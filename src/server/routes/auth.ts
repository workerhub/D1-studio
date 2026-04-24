import { Hono } from 'hono';
import { SignJWT } from 'jose';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import type { Env, JwtPayload } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendEmail } from '../email/index';

type PreAuthEntry = {
  userId: number;
  username: string;
  role: string;
  methods: { totp: boolean; emailOtp: boolean; passkey: boolean };
  emailOtp?: string;
  expiresAt: number;
};

// Module-level store for pre-auth tokens (expires in 10 min)
const preAuthStore = new Map<string, PreAuthEntry>();

async function signAccessToken(env: Env, payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

async function signRefreshToken(env: Env, payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  role: string;
  is_active: number;
  totp_enabled: number;
  email_otp_enabled: number;
  passkey_enabled: number;
  confirm_write_ops: number;
};

const auth = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<{ username: string; password: string }>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const prefix = c.env.TABLE_PREFIX;
  const user = await c.env.APP_DB
    .prepare(`SELECT * FROM ${prefix}_users WHERE username = ? AND is_active = 1`)
    .bind(username)
    .first<UserRow>();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const requires2fa = user.totp_enabled || user.email_otp_enabled || user.passkey_enabled;

  if (requires2fa) {
    const preAuthToken = crypto.randomUUID();
    const entry: PreAuthEntry = {
      userId: user.id,
      username: user.username,
      role: user.role,
      methods: {
        totp: !!user.totp_enabled,
        emailOtp: !!user.email_otp_enabled,
        passkey: !!user.passkey_enabled,
      },
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // If email OTP is enabled, generate and send code
    if (user.email_otp_enabled && user.email) {
      // Generate an unbiased 6-digit OTP using rejection sampling on a 4-byte random value
      const randomUint32 = () => {
        const buf = new Uint8Array(4);
        crypto.getRandomValues(buf);
        return ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
      };
      const otp = String(randomUint32() % 1_000_000).padStart(6, '0');
      entry.emailOtp = otp;
      try {
        await sendEmail(c.env, {
          to: user.email,
          subject: 'D1Studio Login Verification Code',
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        });
      } catch {
        // Non-fatal: user can still use TOTP/passkey
      }
    }

    preAuthStore.set(preAuthToken, entry);

    return c.json({
      requires2fa: true,
      preAuthToken,
      methods: entry.methods,
    });
  }

  // No 2FA — create session and return tokens
  const sessionId = crypto.randomUUID();
  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    sessionId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(c.env, tokenPayload),
    signRefreshToken(c.env, tokenPayload),
  ]);

  const tokenHash = await hashToken(refreshToken);
  await c.env.APP_DB
    .prepare(`INSERT INTO ${prefix}_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(sessionId, user.id, tokenHash, Date.now() + 7 * 24 * 60 * 60 * 1000, Date.now())
    .run();

  return c.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      totp_enabled: user.totp_enabled,
      email_otp_enabled: user.email_otp_enabled,
      passkey_enabled: user.passkey_enabled,
      confirm_write_ops: user.confirm_write_ops,
    },
  });
});

// POST /api/auth/verify-otp
auth.post('/verify-otp', async (c) => {
  const body = await c.req.json<{ preAuthToken: string; code: string; method: 'totp' | 'email' }>();
  const { preAuthToken, code, method } = body;

  const entry = preAuthStore.get(preAuthToken);
  if (!entry || Date.now() > entry.expiresAt) {
    preAuthStore.delete(preAuthToken);
    return c.json({ error: 'Invalid or expired pre-auth token' }, 401);
  }

  const prefix = c.env.TABLE_PREFIX;

  if (method === 'totp') {
    const totpRow = await c.env.APP_DB
      .prepare(`SELECT secret FROM ${prefix}_totp_secrets WHERE user_id = ? AND is_verified = 1`)
      .bind(entry.userId)
      .first<{ secret: string }>();

    if (!totpRow) return c.json({ error: 'TOTP not configured' }, 400);

    const valid = authenticator.verify({ token: code, secret: totpRow.secret });
    if (!valid) return c.json({ error: 'Invalid TOTP code' }, 401);
  } else if (method === 'email') {
    if (!entry.emailOtp || entry.emailOtp !== code) {
      return c.json({ error: 'Invalid email OTP' }, 401);
    }
  } else {
    return c.json({ error: 'Unsupported method' }, 400);
  }

  // Invalidate pre-auth token immediately
  preAuthStore.delete(preAuthToken);

  const sessionId = crypto.randomUUID();
  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: String(entry.userId),
    username: entry.username,
    role: entry.role,
    sessionId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(c.env, tokenPayload),
    signRefreshToken(c.env, tokenPayload),
  ]);

  const tokenHash = await hashToken(refreshToken);
  await c.env.APP_DB
    .prepare(`INSERT INTO ${prefix}_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(sessionId, entry.userId, tokenHash, Date.now() + 7 * 24 * 60 * 60 * 1000, Date.now())
    .run();

  const user = await c.env.APP_DB
    .prepare(`SELECT id, username, email, role, is_active, totp_enabled, email_otp_enabled, passkey_enabled, confirm_write_ops FROM ${prefix}_users WHERE id = ?`)
    .bind(entry.userId)
    .first<Omit<UserRow, 'password_hash'>>();

  return c.json({ accessToken, refreshToken, user });
});

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken: string }>();
  const { refreshToken } = body;

  if (!refreshToken) return c.json({ error: 'Refresh token required' }, 400);

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(refreshToken, secret);
    const jwtPayload = payload as unknown as JwtPayload;

    const prefix = c.env.TABLE_PREFIX;
    const tokenHash = await hashToken(refreshToken);
    const session = await c.env.APP_DB
      .prepare(`SELECT * FROM ${prefix}_sessions WHERE id = ? AND token_hash = ? AND expires_at > ?`)
      .bind(jwtPayload.sessionId, tokenHash, Date.now())
      .first();

    if (!session) return c.json({ error: 'Invalid session' }, 401);

    const newAccessToken = await signAccessToken(c.env, {
      sub: jwtPayload.sub,
      username: jwtPayload.username,
      role: jwtPayload.role,
      sessionId: jwtPayload.sessionId,
    });

    return c.json({ accessToken: newAccessToken });
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

