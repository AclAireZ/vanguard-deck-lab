// Two browser pages play a private room against each other through a stand-in for the shared database (same shape as the real one).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const mock = uid => `(() => {
  const uid = ${JSON.stringify(uid)}; const KEY = 'mockdb:'; const subs = [];
  const read = p => { const v = localStorage.getItem(KEY + p); return v == null ? undefined : JSON.parse(v); };
  const fire = () => { for (const s of subs.slice()) s(); };
  window.addEventListener('storage', fire);
  const write = (p, v) => { if (v === undefined) localStorage.removeItem(KEY + p); else localStorage.setItem(KEY + p, JSON.stringify(v)); setTimeout(fire, 0); };
  const snap = p => { const d = read(p); return { exists: d !== undefined, id: p.split('/').pop(), data: () => d }; };
  const sub = (get, cb) => { let last; const f = () => { const v = get(); const s = JSON.stringify(v.key); if (s !== last) { last = s; cb(v.out); } }; subs.push(f); setTimeout(f, 0); return () => subs.splice(subs.indexOf(f), 1); };
  const doc = p => ({ id: p.split('/').pop(), async set(v) { write(p, v); }, async get() { return snap(p); }, async update(v) { write(p, Object.assign({}, read(p), v)); }, async delete() { write(p, undefined); }, onSnapshot(cb) { return sub(() => ({ key: read(p), out: snap(p) }), cb); } });
  const list = p => Object.keys(localStorage).filter(k => k.startsWith(KEY + p + '/') && !k.slice((KEY + p + '/').length).includes('/')).sort().map(k => snap(k.slice(KEY.length)));
  const col = p => ({ doc: id => doc(p + '/' + id), async get() { return { docs: list(p) }; }, onSnapshot(cb) { return sub(() => { const l = list(p); return { key: l.map(d => [d.id, d.data()]), out: { docs: l } }; }, cb); } });
  window.claude = { use: async k => (k === 'db' ? { doc, collection: col } : { id: async () => uid, profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: 'Player ' + i }])) }) };
})();`;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const errs = [];
async function open(uid) { const pg = await ctx.newPage(); await pg.addInitScript(mock(uid)); pg.on('pageerror', e => errs.push(uid + ': ' + e)); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300); await pg.click('#modeSeg [data-mode="online"]'); await pg.evaluate(() => { window.VGUI.S.speed = 6; }); return pg; }
const A = await open('ua'); const B = await open('ub');
await A.click('#createBtn'); await A.waitForSelector('#roomBox:not([hidden])');
const code = (await A.textContent('#roomCode')).trim();
await B.selectOption('#deckSel0', 'TD01'); await B.fill('#codeIn', code); await B.click('#joinBtn');
await A.waitForSelector('#table:not([hidden])', { timeout: 8000 }); await B.waitForSelector('#table:not([hidden])', { timeout: 8000 });
const drive = pg => pg.evaluate(async () => {
  const U = window.VGUI; const S = U.S; const t0 = Date.now(); let man = 0; const M = window.VG.MAN;
  const sig = g => g.players.map(P => [P.hand.length, P.deck.length, P.soul.length, P.drop.length, P.damage.length].join('.')).join('|');
  while (Date.now() - t0 < 150000) {
    const g = S.game; if (!g) break; if (g.over) return { over: g.over, turn: g.turnNo, seat: S.seat, n: g.history.length, man, sig: sig(g) };
    const d = g.pending;
    if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) {
      // now and then a "do it by hand" action goes through the room as well: draw a card, then put a hand card into the soul
      if (d.man && d.kind === 'main' && man < 4 && g.turnNo >= 2) { const a = man % 2 === 0 ? [-1, M.op.draw, 1] : [-1, M.op.mv, g.players[S.seat].hand[0], M.dest.indexOf('soul')]; if (!g.validate(a)) { man++; U.submit(a); await new Promise(r => setTimeout(r, 30)); continue; } }
      U.submit(window.VG.bot(g));
    }
    await new Promise(r => setTimeout(r, 30));
  }
  return { timeout: true, turn: S.game && S.game.turnNo, pending: S.game && S.game.pending && S.game.pending.kind, seat: S.seat };
});
const [ra, rb] = await Promise.all([drive(A), drive(B)]);
console.log('room', code, 'A', JSON.stringify(ra), 'B', JSON.stringify(rb));
const ok = ra.over && rb.over && ra.over.winner === rb.over.winner && ra.n === rb.n && ra.seat !== rb.seat && ra.man > 0 && rb.man > 0 && ra.sig === rb.sig;
if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 5));
console.log(ok && !errs.length ? 'online ok: both pages finished the same game (manual actions included)' : 'ONLINE FAILED'); if (!ok || errs.length) process.exitCode = 1;
await b.close();
