// Screenshots of the skill question panel and of frames during an attack: node test/shotfx.mjs [name] → shots/<name>-ask.png, -atk0..5.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'fx'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && (g.over || (g.pending && !U.S.busy && !U.S.running)); }, null, { timeout: 30000 });
let ask = false, atk = false;
for (let n = 0; n < 500 && !(ask && atk); n++) {
  await ready();
  const st = await pg.evaluate(() => { const g = window.VGUI.S.game; if (g.over) return { over: true }; const d = g.pending; return { kind: d.kind, turn: g.turnNo, hasAtk: d.kind === 'attack' && d.options.some(o => o.a === 'attack') }; });
  if (st.over) break;
  if (!ask && st.kind === 'yesno' && st.turn >= 3) { await pg.waitForTimeout(500); await pg.screenshot({ path: 'shots/' + name + '-ask.png' }); ask = true; }
  if (!atk && st.hasAtk && st.turn >= 5) {
    await pg.evaluate(() => { const U = window.VGUI; U.S.speed = 1; const g = U.S.game; const d = g.pending; const v = g.vg(1 - d.player).iid; let i = d.options.findIndex(o => o.a === 'attack' && o.target === v); if (i < 0) i = d.options.findIndex(o => o.a === 'attack'); U.submit([i]); });
    for (let k = 0; k < 14; k++) { await pg.waitForTimeout(260); await pg.screenshot({ path: 'shots/' + name + '-atk' + k + '.png' }); const pend = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; return g.pending && !U.S.busy && !U.S.running ? g.pending.kind : null; }); if (pend) await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; U.submit(d.kind === 'guard' ? [] : window.VG.bot(g)); }); }
    await pg.evaluate(() => { window.VGUI.S.speed = 6; }); atk = true; continue;
  }
  await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; U.submit(window.VG.bot(g)); });
}
console.log(JSON.stringify({ ask, atk, errs }));
await b.close();
