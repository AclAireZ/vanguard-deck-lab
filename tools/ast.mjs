// Prints the structured form of a card as the game holds it: node tools/ast.mjs <regexp on name>…
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
VG.loadDB(JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(U('../src/jp.json'), 'utf8')));
for (const a of process.argv.slice(2)) { const re = new RegExp(a, 'i'); for (const r of VG.DB.rows.filter(r => r.jno && re.test(r.name)).slice(0, 6)) console.log(r.name + ' | ' + r.t + ' g' + r.grade + ' | ' + (r.nation || '-') + ' | ' + (r.race || '-') + '\n   ' + JSON.stringify(r.ast)); }
