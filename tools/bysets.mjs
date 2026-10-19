// Coverage per set (first printing of each card): full / partial / none. node tools/bysets.mjs
import fs from 'node:fs';
const db = JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8'));
const g = {};
for (const r of db.rows) {
  const nos = [r[0], ...(r[12] || [])]; const sets = [...new Set(nos.map(n => String(n).split('/')[0]))];
  const st = r[10] ? 'full' : r[14] != null ? (db.asts[r[14]].miss ? 'part' : 'full') : 'none';
  for (const s of sets) { g[s] = g[s] || { full: 0, part: 0, none: 0 }; g[s][st]++; }
}
const rows = Object.entries(g).filter(([, v]) => v.full + v.part + v.none >= 20).sort((a, b) => a[0].localeCompare(b[0]));
console.log(rows.map(([s, v]) => { const t = v.full + v.part + v.none; return s.padEnd(12) + String(t).padStart(4) + '  full ' + String(Math.round(v.full / t * 100)).padStart(3) + '%  part ' + String(v.part).padStart(3) + '  none ' + String(v.none).padStart(3); }).join('\n'));
