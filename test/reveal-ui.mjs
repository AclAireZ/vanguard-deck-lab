// The strip that shows cards revealed or looked at by a skill: play bot games until one appears, screenshot it → shots/reveal-*.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); await pg.goto('http://vg.test/'); await pg.waitForTimeout(400);
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 2; });
const seen = { reveal: 0, look: 0 }; let shots = 0;
for (let n = 0; n < 900 && shots < 2; n++) {
  const st = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const bar = document.querySelector('#revealBar'); return { over: g && g.over, vis: bar && !bar.hidden ? bar.querySelector('.rv-h b').textContent + ' ' + bar.querySelectorAll('.rv-c').length : '', ready: g && g.pending && !U.S.busy && !U.S.running }; });
  if (st.over) break;
  if (st.vis && !seen[st.vis]) { seen[st.vis] = 1; await pg.evaluate(() => clearTimeout(window.VGUI.S.revT)); await pg.screenshot({ path: 'shots/reveal-' + shots + '.png' }); console.log('strip:', st.vis); shots++; }
  if (st.ready) await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; U.submit(window.VG.bot(g)); });
  await pg.waitForTimeout(60);
}
console.log(JSON.stringify({ shots, errs })); await b.close();
