'use strict';
require('dotenv').config({ quiet: true });

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const apiRouter = require('./src/routes/api');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const KEY_FILE = process.env.SSL_KEY_FILE;
const CERT_FILE = process.env.SSL_CERT_FILE;
const useTls = Boolean(KEY_FILE && CERT_FILE);

const app = express();
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // 拍照預覽、QR 圖片會用到 data: 與 blob:
        'img-src': ["'self'", 'data:', 'blob:'],
        // 區網用 http 開啟時，不能強制升級成 https
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// 允許本站使用相機
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});
app.use(compression());
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.use((req, res) => res.status(404).type('text').send('404 找不到頁面'));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? '伺服器發生錯誤' : '請求內容不正確' });
});

const server = useTls
  ? https.createServer({ key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CERT_FILE) }, app)
  : http.createServer(app);

server.listen(PORT, HOST, () => {
  const proto = useTls ? 'https' : 'http';
  console.log(`LINE Pay POS 已啟動（${useTls ? 'HTTPS' : 'HTTP'}）`);
  console.log(`  本機：${proto}://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  區網：${proto}://${n.address}:${PORT}`);
    }
  }
  if (!useTls) console.log('  提示：手機要用「即時相機」需要 HTTPS，詳見 README。');
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
