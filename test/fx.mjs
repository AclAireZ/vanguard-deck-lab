// Scenario tests for machine-read skills: small made-up cards are written in the card-text grammar, compiled, put on the table and checked for the right behaviour.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js'; import '../src/bot.js';
import { compileCard } from '../tools/skillc.mjs';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')));
const races = new Set(['human', 'dragon', 'flame dragon', 'sylph']);
let seq = 0;
function card(o, text) {
  const no = 'T/' + (++seq); const rec = { effect: text, type: o.type === 'order' ? 'Normal Order' : 'Normal Unit', name: o.name || 'Test ' + seq };
  const res = compileCard(rec, races); if (res.fail) throw new Error('does not compile: ' + JSON.stringify(res.fail));
  const d = Object.assign({ no, name: rec.name, type: 'unit', nation: 'Dragon Empire', race: 'Human', grade: 1, power: 8000, shield: 5000, crit: 1, boost: true, intercept: false, drive: 1, text: [], abilities: [], auto: true }, o);
  if (d.type === 'order') { d.orderKind = d.orderKind || 'normal'; d.power = null; d.shield = null; }
  VG.fx.apply(d, res.ast); VG.CARDS[no] = d; return no;
}
const PLAIN = card({ name: 'Plain One', grade: 1, power: 8000 }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');
const PLAIN2 = card({ name: 'Plain Two', grade: 2, power: 10000, boost: false, intercept: true }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');
const G3 = card({ name: 'Big Three', grade: 3, power: 13000, boost: false, drive: 2, shield: null }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');

let passed = 0; const fails = [];
function test(name, fn) { try { fn(); passed++; if (!process.env.QUIET) console.log('  ok  ' + name); } catch (e) { fails.push(name); console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 5).map(l => l.slice(0, 300)).join('\n       ')); } }
const D = VG.DECKS.TD01;
/* a game at player 0's main phase on turn `turn` (1 or 3), both vanguards grade 3 */
function mk(turn = 3, seed = 5) {
  const G = new VG.Game({ seed, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }).start();
  G.answer([]); G.answer([]);
  for (const p of [0, 1]) { const v = sp(G, p, G3, 'new'); const old = G.vg(p); G.move(old.iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true }); for (const c of G.players[p].ride.slice()) if (G.def(G.cards[c]).type === 'crest') G.move(c, 'crest', { silent: true }); }
  run(G, d => (d.kind === 'ride' ? pick(d, o => o.a === 'skip') : d.kind === 'main' ? (G.active === 0 && G.turnNo >= turn ? undefined : pick(d, o => o.a === 'next')) : d.kind === 'attack' ? pick(d, o => o.a === 'end') : null));
  return G;
}
function sp(G, p, no, zone, pos, o) { const c = G.newCard(no, p, zone === 'RC' || zone === 'VC' ? 'new' : zone); if (zone === 'RC' || zone === 'VC') G.move(c.iid, zone, Object.assign({ pos, silent: true }, o || {})); return c.iid; }
function dmg(G, p, n) { for (let k = 0; k < n; k++) { const i = G.players[p].deck.find(x => !G.def(G.cards[x]).trigger); G.move(i, 'damage', { silent: true }); } }
function soul(G, p, n) { for (let k = 0; k < n; k++) { const i = G.players[p].deck.find(x => !G.def(G.cards[x]).trigger); G.move(i, 'soul', { silent: true }); } }
function topdeck(G, p, ...nos) { for (const no of nos.reverse()) { const c = G.newCard(no, p, 'new'); G.move(c.iid, 'deck', { silent: true }); } }
const pick = (d, f) => { const i = d.options.findIndex(f); if (i < 0) throw new Error('option not found in ' + d.kind + ' "' + (d.title || '') + '": ' + JSON.stringify(d.options).slice(0, 400)); return [i]; };
/* default answers: say yes, take as few cards as allowed (but at least one when possible), never guard */
function dflt(d) { if (d.kind === 'yesno' || d.kind === 'boost') return [0]; if (d.kind === 'guard') return []; const n = Math.max(d.min, Math.min(1, d.max)); return d.options.slice(0, n).map((_, i) => i); }
function run(G, policy, max = 600) { for (let n = 0; n < max && G.pending; n++) { const r = policy ? policy(G.pending, G) : null; if (r === undefined) return; G.answer(r === null ? dflt(G.pending) : r); } }
/* answer until the game waits in a main phase / attack choice again */
const settle = (G, policy) => run(G, (d, g) => { const r = policy ? policy(d, g) : null; if (r !== null && r !== undefined) return r; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
const main = (G, f, policy) => { settleMain(G); G.answer(pick(G.pending, f)); settle(G, policy); };
const toBattle = G => { settleMain(G); G.answer(pick(G.pending, o => o.a === 'next')); settle(G); assert.equal(G.pending.kind, 'attack'); G.pending.options = G.attackOptions(G.pending.player); };
const attack = (G, a, t, policy) => { G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === t)); settle(G, policy); };
const pw = (G, i) => G.stat(G.cards[i]).power;
const P = (G, p) => G.players[p];

console.log('placement, costs, draws');
test('on-place: counter-blast cost is optional, draw + soul-charge + counter-charge resolve in order', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC), [COST][Counter-Blast 1], draw two cards, [Soul-Charge 1], and [Counter-Charge 1].');
  const G = mk(); dmg(G, 0, 2); const c = sp(G, 0, no, 'hand'); const h = P(G, 0).hand.length, s = P(G, 0).soul.length;
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL');
  assert.equal(P(G, 0).hand.length, h - 1 + 2); assert.equal(P(G, 0).soul.length, s + 1);
  assert.equal(P(G, 0).damage.filter(i => G.cards[i].faceup).length, 2, 'CB1 then CC1');
  const G2 = mk(); dmg(G2, 0, 2); const c2 = sp(G2, 0, no, 'hand'); const h2 = P(G2, 0).hand.length;
  main(G2, o => o.a === 'call' && o.iid === c2 && o.circle === 'FL', d => (d.kind === 'yesno' ? [1] : null));
  assert.equal(P(G2, 0).hand.length, h2 - 1, 'declining the cost does nothing');
});
test('on-place "from hand" does not fire when called from drop; condition on vanguard name', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC) from hand, if you have a vanguard with "Big" in its card name, draw a card.');
  const caller = card({}, '[ACT](RC)[1/turn]:Choose a grade 1 card from your drop, and call it to (RC).');
  const G = mk(); const a = sp(G, 0, no, 'hand'); const b = sp(G, 0, no, 'drop'); const k = sp(G, 0, caller, 'RC', 'BL'); const h = P(G, 0).hand.length;
  main(G, o => o.a === 'call' && o.iid === a && o.circle === 'FL'); assert.equal(P(G, 0).hand.length, h, 'called from hand: -1 +1');
  main(G, o => o.a === 'act' && o.iid === k, d => (d.kind === 'cards' ? pick(d, o => o.iid === b) : d.kind === 'circle' ? pick(d, o => o.circle === 'FR') : null));
  assert.equal(G.cards[b].zone, 'RC'); assert.equal(P(G, 0).hand.length, h, 'no draw when called from drop');
});
test('discard cost with a filter, self-to-soul cost, once per turn', () => {
  const no = card({}, '[ACT](RC)[1/turn]:[COST][Discard a grade 3 card from your hand], draw a card.');
  const s2 = card({}, '[ACT](RC):[COST][Put this unit into your soul], [Counter-Charge 1].');
  const G = mk(); const u = sp(G, 0, no, 'RC', 'FL'); const v = sp(G, 0, s2, 'RC', 'FR'); P(G, 0).hand.slice().forEach(i => G.move(i, 'deck', { silent: true }));
  sp(G, 0, PLAIN, 'hand'); assert.ok(!G.pending.options.some(o => o.a === 'act' && o.iid === u), 'no grade 3 in hand: cannot pay');
  const g3 = sp(G, 0, G3, 'hand'); settleMain(G);
  main(G, o => o.a === 'act' && o.iid === u); assert.equal(G.cards[g3].zone, 'drop'); assert.equal(P(G, 0).hand.length, 2);
  assert.ok(!G.pending.options.some(o => o.a === 'act' && o.iid === u), 'once per turn');
  main(G, o => o.a === 'act' && o.iid === v); assert.equal(G.cards[v].zone, 'soul');
});
function settleMain(G) { // refresh the pending main-phase options after the table was edited by hand
  const d = G.pending; if (d.kind !== 'main') return; d.options = G.mainOptions(d.player);
}

