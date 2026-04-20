require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const { initDb } = require("./server/db/connection");
const { runMigrations } = require("./server/db/migrate");
const victronRoutes = require("./server/victron/routes");
const adminRoutes = require("./server/admin/routes");
const { createStore } = require("./server/admin/auth");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// On Vercel, use /tmp for SQLite since filesystem is read-only elsewhere
if (IS_VERCEL && !process.env.DB_PATH) {
  process.env.DB_PATH = "/tmp/optigrid.db";
}

// Ensure data directory exists and initialize DB eagerly
const dbDir = path.dirname(process.env.DB_PATH || "./data/optigrid.db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
initDb();
runMigrations();

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const app = express();
if (IS_VERCEL) app.set("trust proxy", 1);
app.use(express.json());

// ---------------------------------------------------------------------------
// Session middleware (must come before routes)
// ---------------------------------------------------------------------------
const sessionStore = createStore(session);
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "optigrid-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_VERCEL || process.env.NODE_ENV === "production",
      sameSite: IS_VERCEL ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Serve existing static files (HTML, CSS, JS, images) from project root
app.use(express.static(path.join(__dirname, "public")));
app.use(
  express.static(__dirname, {
    extensions: ["html"],
    index: "index.html",
  }),
);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use("/api/victron", victronRoutes);
app.use("/api/admin", adminRoutes);

// ---------------------------------------------------------------------------
// Start (local dev only — on Vercel the export is used)
// ---------------------------------------------------------------------------
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`OptiGrid server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
