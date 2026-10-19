import fs from 'node:fs';
import '../src/engine.js';
import '../src/cards.js';
import '../src/fx.js';
import '../src/db.js';
import '../src/bot.js';
import assert from 'node:assert/strict';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')));
const A = '1MCW2', T = 'TD01';
const ART = 'DZ-BT07/016EN', RACH = 'DZ-BT07/143EN', LUMI = 'DZ-BT08/017EN', LUFUR = 'DZ-BT07/018EN', REVERB = 'DZ-BT07/053EN', WARMIA = 'DZ-BT07/094EN', SISKA = 'DZ-BT02/066EN', ANGELMA = 'D-LBT01/H19EN';
const OVER = 'DZ-BT07/025EN', CRIT = 'DZ-LBT01/089EN', FRONT = 'DZ-LBT01/093EN', HEAL = 'DZ-LBT01/095EN', SHOUT = 'DZ-BT07/095EN', MEGA = 'DZ-BT07/096EN', TOKEN = 'TOKEN/ShadowArmy';
const TRI = 'DZ-TD01/001EN', KAGE = 'DZ-TD01/007EN', YUMNA = 'DZ-TD01/011EN', HAYA = 'DZ-TD01/013EN', TCRIT = 'DZ-TD01/014EN', THEAL = 'DZ-TD01/017EN', QUAY = 'DZ-TD01/006EN';

