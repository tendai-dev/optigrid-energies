const { Router } = require('express');
const { getDb } = require('../db/connection');
const { syncVictronProducts } = require('./sync');

const router = Router();

// ---------------------------------------------------------------------------
// Middleware: validate admin key for protected endpoints
// ---------------------------------------------------------------------------
function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_SYNC_KEY;
  if (!key) return next(); // No key configured — allow (dev mode)

  const provided = req.headers['x-admin-key'] || req.query.key;
  if (provided !== key) {
    return res.status(403).json({ error: 'Invalid or missing admin key' });
  }
  next();
}

// ---------------------------------------------------------------------------
// GET /api/victron/products
// Supports: ?page, ?limit, ?category, ?search, ?sort, ?type (asset filter)
// ---------------------------------------------------------------------------
router.get('/products', (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;

    const conditions = ['p.is_active = 1'];
    const params = [];

    // Category filter
    if (req.query.category) {
      conditions.push('c.slug = ?');
      params.push(req.query.category);
    }

    // Text search
    if (req.query.search) {
      conditions.push('(p.name LIKE ? OR p.short_description LIKE ? OR p.sku LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    // Asset type filter — only return products that have documents of this type
    if (req.query.type) {
      conditions.push(`p.id IN (SELECT product_id FROM victron_product_documents WHERE type = ?)`);
      params.push(req.query.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting
    const sortMap = {
      name: 'p.name ASC',
      newest: 'p.created_at DESC',
      updated: 'p.updated_at DESC',
    };
    const orderBy = sortMap[req.query.sort] || 'p.name ASC';

    // Count
    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM victron_products p
       LEFT JOIN victron_categories c ON c.id = p.category_id
       ${where}`
    ).get(...params);

    // Fetch products
    const products = db.prepare(`
      SELECT
        p.id, p.slug, p.name, p.short_name, p.model, p.sku,
        p.short_description, p.image_url, p.product_url,
        c.name as category_name, c.slug as category_slug
      FROM victron_products p
      LEFT JOIN victron_categories c ON c.id = p.category_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Attach asset type badges per product
    const docTypesStmt = db.prepare(
      'SELECT DISTINCT type FROM victron_product_documents WHERE product_id = ?'
    );
    for (const product of products) {
      product.asset_types = docTypesStmt.all(product.id).map((r) => r.type);
    }

    res.json({
      data: products,
      pagination: {
        page,
        limit,
        total: countRow.total,
        pages: Math.ceil(countRow.total / limit),
      },
    });
  } catch (err) {
    console.error('[api] GET /products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/victron/products/:slug
// ---------------------------------------------------------------------------
router.get('/products/:slug', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(`
      SELECT
        p.id, p.external_id, p.slug, p.name, p.short_name, p.model, p.sku,
        p.short_description, p.full_description, p.image_url, p.product_url,
        p.modified_at, p.created_at, p.updated_at,
        c.name as category_name, c.slug as category_slug
      FROM victron_products p
      LEFT JOIN victron_categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.is_active = 1
    `).get(req.params.slug);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Attach documents grouped by type
    const documents = db.prepare(`
      SELECT id, type, title, url, file_format, language, sort_order, metadata_json
      FROM victron_product_documents
      WHERE product_id = ?
      ORDER BY type, sort_order
    `).all(product.id);

    product.documents = documents;

    // Group documents by type for convenience
    const grouped = {};
    for (const doc of documents) {
      if (!grouped[doc.type]) grouped[doc.type] = [];
      grouped[doc.type].push(doc);
    }
    product.documents_grouped = grouped;

    // Related products in same category
    product.related = db.prepare(`
      SELECT slug, name, short_name, image_url, short_description
      FROM victron_products
      WHERE category_id = (SELECT category_id FROM victron_products WHERE slug = ?)
        AND slug != ? AND is_active = 1
      ORDER BY RANDOM() LIMIT 4
    `).all(req.params.slug, req.params.slug);

    res.json({ data: product });
  } catch (err) {
    console.error('[api] GET /products/:slug error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/victron/products/:slug/assets
// Supports: ?type filter
// ---------------------------------------------------------------------------
router.get('/products/:slug/assets', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(
      'SELECT id FROM victron_products WHERE slug = ? AND is_active = 1'
    ).get(req.params.slug);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let query = `
      SELECT id, type, title, url, file_format, language, sort_order, metadata_json
      FROM victron_product_documents WHERE product_id = ?
    `;
    const params = [product.id];

    if (req.query.type) {
      query += ' AND type = ?';
      params.push(req.query.type);
    }

    query += ' ORDER BY type, sort_order';

    const assets = db.prepare(query).all(...params);
    res.json({ data: assets });
  } catch (err) {
    console.error('[api] GET /products/:slug/assets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/victron/categories
// ---------------------------------------------------------------------------
router.get('/categories', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT id, name, slug, product_count
      FROM victron_categories
      WHERE product_count > 0
      ORDER BY name
    `).all();

    res.json({ data: categories });
  } catch (err) {
    console.error('[api] GET /categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/victron/sync  (admin-protected)
// ---------------------------------------------------------------------------
router.post('/sync', requireAdminKey, async (req, res) => {
  try {
    const result = await syncVictronProducts();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[api] POST /sync error:', err);
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
});

module.exports = router;
