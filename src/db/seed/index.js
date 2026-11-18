'use strict';
const products = require('./products');

// Arbitrary constant key (distinct from the migration lock) serialising concurrent seeders.
const SEED_LOCK_KEY = 726354811;

const INSERT_SQL = `INSERT INTO products
  (sku, name, variation_name, category, original_price, sale_price, weight_kg,
   image_url, product_url, warehouse_code, item_id, model_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;

/**
 * Idempotent product seed. Runs in a single transaction guarded by an advisory lock.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{seeded: boolean, count: number}>}
 */
async function seed(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [SEED_LOCK_KEY]);
    const { rows } = await client.query('SELECT count(*)::int AS count FROM products');
    const existing = rows[0].count;
    if (existing > 0) {
      await client.query('COMMIT');
      console.log(`[seed] skipped: ${existing} products already exist`);
      return { seeded: false, count: existing };
    }
    for (const p of products) {
      await client.query(INSERT_SQL, [
        p.sku, p.name, p.variation_name, p.category, p.original_price, p.sale_price,
        p.weight_kg, p.image_url, p.product_url, p.warehouse_code, p.item_id, p.model_id,
      ]);
    }
    await client.query('COMMIT');
    console.log(`[seed] inserted ${products.length} products`);
    return { seeded: true, count: products.length };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failure; original error is more useful
    }
    console.error('[seed] failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = seed;
module.exports.seed = seed;
