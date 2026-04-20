/**
 * Victron product sync service.
 *
 * Fetches the Victron XML feed, parses it, and upserts products + documents
 * into the SQLite database. Designed for idempotent re-runs.
 */

const https = require("https");
const http = require("http");
const { getDb } = require("../db/connection");
const { parseVictronFeed, slugify } = require("./parser");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FEED_URL =
  process.env.VICTRON_FEED_URL ||
  "https://www.victronenergy.com/api/v1/products?format=xml";
const FETCH_TIMEOUT =
  parseInt(process.env.VICTRON_FETCH_TIMEOUT_MS, 10) || 30000;

// ---------------------------------------------------------------------------
// HTTP fetcher with timeout
// ---------------------------------------------------------------------------
function fetchXml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode} from Victron feed`));
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.setTimeout(FETCH_TIMEOUT, () => {
      req.destroy();
      reject(
        new Error(`Victron feed request timed out after ${FETCH_TIMEOUT}ms`),
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/** Get or create a category, returning its ID. */
function upsertCategory(db, name) {
  const slug = slugify(name);
  const existing = db
    .prepare("SELECT id FROM victron_categories WHERE slug = ?")
    .get(slug);
  if (existing) return existing.id;

  const result = db
    .prepare("INSERT INTO victron_categories (name, slug) VALUES (?, ?)")
    .run(name, slug);
  return result.lastInsertRowid;
}

/** Upsert a single product and its documents. Returns 'inserted' | 'updated' | 'skipped'. */
function upsertProduct(db, product, categoryId) {
  const existing = db
    .prepare(
      "SELECT id, modified_at FROM victron_products WHERE external_id = ?",
    )
    .get(product.external_id);

  let productId;
  let action;

  // Ensure unique slug by appending external_id if collision exists
  let slug = product.slug;
  const slugCollision = db
    .prepare(
      "SELECT id FROM victron_products WHERE slug = ? AND external_id != ?",
    )
    .get(slug, product.external_id);
  if (slugCollision) {
    slug = `${slug}-${product.external_id}`;
  }

  if (existing) {
    // Skip if not modified since last sync
    if (existing.modified_at === product.modified_at) {
      return { action: "skipped", productId: existing.id };
    }

    db.prepare(
      `
      UPDATE victron_products SET
        slug = ?, name = ?, short_name = ?, model = ?, sku = ?,
        category_id = ?, short_description = ?, full_description = ?,
        product_url = ?, image_url = ?, modified_at = ?,
        raw_payload = ?, is_active = 1, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      slug,
      product.name,
      product.short_name,
      product.model,
      product.sku,
      categoryId,
      product.short_description,
      product.full_description,
      product.product_url,
      product.image_url,
      product.modified_at,
      product.raw_payload,
      existing.id,
    );
    productId = existing.id;
    action = "updated";
  } else {
    const result = db
      .prepare(
        `
      INSERT INTO victron_products
        (external_id, slug, name, short_name, model, sku, category_id,
         short_description, full_description, product_url, image_url,
         modified_at, raw_payload, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
      )
      .run(
        product.external_id,
        slug,
        product.name,
        product.short_name,
        product.model,
        product.sku,
        categoryId,
        product.short_description,
        product.full_description,
        product.product_url,
        product.image_url,
        product.modified_at,
        product.raw_payload,
      );
    productId = result.lastInsertRowid;
    action = "inserted";
  }

  // Replace documents — delete old, insert new
  db.prepare("DELETE FROM victron_product_documents WHERE product_id = ?").run(
    productId,
  );

  const insertDoc = db.prepare(`
    INSERT INTO victron_product_documents
      (product_id, external_id, type, title, url, file_format, language, sort_order, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, 'en', ?, ?)
  `);

  for (let i = 0; i < product.documents.length; i++) {
    const doc = product.documents[i];
    insertDoc.run(
      productId,
      doc.external_id,
      doc.type,
      doc.title,
      doc.url,
      doc.file_format,
      i,
      doc.metadata_json,
    );
  }

  return { action, productId };
}

/** Update product_count on all categories. */
function refreshCategoryCounts(db) {
  db.exec(`
    UPDATE victron_categories SET product_count = (
      SELECT COUNT(*) FROM victron_products
      WHERE victron_products.category_id = victron_categories.id AND is_active = 1
    ), updated_at = datetime('now')
  `);
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Run a full Victron product sync.
 * @returns {Object} Sync result summary
 */
async function syncVictronProducts() {
  const startTime = Date.now();
  const result = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log(`[victron-sync] Fetching feed from ${FEED_URL}`);
  let xml;
  try {
    xml = await fetchXml(FEED_URL);
  } catch (err) {
    console.error(`[victron-sync] Fetch failed: ${err.message}`);
    result.errors.push(`Fetch failed: ${err.message}`);
    return result;
  }

  console.log(
    `[victron-sync] Parsing XML (${(xml.length / 1024).toFixed(0)} KB)`,
  );
  let products;
  try {
    products = await parseVictronFeed(xml);
  } catch (err) {
    console.error(`[victron-sync] Parse failed: ${err.message}`);
    result.errors.push(`Parse failed: ${err.message}`);
    return result;
  }

  result.total = products.length;
  console.log(
    `[victron-sync] Parsed ${products.length} products. Upserting...`,
  );

  const db = getDb();

  // Run all upserts in a single transaction for performance
  const syncAll = db.transaction(() => {
    for (const product of products) {
      try {
        const categoryId = upsertCategory(db, product.category);
        const { action } = upsertProduct(db, product, categoryId);
        result[action]++;
      } catch (err) {
        result.failed++;
        result.errors.push(`${product.name}: ${err.message}`);
        console.warn(`[victron-sync] Failed: ${product.name} — ${err.message}`);
      }
    }

    refreshCategoryCounts(db);
  });

  syncAll();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[victron-sync] Done in ${elapsed}s — ` +
      `${result.inserted} inserted, ${result.updated} updated, ` +
      `${result.skipped} skipped, ${result.failed} failed`,
  );

  return result;
}

module.exports = { syncVictronProducts };
