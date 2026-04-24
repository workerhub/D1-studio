import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { getSlotDb } from '../db/schema';

type SchemaRow = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
type TableInfo = { name: string; columns: SchemaRow[] };

const query = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// GET /api/query/databases
query.get('/databases', async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const userId = parseInt(payload.sub);

  let slots: { slot_index: number; display_name: string }[];

  if (payload.role === 'admin') {
    const result = await c.env.APP_DB
      .prepare(`SELECT slot_index, display_name FROM ${prefix}_db_slots WHERE is_active = 1 ORDER BY slot_index`)
      .all<{ slot_index: number; display_name: string }>();
    slots = result.results;
  } else {
    const result = await c.env.APP_DB
      .prepare(
        `SELECT s.slot_index, s.display_name FROM ${prefix}_db_slots s
         INNER JOIN ${prefix}_db_permissions p ON p.slot_index = s.slot_index
         WHERE p.user_id = ? AND s.is_active = 1 ORDER BY s.slot_index`
      )
      .bind(userId)
      .all<{ slot_index: number; display_name: string }>();
    slots = result.results;
  }

  return c.json({ databases: slots });
});

// GET /api/query/schema/:slotIndex
query.get('/schema/:slotIndex', async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const slotIndex = parseInt(c.req.param('slotIndex'));
  const userId = parseInt(payload.sub);

  if (payload.role !== 'admin') {
    const perm = await c.env.APP_DB
      .prepare(`SELECT 1 FROM ${prefix}_db_permissions WHERE user_id = ? AND slot_index = ?`)
      .bind(userId, slotIndex)
      .first();
    if (!perm) return c.json({ error: 'Forbidden' }, 403);
  }

  const db = getSlotDb(c.env, slotIndex);
  if (!db) return c.json({ error: 'Invalid slot' }, 400);

  const tables = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all<{ name: string }>();

  const schema: TableInfo[] = [];

  for (const table of tables.results) {
    // PRAGMA does not support parameterized queries; use double-quote escaping to prevent injection
    const columns = await db
      .prepare(`PRAGMA table_info("${table.name.replace(/"/g, '""')}")`)
      .all<SchemaRow>();
    schema.push({ name: table.name, columns: columns.results });
  }

  return c.json({ schema });
});

// POST /api/query/execute
query.post('/execute', async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ sql: string; slotIndex: number }>();
  const { sql, slotIndex } = body;
  const userId = parseInt(payload.sub);

  if (!sql?.trim()) return c.json({ error: 'SQL is required' }, 400);

  if (payload.role !== 'admin') {
    const perm = await c.env.APP_DB
      .prepare(`SELECT 1 FROM ${prefix}_db_permissions WHERE user_id = ? AND slot_index = ?`)
      .bind(userId, slotIndex)
      .first();
    if (!perm) return c.json({ error: 'Forbidden' }, 403);
  }

  const db = getSlotDb(c.env, slotIndex);
  if (!db) return c.json({ error: 'Invalid slot' }, 400);

  const trimmed = sql.trim().toUpperCase();
  const isSelect =
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('PRAGMA') ||
    trimmed.startsWith('EXPLAIN');

  const start = Date.now();
  let status = 'success';
  let errorMessage: string | null = null;
  let columns: string[] = [];
  let rows: unknown[][] = [];
  let rowsAffected = 0;

  try {
    if (isSelect) {
      // Strip trailing semicolon and whitespace, then enforce 5000-row limit.
      // Note: complex subquery wrapping cannot easily be prevented without a full
      // SQL parser; the LIMIT here guards against accidental large result sets.
      const sanitized = sql.replace(/;\s*$/, '').trim();
      const limitedSql = `SELECT * FROM (${sanitized}) LIMIT 5000`;
      const result = await db.prepare(limitedSql).all();
      if (result.results.length > 0) {
        columns = Object.keys(result.results[0] as object);
        rows = result.results.map((r) => columns.map((col) => (r as Record<string, unknown>)[col]));
      }
      rowsAffected = result.results.length;
    } else {
      const result = await db.prepare(sql).run();
      rowsAffected = result.meta.changes ?? 0;
    }
  } catch (err) {
    status = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const executionTime = Date.now() - start;

  await c.env.APP_DB
    .prepare(
      `INSERT INTO ${prefix}_query_history (user_id, slot_index, sql_text, status, rows_affected, error_message, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, slotIndex, sql, status, rowsAffected, errorMessage, Date.now())
    .run();

  if (status === 'error') {
    return c.json({ error: errorMessage }, 400);
  }

  return c.json({ columns, rows, rowsAffected, isSelect, executionTime });
});

export default query;
