// Unreadable lines of cards outside the Japanese pool (G units etc.): node tools/gl.mjs [card regexp]
import fs from 'node:fs';
const re = new RegExp(process.argv[2] || '.', 'i');
const FL = fs.readFileSync(new URL('../data/fails.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x)).filter(f => re.test(f.n));
const by = new Map(); for (const f of FL) { let e = by.get(f.k); if (!e) by.set(f.k, e = { f, cards: [] }); e.cards.push(f.n); }
for (const e of by.values()) console.log(e.f.k + ' {' + e.cards.join(' / ').slice(0, 60) + '} why=' + (e.f.why || '') + '\n  ' + e.f.l + (e.f.b ? '\n   ' + e.f.b.join('\n   ') : '') + (e.f.nm ? '\n   names ' + JSON.stringify(e.f.nm) : ''));
