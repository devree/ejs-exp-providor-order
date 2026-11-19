# Requirements: Provider Order Pulling Simulator

## 1. ภาพรวม (Introduction)

โปรเจคนี้เป็นเครื่องมือจำลองการสร้างออร์เดอร์จาก Marketplace Provider 3 ราย ได้แก่ **Shopee**, **TikTok Shop** และ **Lazada** เพื่อให้ทีม Developer นำไปรันและเรียก API ดึงรายการออร์เดอร์ (pulling order list) มาทดสอบระบบของตนเอง โดยไม่ต้องพึ่งพา Provider จริง

ผู้ใช้สร้างออร์เดอร์ผ่านหน้า Backoffice (เลือก Provider และจำนวนสินค้าในออร์เดอร์) ระบบสุ่มสร้างข้อมูลออร์เดอร์ในรูปแบบ response ของ Provider นั้น ๆ แล้วบันทึกลง Database จากนั้น Developer เรียก Pulling API เพื่อดึงออร์เดอร์ที่ยังไม่เคยถูกดึง ออร์เดอร์ที่ถูกดึงแล้วจะถูก stamp และไม่ถูกส่งกลับในการเรียกครั้งถัดไป

### Tech Stack (ตามที่กำหนด)

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | EJS (server-side rendered) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Runtime / Deploy | Docker (docker-compose) |

### Glossary

- **Provider**: ช่องทางขาย ได้แก่ `shopee`, `tiktok`, `lazada`
- **Product**: สินค้าตั้งต้นใน Database ที่ใช้เป็นข้อมูลประกอบการสร้างออร์เดอร์
- **Order**: ออร์เดอร์จำลองที่ระบบสร้างขึ้น
- **Pulling API**: API สำหรับ Developer เรียกเพื่อดึงออร์เดอร์
- **Pulled stamp**: ค่าที่บอกว่าออร์เดอร์ถูกดึงผ่าน Pulling API แล้ว (พร้อมเวลาที่ดึง)

## 2. ผลการวิเคราะห์ข้อมูลตัวอย่าง (Sample Data Analysis)

ไฟล์ตัวอย่างอยู่ที่ `data-example/` โครงสร้างของแต่ละ Provider ต่างกันมาก จึงต้องออกแบบ Product ให้มีข้อมูลเพียงพอสำหรับทุก Provider

| หัวข้อ | Shopee | TikTok | Lazada |
|---|---|---|---|
| Envelope | `{ error, message, request_id, response: { order_list: [] } }` | `{ code: 0, data: { orders: [] }, message, request_id }` | `{ code: "0", data: {...}, request_id }` (GetOrder, `data` เป็น object ของออร์เดอร์เดียว) และ `{ code: "0", data: [...], request_id }` (GetOrderItems, `data` เป็น array) |
| Order ID | (ไม่มีฟิลด์ `order_sn` ในตัวอย่าง) | `id` | `order_id` (และ `order_number`) |
| รายการสินค้า | `item_list[]` ซ้อนใน order | `line_items[]` ซ้อนใน order | **แยกเป็น 2 ไฟล์/2 response**: `lazada-data.json` = ข้อมูลหัวออร์เดอร์ (ไม่มีรายการสินค้า) และ `lazada-order-item.json` = รายการสินค้าของออร์เดอร์ (1 element ใน `data[]` = 1 order item, เชื่อมกันด้วย `order_id`) |
| ชนิดเวลา | Unix seconds (number) | Unix seconds (number) | หลายแบบ: string `"2014-10-15 19:12:15 +0800"`, `"2017-03-24 16:09:22"` (ไม่มี timezone), ISO 8601 (ใน order item), epoch ms (string, ใน order item) |
| ชนิดเงิน | number (หน่วยเล็ก เช่น VND) | string | string |
| สกุลเงิน/ภูมิภาค | VND / VN | IDR / US (ตัวอย่างปนกัน) | SGD |
| ข้อมูลสินค้าที่ใช้ | `item_id`, `item_name`, `model_id`, `model_name`, `model_sku`, `model_original_price`, `model_discounted_price`, `model_quantity_purchased`, `weight`, `image_info.image_url` | `product_id`, `sku_id`, `product_name`, `sku_name`, `seller_sku`, `original_price`, `sale_price`, `sku_image` | (อยู่ใน order item) `product_id`, `sku_id`, `sku`, `shop_sku`, `name`, `item_price`, `paid_price`, `product_main_image`, `product_detail_url` |
| ข้อมูลผู้ซื้อ/ที่อยู่ | `recipient_address` (city, district, state, region, zipcode, name, phone) | `recipient_address` (full_address, name, phone_number, region_code, postal_code, district_info ...) | (อยู่ในหัวออร์เดอร์) `customer_first_name`, `customer_last_name`, `address_shipping`, `address_billing`, `recipient_info` ; ใน order item มี `buyer_id` |
| Status | ไม่มีใน order ตัวอย่าง | `status` เช่น `UNPAID` | หัวออร์เดอร์มี `statuses: []` ; order item มี `status` เช่น `canceled` |