let passed = 0; const fails = [];
function test(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { fails.push(name); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').slice(0, 8).join('\n       ')); } }

function mk(d0 = A, d1 = T, first = 0, seed = 11) {
  const G = new VG.Game({ seed, first, players: [{ name: 'A', deck: VG.DECKS[d0] }, { name: 'B', deck: VG.DECKS[d1] }] }).start();
  G.answer([]); G.answer([]); // no mulligan
  return G;
}
function take(G, p, no, zones = ['deck', 'hand', 'drop', 'ride', 'soul']) {
  const P = G.players[p];
  for (const z of zones) { const i = P[z].find(x => G.cards[x].no === no); if (i) return i; }
  throw new Error('no free copy of ' + no);
}
function put(G, p, no, zone, o = {}) { const i = take(G, p, no, o.from || ['deck']); G.move(i, zone, Object.assign({ silent: true }, o)); return i; }
function setVG(G, p, no) { const old = G.vg(p); const i = take(G, p, no, ['ride', 'deck', 'hand']); G.move(old.iid, 'soul', { silent: true }); G.move(i, 'VC', { pos: 'V', silent: true }); for (const c of G.players[p].ride.slice()) if (G.def(G.cards[c]).type === 'crest') G.move(c, 'crest', { silent: true }); return i; }
function top(G, p, ...nos) {
  const P = G.players[p]; const used = new Set(); const picks = [];
  for (const no of nos) { let i = null; for (const z of ['deck', 'hand', 'drop', 'damage', 'soul']) { i = P[z].find(x => G.cards[x].no === no && !used.has(x)); if (i) break; } if (!i) throw new Error('no free copy of ' + no); used.add(i); picks.push(i); }
  for (const i of picks.reverse()) G.move(i, 'deck', { silent: true });
}
function dmg(G, p, n) { const P = G.players[p]; for (let k = 0; k < n; k++) { const i = P.deck.find(x => !G.def(G.cards[x]).trigger); G.move(i, 'damage', { silent: true }); } }
function go(G, policy, max = 400) {
  for (let n = 0; n < max && G.pending; n++) { const r = policy(G.pending, G); if (process.env.DBG && G.turnNo >= 3) console.log('     ', G.pending.kind, G.pending.player, G.pending.hint || '', G.pending.title, '->', JSON.stringify(r)); if (r === undefined) return; G.answer(r === 'bot' ? VG.bot(G) : r); }
}
const opt = (d, f) => { const i = d.options.findIndex(f); if (i < 0) throw new Error('option not found in ' + d.kind + ': ' + JSON.stringify(d.options).slice(0, 300)); return [i]; };
const until = (kind, extra) => (d, G) => (d.kind === kind && (!extra || extra(d, G)) ? undefined : 'bot');
const pw = (G, i) => G.stat(G.cards[i]).power;

console.log('setup / turn structure');
test('first player draws on turn 1 and cannot attack', () => {
  const G = mk();
  assert.equal(G.turnNo, 1); assert.equal(G.players[0].hand.length, 6); assert.equal(G.pending.kind, 'ride');
  go(G, d => (d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? opt(d, o => o.a === 'next') : undefined));
  assert.equal(G.turnNo, 2, 'turn 1 has no battle phase'); assert.equal(G.active, 1);
});
test('ride from ride deck costs one discard; G0 goes to soul', () => {
  const G = mk();
  G.answer(opt(G.pending, o => o.a === 'rideDeck'));
  assert.equal(G.pending.kind, 'cards'); G.answer([0]);
  go(G, until('main'));
  assert.equal(G.grade(G.vg(0)), 1); assert.equal(G.players[0].soul.length, 1); assert.equal(G.players[0].drop.length, 1);
});
test('energy: first player 0 on turn 1, second gets 3 on first ride, +3 each ride phase, cap 10', () => {
  const G = mk(A, A);
  const seen = [];
  go(G, (d, g) => { if (d.kind === 'main') { seen.push([g.turnNo, g.active, g.players[g.active].energy]); if (seen.length >= 8) return undefined; return opt(d, o => o.a === 'next'); } if (d.kind === 'attack') return opt(d, o => o.a === 'end'); if (d.kind === 'ride') { const i = d.options.findIndex(o => o.a === 'rideDeck'); return [i >= 0 ? i : d.options.findIndex(o => o.a === 'skip')]; } if (d.kind === 'yesno') return [1]; return 'bot'; });
  assert.deepEqual(seen.slice(0, 8).map(x => x[2]), [0, 3, 3, 6, 6, 9, 9, 10]);
});
test('starter draws only for the player going second (Proutta); search is optional on ride', () => {
  const G = mk(A, A, 0);
  const h0 = G.players[0].hand.length;
  go(G, (d, g) => (d.kind === 'ride' ? opt(d, o => o.a === 'rideDeck') : d.kind === 'main' ? undefined : d.kind === 'yesno' ? [1] : 'bot'));
  assert.equal(G.players[0].hand.length, h0 - 1, 'first player: discard only, no starter draw');
  go(G, (d, g) => (g.active === 0 ? (d.kind === 'main' ? opt(d, o => o.a === 'next') : 'bot') : d.kind === 'ride' ? opt(d, o => o.a === 'rideDeck') : d.kind === 'main' ? undefined : d.kind === 'yesno' ? [1] : 'bot'));
  assert.equal(G.active, 1); assert.equal(G.players[1].hand.length, 5 + 1 - 1 + 1, 'second player: draw, discard, starter draw');
});

console.log('persona ride / triggers');
test('persona ride: draw 1, front row +10000 until end of turn (units called later too)', () => {
  const G = mk();
  setVG(G, 0, ART); const copy = put(G, 0, ART, 'hand'); const r = put(G, 0, RACH, 'RC', { pos: 'FL' }); const lu = put(G, 0, LUFUR, 'hand');
  go(G, (d, g) => (g.turnNo < 3 ? (d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? opt(d, o => o.a === 'next') : d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : undefined));
  assert.equal(G.pending.kind, 'ride');
  const h = G.players[0].hand.length;
  G.answer(opt(G.pending, o => o.a === 'ride' && o.persona && o.iid === copy));
  assert.equal(G.players[0].hand.length, h - 1 + 1);
  assert.equal(pw(G, r), 13000 + 10000); assert.equal(pw(G, G.vg(0).iid), 23000);
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === lu && o.circle === 'FR'));
  assert.equal(pw(G, lu), 20000, 'unit called after persona ride also gets +10000');
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === G.players[0].hand.find(i => G.def(G.cards[i]).grade <= 1 && G.def(G.cards[i]).type === 'unit') && o.circle === 'BL'));
  assert.equal(pw(G, G.at(0, 'BL').iid), G.def(G.at(0, 'BL')).power, 'back row gets nothing');
  go(G, (d, g) => (g.turnNo === 3 ? (d.kind === 'main' ? opt(d, o => o.a === 'next') : d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : undefined));
  assert.equal(pw(G, r), 13000, 'bonus ends with the turn');
});
function battleSetup(opts = {}) {
  const G = mk(opts.d0 || A, opts.d1 || T, 0);
  setVG(G, 0, opts.vg0 || ART); setVG(G, 1, opts.vg1 || TRI);
  if (opts.pre) opts.pre(G);
  go(G, (d, g) => (g.turnNo < 3 ? (d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? opt(d, o => o.a === 'next') : d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? undefined : 'bot'));
  assert.equal(G.pending.kind, 'main'); assert.equal(G.turnNo, 3);
  return G;
}
const toBattle = G => { G.answer(opt(G.pending, o => o.a === 'next')); assert.equal(G.pending.kind, 'attack'); };
const attackVG = (G, from = 'V') => G.answer(opt(G.pending, o => o.a === 'attack' && o.iid === G.at(0, from).iid && o.target === G.vg(1).iid));
test('critical trigger on drive check: +1 crit and +10000, two damage dealt', () => {
  const G = battleSetup({ pre: g => { put(g, 0, LUFUR, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, CRIT, RACH); top(G, 1, QUAY, QUAY);
  attackVG(G);
  go(G, (d, g) => { if (d.kind === 'yesno') return [1]; if (d.kind === 'guard') return []; if (d.kind === 'cards' && d.hint === 'crit') return opt(d, o => o.iid === g.vg(0).iid); if (d.kind === 'cards' && d.hint === 'buff') return opt(d, o => o.iid === g.vg(0).iid); return undefined; });
  assert.equal(G.players[1].damage.length, 2); assert.equal(G.pending.kind, 'attack');
  assert.equal(pw(G, G.vg(0).iid), 23000, 'trigger power lasts until end of turn');
});
test('front trigger buffs the whole front row; draw trigger draws', () => {
  const G = battleSetup({ pre: g => { put(g, 0, RACH, 'RC', { pos: 'FL' }); put(g, 0, REVERB, 'RC', { pos: 'BL' }); } });
  toBattle(G); top(G, 0, FRONT, RACH);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : undefined));
  assert.equal(pw(G, G.at(0, 'FL').iid), 23000); assert.equal(pw(G, G.at(0, 'BL').iid), 8000); assert.equal(pw(G, G.vg(0).iid), 23000);
});
test('heal trigger heals only when damage >= opponent', () => {
  const G = battleSetup({ pre: g => { dmg(g, 1, 2); } });
  toBattle(G); top(G, 0, RACH, RACH); top(G, 1, THEAL);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : d.kind === 'cards' ? [0] : undefined));
  assert.equal(G.players[1].damage.length, 2, '2 damage, heal check: heals one, then check card lands → still 2');
  const G2 = battleSetup({ pre: g => { dmg(g, 0, 3); } });
  toBattle(G2); top(G2, 0, RACH, RACH); top(G2, 1, THEAL);
  attackVG(G2);
  go(G2, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : d.kind === 'cards' ? [0] : undefined));
  assert.equal(G2.players[1].damage.length, 1, 'fewer damage than opponent: no heal');
});
test('sixth damage loses; heal on the sixth check saves', () => {
  const G = battleSetup({ pre: g => { dmg(g, 1, 5); dmg(g, 0, 5); } });
  toBattle(G); top(G, 0, RACH, RACH); top(G, 1, THEAL);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : d.kind === 'cards' ? [0] : undefined));
  assert.equal(G.over, null); assert.equal(G.players[1].damage.length, 5);
  const G2 = battleSetup({ pre: g => { dmg(g, 1, 5); } });
  toBattle(G2); top(G2, 0, RACH, RACH); top(G2, 1, QUAY);
  attackVG(G2);
  go(G2, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : undefined));
  assert.deepEqual(G2.over, { winner: 0, reason: 'damage' });
});
test('over trigger: removed from game, draw, +100M, rear-guards +10000 on own turns for the rest of the fight', () => {
  const G = battleSetup({ pre: g => { put(g, 0, RACH, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, OVER, RACH);
  const h = G.players[0].hand.length;
  attackVG(G);
  go(G, (d, g) => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : d.kind === 'cards' && d.hint === 'buff' ? opt(d, o => o.iid === g.vg(0).iid) : undefined));
  assert.equal(G.players[0].removed.length, 1); assert.equal(G.players[0].hand.length, h + 1 + 1, 'over draw + second drive check');
  assert.ok(pw(G, G.vg(0).iid) >= 100000000); assert.equal(pw(G, G.at(0, 'FL').iid), 23000);
  go(G, (d, g) => (g.turnNo === 3 ? (d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : undefined));
  assert.equal(pw(G, G.at(0, 'FL').iid), 13000, 'not on the opponent turn');
  go(G, (d, g) => (g.turnNo === 4 ? (d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? opt(d, o => o.a === 'next') : d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : d.kind === 'ride' ? opt(d, o => o.a === 'skip') : undefined));
  assert.equal(G.turnNo, 5); if (G.at(0, 'FL')) assert.equal(pw(G, G.at(0, 'FL').iid), 23000, 'back on own turn 5');
});

console.log('guarding');
test('guard with shield: attack misses when shield makes defense exceed power', () => {
  const G = battleSetup({ pre: g => { put(g, 1, TCRIT, 'hand'); put(g, 0, LUFUR, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, RACH, RACH);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : undefined));
  assert.equal(G.pending.kind, 'guard'); assert.equal(G.pending.atk, 13000); assert.equal(G.pending.dfn, 13000);
  G.answer(opt(G.pending, o => o.a === 'guard' && G.cards[o.iid].no === TCRIT));
  assert.equal(G.players[1].damage.length, 0); assert.equal(G.players[1].GC.length, 0, 'guardian retired at end of battle');
  assert.equal(G.pending.kind, 'attack');
});
test('equal power hits (attacker wins ties)', () => {
  const G = battleSetup();
  toBattle(G); top(G, 0, RACH, RACH); top(G, 1, QUAY);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : undefined));
  assert.equal(G.players[1].damage.length, 1);
});
test('sentinel (Hayashi Kaze): discard cost, unit cannot be hit', () => {
  const G = battleSetup({ pre: g => { put(g, 1, HAYA, 'hand'); put(g, 0, LUFUR, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, CRIT, CRIT);
  const h = G.players[1].hand.length;
  attackVG(G);
  go(G, (d, g) => { if (d.kind === 'guard') return opt(d, o => g.cards[o.iid].no === HAYA); if (d.kind === 'yesno') return d.player === 1 ? [0] : [1]; if (d.kind === 'cards' && d.player === 1 && d.hint === 'protect') return opt(d, o => o.iid === g.vg(1).iid); if (d.kind === 'cards') return 'bot'; return undefined; });
  assert.equal(G.players[1].damage.length, 0); assert.equal(G.players[1].hand.length, h - 2, 'sentinel + discard');
});
test('sentinel (Warmia): no cost, discards one when hand has two or more', () => {
  const G = battleSetup({ d0: T, d1: A, vg0: TRI, vg1: ART, pre: g => { put(g, 1, WARMIA, 'hand'); put(g, 0, KAGE, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, QUAY, QUAY);
  const h = G.players[1].hand.length;
  attackVG(G);
  go(G, (d, g) => { if (d.kind === 'guard') return opt(d, o => g.cards[o.iid].no === WARMIA); if (d.kind === 'yesno') return [1]; if (d.kind === 'cards' && d.hint === 'protect') return opt(d, o => o.iid === g.vg(1).iid); if (d.kind === 'cards') return 'bot'; return undefined; });
  assert.equal(G.players[1].damage.length, 0); assert.equal(G.players[1].hand.length, h - 2);
});
test('intercept: front-row grade 2 moves to GC, adds 5000, goes to drop after battle', () => {
  const G = battleSetup({ pre: g => { put(g, 1, KAGE, 'RC', { pos: 'FL' }); } });
  toBattle(G); top(G, 0, RACH, RACH);
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : undefined));
  const i = G.at(1, 'FL').iid;
  G.answer(opt(G.pending, o => o.a === 'intercept' && o.iid === i));
  assert.equal(G.players[1].damage.length, 0); assert.equal(G.cards[i].zone, 'drop'); assert.equal(G.at(1, 'FL'), null);
});
test('rear-guard hit is retired; guardians need grade <= vanguard grade', () => {
  const G = battleSetup({ vg1: 'DZ-TD01/003EN', pre: g => { put(g, 1, YUMNA, 'RC', { pos: 'FR' }); put(g, 1, KAGE, 'hand'); put(g, 1, TCRIT, 'hand'); } });
  toBattle(G);
  G.answer(opt(G.pending, o => o.a === 'attack' && o.iid === G.vg(0).iid && o.target === G.at(1, 'FR').iid));
  go(G, d => (d.kind === 'yesno' ? [1] : undefined));
  assert.equal(G.pending.kind, 'guard');
  assert.ok(!G.pending.options.some(o => G.cards[o.iid].no === KAGE), 'grade 2 cannot guard under a grade 1 vanguard');
  G.answer([]);
  assert.equal(G.at(1, 'FR'), null); assert.equal(G.players[1].damage.length, 0);
});

console.log('Artisaria deck');
test('Artisaria ACT: Sound System from hand → order zone + draw; Shout draws and calls a token', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'hand'); g.players[0].energy = 0; } });
  assert.equal(G.players[0].energy, 3);
  const h = G.players[0].hand.length;
  G.answer(opt(G.pending, o => o.a === 'act' && G.cards[o.iid].no === ART));
  go(G, (d, g) => (d.kind === 'cards' ? opt(d, o => g.cards[o.iid].no === SHOUT && g.cards[o.iid].zone === 'hand') : d.kind === 'circle' ? opt(d, o => o.circle === 'FL') : undefined));
  assert.equal(G.players[0].energy, 1); assert.equal(G.players[0].order.length, 1);
  assert.equal(G.players[0].hand.length, h - 1 + 1 + 1, 'ACT draw + Shout draw');
  assert.equal(G.at(0, 'FL').no, TOKEN); assert.equal(pw(G, G.at(0, 'FL').iid), 15000);
  assert.ok(!G.pending.options.some(o => o.a === 'act' && G.cards[o.iid].no === ART), 'once per turn');
});
test('Sound Systems cannot be played from hand as orders', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'hand'); put(g, 0, MEGA, 'hand'); } });
  assert.ok(!G.pending.options.some(o => o.a === 'order'));
});
test('Artisaria: 2 Sound Systems → crit 2 on own turn; on attack CB1 calls tokens and front row +5000', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); put(g, 0, MEGA, 'order'); dmg(g, 0, 1); put(g, 0, RACH, 'RC', { pos: 'FR' }); } });
  assert.equal(G.stat(G.vg(0)).crit, 2);
  toBattle(G); top(G, 0, REVERB, REVERB); top(G, 1, QUAY, QUAY);
  attackVG(G);
  let circles = ['FL', 'BL'];
  go(G, (d, g) => { if (d.kind === 'yesno') return [0]; if (d.kind === 'circle') { const c = circles.shift(); return opt(d, o => o.circle === c); } if (d.kind === 'guard') return []; return undefined; });
  assert.equal(G.at(0, 'FL').no, TOKEN); assert.equal(G.at(0, 'BL').no, TOKEN);
  assert.equal(G.players[0].damage.filter(i => G.cards[i].faceup).length, 0, 'CB1 paid');
  assert.equal(pw(G, G.at(0, 'FR').iid), 18000, 'front row +5000 (2 systems)'); assert.equal(pw(G, G.at(0, 'BL').iid), 15000, 'back row token unchanged');
  assert.equal(pw(G, G.at(0, 'FL').iid), 20000, 'front row token got +5000'); assert.equal(G.players[1].damage.length, 2, 'crit 2');
  go(G, (d, g) => (g.turnNo === 3 ? (d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : undefined));
  assert.equal(G.stat(G.vg(0)).crit, 1, 'crit bonus only on own turn'); assert.equal(pw(G, G.at(0, 'FR').iid), 13000, 'front row bonus ended');
});
test('token called over a unit retires it → Rachroea / Lufur leave-RC skills; token vanishes when it leaves', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); dmg(g, 0, 2); put(g, 0, RACH, 'RC', { pos: 'FR' }); put(g, 0, LUFUR, 'RC', { pos: 'FL' }); g.soulCharge(0, 2); } });
  const rach = G.at(0, 'FR').iid;
  toBattle(G); top(G, 0, REVERB, REVERB);
  const h = G.players[0].hand.length;
  attackVG(G);
  const asked = [];
  go(G, (d, g) => { if (d.kind === 'yesno') { asked.push(d.title); return [0]; } if (d.kind === 'circle') return opt(d, o => o.circle === 'FL'); if (d.kind === 'guard') return []; if (d.kind === 'cards') return 'bot'; if (d.kind === 'order') return [0]; return undefined; });
  assert.equal(G.at(0, 'FL').no, TOKEN);
  assert.ok(asked.some(t => t.includes('Lufur')), 'Lufur asked: ' + asked.join(' | '));
  assert.equal(G.players[0].hand.length, h + 1 + 2, 'Lufur draw + twin drive');
  G.move(rach, 'hand', { reason: 'bounce' });
  go(G, (d, g) => (d.kind === 'yesno' ? [0] : d.kind === 'cards' && d.hint === 'buff' ? opt(d, o => o.iid === g.vg(0).iid) : d.kind === 'cards' ? 'bot' : undefined));
  const tok = G.at(0, 'FL').iid; G.retire(tok); assert.equal(G.cards[tok].zone, 'gone'); assert.ok(!G.players[0].drop.includes(tok));
});
test('Rachroea on RC: +5000 per Sound System when attacking', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); put(g, 0, MEGA, 'order'); put(g, 0, RACH, 'RC', { pos: 'FR' }); } });
  toBattle(G);
  attackVG(G, 'FR');
  assert.equal(G.pending.kind, 'guard'); assert.equal(G.pending.atk, 23000);
});
test('Luminoel: reveal Artisaria from hand when VG is not Artisaria G3; token cannot attack', () => {
  const G = battleSetup({ vg0: 'DZ-BT07/145EN', pre: g => { put(g, 0, LUMI, 'hand'); put(g, 0, ART, 'hand'); for (const c of g.players[0].ride.slice()) if (g.def(g.cards[c]).type === 'crest') g.move(c, 'crest', { silent: true }); } });
  assert.ok(G.players[0].energy >= 2);
  const l = G.players[0].hand.find(i => G.cards[i].no === LUMI);
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === l && o.circle === 'FL'));
  assert.equal(G.pending.kind, 'cards', 'asked to reveal'); G.answer([0]);
  assert.equal(G.pending.kind, 'yesno'); G.answer([0]);
  G.answer(opt(G.pending, o => o.circle === 'FR'));
  const t = G.at(0, 'FR'); assert.equal(t.no, TOKEN); assert.equal(G.stat(t).cantAttack, true);
  toBattle(G);
  assert.ok(!G.pending.options.some(o => o.iid === t.iid), 'token not offered as attacker');
});
test('Luminoel on GC: retire 2 tokens → shield 5000 + 20000', () => {
  const G = battleSetup({ d0: T, d1: A, vg0: TRI, vg1: ART, pre: g => { put(g, 1, LUMI, 'hand'); for (const k of ['BL', 'BR']) { const t = g.newCard(TOKEN, 1, 'new', true); g.move(t.iid, 'RC', { pos: k, silent: true }); } } });
  toBattle(G); top(G, 0, QUAY, QUAY);
  attackVG(G);
  go(G, (d, g) => { if (d.kind === 'yesno') return d.player === 1 ? [0] : [1]; if (d.kind === 'guard') return d.title.includes('ยังโดน') ? [] : opt(d, o => g.cards[o.iid].no === LUMI); if (d.kind === 'cards' && d.player === 1) return [0, 1]; if (d.kind === 'cards') return 'bot'; return undefined; });
  assert.equal(G.players[1].damage.length, 0); assert.equal(G.rcs(1).filter(c => c.token).length, 0);
});
test('Lufur: +5000/+5000 on RC and on GC only with a Sound System', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); put(g, 0, LUFUR, 'hand'); } });
  const l = G.players[0].hand.find(i => G.cards[i].no === LUFUR);
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === l && o.circle === 'FL'));
  assert.equal(pw(G, l), 15000); assert.equal(G.stat(G.cards[l]).shield, 10000);
});
test('Reverbera: +5000 with Sound System on own turn; after boosting goes to soul and bounces a rear-guard', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); put(g, 0, REVERB, 'RC', { pos: 'BC' }); put(g, 0, RACH, 'RC', { pos: 'FR' }); } });
  const rv = G.at(0, 'BC').iid, ra = G.at(0, 'FR').iid;
  assert.equal(pw(G, rv), 13000);
  toBattle(G); top(G, 0, REVERB, REVERB);
  attackVG(G);
  const soul = G.players[0].soul.length;
  go(G, (d, g) => { if (d.kind === 'boost') return [0]; if (d.kind === 'yesno') return d.title.includes('Reverbera') ? [0] : [1]; if (d.kind === 'guard') return []; if (d.kind === 'cards' && d.hint === 'bounce') return opt(d, o => o.iid === ra); return undefined; });
  assert.equal(G.cards[rv].zone, 'soul'); assert.equal(G.players[0].soul.length, soul + 1); assert.equal(G.cards[ra].zone, 'hand');
});
test('Siska: choice between CB1 draw (4+ units) and EB3 +10000; not when another Siska is on RC', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SISKA, 'hand'); put(g, 0, SISKA, 'hand'); dmg(g, 0, 1); put(g, 0, RACH, 'RC', { pos: 'FR' }); put(g, 0, REVERB, 'RC', { pos: 'BR' }); } });
  const [s1, s2] = G.players[0].hand.filter(i => G.cards[i].no === SISKA);
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === s1 && o.circle === 'FL'));
  assert.equal(G.pending.kind, 'option'); assert.deepEqual(G.pending.options.map(o => o.id), ['draw', 'power', 'none']);
  G.answer(opt(G.pending, o => o.id === 'power'));
  assert.equal(pw(G, s1), 18000); assert.equal(G.players[0].energy, 0);
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === s2 && o.circle === 'BL'));
  assert.equal(G.pending.kind, 'main', 'second Siska: no skill');
});
test('Angelma (back row): draw when another unit is placed on RC during own battle phase, once per turn', () => {
  const G = battleSetup({ pre: g => { put(g, 0, SHOUT, 'order'); put(g, 0, MEGA, 'order'); put(g, 0, ANGELMA, 'RC', { pos: 'BR' }); dmg(g, 0, 1); g.soulCharge(0, 3); } });
  toBattle(G); top(G, 0, REVERB, REVERB);
  const h = G.players[0].hand.length;
  attackVG(G);
  let n = 0;
  go(G, (d, g) => { if (d.kind === 'yesno') { if (d.title.includes('Angelma')) n++; return [0]; } if (d.kind === 'circle') return opt(d, o => o.circle === (g.at(0, 'FL') ? 'FR' : 'FL')); if (d.kind === 'guard') return []; if (d.kind === 'cards') return 'bot'; if (d.kind === 'order') return [0]; return undefined; });
  assert.equal(n, 1); assert.equal(G.players[0].hand.length, h + 1 + 2);
});
test('MegaЯoManiA: locks a rear-guard only vs grade 3+ vanguard; locked unit cannot act; unlocks at end of its owner turn', () => {
  const G = battleSetup({ pre: g => { put(g, 0, MEGA, 'hand'); put(g, 1, KAGE, 'RC', { pos: 'FL' }); put(g, 1, YUMNA, 'RC', { pos: 'BL' }); } });
  const k = G.at(1, 'FL').iid;
  G.answer(opt(G.pending, o => o.a === 'act' && G.cards[o.iid].no === ART));
  go(G, (d, g) => (d.kind === 'cards' && d.hint === 'lockOpp' ? opt(d, o => o.iid === k) : d.kind === 'cards' ? [0] : undefined));
  assert.equal(G.cards[k].locked, true);
  toBattle(G);
  assert.ok(!G.pending.options.some(o => o.target === k), 'locked card is not a legal attack target');
  attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : undefined));
  if (G.pending.kind === 'guard') { assert.ok(!G.pending.options.some(o => o.iid === k), 'locked card cannot intercept'); G.answer([]); }
  go(G, (d, g) => (g.turnNo === 3 ? (d.kind === 'attack' ? opt(d, o => o.a === 'end') : 'bot') : undefined));
  assert.equal(G.turnNo, 4); assert.equal(G.cards[k].locked, true, 'still locked during its owner turn');
  go(G, (d, g) => { if (g.turnNo !== 4) return undefined; if (d.kind === 'ride') return opt(d, o => o.a === 'skip'); if (d.kind === 'main') { assert.ok(!d.options.some(o => o.a === 'call' && o.circle === 'FL'), 'cannot call onto a locked circle'); assert.ok(!d.options.some(o => o.a === 'move' && o.col === 'L'), 'cannot move a locked column'); return opt(d, o => o.a === 'next'); } if (d.kind === 'attack') { assert.ok(!d.options.some(o => o.iid === k)); return opt(d, o => o.a === 'end'); } return 'bot'; });
  assert.equal(G.cards[k].locked, false, 'unlocked at end of owner turn');
});
test('ride line: Eastiera/Lifel search a Sound System when the ride deck still holds Artisaria', () => {
  const G = mk(A, T, 1);
  go(G, (d, g) => (g.active === 1 ? (d.kind === 'ride' ? opt(d, o => o.a === 'skip') : d.kind === 'main' ? opt(d, o => o.a === 'next') : 'bot') : d.kind === 'ride' ? opt(d, o => o.a === 'rideDeck') : d.kind === 'cards' && d.hint === 'discard' ? [0] : d.kind === 'yesno' ? [0] : d.kind === 'cards' && d.hint === 'search' ? [0] : d.kind === 'main' ? undefined : 'bot'));
  assert.equal(G.def(G.vg(0)).name, 'DynamicExciter, Eastiera');
  assert.ok(G.players[0].hand.some(i => G.def(G.cards[i]).race === 'Sound System'));
});

