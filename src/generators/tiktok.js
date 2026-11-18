'use strict';

const orderTemplate = require('./templates/tiktok.order.json');
const lineItemTemplate = require('./templates/tiktok.line-item.json');
const common = require('./common');

const PROVIDER = 'tiktok';

// Per design D 6.2: one line_item per product (quantity is not expanded and the
// template has no quantity field), so every line_item counts as quantity 1.
function buildLineItem(product, trackingNumber, rtsTime) {
  const li = structuredClone(lineItemTemplate);
  const original = Math.max(Number(common.convertPrice(PROVIDER, product.original_price)), 100);
  const sale = Math.min(Math.max(Number(common.convertPrice(PROVIDER, product.sale_price)), 100), original);
  const originalStr = String(original);
  const saleStr = String(sale);
  const productId = String(product.item_id);
  const skuId = String(product.model_id);

  li.id = common.numericId(18);
  li.sku_id = skuId;
  li.product_id = productId;
  li.product_name = product.name;
  li.sku_name = product.variation_name;
  li.seller_sku = product.sku;
  li.sku_image = product.image_url;
  li.original_price = originalStr;
  li.sale_price = saleStr;
  li.currency = 'IDR';
  li.tracking_number = trackingNumber;
  li.rts_time = rtsTime;

  const sub = li.sub_item_info[0];
  sub.id = li.id;
  sub.sku_id = skuId;
  sub.product_id = productId;
  sub.product_name = product.name;
  sub.sku_name = product.variation_name;
  sub.seller_sku = product.sku;
  sub.sku_image = product.image_url;
  sub.original_price = originalStr;
  sub.sale_price = saleStr;
  sub.currency = 'IDR';
  sub.tracking_number = trackingNumber;
  sub.rts_time = rtsTime;

  return { li, original, sale };
}

function generate({ lines, now = new Date() }) {
  const order = structuredClone(orderTemplate);
  const buyer = common.mockBuyer();
  const addr = common.mockAddress();
  const nowSec = common.unixSeconds(now);

  // create < paid < rts < delivery... ; update_time <= now
  const createTime = nowSec - common.randInt(2 * 86400, 4 * 86400);
  const paidTime = createTime + common.randInt(60, 3600);
  const rtsTime = paidTime + common.randInt(3600, 86400);
  const updateTime = Math.min(nowSec, rtsTime + common.randInt(60, 86400));
  const ttsSlaTime = createTime + 2 * 86400;
  const deliveryTime = createTime + 5 * 86400;

  order.id = common.numericId(18);
  order.user_id = common.numericId(19);
  order.create_time = createTime;
  order.update_time = updateTime;
  order.paid_time = paidTime;
  order.rts_time = rtsTime;
  order.rts_sla_time = paidTime + 86400;
  order.tts_sla_time = ttsSlaTime;
  order.cancel_order_sla_time = createTime + 86400;
  order.release_date = deliveryTime + 7 * 86400;
  order.delivery_sla_time = deliveryTime;
  order.shipping_due_time = ttsSlaTime;
  order.delivery_time = deliveryTime;
  order.request_cancel_time = paidTime + 3600;
  order.delivery_option_required_delivery_time = deliveryTime;
  order.delivery_due_time = deliveryTime;
  order.collection_time = rtsTime + 3600;
  order.cancel_time = paidTime + 7200;
  order.collection_due_time = ttsSlaTime;
  order.pick_up_cut_off_time = ttsSlaTime;
  order.fast_dispatch_sla_time = paidTime + 43200;
  order.recommended_shipping_time = createTime;

  order.tracking_number = `JX${common.randDigits(10)}`;
  order.buyer_nickname = buyer.nickname;
  order.buyer_email = buyer.chatEmail;

  const ra = order.recipient_address;
  ra.name = buyer.fullName;
  ra.first_name = buyer.firstName;
  ra.last_name = buyer.lastName;
  ra.phone_number = buyer.phone;
  ra.full_address = `${addr.line1}, ${addr.city} ${addr.postcode}`;
  ra.region_code = addr.country;
  ra.postal_code = addr.postcode;
  ra.post_town = addr.city;
  ra.address_line1 = addr.line1;
  ra.address_line2 = addr.line2;
  ra.address_detail = addr.line2;

  const items = [];
  const lineItems = [];
  const salePrices = [];
  const originalPrices = [];
  for (const { product } of lines) {
    const { li, original, sale } = buildLineItem(product, order.tracking_number, rtsTime);
    lineItems.push(li);
    salePrices.push(sale);
    originalPrices.push(original);
    items.push({ product, productId: product.id, quantity: 1, unitPrice: sale, lineTotal: sale });
  }
  order.line_items = lineItems;

  // Totals mirror the displayed line_items (each counted once). Other fee fields
  // in `payment` stay as in the template and are not added to total_amount, so
  // the payload total equals the DB total.
  const subTotal = common.sumPrices(salePrices);
  order.payment.sub_total = String(subTotal);
  order.payment.original_total_product_price = String(common.sumPrices(originalPrices));
  order.payment.total_amount = String(subTotal);

  return {
    externalOrderId: order.id,
    currency: order.payment.currency,
    totalAmount: subTotal,
    items,
    payload: order,
  };
}

module.exports = { generate };