console.log('choosing units, buffs, durations');
test('choose your unit: +power until end of turn expires; until end of battle expires after the battle', () => {
  const t = card({}, '[ACT](RC)[1/turn]:Choose one of your other units, and it gets [Power]+5000 until end of turn.');
  const b = card({ grade: 2, power: 10000, boost: false }, '[AUTO](RC):When this unit attacks a vanguard, this unit gets [Power]+10000/[Critical]+1 until end of that battle.');
  const G = mk(); const a = sp(G, 0, t, 'RC', 'BL'); const f = sp(G, 0, b, 'RC', 'FL');
  main(G, o => o.a === 'act' && o.iid === a, d => (d.kind === 'cards' ? pick(d, o => o.iid === f) : null));
  assert.equal(pw(G, f), 15000);
  toBattle(G); let seen = 0;
  attack(G, f, G.vg(1).iid, d => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seen = pw(G, f); assert.equal(G.stat(G.cards[f]).crit, 2); } return null; });
  assert.equal(seen, 25000, 'battle buff applied during the battle'); assert.equal(pw(G, f), 15000, 'battle buff gone, turn buff stays');
  run(G, d => (d.kind === 'attack' ? pick(d, o => o.a === 'end') : d.kind === 'ride' ? undefined : null));
  assert.equal(pw(G, f), 10000, 'turn buff expired');
});
test('retire an opponent rear-guard; resist blocks choosing; "up to" may pick none', () => {
  const r = card({}, '[AUTO]:When this unit is placed on (RC), choose one of your opponent\'s rear-guards, and retire it.');
  const res = card({ name: 'Slippery' }, '[CONT](RC):This unit cannot be chosen by your opponent\'s card effects.');
  const G = mk(); const x = sp(G, 1, res, 'RC', 'FL'); const y = sp(G, 1, PLAIN, 'RC', 'FR'); const c = sp(G, 0, r, 'hand');
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL', d => { if (d.kind === 'cards') assert.ok(!d.options.some(o => o.iid === x), 'resist unit is not offered'); return null; });
  assert.equal(G.cards[y].zone, 'drop'); assert.equal(G.cards[x].zone, 'RC');
});
test('"for each" scaling and "instead of" top-up', () => {
  const no = card({ grade: 2, power: 10000 }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+2000 until end of that battle for each of your other rear-guards. If your damage zone has three or more cards, it gets [Power]+5000 instead of +2000.');
  const G = mk(); const u = sp(G, 0, no, 'RC', 'FL'); sp(G, 0, PLAIN, 'RC', 'BR'); sp(G, 0, PLAIN, 'RC', 'FR'); toBattle(G); let seen = 0;
  attack(G, u, G.vg(1).iid, d => { if (d.kind === 'guard') seen = pw(G, u); return null; }); assert.equal(seen, 14000);
  const G2 = mk(); dmg(G2, 0, 3); const u2 = sp(G2, 0, no, 'RC', 'FL'); sp(G2, 0, PLAIN, 'RC', 'BR'); sp(G2, 0, PLAIN, 'RC', 'FR'); toBattle(G2);
  attack(G2, u2, G2.vg(1).iid, d => { if (d.kind === 'guard') seen = pw(G2, u2); return null; }); assert.equal(seen, 20000);
});
test('continuous: own-turn condition, aura on a filtered group, column aura mirrors across the table', () => {
  const c1 = card({ grade: 2, power: 10000 }, '[CONT](RC):During your turn, if you have three or more rear-guards, this unit gets [Power]+5000.');
  const c2 = card({}, '[CONT](RC):All of your grade 2 rear-guards get [Power]+3000.');
  const c3 = card({}, '[CONT](RC):All of your opponent\'s rear-guards in the same column as this unit get [Power]-2000.');
  const G = mk(); const a = sp(G, 0, c1, 'RC', 'FL'); assert.equal(pw(G, a), 10000);
  const b = sp(G, 0, c2, 'RC', 'BL'); sp(G, 0, PLAIN, 'RC', 'FR'); assert.equal(pw(G, a), 18000, '+5000 own turn with 3 rear-guards, +3000 aura');
  assert.equal(pw(G, b), 8000, 'aura only reaches grade 2');
  sp(G, 0, c3, 'RC', 'BR'); const oppLeft = sp(G, 1, PLAIN, 'RC', 'FL'); const oppRight = sp(G, 1, PLAIN, 'RC', 'FR');
  assert.equal(pw(G, oppLeft), 6000, 'my right column faces the opponent\'s left column'); assert.equal(pw(G, oppRight), 8000);
});

console.log('deck handling');
test('look at top cards, take one that matches, rest to the bottom', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC), look at the top three cards of your deck, choose up to one grade 3 card from among them, reveal it and put it into your hand, and put the rest on the bottom of your deck in any order.');
  const G = mk(); topdeck(G, 0, PLAIN, G3, PLAIN2); const c = sp(G, 0, no, 'hand'); const n = P(G, 0).deck.length; const h = P(G, 0).hand.length;
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL');
  assert.equal(P(G, 0).hand.length, h); assert.ok(P(G, 0).hand.some(i => G.cards[i].no === G3)); assert.equal(P(G, 0).deck.length, n - 1);
  assert.deepEqual(P(G, 0).deck.slice(-2).map(i => G.cards[i].no).sort(), [PLAIN, PLAIN2].sort(), 'the other two went to the bottom');
});
test('search deck by name, call it, shuffle; conditional follow-up on success', () => {
  const no = card({}, '[ACT](RC)[1/turn]:Search your deck for up to one "Plain Two", call it to (RC), and shuffle your deck. If you called a card, draw a card.');
  const G = mk(); const u = sp(G, 0, no, 'RC', 'BL'); topdeck(G, 0, PLAIN2); const h = P(G, 0).hand.length;
  main(G, o => o.a === 'act' && o.iid === u, d => (d.kind === 'circle' ? pick(d, o => o.circle === 'FL') : null));
  assert.equal(G.at(0, 'FL') && G.at(0, 'FL').no, PLAIN2); assert.equal(P(G, 0).hand.length, h + 1);
  const G2 = mk(); const u2 = sp(G2, 0, no, 'RC', 'BL'); const h2 = P(G2, 0).hand.length;
  main(G2, o => o.a === 'act' && o.iid === u2, d => (d.kind === 'cards' ? [] : null)); assert.equal(P(G2, 0).hand.length, h2, 'nothing called: no draw');
});
test('"put it on top of deck or into soul" asks the player; "if you put it into soul" follows the choice', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC), look at the top card of your deck, and put it on the top of your deck or into your soul. If you put it into your soul, draw a card.');
  const G = mk(); topdeck(G, 0, PLAIN2, PLAIN); const c = sp(G, 0, no, 'hand'); const s = P(G, 0).soul.length, h = P(G, 0).hand.length;
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL', d => (d.kind === 'option' ? [1] : null));
  assert.equal(P(G, 0).soul.length, s + 1); assert.equal(P(G, 0).hand.length, h, 'called (-1) then drew (+1)');
  const G2 = mk(); topdeck(G2, 0, PLAIN2); const c2 = sp(G2, 0, no, 'hand'); const h2 = P(G2, 0).hand.length;
  main(G2, o => o.a === 'call' && o.iid === c2 && o.circle === 'FL', d => (d.kind === 'option' ? [0] : null));
  assert.equal(G2.cards[P(G2, 0).deck[0]].no, PLAIN2); assert.equal(P(G2, 0).hand.length, h2 - 1);
});
test('mid-text cost: refusing it stops the rest of the effect', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC), [Soul-Charge 1]. Then, [COST][Counter-Blast 1], and draw a card.');
  const G = mk(); dmg(G, 0, 1); const c = sp(G, 0, no, 'hand'); const s = P(G, 0).soul.length, h = P(G, 0).hand.length;
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL', d => (d.kind === 'yesno' ? [1] : null));
  assert.equal(P(G, 0).soul.length, s + 1); assert.equal(P(G, 0).hand.length, h - 1);
});

console.log('battle triggers');
test('attack hit trigger, end-of-battle restand with a cost, boost trigger', () => {
  const hit = card({ grade: 2, power: 30000, boost: false }, '[AUTO](RC):When this unit\'s attack hits a vanguard, draw a card.');
  const re = card({ grade: 2, power: 10000, boost: false }, '[AUTO](RC)[1/turn]:At the end of the battle this unit attacked, [COST][Counter-Blast 1], [Stand] this unit, and it gets [Power]+5000 until end of turn.');
  const bo = card({}, '[AUTO](RC):When this unit boosts, the boosted unit gets [Power]+3000 until end of that battle.');
  const G = mk(); dmg(G, 0, 1); const a = sp(G, 0, hit, 'RC', 'FL'); const r = sp(G, 0, re, 'RC', 'FR'); const b = sp(G, 0, bo, 'RC', 'BR'); toBattle(G);
  const h = P(G, 0).hand.length; attack(G, a, G.vg(1).iid); assert.equal(P(G, 0).hand.length, h + 1, 'hit a vanguard: draw');
  let seen = 0; attack(G, r, G.vg(1).iid, d => { if (d.kind === 'guard') seen = pw(G, r); return null; });
  assert.equal(seen, 13000, 'boosted unit +3000 from the booster\'s skill'); assert.equal(G.cards[r].rest, false, 'stood again'); assert.equal(pw(G, r), 15000);
  attack(G, r, G.vg(1).iid, d => (d.kind === 'boost' ? [1] : null)); assert.equal(G.cards[r].rest, true, 'once per turn');
});
test('"when your vanguard attacks" on a rear-guard; "when your other rear-guard is placed"', () => {
  const sup = card({}, '[AUTO](RC):When your vanguard attacks, [COST][Put this unit into your soul], choose one of your vanguards, and it gets [Power]+10000 until end of that battle.');
  const wat = card({}, '[AUTO](RC):When your other rear-guard is placed on (RC), this unit gets [Power]+2000 until end of turn.');
  const G = mk(); const s = sp(G, 0, sup, 'RC', 'BR'); const w = sp(G, 0, wat, 'RC', 'BL'); const c = sp(G, 0, PLAIN, 'hand'); settleMain(G);
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL'); assert.equal(pw(G, w), 10000);
  toBattle(G); let seen = 0; attack(G, G.vg(0).iid, G.vg(1).iid, d => { if (d.kind === 'guard') seen = pw(G, G.vg(0).iid); return null; });
  assert.equal(seen, 23000); assert.equal(G.cards[s].zone, 'soul');
});
test('guardian: on-GC shield bonus with a condition; intercept trigger', () => {
  const g = card({ grade: 0, power: 5000, shield: 15000 }, '[AUTO]:When this unit is put on (GC), if you have three or more rear-guards, this unit gets [Shield]+10000 until end of that battle.');
  const G = mk(); const c = sp(G, 1, g, 'hand'); sp(G, 1, PLAIN, 'RC', 'FL'); sp(G, 1, PLAIN, 'RC', 'FR'); sp(G, 1, PLAIN, 'RC', 'BL'); const a = sp(G, 0, PLAIN2, 'RC', 'FL'); toBattle(G);
  let sh = 0; attack(G, a, G.vg(1).iid, d => { if (d.kind === 'guard') { return pick(d, o => o.a === 'guard' && o.iid === c); } if (d.kind === 'yesno' || d.kind === 'cards') sh = Math.max(sh, G.cards[c].zone === 'GC' ? G.stat(G.cards[c]).shield : 0); return null; });
  assert.equal(G.cards[c].zone, 'drop'); assert.equal(P(G, 1).damage.length, 0, 'guard held (10000 vs 13000+25000)');
});
test('retired-by-opponent trigger; "cannot be retired by your opponent\'s card effects"', () => {
  const av = card({}, '[AUTO]:When this unit is retired from (RC) by your opponent\'s card\'s ability, draw a card.');
  const st = card({ name: 'Sturdy' }, '[CONT](RC):This unit cannot be retired by your opponent\'s card effects.');
  const wipe = card({}, '[ACT](RC)[1/turn]:Retire all of your opponent\'s front row rear-guards.');
  const G = mk(); const x = sp(G, 1, av, 'RC', 'FL'); const y = sp(G, 1, st, 'RC', 'FR'); const z = sp(G, 1, PLAIN, 'RC', 'BL'); const w = sp(G, 0, wipe, 'RC', 'BL'); const h = P(G, 1).hand.length;
  main(G, o => o.a === 'act' && o.iid === w);
  assert.equal(G.cards[x].zone, 'drop'); assert.equal(G.cards[y].zone, 'RC', 'protected'); assert.equal(G.cards[z].zone, 'RC', 'back row untouched'); assert.equal(P(G, 1).hand.length, h + 1);
});