ข้อสังเกตจากข้อมูลตัวอย่าง:

1. ตัวอย่าง Shopee ไม่มีฟิลด์ `order_sn` และ `order_status` ซึ่งเป็นฟิลด์หลักของ Shopee จริง
2. ตัวอย่าง TikTok มี key ที่เป็นช่องว่าง `" "` ใน `payment` (น่าจะเป็นความผิดพลาดของตัวอย่าง)
3. ตัวอย่างบางส่วนมีค่าขัดแย้งกัน เช่น TikTok `currency` เป็น IDR แต่ `region_code` เป็น US
4. ค่า `status` ในตัวอย่างไม่ได้เป็นสถานะที่สะท้อนออร์เดอร์ใหม่ (Lazada order item = `canceled`)
5. ข้อมูล Lazada แยกเป็น 2 ระดับ (หัวออร์เดอร์ และรายการสินค้า) ซึ่งตรงกับวิธีใช้งาน Lazada จริงที่ต้องเรียก 2 API ค่า `order_id` ใน order item ต้องตรงกับ `order_id` ของหัวออร์เดอร์ที่ตัวอย่างให้มาเป็นคนละค่า (`16090` กับ `31202`) ในระบบนี้จะสร้างให้ตรงกัน
6. `lazada-data.json` ตรงกับ API GetOrder (`/order/get`, ดึงออร์เดอร์เดียวด้วย `order_id`) ส่วน API รายการออร์เดอร์ของ Lazada คือ GetOrders (`/orders/get`) ที่คืนหลายออร์เดอร์พร้อมจำนวนรวม (ตรวจกับเอกสาร Seller Center ของ Lazada) Pulling API จึงใช้รูปแบบ GetOrders คือ `data: { count, countTotal, orders: [...] }` โดยแต่ละ object ใน `orders` มีโครงสร้างเดียวกับ `data` ของ `lazada-data.json` (ดู Requirement 5.14) ชื่อ `count`/`countTotal` ยังไม่ได้ยืนยันกับหน้า Open Platform โดยตรง

## 3. ขอบเขต (Scope)

### In scope

- Seed สินค้าตั้งต้นอย่างน้อย 30 รายการ
- หน้า Backoffice (EJS) สำหรับดูสินค้า, สร้างออร์เดอร์, ดูรายการออร์เดอร์
- Internal API สำหรับรองรับ Backoffice ทั้งหมด
- Pulling API แยก path สำหรับ Developer
- Docker / docker-compose สำหรับรัน app + PostgreSQL

### Out of scope (ยกเว้นผู้ใช้ขอเพิ่ม)

- การเชื่อมต่อ Provider จริง
- ระบบ Login / จัดการผู้ใช้ใน Backoffice
- การแก้ไข/ลบสินค้าผ่านหน้าจอ
- การเปลี่ยนสถานะออร์เดอร์ตาม lifecycle (จัดส่ง, ยกเลิก ฯลฯ)
- Automated tests (จะทำเมื่อผู้ใช้ร้องขอ)

## 4. Functional Requirements

### Requirement 1: Product Seed Data

**User Story:** ในฐานะ Developer ฉันต้องการให้ระบบมีสินค้าตั้งต้นพร้อมใช้ เพื่อให้สร้างออร์เดอร์ทดสอบได้ทันทีหลังรัน

