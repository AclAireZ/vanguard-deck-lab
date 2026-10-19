// node tools/cat.mjs "<why>" [words] [top] → all failing fragments of one kind (cost, cond, trigger, step, …), most common first. env SET, NOSP=1 (skip cards with special mechanics)
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const SET = process.env.SET ? new RegExp(process.env.SET) : null; const why = process.argv[2]; const W = +process.argv[3] || 12, TOP = +process.argv[4] || 80;
const gen = s => s.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#'); const g = {}; let n = 0;
for (const r of byName.values()) { if (!r.effect || r.effect.trim() === '-') continue; if (SET && ![r.no, ...(r.nos || [])].some(x => SET.test(x))) continue; const res = compileCard(r, races); if (!res.fail) continue; const seen = new Set();
  for (const f of res.fail) { if (f.why !== why) continue; const k = gen(f.at).trim().split(/\s+/).slice(0, W).join(' '); if (seen.has(k)) continue; seen.add(k); g[k] = (g[k] || 0) + 1; n++; } }
const rows = Object.entries(g).sort((a, b) => b[1] - a[1]);
console.log(why, 'fails', n, '| distinct', rows.length); console.log(rows.slice(0, TOP).map(([k, v]) => String(v).padStart(3) + ' | ' + k).join('\n'));
