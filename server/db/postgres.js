// Postgres connection pool using node-postgres (pg). Used when SUPABASE_DB_URL is set.

const { Pool } = require("pg");

let pool = null;

/**
 * Returns a singleton pg Pool configured from SUPABASE_DB_URL.
 * Reuses the pool across serverless invocations in the same process/container.
 * Throws if SUPABASE_DB_URL is not set.
 */
function getPool() {
  if (pool) return pool;

  if (!process.env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is not set — cannot create Postgres pool");
  }

  pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    // Supabase enforces SSL on all connections
    ssl: { rejectUnauthorized: false },
    // Conservative pool size for serverless — each invocation runs briefly
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    console.error("[postgres] Unexpected pool error:", err.message);
  });

  return pool;
}

/**
 * Execute a parameterised SQL query against Postgres.
 * Converts better-sqlite3's positional `?` placeholders to pg's `$1, $2, ...` style.
 *
 * @param {string} sql - SQL with `?` placeholders
 * @param {Array} params - Bound parameter values
 * @returns {Promise<Array>} Array of result rows
 */
async function query(sql, params = []) {
  // Translate ? positional placeholders → $1 $2 … so the same SQL strings work
  // with both SQLite and Postgres without duplication.
  let index = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++index}`);

  const client = getPool();
  const result = await client.query(pgSql, params);
  return result.rows;
}

module.exports = { getPool, query };