console.log('Triumph Dragon deck');
test('Triumph ACT: CB1, search a copy, +10000; attack skill: EB4 retire + 5000/crit only vs vanguard', () => {
  const G = battleSetup({ d0: T, d1: A, vg0: TRI, vg1: ART, pre: g => { dmg(g, 0, 1); g.players[0].energy = 1; put(g, 1, LUFUR, 'RC', { pos: 'FR' }); put(g, 1, REVERB, 'RC', { pos: 'BR' }); } });
  assert.equal(G.players[0].energy, 4);
  const h = G.players[0].hand.length;
  G.answer(opt(G.pending, o => o.a === 'act' && G.cards[o.iid].no === TRI));
  go(G, d => (d.kind === 'cards' ? [0] : undefined));
  assert.equal(G.players[0].hand.length, h + 1); assert.equal(pw(G, G.vg(0).iid), 23000);
  toBattle(G); top(G, 0, QUAY, QUAY); top(G, 1, RACH, RACH);
  const lf = G.at(1, 'FR').iid;
  attackVG(G);
  go(G, (d, g) => (d.kind === 'yesno' ? [0] : d.kind === 'cards' && d.hint === 'retireOpp' ? opt(d, o => o.iid === lf) : d.kind === 'guard' ? [] : undefined));
  assert.equal(G.cards[lf].zone, 'drop'); assert.equal(G.players[0].energy, 0); assert.equal(G.players[1].damage.length, 2);
});
test('Triumph attack skill is not offered when attacking a rear-guard', () => {
  const G = battleSetup({ d0: T, d1: A, vg0: TRI, vg1: ART, pre: g => { g.players[0].energy = 4; put(g, 1, LUFUR, 'RC', { pos: 'FR' }); } });
  toBattle(G);
  G.answer(opt(G.pending, o => o.a === 'attack' && o.iid === G.vg(0).iid && o.target === G.at(1, 'FR').iid));
  assert.notEqual(G.pending.kind, 'yesno');
});

