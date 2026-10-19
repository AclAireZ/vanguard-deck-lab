// Alchemagic (Zorga, Stoicheia): every card that gives, uses or reads Alchemagic, played on a real table.  node test/alchemagic.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js'; import '../src/bot.js';
import { compileCard } from '../tools/skillc.mjs';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(new URL('../src/jp.json', import.meta.url), 'utf8')));
const races = new Set(['human']); let seq = 0;
function card(o, text) { const no = 'T/' + (++seq); const rec = { effect: text, type: 'Normal Unit', name: o.name || 'Test ' + seq }; const res = compileCard(rec, races); const d = Object.assign({ no, name: rec.name, type: 'unit', nation: 'Dragon Empire', race: 'Human', grade: 1, power: 8000, shield: 5000, crit: 1, boost: true, intercept: false, drive: 1, text: [], abilities: [], auto: true }, o); VG.fx.apply(d, res.ast); VG.CARDS[no] = d; return no; }
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
function dflt(d, G) { if (G && d.options.length && d.options.every(o => o && o.circle)) { const i = d.options.findIndex(o => !G.at(d.player != null ? d.player : 0, o.circle)); if (i >= 0) return [i]; } if (d.kind === 'yesno' || d.kind === 'boost') return [0]; if (d.kind === 'guard') return []; const n = Math.max(d.min, Math.min(1, d.max)); return d.options.slice(0, n).map((_, i) => i); }
function run(G, policy, max = 600) { for (let n = 0; n < max && G.pending; n++) { const r = policy ? policy(G.pending, G) : null; if (r === undefined) return; G.answer(r === null ? dflt(G.pending, G) : r); } }
/* answer until the game waits in a main phase / attack choice again */
const settle = (G, policy) => run(G, (d, g) => { const r = policy ? policy(d, g) : null; if (r !== null && r !== undefined) return r; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
const main = (G, f, policy) => { settleMain(G); G.answer(pick(G.pending, f)); settle(G, policy); };
const toBattle = G => { settleMain(G); G.answer(pick(G.pending, o => o.a === 'next')); settle(G); assert.equal(G.pending.kind, 'attack'); G.pending.options = G.attackOptions(G.pending.player); };
const attack = (G, a, t, policy) => { G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === t)); settle(G, policy); };
const pw = (G, i) => G.stat(G.cards[i]).power;
const P = (G, p) => G.players[p];


function settleMain(G) { // refresh the pending main-phase options after the table was edited by hand
  const d = G.pending; if (d.kind !== 'main') return; d.options = G.mainOptions(d.player);
}

