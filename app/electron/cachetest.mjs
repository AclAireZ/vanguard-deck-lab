// The picture cache of the game app: a stand-in picture site counts requests; the second start of the app must show the pictures with the site switched off.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url'; import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const big = Buffer.concat([PNG, Buffer.alloc(400)]);   // over the 200-byte "not a page" check
let hits = 0; const srv = http.createServer((q, r) => { hits++; if (/missing/.test(q.url)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'image/png' }); r.end(big); });
await new Promise(r => srv.listen(9130, '127.0.0.1', r));
const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'vgud-')); const env = Object.assign({}, process.env, { http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', no_proxy: '*', NO_PROXY: '*', VG_USERDATA: ud, VG_CACHE_HOSTS: 'http://127.0.0.1:9130/img/', VG_NO_UPDATE: '1' });
async function run(label) {
  const app = await electron.launch({ args: ['.'], cwd: path.dirname(fileURLToPath(import.meta.url)), env });
  const win = await app.firstWindow(); await win.waitForSelector('#lobby');
  await win.evaluate(() => { localStorage.setItem('vg.sb', JSON.stringify({ off: true })); localStorage.setItem('vg.imgJp', 'false'); localStorage.setItem('vg.imgBase', JSON.stringify('http://127.0.0.1:9130/img/')); localStorage.removeItem('vg.imgMap'); });
  await win.reload(); await win.waitForSelector('#lobby'); await win.waitForTimeout(4000);
  const r = await win.evaluate(async () => { const imgs = [...document.querySelectorAll('img.cf-img')]; const ok = imgs.filter(i => i.complete && i.naturalWidth > 0).length; let st = null; try { st = await (await fetch('vgcache://img/stat')).json(); } catch (e) { st = String(e); } return { imgs: imgs.length, ok, src: imgs[0] && imgs[0].src.slice(0, 60), st }; });
  console.log(label, JSON.stringify(r), 'site hits so far', hits); await app.close(); return r;
}
const a = await run('first start ');
const h1 = hits; srv.close();
const b = await run('second start (site off)');
const ok = a.ok > 0 && a.st && a.st.n > 0 && b.ok >= a.ok && hits === h1;
console.log(ok ? 'picture cache ok' : 'PICTURE CACHE FAILED'); if (!ok) process.exitCode = 1;
fs.rmSync(ud, { recursive: true, force: true });
