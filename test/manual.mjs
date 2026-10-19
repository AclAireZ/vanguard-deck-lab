// Manual tools ("do it by hand"): scenario checks, then random games in which valid manual actions are thrown in at random; state must stay consistent and replay identically.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js'; import '../src/bot.js';
import { mulb, randomAnswer } from './sim.mjs';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')));
const M = VG.MAN.op, DEST = k => VG.MAN.dest.indexOf(k), KEY = k => VG.MAN.key.indexOf(k);
const D = VG.DECKS.TD01;
function toMain(seed = 3) {
  const G = new VG.Game({ seed, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }).start();
  for (let n = 0; n < 400 && G.pending; n++) { const d = G.pending; if (d.kind === 'main' && G.turnNo >= 3) break; G.answer(VG.bot(G)); }
  assert.equal(G.pending.kind, 'main'); return G;
}
let passed = 0;
function test(name, fn) { fn(); passed++; if (!process.env.QUIET) console.log('  ok  ' + name); }

test('manual actions are answers: allowed in the main phase, the same decision comes back, the log names them', () => {
  const G = toMain(); const p = G.pending.player; const P = G.players[p]; const h = P.hand.length, dk = P.deck.length;
  assert.ok(G.pending.man); G.events.length = 0;
  G.answer([-1, M.draw, 2]); assert.equal(P.hand.length, h + 2); assert.equal(P.deck.length, dk - 2); assert.equal(G.pending.kind, 'main'); assert.equal(G.pending.player, p);
  assert.ok(G.events.some(e => e.t === 'log' && e.text.startsWith('[ทำเอง]')));
  const s = P.soul.length; G.answer([-1, M.sc, 1]); assert.equal(P.soul.length, s + 1);
  assert.ok(G.validate([-1, M.draw, 0]), 'bad numbers are refused'); assert.ok(G.validate([-1, 99]), 'unknown action'); assert.ok(G.validate([-1, M.draw, 1.5]));
});
test('moving cards by hand: hand → soul, drop → hand, deck → rear-guard circle (placement skills still fire), rear-guard → drop', () => {
  const G = toMain(); const p = G.pending.player; const P = G.players[p];
  const a = P.hand[0]; G.answer([-1, M.mv, a, DEST('soul')]); assert.equal(G.cards[a].zone, 'soul');
  G.answer([-1, M.mv, a, DEST('drop')]); assert.equal(G.cards[a].zone, 'drop'); G.answer([-1, M.mv, a, DEST('hand')]); assert.equal(G.cards[a].zone, 'hand');
  const u = P.deck.find(i => G.def(G.cards[i]).type === 'unit'); G.answer([-1, M.mv, u, DEST('rc'), VG.RCS.indexOf('BC')]);
  while (G.pending && G.pending.kind !== 'main') G.answer(VG.bot(G));   // a placement skill may ask something
  assert.equal(G.cards[u].zone, 'RC'); assert.equal(G.cards[u].pos, 'BC');
  G.answer([-1, M.mv, u, DEST('drop')]); while (G.pending && G.pending.kind !== 'main') G.answer(VG.bot(G)); assert.equal(G.cards[u].zone, 'drop'); assert.equal(G.at(p, 'BC'), null);
  const top = P.deck[0]; G.answer([-1, M.mv, top, DEST('bottom')]); assert.equal(P.deck[P.deck.length - 1], top);
  assert.ok(G.validate([-1, M.mv, G.players[1 - p].hand[0], DEST('drop')]), "the other player's hand is off limits");
  assert.ok(G.validate([-1, M.mv, G.vg(p).iid, DEST('drop')]), 'a vanguard cannot be moved away');
});
test('changing numbers by hand: power until end of turn, critical for one battle, stand / rest, damage face up / down, energy', () => {
  const G = toMain(); const p = G.pending.player; const P = G.players[p]; const v = G.vg(p); const pw = G.stat(v).power;
  G.answer([-1, M.mod, v.iid, KEY('power'), 10000, 0]); assert.equal(G.stat(v).power, pw + 10000);
  G.answer([-1, M.mod, v.iid, KEY('crit'), 1, 1]); assert.equal(G.stat(v).crit, 2);
  G.answer([-1, M.st, v.iid, 0]); assert.equal(v.rest, true); G.answer([-1, M.st, v.iid, 1]); assert.equal(v.rest, false);
  if (P.damage.length) { const c = G.cards[P.damage[0]]; const f = c.faceup; G.answer([-1, M.flip, c.iid]); assert.equal(c.faceup, !f); }
  if (P.crest.length) { const e = P.energy; G.answer([-1, M.ec, -1 * Math.min(1, e) || 1]); assert.notEqual(P.energy, e); }
  const R = VG.Game.replay({ seed: 3, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }, G.history);
  assert.equal(R.stat(R.vg(p)).power, G.stat(v).power, 'a replay of the answers gives the same table');
});
test('not possible while another kind of decision is open; a manual sixth damage ends the fight', () => {
  const G = new VG.Game({ seed: 4, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }).start();
  assert.equal(G.pending.kind, 'mulligan'); assert.ok(G.validate([-1, M.draw, 1]));
  const H = toMain(); const p = H.pending.player; const P = H.players[p];
  for (let n = 0; n < 8 && H.pending; n++) H.answer([-1, M.mv, P.deck[0], DEST('damage')]);
  assert.ok(H.over && H.over.winner === 1 - p && H.over.reason === 'damage');
});

