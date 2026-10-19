// Builds src/db.json: the card list (facts only) plus compiled skills.
// Input: data/base-db.json (card facts + hand-made skill families) and data/raw.json (official list dump, used only here at build time).
// Row: [no, name, type, nationIdx, raceIdx, grade, power, shield, flags, trigger, kind, limit, otherNos, regardedAs, astIdx]
import fs from 'node:fs';
import { compileCard, HANDAST, HANDUSED, HANDCARD } from './skillc.mjs';
import { merged } from './jpcommon.mjs';
const U = f => new URL(f, import.meta.url);
// card facts + hand-made family codes: the saved base file, or (after a restore from the published page) the previous src/db.json
const base = JSON.parse(fs.readFileSync(fs.existsSync(U('../data/base-db.json')) ? U('../data/base-db.json') : U('../src/db.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(U('../data/raw.json'), 'utf8')).recs;
let XS = null, XW = null;
// Japanese cards the English list does not have (tools/mkwiki.mjs): rows appended after the English ones, wording read from the wiki
if (fs.existsSync(U('../data/wiki-extra.json'))) {
  const x = JSON.parse(fs.readFileSync(U('../data/wiki-extra.json'), 'utf8')); XS = x.sums || null; XW = x.wt || null; const have = new Set(base.rows.map(r => r[1])); const haveRec = new Set(raw.map(r => r.name));
  base.nations = x.nations; base.races = x.races;
  const recOf = new Map(x.recs.map(r => [r.name, r]));
  for (const r of x.rows) {
    if (!have.has(r[1])) { have.add(r[1]); base.rows.push(r); continue; }
    // the English dump joined several cards under this name: the row is rebuilt from the wiki (its old number stays readable for saved decks)
    const i = base.rows.findIndex(b => b[1] === r[1]); if (i < 0 || !merged(base.rows[i])) continue;
    const n = r.slice(); n[12] = (n[12] || []).concat([base.rows[i][0]]); base.rows[i] = n;
    for (let k = raw.length - 1; k >= 0; k--) if (raw[k].name === r[1]) raw.splice(k, 1); haveRec.delete(r[1]);
  }
  for (const r of x.recs) if (!haveRec.has(r.name)) { haveRec.add(r.name); raw.push(r); }
}
// same-name reprints with new skills (tools/variant.txt): their printings move to a new row of the same name; skills from hand-ast "@Name [SET]"
const VKEY = new Map(), VARS = [];
if (fs.existsSync(U('./variant.txt'))) for (const l of fs.readFileSync(U('./variant.txt'), 'utf8').split('\n')) {
  if (!l.trim() || l[0] === '#') continue; const [nm, pre, icon, drop, js] = l.split('\t'); const bi = base.rows.findIndex(b => b[1] === nm.trim()); if (bi < 0) { console.log('variant: no card ' + nm); continue; }
  const b = base.rows[bi]; const all = [b[0], ...(b[12] || [])]; const mine = all.filter(n => String(n).startsWith(pre.trim() + '/')); if (!mine.length) { console.log('variant: no printing ' + pre + ' for ' + nm); continue; }
  const v = b.slice(0, 13); v[0] = mine.find(n => /^[^/]+\/\d+/.test(n)) || mine[0]; v[12] = mine.filter(n => n !== v[0]); v[10] = ''; const o = js && js.trim() ? JSON.parse(js) : {}; if (o.grade != null) v[5] = o.grade; if (o.power != null) v[6] = o.power; if (o.shield !== undefined) v[7] = o.shield;
  b[12] = (b[12] || []).filter(n => !mine.includes(n)); if (mine.includes(b[0])) { console.log('variant: base number moved for ' + nm); }
  base.rows.push(v); VKEY.set(v, nm.trim() + ' [' + pre.trim() + ']'); VARS.push({ v, b, icon: icon && icon.trim() !== '-' ? icon.trim() : null, drop: drop && drop.trim() === '1', pre: pre.trim() });
}
// order subtypes the lists do not give (tools/subtype.txt: Name<TAB>Subtype) — stored like a race
if (fs.existsSync(U('./subtype.txt'))) for (const l of fs.readFileSync(U('./subtype.txt'), 'utf8').split('\n')) {
  const [nm, st] = l.split('\t'); if (!nm || !st || nm[0] === '#') continue; const row = base.rows.find(b => b[1] === nm.trim()); if (!row) { console.log('subtype: no card ' + nm); continue; }
  let i = base.races.indexOf(st.trim()); if (i < 0) { base.races = base.races.slice(); i = base.races.push(st.trim()) - 1; } row[4] = i;
  for (const r of raw) if (r.name === nm.trim()) r.race = st.trim();
}
// BanG Dream! normal orders are Music orders (the lists only give the band): "Music/<band>"
{ const nb = base.nations.indexOf('BanG Dream!'); if (nb >= 0) for (const row of base.rows) { if (row[3] !== nb || row[2] !== 'O' || row[4] == null || row[4] < 0) continue; const rc = base.races[row[4]]; if (!rc || /(^|\/)Music(\/|$)/.test(rc)) continue; const st = 'Music/' + rc; let i = base.races.indexOf(st); if (i < 0) { base.races = base.races.slice(); i = base.races.push(st) - 1; } row[4] = i; for (const r of raw) if (r.name === row[1]) r.race = st; } }
const races = new Set(); for (const r of raw)
 for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const byName = new Map();
for (const r of raw) { if (!r.name) continue; const cur = byName.get(r.name); if (!cur || (r.effect || '').length > (cur.effect || '').length) byName.set(r.name, r); }
const asts = []; const index = new Map();
const stat = { rows: 0, kind: 0, compiled: 0, partial: 0, failed: 0, noText: 0, missing: 0, wikiRows: 0, wikiKind: 0, wikiCompiled: 0, wikiPartial: 0 };
const failed = []; const FL = [];
const ROWFIX = new Map(); if (fs.existsSync(U('./rowfix.txt'))) for (const l of fs.readFileSync(U('./rowfix.txt'), 'utf8').split('\n')) { if (!l.trim() || l[0] === '#') continue; const [n, k, lim] = l.split('\t'); ROWFIX.set(n.trim(), { k: (k || '').trim(), l: +lim || 0 }); }
const rows = base.rows.map(row => {
  const r = row.slice(0, 14); stat.rows++; const wiki = row[15] === 1 || row[15] === 2 ? row[15] : 0; if (wiki) stat.wikiRows++;
  while (r.length < 14) r.push(r.length === 12 ? [] : 0);
  const vk = VKEY.get(row); const rec = vk ? null : byName.get(r[1]);
  if (rec && /^\s*\[Glitter\]/im.test(rec.effect || '') && !String(r[8] || '').includes('G')) r[8] = (r[8] || '') + 'G';
  { const fx = ROWFIX.get(r[1]); if (fx) { if (fx.k) r[10] = fx.k; if (fx.l) r[11] = fx.l === 4 ? 0 : fx.l; } }   // tools/rowfix.txt: facts checked on the Japanese official card pages
  if (r[10]) { stat.kind++; if (wiki) stat.wikiKind++; return mark(trim(r), wiki); }
  const hc = HANDCARD.has(vk || r[1]);   // a hand-written whole card (tools/hand-ast.txt "@Name<TAB>ast") — also for cards without English wording
  if (!rec && !hc) { stat.missing++; return mark(trim(r), wiki); }
  const eff = ((rec && rec.effect) || '').trim();
  if ((!eff || eff === '-') && !hc) { stat.noText++; return mark(trim(r), wiki); }
  let res; try { res = compileCard(rec || { name: vk || r[1], effect: '', type: '' }, races); } catch (e) { res = { fail: [{ why: 'crash', at: String(e.message) }] }; }
  if (res.ast && (res.ast.t || res.ast.on || res.ast.m)) res.ast = { a: [res.ast] }; else if (res.ast && !res.ast.a) res.ast.a = [];
  if (res.fail) for (const f of res.fail) FL.push({ n: r[1], k: f.key, l: f.line, b: f.bullets && f.bullets.length ? f.bullets : undefined, why: f.why, at: f.at, as: f.as ? 1 : 0, t: rec.type, nm: f.nm && Object.keys(f.nm).length ? f.nm : undefined });
  if (res.ast && (res.ast.a.length || res.ast.p || res.ast.o || res.ast.nr || res.ast.nnc || res.ast.rf || res.ast.og != null || res.ast.as || res.ast.tg || res.ast.np || res.ast.sentinel || res.ast.gl || res.ast.rp || res.ast.cp || res.ast.cb || res.ast.ss || res.ast.ig || res.ast.ncc || res.ast.sina || res.ast.na2 || res.ast.cl || res.ast.bind || res.ast.noOrdAb || res.ast.ra || res.ast.cf || res.ast.cag || res.ast.roo || res.ast.nobc || res.ast.musto || res.ast.retry || res.ast.eg || res.ast.pug || res.ast.memord || res.ast.alc || res.ast.sg3 || res.ast.trigAdd || res.ast.atkBackCol || res.ast.dvFrom || res.ast.gzAbs || res.ast.absFrom || res.ast.vgBlank || res.ast.secretSword || res.ast.mbAny || res.ast.ozShield || res.ast.ozTrig || res.ast.xod2 || res.ast.saien || res.ast.gsLess || res.ast.gleip || res.ast.race2 || res.ast.bsStay3 || res.ast.bsToDeck || res.ast.noSG || res.ast.frozenStars || res.ast.rt2 || res.ast.strideIf || res.ast.crestEG || res.ast.noRideMy || res.ast.overHand || res.ast.handDbl || res.ast.callNa || res.ast.dropG || res.ast.discLess || res.ast.dressDrop || res.ast.dressDropDB || res.ast.look1 || res.ast.atkTax || res.ast.mkPw || res.ast.strideAlt || res.ast.dressGrant || res.ast.nuDeck || res.ast.raceDeck || res.ast.soulNames || res.ast.rcSave || res.ast.dname || res.ast.deckAs || res.ast.alias || res.ast.noRestNm || res.ast.gcWith || res.ast.retryc || res.ast.rv3 || res.ast.discOrd || res.ast.mate || res.ast.ozCallF || res.ast.ozOne || res.ast.dropSave || res.ast.evn || res.ast.event || res.ast.sg0 || res.ast.u2 || res.ast.pd2 || res.ast.cnt2 || res.ast.dbl || res.ast.cpx || res.ast.cmdeck || res.ast.g12deck || res.ast.h2o || res.ast.udeck || res.ast.c2h || res.ast.callonly || res.ast.vol || res.ast.volm || res.ast.sslock || res.ast.kiw || res.ast.treq || res.ast.smc || res.ast.smu || res.ast.noso || res.ast.ronly || res.ast.oprby || res.ast.cc || res.ast.ctop || res.ast.arm || res.ast.armby || res.ast.jail || res.ast.prsc || res.ast.cot || res.ast.gz || res.ast.psink || res.ast.tkas || res.ast.charm || res.ast.pa || res.ast.pf || res.ast.rby || res.ast.rov || res.ast.rc2 || res.ast.asSet || res.ast.world || res.ast.ovp || res.ast.of || res.ast.as2 || res.ast.nc || res.ast.il || res.ast.od || res.ast.tg || res.ast.x)) {
    const key = JSON.stringify(res.ast); let i = index.get(key);
    if (i === undefined) { i = asts.length; asts.push(res.ast); index.set(key, i); }
    r[14] = i; stat.compiled++; if (wiki) stat.wikiCompiled++;
  } else if (res.part) {
    const key = JSON.stringify(res.part); let i = index.get(key);
    if (i === undefined) { i = asts.length; asts.push(res.part); index.set(key, i); }
    r[14] = i; stat.partial++; if (wiki) stat.wikiPartial++;
  } else { stat.failed++; failed.push(r[1]); }
  return mark(trim(r), wiki);
});
// slot 15: 1 = a Japanese card whose English name and skills were read from the wiki (not the official English list) · 2 = no page anywhere: name translated by hand (unofficial)
function mark(r, wiki) { if (wiki) { while (r.length < 15) r.push(r.length === 12 ? [] : r.length === 14 ? null : 0); r[15] = wiki; } return r; }
function trim(r) { while (r.length > 12 && (r[r.length - 1] === 0 || r[r.length - 1] == null || (Array.isArray(r[r.length - 1]) && !r[r.length - 1].length)) && r.length > 12) { if (r.length === 15) break; r.pop(); } return r; }
const out = { nations: base.nations, races: base.races, rows, asts };
// short Thai summaries written by hand (shown while a card is not fully automatic): { row index: [lines] }
if (XW) { out.wt = {}; rows.forEach((r, i) => { if (XW[r[1]]) out.wt[i] = XW[r[1]]; }); }
if (XS) { out.sums = {}; rows.forEach((r, i) => { if (XS[r[1]]) out.sums[i] = XS[r[1]]; }); }
// clan icons (tools/clan.txt: Name<TAB>Clan, or ~Clan = counts as that clan only while the vanguard has just that clan): { row index: 'Clan' | '~Clan' }
const byNs = new Map(); rows.forEach((r, i) => { if (!byNs.has(r[1])) byNs.set(r[1], []); byNs.get(r[1]).push(i); });
if (fs.existsSync(U('./clan.txt'))) { out.clans = {}; const byN = new Map(rows.map((r, i) => [r[1], i])); let n = 0, miss = 0; for (const l of fs.readFileSync(U('./clan.txt'), 'utf8').split('\n')) { const [nm, cl] = l.split('\t'); if (!nm || !cl || nm[0] === '#') continue; const i = byN.get(nm.trim()); if (i === undefined) { miss++; continue; } if (cl.trim()[0] === '@') { for (const j of (byNs.get(nm.trim()) || [i])) (out.icons = out.icons || {})[j] = cl.trim().slice(1); continue; } for (const j of (byNs.get(nm.trim()) || [i])) out.clans[j] = cl.trim(); n++; } console.log('clans: ' + n + ' cards (' + miss + ' listed names are not in the card list)'); }
{ const vi = []; for (const x of VARS) { const i = base.rows.indexOf(x.v), j = base.rows.indexOf(x.b); vi.push([i, j]); out.icons = out.icons || {}; if (x.icon) out.icons[i] = x.icon; if (x.drop) delete out.icons[j]; } if (vi.length) out.vars = vi; console.log('variants: ' + vi.length); }   // [new row, old row]
fs.writeFileSync(U('../src/db.json'), JSON.stringify(out));
fs.writeFileSync(U('../data/failed.json'), JSON.stringify(failed));
fs.writeFileSync(U('../data/fails.jsonl'), FL.map(x => JSON.stringify(x)).join('\n'));   // every line the reader could not read (wording: build-time only, never saved or published)
// picture file names on the official card list, one per row ("dzbt07/dzbt07_016" = dzbt07/dzbt07_016.png); only the copy of the game that runs from the owner's disk uses them
{ const byNo = new Map(); for (const r of raw) if (r.no && !byNo.has(r.no)) byNo.set(r.no, r);
  fs.writeFileSync(U('../src/img.json'), JSON.stringify(rows.map((r, ri) => { if ((out.vars || []).some(x => x[0] === ri)) { const m = /^([^/]+)\/([^/]+?)EN$/i.exec(r[0]); if (m) { const s = m[1].replace(/-/g, '').toLowerCase(); return s + '/' + s + '_' + m[2]; } } const rec = byNo.get(r[0]) || byName.get(r[1]); return rec && rec.img ? rec.img.replace(/\.png$/, '') : ''; }))); }
{ const un = [...HANDAST.keys()].filter(k => !HANDUSED.has(k)); if (un.length) console.log('hand-written lines not used by any card: ' + un.length + ' ' + un.slice(0, 12).join(' ')); }
console.log(JSON.stringify(stat), '| distinct skill sets', asts.length, '| db', (fs.statSync(U('../src/db.json')).size / 1024).toFixed(0) + ' KB');
