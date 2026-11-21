'use strict';
const express = require('express');
const store = require('../store');

const router = express.Router();

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

/** 健康檢查 */
router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/** 商品清單 */
router.get('/products', (req, res) => {
  res.json(store.getProducts());
});

/** 整份商品清單覆寫（前端新增、刪除商品後送來完整清單） */
router.put('/products', (req, res) => {
  const list = req.body;
  if (!Array.isArray(list) || list.length > 200) return badRequest(res, '商品清單格式不正確（最多 200 項）');
  const clean = [];
  for (const p of list) {
    const name = typeof p?.name === 'string' ? p.name.trim() : '';
    const price = Number(p?.price);
    if (!name || name.length > 20) return badRequest(res, '商品名稱需為 1 到 20 個字');
    if (!isInt(price, 1, 99999)) return badRequest(res, '商品價格需為 1 到 99999 的整數');
    clean.push({ name, price });
  }
  store.setProducts(clean);
  res.json(clean);
});

/** 今日交易紀錄（可用 ?date=YYYY-MM-DD 查其他日期） */
router.get('/transactions', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest(res, 'date 格式應為 YYYY-MM-DD');
  res.json(store.getTransactions(date));
});

/** 新增一筆交易 */
router.post('/transactions', (req, res) => {
  const t = req.body || {};
  const need = Number(t.need);
  const paid = Number(t.paid);
  if (typeof t.id !== 'string' || !/^\d{6,16}$/.test(t.id)) return badRequest(res, '交易編號格式不正確');
  if (!isInt(need, 1, 999999) || !isInt(paid, 1, 999999)) return badRequest(res, '金額需為 1 到 999999 的整數');
  if (typeof t.ok !== 'boolean') return badRequest(res, 'ok 必須是布林值');
  const time = typeof t.time === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(t.time) ? t.time : '';
  const note = typeof t.note === 'string' ? t.note.slice(0, 30) : '';
  const created = store.addTransaction({ id: t.id, need, paid, ok: t.ok, time, note });
  res.status(created ? 201 : 200).json({ created });
});

/** 日結：今日成功筆數與金額 */
router.get('/summary', (req, res) => {
  const list = store.getTransactions();
  const ok = list.filter((t) => t.ok);
  res.json({
    date: store.dayKey(new Date()),
    count: list.length,
    okCount: ok.length,
    failCount: list.length - ok.length,
    total: ok.reduce((sum, t) => sum + t.need, 0),
  });
});

router.use((req, res) => res.status(404).json({ error: '找不到這個 API' }));

module.exports = router;
