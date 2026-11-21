'use strict';
/**
 * 簡單的 JSON 檔案儲存。
 * 資料量小的單店收銀場景夠用；要換成資料庫時，只需要保留這裡匯出的函式介面。
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
const MAX_TRANSACTIONS = 5000;

let db = { products: [], transactions: [] };

function load() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    db = {
      products: Array.isArray(j.products) ? j.products : [],
      transactions: Array.isArray(j.transactions) ? j.transactions : [],
    };
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('讀取資料檔失敗，將使用空資料：', err.message);
  }
}

function save() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE); // 先寫暫存檔再改名，避免寫到一半斷電造成檔案損毀
}

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

load();

module.exports = {
  dayKey,
  getProducts: () => db.products,
  setProducts(list) {
    db.products = list;
    save();
  },
  /** 取得某天（預設今天）的交易，最新的在最前面 */
  getTransactions(day = dayKey(new Date())) {
    return db.transactions.filter((t) => dayKey(new Date(t.at)) === day).reverse();
  },
  /** 新增交易；相同編號重複送出時只保留第一筆 */
  addTransaction(tx) {
    if (db.transactions.some((t) => t.id === tx.id)) return false;
    db.transactions.push({ ...tx, at: new Date().toISOString() });
    if (db.transactions.length > MAX_TRANSACTIONS) {
      db.transactions.splice(0, db.transactions.length - MAX_TRANSACTIONS);
    }
    save();
    return true;
  },
};
