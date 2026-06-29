// Tiny file-based "database". No external dependencies required.
// Good enough for a small real store. Swap for Postgres/MySQL later if you scale up
// (see README.md "Going to production" section).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readDB(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, 'utf-8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeDB(name, data) {
  const fp = filePath(name);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
}

module.exports = { readDB, writeDB, nextId };