/* ---- random games with manual actions mixed in ---- */
function randomManual(G, rng) {
  const d = G.pending; const p = d.player; const P = G.players[p]; const O = G.players[1 - p]; const pickOf = a => a[Math.floor(rng() * a.length)];
  const mine = [...P.hand, ...P.drop, ...P.soul, ...P.bind, ...P.order, ...P.deck.slice(0, 3), ...G.rcs(p).map(c => c.iid)]; const units = G.units(p).concat(G.units(1 - p)).map(c => c.iid);
  for (let tries = 0; tries < 12; tries++) {
    const r = rng(); let m;
    if (r < 0.12) m = [-1, pickOf([M.draw, M.sc, M.mill]), 1 + Math.floor(rng() * 2)];
    else if (r < 0.2) m = [-1, pickOf([M.cc, M.cb]), 1];
    else if (r < 0.26) m = [-1, M.ec, pickOf([-2, -1, 1, 2])];
    else if (r < 0.3) m = [-1, pickOf([M.shuf, M.look]), 0].slice(0, rng() < 0.5 ? 2 : 3);
    else if (r < 0.42 && units.length) m = [-1, M.mod, pickOf(units), Math.floor(rng() * 4), pickOf([5000, 10000, -5000, 1, -1]), Math.floor(rng() * 2)];
    else if (r < 0.5 && units.length) m = [-1, M.st, pickOf(units), Math.floor(rng() * 2)];
    else if (r < 0.55 && P.damage.length) m = [-1, M.flip, pickOf(P.damage)];
    else if (r < 0.62 && G.rcs(1 - p).length) m = [-1, M.mv, pickOf(G.rcs(1 - p)).iid, DEST(pickOf(['drop', 'hand', 'top', 'bottom', 'bind']))];
    else if (mine.length) { const dest = pickOf(['hand', 'drop', 'soul', 'bind', 'top', 'bottom', 'order', 'removed', 'rc', 'rc', 'vc', 'gc']); m = [-1, M.mv, pickOf(mine), DEST(dest)]; if (dest === 'rc') m.push(Math.floor(rng() * 5)); }
    if (m && m[1] === M.shuf) m = [-1, M.shuf];
    if (m && !G.validate(m)) return m;
  }
  return null;
}
function invariants(G, tag) {
  for (const p of [0, 1]) {
    const P = G.players[p]; const seen = new Set(); let n = 0;
    for (const z of ['deck', 'hand', 'drop', 'damage', 'soul', 'bind', 'removed', 'ride', 'order', 'crest', 'trigger', 'GC']) for (const i of P[z]) { if (seen.has(i)) throw new Error(tag + ' dup ' + i); seen.add(i); if (!G.cards[i].token) n++; if (G.cards[i].zone !== z) throw new Error(tag + ' zone mismatch ' + z + ' ' + G.cards[i].zone); }
    for (const k in P.circles) { const i = P.circles[k]; if (!i) continue; if (seen.has(i)) throw new Error(tag + ' dup circle'); seen.add(i); if (G.cards[i].pos !== k) throw new Error(tag + ' pos mismatch'); if (!G.cards[i].token) n++; }
    if (n !== P.total) throw new Error(tag + ' card count ' + n + ' expected ' + P.total);
    if (!G.over && !G.vg(p)) throw new Error(tag + ' no vanguard');
  }
}
const N = +process.argv[2] || 150; let games = 0, acts = 0; const decks = Object.keys(VG.DECKS);
for (let s = 1; s <= N; s++) {
  const rng = mulb(s * 31 + 7); const cfg = { seed: s * 6007 + 5, players: [{ name: 'A', deck: VG.DECKS[decks[s % decks.length]] }, { name: 'B', deck: VG.DECKS[decks[(s >> 1) % decks.length]] }] };
  const G = new VG.Game(cfg).start(); for (const P of G.players) P.total = Object.values(G.cards).filter(c => c.owner === P.idx && !c.token).length;
  let steps = 0, row = 0;
  while (G.pending) {
    let sel = null;
    if (G.pending.man && row < 3 && rng() < 0.3) { sel = randomManual(G, rng); if (sel) { row++; acts++; } }
    if (!sel) { sel = rng() < 0.5 ? VG.bot(G) : randomAnswer(G, rng); row = 0; }
    try { G.answer(sel); } catch (e) { throw new Error('game ' + s + ' step ' + steps + ' answer ' + JSON.stringify(sel) + ': ' + (e.stack || e)); }
    G.events.length = 0; invariants(G, 'game ' + s + ' step ' + steps + ' after ' + JSON.stringify(sel));
    if (++steps > 12000) throw new Error('game ' + s + ' did not finish');
  }
  if (!G.over) throw new Error('game ' + s + ' ended without a result');
  const R = VG.Game.replay(cfg, G.history); if (!R.over || R.over.winner !== G.over.winner || R.turnNo !== G.turnNo) throw new Error('replay mismatch in game ' + s);
  games++;
}
console.log('\n' + passed + ' scenario tests passed · ' + games + ' random games with ' + acts + ' manual actions ok');
