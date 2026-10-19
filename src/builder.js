/* Deck builder: pick cards from the full card list, check deck rules live, save to "my decks". */
(function () {
'use strict';
const VG = window.VG, U = window.VGUI, $ = U.$, esc = U.esc;
const GRADES = [['all', 'ทุกเกรด'], ['0', 'G0'], ['1', 'G1'], ['2', 'G2'], ['3', 'G3'], ['4', 'G4+']];
const ICONS = [['all', 'ทุกไอคอน'], ['aichi', 'Aichi'], ['kai', 'Kai'], ['ren', 'Ren'], ['chrono', 'Chrono'], ['shinemon', 'Shinemon']];
const TYPES = [['all', 'ทุกประเภท'], ['unit', 'ยูนิท'], ['trig', 'ทริกเกอร์'], ['order', 'ออเดอร์'], ['crest', 'เครสต์']];
const TRIG = { crit: 'Critical', draw: 'Draw', front: 'Front', heal: 'Heal', over: 'Over' };
const B = { id: null, slot: 0, existing: false, ride: [], main: new Map(), gz: new Map(), q: '', nation: '', grade: 'all', type: 'all', icon: 'all', auto: false, limit: 60, open: null, dirty: false, armBack: false, armDel: false };

const row = no => VG.DB.byNo[no];
const defaultCrest = () => { const r = VG.DB.byName['Energy Generator']; return r ? [r.no] : []; };
function deckObj() { return { id: B.id, name: ($('#bdName').value || '').trim() || 'เด็คของฉัน', ride: B.ride.slice(), main: [...B.main].map(([no, n]) => ({ no, n })), g: [...B.gz].map(([no, n]) => ({ no, n })) }; }
const nameOf = c => c.as || c.name;
function copies(name) { let n = 0; for (const [no, k] of B.main) if (nameOf(VG.card(no)) === name) n += k; for (const no of B.ride) if (nameOf(VG.card(no)) === name) n++; for (const [no, k] of B.gz) if (nameOf(VG.card(no)) === name) n += k; return n; }
const isG = r => (r.t === 'X' && r.grade === 4 && r.power != null) || r.t === 'M';   // a G unit or an Inazuma special move (both go in the G zone / special move deck)   // a G unit (goes in the G zone)
function gTotal() { let n = 0; for (const k of B.gz.values()) n += k; return n; }
function mainTotal() { let n = 0; for (const k of B.main.values()) n += k; return n; }

function open(deckId, slot, from) {
  const src = deckId && VG.DECKS[deckId]; B.from = from || null; $('#mydecks').hidden = true;
  Object.assign(B, { slot: slot || 0, open: null, limit: 60, q: '', grade: 'all', type: 'all', icon: 'all', auto: false, dirty: false, armBack: false, armDel: false });
  if (src && src.custom) { B.id = src.id; B.existing = true; $('#bdName').value = src.name; }
  else { B.id = 'my' + Date.now().toString(36); B.existing = false; $('#bdName').value = src ? src.name + ' (ของฉัน)' : 'เด็คใหม่'; }
  B.ride = src ? src.ride.map(VG.canon) : defaultCrest();
  B.gz = new Map(); if (src) for (const e of src.g || []) { const no = VG.canon(e.no); B.gz.set(no, (B.gz.get(no) || 0) + (e.n || 1)); }
  B.main = new Map(); if (src) for (const e of src.main) { const no = VG.canon(e.no); B.main.set(no, (B.main.get(no) || 0) + e.n); }
  B.nation = src ? VG.deckNation(src) : '';
  $('#bdQ').value = ''; $('#bdAuto').checked = false;
  $('#bdNation').innerHTML = '<option value="">ทุกเนชั่น</option>' + VG.DB.nations.map(n => '<option value="' + esc(n) + '"' + (n === B.nation ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
  $('#bdDelete').hidden = !B.existing; $('#bdDelete').textContent = 'ลบเด็ค';
  $('#lobby').hidden = true; $('#builder').hidden = false; window.scrollTo(0, 0);
  status(VG.DB.count ? '' : 'ยังไม่มีฐานข้อมูลการ์ดในหน้านี้', !VG.DB.count);
  chips(); renderList(); renderDeck();
}
function close() { $('#builder').hidden = true; if (B.from === 'decks') { Decks.open(); return; } $('#lobby').hidden = false; U.renderLobby(); window.scrollTo(0, 0); }
function status(t, warn) { const el = $('#bdStatus'); el.textContent = t || ''; el.classList.toggle('err', !!warn); }
function chips() {
  $('#bdGrade').innerHTML = GRADES.map(([v, lb]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (B.grade === v) + '">' + lb + '</button>').join('');
  { const el = $('#bdIcon'); if (el) el.innerHTML = ICONS.map(([v, lb]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (B.icon === v) + '">' + lb + '</button>').join(''); }
  $('#bdType').innerHTML = TYPES.map(([v, lb]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (B.type === v) + '">' + lb + '</button>').join('');
}
function matches() {
  const words = B.q.toLowerCase().split(/\s+/).filter(Boolean);
  return VG.DB.rows.filter(r => {
    if (r.t === 'X' && !isG(r)) return false;
    if (VG.DB.jp && !r.jno && !isG(r)) return false;   // the pool is the Japanese card list
    if (B.nation && r.nation && r.nation !== B.nation) return false;
    if (B.grade !== 'all') { if (r.grade == null) return false; if (B.grade === '4' ? r.grade < 4 : r.grade !== +B.grade) return false; }
    if (B.type === 'unit' && !(r.t === 'U' && !r.trig)) return false;
    if (B.type === 'trig' && !r.trig) return false;
    if (B.type === 'order' && !(r.t === 'O' || r.t === 'S' || r.t === 'B')) return false;
    if (B.type === 'crest' && r.t !== 'C') return false;
    if (B.auto && !r.auto) return false;
    if (B.icon !== 'all' && r.icon !== B.icon) return false;
    for (const w of words) if (!r.key.includes(w)) return false;
    return true;
  });
}
function meta(r) {
  const a = [];
  if (r.nation) a.push(r.nation); if (r.race) a.push(r.race);
  if (r.t === 'U') a.push(r.power + (r.shield != null ? ' / ชิลด์ ' + r.shield : ''));
  if (r.t === 'O') a.push('ออเดอร์'); if (r.t === 'S') a.push('เซ็ตออเดอร์'); if (r.t === 'B') a.push('บลิตซ์ออเดอร์'); if (r.t === 'C') a.push('ไรด์เด็คเครสต์');
  if (r.trig) a.push(TRIG[r.trig] + ' trigger');
  if (r.icon) a.push('ไอคอน ' + r.icon.charAt(0).toUpperCase() + r.icon.slice(1));
  if (r.flags.includes('s')) a.push('เซนทิเนล'); if (r.flags.includes('p')) a.push('เพอร์โซน่าไรด์'); if (r.flags.includes('3')) a.push('ทริปเปิลไดรฟ์');
  return a.join(' · ');
}
const tag = r => (r.auto ? (r.semi ? '<span class="tags">กึ่งออโต้</span>' : r.part ? '<span class="tagp">ออโต้บางส่วน</span>' : r.beta ? '<span class="tagb">ออโต้ β</span>' : '<span class="taga">ออโต้</span>') : '<span class="tagm">ยังไม่ออโต้</span>');
/* a small card face; it shows the owner's picture when there is one (imported, from the cards folder, or loaded by the local copy) */
const thumb = (no, cls) => '<span class="cth' + (cls ? ' ' + cls : '') + '" data-th="' + esc(no) + '">' + U.staticCard(no, true) + '</span>';
/* pictures that arrive after the list was drawn are put in place without redrawing the list */
function refreshThumbs() { if ($('#builder').hidden) return; for (const el of document.querySelectorAll('#builder [data-th]')) { if (el.querySelector('.has-img')) continue; if (U.imgFor(VG.card(el.dataset.th))) el.innerHTML = U.staticCard(el.dataset.th, true); } }
const stTag = r => (r.auto ? (r.semi ? ['s', 'กึ่งออโต้'] : r.part ? ['p', 'บางส่วน'] : r.beta ? ['b', 'β'] : null) : ['m', 'ทำเอง']);
/* one card of the library: a tile with its face; the face opens the card window, the buttons below add / remove */
function rowHTML(r) {
  const g = isG(r); const have = g ? (B.gz.get(r.no) || 0) : (B.main.get(r.no) || 0); const inRide = B.ride.includes(r.no);
  const canRide = (r.t === 'U' && r.grade <= 3) || r.t === 'C' || !!(VG.card(r.no) && VG.card(r.no).rideDeckOK);
  const canMain = r.t !== 'C';
  const full = copies(r.as || r.name) >= r.lim; const st = stTag(r);
  return '<div class="crow' + (have || inRide ? ' in' : '') + '" data-no="' + esc(r.no) + '">'
    + '<button type="button" class="cthb" data-det="1" aria-label="อ่านการ์ด ' + esc(r.name) + '">' + thumb(r.no, 'lg')
    + '<b class="cg' + (r.trig ? ' t-' + r.trig : '') + '">' + (r.grade == null ? '—' : 'G' + r.grade) + '</b>'
    + (st ? '<i class="st st-' + st[0] + '">' + st[1] + '</i>' : '')
    + (have || inRide ? '<span class="have">' + (have ? '×' + have : '') + (inRide ? (have ? ' ' : '') + 'R' : '') + '</span>' : '') + '</button>'
    + '<span class="tn" title="' + esc(r.name + (r.jname && r.jname !== r.name ? ' · ' + r.jname : '') + ' · ' + meta(r)) + '">' + esc(r.name) + '</span>'
    + '<span class="ca">'
    + (canRide ? '<button type="button" class="mini" data-add="ride"' + (inRide || (full && !inRide) ? ' disabled' : '') + ' title="ใส่ในไรด์เด็ค">ไรด์</button>' : '')
    + (canMain ? '<button type="button" class="mini" data-sub="1"' + (have ? '' : ' disabled') + ' aria-label="ลด 1 ใบ">−</button><button type="button" class="mini pri" data-add="' + (g ? 'g' : 'main') + '"' + (full || (g && gTotal() >= 16) ? ' disabled' : '') + ' aria-label="' + (g ? 'เพิ่ม 1 ใบใน G โซน' : 'เพิ่ม 1 ใบ') + '">+</button>' : '') + '</span></div>';
}
function renderList() {
  const m = matches();
  $('#bdCount').textContent = 'พบ ' + m.length.toLocaleString('en-US') + ' ใบ' + (m.length > B.limit ? ' · แสดง ' + B.limit + ' ใบแรก' : '');
  $('#bdList').innerHTML = (m.length ? m.slice(0, B.limit).map(rowHTML).join('') : '<p class="note">ไม่พบการ์ดตามเงื่อนไข ลองเปลี่ยนเนชั่นหรือคำค้นหา</p>')
    + (m.length > B.limit ? '<button type="button" class="ghost bd-more" id="bdMore">แสดงเพิ่มอีก 60 ใบ</button>' : '');
}
/* the card window as the deck editor uses it: the same reading window, with the add / remove buttons under the text */
function cardFoot(no) {
  const r = row(no); if (!r) return '';
  const have = B.main.get(r.no) || 0; const inRide = B.ride.includes(r.no); const canRide = (r.t === 'U' && r.grade <= 3) || r.t === 'C' || !!(VG.card(r.no) && VG.card(r.no).rideDeckOK); const canMain = r.t !== 'C'; const full = copies(r.as || r.name) >= r.lim;
  return '<span class="cw-deck">' + (canRide ? '<button type="button" class="btn" data-cwact="ride"' + (inRide || (full && !inRide) ? ' disabled' : '') + '>' + (inRide ? 'อยู่ในไรด์เด็ค' : 'ใส่ไรด์เด็ค') + '</button>' : '')
    + (canMain ? '<button type="button" class="btn" data-cwact="sub"' + (have ? '' : ' disabled') + ' aria-label="ลด 1 ใบ">−</button><b>' + have + ' ใบ</b><button type="button" class="btn" data-cwact="add"' + (full ? ' disabled' : '') + ' aria-label="เพิ่ม 1 ใบ">+</button>' : '')
    + '<i>' + esc(r.jno || r.no) + (r.lim !== 4 ? ' · สูงสุด ' + r.lim + ' ใบ' : '') + '</i></span>';
}
function readCard(no) {
  U.openCard(no, null, { foot: cardFoot, act: b => { const k = b.dataset.cwact; act(no, { dataset: k === 'ride' ? { add: 'ride' } : k === 'add' ? { add: 'main' } : { sub: '1' } }); readCard(no); } });
}
function renderDeck() {
  const d = deckObj(); const r = VG.inspectDeck(d); const k = r.counts;
  const bar = (lb, n, max, cls, inner) => '<div class="gz ' + (cls || '') + '"><span>' + lb + '</span><b>' + n + '<i>/' + max + '</i></b><em>' + (inner || '<u style="width:' + Math.min(100, n / max * 100) + '%"></u>') + '</em></div>';
  const seg = [['crit', k.crit], ['draw', k.draw], ['front', k.front], ['heal', k.heal], ['over', k.over]].map(([t, n]) => (n ? '<u class="t-' + t + '" style="width:' + (n / 16 * 100) + '%" title="' + TRIG[t] + ' ' + n + '"></u>' : '')).join('');
  const gs = [k.g[0] || 0, k.g[1] || 0, k.g[2] || 0, k.g[3] || 0, k.g[4] || 0]; const gmax = Math.max(1, ...gs);
  $('#bdSum').innerHTML = bar('MAIN', k.main, 50, k.main === 50 ? 'ok' : 'bad') + bar('TRIGGER', k.trig, 16, k.trig === 16 ? 'ok' : 'bad', seg) + bar('SENTINEL', k.sent, 4, k.sent > 4 ? 'bad' : k.sent === 4 ? 'ok' : '')
    + '<div class="curve" aria-label="จำนวนการ์ดตามเกรด">' + gs.map((n, g) => '<span><u style="height:' + (n / gmax * 100) + '%"></u><b>' + n + '</b><i>G' + g + (g === 4 ? '+' : '') + '</i></span>').join('') + '</div>'
    + '<div class="gz-line">' + (r.nation ? '<b>' + esc(r.nation) + '</b>' : '') + '<i>คริ ' + k.crit + ' · ดรอว์ ' + k.draw + ' · ฟรอนต์ ' + k.front + ' · ฮีล ' + k.heal + ' · โอเวอร์ ' + k.over + (k.order ? ' · ออเดอร์ ' + k.order : '') + '</i></div>';
  $('#bdChecks').innerHTML = (r.errors.length ? r.errors.map(e => '<div class="e">• ' + esc(e) + '</div>').join('') : '<div class="g">ผ่านกฎสร้างเด็ค D Standard</div>')
    + (r.manual.length ? '<div class="m">สกิลยังไม่ออโต้ ' + r.manual.length + ' ชนิด: ' + esc(r.manual.slice(0, 6).join(', ')) + (r.manual.length > 6 ? ' …' : '') + '</div>' : (k.kinds ? '<div class="g">สกิลของการ์ดทุกใบในเด็คนี้ทำงานอัตโนมัติ</div>' : ''));
  // ride deck: five slots
  let h = '';
  for (let g = 0; g <= 3; g++) {
    const no = B.ride.find(x => { const c = VG.card(x); return c.type === 'unit' && c.grade === g; });
    h += '<div class="rslot' + (no ? '' : ' empty') + '"' + (no ? ' data-no="' + esc(no) + '"' : '') + '><span class="rl">G' + g + '</span>' + (no ? '<button type="button" class="cthb" data-det="1" aria-label="อ่านการ์ด ' + esc(VG.card(no).name) + '">' + thumb(no, 'md') + '</button><span class="tn">' + esc(VG.card(no).name) + '</span><button type="button" class="mini rx" data-unride="' + esc(no) + '" aria-label="เอาออกจากไรด์เด็ค">×</button>'
      : '<span class="cth md ph"></span><span class="tn">กด "ไรด์" ที่การ์ดเกรด ' + g + '</span>') + '</div>';
  }
  const crest = B.ride.find(x => VG.card(x).type === 'crest');
  h += '<div class="rslot' + (crest ? '' : ' empty') + '"' + (crest ? ' data-no="' + esc(crest) + '"' : '') + '><span class="rl">CREST</span>' + (crest ? '<button type="button" class="cthb" data-det="1" aria-label="อ่านการ์ด ' + esc(VG.card(crest).name) + '">' + thumb(crest, 'md') + '</button><span class="tn">' + esc(VG.card(crest).name) + '</span><button type="button" class="mini rx" data-unride="' + esc(crest) + '" aria-label="เอาเครสต์ออก">×</button>'
    : '<span class="cth md ph"></span><span class="tn">ไม่มีเครสต์ (ไม่มีเอเนอร์จี)</span>' + (defaultCrest().length ? '<button type="button" class="mini" data-crest="1">ใส่ Energy Generator</button>' : '')) + '</div>';
  $('#bdRide').innerHTML = h;
  // main deck: tiles grouped by grade
  const ents = [...B.main].map(([no, n]) => ({ no, n, c: VG.card(no) })).sort((a, b) => a.c.name.localeCompare(b.c.name));
  const groups = [['GRADE 4+', e => e.c.type === 'unit' && !e.c.trigger && e.c.grade >= 4], ['GRADE 3', e => e.c.type === 'unit' && !e.c.trigger && e.c.grade === 3], ['GRADE 2', e => e.c.type === 'unit' && !e.c.trigger && e.c.grade === 2], ['GRADE 1', e => e.c.type === 'unit' && !e.c.trigger && e.c.grade === 1], ['GRADE 0', e => e.c.type === 'unit' && !e.c.trigger && e.c.grade === 0], ['TRIGGER', e => !!e.c.trigger], ['ORDER', e => e.c.type === 'order'], ['OTHER', e => e.c.type !== 'unit' && e.c.type !== 'order']];
  h = '';
  for (const [lb, f] of groups) {
    const g = ents.filter(f); if (!g.length) continue;
    h += '<div class="bd-group"><span>' + lb + '</span><span>' + g.reduce((s, e) => s + e.n, 0) + ' ใบ</span></div><div class="dgrid">';
    for (const e of g) h += '<div class="drowb" data-no="' + esc(e.no) + '"><button type="button" class="cthb" data-det="1" aria-label="อ่านการ์ด ' + esc(e.c.name) + '">' + thumb(e.no, 'md') + '<span class="have">×' + e.n + '</span>' + (e.c.auto ? '' : '<i class="st st-m">ทำเอง</i>') + '</button>'
      + '<span class="tn" title="' + esc(e.c.name) + '">' + esc(e.c.name) + '</span>'
      + '<span class="qty"><button type="button" class="mini" data-sub="1" aria-label="ลด 1 ใบ">−</button><button type="button" class="mini pri" data-add="main"' + (copies(nameOf(e.c)) >= (e.c.lim || 4) ? ' disabled' : '') + ' aria-label="เพิ่ม 1 ใบ">+</button></span></div>';
    h += '</div>';
  }
  if (B.gz.size) {   // G zone (G deck): up to 16 G units
    const gents = [...B.gz].map(([no, n]) => ({ no, n, c: VG.card(no) }));
    h += '<div class="bd-group"><span>' + ([...B.gz.keys()].some(no => VG.card(no) && VG.card(no).special) ? 'ท่าพิเศษ (SPECIAL MOVE)' : 'G ZONE') + '</span><span>' + gTotal() + '/16 ใบ</span></div><div class="dgrid">';
    for (const e of gents) h += '<div class="drowb" data-no="' + esc(e.no) + '"><button type="button" class="cthb" data-det="1" aria-label="อ่านการ์ด ' + esc(e.c.name) + '">' + thumb(e.no, 'md') + '<span class="have">×' + e.n + '</span></button><span class="tn" title="' + esc(e.c.name) + '">' + esc(e.c.name) + '</span><span class="qty"><button type="button" class="mini" data-sub="1" aria-label="ลด 1 ใบ">−</button><button type="button" class="mini pri" data-add="g"' + (copies(nameOf(e.c)) >= (e.c.lim || 4) || gTotal() >= 16 ? ' disabled' : '') + ' aria-label="เพิ่ม 1 ใบ">+</button></span></div>';
    h += '</div>';
  }
  $('#bdMain').innerHTML = h || '<p class="note">ยังไม่มีการ์ด กด + ที่การ์ดทางซ้ายเพื่อเพิ่ม</p>';
  $('#bdTabs').querySelector('[data-tab="deck"]').textContent = 'เด็คของฉัน (' + k.main + '/50)';
}
function change(fn) { fn(); B.dirty = true; B.armBack = false; status(''); if (!B.nation) { B.nation = VG.deckNation(deckObj()); if (B.nation) $('#bdNation').value = B.nation; } renderList(); renderDeck(); }
function act(no, el) {
  const r = row(no); if (!r) return;
  if (el.dataset.add === 'main') return change(() => { if (copies(r.as || r.name) < r.lim) B.main.set(r.no, (B.main.get(r.no) || 0) + 1); });
  if (el.dataset.add === 'g') return change(() => { if (copies(r.as || r.name) < r.lim && gTotal() < 16) B.gz.set(r.no, (B.gz.get(r.no) || 0) + 1); });
  if (el.dataset.sub && isG(r)) return change(() => { const n = (B.gz.get(r.no) || 0) - 1; if (n > 0) B.gz.set(r.no, n); else B.gz.delete(r.no); });
  if (el.dataset.sub) return change(() => { const n = (B.main.get(r.no) || 0) - 1; if (n > 0) B.main.set(r.no, n); else B.main.delete(r.no); });
  if (el.dataset.add === 'ride') return change(() => {
    const rd = VG.card(r.no) && VG.card(r.no).rideDeckOK; B.ride = B.ride.filter(x => { const c = VG.card(x); return rd ? x !== r.no : r.t === 'C' ? c.type !== 'crest' : !(c.type === 'unit' && c.grade === r.grade); });
    B.ride.push(r.no);
  });
}
function wire() {
  $('#bdList').addEventListener('click', e => {
    if (e.target.closest('#bdMore')) { B.limit += 60; return renderList(); }
    if (e.target.closest('a')) return;
    const rw = e.target.closest('.crow'); if (!rw) return;
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.det) return readCard(rw.dataset.no);
    act(rw.dataset.no, b);
  });
  $('#bdMain').addEventListener('click', e => { const b = e.target.closest('button'); const rw = e.target.closest('.drowb'); if (b && rw && !b.disabled) { if (b.dataset.det) return readCard(rw.dataset.no); act(rw.dataset.no, b); } });
  $('#bdRide').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.det) { const rs = b.closest('.rslot'); if (rs && rs.dataset.no) readCard(rs.dataset.no); return; }
    if (b.dataset.unride) change(() => { B.ride = B.ride.filter(x => x !== b.dataset.unride); });
    else if (b.dataset.crest) change(() => { B.ride = B.ride.filter(x => VG.card(x).type !== 'crest').concat(defaultCrest()); });
  });
  let t = null;
  $('#bdQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { B.q = e.target.value; B.limit = 60; renderList(); }, 120); });
  $('#bdNation').addEventListener('change', e => { B.nation = e.target.value; B.limit = 60; renderList(); });
  $('#bdAuto').addEventListener('change', e => { B.auto = e.target.checked; B.limit = 60; renderList(); });
  $('#bdGrade').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { B.grade = b.dataset.v; B.limit = 60; chips(); renderList(); } });
  { const el = $('#bdIcon'); if (el) el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { B.icon = b.dataset.v; B.limit = 60; chips(); renderList(); } }); }
  $('#bdType').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { B.type = b.dataset.v; B.limit = 60; chips(); renderList(); } });
  $('#bdName').addEventListener('input', () => { B.dirty = true; });
  $('#bdTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#bdGrid').dataset.tab = b.dataset.tab; $('#bdTabs').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('#bdSave').addEventListener('click', () => {
    const d = deckObj(); const r = VG.inspectDeck(d);
    U.My.save(d); B.existing = true; B.dirty = false; $('#bdDelete').hidden = false;
    U.S.decks[B.slot] = d.id; U.store.set('vg.decks', U.S.decks);
    status('บันทึก "' + d.name + '" แล้ว' + (U.Net.ready ? ' (เก็บกับบัญชีของคุณ)' : ' (เก็บในเบราว์เซอร์นี้)') + (r.errors.length ? ' · ยังไม่ผ่านกฎ ' + r.errors.length + ' ข้อ' : '') + (r.playable ? '' : ' · ยังเล่นไม่ได้จนกว่าจะมีเกรด 0 ในไรด์เด็คและเมนเด็ค 20 ใบขึ้นไป'), !r.playable);
  });
  $('#bdBack').addEventListener('click', () => { if (B.dirty && !B.armBack) { B.armBack = true; return status('มีการแก้ไขที่ยังไม่บันทึก กด "กลับ" อีกครั้งเพื่อทิ้งการแก้ไข หรือกด "บันทึก"', true); } close(); });
  $('#bdDelete').addEventListener('click', () => { if (!B.armDel) { B.armDel = true; $('#bdDelete').textContent = 'กดอีกครั้งเพื่อลบ'; return; } U.My.remove(B.id); close(); });
}
/* ---- my decks: every deck you made, with edit / copy / delete / use buttons ---- */
const Decks = {
  q: '', armDel: null,
  open() { $('#lobby').hidden = true; $('#builder').hidden = true; $('#mydecks').hidden = false; this.armDel = null; window.scrollTo(0, 0); this.render(); },
  close() { $('#mydecks').hidden = true; $('#lobby').hidden = false; U.renderLobby(); window.scrollTo(0, 0); },
  mine() { return Object.values(VG.DECKS).filter(d => d.custom).sort((a, b) => (b.t || 0) - (a.t || 0)); },
  face(d) { const ride = (d.ride || []).map(no => VG.card(no)).filter(c => c && c.type === 'unit'); ride.sort((a, b) => (b.grade || 0) - (a.grade || 0)); const top = ride.slice(0, 3).map(c => c.no); const ord = top.length === 3 ? [top[1], top[0], top[2]] : top; return ord.map((no, i) => '<span class="dkf' + (no === top[0] ? ' lead' : '') + '" style="--k:' + (ord.length === 3 ? i - 1 : i) + '">' + U.staticCard(no, true) + '</span>').join(''); },
  tile(d) {
    const r = VG.inspectDeck(d); const k = r.counts || {}; const nat = VG.deckNation(d) || 'หลายเนชั่น';
    const cards = [...(d.ride || []), ...d.main.flatMap(e => Array(e.n).fill(e.no))]; const auto = cards.filter(no => { const c = VG.card(no); return c && c.auto; }).length; const pc = cards.length ? Math.round(auto * 100 / cards.length) : 0;
    const when = d.t ? new Date(d.t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
    const slotOf = i => U.S.decks[i] === d.id;
    const ok = !r.errors.length;
    return '<article class="dkt' + (ok ? '' : ' bad') + '" data-id="' + esc(d.id) + '">'
      + '<div class="dkt-fan" aria-hidden="true">' + this.face(d) + '</div>'
      + '<div class="dkt-body"><h3>' + esc(d.name) + '</h3>'
      + '<p class="dkt-meta">' + esc(nat) + ' · เมน ' + (k.main || 0) + ' · ทริกเกอร์ ' + (k.trig || 0) + (when ? ' · แก้ล่าสุด ' + esc(when) : '') + '</p>'
      + '<p class="dkt-st"><b class="' + (ok ? 'ok' : 'warn') + '">' + (ok ? 'ผ่านกติกา' : 'ยังไม่ครบ ' + r.errors.length + ' ข้อ') + '</b><b class="auto">ออโต้ ' + pc + '%</b>' + (slotOf(0) ? '<b class="use">ใช้อยู่ P1</b>' : '') + (slotOf(1) ? '<b class="use">ใช้อยู่ P2</b>' : '') + '</p>'
      + (ok ? '' : '<p class="dkt-err">' + esc(r.errors[0]) + '</p>')
      + '<div class="dkt-acts"><button type="button" class="go sm" data-dk="edit">แก้ไข</button><button type="button" class="ghost" data-dk="p1">ใช้เป็น P1</button><button type="button" class="ghost" data-dk="p2">ใช้เป็น P2</button><button type="button" class="ghost" data-dk="copy">ทำสำเนา</button><button type="button" class="ghost danger" data-dk="del">' + (this.armDel === d.id ? 'กดอีกครั้งเพื่อลบ' : 'ลบ') + '</button></div></div></article>';
  },
  render() {
    const all = this.mine(); const q = this.q.trim().toLowerCase(); const L = q ? all.filter(d => d.name.toLowerCase().includes(q) || (VG.deckNation(d) || '').toLowerCase().includes(q)) : all;
    $('#dkCount').textContent = all.length + ' เด็ค';
    $('#dkGrid').innerHTML = L.length ? L.map(d => this.tile(d)).join('') : '<div class="dk-empty"><b>' + (all.length ? 'ไม่พบเด็คที่ค้นหา' : 'ยังไม่มีเด็คของคุณ') + '</b><p>' + (all.length ? 'ลองคำอื่น หรือลบคำค้นหา' : 'กด "+ จัดเด็คใหม่" เพื่อเลือกการ์ดเอง หรือคัดลอกเด็คพร้อมเล่นด้านล่างไปแก้') + '</p></div>';
    const built = Object.values(VG.DECKS).filter(d => !d.custom);
    $('#dkBuilt').innerHTML = built.map(d => '<button type="button" class="ghost" data-copy="' + esc(d.id) + '">' + esc(d.name) + '</button>').join('');
  },
  status(t) { $('#dkStatus').textContent = t || ''; },
  act(id, a) {
    const d = VG.DECKS[id]; if (!d) return;
    if (a !== 'del') this.armDel = null;
    if (a === 'edit') return open(id, U.S.decks[1] === id ? 1 : 0, 'decks');
    if (a === 'p1' || a === 'p2') { U.S.decks[a === 'p1' ? 0 : 1] = id; U.store.set('vg.decks', U.S.decks); this.status('ตั้ง "' + d.name + '" เป็นเด็ค' + (a === 'p1' ? 'ฝั่งคุณ (P1)' : 'อีกฝั่ง (P2)') + 'แล้ว'); return this.render(); }
    if (a === 'copy') return this.copy(d);
    if (a === 'del') { if (this.armDel !== id) { this.armDel = id; return this.render(); } this.armDel = null; U.My.remove(id); for (let i = 0; i < 2; i++) if (U.S.decks[i] === id) U.S.decks[i] = i ? 'TD01' : '1MCW2'; U.store.set('vg.decks', U.S.decks); this.status('ลบ "' + d.name + '" แล้ว'); return this.render(); }
  },
  copy(d) { const n = { id: 'my' + Date.now().toString(36), name: (d.name + (d.custom ? ' (สำเนา)' : ' (ของฉัน)')).slice(0, 40), ride: d.ride.map(VG.canon), main: d.main.map(e => ({ no: VG.canon(e.no), n: e.n })), g: (d.g || []).map(e => ({ no: VG.canon(e.no), n: e.n || 1 })) }; U.My.save(n); this.status('สร้าง "' + n.name + '" แล้ว'); this.render(); },
  wire() {
    $('#dkBack').addEventListener('click', () => this.close());
    $('#dkNew').addEventListener('click', () => open(null, 0, 'decks'));
    $('#dkQ').addEventListener('input', e => { this.q = e.target.value; this.render(); });
    $('#dkGrid').addEventListener('click', e => { const b = e.target.closest('[data-dk]'); if (b) return this.act(b.closest('.dkt').dataset.id, b.dataset.dk); const f = e.target.closest('.dkt-fan'); if (f) this.act(f.closest('.dkt').dataset.id, 'edit'); });
    $('#dkBuilt').addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b) this.copy(VG.DECKS[b.dataset.copy]); });
  },
};
wire(); Decks.wire();
window.VGBuilder = { open, close, B, refreshThumbs, Decks };
})();
