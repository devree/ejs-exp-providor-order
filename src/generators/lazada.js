'use strict';

const orderTemplate = require('./templates/lazada.order.json');
const itemTemplate = require('./templates/lazada.item.json');
const common = require('./common');

const PROVIDER = 'lazada';

// Per design D 6.2: header (orders.payload) + one order item per product,
// 1 item = 1 piece (quantity from the line is ignored).
function buildItem(product, shared, now) {
  const item = structuredClone(itemTemplate);
  const original = Math.max(Number(common.convertPrice(PROVIDER, product.original_price)), 0.01);
  const paid = Math.min(Math.max(Number(common.convertPrice(PROVIDER, product.sale_price)), 0.01), original);
  const paidStr = paid.toFixed(2);

  item.order_id = shared.orderId;
  item.purchase_order_id = shared.purchaseOrderId;
  item.purchase_order_number = shared.purchaseOrderNumber;
  item.buyer_id = shared.buyerId;
  item.created_at = shared.createdAt;
  item.updated_at = shared.updatedAt;
  item.payment_time = shared.paymentTime;
  item.package_id = shared.packageId;
  item.promised_shipping_time = shared.promisedShippingTime;
  item.sla_time_stamp = common.iso8601(common.addSeconds(now, 86400));

  item.order_item_id = common.numericId(15);
  item.product_id = String(product.item_id);
  item.sku_id = String(product.model_id);
  item.sku = product.sku;
  item.shop_sku = `${product.sku}-${product.model_id}`;
  item.name = product.name;
  item.product_main_image = product.image_url;
  item.product_detail_url = `https://www.lazada.sg/products/i${product.item_id}-s${product.model_id}.html`;
  item.item_price = original.toFixed(2);
  item.paid_price = paidStr;
  item.supply_price = (paid * 0.8).toFixed(2);
  item.tracking_code = `LZ${common.randDigits(12)}`;

  return { item, paid, paidStr };
}

function generate({ lines, now = new Date() }) {
  const order = structuredClone(orderTemplate);
  const buyer = common.mockBuyer();
  const addr = common.mockAddress();

  // create < payment < update <= now
  const created = common.addSeconds(now, -common.randInt(2 * 86400, 4 * 86400));
  const paid = common.addSeconds(created, common.randInt(60, 3600));
  const updated = new Date(Math.min(now.getTime(), common.addSeconds(paid, common.randInt(60, 86400)).getTime()));
  const promised = common.addSeconds(created, 2 * 86400);

  const orderId = common.numericId(15);
  const createdAt = common.formatPlus0800(created);
  const updatedAt = common.formatPlus0800(updated);

  const shared = {
    orderId,
    purchaseOrderId: common.numericId(12),
    purchaseOrderNumber: common.numericId(12),
    buyerId: common.numericId(10),
    createdAt,
    updatedAt,
    paymentTime: common.epochMsString(paid),
    packageId: `FP${common.randDigits(12)}`,
    promisedShippingTime: common.formatPlus0800(promised),
  };

  const items = [];
  const paidPrices = [];
  for (const { product } of lines) {
    const { item, paid: paidNum } = buildItem(product, shared, now);
    paidPrices.push(paidNum);
    items.push({
      product,
      productId: product.id,
      quantity: 1,
      unitPrice: paidNum,
      lineTotal: paidNum,
      payload: item,
    });
  }

  const total = common.sumPrices(paidPrices);

  order.order_id = orderId;
  order.order_number = common.numericId(12);
  order.created_at = createdAt;
  order.updated_at = updatedAt;
  order.promised_shipping_times = common.formatNoTz(promised);
  order.price = total.toFixed(2);
  order.items_count = String(items.length);
  order.customer_first_name = buyer.firstName;
  order.customer_last_name = buyer.lastName;

  for (const key of ['address_shipping', 'address_billing']) {
    const a = order[key];
    a.first_name = buyer.firstName;
    a.last_name = buyer.lastName;
    a.phone = key === 'address_shipping' ? buyer.phone : buyer.maskedPhone;
    a.address1 = addr.line1;
    a.address2 = addr.line2;
    a.city = addr.city;
    a.post_code = addr.postcode;
  }
  order.recipient_info.detail_address = `${addr.line1}, ${addr.line2}`;

  return {
    externalOrderId: orderId,
    currency: 'THB',
    totalAmount: total,
    items,
    payload: order,
  };
}

module.exports = { generate };
