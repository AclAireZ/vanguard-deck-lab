// node tools/kwx.mjs "<regex>" [n] [width] → failing fragments (generalised) around a keyword, most common first
import fs from 'node:fs';
import { canonLines, compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const re = new RegExp(process.argv[2], 'i'); const W = +process.argv[4] || 60; const g = {}; let cards = 0;
for (const r of byName.values()) {
  if (!r.effect) continue; const res = compileCard(r, races); if (!res.fail) continue; let hit = false;
  for (const f of res.fail) { const txt = f.line; let m; const rg = new RegExp('.{0,' + W + '}(?:' + process.argv[2] + ').{0,' + W + '}', 'gi'); while ((m = rg.exec(txt))) { hit = true; const k = m[0].replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#'); g[k] = (g[k] || 0) + 1; } }
  if (hit) cards++;
}
console.log('failing cards with a failing line mentioning it:', cards);
console.log(Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, +process.argv[3] || 30).map(([k, v]) => String(v).padStart(3) + ' | ' + k).join('\n'));
