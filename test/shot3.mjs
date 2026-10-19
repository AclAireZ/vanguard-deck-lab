// Lobby / deck viewer / builder screenshots: node test/shot3.mjs [name]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'ui'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const [w, h, tag] of [[1440, 860, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  if (tag === 'port') await pg.screenshot({ path: 'shots/' + name + '-port-lobby.png' });
  await pg.click('[data-view="0"]'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-viewer.png' });
  await pg.click('[data-dv="img"]'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-viewer-img.png' });
  await pg.click('#picker [data-close]'); await pg.click('#newDeckBtn'); await pg.waitForTimeout(400); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-builder.png' });
  const ov = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(tag, 'horizontal overflow', ov, errs.length ? errs : '');
  await ctx.close();
}
await b.close();
