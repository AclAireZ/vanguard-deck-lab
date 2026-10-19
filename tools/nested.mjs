// Why do quoted (granted) abilities fail to compile? Lists the failing fragment inside the quotes.
import fs from 'node:fs';
import { canonLines, compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const g = {}; const seenTxt = new Set();
for (const r of byName.values()) {
  const { names } = canonLines(r.effect || '');
  for (const n of names) { if (!/^\[(AUTO|ACT|CONT)\]/i.test(n) || seenTxt.has(n)) continue; seenTxt.add(n);
    const res = compileCard({ effect: n, type: 'Normal Unit', name: 'x' }, races);
    if (res.fail) for (const f of res.fail) { const k = f.why + ' :: ' + f.at.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#').slice(0, 110); g[k] = (g[k] || 0) + 1; } }
}
console.log('distinct granted abilities', seenTxt.size);
console.log(Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, +process.argv[2] || 50).map(([k, v]) => String(v).padStart(4) + ' | ' + k).join('\n'));
