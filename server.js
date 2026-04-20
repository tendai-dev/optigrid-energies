require("dotenv").config();
// express-async-errors patches Express so thrown errors in async handlers
// propagate to the global error handler without needing try/catch wrappers.
require("express-async-errors");

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const { initDb, isPostgres } = require("./server/db/connection");
const { runMigrations } = require("./server/db/migrate");
const victronRoutes = require("./server/victron/routes");
const adminRoutes = require("./server/admin/routes");
const { createStore } = require("./server/admin/auth");

// ---------------------------------------------------------------------------
// Sentry (optional — only initialised when SENTRY_DSN is present)
// ---------------------------------------------------------------------------
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "production",
      // Capture 100 % of transactions in production — tune down if volume grows
      tracesSampleRate: 0.1,
    });
    console.log("[sentry] Initialised");
  } catch (err) {
    // Don't crash if Sentry fails to load — it's optional
    console.warn("[sentry] Failed to initialise:", err.message);
    Sentry = null;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;
const IS_VERCEL = !!process.env.VERCEL;

// On Vercel, use /tmp for SQLite since filesystem is read-only elsewhere.
// When SUPABASE_DB_URL is set this path is never opened, but the env guard
// is kept so the dir-creation below doesn't error on a read-only root.
if (IS_VERCEL && !process.env.DB_PATH) {
  process.env.DB_PATH = "/tmp/optigrid.db";
}

// Initialise DB — SQLite only (Postgres is connection-pool based, no init needed)
if (!isPostgres()) {
  const dbDir = path.dirname(process.env.DB_PATH || "./data/optigrid.db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  initDb();
  runMigrations();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const app = express();

// Trust the first proxy hop (Vercel's edge layer) so rate-limit and session
// cookies see the real client IP, not the internal Vercel IP.
if (IS_VERCEL) app.set("trust proxy", 1);

// Attach a unique request ID to every request for log correlation.
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

app.use(express.json());

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

// Helper: build a limiter that handles Vercel's X-Forwarded-For correctly.
function makeLimiter(options) {
  return rateLimit({
    // standardHeaders: true sends RateLimit-* headers (RFC 6585 draft)
    standardHeaders: true,
    // legacyHeaders: false removes the deprecated X-RateLimit-* headers
    legacyHeaders: false,
    // On Vercel the real IP arrives in X-Forwarded-For; express sets
    // req.ip correctly once "trust proxy" is enabled above.
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message: "Too many requests — please slow down",
          code: "RATE_LIMITED",
          requestId: req.requestId,
        },
      });
    },
    ...options,
  });
}

// Global limiter — 200 requests per 15 minutes per IP
const globalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

// Victron catalog API — 60 requests per minute per IP
const victronLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

// Contact endpoint — 5 requests per hour per IP.
// Applied here as a fallback; the contact agent may add its own limiter on top.
const contactLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
});

app.use(globalLimiter);
app.use("/api/victron", victronLimiter);
app.use("/api/contact", contactLimiter);

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
// 404 handler for unknown /api/* routes
// ---------------------------------------------------------------------------
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: {
      message: "Not found",
      code: "NOT_FOUND",
      requestId: req.requestId,
    },
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

/**
 * Structured log line for errors — writes one JSON line to stdout so Vercel
 * log aggregators (and Sentry, Datadog, etc.) can parse it easily.
 */
function logError(err, req) {
  const entry = {
    level: "error",
    message: err.message,
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  };
  console.error(JSON.stringify(entry));
}

// eslint-disable-next-line no-unused-vars — Express requires 4-arg signature
app.use((err, req, res, next) => {
  logError(err, req);

  // Report to Sentry when configured
  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setTag("requestId", req.requestId);
      scope.setContext("request", {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      });
      Sentry.captureException(err);
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isApiRoute = req.originalUrl.startsWith("/api/");

  if (isApiRoute) {
    return res.status(statusCode).json({
      error: {
        // Never leak internal error details to API callers in production
        message:
          process.env.NODE_ENV !== "production"
            ? err.message
            : "Internal server error",
        code: err.code || "INTERNAL_ERROR",
        requestId: req.requestId,
      },
    });
  }

  // HTML routes — serve the friendly error page
  const errorPage = path.join(__dirname, "public", "500.html");
  if (fs.existsSync(errorPage)) {
    return res.status(500).sendFile(errorPage);
  }

  // Absolute fallback if 500.html somehow doesn't exist
  res.status(500).send("An unexpected error occurred. <a href='/'>Go home</a>");
});

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
