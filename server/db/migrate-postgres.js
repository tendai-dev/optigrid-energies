// Postgres migration runner. Reads SQL files from migrations/postgres/ in
// filename order, executes each one, and tracks applied migrations in _migrations.
// Run via: npm run migrate:pg

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { getPool } = require("./postgres");

const MIGRATIONS_DIR = path.join(__dirname, "migrations", "postgres");

/**
 * Ensure the _migrations tracking table exists in the target Postgres database.
 * @param {import('pg').PoolClient} client
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version  INTEGER PRIMARY KEY,
      name     TEXT    NOT NULL,
      applied  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Return the set of already-applied migration version numbers.
 * @param {import('pg').PoolClient} client
 * @returns {Promise<Set<number>>}
 */
async function appliedVersions(client) {
  const result = await client.query("SELECT version FROM _migrations");
  return new Set(result.rows.map((r) => r.version));
}

/**
 * Parse the version number from a migration filename like "001_init.sql".
 * Returns NaN if the filename does not start with digits.
 * @param {string} filename
 * @returns {number}
 */
function parseVersion(filename) {
  return parseInt(filename.split("_")[0], 10);
}

/**
 * Run all pending Postgres migrations in version order.
 * Each migration runs inside its own transaction so a failure rolls back only
 * that migration, leaving earlier ones intact.
 */
async function runPostgresMigrations() {
  if (!process.env.SUPABASE_DB_URL) {
    console.error(
      "[migrate:pg] SUPABASE_DB_URL is not set. Cannot run Postgres migrations.",
    );
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);

    // Collect and sort SQL files by version prefix
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ranCount = 0;

    for (const file of files) {
      const version = parseVersion(file);
      if (isNaN(version)) {
        console.warn(`[migrate:pg] Skipping ${file} — no version prefix`);
        continue;
      }

      if (applied.has(version)) {
        console.log(`[migrate:pg] ${file} — already applied, skipping`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const name = file.replace(/\.sql$/, "");

      console.log(`[migrate:pg] Applying ${file}…`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (version, name) VALUES ($1, $2)",
          [version, name],
        );
        await client.query("COMMIT");
        console.log(`[migrate:pg] ${file} — applied`);
        ranCount++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate:pg] ${file} — FAILED: ${err.message}`);
        throw err;
      }
    }

    if (ranCount === 0) {
      console.log("[migrate:pg] No pending migrations.");
    } else {
      console.log(`[migrate:pg] ${ranCount} migration(s) applied.`);
    }
  } finally {
    client.release();
  }
}

// Allow: node server/db/migrate-postgres.js
if (require.main === module) {
  runPostgresMigrations()
    .then(() => {
      console.log("[migrate:pg] Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate:pg] Migration failed:", err.message);
      process.exit(1);
    });
}

module.exports = { runPostgresMigrations };
