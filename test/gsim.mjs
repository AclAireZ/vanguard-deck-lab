// G units: for every G unit, games with its nation's random deck and that G unit in the G zone (bot + random answers).
// Checks no crash, replay identical, and reports how often it strode and how often its own abilities fired.  node test/gsim.mjs [games per unit]
import { play, mulb } from './sim.mjs';
const VG = globalThis.VG; const N = +process.argv[2] || 6;
const rows = VG.DB.rows; const isG = r => r.t === 'X' && r.grade === 4 && r.power != null;
const ALLG = rows.filter(isG); const GU = ALLG.filter(r => !process.argv[3] || new RegExp(process.argv[3], 'i').test(r.name)); const byNation = {}; for (const r of rows) { if (!r.nation || r.t === 'C' || r.t === 'X') continue; (byNation[r.nation] = byNation[r.nation] || []).push(r); }
function deck(nation, rng, gno, hint) {
  const L = byNation[nation]; const pick = a => a[Math.floor(rng() * a.length)];
  const rp = g => { const a = L.filter(r => r.t === 'U' && r.grade === g && !r.trig); const h = hint && g === 3 ? a.filter(hint) : []; return pick(h.length ? h : a).no; }; const ride = [0, 1, 2, 3].map(rp);
  const main = []; const add = (r, n) => { const e = main.find(x => x.no === r.no); const lim = Math.min(4, r.lim || 4); if (e) { const k = Math.min(n, lim - e.n); e.n += k; return k; } const k = Math.min(n, lim); main.push({ no: r.no, n: k }); return k; };
  let t = 0; const trig = L.filter(r => r.trig && r.trig !== 'over'); t += add(pick(trig.filter(r => r.trig === 'heal')), 4);
  for (let g = 0; t < 16 && g < 300; g++) { const r = pick(trig); if (r.trig === 'heal') continue; t += add(r, Math.min(4, 16 - t)); }
  let n = t; const units = L.filter(r => r.t === 'U' && !r.trig && r.grade <= 3 && !r.flags.includes('s')); const g3a = units.filter(r => r.grade === 3); const g3h = hint ? g3a.filter(hint) : []; const g3 = g3h.length ? g3h : g3a;
  n += add(pick(g3), 4); n += add(pick(g3), 4);   // grade 3s to pay the stride cost
  for (let g = 0; n < 50 && g < 600; g++) n += add(pick(units), Math.min(1 + Math.floor(rng() * 4), 50 - n));
  const others = ALLG.filter(r => r.nation === nation && r.no !== gno); const gz = [{ no: gno, n: 4 }]; for (let k = 0; k < 8 && others.length; k++) { const r = pick(others); const e = gz.find(x => x.no === r.no); if (e) { if (e.n < 4) e.n++; } else gz.push({ no: r.no, n: 1 }); }
  return { id: 'gz', name: nation, ride, main, nation, g: gz };
}
let bad = 0; const out = [];
for (const u of GU) {
  let ok = 0, strode = 0, fired = 0; const errs = [];
  for (let s = 1; s <= N; s++) {
    const rng = mulb(s * 977 + u.no.length);
    const ast = u.ast || {}; const nh = ast.scost && ast.scost.nh; const hint = nh ? r => r.name.includes(nh) : ast.strideIf && ast.strideIf.ico ? r => (r.icon || '').includes(ast.strideIf.ico) || /chrono/i.test(r.name) : /ritual|luard|ogma/i.test(u.name) ? r => /luard|ritual|draganger|dragritter/i.test(r.name) : null;
    const A = deck(u.nation, rng, u.no, hint), B = deck(u.nation, rng, u.no, hint);
    for (const mode of ['bot', 'random']) {
      const cfg = { seed: s * 7331 + (mode === 'bot' ? 1 : 2), players: [{ name: 'A', deck: A }, { name: 'B', deck: B }] };
      try {
        const { G, stats } = play(cfg, mode === 'random' ? { random: true, rng: mulb(s + 5), max: 30000 } : { max: 30000 }); ok++;
        if (Object.values(G.cards).some(c => c.no && VG.canon(c.no) === VG.canon(u.no) && c.faceup && (c.zone === 'gzone' || c.zone === 'VC'))) strode++;
        for (const k in stats.abilities) if (VG.canon(k.split('#')[0]) === VG.canon(u.no)) fired += stats.abilities[k];
      } catch (e) { bad++; errs.push(mode + ' s' + s + ': ' + String(e.message).slice(0, 120) + ' @ ' + (String(e.stack).split('\n').find(l => /src\//.test(l)) || '').trim().replace(/.*src\//, '').slice(0, 50)); }
    }
  }
  out.push((errs.length ? 'FAIL ' : 'ok   ') + u.name.padEnd(48).slice(0, 48) + ' games ' + ok + ' · strode in ' + strode + ' · its abilities fired ' + fired + (errs.length ? '\n      ' + errs.slice(0, 3).join('\n      ') : ''));
}
console.log(out.join('\n')); console.log(bad ? 'G UNITS FAILED (' + bad + ')' : 'g units ok'); if (bad) process.exitCode = 1;
