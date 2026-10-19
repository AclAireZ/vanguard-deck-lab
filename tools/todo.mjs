// Failing lines of the whole pool (English list + wiki rows), one entry per distinct canonical line: data/todo.json = [{ id, n (cards), why, at, line, ex (a card), kind }]
// node tools/todo.mjs            → rebuild data/todo.json and print totals;   node tools/todo.mjs show <from> <count> [why]  → print entries for reading
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const U = f => new URL(f, import.meta.url); const J = f => JSON.parse(fs.readFileSync(U(f), 'utf8'));
const raw = J('../data/raw.json').recs; const base = J('../data/base-db.json'); const x = fs.existsSync(U('../data/wiki-extra.json')) ? J('../data/wiki-extra.json') : { rows: [], recs: [] };
const fix = fs.existsSync(U('../data/fix-lines.json')) ? J('../data/fix-lines.json') : {};
const hand = new Set(base.rows.concat(x.rows).filter(r => r[10]).map(r => r[1]));
const byName = new Map(); for (const r of raw.concat(x.recs)) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw.concat(x.recs)) for (const k of (r.race || '').toLowerCase().split('/')) if (k && k !== '-') races.add(k.trim());
const pool = fs.existsSync(U('../data/jp-map.json')) ? new Set(Object.values(J('../data/jp-map.json'))) : null;
const g = new Map(); let cards = 0, failing = 0, full = 0;
for (const r of byName.values()) {
  if (hand.has(r.name) || !r.effect || r.effect.trim() === '-') continue; if (pool && !pool.has(r.name)) continue; cards++;
  let res; try { res = compileCard(r, races, fix); } catch (e) { res = { fail: [{ why: 'crash', at: e.message, line: '' }] }; }
  if (!res.fail) { full++; continue; } failing++;
  for (const f of res.fail) { if (!f.line) continue; let e = g.get(f.line); if (!e) { e = { n: 0, why: f.why, at: String(f.at || '').slice(0, 70), line: f.line, ex: r.name, kind: /order/i.test(r.type || '') ? 'O' : 'U' }; g.set(f.line, e); } e.n++; }
}
const list = [...g.values()].sort((a, b) => b.n - a.n || (a.line < b.line ? -1 : 1));
const old = fs.existsSync(U('../data/todo.json')) ? J('../data/todo.json') : null;
if (process.argv[2] !== 'show' || !old) { list.forEach((e, i) => { e.id = i; }); fs.writeFileSync(U('../data/todo.json'), JSON.stringify(list)); console.log(JSON.stringify({ cards, full, failing, distinctLines: list.length, chars: list.reduce((a, e) => a + e.line.length, 0) })); }
if (process.argv[2] === 'show') { const L = old || list; const from = +process.argv[3] || 0, cnt = +process.argv[4] || 50, why = process.argv[5]; const sel = (why ? L.filter(e => e.why === why) : L).filter(e => !fix[e.line]).slice(from, from + cnt); for (const e of sel) console.log(e.id + '\t' + e.kind + e.n + ' ' + e.why + ' @ ' + e.at.slice(0, 44) + '\n\t' + e.line); }
