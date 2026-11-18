'use strict';

const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
});

// An error on an idle client must not crash the process.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client:', err && err.stack ? err.stack : err);
});

module.exports = pool;
