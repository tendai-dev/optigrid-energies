const { getDb } = require('./connection');

// ---------------------------------------------------------------------------
// Migration definitions — add new migrations at the end of this array.
// Each migration runs inside a transaction.
// ---------------------------------------------------------------------------
const migrations = [
  {
    version: 1,
    name: 'victron_schema',
    up: `
      CREATE TABLE IF NOT EXISTS victron_categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        slug        TEXT NOT NULL UNIQUE,
        product_count INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS victron_products (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id       TEXT NOT NULL UNIQUE,
        slug              TEXT NOT NULL UNIQUE,
        name              TEXT NOT NULL,
        short_name        TEXT,
        model             TEXT,
        sku               TEXT,
        category_id       INTEGER REFERENCES victron_categories(id),
        short_description TEXT,
        full_description  TEXT,
        product_url       TEXT,
        image_url         TEXT,
        modified_at       TEXT,
        raw_payload       TEXT,
        is_active         INTEGER NOT NULL DEFAULT 1,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS victron_product_documents (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id    INTEGER NOT NULL REFERENCES victron_products(id) ON DELETE CASCADE,
        external_id   TEXT,
        type          TEXT NOT NULL,
        title         TEXT,
        url           TEXT NOT NULL,
        file_format   TEXT,
        language      TEXT DEFAULT 'en',
        sort_order    INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_products_category ON victron_products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_slug ON victron_products(slug);
      CREATE INDEX IF NOT EXISTS idx_products_active ON victron_products(is_active);
      CREATE INDEX IF NOT EXISTS idx_documents_product ON victron_product_documents(product_id);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON victron_product_documents(type);
    `,
  },
];

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------
function runMigrations() {
  const db = getDb();

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version  INTEGER PRIMARY KEY,
      name     TEXT NOT NULL,
      applied  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM _migrations').all().map((r) => r.version)
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    const run = db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    });

    run();
    console.log(`Migration ${migration.version} (${migration.name}) applied.`);
  }
}

// Allow running directly: node server/db/migrate.js
if (require.main === module) {
  const { initDb } = require('./connection');
  const fs = require('fs');
  const path = require('path');
  const dbDir = path.dirname(process.env.DB_PATH || './data/optigrid.db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  initDb();
  runMigrations();
  console.log('All migrations complete.');
}

module.exports = { runMigrations };
