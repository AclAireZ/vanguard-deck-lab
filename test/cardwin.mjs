import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
// The card window with a very long text (it must scroll inside the window, never run off the screen) and the ways to the soul: node test/cardwin.mjs
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8'); let ok = true;
const b = await chromium.launch();
for (const [w, h, tag] of [[1225, 882, 'user'], [1280, 620, 'short'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://vg.test/'); await pg.waitForTimeout(300); await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  for (let n = 0; n < 200; n++) {
    await pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
    const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 5) return true; U.submit(window.VG.bot(g)); return false; });
    if (done) break;
  }
  await pg.waitForTimeout(500);
  const out = { tag };
  await pg.evaluate(() => { const U = window.VGUI, g = U.S.game, p = g.pending.player; while (g.players[p].soul.length < 2) g.move(g.players[p].deck[0], 'soul', { silent: true }); U.S.snap = g.snapshot(); U.renderLobby; document.querySelector('#mSpeed').click(); document.querySelector('#mSpeed').click(); document.querySelector('#mSpeed').click(); });
  await pg.waitForTimeout(200);
  // a very long card text (as in the local copy, where the English wording is appended)
  out.long = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const v = g.vg(g.pending.player); U.openCard(v.no, v.iid); const t = document.querySelector('#cardwin .cw-text'); for (let k = 0; k < 14; k++) { const p = document.createElement('p'); p.textContent = 'บรรทัดทดสอบยาว ๆ '.repeat(12) + k; t.appendChild(p); } const w = document.querySelector('#cardwin .cw'); const R = w.getBoundingClientRect(), F = document.querySelector('#cardwin .cw-foot').getBoundingClientRect(); t.scrollTop = 99999; return { overflows: t.scrollHeight > t.clientHeight, scrolled: t.scrollTop > 0, cwBottom: Math.round(R.bottom), footBottom: Math.round(F.bottom), vh: innerHeight, cwScrollable: w.scrollHeight > w.clientHeight + 1 && getComputedStyle(w).overflowY !== 'hidden', soulBtn: !!document.querySelector('#cardwin [data-cwzone="soul"]') }; });
  await pg.screenshot({ path: 'shots/long-' + tag + '.png' });
  // wheel over the text scrolls it
  if (tag !== 'port') { await pg.evaluate(() => { document.querySelector('#cardwin .cw-text').scrollTop = 0; }); const bx = await (await pg.$('#cardwin .cw-text')).boundingBox(); await pg.mouse.move(bx.x + 50, bx.y + 50); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200); out.wheel = await pg.evaluate(() => document.querySelector('#cardwin .cw-text').scrollTop); }
  else { await pg.evaluate(() => { document.querySelector('#cardwin .cw').scrollTop = 99999; }); out.portScroll = await pg.evaluate(() => document.querySelector('#cardwin .cw').scrollTop); }
  // soul: from the card window, and from the button at the vanguard
  await pg.evaluate(() => { const b = document.querySelector('#cardwin [data-cwzone="soul"]'); b.scrollIntoView(); }); await pg.click('#cardwin [data-cwzone="soul"]'); await pg.waitForTimeout(300);
  out.fromWin = await pg.evaluate(() => document.querySelector('#cardwin').hidden && !document.querySelector('#picker').hidden ? document.querySelectorAll('#picker .mcard').length : -1);
  await pg.click('#picker .mcard'); await pg.waitForTimeout(300); out.readSoulCard = await pg.evaluate(() => !document.querySelector('#cardwin').hidden); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); await pg.click('#picker [data-close]'); await pg.waitForTimeout(150);
  const p = await pg.evaluate(() => window.VGUI.S.game.pending.player);
  await pg.screenshot({ path: 'shots/soulbtn-' + tag + '.png' });
  await pg.click('#soulb button[data-p="' + p + '"]', { timeout: 4000 }).catch(e => { out.btnErr = String(e).slice(0, 300); }); await pg.waitForTimeout(300);
  out.fromBoard = await pg.evaluate(() => !document.querySelector('#picker').hidden ? document.querySelectorAll('#picker .mcard').length : -1);
  out.overflow = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  out.errs = errs; console.log(JSON.stringify(out));
  const L = out.long; if (!((tag === 'port' || L.overflows) && L.cwBottom <= L.vh && (tag === 'port' ? out.portScroll > 0 : (L.scrolled && L.footBottom <= L.vh && out.wheel > 0)) && L.soulBtn && out.fromWin >= 2 && out.readSoulCard && out.fromBoard >= 2 && !out.overflow && !errs.length)) ok = false;
  await ctx.close();
}
await b.close(); console.log(ok ? 'card window ok' : 'CARD WINDOW FAILED'); if (!ok) process.exitCode = 1;
