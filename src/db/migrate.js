'use strict';
const fs = require('fs');
const path = require('path');

// Resolved relative to this file so it works inside Docker (/app/src/db -> /app/db/migrations).
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');
// Arbitrary constant key for the advisory lock that serialises concurrent starts.
const LOCK_KEY = 726354810;

function listMigrationFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Apply pending SQL migrations in filename order.
 * Each file runs in its own transaction and is recorded in schema_migrations.
 * @param {import('pg').Pool} pool
 * @param {{dir?: string}} [options]
 * @returns {Promise<string[]>} names of migrations applied by this call
 */
async function migrate(pool, options = {}) {
  const dir = options.dir || MIGRATIONS_DIR;
  const files = listMigrationFiles(dir);
  const applied = [];
  const client = await pool.connect();
  try {
    // Session-level lock held on this one connection; other instances wait here.
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           name       text PRIMARY KEY,
           applied_at timestamptz NOT NULL DEFAULT now()
         )`
      );
      const { rows } = await client.query('SELECT name FROM schema_migrations');
      const done = new Set(rows.map((r) => r.name));

      for (const file of files) {
        if (done.has(file)) continue;
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          err.message = `migration ${file} failed: ${err.message}`;
          throw err;
        }
        applied.push(file);
        console.log(`[migrate] applied ${file}`);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    }
  } finally {
    client.release();
  }
  return applied;
}

module.exports = { migrate };
