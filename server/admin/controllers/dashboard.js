const { getDb } = require("../../db/connection");

function getStats(req, res) {
  try {
    const db = getDb();

    const clientCount = db
      .prepare("SELECT COUNT(*) as count FROM clients")
      .get().count;

    const projectsByStatus = db
      .prepare("SELECT status, COUNT(*) as count FROM projects GROUP BY status")
      .all();

    const quotationsByStatus = db
      .prepare(
        "SELECT status, COUNT(*) as count FROM quotations GROUP BY status",
      )
      .all();

    const totalRevenue = db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM receipts")
      .get().total;

    const activeProjects = db
      .prepare(
        "SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('completed')",
      )
      .get().count;

    const pendingQuotations = db
      .prepare(
        "SELECT COUNT(*) as count FROM quotations WHERE status IN ('draft', 'sent')",
      )
      .get().count;

    const recentClients = db
      .prepare(
        "SELECT id, name, type, created_at FROM clients ORDER BY created_at DESC LIMIT 5",
      )
      .all();

    const recentProjects = db
      .prepare(
        `SELECT p.id, p.project_number, p.title, p.status, c.name as client_name
       FROM projects p JOIN clients c ON c.id = p.client_id
       ORDER BY p.created_at DESC LIMIT 5`,
      )
      .all();

    const recentReceipts = db
      .prepare(
        `SELECT r.id, r.receipt_number, r.amount, r.paid_at, c.name as client_name
       FROM receipts r JOIN clients c ON c.id = r.client_id
       ORDER BY r.created_at DESC LIMIT 5`,
      )
      .all();

    res.json({
      data: {
        clientCount,
        activeProjects,
        pendingQuotations,
        totalRevenue,
        projectsByStatus,
        quotationsByStatus,
        recentClients,
        recentProjects,
        recentReceipts,
      },
    });
  } catch (err) {
    console.error("[admin] GET /dashboard error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getStats };
