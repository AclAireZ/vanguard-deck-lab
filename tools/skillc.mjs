// Skill compiler: reads the wording of a card's skills and produces a compact structured description of what the card does.
// The page ships only that structured form (and renders its own Thai summary from it), never the original wording.
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fifteen: 15 };
const N = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fifteen|\\d+)';
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const num = w => (w in NUMW ? NUMW[w] : +w);
import fs from 'node:fs'; import crypto from 'node:crypto';
/* HAND-WRITTEN LINES (tools/hand-ast.txt): what a line the reader cannot read does, written by hand in the same structured form.
   One entry per line of the file:  <key> <json>   — key = lineKey() of the canonical line (a hash: the file holds no card wording);  "@<card name>\t<json>" = the whole card (cards with no English wording).
   json: { a: [abilities…] } and/or card-level fields (p: order play {k,c,d,from} merged, o, tg, od, …). Names inside use «0», «1»… = the quoted names of that card in order. */
export const lineKey = (l, bullets) => crypto.createHash('sha1').update(l + (bullets && bullets.length ? '\n' + bullets.join('\n') : '')).digest('hex').slice(0, 10);
export const HANDAST = new Map(); export const HANDCARD = new Map(); export const HANDUSED = new Set();
{ const f = new URL('./hand-ast.txt', import.meta.url);
  if (fs.existsSync(f)) for (const ln of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!ln.trim() || ln[0] === '#') continue;
    try {
      if (ln[0] === '@') { const t = ln.indexOf('\t'); HANDCARD.set(ln.slice(1, t), JSON.parse(ln.slice(t + 1))); }
      else { const sp = ln.indexOf(' '); HANDAST.set(ln.slice(0, sp), JSON.parse(ln.slice(sp + 1))); }
    } catch (e) { throw new Error('hand-ast.txt: bad entry "' + ln.slice(0, 60) + '…": ' + e.message); }
  } }
const fillNames = (v, names) => (typeof v === 'string' ? v.replace(/«(\d+)»/g, (x, k) => (names[+k] != null ? names[+k] : x)) : Array.isArray(v) ? v.map(x => fillNames(x, names)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fillNames(x, names)])) : v);
function applyHand(out, ov, names, isOrder, head) {
  let v = fillNames(ov, names);
  // short form: one ability without the { a: [...] } wrapper; type, zone and 1/turn are read from the line's own header unless given
  const fill = ab => { if (!ab.t) ab.t = head ? head.t : ab.on ? 'a' : ab.m ? 'c' : 'k'; if (head) { if (!ab.t) ab.t = head.t; if (ab.z === undefined && head.z) ab.z = head.z; if (ab.z === 0) delete ab.z; if (ab.l === undefined && head.l) ab.l = 1; if (ab.l === 0) delete ab.l; } return ab; };
  if (Array.isArray(v)) v = { a: v };
  else if (!v.a && (v.d || v.m || v.on)) v = { a: [v] };
  if (v.a) v.a = v.a.map(fill);
  for (const k of Object.keys(v)) {
    if (k === 'a') { for (const ab of v.a) { if (isOrder && !ab.z) ab.z = 'O'; out.a.push(ab); } }
    else if (k === 'p') { const play = out.p || (out.p = { d: [] }); if (v.p.k) play.k = v.p.k; if (v.p.c) play.c = (play.c || []).concat(v.p.c); if (v.p.from) play.from = (play.from || []).concat(v.p.from); if (v.p.d) play.d.push(...v.p.d); for (const x of Object.keys(v.p)) if (!['k', 'c', 'from', 'd'].includes(x)) play[x] = v.p[x]; }
    else if (k === 'tg' || k === 'bind' || k === 'x' || k === 'ra') out[k] = (out[k] || []).concat(v[k]);

    else out[k] = v[k];
  }
}
export class Fail extends Error { constructor(at, why) { super('unparsed'); this.at = at; this.why = why || ''; } }
const NATIONS = { 'dragon empire': 'Dragon Empire', 'dark states': 'Dark States', 'brandt gate': 'Brandt Gate', 'keter sanctuary': 'Keter Sanctuary', stoicheia: 'Stoicheia', 'lyrical monasterio': 'Lyrical Monasterio',
  // title boosters: the name in the pointed brackets is the card's nation there
  'dark zone': 'Dark Zone', 'touken ranbu': 'Touken Ranbu', 'shaman king': 'SHAMAN KING', buddyfight: 'Buddyfight', 'bang dream!': 'BanG Dream!', 'record of ragnarok': 'Record of Ragnarok', corocoro: 'CoroCoro', 'inazuma eleven': 'Inazuma Eleven', 'monster strike': 'Monster Strike', 'vspo!': 'VSPO!' };
const ZONE_TOK = 'vc|rc|gc|drop|soul|hand|order zone|bind zone|vc\\/rc|damage zone|deck|g zone|gauge zone|rc\\/gc|vc\\/rc\\/gc';
const ZONE_RE = new RegExp('^(?:' + ZONE_TOK + ')$', 'i');
const ZCODE = { vc: 'V', rc: 'R', gc: 'G', drop: 'D', soul: 'S', hand: 'H', 'order zone': 'O', 'bind zone': 'B' };
const ZWORD = { hand: 'hand', drop: 'drop', soul: 'soul', 'damage zone': 'damage', 'bind zone': 'bind', 'order zone': 'order', 'ride deck': 'ride', deck: 'deck', 'among them': 'looked' };
const TRIGW = { critical: 'crit', draw: 'draw', front: 'front', heal: 'heal', over: 'over' };
const gspec = (g, tail) => (tail ? (tail.includes('less') ? [0, g] : [g, 99]) : [g, g]);
const opOf = w => (/more|greater/.test(w) ? '>=' : '<=');

export function canonLines(effect) {
  const names = [];
  let s = (effect || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/（/g, '(').replace(/）/g, ')').replace(/＋/g, '+').replace(/[‐－–]/g, '-').replace(/[＜〈《]/g, '<').replace(/[＞〉》]/g, '>')
    .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).replace(/[①-⑨]/g, d => String(d.charCodeAt(0) - 0x245F));
  // quoted names → «n». A name can itself hold a quoted nickname:  "Zorga "Mother""  — seen as a quote that closes right after a space and reopens before a letter.
  { let out = ''; let i = 0;
    while (i < s.length) {
      const q = s.indexOf('"', i); if (q < 0) { out += s.slice(i); break; }
      out += s.slice(i, q); let j = s.indexOf('"', q + 1); const nl = s.indexOf('\n', q + 1);
      if (j < 0 || (nl >= 0 && nl < j)) { out += '"'; i = q + 1; continue; }
      if (/^\[(?:AUTO|ACT|CONT)\]/i.test(s.slice(q + 1, q + 8))) { const e = s.indexOf('."', q + 1); const lim = nl < 0 ? s.length : nl; if (e >= 0 && e < lim) j = e + 1; }
      else if (s[j - 1] === ' ' && j > q + 2 && /\S/.test(s[j + 1] || ' ') && s[j + 1] !== '"') { const k = s.indexOf('"', j + 1); const l = k < 0 ? -1 : s.indexOf('"', k + 1); const lim = nl < 0 ? s.length : s.indexOf('\n', j); if (l >= 0 && (lim < 0 || l < lim) && l - k < 40 && !/[,.:\[\]]/.test(s.slice(j + 1, k))) j = l; }
      names.push(s.slice(q + 1, j).trim()); out += '«' + (names.length - 1) + '»'; i = j + 1;
    }
    s = out; }
  // brackets hold either a zone or reminder text (dropped). A bracket right behind [AUTO]/[ACT]/[CONT] is always the place the ability works in: an unknown one is kept, so the line is refused instead of being read as "works anywhere"
  for (let k = 0; k < 3; k++) s = s.replace(/\(([^()]*)\)/g, (m, inner, off, str) => (ZONE_RE.test(inner.trim()) || /\[(?:auto|act|cont)\]\s*(?:(?:\([^()]*\)|⦅[^⦆]*⦆)\s*\/?\s*)*$/i.test(str.slice(0, off)) ? '⦅' + inner.trim().toLowerCase() + '⦆' : ' '));
  s = s.replace(/⦅/g, '(').replace(/⦆/g, ')').toLowerCase();
  s = s.replace(/\[1\/turn\]/g, '[1/turn]').replace(/\s*\+\s*/g, '+').replace(/\] ?- ?(?=\d)/g, ']-').replace(/[ \t]+/g, ' ').replace(/ ([,.!])/g, '$1').replace(/(\d+) million/g, (m, d) => String(+d * 1000000));
  // icons printed outside their brackets: "[counter-blast]1" → "counter-blast 1", "& rest] this unit" → "& [rest] this unit"
  s = s.replace(/\[cost\]\[(counter-blast|soul-blast|energy-blast)\] ?(\d+)/g, '[cost][$1 $2').replace(/& ?\[(counter-blast|soul-blast|energy-blast)\] ?(\d+)/g, '& $1 $2')
    .replace(/\[(soul-charge|counter-charge|energy-charge)\] ?(\d+)(?!\d)\]?/g, '[$1 $2]').replace(/(^|[^\[a-z])(rest|stand)\]/gm, '$1[$2]');
  // a cost whose first icon lost a bracket: "[cost][rest] this unit]" → "[cost][[rest] this unit]", "[cost][soul-blast 1] & retire this unit]" → "[cost][soul-blast 1 & retire this unit]"
  s = s.replace(/\[cost\]\[(rest|stand)\] (?=[^\[\]]*\])/g, '[cost][[$1] ').replace(/\[cost\]\[((?:soul|counter|energy)-blast \d+)\] ?(?=(?:&|cards?\b|gem\b|grade\b)[^\[\]]*\])/g, '[cost][$1 ');
  s = s.replace(/\b(?:your|the) (hand|deck|drop zone|drop|soul|ride deck|damage zone|order zone|bind zone)\b/g, '$1').replace(/\bdrop zone\b/g, 'drop').replace(/\bthe (top|bottom) of\b/g, '$1 of').replace(/\bthe top or bottom of\b/g, 'top or bottom of')
    .replace(/\bin their card names\b/g, 'in its card name').replace(/\bcard names?\b/g, 'card name').replace(/\b(an?|your) open \(rc\)/g, 'an open (rc)').replace(/\b(to|on|from) your \((rc|vc|gc)\)/g, '$1 ($2)')
    .replace(/\bfrom among (?:it|the revealed cards|those cards)\b/g, 'from among them').replace(/\bcard's (?:effects?|abilities)\b/g, "card's ability").replace(/\bcard effects?\b/g, "card's ability").replace(/\bvanguard's effect\b/g, "vanguard's ability").replace(/\bisn't\b/g, 'is not').replace(/\bits owner's\b/g, 'its');
  return { lines: s.split('\n').map(l => l.trim()).filter(l => l && l !== '-'), names };
}
function bracketEnd(s, i) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === '[') d++; else if (s[k] === ']') { d--; if (d === 0) return k; } } return -1; }
const DUR = { turn: 't', 'that turn': 't', 'this turn': 't', 'that battle': 'b', 'this battle': 'b', "your opponent's next turn": 'o', 'the next turn': 'o' };
const DURRE = "(turn|that turn|this turn|that battle|this battle|your opponent's next turn)";
const SUBJ = { 'this unit': 'me', 'this card': 'me', it: 'it', they: 'it', 'that unit': 'it', 'that card': 'it', 'those units': 'it', 'each of them': 'it', 'that unit and this unit': 'it+me', 'this unit and that unit': 'it+me', 'it and this unit': 'it+me',
  'that called unit': 'it', 'those called units': 'it', 'the called unit': 'it', 'the called units': 'it', 'the chosen unit': 'it', 'the chosen units': 'it', 'those cards': 'it', 'the unit called by this effect': 'it', 'the units called by this effect': 'it',
  'all of your units': 'all', 'all of your front row units': 'front', 'all of your rear-guards': 'rgs', 'all of your vanguards': 'vgs', 'your vanguard': 'vgs', 'all of your back row rear-guards': 'backrg', 'all of your front row rear-guards': 'frontrg', 'all of your other units': 'others', 'all of your other rear-guards': 'otherrg',
  'all of your units in the same column as this unit': 'col', 'all of your other units in the same column as this unit': 'colo', 'the boosted unit': 'boosted', 'the unit boosted by this unit': 'boosted', 'the attacking unit': 'attacker', 'that attacking unit': 'attacker' };
const SUBJKEYS = Object.keys(SUBJ).sort((a, b) => b.length - a.length);
const KW = { boost: { boost: 1 }, intercept: { intercept: 1 }, 'twin drive': { driveMin: 2 }, 'triple drive': { driveMin: 3 } };
const ITEM = '(?:\\[[a-z]+\\] ?[+-]\\d+(?:\\/\\[[a-z]+\\] ?[+-]\\d+|\\/drive ?[+-]\\d+)*|drive ?[+-]\\d+|«\\d+»)';
const KIND = w => (w[0] === 'v' ? 'v' : w[0] === 'r' ? 'r' : 'u');

