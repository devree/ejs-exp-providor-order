# Implementation Plan: Provider Order Pulling Simulator

อ้างอิง `requirements.md` (R) และ `design.md` (D) ตัวเลขใน `_Requirements_` คือหมายเลข Requirement และข้อ acceptance criteria
ตาม requirement ไม่มี automated test ใช้การตรวจด้วยมือในงานข้อ 12

- [x] 1. วางโครงโปรเจคและ Docker
  - [x] 1.1 สร้าง `package.json` (dependency: `express`, `ejs`, `pg`; Node 22; script `start`) และ `.gitignore`, `.dockerignore`
  - [x] 1.2 สร้าง `src/config.js` อ่านค่าจาก env (`APP_PORT` ค่าเริ่มต้น 3002 ซึ่งใช้เป็นพอร์ตที่ app listen ทั้งใน container และบนเครื่อง, `DB_*`, `PULL_LIMIT_DEFAULT=10`, `PULL_LIMIT_MAX=50`, `ORDER_ITEMS_MAX=10`) และ `.env.example`
  - [x] 1.3 สร้าง `Dockerfile` (`node:22-alpine`, `npm ci --omit=dev`, รันด้วย user `node`)
  - [x] 1.4 สร้าง `docker-compose.yml` ที่มี service `db` (postgres:16-alpine, healthcheck, named volume `pgdata`) และ `app` (depends_on healthy, ไม่ publish port ของ DB)
  - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [x] 2. Database layer
  - [x] 2.1 สร้าง `src/db/pool.js` (pg Pool จาก config)
  - [x] 2.2 สร้าง `db/migrations/001_init.sql` ตาม D หัวข้อ 3 (`products`, `orders`, `order_items` พร้อม `payload` JSONB, index สำหรับ pulling และ list, `schema_migrations`)
  - [x] 2.3 สร้าง `src/db/migrate.js` รัน migration ตามลำดับชื่อไฟล์ใน transaction และบันทึกใน `schema_migrations`
  - [x] 2.4 สร้าง `src/server.js` ให้ retry เชื่อมต่อ DB, รัน migration, seed แล้วจึง `listen`
  - _Requirements: 7.2, 7.5; D: 3_

- [x] 3. Product seed
  - [x] 3.1 สร้าง `src/db/seed/products.js` สินค้า 36 รายการใน 6 หมวด ครบทุกฟิลด์ตาม R1.3 (`sku`, `name`, `variation_name`, `category`, `original_price`, `sale_price`, `weight_kg`, `image_url`, `product_url`, `warehouse_code`, `item_id`, `model_id`) โดยสินค้าหมวดความงามอ้างอิงตัวอย่าง Shopee
  - [x] 3.2 สร้าง `src/db/seed/index.js` ใน transaction เดียว ใช้ `pg_advisory_xact_lock` และข้ามเมื่อมีสินค้าอยู่แล้ว
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Repositories
  - [x] 4.1 `src/repositories/productRepo.js`: `list({q,page,pageSize})`, `count`, `pickRandom(n)` (`ORDER BY random() LIMIT n`)
  - [x] 4.2 `src/repositories/orderRepo.js`: `insertOrder` (orders + order_items รวม `payload` ของ Lazada ใน transaction), `list({provider,pulled,page,pageSize})`, `findById` (พร้อม items), `findLazadaItemsByExternalId`, `resetPulled(id)`, `resetAllPulled(provider?)`
  - [x] 4.3 เพิ่มใน `orderRepo.js`: `lockAndStampPending({provider,limit,from,to})` และ `countPending({provider,from,to})` ใช้ `FOR UPDATE SKIP LOCKED` และ UPDATE `is_pulled`, `pulled_at` ภายใน transaction เดียวกับ client ที่ส่งเข้ามา
  - _Requirements: 3.5, 4.1-4.5, 5.2, 5.4, 5.7, 6.3; D: 3, 7_

