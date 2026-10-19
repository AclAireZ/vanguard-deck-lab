// How far each card sits from the middle of the circle / plate it belongs to, in screen pixels (dx, dy). node test/align.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); let worst = 0;
for (const [w, h, tag] of [[1440, 860, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  for (let n = 0; n < 300; n++) {
    await pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
    const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 7) return true; U.submit(window.VG.bot(g)); return false; });
    if (done) break;
  }
  await pg.waitForTimeout(1200);
  const rows = await pg.evaluate(() => {
    const U = window.VGUI, g = U.S.game, S = U.S; const out = []; const mid = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; };
    for (const p of [0, 1]) {
      const P = g.players[p]; const who = p === S.viewer ? 'me' : 'opp';
      for (const k in P.circles) { const iid = P.circles[k]; if (!iid) continue; const z = document.querySelector('.zone.circle[data-p="' + p + '"][data-k="' + k + '"]'); const c = S.els[iid]; if (!z || !c) continue; const a = mid(z), m = mid(c.firstChild); out.push([who + ' ' + k, Math.round(m[0] - a[0]), Math.round(m[1] - a[1]), Math.round(a[2]), Math.round(m[2])]); }
      for (const zn of ['deck', 'drop', 'ride']) { const list = P[zn]; if (!list.length) continue; const iid = zn === 'deck' ? list[0] : list[list.length - 1]; const z = document.querySelector('#zn-' + p + '-' + zn); const c = S.els[iid]; if (!z || !c) continue; const a = mid(z), m = mid(c.firstChild); out.push([who + ' ' + zn, Math.round(m[0] - a[0]), Math.round(m[1] - a[1]), Math.round(a[2]), Math.round(m[2])]); }
      { const z = document.querySelector('.zone.pile.dmg[data-p="' + p + '"]'); const cs = P.damage.map(i => S.els[i]).filter(Boolean); if (z && cs.length) { const a = z.getBoundingClientRect(); const xs = cs.map(c => mid(c.firstChild)); const cx = xs.reduce((s, m) => s + m[0], 0) / xs.length; out.push([who + ' damage(x only)', Math.round(cx - (a.left + a.width / 2)), 0, Math.round(a.width), Math.round(xs[0][2])]); } }
    }
    return out;
  });
  console.log(tag); for (const r of rows) { console.log('  ' + r[0].padEnd(20) + ' dx ' + String(r[1]).padStart(4) + '  dy ' + String(r[2]).padStart(4) + '   zone w ' + r[3] + ' card w ' + r[4]); worst = Math.max(worst, Math.abs(r[1]), Math.abs(r[2])); }
  await ctx.close();
}
await b.close(); console.log('worst offset', worst, 'px'); console.log(worst <= 10 ? 'alignment ok' : 'ALIGNMENT FAILED'); if (worst > 10) process.exitCode = 1;
