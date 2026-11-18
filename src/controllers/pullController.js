'use strict';
const pullService = require('../services/pullService');
const asyncHandler = require('./asyncHandler');

const pullFor = (provider) =>
  asyncHandler(async (req, res) => {
    res.json(await pullService.pullOrders(provider, req.query));
  });

const pullShopee = pullFor('shopee');
const pullTiktok = pullFor('tiktok');
const pullLazada = pullFor('lazada');

const getLazadaItems = asyncHandler(async (req, res) => {
  res.json(await pullService.getLazadaItems(req.params.orderId));
});

module.exports = { pullShopee, pullTiktok, pullLazada, getLazadaItems };