class P {
  constructor(names, races, self) { this.names = names; this.races = races; this.self = self; this.kind = 'auto'; this.dur = null; this.depth = 0; this.last = null; this.lastCond = null; this.ante = null; }
  name(tok) { const m = /«(\d+)»/.exec(tok); return this.names[+m[1]]; }
  /* who an ability belongs to, from the groups of the "the ability of …" pattern */
  byWho(m) { if (m[5]) return { k: 'o', nm: this.name(m[5]) }; const by = { k: m[2] === 'unit' ? 'u' : 'v' }; if (m[1]) by.gmin = +m[1]; if (m[3]) by.nh = this.name(m[3]); if (m[4]) by.nh2 = this.name(m[4]); return by; }
  isRace(w) { return this.races.has(w.trim()); }
  /* "<race>" / "<nation>" or a bare race word at the start of s → [filter, length]. Bare words need `tail` (a regexp source that must follow). */
  raceAt(s, tail) {
    let m = /^<([^>]+)>/.exec(s);
    if (m) { const w = m[1].trim(); if (NATIONS[w]) return [{ na: NATIONS[w] }, m[0].length]; if (this.isRace(w)) return [{ rc: w }, m[0].length]; return null; }
    if (!tail) return null;
    const words = s.split(' ');
    for (let k = Math.min(4, words.length); k >= 1; k--) {
      const w = words.slice(0, k).join(' '); if (!/^[a-z][a-z' -]*$/.test(w)) continue;
      for (const cand of [w, w.replace(/s$/, ''), w.replace(/ies$/, 'y')]) if (this.isRace(cand) && new RegExp('^' + tail).test(s.slice(w.length))) return [{ rc: cand }, w.length];
    }
    return null;
  }
  nameMods(s, i, F) {
    let m; const r = s.slice(i);
    if ((m = /^ with («\d+»)(?: or («\d+»))? in (?:its|their) different card name from (this unit|this card|your vanguard)/.exec(r))) { F.nh = this.name(m[1]); if (m[2]) F.nh2 = this.name(m[2]); if (m[3] === 'your vanguard') F.dnv = 1; else F.dn = 1; return i + m[0].length; }
    if ((m = /^ with («\d+»)(?: or («\d+»))? in (?:its|their) different card name/.exec(r))) { F.nh = this.name(m[1]); if (m[2]) F.nh2 = this.name(m[2]); F.dist = 1; return i + m[0].length; }
    if ((m = /^ with a different card name from your vanguard/.exec(r))) { F.dnv = 1; return i + m[0].length; }
    if ((m = /^ with different card name(?: from each other)?/.exec(r))) { F.dist = 1; return i + m[0].length; }
    if ((m = /^ with («\d+») or («\d+») in its card name/.exec(r))) { F.nh = this.name(m[1]); F.nh2 = this.name(m[2]); return i + m[0].length; }
    if ((m = /^ with («\d+») in its card name/.exec(r))) { F.nh = this.name(m[1]); return i + m[0].length; }
    if ((m = /^ with the same card name as this (?:unit|card)/.exec(r))) { F.sn = 1; return i + m[0].length; }
    if ((m = /^ with the same card name as your vanguard/.exec(r))) { F.snv = 1; return i + m[0].length; }
    if ((m = /^ with a different card name from this (?:unit|card)/.exec(r))) { F.dn = 1; return i + m[0].length; }
    if ((m = /^ with persona ride/.exec(r))) { F.pr = 1; return i + m[0].length; }
    if ((m = /^ with the \[(x?)overdress\] ability( or (?:the )?\[xoverdress\] ability)?/.exec(r))) { F.oda = m[2] ? 'ox' : m[1] ? 'x' : 'o'; return i + m[0].length; }
    if ((m = /^ with the [\[<]([^\]>]{2,30})[\]>] ability/.exec(r))) { F.tag = m[1]; return i + m[0].length; }
    if ((m = /^ and \[(divine skill)\]/.exec(r))) { F.tag = m[1]; return i + m[0].length; }
    if ((m = /^ and grade (?:equal to or less than|less than or equal to) (?:that of )?your vanguard(?:'s)?(?: grade)?/.exec(r))) { F.gv = 1; return i + m[0].length; }
    if ((m = /^ with original \[power\] ?(\d+) or (less|greater|more)/.exec(r))) { F.op = [opOf(m[2]), +m[1]]; return i + m[0].length; }
    if ((m = /^ with (?:a )?grade (?:equal to or less than|less than or equal to) (?:that of )?your vanguard(?:'s)?(?: grade)?/.exec(r))) { F.gv = 1; return i + m[0].length; }
    if ((m = /^ with (?:a )?grade less than (?:that of )?your vanguard(?:'s)?(?: grade)?/.exec(r))) { F.gv = 2; return i + m[0].length; }
    return -1;
  }

  /* noun phrase describing cards: returns [filter, length] */
  np1(s) {
    let i = 0; const F = {}; let m; let got = false;
    if ((m = /^non-sentinel /.exec(s))) { F.ns = 1; i = m[0].length; }
    if ((m = /^grade (\d+)( or less| or greater)?(?= with|,|$| from| or (?!less|greater))/.exec(s.slice(i)))) { F.g = gspec(+m[1], m[2]); i += m[0].length; got = true; }
    else if ((m = /^grade (\d+)( or less| or greater)? /.exec(s.slice(i)))) { F.g = gspec(+m[1], m[2]); i += m[0].length; }
    let r = s.slice(i); let ra;
    if (got) { /* grade used as the noun */ }
    else if ((m = /^(«\d+»)(?: cards?)?/.exec(r))) { F.nm = this.name(m[1]); i += m[0].length; }
    else if ((ra = this.raceAt(r))) { Object.assign(F, ra[0]); i += ra[1]; if ((m = /^ (normal units?|trigger units?|unit cards?|units?|cards?|normal orders?|set orders?|orders?)(?![a-z])/.exec(s.slice(i)))) { const ty = { 'normal unit': 'nu', 'trigger unit': 'tu', 'unit card': 'u', unit: 'u', 'normal order': 'no', 'set order': 'so', order: 'o' }[m[1].replace(/s$/, '')]; if (ty) F.ty = ty; i += m[0].length; } }
    else if ((m = /^\[glitter\](?: (units?|cards?|normal units?))?(?![a-z])/.exec(r))) { F.gl = 1; if (m[1] && /unit/.test(m[1])) F.ty = m[1].startsWith('normal') ? 'nu' : 'u'; i += m[0].length; }
    else if ((m = /^\[(critical|draw|front|heal|over)\] triggers?(?: or \[(critical|draw|front|heal)\] triggers?)?/.exec(r))) { F.tr = [TRIGW[m[1]]]; if (m[2]) F.tr.push(TRIGW[m[2]]); i += m[0].length; }
    else if ((m = /^(normal units?|trigger units?|non-trigger units?|trigger cards?|unit cards?|normal orders?|set orders?|blitz orders?|order cards?|orders|units?|rear-guards?|cards?)(?![a-z])/.exec(r))) {
      const k = m[1].replace(/s$/, '');
      const ty = { 'normal unit': 'nu', 'non-trigger unit': 'nu', 'trigger unit': 'tu', 'trigger card': 'tu', 'unit card': 'u', 'normal order': 'no', 'set order': 'so', 'blitz order': 'bo', 'order card': 'o', order: 'o', unit: 'u', 'rear-guard': 'u', card: '' }[k];
      if (ty) F.ty = ty; i += m[0].length;
    } else if ((ra = this.raceAt(r, ' (?:normal units?|unit cards?|cards?|units?|orders?)(?![a-z])'))) { Object.assign(F, ra[0]); i += ra[1]; m = /^ (normal units?|unit cards?|cards?|units?|orders?)/.exec(s.slice(i)); if (/unit/.test(m[1])) F.ty = m[1].startsWith('normal') ? 'nu' : 'u'; else if (m[1].startsWith('order')) F.ty = 'o'; i += m[0].length; }
    else return null;
    for (;;) {
      const j = this.nameMods(s, i, F); if (j >= 0) { i = j; continue; }
      r = s.slice(i);
      if ((m = /^ (?:without sentinel|other than a sentinel|without «\d+»)/.exec(r))) { if (/«/.test(m[0]) && !/sentinel/i.test(this.name(m[0]))) break; F.ns = 1; i += m[0].length; continue; }
      if ((m = /^ other than \[over\](?: triggers?)?/.exec(r))) { F.nov = 1; i += m[0].length; continue; }
      if ((m = /^ (?:other than|not named) («\d+»)/.exec(r))) { F.nn = this.name(m[1]); i += m[0].length; continue; }
      break;
    }
    return [F, i];
  }
  np(s) {
    const a = this.np1(s); if (!a) return null;
    const m = /^ or (?:up to one |one |an? )?/.exec(s.slice(a[1]));
    if (m) { const b = this.np1(s.slice(a[1] + m[0].length)); if (b && /^(?: from| in| on| to|,|$)/.test(s.slice(a[1] + m[0].length + b[1]))) return [{ or: [a[0], b[0]] }, a[1] + m[0].length + b[1]]; }
    return a;
  }
  /* a loose race plural used as a noun on its own: "three or more meteorites in order zone" */
  npLoose(s) { const a = this.np(s); if (a) return a; const ra = this.raceAt(s, '(?: in | on | from |,|$)'); return ra ? [ra[0], ra[1]] : null; }
  zones(s) {
    const m = /^(hand|drop|soul|damage zone|bind zone|order zone|ride deck|deck|among them)((?:,? (?:or|and) |, )(hand|drop|soul|deck|bind zone))?((?:,? (?:or|and) )(hand|drop|soul|deck))?/.exec(s);
    if (!m) return null;
    const z = [ZWORD[m[1]]]; if (m[3]) z.push(ZWORD[m[3]]); if (m[5]) z.push(ZWORD[m[5]]);
    return [z, m[0].length];
  }
  /* unit description after "your"/"your opponent's"/"a": "other [stand] front row grade 2 or less <race> rear-guards with «0» in its card name in the same column as this unit" → [{k, f}, length] */
  ud(s) {
    let i = 0; const f = {}; let m, k = null; const eat = re => { m = re.exec(s.slice(i)); if (m) i += m[0].length; return m; };
    if (eat(/^other /)) f.ot = 1;
    if (eat(/^\[(stand|rest)\] /)) f.st = m[1] === 'stand' ? 's' : 'r';
    if (eat(/^(front|back) row /)) f.row = m[1][0];
    if (eat(/^grade (\d+)( or less| or greater)? /)) f.g = gspec(+m[1], m[2]);
    if (eat(/^other /)) f.ot = 1;
    if (eat(/^\[(stand|rest)\] /)) f.st = m[1] === 'stand' ? 's' : 'r';
    let ra;
    if (eat(/^(«\d+»)(?: (units?|vanguards?|rear-guards?)(?![a-z]))?/)) { f.nm = this.name(m[1]); k = m[2] ? KIND(m[2]) : 'u'; }
    else if ((ra = this.raceAt(s.slice(i)))) { Object.assign(f, ra[0]); i += ra[1]; if (eat(/^ (normal )?(units?|vanguards?|rear-guards?)(?![a-z])/)) { k = KIND(m[2]); if (m[1]) f.ty = 'nu'; } else k = 'u'; }
    else if (eat(/^\[glitter\](?: (units?|vanguards?|rear-guards?)(?![a-z]))?/)) { f.gl = 1; k = m[1] ? KIND(m[1]) : 'u'; }
    else if (eat(/^(shadow army|plant|token) (?:tokens?|units?)(?![a-z])/)) { f.tk = m[1] === 'token' ? 1 : m[1]; k = 'r'; }
    else if (eat(/^(normal |trigger )?(units?|vanguards?|rear-guards?)(?![a-z-])/)) { k = KIND(m[2]); if (m[1]) f.ty = m[1][0] === 'n' ? 'nu' : 'tu'; }
    else if ((ra = this.raceAt(s.slice(i), ' (?:units?|vanguards?|rear-guards?)(?![a-z])'))) { Object.assign(f, ra[0]); i += ra[1]; eat(/^ (units?|vanguards?|rear-guards?)/); k = KIND(m[1]); }
    else return null;
    for (;;) {
      const j = this.nameMods(s, i, f); if (j >= 0) { i = j; continue; }
      if (eat(/^ in the same column as this unit/)) { f.col = 1; continue; }
      if (eat(/^ in the same column as (?:that unit|it|that called unit|that card)/)) { f.colit = 1; continue; }
      if (eat(/^ other than this unit/)) { f.ot = 1; continue; }
      if (eat(/^ on \(rc\) with (?:an? )?(?:([a-z][a-z' -]*?) )?markers?/)) { k = 'r'; f.mk = m[1] || 1; continue; }
      if (eat(/^ in the \[(x?)overdress\] state( or (?:the )?\[xoverdress\] state)?/)) { f.ods = m[2] ? 'ox' : m[1] ? 'x' : 'o'; continue; }
      if (eat(new RegExp('^ with (?:(?:an? )?originaldress|' + N + ' or more originaldress)'))) { f.odn = m[1] ? num(m[1]) : 1; continue; }
      if (eat(/^ in (?:the|your|their) (front|back) row/)) { f.row = m[1][0]; continue; }
      if (eat(/^ on \(vc\) or \(rc\)/)) { k = 'u'; continue; }
      if (eat(/^ on \(rc\)/)) { k = 'r'; continue; }
      if (eat(/^ on \(vc\)/)) { k = 'v'; continue; }
      break;
    }
    return [{ k, f }, i];
  }
  unitSel(s) {
    let m;
    if ((m = /^choose (?:a|one of your) units? being attacked/.exec(s))) return [{ s: 'm', k: 'atkd', n: 1 }, m[0].length];
    m = new RegExp('^choose (up to |any number of )?(?:' + N + ' )?(?:of )?(your opponent\'s |your )?').exec(s);
    if (!m || (!m[2] && !(m[1] || '').startsWith('any'))) return null;
    if (!m[3] && !/^choose (up to )?(a|an|one) «/.test(s)) return null;
    const d = this.ud(s.slice(m[0].length)); if (!d) return null;
    if (!m[3] && /^ (?:from|or) /.test(s.slice(m[0].length + d[1]))) return null;
    const any = (m[1] || '').startsWith('any');
    const sel = { s: (m[3] || '').includes('opponent') ? 'o' : 'm', k: d[0].k, n: any ? 99 : num(m[2]) }; if (m[1]) sel.up = 1;
    if (Object.keys(d[0].f).length) sel.f = d[0].f;
    return [sel, m[0].length + d[1]];
  }
  /* subject of "… get(s) …": a fixed phrase or "all of your <units>" → [target, length] */
  subject(s) {
    let fixed = null;
    for (const k of SUBJKEYS) if (s.startsWith(k) && /^(?: |,|$)/.test(s.slice(k.length))) { fixed = [SUBJ[k], k.length]; break; }
    const m = /^all of (your opponent's|your) /.exec(s);
    if (m) { const d = this.ud(s.slice(m[0].length)); if (d && (!fixed || m[0].length + d[1] > fixed[1])) { const t = { s: m[1].includes('opponent') ? 'o' : 'm', k: d[0].k }; if (Object.keys(d[0].f).length) t.f = d[0].f; return [t, m[0].length + d[1]]; } }
    if (fixed) return fixed;
    if (s.startsWith("your opponent's vanguard") && /^(?: |,|$)/.test(s.slice(24))) return [{ s: 'o', k: 'v' }, 24];
    return null;
  }
  count(s) {
    let m;
    if ((m = /^for each of (your opponent's|your) /.exec(s))) { const d = this.ud(s.slice(m[0].length)); if (d) return [['u', m[1].includes('opponent') ? 'o' : 'm', d[0].k, d[0].f], m[0].length + d[1]]; }
    if ((m = new RegExp('^for every ' + N + ' of (your opponent\'s|your) ').exec(s))) { const d = this.ud(s.slice(m[0].length)); if (d) return [['div', ['u', m[2].includes('opponent') ? 'o' : 'm', d[0].k, d[0].f], num(m[1])], m[0].length + d[1]]; }
    if ((m = /^for each of your opponent's open \(rc\)/.exec(s))) return [['oopen'], m[0].length];
    if ((m = /^for each of this unit's originaldress/.exec(s))) return [['odc'], m[0].length];
    if ((m = /^for each (?:of your )?([a-z][a-z' -]*?) markers? on \(rc\)/.exec(s))) return [['mkn', m[1]], m[0].length];
    if ((m = /^for each \(rc\) with (?:your |an? )?([a-z][a-z' -]*?) markers?/.exec(s))) return [['mkn', m[1], 'rc'], m[0].length];
    if ((m = /^for each (face up )?card in damage zone/.exec(s))) return [[m[1] ? 'dmgUp' : 'z', 'damage'], m[0].length];
    if ((m = /^for each card in (soul|hand|drop|bind zone|order zone)/.exec(s))) return [['z', ZWORD[m[1]]], m[0].length];
    if ((m = /^for each card in your opponent's (damage zone|hand|drop)/.exec(s))) return [['oz', ZWORD[m[1]]], m[0].length];
    if ((m = new RegExp('^for every ' + N + ' cards in (soul|hand|drop|bind zone|order zone|damage zone)').exec(s))) return [['div', ['z', ZWORD[m[2]]], num(m[1])], m[0].length];
    if ((m = /^for each grade of (the attacking unit|your vanguard|your opponent's vanguard|that unit|it)/.exec(s))) return [['grade', m[1].includes('attacking') ? 'atk' : m[1].includes('opponent') ? 'ovg' : m[1].includes('your') ? 'vg' : 'it'], m[0].length];
    if ((m = new RegExp('^for every ' + N + ' grades of (the attacking unit|your vanguard|your opponent\'s vanguard|that unit|it)').exec(s))) return [['div', ['grade', m[2].includes('attacking') ? 'atk' : m[2].includes('opponent') ? 'ovg' : m[2].includes('your') ? 'vg' : 'it'], num(m[1])], m[0].length];
    if ((m = /^for each (?:card|unit|rear-guard) (?:retired|discarded|bound|put|chosen|called|revealed|returned)(?: for this cost| this way| by this effect| into soul| to hand)?/.exec(s))) return [['paid'], m[0].length];
    if ((m = /^for each (?:of your )?/.exec(s))) { const np = this.npLoose(s.slice(m[0].length)); if (np) { const r = s.slice(m[0].length + np[1]); const z = /^ (?:in|on) (order zone|soul|drop|bind zone|damage zone|hand|\(rc\))/.exec(r); if (z) return [z[1] === '(rc)' ? ['u', 'm', 'r', np[0]] : ['zf', ZWORD[z[1]], np[0]], m[0].length + np[1] + z[0].length]; } }
    return null;
  }

  /* ---------- conditions ---------- */
  cond1(s) {
    let m;
    const nm = t => this.name(t);
    const T = [
      [/^you (?:do|did)(?=,|$)/, () => ['did']],
      [/^you searched (?:deck|your deck)/, () => ['true']],
      [/^you did not (?:call|choose|reveal|put|retire|discard|bind|ride|add|return|place)(?: (?:an? |any )?(?:cards?|units?|rear-guards?))?(?: into hand| to \(rc\)| into soul| into order zone)?(?: this way| by this effect)?(?=,|$)/, () => ['none']],
      [/^you (?:called|chose|revealed|put|retired|discarded|bound|rode|added|returned|placed|locked) (?:an? |one or more |that )?(?:cards?|units?|rear-guards?)(?: into hand| to \(rc\)| into soul| from deck| into order zone| from hand)?(?: this way| by this effect| for this cost)?(?=,|$| or | and )/, () => ['got']],
      [/^you (?:drew|draw) a card/, () => ['drew']],
      [/^you put it (on top of deck|on bottom of deck|into soul|into hand|into drop)/, m => ['putTo', { 'on top of deck': 'top', 'on bottom of deck': 'bottom', 'into soul': 'soul', 'into hand': 'hand', 'into drop': 'drop' }[m[1]]]],
      [/^your (?:grade (\d+) or greater )?vanguard is («\d+») or («\d+»)/, m => ['vg', { gmin: m[1] ? +m[1] : 0, nm: nm(m[2]), nm2: nm(m[3]) }]],
      [/^your (?:grade (\d+) or greater )?vanguard is («\d+»)/, m => ['vg', { gmin: m[1] ? +m[1] : 0, nm: nm(m[2]) }]],
      [/^your vanguard is grade (\d+) or greater/, m => ['vg', { gmin: +m[1] }]],
      [/^your vanguard is grade (\d+) or less/, m => ['vg', { gmax: +m[1] }]],
      [/^your vanguard is grade (\d+)(?! or)/, m => ['vg', { gmin: +m[1], gmax: +m[1] }]],
      [/^your and your opponent's vanguards are grade (\d+) or greater/, m => ['and', ['vg', { gmin: +m[1] }], ['ovg', +m[1]]]],
      [/^your opponent's vanguard is grade (\d+) or greater/, m => ['ovg', +m[1]]],
      [/^your opponent's vanguard is grade (\d+) or less/, m => ['not', ['ovg', +m[1] + 1]]],
      [/^your opponent's vanguard is grade (\d+)(?! or)/, m => ['and', ['ovg', +m[1]], ['not', ['ovg', +m[1] + 1]]]],
      [/^your vanguard's grade is less than or equal to your opponent's vanguard's grade/, () => ['vgLe']],
      [/^your vanguard's grade is less than your opponent's vanguard's grade/, () => ['vgLt']],
      [/^you have a vanguard(?=,|$)/, () => ['true']],
      [/^this unit is in the \[(x?)overdress\] state/, m => ['ods', m[1] ? 'x' : 'o']],
      [/^you did not put a persona shield ticket into hand this turn/, () => ['nopst']],
      [/^this unit was chosen by the ability of (?:your (?:grade (\d+) or greater )?(vanguard|unit)(?: with («\d+»)(?: or («\d+»))? in its card name)?|(«\d+») in order zone) this turn/, m => ['chosen', this.byWho(m)]],
      [new RegExp('^your \\(rc\\) has (?:an? |' + N + ' or more )([a-z][a-z\' -]*?) markers?'), m => ['mkc', m[2], '>=', m[1] ? num(m[1]) : 1]],
      [new RegExp('^you have (?:an? |' + N + ' or more )([a-z][a-z\' -]*?) markers?(?: on \\(rc\\))?(?=,|$| and )'), m => ['mkc', m[2], '>=', m[1] ? num(m[1]) : 1]],
      [new RegExp('^there are ' + N + ' or more of your ([a-z][a-z\' -]*?) markers?'), m => ['mkc', m[2], '>=', num(m[1]), 'mine']],
      [/^(?:this unit is on a \(rc\) with|the \(rc\) this unit is on has) (your )?(?:an? )?(?:([a-z][a-z' -]*?) )?markers?/, m => ['mkon', m[2] || null, m[1] ? 1 : 0]],
      [/^(?:your |you have an? )([a-z][a-z' -]*?) marker(?: is)? in the same column as this unit/, m => ['mkcol', m[1], /^your/.test(m[0]) ? 1 : 0, /^your/.test(m[0]) ? 1 : 0]],
      [/^your opponent's \(rc\) has your ([a-z][a-z' -]*?) marker/, m => ['mkopp', m[1]]],
      [/^it (?:was an )?\[overdress\]/, () => ['evod']],
      [/^you have an? («\d+») crest/, m => ['crest', nm(m[1])]],
      [/^you are (not )?in («\d+»)/, m => (m[1] ? ['not', ['in', nm(m[2])]] : ['in', nm(m[2])])],
      [/^your world is (not )?(dark night or abyssal dark night|abyssal dark night|dark night)/, m => { const n = ['world', m[2] === 'dark night' ? 'd' : m[2] === 'abyssal dark night' ? 'a' : 'da']; return m[1] ? ['not', n] : n; }],
      [/^you went second/, () => ['second']],
      [/^you persona rode this turn/, () => ['persona']],
      [/^you did not ride this turn/, () => ['noRide']],
      [/^you did not \[(counter-charge|soul-charge)\] this turn/, m => ['not', ['tl', m[1][0] === 'c' ? 'cc' : 'sc']]],
      [/^you \[(counter-charge|soul-charge)\](?:ed)? this turn/, m => ['tl', m[1][0] === 'c' ? 'cc' : 'sc']],
      [/^the attacking unit's \[critical\] is (\d+) or greater, and its \[critical\] is increased by a non-trigger effect ability or its original \[critical\] is \d+ or greater/, m => ['atkCritFx', +m[1]]],
      [new RegExp('^(soul|drop|bind zone|order zone|hand) has ' + N + ' or more cards with different (grades|card name)'), m => ['cntD', ZWORD[m[1]], m[3][0] === 'g' ? 'g' : 'n', num(m[2])]],
      [/^you do not have a rear-guard with the same card name as (?:that|the revealed|the chosen) card/, () => ['noSameIt']],
      [/^you put (?:it |a card )?from (hand|drop|soul|deck)/, m => ['whereIs', ZWORD[m[1]]]],
      [new RegExp('^you played ' + N + ' or more orders this turn'), m => ['ordN', '>=', num(m[1])]],
      [/^you played an? (normal |set |blitz )?order this turn/, m => ['ord', m[1] ? m[1].trim()[0] : '']],
      [/^you did not play (?:any orders|an order) this turn/, () => ['noOrd']],
      [new RegExp('^(soul|drop|damage zone|hand|order zone|bind zone) has ' + N + ' or (more|less|fewer) cards(?! with)'), m => ['cnt', ZWORD[m[1]], opOf(m[3]), num(m[2])]],
      [new RegExp('^(soul|drop|damage zone|hand|order zone|bind zone) has ' + N + ' cards(?! with)'), m => ['cnt', ZWORD[m[1]], '==', num(m[2])]],
      [new RegExp('^you have ' + N + ' or (more|less|fewer) cards in (soul|drop|damage zone|hand|order zone|bind zone)'), m => ['cnt', ZWORD[m[3]], opOf(m[2]), num(m[1])]],
      [/^(soul|drop|hand|order zone|bind zone|damage zone) has no cards/, m => ['cnt', ZWORD[m[1]], '<=', 0]],
      [/^you have no cards in (soul|drop|hand|order zone|bind zone)/, m => ['cnt', ZWORD[m[1]], '<=', 0]],
      [new RegExp('^(?:your )?opponent\'s (damage zone|hand|drop|soul) has ' + N + ' or (more|less|fewer) cards'), m => ['ocnt', ZWORD[m[1]], opOf(m[3]), num(m[2])]],
      [new RegExp('^your opponent has ' + N + ' or (more|less|fewer) cards in (?:their )?(damage zone|hand|drop|soul)'), m => ['ocnt', ZWORD[m[3]], opOf(m[2]), num(m[1])]],
      [/^(?:damage zone has no face up cards|you have no face up cards in damage zone)/, () => ['noCB']],
      [new RegExp('^damage zone has ' + N + ' or more face down cards'), m => ['dmgDown', '>=', num(m[1])]],
      [new RegExp('^damage zone has (?:a|' + N + ' or more) face up cards?'), m => ['dmgUpN', '>=', m[1] ? num(m[1]) : 1]],
      [/^your opponent's front row has no rear-guards/, () => ['ofront0']],
      [/^the number of your rear-guards is more than your opponent's/, () => ['rgMore']],
      [/^you have more rear-guards than your opponent/, () => ['rgMore']],
      [/^you do not have (?:a|another) (?:rear-guard|unit) with the same card name as this (?:card|unit)/, () => ['noSame']],
      [/^all of your rear-guards have different card name from this card/, () => ['noSame']],
      [/^this unit (?:is|was) boosted/, () => ['boosted']],
      [/^this unit is (?:in|on) (?:the|a|your) (front|back) row(?: \(rc\))?/, m => ['row', m[1][0]]],
      [/^this unit is on \((vc|rc)\)/, m => ['zone', m[1] === 'vc' ? 'VC' : 'RC']],
      [/^this unit is \[(stand|rest)\]/, m => ['stIs', m[1][0]]],
      [/^this unit was placed this turn/, () => ['placedNow']],
      [/^it is the (first|second|third|fourth|fifth) battle (?:of )?this turn or more/, m => ['bno', '>=', ORD[m[1]]]],
      [/^it (?:is|was) the (first|second|third|fourth|fifth) battle (?:of )?this turn/, m => ['bno', '==', ORD[m[1]]]],
      [/^(?:this unit|it) attacked a vanguard/, () => ['atkVG']],
      [/^(?:the|that|this unit's) attack hit(?: a vanguard)?/, () => ['didHit']],
      [/^(?:the|that|this unit's) attack did not hit/, () => ['noHit']],
      [/^your opponent's attacking unit has attacked two or more times this turn/, () => ['atk2']],
      [/^(?:your opponent's|the) attacking unit is a (vanguard|rear-guard)/, m => ['atkIs', m[1][0]]],
      [/^(?:your opponent's|the) attacking unit is (not )?boosted/, m => (m[1] ? ['not', ['atkBoosted']] : ['atkBoosted'])],
      [/^(?:your opponent's|the) attacking unit is grade (\d+) or (greater|less)/, m => ['atkGrade', opOf(m[2]), +m[1]]],
      [/^the attacking unit's \[power\] is (\d+) or (more|greater|less)/, m => ['atkPow', opOf(m[2]), +m[1]]],
      [/^no cards were put on \(gc\) this battle/, () => ['noGuard']],
      [/^your opponent's rear-guard was retired this turn/, () => ['oretT']],
      [/^your opponent's rear-guard was retired by (?:your card's ability|the ability of your card) this turn/, () => ['tl', 'ret', 'o', 'a']],
      [/^your opponent's rear-guard was retired by (?:your vanguard's ability|the ability of your vanguard) this turn/, () => ['tl', 'ret', 'o', 'v']],
      [/^your (?:unit|rear-guard) was placed on \(rc\) from (soul|drop|deck|hand) this turn/, m => ['tl', 'place', 'm', '', ZWORD[m[1]]]],
      [/^your (?:unit|rear-guard) was placed(?: on \(rc\))? by (?:your card's ability|a card's ability) this turn/, () => ['tl', 'place', 'm', 'a']],
      [/^your rear-guard was retired this turn/, () => ['tl', 'ret', 'm', '']],
      [/^your rear-guard was retired by (?:your card's ability|a card's ability) this turn/, () => ['tl', 'ret', 'm', 'a']],
      [/^your rear-guard was retired by your vanguard's ability this turn/, () => ['tl', 'ret', 'm', 'v']],
      [/^this unit was placed on \(rc\) by (?:your card's ability|a card's ability) this turn/, () => ['and', ['placedNow'], ['placedBy', 'a']]],
      [/^this unit was placed on \(rc\) by your vanguard's ability this turn/, () => ['and', ['placedNow'], ['placedBy', 'v']]],
      [/^this unit was placed from (deck|soul|drop|hand)/, m => ['placedFrom', ZWORD[m[1]]]],
      [/^your opponent's drive check or damage check revealed a trigger unit this turn/, () => ['otrigT']],
      [/^it is your (main|battle|ride) phase/, m => ['phase', m[1][0]]],
      [/^it is your turn/, () => ['my']],
      [/^it is your opponent's turn/, () => ['opp']],
    ];
    for (const [re, f] of T) if ((m = re.exec(s))) { const n = f(m); if (n) return [n, m[0].length]; }
    // "your vanguard is a <race> / a unit with «N» in its card name (or a <race>)"
    if ((m = /^your (?:grade (\d+) or greater )?vanguard is (?:an? )?/.exec(s))) {
      let r = s.slice(m[0].length); const f = {}; if (m[1]) f.g = [+m[1], 99]; let i = 0, k; let pre = 0;
      if ((k = /^grade (\d+)( or greater| or less)? /.exec(r))) { f.g = gspec(+k[1], k[2]); pre = k[0].length; r = r.slice(pre); }
      else if ((k = /^grade (\d+)( or greater| or less)?(?= with)/.exec(r))) { f.g = gspec(+k[1], k[2]); pre = k[0].length - 4; r = 'unit' + r.slice(k[0].length); }
      const ra = this.raceAt(r);
      if (ra) { Object.assign(f, ra[0]); i = ra[1]; }
      else if ((k = /^\[glitter\]/.exec(r))) { f.gl = 1; i = k[0].length; const j = this.nameMods(r, i, f); if (j >= 0) i = j; }
      else if ((k = /^(?:unit|card)/.exec(r))) { const j = this.nameMods(r, k[0].length, f); if (j < 0) return null; i = j; }
      else return null;
      if ((k = /^ or (?:an? )?/.exec(r.slice(i)))) { const rb = this.raceAt(r.slice(i + k[0].length)); if (rb) { const g = Object.assign({}, m[1] ? { g: [+m[1], 99] } : {}, rb[0]); return [['uq', 'm', 'v', '>=', 1, { or: [f, g] }], m[0].length + pre + i + k[0].length + rb[1]]; } }
      return [['uq', 'm', 'v', '>=', 1, f], m[0].length + pre + i];
    }
    // "you have (no | a | another | N or more | N or less) <units>" and the same for the opponent / a row
    if ((m = new RegExp("^(you have|you do not have|your opponent has|they have|your (front|back) row has|your opponent's (front|back) row has) (no |an? |another |any |" + N + ' or (more|less|fewer) |' + N + ' )').exec(s))) {
      const d = this.ud(s.slice(m[0].length));
      if (d) {
        const neg = m[1] === 'you do not have'; const who = /opponent|they/.test(m[1]) ? 'o' : 'm'; const f = Object.assign({}, d[0].f); if (m[2] || m[3]) f.row = (m[2] || m[3])[0];
        const q = m[4].trim(); let op, n;
        if (q === 'no') { op = '<='; n = 0; } else if (q === 'a' || q === 'an' || q === 'any') { op = '>='; n = 1; } else if (q === 'another') { op = '>='; n = 1; f.ot = 1; } else if (m[6]) { op = opOf(m[6]); n = num(m[5]); } else { op = '=='; n = num(m[7]); }
        if (neg) { if (op !== '>=' || n !== 1) return null; op = '<='; n = 0; }
        return [['uq', who, d[0].k, op, n, f], m[0].length + d[1]];
      }
    }
    if ((m = /^all of your /.exec(s))) { const d = this.ud(s.slice(m[0].length)); const k = d && /^ are \[(rest|stand)\]/.exec(s.slice(m[0].length + d[1])); if (k) return [['allSt', d[0].k, d[0].f, k[1][0]], m[0].length + d[1] + k[0].length]; }
    if ((m = /^(?:it|that card|the revealed card|the chosen card|that unit) is (not\b ?)?(?:an? )?/.exec(s))) { const np = this.np(s.slice(m[0].length)); if (np) return [m[1] ? ['not', ['itIs', np[0]]] : ['itIs', np[0]], m[0].length + np[1]]; if (m[1] && /^(?:,|$)/.test(s.slice(m[0].length)) && this.lastCond) return [['not', this.lastCond], m[0].length]; }
    if ((m = new RegExp('^(order zone|drop|soul|hand|bind zone|damage zone) has (?:(an?|another)|' + N + ' or more) ').exec(s))) {
      const np = this.npLoose(s.slice(m[0].length)); if (np) return [['has', ZWORD[m[1]], m[2] ? 1 : num(m[3]), np[0]], m[0].length + np[1]];
    }
    if ((m = new RegExp('^you have (?:(an?|another)|' + N + ' or more) ').exec(s))) {
      const np = this.npLoose(s.slice(m[0].length)); const z = np && /^ in (order zone|drop|soul|hand|bind zone|damage zone)/.exec(s.slice(m[0].length + np[1]));
      if (z) return [['has', ZWORD[z[1]], m[1] ? 1 : num(m[2]), np[0]], m[0].length + np[1] + z[0].length];
    }
    if ((m = /^(order zone|drop|soul|hand|bind zone) does not have an? /.exec(s))) { const np = this.npLoose(s.slice(m[0].length)); if (np) return [['not', ['has', ZWORD[m[1]], 1, np[0]]], m[0].length + np[1]]; }
    return null;
  }
  cond(s) {
    const a = this.cond1(s); if (!a) return null;
    let node = a[0], i = a[1];
    for (;;) {
      const r = s.slice(i); const m = /^,? (and|or) (?:if )?/.exec(r); if (!m) break;
      const b = this.cond1(r.slice(m[0].length)); if (!b) break;
      node = [m[1], node, b[0]]; i += m[0].length + b[1];
    }
    return [node, i];
  }
  /* "if COND, " at the start of s → [cond, rest] */
  ifc(s) {
    if (!s.startsWith('if ')) return null;
    const c = this.cond(s.slice(3)); if (!c) return null;
    const r = s.slice(3 + c[1]); if (!/^, /.test(r)) return null;
    this.lastCond = c[0];
    return [c[0], r.slice(2)];
  }

  /* ---------- costs ---------- */
  costItem(t) {
    let m;
    if (/^\[.*\]$/.test(t) && bracketEnd(t, 0) === t.length - 1 && !/^\[(rest|stand)\]/.test(t)) t = t.slice(1, -1).trim();
    if ((m = /^counter-blast (\d+)$/.exec(t))) return ['cb', +m[1]];
    if (t === 'counter-blast') return ['cb', 1];
    if ((m = /^soul-blast (\d+)$/.exec(t))) return ['sb', +m[1]];
    if (t === 'soul-blast') return ['sb', 1];
    if ((m = /^energy-blast (\d+)$/.exec(t))) return ['eb', +m[1]];
    if ((m = /^(counter-blast|soul-blast) (\d+) or energy-blast (\d+)$/.exec(t))) return ['alt', [[m[1][0] === 'c' ? 'cb' : 'sb', +m[2]]], [['eb', +m[3]]]];
    if (/^put this (unit|card) into soul$/.test(t)) return ['self', 'soul'];
    if (/^retire this unit$/.test(t)) return ['self', 'retire'];
    if (/^bind this (card|unit)$/.test(t)) return ['self', 'bind'];
    if (/^(\[rest\] this (unit|card)|rest this unit)$/.test(t)) return ['self', 'rest'];
    if (/^(put this (?:card|unit) into drop|discard this card)$/.test(t)) return ['self', 'drop'];
    if (/^put this (unit|card) on bottom of deck$/.test(t)) return ['self', 'bottom'];
    if (/^remove this card$/.test(t)) return ['self', 'removed'];
    if (/^return this unit to hand$/.test(t)) return ['self', 'hand'];
    if ((m = new RegExp('^discard ' + N + ' ').exec(t))) { const np = this.np(t.slice(m[0].length)); if (np && /^ from hand$/.test(t.slice(m[0].length + np[1]))) return ['disc', num(m[1]), np[0]]; }
    if ((m = new RegExp('^soul-blast ' + N + ' ').exec(t))) { const np = this.np(t.slice(m[0].length)); if (np && Object.keys(np[0]).length && m[0].length + np[1] === t.length) return ['zc', num(m[1]), np[0], 'soul', 'drop']; }
    if ((m = new RegExp('^(put|bind|remove|discard) ' + N + ' ').exec(t))) {
      const np = this.np(t.slice(m[0].length)); const r = np ? t.slice(m[0].length + np[1]) : ''; const n = num(m[2]); let k;
      if (np && m[1] === 'put' && /^ from hand into soul$/.test(r)) return ['h2s', n, np[0]];
      if (np && m[1] === 'put' && /^ from drop on bottom of deck$/.test(r)) return ['d2b', n, np[0]];
      if (np && m[1] === 'put' && (k = /^ from (hand|drop|soul) (?:on (top|bottom) of deck|into (soul|drop|hand))$/.exec(r))) return ['zc', n, np[0], k[1], k[2] || k[3]];
      if (np && m[1] === 'bind' && (k = /^ from (hand|drop|soul)$/.exec(r))) return ['zc', n, np[0], k[1], 'bind'];
      if (np && m[1] === 'remove' && (k = /^ from (hand|drop|soul)$/.exec(r))) return ['zc', n, np[0], k[1], 'removed'];
      if (np && (m[1] === 'remove' || m[1] === 'bind') && (k = /^ from (hand|drop|soul)(?:, (hand|drop|soul))?,? or (hand|drop|soul)$/.exec(r))) return ['zc', n, np[0], [k[1], k[2], k[3]].filter(Boolean), m[1] === 'bind' ? 'bind' : 'removed'];
      if (np && m[1] === 'put' && (k = /^ from (hand|drop|soul) or (hand|drop|soul) (?:on (top|bottom) of deck|into (soul|drop|hand))$/.exec(r)) && k[1] !== k[4] && k[2] !== k[4]) return ['zc', n, np[0], [k[1], k[2]], k[3] || k[4]];
    }
    if ((m = new RegExp('^discard (?:the )?top ' + N + ' cards? of deck$').exec(t))) return ['mill', num(m[1])];
    if (/^discard (?:the )?top card of deck$/.test(t)) return ['mill', 1];
    // rear-guards as a cost: retire / put into soul / rest / return to hand / put on bottom of deck
    if ((m = new RegExp('^(retire|put|\\[rest\\]|return|bind) (another |any number of |' + N + ' )(?:of your )?').exec(t))) {
      const r0 = t.slice(m[0].length); const d = this.ud(m[2] === 'another ' ? 'other ' + r0 : r0);
      if (d && d[0].k !== 'v') {
        const used = m[2] === 'another ' ? d[1] - 6 : d[1]; const tail = r0.slice(used); const n = m[2] === 'another ' ? 1 : m[2].startsWith('any') ? 99 : num(m[3]); const f = d[0].f;
        if (m[1] === 'retire' && tail === '') return ['rrg', n, f];
        if (m[1] === 'put' && tail === ' into soul') return ['rg2s', n, f];
        if (m[1] === '[rest]' && tail === '') return ['rgc', n, f, 'rest'];
        if (m[1] === 'return' && tail === ' to hand') return ['rgc', n, f, 'hand'];
        if (m[1] === 'put' && tail === ' on bottom of deck') return ['rgc', n, f, 'bottom'];
        if (m[1] === 'bind' && tail === '') return ['rgc', n, f, 'bind'];
      }
    }
    if ((m = new RegExp('^retire ' + N + ' (shadow army|plant) tokens?$').exec(t))) return ['rrg', num(m[1]), { tk: m[2] }];
    if ((m = /^reveal an? /.exec(t))) { const np = this.np(t.slice(m[0].length)); if (np && /^ from ride deck$/.test(t.slice(m[0].length + np[1]))) return ['rride', np[0]]; if (np && /^ from hand$/.test(t.slice(m[0].length + np[1]))) return ['rhand', np[0]]; }
    throw new Fail(t, 'cost');
  }
  costs(inner) { return inner.split(/\s*&\s*/).map(t => this.costItem(t.trim().replace(/^\[cost\]\[/, ''))); }
  /* "[cost][...]" (optionally " or [...]") at the start of s → [costs, rest] */
  eatCost(s) {
    const e = bracketEnd(s, 6); if (e < 0) throw new Fail(s, 'cost bracket');
    let k = this.costs(s.slice(7, e)); let rest = s.slice(e + 1);
    const m = /^ or \[/.exec(rest);
    if (m) { const e2 = bracketEnd(rest, 4); if (e2 < 0) throw new Fail(rest, 'cost bracket'); const k2 = this.costs(rest.slice(5, e2)); k = [['alt', k, k2]]; rest = rest.slice(e2 + 1); }
    return [k, rest];
  }

  /* ---------- effect steps ---------- */
  stats(str) {
    const mod = {};
    for (const part of str.split('/')) {
      let m;
      if ((m = /^\[(power|shield|critical)\]\+(\d+)$/.exec(part))) mod[m[1] === 'critical' ? 'crit' : m[1]] = +m[2];
      else if ((m = /^\[(power|shield|critical)\] ?-(\d+)$/.exec(part))) mod[m[1] === 'critical' ? 'crit' : m[1]] = -m[2];
      else if ((m = /^drive ?([+-])(\d+)$/.exec(part))) mod.drive = (m[1] === '-' ? -1 : 1) * +m[2];
      else return null;
    }
    return mod;
  }
  /* "<subject> gets A, and B until end of turn for each ..." */
  buff(s) {
    let m, k;
    // "… +10000 instead of +5000": tops up the buff given just before
    if (this.last && (m = /^(?:(?:it|this unit|that unit|they|those units) gets? )?\[(power|shield)\]\+(\d+) instead of ?\+(\d+)/.exec(s))) {
      const node = ['bf', this.last.tg, { [m[1]]: +m[2] - +m[3] }, this.last.d]; if (this.last.per) node.push(this.last.per);
      return [[node], m[0].length];
    }
    const sub = this.subject(s); if (!sub) return null;
    m = new RegExp('^ (?:also )?gets? (' + ITEM + '(?:,? and ' + ITEM + ')*)').exec(s.slice(sub[1]));
    if (!m) return null;
    // "[stand] this unit, and it gets …": the pronoun points back at this unit unless something was chosen since
    const tg = sub[0] === 'it' && /^(?:it|they) /.test(s) && this.ante === 'me' ? 'me' : sub[0]; const mod = {}; const grants = [];
    for (const it of m[1].split(/,? and /)) {
      if (it.startsWith('«')) {
        const txt = this.name(it); const kw = KW[txt.toLowerCase().replace(/[^a-z ]/g, '').trim()];
        if (kw) Object.assign(mod, kw);
        else { const g = this.nested(txt); if (!g) return null; grants.push(g); }
      } else { const st = this.stats(it.replace(/ /g, '')); if (!st) return null; for (const key in st) mod[key] = (mod[key] || 0) + st[key]; }
    }
    let i = sub[1] + m[0].length; let d = this.dur; let per = null;
    for (let pass = 0; pass < 3; pass++) {
      const r = s.slice(i);
      if ((k = new RegExp('^ until end of ' + DURRE).exec(r))) { d = DUR[k[1]]; i += k[0].length; continue; }
      if (!per && /^ for (?:each|every) /.test(r)) { const c = this.count(r.slice(1)); if (c) { per = c[0]; i += 1 + c[1]; continue; } }
      break;
    }
    if (!d) { if (this.kind === 'cont') d = 'c'; else return null; }
    const out = [];
    if (Object.keys(mod).length) { const node = ['bf', tg, mod, d]; if (per) node.push(per); out.push(node); }
    for (const g of grants) out.push(['grant', tg, g, d]);
    if (mod.power || mod.shield) this.last = { tg, d, per };
    return [out, i];
  }
  /* an ability granted in quotes */
  nested(txt) {
    if (this.depth > 0) return null;
    const { lines, names } = canonLines(txt); if (lines.length !== 1) return null;
    const p = new P(names, this.races, this.self); p.depth = this.depth + 1;
    const m = HDR.exec(lines[0]); if (!m) return null;
    try { return p.ability(m[1], m[2], m[3], !!m[4], m[5], []); } catch (e) { if (e instanceof Fail) return null; throw e; }
  }
  /* a quoted continuous effect given to the player: "you get "All of your front row units get [Power]+5000" until end of turn" */
  nestedCont(txt) {
    if (this.depth > 0) return null;
    const { lines, names } = canonLines(txt); if (lines.length !== 1 || /^\[|^when |^at /.test(lines[0])) return null;
    const p = new P(names, this.races, this.self); p.depth = this.depth + 1; p.kind = 'cont';
    try { const r = p.cont({ t: 'c' }, lines[0]); return r.length && r.every(a => a.s && a.s !== 'me' && a.m) ? r : null; } catch (e) { if (e instanceof Fail) return null; throw e; }
  }
  step(s) {
    let m;
    if ((m = /^you get («\d+»)(?: until end of (turn|that turn|this turn|this fight))?(?=,|$| and )/.exec(s))) { const g = this.nestedCont(this.name(m[1])); const d = m[2] ? (m[2] === 'this fight' ? 'f' : 't') : this.dur; if (g && (d === 't' || d === 'f')) return [['pget', g, d], m[0].length]; }
    if ((m = new RegExp('^draw ' + N + ' cards?').exec(s))) return [['draw', num(m[1])], m[0].length];
    if ((m = /^\[soul-charge (\d+)\]/.exec(s))) return [['sc', +m[1]], m[0].length];
    if ((m = /^\[counter-charge (\d+)\]/.exec(s))) return [['cc', +m[1]], m[0].length];
    if ((m = /^\[energy-charge (\d+)\]/.exec(s))) return [['ec', +m[1]], m[0].length];
    if ((m = /^shuffle (?:deck|it)/.exec(s))) return [['shuf'], m[0].length];
    if ((m = /^\[cost\]\[/.exec(s))) { const [k, rest] = this.eatCost(s); return [['pay', k], s.length - rest.length]; }
    const us = this.unitSel(s); if (us) return [['ch', us[0]], us[1]];
    if ((m = new RegExp('^choose (up to |any number of )?(?:' + N + ' )?').exec(s)) && (m[1] || m[2])) {
      const np = this.np(s.slice(m[0].length));
      if (np) { const r = s.slice(m[0].length + np[1]); const f = /^ from /.exec(r); if (f) { const z = this.zones(r.slice(f[0].length)); if (z) { const any = (m[1] || '').startsWith('any'); let end = m[0].length + np[1] + f[0].length + z[1]; const F = np[0].or ? np[0] : Object.assign({}, np[0]); if (!F.or) { const j = this.nameMods(s, end, F); if (j >= 0) end = j; } return [['pk', z[0], any ? 99 : num(m[2] || 'a'), m[1] ? 1 : 0, F], end]; } } }
    }
    if ((m = /^search (deck or drop|drop or deck|deck or hand|hand or deck|deck) for (up to )?/.exec(s))) {
      const r0 = s.slice(m[0].length); const n = new RegExp('^' + N + ' ').exec(r0);
      if (n) { const np = this.np(r0.slice(n[0].length)); if (np) return [['sr', m[1].split(' or ').map(z => ZWORD[z]), num(n[1]), m[2] ? 1 : 0, np[0]], m[0].length + n[0].length + np[1]]; }
    }
    if ((m = new RegExp('^look at (?:the )?top ' + N + ' cards? of deck').exec(s))) return [['lk', num(m[1])], m[0].length];
    if ((m = new RegExp('^look at ' + N + ' cards? from top of deck').exec(s))) return [['lk', num(m[1])], m[0].length];
    if ((m = /^look at (?:the )?top card of deck/.exec(s))) return [['lk', 1], m[0].length];
    if ((m = new RegExp('^reveal (?:the )?top ' + N + ' cards? of deck').exec(s))) return [['rvt', num(m[1])], m[0].length];
    if ((m = /^reveal (?:the )?top card of deck/.exec(s))) return [['rvt', 1], m[0].length];
    if ((m = new RegExp('^(discard|bind) (?:the )?top (?:' + N + ' cards?|card) of deck').exec(s))) return [['topTo', m[2] ? num(m[2]) : 1, m[1] === 'bind' ? 'bind' : 'drop'], m[0].length];
    if ((m = new RegExp('^put (?:the )?top (?:' + N + ' cards?|card) of deck into (soul|drop|bind zone)').exec(s))) return [['topTo', m[1] ? num(m[1]) : 1, ZWORD[m[2]]], m[0].length];
    if ((m = /^reveal (?:it|them) and put (?:it|them) into hand/.exec(s))) return [['to', 'it', 'hand', 1], m[0].length];
    if ((m = /^reveal (?:it|them)/.exec(s))) return [['reveal'], m[0].length];
    if ((m = /^(?:put|add) (?:it|them|that card|those cards) (?:into|to) hand/.exec(s))) return [['to', 'it', 'hand'], m[0].length];
    if ((m = /^return (?:it|them|that unit|those units) to (?:hand|its hand|their hand)/.exec(s))) return [['to', 'it', 'hand'], m[0].length];
    if ((m = /^put (?:it|them|that card|that unit) into soul/.exec(s))) return [['to', 'it', 'soul'], m[0].length];
    if ((m = /^put (?:it|them|that card|those cards) as this unit's originaldress/.exec(s))) return [['to', 'it', 'dress'], m[0].length];
    if ((m = /^put all of this unit's originaldress into drop/.exec(s))) return [['odrop'], m[0].length];
    if ((m = /^put a persona shield ticket into hand/.exec(s))) return [['pst'], m[0].length];
    if ((m = /^choose one of your \(rc\)( without any ([a-z][a-z' -]*?) markers?)?,? (?:and )?put an? ([a-z][a-z' -]*?) marker(?: on it)?/.exec(s))) return [['mk', m[3], m[1] ? { no: 1 } : {}], m[0].length];
    if ((m = /^choose one of this card's outerdress units/.exec(s))) return [['hostsel'], m[0].length];
    if ((m = /^(?:put (?:it|them|that card) into drop|discard (?:it|them|that card))/.exec(s))) return [['to', 'it', 'drop'], m[0].length];
    if ((m = /^put (?:it|them) on top or bottom of deck/.exec(s))) return [['to', 'it', 'tb'], m[0].length];
    if ((m = /^put (?:it|them|that card|that unit) on (top|bottom) of (?:deck|its deck|their deck)(?: in any order)?/.exec(s))) return [['to', 'it', m[1]], m[0].length];
    if ((m = /^return (?:it|them) to deck(?:,? and shuffle (?:it|deck))?/.exec(s))) return [[['to', 'it', 'top'], ['shuf']], m[0].length, true];
    if ((m = /^put (?:it|them) into (?:the )?order zone/.exec(s))) return [['to', 'it', 'order'], m[0].length];
    if ((m = /^bind (?:it|them|that card)/.exec(s))) return [['to', 'it', 'bind'], m[0].length];
    if ((m = /^remove (?:it|them)/.exec(s))) return [['to', 'it', 'removed'], m[0].length];
    if ((m = /^put the rest on bottom of deck(?: in any order)?/.exec(s))) return [['rs', 'bottom'], m[0].length];
    if ((m = /^put the rest on top of deck(?: in any order)?/.exec(s))) return [['rs', 'top'], m[0].length];
    if ((m = /^(?:discard the rest|put the rest into drop)/.exec(s))) return [['rs', 'drop'], m[0].length];
    if ((m = /^put the rest into soul/.exec(s))) return [['rs', 'soul'], m[0].length];
    if ((m = /^shuffle the rest and put them on bottom of deck/.exec(s))) return [['rs', 'bottom'], m[0].length];
    if ((m = /^call (?:it|them|that card|those cards) to (?:an open \(rc\)|(a (?:front|back) row \(rc\))|(your back row center \(rc\))|a \(rc\) in the same column as this unit|(?:open )?\(rc\)(?! or \())( in the same column as this unit)?( as \[rest\])?/.exec(s))) {
      const o = {}; if (/open/.test(m[0])) o.open = 1; if (/same column/.test(m[0])) o.col = 1; if (m[1]) o.row = /front/.test(m[1]) ? 'f' : 'b'; if (m[2]) o.pos = 'BC'; if (m[4]) o.rest = 1; return [['cl', 'it', o], m[0].length];
    }
    if ((m = /^call (?:it|them) to \(gc\)/.exec(s))) return [['cl', 'it', { gc: 1 }], m[0].length];
    if ((m = /^call this card to (?:an open \(rc\)|(a (?:front|back) row \(rc\)|your (?:front|back) row \(rc\))|\(rc\)(?! or \())( as \[rest\])?/.exec(s))) { const o = {}; if (/an open/.test(m[0])) o.open = 1; if (m[1]) o.row = /front/.test(m[1]) ? 'f' : 'b'; if (m[2]) o.rest = 1; return [['cl', 'me', o], m[0].length]; }
    if ((m = /^move this unit to \(gc\)/.exec(s))) return [['cl', 'me', { gc: 1 }], m[0].length];
    if ((m = /^retire (?:it|them|that unit|those units|that called unit|those called units)/.exec(s))) return [['rt', 'it'], m[0].length];
    if ((m = /^ride (?:it|that card) as \[stand\]/.exec(s))) return [['ride', 'it'], m[0].length];
    if ((m = /^ride this card as \[stand\]/.exec(s))) return [['ride', 'me'], m[0].length];
    if ((m = /^retire this unit/.exec(s))) return [['rt', 'me'], m[0].length];
    if ((m = /^retire all of (your opponent's|your) /.exec(s))) { const d = this.ud(s.slice(m[0].length)); if (d && d[0].k !== 'v') { const t = { s: m[1].includes('opponent') ? 'o' : 'm', k: 'r' }; if (Object.keys(d[0].f).length) t.f = d[0].f; return [['rt', t], m[0].length + d[1]]; } }
    if ((m = /^\[(stand|rest)\] (this unit|it|them|that unit|those units)/.exec(s))) return [[m[1] === 'stand' ? 'st' : 're', m[2] === 'this unit' ? 'me' : 'it'], m[0].length];
    if ((m = /^\[(stand|rest)\] /.exec(s))) { const sub = this.subject(s.slice(m[0].length)); if (sub && sub[0] !== 'it' && sub[0] !== 'me') return [[m[1] === 'stand' ? 'st' : 're', sub[0]], m[0].length + sub[1]]; }
    if ((m = /^put this (?:unit|card) into soul/.exec(s))) return [['to', 'me', 'soul'], m[0].length];
    if ((m = /^(?:return this (?:unit|card) to hand|put this card into hand)/.exec(s))) return [['to', 'me', 'hand'], m[0].length];
    if ((m = /^put this (?:unit|card) on (top|bottom) of deck/.exec(s))) return [['to', 'me', m[1]], m[0].length];
    if ((m = /^bind this (?:unit|card)/.exec(s))) return [['to', 'me', 'bind'], m[0].length];
    if ((m = /^put this card into (?:the )?order zone/.exec(s))) return [['to', 'me', 'order'], m[0].length];
    if ((m = /^(?:put this (?:unit|card) into drop|discard this card)/.exec(s))) return [['to', 'me', 'drop'], m[0].length];
    if ((m = /^remove this card/.exec(s))) return [['to', 'me', 'removed'], m[0].length];
    if ((m = new RegExp('^call (up to )?' + N + ' (shadow army|plant) tokens? to (an open )?(?:\\(rc\\)|(your back row center \\(rc\\)))').exec(s))) return [['tk', m[3], num(m[2]), m[1] ? 1 : 0, m[4] ? 1 : 0].concat(m[5] ? ['BC'] : []), m[0].length];
    { const sub = this.subject(s); const k = sub && /^ can (attack|intercept) from the back row(?:,? and gets? )?/.exec(s.slice(sub[1]));
      if (k) {
        const flag = k[1] === 'attack' ? { backAtk: 1 } : { backInt: 1, intercept: 1 }; const pre = sub[1] + k[0].length;
        if (/gets? $/.test(k[0])) { const b2 = this.buff(s.slice(0, sub[1]) + ' gets ' + s.slice(pre)); if (b2 && b2[0][0][0] === 'bf') { Object.assign(b2[0][0][2], flag); return [b2[0], pre + b2[1] - sub[1] - 6, true]; } }
        else { const k2 = new RegExp('^ until end of ' + DURRE).exec(s.slice(pre)); const d = k2 ? DUR[k2[1]] : this.dur; if (d) return [['bf', sub[0], flag, d], pre + (k2 ? k2[0].length : 0)]; }
      } }
    const bf = this.buff(s); if (bf) return [bf[0], bf[1], true];
    if ((m = /^(this unit|it|that unit|they) cannot be hit until end of that battle/.exec(s))) return [['bf', m[1] === 'this unit' || (m[1] === 'it' && this.ante === 'me') ? 'me' : 'it', { cantBeHit: 1 }, 'b'], m[0].length];
    if ((m = new RegExp('^(this unit|it|that unit|they) cannot (attack|intercept|boost)(?: until end of ' + DURRE + ')?').exec(s))) { const d = m[3] ? DUR[m[3]] : this.dur; if (d) return [['bf', m[1] === 'this unit' ? 'me' : 'it', { ['cant' + m[2][0].toUpperCase() + m[2].slice(1)]: 1 }, d], m[0].length]; }
    if ((m = new RegExp('^when your opponent would call cards (?:from (?:their )?hand )?to \\(gc\\)(?: from (?:their )?hand)?( (?:during|for) the battle (?:that )?this unit attacked)?, they must call ' + N + ' or more at the same time').exec(s))) { const d = m[1] ? 'b' : this.dur; if (d) return [['pfx', 'guardMin', d, num(m[2])], m[0].length]; }
    if ((m = new RegExp('^your opponent cannot intercept(?: until end of ' + DURRE + ')?').exec(s))) { const d = m[1] ? DUR[m[1]] : this.dur; if (d) return [['pfx', 'noInt', d], m[0].length]; }
    if ((m = new RegExp("^your opponent chooses " + N + " cards? from (?:their |opponent's )?hand,? (?:and )?discards? (?:it|them)").exec(s))) return [['odisc', num(m[1])], m[0].length];
    if ((m = new RegExp("^your opponent chooses " + N + " of their rear-guards,? (?:and )?retires? (?:it|them)").exec(s))) return [['oret', num(m[1])], m[0].length];
    if ((m = /^your opponent draws a card/.exec(s))) return [['odraw', 1], m[0].length];
    if ((m = /^lock (it|them)/.exec(s))) return [['lock', 'it'], m[0].length];
    if ((m = new RegExp('^you («\\d+»)(?: until end of ' + DURRE + ')?(?=,|$| and )').exec(s)) && !/^\[/.test(this.name(m[1])) && this.name(m[1]).length < 30) { const d = m[2] ? DUR[m[2]] : this.dur; if (d) return [['state', this.name(m[1]), d], m[0].length]; }
    return null;
  }
  /* "… or <other step>": the player picks one. The second half often drops its verb ("or into soul"). */
  orStep(first, tail) {
    const m = /^ or /.exec(tail); if (!m) return null;
    const rest = tail.slice(m[0].length);
    const fix = [[/^into (soul|hand|drop)/, 'put it into $1'], [/^on (top|bottom) of deck/, 'put it on $1 of deck'], [/^(call|discard|retire|bind) it/, '$1 it']];
    for (const [re, rep] of fix) if (re.test(rest)) { const fixed = rest.replace(re, rep); const st = this.step(fixed); if (st && !st[2]) return [['or', [first], [st[0]]], m[0].length + st[1] - (fixed.length - rest.length)]; }
    const st = /^(?:choose|search|look|reveal the|all|this unit gets|it gets)/.test(rest) ? null : this.step(rest); if (st && !st[2] && ['sc', 'cc', 'ec', 'draw', 'to', 'cl', 'rt'].includes(st[0][0])) return [['or', [first], [st[0]]], m[0].length + st[1]];
    return null;
  }
  sentence(s) {
    const out = []; let m;
    const save = this.dur;
    try {
      while (s.length) {
        s = s.replace(/^(?:,? and then |, and |, then |, |; | and |then, |then )/, '');
        if (!s.length) break;
        if ((m = new RegExp('^until end of ' + DURRE + ', ').exec(s))) { this.dur = DUR[m[1]]; s = s.slice(m[0].length); continue; }
        const ic = this.ifc(s);
        if (ic) {
          // "if A, X, and if it is not, Y": the second half is the other branch, not part of the first
          const body = this.sentence(ic[1]); const other = JSON.stringify(['not', ic[0]]); const hoist = [];
          while (body.length > 1 && body[body.length - 1][0] === 'if' && JSON.stringify(body[body.length - 1][1]) === other) hoist.unshift(body.pop());
          out.push(['if', ic[0], body], ...hoist); return out;
        }
        if (s.startsWith('if ')) throw new Fail(s, 'cond');
        if ((m = /^you may have (this unit|it) get /.exec(s))) { const st = this.step(m[1] + ' gets ' + s.slice(m[0].length)); if (!st) throw new Fail(s, 'may have'); out.push(['may', st[2] ? st[0] : [st[0]]]); s = s.slice(m[0].length + st[1] - (m[1] + ' gets ').length); continue; }
        if ((m = /^you may /.exec(s))) {
          const rest = s.slice(m[0].length);
          if (!out.length) { out.push(['may', this.sentence(rest)]); return out; }
          const st = this.step(rest); if (!st) throw new Fail(s, 'may');
          out.push(['may', st[2] ? st[0] : [st[0]]]); s = rest.slice(st[1]); continue;
        }
        if ((m = /^at the end of that (battle|turn), /.exec(s))) { out.push(['later', m[1][0], this.sentence(s.slice(m[0].length))]); return out; }
        if ((m = /^perform (one|all) of the following/.exec(s))) { out.push(m[1] === 'all' ? ['modal', null, 1] : ['modal']); s = s.slice(m[0].length); continue; }
        const st = this.step(s);
        if (!st) throw new Fail(s, 'step');
        s = s.slice(st[1]);
        let nodes = st[2] ? st[0] : [st[0]];
        if (!st[2]) { const alt = this.orStep(st[0], s); if (alt) { nodes = [alt[0]]; s = s.slice(alt[1]); } }
        // "<step> if <condition>" / "<step> if it is not"
        if ((m = /^ if /.exec(s))) { const c = this.cond(s.slice(m[0].length)); if (c && /^(?:,|$)/.test(s.slice(m[0].length + c[1]))) { if (c[0][0] !== 'not') this.lastCond = c[0]; nodes = [['if', c[0], nodes]]; s = s.slice(m[0].length + c[1]); } }
        for (const n of nodes) { if (['ch', 'pk', 'sr', 'lk', 'rvt', 'topTo'].includes(n[0])) this.ante = 'it'; else if (['st', 're', 'cl', 'to', 'rt', 'ride'].includes(n[0]) && n[1] === 'me') this.ante = 'me'; else if (n[0] === 'bf' && n[1] === 'me' && !this.ante) this.ante = 'me'; }
        out.push(...nodes);
        if (s.length && !/^(?:,|;| and | then )/.test(s)) throw new Fail(s, 'step tail');
      }
    } finally { this.dur = save; }
    return out;
  }
  text(body) {
    const steps = [];
    for (const sent of body.split(/(?<=[.!])\s+/)) { const t = sent.replace(/[.!]+$/, '').trim(); if (t) steps.push(...this.sentence(t)); }
    return steps;
  }

  /* ---------- triggers ---------- */
  trigger(s) {
    let m; const T = re => (m = re.exec(s));
    const who = k => { const f = {}; if (k[1]) f.gmin = +k[1]; if (k[2]) f.nh = this.name(k[2]); if (k[3]) f.nh2 = this.name(k[3]); return f; };
    const WHO = "(?:grade (\\d+) or greater )?(?:vanguard|card|unit)(?: with («\\d+»)(?: or («\\d+»))? in its card name)?";
    const tail = (t, i, mods) => {
      for (;;) {
        const r = s.slice(i); let k;
        if (mods.includes('from') && (k = /^ from (hand|deck|drop|soul|bind zone|order zone)(?: or (hand|deck|drop|soul|\(rc\)))?/.exec(r))) { t.from = [ZWORD[k[1]]]; if (k[2]) t.from.push(k[2] === '(rc)' ? 'RC' : ZWORD[k[2]]); i += k[0].length; continue; }
        if (mods.includes('from') && (k = /^ other than from (hand|deck|drop|soul)/.exec(r))) { t.nfrom = [ZWORD[k[1]]]; i += k[0].length; continue; }
        if ((k = /^ during (?:your|the) (main|battle|ride) phase/.exec(r))) { t.ph = k[1][0]; i += k[0].length; continue; }
        if ((k = /^ during your opponent's turn/.exec(r))) { t.ph = 'o'; i += k[0].length; continue; }
        if ((k = /^ during your turn/.exec(r))) { t.ph = 't'; i += k[0].length; continue; }
        if ((k = /^ other than during (?:the|your) battle phase/.exec(r))) { t.ph = 'nb'; i += k[0].length; continue; }
        if (mods.includes('by') && (k = /^ by (?:the )?\[(x?)overdress\](?: ability)?/.exec(r))) { t.od = k[1] ? 'x' : 'o'; i += k[0].length; continue; }
        if (mods.includes('by')) {
          if ((k = /^ by (?:a|your|any) card's ability/.exec(r))) { t.by = 'a'; i += k[0].length; continue; }
          if ((k = /^ by any player's card(?:'s)? ability/.exec(r))) { t.by = 'x'; i += k[0].length; continue; }
          if ((k = /^ other than by a unit card's ability/.exec(r))) { t.by = 'nu'; i += k[0].length; continue; }
          if ((k = /^ by your opponent's card's ability/.exec(r))) { t.by = 'o'; i += k[0].length; continue; }
          if ((k = /^ by your vanguard's ability/.exec(r))) { t.by = 'v'; i += k[0].length; continue; }
          if ((k = /^ (?:by|for the cost of) the ability of your /.exec(r)) || (k = /^ (?:by|for the cost of) your (?=.*?'s ability)/.exec(r))) {
            const cost = /cost/.test(k[0]); const d = this.ud(r.slice(k[0].length)); const post = d && (/the ability of/.test(k[0]) ? /^/ : /^'s ability/).exec(r.slice(k[0].length + d[1]));
            if (d && post) { t.by = cost ? 'c' : d[0].k === 'v' ? 'v' : 'a'; if (cost && d[0].k === 'v') t.byv = 1; if (Object.keys(d[0].f).length) t.byf = d[0].f; i += k[0].length + d[1] + post[0].length; continue; }
          }
          if ((k = new RegExp('^ by the ability of your ' + WHO).exec(r))) { t.by = /vanguard/.test(k[0]) ? 'v' : 'a'; const f = who(k); if (Object.keys(f).length) t.byf = f; i += k[0].length; continue; }
          if ((k = /^ (?:for|by) (?:the cost of )?your (?:card|vanguard)(?:'s cost| 's cost|'s ability)?/.exec(r))) { t.by = 'c'; i += k[0].length; continue; }
        }
        if (mods.includes('boosted') && (k = /^ while (not )?boosted/.exec(r))) { t.bo = k[1] ? 0 : 1; i += k[0].length; continue; }
        break;
      }
      const r = s.slice(i);
      // "A or B": a second trigger sharing the same subject
      const alt = /^ or (?:is )?/.exec(r);
      if (alt && !t.alt) { const t2 = this.trigger('when this unit is ' + r.slice(alt[0].length)) || this.trigger('when this card is ' + r.slice(alt[0].length)) || this.trigger('when this unit ' + r.slice(alt[0].length)); if (t2) { t.alt = t2[0]; return [t, t2[1]]; } }
      if (!/^, ?/.test(r)) return null;
      return [t, r.replace(/^, ?/, '')];
    };
    /* what was attacked / boosted / hit: " a grade 3 or greater unit", " «N»", " a <race>" → [filter, length] */
    const tgt = r => {
      let k;
      if ((k = /^ a (shadow army|plant) token/.exec(r))) return [{ tk: k[1] }, k[0].length];
      if ((k = /^ a token unit/.exec(r))) return [{ tk: 1 }, k[0].length];
      if ((k = /^ a grade (\d+)( or greater| or less)?(?: card)?(?=,| during| while|$)/.exec(r))) return [{ g: gspec(+k[1], k[2]) }, k[0].length];
      if ((k = /^ (?:an? |your |your opponent's )/.exec(r)) || (k = /^ (?=«)/.exec(r))) { const d = this.ud(r.slice(k[0].length)); if (d) { const f = Object.assign({}, d[0].f); if (d[0].k !== 'u') f.k = d[0].k; return [f, k[0].length + d[1]]; } }
      return [null, 0];
    };
    let r;
    if (T(/^when this card becomes an originaldress/)) return [{ e: 'dress' }, s.slice(m[0].length).replace(/^, /, '')];
    if (T(/^when you play a persona shield ticket/)) return tail({ e: 'pst' }, m[0].length, []);
    if (T(/^when any player(?:s'|'s|s)? units? is retired from a (front|back) row \(rc\) in the same column as this unit/)) return tail({ e: 'retCol', row: m[1][0] }, m[0].length, []);
    if (T(/^when this unit is chosen by the ability of (?:your (?:grade (\d+) or greater )?(vanguard|unit)(?: with («\d+»)(?: or («\d+»))? in its card name)?|(«\d+») in order zone)/)) return tail({ e: 'chosen', by: this.byWho(m) }, m[0].length, []);
    if (T(/^when this (?:unit|card) is placed on \(vc\) or \(rc\)/)) return tail({ e: 'placeRC', vc: 1 }, m[0].length, ['from']);
    if (T(/^when this (?:unit|card) is (?:placed|put) on (?:(?:a|your) (front|back) row |your (back row center) )?\(rc\)/)) { const t = { e: 'placeRC' }; if (m[1]) t.row = m[1][0]; if (m[2]) t.pos = 'BC'; return tail(t, m[0].length, ['from', 'by']); }
    if (T(/^when this unit is placed on \(vc\) by riding (?:from|on) («\d+»)/) || T(/^when this unit is placed by riding (?:from|on) («\d+»)/)) return tail({ e: 'rideFrom', f: { nm: this.name(m[1]) } }, m[0].length, []);
    if (T(/^when this unit is placed (?:on \(vc\) )?by riding (?:from|on) a (?:grade (\d+) )?(?:card |unit )?with («\d+») in its card name/)) return tail({ e: 'rideFrom', f: Object.assign({ nh: this.name(m[2]) }, m[1] ? { g: [+m[1], +m[1]] } : {}) }, m[0].length, []);
    if (T(/^when this unit is placed (?:on \(vc\) )?by riding (?:from|on) a grade (\d+)( or greater| or less)?(?: card| unit)?/)) return tail({ e: 'rideFrom', f: { g: gspec(+m[1], m[2]) } }, m[0].length, []);
    if (T(/^when this unit is placed by riding/)) return tail({ e: 'placeVC', ride: 1 }, m[0].length, []);
    if (T(/^when this unit is placed on \(vc\)/)) return tail({ e: 'placeVC' }, m[0].length, []);
    if (T(/^when this (?:unit|card) is put on \(gc\)/)) return tail({ e: 'placeGC' }, m[0].length, ['from']);
    if (T(/^when this unit intercepts/)) return tail({ e: 'placeGC', ic: 1 }, m[0].length, []);
    if (T(/^when this unit attacks or boosts/)) return tail({ e: 'atk', ob: 1 }, m[0].length, []);
    if (T(/^when this unit attacks while boosted by/)) { const [f, l] = tgt(s.slice(m[0].length)); if (!f) return null; return tail({ e: 'atk', bo: 1, bof: f }, m[0].length + l, []); }
    if (T(/^when this unit attacks/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'atk' }; if (f) t.tg = f; let i = m[0].length + l; const b = /^ while boosted by/.exec(s.slice(i)); if (b) { const [f2, l2] = tgt(s.slice(i + b[0].length)); if (!f2) return null; t.bo = 1; t.bof = f2; i += b[0].length + l2; } return tail(t, i, ['boosted']); }
    if (T(/^when this unit boosts/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'boost' }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^when this unit is boosted(?: by)?/)) { const [f, l] = / by$/.test(m[0]) ? tgt(s.slice(m[0].length)) : [null, 0]; if (/ by$/.test(m[0]) && !f) return null; const t = { e: 'boosted' }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^when this unit's attack hits/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'hit' }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^when the attack (?:that )?this unit boosted hits/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'bhit' }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^at the end of the battle (?:that )?this unit attacked or boosted/)) return tail({ e: 'end', a: 1, b: 1 }, m[0].length, []);
    if (T(/^at the end of the battle (?:that )?this unit's attack hit/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'end', a: 1, hit: 1 }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^at the end of the battle (?:that )?this unit attacked/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'end', a: 1 }; if (f) t.tg = f; let i = m[0].length + l; const b = /^ while boosted by/.exec(s.slice(i)); if (b) { const [f2, l2] = tgt(s.slice(i + b[0].length)); if (!f2) return null; t.bo = 1; t.bof = f2; i += b[0].length + l2; } return tail(t, i, ['boosted']); }
    if (T(/^at the end of the battle (?:that )?this unit boosted/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'end', b: 1 }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^at the end of the battle (?:that )?your drive check revealed (?:an? )?/)) { const np = this.np(s.slice(m[0].length)); if (np) return tail({ e: 'endChk', f: np[0] }, m[0].length + np[1], []); }
    if (T(/^at the end of the battle (?:that )?your /)) { const d = this.ud(s.slice(m[0].length)); const k = d && /^ attacked/.exec(s.slice(m[0].length + d[1])); if (k) { const i0 = m[0].length + d[1] + k[0].length; const [f, l] = tgt(s.slice(i0)); const t = { e: 'end', w: d[0].k, wf: d[0].f }; if (f) t.tg = f; return tail(t, i0 + l, []); } }
    if (T(new RegExp('^at the end of the battle (?:that )?your ' + WHO + ' attacked'))) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'end', w: /vanguard/.test(m[0]) ? 'v' : 'u', wf: who(m) }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^when this unit is rode upon by /)) {
      r = s.slice(m[0].length); let k;
      if ((k = /^(«\d+»)/.exec(r))) return tail({ e: 'rode', by: { nm: this.name(k[1]) } }, m[0].length + k[0].length, []);
      if ((k = /^a (?:grade (\d+) )?(?:card |unit )?with («\d+») in its card name/.exec(r))) return tail({ e: 'rode', by: Object.assign({ nh: this.name(k[2]) }, k[1] ? { g: [+k[1], +k[1]] } : {}) }, m[0].length + k[0].length, []);
      { const lead = /^(?:an? )?/.exec(r)[0]; const a = this.np1(r.slice(lead.length)); if (a && /^,/.test(r.slice(lead.length + a[1]))) return tail({ e: 'rode', by: a[0] }, m[0].length + lead.length + a[1], []); }
      if ((k = /^a grade (\d+)( or greater)?(?: card| unit)?/.exec(r))) return tail({ e: 'rode', by: { g: gspec(+k[1], k[2]) } }, m[0].length + k[0].length, []);
      return null;
    }
    if (T(/^when this unit is rode upon/)) return tail({ e: 'rode' }, m[0].length, []);
    if (T(/^when this card is discarded from hand while riding from ride deck/)) return tail({ e: 'disc', ph: 'rd' }, m[0].length, []);
    if (T(/^when this card is discarded from (hand|deck)(?: or (hand|deck))?/)) { const t = { e: 'disc' }; if (m[1] === 'deck' || m[2]) t.from = [m[1]].concat(m[2] ? [m[2]] : []); return tail(t, m[0].length, ['by']); }
    if (T(/^when this card is put (?:in|into) (?:the |your )?order zone/)) return tail({ e: 'toOrder' }, m[0].length, []);
    if (T(/^when this card is revealed (?:for|during|by) your drive check/)) return tail({ e: 'revealed' }, m[0].length, []);
    if (T(/^when this unit is retired from \(gc\)/)) return tail({ e: 'retGC' }, m[0].length, []);
    if (T(/^when this unit is retired from \(rc\) or \(gc\)/)) return tail({ e: 'retRC', gc: 1 }, m[0].length, ['by']);
    if (T(/^when this unit is retired from \(rc\)/)) return tail({ e: 'retRC' }, m[0].length, ['by']);
    if (T(/^when this unit is retired/)) return tail({ e: 'retRC', gc: 1 }, m[0].length, ['by']);
    if (T(/^when this unit is returned to hand from \(rc\)/)) return tail({ e: 'bounced' }, m[0].length, ['by']);
    if (T(/^when this (?:unit|card) is put into soul from \(rc\)/) || T(/^when this unit is put from \(rc\) into soul/)) return tail({ e: 'toSoul', from: ['RC'] }, m[0].length, ['by']);
    if (T(/^when this card is put into soul/)) return tail({ e: 'toSoul' }, m[0].length, ['from', 'by']);
    if (T(/^when this unit is bound from \(rc\)/)) return tail({ e: 'bound' }, m[0].length, ['by']);
    if (T(/^when this unit (?:is )?\[stand\]s?/)) return tail({ e: 'stood' }, m[0].length, ['by']);
    if (T(/^when this unit is attacked/)) return tail({ e: 'atked', w: 'me' }, m[0].length, []);
    if (T(/^at the end of your turn/)) return tail({ e: 'tend' }, m[0].length, []);
    if (T(/^at the end of each turn/)) return tail({ e: 'tend', each: 1 }, m[0].length, []);
    if (T(/^at the end of your opponent's turn/)) return tail({ e: 'tend', opp: 1 }, m[0].length, []);
    if (T(/^at the beginning of your (ride|main|battle) phase/)) return tail({ e: 'phase', ph: m[1][0] }, m[0].length, []);
    if (T(/^at the beginning of your opponent's (battle) phase/)) return tail({ e: 'phase', ph: m[1][0], opp: 1 }, m[0].length, []);
    if (T(/^when your vanguard's attack hits/)) { const [f, l] = tgt(s.slice(m[0].length)); const t = { e: 'vhit' }; if (f) t.tg = f; return tail(t, m[0].length + l, []); }
    if (T(/^when your drive check reveals a (trigger unit|trigger|normal unit)/)) return tail({ e: 'dcheck', k: m[1][0] === 'n' ? 'n' : 't' }, m[0].length, []);
    if (T(/^when you play an? (normal |set |blitz )?order(?! card)/)) return tail({ e: 'order', k: m[1] ? m[1][0] : '' }, m[0].length, []);
    if (T(/^when you play (?:an? )?/)) { const np = this.np(s.slice(m[0].length)); if (np) return tail({ e: 'order', k: '', f: np[0] }, m[0].length + np[1], []); }
    if (T(/^when you persona ride/)) return tail({ e: 'pride' }, m[0].length, []);
    if (T(/^when you («\d+»)(?=,)/) && this.name(m[1]).length < 30) return tail({ e: 'state', n: this.name(m[1]) }, m[0].length, []);
    if (T(new RegExp('^when you \\[soul-blast (\\d+)\\] or more(?: cards)? at the same time for the cost of your (vanguard|card)\'s ability'))) return tail({ e: 'sbcost', n: +m[1], by: m[2][0] === 'v' ? 'v' : 'a' }, m[0].length, []);
    // "when your (opponent's) <units> attack / are placed / stand / are retired / are attacked / hit"
    if (T(/^when your other card is discarded from hand/)) return tail({ e: 'uDisc' }, m[0].length, ['by']);
    if (T(/^when (your opponent's|your|any player's) /)) {
      const d = this.ud(s.slice(m[0].length)); if (!d) return null;
      const side = m[1].includes('opponent') ? 'o' : m[1].includes('any') ? 'x' : 'm'; const i = m[0].length + d[1]; let k;
      const base = e => { const t = { e, s: side, k: d[0].k }; if (Object.keys(d[0].f).length) t.wf = d[0].f; return t; };
      r = s.slice(i);
      if ((k = /^ attacks or is attacked/.exec(r))) { const t = base('uAtk'); t.alt = base('uAtked'); return tail(t, i + k[0].length, []); }
      if ((k = /^ attacks?(?! or)/.exec(r))) { const [f, l] = tgt(r.slice(k[0].length)); const t = base('uAtk'); if (f) t.tg = f; return tail(t, i + k[0].length + l, []); }
      if ((k = /^ is placed(?: on (?:an? )?\((rc|vc)\))?( in the same column as this unit)?/.exec(r))) { const t = base('uPlace'); if (k[1] === 'vc') t.k = 'v'; else if (k[1] === 'rc' && t.k === 'u') t.k = 'r'; if (k[2]) t.wf = Object.assign({}, t.wf, { col: 1 }); return tail(t, i + k[0].length, ['from', 'by']); }
      if ((k = /^ is returned to hand/.exec(r))) return tail(base('uBounce'), i + k[0].length, ['by']);
      if ((k = /^ (?:is )?\[stand\]s?/.exec(r))) return tail(base('uStood'), i + k[0].length, ['by']);
      if ((k = /^ is retired(?: from \(rc\))?/.exec(r))) return tail(base('uRet'), i + k[0].length, ['by']);
      if ((k = /^ is attacked/.exec(r))) return tail(base('uAtked'), i + k[0].length, []);
      if ((k = /^'s attack hits/.exec(r))) { const [f, l] = tgt(r.slice(k[0].length)); const t = base('uHit'); if (f) t.tg = f; return tail(t, i + k[0].length + l, []); }
      if ((k = /^ is put into soul/.exec(r))) return tail(base('uSoul'), i + k[0].length, ['by']);
      return null;
    }
    return null;
  }

  /* ---------- whole abilities ---------- */
  zone(txt, row) {
    if (!txt) { if (row) throw new Fail(row, 'row zone'); return ''; }
    const parts = txt.split('/').map(x => x.replace(/[()]/g, '').trim()).filter(Boolean).map(x => ZCODE[x]);
    if (parts.some(x => !x)) throw new Fail(txt, 'zone');
    if (row) { if (parts.length !== 1 || parts[0] !== 'R') throw new Fail(row + txt, 'row zone'); return row.startsWith('back row center') ? 'Rc' : row.startsWith('front') ? 'Rf' : 'Rb'; }
    const z = parts.join('');
    return ['V', 'R', 'G', 'VR', 'RG', 'D', 'S', 'H', 'O', 'B'].includes(z) ? z : parts;
  }
  ability(type, row, zoneTxt, once, body, bullets) {
    this.kind = type; this.dur = null; this.last = null; this.lastCond = null; this.ante = null;
    const ab = { t: type === 'auto' ? 'a' : type === 'act' ? 'k' : 'c' };
    const z = this.zone((zoneTxt || '').replace(/\/$/, ''), row);
    if (z && z.length) ab.z = z; if (once) ab.l = 1;
    let s = body;
    if (type === 'cont') return this.cont(ab, s);
    const conds = [];
    if (type === 'auto' && /^if /.test(s)) { for (;;) { const ic = this.ifc(s); if (!ic) break; conds.push(ic[0]); s = ic[1]; } }   // "if X, when Y, …"
    if (type === 'auto') { const t = this.trigger(s); if (!t) throw new Fail(s.split(',')[0], 'trigger'); ab.on = t[0]; s = t[1]; }
    for (;;) { const ic = this.ifc(s); if (!ic) break; conds.push(ic[0]); s = ic[1]; }
    if (conds.length) ab.c = conds;
    if (/^\[cost\]\[/.test(s)) { const [k, rest] = this.eatCost(s); ab.k = k; s = rest.replace(/^(?:, and |, | and )/, ''); }
    ab.d = this.text(s);
    this.modal(ab.d, bullets, s);
    if (!ab.d.length) throw new Fail(body, 'empty');
    return ab;
  }
  /* An ability the compiler cannot run in full can still be half-run: the game knows WHEN it happens (and, where readable, its conditions and cost);
     the effect is left to the player ("man" step). Returns null when not even the timing is understood. mc = a condition the player must judge, mk = a cost the player must pay by hand. */
  assist(type, row, zoneTxt, once, body) {
    this.kind = type; this.dur = null; this.last = null; this.lastCond = null; this.ante = null;
    if (type === 'cont') return null;
    const ab = { t: type === 'auto' ? 'a' : 'k', as: 1 };
    let z; try { z = this.zone((zoneTxt || '').replace(/\/$/, ''), row); } catch (e) { return null; }
    if (z && z.length) ab.z = z; if (once) ab.l = 1;
    let s = body;
    const conds = [];
    if (type === 'auto' && /^if /.test(s)) { try { for (;;) { const ic = this.ifc(s); if (!ic) break; conds.push(ic[0]); s = ic[1]; } } catch (e) { /* judged by the player */ } if (/^if /.test(s)) { const w = s.search(/, (?:when|at the (?:end|beginning|start)) /); if (w < 0) return null; ab.mc = 1; s = s.slice(w + 2); } }
    if (type === 'auto') { let t = null; try { t = this.trigger(s); } catch (e) { t = null; } if (!t) return null; ab.on = t[0]; s = t[1]; }
    try { for (;;) { const ic = this.ifc(s); if (!ic) break; conds.push(ic[0]); s = ic[1]; } } catch (e) { /* the rest is for the player */ }
    if (conds.length) ab.c = conds;
    if (/^(?:if|when|while) /.test(s)) { ab.mc = 1; const w = s.indexOf('[cost]['); const dot = s.search(/\. /); if (w > 0 && (dot < 0 || w < dot)) s = s.slice(w); }
    if (/^\[cost\]\[/.test(s)) { try { ab.k = this.eatCost(s)[0]; } catch (e) { ab.mk = 1; } }
    ab.d = [['man']];
    return ab;
  }
  modal(d, bullets, s) {
    // the "perform one of the following" marker may sit inside an if/may block
    const slots = []; const walk = list => { list.forEach((n, i) => { if (n[0] === 'modal' && !n[1]) slots.push([list, i]); else if (n[0] === 'if' || n[0] === 'later') walk(n[2]); else if (n[0] === 'may') walk(n[1]); }); };
    walk(d);
    if (bullets && bullets.length) { if (slots.length !== 1) throw new Fail(bullets[0], 'bullets without modal'); const all = slots[0][0][slots[0][1]][2]; slots[0][0][slots[0][1]] = ['modal', bullets.map(b => this.option(b))].concat(all ? [1] : []); }
    else if (slots.length) throw new Fail(s, 'modal without bullets');
  }
  option(b) {
    let s = b.replace(/^・\s*/, ''); const o = {}; this.last = null; this.ante = null;
    const ic = this.ifc(s); if (ic) { o.c = ic[0]; s = ic[1]; }
    if (/^\[cost\]\[/.test(s)) { const [k, rest] = this.eatCost(s); o.k = k; s = rest.replace(/^(?:, and |, | and )/, ''); }
    o.d = this.text(s); return o;
  }
  /* "<subject> gets A, can B and cannot C (for each …)" → { s: target, m: mod, per, subText } */
  contBody(s) {
    const FLAGS = [[/^cannot be chosen by your opponent's card's ability/, { resist: 1 }], [/^cannot be retired by your opponent's card's ability/, { noRetOpp: 1 }], [/^cannot be chosen or retired by your opponent's card's ability/, { resist: 1, noRetOpp: 1 }],
      [/^can attack from the back row/, { backAtk: 1 }], [/^can intercept from the back row/, { backInt: 1, intercept: 1 }], [/^cannot be hit/, { cantBeHit: 1 }], [/^cannot attack/, { cantAttack: 1 }], [/^cannot intercept/, { cantIntercept: 1 }], [/^cannot boost/, { cantBoost: 1 }]];
    let m = new RegExp('^when your opponent would call cards (?:from (?:their )?hand )?to \\(gc\\)(?: from (?:their )?hand)?, they must call ' + N + ' or more at the same time$').exec(s);
    if (m) return { s: this.condsAttack ? 'me' : 'all', m: { guardMin: num(m[1]) }, subText: 'this unit' };
    const sub = this.subject(s); if (!sub) return null; let i = sub[1]; const mod = {}; let per = null; let any = false;
    for (;;) {
      let r = s.slice(i);
      if (any) { const sep = /^(?:,? and |, )/.exec(r); if (!sep) break; i += sep[0].length; r = s.slice(i); }
      const lead = /^ ?(?:it |they |this unit )?(?:also )?/.exec(r); const r2 = r.slice(lead[0].length); let k;
      const fl = FLAGS.find(([re]) => re.test(r2));
      if (fl) { Object.assign(mod, fl[1]); i += lead[0].length + fl[0].exec(r2)[0].length; any = true; continue; }
      if ((k = new RegExp('^' + (any ? '(?:gets? )?' : 'gets? ') + '(' + ITEM + '(?:,? and ' + ITEM + ')*)').exec(r2))) {
        for (const it of k[1].split(/,? and /)) {
          if (it.startsWith('«')) { const kw = KW[this.name(it).toLowerCase().replace(/[^a-z ]/g, '').trim()]; if (!kw) return null; Object.assign(mod, kw); }
          else { const st = this.stats(it.replace(/ /g, '')); if (!st) return null; for (const key in st) mod[key] = (mod[key] || 0) + st[key]; }
        }
        i += lead[0].length + k[0].length; any = true;
        { const ins = /^ instead of ?\+(\d+)/.exec(s.slice(i)); if (ins) { for (const key of ['power', 'shield']) if (mod[key]) mod[key] -= +ins[1]; i += ins[0].length; } }
        if (!per && /^ for (?:each|every) /.test(s.slice(i))) { const c = this.count(s.slice(i + 1)); if (c) { per = c[0]; i += 1 + c[1]; } }
        continue;
      }
      if (any) { // a separator was eaten but nothing followed it
        return null;
      }
      return null;
    }
    if (!any || i !== s.length) return null;
    return { s: sub[0] === 'it' ? 'me' : sub[0], m: mod, per, subText: s.slice(0, sub[1]) };
  }
  /* continuous abilities; may return several (one per sentence) */
  cont(ab, s) {
    const conds = []; let m; this.condsAttack = false;
    const eatConds = () => {
      for (;;) {
        if ((m = /^during your turn, /.exec(s))) { conds.push(['my']); s = s.slice(m[0].length); continue; }
        if ((m = /^during your opponent's turn, /.exec(s))) { conds.push(['opp']); s = s.slice(m[0].length); continue; }
        if ((m = /^during your (main|battle) phase, /.exec(s))) { conds.push(['phase', m[1][0]]); s = s.slice(m[0].length); continue; }
        if ((m = /^during the battle (?:that )?this unit (attacked|boosted)(?: a vanguard)?, /.exec(s))) { conds.push([m[1] === 'attacked' ? 'attacking' : 'boosting']); if (m[1] === 'attacked') this.condsAttack = true; if (/a vanguard/.test(m[0])) conds.push(['atkVG']); s = s.slice(m[0].length); continue; }
        if ((m = /^during the battle (?:that )?this unit attacked a grade (\d+)( or greater| or less)?(?: unit| vanguard)?, /.exec(s))) { conds.push(['attacking']); conds.push(['tgGrade', gspec(+m[1], m[2])]); s = s.slice(m[0].length); continue; }
        if ((m = /^during the battle (?:that )?this unit is boosted, /.exec(s))) { conds.push(['boosted']); s = s.slice(m[0].length); continue; }
        if ((m = /^during the battle (?:that )?this unit boosted (?:an? )?/.exec(s))) {
          const r0 = s.slice(m[0].length); const g0 = /^grade (\d+)( or greater| or less)?(?: unit)?(?=, )/.exec(r0); const np = g0 ? [{ g: gspec(+g0[1], g0[2]) }, g0[0].length] : this.np(r0);
          if (np && r0.slice(np[1]).startsWith(', ')) { conds.push(['boosting']); conds.push(['bstIs', np[0]]); s = r0.slice(np[1] + 2); continue; }
        }
        const ic = this.ifc(s); if (ic) { conds.push(ic[0]); s = ic[1]; continue; }
        if (s.startsWith('if ')) throw new Fail(s, 'cont cond');
        break;
      }
    };
    const out = []; let noop = false;
    const sents = s.split(/(?<=[.!])\s+/).map(x => x.replace(/[.!]+$/, '').trim()).filter(Boolean);
    for (const sent of sents) {
      { const prev = conds.slice(); conds.length = 0; s = sent; eatConds(); if (/ instead of ?\+\d/.test(s) || /^(?:it|they) /.test(s)) conds.unshift(...prev); }
      const a = Object.assign({}, ab); if (conds.length) a.c = conds.slice();
      if (/^this (?:card|unit) is (?:also )?regarded as «\d+»$/.test(s) && !conds.length) { noop = true; continue; }
      const parts = s.split(/, and (?=if |all of your |this unit gets |during )/);
      let prevSub = null; let okAll = true; const made = [];
      for (let pi = 0; pi < parts.length && okAll; pi++) {
        s = parts[pi]; const c0 = conds.length; if (pi > 0) eatConds();
        if (pi > 0 && prevSub && /^(?:it|they) /.test(s)) s = prevSub + s.replace(/^(?:it|they)/, '');
        const r = this.contBody(s);
        if (!r) { okAll = false; break; }
        const x = Object.assign({}, ab); if (conds.length) x.c = conds.slice(); x.m = r.m; if (r.s !== 'me') x.s = r.s; if (r.per) x.per = r.per; made.push(x);
        prevSub = r.subText; conds.length = c0 > 0 || pi === 0 ? conds.length : conds.length; if (pi > 0) conds.length = c0;
      }
      if (okAll && made.length) { out.push(...made); continue; }
      throw new Fail(s, 'cont body');
    }
    if (!out.length && !noop) throw new Fail(ab.z || '', 'cont body');
    return out;
  }
}
const HDR = /^・?\[(auto|act|cont)\]\s*(front row |back row center |back row )?((?:\(?(?:vc|rc|gc|drop|soul|hand|order zone|bind zone|vc\/rc|rc\/gc)\)?\/?)*)\s*(\[1\/turn\])?\s*:\s*(.*)$/;

const openModal = d => /\["modal"(?:,null(?:,1)?)?\]/.test(JSON.stringify(d || []));   // a "perform one of the following" whose choices were never filled in
/* overDress wording brought into the shapes the grammar already knows */
const odCanon = l => l.replace(/<(x?overdress)>/g, '[$1]')
  .replace(/^(\[(?:auto|act|cont)\](?:\s*(?:front row |back row center |back row )?\(?(?:vc|rc|gc|drop|soul|hand)\)?)+)\s*[a-z][a-z' -]{2,30}?\s*:(?=\S)/, '$1:')                       // a move's name between the zone and the colon
  .replace(/^play effect ?- ?/, '')
  .replace(/^if (.+?), play this with (\[cost\]\[.*?\])!$/, 'play this with $2 if $1!')
  .replace(/^(\[auto\][^:]*:)\s*when (the attack of )?this unit in the \[(x?overdress)\] state ([^,]*),/, (m, h, att, st, rest) => h + (att ? "when this unit's attack " + rest : 'when this unit ' + rest) + ', if this unit is in the [' + st + '] state,')
  .replace(/^(\[auto\][^:]*:)\s*when this unit (boosts|attacks) in the \[(x?overdress)\] state,/, '$1when this unit $2, if this unit is in the [$3] state,')
  .replace(/\b(choose (?:up to )?(?:a|an|one|two|three|\d+) cards?) from (drop|soul|hand|deck) with the (\[x?overdress\] ability(?: or (?:the )?\[xoverdress\] ability)?)/g, '$1 with the $3 from $2');
const LABEL = /^(\[[^\]]{2,30}\]|<[^>]{2,30}>|[a-zà-ÿ«»0-9!' ,]{3,44}?) ?- ?(?=\[(?:auto|act|cont)\])/;

/* Compile one card. Returns { ast } when every line was understood, otherwise { fail: [...] }. */
export function compileCard(rec, races) {
  if (HANDCARD.has(rec.name)) { HANDUSED.add('@' + rec.name); return { ast: JSON.parse(JSON.stringify(HANDCARD.get(rec.name))) }; }
  const { lines, names } = canonLines(rec.effect);
  const p = new P(names, races, rec.name);
  const out = { a: [] }; const fails = []; let playFailed = false, inPlay = false;
  const isOrder = /order/i.test(rec.type || '');
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    const bullets = []; while (i + 1 < lines.length && lines[i + 1].startsWith('・')) bullets.push(lines[++i]);
    // a keyword name in front of an ability ("Friend - [CONT]…", "[Divine Skill] - [AUTO]…"): mostly a plain name plate; White/Black Wings are a condition, Divine Skill a once-per-fight limit
    l = odCanon(l);
    const lab = LABEL.exec(l); let label = null; const n0 = out.a.length;
    if (lab) { label = lab[1].replace(/[\[\]<>]/g, '').trim(); l = l.slice(lab[0].length); { const tgn = label.replace(/«(\d+)»/g, (x, k) => names[+k]); if (!(out.tg || []).includes(tgn)) (out.tg = out.tg || []).push(tgn); } }
    const wantsBullets = /perform (?:one|all) of the following/.test(l); inPlay = false;
    const hkey = lineKey(l, bullets);
    try {
      let m;
      if (HANDAST.has(hkey)) {
        HANDUSED.add(hkey); const hm = HDR.exec(l); let head = null;
        if (hm) { head = { t: hm[1] === 'auto' ? 'a' : hm[1] === 'act' ? 'k' : 'c', l: !!hm[4] }; try { const z = p.zone((hm[3] || '').replace(/\/$/, ''), hm[2]); if (z && z.length) head.z = z; } catch (e) { if (!(e instanceof Fail)) throw e; } }
        applyHand(out, HANDAST.get(hkey), names, isOrder, head); continue;
      }
      // lines that carry no ability of their own
      if (/^\[cont\]\s*:\s*sentinel\.?$/.test(l)) { out.sentinel = 1; continue; }
      if (/^\[cont\]\s*:\s*this (?:card|unit) is (?:also )?regarded as «\d+»\.?$/.test(l)) continue;
      if (/^\[cont\]\s*:\s*you may (?:only )?have (?:up to )?[a-z]+ «\d+» in (?:a )?deck\.?$/.test(l)) continue;
      if (/^<[^>]+ world>$/.test(l)) continue;
      if (/^regalis piece$/.test(l)) { out.rp = 1; continue; }
      if (/^updated: ?text$/.test(l)) continue;                                           // a note of the card list, not card wording
      // name plates that carry no ability of their own (other cards may look for them): kept as tags
      if (/^(?:\[(?:prisoner|happy toys|ace unit)\]|power ?\d+|skill ?\d+|⟦position\|[a-z ]+⟧|super finishing attack ?: ?«\d+»|finishing attack ?: ?[a-z]+|<[a-z0-9' !:@.&-]+>)$/.test(l) && !/ world>$/.test(l)) { (out.tg = out.tg || []).push(l.replace(/[\[\]<>⟦⟧]/g, '').replace(/«(\d+)»/g, (x, k) => names[+k]).replace(/^position\|/, '')); continue; }
      if ((m = /^dressup ?- ?(«\d+»)$/.exec(l))) { out.as = p.name(m[1]); continue; }      // during the fight also regarded as the named card
      if ((m = /^\[cont\]\s*:\s*during your opponent's turn's guard step, this card can be called to \(gc\) as a trigger unit, and it becomes a grade 0\/\[shield\] ?(\d+) guardian\.?$/.exec(l))) { out.og = +m[1]; continue; }
      if (/^\[cont\]\s*:\s*this card cannot be played\.?$/.test(l)) { out.np = 1; continue; }
      if ((m = /^\[cont\]\s*:\s*(?:this card cannot be ridden|you cannot ride this card)(?:,? (?:and|or) (cannot be normal called to \(rc\)(?: from hand)?|can only be called to the back row center \(rc\)|(?:cannot be )?called to \(rc\)))?\.?$/.exec(l))) { out.nr = 1; if (m[1]) out[m[1].startsWith('can only') ? 'bc' : m[1].includes('normal') ? 'nnc' : 'nc'] = 1; continue; }
      if (/^\[cont\]\s*:\s*this (?:unit|card) cannot be normal called to \(rc\)\.?$/.test(l)) { out.nnc = 1; continue; }
      if ((m = /^\[cont\]\s*:\s*this card cannot be ridden, and cannot be normal called to \(rc\) without any ([a-z][a-z' -]*?) markers?\.?$/.exec(l))) { out.nr = 1; out.ncm = m[1]; continue; }
      if ((m = /^\[cont\]\s*:\s*this card can only be ridden from a (?:grade (\d+) )?(?:card |unit )?with («\d+») in its card name\.?$/.exec(l))) { out.rf = { nh: p.name(m[2]) }; if (m[1]) out.rf.g = +m[1]; continue; }
      if (/^\[glitter\](?:\s*-\s*[a-z' ]+)?$/.test(l)) { out.gl = 1; continue; }
      // overDress / X-overDress: which rear-guards this card may be put on top of
      if ((m = /^\[(x?)overdress\] ?- ?(.+)$/.exec(l))) {
        const x = !!m[1]; const parts = []; let r = m[2].replace(/\.$/, '');
        if (!x) {
          const one = t => { let k; if ((k = /^(?:an? )?(?:(grade (\d+) or less) )?unit in the \[(x?)overdress\] state$/.exec(t))) return Object.assign({ ods: k[3] ? 'x' : 'o' }, k[2] ? { g: [0, +k[2]] } : {}); const a = p.np1(t); if (a && a[1] === t.length) return a[0]; throw new Fail(t, 'overdress on'); };
          const alt = r.split(/,? or (?!less|greater|more)/); parts.push({ f: alt.length > 1 ? { or: alt.map(one) } : one(alt[0]), n: 1 });
        } else {
          for (const t of r.split(/,? and /)) {
            let k;
            if ((k = new RegExp('^' + N + ' or more (.+?)(?: units?)? with different card name(?: from each other)?$').exec(t))) { const a = p.np1(k[2]); if (!a || a[1] !== k[2].length) throw new Fail(t, 'xoverdress part'); parts.push({ f: a[0], min: num(k[1]), max: 9, dist: 1 }); }
            else if ((k = /^one (.+?)(?: units?)?$/.exec(t))) { const a = p.np1(k[1]); if (!a || a[1] !== k[1].length) throw new Fail(t, 'xoverdress part'); parts.push({ f: a[0], n: 1 }); }
            else throw new Fail(t, 'xoverdress part');
          }
        }
        out.od = Object.assign({ p: parts }, x ? { x: 1 } : {}); continue;
      }
      if (/^\[cont\]order zone:if order zone only has world cards, the following effects are active according to the number of cards in order zone\.?$/.test(l) && bullets.length === 2 && /1 card ?- ?your world becomes dark night/.test(bullets[0]) && /2 or more cards ?- ?your world becomes abyssal dark night/.test(bullets[1])) { out.world = 1; continue; }
      // "[CONT]: If X, this card gets all of the following" + bulleted abilities
      if ((m = /^\[cont\]\s*:\s*(.*)this (?:card|unit) gets all of the following\.?$/.exec(l)) && bullets.length) {
        let pre = m[1].trim(); const conds = [];
        while (pre) { const ic = p.ifc(pre.endsWith(', ') || pre.endsWith(',') ? pre + ' x' : pre + ', x'); if (!ic) throw new Fail(pre, 'group cond'); conds.push(ic[0]); pre = ic[1] === 'x' ? '' : ic[1].replace(/,? ?x$/, ''); }
        for (const b of bullets) {
          const bm = HDR.exec(b); if (!bm) throw new Fail(b.slice(0, 60), 'group line');
          const ab = p.ability(bm[1], bm[2], bm[3], !!bm[4], bm[5], []);
          for (const a of (Array.isArray(ab) ? ab : [ab])) { if (conds.length) a.c = conds.concat(a.c || []); if (isOrder && !a.z) a.z = 'O'; out.a.push(a); }
        }
        continue;
      }
      m = HDR.exec(l);
      if (m) {
        const ab = p.ability(m[1], m[2], m[3], !!m[4], m[5], wantsBullets ? bullets : []);
        if (bullets.length && !wantsBullets) throw new Fail(bullets[0].slice(0, 60), 'stray bullets');
        for (const a of (Array.isArray(ab) ? ab : [ab])) { if (isOrder && !a.z) a.z = 'O'; out.a.push(a); }
        continue;
      }
      if ((m = /^additional effect\s*-\s*(.*)$/.exec(l))) { p.kind = 'over'; p.dur = null; p.last = null; p.ante = null; out.o = p.text(m[1]); p.modal(out.o, wantsBullets ? bullets : [], l); continue; }
      if (isOrder) {
        inPlay = true; p.kind = 'play'; p.dur = null; p.last = null; p.ante = null; let s = l; const play = out.p || (out.p = { d: [] });
        if ((m = /^this card can be played from (drop|soul)(?:, and |\. ?|$)/.exec(s))) { play.from = (play.from || []).concat([ZWORD[m[1]]]); s = s.slice(m[0].length); }
        if ((m = /^play this (?:card )?if /.exec(s))) { const c = p.cond(s.slice(m[0].length)); if (!c) throw new Fail(s, 'play cond'); play.c = (play.c || []).concat([c[0]]); s = s.slice(m[0].length + c[1]).replace(/^[!.,]?\s*/, ''); }
        if ((m = /^play this (?:card )?with (\[cost\]\[)/.exec(s))) {
          const [k, rest] = p.eatCost(s.slice(m[0].length - m[1].length)); play.k = k; s = rest;
          if ((m = /^ if /.exec(s))) { const c = p.cond(s.slice(m[0].length)); if (!c) throw new Fail(s, 'play cond'); play.c = (play.c || []).concat([c[0]]); s = s.slice(m[0].length + c[1]); }
          s = s.replace(/^[!.,]?\s*/, '');
        }
        if (s) play.d.push(...p.text(s));
        p.modal(play.d, wantsBullets ? bullets : [], l);
        continue;
      }
      throw new Fail(l.slice(0, 60), 'line');
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      let as = null; const hm = process.env.NOASSIST ? null : HDR.exec(l);
      if (hm) { try { as = p.assist(hm[1], hm[2], hm[3], !!hm[4], hm[5]); } catch (x) { if (!(x instanceof Fail)) throw x; as = null; } if (as) { if (isOrder && !as.z) as.z = 'O'; out.a.push(as); } }
      else if (!process.env.NOASSIST && inPlay && isOrder && out.p && out.p.as) { as = out.p; out.p.d = out.p.d.filter(st => !openModal([st])); if ((out.p.d[out.p.d.length - 1] || [])[0] !== 'man') out.p.d.push(['man']); }   // another line that is not understood: one more stop for the player, after the steps the game does
      else if (!process.env.NOASSIST && inPlay && isOrder) {
        // an order whose effect is not understood: it can still be played (cost paid when readable), the effect is done by hand
        const kept = out.p && out.p.d && !openModal(out.p.d) ? out.p.d : [];   // steps of earlier lines stay; a half-read "perform one of the following" does not
        const play = Object.assign({}, out.p || {}, { d: kept.concat([['man']]), as: 1 }); const m2 = /^play this (?:card )?with (\[cost\]\[)/.exec(l);
        if (m2) { try { play.k = p.eatCost(l.slice(m2[0].length - m2[1].length))[0]; } catch (x) { if (!(x instanceof Fail)) throw x; play.mk = 1; } }
        if (/^play this (?:card )?if |\bif you\b|\bif your\b/.test(l) && !m2) play.mc = 1;
        out.p = play; as = play;
      }
      if (out.o && openModal(out.o)) delete out.o;
      if (out.p && !out.p.as && openModal(out.p.d)) playFailed = true;
      if (inPlay && !as) playFailed = true;
      { const nm = {}; for (const m of (l + ' ' + bullets.join(' ')).matchAll(/«(\d+)»/g)) nm[m[1]] = names[+m[1]]; fails.push({ at: e.at, why: e.why, line: l, as: !!as, key: hkey, bullets, nm }); }
    } finally {
      if (label) for (let k = n0; k < out.a.length; k++) { const a = out.a[k]; if (label === 'divine skill') a.dv = 1; const w = /^(white|black) wings$/.exec(label); if (w) a.c = [['wings', w[1][0]]].concat(a.c || []); }
    }
  }
  if (fails.length) {
    // some abilities were understood and some were not: the understood ones can still run (the card is marked as partly automatic)
    const usable = !playFailed && (out.a.length > 0 || (isOrder && out.p && out.p.d.length > 0));
    const asst = fails.filter(f => f.as).length;
    return usable ? { fail: fails, part: Object.assign(out, { miss: fails.length }, asst ? { asst } : {}) } : { fail: fails };
  }
  return { ast: out };
}
