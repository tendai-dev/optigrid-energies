const { getDb } = require("../../db/connection");
const { generateNumber } = require("../helpers");

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
      conditions.push("(q.quotation_number LIKE ? OR c.name LIKE ?)");
      const term = `%${req.query.search}%`;
      params.push(term, term);
    }

    if (req.query.status) {
      conditions.push("q.status = ?");
      params.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db
      .prepare(
        `SELECT COUNT(*) as count FROM quotations q JOIN clients c ON c.id = q.client_id ${where}`,
      )
      .get(...params).count;

    const quotations = db
      .prepare(
        `SELECT q.*, c.name as client_name
       FROM quotations q JOIN clients c ON c.id = q.client_id
       ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);

    res.json({
      data: quotations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[admin] GET /quotations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function create(req, res) {
  try {
    const db = getDb();
    const { client_id, items, notes, valid_until, vat_rate } = req.body;

    if (!client_id || !items || !items.length) {
      return res
        .status(400)
        .json({ error: "Client and at least one item are required" });
    }

    const vatRate = vat_rate != null ? vat_rate : 15.0;
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    const quotationNumber = generateNumber(
      "OG-Q",
      "quotations",
      "quotation_number",
    );

    const run = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO quotations (quotation_number, client_id, subtotal, vat_rate, vat_amount, total, notes, valid_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          quotationNumber,
          client_id,
          subtotal,
          vatRate,
          vatAmount,
          total,
          notes || null,
          valid_until || null,
        );

      const quotationId = result.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      items.forEach((item, i) => {
        insertItem.run(
          quotationId,
          item.description,
          item.quantity || 1,
          item.unit || "unit",
          item.unit_price,
          (item.quantity || 1) * item.unit_price,
          item.sort_order != null ? item.sort_order : i,
        );
      });

      return quotationId;
    });

    const quotationId = run();
    const quotation = db
      .prepare(
        `SELECT q.*, c.name as client_name FROM quotations q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`,
      )
      .get(quotationId);
    quotation.items = db
      .prepare(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order",
      )
      .all(quotationId);

    res.status(201).json({ data: quotation });
  } catch (err) {
    console.error("[admin] POST /quotations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function get(req, res) {
  try {
    const db = getDb();
    const quotation = db
      .prepare(
        `SELECT q.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
              c.address as client_address, c.city as client_city
       FROM quotations q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`,
      )
      .get(req.params.id);

    if (!quotation)
      return res.status(404).json({ error: "Quotation not found" });

    quotation.items = db
      .prepare(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order",
      )
      .all(quotation.id);

    res.json({ data: quotation });
  } catch (err) {
    console.error("[admin] GET /quotations/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function update(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Quotation not found" });
    if (existing.status !== "draft") {
      return res
        .status(400)
        .json({ error: "Only draft quotations can be edited" });
    }

    const { client_id, items, notes, valid_until, vat_rate } = req.body;
    if (!client_id || !items || !items.length) {
      return res
        .status(400)
        .json({ error: "Client and at least one item are required" });
    }

    const vatRate = vat_rate != null ? vat_rate : existing.vat_rate;
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;

    const run = db.transaction(() => {
      db.prepare(
        `UPDATE quotations SET client_id=?, subtotal=?, vat_rate=?, vat_amount=?, total=?, notes=?, valid_until=?, updated_at=datetime('now')
         WHERE id=?`,
      ).run(
        client_id,
        subtotal,
        vatRate,
        vatAmount,
        total,
        notes || null,
        valid_until || null,
        req.params.id,
      );

      db.prepare("DELETE FROM quotation_items WHERE quotation_id = ?").run(
        req.params.id,
      );

      const insertItem = db.prepare(
        `INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      items.forEach((item, i) => {
        insertItem.run(
          req.params.id,
          item.description,
          item.quantity || 1,
          item.unit || "unit",
          item.unit_price,
          (item.quantity || 1) * item.unit_price,
          item.sort_order != null ? item.sort_order : i,
        );
      });
    });

    run();

    const quotation = db
      .prepare(
        `SELECT q.*, c.name as client_name FROM quotations q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`,
      )
      .get(req.params.id);
    quotation.items = db
      .prepare(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order",
      )
      .all(req.params.id);

    res.json({ data: quotation });
  } catch (err) {
    console.error("[admin] PUT /quotations/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function updateStatus(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Quotation not found" });

    const { status } = req.body;
    const valid = ["draft", "sent", "accepted", "rejected"];
    if (!valid.includes(status)) {
      return res
        .status(400)
        .json({ error: `Status must be one of: ${valid.join(", ")}` });
    }

    db.prepare(
      "UPDATE quotations SET status=?, updated_at=datetime('now') WHERE id=?",
    ).run(status, req.params.id);

    const quotation = db
      .prepare(
        `SELECT q.*, c.name as client_name FROM quotations q JOIN clients c ON c.id = q.client_id WHERE q.id = ?`,
      )
      .get(req.params.id);

    res.json({ data: quotation });
  } catch (err) {
    console.error("[admin] PUT /quotations/:id/status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function remove(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM quotations WHERE id = ?")
      .get(req.params.id);
    if (!existing)
      return res.status(404).json({ error: "Quotation not found" });
    if (existing.status !== "draft") {
      return res
        .status(400)
        .json({ error: "Only draft quotations can be deleted" });
    }

    db.prepare("DELETE FROM quotations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[admin] DELETE /quotations/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { list, create, get, update, updateStatus, remove };
