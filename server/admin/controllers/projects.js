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
        "(p.project_number LIKE ? OR p.title LIKE ? OR c.name LIKE ?)",
      );
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    if (req.query.status) {
      conditions.push("p.status = ?");
      params.push(req.query.status);
    }

    if (req.query.type) {
      conditions.push("p.type = ?");
      params.push(req.query.type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = db
      .prepare(
        `SELECT COUNT(*) as count FROM projects p JOIN clients c ON c.id = p.client_id ${where}`,
      )
      .get(...params).count;

    const projects = db
      .prepare(
        `SELECT p.*, c.name as client_name
       FROM projects p JOIN clients c ON c.id = p.client_id
       ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);

    res.json({
      data: projects,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[admin] GET /projects error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function create(req, res) {
  try {
    const db = getDb();
    const {
      client_id,
      quotation_id,
      type,
      title,
      site_address,
      gps_lat,
      gps_lng,
      panel_count,
      capacity_kw,
      inverter_details,
      battery_details,
      start_date,
      expected_completion,
      notes,
    } = req.body;

    if (!client_id || !type || !title) {
      return res
        .status(400)
        .json({ error: "Client, type, and title are required" });
    }

    const projectNumber = generateNumber("OG-P", "projects", "project_number");

    const result = db
      .prepare(
        `INSERT INTO projects (project_number, client_id, quotation_id, type, title, site_address,
        gps_lat, gps_lng, panel_count, capacity_kw, inverter_details, battery_details,
        start_date, expected_completion, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectNumber,
        client_id,
        quotation_id || null,
        type,
        title,
        site_address || null,
        gps_lat || null,
        gps_lng || null,
        panel_count || null,
        capacity_kw || null,
        inverter_details || null,
        battery_details || null,
        start_date || null,
        expected_completion || null,
        notes || null,
      );

    const project = db
      .prepare(
        `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
      )
      .get(result.lastInsertRowid);

    res.status(201).json({ data: project });
  } catch (err) {
    console.error("[admin] POST /projects error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function get(req, res) {
  try {
    const db = getDb();
    const project = db
      .prepare(
        `SELECT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
              c.address as client_address, c.city as client_city
       FROM projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
      )
      .get(req.params.id);

    if (!project) return res.status(404).json({ error: "Project not found" });

    if (project.quotation_id) {
      project.quotation = db
        .prepare(
          "SELECT id, quotation_number, status, total FROM quotations WHERE id = ?",
        )
        .get(project.quotation_id);
    }

    project.receipts = db
      .prepare(
        "SELECT * FROM receipts WHERE project_id = ? ORDER BY paid_at DESC",
      )
      .all(project.id);

    const totalPaid = project.receipts.reduce((sum, r) => sum + r.amount, 0);
    const quotedTotal = project.quotation ? project.quotation.total : 0;
    project.payment_summary = {
      quoted_total: quotedTotal,
      total_paid: totalPaid,
      outstanding: quotedTotal - totalPaid,
    };

    res.json({ data: project });
  } catch (err) {
    console.error("[admin] GET /projects/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function update(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Project not found" });

    const {
      client_id,
      quotation_id,
      type,
      title,
      site_address,
      gps_lat,
      gps_lng,
      panel_count,
      capacity_kw,
      inverter_details,
      battery_details,
      start_date,
      expected_completion,
      actual_completion,
      notes,
    } = req.body;

    if (!client_id || !type || !title) {
      return res
        .status(400)
        .json({ error: "Client, type, and title are required" });
    }

    db.prepare(
      `UPDATE projects SET client_id=?, quotation_id=?, type=?, title=?, site_address=?,
        gps_lat=?, gps_lng=?, panel_count=?, capacity_kw=?, inverter_details=?, battery_details=?,
        start_date=?, expected_completion=?, actual_completion=?, notes=?, updated_at=datetime('now')
       WHERE id=?`,
    ).run(
      client_id,
      quotation_id || null,
      type,
      title,
      site_address || null,
      gps_lat || null,
      gps_lng || null,
      panel_count || null,
      capacity_kw || null,
      inverter_details || null,
      battery_details || null,
      start_date || null,
      expected_completion || null,
      actual_completion || null,
      notes || null,
      req.params.id,
    );

    const project = db
      .prepare(
        `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
      )
      .get(req.params.id);

    res.json({ data: project });
  } catch (err) {
    console.error("[admin] PUT /projects/:id error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function updateStatus(req, res) {
  try {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Project not found" });

    const { status } = req.body;
    const valid = [
      "planning",
      "procurement",
      "installation",
      "commissioning",
      "completed",
    ];
    if (!valid.includes(status)) {
      return res
        .status(400)
        .json({ error: `Status must be one of: ${valid.join(", ")}` });
    }

    const updates = { status };
    if (status === "completed" && !existing.actual_completion) {
      db.prepare(
        "UPDATE projects SET status=?, actual_completion=date('now'), updated_at=datetime('now') WHERE id=?",
      ).run(status, req.params.id);
    } else {
      db.prepare(
        "UPDATE projects SET status=?, updated_at=datetime('now') WHERE id=?",
      ).run(status, req.params.id);
    }

    const project = db
      .prepare(
        `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
      )
      .get(req.params.id);

    res.json({ data: project });
  } catch (err) {
    console.error("[admin] PUT /projects/:id/status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { list, create, get, update, updateStatus };