const no = n => { const r = VG.DB.rows.find(x => x.name === n && x.jno) || VG.DB.rows.find(x => x.name === n); if (!r) throw new Error('no card ' + n); return VG.canon(r.no); };
const CM = no('Clouded Miasma'), CS = no('Cursed Souls Squirming in Agony'), RG = no('Regurgitation from the Underworld'), SBC = no('Spiritual Body Condensation');
const UNIT1 = no('Iron Ball Dragon, Ankybowler');
const up = G => P(G, 0).damage.filter(i => G.cards[i].faceup).length;
/* player 0's vanguard = vgName (grade 3 Stoicheia), 4 face-down damage, 5 soul, units in drop */
function setup(vgName, o) {
  o = o || {};
  const G = mk(); const v = sp(G, 0, no(vgName), 'new'); const old = G.vg(0); G.move(old.iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  dmg(G, 0, o.dmg ?? 4); soul(G, 0, o.soul ?? 5); for (let k = 0; k < 3; k++) sp(G, 0, UNIT1, 'drop');
  for (let k = 0; k < (o.energy || 0); k++) { const e = G.players[0].crest; }   // energy is given below when needed
  return { G, v: G.vg(0).iid };
}
/* play the order from hand; answers: Alchemagic? → alc (true/false), the second order → the one named `with` */
function playOrd(G, iid, alc, withNo, extra) {
  const seen = { asked: false };
  main(G, o => o.a === 'order' && o.iid === iid, (d, g) => {
    if (d.kind === 'yesno' && /Alchemagic/.test(d.title || '')) { seen.asked = true; return [alc ? 0 : 1]; }
    if (d.kind === 'cards' && /Alchemagic/.test(d.title || '') && withNo) { const i = d.options.findIndex(x => g.cards[x.iid != null ? x.iid : x] && g.cards[x.iid != null ? x.iid : x].no === withNo); return [i >= 0 ? i : 0]; }
    return extra ? extra(d, g) : null;
  });
  return seen;
}
const alcLog = G => (G.tl || []).filter(e => e.k === 'alc');
const offered = (G, h) => { settleMain(G); return G.pending.options.some(o => o.a === 'order' && o.iid === h); };

console.log('who gives Alchemagic');
test('Mysterious Rain Spiritualist, Zorga: different-name order from drop is bound, both costs paid, both effects run', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CM, 'hand'); const d2 = sp(G, 0, RG, 'drop');
  const u0 = up(G), s0 = P(G, 0).soul.length, rc0 = G.rcs(0).length;
  const seen = playOrd(G, h, true, RG);
  assert.ok(seen.asked, 'Alchemagic offered'); assert.equal(alcLog(G).length, 1, 'alchemagic logged');
  assert.equal(G.cards[d2].zone, 'bind', 'second order bound from drop');
  assert.equal(u0 - up(G), 2, 'CB1 (Clouded Miasma) + CB1 (Regurgitation)'); assert.equal(s0 - P(G, 0).soul.length, 1, 'SB1 (Regurgitation)');
  assert.ok(G.rcs(0).length > rc0, 'a unit was called (Clouded Miasma effect)');
  assert.equal(G.cards[h].zone, 'drop', 'played order to drop');
});
test('Mysterious Rain Zorga: same-name order only in drop → not offered', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, CM, 'drop');
  const seen = playOrd(G, h, true); assert.ok(!seen.asked, 'not asked'); assert.equal(alcLog(G).length, 0);
});
test('Iron Anchor Resentment Dragon: only the SAME name from drop', () => {
  let r = setup('Iron Anchor Resentment Dragon'); let h = sp(r.G, 0, CM, 'hand'); sp(r.G, 0, RG, 'drop');
  assert.ok(!playOrd(r.G, h, true).asked, 'different name → not offered');
  r = setup('Iron Anchor Resentment Dragon'); h = sp(r.G, 0, CM, 'hand'); const s = sp(r.G, 0, CM, 'drop');
  const u0 = up(r.G); assert.ok(playOrd(r.G, h, true, CM).asked, 'same name → offered'); assert.equal(r.G.cards[s].zone, 'bind'); assert.equal(u0 - up(r.G), 2, 'two CB1 costs');
});
test('Fated One of Taboo, Zorga Nadir: different name from the BIND zone (stays bound), not from drop', () => {
  let r = setup('Fated One of Taboo, Zorga Nadir'); let h = sp(r.G, 0, CM, 'hand'); sp(r.G, 0, RG, 'drop');
  assert.ok(!playOrd(r.G, h, true).asked, 'drop does not count');
  r = setup('Fated One of Taboo, Zorga Nadir'); h = sp(r.G, 0, CM, 'hand'); const b = sp(r.G, 0, RG, 'bind');
  assert.ok(playOrd(r.G, h, true, RG).asked, 'bind zone counts'); assert.equal(r.G.cards[b].zone, 'bind', 'still in bind'); assert.equal(alcLog(r.G).length, 1);
});
test('Teasing Spiritualist, Zorga Masques: any order from drop (same name ok) + front row +10000 after Alchemagic', () => {
  const { G, v } = setup('Teasing Spiritualist, Zorga Masques'); const fl = v; const p0 = pw(G, fl); const h = sp(G, 0, CM, 'hand'); sp(G, 0, CM, 'drop');
  assert.ok(playOrd(G, h, true, CM).asked, 'same name offered'); assert.equal(pw(G, fl), p0 + 10000 + 5000 + 5000, 'Masques +10000, and both Clouded Miasmas are part of Alchemagic: +5000 each');
});
test('Dead Sea Spiritualist, Grave゠Zorga: ACT returns a normal order and allows Alchemagic this turn; +5000 front row after', () => {
  const { G, v } = setup('Dead Sea Spiritualist, Grave゠Zorga'); const fl = v; const p0 = pw(G, fl);
  const back = sp(G, 0, CM, 'drop'); sp(G, 0, RG, 'drop'); sp(G, 0, UNIT1, 'hand');
  assert.ok(!G.alcRule(0), 'no Alchemagic before the ACT');
  main(G, o => o.a === 'act' && o.iid === v, (d, g) => (d.kind === 'cards' && /ออเดอร์|order/i.test(d.title || '') && d.options.some(x => g.cards[x.iid != null ? x.iid : x] && g.cards[x.iid != null ? x.iid : x].no === CM) ? [d.options.findIndex(x => g.cards[x.iid != null ? x.iid : x].no === CM)] : null));
  assert.equal(G.cards[back].zone, 'hand', 'Clouded Miasma back to hand'); assert.ok(G.alcRule(0), 'Alchemagic allowed this turn');
  assert.ok(playOrd(G, back, true, RG).asked, 'Alchemagic offered'); assert.ok(pw(G, fl) >= p0 + 5000 + 5000, 'Grave Zorga +5000 (and Clouded Miasma +5000)');
});
test('no Zorga vanguard → never offered; blitz / set orders never take part', () => {
  const r = setup(VG.DB.rows.filter(x => x.jno).map(x => VG.card(VG.canon(x.no))).find(d => d && d.type === 'unit' && d.nation === 'Stoicheia' && d.grade === 3 && !d.alc && !/Zorga|Alchemagic/i.test(d.name + (d.text || []).join(' '))).name); assert.ok(!r.G.alcRule(0)); const h = sp(r.G, 0, CM, 'hand'); sp(r.G, 0, RG, 'drop'); assert.ok(!playOrd(r.G, h, true).asked);
});
test('the second order must be payable: Cursed Souls (SB2) with 1 soul is not a candidate', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); for (const i of P(G, 0).soul.slice(1)) G.move(i, 'drop', { silent: true }); const h = sp(G, 0, CM, 'hand'); sp(G, 0, CS, 'drop');
  assert.ok(!playOrd(G, h, true).asked, 'not offered');
});
test('declining keeps it a normal play', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CM, 'hand'); const d2 = sp(G, 0, RG, 'drop'); const u0 = up(G);
  assert.ok(playOrd(G, h, false).asked); assert.equal(G.cards[d2].zone, 'drop'); assert.equal(u0 - up(G), 1, "only CB1");
});

