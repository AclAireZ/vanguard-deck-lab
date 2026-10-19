// node tools/why.mjs "<card name>" ... → shows why a card fails to compile (or its structure)
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
for (const q of process.argv.slice(2)) for (const r of byName.values()) if (r.name === q || (q.length > 3 && r.name.toLowerCase().includes(q.toLowerCase()))) {
  const res = compileCard(r, races);
  console.log('# ' + r.name + '\n' + (res.ast ? '  OK ' + JSON.stringify(res.ast).slice(0, 900) : res.fail.map(f => '  ' + f.why + ' @ ' + f.at.slice(0, 220) + '\n      line: ' + f.line.slice(0, 260)).join('\n')));
}
