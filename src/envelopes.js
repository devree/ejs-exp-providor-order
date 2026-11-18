'use strict';

const { shopeeRequestId, tiktokRequestId, lazadaRequestId } = require('./generators/common');

function shopeeEnvelope(orders) {
  return { error: '', message: '', request_id: shopeeRequestId(), response: { order_list: orders } };
}

function tiktokEnvelope(orders) {
  return { code: 0, data: { orders }, message: 'Success', request_id: tiktokRequestId() };
}

function lazadaListEnvelope(orders, countTotal) {
  return {
    code: '0',
    data: { count: orders.length, countTotal: countTotal === undefined ? orders.length : countTotal, orders },
    request_id: lazadaRequestId(),
  };
}

function lazadaItemsEnvelope(items) {
  return { code: '0', data: items, request_id: lazadaRequestId() };
}

function wrapOrders(provider, orders, countTotal) {
  switch (provider) {
    case 'shopee': return shopeeEnvelope(orders);
    case 'tiktok': return tiktokEnvelope(orders);
    case 'lazada': return lazadaListEnvelope(orders, countTotal);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

module.exports = { shopeeEnvelope, tiktokEnvelope, lazadaListEnvelope, lazadaItemsEnvelope, wrapOrders };
