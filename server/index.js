// Local / long-running server: `npm start`. (On Vercel, api/index.js uses the same handler.)
const http = require('http');
const fs = require('fs');
const path = require('path');
const presidents = require('../data/presidents');
const store = require('./store');
const { handle, PORTRAITS } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const missing = presidents.filter((p) => !fs.existsSync(path.join(PORTRAITS, `${p.id}.jpg`)));
if (missing.length) console.warn(`⚠  ${missing.length} portraits missing. Run: npm run portraits`);

http.createServer(handle).listen(PORT, () => {
  console.log(`\n  🇺🇸  Hail to the Guess is live →  http://localhost:${PORT}  (scores: ${store.kind})\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.flush();
    process.exit(0);
  });
}
