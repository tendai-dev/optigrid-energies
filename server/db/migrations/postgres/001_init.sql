-- Initial Postgres schema for OptiGrid Energies.
-- Mirrors the SQLite schema from server/db/migrate.js (migrations 1 + 2).
-- Differences from SQLite:
--   TEXT instead of VARCHAR, TIMESTAMPTZ instead of TEXT for timestamps,
--   SERIAL instead of INTEGER AUTOINCREMENT (keeps integer PKs for compatibility
--   with existing admin/ routes that pass numeric IDs), REAL → NUMERIC for money.

-- ─────────────────────────────────────────────────────────────────────────────
-- Victron catalog (migration 1 equivalent)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS victron_categories (
  id            SERIAL PRIMARY KEY,
  name          TEXT    NOT NULL UNIQUE,
  slug          TEXT    NOT NULL UNIQUE,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS victron_products (
  id                SERIAL PRIMARY KEY,
  external_id       TEXT    NOT NULL UNIQUE,
  slug              TEXT    NOT NULL UNIQUE,
  name              TEXT    NOT NULL,
  short_name        TEXT,
  model             TEXT,
  sku               TEXT,
  category_id       INTEGER,
  short_description TEXT,
  full_description  TEXT,
  product_url       TEXT,
  image_url         TEXT,
  modified_at       TEXT,
  raw_payload       TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS victron_product_documents (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER     NOT NULL,
  external_id   TEXT,
  type          TEXT        NOT NULL,
  title         TEXT,
  url           TEXT        NOT NULL,
  file_format   TEXT,
  language      TEXT        DEFAULT 'en',
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON victron_products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug      ON victron_products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active    ON victron_products(is_active);
CREATE INDEX IF NOT EXISTS idx_documents_product  ON victron_product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_documents_type     ON victron_product_documents(type);

-- ─────────────────────────────────────────────────────────────────────────────
-- CRM schema (migration 2 equivalent)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id         SERIAL PRIMARY KEY,
  name       TEXT    NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  city       TEXT,
  type       TEXT    NOT NULL CHECK (type IN ('residential', 'commercial')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotations (
  id               SERIAL PRIMARY KEY,
  quotation_number TEXT    UNIQUE NOT NULL,
  client_id        INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  subtotal         NUMERIC NOT NULL DEFAULT 0,
  vat_rate         NUMERIC NOT NULL DEFAULT 15.0,
  vat_amount       NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  notes            TEXT,
  valid_until      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id           SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL,
  description  TEXT    NOT NULL,
  quantity     NUMERIC NOT NULL DEFAULT 1,
  unit         TEXT    DEFAULT 'unit',
  unit_price   NUMERIC NOT NULL,
  total        NUMERIC NOT NULL,
  sort_order   INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

CREATE TABLE IF NOT EXISTS projects (
  id                  SERIAL PRIMARY KEY,
  project_number      TEXT    UNIQUE NOT NULL,
  client_id           INTEGER NOT NULL,
  quotation_id        INTEGER,
  type                TEXT    NOT NULL CHECK (type IN ('residential', 'commercial')),
  status              TEXT    NOT NULL DEFAULT 'planning'
                        CHECK (status IN ('planning', 'procurement', 'installation', 'commissioning', 'completed')),
  title               TEXT    NOT NULL,
  site_address        TEXT,
  gps_lat             NUMERIC,
  gps_lng             NUMERIC,
  panel_count         INTEGER,
  capacity_kw         NUMERIC,
  inverter_details    TEXT,
  battery_details     TEXT,
  start_date          TEXT,
  expected_completion TEXT,
  actual_completion   TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client    ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_quotation ON projects(quotation_id);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(status);

CREATE TABLE IF NOT EXISTS receipts (
  id                SERIAL PRIMARY KEY,
  receipt_number    TEXT    UNIQUE NOT NULL,
  project_id        INTEGER NOT NULL,
  client_id         INTEGER NOT NULL,
  amount            NUMERIC NOT NULL,
  payment_method    TEXT    NOT NULL
                      CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'other')),
  payment_reference TEXT,
  notes             TEXT,
  paid_at           TEXT    NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_project ON receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_client  ON receipts(client_id);

-- Session store (used by express-session SQLiteStore / Postgres fallback)
CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  sess    TEXT NOT NULL,
  expired TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
