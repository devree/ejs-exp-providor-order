'use strict';
const express = require('express');
const c = require('../controllers/adminController');
const { adminErrorHandler } = require('../middleware/apiErrors');

const router = express.Router();

// Parse here too (no-op if already parsed) so malformed JSON errors reach adminErrorHandler.
router.use(express.json());

router.get('/products', c.listProducts);

router.post('/orders/generate', c.generateOrder);
router.get('/orders', c.listOrders);
// Must be declared before /orders/:id routes.
router.post('/orders/reset-pulled', c.resetAllOrders);
router.get('/orders/:id', c.getOrder);
router.post('/orders/:id/reset-pulled', c.resetOrder);

// Unknown admin routes -> JSON 404
router.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

router.use(adminErrorHandler);

module.exports = router;
