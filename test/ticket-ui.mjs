// The Persona Shield ticket in the real page: Nasruddin is called → the ticket comes to hand and can be read; in the opponent's attack it is offered in the guard step,
// playing it asks for Nasruddin's skill and the unit goes to (GC). Screenshots go to shots/.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.selectOption('#deckSel0', 'VARGA'); await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
const idle = async () => { for (let n = 0; n < 400; n++) { if (await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; return !!(g && (g.over || (g.pending && !U.S.busy && !U.S.running))); })) return; await pg.waitForTimeout(30); } };
/* answer with `fn(game, decision)` (page side) until it returns null */
const drive = async (fn, max = 600) => { for (let n = 0; n < max; n++) { await idle(); const r = await pg.evaluate(f => { const U = window.VGUI, g = U.S.game; if (g.over) return 'over'; const a = (new Function('g', 'd', 'VG', 'return (' + f + ')(g, d, VG)'))(g, g.pending, window.VG); if (a == null) return 'stop'; U.submit(a); return 'go'; }, fn.toString()); if (r !== 'go') return r; } return 'max'; };
// to player 0's main phase with a grade 3 vanguard (bot plays both seats until then)
await drive((g, d, VG) => (g.active === 0 && d.kind === 'main' && g.grade(g.vg(0)) >= 3 && g.grade(g.vg(1)) >= 2 ? null : VG.bot(g)));
const setup = await pg.evaluate(() => {
  const U = window.VGUI, g = U.S.game, VG = window.VG; const no = VG.DB.byName['Dragritter, Nasruddin'].no;
  const k = ['BL', 'BR', 'BC', 'FL', 'FR'].find(c => !g.rcs(0).some(u => u.pos === c)) || 'BL';
  for (const u of g.rcs(0)) if (u.pos === k) g.move(u.iid, 'drop', { silent: true });
  while (g.players[0].soul.length < 2) g.move(g.players[0].deck[0], 'soul', { silent: true });
  const c = g.newCard(no, 0, 'hand'); g.pending.options = g.mainOptions(0); const i = g.pending.options.findIndex(o => o.a === 'call' && o.iid === c.iid && o.circle === k);
  U.submit([i]); return { persona: !!g.def(g.vg(0)).persona, i, k };
});
await drive((g, d) => (d.kind === 'main' ? null : d.kind === 'yesno' ? [0] : d.options && d.options.length ? [0] : []));
await pg.waitForTimeout(400);
const got = await pg.evaluate(() => { const g = window.VGUI.S.game; const t = g.players[0].hand.map(i => g.cards[i]).find(c => c.ticket); window.__t = t ? t.iid : null; return t ? { iid: t.iid, name: g.def(t).name } : null; });
await pg.screenshot({ path: 'shots/ticket-hand.png' });
// read the ticket in the card window
if (got) await pg.evaluate(() => window.VGUI.openCard(window.VGUI.S.game.cards[window.__t].no, window.__t));
await pg.waitForTimeout(300); const win = await pg.evaluate(() => { const w = document.querySelector('#cardwin'); return w && !w.hidden ? w.textContent.replace(/\s+/g, ' ').slice(0, 400) : ''; });
await pg.screenshot({ path: 'shots/ticket-window.png' }); await pg.evaluate(() => window.VGUI.closeCard());
// end my turn; the opponent's vanguard attacks mine; stop in the guard step
await drive((g, d, VG) => (g.active === 0 ? (d.kind === 'main' ? [d.options.findIndex(o => o.a === 'next')] : d.kind === 'attack' ? [d.options.findIndex(o => o.a === 'end')] : VG.bot(g)) : (d.kind === 'guard' && d.player === 0 && d.options.some(o => o.a === 'blitz') ? null : VG.bot(g))));
await pg.waitForTimeout(500);
const guard = await pg.evaluate(() => { const g = window.VGUI.S.game, d = g.pending; return { kind: d.kind, player: d.player, blitz: d.options.findIndex(o => o.a === 'blitz' && o.iid === window.__t), title: d.title }; });
await pg.screenshot({ path: 'shots/ticket-guard.png' });
let after = null;
if (guard.kind === 'guard' && guard.blitz >= 0) {
  await pg.evaluate(i => { const g = window.VGUI.S.game; window.__gc = 0; window.VGUI.submit([i]); }, guard.blitz);
  await idle(); await pg.waitForTimeout(300);
  const ask = await pg.evaluate(() => { const d = window.VGUI.S.game.pending; return { kind: d.kind, title: d.title }; });
  await pg.screenshot({ path: 'shots/ticket-ask.png' });
  await drive((g, d) => (d.kind === 'yesno' ? [0] : d.kind === 'cards' && /โซล/.test(d.title || '') ? [0] : null));
  await pg.waitForTimeout(500);
  after = await pg.evaluate(() => { const g = window.VGUI.S.game; const log = [...document.querySelectorAll('#log div')].map(x => x.textContent); return { ticket: g.cards[window.__t].zone, gc: g.players[0].GC.length, moved: log.some(t => /Nasruddin ย้ายไป GC/.test(t)), played: log.some(t => /เพลย์ออเดอร์ Persona Shield/.test(t)), gotLog: log.some(t => /ได้รับ Persona Shield/.test(t)), pend: g.pending && g.pending.kind }; });
  after.ask = ask; await pg.screenshot({ path: 'shots/ticket-gc.png' });
}
console.log(JSON.stringify({ setup, got, win: win.slice(0, 200), guard, after, errs }));
const ok = got && got.name === 'Persona Shield' && /ทิกเก็ต/.test(win) && guard.blitz >= 0 && after && after.ticket === 'gone' && after.moved && after.played && !errs.length;
console.log(ok ? 'ticket ok in the page' : 'TICKET UI FAILED'); if (!ok) process.exitCode = 1;
await b.close();
