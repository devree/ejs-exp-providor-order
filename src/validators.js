'use strict';

const config = require('./config');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
  }
}

const PROVIDERS = ['shopee', 'tiktok', 'lazada'];

function isBlank(v) {
  return v === undefined || v === '';
}

// Accepts integer numbers or digit-only strings; returns a number or throws.
function toInt(v, name) {
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new ValidationError(`${name} must be an integer`);
    return v;
  }
  if (typeof v === 'string') {
    if (!/^-?\d+$/.test(v.trim())) throw new ValidationError(`${name} must be an integer`);
    const n = Number(v.trim());
    if (!Number.isSafeInteger(n)) throw new ValidationError(`${name} is out of range`);
    return n;
  }
  throw new ValidationError(`${name} must be an integer`);
}

function parseProvider(v) {
  if (typeof v !== 'string' || !PROVIDERS.includes(v)) {
    throw new ValidationError(`provider must be one of: ${PROVIDERS.join(', ')}`);
  }
  return v;
}

function parseProductCount(v, { max = config.orderItemsMax } = {}) {
  const n = toInt(v, 'product_count');
  if (n < 1 || n > max) throw new ValidationError(`product_count must be between 1 and ${max}`);
  return n;
}

function parsePositive(v, name, def, max) {
  if (isBlank(v)) return def;
  const n = toInt(v, name);
  if (n < 1) throw new ValidationError(`${name} must be a positive integer`);
  if (max !== undefined && n > max) throw new ValidationError(`${name} must not exceed ${max}`);
  return n;
}

function parsePage(v, def = 1) {
  return parsePositive(v, 'page', def);
}

function parsePageSize(v, def = 20, max = 100) {
  return parsePositive(v, 'page_size', def, max);
}

function parseLimit(v) {
  return parsePositive(v, 'limit', config.pull.limitDefault, config.pull.limitMax);
}

function parseTime(v, name = 'time') {
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v) || v <= 0) {
      throw new ValidationError(`${name} must be Unix seconds or ISO 8601`);
    }
    return new Date(v * 1000);
  }
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ValidationError(`${name} must be Unix seconds or ISO 8601`);
  }
  const s = v.trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n <= 0) {
      throw new ValidationError(`${name} must be Unix seconds or ISO 8601`);
    }
    const d = new Date(n * 1000);
    if (Number.isNaN(d.getTime())) throw new ValidationError(`${name} is out of range`);
    return d;
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
    throw new ValidationError(`${name} must be Unix seconds or ISO 8601`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${name} must be Unix seconds or ISO 8601`);
  }
  return d;
}

function parsePullQuery(query, provider) {
  const q = query || {};
  const edge = (primary, alias) => {
    const names = provider === 'lazada' ? [primary, alias] : [primary];
    const present = names.filter((n) => !isBlank(q[n]));
    if (present.length > 1) {
      throw new ValidationError(`${primary} and ${alias} must not be used together`);
    }
    if (present.length === 0) return null;
    return parseTime(q[present[0]], present[0]);
  };
  const limit = parseLimit(q.limit);
  const from = edge('time_from', 'created_after');
  const to = edge('time_to', 'created_before');
  if (from && to && from.getTime() > to.getTime()) {
    throw new ValidationError('time_from must not be later than time_to');
  }
  return { limit, from, to };
}

function parsePulledFilter(v) {
  if (isBlank(v)) return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new ValidationError('pulled must be "true" or "false"');
}

function parseOrderId(v) {
  const n = toInt(v, 'id');
  if (n < 1) throw new ValidationError('id must be a positive integer');
  return n;
}

module.exports = {
  ValidationError,
  parseProvider,
  parseProductCount,
  parsePage,
  parsePageSize,
  parseLimit,
  parseTime,
  parsePullQuery,
  parsePulledFilter,
  parseOrderId,
};
