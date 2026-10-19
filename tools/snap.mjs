// Regression helper for the compiler: `node tools/snap.mjs save` stores every compiled card's structure; `node tools/snap.mjs diff [n]` shows cards whose structure changed or stopped compiling.
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const cur = {}; let total = 0;
for (const r of byName.values()) { if (!r.effect || r.effect.trim() === '-') continue; total++; let res; try { res = compileCard(r, races); } catch (e) { console.log('CRASH', r.name, e.message); continue; } if (res.ast) cur[r.name] = JSON.stringify(res.ast); }
const f = new URL('../data/snap.json', import.meta.url);
if (process.argv[2] === 'save') { fs.writeFileSync(f, JSON.stringify(cur)); console.log('saved', Object.keys(cur).length, 'of', total); }
else {
  const old = JSON.parse(fs.readFileSync(f, 'utf8')); let lost = 0, changed = 0, gained = 0; const n = +process.argv[3] || 8; const out = [];
  for (const k in old) { if (!cur[k]) { lost++; if (lost <= n) out.push('LOST    ' + k); } else if (cur[k] !== old[k]) { changed++; if (changed <= n) out.push('CHANGED ' + k + '\n   was ' + old[k].slice(0, 400) + '\n   now ' + cur[k].slice(0, 400)); } }
  for (const k in cur) if (!old[k]) { gained++; if (process.env.GAIN) out.push('GAINED  ' + k + '  ' + cur[k].slice(0, +process.env.GAIN > 1 ? +process.env.GAIN : 260)); }
  console.log(out.join('\n')); console.log('compiled', Object.keys(cur).length, 'of', total, '(' + (Object.keys(cur).length / total * 100).toFixed(1) + '%) | gained', gained, '| lost', lost, '| changed', changed);
}
