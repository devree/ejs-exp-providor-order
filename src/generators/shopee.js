'use strict';

const orderTemplate = require('./templates/shopee.order.json');
const itemTemplate = require('./templates/shopee.item.json');
const common = require('./common');

const PROVIDER = 'shopee';

function buildItem(product, quantity) {
  const item = structuredClone(itemTemplate);
  const itemId = Number(product.item_id);
  const original = Math.max(common.convertPrice(PROVIDER, product.original_price), 1);
  const discounted = Math.min(Math.max(common.convertPrice(PROVIDER, product.sale_price), 1), original);

  item.item_id = itemId;
  item.order_item_id = itemId;
  item.item_name = product.name;
  item.model_id = Number(product.model_id);
  item.model_name = product.variation_name;
  item.model_sku = product.sku;
  item.model_original_price = original;
  item.model_discounted_price = discounted;
  item.model_quantity_purchased = quantity;
  item.weight = Number(product.weight_kg);
  item.image_info.image_url = product.image_url;
  return { item, unitPrice: discounted };
}

function generate({ lines, now = new Date() }) {
  const order = structuredClone(orderTemplate);
  const buyer = common.mockBuyer();
  const nowSec = common.unixSeconds(now);

  // create < pay < pickup_done < update <= now
  const createTime = nowSec - common.randInt(2 * 86400, 4 * 86400);
  const payTime = createTime + common.randInt(60, 3600);
  const pickupDoneTime = payTime + common.randInt(3600, 86400);
  const updateTime = Math.min(nowSec, pickupDoneTime + common.randInt(60, 86400));

  order.buyer_user_id = common.numericIdNumber() % 10000000000; // 10 digits max, safe int
  order.buyer_username = buyer.username;
  order.create_time = createTime;
  order.update_time = updateTime;
  order.pay_time = payTime;
  order.pickup_done_time = pickupDoneTime;
  order.ship_by_date = createTime + order.days_to_ship * 86400;
  // Realistic domestic shipping fee in THB (whole baht, number like the template).
  order.estimated_shipping_fee = common.randInt(25, 80);

  const addr = common.mockAddress();
  order.recipient_address.name = buyer.maskedName;
  order.recipient_address.phone = buyer.maskedPhone;
  order.recipient_address.city = addr.city;
  order.recipient_address.district = addr.line2;
  order.recipient_address.full_address = `${addr.line1.slice(0, 3)}******`;
  order.recipient_address.state = addr.city;

  const items = [];
  const itemList = [];
  let subtotal = 0;
  for (const { product, quantity } of lines) {
    const qty = Number(quantity);
    const { item, unitPrice } = buildItem(product, qty);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    itemList.push(item);
    items.push({ product, productId: product.id, quantity: qty, unitPrice, lineTotal });
  }
  order.item_list = itemList;
  order.total_amount = subtotal + order.estimated_shipping_fee;

  return {
    externalOrderId: `SP${common.numericId(14)}`,
    currency: order.currency,
    totalAmount: order.total_amount,
    items,
    payload: order,
  };
}

module.exports = { generate };
