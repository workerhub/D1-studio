import type { Env } from '../types';

export type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

async function sendViaResend(env: Env, options: EmailOptions): Promise<void> {
  const from = env.SMTP_FROM ?? 'noreply@d1studio.app';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error: ${response.status} ${text}`);
  }
}

async function sendViaSmtp(env: Env, options: EmailOptions): Promise<void> {
  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT ?? '587';
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration incomplete: SMTP_HOST, SMTP_USER, SMTP_PASS required');
  }

  // Validate host to prevent SSRF
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!hostnameRegex.test(host)) {
    throw new Error('Invalid SMTP_HOST');
  }
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host)) {
    throw new Error('Invalid SMTP_HOST: private addresses not allowed');
  }

  // Cloudflare Workers do not support raw TCP (SMTP protocol).
  // SMTP_HOST must point to an HTTP-based email relay that accepts POST /api/send.
  const relayUrl = `https://${host}:${port}/api/send`;
  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
    },
    body: JSON.stringify({ from, to: options.to, subject: options.subject, html: options.html }),
  });

  if (!response.ok) {
    throw new Error(`SMTP relay error: ${response.status}`);
  }
}

export async function sendEmail(env: Env, options: EmailOptions): Promise<void> {
  const provider = (env.EMAIL_PROVIDER ?? 'resend').toLowerCase();
  if (provider === 'smtp') {
    return sendViaSmtp(env, options);
  }
  return sendViaResend(env, options);
}
