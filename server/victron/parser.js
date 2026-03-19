/**
 * Victron XML feed parser.
 *
 * Fetches the product feed, parses XML, and normalizes each product into a
 * structured object ready for database insertion.
 */

const { parseString } = require('xml2js');
const { classifyDocument, extractFileFormat } = require('./classifier');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract text from an xml2js parsed element. */
function text(node) {
  if (node == null) return null;
  if (typeof node === 'string') return node.trim() || null;
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === 'object' && node._) return node._.trim() || null;
  return null;
}

/** Generate a URL-safe slug from a product name. */
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

/** Collect all SKU strings from sku_information or sku arrays. */
function extractSkus(product) {
  const skus = [];
  const skuInfo = product.sku_information;
  if (Array.isArray(skuInfo)) {
    for (const entry of skuInfo) {
      const items = entry?.item;
      if (Array.isArray(items)) {
        for (const item of items) {
          const s = text(item?.sku);
          if (s) skus.push(s);
        }
      }
    }
  }
  const skuList = product.sku;
  if (Array.isArray(skuList)) {
    for (const entry of skuList) {
      const items = entry?.item;
      if (Array.isArray(items)) {
        for (const item of items) {
          const s = text(item);
          if (s && !skus.includes(s)) skus.push(s);
        }
      }
    }
  }
  return skus;
}

/** Parse a documents/external_images/main_images section. */
function parseDocumentList(section) {
  const docs = [];
  if (!Array.isArray(section)) return docs;

  for (const group of section) {
    const items = group?.item;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const url = text(item?.url);
      if (!url) continue;

      docs.push({
        external_id: text(item?.id),
        name: text(item?.name),
        document_type: text(item?.document_type),
        url,
        notes: text(item?.notes),
      });
    }
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Main parsing function
// ---------------------------------------------------------------------------

/**
 * Parse the raw XML string from Victron's feed into an array of normalized
 * product objects.
 *
 * @param {string} xml - Raw XML string
 * @returns {Promise<Array>} Normalized products
 */
function parseVictronFeed(xml) {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: true, trim: true }, (err, result) => {
      if (err) return reject(new Error(`XML parse error: ${err.message}`));

      const items = result?.products?.item;
      if (!Array.isArray(items)) {
        return resolve([]);
      }

      const products = [];

      for (const item of items) {
        try {
          const name = text(item.name) || 'Unknown Product';
          const externalId = text(item.id);
          if (!externalId) continue; // Skip items with no ID

          const skus = extractSkus(item);

          // Collect all document-like items from multiple sections
          const rawDocs = [
            ...parseDocumentList(item.documents),
            ...parseDocumentList(item.external_images),
            ...parseDocumentList(item.main_images),
          ];

          // Deduplicate documents by URL
          const seenUrls = new Set();
          const documents = [];
          for (const doc of rawDocs) {
            if (seenUrls.has(doc.url)) continue;
            seenUrls.add(doc.url);

            const type = classifyDocument(doc.document_type, doc.url, doc.name);
            documents.push({
              external_id: doc.external_id,
              type,
              title: doc.name,
              url: doc.url,
              file_format: extractFileFormat(doc.url),
              metadata_json: doc.notes ? JSON.stringify({ notes: doc.notes }) : null,
            });
          }

          products.push({
            external_id: externalId,
            slug: slugify(name),
            name,
            short_name: text(item.short_name),
            model: text(item.short_name) || name,
            sku: skus.join(', ') || null,
            category: text(item.category) || 'Uncategorized',
            short_description: truncate(text(item.description), 300),
            full_description: text(item.description),
            product_url: `https://www.victronenergy.com/products/${slugify(name)}`,
            image_url: text(item.image),
            modified_at: text(item.modified_at),
            raw_payload: JSON.stringify(item),
            documents,
          });
        } catch (parseErr) {
          // Skip individual product on parse error — log and continue
          console.warn(`Skipped product (parse error): ${parseErr.message}`);
        }
      }

      resolve(products);
    });
  });
}

function truncate(str, len) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

module.exports = { parseVictronFeed, slugify };