Acceptance Criteria

1. WHEN ระบบเริ่มทำงานครั้งแรกและตาราง product ว่าง THEN ระบบ SHALL สร้างสินค้าตั้งต้นอย่างน้อย 30 รายการ
2. WHEN ระบบเริ่มทำงานซ้ำและมีสินค้าอยู่แล้ว THEN ระบบ SHALL NOT สร้างสินค้าซ้ำ (seed ต้อง idempotent)
3. สินค้าแต่ละรายการ SHALL มีข้อมูลอย่างน้อย: ชื่อ, SKU, ชื่อ variation/model, ราคาปกติ, ราคาขายหลังลด, น้ำหนัก, URL รูปภาพ, URL หน้าสินค้า, รหัสคลังสินค้า/ตำแหน่งสินค้า และ ID สินค้าที่เพียงพอต่อการสร้าง ID ของทั้ง 3 Provider (เช่น `item_id`/`model_id`, `product_id`/`sku_id`)
4. ข้อมูลสินค้า SHALL มีความหลากหลาย (หลายหมวด หลายช่วงราคา) เพื่อให้ออร์เดอร์ที่สุ่มไม่ซ้ำกันเกินไป

### Requirement 2: Backoffice – หน้าสินค้า

**User Story:** ในฐานะผู้ใช้ ฉันต้องการดูรายการสินค้าทั้งหมด เพื่อรู้ว่ามีสินค้าอะไรให้ใช้สร้างออร์เดอร์

Acceptance Criteria

1. ระบบ SHALL มีเมนู "สินค้า" แสดงรายการสินค้าทั้งหมดในรูปแบบตาราง (รูป, ชื่อ, SKU, ราคา, น้ำหนัก)
2. WHEN สินค้ามีจำนวนมาก THEN ระบบ SHALL แบ่งหน้า (pagination)
3. ระบบ SHALL รองรับการค้นหาด้วยชื่อหรือ SKU

### Requirement 3: Backoffice – สร้างออร์เดอร์ (Gen Order Data)

**User Story:** ในฐานะผู้ใช้ ฉันต้องการเลือก Provider และจำนวนสินค้า แล้วกดสร้างออร์เดอร์ เพื่อให้มีข้อมูลออร์เดอร์จำลองใน Database

Acceptance Criteria

1. ระบบ SHALL มีหน้าสร้างออร์เดอร์ที่ให้เลือก Provider ได้ 1 ใน 3 (Shopee, TikTok, Lazada)
2. ระบบ SHALL มีช่องระบุ "จำนวนสินค้าในออร์เดอร์" (จำนวนรายการสินค้าที่ไม่ซ้ำกัน) ตั้งแต่ 1 ถึง 10 ชิ้น
3. WHEN ผู้ใช้กดปุ่ม "Gen Order Data" THEN ระบบ SHALL สุ่มเลือกสินค้าจากตาราง product ตามจำนวนที่ระบุ (ไม่ซ้ำกันในออร์เดอร์เดียว) และสร้างออร์เดอร์ 1 รายการ
4. ออร์เดอร์ที่สร้าง SHALL มีโครงสร้างตรงกับตัวอย่างของ Provider ที่เลือก (ดูหัวข้อ 5)
5. ออร์เดอร์ SHALL ถูกบันทึกลง Database พร้อมสถานะ "ยังไม่ถูกดึง"
6. WHEN สร้างสำเร็จ THEN ระบบ SHALL แจ้งผลและแสดงสรุปออร์เดอร์ที่สร้าง (Order ID, Provider, จำนวนสินค้า, ยอดรวม) พร้อมลิงก์ไปดูรายละเอียด
7. IF จำนวนสินค้าไม่ใช่จำนวนเต็มบวก หรือมากกว่า 10 หรือมากกว่าจำนวนสินค้าที่มี THEN ระบบ SHALL แสดงข้อความผิดพลาดและไม่สร้างออร์เดอร์
8. Order ID และเลขอ้างอิงที่ต้องไม่ซ้ำ SHALL ไม่ซ้ำกันภายใน Provider เดียวกัน
9. ระบบ SHALL สุ่มข้อมูลที่เกี่ยวกับผู้ซื้อ/ที่อยู่/การชำระเงิน/การจัดส่งให้สมเหตุสมผล และยอดรวมของออร์เดอร์ SHALL สอดคล้องกับราคาและจำนวนของสินค้าที่เลือก

