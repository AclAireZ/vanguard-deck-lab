// Fuzz for overDress: decks made of every card with overDress / X-overDress plus the units they are stacked on, played with random answers and by the bot.
// The usual invariants apply (every card stays in exactly one place); also counts how often an overDress happened and checks host/dress links after every answer.
import { mulb, randomAnswer } from './sim.mjs';
const VG = globalThis.VG; const N = +process.argv[2] || 150;
const rows = VG.DB.rows.filter(r => r.nation === 'Dragon Empire');
const od = rows.filter(r => r.ast && r.ast.od);
const names = new Set(); const races = new Set();
for (const r of od) for (const p of r.ast.od.p) for (const f of (p.f.or || [p.f])) { if (f.nm) names.add(f.nm); if (f.rc) races.add(f.rc); }
const base = rows.filter(r => r.t === 'U' && !r.trig && (names.has(r.name) || [...races].some(k => (r.race || '').toLowerCase().includes(k))) && r.grade <= 2);
const trig = rows.filter(r => r.trig && r.trig !== 'over' && r.kind === 'v'); const heal = trig.find(r => r.trig === 'heal'); const crit = trig.find(r => r.trig === 'crit');
const ride = [0, 1, 2, 3].map(g => rows.find(r => r.t === 'U' && r.grade === g && !r.trig && r.kind === (g ? '' : 'g') && (g === 0 || (r.auto && !r.part))) || rows.find(r => r.t === 'U' && r.grade === g && !r.trig));
function deck(rng) {
  const main = [{ no: heal.no, n: 4 }, { no: crit.no, n: 12 }]; let n = 16; const pick = a => a[Math.floor(rng() * a.length)]; const seen = new Set([heal.no, crit.no]);
  const add = (r, k) => { if (seen.has(r.no) || n >= 50) return; k = Math.min(k, 50 - n); seen.add(r.no); main.push({ no: r.no, n: k }); n += k; };
  for (const b of base.filter(r => names.has(r.name))) add(b, 4);
  for (let g = 0; g < 200 && n < 50; g++) add(rng() < 0.6 ? pick(od) : pick(base), 1 + Math.floor(rng() * 3));
  for (const r of rows) { if (n >= 50) break; if (r.t === 'U' && !r.trig && r.auto && !r.part && r.grade <= 2) add(r, 4); }
  return { id: 'od', name: 'overDress', ride: ride.map(r => r.no), main, nation: 'Dragon Empire' };
}
let games = 0, ods = 0, xods = 0, moved = 0;
for (let s = 1; s <= N; s++) {
  const rng = mulb(s * 17 + 3); const cfg = { seed: s * 7919, players: [{ name: 'A', deck: deck(rng) }, { name: 'B', deck: deck(rng) }] };
  for (const mode of ['random', 'bot']) {
    const G = new VG.Game(cfg).start(); const total = Object.values(G.cards).filter(c => !c.token).length; const r2 = mulb(s + 5); let steps = 0;
    while (G.pending) {
      const d = G.pending; let sel = mode === 'random' ? randomAnswer(G, r2) : VG.bot(G);
      // the random player likes to call on top of its own units, and says yes to overDress
      if (mode === 'random' && d.kind === 'main') { const c = d.options.map((o, i) => [o, i]).filter(([o]) => o.a === 'call' && G.odPlan(d.player, G.cards[o.iid], o.circle)); if (c.length && r2() < 0.7) sel = [c[Math.floor(r2() * c.length)][1]]; }
      if (d.kind === 'yesno' && /overDress/.test(d.title || '')) sel = [r2() < 0.85 ? 0 : 1];
      G.answer(sel);
      for (const e of G.events) if (e.t === 'move' && e.to === 'RC' && e.od) { if (e.od === 'x') xods++; else ods++; }
      for (const e of G.events) if (e.t === 'move' && e.reason === 'dress') moved++;
      G.events.length = 0;
      let live = 0;
      for (const k in G.cards) { const c = G.cards[k]; if (c.token || c.zone === 'gone') { if (!c.token) live++; continue; } live++;
        if (c.zone === 'dress') { const h = G.cards[c.host]; if (!h || !(h.zone === 'RC' || h.zone === 'VC' || h.zone === 'GC') || !(h.dress || []).includes(c.iid)) throw new Error('seed ' + cfg.seed + ' ' + mode + ': originalDress without its unit: ' + G.name(c)); if (!G.players[c.owner].dress.includes(c.iid)) throw new Error('not in the dress list'); }
        else if (c.host != null) throw new Error('seed ' + cfg.seed + ': host left on a card in ' + c.zone);
        for (const i of (c.dress || [])) if (G.cards[i].zone !== 'dress' || G.cards[i].host !== c.iid) throw new Error('seed ' + cfg.seed + ' ' + mode + ': broken dress link under ' + G.name(c));
        if ((c.dress || []).length && !(c.zone === 'RC' || c.zone === 'VC' || c.zone === 'GC')) throw new Error('seed ' + cfg.seed + ': dress kept outside the field');
      }
      if (live !== total) throw new Error('seed ' + cfg.seed + ': card count ' + live + ' != ' + total);
      if (++steps > 20000) throw new Error('seed ' + cfg.seed + ' did not finish');
    }
    games++;
  }
}
console.log('overDress cards', od.length, '| stacked-on candidates', base.length, '| games ok', games, '| overDress', ods, '| X-overDress', xods, '| originalDress that left with their unit', moved);
if (!ods || !xods || !moved) { console.log('NOT EXERCISED'); process.exitCode = 1; }
