// node tools/exl.mjs k "<fragment>" … → up to k failing abilities (whole line + card name) whose failing part contains the string. env SET=regex limits sets.
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const SET = process.env.SET ? new RegExp(process.env.SET) : null;
const all = []; for (const r of byName.values()) { if (!r.effect || r.effect.trim() === '-') continue; if (SET && ![r.no, ...(r.nos || [])].some(x => SET.test(x))) continue; const res = compileCard(r, races); if (res.fail) for (const f of res.fail) all.push([r.name, f]); }
const k = +process.argv[2] || 3; const W = +process.env.W || 420;
for (const q of process.argv.slice(3)) { const seen = new Set(); let n = 0, tot = 0; for (const [, f] of all) if ((f.why + ' :: ' + f.at).includes(q)) tot++; console.log('== ' + q + '  (' + tot + ')'); for (const [nm, f] of all) { if (!(f.why + ' :: ' + f.at).includes(q)) continue; const key = (f.line || '').replace(/«\d+»/g, '«N»').replace(/\d+/g, '#').slice(0, 60); if (seen.has(key)) continue; seen.add(key); console.log('   <' + nm + '> ' + String(f.line || f.at).slice(0, W)); if (++n >= k) break; } }
