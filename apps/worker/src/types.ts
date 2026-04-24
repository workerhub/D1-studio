export type Env = {
  APP_DB: D1Database;
  DB_SLOT_1: D1Database;
  DB_SLOT_2: D1Database;
  DB_SLOT_3: D1Database;
  DB_SLOT_4: D1Database;
  DB_SLOT_5: D1Database;
  DB_SLOT_6: D1Database;
  DB_SLOT_7: D1Database;
  DB_SLOT_8: D1Database;
  DB_SLOT_9: D1Database;
  DB_SLOT_10: D1Database;
  TABLE_PREFIX: string;
  JWT_SECRET: string;
  EMAIL_PROVIDER: string;
  RESEND_API_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  __STATIC_CONTENT: KVNamespace;
};

export type JwtPayload = {
  sub: string;
  username: string;
  role: string;
  sessionId: string;
  iat?: number;
  exp?: number;
};
