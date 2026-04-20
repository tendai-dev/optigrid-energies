const { getDb } = require("./connection");

// ---------------------------------------------------------------------------
// Migration definitions — add new migrations at the end of this array.
// Each migration runs inside a transaction.
// ---------------------------------------------------------------------------
const migrations = [
  {
    version: 1,
    name: "victron_schema",
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
  {
    version: 2,
    name: "crm_schema",
    up: `
      CREATE TABLE IF NOT EXISTS clients (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT,
        phone      TEXT,
        address    TEXT,
        city       TEXT,
        type       TEXT NOT NULL CHECK (type IN ('residential', 'commercial')),
        notes      TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quotations (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_number TEXT UNIQUE NOT NULL,
        client_id        INTEGER NOT NULL REFERENCES clients(id),
        status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
        subtotal         REAL NOT NULL DEFAULT 0,
        vat_rate         REAL NOT NULL DEFAULT 15.0,
        vat_amount       REAL NOT NULL DEFAULT 0,
        total            REAL NOT NULL DEFAULT 0,
        notes            TEXT,
        valid_until      TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quotation_items (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        description  TEXT NOT NULL,
        quantity     REAL NOT NULL DEFAULT 1,
        unit         TEXT DEFAULT 'unit',
        unit_price   REAL NOT NULL,
        total        REAL NOT NULL,
        sort_order   INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

      CREATE TABLE IF NOT EXISTS projects (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        project_number      TEXT UNIQUE NOT NULL,
        client_id           INTEGER NOT NULL REFERENCES clients(id),
        quotation_id        INTEGER REFERENCES quotations(id),
        type                TEXT NOT NULL CHECK (type IN ('residential', 'commercial')),
        status              TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'procurement', 'installation', 'commissioning', 'completed')),
        title               TEXT NOT NULL,
        site_address        TEXT,
        gps_lat             REAL,
        gps_lng             REAL,
        panel_count         INTEGER,
        capacity_kw         REAL,
        inverter_details    TEXT,
        battery_details     TEXT,
        start_date          TEXT,
        expected_completion TEXT,
        actual_completion   TEXT,
        notes               TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_projects_quotation ON projects(quotation_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

      CREATE TABLE IF NOT EXISTS receipts (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number    TEXT UNIQUE NOT NULL,
        project_id        INTEGER NOT NULL REFERENCES projects(id),
        client_id         INTEGER NOT NULL REFERENCES clients(id),
        amount            REAL NOT NULL,
        payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'other')),
        payment_reference TEXT,
        notes             TEXT,
        paid_at           TEXT NOT NULL,
        created_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_project ON receipts(project_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_client ON receipts(client_id);

      CREATE TABLE IF NOT EXISTS sessions (
        sid     TEXT PRIMARY KEY,
        sess    TEXT NOT NULL,
        expired TEXT
      );
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
    db
      .prepare("SELECT version FROM _migrations")
      .all()
      .map((r) => r.version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    const run = db.transaction(() => {
      db.exec(migration.up);
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );
    });

    run();
    console.log(`Migration ${migration.version} (${migration.name}) applied.`);
  }
}

// Allow running directly: node server/db/migrate.js
if (require.main === module) {
  const { initDb } = require("./connection");
  const fs = require("fs");
  const path = require("path");
  const dbDir = path.dirname(process.env.DB_PATH || "./data/optigrid.db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  initDb();
  runMigrations();
  console.log("All migrations complete.");
}

module.exports = { runMigrations };