- [x] 5. Generators
  - [x] 5.1 สร้าง `src/generators/templates/*.json` จากไฟล์ใน `data-example/` โดยไม่แก้ไขโครงสร้าง: `shopee.order.json`, `shopee.item.json`, `tiktok.order.json` (รวม key `" "`), `tiktok.line-item.json`, `lazada.order.json`, `lazada.item.json`
  - [x] 5.2 `src/generators/common.js`: random helpers, ตัวสร้าง ID (ตัวเลข string/number ไม่ซ้ำ), ฟอร์แมตเวลา (Unix seconds, `YYYY-MM-DD HH:mm:ss +0800`, ISO 8601, epoch ms string), ค่าอัตราแลกเปลี่ยนและการปัดราคาตาม D 6.1, ข้อมูลผู้ซื้อ/ที่อยู่/เบอร์สมมติ
  - [x] 5.3 `src/generators/shopee.js`: สร้าง `item_list[]` ต่อสินค้า, คำนวณ `total_amount`, เขียนทับฟิลด์ตาม D 6.2
  - [x] 5.4 `src/generators/tiktok.js`: สร้าง `line_items[]` (และ `sub_item_info`), คำนวณ `payment.sub_total`/`original_total_product_price`/`total_amount` ตาม D 6.2
  - [x] 5.5 `src/generators/lazada.js`: สร้างหัวออร์เดอร์ (`price`, `items_count` จากสินค้า) และ order item ต่อสินค้า (`order_id` ตรงกับหัวออร์เดอร์, `order_item_id` ไม่ซ้ำ, quantity = 1)
  - [x] 5.6 `src/generators/index.js` registry `provider -> generator` ที่ส่งคืน `{ externalOrderId, currency, totalAmount, items, payload }`
  - _Requirements: 3.3, 3.4, 3.8, 3.9, 5.2-5.5; D: 6_

- [x] 6. Envelopes และ validators
  - [x] 6.1 `src/envelopes.js`: ห่อ response ของ Shopee, TikTok, Lazada list (`data: { count, countTotal, orders }`), Lazada items พร้อมสร้าง `request_id` ใหม่ทุกครั้ง
  - [x] 6.2 `src/validators.js`: `provider`, `productCount` (1-10), `page`/`pageSize`, `limit` (1-50), แปลง `time_from`/`time_to` (Unix seconds หรือ ISO 8601), ชื่อแทน `created_after`/`created_before` ของ Lazada และตรวจกรณีส่งสองชื่อพร้อมกัน, `time_from > time_to`
  - _Requirements: 5.3, 5.6, 5.8-5.11, 5.17, 6.3; D: 5.2, 6.4_

- [x] 7. Services
  - [x] 7.1 `src/services/productService.js`
  - [x] 7.2 `src/services/orderService.js`: `generate` (สุ่มสินค้า, สุ่ม quantity, เรียก generator, บันทึก, retry 3 ครั้งเมื่อ unique ชน), `list`, `getById`, `resetOne`, `resetAll`
  - [x] 7.3 `src/services/pullService.js`: `pullOrders(provider, params)` (BEGIN, `countPending`, `lockAndStampPending`, ห่อ envelope, COMMIT) และ `getLazadaItems(orderId)` แบบ read-only (404 เมื่อไม่พบ)
  - _Requirements: 3.3-3.9, 5.1-5.16, 6.4; D: 6.3, 7_

- [x] 8. Routes และ controllers สำหรับ API
  - [x] 8.1 `src/routes/admin.api.js` และ controllers: endpoints ทั้งหมดตาม D 5.1 พร้อม error format `{ error: { code, message } }` และ status 200/201/400/404/500 (route `POST /orders/reset-pulled` ต้องประกาศก่อน `/orders/:id/...`)
  - [x] 8.2 `src/routes/pull.api.js` และ controller: `GET /api/pull/{shopee|tiktok|lazada}/orders` และ `GET /api/pull/lazada/orders/:orderId/items` พร้อม error format `{ error, message }`
  - [x] 8.3 `src/app.js`: json body parser, request log middleware, mount routes, error handler (JSON สำหรับ `/api/*`, หน้า `error.ejs` สำหรับหน้าเว็บ), static `public/`
  - _Requirements: 5.1, 5.9, 5.11, 5.15, 5.16, 6.1-6.3_

