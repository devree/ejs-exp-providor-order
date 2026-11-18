'use strict';
const productRepo = require('../repositories/productRepo');
const { ValidationError, parsePage, parsePageSize } = require('../validators');

const Q_MAX_LENGTH = 100;

function parseQ(q) {
  if (q === undefined || q === null) return undefined;
  if (typeof q !== 'string') throw new ValidationError('q must be a string');
  const t = q.trim();
  if (t === '') return undefined;
  if (t.length > Q_MAX_LENGTH) throw new ValidationError(`q must not exceed ${Q_MAX_LENGTH} characters`);
  return t;
}

const toNum = (v) => (v === null || v === undefined ? v : Number(v));
const toStr = (v) => (v === null || v === undefined ? v : String(v));

function toApiProduct(row) {
  return {
    ...row,
    original_price: toNum(row.original_price),
    sale_price: toNum(row.sale_price),
    weight_kg: toNum(row.weight_kg),
    item_id: toStr(row.item_id),
    model_id: toStr(row.model_id),
  };
}

/**
 * List products (search by name/sku, paginated).
 * @param {{q?: string, page?: *, pageSize?: *}} [opts] raw (unvalidated) inputs
 * @param {{list: Function}} [repo] injectable for tests
 */
async function list({ q, page, pageSize } = {}, repo = productRepo) {
  const term = parseQ(q);
  const p = parsePage(page);
  const ps = parsePageSize(pageSize);
  const { rows, total } = await repo.list({ q: term, page: p, pageSize: ps });
  return { data: rows.map(toApiProduct), page: p, pageSize: ps, total };
}

module.exports = { list };
