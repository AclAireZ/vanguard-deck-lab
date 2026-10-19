// Looks cards up in the pool: node tools/q.mjs <regexp on name / race / tags> [more regexps…]   → name | type grade | nation | race | tags
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
VG.loadDB(JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(U('../src/jp.json'), 'utf8')));
for (const a of process.argv.slice(2)) {
  const re = new RegExp(a, 'i'); const hit = VG.DB.rows.filter(r => r.jno && (re.test(r.name) || re.test(r.race || '') || (r.ast && r.ast.tg || []).some(t => re.test(t))));
  console.log('== ' + a + ': ' + hit.length);
  for (const r of hit.slice(0, 14)) console.log('  ' + r.name + ' | ' + r.t + ' g' + r.grade + ' | ' + (r.nation || '-') + ' | ' + (r.race || '-') + (r.ast && r.ast.tg ? ' | tags ' + r.ast.tg.join(',') : ''));
}
