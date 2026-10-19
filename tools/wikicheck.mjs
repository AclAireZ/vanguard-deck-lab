// How close is the wiki's wording (after tools/wikitext.mjs) to the official list's wording, for cards present in both?
// node tools/wikicheck.mjs            → totals;   node tools/wikicheck.mjs diff [n]  → first differing lines;   node tools/wikicheck.mjs marks → unknown templates
import fs from 'node:fs';
import { canonLines, compileCard } from './skillc.mjs';
import { wikiToPlain, makeStd } from './wikitext.mjs';
const U = f => new URL(f, import.meta.url);
const wk = JSON.parse(fs.readFileSync(U('../data/wiki.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(U('../data/raw.json'), 'utf8')).recs;
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const by = new Map(); for (const r of raw) { const c = by.get(r.name); if (!c || (r.effect || '').length > (c.effect || '').length) by.set(r.name, r); }
const key = e => { const c = canonLines(e); return c.lines.map(l => l.replace(/«(\d+)»/g, (m, i) => '"' + c.names[+i] + '"').replace(/[.\s]+$/, '').replace(/\s+/g, ' ')).join('\n'); };
const eff = n => (by.get(n) || {}).effect || ''; const std = makeStd(eff);
let risk = 0, lost = 0, gained = 0;
const mode = process.argv[2]; const lim = +process.argv[3] || 25;
let both = 0, same = 0, sameAst = 0, shown = 0; const marks = {};
for (const w of wk) {
  const r = by.get(w.t); if (!r) continue; const off = (r.effect || '').trim(); if (!off || off === '-' || !w.e) continue;
  both++;
  const plain = wikiToPlain(w.e, w.t, std);
  for (const m of plain.matchAll(/⟦([^|⟧\n]{1,30})[|⟧]/g)) marks[m[1]] = (marks[m[1]] || 0) + 1;
  const a = key(plain), b = key(off);
  if (a === b) { same++; sameAst++; continue; }
  let x, y; try { x = JSON.stringify(compileCard({ name: w.t, type: r.type, effect: plain }, races).ast || null); } catch (e) { x = 'crash'; }
  try { y = JSON.stringify(compileCard(r, races).ast || null); } catch (e) { y = 'crash2'; }
  if (x === y) sameAst++;
  else { if (x !== 'null' && y !== 'null') risk++; else if (x === 'null') lost++; else gained++; }
  if (x !== y && (mode === 'diff' || (mode === 'risk' && x !== 'null' && y !== 'null')) && shown < lim) {
    const al = a.split('\n'), bl = b.split('\n'); const i = al.findIndex((l, k) => l !== bl[k]);
    shown++; console.log('— ' + w.t + '\n  W: ' + (al[i] || '(none)').slice(0, 300) + '\n  R: ' + (bl[i] || '(none)').slice(0, 300));
  }
}
console.log(JSON.stringify({ both, sameText: same, sameResult: sameAst, pct: Math.round(sameAst / both * 1000) / 10, differentResult: risk, wikiFailsOfficialWorks: lost, wikiWorksOfficialFails: gained }));
if (mode === 'marks') console.log(Object.entries(marks).sort((a, b) => b[1] - a[1]).map(x => x.join(':')).join(' '));
