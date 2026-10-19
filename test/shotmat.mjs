// Screenshot of the board early in a fight (few cards on it), landscape and phone: node test/shotmat.mjs [name] → shots/<name>-land.png, -port.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'board'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const [w, h, tag] of [[1440, 860, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  for (let n = 0; n < 200; n++) {
    await pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
    const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 4) return true; U.submit(window.VG.bot(g)); return false; });
    if (done) break;
  }
  await pg.waitForTimeout(700); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '.png' });
  await ctx.close();
}
await b.close(); console.log('ok');
