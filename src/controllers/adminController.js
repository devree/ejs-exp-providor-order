'use strict';
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const asyncHandler = require('./asyncHandler');

const listProducts = asyncHandler(async (req, res) => {
  const { q, page, pageSize } = req.query;
  res.json(await productService.list({ q, page, pageSize }));
});

const generateOrder = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { provider, productCount } = body;
  const data = await orderService.generate({ provider, productCount });
  res.status(201).json({ data });
});

const listOrders = asyncHandler(async (req, res) => {
  const { provider, pulled, page, pageSize } = req.query;
  res.json(await orderService.list({ provider, pulled, page, pageSize }));
});

const getOrder = asyncHandler(async (req, res) => {
  res.json({ data: await orderService.getById(req.params.id) });
});

const resetOrder = asyncHandler(async (req, res) => {
  res.json({ data: await orderService.resetOne(req.params.id) });
});

const resetAllOrders = asyncHandler(async (req, res) => {
  res.json({ data: await orderService.resetAll(req.query.provider) });
});

module.exports = {
  listProducts,
  generateOrder,
  listOrders,
  getOrder,
  resetOrder,
  resetAllOrders,
};
