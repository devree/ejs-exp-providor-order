# Provider Order Pulling Simulator

ระบบจำลอง Marketplace Provider (Shopee, TikTok Shop, Lazada) สำหรับทดสอบการ "ดึงออร์เดอร์" (order pulling)
ผู้ใช้สร้างออร์เดอร์สมมติผ่านหน้า Backoffice แล้วให้ระบบของ Developer เรียก Pulling API
ซึ่งตอบกลับด้วยโครงสร้าง JSON เดียวกับตัวอย่างใน `data-example/` ของแต่ละ Provider

ออร์เดอร์หนึ่งรายการจะถูกส่งออกทาง Pulling API เพียงครั้งเดียว (ระบบ stamp ว่า "ถูกดึงแล้ว") จนกว่าจะ reset

เทคโนโลยี: Node.js 22, Express, EJS, PostgreSQL 16, Docker Compose

## วิธีรัน

ต้องมี Docker และ Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

เมื่อรันครั้งแรก ระบบจะ migrate ฐานข้อมูลและ seed สินค้า 36 รายการ (6 หมวด) โดยอัตโนมัติ
การรันซ้ำจะไม่ seed ซ้ำ และข้อมูลยังอยู่ใน volume `pgdata`

## Backoffice

เปิด http://localhost:3002 (เปลี่ยนพอร์ตได้ด้วย `APP_PORT` ใน `.env`)

| เมนู | URL | หน้าที่ |
|---|---|---|
| สินค้า | `/products` | รายการสินค้าตัวอย่าง ค้นหาด้วยชื่อ/SKU และแบ่งหน้า |
| สร้างออร์เดอร์ | `/orders/new` | เลือก Provider, ใส่จำนวนสินค้า (1-10), กดปุ่ม **Gen Order Data** |
| คำสั่งซื้อ | `/orders` | รายการออร์เดอร์ กรองตาม Provider / สถานะการถูกดึง, ดูรายละเอียดและ raw JSON, reset สถานะ |

## ขั้นตอนใช้งาน: สร้างก่อน แล้วค่อยดึง

1. เปิดเมนู **สร้างออร์เดอร์** เลือก Provider และจำนวนสินค้า แล้วกด **Gen Order Data** (ทำซ้ำได้หลายครั้ง)
2. ระบบของคุณเรียก Pulling API ของ Provider นั้น (ดูหัวข้อถัดไป) ออร์เดอร์ที่ยังไม่ถูกดึงจะถูกส่งกลับและถูกทำเครื่องหมายว่าดึงแล้ว
3. เรียกซ้ำจะไม่ได้ออร์เดอร์เดิม (ได้รายการว่างถ้าไม่มีออร์เดอร์ใหม่)
4. ดูสถานะที่เมนู **คำสั่งซื้อ** ถ้าต้องการทดสอบใหม่ให้ reset สถานะ (ดูหัวข้อ "Reset สถานะการถูกดึง")

หมายเหตุ: ออร์เดอร์ถูกส่งตามลำดับเวลาที่สร้าง (เก่าไปใหม่)

## Pulling API

Base URL: `http://localhost:3002/api/pull` (ไม่ต้องมี authentication)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/pull/shopee/orders` | ดึงออร์เดอร์ Shopee |
| GET | `/api/pull/tiktok/orders` | ดึงออร์เดอร์ TikTok |
| GET | `/api/pull/lazada/orders` | ดึงออร์เดอร์ Lazada (หัวออร์เดอร์) |
| GET | `/api/pull/lazada/orders/:orderId/items` | ดึงรายการสินค้าของออร์เดอร์ Lazada (อ่านอย่างเดียว ไม่ stamp) |

### Query parameters

| พารามิเตอร์ | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `limit` | 10 | จำนวนออร์เดอร์สูงสุดต่อครั้ง ต้องเป็นจำนวนเต็ม 1-50 |
| `time_from` | - | เอาเฉพาะออร์เดอร์ที่สร้างตั้งแต่เวลานี้ (รวมค่านี้) รับ Unix seconds หรือ ISO 8601 |
| `time_to` | - | เอาเฉพาะออร์เดอร์ที่สร้างไม่เกินเวลานี้ (รวมค่านี้) รับ Unix seconds หรือ ISO 8601 |
| `created_after` | - | เฉพาะ Lazada: ชื่อแทน `time_from` |
| `created_before` | - | เฉพาะ Lazada: ชื่อแทน `time_to` |

- เวลาที่ใช้กรองคือเวลาที่ออร์เดอร์ถูกสร้างในระบบจำลองนี้
- Lazada: ห้ามส่ง `time_from` พร้อม `created_after` (หรือ `time_to` พร้อม `created_before`) ในคำขอเดียวกัน จะได้ 400 ส่วน Shopee และ TikTok ไม่รู้จัก `created_after`/`created_before` (ถูกเมินเฉย)
- ถ้า `time_from` มากกว่า `time_to` หรือพารามิเตอร์ผิดรูปแบบ จะได้ 400 และไม่มีออร์เดอร์ถูก stamp
- ISO 8601 ที่มีเครื่องหมาย `+` ต้อง URL-encode เป็น `%2B` (เช่น `+07:00` เป็น `%2B07:00`) หรือใช้ `Z`

### ตัวอย่าง curl

```bash
# Shopee (ค่าเริ่มต้น limit=10)
curl "http://localhost:3002/api/pull/shopee/orders"

