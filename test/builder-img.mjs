// Deck builder shows card faces: thumbnails in the card list and in the deck, a large face when a row is opened; pictures that arrive later replace the drawn face in place.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import zlib from 'node:zlib';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
function png(w, h, rgb) {
  const crc = buf => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))]); const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const b = await chromium.launch(); let ok = true; const out = {};
for (const [w, h, tag] of [[1280, 900, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); let asked = 0;
  await ctx.route('http://vg.test/**', r => (new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.fulfill({ status: 404, body: '' })));
  await ctx.route('https://cf-vanguard.com/**', r => { asked++; const n = +(/_(\d+)\.png$/.exec(r.request().url()) || [0, 0])[1]; return n % 3 === 0 ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'image/png', body: png(20, 28, [60 + (n * 37) % 180, 60 + (n * 59) % 180, 90 + (n * 83) % 150]) }); });   // a stand-in picture for two cards out of three
  await ctx.route('https://en.cf-vanguard.com/**', r => r.fulfill({ status: 404, body: '' })); await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  await pg.click('[data-edit="0"]'); await pg.waitForSelector('#builder:not([hidden])');
  const first = await pg.evaluate(() => ({ rows: document.querySelectorAll('#bdList .crow').length, thumbs: document.querySelectorAll('#bdList .crow .cth .card').length, deck: document.querySelectorAll('#bdMain .cth .card, #bdRide .cth .card').length }));
  await pg.waitForFunction(() => document.querySelectorAll('#bdList .cth .has-img').length >= 10, null, { timeout: 20000 }); await pg.waitForTimeout(600);
  const withImg = await pg.evaluate(() => ({ list: document.querySelectorAll('#bdList .cth .has-img').length, deck: document.querySelectorAll('#bdMain .cth .has-img, #bdRide .cth .has-img').length }));
  await pg.click('#bdList .crow .cthb'); await pg.waitForSelector('#cardwin .cw-face .card');   // the face opens the card window
  const big = await pg.evaluate(() => { const r = document.querySelector('#cardwin .cw-face').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  await pg.keyboard.press('Escape');
  if (tag === 'port') { await pg.click('#bdTabs [data-tab="deck"]'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'shots/builder-img-port-deck.png' }); await pg.click('#bdTabs [data-tab="cards"]'); }
  await pg.screenshot({ path: 'shots/builder-img-' + tag + '.png' });
  const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  out[tag] = { first, withImg, big, overflow, asked, errs };
  if (!(first.rows > 20 && first.thumbs === first.rows && first.deck > 10 && withImg.list >= 10 && withImg.deck >= 3 && big[0] >= 110 && !overflow && !errs.length)) ok = false;
  await ctx.close();
}
console.log(JSON.stringify(out)); console.log(ok ? 'builder pictures ok' : 'BUILDER PICTURES FAILED'); if (!ok) process.exitCode = 1;
await b.close();
