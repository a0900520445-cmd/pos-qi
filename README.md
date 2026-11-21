# LINE Pay POS 收銀機

用 Node.js + Express 做的 POS 收銀機網頁。店家在手機或平板上選好商品（或直接輸入金額），掃描顧客的 QR Code，金額剛好相符就收款成功，不足或超過都會顯示付款失敗。

> **這是示範系統，沒有串接真正的 LINE Pay。** 付款碼內容約定為 `LINE 金額`，例如 `LINE 170` 代表顧客付 170 元。正式收款請改接 LINE Pay 官方 API，並把金鑰放在伺服器端，不要放在前端。

## 功能

- 商品自己新增、刪除（存在伺服器），點商品加入訂單，可調整數量
- 也可以切到「輸入金額」用數字鍵收款
- 兩種掃碼方式：
  - **LINE Pay 掃碼收款**：開啟手機內建相機拍下 QR Code（任何環境都能用）
  - **即時相機**：直接用鏡頭連續掃描（需要 HTTPS 或 localhost）
- 金額比對：剛好相符才算成功；不足顯示差額，超過顯示多出金額
- 今日交易紀錄與成功合計，重新整理後仍保留
- 提示音與震動、深色模式、可加入手機主畫面

## 需求

Node.js 18 以上。

## 安裝與啟動

```bash
npm install
cp .env.example .env     # 需要時再修改，不改也能跑
npm start
```

啟動後終端機會列出本機網址與區網網址，例如 `http://localhost:3000`、`http://192.168.1.20:3000`。

開發時可用 `npm run dev`，改了 `server.js` 或 `src/` 會自動重啟。

## 用手機當收銀機

1. 電腦和手機連同一個 Wi-Fi。
2. 手機瀏覽器開啟終端機顯示的「區網」網址。
3. 用「LINE Pay 掃碼收款」拍照掃描，不需要 HTTPS。

## 啟用 HTTPS（即時相機需要）

手機瀏覽器只允許 HTTPS 或 localhost 使用即時相機。可以用 [mkcert](https://github.com/FiloSottile/mkcert) 做本機憑證：

```bash
mkcert -install
mkdir certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 192.168.1.20
```

把 `192.168.1.20` 換成你電腦的區網 IP，然後在 `.env` 加入：

```
SSL_KEY_FILE=./certs/key.pem
SSL_CERT_FILE=./certs/cert.pem
```

重新啟動後改用 `https://` 開啟。手機需要安裝並信任 mkcert 的根憑證，才不會出現憑證警告（根憑證位置用 `mkcert -CAROOT` 查詢）。

## 測試用 QR Code

頁面下方的「測試用 QR Code」可以產生 `LINE 金額` 的 QR，用另一支手機或螢幕顯示後再掃。沒有第二個螢幕時，先設好應收金額，按「模擬掃到 LINE ○○○」就能直接測試流程。

拍照時請讓 QR 佔畫面大一些、對焦清楚、避開反光。讀不到時，點一下照片裡 QR 的位置會放大再讀，也可以手動輸入顧客付款金額。

## 環境變數

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3000` | 伺服器埠號 |
| `HOST` | `0.0.0.0` | 監聽位址，只想本機使用可設 `127.0.0.1` |
| `DATA_DIR` | `./data` | 資料存放資料夾（`db.json`） |
| `SSL_KEY_FILE` | 無 | HTTPS 私鑰路徑，與下一項都填才會啟用 HTTPS |
| `SSL_CERT_FILE` | 無 | HTTPS 憑證路徑 |

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/health` | 健康檢查 |
| GET | `/api/products` | 商品清單 |
| PUT | `/api/products` | 以完整清單覆寫商品，格式 `[{"name":"咖啡","price":100}]` |
| GET | `/api/transactions` | 今日交易，可加 `?date=YYYY-MM-DD` |
| POST | `/api/transactions` | 新增交易，相同 `id` 重複送出只會保留第一筆 |
| GET | `/api/summary` | 今日筆數、成功與失敗筆數、成功合計 |

## 專案結構

```
linepay-pos/
├── server.js              伺服器入口（安全標頭、靜態檔案、HTTPS）
├── src/
│   ├── store.js           JSON 檔案儲存（日後換資料庫只需改這裡）
│   └── routes/api.js      API 路由與輸入檢查
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js          收銀流程、訂單、交易紀錄
│   ├── js/scanner.js      QR 辨識（分區掃描、二值化、多引擎）
│   ├── vendor/            jsQR、ZXing、qrcode-generator 與授權檔
│   ├── icons/icon.svg
│   └── manifest.webmanifest
├── data/                  執行後產生 db.json（已加入 .gitignore）
├── .env.example
└── package.json
```

## 第三方元件

`public/vendor/` 內為 jsQR（Apache-2.0）、ZXing（Apache-2.0）、qrcode-generator（MIT），jsQR 與 ZXing 的授權檔放在 `public/vendor/licenses/`，qrcode-generator 的授權聲明在 `public/vendor/qrcode.js` 檔案開頭。

## 注意事項

- 資料存在單一 JSON 檔，適合單店單機。多台收銀機同時使用，或需要長期保存與報表時，建議改用資料庫。
- 這個專案沒有登入與權限，請只在店內網路使用，不要直接開放到網際網路。
