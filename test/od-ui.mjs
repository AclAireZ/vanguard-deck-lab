// overDress in the real page: call a card with overDress on top of the named rear-guard, answer the question, see the originalDress under the unit; screenshots go to shots/.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const lay = process.argv[2] === 'port' ? 'port' : 'land';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: lay === 'port' ? { width: 400, height: 820 } : { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.click('#goBtn'); await pg.waitForTimeout(600);
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
for (let n = 0; n < 300; n++) {
  await ready();
  const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 5 && (U.S.mode === 'solo' || d.player === U.S.seat)) return true; U.submit(window.VG.bot(g)); return false; });
  if (done) break;
}
const put = await pg.evaluate(() => {
  const VG = window.VG, U = window.VGUI, g = U.S.game, p = g.pending.player;
  const all = VG.DB.rows.filter(x => x.ast && x.ast.od);
  const r = all.find(x => !x.ast.od.x && x.ast.od.p[0].f.nm && VG.DB.byName[x.ast.od.p[0].f.nm] && x.grade <= g.grade(g.vg(p)));
  if (!r) return { n: all.length };
  const base = VG.DB.byName[r.ast.od.p[0].f.nm];
  const old = g.rcs(p).find(u => u.pos === 'FL'); if (old) g.move(old.iid, 'drop', { silent: true });
  const t = g.newCard(base.no, p, 'new'); g.move(t.iid, 'RC', { pos: 'FL', silent: true });
  const c = g.newCard(r.no, p, 'new'); g.move(c.iid, 'hand', { silent: true });
  g.pending.options = g.mainOptions(p); U.S.snap = g.snapshot();
  return { n: all.length, x: all.filter(z => z.ast.od.x).length, name: r.name, base: base.name, t: t.iid, c: c.iid, call: g.pending.options.findIndex(o => o.a === 'call' && o.iid === c.iid && o.circle === 'FL') };
});
if (put.call === undefined || put.call < 0) { console.log('no suitable card', JSON.stringify(put)); process.exit(1); }
await pg.evaluate(i => window.VGUI.submit([i]), put.call); await ready(); await pg.waitForTimeout(300);
const q = await pg.evaluate(() => { const d = window.VGUI.S.game.pending; return { kind: d.kind, title: d.title, btns: [...document.querySelectorAll('#prompt button')].map(x => x.textContent.trim()) }; });
await pg.screenshot({ path: 'shots/od-' + lay + '-1.png' });
await pg.click('#prompt button:has-text("overDress")'); await ready(); await pg.waitForTimeout(700);
const st = await pg.evaluate(({ t, c }) => {
  const U = window.VGUI, g = U.S.game; U.S.snap = g.snapshot();
  const et = document.querySelector('#cards .card[data-iid="' + t + '"]'), ec = document.querySelector('#cards .card[data-iid="' + c + '"]');
  const rt = et && et.getBoundingClientRect(), rc = ec && ec.getBoundingClientRect();
  return { zt: g.cards[t].zone, host: g.cards[t].host, zc: g.cards[c].zone, pos: g.cards[c].pos, dress: g.cards[c].dress, near: rt && rc ? Math.round(Math.hypot(rt.x - rc.x, rt.y - rc.y)) : -1, zi: et && ec ? [+et.style.zIndex, +ec.style.zIndex] : null, kind: g.pending.kind };
}, put);
await pg.evaluate(c => { const U = window.VGUI; const el = document.querySelector('#cards .card[data-iid="' + c + '"]'); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, put.c); await pg.waitForTimeout(250);
const detail = await pg.evaluate(() => document.querySelector('#detail').textContent.includes('originalDress'));
await pg.screenshot({ path: 'shots/od-' + lay + '-2.png' });
const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log(JSON.stringify({ lay, put, q, st, detail, overflow }));
const ok = q.kind === 'yesno' && q.btns.some(x => x.includes('overDress')) && st.zt === 'dress' && st.host === put.c && st.zc === 'RC' && st.pos === 'FL' && st.dress.length === 1 && st.near >= 0 && st.near < 60 && st.zi[0] < st.zi[1] && !overflow && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(ok ? 'overDress ok (' + lay + ')' : 'OVERDRESS UI FAILED'); if (!ok) process.exitCode = 1;
await b.close();
