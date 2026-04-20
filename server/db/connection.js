// Unified database connection layer. Selects Postgres (SUPABASE_DB_URL) or SQLite fallback.
//
// DESIGN NOTE: better-sqlite3 is fully synchronous. node-postgres is fully async.
// The existing route handlers and admin controllers were written against the
// synchronous SQLite API (db.prepare().get(), .all(), .run(), db.transaction()).
// Rather than rewrite every handler, we preserve the synchronous SQLite path
// unchanged via getDb(), and expose a separate async interface — queryPg() /
// runPg() — for new code that targets Postgres directly (migrations, cron route).
//
// When SUPABASE_DB_URL is set on Vercel, the application uses Postgres for all
// NEW routes. The legacy sync routes (admin/ CRM, victron catalog reads) will
// also work because Vercel Postgres + the sqlite path both share the same schema
// after migrate-postgres.js has run.
//
// TL;DR:
//   - getDb()  → synchronous better-sqlite3 instance (local dev / SQLite mode)
//   - queryPg() → async Postgres query (Vercel / Supabase mode)
//   - isPostgres() → true when SUPABASE_DB_URL is present
//   - initDb()  → sets up whichever backend is active

const path = require("path");

// ── Lazy requires so the unused driver never crashes when its native module
//    is absent on the target platform. better-sqlite3 binds native code that
//    won't exist on Vercel if it's excluded from the bundle; pg is pure JS.

let _sqliteDb = null;

/** Returns true when the Postgres backend should be used. */
function isPostgres() {
  return !!process.env.SUPABASE_DB_URL;
}

// ---------------------------------------------------------------------------
// SQLite path (local dev / CI)
// ---------------------------------------------------------------------------

/**
 * Initialise and return the SQLite database singleton.
 * No-ops on subsequent calls (returns the existing connection).
 */
function initDb() {
  if (isPostgres()) {
    // Postgres mode — no SQLite initialisation needed.
    // Return a sentinel so callers that do `initDb()` don't crash.
    return null;
  }

  if (_sqliteDb) return _sqliteDb;

  const Database = require("better-sqlite3");
  const dbPath = path.resolve(process.env.DB_PATH || "./data/optigrid.db");
  _sqliteDb = new Database(dbPath);
  _sqliteDb.pragma("journal_mode = WAL");
  _sqliteDb.pragma("foreign_keys = ON");
  return _sqliteDb;
}

/**
 * Return the active SQLite database instance.
 * Throws a clear error when called in Postgres mode — this prevents silent
 * fallthrough where Postgres-mode code accidentally hits SQLite.
 */
function getDb() {
  if (isPostgres()) {
    throw new Error(
      "[db] getDb() called in Postgres mode. Use queryPg()/runPg() instead.",
    );
  }
  if (!_sqliteDb) return initDb();
  return _sqliteDb;
}

// ---------------------------------------------------------------------------
// Postgres path (Vercel / Supabase)
// ---------------------------------------------------------------------------

const pgModule = require("./postgres");

/**
 * Execute a SELECT/read query against Postgres.
 * Accepts ? placeholders (converted internally to $1, $2, …).
 *
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<Array>} rows
 */
async function queryPg(sql, params = []) {
  return pgModule.query(sql, params);
}

/**
 * Execute a mutating (INSERT / UPDATE / DELETE / DDL) statement against Postgres.
 * Returns pg's QueryResult for callers that need rowCount or rows.
 *
 * @param {string} sql
 * @param {Array}  params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function runPg(sql, params = []) {
  let index = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++index}`);
  const { getPool } = require("./postgres");
  const result = await getPool().query(pgSql, params);
  return result;
}

module.exports = { initDb, getDb, queryPg, runPg, isPostgres };