### Requirement 4: Backoffice – รายการคำสั่งซื้อ

**User Story:** ในฐานะผู้ใช้ ฉันต้องการดูรายการและรายละเอียดออร์เดอร์ที่สร้างไว้ เพื่อตรวจสอบข้อมูลและสถานะการถูกดึง

Acceptance Criteria

1. ระบบ SHALL มีเมนู "คำสั่งซื้อ" แสดงรายการออร์เดอร์เรียงจากใหม่ไปเก่า (Order ID, Provider, จำนวนสินค้า, ยอดรวม, เวลาสร้าง, สถานะการถูกดึง, เวลาที่ถูกดึง)
2. ระบบ SHALL รองรับ filter ตาม Provider และตามสถานะการถูกดึง (ทั้งหมด / ยังไม่ถูกดึง / ถูกดึงแล้ว)
3. ระบบ SHALL รองรับ pagination
4. WHEN ผู้ใช้เลือกออร์เดอร์ THEN ระบบ SHALL แสดงรายละเอียดรวมถึง raw JSON ของออร์เดอร์ตามรูปแบบ Provider (Lazada แสดง 2 ส่วน: หัวออร์เดอร์ และรายการสินค้า)
5. ระบบ SHALL มีปุ่ม "รีเซ็ตสถานะการถูกดึง" ต่อออร์เดอร์ และแบบทั้งหมด เพื่อให้ Developer ทดสอบดึงซ้ำได้ 

### Requirement 5: Pulling API (สำหรับ Developer)

**User Story:** ในฐานะ Developer ฉันต้องการเรียก API เพื่อดึงออร์เดอร์ที่ยังไม่เคยดึง เพื่อทดสอบ flow การ pulling ของระบบฉัน

Acceptance Criteria

