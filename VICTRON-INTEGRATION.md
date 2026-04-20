# Victron Energy Integration

## Overview

This module syncs the complete Victron Energy product catalog into OptiGrid's database, making products, documents, and technical resources browsable through the website.

## Architecture

```
server/
  db/
    connection.js    — SQLite connection (better-sqlite3, WAL mode)
    migrate.js       — Migration runner with version tracking
  victron/
    classifier.js    — Document type classifier (URL + title pattern matching)
    parser.js        — XML feed parser with safe extraction and normalization
    sync.js          — Sync service (fetch, parse, upsert, dedup)
    sync-cli.js      — CLI entry point for manual sync
    routes.js        — Express API routes with pagination, search, filtering
public/
  js/
    victron-catalog.js  — Product listing page logic
    victron-product.js  — Product detail page logic
victron-catalog.html    — Product listing page
victron-product.html    — Product detail page
```

## Setup

```bash
npm install
npm run migrate       # Create database tables
npm run sync:victron  # Fetch and sync all Victron products
npm start             # Start the server (default port 3000)
npm run dev           # Start with --watch for auto-reload
```

## Environment Variables

| Variable                   | Default                                                    | Description                                                  |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `PORT`                     | `3000`                                                     | Server port                                                  |
| `DB_PATH`                  | `./data/optigrid.db`                                       | SQLite database file path                                    |
| `VICTRON_FEED_URL`         | `https://www.victronenergy.com/api/v1/products?format=xml` | Product feed URL                                             |
| `VICTRON_FETCH_TIMEOUT_MS` | `30000`                                                    | Feed fetch timeout                                           |
| `ADMIN_SYNC_KEY`           | (empty)                                                    | Protects POST /api/victron/sync. If empty, endpoint is open. |

## How Sync Works

1. Fetches XML from Victron's public product feed
2. Parses XML into structured product objects using xml2js
3. For each product:
   - Creates/updates the category
   - Upserts the product (matched by external_id)
   - Skips unchanged products (compares modified_at timestamp)
   - Replaces all documents with fresh data
4. Runs in a single SQLite transaction for atomicity
5. Returns a summary: total, inserted, updated, skipped, failed

## How to Trigger Sync

**CLI (recommended for initial load):**

```bash
npm run sync:victron
```

**API endpoint:**

```bash
# Without admin key
curl -X POST http://localhost:3000/api/victron/sync

# With admin key (when ADMIN_SYNC_KEY is set)
curl -X POST http://localhost:3000/api/victron/sync \
  -H "x-admin-key: YOUR_KEY"
```

## How Documents Are Classified

Documents from the Victron feed are classified into canonical types:

| Victron Type              | Internal Type | Description                           |
| ------------------------- | ------------- | ------------------------------------- |
| Datasheet                 | `datasheet`   | Product datasheets                    |
| Material safety datasheet | `datasheet`   | MSDS documents                        |
| Product Manual            | `manual`      | Product manuals                       |
| Old user manual           | `manual`      | Legacy manuals                        |
| Quick installation guide  | `manual`      | Install guides                        |
| Brochure                  | `brochure`    | Marketing brochures                   |
| System schematic          | `schematic`   | System schematics and wiring diagrams |
| Enclosure dimension       | `enclosure`   | Mechanical drawings, dimensions       |
| Certificate               | `certificate` | Compliance certificates               |
| High quality photo        | `photo`       | Product photography                   |
| Technical information     | `technical`   | Technical articles                    |
| Promo video / Video       | `video`       | Product videos                        |

**Fallback classification** uses URL/filename pattern matching for documents without a type label.

## API Endpoints

### GET /api/victron/products

List products with pagination, search, and filtering.

**Query parameters:**

- `page` (default: 1)
- `limit` (default: 24, max: 100)
- `search` — text search across name, description, SKU
- `category` — category slug filter
- `sort` — `name`, `newest`, `updated`
- `type` — filter to products that have assets of this type (e.g., `schematic`)

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "slug": "multiplus-500va-1600va",
      "name": "MultiPlus 500VA - 1600VA",
      "short_name": "MultiPlus 500VA - 1600VA",
      "model": "MultiPlus 500VA - 1600VA",
      "sku": "PMP121800000, PMP241800000, ...",
      "short_description": "...",
      "image_url": "https://www.victronenergy.com/upload/products/...",
      "product_url": "https://www.victronenergy.com/products/...",
      "category_name": "Inverter/chargers",
      "category_slug": "inverter-chargers",
      "asset_types": [
        "datasheet",
        "manual",
        "schematic",
        "brochure",
        "certificate"
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 197,
    "pages": 9
  }
}
```

### GET /api/victron/products/:slug

Full product detail with grouped documents and related products.

### GET /api/victron/products/:slug/assets

Product documents. Optional `?type=datasheet` filter.

### GET /api/victron/categories

All categories with product counts.

### POST /api/victron/sync

Trigger a full sync. Returns summary of results.

## Database Schema

### victron_categories

- id, name, slug, product_count, created_at, updated_at

### victron_products

- id, external_id (unique), slug (unique), name, short_name, model, sku
- category_id (FK), short_description, full_description
- product_url, image_url, modified_at, raw_payload
- is_active, created_at, updated_at

### victron_product_documents

- id, product_id (FK), external_id, type, title, url
- file_format, language, sort_order, metadata_json
- created_at, updated_at

## Future Extensions

### Compatibility Engine

The `raw_payload` field stores the complete Victron feed data for each product, including technical specifications (battery voltage, power ratings, etc.). A compatibility engine could:

- Parse `pms_technical_data` from raw_payload
- Build a compatibility matrix between inverters, batteries, and charge controllers
- Suggest compatible products based on voltage/capacity matching

### System Builder / Mockup Builder

The schematic and wiring diagram assets provide a foundation for an interactive system designer:

- Let users drag-and-drop Victron components
- Auto-validate compatibility
- Generate a bill of materials
- Link to relevant schematics for the selected configuration

### 3D Viewer Integration

Enclosure dimension files and any future STEP/STL files can be rendered:

- Integrate three.js or model-viewer for in-browser 3D preview
- Show physical dimensions overlay
- Allow rotation and measurement
- The `enclosure` document type already captures dimension drawings