# TikTok จำกัด 5 รายการ
curl "http://localhost:3002/api/pull/tiktok/orders?limit=5"

# Lazada สูงสุด 50 รายการ
curl "http://localhost:3002/api/pull/lazada/orders?limit=50"

# กรองด้วยเวลา Unix seconds
curl "http://localhost:3002/api/pull/shopee/orders?time_from=1735689600&time_to=1893455999"

# กรองด้วย ISO 8601
curl "http://localhost:3002/api/pull/tiktok/orders?time_from=2025-01-01T00:00:00Z&time_to=2030-12-31T23:59:59Z"

# Lazada ใช้ชื่อพารามิเตอร์แบบ Lazada ได้
curl "http://localhost:3002/api/pull/lazada/orders?created_after=2025-01-01T00:00:00Z&created_before=2030-12-31T23:59:59Z&limit=20"

# Lazada: รายการสินค้าของออร์เดอร์ (ใช้ order_id จากหัวออร์เดอร์; เรียกซ้ำได้ผลเดิม)
curl "http://localhost:3002/api/pull/lazada/orders/<order_id>/items"
```

### โครงสร้าง response

| Provider | โครงสร้าง |
|---|---|
| Shopee | `{ "error": "", "message": "", "request_id": "...", "response": { "order_list": [ ... ] } }` |
| TikTok | `{ "code": 0, "data": { "orders": [ ... ] }, "message": "Success", "request_id": "..." }` |
| Lazada (orders) | `{ "code": "0", "data": { "count": N, "countTotal": M, "orders": [ ... ] }, "request_id": "..." }` |
| Lazada (items) | `{ "code": "0", "data": [ ...order items... ], "request_id": "..." }` |

- `request_id` สร้างใหม่ทุกครั้งที่เรียก
- Lazada `count` คือจำนวนออร์เดอร์ใน response นี้ ส่วน `countTotal` คือจำนวนออร์เดอร์ที่ยังไม่ถูกดึงและตรงเงื่อนไขเวลา ณ ตอนเรียก (ก่อน `limit`)
- Lazada แยกหัวออร์เดอร์กับรายการสินค้า: ใช้ `order_id` จากหัวออร์เดอร์เรียก endpoint `/items` และจำนวน item เท่ากับ `items_count`
- ไม่มีออร์เดอร์ที่ตรงเงื่อนไข จะได้ 200 พร้อมรายการว่าง

### รูปแบบ error ของ Pulling API

```json
{ "error": "BAD_REQUEST", "message": "limit must not exceed 50" }
```

| HTTP | `error` | เมื่อไหร่ |
|---|---|---|
| 400 | `BAD_REQUEST` | `limit` นอกช่วง/ไม่ใช่ตัวเลข, เวลาผิดรูปแบบ, `time_from` > `time_to`, ส่งชื่อพารามิเตอร์เวลาซ้ำกัน |
| 404 | `NOT_FOUND` | ไม่พบออร์เดอร์ Lazada ตาม `:orderId` หรือ route ไม่มีอยู่ |
| 500 | `INTERNAL_ERROR` | ข้อผิดพลาดภายในระบบ |

## Reset สถานะการถูกดึง

ออร์เดอร์ที่ถูกดึงแล้วจะไม่ถูกส่งอีก ถ้าต้องการให้ดึงซ้ำได้ ให้ reset สถานะด้วยวิธีใดวิธีหนึ่ง

1. **หน้า UI** เมนู คำสั่งซื้อ: ปุ่ม reset ต่อแถว (หรือในหน้ารายละเอียด) และปุ่ม "รีเซ็ตทั้งหมด"
2. **Admin API** ออร์เดอร์เดียว:
   ```bash
   curl -X POST http://localhost:3002/api/admin/orders/1/reset-pulled
   ```
3. **Admin API** ทุกออร์เดอร์ (ระบุ `?provider=shopee|tiktok|lazada` เพื่อ reset เฉพาะ Provider):
   ```bash
   curl -X POST http://localhost:3002/api/admin/orders/reset-pulled
   curl -X POST "http://localhost:3002/api/admin/orders/reset-pulled?provider=lazada"
   ```

## Admin API

Base URL: `http://localhost:3002/api/admin` (ใช้โดยหน้า Backoffice และเรียกเองได้)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/products?q=&page=&pageSize=` | รายการสินค้า (`q` ค้นหาชื่อ/SKU; `pageSize` ค่าเริ่มต้น 20 สูงสุด 100) |
| POST | `/orders/generate` | สร้างออร์เดอร์ body: `{ "provider": "shopee", "productCount": 3 }` (`provider` = `shopee` / `tiktok` / `lazada`, `productCount` = 1-10) ตอบ 201 `{ "data": { id, provider, externalOrderId, itemCount, totalAmount, currency, createdAt } }` |
| GET | `/orders?provider=&pulled=&page=&pageSize=` | รายการออร์เดอร์ (`pulled` = `true` / `false`) ตอบ `{ data, page, pageSize, total }` |
| GET | `/orders/:id` | รายละเอียดออร์เดอร์ พร้อม `items` และ `payload` |
| POST | `/orders/:id/reset-pulled` | reset ออร์เดอร์เดียว ตอบ `{ "data": { id, isPulled: false } }` |
| POST | `/orders/reset-pulled?provider=` | reset ทั้งหมด ตอบ `{ "data": { resetCount } }` |

