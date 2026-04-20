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
      conditions.push(
        "(r.receipt_number LIKE ? OR c.name LIKE ? OR r.payment_reference LIKE ?)",
      );
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    if (req.query.payment_method) {
      conditions.push("r.payment_method = ?");
      params.push(req.query.payment_method);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db
      .prepare(
        `SELECT COUNT(*) as count FROM receipts r
       JOIN clients c ON c.id = r.client_id
       JOIN projects p ON p.id = r.project_id ${where}`,
      )
      .get(...params).count;

    const receipts = db
      .prepare(
        `SELECT r.*, c.name as client_name, p.project_number, p.title as project_title
       FROM receipts r
       JOIN clients c ON c.id = r.client_id
       JOIN projects p ON p.id = r.project_id
       ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);

    res.json({
      data: receipts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[admin] GET /receipts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function create(req, res) {
  try {
    const db = getDb();
    const {
      project_id,
      amount,
      payment_method,
      payment_reference,
      notes,
      paid_at,
    } = req.body;

    if (!project_id || !amount || !payment_method || !paid_at) {
      return res.status(400).json({
        error: "Project, amount, payment method, and payment date are required",
      });
    }

    const project = db
      .prepare("SELECT client_id FROM projects WHERE id = ?")
      .get(project_id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const receiptNumber = generateNumber("OG-R", "receipts", "receipt_number");

    const result = db
      .prepare(
        `INSERT INTO receipts (receipt_number, project_id, client_id, amount, payment_method, payment_reference, notes, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        receiptNumber,
        project_id,
        project.client_id,
        amount,
        payment_method,
        payment_reference || null,
        notes || null,
        paid_at,
      );

    const receipt = db
      .prepare(
        `SELECT r.*, c.name as client_name, p.project_number, p.title as project_title
       FROM receipts r
       JOIN clients c ON c.id = r.client_id
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = ?`,
      )
      .get(result.lastInsertRowid);

    res.status(201).json({ data: receipt });
  } catch (err) {
    console.error("[admin] POST /receipts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function get(req, res) {
  try {
    const db = getDb();
    const receipt = db
      .prepare(
        `SELECT r.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
              c.address as client_address, c.city as client_city,
              p.project_number, p.title as project_title, p.quotation_id
       FROM receipts r
       JOIN clients c ON c.id = r.client_id
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = ?`,
      )
      .get(req.params.id);

    if (!receipt) return res.status(404).json({ error: "Receipt not found" });

    // Payment summary for the project
    const totalPaid = db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM receipts WHERE project_id = ?",
      )
      .get(receipt.project_id).total;

    let quotedTotal = 0;
    if (receipt.quotation_id) {
      const q = db
        .prepare("SELECT total FROM quotations WHERE id = ?")
        .get(receipt.quotation_id);
      if (q) quotedTotal = q.total;
    }

    receipt.payment_summary = {
      quoted_total: quotedTotal,
      total_paid: totalPaid,
      outstanding: quotedTotal - totalPaid,
    };

    res.json({ data: receipt });
  } catch (err) {
    console.error("[admin] GET /receipts/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function remove(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM receipts WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Receipt not found" });

    db.prepare("DELETE FROM receipts WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[admin] DELETE /receipts/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { list, create, get, remove };
