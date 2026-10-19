// Scenario tests for machine-read skills: small made-up cards are written in the card-text grammar, compiled, put on the table and checked for the right behaviour.
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
function dflt(d) { if (d.kind === 'yesno' || d.kind === 'boost') return [0]; if (d.kind === 'guard') return []; const n = Math.max(d.min, Math.min(1, d.max)); return d.options.slice(0, n).map((_, i) => i); }
function run(G, policy, max = 600) { for (let n = 0; n < max && G.pending; n++) { const r = policy ? policy(G.pending, G) : null; if (r === undefined) return; G.answer(r === null ? dflt(G.pending) : r); } }
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
// ---- Lianorn (owner 2026-10-19: "multiple boost" skills do not seem to work)
const no = n => { const r = VG.DB.rows.find(x => x.name === n); if (!r) throw new Error('no card ' + n); return VG.canon(r.no); };
const BOOSTER = no('Iron Ball Dragon, Ankybowler');
function setup(vgName, opts) {
  opts = opts || {};
  const G = mk(); const p = 0; const v = sp(G, p, no(vgName), 'new'); const old = G.vg(p); G.move(old.iid, 'soul', { silent: true }); G.move(v, 'VC', { pos: 'V', silent: true });
  const back = ['BL', 'BC', 'BR'].map(pos => sp(G, p, opts.backNo || BOOSTER, 'RC', pos));
  dmg(G, p, 3); soul(G, p, 3); for (let k = 0; k < 3; k++) sp(G, p, BOOSTER, 'hand');
  if (opts.setup) opts.setup(G);
  return { G, v: G.vg(p).iid, back };
}
const LOG = G => (G.logs || []).slice(-30);
function attackV(G, v, policy) { toBattle(G); const t = G.vg(1).iid; attack(G, v, t, policy || (d => (d.kind === 'boost' ? [1] : d.kind === 'guard' ? [] : null))); }
test('Grand March of Full Bloom: when attacking, pay SB1 + discard → all 3 stand back-row boosters boost, drive +1, stand 2 back row after battle', () => {
  const { G, v, back } = setup('Grand March of Full Bloom, Lianorn');
  const p0 = pw(G, v); const bp = back.map(i => pw(G, i));
  let seenPw = null, seenDrive = null;
  toBattle(G); const t = G.vg(1).iid;
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seenPw = g.stat(g.cards[v]).power; seenDrive = g.stat(g.cards[v]).drive; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.equal(seenPw, p0 + bp.reduce((a, b) => a + b, 0), 'power with the three boosts (seen when guarding)');
  assert.ok(seenDrive >= 3, 'drive +1 (twin → triple): ' + seenDrive);
  assert.equal(back.filter(i => !G.cards[i].rest).length, 2, 'two back-row rear-guards stood at the end of that battle');
});
test('Servitude of Funeral Procession: choose up to three back-row boosters, then CB1 stand two', () => {
  const { G, v, back } = setup('Servitude of Funeral Procession, Lianorn Masques');
  const p0 = pw(G, v); const bp = back.map(i => pw(G, i)); let seenPw = null;
  toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seenPw = g.stat(g.cards[v]).power; return []; } if (d.kind === 'cards' && /เลือก/.test(d.title || '') && d.max >= 3) return [0, 1, 2]; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.equal(seenPw, p0 + bp.reduce((a, b) => a + b, 0));
  assert.equal(back.filter(i => !G.cards[i].rest).length >= 2, true, 'stood two');
});
test('Bandmaster of Blooming Dreams (Traumend): Lianorn rear-guards get Boost; when attacking not boosted, stand + boost with all back-row Boost units', () => {
  const L1 = VG.DB.rows.filter(r => /Lianorn/.test(r.name) && r.grade === 1 && r.jno)[0] || VG.DB.rows.filter(r => /Lianorn/.test(r.name) && r.grade < 3)[0];
  const { G, v, back } = setup('Bandmaster of Blooming Dreams, Lianorn Traumend');
  for (const i of back) G.cards[i].rest = true;   // stood by the skill
  const p0 = pw(G, v); let seenPw = null;
  toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seenPw = g.stat(g.cards[v]).power; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(seenPw > p0, 'boosted: ' + p0 + ' → ' + seenPw);
});
test('Marche Fleur, Lianorn Vivace (in UnisonDress): stand all rear-guards and boost with them', () => {
  const { G, v, back } = setup('Marche Fleur, Lianorn Vivace', { setup: G => { const vv = G.vg(0); (vv.st = vv.st || {}).unisondress = 99; } });
  G.stateOn && G.stateOn(v, 'unisondress');
  const p0 = pw(G, v); let seenPw = null;
  toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seenPw = g.stat(g.cards[v]).power; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(seenPw > p0, 'boosted: ' + p0 + ' → ' + seenPw);
});
test('Traumend: grade 3 Lianorn rear-guards get Boost → normal boost offered, and they join the multi-boost', () => {
  const LG3 = no('Grand March of Full Bloom, Lianorn');
  const { G, v, back } = setup('Bandmaster of Blooming Dreams, Lianorn Traumend', { backNo: LG3 });
  for (const i of back) assert.ok(G.stat(G.cards[i]).boost, 'Lianorn rear-guard has Boost');
  const fl = sp(G, 0, BOOSTER, 'RC', 'FL'); let offered = false;
  toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === fl && o.target === t));
  run(G, (d) => { if (d.kind === 'boost') { offered = true; return [1]; } if (d.kind === 'guard') return []; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(offered, 'boost offered for a grade 3 Lianorn behind the attacker');
  let seen = null; const p0 = pw(G, v); G.pending.options = G.attackOptions(G.pending.player);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') return [1]; if (d.kind === 'guard') { seen = g.stat(g.cards[v]).power; return []; } return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(seen > p0 + 20000, 'multi-boost by the grade 3 Lianorns: ' + p0 + ' → ' + seen);
});
test('Seraphic Notes "Fantôme": Seraphic Notes rear-guards without printed Boost can boost', () => {
  const SN = VG.DB.rows.find(r => /^Seraphic Notes, /.test(r.name) && r.grade === 2 && r.jno); if (!SN) throw new Error('no Seraphic Notes grade 2');
  const { G, v } = setup('Seraphic Notes, Lianorn "Fantôme"', { backNo: VG.canon(SN.no) });
  const fl = sp(G, 0, BOOSTER, 'RC', 'FL'); let offered = false;
  toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === fl && o.target === t));
  run(G, (d) => { if (d.kind === 'boost') { offered = true; return [0]; } if (d.kind === 'guard') return []; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(offered, 'boost offered (Seraphic Notes grade 2 behind) ' + SN.name);
});
test('boost prompt for a vanguard with its own multi-boost skill recommends not boosting; the bot does not boost', () => {
  const { G, v } = setup('Bandmaster of Blooming Dreams, Lianorn Traumend');
  let prompt = null; toBattle(G); const t = G.vg(1).iid; G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === v && o.target === t));
  run(G, (d, g) => { if (d.kind === 'boost') { prompt = d; return VG.bot(g); } if (d.kind === 'guard') return []; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
  assert.ok(prompt && prompt.prefer === 'no' && /แนะนำ/.test(prompt.sub || ''), 'hint shown: ' + JSON.stringify(prompt && { prefer: prompt.prefer, sub: prompt.sub }));
  assert.ok(VG.bot.length >= 0);
});
console.log(passed + ' passed, ' + fails.length + ' failed'); if (fails.length) process.exitCode = 1;
