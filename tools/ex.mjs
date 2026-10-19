// node tools/ex.mjs k "<fragment>" "<fragment>" … → up to k distinct failing fragments (full text, numbers kept) containing each string
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const all = []; for (const r of byName.values()) { if (!r.effect || r.effect.trim() === '-') continue; const res = compileCard(r, races); if (res.fail) for (const f of res.fail) all.push(f); }
const k = +process.argv[2] || 3; const W = +process.env.W || 230;
for (const q of process.argv.slice(3)) { const seen = new Set(); let n = 0; console.log('== ' + q); for (const f of all) { if (!(f.why + ' :: ' + f.at).includes(q)) continue; const key = f.at.replace(/«\d+»/g, '«N»').replace(/\d+/g, '#').slice(0, 70); if (seen.has(key)) continue; seen.add(key); console.log('   [' + f.why + '] ' + f.at.slice(0, W)); if (++n >= k) break; } }
