// Coarser view of compiler failures: groups by the first few words so structural gaps stand out.
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) if (r.name && !byName.has(r.name)) byName.set(r.name, r);
const R = [...byName.values()].filter(r => /Unit|Order/.test(r.type) || (r.type === '' && /Power \d/.test(r.power)));
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const gen = s => s.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#');
const W = +process.argv[3] || 5; const cat = process.argv[2] || 'step'; const g = {}; const ex = {};
for (const r of R) { const res = compileCard(r, races); if (!res.fail) continue; const seen = new Set(); for (const f of res.fail) { if (f.why !== cat) continue; const k = gen(f.at).trim().split(/\s+/).slice(0, W).join(' '); if (seen.has(k)) continue; seen.add(k); g[k] = (g[k] || 0) + 1; (ex[k] = ex[k] || []).push(gen(f.at).slice(0, 150)); } }
const rows = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, +process.argv[4] || 60);
for (const [k, v] of rows) { console.log(String(v).padStart(4) + ' | ' + k); if (process.argv[5]) for (const e of [...new Set(ex[k])].slice(0, +process.argv[5])) console.log('         · ' + e); }
