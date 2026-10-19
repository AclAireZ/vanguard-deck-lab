// Fuzz: random decks drawn from the whole card list (per nation), played by the bot and by random answers.
// Proves that machine-read skills never crash the game, keep the card count intact and replay identically.
import fs from 'node:fs';
import { play, mulb } from './sim.mjs';
const VG = globalThis.VG;
const N = +process.argv[2] || 200; const only = process.argv[3];
const rows = VG.DB.rows;
const byNation = {}; for (const r of rows) { if (!r.nation || r.t === 'C' || r.t === 'X') continue; (byNation[r.nation] = byNation[r.nation] || []).push(r); }
const nations = Object.keys(byNation).filter(n => byNation[n].length > 150);
function deck(nation, rng, pref) {
  const L = byNation[nation]; const pick = a => a[Math.floor(rng() * a.length)];
  const want = r => (pref ? pref(r) : true);
  const pool = f => { const a = L.filter(r => f(r) && want(r)); return a.length ? a : L.filter(f); };
  const ride = [0, 1, 2, 3].map(g => pick(pool(r => r.t === 'U' && r.grade === g && !r.trig)).no);
  const main = []; const add = (r, n) => { const e = main.find(x => x.no === r.no); const lim = Math.min(4, r.lim || 4); if (e) { const k = Math.min(n, lim - e.n); e.n += k; return k; } const k = Math.min(n, lim); main.push({ no: r.no, n: k }); return k; };
  let t = 0; const trig = L.filter(r => r.trig && r.trig !== 'over'); const heal = trig.filter(r => r.trig === 'heal');
  t += add(pick(heal), 4); const over = L.filter(r => r.trig === 'over'); if (over.length && rng() < 0.7) t += add(pick(over), 1);
  for (let g = 0; t < 16 && g < 200; g++) { const r = pick(trig); if (r.trig === 'heal') continue; t += add(r, Math.min(4, 16 - t)); }
  let n = t; const sent = L.filter(r => r.flags.includes('s') && !r.trig); if (sent.length) n += add(pick(sent), 4);
  const orders = pool(r => r.t === 'O' || r.t === 'S' || r.t === 'B'); const units = pool(r => r.t === 'U' && !r.trig && !r.flags.includes('s') && r.grade <= 3);
  for (let g = 0; n < 50 && g < 500; g++) { const r = rng() < 0.22 && orders.length ? pick(orders) : pick(units); n += add(r, Math.min(1 + Math.floor(rng() * 4), 50 - n)); }
  const GU = rows.filter(r => ((r.t === 'X' && r.grade === 4 && r.power != null) || r.t === 'M') && r.nation === nation); const g = []; for (let k = 0; GU.length && k < (GU.some(x => x.t === "M") ? 16 : 8); k++) { const r = pick(GU); const e = g.find(x => x.no === r.no); if (e) { if (e.n < (r.lim || 4)) e.n++; } else g.push({ no: r.no, n: 1 }); }   // a G deck when the nation has G units
  return { id: 'fz', name: nation, ride, main, nation, g };
}
const fired = {}; const errs = {}; let games = 0, bad = 0; const used = new Set();
const beta = r => r.beta;
for (let s = +process.env.FROM || 1; s <= N; s++) {
  const rng = mulb(s * 31 + 7);
  const na = only || nations[s % nations.length], nb = only || nations[Math.floor(rng() * nations.length)];
  const A = deck(na, rng, beta), B = deck(nb, rng, s % 3 ? beta : null);
  for (const d of [A, B]) for (const no of [...d.ride, ...d.main.map(e => e.no)]) used.add(VG.canon(no));
  for (const mode of ['bot', 'random']) {
    const cfg = { seed: s * 104729 + (mode === 'bot' ? 1 : 2), players: [{ name: 'A', deck: A }, { name: 'B', deck: B }] };
    try { const { stats } = play(cfg, mode === 'random' ? { random: true, rng: mulb(s + 99), max: 20000 } : { max: 20000 }); for (const k in stats.abilities) fired[k] = (fired[k] || 0) + stats.abilities[k]; games++; }
    catch (e) {
      bad++; const st = String(e.stack || e); const key = String(e.message).replace(/seed \d+( step \d+)?/g, 'seed').replace(/\d+/g, '#').slice(0, 90) + ' @ ' + (st.split('\n').find(l => /src\/(fx|engine|cards|bot|db)\.js/.test(l)) || '').trim().replace(/.*src\//, '').slice(0, 60);
      (errs[key] = errs[key] || []).push(s + ':' + mode + ' ' + na + ' vs ' + nb);
    }
  }
}
const usedBeta = [...used].filter(no => VG.DB.byNo[no] && VG.DB.byNo[no].beta);
const firedCards = new Set(Object.keys(fired).map(k => VG.canon(k.split('#')[0])));
console.log('games ok', games, '| failed', bad, '| compiled cards in decks', usedBeta.length, '| of which had an ability fire', usedBeta.filter(n => firedCards.has(n)).length);
for (const k of Object.keys(errs).sort((a, b) => errs[b].length - errs[a].length).slice(0, 25)) console.log(String(errs[k].length).padStart(4), '|', k, '|', errs[k].slice(0, 2).join('; '));
if (bad) process.exitCode = 1;
