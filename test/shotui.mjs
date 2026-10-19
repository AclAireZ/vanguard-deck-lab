// Screenshots for UI work: lobby, deck builder, the field during a main phase (actionable cards): node test/shotui.mjs [name] → shots/<name>-*.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'ui'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); await pg.goto('http://vg.test/'); await pg.waitForTimeout(1500);
await pg.screenshot({ path: 'shots/' + name + '-lobby.png' });
if (await pg.$('#myDecksBtn')) { await pg.click('#myDecksBtn'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'shots/' + name + '-decks.png' }); const back = await pg.$('#dkBack'); if (back) await back.click(); await pg.waitForTimeout(300); }
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && (g.over || (g.pending && !U.S.busy && !U.S.running)); }, null, { timeout: 30000 });
let shot = 0;
for (let n = 0; n < 400 && shot < 2; n++) {
  await ready();
  const st = await pg.evaluate(() => { const g = window.VGUI.S.game; if (g.over) return { over: true }; const d = g.pending; return { kind: d.kind, turn: g.turnNo, p: d.player }; });
  if (st.over) break;
  if (st.kind === 'main' && st.turn >= 3 + shot * 2) { await pg.waitForTimeout(700); await pg.screenshot({ path: 'shots/' + name + '-field' + shot + '.png' }); shot++; }
  await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; U.submit(window.VG.bot(g)); });
}
console.log(JSON.stringify({ shot, errs }));
await b.close();
