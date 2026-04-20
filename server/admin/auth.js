const { getDb } = require("../db/connection");

// ---------------------------------------------------------------------------
// SQLite Session Store for express-session
// ---------------------------------------------------------------------------
class SQLiteStore {
  constructor(session) {
    this.Store = session.Store;
    Object.setPrototypeOf(SQLiteStore.prototype, this.Store.prototype);
  }

  get(sid, cb) {
    try {
      const db = getDb();
      const row = db
        .prepare(
          "SELECT sess FROM sessions WHERE sid = ? AND (expired IS NULL OR expired > datetime('now'))",
        )
        .get(sid);
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      const db = getDb();
      const expired =
        sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires).toISOString()
          : null;
      db.prepare(
        "INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
      ).run(sid, JSON.stringify(sess), expired);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      const db = getDb();
      db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb) {
    this.set(sid, sess, cb);
  }
}

function createStore(session) {
  return new SQLiteStore(session);
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ---------------------------------------------------------------------------
// Login handler
// ---------------------------------------------------------------------------
function login(req, res) {
  const { password } = req.body;
  const expected = process.env.CRM_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "CRM_PASSWORD not configured" });
  }

  if (password !== expected) {
    return res.status(401).json({ error: "Invalid password" });
  }

  req.session.authenticated = true;
  res.json({ success: true });
}

// ---------------------------------------------------------------------------
// Logout handler
// ---------------------------------------------------------------------------
function logout(req, res) {
  req.session.destroy(() => {
    res.json({ success: true });
  });
}

module.exports = { createStore, requireAuth, login, logout };
