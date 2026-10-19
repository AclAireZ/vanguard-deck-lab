// Builds src/jp.json: the Japanese card pool (facts read from the Japanese official card list: number, name, picture file, type, nation, grade, power, shield)
// and, for every card that is certainly the same card as a row of src/db.json (the English list), the link to that row — so its compiled skills can be reused.
// Input: data/jp.json = { rows: [{ no, img, name, kana, st: [type, nation, grade, power, shield], f }], trig: { c: [no..], d: [..], f: [..], h: [..], o: [..] } }  (no card wording is stored)
// A set is trusted only when the numbers shared with the English list describe the same cards (type, grade, power, shield agree for nearly all of them).
import fs from 'node:fs';
import { jpCards, numberLink, merged } from './jpcommon.mjs';
const U = f => new URL(f, import.meta.url);
const jp = JSON.parse(fs.readFileSync(U('../data/jp.json'), 'utf8'));
const db = JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'));
const cards = jpCards(jp); const bad = jp.rows.filter(r => !r.no || !r.name).length;
const { sets, trusted, hits } = numberLink(cards, db.rows, r => r[15] === 1 || merged(r));
/* ---- link ---- */
const link = new Array(db.rows.length).fill(0); const claimed = new Map(); let ambiguous = 0; const jpOnly = []; let viaWiki = 0, viaNumber = 0;
// 1) the wiki's pairing of Japanese and English names (tools/mkwiki.mjs)   2) the same number in a set known to carry the same cards
const wmap = fs.existsSync(U('../data/jp-map.json')) ? JSON.parse(fs.readFileSync(U('../data/jp-map.json'), 'utf8')) : {};
const varRows = new Set((db.vars || []).map(x => x[0])); const rowByName = new Map(); db.rows.forEach((r, i) => { if (!varRows.has(i) && !rowByName.has(r[1])) rowByName.set(r[1], i); });   // a same-name remake (variant row) never takes the old card's Japanese link
const left = [];
for (const c of cards.values()) { const i = rowByName.get(wmap[c.name]); if (i !== undefined && !claimed.has(i)) { claimed.set(i, c); link[i] = c; viaWiki++; } else left.push(c); }
for (const c of left) {
  const hit = hits(c);
  const free = hit.filter(i => !claimed.has(i));
  if (free.length === 1) { claimed.set(free[0], c); link[free[0]] = c; viaNumber++; }
  else { if (hit.length > 1) ambiguous++; jpOnly.push(c); }
}
const JPSET = { 'DZ-SS13': 'DZ-SS14', 'DZ-SS14': 'DZ-SS15', 'DZ-SS15': 'DZ-SS16' };   // icon start decks / Festival Collection: the English code is one lower than the Japanese one
for (const [vi, bi] of db.vars || []) { const c = link[bi]; if (!c) continue; const nos = [db.rows[vi][0], ...(db.rows[vi][12] || [])].map(n => String(n).replace(/EN(?=[^/]*$)/i, '').replace(/-R$/, '')); const wants = nos.flatMap(w => { const [s, k] = w.split('/'); return JPSET[s] ? [JPSET[s] + '/' + k, w] : [w]; }); const sets = [...new Set(wants.map(w => w.split('/')[0]))]; const p = wants.map(w => c.prints.find(x => x.no === w)).find(Boolean) || c.prints.find(x => sets.includes(x.no.split('/')[0])); if (p) link[vi] = { no: p.no, name: c.name, img: p.img || '' }; }   // a same-name reprint with new skills gets its own Japanese printing
// icon cards (Aichi / Kai / Ren / Chrono / Shinemon) show the picture of their icon printing, not an older art of the same card
{ const ICS = { aichi: ['DZ-SS14'], kai: ['DZ-SS15'], ren: ['DZ-BT15'], chrono: ['DZ-SS16'], shinemon: ['DZ-SS16'] }; const rank = no => { const k = no.split('/')[1] || ''; return /^\d+$/.test(k) ? 0 : /^LG/.test(k) ? 1 : /^SR/.test(k) ? 2 : /^FFR/.test(k) ? 3 : 4; };
  for (const i in db.icons || {}) { const c = link[i]; const sets = ICS[db.icons[i]]; if (!c || !sets || !c.prints) continue; if (sets.includes(String(c.img || '').split('/')[0])) continue; const pr = c.prints.filter(x => sets.includes(x.no.split('/')[0]) && x.img).sort((a, b) => rank(a.no) - rank(b.no))[0]; if (pr) link[i] = { no: c.no, name: c.name, img: pr.img, prints: c.prints }; } }
const out = { link: link.map(c => (c ? [c.no, c.name, c.img.replace(/\.png$/, '')] : 0)),
  // cards of the Japanese pool that have no certain English counterpart: [no, name, type, nation, grade, power, shield, flags, trigger, picture, other numbers]
  extra: jpOnly.filter(c => c.t !== 'G' && c.t !== 'X').map(c => [c.no, c.name, c.t === 'T' ? 'O' : c.t, c.nation, c.grade, c.power, c.shield, (c.f.includes('s') && ((c.t === 'U' && !c.trigUnit && c.grade <= 1) || c.t === 'B') ? 's' : '') + (c.f.includes('p') && c.t === 'U' && c.grade >= 3 ? 'p' : '') + (c.t === 'U' && !c.trigUnit && c.grade != null ? (c.grade <= 1 ? 'b' : c.grade === 2 ? 'i' : c.grade === 3 ? '2' : '3') : c.trigUnit ? 'b' : ''), c.trig || (c.trigUnit ? '?' : 0), c.img.replace(/\.png$/, ''), c.prints.map(p => p.no).filter(n => n !== c.no)]) };
fs.writeFileSync(U('../src/jp.json'), JSON.stringify(out));
const linked = out.link.filter(Boolean).length; const ast = i => (db.rows[i][14] != null ? db.asts[db.rows[i][14]] : null);
const autoLinked = out.link.filter((x, i) => x && (db.rows[i][10] || (ast(i) && !ast(i).miss))).length; const partLinked = out.link.filter((x, i) => x && !db.rows[i][10] && ast(i) && ast(i).miss).length;
console.log(JSON.stringify({ printings: jp.rows.length, bad, cards: cards.size, setsSeen: Object.keys(sets).length, trusted: trusted.size, linked, viaWiki, viaNumber, wikiRows: out.link.filter((x, i) => x && db.rows[i][15] === 1).length, fullAuto: autoLinked, partAuto: partLinked, jpOnly: out.extra.length, skippedTypes: jpOnly.length - out.extra.length, ambiguous, englishRowsWithoutJapanese: db.rows.length - linked, kb: Math.round(fs.statSync(U('../src/jp.json')).size / 1024) }));
if (process.argv[2] === 'sets') console.log(Object.entries(sets).sort().map(([s, v]) => (trusted.has(s) ? 'ok   ' : 'NO   ') + s.padEnd(12) + String(v.ok).padStart(4) + ' / ' + String(v.pairs).padStart(4)).join('\n'));