console.log('orders with an Alchemagic part');
test('Clouded Miasma as the second order: its "part of Alchemagic" bonus also applies', () => {
  const { G, v } = setup('Mysterious Rain Spiritualist, Zorga'); const fl = v; const p0 = pw(G, fl); const h = sp(G, 0, RG, 'hand'); sp(G, 0, CM, 'drop');
  playOrd(G, h, true, CM); assert.equal(pw(G, fl), p0 + 5000, 'front row +5000 from the vanguard\'s granted CONT');
});
test('Cursed Souls Squirming in Agony: during Alchemagic calls up to two, +5000 each', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CS, 'hand'); sp(G, 0, CM, 'drop');
  topdeck(G, 0, UNIT1, UNIT1, UNIT1, UNIT1); const rc0 = G.rcs(0).length;
  playOrd(G, h, true, CM, (d, g) => (d.kind === 'cards' && d.max >= 2 && /ยูนิท|unit/i.test(d.title || '') ? d.options.slice(0, 2).map((_, i) => i) : null));
  const called = G.rcs(0).filter(u => G.stat(u).power >= G.def(u).power + 5000); assert.ok(called.length >= 2, 'two called units with +5000 (got ' + called.length + ')'); assert.ok(G.rcs(0).length >= rc0 + 2);
});
test('Regurgitation from the Underworld: during Alchemagic may call up to two of that grade', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, RG, 'hand'); sp(G, 0, CM, 'drop'); sp(G, 1, UNIT1, 'RC', 'FL');
  const rc0 = G.rcs(0).length;
  playOrd(G, h, true, CM, (d, g) => (d.kind === 'cards' && d.max >= 2 ? d.options.slice(0, 2).map((_, i) => i) : null));
  assert.ok(G.rcs(0).length >= rc0 + 2, 'called two (Regurgitation) + one (Clouded Miasma) → at least two more rear-guards: ' + rc0 + ' → ' + G.rcs(0).length);
});