1. ระบบ SHALL มี Pulling API แยก path จาก API ของ Backoffice โดยใช้ prefix `/api/pull/` และมี endpoint ต่อ Provider ได้แก่ `GET /api/pull/shopee/orders`, `GET /api/pull/tiktok/orders`, `GET /api/pull/lazada/orders` และสำหรับ Lazada มี endpoint เพิ่มสำหรับดึงรายการสินค้าของออร์เดอร์ `GET /api/pull/lazada/orders/:orderId/items` (ดูข้อ 14-16)
2. WHEN เรียก endpoint THEN ระบบ SHALL คืนเฉพาะออร์เดอร์ของ Provider นั้นที่ยังไม่ถูกดึง
3. Response SHALL ใช้ envelope และโครงสร้างตรงกับตัวอย่างของ Provider นั้น (ดูหัวข้อ 2 และ 5)
4. WHEN ออร์เดอร์ถูกส่งกลับสำเร็จ THEN ระบบ SHALL stamp ออร์เดอร์นั้นว่าถูกดึงแล้ว พร้อมเวลาที่ดึง
5. WHEN เรียก endpoint ซ้ำ THEN ระบบ SHALL NOT คืนออร์เดอร์ที่ถูก stamp แล้ว
6. IF ไม่มีออร์เดอร์ที่ยังไม่ถูกดึง THEN ระบบ SHALL คืน response สำเร็จพร้อมรายการว่าง (ในรูปแบบ envelope ของ Provider)
7. การเลือกและการ stamp ออร์เดอร์ SHALL ทำใน transaction เดียว และต้องปลอดภัยเมื่อมีการเรียกพร้อมกัน (ออร์เดอร์เดียวต้องไม่ถูกส่งให้ 2 request) เช่นใช้ `SELECT ... FOR UPDATE SKIP LOCKED`
8. ระบบ SHALL รองรับ query parameter `limit` เพื่อจำกัดจำนวนออร์เดอร์ต่อการเรียก ค่าเริ่มต้น 10 และค่าสูงสุด 50
9. WHEN ผู้เรียกส่ง `limit` ไม่ใช่จำนวนเต็มบวก หรือมากกว่า 50 THEN ระบบ SHALL ตอบ 400 พร้อมข้อความผิดพลาด
10. ระบบ SHALL รองรับ filter ตามช่วงเวลาด้วย query parameter `time_from` และ `time_to` (optional ทั้งคู่) โดยกรองจากเวลาสร้างออร์เดอร์ (`orders.created_at`) แบบ `time_from <= created_at <= time_to` และรับค่าได้ทั้ง Unix timestamp (วินาที) และ ISO 8601
11. IF `time_from` หรือ `time_to` รูปแบบไม่ถูกต้อง หรือ `time_from` มากกว่า `time_to` THEN ระบบ SHALL ตอบ 400 พร้อมข้อความผิดพลาดและไม่ stamp ออร์เดอร์ใด
12. ออร์เดอร์ที่ไม่อยู่ในช่วงเวลาที่กรอง SHALL ไม่ถูกส่งกลับและไม่ถูก stamp
13. ระบบ SHALL ให้ Developer ดึง Pulling API ได้โดยไม่ต้องผ่าน UI (curl/Postman) และ SHALL มี `request_id` ใน response ตามรูปแบบ Provider
14. `GET /api/pull/lazada/orders` SHALL คืนเฉพาะ **หัวออร์เดอร์** (รูปแบบตาม `lazada-data.json`) ใน envelope `{ code: "0", data: { count, countTotal, orders: [<order>...] }, request_id }` ตามรูปแบบ GetOrders โดยแต่ละ object ใน `orders` มีโครงสร้างเดียวกับ `data` ของ `lazada-data.json`, `count` = จำนวนออร์เดอร์ที่คืนในครั้งนั้น, `countTotal` = จำนวนออร์เดอร์ที่ยังไม่ถูกดึงและตรงเงื่อนไข filter ก่อนการเรียกนั้น และการ stamp, `limit`, `time_from`, `time_to` ตามข้อ 2-12 นำมาใช้กับ endpoint นี้
15. `GET /api/pull/lazada/orders/:orderId/items` SHALL คืนรายการสินค้าของออร์เดอร์ที่ `order_id` ตรงกับ `:orderId` ในรูปแบบ `lazada-order-item.json` (`{ code: "0", data: [<item>...], request_id }`) โดยจำนวน element ใน `data[]` เท่ากับจำนวนสินค้าของออร์เดอร์ และทุก element มี `order_id` เท่ากับ `:orderId`
16. endpoint ในข้อ 15 SHALL NOT stamp ออร์เดอร์ และเรียกซ้ำได้โดยได้ผลเหมือนเดิม (read-only) โดยไม่ขึ้นกับสถานะการถูกดึง ถ้าไม่พบ `order_id` SHALL ตอบ 404 ในรูปแบบ error ของระบบ

17. สำหรับ `GET /api/pull/lazada/orders` ระบบ SHALL รับ `created_after` และ `created_before` (ISO 8601 หรือ Unix seconds) เป็นชื่อแทนของ `time_from` และ `time_to` ตามลำดับ (ตรงกับชื่อ parameter ของ GetOrders) ถ้าส่งทั้งสองชื่อสำหรับขอบเดียวกัน SHALL ตอบ 400

### Requirement 6: Internal API สำหรับ Backoffice

**User Story:** ในฐานะ Frontend ฉันต้องการ API ครบทุกการทำงาน เพื่อให้หน้าจอไม่ต้องเข้าถึง Database โดยตรง

Acceptance Criteria

1. Backend SHALL มี API (prefix `/api/admin/`) รองรับทุกการทำงานของ Frontend ได้แก่
   - `GET /api/admin/products` (รองรับ `page`, `pageSize`, `q`)
   - `POST /api/admin/orders/generate` (body: `provider`, `productCount`)
   - `GET /api/admin/orders` (รองรับ `provider`, `pulled`, `page`, `pageSize`)
   - `GET /api/admin/orders/:id` (สำหรับ Lazada ต้องคืนทั้งหัวออร์เดอร์และรายการสินค้า)
   - `POST /api/admin/orders/:id/reset-pulled` และ `POST /api/admin/orders/reset-pulled`
