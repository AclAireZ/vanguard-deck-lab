import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js'; import '../src/bot.js';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')));
if (fs.existsSync(new URL('../src/jp.json', import.meta.url))) VG.loadJP(JSON.parse(fs.readFileSync(new URL('../src/jp.json', import.meta.url), 'utf8')));   // the Japanese pool: names, numbers and the cards only it has
function invariants(G, tag) {
  for (const p of [0, 1]) {
    const P = G.players[p]; const seen = new Set();
    const lists = ['deck', 'hand', 'drop', 'damage', 'soul', 'bind', 'removed', 'ride', 'order', 'crest', 'trigger', 'GC', 'dress', 'gauge', 'prison', 'arms', 'music', 'gzone', 'heart', 'memory', 'mbox'];
    let n = 0;
    for (const z of lists) for (const i of P[z]) { if (seen.has(i)) throw new Error(tag + ' dup ' + i); seen.add(i); if (!G.cards[i].token) n++; if (G.cards[i].zone !== z) throw new Error(tag + ' zone mismatch ' + z + ' ' + G.cards[i].zone); if (G.cards[i].token && z !== 'GC' && z !== 'gauge' && !(G.cards[i].ticket && (z === 'hand' || z === 'order')) && !((z === 'order' || z === 'crest') && G.def(G.cards[i]).type !== 'token')) throw new Error(tag + ' token off field in ' + z); }
    for (const k in P.circles) { const i = P.circles[k]; if (!i) continue; if (seen.has(i)) throw new Error(tag + ' dup circle'); seen.add(i); const c = G.cards[i]; if (c.pos !== k) throw new Error(tag + ' pos mismatch'); if (!c.token) n++; }
    if (n !== P.total) throw new Error(tag + ' card count ' + n + ' for p' + p + ' expected ' + P.total);
    if (P.energy < 0 || P.energy > 10) throw new Error(tag + ' energy ' + P.energy);
    if (P.damage.length > G.loseAt(P.idx)) throw new Error(tag + ' damage>' + G.loseAt(P.idx));   // some cards make the losing count seven
  }
}
export function mulb(a) { return () => { let t = (a += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function randomAnswer(G, rng) {
  const d = G.pending;
  const k = d.min + Math.floor(rng() * (Math.min(d.max, d.min + 2) - d.min + 1));
  const idx = d.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  let sel = idx.slice(0, k);
  if (d.kind === 'main' && rng() < 0.35) sel = [d.options.findIndex(o => o.a === 'next')];
  if (d.kind === 'main' && d.options[sel[0]].a === 'move' && rng() < 0.8) sel = [d.options.findIndex(o => o.a === 'next')];
  if (d.kind === 'guard' && G.guardBadSel(d, sel)) sel = sel.filter(i => d.options[i].a !== 'guard');
  return sel;
}
export function play(cfg, opts = {}) {
  const G = new VG.Game(cfg).start();
  for (const P of G.players) P.total = Object.values(G.cards).filter(c => c.owner === P.idx && !c.token).length;
  let steps = 0; const stats = { abilities: {} };
  while (G.pending) {
    const sel = opts.random ? randomAnswer(G, opts.rng) : VG.bot(G);
    G.answer(sel);
    for (const e of G.events) if (e.t === 'ability') { const k = e.no + '#' + (e.idx ?? 'play'); stats.abilities[k] = (stats.abilities[k] || 0) + 1; }
    G.events.length = 0;
    if (!opts.noInv) invariants(G, 'seed ' + cfg.seed + ' step ' + steps);
    if (++steps > (opts.max || 8000)) { if (process.env.DBG) { console.log('turn', G.turnNo, 'phase', G.phase, 'pending', JSON.stringify({ kind: G.pending.kind, title: G.pending.title, n: G.pending.options.length, o: G.pending.options.slice(0, 6) }).slice(0, 700)); const pick = VG.bot(G); console.log('bot picks', JSON.stringify(pick), JSON.stringify(pick.map(i => G.pending.options[i])), pick.map(i => { const o = G.pending.options[i]; return o && o.iid != null ? G.def(G.cards[o.iid]).name + ' @' + G.cards[o.iid].zone : ''; }).join(',')); } throw new Error('seed ' + cfg.seed + ' did not finish'); }
  }
  if (!G.over) throw new Error('ended without result, seed ' + cfg.seed);
  if (!opts.noReplay) { const R = VG.Game.replay(cfg, G.history); if (!R.over || R.over.winner !== G.over.winner || R.turnNo !== G.turnNo) throw new Error('replay mismatch seed ' + cfg.seed); }
  return { G, steps, stats };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  for (const id in VG.DECKS) { const e = VG.checkDeck(VG.DECKS[id]); if (e.length) { console.error('DECK ILLEGAL', id, e); process.exit(1); } }
  const N = +process.argv[2] || 300;
  const pairs = [['1MCW2', 'TD01'], ['TD01', '1MCW2'], ['1MCW2', '1MCW2'], ['TD01', 'TD01']];
  const agg = { abilities: {}, turns: 0, games: 0, reasons: {}, steps: 0 };
  for (const mode of ['bot', 'random']) for (const [a, b] of pairs) {
    const w = [0, 0];
    for (let s = 1; s <= N; s++) {
      const cfg = { seed: s * 7919 + (mode === 'bot' ? 0 : 13), players: [{ name: 'A', deck: VG.DECKS[a] }, { name: 'B', deck: VG.DECKS[b] }] };
      const { G, steps, stats } = play(cfg, mode === 'random' ? { random: true, rng: mulb(s) } : {});
      w[G.over.winner]++; agg.turns += G.turnNo; agg.games++; agg.steps += steps; agg.reasons[G.over.reason] = (agg.reasons[G.over.reason] || 0) + 1;
      for (const k in stats.abilities) agg.abilities[k] = (agg.abilities[k] || 0) + stats.abilities[k];
    }
    console.log(mode.padEnd(6), a.padEnd(6), 'vs', b.padEnd(6), 'wins', w.join(' / '));
  }
  console.log('games', agg.games, 'avg turns', (agg.turns / agg.games).toFixed(1), 'avg decisions', (agg.steps / agg.games).toFixed(0), 'end reasons', agg.reasons);
  const all = [];
  for (const id of ['1MCW2', 'TD01']) { const d = VG.DECKS[id]; for (const no of [...d.ride, ...d.main.map(e => e.no)]) (VG.card(no).abilities || []).forEach((ab, i) => { if (ab.type !== 'cont' && !all.includes(no + '#' + i)) all.push(no + '#' + i); }); }
  const unused = all.filter(k => !agg.abilities[k]);
  if (unused.length) { console.log('NEVER FIRED:', unused.map(k => k + ' ' + VG.card(k.split('#')[0]).name)); process.exitCode = 2; } else console.log('every scripted ability in both decks fired at least once (' + all.length + ')');
}
