CREATE TABLE IF NOT EXISTS schema_migrations (
  name       text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             serial PRIMARY KEY,
  sku            text           NOT NULL UNIQUE,
  name           text           NOT NULL,
  variation_name text           NOT NULL,
  category       text           NOT NULL,
  original_price numeric(12,2)  NOT NULL CHECK (original_price > 0),
  sale_price     numeric(12,2)  NOT NULL CHECK (sale_price > 0),
  weight_kg      numeric(8,3)   NOT NULL,
  image_url      text           NOT NULL,
  product_url    text           NOT NULL,
  warehouse_code text           NOT NULL,
  item_id        bigint         NOT NULL UNIQUE,
  model_id       bigint         NOT NULL UNIQUE,
  created_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id                bigserial PRIMARY KEY,
  provider          text          NOT NULL CHECK (provider IN ('shopee','tiktok','lazada')),
  external_order_id text          NOT NULL,
  currency          text          NOT NULL,
  total_amount      numeric(14,2) NOT NULL,
  item_count        int           NOT NULL CHECK (item_count BETWEEN 1 AND 10),
  payload           jsonb         NOT NULL,
  is_pulled         boolean       NOT NULL DEFAULT false,
  pulled_at         timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (provider, external_order_id)
);

-- รองรับ query ของ Pulling API (provider + is_pulled + ช่วงเวลา + เรียงตามเวลา)
CREATE INDEX idx_orders_pull ON orders (provider, created_at, id) WHERE is_pulled = false;
CREATE INDEX idx_orders_list ON orders (created_at DESC, id DESC);

CREATE TABLE order_items (
  id         bigserial PRIMARY KEY,
  order_id   bigint        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id int           NOT NULL REFERENCES products(id),
  quantity   int           NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,   -- ราคาขาย ณ เวลาสร้าง (หน่วยสกุลเงินของ Provider)
  line_total numeric(14,2) NOT NULL,
  payload    jsonb                      -- Lazada: order item object (Shopee/TikTok: NULL)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
