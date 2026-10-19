// Lists the lines the reader cannot read yet (cards of the Japanese pool), one per distinct line, with the key for tools/hand-ast.txt.
// node tools/fl.mjs [regexp on line] [--from N] [--n N] [--why X] [--stat] [--card regexp] [--manual] [--one]
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
VG.loadDB(JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(U('../src/jp.json'), 'utf8')));
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf('--' + k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }; const flag = k => { const i = args.indexOf('--' + k); if (i < 0) return false; args.splice(i, 1); return true; };
const nationRe = (x => x ? new RegExp(x, 'i') : null)(opt('nation')); const bothF = flag('all'); const notRe = (x => x ? new RegExp(x, 'i') : null)(opt('not')); const from = +(opt('from') || 0), n = +(opt('n') || 60), why = opt('why'), cardRe = opt('card'), stat = flag('stat'), manual = flag('manual'), one = flag('one'), full = flag('full'), alpha = flag('alpha'), deferred = flag('deferred'), plain = flag('plain'); const re = args[0] ? new RegExp(args[0], 'i') : null;
const pool = new Map(VG.DB.rows.filter(r => r.jno).map(r => [r.name, r])); const poolRows = VG.DB.rows.filter(r => r.jno);
const FL = fs.readFileSync(U('../data/fails.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x)).filter(f => pool.has(f.n) && !(pool.get(f.n).auto && !pool.get(f.n).part));
const per = {}; for (const f of FL) per[f.n] = (per[f.n] || 0) + 1;
const by = new Map(); for (const f of FL) { let e = by.get(f.k); if (!e) by.set(f.k, e = { f, cards: [], as: 0 }); e.cards.push(f.n); if (f.as) e.as++; }
let list = [...by.values()];
if (stat) { const R = poolRows; console.log({ pool: R.length, full: R.filter(r => r.auto && !r.part).length, semi: R.filter(r => r.semi).length, part: R.filter(r => r.part && !r.semi).length, manual: R.filter(r => !r.auto).length, failingLines: FL.length, distinct: list.length, cardsWithLines: Object.keys(per).length, noLineManual: R.filter(r => !r.auto && !per[r.name]).length }); process.exit(0); }
if (re) list = list.filter(e => re.test(e.f.l) || (e.f.b || []).some(b => re.test(b)));
if (notRe) list = list.filter(e => !notRe.test(e.f.l + ' ' + (e.f.b || []).join(' ')));
if (why) list = list.filter(e => e.f.why === why);
if (cardRe) { const c = new RegExp(cardRe, 'i'); list = list.filter(e => e.cards.some(x => c.test(x))); }
if (nationRe) list = list.filter(e => e.cards.some(x => nationRe.test(pool.get(x).nation || '')));   // --nation regexp
if (manual) list = list.filter(e => e.cards.some(x => !pool.get(x).auto));
if (one) list = list.filter(e => e.cards.some(x => per[x] === 1));
const defer = new Set(fs.existsSync(U('./defer.txt')) ? fs.readFileSync(U('./defer.txt'), 'utf8').split(/\s+/).filter(Boolean) : []);
const both = bothF;   // --all: deferred and not deferred together
if (both) {} else if (!deferred) list = list.filter(e => !defer.has(e.f.k)); else list = list.filter(e => defer.has(e.f.k));
const body = l => l.replace(/^[^:]*:\s*/, '');
const SPECIAL = /special move|\bmemory\b|gauge|buddy|soulguard|penetrate|\bflag\b|counterattack|double attack|stride|g zone|\bhearts?\b|g guardian|generation break|prison|imprison|\barms?\b|armed|\bsongs?\b|music|\bsing|crest|clan|token|marker|\bstate\b|face (?:up|down)|legion|\bmate|limit break|world|night|friend|\bevent|alchemagic|overdress|originaldress|revoldress|delet|\block|meteor|deity|dragontree|\brunes?\b|mysteries|bullet|\bgene\b|astral|unmoor|hollow|operated|this attack is used|say |stand up!!|become|regarded|sweetlink|ticket|forge|glitter|power ?\d|skill ?\d|\bset order|\bblitz|regalis|malwyrm|dress|product|research|item|gem\b|trigger zone|damage check|ride deck|energy/;
if (plain) list = list.filter(e => !SPECIAL.test(e.f.l + ' ' + (e.f.b || []).join(' ') + ' ' + Object.values(e.f.nm || {}).join(' ')));
if (alpha) list.sort((a, b) => (body(a.f.l) < body(b.f.l) ? -1 : 1)); else list.sort((a, b) => b.cards.length - a.cards.length || (a.f.l < b.f.l ? -1 : 1));
console.log('distinct ' + list.length + ' (cards ' + new Set(list.flatMap(e => e.cards)).size + ') showing ' + from + '..' + (from + n));
for (const e of list.slice(from, from + n)) {
  const c = e.cards[0]; const r = pool.get(c);
  const nm = e.f.nm ? ' ⟪' + Object.entries(e.f.nm).map(([k, v]) => k + '=' + v).join(' ¦ ') + '⟫' : '';
  console.log(e.f.k + (e.cards.length > 1 ? ' x' + e.cards.length : '') + (e.f.t && /order/i.test(e.f.t) ? ' ORD' : '') + ' {' + c.slice(0, 30) + (full ? ' ' + r.no + ' g' + r.grade : '') + '} ' + e.f.l + (e.f.b ? '\n   ' + e.f.b.join('\n   ') : '') + nm);
}
