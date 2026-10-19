// Screenshots of the windows: card window on the table (landscape + phone), card window in the deck editor, zone viewer, end screen: node test/shotwin.mjs [name] → shots/<name>-*.png
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'win'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const out = {};
for (const [w, h, tag] of [[1440, 860, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  await pg.click('#newDeckBtn'); await pg.waitForTimeout(300);
  await pg.click('#bdList .crow .cthb'); await pg.waitForTimeout(450); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-bcard.png' });
  await pg.click('#cardwin [data-cwact="add"]'); await pg.click('#cardwin [data-cwact="add"]'); await pg.waitForTimeout(100);
  out[tag + 'Added'] = await pg.evaluate(() => document.querySelector('#cardwin .cw-deck b').textContent);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  for (let k = 0; k < 6; k++) await pg.click('#bdList .crow:nth-child(' + (k + 3) + ') [data-add="main"]');
  if (tag === 'port') await pg.click('#bdTabs [data-tab="deck"]');
  await pg.waitForTimeout(200); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-builder.png', fullPage: tag === 'port' });
  await pg.click('#bdBack'); await pg.click('#bdBack'); await pg.waitForTimeout(300);
  await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  for (let n = 0; n < 200; n++) {
    await pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
    const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 4) return true; U.submit(window.VG.bot(g)); return false; });
    if (done) break;
  }
  await pg.waitForTimeout(500);
  // the vanguard has nothing to do in the main phase: a click opens the card window
  const vg = await pg.evaluate(() => { const g = window.VGUI.S.game; return g.vg(g.pending.player).iid; });
  await pg.click('#cards .card[data-iid="' + vg + '"]', { force: true }); await pg.waitForTimeout(450);
  out[tag + 'Win'] = await pg.evaluate(() => !document.querySelector('#cardwin').hidden && !!document.querySelector('#cardwin .cw-text'));
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-card.png' });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  out[tag + 'Closed'] = await pg.evaluate(() => document.querySelector('#cardwin').hidden);
  // a hand card that can be called: click selects it; right-click reads it
  const hc = await pg.evaluate(() => { const g = window.VGUI.S.game; const o = g.pending.options.find(x => x.a === 'call'); return o ? o.iid : null; });
  if (hc) { await pg.click('#cards .card[data-iid="' + hc + '"]', { force: true }); await pg.waitForTimeout(150);
    out[tag + 'Sel'] = await pg.evaluate(i => window.VGUI.S.src === i && document.querySelector('#cardwin').hidden && !document.querySelector('#peek').hidden, hc);
    await pg.click('#cards .card[data-iid="' + hc + '"]', { button: 'right', force: true }); await pg.waitForTimeout(300);
    out[tag + 'Right'] = await pg.evaluate(() => !document.querySelector('#cardwin').hidden); await pg.keyboard.press('Escape'); }
  // end screen
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-sel.png' });
  for (let n = 0; n < 900; n++) {
    const st = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; if (g.over) return 'over'; if (!g.pending || U.S.busy || U.S.running) return 'wait'; U.submit(window.VG.bot(g)); return 'go'; });
    if (st === 'over') break; if (st === 'wait') await pg.waitForTimeout(60);
  }
  await pg.waitForTimeout(1200); out[tag + 'End'] = await pg.evaluate(() => !document.querySelector('#endov').hidden && !!document.querySelector('#endov .end-big')); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-end.png' });
  out[tag + 'Overflow'] = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  out[tag + 'Errs'] = errs;
  await ctx.close();
}
await b.close(); console.log(JSON.stringify(out));
