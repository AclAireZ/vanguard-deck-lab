// Fragments that are the ONLY thing stopping a card (cheapest wins). node tools/single.mjs [words] [top]
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const base = JSON.parse(fs.readFileSync(new URL('../data/base-db.json', import.meta.url), 'utf8'));
const hand = new Set(base.rows.filter(r => r[10]).map(r => r[1]));
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const gen = s => s.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#');
const W = +process.argv[2] || 8, TOP = +process.argv[3] || 120; const g = {}; let n = 0;
const SET = process.env.SET ? new RegExp(process.env.SET) : null; const ALL = !!process.env.ALL;
for (const r of byName.values()) {
  if (hand.has(r.name) || !r.effect || r.effect.trim() === '-') continue;
  if (SET && ![r.no, ...(r.nos || [])].some(x => SET.test(x))) continue;
  const res = compileCard(r, races); if (!res.fail || (!ALL && res.fail.length !== 1)) continue; n++;
  const seen = new Set(); for (const f of res.fail) { const k = f.why + ' :: ' + gen(f.at).trim().split(/\s+/).slice(0, W).join(' '); if (seen.has(k)) continue; seen.add(k); g[k] = (g[k] || 0) + 1; }
}
const rows = Object.entries(g).sort((a, b) => b[1] - a[1]);
console.log('cards with one failing line', n, '| distinct', rows.length);
console.log(rows.slice(0, TOP).map(([k, v]) => String(v).padStart(4) + ' | ' + k).join('\n'));
