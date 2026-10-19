// The copy that runs from disk: database rooms are replaced by the direct link (test/p2p.mjs); a card's picture comes from the official card lists (Japanese, then English), then from the spare "cards" folder, else the drawn face.
// The official site cannot be reached from the test machine, so both sources are answered by the test itself; what is checked is the order and the fallbacks.
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
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const asked = { folder: [], web: [], jp: [], referer: 0 };
// the Japanese pool: every card carries the exact picture file of the Japanese list
const DBJ = JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')), JPJ = JSON.parse(fs.readFileSync(new URL('../src/jp.json', import.meta.url), 'utf8'));
const jimgs = new Set(JPJ.link.filter(Boolean).map(l => l[2]).concat(JPJ.extra.map(x => x[9])));
const eastImg = JPJ.link[DBJ.rows.findIndex(r => r[1] === 'DynamicExciter, Eastiera')][2];
await ctx.route('http://vg.test/**', r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/' || u.pathname.endsWith('.html')) return r.fulfill({ contentType: 'text/html', body: html });
  if (u.pathname.startsWith('/cards/')) { const f = decodeURIComponent(u.pathname.slice(7)); asked.folder.push(f); if (f === 'dzbt07_016.png' || f === 'Energy Generator.jpg' || f === 'dzbt07_147.png' || f === 'back.png') return r.fulfill({ contentType: 'image/png', body: png(30, 42, [200, 40, 90]) }); return r.fulfill({ status: 404, body: '' }); }
  return r.fulfill({ status: 404, body: '' });
});
await ctx.route('https://en.cf-vanguard.com/**', r => {
  const u = new URL(r.request().url()); asked.web.push(u.pathname); if (r.request().headers().referer) asked.referer++;
  if (/dzbt07_145\.png$/.test(u.pathname)) return r.fulfill({ contentType: 'image/png', body: png(30, 42, [40, 90, 200]) });   // only this one "exists" on the site
  return r.fulfill({ status: 404, body: '' });
});
await ctx.route('https://cf-vanguard.com/**', r => {
  const u = new URL(r.request().url()); asked.jp.push(u.pathname); if (r.request().headers().referer) asked.referer++;
  if (u.pathname.endsWith('/' + eastImg + '.png')) return r.fulfill({ contentType: 'image/png', body: png(30, 42, [40, 200, 90]) });   // only this one "exists" on the Japanese list
  return r.fulfill({ status: 404, body: '' });
});
// the wiki (card wording shown live): answers every asked title with a small page
asked.wiki = [];
await ctx.route('https://cardfight.fandom.com/**', r => {
  const u = new URL(r.request().url()); const titles = (u.searchParams.get('titles') || '').split('|'); asked.wiki.push(...titles);
  const pages = {}; titles.forEach((t, i) => { pages[i + 1] = { title: t, revisions: [{ slots: { main: { '*': '{{DTable\n|name = x\n|effect = [AUTO]:{{Cost|Counter Blast (1)}}, [[call|call]] it. {{Once}}<br>Second line of ' + t.length + '\n|flavor = f\n}}' } } }] }; });
  return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ query: { pages } }) });
});
await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.addInitScript(() => { try { if (!localStorage.getItem('vg.sb')) localStorage.setItem('vg.sb', JSON.stringify({ off: true })); } catch (e) {} }); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
const lobby = await pg.evaluate(() => ({ online: !document.querySelector('#modeSeg [data-mode="online"]').hidden && document.querySelector('#roomPanel').hidden && !document.querySelector('#p2pPanel').hidden, box: !document.querySelector('#autoBox').hidden, base: document.querySelector('#imgBase').value, web: document.querySelector('#imgWeb').checked }));
await pg.click('[data-view="0"]');                                   // deck viewer of the first deck: asks for every card's picture
await pg.waitForFunction(() => /หาไม่พบ \d+ ใบ/.test(document.querySelector('#autoStat').textContent) && !/หาไม่พบ 0 ใบ/.test(document.querySelector('#autoStat').textContent), null, { timeout: 15000 }); await pg.waitForTimeout(800);
await pg.waitForFunction(() => document.querySelectorAll('#picker .wtext[data-done]').length > 3, null, { timeout: 8000 });
const wtxt = await pg.evaluate(() => { const el = [...document.querySelectorAll('#picker .wtext[data-done]')].find(e => e.children.length); return el ? [...el.querySelectorAll('p')].map(p => p.textContent) : null; });
const got = await pg.evaluate(() => { const U = window.VGUI, V = window.VG; const f = n => U.imgFor(V.card(V.DB.byName[n].no)); return { folderByFile: f('PolyPhonicOverDrive, Artisaria'), folderByName: f('Energy Generator'), web: f('WitchingVibrato, Lifel'), jp: f('DynamicExciter, Eastiera'), none: f('HeapUpOctaver, Proutta'), stat: document.querySelector('#autoStat').textContent }; });
// the card back picture from the folder is in use; found addresses are remembered: after a reload the first question already has the answer
const back = await pg.evaluate(() => ({ cls: document.body.classList.contains('has-back'), v: getComputedStyle(document.documentElement).getPropertyValue('--cbimg') }));
await pg.waitForTimeout(1800); await pg.reload(); await pg.waitForTimeout(300);
const again = await pg.evaluate(() => { const U = window.VGUI, V = window.VG; return U.imgFor(V.card(V.DB.byName['WitchingVibrato, Lifel'].no)); });
await pg.click('[data-view="0"]'); await pg.waitForTimeout(600);
await pg.click('#picker [data-close]'); await pg.click('#goBtn'); await pg.waitForTimeout(1500);
const onTable = await pg.evaluate(() => document.querySelectorAll('#cards .cf.has-img').length);
await pg.click('#mExit');
// switching the web source off: nothing more is asked from the site
const before = asked.web.length; const folderEarly = asked.folder.slice(); await pg.click('#navOpt'); await pg.uncheck('#imgWeb'); await pg.click('#drawer .lb-ico[data-dclose]'); await pg.click('[data-view="0"]'); await pg.waitForTimeout(1500);
const off = await pg.evaluate(() => { const U = window.VGUI, V = window.VG; return { web: U.imgFor(V.card(V.DB.byName['WitchingVibrato, Lifel'].no)), folder: U.imgFor(V.card(V.DB.byName['PolyPhonicOverDrive, Artisaria'].no)) }; });
const askedAfter = asked.web.length - before;
const jpOdd = asked.jp.filter(p => { const m = /^\/wordpress\/wp-content\/images\/cardlist\/(.+)\.png$/.exec(p); return !m || !jimgs.has(m[1]); });   // only pictures the Japanese list really has are asked for
console.log(JSON.stringify({ wtxt, wikiAsked: asked.wiki.length, back, again, lobby, got, onTable, off, askedAfter, webAsked: before, jpAsked: asked.jp.length, jpOdd, sample: asked.jp.slice(0, 2), referer: asked.referer }));
const ok = lobby.online && lobby.box && lobby.web && /^https:\/\/en\.cf-vanguard\.com\//.test(lobby.base)
  && got.folderByFile === 'cards/dzbt07_016.png' && /^cards\/Energy%20Generator\.jpg$/.test(got.folderByName) && /^https:\/\/en\.cf-vanguard\.com\/.*dzbt07\/dzbt07_145\.png$/.test(got.web) && got.jp === 'https://cf-vanguard.com/wordpress/wp-content/images/cardlist/' + eastImg + '.png' && got.none === null && asked.jp.length > 5 && !jpOdd.length && wtxt && wtxt[0] === '[AUTO]:[COST][Counter Blast (1)], call it. [1/Turn]' && /^Second line of \d+$/.test(wtxt[1]) && asked.wiki.length > 5
  && !folderEarly.includes('dzbt07_147.png') && !folderEarly.includes('dzbt07_145.png') /* found on a site: the folder is not even looked at */ && back.cls && /cards\/back\.png/.test(back.v) && /dzbt07_145\.png$/.test(again || '') && onTable >= 1 && off.web === null && off.folder === 'cards/dzbt07_016.png' && askedAfter === 0 && asked.referer === 0 && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(ok ? 'local copy ok' : 'LOCAL COPY FAILED'); if (!ok) process.exitCode = 1;
await b.close();