2. API SHALL ตอบเป็น JSON และใช้ HTTP status code ที่เหมาะสม (200/201/400/404/500)
3. API SHALL validate input ที่ขอบเขตของระบบ และใช้ parameterized query ทั้งหมด
4. หน้า EJS SHALL เรียกผ่าน API ชุดนี้ (ผ่าน fetch ฝั่ง client หรือผ่าน controller ที่ใช้ service เดียวกัน) โดยไม่ซ้ำ logic

### Requirement 7: Docker และ Database

**User Story:** ในฐานะ Developer ฉันต้องการรันทั้งระบบด้วยคำสั่งเดียว เพื่อเริ่มทดสอบได้ทันที

Acceptance Criteria

1. ระบบ SHALL รันได้ด้วย `docker compose up` โดยมี service อย่างน้อย `app` (Node/Express) และ `db` (PostgreSQL)
2. ระบบ SHALL สร้าง schema (migration) และ seed สินค้าอัตโนมัติเมื่อ start
3. ข้อมูลใน PostgreSQL SHALL คงอยู่ข้ามการ restart ผ่าน named volume
4. ค่าตั้งค่า (port, DB credentials, ค่า limit ฯลฯ) SHALL อ่านจาก environment variable พร้อมไฟล์ `.env.example` และ SHALL NOT hardcode credentials ใน source
5. app SHALL รอให้ DB พร้อมก่อน start (healthcheck / retry)
6. ระบบ SHALL รันที่พอร์ต 3002 เป็นค่าเริ่มต้น (เปลี่ยนได้ด้วย env `APP_PORT`) และ SHALL มี README อธิบายวิธีรัน, URL ของ Backoffice (`http://localhost:3002`), ตัวอย่าง `curl` ของ Pulling API ทั้ง 3 Provider (รวม Lazada order items)

## 5. Data Requirements: โครงสร้างออร์เดอร์ที่สร้าง

หลักการ: เก็บออร์เดอร์ใน Database แบบ normalized บางส่วน (ฟิลด์ที่ใช้ query: provider, order id, ยอดรวม, สถานะการถูกดึง, เวลา) ร่วมกับ **payload JSONB** ที่เป็น order object ตามรูปแบบ Provider (Lazada: `orders.payload` = หัวออร์เดอร์, `order_items.payload` = รายการสินค้า) เพื่อให้ Pulling API คืนข้อมูลได้ตรงกับตัวอย่างโดยไม่ต้อง map ซ้ำ

### 5.1 ตาราง (ระดับ requirement)

- `products`: ข้อมูลสินค้าตั้งต้น (ดู Requirement 1.3)
- `orders`: `id`, `provider`, `external_order_id` (unique ต่อ provider), `total_amount`, `currency`, `item_count`, `payload` (JSONB), `created_at`, `is_pulled` (boolean), `pulled_at` (timestamp, nullable)
- `order_items`: รายการสินค้าในออร์เดอร์ อ้างอิง `orders` และ `products` พร้อมจำนวน ราคาขาย ณ เวลาสร้าง และมีคอลัมน์ `payload` (JSONB, nullable) ใช้เก็บ order item object ตามรูปแบบ `lazada-order-item.json` สำหรับ Provider Lazada (Shopee/TikTok เป็น null เพราะรายการสินค้าซ้อนอยู่ใน `orders.payload`)
- ต้องมี index รองรับ query ของ Pulling API (provider + is_pulled + created_at)

### 5.2 Shopee

- Envelope: `error`, `message`, `request_id`, `response.order_list[]`
- ฟิลด์ต่อออร์เดอร์ต้องครอบคลุมตามตัวอย่าง `shopee-data.json` และ `item_list[]` ต้องมีจำนวนเท่ากับจำนวนสินค้าที่ผู้ใช้เลือก
- `model_quantity_purchased` สุ่ม 1-3 (ปรับได้), `total_amount` คำนวณจากราคาลดคูณจำนวน (+ ค่าส่งประมาณการ) ของสินค้าในออร์เดอร์
- คงโครงสร้างและฟิลด์ตามตัวอย่างทุกประการ ไม่เพิ่มหรือลบฟิลด์ (ไม่เพิ่ม `order_sn`/`order_status`)

