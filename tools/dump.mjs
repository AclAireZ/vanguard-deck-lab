// Dumps every unparsed fragment (numbers/names generalised) to data/fails.txt, most common first, with counts. Optional arg: only cards without special-mechanic keywords.
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const SPECIAL = /overdress|\barm(s|ed)?\b|prison|dragontree|\bworld\b|dark night|abyssal|final rush|you are in "|gauge|\bsong|sing\b|sung|product|operate|memory|glitter|stride|g zone|g unit|g guardian|divine skill|revoldress|\bfriend\b|powerful|hollow|ticket|\bclan\b|legion|marker|imaginary|scout|alchemagic|limit break|generation break/i;
const gen = s => s.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#');
const W = +process.argv[2] || 9; const g = {}; let cards = 0, one = 0;
for (const r of byName.values()) {
  if (!r.effect || r.effect.trim() === '-') continue; if (SPECIAL.test(r.effect)) continue;
  const res = compileCard(r, races); if (!res.fail) continue; cards++; if (res.fail.length === 1) one++;
  const seen = new Set();
  for (const f of res.fail) { const k = f.why + ' :: ' + gen(f.at).trim().split(/\s+/).slice(0, W).join(' '); if (seen.has(k)) continue; seen.add(k); g[k] = (g[k] || 0) + 1; }
}
const rows = Object.entries(g).sort((a, b) => b[1] - a[1]);
fs.writeFileSync(new URL('../data/fails.txt', import.meta.url), rows.map(([k, v]) => String(v).padStart(4) + ' | ' + k).join('\n'));
console.log('plain failing cards', cards, '| with a single failing line', one, '| distinct fragments', rows.length);
