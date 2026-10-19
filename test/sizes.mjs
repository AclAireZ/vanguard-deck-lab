// Screens at several window sizes: lobby, my decks, deck builder, field → shots/size-<w>x<h>-<screen>.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const sizes = (process.argv[2] || '1024x640,1366x768,1920x1080,2560x1440,800x1000').split(',').map(s => s.split('x').map(Number));
const b = await chromium.launch(); const report = [];
for (const [w, h] of sizes) {
  const pg = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.route('**/*', r => r.request().url().startsWith('http://vg.test/') ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
  await pg.goto('http://vg.test/'); await pg.waitForTimeout(1600);
  const over = async () => pg.evaluate(() => ({ sx: document.documentElement.scrollWidth > innerWidth + 1, sy: document.documentElement.scrollHeight > innerHeight + 1 }));
  const shot = async n => { await pg.screenshot({ path: 'shots/size-' + w + 'x' + h + '-' + n + '.png' }); report.push(w + 'x' + h + ' ' + n + ' ' + JSON.stringify(await over())); };
  await shot('lobby');
  await pg.click('#newDeckBtn'); await pg.waitForTimeout(300); await pg.click('#dkBuilt button'); await pg.waitForTimeout(300); await shot('decks');
  await pg.click('#dkNew'); await pg.waitForTimeout(500); await shot('builder');
  await pg.click('#bdBack'); await pg.click('#dkBack'); await pg.waitForTimeout(300);
  await pg.click('#goBtn'); await pg.waitForTimeout(600); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  for (let n = 0; n < 300; n++) { const st = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running ? g.pending.kind + ':' + g.turnNo : ''; }); if (st.startsWith('main:') && +st.split(':')[1] >= 4) break; if (st) await pg.evaluate(() => { const U = window.VGUI; U.submit(window.VG.bot(U.S.game)); }); await pg.waitForTimeout(40); }
  await pg.waitForTimeout(800); await shot('field');
  if (errs.length) report.push('ERR ' + errs[0]); await pg.close();
}
console.log(report.join('\n')); await b.close();
