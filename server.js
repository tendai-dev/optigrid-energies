const path = require('path');
const express = require('express');
const { initDb } = require('./server/db/connection');
const { runMigrations } = require('./server/db/migrate');
const victronRoutes = require('./server/victron/routes');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

// Serve existing static files (HTML, CSS, JS, images) from project root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html',
}));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/api/victron', victronRoutes);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
  // Ensure data directory exists
  const fs = require('fs');
  const dbDir = path.dirname(process.env.DB_PATH || './data/optigrid.db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  // Initialize database and run migrations
  initDb();
  runMigrations();

  app.listen(PORT, () => {
    console.log(`OptiGrid server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
