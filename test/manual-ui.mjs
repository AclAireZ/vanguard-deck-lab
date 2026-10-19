// The "do it by hand" panel in the real page: open it from the prompt, draw, move a card, look at the deck, change power; screenshots go to shots/.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const lay = process.argv[2] === 'port' ? 'port' : 'land';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: lay === 'port' ? { width: 400, height: 820 } : { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.click('#goBtn'); await pg.waitForTimeout(600);
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
// play with the bot's answers until a main phase on turn 3 or later
for (let n = 0; n < 300; n++) {
  await ready();
  const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 3) return true; U.submit(window.VG.bot(g)); return false; });
  if (done) break;
}
const state = () => pg.evaluate(() => { const g = window.VGUI.S.game, p = g.pending.player, P = g.players[p]; return { p, hand: P.hand.length, soul: P.soul.length, deck: P.deck.length, kind: g.pending.kind, vg: g.stat(g.vg(p)).power, panel: !!document.querySelector('#picker .mbox.man') && !document.querySelector('#picker').hidden }; });
const panel = () => pg.waitForFunction(() => { const U = window.VGUI; return !U.S.busy && !U.S.running && document.querySelector('#picker .mbox.man') && !document.querySelector('#picker').hidden; }, null, { timeout: 20000 });
const s0 = await state();
await pg.click('#prompt [data-do="manual"]'); await panel();
await pg.screenshot({ path: 'shots/manual-' + lay + '-1.png' });
await pg.click('#picker [data-man="1,1"]'); await panel(); const s1 = await state();                         // draw 1
await pg.click('#picker .mgrid .mcard'); await pg.waitForSelector('#picker .manact .manrow');                  // choose the first hand card
const firstHand = await pg.evaluate(() => +document.querySelector('#picker .mcard.on').dataset.ms);
await pg.click('#picker .manact button:has-text("เข้าโซล")'); await panel(); const s2 = await state();
const inSoul = await pg.evaluate(i => window.VGUI.S.game.cards[i].zone, firstHand);
await pg.click('#picker [data-mt="deck"]'); await pg.click('#picker [data-look="3"]'); await panel();
const looked = await pg.evaluate(() => document.querySelectorAll('#picker .mgrid .mcard').length);
await pg.click('#picker .mgrid .mcard'); await pg.click('#picker .manact button:has-text("ขึ้นมือ")'); await panel();
const lookedAfter = await pg.evaluate(() => document.querySelectorAll('#picker .mgrid .mcard').length); const s3 = await state();
await pg.click('#picker [data-mt="field"]'); await pg.click('#picker .mgrid .mcard'); await pg.click('#picker [data-until="1"]');
await pg.screenshot({ path: 'shots/manual-' + lay + '-2.png' });
await pg.click('#picker .manact button:has-text("พลัง +10000")'); await panel(); const s4 = await state();
await pg.click('#picker [data-close]'); await pg.waitForTimeout(200);
const closed = await pg.evaluate(() => document.querySelector('#picker').hidden && !window.VGUI.S.man);
const log = await pg.evaluate(() => [...document.querySelectorAll('#log div')].map(x => x.textContent).filter(t => t.includes('[ทำเอง]')).length);
const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
// the game goes on normally afterwards
await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; U.submit([g.pending.options.findIndex(o => o.a === 'next')]); }); await ready();
const after = await pg.evaluate(() => window.VGUI.S.game.pending.kind);
console.log(JSON.stringify({ lay, s0, s1, s2, inSoul, looked, lookedAfter, s3, s4, closed, log, overflow, after }));
const ok = !s0.panel && s1.panel && s1.hand === s0.hand + 1 && s2.hand === s1.hand - 1 && s2.soul === s1.soul + 1 && inSoul === 'soul' && looked === 3 && lookedAfter === 2 && s3.hand === s2.hand + 1 && s4.vg === s3.vg + 10000 && closed && log >= 5 && !overflow && !errs.length && s4.kind === 'main';
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(ok ? 'manual panel ok (' + lay + ')' : 'MANUAL PANEL FAILED'); if (!ok) process.exitCode = 1;
await b.close();
