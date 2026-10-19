// Own card pictures: files named after the card number or the card name are matched, shown on the cards, kept across reloads, and can be cleared.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import zlib from 'node:zlib';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
function png(w, h, rgb) { // a plain colour PNG made by hand
  const crc = buf => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(rgb)))]); const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.setInputFiles('#imgIn', [
  { name: 'dzbt07_016.png', mimeType: 'image/png', buffer: png(600, 840, [200, 40, 90]) },     // by official file name (large: gets scaled down)
  { name: 'Energy Generator.png', mimeType: 'image/png', buffer: png(50, 70, [40, 200, 90]) }, // by card name
  { name: 'holiday.png', mimeType: 'image/png', buffer: png(10, 10, [1, 2, 3]) },               // matches nothing
  { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
]);
await pg.waitForFunction(() => /มีรูป 3 ไฟล์/.test(document.querySelector('#imgStat').textContent), null, { timeout: 8000 });
const st1 = await pg.textContent('#imgStat');
const m1 = await pg.evaluate(() => ({ a: !!window.VGUI.imgFor(window.VG.card('DZ-BT07/016EN')), b: !!window.VGUI.imgFor(window.VG.card(window.VG.DB.byName['Energy Generator'].no)), c: !!window.VGUI.imgFor(window.VG.card('DZ-BT07/018EN')) }));
await pg.click('[data-view="0"]'); await pg.click('[data-dv="img"]');
const tab = await pg.textContent('#picker [data-dv="img"]'); const faces = await pg.evaluate(() => document.querySelectorAll('#picker .ilist .cf.has-img').length);
await pg.reload(); await pg.waitForFunction(() => /มีรูป 3 ไฟล์/.test(document.querySelector('#imgStat').textContent), null, { timeout: 8000 });
await pg.click('#goBtn'); await pg.waitForTimeout(1200);
const onTable = await pg.evaluate(() => document.querySelectorAll('#cards .cf.has-img').length);
await pg.click('#mExit'); await pg.click('#navOpt'); await pg.click('#imgClear'); await pg.waitForFunction(() => /ยังไม่มีรูป/.test(document.querySelector('#imgStat').textContent));
console.log(JSON.stringify({ st1, m1, tab, faces, onTable }));
const ok = m1.a && m1.b && !m1.c && /2/.test(st1) && /2\/19/.test(tab) && faces === 2 && onTable >= 1 && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(ok ? 'images ok' : 'IMAGES FAILED'); if (!ok) process.exitCode = 1;
await b.close();
