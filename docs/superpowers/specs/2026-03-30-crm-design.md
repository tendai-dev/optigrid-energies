# OptiGrid CRM Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

Internal admin CRM for OptiGrid Energies at `/admin`, protected by a shared password. Manages the full solar project lifecycle: **Clients > Quotations > Projects/Installations > Receipts**. Internal team only — clients receive quotation and receipt documents as printable HTML pages (no client portal).

## Tech Stack

- Same as existing: Express.js + SQLite (better-sqlite3) + vanilla HTML/CSS/JS
- New migration (version 2) for all CRM tables
- express-session with SQLite-backed session store for auth
- No PDF library — quotation and receipt documents are print-ready HTML pages using `window.print()`
- Matches existing design system: Satoshi font, CSS custom properties, dark/light theme

## Authentication

- Single shared password stored in `.env` as `CRM_PASSWORD`
- New dependency: `express-session` + `better-sqlite3-session-store` (or manual SQLite session table)
- Login page at `/admin/login`
- Session cookie with httpOnly, secure in production
- Middleware on all `/admin/*` routes checks for valid session
- Logout endpoint clears session

## Database Schema (Migration v2: crm_schema)

### clients

| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PK, auto-increment |
| name | TEXT | NOT NULL |
| email | TEXT | |
| phone | TEXT | |
| address | TEXT | |
| city | TEXT | |
| type | TEXT | NOT NULL, CHECK IN ('residential', 'commercial') |
| notes | TEXT | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### quotations

| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PK, auto-increment |
| quotation_number | TEXT | UNIQUE, NOT NULL (format: OG-Q-YYYY-NNNN) |
| client_id | INTEGER | FK -> clients(id), NOT NULL |
| status | TEXT | NOT NULL, DEFAULT 'draft', CHECK IN ('draft', 'sent', 'accepted', 'rejected') |
| subtotal | REAL | NOT NULL, DEFAULT 0 |
| vat_rate | REAL | NOT NULL, DEFAULT 15.0 |
| vat_amount | REAL | NOT NULL, DEFAULT 0 |
| total | REAL | NOT NULL, DEFAULT 0 |
| notes | TEXT | |
| valid_until | TEXT | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

### quotation_items

| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PK, auto-increment |
| quotation_id | INTEGER | FK -> quotations(id), CASCADE DELETE, NOT NULL |
| description | TEXT | NOT NULL |
| quantity | REAL | NOT NULL, DEFAULT 1 |
| unit | TEXT | DEFAULT 'unit' |
| unit_price | REAL | NOT NULL |
| total | REAL | NOT NULL |
| sort_order | INTEGER | DEFAULT 0 |

Index: quotation_id

### projects

| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PK, auto-increment |
| project_number | TEXT | UNIQUE, NOT NULL (format: OG-P-YYYY-NNNN) |
| client_id | INTEGER | FK -> clients(id), NOT NULL |
| quotation_id | INTEGER | FK -> quotations(id), nullable |
| type | TEXT | NOT NULL, CHECK IN ('residential', 'commercial') |
| status | TEXT | NOT NULL, DEFAULT 'planning', CHECK IN ('planning', 'procurement', 'installation', 'commissioning', 'completed') |
| title | TEXT | NOT NULL |
| site_address | TEXT | |
| gps_lat | REAL | |
| gps_lng | REAL | |
| panel_count | INTEGER | |
| capacity_kw | REAL | |
| inverter_details | TEXT | |
| battery_details | TEXT | |
| start_date | TEXT | |
| expected_completion | TEXT | |
| actual_completion | TEXT | |
| notes | TEXT | |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

Indexes: client_id, quotation_id, status

### receipts

