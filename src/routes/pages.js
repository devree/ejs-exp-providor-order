'use strict';

const express = require('express');
const config = require('../config');
const asyncHandler = require('../controllers/asyncHandler');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const productRepo = require('../repositories/productRepo');

const router = express.Router();

const totalPagesOf = (total, pageSize) => Math.max(1, Math.ceil(total / pageSize));
const str = (v) => (typeof v === 'string' ? v : undefined);

router.get('/', (req, res) => res.redirect(302, '/products'));

// ValidationError / NotFoundError propagate to the app's error handler (400/404 error view).
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const q = str(req.query.q);
    const { data, page, pageSize, total } = await productService.list({
      q,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.render('products', {
      title: 'สินค้า',
      active: 'products',
      products: data,
      page,
      pageSize,
      total,
      q: q ? q.trim() : '',
      totalPages: totalPagesOf(total, pageSize),
    });
  })
);

router.get(
  '/orders/new',
  asyncHandler(async (req, res) => {
    const productTotal = await productRepo.count();
    res.render('order-new', {
      title: 'สร้างออร์เดอร์',
      active: 'orders-new',
      maxItems: config.orderItemsMax,
      productTotal,
    });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const provider = str(req.query.provider) || '';
    const pulled = str(req.query.pulled) || '';
    const { data, page, pageSize, total } = await orderService.list({
      provider: provider || undefined,
      pulled: pulled || undefined,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    res.render('orders', {
      title: 'คำสั่งซื้อ',
      active: 'orders',
      orders: data,
      page,
      pageSize,
      total,
      totalPages: totalPagesOf(total, pageSize),
      filters: { provider, pulled },
    });
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await orderService.getById(req.params.id);
    res.render('order-detail', {
      title: `คำสั่งซื้อ #${order.id}`,
      active: 'orders',
      order,
    });
  })
);

module.exports = router;
