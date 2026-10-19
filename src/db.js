/* Full card list (facts only: name, grade, power, shield, icons) + deck rules. Cards without a script still play with their printed stats. */
(function (root) {
'use strict';
const VG = root.VG; const C = VG.CARDS; const std = VG.std;
const DB = VG.DB = { rows: [], byNo: {}, byName: {}, nations: [], count: 0 };
VG.BYNAME = {};
for (const no in C) { const d = C[no]; d.auto = true; d.scripted = true; if (d.type !== 'token') VG.BYNAME[d.name] = d; }

/* data: { nations: [..], races: [..], rows: [[no, name, type, nationIdx, raceIdx, grade, power, shield, flags, trigger, kind, limit, [other numbers]]] } */
VG.loadDB = function (data) {
  DB.nations = data.nations.slice();
  DB.rows = data.rows.map(r => ({ no: r[0], name: r[1], t: r[2], nation: r[3] < 0 ? null : data.nations[r[3]], race: r[4] < 0 ? null : data.races[r[4]], grade: r[5], power: r[6], shield: r[7], flags: r[8] || '', trig: r[9] || null, kind: r[10] || '', lim: r[11] || 4, nos: r[12] || [], as: r[13] || null, ast: r[14] != null && data.asts ? data.asts[r[14]] : null, wiki: r[15] === 1, unofficial: r[15] === 2 }));
  if (data.sums) for (const i in data.sums) if (DB.rows[i]) DB.rows[i].sum = data.sums[i];
  if (data.wt) for (const i in data.wt) if (DB.rows[i]) DB.rows[i].wt = data.wt[i];
  if (data.icons) for (const i in data.icons) if (DB.rows[i]) { DB.rows[i].icon = data.icons[i]; }   // character icon (Kai, Ren, Aichi, Shinemon, Chrono)
  if (data.clans) for (const i in data.clans) if (DB.rows[i]) { const c = data.clans[i]; if (c[0] === '~') DB.rows[i].clanIf = c.slice(1).toLowerCase(); else DB.rows[i].clan = c.toLowerCase(); }   // clan icon / conditional clan
  for (const r of DB.rows) {
    DB.byNo[r.no] = r; for (const n of r.nos) DB.byNo[n] = r;
    if (!DB.byName[r.name]) DB.byName[r.name] = r;
    const hw = !!(VG.HAND && VG.HAND[r.name]);            // skills written by hand for this card (they replace what the compiler read)
    r.auto = !!(VG.BYNAME[r.name] || hw || r.kind || r.ast);
    r.beta = !VG.BYNAME[r.name] && !hw && !r.kind && !!r.ast;   // skills read by the compiler (not hand-checked)
    r.part = r.beta && !!r.ast.miss;                     // only some of the card's abilities are automatic
    r.semi = r.part && r.ast.asst === r.ast.miss;        // every ability that is not automatic is at least half-automatic (timing, conditions and cost by the game; effect by hand)
    r.key = (r.name + ' ' + r.no + ' ' + r.nos.join(' ')).toLowerCase() + (r.icon ? ' icon:' + r.icon + ' ' + ({ aichi: 'aichi ichi アイチ', kai: 'kai カイ 櫂', ren: 'ren レン', chrono: 'chrono クロノ', shinemon: 'shinemon シンエモン' }[r.icon] || r.icon) : '');
  }
  DB.count = DB.rows.length;
};
/* The Japanese card pool. data: { link: [per row of the list above: [number, name, picture file] or 0], extra: [[number, name, type, nation, grade, power, shield, flags, trigger, picture file, [other numbers]]] }
   A linked row keeps its English name inside (skills compare names in English) and gains the Japanese number / name / picture for display; `extra` are cards with no certain English counterpart: stats only, skills by hand. */
const JP_NATION = { '刀剣乱舞': 'Touken Ranbu', '終末のワルキューレ': 'Record of Ragnarok', 'バディファイト': 'Buddyfight', 'コロコロ': 'CoroCoro', 'イナズマイレブン': 'Inazuma Eleven', 'モンスターストライク': 'Monster Strike', 'ぶいすぽっ！': 'VSPO!' };
/* Sample decks put together from the card list by card name (they appear among the ready decks). Not official lists: they exist so a family of cards can be tried at once. */
VG.presets = function () {
  const DB = VG.DB; const R = DB.rows.filter(r => r.jno); const no = n => (DB.byName[n] || {}).no;
  const make = (id, name, source, nation, ride, cards) => {
    const tr = k => R.filter(r => r.nation === nation && r.trig === k && r.kind === 'v').sort((a, b) => (a.jno < b.jno ? -1 : 1));
    const sent = R.filter(r => r.nation === nation && r.flags.includes('s') && !r.trig && r.kind).sort((a, b) => (a.jno < b.jno ? -1 : 1))[0];
    const crit = tr('crit'), front = tr('front'), heal = tr('heal'); const crest = DB.byName['Energy Generator'];
    if (ride.concat(cards.map(x => x[0])).some(n => !no(n)) || crit.length < 2 || !front.length || !heal.length || !sent) return;
    const main = cards.map(([n, k]) => ({ no: no(n), n: k })).concat([{ no: sent.no, n: 4 }, { no: crit[0].no, n: 4 }, { no: crit[1].no, n: 4 }, { no: front[0].no, n: 4 }, { no: heal[0].no, n: 4 }]);
    VG.DECKS[id] = { id, name, source, nation, ride: ride.map(no).concat(crest ? [crest.no] : []), main };
  };
  make('VARGA', 'Varga "Heavenwake" (เด็คตัวอย่าง)', 'ประกอบจากการ์ดตระกูล Varga เพื่อทดสอบสกิล — ไม่ใช่ลิสต์ทางการ', 'Dragon Empire',
    ['Heated Blade, Ardart', 'Blazembar Dragon, "Touen"', 'Boulder Axe Dragon, "Fugen"', 'Unparalleled Rakshasa Dragon, Varga Dragres "Heavenwake"'],
    [['Unparalleled Rakshasa Dragon, Varga Dragres "Heavenwake"', 3], ['Fated One of Unparalleled, Varga Dragres', 2], ['Unparalleled Drekasleif, Varga Dragres "Rakshasa"', 1], ['Dragritter of Ashen Flower, Shuura', 4],
      ['Boulder Axe Dragon, "Fugen"', 3], ['Blazembar Dragon, "Touen"', 3], ['Dragritter, Nabilla', 4], ['Mythisch of Unparalleled, Zalva Dragnia', 3], ['Dragritter, Mutawari', 2], ['Aero Halberd Dragon', 2], ['Valorous Blade Dragon', 2], ['Obduracy Glaive Dragon', 1]]);
};
VG.loadJP = function (jp) {
  if (!jp || !Array.isArray(jp.link)) return;
  DB.jp = true;
  jp.link.forEach((l, i) => { const r = DB.rows[i]; if (!l || !r) return; r.jno = l[0]; r.jname = l[1]; r.jimg = l[2]; if (!DB.byNo[l[0]]) DB.byNo[l[0]] = r; r.key += ' ' + l[0].toLowerCase() + ' ' + l[1].toLowerCase(); });
  for (const x of jp.extra || []) {
    if (DB.byNo[x[0]]) continue;
    const r = { no: x[0], name: x[1], t: x[2], nation: x[3] ? (JP_NATION[x[3]] || x[3]) : null, race: null, grade: x[4], power: x[5], shield: x[6], flags: x[7] || '', trig: x[8] || null, kind: '', lim: x[8] === 'over' ? 1 : 4, nos: x[10] || [], as: null, ast: null, jno: x[0], jname: x[1], jimg: x[9], jonly: true, auto: false, beta: false, part: false };
    r.key = (r.name + ' ' + r.no + ' ' + r.nos.join(' ')).toLowerCase();
    if (r.nation && !DB.nations.includes(r.nation)) DB.nations.push(r.nation);
    DB.rows.push(r); DB.byNo[r.no] = r; for (const n of r.nos) if (!DB.byNo[n]) DB.byNo[n] = r; if (!DB.byName[r.name]) DB.byName[r.name] = r;
  }
  DB.count = DB.rows.filter(r => r.jno).length;
  VG.presets();
  for (const no in C) { const d = C[no]; const r = DB.byNo[d.official || no] || DB.byName[d.name]; if (r && r.jno && !d.jname) { d.jname = r.jname; d.jno = r.jno; d.jimg = r.jimg; } }   // cards already made (hand-written decks)
};
const TOKPW = { Momokke: 5000 };
/* tokens the card list does not carry (structured skills written by hand; `ord` = an order token for the order zone) */
const XTOK = VG.XTOK = {
  'blast': { name: 'Blast', grade: 0, power: 5000, race: 'Blast', ast: { a: [
    { t: 'c', z: 'R', m: { noMove: 1 } },
    { t: 'c', z: 'R', c: [['vg', { nh: 'Estacion' }]], m: { immune: 1 } },
    { t: 'k', z: 'R', l: 1, c: [['vg', { nh: 'Estacion' }]], k: [['gzc', 3, {}, ['rc'], 'plant', { host: 1, min: 2 }]], d: [['draw', 1]] },
    { t: 'c', z: 'R', c: [['vg', { nh: 'Estacion' }], ['my'], ['vg', { gmin: 3 }]], s: 'front', m: { power: 5000 }, per: ['div', ['gzme'], 3] }] } },
  'almajest celestage': { name: 'Almajest Celestage', ord: 1, grade: 1, ast: { a: [
    { t: 'k', z: 'O', l: 1, lk: 'cel', c: [['vg', { nh: 'Almajestar' }]], k: [['zc', 1, { tr: ['crit'] }, ['hand'], 'order']], d: [['or', [['draw', 2]], [['sr', ['deck'], 1, 1, { rc: 'crimson moon' }], ['reveal'], ['to', 'it', 'hand'], ['shuf']]]] },
    { t: 'k', z: 'O', l: 1, lk: 'cel', c: [['vg', { nh: 'Almajestar' }]], k: [['zc', 1, { tr: ['crit'] }, ['rc'], 'order']], d: [['or', [['draw', 1]], [['sr', ['deck'], 1, 1, { rc: 'crimson moon' }], ['reveal'], ['to', 'it', 'hand'], ['shuf']]]] }] } },
  'demon wolf, fenrir': { name: 'Demon Wolf, Fenrir', grade: 3, power: 23000, crit: 2, race: 'Asgard' },
  'goat': { name: 'Goat', grade: 1, power: 15000, race: 'Demon', nation: 'When They Cry' },
  'great magick caster of transitory, zerith "fantôme"': { name: 'Great Magick Caster of Transitory, Zerith "Fantôme"', grade: 3, power: 13000, race: 'Fantôme', ast: { a: [
    { t: 'a', z: 'R', on: { e: 'uAtked', s: 'm', k: 'u', wf: { ot: 1 } }, k: [['self', 'retire']], d: [['itu', 'tgt'], ['bf', 'it', { power: 10000 }, 'b']] },
    { t: 'a', z: 'R', on: { e: 'tend', opp: 1 }, d: [['rt', 'me']] }] }, drive: 2 },
  'moon gate': { name: 'Moon Gate', ord: 1, grade: 3, ast: { roo: { nh: 'Miracles of the Moon, Rezael Veritas', gmin: 0 }, a: [
    { t: 'k', z: 'O', l: 1, k: [['alt', [['sb', 2]], [['eb', 3]]]], d: [['sr', ['deck'], 1, 1, { nh: 'Mythisch' }], ['cl', 'it', {}], ['shuf']] },
    { t: 'c', z: 'O', c: [['my']], s: { s: 'm', k: 'r', f: { nh: 'Mythisch', pby: 'a', placed: 1 } }, m: { power: 5000 } }] } },
  'erosion fantôme cage': { name: 'Erosion Fantôme Cage', ord: 1, grade: 3, ast: { roo: { nh: 'Great Magick Caster of the Crimson Moon, Zerith "Mirazh"', gmin: 3 }, a: [
    { t: 'c', z: 'O', s: { s: 'm', k: 'r', f: { rc: 'Fantôme', ty: 'nu', nn: 'Great Magick Caster of the Crimson Moon, Zerith "Mirazh"' } }, m: { intercept: 1, boost: 1, backInt: 1 } },
    { t: 'c', z: 'O', s: { s: 'm', k: 'u', f: { g: [3, 99], rc: 'Fantôme', nh: 'Fantôme' } }, m: { shield: 10000 } },
    { t: 'c', z: 'O', s: { s: 'm', k: 'g', f: { g: [3, 99], rc: 'Fantôme', nh: 'Fantôme' } }, m: { shield: 10000 } },
    { t: 'c', z: 'O', s: { s: 'm', k: 'r', f: { g: [3, 3], nh: 'Fantôme', mk: 'crimson moon' } }, m: { immune: 1, power: 5000 } }] } },
};
function makeTok(no) {
  const x = XTOK[no.slice(8)]; if (!x) return undefined;
  const d = { no, name: x.name, type: x.ord ? 'order' : 'token', orderKind: x.ord ? 'set' : undefined, nation: x.nation || null, race: x.race || null, grade: x.grade, power: x.ord ? null : x.power, shield: null, crit: x.crit || 1, boost: !x.ord && x.grade <= 1, intercept: false, drive: x.drive || 1,
    text: ['โทเคน: เมื่อออกจากสนามจะหายไป ใส่ในเด็คไม่ได้'], abilities: [], auto: true, scripted: true };
  if (x.ast) VG.fx.apply(d, x.ast);
  return d;
}
function make(r, no) {
  const s = VG.BYNAME[r.name];
  if (s) return Object.assign({}, s, { no, auto: true, lim: r.lim, official: r.no, jname: r.jname, jno: r.jno, jimg: r.jimg, wt: r.wt || null, clans: r.clan ? [r.clan] : [], clanIf: r.clanIf || null, icon: r.icon || null });
  const f = r.flags; const ord = r.t === 'O' || r.t === 'S' || r.t === 'B';
  const d = {
    no, name: r.name, type: r.t === 'U' ? 'unit' : r.t === 'C' ? 'crest' : r.t === 'M' ? 'special' : ord ? 'order' : r.t === 'X' && r.grade === 4 && r.power != null ? 'unit' : r.t === 'X' && r.power != null ? 'token' : 'other', gunit: r.t === 'X' && r.grade === 4 && r.power != null, special: r.t === 'M',   // grade-4 rows outside the deck are G units (G deck)   // a token row with a power is a token unit
    orderKind: r.t === 'S' ? 'set' : r.t === 'B' ? 'blitz' : r.t === 'O' ? 'normal' : undefined,
    nation: r.nation, race: r.race, grade: r.grade, power: r.t === 'X' && r.power === 0 && TOKPW[r.name] ? TOKPW[r.name] : r.power, shield: r.shield, crit: f.includes('C') ? 2 : f.includes('Z') ? 0 : 1, as: r.as,
    boost: f.includes('b') || (r.t === 'X' && r.power != null && (r.grade || 0) <= 1), intercept: f.includes('i'), drive: f.includes('3') ? 3 : f.includes('2') ? 2 : 1, persona: f.includes('p'), sentinel: f.includes('s'), glitter: f.includes('G'),
    trigger: r.trig, triggerPower: r.trig === 'over' ? 100000000 : 10000, text: [], abilities: [], auto: !!r.kind, lim: r.lim, official: r.no,
    jname: r.jname, jno: r.jno, jimg: r.jimg, jonly: !!r.jonly, wiki: !!r.wiki, unofficial: !!r.unofficial, sum: r.sum || null, wt: r.wt || null,
    clans: r.clan ? [r.clan] : [], clanIf: r.clanIf || null, icon: r.icon || null, music: ord && /(^|\/)Music(\/|$)/.test(r.race || ''),
  };
  if (d.music) d.text.push('มิวสิก: เมื่อเพลย์ จะวางไว้ที่ RC แถวหลังกลางจนจบเทิร์น (ไม่นับเป็นยูนิท)');
  const CLT = x => x.replace(/\b\w/g, y => y.toUpperCase());
  if (r.clan) d.text.push('แคลน: ' + CLT(r.clan) + (r.icon ? ' · ไอคอน ' + CLT(r.icon) : ''));
  if (r.clanIf) d.text.push('CONT: ถ้าแวนการ์ดของคุณมีแคลน ' + CLT(r.clanIf) + ' เพียงแคลนเดียว การ์ดนี้นับเป็นของแคลน ' + CLT(r.clanIf) + ' เท่านั้น');
  if (r.trig) d.text.push(std.TRIG_TEXT[r.trig] || 'โอเวอร์ทริกเกอร์ (ใส่ได้ 1 ใบ): เมื่อเปิดเป็นทริกเกอร์ นำการ์ดนี้ออกจากเกม จั่ว 1 ใบ เลือกยูนิท 1 ใบ พลัง +100 ล้านจนจบเทิร์น');
  if (r.lim > 4) d.text.push('CONT: ใส่การ์ดนี้ในเด็คได้ไม่เกิน ' + r.lim + ' ใบ');
  if (r.kind === 'g') { d.text.push(std.starterText); d.abilities.push(std.starterAbility); }
  if (r.kind === '1') { d.text.push(std.sentinelText, std.pgCost.text); d.abilities.push(std.pgCost.ability); }
  if (r.kind === '2') { d.text.push(std.sentinelText, std.pgHand2.text); d.abilities.push(std.pgHand2.ability); }
  const fam = VG.FAM[r.kind]; if (fam) { d.text.push(...fam.text); d.abilities.push(...fam.abilities); if (fam.overEffect) d.overEffect = fam.overEffect; }
  const hw = VG.HAND && VG.HAND[r.name];
  if (hw) { d.text = hw.text.slice(); d.abilities = hw.abilities.slice(); d.auto = true; d.scripted = true; if (hw.extra) Object.assign(d, hw.extra); if (d.abilities.some(a => a.type === 'act' && [].concat(a.zone || []).some(z => ['mbox', 'drop', 'soul', 'hand', 'bind'].includes(z)))) d.actOff = true; return d; }
  if (!r.kind && r.ast) { VG.fx.apply(d, r.ast); d.auto = true; d.beta = true; if (r.ast.miss) { d.partial = true; d.miss = r.ast.miss; d.semi = r.ast.asst === r.ast.miss; } }
  return d;
}
VG.card = function (no) {
  if (C[no]) return C[no];
  if (typeof no === 'string' && no.startsWith('TOKEN/x:')) { const t = makeTok(no); if (t) C[no] = t; return t; }
  const r = DB.byNo[no]; if (!r) return undefined;
  return (C[no] = make(r, no));
};
VG.canon = no => (DB.byNo[no] ? DB.byNo[no].no : no);

/* ---- deck storage shape: { name, ride: [no], main: ["4|no", ...] } ---- */
VG.packDeck = d => ({ name: d.name, ride: d.ride.slice(), main: d.main.map(e => e.n + '|' + e.no), t: d.t || Date.now() });
VG.unpackDeck = function (id, p) {
  if (!p || !Array.isArray(p.ride) || !Array.isArray(p.main)) return null;
  const ride = p.ride.map(String).filter(no => VG.card(no)).slice(0, 8);
  const main = [];
  for (const x of p.main.slice(0, 80)) { const m = /^(\d{1,2})\|(.+)$/.exec(String(x)); if (!m || !VG.card(m[2])) continue; const n = Math.min(+m[1], 50); if (n > 0) main.push({ no: m[2], n }); }
  const d = { id, name: String(p.name || 'เด็คของฉัน').slice(0, 40), ride, main, custom: true, t: +p.t || 0, source: 'เด็คของฉัน' };
  d.nation = VG.deckNation(d);
  return d;
};
VG.deckNation = function (d) {
  const cnt = {};
  for (const e of d.main) { const c = VG.card(e.no); if (c && c.nation) cnt[c.nation] = (cnt[c.nation] || 0) + e.n; }
  for (const no of d.ride) { const c = VG.card(no); if (c && c.nation) cnt[c.nation] = (cnt[c.nation] || 0) + 1; }
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '';
};
/* returns { errors: [...], counts: {...}, manual: [names], playable } — errors are rule problems; `playable` only needs a grade 0 to stand on and a deck to draw from */
VG.inspectDeck = function (deck) {
  const errs = []; const names = {}; const k = { main: 0, trig: 0, crit: 0, draw: 0, front: 0, heal: 0, over: 0, sent: 0, order: 0, g: [0, 0, 0, 0, 0], kinds: 0, autoKinds: 0 };
  const manual = []; const nation = VG.deckNation(deck); const offNation = [];
  const see = (c, n) => { const nm = c.as || c.name; names[nm] = (names[nm] || 0) + n; if (c.nation && nation && c.nation !== nation && !offNation.includes(c.name)) offNation.push(c.name); if (!c.auto && !manual.includes(c.name)) manual.push(c.name); k.kinds++; if (c.auto) k.autoKinds++; };
  for (const e of deck.main) {
    const c = VG.card(e.no); if (!c) { errs.push('ไม่รู้จักการ์ด ' + e.no); continue; }
    k.main += e.n; see(c, e.n);
    if (c.type === 'crest' || c.type === 'other' || c.type === 'token' || c.gunit || c.special) errs.push(c.name + ' ใส่ในเมนเด็คไม่ได้');
    if (c.trigger) { k.trig += e.n; k[c.trigger] = (k[c.trigger] || 0) + e.n; }
    else if (c.type === 'order') k.order += e.n;
    else if (c.type === 'unit') k.g[Math.min(c.grade || 0, 4)] += e.n;
    if (c.sentinel) k.sent += e.n;
  }
  const rg = [0, 0, 0, 0]; let crest = 0, rdTE = 0;
  for (const no of deck.ride) {
    const c = VG.card(no); if (!c) { errs.push('ไม่รู้จักการ์ด ' + no); continue; }
    see(c, 1);
    if (c.type === 'crest') crest++; else if (c.rideDeckOK) rdTE++; else if (c.type === 'unit' && c.grade <= 3) rg[c.grade]++; else errs.push(c.name + ' อยู่ในไรด์เด็คไม่ได้');
  }
  { let gn = 0; for (const e of deck.g || []) { const c = VG.card(e.no); if (!c) { errs.push('ไม่รู้จักการ์ด ' + e.no); continue; } if (!c.gunit && !c.special) errs.push(c.name + ' อยู่ใน G โซนไม่ได้'); gn += e.n || 1; see(c, e.n || 1); } if (gn > 16) errs.push('G โซนมีได้ไม่เกิน 16 ใบ (ตอนนี้ ' + gn + ')'); k.gz = gn; }
  if (k.main !== 50) errs.push('เมนเด็คต้องมี 50 ใบ (ตอนนี้ ' + k.main + ')');
  if (k.trig !== 16) errs.push('ทริกเกอร์ต้องมี 16 ใบ (ตอนนี้ ' + k.trig + ')');
  if (k.heal > 4) errs.push('ฮีลทริกเกอร์เกิน 4 ใบ'); if (k.over > 1) errs.push('โอเวอร์ทริกเกอร์เกิน 1 ใบ'); if (k.sent > 4) errs.push('เซนทิเนลเกิน 4 ใบ');
  if (rdTE) { for (let g = 0; g <= 2; g++) if (rg[g] < 1) errs.push('ไรด์เด็คต้องมีเกรด ' + g + ' อย่างน้อย 1 ใบ'); if (rg.reduce((a, b) => a + b, 0) !== 4) errs.push('ไรด์เด็คที่มี Training Equipment ต้องมียูนิท 4 ใบ (เกรด 0-2 อย่างละ 1 และยูนิทที่ไม่มีชื่อ Kiwame 1 ใบ)'); }
  else for (let g = 0; g <= 3; g++) if (rg[g] !== 1) errs.push('ไรด์เด็คต้องมีเกรด ' + g + ' จำนวน 1 ใบ (ตอนนี้ ' + rg[g] + ')');
  if (crest > 1) errs.push('ไรด์เด็คมีเครสต์ได้ 1 ใบ');
  for (const n in names) { const lim = (VG.DB.byName[n] && VG.DB.byName[n].lim) || 4; if (names[n] > lim) errs.push(n + ' เกิน ' + lim + ' ใบ (รวมไรด์เด็ค)'); }
  if (offNation.length) errs.push('มีการ์ดต่างเนชั่นจาก ' + nation + ': ' + offNation.slice(0, 4).join(', ') + (offNation.length > 4 ? ' และอีก ' + (offNation.length - 4) + ' ใบ' : ''));
  return { errors: errs, counts: k, manual, nation, playable: rg[0] >= 1 && k.main >= 20 };
};
VG.checkDeck = deck => VG.inspectDeck(deck).errors;
})(typeof globalThis !== 'undefined' ? globalThis : this);