// POST /api/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;

  await c.env.APP_DB
    .prepare(`DELETE FROM ${prefix}_sessions WHERE id = ?`)
    .bind(payload.sessionId)
    .run();

  return c.json({ ok: true });
});

// GET /api/auth/me
auth.get('/me', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;

  const user = await c.env.APP_DB
    .prepare(`SELECT id, username, email, role, is_active, totp_enabled, email_otp_enabled, passkey_enabled, confirm_write_ops FROM ${prefix}_users WHERE id = ?`)
    .bind(parseInt(payload.sub))
    .first();

  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json({ user });
});

// POST /api/auth/2fa/totp/setup
auth.post('/2fa/totp/setup', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;

  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(payload.username, 'D1Studio', secret);

  await c.env.APP_DB
    .prepare(`INSERT OR REPLACE INTO ${prefix}_totp_secrets (user_id, secret, is_verified) VALUES (?, ?, 0)`)
    .bind(parseInt(payload.sub), secret)
    .run();

  return c.json({ secret, otpauthUrl });
});

// POST /api/auth/2fa/totp/verify
auth.post('/2fa/totp/verify', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ code: string }>();

  const totpRow = await c.env.APP_DB
    .prepare(`SELECT secret FROM ${prefix}_totp_secrets WHERE user_id = ?`)
    .bind(parseInt(payload.sub))
    .first<{ secret: string }>();

  if (!totpRow) return c.json({ error: 'TOTP not set up' }, 400);

  const valid = authenticator.verify({ token: body.code, secret: totpRow.secret });
  if (!valid) return c.json({ error: 'Invalid TOTP code' }, 400);

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_totp_secrets SET is_verified = 1 WHERE user_id = ?`)
    .bind(parseInt(payload.sub))
    .run();

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET totp_enabled = 1 WHERE id = ?`)
    .bind(parseInt(payload.sub))
    .run();

  return c.json({ ok: true });
});

// POST /api/auth/2fa/email/setup
auth.post('/2fa/email/setup', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ enabled: boolean }>();

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET email_otp_enabled = ? WHERE id = ?`)
    .bind(body.enabled ? 1 : 0, parseInt(payload.sub))
    .run();

  return c.json({ ok: true });
});

// GET /api/auth/passkey/register-options
auth.get('/passkey/register-options', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const challenge = crypto.randomUUID();

  return c.json({
    challenge,
    rp: { name: 'D1Studio', id: new URL(c.req.url).hostname },
    user: {
      id: payload.sub,
      name: payload.username,
      displayName: payload.username,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    attestation: 'none',
  });
});

// POST /api/auth/passkey/register
auth.post('/passkey/register', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ credentialId: string; publicKey: string; signCount: number }>();

  await c.env.APP_DB
    .prepare(`INSERT INTO ${prefix}_passkeys (id, user_id, credential_id, public_key, sign_count, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), parseInt(payload.sub), body.credentialId, body.publicKey, body.signCount ?? 0, Date.now())
    .run();

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET passkey_enabled = 1 WHERE id = ?`)
    .bind(parseInt(payload.sub))
    .run();

  return c.json({ ok: true });
});

// GET /api/auth/passkey/login-options
auth.get('/passkey/login-options', async (c) => {
  const challenge = crypto.randomUUID();

  return c.json({
    challenge,
    timeout: 60000,
    rpId: new URL(c.req.url).hostname,
    userVerification: 'preferred',
  });
});

// POST /api/auth/passkey/login
auth.post('/passkey/login', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ credentialId: string; signCount: number }>();

  const passkey = await c.env.APP_DB
    .prepare(`SELECT * FROM ${prefix}_passkeys WHERE credential_id = ?`)
    .bind(body.credentialId)
    .first<{ id: string; user_id: number; sign_count: number }>();

  if (!passkey) return c.json({ error: 'Passkey not found' }, 401);

  // Update sign count
  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_passkeys SET sign_count = ? WHERE id = ?`)
    .bind(body.signCount, passkey.id)
    .run();

  const user = await c.env.APP_DB
    .prepare(`SELECT id, username, email, role, is_active, totp_enabled, email_otp_enabled, passkey_enabled, confirm_write_ops FROM ${prefix}_users WHERE id = ? AND is_active = 1`)
    .bind(passkey.user_id)
    .first<Omit<UserRow, 'password_hash'>>();

  if (!user) return c.json({ error: 'User not found or inactive' }, 401);

  const sessionId = crypto.randomUUID();
  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
    sessionId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(c.env, tokenPayload),
    signRefreshToken(c.env, tokenPayload),
  ]);

  const tokenHash = await hashToken(refreshToken);
  await c.env.APP_DB
    .prepare(`INSERT INTO ${prefix}_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(sessionId, user.id, tokenHash, Date.now() + 7 * 24 * 60 * 60 * 1000, Date.now())
    .run();

  return c.json({ accessToken, refreshToken, user });
});

// PUT /api/auth/settings
auth.put('/settings', authMiddleware, async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ confirm_write_ops: boolean }>();

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET confirm_write_ops = ? WHERE id = ?`)
    .bind(body.confirm_write_ops ? 1 : 0, parseInt(payload.sub))
    .run();

  return c.json({ ok: true });
});

export default auth;
