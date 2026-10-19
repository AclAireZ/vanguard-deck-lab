// Two browser pages play a room through a stand-in for the live room (presence), as friends shared the page as Viewers do: the host's database write is refused (falls back), the guest has no database at all.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const mock = (uid, dbMode) => `(() => {
  const uid = ${JSON.stringify(uid)}; const me = uid + ':' + Math.random().toString(36).slice(2, 7); const KEY = 'mockroom:';
  const rooms = {};
  function named(name) {
    if (rooms[name]) return rooms[name];
    const subs = []; let pres = {}; let snap = null;
    const peers = () => { const out = []; for (const k of Object.keys(localStorage)) if (k.startsWith(KEY + name + '|')) { const id = k.split('|')[1]; out.push(Object.freeze({ peer: id, by: id.split(':')[0], isMe: id === me, sameTab: id === me, kind: 'viewer', guest: false, presence: JSON.parse(localStorage.getItem(k)), updatedAt: Date.now() })); } return out; };
    const fire = () => { const p = peers(); for (const f of subs.slice()) f({ peers: p, joined: [], left: [], updated: p }); };
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith(KEY + name + '|')) fire(); });
    const r = { name, async presence(patch) { pres = Object.assign({}, pres, patch); for (const k in pres) if (pres[k] === null) delete pres[k]; const t = JSON.stringify(pres); if (new TextEncoder().encode(t).length > 4096) throw { code: 'invalid_argument', message: 'over 4 KiB: ' + t.length }; localStorage.setItem(KEY + name + '|' + me, t); setTimeout(fire, 0); },
      peers, onPeers(f) { subs.push(f); setTimeout(() => f({ peers: peers(), joined: peers(), left: [], updated: [] }), 0); return () => subs.splice(subs.indexOf(f), 1); },
      connected: () => true, onConnection(f) { setTimeout(() => f(true), 0); return () => {}; }, async emit() {}, on() { return () => {}; }, async leave() { localStorage.removeItem(KEY + name + '|' + me); } };
    rooms[name] = r; return r;
  }
  const room = { async join(n) { return named(n); }, connected: () => true };
  const deny = () => Promise.reject({ code: 'invalid_argument', message: 'write not permitted' });
  const ro = p => ({ id: p.split('/').pop(), set: deny, update: deny, delete: deny, async get() { return { exists: false, id: p.split('/').pop(), data: () => undefined }; }, onSnapshot() { return () => {}; } });
  const db = ${JSON.stringify(dbMode)} === 'ro' ? { doc: ro, collection: p => ({ doc: id => ro(p + '/' + id), async get() { return { docs: [] }; }, onSnapshot() { return () => {}; } }) } : null;
  window.claude = { use: async k => (k === 'db' ? db : k === 'room' ? room : { id: async () => uid, can: async () => (${JSON.stringify(dbMode)} === 'ro' ? null : false), profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: 'Player ' + i }])) }) };
})();`;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const errs = [];
async function open(uid, dbMode) { const pg = await ctx.newPage(); await pg.addInitScript(mock(uid, dbMode)); pg.on('pageerror', e => errs.push(uid + ': ' + e)); await pg.goto('http://vg.test/'); await pg.waitForTimeout(300); await pg.click('#modeSeg [data-mode="online"]'); await pg.evaluate(() => { window.VGUI.S.speed = 6; }); return pg; }
const A = await open('ua', 'ro'); const B = await open('ub', 'none');
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
// part way through, B reloads the page and comes back with "back to the last room"
const part = pg => pg.evaluate(async () => { const S = window.VGUI.S; const t0 = Date.now(); while (Date.now() - t0 < 60000) { const g = S.game; if (g && g.turnNo >= 4) return g.history.length; const d = g && g.pending; if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) window.VGUI.submit(window.VG.bot(g)); await new Promise(r => setTimeout(r, 30)); } return -1; });
const [pa] = await Promise.all([part(A), part(B)]);
await B.reload(); await B.waitForTimeout(400); await B.click('#modeSeg [data-mode="online"]'); await B.waitForSelector('#rejoinBtn:not([hidden])', { timeout: 5000 }); await B.click('#rejoinBtn');
await B.waitForSelector('#table:not([hidden])', { timeout: 8000 });
const back = await B.evaluate(async () => { for (let k = 0; k < 50; k++) { const g = window.VGUI.S.game; if (g && g.history.length > 10) return g.history.length; await new Promise(r => setTimeout(r, 100)); } return -1; });
console.log('resumed B after reload at', back, 'answers (A had', pa, ')');
const [ra, rb] = await Promise.all([drive(A), drive(B)]);
console.log('room', code, 'A', JSON.stringify(ra), 'B', JSON.stringify(rb));
const ok = ra.over && rb.over && ra.over.winner === rb.over.winner && ra.n === rb.n && ra.seat !== rb.seat && ra.man > 0 && rb.man > 0 && ra.sig === rb.sig;
if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 5));
console.log(ok && !errs.length ? 'online room ok: both pages finished the same game through the live room (manual actions included)' : 'ONLINE FAILED'); if (!ok || errs.length) process.exitCode = 1;
await b.close();