- [x] 9. Backoffice UI (EJS ภาษาไทย)
  - [x] 9.1 Layout partials (`header`, `sidebar`, `footer`) และ `public/css/app.css` (ไม่พึ่ง CDN)
  - [x] 9.2 `src/routes/pages.js` และ views: `/` redirect ไป `/products`, `products.ejs` (ค้นหา, ตาราง, pagination)
  - [x] 9.3 `order-new.ejs` + `public/js/order-new.js`: เลือก Provider, ใส่จำนวนสินค้า 1-10, ปุ่ม **Gen Order Data** เรียก `POST /api/admin/orders/generate`, แสดงการ์ดสรุปและ error
  - [x] 9.4 `orders.ejs` + `public/js/orders.js`: filter Provider/สถานะการถูกดึง, ตาราง, pagination, ปุ่ม reset ต่อแถวและ "รีเซ็ตทั้งหมด" (confirm)
  - [x] 9.5 `order-detail.ejs`: ข้อมูลหลัก, รายการสินค้า, raw JSON (Lazada แสดงหัวออร์เดอร์และรายการสินค้าแยกส่วน), ปุ่ม reset
  - [x] 9.6 `error.ejs`
  - _Requirements: 2.1-2.3, 3.1, 3.2, 3.6, 3.7, 4.1-4.5; D: 8_

- [x] 10. README
  - เขียน `README.md`: วิธีรัน (`cp .env.example .env`, `docker compose up --build`), URL Backoffice, ตัวอย่าง `curl` ของ Pulling API ทั้ง 3 Provider รวมถึง `limit`, `time_from`/`time_to` และ Lazada order items, วิธี reset สถานะการถูกดึง และวิธีรีเซ็ตข้อมูลทั้งหมด (`docker compose down -v`)
  - _Requirements: 7.6_

- [x] 11. Checkpoint: ระบบรันได้
  - รัน `docker compose up --build` ตรวจว่า migrate และ seed สำเร็จ, มีสินค้า 30+ รายการ, restart แล้วไม่ seed ซ้ำและข้อมูลยังอยู่
  - _Requirements: 1.1, 1.2, 7.1-7.3_

- [x] 12. ตรวจสอบตาม Definition of Done (ด้วยมือ)
  - [x] 12.1 สร้างออร์เดอร์ทั้ง 3 Provider ผ่านหน้า UI ด้วยจำนวนสินค้า 1, 5 และ 10 และตรวจ input ผิด (0, 11, ไม่ใช่ตัวเลข)
  - [x] 12.2 เรียก Pulling API ของแต่ละ Provider สองครั้ง ตรวจว่าครั้งที่สองไม่คืนออร์เดอร์เดิมและหน้า "คำสั่งซื้อ" แสดงสถานะถูกดึง
  - [x] 12.3 ตรวจ `limit` (ค่าเริ่มต้น 10, 50 ผ่าน, 51/0/abc ได้ 400), `time_from`/`time_to` (ในช่วง, นอกช่วง, รูปแบบผิด, from > to ได้ 400 และไม่ stamp) และ `created_after`/`created_before` ของ Lazada
  - [x] 12.4 Lazada: `/orders/:orderId/items` คืนจำนวน item เท่ากับ `items_count`, `order_id` ตรงกับหัวออร์เดอร์, เรียกซ้ำได้ผลเดิม, ไม่พบ order ได้ 404
  - [x] 12.5 ตรวจการเรียกพร้อมกัน (เช่น `xargs -P` ยิง 10 request) ว่าไม่มีออร์เดอร์ซ้ำข้าม response
  - [x] 12.6 เขียนสคริปต์ครั้งเดียว (ไม่เก็บใน repo ก็ได้) เทียบชื่อฟิลด์ทุกระดับของ response ที่ได้กับไฟล์ใน `data-example/` ให้ตรงกัน
  - [x] 12.7 ตรวจปุ่ม reset ต่อออร์เดอร์และทั้งหมด แล้วดึงซ้ำได้
  - _Requirements: ทั้งหมด; R9 Definition of Done_
