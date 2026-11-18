'use strict';
const defaultPool = require('../db/pool');

const ORDER_COLUMNS =
  'id, provider, external_order_id, currency, total_amount, item_count, payload, is_pulled, pulled_at, created_at';

/**
 * Insert an order and its items in ONE transaction.
 * Errors (including pg unique violation 23505) propagate after ROLLBACK.
 */
async function insertOrder(order, pool = defaultPool) {
  const { provider, externalOrderId, currency, totalAmount, payload, items } = order;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO orders (provider, external_order_id, currency, total_amount, item_count, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING ${ORDER_COLUMNS}`,
      [provider, externalOrderId, currency, totalAmount, items.length, JSON.stringify(payload)]
    );
    const row = rows[0];
    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          row.id,
          it.productId,
          it.quantity,
          it.unitPrice,
          it.lineTotal,
          it.payload === undefined || it.payload === null ? null : JSON.stringify(it.payload),
        ]
      );
    }
    await client.query('COMMIT');
    return row;
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

async function list({ provider, pulled, page = 1, pageSize = 20 } = {}, db = defaultPool) {
  const where = [];
  const params = [];
  if (provider) {
    params.push(provider);
    where.push(`provider = $${params.length}`);
  }
  if (pulled === true || pulled === false) {
    params.push(pulled);
    where.push(`is_pulled = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(`SELECT count(*)::int AS total FROM orders ${whereSql}`, params);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const { rows } = await db.query(
    `SELECT ${ORDER_COLUMNS} FROM orders ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { rows, total: totalRes.rows[0].total };
}

async function findById(id, db = defaultPool) {
  const orderRes = await db.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`, [id]);
  if (orderRes.rows.length === 0) return null;
  const itemsRes = await db.query(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price, oi.line_total, oi.payload,
            p.name AS product_name, p.sku AS product_sku, p.variation_name AS product_variation_name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [id]
  );
  return { ...orderRes.rows[0], items: itemsRes.rows };
}

async function findLazadaItemsByExternalId(externalOrderId, db = defaultPool) {
  const orderRes = await db.query(
    `SELECT id FROM orders WHERE provider = 'lazada' AND external_order_id = $1`,
    [externalOrderId]
  );
  if (orderRes.rows.length === 0) return null;
  const { rows } = await db.query(
    'SELECT payload FROM order_items WHERE order_id = $1 ORDER BY id',
    [orderRes.rows[0].id]
  );
  return rows.map((r) => r.payload);
}

async function resetPulled(id, db = defaultPool) {
  const { rows } = await db.query(
    `UPDATE orders SET is_pulled = false, pulled_at = NULL
     WHERE id = $1
     RETURNING ${ORDER_COLUMNS}`,
    [id]
  );
  return rows[0] || null;
}

async function resetAllPulled(provider, db = defaultPool) {
  const params = [];
  let providerSql = '';
  if (provider) {
    params.push(provider);
    providerSql = 'AND provider = $1';
  }
  const res = await db.query(
    `UPDATE orders SET is_pulled = false, pulled_at = NULL
     WHERE is_pulled = true ${providerSql}`,
    params
  );
  return res.rowCount;
}

/**
 * Lock up to `limit` unpulled orders (SKIP LOCKED) and stamp them as pulled.
 * `client` must already be inside a transaction owned by the caller.
 */
async function lockAndStampPending(client, { provider, limit, from = null, to = null }) {
  const { rows } = await client.query(
    `SELECT id, external_order_id, payload FROM orders
     WHERE provider = $1 AND is_pulled = false
       AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)
     ORDER BY created_at, id
     LIMIT $4
     FOR UPDATE SKIP LOCKED`,
    [provider, from, to, limit]
  );
  if (rows.length > 0) {
    await client.query(
      `UPDATE orders SET is_pulled = true, pulled_at = now() WHERE id = ANY($1::bigint[])`,
      [rows.map((r) => r.id)]
    );
  }
  return rows;
}

async function countPending(client, { provider, from = null, to = null }) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS total FROM orders
     WHERE provider = $1 AND is_pulled = false
       AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)`,
    [provider, from, to]
  );
  return rows[0].total;
}

module.exports = {
  lockAndStampPending,
  countPending,
  insertOrder,
  list,
  findById,
  findLazadaItemsByExternalId,
  resetPulled,
  resetAllPulled,
};