ตัวอย่าง:

```bash
curl -X POST http://localhost:3002/api/admin/orders/generate \
  -H "Content-Type: application/json" \
  -d '{"provider":"lazada","productCount":3}'
```

### รูปแบบ error ของ Admin API

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "product_count must be between 1 and 10" } }
```

| HTTP | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 404 | `NOT_FOUND` |
| 500 | `INTERNAL_ERROR` |

## รีเซ็ตข้อมูลทั้งหมด

ลบ container และ volume ของฐานข้อมูล (สินค้าจะถูก seed ใหม่เมื่อรันครั้งถัดไป)

```bash
docker compose down -v
```

`docker compose down` เฉยๆ จะคงข้อมูลไว้

## Environment variables

ตั้งค่าในไฟล์ `.env` (คัดลอกจาก `.env.example`)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `APP_PORT` | `3002` | พอร์ตที่เปิดบนเครื่องของคุณ |
| `DB_HOST` | `localhost` | host ของฐานข้อมูล (ใน Docker Compose ถูกแทนที่เป็น `db` อัตโนมัติ) |
| `DB_PORT` | `5432` | พอร์ตฐานข้อมูล (ใน Docker Compose ใช้ 5432 ภายใน network และไม่เปิดออกนอกเครื่อง) |
| `DB_USER` | `pulling` | ผู้ใช้ PostgreSQL |
| `DB_PASSWORD` | `change-me` | รหัสผ่าน PostgreSQL ควรเปลี่ยนค่านี้ |
| `DB_NAME` | `provider_pulling` | ชื่อฐานข้อมูล |
| `PULL_LIMIT_DEFAULT` | `10` | ค่า `limit` เริ่มต้นของ Pulling API (ต้องไม่เกิน `PULL_LIMIT_MAX`) |
| `PULL_LIMIT_MAX` | `50` | ค่า `limit` สูงสุดของ Pulling API |
| `ORDER_ITEMS_MAX` | `10` | จำนวนสินค้าสูงสุดต่อออร์เดอร์ตอนสร้าง |

หลังแก้ `.env` ต้องรัน `docker compose up --build` ใหม่ (ค่า `DB_USER`/`DB_PASSWORD`/`DB_NAME` มีผลตอนสร้างฐานข้อมูลครั้งแรก ถ้าเปลี่ยนภายหลังให้ `docker compose down -v` ก่อน)

## ข้อควรรู้

- **Shopee ไม่มี `order_sn` และ status**: ตัวอย่าง Shopee ไม่มี id หรือ status ของออร์เดอร์ใน payload จึงแยกออร์เดอร์ด้วยฟิลด์อื่นได้เท่านั้น เช่น `buyer_user_id` + `create_time`
- **ราคาถูกแปลงเป็นบาท (THB)**: ราคาในหน้าสินค้าเป็นราคาฐาน (ใกล้เคียง USD) ส่วนออร์เดอร์ของทุก Provider ใช้สกุลเงิน THB (฿) โดยแปลงด้วยอัตราคงที่ 1 หน่วยฐาน = 35 บาท จึงไม่ตรงกับราคาในหน้าสินค้า
- **Lazada 1 item = 1 ชิ้น**: ตัวอย่างไม่มีฟิลด์จำนวน ระบบจึงสร้าง order item ละ 1 ชิ้น ส่วน Shopee กับ TikTok สุ่ม quantity 1-3
- **`count` / `countTotal` ของ Lazada ยังไม่ยืนยัน**: `lazada-data.json` ตรงกับ GetOrder (ออร์เดอร์เดียว) ส่วน list endpoint ใช้รูปแบบ GetOrders (`data.orders[]`, `count`, `countTotal`) ตามเอกสาร Seller Center ชื่อ `count`/`countTotal` ยังไม่ได้ยืนยันกับเอกสาร Lazada Open Platform โดยตรง
- `order_id` ของ Lazada order item ถูกสร้างให้ตรงกับหัวออร์เดอร์ (ตัวอย่างต้นฉบับไม่ตรงกัน)
