// Shared by tools/mkwiki.mjs and tools/mkjp.mjs: the Japanese pool as cards, and the test "is this English row the same card?"
export const TYPE = { 'ノーマルユニット': 'U', 'トリガーユニット': 'U', 'ノーマルオーダー': 'O', 'セットオーダー': 'S', 'ブリッツオーダー': 'B', 'ライドデッキクレスト': 'C', 'トリガーオーダー': 'T', 'Gユニット': 'G', 'その他': 'X', '必殺技': 'M' };
export const NATION = { 'ドラゴンエンパイア': 'Dragon Empire', 'ダークステイツ': 'Dark States', 'ブラントゲート': 'Brandt Gate', 'ケテルサンクチュアリ': 'Keter Sanctuary', 'ストイケイア': 'Stoicheia', 'リリカルモナステリオ': 'Lyrical Monasterio', '刀剣乱舞': 'Touken Ranbu', '終末のワルキューレ': 'Record of Ragnarok', 'バディファイト': 'Buddyfight', 'コロコロ': 'CoroCoro', 'イナズマイレブン': 'Inazuma Eleven', 'モンスターストライク': 'Monster Strike', 'ぶいすぽっ！': 'VSPO!', 'ダークゾーン': 'Dark Zone', 'スターゲート': 'Star Gate', 'メガラニカ': 'Magallanica', 'ユナイテッドサンクチュアリ': 'United Sanctuary' };
const num = s => { const m = /(\d[\d,]*)/.exec(s || ''); return m ? +m[1].replace(/,/g, '') : null; };
export const setOf = no => no.split('/')[0]; export const plain = no => /\/\d+$/.test(no); export const promo = no => /^(?:[A-Z]+-)?PR\//.test(no);
/* Japanese printings → unique cards (same name = same card). jp = { rows: [{ no, img, name, st: [type, nation.., grade, power, shield], f }], trig: { c, d, f, h, o: [numbers] } } */
export const nameKey = s => String(s || '').normalize('NFKC').replace(/[\s\u3000]+/g, '').replace(/[“”"「」『』'’‘]/g, '"').replace(/[・･·]/g, '・').toLowerCase();
export function jpCards(jp) {
  const trigOf = {}; for (const k in jp.trig || {}) for (const no of jp.trig[k]) trigOf[no] = { c: 'crit', d: 'draw', f: 'front', h: 'heal', o: 'over' }[k];
  const cards = new Map(); const byKey = new Map();
  for (const r of jp.rows) {
    if (!r.no || !r.name) continue;
    const st = r.st; const gi = st.findIndex(x => /^グレード/.test(x)); const pick = re => st.find(x => re.test(x));
    const nat = st.slice(1, gi < 0 ? 2 : gi).filter(x => x && x !== '-').map(x => NATION[x] || x);
    // one card can be written with small differences between printings (width of a space or of quotation marks): those are the same card
    const key = nameKey(r.name); let c = byKey.get(key);
    if (!c) { c = { name: r.name, prints: [], f: '', t: TYPE[st[0]] || 'X', jt: st[0], trigUnit: st[0] === 'トリガーユニット', nation: nat[0] || '', nations: nat, grade: num(pick(/^グレード/)), power: num(pick(/^パワー/)), shield: num(pick(/^シールド/)), also: [] }; cards.set(r.name, c); byKey.set(key, c); }
    else if (r.name !== c.name && !c.also.includes(r.name)) c.also.push(r.name);
    c.prints.push({ no: r.no, img: r.img }); for (const ch of r.f || '') if (!c.f.includes(ch)) c.f += ch;
    if (trigOf[r.no]) c.trig = trigOf[r.no];
  }
  // the list is newest first: the card's number and picture are those of its first printing in a regular set
  for (const c of cards.values()) { const p = c.prints.filter(x => plain(x.no)); const q = p.filter(x => !promo(x.no)); const pick = (q.length ? q : p.length ? p : c.prints).slice(-1)[0]; c.no = pick.no; c.img = pick.img; }
  return cards;
}
const TOK = { U: ['U', 'X'], T: ['O'], O: ['O'], S: ['S'], B: ['B'], C: ['C', 'X'], X: ['X', 'C'], G: [], M: [] };
// rows: [no, name, type, nationIdx, raceIdx, grade, power, shield, flags, trigger, …, [other numbers]]
export const same = (c, r) => (TOK[c.t] || []).includes(r[2]) && (c.grade ?? null) === (r[5] ?? null) && (c.power ?? null) === (r[6] ?? null) && (c.shield ?? null) === (r[7] ?? null) && (!c.trig || !r[9] || c.trig === r[9]) && (!!(c.trigUnit || c.t === 'T') === !!r[9] || c.t === 'X' || c.t === 'C');
/* English rows by number without the EN mark; and which sets carry the same cards under the same numbers in both languages */
// The English list dump joined some different cards into one record (names that differ only inside quotation marks): such a row lists two plain numbers of one set.
// Only its own first number can be trusted to mean that card.
export const merged = r => { const seen = new Map(); for (const n of [r[0], ...(r[12] || [])]) { const m = /^([A-Z0-9-]+)\/(\d+)EN$/.exec(n); if (!m || /PR$/.test(m[1])) continue; if (seen.has(m[1]) && seen.get(m[1]) !== m[2]) return true; seen.set(m[1], m[2]); } return false; };
export function numberLink(cards, rows, skip = () => false) {
  const enByNo = new Map(), enExact = new Map(); const strip = n => String(n).replace(/EN$/i, '').replace(/EN(?=[^/]*$)/i, '');
  rows.forEach((r, i) => { if (skip(r)) return; for (const n of [r[0], ...(r[12] || [])]) { if (!enExact.has(n)) enExact.set(n, i); const k = strip(n); if (!enByNo.has(k)) enByNo.set(k, i); } });
  // the same product can carry another code in the two languages (start decks: DZ-SD.. in Japan, DZ-TD.. in English)
  const enOf = no => enByNo.get(no) ?? enByNo.get(no.replace(/^DZ-SD(\d+)\//, 'DZ-TD$1/'));
  const sets = {};
  for (const c of cards.values()) for (const p of c.prints) { if (!plain(p.no) || c.t === 'X') continue; const i = enOf(p.no); if (i === undefined) continue; const s = sets[setOf(p.no)] || (sets[setOf(p.no)] = { pairs: 0, ok: 0 }); s.pairs++; if (same(c, rows[i])) s.ok++; }
  const trusted = new Set(Object.keys(sets).filter(s => sets[s].pairs >= 4 && sets[s].ok / sets[s].pairs >= 0.97));
  // rows this card certainly is, by number
  const hits = c => { const hit = new Set(); for (const p of c.prints) { if (!trusted.has(setOf(p.no))) continue; const i = enOf(p.no); if (i !== undefined && same(c, rows[i])) hit.add(i); } return [...hit]; };
  return { enByNo, enExact, enOf, sets, trusted, hits };
}