### 5.3 TikTok

- Envelope: `code`, `message`, `request_id`, `data.orders[]`
- ฟิลด์ต่อออร์เดอร์ตามตัวอย่าง `tiktok-data.json` และ `line_items[]` มีจำนวนเท่ากับจำนวนสินค้าที่เลือก
- `payment.sub_total`, `total_amount` คำนวณจาก `line_items` ให้สอดคล้องกัน
- คงโครงสร้างและฟิลด์ตามตัวอย่างทุกประการ รวมถึง key ที่เป็นช่องว่าง `" "` ใน `payment`

### 5.4 Lazada

Lazada แยกข้อมูลเป็น 2 ระดับ โดยอ้างอิงจากไฟล์ตัวอย่าง 2 ไฟล์

**หัวออร์เดอร์** (`lazada-data.json`)

- ฟิลด์ตามตัวอย่างทุกประการ (`order_id`, `order_number`, `created_at`, `updated_at`, `promised_shipping_times`, `price`, `items_count`, `customer_first_name`, `customer_last_name`, `address_shipping`, `address_billing`, `recipient_info`, `statuses`, `payment_method` ฯลฯ) และไม่มีรายการสินค้าซ้อนอยู่
- ฟิลด์ที่ขึ้นกับออร์เดอร์ SHALL สร้างให้สอดคล้องกับสินค้าที่เลือก: `items_count` = จำนวนสินค้า และ `price` = ผลรวม `paid_price` ของ order item ทั้งหมด

**รายการสินค้า** (`lazada-order-item.json`)

- Envelope: `code`, `request_id`, `data[]` โดย 1 element ใน `data[]` = 1 order item
- ออร์เดอร์ที่มี N สินค้า SHALL มี order item N รายการ ซึ่งทุกรายการมี `order_id` เท่ากับ `order_id` ของหัวออร์เดอร์ และมี `order_item_id` ต่างกัน
- Lazada ไม่มีฟิลด์จำนวนชิ้น จึงกำหนดให้ 1 order item = 1 ชิ้น (quantity = 1)
- ฟิลด์ที่ขึ้นกับสินค้า (`product_id`, `sku_id`, `sku`, `shop_sku`, `name`, `product_main_image`, `product_detail_url`, `item_price`, `paid_price`) SHALL มาจากสินค้าที่เลือก

**กฎร่วมของ Lazada**

- ชนิดข้อมูลทุกฟิลด์ตามตัวอย่าง (ส่วนใหญ่เป็น string รวมถึงตัวเลขและ boolean)
- ฟิลด์เวลา SHALL ใช้รูปแบบเดียวกับตัวอย่างของแต่ละฟิลด์
- Pulling `limit` นับเป็นจำนวนออร์เดอร์ (หัวออร์เดอร์) การ stamp ทำที่ endpoint รายการออร์เดอร์เท่านั้น

### 5.5 กฎร่วม

1. ข้อมูลสุ่มต้องไม่ใช้ข้อมูลส่วนบุคคลจริง (ชื่อ เบอร์โทร อีเมล เป็นข้อมูลปลอม)
2. ฟิลด์สถานะของ Provider (เช่น `status`) SHALL ใช้ค่าตามตัวอย่างโดยไม่แก้ไข (TikTok `UNPAID`, Lazada order item `status` = `canceled` และหัวออร์เดอร์ `statuses` = `[]`, Shopee ไม่มีฟิลด์สถานะ) ส่วนสถานะการ pulling เก็บแยกในคอลัมน์ `is_pulled` และ `pulled_at` ของตาราง `orders` ไม่ปนใน payload
2.1. กฎ "คงตามตัวอย่าง" หมายถึงรายชื่อฟิลด์ ชนิดข้อมูล และรูปแบบค่าคงเดิม ส่วนค่าที่ขึ้นกับออร์เดอร์ (ID, เวลา, สินค้า, ราคา, ชื่อผู้ซื้อ) ยังคงสุ่มหรือคำนวณตามจริง
3. เวลา (create_time ฯลฯ) SHALL เป็นเวลาปัจจุบัน ณ ตอนสร้าง ในรูปแบบของ Provider นั้น

