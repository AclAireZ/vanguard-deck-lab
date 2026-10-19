// Frames of a battle as the defender sees it (bot attacks): node test/shot2.mjs [name]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'ui'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const [w, h, tag] of [[1440, 860, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); await pg.goto('http://vg.test/'); await pg.click('#modeSeg [data-mode="bot"]'); await pg.evaluate(() => { window.VGUI.S.speed = 6; }); await pg.click('#goBtn');
  await pg.evaluate(async () => { const U = window.VGUI; const S = U.S; for (let i = 0; i < 400; i++) { for (let k = 0; k < 1200 && (S.running || S.busy); k++) await new Promise(r => setTimeout(r, 25)); const g = S.game; if (!g || g.over) break; const d = g.pending; if (!d) break; if (d.player !== S.seat) { await new Promise(r => setTimeout(r, 40)); continue; } if (d.kind === 'guard' && g.turnNo >= 6 && g.cards[g.battle.attacker].zone === 'VC') break; U.submit(window.VG.bot(g)); } });
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-guard.png' });
  await ctx.close();
}
await b.close(); console.log('ok');