console.log('orders, modal effects, granted abilities, tokens');
test('normal order: play condition, cost, effect; one order per turn', () => {
  const o1 = card({ type: 'order', grade: 1 }, 'Play this with [COST][Soul-Blast 1]!\nChoose one of your units, and it gets [Power]+10000 until end of turn.');
  const G = mk(); const a = sp(G, 0, o1, 'hand'); const b = sp(G, 0, o1, 'hand'); P(G, 0).soul.slice().forEach(i => G.move(i, 'drop', { silent: true })); settleMain(G);
  assert.ok(!G.pending.options.some(o => o.a === 'order'), 'no soul: cannot pay');
  soul(G, 0, 2); settleMain(G); main(G, o => o.a === 'order' && o.iid === a, d => (d.kind === 'cards' && d.zone === 'field' ? pick(d, o => o.iid === G.vg(0).iid) : null));
  assert.equal(pw(G, G.vg(0).iid), 23000); assert.equal(G.cards[a].zone, 'drop'); assert.ok(!G.pending.options.some(o => o.a === 'order' && o.iid === b), 'second order blocked');
});
test('blitz order is offered in the guard step and buffs the attacked unit', () => {
  const bl = card({ type: 'order', orderKind: 'blitz', grade: 1 }, 'Choose one of your units being attacked, and it gets [Power]+15000 until end of that battle.');
  const G = mk(); const c = sp(G, 1, bl, 'hand'); const a = sp(G, 0, PLAIN2, 'RC', 'FL'); toBattle(G);
  attack(G, a, G.vg(1).iid, d => (d.kind === 'guard' ? pick(d, o => o.a === 'blitz' && o.iid === c) : null));
  assert.equal(G.cards[c].zone, 'drop'); assert.equal(P(G, 1).damage.length, 0, '10000 vs 13000+15000 does not hit');
});
test('"perform one of the following" offers only usable options; "perform all" runs every line', () => {
  const m = card({}, '[ACT](RC)[1/turn]:Perform one of the following.\n・[COST][Counter-Blast 1], draw two cards.\n・This unit gets [Power]+5000 until end of turn.');
  const all = card({}, '[ACT](RC)[1/turn]:Perform all of the following.\n・Draw a card.\n・This unit gets [Power]+5000 until end of turn.');
  const G = mk(); const u = sp(G, 0, m, 'RC', 'FL'); const v = sp(G, 0, all, 'RC', 'FR'); const h = P(G, 0).hand.length;
  main(G, o => o.a === 'act' && o.iid === u, d => { if (d.kind === 'option') { assert.equal(d.options.length, 1, 'no face-up damage: only the free option'); } return null; });
  assert.equal(pw(G, u), 13000); main(G, o => o.a === 'act' && o.iid === v); assert.equal(pw(G, v), 13000); assert.equal(P(G, 0).hand.length, h + 1);
});
test('granted ability works for the turn and then disappears', () => {
  const g = card({}, '[ACT](RC)[1/turn]:Choose one of your other rear-guards, and it gets "[AUTO](RC):When this unit attacks, draw a card." until end of turn.');
  const G = mk(); const u = sp(G, 0, g, 'RC', 'BL'); const t = sp(G, 0, PLAIN2, 'RC', 'FL');
  main(G, o => o.a === 'act' && o.iid === u, d => (d.kind === 'cards' ? pick(d, o => o.iid === t) : null));
  toBattle(G); const h = P(G, 0).hand.length; attack(G, t, G.vg(1).iid, d => (d.kind === 'boost' ? [1] : null)); assert.equal(P(G, 0).hand.length, h + 1);
  assert.equal(G.cards[t].granted.length, 1); run(G, d => (d.kind === 'attack' ? pick(d, o => o.a === 'end') : d.kind === 'ride' ? undefined : null)); assert.equal(G.cards[t].granted.length, 0);
});
test('tokens: call Plant tokens to open circles; token leaves the game when retired', () => {
  const t = card({}, '[AUTO]:When this unit is placed on (RC), call up to two Plant tokens to (RC).');
  const G = mk(); const c = sp(G, 0, t, 'hand');
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL', d => (d.kind === 'circle' ? pick(d, o => !G.at(0, o.circle)) : null));
  const toks = G.rcs(0).filter(x => x.token); assert.equal(toks.length, 2); assert.equal(pw(G, toks[0].iid), 5000);
  G.retire(toks[0].iid, 'effect'); assert.equal(G.cards[toks[0].iid].zone, 'gone');
});
test('delayed effect: "at the end of that turn, retire it"', () => {
  const no = card({}, '[ACT](RC)[1/turn]:Choose a card from your drop, call it to (RC), and at the end of that turn, retire it.');
  const G = mk(); const u = sp(G, 0, no, 'RC', 'BL'); const d0 = sp(G, 0, PLAIN2, 'drop');
  main(G, o => o.a === 'act' && o.iid === u, d => (d.kind === 'cards' ? pick(d, o => o.iid === d0) : d.kind === 'circle' ? pick(d, o => o.circle === 'FL') : null));
  assert.equal(G.cards[d0].zone, 'RC'); toBattle(G); run(G, d => (d.kind === 'attack' ? pick(d, o => o.a === 'end') : d.kind === 'ride' ? undefined : null));
  assert.equal(G.cards[d0].zone, 'drop');
});
test('ride triggers: "placed by riding from <name>" and "rode upon by a grade 3"', () => {
  const lo = card({ name: 'Low Step', grade: 2, power: 10000 }, '[AUTO]:When this unit is rode upon by a grade 3, draw a card.');
  const hi = card({ name: 'High Step', grade: 3, power: 13000, shield: null }, '[AUTO]:When this unit is placed on (VC) by riding from "Low Step", [Soul-Charge 2].');
  const G = new VG.Game({ seed: 3, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }).start(); G.answer([]); G.answer([]);
  const old = G.vg(0); const l = sp(G, 0, lo, 'new'); G.move(old.iid, 'soul', { silent: true }); G.move(l, 'VC', { pos: 'V', silent: true }); const h3 = sp(G, 0, hi, 'hand');
  G.pending.options = [{ a: 'ride', iid: h3 }, { a: 'skip' }]; const h = P(G, 0).hand.length, s = P(G, 0).soul.length;
  G.answer([0]); settle(G); assert.equal(G.vg(0).iid, h3); assert.equal(P(G, 0).soul.length, s + 1 + 2); assert.equal(P(G, 0).hand.length, h - 1 + 1);
});
test('opponent-side effects: opponent discards; "your opponent cannot intercept" for the battle', () => {
  const od = card({}, '[AUTO]:When this unit is placed on (RC), your opponent chooses a card from their hand, and discards it.');
  const ni = card({ grade: 2, power: 10000, boost: false }, '[AUTO](RC):When this unit attacks, your opponent cannot intercept until end of that battle.');
  const G = mk(); const c = sp(G, 0, od, 'hand'); const a = sp(G, 0, ni, 'RC', 'FR'); const i2 = sp(G, 1, PLAIN2, 'RC', 'FL'); const h = P(G, 1).hand.length; settleMain(G);
  main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL'); assert.equal(P(G, 1).hand.length, h - 1);
  toBattle(G); let offered = null; attack(G, a, G.vg(1).iid, d => { if (d.kind === 'guard') offered = d.options.some(o => o.a === 'intercept'); return null; }); assert.equal(offered, false);
});
test('things that happened this turn: "if your opponent\'s rear-guard was retired this turn"', () => {
  const r = card({}, '[ACT](RC)[1/turn]:Choose one of your opponent\'s rear-guards, and retire it.');
  const c = card({ grade: 2, power: 10000 }, '[CONT](RC):If your opponent\'s rear-guard was retired by your card\'s ability this turn, this unit gets [Power]+5000.');
  const G = mk(); const a = sp(G, 0, r, 'RC', 'BL'); const b = sp(G, 0, c, 'RC', 'FL'); sp(G, 1, PLAIN, 'RC', 'FL'); assert.equal(pw(G, b), 10000);
  main(G, o => o.a === 'act' && o.iid === a); assert.equal(pw(G, b), 15000);
});
test('guard restriction: "they must call two or more at the same time" blocks a single card from hand', () => {
  const g2 = card({ grade: 2, power: 10000, boost: false }, '[AUTO](RC):When this unit attacks, until end of that battle, when your opponent would call cards from their hand to (GC), they must call two or more at the same time.');
  const G = mk(); const a = sp(G, 0, g2, 'RC', 'FL'); P(G, 1).hand.slice().forEach(i => G.move(i, 'deck', { silent: true })); const h1 = sp(G, 1, PLAIN, 'hand'); const h2 = sp(G, 1, PLAIN, 'hand'); toBattle(G);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  const d = G.pending; assert.equal(d.kind, 'guard'); assert.equal(d.handMin, 2);
  const i1 = d.options.findIndex(o => o.iid === h1), i2 = d.options.findIndex(o => o.iid === h2);
  assert.ok(G.validate([i1]), 'one card alone is refused'); assert.equal(G.validate([i1, i2]), null); assert.equal(G.validate([]), null);
  assert.deepEqual(VG.bot(G).filter(i => d.options[i].a === 'guard').length === 1, false, 'the bot respects it');
});
test('"different card names": picks cannot repeat a name, and counting ignores duplicates', () => {
  const pk = card({}, '[ACT](RC)[1/turn]:Choose up to two cards with "Plain" in their different card names from your drop, and put them into your hand.');
  const ct = card({ grade: 2, power: 10000 }, '[CONT](RC):If you have three or more units with "Plain" in their different card names, this unit gets [Power]+5000.');
  const G = mk(); const u = sp(G, 0, pk, 'RC', 'BL'); const d1 = sp(G, 0, PLAIN, 'drop'); const d2 = sp(G, 0, PLAIN, 'drop'); const d3 = sp(G, 0, PLAIN2, 'drop'); const h = P(G, 0).hand.length;
  let asked = 0; main(G, o => o.a === 'act' && o.iid === u, d => { if (d.kind === 'cards') { asked++; if (asked === 2) assert.ok(!d.options.some(o => o.iid === d2), 'second copy of the same name is not offered'); return pick(d, o => o.iid === (asked === 1 ? d1 : d3)); } return null; });
  assert.equal(P(G, 0).hand.length, h + 2); assert.equal(G.cards[d2].zone, 'drop');
  const c = sp(G, 0, ct, 'RC', 'FL'); sp(G, 0, PLAIN, 'RC', 'FR'); sp(G, 0, PLAIN, 'RC', 'BR'); assert.equal(pw(G, c), 10000, 'two copies of one name count once');
  sp(G, 0, PLAIN2, 'RC', 'BC'); assert.equal(pw(G, c), 10000, 'still only two different names'); const big = card({ name: 'Plain Three' }, '[CONT](RC):This unit cannot attack.'); G.retire(G.at(0, 'BR').iid, 'effect'); sp(G, 0, big, 'RC', 'BR'); assert.equal(pw(G, c), 15000);
});
test('order that can be played from the drop zone; column-relative choice', () => {
  const od = card({ type: 'order', grade: 1 }, 'This card can be played from your drop, and play this with [COST][Counter-Blast 1]!\nDraw a card, and remove this card.');
  const col = card({}, '[ACT](RC)[1/turn]:Choose one of your rear-guards, choose one of your opponent\'s rear-guards in the same column as that unit, and retire it.');
  const G = mk(); dmg(G, 0, 1); const o = sp(G, 0, od, 'drop'); const h = P(G, 0).hand.length;
  main(G, x => x.a === 'order' && x.iid === o); assert.equal(P(G, 0).hand.length, h + 1); assert.equal(G.cards[o].zone, 'removed');
  const u = sp(G, 0, col, 'RC', 'BL'); const mine = sp(G, 0, PLAIN, 'RC', 'FR'); const facing = sp(G, 1, PLAIN, 'RC', 'FL'); const other = sp(G, 1, PLAIN, 'RC', 'FR');
  main(G, x => x.a === 'act' && x.iid === u, d => (d.kind === 'cards' && d.options.some(x => x.iid === mine) ? pick(d, x => x.iid === mine) : null));
  assert.equal(G.cards[facing].zone, 'drop', 'only the unit facing the chosen column could be picked'); assert.equal(G.cards[other].zone, 'RC');
});
test('continuous ability with several clauses and "it also gets" keeps the first condition', () => {
  const c = card({ grade: 2, power: 10000, boost: false }, '[CONT](RC):During your turn, this unit gets [Power]+5000, and can attack from the back row. If your damage zone has three or more cards, it also gets [Critical]+1.');
  const k = card({}, '[CONT](RC):This unit cannot be chosen by your opponent\'s card effects, and gets [Power]+3000.');
  const G = mk(); const u = sp(G, 0, c, 'RC', 'BL'); const v = sp(G, 0, k, 'RC', 'FR');
  assert.equal(pw(G, u), 15000); assert.ok(G.stat(G.cards[u]).backAtk); assert.equal(G.stat(G.cards[u]).crit, 1); dmg(G, 0, 3); assert.equal(G.stat(G.cards[u]).crit, 2);
  assert.equal(pw(G, v), 11000); assert.ok(G.stat(G.cards[v]).resist);
  toBattle(G); assert.ok(G.pending.options.some(o => o.a === 'attack' && o.iid === u), 'attacks from the back row');
});
test('player state ("Final Rush"): entered by a skill, seen by conditions and "when you …" triggers, gone next turn', () => {
  const v = card({ name: 'Rush Boss', grade: 3, power: 13000, shield: null, boost: false }, '[ACT](VC)[1/turn]:Until end of turn, you "Final Rush".');
  const r = card({ grade: 1 }, '[CONT](RC):If you are in "Final Rush", this unit gets [Power]+5000.\n[AUTO](RC):When you "Final Rush", draw a card.');
  const G = mk(); const old = G.vg(0); const b = sp(G, 0, v, 'new'); G.move(old.iid, 'soul', { silent: true }); G.move(b, 'VC', { pos: 'V', silent: true }); const u = sp(G, 0, r, 'RC', 'BL'); const h = P(G, 0).hand.length;
  assert.equal(pw(G, u), 8000); main(G, o => o.a === 'act' && o.iid === b); assert.equal(pw(G, u), 13000); assert.equal(P(G, 0).hand.length, h + 1);
  toBattle(G); run(G, d => (d.kind === 'attack' ? pick(d, o => o.a === 'end') : d.kind === 'ride' ? undefined : null)); assert.equal(pw(G, u), 8000, 'state ended with the turn');
});
test('World: one World card in the order zone is Dark Night, two are Abyssal Dark Night, a non-World card breaks it', () => {
  const W = 'Play this with [COST][Soul-Blast 1]!\n[CONT]Order Zone:If your order zone only has World cards, the following effects are active according to the number of cards in your order zone.\n・1 card - Your World becomes Dark Night.\n・2 or more cards - Your World becomes Abyssal Dark Night.';
  const w = card({ type: 'order', orderKind: 'set', grade: 1, name: 'Test Night' }, W); const plainSet = card({ type: 'order', orderKind: 'set', grade: 1, name: 'Other Set' }, '[AUTO]:When this card is put into the order zone, draw a card.');
  const c = card({ grade: 2, power: 10000 }, '[CONT](RC):If your World is Dark Night or Abyssal Dark Night, this unit gets [Power]+2000.\n[CONT](RC):If your World is Abyssal Dark Night, this unit gets [Power]+5000.');
  const G = mk(); const u = sp(G, 0, c, 'RC', 'FL'); assert.equal(pw(G, u), 10000);
  sp(G, 0, w, 'order'); assert.equal(pw(G, u), 12000); sp(G, 0, w, 'order'); assert.equal(pw(G, u), 17000); sp(G, 0, plainSet, 'order'); assert.equal(pw(G, u), 10000);
});
console.log('ride / call restrictions, else-branches, new conditions');
test('card restrictions: cannot be ridden, back row centre only, ride only from a named grade 3', () => {
  const bc = card({ grade: 1 }, '[CONT]:This card cannot be ridden, and can only be called to the back row center (RC).');
  const nn = card({ grade: 1 }, '[CONT]:This card cannot be ridden, and cannot be normal called to (RC) from hand.');
  const rf = card({ name: 'Masked Three', grade: 3, power: 13000, shield: null }, '[CONT]:This card can only be ridden from a grade 3 with "Big" in its card name.\n[AUTO](VC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');
  const G = mk(); const a = sp(G, 0, bc, 'hand'); const b = sp(G, 0, nn, 'hand'); const c = sp(G, 0, rf, 'hand'); settleMain(G);
  const calls = G.pending.options.filter(o => o.a === 'call' && o.iid === a).map(o => o.circle); assert.deepEqual(calls, ['BC']);
  assert.ok(!G.pending.options.some(o => o.a === 'call' && o.iid === b), 'cannot be normal called');
  assert.equal(G.rideOk(G.cards[a], G.vg(0)), false); assert.equal(G.rideOk(G.cards[c], G.vg(0)), true, 'vanguard is "Big Three"');
  const other = sp(G, 0, PLAIN2, 'new'); assert.equal(G.def(G.cards[c]).canRideOn(G, G.cards[other]), false);
  assert.equal(G.superRide(0, a, true), false, 'not by an effect either');
});
test('"A if it is X, and B if it is not": only one branch runs', () => {
  const no = card({}, '[AUTO]:When this unit is placed on (RC), reveal the top card of your deck, call it to (RC) if it is a unit card, and put it into your hand if it is not.');
  const ord = card({ type: 'order', grade: 1, name: 'Plain Order' }, 'Draw a card.');
  const G = mk(); topdeck(G, 0, ord); const top = P(G, 0).deck[0]; const c = sp(G, 0, no, 'hand'); main(G, o => o.a === 'call' && o.iid === c && o.circle === 'FL');
  assert.equal(G.cards[top].zone, 'hand');
  const G2 = mk(); topdeck(G2, 0, PLAIN); const top2 = P(G2, 0).deck[0]; const c2 = sp(G2, 0, no, 'hand'); main(G2, o => o.a === 'call' && o.iid === c2 && o.circle === 'FL');
  assert.equal(G2.cards[top2].zone, 'RC');
});
test('"if you did not counter-charge this turn", cards with different grades in soul, cost paid from several zones', () => {
  const cc = card({}, '[AUTO]:When this unit is placed on (RC), if you did not [Counter-Charge] this turn, [Counter-Charge 1].');
  const dg = card({ grade: 2, power: 10000 }, '[CONT](RC):If your soul has two or more cards with different grades, this unit gets [Power]+5000.');
  const rm = card({}, '[ACT](RC)[1/turn]:[COST][Remove a card from your hand, soul, or drop], draw a card.');
  const G = mk(); dmg(G, 0, 3); for (const i of P(G, 0).damage) G.cards[i].faceup = false;
  const a = sp(G, 0, cc, 'hand'), b = sp(G, 0, cc, 'hand'); main(G, o => o.a === 'call' && o.iid === a && o.circle === 'FL'); main(G, o => o.a === 'call' && o.iid === b && o.circle === 'FR');
  assert.equal(P(G, 0).damage.filter(i => G.cards[i].faceup).length, 1, 'second one sees the counter-charge already done');
  const G2 = mk(); P(G2, 0).soul.slice().forEach(i => G2.move(i, 'drop', { silent: true })); const u = sp(G2, 0, dg, 'RC', 'FL'); assert.equal(pw(G2, u), 10000);
  G2.move(sp(G2, 0, PLAIN, 'new'), 'soul', { silent: true }); G2.move(sp(G2, 0, PLAIN, 'new'), 'soul', { silent: true }); assert.equal(pw(G2, u), 10000, 'same grade twice');
  G2.move(sp(G2, 0, PLAIN2, 'new'), 'soul', { silent: true }); assert.equal(pw(G2, u), 15000);
  const r = sp(G2, 0, rm, 'RC', 'BL'); const s0 = P(G2, 0).soul[0]; const h = P(G2, 0).hand.length;
  main(G2, o => o.a === 'act' && o.iid === r, d => (d.kind === 'cards' && d.options.some(x => x.iid === s0) ? pick(d, x => x.iid === s0) : null));
  assert.equal(G2.cards[s0].zone, 'removed'); assert.equal(P(G2, 0).hand.length, h + 1);
});
test('"you get <effect> until end of turn" also covers units placed afterwards; boosted-unit condition', () => {
  const o1 = card({ type: 'order', grade: 1 }, 'You get "All of your front row units get [Power] +5000." until end of turn.');
  const bs = card({}, '[CONT](RC):During the battle this unit boosted a grade 3, this unit gets [Power]+5000.');
  const G = mk(); const a = sp(G, 0, PLAIN2, 'RC', 'FL'); const o = sp(G, 0, o1, 'hand'); const late = sp(G, 0, PLAIN2, 'hand'); const back = sp(G, 0, PLAIN, 'RC', 'BL');
  main(G, x => x.a === 'order' && x.iid === o); assert.equal(pw(G, a), 15000); assert.equal(pw(G, back), 8000);
  main(G, x => x.a === 'call' && x.iid === late && x.circle === 'FR'); assert.equal(pw(G, late), 15000);
  const G2 = mk(); const b = sp(G2, 0, bs, 'RC', 'BC'); toBattle(G2);
  G2.answer(pick(G2.pending, x => x.a === 'attack' && x.iid === G2.vg(0).iid && x.target === G2.vg(1).iid)); run(G2, d => (d.kind === 'boost' ? [0] : d.kind === 'guard' ? undefined : null));
  assert.equal(G2.pending.kind, 'guard'); assert.equal(G2.battle.booster, b); assert.equal(pw(G2, b), 13000);
});
test('guardian that grows against critical gained from a skill but not from a trigger', () => {
  const g = card({ grade: 1, shield: 5000 }, '[AUTO]:When this unit is put on (GC), if the attacking unit\'s [Critical] is 2 or greater, and its [Critical] is increased by a non-trigger effect ability or its original [Critical] is 2 or greater, this unit gets [Shield]+15000 until end of that battle.');
  for (const how of ['skill', 'trigger', 'none']) {
    const G = mk(); const a = sp(G, 0, PLAIN2, 'RC', 'FL'); P(G, 1).hand.slice().forEach(i => G.move(i, 'deck', { silent: true })); const h = sp(G, 1, g, 'hand');
    G.addMod(a, { power: 10000 }, 'turn'); if (how === 'skill') G.addMod(a, { crit: 1 }, 'turn'); if (how === 'trigger') G.addMod(a, { crit: 1, trig: 1 }, 'turn');
    toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
    const before = P(G, 1).damage.length + P(G, 1).drop.length;
    G.answer(pick(G.pending, o => o.iid === h)); run(G, d => (d.kind === 'guard' ? [] : d.kind === 'attack' ? undefined : null));
    const took = P(G, 1).damage.length + P(G, 1).drop.length - before - 1;   // the guardian itself went to the drop zone
    assert.equal(took > 0, how !== 'skill', how + ': 20000 attack against 13000 + 5000 (+15000 only against skill-given critical)');
  }
});
/* a card of which only part is understood: the rest becomes half-automatic (timing and cost by the game, effect by hand) */
function cardPart(o, text) {
  const no = 'T/' + (++seq); const rec = { effect: text, type: o.type === 'order' ? 'Normal Order' : 'Normal Unit', name: o.name || 'Test ' + seq };
  const res = compileCard(rec, races); if (!res.part) throw new Error('expected a partly understood card: ' + JSON.stringify(res).slice(0, 300));
  const d = Object.assign({ no, name: rec.name, type: 'unit', nation: 'Dragon Empire', race: 'Human', grade: 1, power: 8000, shield: 5000, crit: 1, boost: true, intercept: false, drive: 1, text: [], abilities: [], auto: true }, o);
  if (d.type === 'order') { d.orderKind = d.orderKind || 'normal'; d.power = null; d.shield = null; }
  VG.fx.apply(d, res.part); VG.CARDS[no] = d; return { no, part: res.part };
}
test('half-automatic ability: the game asks at the right moment, takes the cost, then waits while the effect is done by hand', () => {
  const { no, part } = cardPart({ grade: 2, power: 10000, boost: false }, '[AUTO](RC):When this unit attacks, [COST][Counter-Blast 1], sing a song of victory at the top of your voice.');
  assert.equal(part.miss, 1); assert.equal(part.asst, 1); assert.equal(part.a[0].as, 1); assert.deepEqual(part.a[0].d, [['man']]);
  const G = mk(); const a = sp(G, 0, no, 'RC', 'FL'); dmg(G, 0, 2); toBattle(G); const h = P(G, 0).hand.length;
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === G.vg(1).iid));
  run(G, d => (d.kind === 'yesno' && d.iid === a ? undefined : null)); assert.equal(G.pending.kind, 'yesno'); assert.equal(G.pending.iid, a);
  G.answer([0]); assert.equal(G.pending.manstep, true); assert.equal(G.pending.man, true);
  assert.equal(P(G, 0).damage.filter(i => !G.cards[i].faceup).length, 1, 'the cost was taken by the game');
  G.answer([-1, VG.MAN.op.draw, 1]); assert.equal(G.pending.manstep, true, 'still waiting after a manual action'); assert.equal(P(G, 0).hand.length, h + 1);
  G.answer([0]); assert.ok(!G.pending.manstep); run(G, d => (d.kind === 'guard' ? undefined : null)); assert.equal(G.pending.kind, 'guard');
  // saying no leaves everything untouched; the bot never starts a half-automatic ability
  const G2 = mk(); const b = sp(G2, 0, no, 'RC', 'FL'); dmg(G2, 0, 2); toBattle(G2);
  G2.answer(pick(G2.pending, o => o.a === 'attack' && o.iid === b && o.target === G2.vg(1).iid)); run(G2, d => (d.kind === 'yesno' && d.iid === b ? undefined : null));
  assert.deepEqual(VG.bot(G2), [1]); G2.answer([1]); assert.ok(!G2.pending.manstep); assert.equal(P(G2, 0).damage.filter(i => !G2.cards[i].faceup).length, 0);
});
test('half-automatic order: it can be played (cost taken), its effect is done by hand; conditions the game cannot read are left to the player', () => {
  const { no, part } = cardPart({ type: 'order', grade: 1 }, 'Play this with [COST][Soul-Blast 1]!\nDance with every unit under the pale moonlight.');
  assert.equal(part.p.as, 1); assert.deepEqual(part.p.k, [['sb', 1]]);
  const G = mk(); soul(G, 0, 2); const o = sp(G, 0, no, 'hand'); const sl = P(G, 0).soul.length;
  settleMain(G); G.answer(pick(G.pending, x => x.a === 'order' && x.iid === o)); run(G, d => (d.manstep ? undefined : null));
  assert.equal(G.pending.manstep, true); assert.equal(P(G, 0).soul.length, sl - 1); G.answer([0]); assert.equal(G.pending.kind, 'main');
  const c = cardPart({ grade: 1 }, '[AUTO]:When this unit is placed on (RC), if the moon is full tonight, [COST][Soul-Blast 1], howl.');
  assert.equal(c.part.a[0].mc, 1); assert.deepEqual(c.part.a[0].k, [['sb', 1]]);
  assert.ok(VG.CARDS[c.no].text.some(t => t.includes('กึ่งออโต้')));
});
test('keyword names in front of an ability: Divine Skill once per fight for a fighter, White / Black Wings as a condition, plain name plates', () => {
  const dv = card({ grade: 1 }, '[Divine Skill] - [ACT](RC):[COST][Counter-Blast 1], draw a card.');
  const G = mk(); const a = sp(G, 0, dv, 'RC', 'FL'), b = sp(G, 0, dv, 'RC', 'FR'); dmg(G, 0, 3); const h = P(G, 0).hand.length;
  main(G, o => o.a === 'act' && o.iid === a); assert.equal(P(G, 0).hand.length, h + 1);
  settleMain(G); assert.ok(!G.pending.options.some(o => o.a === 'act'), 'no second Divine Skill in the same fight');
  const ww = card({ grade: 1 }, 'White Wings - [CONT](RC):This unit gets [Power]+5000.');
  const G2 = mk(); const w = sp(G2, 0, ww, 'RC', 'FL'); assert.equal(pw(G2, w), 8000, 'empty bind zone: not active');
  const odd = sp(G2, 0, PLAIN, 'bind'); assert.equal(pw(G2, w), 13000); const even = sp(G2, 0, PLAIN2, 'bind'); assert.equal(pw(G2, w), 8000); void odd; void even;
  const fr = card({ grade: 1 }, 'Friend - [AUTO](RC):When this unit attacks, this unit gets [Power]+5000 until end of that battle.');
  assert.deepEqual(VG.CARDS[fr].tags, ['friend']);
  const pre = card({ grade: 2, boost: false }, '[AUTO](RC):If your vanguard is grade 3 or greater, when this unit attacks, this unit gets [Power]+5000 until end of that battle.');
  const G3g = mk(); const x = sp(G3g, 0, pre, 'RC', 'FL'); toBattle(G3g); G3g.answer(pick(G3g.pending, o => o.a === 'attack' && o.iid === x && o.target === G3g.vg(1).iid)); run(G3g, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(pw(G3g, x), 13000);
});
test('overDress: stacked on the named rear-guard, the unit under it becomes an originalDress and travels with the unit', () => {
  const trick = card({ name: 'Trickstar', grade: 0, power: 5000 }, '[AUTO]:When this card becomes an originalDress, choose one of this card\'s outerDress units, and it gets [Power]+5000 until end of turn.');
  const vai = card({ name: 'Vairina Test', grade: 1, power: 8000 }, '[overDress]-"Trickstar" (You may place it by stacking it on the specified unit instead of normal calling it to (RC))\n[AUTO](RC):When this unit in the [overDress] state attacks a vanguard, this unit gets [Power]+10000 until end of that battle.\n[CONT](RC):This unit gets [Power]+2000 for each of this unit\'s originalDress.');
  const total = G => Object.values(G.cards).filter(c => c.zone !== 'gone' && c.zone !== 'new').length;
  const G = mk(); const t = sp(G, 0, trick, 'RC', 'FL'); const v = sp(G, 0, vai, 'hand'); const n0 = total(G);
  settleMain(G); G.answer(pick(G.pending, o => o.a === 'call' && o.iid === v && o.circle === 'FL'));
  assert.equal(G.pending.kind, 'yesno', 'asks whether to overDress'); G.answer([0]); settle(G);
  assert.equal(G.cards[v].zone, 'RC'); assert.equal(G.cards[v].pos, 'FL'); assert.equal(G.cards[t].zone, 'dress'); assert.equal(G.cards[t].host, v); assert.deepEqual(G.cards[v].dress, [t]);
  assert.equal(P(G, 0).drop.includes(t), false, 'not retired'); assert.equal(total(G), n0);
  assert.equal(pw(G, v), 8000 + 2000 + 5000, 'own CONT per originalDress + the originalDress\'s own skill');
  assert.equal(G.snapshot().cards[t].host, v); assert.deepEqual(G.snapshot().cards[v].dress, [t]);
  toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(pw(G, v), 25000, 'overDress state: +10000 for the battle');
  // returned to hand: the originalDress goes to hand as well
  G.move(v, 'hand', { reason: 'bounce' }); assert.equal(G.cards[t].zone, 'hand'); assert.equal(G.cards[t].host, null); assert.equal(total(G), n0);
  // "no" = ordinary call over the unit (it is retired); without an originalDress the state skill stays quiet
  const G2 = mk(); const t2 = sp(G2, 0, trick, 'RC', 'FL'); const v2 = sp(G2, 0, vai, 'hand');
  settleMain(G2); G2.answer(pick(G2.pending, o => o.a === 'call' && o.iid === v2 && o.circle === 'FL')); G2.answer([1]); settle(G2);
  assert.equal(G2.cards[t2].zone, 'drop'); assert.equal(pw(G2, v2), 8000);
  // retired: both go to the drop zone; a unit that is not named gives no overDress question
  const G3x = mk(); const t3 = sp(G3x, 0, trick, 'RC', 'FL'); const v3 = sp(G3x, 0, vai, 'hand'); const other = sp(G3x, 0, PLAIN, 'RC', 'FR');
  settleMain(G3x); G3x.answer(pick(G3x.pending, o => o.a === 'call' && o.iid === v3 && o.circle === 'FL')); G3x.answer([0]); settle(G3x);
  G3x.retire(v3, 'effect'); assert.equal(G3x.cards[v3].zone, 'drop'); assert.equal(G3x.cards[t3].zone, 'drop');
  const v4 = sp(G3x, 0, vai, 'hand'); settleMain(G3x); G3x.answer(pick(G3x.pending, o => o.a === 'call' && o.iid === v4 && o.circle === 'FR')); assert.notEqual(G3x.pending.kind, 'yesno'); assert.equal(G3x.cards[other].zone, 'drop');
});
test('X-overDress: stacked on all the specified rear-guards; "placed by X-overDress", X-overDress state, cards put as originalDress by a skill', () => {
  races.add('prayer dragon');
  const trick = card({ name: 'Trickstar', grade: 0, power: 5000 }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');
  const pd = card({ name: 'Little Prayer', race: 'Prayer Dragon', grade: 1 }, '[AUTO](RC):When this unit attacks, this unit gets [Power]+0 until end of that battle.');
  const x = card({ name: 'Cross Vairina', grade: 2, power: 10000, boost: false }, '[XoverDress] - One "Trickstar" and one <Prayer Dragon> unit (You may place it by stacking it on all of the specified units instead of normal calling it to (RC))\n[AUTO]:When this unit is placed on (RC) by [XoverDress], choose up to two cards with "Prayer" in their card names from your drop, and put them as this unit\'s originalDress.\n[CONT](RC):If this unit is in the [XoverDress] state, this unit gets [Power]+10000.\n[ACT](RC)[1/Turn]:If this unit is in the [XoverDress] state, [COST][Counter-Blast 1], and put all of this unit\'s originalDress into drop.');
  const od = card({ name: 'Plain Dress', grade: 1 }, '[overDress]-unit in the [XoverDress] state\n[CONT](RC):If this unit is in the [overDress] state, this unit gets [Power]+3000.');
  assert.ok(VG.CARDS[x].od.x); assert.equal(VG.CARDS[x].od.p.length, 2);
  const G = mk(); const t = sp(G, 0, trick, 'RC', 'FL'), d = sp(G, 0, pd, 'RC', 'BL'), h = sp(G, 0, x, 'hand'), dr = sp(G, 0, pd, 'drop'); dmg(G, 0, 1);
  assert.equal(G.odPlan(0, G.cards[h], 'FR'), null, 'nothing on that circle');
  settleMain(G); G.answer(pick(G.pending, o => o.a === 'call' && o.iid === h && o.circle === 'FL')); assert.equal(G.pending.kind, 'yesno'); G.answer([0]);
  settle(G, q => (q.kind === 'cards' ? pick(q, o => o.iid === dr) : null));
  assert.equal(G.cards[h].pos, 'FL'); assert.deepEqual(G.cards[h].dress.slice().sort(), [t, d, dr].sort(), 'both rear-guards plus the card from drop'); assert.equal(G.at(0, 'BL'), null);
  assert.equal(pw(G, h), 20000, 'X-overDress state');
  // only one of the two specified units: no X-overDress
  const G2 = mk(); sp(G2, 0, trick, 'RC', 'FL'); const h2 = sp(G2, 0, x, 'hand'); assert.equal(G2.odPlan(0, G2.cards[h2], 'FL'), null);
  // without originalDress the state ends
  main(G, o => o.a === 'act' && o.iid === h); assert.deepEqual(G.cards[h].dress, []); assert.equal(G.cards[t].zone, 'drop'); assert.equal(pw(G, h), 10000);
  // a unit in the X-overDress state can itself be overDressed: its originalDress pass on to the new unit
  const G4 = mk(); const t4 = sp(G4, 0, trick, 'RC', 'FL'), d4 = sp(G4, 0, pd, 'RC', 'BL'), h4 = sp(G4, 0, x, 'hand'), o4 = sp(G4, 0, od, 'hand');
  settleMain(G4); G4.answer(pick(G4.pending, o => o.a === 'call' && o.iid === h4 && o.circle === 'BL')); G4.answer([0]); settle(G4, q => (q.kind === 'cards' ? [] : null));
  assert.equal(G4.cards[h4].pos, 'BL');
  settleMain(G4); G4.answer(pick(G4.pending, o => o.a === 'call' && o.iid === o4 && o.circle === 'BL')); assert.equal(G4.pending.kind, 'yesno'); G4.answer([0]); settle(G4);
  assert.deepEqual(G4.cards[o4].dress.slice().sort(), [t4, d4, h4].sort()); assert.equal(pw(G4, o4), 8000 + 3000); assert.equal(G4.cards[h4].zone, 'dress');
});
test('markers on circles: placed on a circle without one, counted, "on a (RC) with a marker", normal call only onto a marked circle', () => {
  const putter = card({ grade: 1 }, '[AUTO]:When this unit is placed on (RC), choose one of your (RC) without any dragontree markers, and put a dragontree marker.\n[CONT](RC):During your turn, this unit gets [Power]+2000 for each dragontree marker on (RC).\n[CONT](RC):If this unit is on a (RC) with a dragontree marker, this unit gets [Power]+5000.');
  const tree = card({ grade: 1 }, '[CONT]:This card cannot be ridden, and cannot be normal called to (RC) without any dragontree markers.\n[AUTO]:When this unit is placed on (RC), if you have two or more dragontree markers on (RC), draw a card.');
  const G = mk(); const a = sp(G, 0, putter, 'hand'), b = sp(G, 0, putter, 'hand'), t = sp(G, 0, tree, 'hand');
  settleMain(G); assert.ok(!G.pending.options.some(o => o.a === 'call' && o.iid === t), 'no marked circle yet');
  main(G, o => o.a === 'call' && o.iid === a && o.circle === 'FL', d => (d.kind === 'circle' ? pick(d, o => o.circle === 'FL') : null));
  assert.equal(G.markerCount(0, 'FL', 'dragontree'), 1); assert.equal(pw(G, a), 8000 + 2000 + 5000); assert.equal(G.snapshot().markers.length, 1);
  main(G, o => o.a === 'call' && o.iid === b && o.circle === 'FR', d => { if (d.kind !== 'circle') return null; assert.ok(!d.options.some(o => o.circle === 'FL'), 'only circles without the marker'); return pick(d, o => o.circle === 'BR'); });
  assert.equal(G.markerCount(0, null, 'dragontree'), 2); assert.equal(pw(G, b), 8000 + 4000, 'two markers, not standing on one'); assert.equal(pw(G, a), 8000 + 4000 + 5000);
  settleMain(G); const calls = G.pending.options.filter(o => o.a === 'call' && o.iid === t).map(o => o.circle).sort(); assert.deepEqual(calls, ['BR', 'FL']);
  const h = P(G, 0).hand.length; main(G, o => o.a === 'call' && o.iid === t && o.circle === 'BR'); assert.equal(P(G, 0).hand.length, h - 1 + 1, 'placed, then drew for two markers');
  // the marker belongs to the circle: it stays when the unit leaves
  G.retire(a, 'effect'); assert.equal(G.markerCount(0, 'FL', 'dragontree'), 1);
});
test('wording variants: rode upon by any card description, a move name between zone and colon, tag filters', () => {
  races.add('mermaid');
  const r0 = card({ name: 'Under Mermaid', grade: 2 }, '[AUTO]:When this unit is rode upon by a grade 3 <Mermaid>, draw a card.');
  const top = card({ name: 'Top Mermaid', race: 'Mermaid', grade: 3, power: 13000 }, '[AUTO](VC)Grand Splash :When this unit attacks, this unit gets [Power]+5000 until end of that battle.');
  assert.deepEqual(VG.CARDS[r0].abilities.length, 1);
  const G = mk(); const v = G.vg(0); G.move(v.iid, 'soul', { silent: true }); const u = sp(G, 0, r0, 'VC', 'V'); const t = sp(G, 0, top, 'hand'); const h = P(G, 0).hand.length;
  G.superRide(0, t, true); assert.equal(G.vg(0).iid, t); void h;
  assert.ok(G.pendingAutos.some(e => e.iid === u), 'rode upon by a grade 3 <Mermaid>: the ability waits to resolve');
  const G2 = mk(); const v2 = G2.vg(0); G2.move(v2.iid, 'soul', { silent: true }); const u2 = sp(G2, 0, r0, 'VC', 'V'); const p2 = sp(G2, 0, G3, 'hand');
  G2.superRide(0, p2, true); assert.ok(!G2.pendingAutos.some(e => e.iid === u2), 'not by another grade 3');
});
test('"chosen by the ability of your vanguard": the trigger and the this-turn condition', () => {
  const vg = card({ name: 'Charge Lord', grade: 3, power: 13000, boost: false }, '[ACT](VC)[1/Turn]:Choose one of your rear-guards, and it gets [Power]+5000 until end of turn.');
  const oc = card({ grade: 1 }, '[AUTO](RC):When this unit is chosen by the ability of your grade 3 or greater vanguard with "Charge" in its card name, draw a card.\n[CONT](RC):If this unit was chosen by the ability of your grade 3 or greater vanguard with "Charge" in its card name this turn, this unit gets [Power]+10000.');
  const G = mk(); const old = G.vg(0); G.move(old.iid, 'soul', { silent: true }); const v = sp(G, 0, vg, 'VC', 'V'); const u = sp(G, 0, oc, 'RC', 'FL'), w = sp(G, 0, oc, 'RC', 'FR'); const h = P(G, 0).hand.length;
  assert.equal(pw(G, u), 8000);
  main(G, o => o.a === 'act' && o.iid === v, d => (d.kind === 'cards' ? pick(d, o => o.iid === u) : null));
  assert.equal(pw(G, u), 8000 + 5000 + 10000); assert.equal(pw(G, w), 8000, 'the other one was not chosen'); assert.equal(P(G, 0).hand.length, h + 1);
});
console.log('hand-written mechanics (Version 29-31)');
function cardAst(o, ast) { const no = 'T/' + (++seq); const d = Object.assign({ no, name: o.name || 'Test ' + seq, type: 'unit', nation: 'Dragon Empire', race: 'Human', grade: 1, power: 8000, shield: 5000, crit: 1, boost: true, intercept: false, drive: 1, text: [], abilities: [], auto: true }, o);
  if (d.type === 'order') { d.orderKind = d.orderKind || 'normal'; d.power = null; d.shield = null; } VG.fx.apply(d, ast); VG.CARDS[no] = d; return no; }
test('alchemagic: a second normal order from drop is bound, its cost added and its effect resolved after', () => {
  const V = cardAst({ name: 'Alc Master', grade: 3, power: 13000, boost: false, drive: 2 }, { a: [], alc: { nm: 'same', from: 'drop' } });
  const O = cardAst({ name: 'Alc Draw', type: 'order', grade: 0, race: null }, { a: [], p: { d: [['draw', 1]] } });
  const G = mk(); const v = sp(G, 0, V, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const a = sp(G, 0, O, 'hand'); const b = sp(G, 0, O, 'drop'); settleMain(G); const h = P(G, 0).hand.length;
  main(G, o => o.a === 'order' && o.iid === a);
  assert.equal(G.cards[b].zone, 'bind'); assert.equal(P(G, 0).hand.length, h - 1 + 2, 'both effects drew'); assert.ok(G.tf.alcd0);
});
test('operate: a product is operated by an ACT and calls itself as a normal unit, back to the order zone at end of turn', () => {
  const PR = cardAst({ name: 'Test Product', type: 'order', orderKind: 'set', grade: 1, race: 'Product' }, { a: [{ t: 'a', z: 'O', on: { e: 'oprd' }, d: [['asu', { power: 10000, crit: 1, boost: 1 }], ['if', ['got'], [['later', 't', [['to', 'me', 'order']]]]]] }] });
  const U = cardAst({ name: 'Operator' }, { a: [{ t: 'k', z: 'R', l: 1, d: [['pk', ['order'], 1, 0, { rc: 'product' }], ['opr']] }] });
  const G = mk(); const u = sp(G, 0, U, 'RC', 'FL'); const pr = sp(G, 0, PR, 'order'); settleMain(G);
  main(G, o => o.a === 'act' && o.iid === u, d => (d.kind === 'circle' ? pick(d, o => o.circle === 'FR') : null));
  assert.equal(G.cards[pr].zone, 'RC'); assert.equal(pw(G, pr), 10000);
});
test('buddyfight: call cost pays gauge and puts the top card into the buddy soul; soulguard keeps the unit', () => {
  const U = cardAst({ name: 'Buddy Dragon', grade: 1 }, { a: [{ t: 'c', z: 'R', m: { soulguard: 1 } }], cc: [['gp', 1], ['gzc', 1, {}, ['top'], 'bs', { host: 1 }]] });
  const GZ = cardAst({ name: 'Gauge Holder', grade: 0, type: 'crest' }, { a: [], gz: 'bf' });
  const G = mk(); sp(G, 0, GZ, 'crest'); const top = P(G, 0).deck[0]; for (let k = 0; k < 2; k++) G.toGauge(P(G, 0).deck[1], 'bf', null, true);
  const u = sp(G, 0, U, 'hand'); settleMain(G);
  main(G, o => o.a === 'call' && o.iid === u && o.circle === 'FL');
  assert.equal(G.cards[u].zone, 'RC'); assert.equal(G.gaugeOf(u, 'bs').length, 1, 'buddy soul'); assert.equal(G.cards[top].gh, u);
  assert.equal(P(G, 0).gauge.filter(i => G.cards[i].gk === 'bf').length, 1, 'one gauge paid');
});
test('explosive growth: called on top of a matching grade 0 rear-guard, which becomes its growth factor; retry stands a unit', () => {
  const B0 = cardAst({ name: 'Baby Zero', grade: 0, power: 5000 }, { a: [] });
  const EG = cardAst({ name: 'Grown Baby', grade: 1, power: 9000 }, { a: [], eg: { g: [0, 0], nh: 'Baby' }, retry: 1 });
  const G = mk(); const b0 = sp(G, 0, B0, 'RC', 'FL'); const e = sp(G, 0, EG, 'hand'); settleMain(G);
  main(G, o => o.a === 'call' && o.iid === e && o.circle === 'FL' && o.eg);
  assert.equal(G.cards[e].zone, 'RC'); assert.equal(G.cards[b0].zone, 'gauge'); assert.equal(G.cards[b0].gk, 'growth'); assert.equal(G.cards[b0].gh, e);
  G.cards[e].rest = true; assert.ok(G.retry(e)); assert.equal(G.cards[e].rest, false); assert.equal(G.stat(G.cards[e]).crit, 1); assert.equal(pw(G, e), 14000); assert.ok(!G.retry(e), 'only once a turn');
});
test('row move: a unit with rowMove can swap along its row in the main phase; a vg filter checks the icon', () => {
  const R = cardAst({ name: 'Row Walker' }, { a: [{ t: 'c', z: 'R', m: { rowMove: 1 } }] });
  const G = mk(); const r = sp(G, 0, R, 'RC', 'BL'); settleMain(G);
  main(G, o => o.a === 'move' && o.row && o.row[0] === 'BL' && o.row[1] === 'BC');
  assert.equal(G.cards[r].pos, 'BC');
  const T = cardAst({ name: 'Icon Check' }, { a: [{ t: 'c', z: 'R', c: [['vg', { ico: 'nobody-has-this' }]], m: { power: 5000 } }] });
  const t = sp(G, 0, T, 'RC', 'FR'); assert.equal(pw(G, t), 8000, 'icon filter on the vanguard is checked');
});
test('dominate: an opponent rear-guard is stood and attacks its own side; dominated attacks are counted', () => {
  const U = cardAst({ name: 'Dominator' }, { a: [{ t: 'k', z: 'R', l: 1, d: [['ch', { s: 'o', k: 'r', n: 1 }], ['dom', { m: { power: 4000 } }]] }] });
  const F = cardAst({ name: 'Counter Fan' }, { a: [{ t: 'c', z: 'R', m: { power: 5000 }, per: ['tl', { k: 'atk', s: 'm', dom: 1 }] }] });
  const X = cardAst({ name: 'Victim' }, { a: [] });
  const G = mk(); const u = sp(G, 0, U, 'RC', 'FL'); const f = sp(G, 0, F, 'RC', 'FR'); const x = sp(G, 1, X, 'RC', 'FL'); G.cards[x].rest = true; settleMain(G);
  main(G, o => o.a === 'act' && o.iid === u);
  assert.ok(G.tl.some(r => r.k === 'atk' && r.dom && r.iid === x), 'the dominated unit attacked'); assert.equal(G.cards[x].rest, true); assert.ok(!G.cards[x].dom, 'dominate ends after the battle');
  assert.equal(pw(G, f), 13000, '+5000 per dominated attack');
});
test('Mushiking: the crest rests an attack card when a Mushi attacks; the attack checks Skill / Finishing Attack', () => {
  const CR = cardAst({ name: 'Test Mushi Crest', type: 'crest', grade: 0 }, { a: [{ t: 'a', z: 'C', on: { e: 'uAtk', s: 'm', k: 'u', wf: { rc: 'mushi' } }, k: [['orest', 1, { or: [{ rc: 'pinching attack', gv: 1 }] }]], d: [['itpd', 0], ['useatk']] }], noso: 1 });
  const AT = cardAst({ name: 'Test Pinch', type: 'order', orderKind: 'set', grade: 1, race: 'Pinching Attack' }, { a: [{ t: 'a', z: 'O', on: { e: 'atkUsed' }, d: [['if', ['uis', 'atk', { skmin: 20 }], [['bf', 'attacker', { power: 5000 }, 't']]], ['if', ['uis', 'atk', { fin: 'pinching' }], [['bf', 'attacker', { power: 5000 }, 't']]], ['if', ['uis', 'atk', { skmin: 90 }], [['bf', 'attacker', { power: 50000 }, 't']]]] }] });
  const MU = cardAst({ name: 'Test Beetle', race: 'Mushi', grade: 2, power: 10000 }, { a: [], tg: ['power160', 'skill30', 'finishing attack:pinching', 'super finishing attack:Test Pinch'] });
  const G = mk(); sp(G, 0, CR, 'crest'); const at = sp(G, 0, AT, 'order'); const m = sp(G, 0, MU, 'RC', 'FL'); toBattle(G);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === m && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(G.cards[at].rest, true, 'the attack card was rested'); assert.ok(G.tl.some(r => r.k === 'atkuse'));
  assert.equal(pw(G, m), 20000, 'Skill 20+ and pinching each +5000, Skill 90 not met');
  assert.equal(G.canPlayOrder(0, G.cards[at]), false, 'the crest stops set orders being played');
});
test('Inazuma special moves: an attacking unit uses a face-down special move it meets the usage condition of', () => {
  const SM = cardAst({ name: 'Test Shot', type: 'special', grade: 2, race: null }, { a: [{ t: 'a', z: 'GZ', on: { e: 'smUsed' }, d: [['bf', 'smu', { power: 5000 }, 'b']] }], smu: [{ nh: ['Striker Kid'], pos: 'f' }] });
  VG.CARDS[SM].special = true; VG.CARDS[SM].power = null;
  const U = cardAst({ name: 'Striker Kid', grade: 2, power: 10000 }, { a: [{ t: 'a', z: 'VR', on: { e: 'atk' }, d: [['usesm']] }] });
  const W = cardAst({ name: 'Other Kid', grade: 2, power: 10000 }, { a: [{ t: 'a', z: 'VR', on: { e: 'atk' }, d: [['usesm']] }] });
  const G = mk(); const s1 = sp(G, 0, SM, 'gzone'); G.cards[s1].faceup = false; const w = sp(G, 0, W, 'RC', 'FR'); const u = sp(G, 0, U, 'RC', 'FL'); toBattle(G);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === w && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(G.cards[s1].faceup, false, 'a unit that does not meet the usage condition cannot use it');
  run(G, d => (d.kind === 'attack' ? undefined : null)); G.pending.options = G.attackOptions(0);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === u && o.target === G.vg(1).iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(G.cards[s1].faceup, true, 'used: face up'); assert.equal(pw(G, u), 15000); assert.ok(!G.canStride(0), 'special moves never stride');
});
test('Touken training: Training Equipment rides the Kiwame form and gives the weapon crest, which reshapes the vanguard', () => {
  const TE = VG.DB.byName['Training Equipment'], KC = VG.DB.byName["Naginata's Ability Kiwame"]; if (!TE || !KC) throw new Error('missing cards');
  const BASE = cardAst({ name: 'Testgiri', grade: 3, race: 'Touken Danshi - Naginata' }, { a: [] });
  const KW = cardAst({ name: 'Testgiri Kiwame', grade: 2, power: 10000, race: 'Touken Danshi - Naginata' }, { a: [{ t: 'c', z: 'V', m: { power: 99000 } }] });
  const G = mk(); const P0 = P(G, 0); P0.ride.slice().forEach(i => G.move(i, 'drop', { silent: true }));
  const te = sp(G, 0, TE.no, 'order'); const tr = sp(G, 0, BASE, 'order'); G.cards[tr].training = true; const kw = sp(G, 0, KW, 'hand'); G.tf.rode0 = 0; settleMain(G);
  main(G, o => o.a === 'act' && o.iid === te);
  assert.equal(G.vg(0).iid, kw, 'rode the Kiwame card'); assert.equal(G.cards[te].zone, 'soul'); assert.ok(P0.crest.some(i => G.def(G.cards[i]).name === KC.name), 'got the crest');
  const d = G.def(G.vg(0)); assert.equal(d.grade, 3); assert.equal(G.stat(G.vg(0)).power, 13000, 'original abilities lost, power 13000'); assert.equal(G.stat(G.vg(0)).drive, 2);
});
test('Völundr: a Valkyrie unit is played as an arms order onto the named vanguard', () => {
  const MAN = cardAst({ name: 'Test Hero Man', grade: 3, power: 13000 }, { a: [], volm: 1 });
  const VAL = cardAst({ name: 'Test Valkyrie', grade: 1, race: 'Valkyrie' }, { vol: 'Test Hero Man', a: [{ t: 'c', z: 'A', c: [['my']], s: { s: 'm', k: 'v' }, m: { power: 5000 } }] });
  const G = mk(); const v = sp(G, 0, MAN, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const k = sp(G, 0, VAL, 'hand'); settleMain(G);
  main(G, o => o.a === 'varm' && o.iid === k);
  assert.equal(G.cards[k].zone, 'arms'); assert.equal(pw(G, v), 18000); assert.equal(G.tf.ord0, 1, 'counts as playing an order');
});
test('explosive growth by an ability (egon) and leaving the growth factor behind (egsplit)', () => {
  const B0 = cardAst({ name: 'Baby Bebe', grade: 0, power: 5000 }, { a: [] });
  const EG = cardAst({ name: 'Grown Bebe', grade: 1, power: 9000 }, { a: [{ t: 'k', z: 'R', d: [['egsplit']] }], eg: { g: [0, 0], nh: 'Bebe' } });
  const V = cardAst({ name: 'Bebe Boss', grade: 3, power: 13000 }, { a: [{ t: 'k', z: 'V', d: [['ch', { s: 'm', k: 'r', n: 1 }], ['egon', ['hand'], 1]] }] });
  const G = mk(); const v = sp(G, 0, V, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const b0 = sp(G, 0, B0, 'RC', 'FL'); G.cards[b0].rest = true; const e = sp(G, 0, EG, 'hand'); settleMain(G);
  main(G, o => o.a === 'act' && o.iid === v);
  assert.equal(G.cards[e].zone, 'RC'); assert.equal(G.cards[e].rest, false); assert.equal(G.cards[b0].gk, 'growth');
  settleMain(G); main(G, o => o.a === 'act' && o.iid === e);
  assert.equal(G.cards[e].zone, 'hand'); assert.equal(G.cards[b0].zone, 'RC'); assert.equal(G.cards[b0].rest, true);
});
test('D-legion: four drop cards back to deck, the partner joins the vanguard, both attack with added power, both leave when ridden upon', () => {
  const L = cardAst({ name: 'Legion Leader', grade: 3, power: 13000, drive: 2 }, { a: [{ t: 'k', z: 'V', c: [['candl']], d: [['dlegion', 'Legion Mate']] }] });
  const M = cardAst({ name: 'Legion Mate', grade: 3, power: 10000 }, { a: [] });
  const X = cardAst({ name: 'Drop Filler', grade: 1 }, { a: [] });
  const G = mk(); const v = sp(G, 0, L, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  G.vg(1).no = L; for (let k = 0; k < 4; k++) sp(G, 0, X, 'drop'); const m = sp(G, 0, M, 'deck');
  settleMain(G); main(G, o => o.a === 'act' && o.iid === v);
  assert.equal(P(G, 0).circles.V2, m, 'mate on the vanguard circle'); assert.equal(P(G, 0).drop.length, 0, 'four cards back to deck'); assert.ok(!G.canDLegion(0), 'once a fight');
  toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === G.vg(1).iid));
  assert.equal(G.battlePower(), 23000); assert.equal(G.cards[m].rest, true);
});
test('alchemix: two genomegel rear-guards go under the Ubermensch token; its "when this unit alchemixes" and the materials\' abilities fire', () => {
  const TK = VG.DB.byName['Demonic Beast Alchemix Body, Ubermensch']; if (!TK) throw new Error('no token');
  const A = cardAst({ name: 'Gel One', race: 'Genomegel' }, { a: [{ t: 'a', z: 'Z', on: { e: 'alcxd' }, d: [['itev', 'host'], ['bf', 'it', { crit: 1 }, 't']] }] });
  const B = cardAst({ name: 'Gel Two', race: 'Genomegel' }, { a: [] });
  const V = cardAst({ name: 'Gel Boss', grade: 3, power: 13000 }, { a: [{ t: 'k', z: 'V', d: [['alcx', { rc: 'genomegel' }]] }] });
  const G = mk(); const v = sp(G, 0, V, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const t = G.newCard(TK.no, 0, 'new', true); G.move(t.iid, 'RC', { pos: 'BL', silent: true }); t.rest = true;
  const a = sp(G, 0, A, 'RC', 'FR'); const b = sp(G, 0, B, 'RC', 'BR'); settleMain(G);
  main(G, o => o.a === 'act' && o.iid === v, d => (/Alchemix/.test(d.title || '') ? d.options.map((_, i) => i).slice(0, d.max) : null));
  assert.equal(G.cards[a].zone, 'gauge'); assert.equal(G.cards[b].gh, t.iid); assert.equal(t.rest, false, 'the token stood'); assert.equal(G.stat(t).crit, 2, 'material gave critical'); assert.equal(G.stat(t).power, 15000, '+5000 per vanguard grade');
});
test('vswap: a rear-guard and the vanguard swap positions keeping their state', () => {
  const R = cardAst({ name: 'Swap Singer', grade: 2, power: 10000 }, { a: [{ t: 'k', z: 'R', d: [['vswap', 'me']] }] });
  const G = mk(); const v0 = G.vg(0).iid; const r = sp(G, 0, R, 'RC', 'BC'); settleMain(G);
  main(G, o => o.a === 'act' && o.iid === r);
  assert.equal(G.vg(0).iid, r); assert.equal(G.cards[v0].zone, 'RC'); assert.equal(G.cards[v0].pos, 'BC');
});
test('dbl: a rear-guard retired for the vanguard\'s cost may count as two', () => {
  const V = cardAst({ name: 'Double Boss', grade: 3, power: 13000 }, { a: [{ t: 'k', z: 'V', k: [['rrg', 2, {}]], d: [['draw', 2]] }] });
  const W = cardAst({ name: 'Double Witch', grade: 1 }, { a: [], dbl: { k: 'retire', v: { nh: 'Double Boss' } } });
  const G = mk(); const v = sp(G, 0, V, 'new'); G.move(G.vg(0).iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const w = sp(G, 0, W, 'RC', 'BL'); settleMain(G); const h0 = P(G, 0).hand.length;
  assert.ok(G.dblCan(G.cards[v], 'retire', [w], 2), 'one card is enough');
  main(G, o => o.a === 'act' && o.iid === v, d => (/นับเป็น 2/.test(d.title || '') ? [0] : null));
  assert.equal(G.cards[w].zone, 'drop'); assert.equal(P(G, 0).hand.length, h0 + 2);
});
test('Thai text is produced for every compiled ability', () => {
  for (const no in VG.CARDS) if (no.startsWith('T/')) for (const t of VG.CARDS[no].text) { assert.ok(typeof t === 'string' && t.length > 8, no); assert.ok(!t.includes('undefined') && !t.includes('?'), no + ': ' + t); }
});

console.log('\n' + passed + ' passed, ' + fails.length + ' failed'); if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