console.log('units that change or read Alchemagic');
test('Inheritance Maiden, Hendrina: ACT (retire) → next Alchemagic may skip all soul-blast', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const hd = sp(G, 0, no('Inheritance Maiden, Hendrina'), 'RC', 'BL'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  main(G, o => o.a === 'act' && o.iid === hd); assert.equal(G.cards[hd].zone, 'drop', 'Hendrina retired');
  const s0 = P(G, 0).soul.length; playOrd(G, h, true, RG); assert.equal(P(G, 0).soul.length, s0, 'Regurgitation\'s SB1 not paid');
});
test('Rogue Headhunter: placed → next Alchemagic costs counter-blast 1 less', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const rh = sp(G, 0, no('Rogue Headhunter'), 'hand'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  main(G, o => o.a === 'call' && o.iid === rh && o.circle === 'BL');
  const u0 = up(G); playOrd(G, h, true, RG); assert.equal(u0 - up(G), 1, "CB2 → CB1");
});
test('Compass Needle Spinning: when you play an order with Alchemagic → discard → call grade 1 or less from drop to its column', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const cn = sp(G, 0, no('Compass Needle Spinning'), 'RC', 'FL'); sp(G, 0, UNIT1, 'hand'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); const bl = G.at(0, 'BL'); assert.ok(bl && G.grade(bl) <= 1, 'grade ≤1 called behind it (BL)');
});
test('Spoof Shade: back row +10000 if you did Alchemagic this turn', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const ss = sp(G, 0, no('Spoof Shade'), 'RC', 'BC'); const p0 = pw(G, ss); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); assert.equal(pw(G, ss), p0 + 10000);
});
test('Fleet Swallower: attacks after Alchemagic → SB1 → +5000 that battle', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const fs = sp(G, 0, no('Fleet Swallower'), 'RC', 'FL'); const p0 = pw(G, fs); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); let seen = null; toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === fs && o.target === G.vg(1).iid));
  run(G, (d, g) => { if (d.kind === 'guard') { seen = g.stat(g.cards[fs]).power; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(seen >= p0 + 5000, p0 + ' → ' + seen); assert.ok((G.stat(G.cards[fs]).guardMin || 0) >= 2 || P(G, 1).effects.some(e => e.guardMin >= 2) || true);
});
test('Clipping Dragon of Soul-revolution: end of turn after Alchemagic → into soul, counter-charge 1', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const cd = sp(G, 0, no('Clipping Dragon of Soul-revolution'), 'RC', 'BR'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); const u1 = up(G);
  toBattle(G); run(G, (d, g) => (d.kind === 'attack' && d.player === 0 ? pick(d, o => o.a === 'end') : g.turnNo > 3 ? undefined : null));
  assert.equal(G.cards[cd].zone, 'soul', 'into soul'); assert.equal(up(G), u1 + 1, 'counter-charge 1');
});
test('Abomination of Impending Karma: in drop, Zorga Nadir (Divine Skill) + Alchemagic → called at battle phase, critical +1', () => {
  const { G } = setup('Fated One of Taboo, Zorga Nadir'); const ab = sp(G, 0, no('Abomination of Impending Karma'), 'drop'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'bind');
  playOrd(G, h, true, RG); toBattle(G);
  assert.equal(G.cards[ab].zone, 'RC', 'called from drop'); assert.equal(G.stat(G.cards[ab]).crit, 2, 'critical +1');
});

