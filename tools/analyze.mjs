import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) if (r.name && !byName.has(r.name)) byName.set(r.name, r);
const R = [...byName.values()];
const norm = s => (s || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/（/g, '(').replace(/）/g, ')').replace(/[ \t]+/g, ' ').trim();
const lines = [];
for (const r of R) for (const l of norm(r.effect).split('\n')) { const t = l.trim(); if (t && t !== '-') lines.push({ t, r }); }
console.log('cards', R.length, 'lines', lines.length);
const head = {}; for (const { t } of lines) { const m = /^(\[[A-Za-z]+\]|\([^)]{0,30}|[A-Za-z]+ [A-Za-z]+)/.exec(t); const k = m ? m[1].slice(0, 24) : t.slice(0, 16); head[k] = (head[k] || 0) + 1; }
console.log(Object.entries(head).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => v + ' ' + k).join('\n'));
const gen = s => s.replace(/"[^"]*"/g, '"N"').replace(/\d[\d,]*/g, '#');
const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => v + ' | ' + k).join('\n');
const hdr = {}, trig = {}; let nAuto = 0;
for (const { t } of lines) { const m = /^・?\[(AUTO|ACT|CONT)\]\s*((?:[A-Z][a-z]+ Row ?)?(?:\([A-Za-z/ ]+\)(?:\/\([A-Za-z/ ]+\))*)?)\s*(\[1\/[Tt]urn\])?\s*:\s*(.*)$/.exec(t); if (!m) continue; const k = m[1] + ' ' + m[2] + (m[3] ? ' 1/turn' : ''); hdr[k] = (hdr[k] || 0) + 1; if (m[1] === 'AUTO') { nAuto++; const body = m[4]; const c = /^((?:When|At|During)[^,]*),/.exec(body); const tk = gen(c ? c[1] : body.slice(0, 40)); trig[tk] = (trig[tk] || 0) + 1; } }
if (process.argv[2] === 'hdr') { console.log('--- headers\n' + top(hdr, 50)); }
if (process.argv[2] === 'trig') { console.log('--- auto triggers (' + nAuto + ', distinct ' + Object.keys(trig).length + ')\n' + top(trig, +process.argv[3] || 120)); let cum = 0, tot = 0; const arr = Object.values(trig).sort((a, b) => b - a); for (const v of arr) tot += v; for (let i = 0; i < arr.length; i++) { cum += arr[i]; if ([20, 50, 100, 200, 400].includes(i + 1)) console.log('top', i + 1, 'cover', (cum / tot * 100).toFixed(1) + '%'); } }
if (process.argv[2] === 'cost') {
  const costs = {}, parts = {};
  for (const { t } of lines) for (const m of t.matchAll(/\[COST\]\[((?:[^\[\]]|\[[^\]]*\])*)\]/g)) { const k = gen(m[1]); costs[k] = (costs[k] || 0) + 1; for (const p of m[1].split(/\s*(?:&|, and | and (?=\[)|,(?= \[))\s*/)) { const pk = gen(p.trim()); parts[pk] = (parts[pk] || 0) + 1; } }
  console.log('--- whole costs distinct', Object.keys(costs).length, '\n--- cost parts distinct', Object.keys(parts).length, '\n' + top(parts, +process.argv[3] || 100));
  let cum = 0, tot = 0; const arr = Object.values(parts).sort((a, b) => b - a); for (const v of arr) tot += v; for (let i = 0; i < arr.length; i++) { cum += arr[i]; if ([10, 20, 40, 80, 160].includes(i + 1)) console.log('top', i + 1, 'cover', (cum / tot * 100).toFixed(1) + '%'); }
}
if (process.argv[2] === 'eff' || process.argv[2] === 'cond') {
  const steps = {}, conds = {}, whole = {};
  for (const { t } of lines) {
    const m = /^・?\[(AUTO|ACT|CONT)\][^:]*:\s*(.*)$/.exec(t); if (!m) continue;
    let b = m[2];
    if (m[1] === 'AUTO') { const c = /^((?:When|At)[^,]*),\s*/.exec(b); if (c) b = b.slice(c[0].length); }
    for (let g = 0; g < 3; g++) { const c = /^(if [^,]*(?:, (?:and|or) [^,]*)?),\s*/.exec(b); if (!c) break; const ck = gen(c[1]); conds[ck] = (conds[ck] || 0) + 1; b = b.slice(c[0].length); }
    b = b.replace(/^\[COST\]\[((?:[^\[\]]|\[[^\]]*\])*)\],?\s*(and\s+)?/, '');
    b = b.replace(/\s*\([^()]*\)\s*$/, '');
    if (m[1] === 'CONT') continue;
    const wk = gen(b); whole[wk] = (whole[wk] || 0) + 1;
    for (const s of b.split(/\s*(?:, and |\. (?=[A-Z])|, (?=(?:choose|draw|search|look|call|this unit|it gets|retire|reveal|put|shuffle|\[)))\s*/)) { const sk = gen(s.replace(/\.$/, '').trim()); if (sk) steps[sk] = (steps[sk] || 0) + 1; }
  }
  const show = (name, o, n) => { console.log('--- ' + name + ' distinct', Object.keys(o).length, '\n' + top(o, n)); let cum = 0, tot = 0; const arr = Object.values(o).sort((a, b) => b - a); for (const v of arr) tot += v; for (let i = 0; i < arr.length; i++) { cum += arr[i]; if ([20, 50, 100, 200, 400, 800].includes(i + 1)) console.log('top', i + 1, 'cover', (cum / tot * 100).toFixed(1) + '%'); } };
  if (process.argv[2] === 'eff') { show('steps', steps, +process.argv[3] || 150); }
  else show('conds', conds, +process.argv[3] || 100);
}