## 6. Non-Functional Requirements

1. **Maintainability**: แยกชั้น routes / controllers / services / repositories และแยก generator ต่อ Provider (Strategy pattern) เพื่อเพิ่ม Provider ใหม่ได้ง่าย
2. **Security**: parameterized query, escape output ใน EJS, ไม่เก็บ secret ใน source, container รันด้วย non-root user, เปิด port DB ออกภายนอกเฉพาะเมื่อกำหนด
3. **Performance**: Pulling API ตอบภายใน 1 วินาที สำหรับ `limit` ไม่เกิน 50 ออร์เดอร์ ภายใต้ข้อมูลหลักพันออร์เดอร์
4. **Reliability**: การ stamp ต้อง atomic, ถ้า response ส่งไม่สำเร็จ transaction ต้องไม่ commit stamp
5. **Observability**: log request พื้นฐานและ error ลง stdout
6. **Usability**: UI ใช้ภาษาไทยอย่างสม่ำเสมอ และใช้ layout แบบ backoffice (sidebar menu + content)

## 7. Assumptions

1. ใช้งานเป็นเครื่องมือภายในทีม Dev ไม่เปิด public จึงไม่มีระบบ Login
2. Pulling API ไม่มี authentication เนื่องจากรัน Docker บนเครื่อง local
3. 1 คลิก "Gen Order Data" สร้าง 1 ออร์เดอร์
4. Product 1 รายการแทน SKU/variation 1 ตัว
5. รันบน Node.js LTS ล่าสุด, PostgreSQL 16
6. Frontend ใช้ EJS และ UI เป็นภาษาไทย (ยืนยันแล้ว)
7. Lazada ใช้ข้อมูลตัวอย่าง 2 ไฟล์ (หัวออร์เดอร์ + รายการสินค้า) ตาม Requirement 5.4 และ list endpoint ของ Lazada คืน `data: { count, countTotal, orders: [...] }` ตามรูปแบบ GetOrders

## 8. Decisions (สรุปคำตอบที่ยืนยันแล้ว)

| # | หัวข้อ | การตัดสินใจ |
|---|---|---|
| 1 | Auth ของ Pulling API | ไม่มี (รัน Docker local) |
| 2 | Filter ตามเวลา | มี `time_from` / `time_to` กรองจากเวลาสร้างออร์เดอร์ |
| 3 | ปุ่ม reset สถานะการ pulling | มี (ต่อออร์เดอร์ และทั้งหมด) |
| 4 | `limit` | เริ่มต้น 10 สูงสุด 50 |
| 5 | โครงสร้าง/ค่า status ของ payload | คงตามตัวอย่างทั้งหมด ไม่แก้ไข |
| 6 | Frontend | EJS, UI ภาษาไทย (ยืนยันแล้ว) |
| 7 | จำนวนสินค้าสูงสุดต่อออร์เดอร์ | 10 |
| 8 | Lazada | แยก 2 ระดับ: list endpoint คืนหัวออร์เดอร์รูปแบบ GetOrders `data.orders[]` (stamp) และ `/orders/:orderId/items` คืนรายการสินค้ารูปแบบ GetOrderItems (ไม่ stamp) รับ `created_after`/`created_before` เป็นชื่อแทน |

## 9. Definition of Done

1. `docker compose up` แล้วเปิด Backoffice ได้ มีสินค้า 30+ รายการ
2. สร้างออร์เดอร์ได้ครบทั้ง 3 Provider ด้วยจำนวนสินค้าที่เลือก และเห็นในหน้า "คำสั่งซื้อ"
3. เรียก Pulling API ของแต่ละ Provider ได้ response ตรงรูปแบบตัวอย่าง
4. Lazada เรียก `/orders/:orderId/items` แล้วได้รายการสินค้าครบตามจำนวนและ `order_id` ตรงกับหัวออร์เดอร์ โดยไม่ stamp
5. เรียกซ้ำแล้วไม่ได้ออร์เดอร์เดิม และหน้า "คำสั่งซื้อ" แสดงสถานะถูกดึงแล้ว
6. README ครบตาม Requirement 7.6
