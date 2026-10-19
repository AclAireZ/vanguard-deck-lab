// node tools/nm.mjs <name part> …  → pool rows (also those without a JP number) whose name contains the part
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
VG.loadDB(JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(U('../src/jp.json'), 'utf8')));
for (const a of process.argv.slice(2)) { const hit = VG.DB.rows.filter(r => r.name.toLowerCase().includes(a.toLowerCase())); console.log('== ' + a + ': ' + hit.length); for (const r of hit.slice(0, 8)) console.log('  ' + r.no + ' | ' + r.name + ' | ' + r.t + ' g' + r.grade + ' p' + r.power + ' | ' + (r.nation || '-') + ' | ' + (r.race || '-') + ' | jno ' + (r.jno || '-') + ' | auto ' + r.auto + ' part ' + r.part); }
