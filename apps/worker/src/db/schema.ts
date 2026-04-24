import type { Env } from '../types';

export async function initDb(db: D1Database, prefix: string): Promise<void> {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS ${prefix}_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      email_otp_enabled INTEGER NOT NULL DEFAULT 0,
      passkey_enabled INTEGER NOT NULL DEFAULT 0,
      confirm_write_ops INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_totp_secrets (
      user_id INTEGER PRIMARY KEY,
      secret TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_passkeys (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_db_slots (
      slot_index INTEGER PRIMARY KEY,
      display_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_db_permissions (
      user_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL,
      PRIMARY KEY (user_id, slot_index)
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_query_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      slot_index INTEGER NOT NULL,
      sql_text TEXT NOT NULL,
      status TEXT NOT NULL,
      rows_affected INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      executed_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];

  for (const sql of stmts) {
    await db.prepare(sql).run();
  }

  await db
    .prepare(`INSERT OR IGNORE INTO ${prefix}_settings (key, value) VALUES (?, ?)`)
    .bind('history_retention_days', '30')
    .run();

  for (let i = 1; i <= 10; i++) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO ${prefix}_db_slots (slot_index, display_name, is_active) VALUES (?, ?, 0)`
      )
      .bind(i, `DB Slot ${i}`)
      .run();
  }
}

export function getSlotDb(env: Env, slotIndex: number): D1Database | null {
  const map: Record<number, D1Database> = {
    1: env.DB_SLOT_1,
    2: env.DB_SLOT_2,
    3: env.DB_SLOT_3,
    4: env.DB_SLOT_4,
    5: env.DB_SLOT_5,
    6: env.DB_SLOT_6,
    7: env.DB_SLOT_7,
    8: env.DB_SLOT_8,
    9: env.DB_SLOT_9,
    10: env.DB_SLOT_10,
  };
  return map[slotIndex] ?? null;
}
