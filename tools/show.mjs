// Review helper: prints a card's wording next to what the compiler understood (structured form + the Thai text players will see).
// usage: node tools/show.mjs rand [n] [seed]   |   node tools/show.mjs "<name fragment>"
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8')));
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (!c || (r.effect || '').length > (c.effect || '').length) byName.set(r.name, r); }
const rows = VG.DB.rows.filter(r => r.beta && (process.env.PART ? r.part : true));
let pick;
if (process.argv[2] === 'rand') { let a = +process.argv[4] || 1; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; pick = Array.from({ length: +process.argv[3] || 10 }, () => rows[Math.floor(rnd() * rows.length)]); }
else pick = rows.filter(r => r.name.toLowerCase().includes((process.argv[2] || '').toLowerCase())).slice(0, +process.argv[3] || 5);
for (const r of pick) {
  const d = VG.card(r.no);
  console.log('\n# ' + r.name + '  [' + r.t + ' g' + r.grade + ']\n' + (byName.get(r.name).effect || '').trim().split('\n').map(l => '   EN ' + l.trim()).join('\n'));
  console.log(d.text.map(t => '   TH ' + t).join('\n'));
  if (process.env.AST) console.log('   ' + JSON.stringify(r.ast));
}
