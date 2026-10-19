// Coverage report for the skill compiler: how many cards compile fully, and which unparsed fragments block the most cards.
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) if (r.name && !byName.has(r.name)) byName.set(r.name, r);
const R = [...byName.values()].filter(r => /Unit|Order/.test(r.type) || (r.type === '' && /Power \d/.test(r.power)));
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const gen = s => s.replace(/«\d+»/g, '«N»').replace(/\d[\d,]*/g, '#');
let ok = 0, empty = 0; const single = {}, any = {}, why = {}; const okCards = [];
for (const r of R) {
  if (!r.effect || r.effect.trim() === '-' || !r.effect.trim()) { empty++; continue; }
  let res; try { res = compileCard(r, races); } catch (e) { console.error('CRASH', r.name, e.stack.split('\n').slice(0, 3).join(' | ')); continue; }
  if (res.ast) { if (res.ast.a.length || res.ast.p || res.ast.o) { ok++; okCards.push(r.name); } else empty++; continue; }
  const keys = [...new Set(res.fail.map(f => f.why + ' :: ' + gen(f.at).slice(0, 110)))];
  for (const k of keys) any[k] = (any[k] || 0) + 1;
  if (keys.length === 1) single[keys[0]] = (single[keys[0]] || 0) + 1;
  for (const f of res.fail) why[f.why] = (why[f.why] || 0) + 1;
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => String(v).padStart(4) + ' | ' + k).join('\n');
console.log('cards with skills:', R.length - empty, '| compiled fully:', ok, '(' + (ok / (R.length - empty) * 100).toFixed(1) + '%) | no skill text:', empty);
console.log('fail kinds', JSON.stringify(why));
const mode = process.argv[2] || 'single'; const n = +process.argv[3] || 60; const filt = process.argv[4];
const src = mode === 'any' ? any : single; const view = filt ? Object.fromEntries(Object.entries(src).filter(([k]) => k.startsWith(filt))) : src;
console.log('--- top blockers (' + mode + ')\n' + top(view, n));
if (mode === 'find') { const q = process.argv[3]; let k = 0; for (const r of R) { const res = compileCard(r, races); if (res.fail && res.fail.some(f => gen(f.at).includes(q) || f.at.includes(q))) { console.log('\n# ' + r.name + ' [' + r.type + ']\n' + res.fail.map(f => '  ' + f.why + ' @ ' + f.at.slice(0, 200)).join('\n')); if (++k >= (+process.argv[4] || 6)) break; } } }
