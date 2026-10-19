// Why the wiki-sourced cards do not compile: node tools/wikifail.mjs [why] [n]
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const U = f => new URL(f, import.meta.url);
const x = JSON.parse(fs.readFileSync(U('../data/wiki-extra.json'), 'utf8')); const raw = JSON.parse(fs.readFileSync(U('../data/raw.json'), 'utf8')).recs;
const races = new Set(); for (const r of raw.concat(x.recs)) for (const k of (r.race || '').toLowerCase().split('/')) if (k && k !== '-') races.add(k.trim());
const kindOf = new Map(x.rows.map(r => [r[1], r[10]]));
const why = {}; const at = {}; const want = process.argv[2]; const lim = +process.argv[3] || 30; let shown = 0, n = 0, ok = 0, part = 0;
for (const r of x.recs) {
  if (kindOf.get(r.name) || !r.effect) continue; n++;
  let res; try { res = compileCard(r, races); } catch (e) { res = { fail: [{ why: 'crash', at: e.message }] }; }
  if (res.ast && !res.part) { ok++; continue; } if (res.part) part++;
  for (const f of res.fail || []) { const k = f.why || '?'; why[k] = (why[k] || 0) + 1; const a = String(f.at || '').slice(0, 46); (at[k] = at[k] || {})[a] = ((at[k] || {})[a] || 0) + 1; if (want === k && shown++ < lim) console.log(r.name + ' :: ' + String(f.at).slice(0, 200)); }
}
console.log(JSON.stringify({ n, ok, part }));
if (!want) for (const [k, v] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(String(v).padStart(5), k, ' e.g. ', Object.entries(at[k]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0] + ' ×' + e[1]).join(' ¦ '));
