// Joins the Japanese card pool (data/jp.json, facts from the Japanese official list) with the wiki (data/wiki.json):
//  • data/jp-map.json   — { japanese card name → the English name used as that card's row name }
//  • data/wiki-extra.json — { rows, recs, nations, races }: rows for Japanese cards the English list does not have (facts from the Japanese list,
//    English name / race / icons from the wiki) and the wiki's wording for them in the form tools/skillc.mjs reads. Build-time only; never shipped.
import fs from 'node:fs';
import { wikiToPlain, makeStd } from './wikitext.mjs';
import { jpCards, numberLink, same, merged } from './jpcommon.mjs';
const U = f => new URL(f, import.meta.url);
const J = f => JSON.parse(fs.readFileSync(U(f), 'utf8'));
const jp = J('../data/jp.json'), wk = J('../data/wiki.json'), base = J('../data/base-db.json'), raw = J('../data/raw.json').recs;
// pages found one by one for cards the first sweep missed (older cards reprinted in this format use another page template): each row names its Japanese card in `jp`
if (fs.existsSync(U('../data/wiki2.json'))) { const have = new Set(wk.map(w => w.t)); for (const w of J('../data/wiki2.json')) if (!have.has(w.t)) wk.push(w); }
const norm = s => String(s || '').normalize('NFKC').replace(/[\s　]+/g, '').replace(/[“”"「」『』''’‘]/g, '"').replace(/[・･·]/g, '・').replace(/[~〜～]/g, '~').replace(/[!！]/g, '!').replace(/[?？]/g, '?').toLowerCase();
const cards = jpCards(jp);
const byNorm = new Map(); for (const c of cards.values()) byNorm.set(norm(c.name), c);
const byNo = new Map(); for (const c of cards.values()) for (const p of c.prints) byNo.set(p.no, c);

/* wiki pages → Japanese cards */
const wnum = s => { const m = /^\s*(\d[\d,]*)/.exec(String(s || '').replace(/<[^>]*>/g, '')); return m ? +m[1].replace(/,/g, '') : null; };
const agree = (w, c) => { const g = wnum(w.g), p = wnum(w.p), s = wnum(w.s); return (g == null || c.grade == null || g === c.grade) && (p == null || c.power == null || p === c.power) && (s == null || c.shield == null || s === c.shield || (s === 0 && c.shield == null)); };
const title = w => { const n = (w.n || '').replace(/<[^>]*>/g, '').trim(); const t = n && !/[{}\[\]|]/.test(n) ? n : w.t; return t.replace(/ \((?:D Series|V Series|Card|Unit|Order|D|Token|Crest|Standard|Promo|Anime Promo)\)$/i, '').trim(); };
const pages = new Map(); const stat = { pages: wk.length, byName: 0, byNumber: 0, factsDisagree: 0, unmatched: 0, ambiguous: 0, nameOverruledByNumbers: 0 };
for (const w of wk) {
  let c = (w.jp && cards.get(w.jp)) || byNorm.get(norm(w.k)); let how = 'k';
  const hit = new Set(); for (const n of w.sets) { const x = byNo.get(n); if (x) hit.add(x); }
  // the page's own Japanese numbers all point at one other card: the Japanese name on the page is a slip, the numbers win
  if (c && !w.jp && hit.size === 1 && !hit.has(c) && agree(w, [...hit][0])) { c = [...hit][0]; how = 'n'; stat.nameOverruledByNumbers++; }
  if (!c) { if (hit.size === 1) { c = [...hit][0]; how = 'n'; } else { if (hit.size > 1) stat.ambiguous++; else stat.unmatched++; continue; } }
  if (how === 'n' && !agree(w, c)) { stat.factsDisagree++; continue; }   // matched by number only: the facts must agree too (a matching Japanese name is proof enough; the wiki has typos in its numbers)
  stat[how === 'k' ? 'byName' : 'byNumber']++;
  if (!pages.has(c.name)) pages.set(c.name, []);
  pages.get(c.name).push({ w, how });
}

/* hand-made entries (data/jp-manual.txt) for cards with no usable page: @ number, then  N english name · K family code · A regarded-as (Japanese name) · L english row to link ·
   W title of a wiki page that names no Japanese card · M deck limit (copies) · S thai summary line · E wording line in the compiler's input style */
const manual = new Map();
if (fs.existsSync(U('../data/jp-manual.txt'))) {
  let cur = null;
  for (const line of fs.readFileSync(U('../data/jp-manual.txt'), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const m = /^([@NKALWSEM]) (.*)$/.exec(line); if (!m) continue;
    if (m[1] === '@') { const c = byNo.get(m[2].trim()); if (!c) { cur = null; continue; } cur = manual.get(c.name); if (!cur) { cur = { S: [], E: [] }; manual.set(c.name, cur); } continue; }
    if (!cur) continue;
    if (m[1] === 'S' || m[1] === 'E') cur[m[1]].push(m[2]); else cur[m[1]] = m[2].trim();
  }
  const byTitle = new Map(wk.map(w => [w.t, w]));
  for (const [name, e] of manual) if (e.W && byTitle.has(e.W)) { pages.set(name, [{ w: byTitle.get(e.W), how: 'k' }]); stat.pagesNamedByHand = (stat.pagesNamedByHand || 0) + 1; }
}
/* which Japanese cards the English list already has (same name there), which need a new row */
// records of the English dump that joined several cards are not used: those cards are rebuilt from the wiki (tools/mkdb.mjs swaps the row)
const bad = new Set(base.rows.filter(merged).map(r => r[1]));
const baseByName = new Map(base.rows.map((r, i) => [r[1], i]).filter(([n]) => !bad.has(n)));
const rawByName = new Map(); for (const r of raw) { const c = rawByName.get(r.name); if (!c || (r.effect || '').length > (c.effect || '').length) rawByName.set(r.name, r); }
const eff = n => (rawByName.get(n) || {}).effect || '';
const std = makeStd(eff);
// hand-made skill families: the same wiki wording (card's own name aside) means the same family
const fam = new Map(); const famKey = (e, t) => String(e || '').split(t).join('§').replace(/\s+/g, ' ').trim().toLowerCase();
for (const w of wk) { const i = baseByName.get(title(w)); if (i === undefined || !w.e) continue; const k = base.rows[i][10]; const key = famKey(w.e, w.t); if (!fam.has(key)) fam.set(key, new Map()); const m = fam.get(key); m.set(k || '', (m.get(k || '') || 0) + 1); }
const famOf = (e, t) => { const m = fam.get(famKey(e, t)); if (!m) return ''; const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; return best[0] && best[1] >= 2 && best[1] / [...m.values()].reduce((a, b) => a + b, 0) >= 0.9 ? best[0] : ''; };

const nations = base.nations.slice(), races = base.races.slice();
const idx = (list, v) => { if (!v) return -1; let i = list.indexOf(v); if (i < 0) { i = list.length; list.push(v); } return i; };
const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^{}]*\}\}/g, '').trim();
const map = {}; const rows = []; const recs = []; const claimed = new Map(); const usedNames = new Set(base.rows.map(r => r[1]).filter(n => !bad.has(n)));
let byHand = 0, handRows = 0; const sums = {};
let overruled = 0, known = 0, added = 0, clash = 0, noText = 0, famHit = 0, byEnNumber = 0, bySetNumber = 0;
const NL = numberLink(cards, base.rows, merged);
const grams = t => { const x = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); const g = new Set(); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
const alike = (a, b) => { const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0; let n = 0; for (const g of A) if (B.has(g)) n++; return 2 * n / (A.size + B.size); };
const take = (c, i) => { const t = base.rows[i][1]; if (claimed.has(t)) return false; claimed.set(t, c.name); map[c.name] = t; known++; return true; };
const later = []; const noPage = [];
// 1) the wiki page is titled with the English list's name   2) the wiki page lists an English number of the English list   3) same number in a set that carries the same cards in both languages
for (const c of cards.values()) { const e = manual.get(c.name); if (e && e.L && baseByName.has(e.L) && take(c, baseByName.get(e.L))) byHand++; }   // links made by hand come first
for (const c of cards.values()) {
  const ps = pages.get(c.name) || [];
  if (map[c.name]) continue;   // linked by hand above
  // several pages can claim one Japanese name (a slip on one of them): the row the numbers also point at wins, then a row with the same stats
  const inB = ps.filter(p => baseByName.has(title(p.w))); const cand = inB.map(p => baseByName.get(title(p.w))); const nh = cand.length ? NL.hits(c) : [];
  const confirmed = inB.some(p => p.how === 'k' || p.w.sets.some(n => NL.enExact.get(n) === baseByName.get(title(p.w))));   // the page carries this card's Japanese name, or lists an English number of the row its title names
  let inBase = cand.find(i => nh.includes(i)) ?? cand.find(i => same(c, base.rows[i])) ?? cand[0];
  if (inBase !== undefined && !confirmed && nh.length === 1 && nh[0] !== inBase && !claimed.has(base.rows[nh[0]][1])) { inBase = nh[0]; overruled++; }   // a title that merely coincides with another card's English name, against a number in a trusted set
  if (inBase !== undefined && take(c, inBase)) continue;
  const en = new Set(); for (const p of ps) for (const n of p.w.sets) { if (!/EN(?:-[A-Za-z0-9]+)?$/.test(n)) continue; const i = NL.enExact.get(n); if (i !== undefined && same(c, base.rows[i])) en.add(i); }
  if (en.size === 1 && take(c, [...en][0])) { byEnNumber++; continue; }
  later.push(c);
}
for (const c of later) {
  const ps = pages.get(c.name);
  // a number alone can pair two different cards with the same stats; when the wiki knows this card, its English title must at least resemble the row's name (two translations of one name do)
  const free = NL.hits(c).filter(i => !claimed.has(base.rows[i][1]) && (!ps || ps.some(p => alike(title(p.w), base.rows[i][1]) >= 0.3)));
  if (free.length === 1 && take(c, free[0])) { bySetNumber++; continue; }
  if (!ps) { noPage.push(c); continue; }
  if (c.t === 'G' || c.t === 'X') continue;   // special moves (Inazuma Eleven, type M) are kept: they go in the special move deck
  const p = ps.find(x => x.how === 'k') || ps[0]; const w = p.w; const t = title(w);
  if (usedNames.has(t)) { clash++; continue; }
  usedNames.add(t); map[c.name] = t;
  const e = w.e || ''; const unit = c.t === 'U';
  let flags = '';
  if (unit) flags += c.trigUnit || c.grade <= 1 ? 'b' : c.grade === 2 ? 'i' : c.grade === 3 ? '2' : '3';
  if (unit && /persona/i.test(w.ic + w.ri + w.si)) flags += 'p';
  if (/\{\{(?:Perfect Guard|Sentinel)\b|\[CONT\]:\s*Sentinel/i.test(e)) flags += 's';
  if (/\{\{Glitter\b/i.test(e)) flags += 'G';
  if (/^\s*0\b/.test(w.c)) flags += 'Z'; else if (/^\s*2\b/.test(w.c)) flags += 'C';
  const lim = manual.get(c.name) && manual.get(c.name).M ? +manual.get(c.name).M : c.t === 'M' ? 2 : c.trig === 'over' ? 1 : (m => (m ? ({ one: 1, two: 2, three: 3 }[m[1].toLowerCase()] || +m[1] || 0) : 0))(/You may only have (?:up to )?(one|two|three|\d+) (?:"|cards? with the same)/i.exec(e));
  const as = (m => (m ? clean(m[1]) : 0))(/\{\{Reskin\|(?:NoAlso\||Also\|)?([^|}]+)/i.exec(e));
  const me = manual.get(c.name) || null;
  // a filled-in wiki page of a trigger unit that shows no ability at all: a plain trigger (the trigger effect itself is a rule of the game)
  const plainTrig = unit && c.trig && c.trig !== 'over' && !e.trim() && String(w.g) !== '' && String(w.p) !== '' ? 'v' : '';
  const kind = (me && me.K) || famOf(e, w.t) || plainTrig; if (kind) famHit++;
  if (me && me.S.length) sums[t] = me.S;
  const nation = c.nation || '';   // the Japanese list is the authority for facts
  const race = clean(w.ra).split(/\s*[\/,]\s*/)[0] || '';
  const row = [c.no, t, c.t === 'T' ? 'O' : c.t, idx(nations, nation), idx(races, race), c.grade, c.power, c.shield, flags, c.trig || 0, kind, lim === 4 ? 0 : lim, c.prints.map(x => x.no).filter(n => n !== c.no), as, null, 1];
  rows.push(row); added++;
  const text = wikiToPlain(e, w.t, std);
  if (!text) noText++;
  recs.push({ name: t, type: unit ? (c.trigUnit ? 'Trigger Unit' : 'Normal Unit') : c.t === 'C' ? 'Crest' : c.t === 'M' ? 'Special Move' : 'Order', race: clean(w.ra), effect: text });
}
const byKeyName = new Map([...cards.values()].map(c => [norm(c.name), c]));
const en = jn => { const c = byKeyName.get(norm(jn)); return (c && map[c.name]) || jn; };   // English row name of a Japanese card name
for (const c of noPage) {
  const e = manual.get(c.name); if (!e || !e.N || c.t === 'G' || c.t === 'X') continue;
  let t = e.N; if (usedNames.has(t)) t += ' (JP)'; if (usedNames.has(t)) { clash++; continue; }
  usedNames.add(t); map[c.name] = t; handRows++;
}
for (const c of noPage) {
  const e = manual.get(c.name); const t = map[c.name]; if (!e || !t || rows.some(r => r[1] === t) || baseByName.has(t)) continue;
  const unit = c.t === 'U'; const fill = x => x.replace(/\{\{jp:([^}]+)\}\}/g, (m, j) => en(j));
  const eff = e.E.map(fill).join('\n'); let flags = '';
  if (unit) flags += c.trigUnit || c.grade <= 1 ? 'b' : c.grade === 2 ? 'i' : c.grade === 3 ? '2' : '3';
  if (e.K === '1' || e.K === '2' || /\[CONT\]:Sentinel/.test(eff)) flags += 's';
  if (unit && c.grade === 3 && c.f.includes('p')) flags += 'p';
  const row = [c.no, t, c.t === 'T' ? 'O' : c.t, idx(nations, c.nation || ''), -1, c.grade, c.power, c.shield, flags, c.trig || 0, e.K || '', c.t === 'M' ? 2 : c.trig === 'over' ? 1 : 0, c.prints.map(x => x.no).filter(n => n !== c.no), e.A ? en(e.A) : 0, null, 2];
  rows.push(row); if (e.S.length) sums[t] = e.S.map(fill);
  recs.push({ name: t, type: unit ? (c.trigUnit ? 'Trigger Unit' : 'Normal Unit') : c.t === 'C' ? 'Crest' : c.t === 'M' ? 'Special Move' : 'Order', race: '', effect: eff });
}
// the wiki often keeps its own translation of a name the English list prints differently: inside the wording read from the wiki, quoted names are switched to the row names in use
const alias = new Map(); for (const c of cards.values()) { const t = map[c.name]; if (!t) continue; for (const p of pages.get(c.name) || []) { const wt = title(p.w); if (wt !== t) alias.set(wt, t); if (p.w.t !== t) alias.set(p.w.t, t); } }
let renamed = 0; for (const r of recs) r.effect = r.effect.replace(/"([^"\n]+)"/g, (m, n) => (alias.has(n) ? (renamed++, '"' + alias.get(n) + '"') : m));
// title of the wiki page of each row, where it is not simply the row's name (the page is the place to read the card's wording in English)
const wt = {}; for (const c of cards.values()) { const t = map[c.name]; const ps = pages.get(c.name); if (!t || !ps) continue; const p = ps.find(x => title(x.w) === t) || ps[0]; if (p.w.t !== t) wt[t] = p.w.t; }
fs.writeFileSync(U('../data/jp-map.json'), JSON.stringify(map));
fs.writeFileSync(U('../data/wiki-extra.json'), JSON.stringify({ nations, races, rows, recs, sums, wt }));
console.log(JSON.stringify(Object.assign(stat, { japaneseCards: cards.size, withWikiPage: pages.size, alreadyInEnglishList: known, byEnglishNumberOnWiki: byEnNumber, bySetNumber, linkedByHand: byHand, rowsNamedByHand: handRows, summaries: Object.keys(sums).length, newRows: added, newRowsInAFamily: famHit, newRowsNoText: noText, nameClash: clash, pageOverruledByNumber: overruled, namesSwitchedInWording: renamed })));
if (process.argv[2] === 'dis') { let n = 0; for (const w of wk) { let c = byNorm.get(norm(w.k)); if (!c) { const hit = new Set(); for (const x of w.sets) { const y = byNo.get(x); if (y) hit.add(y); } if (hit.size === 1) c = [...hit][0]; } if (c && !agree(w, c) && n++ < 25) console.log(w.t, '| wiki', w.g, w.p, w.s, '| jp', c.name, c.jt, c.grade, c.power, c.shield, c.no); } }
if (process.argv[2] === 'miss') { const m = [...cards.values()].filter(c => !pages.has(c.name)); const t = {}; for (const c of m) { const k = c.jt + ' ' + c.no.split('/')[0]; t[k] = (t[k] || 0) + 1; } console.log(m.length, Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x.join(':')).join(' | ')); }
if (process.argv[2] === 'names') { let n = 0; for (const c of later) { const t = map[c.name]; const ps = pages.get(c.name); if (!t || !ps || rows.some(r => r[1] === t)) continue; const wt = title(ps[0].w); if (wt !== t && n++ < 40) console.log(JSON.stringify(wt), '≠', JSON.stringify(t)); } console.log('differing titles', n); }
if (process.argv[2] === 'cross') { let agreeN = 0, dis = 0; const ex = []; for (const c of cards.values()) { const t = map[c.name]; if (!t || !baseByName.has(t)) continue; const h = NL.hits(c); if (!h.length) continue; if (h.some(i => base.rows[i][1] === t)) agreeN++; else { dis++; if (ex.length < 12) ex.push(c.name + ' → ' + t + '  but number says ' + h.map(i => base.rows[i][1]).join(' / ')); } } console.log('cross-check: wiki pairing vs number pairing agree', agreeN, 'disagree', dis); console.log(ex.join('\n')); }
if (process.argv[2] === 'todo') { const m = [...cards.values()].filter(c => !map[c.name] && c.t !== 'G' && c.t !== 'X'); fs.writeFileSync(U('../data/wiki-todo.json'), JSON.stringify(m.map(c => [c.name, c.no, ...c.prints.map(p => p.no).filter(n => n !== c.no && /\/\d+$/.test(n)).slice(0, 2)]))); console.log('todo', m.length); }