console.log('misc rules');
test('deck-out loses', () => {
  const G = battleSetup();
  const P = G.players[0]; while (P.deck.length > 2) G.move(P.deck[0], 'drop', { silent: true });
  toBattle(G); attackVG(G);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'guard' ? [] : d.kind === 'cards' ? [0] : undefined));
  assert.deepEqual(G.over, { winner: 1, reason: 'deck' });
});
test('normal call needs grade <= vanguard grade; calling over a unit retires it; column swap', () => {
  const G = mk();
  go(G, d => (d.kind === 'ride' ? opt(d, o => o.a === 'rideDeck') : d.kind === 'cards' ? [0] : d.kind === 'yesno' ? [1] : d.kind === 'main' ? undefined : 'bot'));
  const d = G.pending; assert.ok(d.options.filter(o => o.a === 'call').every(o => G.grade(G.cards[o.iid]) <= 1));
  const c = d.options.find(o => o.a === 'call'); if (!c) return;
  G.answer(opt(G.pending, o => o.a === 'call' && o.iid === c.iid && o.circle === 'FL'));
  go(G, x => (x.kind === 'main' ? undefined : 'bot'));
  G.answer(opt(G.pending, o => o.a === 'move' && o.col === 'L'));
  assert.equal(G.at(0, 'BL').iid, c.iid); assert.equal(G.at(0, 'FL'), null);
  const c2 = G.pending.options.find(o => o.a === 'call' && o.circle === 'BL');
  if (c2) { G.answer(opt(G.pending, o => o.a === 'call' && o.iid === c2.iid && o.circle === 'BL')); assert.equal(G.cards[c.iid].zone, 'drop'); }
});
test('boost adds the booster power only for that battle; rested units cannot boost or attack', () => {
  const G = battleSetup({ pre: g => { put(g, 0, REVERB, 'RC', { pos: 'BC' }); } });
  toBattle(G); top(G, 0, RACH, RACH);
  attackVG(G);
  assert.equal(G.pending.kind, 'boost'); G.answer([0]);
  go(G, d => (d.kind === 'yesno' ? [1] : undefined));
  assert.equal(G.pending.atk, 21000); G.answer([]);
  go(G, d => (d.kind === 'yesno' ? [1] : d.kind === 'cards' ? 'bot' : undefined));
  assert.equal(pw(G, G.vg(0).iid), 13000); assert.equal(G.vg(0).rest, true); assert.equal(G.at(0, 'BC').rest, true);
  assert.ok(!G.pending.options.some(o => o.iid === G.vg(0).iid));
});
test('replay of the answer log reproduces the same state', () => {
  const cfg = { seed: 77, players: [{ name: 'A', deck: VG.DECKS[A] }, { name: 'B', deck: VG.DECKS[T] }] };
  const G = new VG.Game(cfg).start(); for (let i = 0; i < 120 && G.pending; i++) G.answer(VG.bot(G));
  const R = VG.Game.replay(cfg, G.history);
  assert.deepEqual(R.snapshot(), G.snapshot());
});

console.log('\n' + passed + ' passed, ' + fails.length + ' failed' + (fails.length ? ': ' + fails.join('; ') : ''));
process.exit(fails.length ? 1 : 0);
