'use strict';
const defaultDb = require('../db/pool');

// NOTE: node-postgres returns `numeric` columns (original_price, sale_price,
// weight_kg) as strings, and `bigint` columns (item_id, model_id) as strings.
// Rows are returned as-is; generators are responsible for converting them.

const COLUMNS = `id, sku, name, variation_name, category, original_price, sale_price,
  weight_kg, image_url, product_url, warehouse_code, item_id, model_id, created_at`;

/** Escape LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * List products with optional search (name or sku, case-insensitive) and pagination.
 * @param {{q?: string, page?: number, pageSize?: number}} [opts]
 * @param {{query: Function}} [db] pool or client
 * @returns {Promise<{rows: object[], total: number}>}
 */
async function list({ q, page = 1, pageSize = 20 } = {}, db = defaultDb) {
  const params = [];
  let where = '';
  const term = typeof q === 'string' ? q.trim() : '';
  if (term) {
    params.push(`%${escapeLike(term)}%`);
    where = `WHERE name ILIKE $1 ESCAPE '\\' OR sku ILIKE $1 ESCAPE '\\'`;
  }
  const limit = Math.max(1, Math.floor(pageSize));
  const offset = (Math.max(1, Math.floor(page)) - 1) * limit;

  const totalRes = await db.query(`SELECT count(*)::int AS total FROM products ${where}`, params);
  const rowsRes = await db.query(
    `SELECT ${COLUMNS} FROM products ${where}
     ORDER BY id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { rows: rowsRes.rows, total: totalRes.rows[0].total };
}

/** @returns {Promise<number>} total number of products */
async function count(db = defaultDb) {
  const res = await db.query('SELECT count(*)::int AS total FROM products');
  return res.rows[0].total;
}

/**
 * Pick n distinct random products.
 * @param {number} n
 * @param {{query: Function}} [db]
 */
async function pickRandom(n, db = defaultDb) {
  const res = await db.query(
    `SELECT ${COLUMNS} FROM products ORDER BY random() LIMIT $1`,
    [n]
  );
  return res.rows;
}

module.exports = { list, count, pickRandom };
