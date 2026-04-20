const { getDb } = require("../db/connection");

/**
 * Generate sequential auto-number like OG-Q-2026-0001.
 * @param {string} prefix - e.g. 'OG-Q'
 * @param {string} table - table name
 * @param {string} column - column name holding the number
 */
function generateNumber(prefix, table, column) {
  const db = getDb();
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;

  const row = db
    .prepare(
      `SELECT MAX(CAST(SUBSTR(${column}, -4) AS INTEGER)) as max_num FROM ${table} WHERE ${column} LIKE ?`,
    )
    .get(pattern);

  const next = (row && row.max_num ? row.max_num : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

module.exports = { generateNumber };