| Column | Type | Constraints |
|--------|------|------------|
| id | INTEGER | PK, auto-increment |
| receipt_number | TEXT | UNIQUE, NOT NULL (format: OG-R-YYYY-NNNN) |
| project_id | INTEGER | FK -> projects(id), NOT NULL |
| client_id | INTEGER | FK -> clients(id), NOT NULL |
| amount | REAL | NOT NULL |
| payment_method | TEXT | NOT NULL, CHECK IN ('cash', 'bank_transfer', 'mobile_money', 'other') |
| payment_reference | TEXT | |
| notes | TEXT | |
| paid_at | TEXT | NOT NULL |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP |

Index: project_id, client_id

### sessions (for express-session)

| Column | Type | Constraints |
|--------|------|------------|
| sid | TEXT | PK |
| sess | TEXT | NOT NULL |
| expired | TEXT | |

## Auto-numbering

Helper function generates sequential numbers per entity per year:
- Query: `SELECT MAX(CAST(SUBSTR(quotation_number, -4) AS INTEGER)) FROM quotations WHERE quotation_number LIKE 'OG-Q-2026-%'`
- Increment by 1, zero-pad to 4 digits
- Same pattern for projects (OG-P-) and receipts (OG-R-)

## Admin Pages

### Layout
All admin pages share a common structure:
- Sidebar navigation (collapsible on mobile)
- Top bar with "OptiGrid CRM" title and logout button
- Main content area
- Uses existing CSS custom properties + additional admin-specific styles in `styles-admin.css`

### Pages

1. **`/admin/login`** — Login form (password only, no username)
2. **`/admin`** (Dashboard) — Overview cards (total clients, active projects, pending quotes, revenue), recent activity, projects by status
3. **`/admin/clients`** — Client list with search, filter by type
4. **`/admin/clients/new`** — Create client form
5. **`/admin/clients/:id`** — Client detail with linked quotations, projects, receipts
6. **`/admin/clients/:id/edit`** — Edit client form
7. **`/admin/quotations`** — Quotation list with search, filter by status
8. **`/admin/quotations/new`** — Create quotation: select client, add line items dynamically, auto-calculate totals
9. **`/admin/quotations/:id`** — Quotation detail view
10. **`/admin/quotations/:id/edit`** — Edit quotation (only if draft)
11. **`/admin/quotations/:id/document`** — Print-ready quotation document (full-page, branded)
12. **`/admin/projects`** — Project list with search, filter by status/type
13. **`/admin/projects/new`** — Create project: select client, optionally link quotation, enter system details
14. **`/admin/projects/:id`** — Project detail with status pipeline visualization, linked receipts, payment summary
15. **`/admin/projects/:id/edit`** — Edit project
16. **`/admin/receipts`** — Receipt list with search, filter by payment method
17. **`/admin/receipts/new`** — Create receipt: select project (auto-fills client), enter payment details
18. **`/admin/receipts/:id`** — Receipt detail view
19. **`/admin/receipts/:id/document`** — Print-ready receipt document (full-page, branded)

## API Routes

All under `/api/admin/*`, protected by session auth middleware.

### Auth
- `POST /api/admin/login` — Validate password, create session
- `POST /api/admin/logout` — Destroy session

### Clients
- `GET /api/admin/clients` — List (search, filter, pagination)
- `POST /api/admin/clients` — Create
- `GET /api/admin/clients/:id` — Get with summary counts
- `PUT /api/admin/clients/:id` — Update
- `DELETE /api/admin/clients/:id` — Delete (only if no linked records)

### Quotations
- `GET /api/admin/quotations` — List (search, filter by status, pagination)
- `POST /api/admin/quotations` — Create with items
- `GET /api/admin/quotations/:id` — Get with items and client
- `PUT /api/admin/quotations/:id` — Update with items (draft only)
- `PUT /api/admin/quotations/:id/status` — Update status
- `DELETE /api/admin/quotations/:id` — Delete (draft only)

### Projects
- `GET /api/admin/projects` — List (search, filter by status/type, pagination)
- `POST /api/admin/projects` — Create
- `GET /api/admin/projects/:id` — Get with client, quotation, receipts, payment summary
- `PUT /api/admin/projects/:id` — Update
- `PUT /api/admin/projects/:id/status` — Update status

