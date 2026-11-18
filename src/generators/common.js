'use strict';

const crypto = require('crypto');

// ---------- random helpers ----------

function randInt(min, max) {
  return crypto.randomInt(min, max + 1); // inclusive
}

function pick(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String(crypto.randomInt(0, 10));
  return s;
}

function randHex(n) {
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

function randQuantity() {
  return randInt(1, 3);
}

// ---------- ID generators ----------

let lastTick = 0;

// Strictly increasing microsecond-like tick (16 digits): unique within the process.
function nextTick() {
  lastTick = Math.max(lastTick + 1, Date.now() * 1000);
  return String(lastTick);
}

// Numeric string of exactly n digits, time-based so it is unique within the
// process and collision-resistant across instances (random suffix when n > 16).
function numericId(n) {
  const tick = nextTick(); // 16 digits
  let id;
  if (n <= tick.length) id = tick.slice(tick.length - n);
  else id = tick + randDigits(n - tick.length);
  return id[0] === '0' ? '1' + id.slice(1) : id;
}

// Numeric id as a safe integer (< 2^53, 15 digits).
function numericIdNumber() {
  return Number(numericId(15));
}

// ---------- time formatters ----------

const p2 = (n) => String(n).padStart(2, '0');

function unixSeconds(d) {
  return Math.floor(d.getTime() / 1000);
}

function epochMsString(d) {
  return String(d.getTime());
}

function iso8601(d) {
  return d.toISOString();
}

function partsAtOffset(d, offsetHours) {
  const s = new Date(d.getTime() + offsetHours * 3600 * 1000);
  return (
    `${s.getUTCFullYear()}-${p2(s.getUTCMonth() + 1)}-${p2(s.getUTCDate())} ` +
    `${p2(s.getUTCHours())}:${p2(s.getUTCMinutes())}:${p2(s.getUTCSeconds())}`
  );
}

function formatPlus0800(d) {
  return `${partsAtOffset(d, 8)} +0800`;
}

function formatNoTz(d) {
  return partsAtOffset(d, 8);
}

function addSeconds(d, s) {
  return new Date(d.getTime() + s * 1000);
}

// ---------- currency ----------

const CURRENCY = {
  shopee: { currency: 'VND', rate: 25000 },
  tiktok: { currency: 'IDR', rate: 16000 },
  lazada: { currency: 'SGD', rate: 1.3 },
};

// Returns the provider-typed value: shopee -> integer number, tiktok -> string
// integer, lazada -> string with 2 decimals.
function convertPrice(provider, baseAmount) {
  const cfg = CURRENCY[provider];
  if (!cfg) throw new Error(`unknown provider: ${provider}`);
  const raw = Number(baseAmount) * cfg.rate;
  switch (provider) {
    case 'shopee':
      return Math.round(raw / 1000) * 1000;
    case 'tiktok':
      return String(Math.round(raw / 100) * 100);
    case 'lazada':
      return raw.toFixed(2);
    default:
      throw new Error(`unknown provider: ${provider}`);
  }
}

// Numeric form of a provider-typed price, for summing.
function toNumber(v) {
  return Number(v);
}

// Sum of provider-typed prices, returned as a number (rounded to 2 decimals).
function sumPrices(values) {
  const total = values.reduce((a, v) => a + Number(v), 0);
  return Math.round(total * 100) / 100;
}

// ---------- fake buyer / address data (no real PII) ----------

const FIRST_NAMES = ['Somchai', 'Nguyen', 'Putri', 'Wei', 'Anong', 'Budi', 'Linh', 'Mei', 'Siti', 'Kanya'];
const LAST_NAMES = ['Tan', 'Wijaya', 'Srisuk', 'Tran', 'Lim', 'Santoso', 'Pham', 'Chaiyo', 'Lee', 'Hartono'];
const STREETS = ['Jalan Mawar', 'Orchard Road', 'Sukhumvit Soi', 'Nguyen Hue', 'Jalan Melati', 'Tampines Ave'];
const CITIES = ['Bangkok', 'Ho Chi Minh City', 'Jakarta', 'Singapore', 'Surabaya', 'Hanoi'];
const COUNTRIES = ['TH', 'VN', 'ID', 'SG'];
const EMAIL_DOMAINS = ['example.com', 'mail.test', 'demo.invalid'];

function maskedPhone() {
  return `******${randDigits(2)}`;
}

function fullPhone() {
  return `+${randInt(60, 66)}${randDigits(9)}`;
}

function maskName(name) {
  if (name.length <= 2) return `${name[0]}*`;
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function mockBuyer() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  return {
    firstName: first,
    lastName: last,
    fullName: `${first} ${last}`,
    maskedName: maskName(`${first} ${last}`.replace(' ', '')),
    username: `${first.toLowerCase()}${randDigits(4)}`,
    nickname: `${first.toLowerCase()}_${randHex(4)}`,
    phone: fullPhone(),
    maskedPhone: maskedPhone(),
    email: `${randHex(8)}@${pick(EMAIL_DOMAINS)}`,
    chatEmail: `${randHex(10)}@chat.seller.tiktok.com`,
  };
}

function mockAddress() {
  return {
    line1: `${randInt(1, 999)} ${pick(STREETS)}`,
    line2: `Unit ${randInt(1, 40)}-${randInt(1, 99)}`,
    city: pick(CITIES),
    postcode: randDigits(5),
    country: pick(COUNTRIES),
  };
}

// ---------- request id generators ----------

function shopeeRequestId() {
  return randHex(32);
}

// mimics 202203070749000101890810281E8C70B7 (34 chars: 14-digit timestamp + digits + upper hex)
function tiktokRequestId(now = new Date()) {
  const ts = partsAtOffset(now, 0).replace(/[- :]/g, '');
  return ts + randDigits(10) + randHex(10).toUpperCase();
}

// mimics 0ba2887315178178017221014 (25 chars: "0b" + 6 hex + 17 digits)
function lazadaRequestId() {
  return '0b' + randHex(6) + randDigits(17);
}

module.exports = {
  randInt,
  pick,
  randDigits,
  randHex,
  randQuantity,
  numericId,
  numericIdNumber,
  unixSeconds,
  formatPlus0800,
  formatNoTz,
  iso8601,
  epochMsString,
  addSeconds,
  CURRENCY,
  convertPrice,
  toNumber,
  sumPrices,
  maskedPhone,
  maskName,
  mockBuyer,
  mockAddress,
  shopeeRequestId,
  tiktokRequestId,
  lazadaRequestId,
};
