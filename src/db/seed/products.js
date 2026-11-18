'use strict';

// สินค้า seed 36 รายการ (6 หมวด x 6 รายการ)
// ราคาเป็น "หน่วยฐาน" (ใกล้เคียง USD) แต่ละ Provider แปลงเป็นสกุลเงินตอนสร้างออร์เดอร์
// item_id / model_id เป็น JS number (< 2^53) และไม่ซ้ำกันทั้งชุด

const BASE_ITEM_ID = 23620853561;
const BASE_MODEL_ID = 221404189791;

// [sku, name, variation_name, original_price, sale_price, weight_kg, warehouse_code]
const catalog = {
  'ความงาม': [
    ['QAZ-SADOER-05', 'SADOER Enlarging Breast Cream Papaya / Coconut Essence 60g', '60g (Papaya)', 12.5, 1.9, 0.01, 'WH-BKK-01'],
    ['QAZ-SADOER-VC30', 'SADOER Vitamin C Brightening Facial Serum 30ml', '30ml', 8.5, 3.5, 0.05, 'WH-BKK-01'],
    ['BIO-ALOE-300', 'BIOAQUA Aloe Vera Moisturizing Gel 300g', '300g', 9.9, 4.2, 0.35, 'WH-BKK-01'],
    ['SAD-HA-MASK10', 'SADOER Hyaluronic Acid Hydrating Facial Mask (10 Sheets)', '10 Sheets', 11.0, 5.5, 0.25, 'WH-BKK-01'],
    ['BIO-LIP-RED', 'BIOAQUA Velvet Matte Lip Tint', 'Red', 6.0, 2.8, 0.03, 'WH-BKK-02'],
    ['SAD-SUN-SPF50', 'SADOER Sunscreen Lotion SPF50 PA+++ 50g', 'SPF50 50g', 14.5, 7.9, 0.08, 'WH-BKK-02'],
  ],
  'เครื่องใช้ไฟฟ้า': [
    ['EL-FAN-MINI01', 'Portable Mini USB Handheld Fan', 'White', 12.0, 6.5, 0.18, 'WH-BKK-03'],
    ['EL-KETTLE-15L', 'Electric Kettle Stainless Steel 1.5L', '1.5L Silver', 28.0, 19.9, 1.1, 'WH-BKK-03'],
    ['EL-AIRFRY-4L', 'Digital Air Fryer 4L', '4L Black', 89.0, 64.0, 4.2, 'WH-BKK-03'],
    ['EL-BLEND-600', 'Personal Blender 600ml', '600ml Green', 35.0, 24.5, 1.6, 'WH-BKK-03'],
    ['EL-HAIRDRY-2000', 'Hair Dryer 2000W Ionic', '2000W Pink', 42.0, 29.0, 0.7, 'WH-BKK-03'],
    ['EL-RICE-18L', 'Rice Cooker 1.8L Non-stick', '1.8L White', 55.0, 39.9, 2.3, 'WH-BKK-03'],
  ],
  'แฟชั่น': [
    ['FA-TEE-COT-M', 'Cotton Crew Neck T-Shirt', 'White / M', 10.0, 5.9, 0.2, 'WH-BKK-04'],
    ['FA-JEAN-SLIM-32', 'Slim Fit Denim Jeans', 'Blue / 32', 38.0, 24.9, 0.65, 'WH-BKK-04'],
    ['FA-DRESS-FLR-S', 'Floral Summer Midi Dress', 'Floral / S', 32.0, 20.5, 0.4, 'WH-BKK-04'],
    ['FA-SNEAK-WH-42', 'Casual Canvas Sneakers', 'White / 42', 45.0, 31.0, 0.8, 'WH-BKK-04'],
    ['FA-BAG-CROSS-BK', 'Crossbody Shoulder Bag PU Leather', 'Black', 26.0, 15.9, 0.45, 'WH-BKK-04'],
    ['FA-CAP-BASE-NV', 'Baseball Cap Adjustable', 'Navy', 8.0, 4.5, 0.1, 'WH-BKK-04'],
  ],
  'ของใช้ในบ้าน': [
    ['HM-TOWEL-SET3', 'Microfiber Bath Towel Set (3 pcs)', 'Grey', 18.0, 11.9, 0.9, 'WH-BKK-05'],
    ['HM-PILLOW-MEM', 'Memory Foam Pillow', 'Standard', 30.0, 21.0, 1.0, 'WH-BKK-05'],
    ['HM-STORE-BOX3', 'Foldable Storage Box (Set of 3)', 'Beige', 22.0, 14.5, 1.3, 'WH-BKK-05'],
    ['HM-MUG-CER350', 'Ceramic Coffee Mug 350ml', 'White', 6.5, 3.9, 0.4, 'WH-BKK-05'],
    ['HM-LAMP-LED-DK', 'LED Desk Lamp USB Rechargeable', 'Warm White', 24.0, 16.5, 0.55, 'WH-BKK-05'],
    ['HM-PAN-NS28', 'Non-stick Frying Pan 28cm', '28cm Black', 27.0, 17.9, 1.2, 'WH-BKK-05'],
  ],
  'อาหารเสริม': [
    ['SP-VITC-1000', 'Vitamin C 1000mg (60 Tablets)', '60 Tablets', 19.0, 12.9, 0.12, 'WH-BKK-06'],
    ['SP-COLL-250G', 'Collagen Peptide Powder 250g', '250g Lychee', 35.0, 24.0, 0.3, 'WH-BKK-06'],
    ['SP-FISHOIL-90', 'Omega-3 Fish Oil 1000mg (90 Softgels)', '90 Softgels', 25.0, 16.5, 0.2, 'WH-BKK-06'],
    ['SP-PROT-WH-1K', 'Whey Protein Isolate 1kg', '1kg Chocolate', 58.0, 42.0, 1.1, 'WH-BKK-06'],
    ['SP-ZINC-50', 'Zinc 50mg (100 Capsules)', '100 Capsules', 12.0, 7.5, 0.1, 'WH-BKK-06'],
    ['SP-PROBIO-30', 'Probiotic Daily Care (30 Sachets)', '30 Sachets', 29.0, 20.0, 0.15, 'WH-BKK-06'],
  ],
  'อุปกรณ์เสริมมือถือ': [
    ['PH-CASE-IP15-BK', 'Shockproof Silicone Phone Case', 'iPhone 15 / Black', 7.0, 3.5, 0.04, 'WH-BKK-07'],
    ['PH-CABLE-C2C-1M', 'USB-C to USB-C Fast Charging Cable 1m', '1m White', 6.0, 3.2, 0.05, 'WH-BKK-07'],
    ['PH-CHARGER-65W', 'GaN Fast Charger 65W 3-Port', '65W White', 32.0, 21.9, 0.2, 'WH-BKK-07'],
    ['PH-PBANK-20K', 'Power Bank 20000mAh', '20000mAh Black', 34.0, 22.5, 0.45, 'WH-BKK-07'],
    ['PH-EARBUD-TWS', 'Bluetooth Wireless Earbuds TWS', 'Black', 28.0, 14.9, 0.06, 'WH-BKK-07'],
    ['PH-GLASS-TEMP', 'Tempered Glass Screen Protector (2 pcs)', 'Clear / 6.1"', 4.5, 2.0, 0.03, 'WH-BKK-07'],
  ],
};

const products = [];
let index = 0;
for (const [category, rows] of Object.entries(catalog)) {
  for (const [sku, name, variation_name, original_price, sale_price, weight_kg, warehouse_code] of rows) {
    products.push({
      sku,
      name,
      variation_name,
      category,
      original_price,
      sale_price,
      weight_kg,
      image_url: `https://picsum.photos/seed/${encodeURIComponent(sku)}/400/400`,
      product_url: `https://shop.example.com/product/${encodeURIComponent(sku.toLowerCase())}`,
      warehouse_code,
      item_id: BASE_ITEM_ID + index,
      model_id: BASE_MODEL_ID + index,
    });
    index += 1;
  }
}

module.exports = products;