### Receipts
- `GET /api/admin/receipts` — List (search, filter by payment method, pagination)
- `POST /api/admin/receipts` — Create
- `GET /api/admin/receipts/:id` — Get with project and client
- `DELETE /api/admin/receipts/:id` — Delete

### Dashboard
- `GET /api/admin/dashboard` — Aggregated stats (client count, project counts by status, quotation counts by status, total revenue, recent activity)

## Quotation Document Design

Full-page, print-optimized HTML document:

- **Header:** OptiGrid Energies logo/name, company address, phone, email, website
- **Quotation info block:** Quotation number, date, valid until date
- **Client info block:** Client name, address, phone, email
- **Line items table:** # | Description | Qty | Unit | Unit Price (USD) | Total (USD)
- **Totals section:** Subtotal, VAT (15%), Grand Total — right-aligned, bold grand total
- **Terms & conditions:** Standard payment terms, validity period, warranty info
- **Footer:** "Thank you for choosing OptiGrid Energies" tagline, company registration details

**Styling:** Clean, professional. Uses Satoshi font. OptiGrid brand colors (dark navy #0F232A as primary). Subtle borders, good whitespace. Print media query hides browser chrome. A4 page size optimized.

## Receipt Document Design

Similar layout to quotation but simpler:

- **Header:** Same as quotation
- **Receipt info:** Receipt number, date, payment method, reference
- **Client info:** Name, address
- **Project reference:** Project number, title
- **Payment details table:** Description | Amount (USD)
- **Total paid** — bold, prominent
- **Outstanding balance** (if partial payment)
- **Footer:** Same as quotation

## File Structure

```
server/
  admin/
    routes.js          — All admin API routes
    auth.js            — Auth middleware and login/logout handlers
    controllers/
      dashboard.js     — Dashboard stats
      clients.js       — Client CRUD
      quotations.js    — Quotation CRUD with items
      projects.js      — Project CRUD
      receipts.js      — Receipt CRUD
    helpers.js         — Auto-numbering, date formatting utilities
  db/
    migrations/
      002-crm-schema.js  — CRM tables migration

public/
  admin/
    js/
      admin-common.js    — Shared admin utilities (fetch wrapper, sidebar, notifications)
      dashboard.js       — Dashboard page logic
      clients.js         — Client list/form logic
      quotations.js      — Quotation list/form logic with dynamic line items
      projects.js        — Project list/form logic
      receipts.js        — Receipt list/form logic
      document.js        — Print document utilities

admin/
  login.html
  dashboard.html
  clients.html
  client-form.html
  client-detail.html
  quotations.html
  quotation-form.html
  quotation-detail.html
  quotation-document.html
  projects.html
  project-form.html
  project-detail.html
  receipts.html
  receipt-form.html
  receipt-detail.html
  receipt-document.html

styles-admin.css         — Admin-specific styles (sidebar, cards, tables, forms, status badges, document print styles)
```

## Key UX Details

- **Dynamic line items:** On quotation form, add/remove rows with JS. Auto-calculates row totals, subtotal, VAT, grand total in real-time.
- **Status pipeline:** On project detail, visual horizontal pipeline showing all stages with current stage highlighted.
- **Payment tracking:** On project detail, shows total quoted amount, total paid (sum of receipts), and outstanding balance.
- **Search:** All list pages have instant search filtering.
- **Responsive:** Admin works on tablet/mobile with collapsible sidebar.
- **Notifications:** Toast notifications for success/error on CRUD operations.
- **Confirmation dialogs:** Before delete actions.
- **Create project from quotation:** When a quotation is accepted, offer a "Create Project" button that pre-fills project details from the quotation.

## Environment Variables (additions)

```
CRM_PASSWORD=your-secure-password
SESSION_SECRET=random-session-secret
```

## Dependencies (additions)

```
express-session
```

Session store will be implemented manually with the existing better-sqlite3 (simple table with sid, sess, expired columns — no extra dependency needed).
