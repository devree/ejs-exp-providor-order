'use strict';
const pool = require('../db/pool');
const orderRepo = require('../repositories/orderRepo');
const { wrapOrders, lazadaItemsEnvelope } = require('../envelopes');
const { NotFoundError } = require('../errors');
const { ValidationError, parseProvider, parsePullQuery } = require('../validators');

const MAX_ORDER_ID_LENGTH = 64;

/**
 * Pull (and stamp as pulled) pending orders for a provider.
 * Validation happens before any transaction so invalid input never stamps rows.
 */
async function pullOrders(provider, query) {
  const prov = parseProvider(provider);
  const { limit, from, to } = parsePullQuery(query, prov);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const countTotal = await orderRepo.countPending(client, { provider: prov, from, to });
    const rows = await orderRepo.lockAndStampPending(client, { provider: prov, limit, from, to });
    const envelope = wrapOrders(prov, rows.map((r) => r.payload), countTotal);
    await client.query('COMMIT');
    return envelope;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failure; original error is more useful
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Read-only: returns the Lazada items envelope for an external order id. */
async function getLazadaItems(orderId) {
  if (
    typeof orderId !== 'string' ||
    orderId.trim() === '' ||
    orderId.length > MAX_ORDER_ID_LENGTH
  ) {
    throw new ValidationError('order_id must be a non-empty string');
  }
  const items = await orderRepo.findLazadaItemsByExternalId(orderId.trim());
  if (items === null) throw new NotFoundError(`Order ${orderId} not found`);
  return lazadaItemsEnvelope(items);
}

module.exports = { pullOrders, getLazadaItems };
