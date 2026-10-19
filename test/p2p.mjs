// Two local copies link up directly (WebRTC data channel, connection texts carried by hand) and play a whole game; manual actions included.
// Both pages run on this machine, so this checks the exchange of codes, the replicated room store and the game staying in step — not a link across the internet.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
const errs = [];
async function open(tag) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });   // separate contexts: nothing is shared between the two players but the codes
  await ctx.route('http://vg.test/**', r => (new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.fulfill({ status: 404, body: '' })));
  await ctx.route('https://**', r => r.fulfill({ status: 404, body: '' }));
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(tag + ': ' + e)); await pg.addInitScript(() => { try { if (!localStorage.getItem('vg.sb')) localStorage.setItem('vg.sb', JSON.stringify({ off: true })); } catch (e) {} }); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
  await pg.click('#modeSeg [data-mode="online"]'); await pg.evaluate(() => { document.querySelector('.qlman').open = true; }); await pg.evaluate(() => { window.VGUI.S.speed = 6; }); return pg;
}
const A = await open('host'); const B = await open('guest');
const panel = await A.evaluate(() => ({ p2p: !document.querySelector('#p2pPanel').hidden, room: document.querySelector('#roomPanel').hidden }));
await B.selectOption('#deckSel0', 'TD01'); await B.click('#p2pRole [data-role="guest"]');
await A.click('#p2pMake'); await A.waitForFunction(() => document.querySelector('#p2pOffer').value.startsWith('VG'), null, { timeout: 15000 });
const offer = await A.inputValue('#p2pOffer');
// wrong text is refused with a message, not an error
await B.fill('#p2pOfferIn', 'hello'); await B.click('#p2pReply'); await B.waitForFunction(() => /รหัสไม่ถูกต้อง/.test(document.querySelector('#onStatus').textContent));
await B.fill('#p2pOfferIn', offer.slice(0, 40) + '\n' + offer.slice(40)); await B.click('#p2pReply');       // a chat app may break the line
await B.waitForFunction(() => document.querySelector('#p2pAns').value.startsWith('VG'), null, { timeout: 15000 });
const answer = await B.inputValue('#p2pAns');
await A.fill('#p2pAnsIn', answer); await A.click('#p2pConnect');
await A.waitForSelector('#table:not([hidden])', { timeout: 20000 }); await B.waitForSelector('#table:not([hidden])', { timeout: 20000 });
const drive = pg => pg.evaluate(async () => {
  const U = window.VGUI; const S = U.S; const t0 = Date.now(); let man = 0; const M = window.VG.MAN;
  const sig = g => g.players.map(P => [P.hand.length, P.deck.length, P.soul.length, P.drop.length, P.damage.length].join('.')).join('|');
  while (Date.now() - t0 < 150000) {
    const g = S.game; if (!g) break; if (g.over) return { over: g.over, turn: g.turnNo, seat: S.seat, n: g.history.length, man, sig: sig(g), decks: g.players.map(P => P.name) };
    const d = g.pending;
    if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) {
      if (d.man && d.kind === 'main' && man < 2 && g.turnNo >= 2) { const a = [-1, M.op.draw, 1]; if (!g.validate(a)) { man++; U.submit(a); await new Promise(r => setTimeout(r, 30)); continue; } }
      U.submit(window.VG.bot(g));
    }
    await new Promise(r => setTimeout(r, 30));
  }
  return { timeout: true, turn: S.game && S.game.turnNo, pending: S.game && S.game.pending && S.game.pending.kind, seat: S.seat, status: document.querySelector('#onStatus').textContent };
});
const [ra, rb] = await Promise.all([drive(A), drive(B)]);
console.log('codes', offer.length, answer.length, 'chars', JSON.stringify(panel)); console.log('host', JSON.stringify(ra)); console.log('guest', JSON.stringify(rb));
const ok = panel.p2p && panel.room && ra.over && rb.over && ra.over.winner === rb.over.winner && ra.n === rb.n && ra.seat === 0 && rb.seat === 1 && ra.sig === rb.sig && ra.man > 0 && rb.man > 0 && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 5));
console.log(ok ? 'direct link ok: both copies finished the same game' : 'DIRECT LINK FAILED'); if (!ok) process.exitCode = 1;
await b.close();
