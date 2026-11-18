'use strict';

const config = require('./config');
const pool = require('./db/pool');
const { migrate } = require('./db/migrate');

const DB_MAX_ATTEMPTS = 30;
const DB_RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDb() {
  for (let attempt = 1; attempt <= DB_MAX_ATTEMPTS; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      console.log(`[server] database is ready (attempt ${attempt})`);
      return;
    } catch (err) {
      console.warn(
        `[server] database not ready (attempt ${attempt}/${DB_MAX_ATTEMPTS}): ${err.message}`
      );
      if (attempt === DB_MAX_ATTEMPTS) {
        throw new Error(`Database unavailable after ${DB_MAX_ATTEMPTS} attempts`);
      }
      await sleep(DB_RETRY_DELAY_MS);
    }
  }
}

let server = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] received ${signal}, shutting down`);
  try {
    if (server) {
      await new Promise((resolve) => server.close(() => resolve()));
    }
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('[server] error during shutdown:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

async function main() {
  await waitForDb();
  await migrate(pool);

  // Loaded lazily: the seed module is created in a later task.
  const seedModule = require('./db/seed');
  const seed = typeof seedModule === 'function' ? seedModule : seedModule.seed;
  await seed(pool);

  const app = require('./app');
  server = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, () => resolve(s));
    s.on('error', reject);
  });
  console.log(`[server] listening on port ${config.port}`);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch(async (err) => {
  console.error('[server] startup failed:', err && err.stack ? err.stack : err);
  try {
    await pool.end();
  } catch (_) {
    // ignore: already failing
  }
  process.exit(1);
});