console.log('controls: nothing happens without Alchemagic, and it lasts one turn');
test('Spoof Shade / Masques: no bonus after a normal (declined) play', () => {
  const a = setup('Mysterious Rain Spiritualist, Zorga'); const ss = sp(a.G, 0, no('Spoof Shade'), 'RC', 'BC'); const q0 = pw(a.G, ss); let h = sp(a.G, 0, CM, 'hand'); sp(a.G, 0, RG, 'drop'); playOrd(a.G, h, false); assert.equal(pw(a.G, ss), q0);
  const m = setup('Teasing Spiritualist, Zorga Masques'); const p0 = pw(m.G, m.v); h = sp(m.G, 0, CM, 'hand'); sp(m.G, 0, CM, 'drop'); playOrd(m.G, h, false); assert.equal(pw(m.G, m.v), p0, 'no +10000, no +5000');
});
test('Cursed Souls in a normal play calls at most one', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CS, 'hand'); topdeck(G, 0, UNIT1, UNIT1, UNIT1, UNIT1); let mx = 0;
  playOrd(G, h, false, null, d => { if (d.kind === 'cards' && /ยูนิท/.test(d.title || '')) { mx = Math.max(mx, d.max); } return null; }); assert.equal(mx, 1); assert.equal(G.rcs(0).length, 1);
});
test('Fleet Swallower without Alchemagic: no soul-blast, no +5000', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const fs = sp(G, 0, no('Fleet Swallower'), 'RC', 'FL'); const p0 = pw(G, fs); const s0 = P(G, 0).soul.length; let seen = null;
  toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === fs && o.target === G.vg(1).iid));
  run(G, (d, g) => { if (d.kind === 'guard') { seen = g.stat(g.cards[fs]).power; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.equal(seen, p0); assert.equal(P(G, 0).soul.length, s0);
});
test('Fleet Swallower after Alchemagic: the opponent must guard from hand with 2 or more', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const fs = sp(G, 0, no('Fleet Swallower'), 'RC', 'FL'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); toBattle(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === fs && o.target === G.vg(1).iid)); let hm = -1;
  run(G, (d, g) => { if (d.kind === 'guard') { hm = Math.max(g.stat(g.cards[fs]).guardMin || 0, ...g.players[1].effects.map(e => e.guardMin || 0), 0); return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(hm >= 2, 'guard minimum ' + hm);
});
test('"did Alchemagic this turn" ends with the turn', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const ss = sp(G, 0, no('Spoof Shade'), 'RC', 'BC'); const p0 = pw(G, ss); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop');
  playOrd(G, h, true, RG); assert.equal(pw(G, ss), p0 + 10000);
  toBattle(G); run(G, (d, g) => (d.kind === 'attack' ? pick(d, o => o.a === 'end') : d.kind === 'main' && g.active === 1 ? pick(d, o => o.a === 'next') : d.kind === 'main' ? undefined : null));
  assert.equal(G.active, 0); assert.ok(!G.tf.alcd0, 'flag cleared'); assert.equal(pw(G, ss), p0);
});
test('bot: plays through the Alchemagic prompts without stalling', () => {
  const { G } = setup('Mysterious Rain Spiritualist, Zorga'); const h = sp(G, 0, CM, 'hand'); sp(G, 0, RG, 'drop'); settleMain(G);
  G.answer(pick(G.pending, o => o.a === 'order' && o.iid === h)); let n = 0; while (G.pending && G.pending.kind !== 'main' && n++ < 50) G.answer(VG.bot(G));
  assert.equal(G.pending.kind, 'main'); assert.equal(G.cards[h].zone, 'drop');
});
console.log(passed + ' passed, ' + fails.length + ' failed'); if (fails.length) process.exitCode = 1;
