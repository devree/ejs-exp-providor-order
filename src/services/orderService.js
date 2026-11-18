'use strict';
const orderRepo = require('../repositories/orderRepo');
const productRepo = require('../repositories/productRepo');
const { getGenerator } = require('../generators');
const common = require('../generators/common');
const { NotFoundError } = require('../errors');
const {
  ValidationError,
  parseProvider,
  parseProductCount,
  parsePage,
  parsePageSize,
  parsePulledFilter,
  parseOrderId,
} = require('../validators');

const MAX_ATTEMPTS = 3;
const PG_UNIQUE_VIOLATION = '23505';

function toSummary(row) {
  return {
    id: Number(row.id),
    provider: row.provider,
    externalOrderId: row.external_order_id,
    itemCount: row.item_count,
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    createdAt: row.created_at,
  };
}

function toMeta(row) {
  return {
    id: Number(row.id),
    provider: row.provider,
    externalOrderId: row.external_order_id,
    currency: row.currency,
    totalAmount: Number(row.total_amount),
    itemCount: row.item_count,
    isPulled: row.is_pulled,
    pulledAt: row.pulled_at,
    createdAt: row.created_at,
  };
}

function toItem(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: row.product_name,
    productSku: row.product_sku,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    payload: row.payload,
  };
}

/**
 * Generate and persist one order for a provider.
 * @param {{provider: *, productCount: *}} input raw (unvalidated)
 */
async function generate({ provider, productCount } = {}) {
  const prov = parseProvider(provider);
  const n = parseProductCount(productCount);

  const available = await productRepo.count();
  if (available < n) {
    throw new ValidationError(
      `product_count (${n}) exceeds the number of available products (${available})`
    );
  }
  const products = await productRepo.pickRandom(n);
  const generator = getGenerator(prov);

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const lines = products.map((p) => ({ product: p, quantity: common.randQuantity() }));
    const g = generator.generate({ lines, now: new Date() });
    try {
      const row = await orderRepo.insertOrder({
        provider: prov,
        externalOrderId: g.externalOrderId,
        currency: g.currency,
        totalAmount: g.totalAmount,
        payload: g.payload,
        items: g.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          payload: it.payload,
        })),
      });
      return toSummary(row);
    } catch (err) {
      if (err && err.code === PG_UNIQUE_VIOLATION && attempt < MAX_ATTEMPTS) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** @param {{provider?: *, pulled?: *, page?: *, pageSize?: *}} [opts] raw inputs */
async function list({ provider, pulled, page, pageSize } = {}) {
  const prov =
    provider === undefined || provider === null || provider === ''
      ? undefined
      : parseProvider(provider);
  const pl = parsePulledFilter(pulled === null ? undefined : pulled);
  const p = parsePage(page);
  const ps = parsePageSize(pageSize);
  const { rows, total } = await orderRepo.list({ provider: prov, pulled: pl, page: p, pageSize: ps });
  return { data: rows.map(toMeta), page: p, pageSize: ps, total };
}

async function getById(id) {
  const oid = parseOrderId(id);
  const row = await orderRepo.findById(oid);
  if (!row) throw new NotFoundError(`Order ${oid} not found`);
  return { ...toMeta(row), items: row.items.map(toItem), payload: row.payload };
}

async function resetOne(id) {
  const oid = parseOrderId(id);
  const row = await orderRepo.resetPulled(oid);
  if (!row) throw new NotFoundError(`Order ${oid} not found`);
  return { id: Number(row.id), isPulled: false };
}

async function resetAll(provider) {
  const prov =
    provider === undefined || provider === null || provider === ''
      ? undefined
      : parseProvider(provider);
  const resetCount = await orderRepo.resetAllPulled(prov);
  return { resetCount };
}

module.exports = { generate, list, getById, resetOne, resetAll };
