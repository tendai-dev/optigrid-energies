/**
 * CLI entry point for running Victron sync manually.
 * Usage: npm run sync:victron
 */

const { initDb } = require("../db/connection");
const { runMigrations } = require("../db/migrate");
const { syncVictronProducts } = require("./sync");
const fs = require("fs");
const path = require("path");

async function main() {
  const dbDir = path.dirname(process.env.DB_PATH || "./data/optigrid.db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  initDb();
  runMigrations();

  const result = await syncVictronProducts();
  console.log("\nSync result:", JSON.stringify(result, null, 2));
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
