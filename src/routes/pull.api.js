'use strict';
const express = require('express');
const c = require('../controllers/pullController');
const { pullErrorHandler } = require('../middleware/apiErrors');

const router = express.Router();

// Pull responses are live, stateful data; never cache.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/shopee/orders', c.pullShopee);
router.get('/tiktok/orders', c.pullTiktok);
router.get('/lazada/orders', c.pullLazada);
router.get('/lazada/orders/:orderId/items', c.getLazadaItems);

// Unknown pull routes -> JSON 404
router.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

router.use(pullErrorHandler);

module.exports = router;
