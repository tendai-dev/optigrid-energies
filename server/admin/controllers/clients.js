const { getDb } = require("../../db/connection");

function list(req, res) {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.search) {
      conditions.push(
        "(name LIKE ? OR email LIKE ? OR phone LIKE ? OR city LIKE ?)",
      );
      const term = `%${req.query.search}%`;
      params.push(term, term, term, term);
    }

    if (req.query.type) {
      conditions.push("type = ?");
      params.push(req.query.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db
      .prepare(`SELECT COUNT(*) as count FROM clients ${where}`)
      .get(...params).count;

    const clients = db
      .prepare(
        `SELECT * FROM clients ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);

    res.json({
      data: clients,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[admin] GET /clients error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function create(req, res) {
  try {
    const db = getDb();
    const { name, email, phone, address, city, type, notes } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    const result = db
      .prepare(
        `INSERT INTO clients (name, email, phone, address, city, type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        email || null,
        phone || null,
        address || null,
        city || null,
        type,
        notes || null,
      );

    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json({ data: client });
  } catch (err) {
    console.error("[admin] POST /clients error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function get(req, res) {
  try {
    const db = getDb();
    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(req.params.id);

    if (!client) return res.status(404).json({ error: "Client not found" });

    client.quotations = db
      .prepare(
        "SELECT id, quotation_number, status, total, created_at FROM quotations WHERE client_id = ? ORDER BY created_at DESC",
      )
      .all(client.id);

    client.projects = db
      .prepare(
        "SELECT id, project_number, title, status, created_at FROM projects WHERE client_id = ? ORDER BY created_at DESC",
      )
      .all(client.id);

    client.receipts = db
      .prepare(
        "SELECT id, receipt_number, amount, paid_at FROM receipts WHERE client_id = ? ORDER BY paid_at DESC",
      )
      .all(client.id);

    res.json({ data: client });
  } catch (err) {
    console.error("[admin] GET /clients/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function update(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const { name, email, phone, address, city, type, notes } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    db.prepare(
      `UPDATE clients SET name=?, email=?, phone=?, address=?, city=?, type=?, notes=?, updated_at=datetime('now')
       WHERE id=?`,
    ).run(
      name,
      email || null,
      phone || null,
      address || null,
      city || null,
      type,
      notes || null,
      req.params.id,
    );

    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(req.params.id);
    res.json({ data: client });
  } catch (err) {
    console.error("[admin] PUT /clients/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function remove(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const linked =
      db
        .prepare("SELECT COUNT(*) as count FROM quotations WHERE client_id = ?")
        .get(req.params.id).count +
      db
        .prepare("SELECT COUNT(*) as count FROM projects WHERE client_id = ?")
        .get(req.params.id).count;

    if (linked > 0) {
      return res.status(400).json({
        error: "Cannot delete client with linked quotations or projects",
      });
    }

    db.prepare("DELETE FROM clients WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[admin] DELETE /clients/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { list, create, get, update, remove };
