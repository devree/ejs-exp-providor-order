'use strict';

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid env ${name}="${raw}": must be a positive integer`);
  }
  return n;
}

function strFromEnv(name, fallback) {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

const config = {
  port: intFromEnv('APP_PORT', 3000),
  db: {
    host: strFromEnv('DB_HOST', 'localhost'),
    port: intFromEnv('DB_PORT', 5432),
    user: strFromEnv('DB_USER', 'pulling'),
    password: strFromEnv('DB_PASSWORD', 'change-me'),
    database: strFromEnv('DB_NAME', 'provider_pulling'),
  },
  pull: {
    limitDefault: intFromEnv('PULL_LIMIT_DEFAULT', 10),
    limitMax: intFromEnv('PULL_LIMIT_MAX', 50),
  },
  orderItemsMax: intFromEnv('ORDER_ITEMS_MAX', 10),
};

if (config.pull.limitDefault > config.pull.limitMax) {
  throw new Error('PULL_LIMIT_DEFAULT must not exceed PULL_LIMIT_MAX');
}

module.exports = config;
