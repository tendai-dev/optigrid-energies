const path = require("path");
const Database = require("better-sqlite3");

let db = null;

/**
 * Initialize (or return existing) SQLite connection.
 * Enables WAL mode and foreign keys for performance and integrity.
 */
function initDb() {
  if (db) return db;

  const dbPath = path.resolve(process.env.DB_PATH || "./data/optigrid.db");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

/** Return the active database instance. */
function getDb() {
  if (!db) return initDb();
  return db;
}

module.exports = { initDb, getDb };
