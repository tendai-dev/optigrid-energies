const { Router } = require("express");
const { requireAuth, login, logout } = require("./auth");
const dashboard = require("./controllers/dashboard");
const clients = require("./controllers/clients");
const quotations = require("./controllers/quotations");
const projects = require("./controllers/projects");
const receipts = require("./controllers/receipts");

const router = Router();

// ---------------------------------------------------------------------------
// Auth (unprotected)
// ---------------------------------------------------------------------------
router.post("/login", login);
router.post("/logout", logout);

// ---------------------------------------------------------------------------
// All routes below require authentication
// ---------------------------------------------------------------------------
router.use(requireAuth);

// Dashboard
router.get("/dashboard", dashboard.getStats);

// Clients
router.get("/clients", clients.list);
router.post("/clients", clients.create);
router.get("/clients/:id", clients.get);
router.put("/clients/:id", clients.update);
router.delete("/clients/:id", clients.remove);

// Quotations
router.get("/quotations", quotations.list);
router.post("/quotations", quotations.create);
router.get("/quotations/:id", quotations.get);
router.put("/quotations/:id", quotations.update);
router.put("/quotations/:id/status", quotations.updateStatus);
router.delete("/quotations/:id", quotations.remove);

// Projects
router.get("/projects", projects.list);
router.post("/projects", projects.create);
router.get("/projects/:id", projects.get);
router.put("/projects/:id", projects.update);
router.put("/projects/:id/status", projects.updateStatus);

// Receipts
router.get("/receipts", receipts.list);
router.post("/receipts", receipts.create);
router.get("/receipts/:id", receipts.get);
router.delete("/receipts/:id", receipts.remove);

module.exports = router;
