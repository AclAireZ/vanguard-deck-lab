function officialLink(c, label) { return '<a href="' + OFFICIAL + encodeURIComponent(c.official || c.no).replace(/%2F/g, '/') + '" target="_blank" rel="noopener">' + label + ' ↗</a>'; }
function cardNote(c) {
  const t = (c.text || []).map(x => '<p>' + fmtText(x) + '</p>').join('');
  if (!c.auto) return t + '<p class="manual">สกิลของใบนี้ยังไม่ทำงานอัตโนมัติ ในเกมจะใช้ได้เฉพาะค่าพลัง ชิลด์ และไอคอนบนการ์ด · ' + officialLink(c, 'อ่านข้อความการ์ดบนเว็บทางการ') + '</p>';
  if (c.beta) return t + '<p class="betan">ออโต้ β — ระบบอ่านสกิลใบนี้จากข้อความการ์ดเอง ยังไม่ได้ตรวจด้วยมือ ถ้าทำงานไม่ตรงกับการ์ดจริงให้บอก Claude · ' + officialLink(c, 'ข้อความการ์ดทางการ') + '</p>';
  return t;
}
function tagOf(c) { return c.auto ? (c.beta ? ' <span class="tagb">ออโต้ β</span>' : '') : ' <span class="tagm">ยังไม่ออโต้</span>'; }
/* file name the official site uses for a card's picture, e.g. D-BT04/048EN → dbt04_048 */
function fileHint(c) { return String(c.official || c.no).toLowerCase().replace(/-/g, '').replace(/\//g, '_').replace(/en(-[a-z0-9]+)?$/, '$1'); }
function deckViewer(id, tab) {
  const d = VG.DECKS[id]; if (!d) return; const errs = VG.checkDeck(d); S.viewDeck = { id, tab: tab || 'cards' };
  const all = d.ride.map(no => [no, 1]).concat(d.main.map(e => [e.no, e.n]));
  const uniq = []; const seen = {}; for (const [no] of all) { const k = C[no].name; if (!seen[k]) { seen[k] = 1; uniq.push(no); } }
  const have = uniq.filter(no => imgFor(C[no])).length;
  let body;
  if (tab === 'img') {
    body = '<p class="note">เกมนี้ไม่ได้ฝังรูปการ์ดจริงไว้ (ลิขสิทธิ์ของ Bushiroad) แต่ใช้รูปที่คุณมีในเครื่องได้: เปิดหน้าการ์ดทางการจากลิงก์ด้านล่าง บันทึกรูปลงเครื่อง แล้วกดเลือกไฟล์หรือเลือกทั้งโฟลเดอร์ ระบบจับคู่จาก<b>ชื่อไฟล์</b> (เลขการ์ดตามที่เว็บทางการตั้งให้ หรือชื่อการ์ด) รูปเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น</p>'
      + '<div class="row"><label class="btn pri" for="imgIn">เลือกไฟล์รูป…</label><label class="btn" for="imgDir">เลือกทั้งโฟลเดอร์…</label><span class="note">มีรูปแล้ว <b>' + have + '</b> / ' + uniq.length + ' ชนิดในเด็คนี้</span></div>'
      + '<div class="ilist">' + uniq.map(no => { const c = C[no]; const ok = !!imgFor(c); return '<div class="irow' + (ok ? ' ok' : '') + '"><div class="ith">' + staticCard(no, true) + '</div><div><div class="nm">' + esc(c.name) + '</div><div class="mt">' + (ok ? '✓ มีรูปแล้ว' : 'ยังไม่มีรูป · ตั้งชื่อไฟล์ว่า <b>' + esc(fileHint(c)) + '</b> (.png .jpg .webp)') + '</div><div class="mt">' + officialLink(c, 'เปิดหน้าการ์ดทางการเพื่อบันทึกรูป') + '</div></div></div>'; }).join('') + '</div>';
  } else {
    const row = (no, n) => { const c = C[no]; return '<div class="drow"><span class="q">' + n + '×</span><div><div class="nm">' + esc(c.name) + tagOf(c) + '</div><div class="mt">' + statLine(c) + ' · ' + esc(no) + '</div>' + cardNote(c) + '</div></div>'; };
    const groups = [['ไรด์เด็ค', d.ride.map(no => [no, 1])]];
    const main = d.main.map(e => [e.no, e.n]);
    for (const g of [4, 3, 2, 1, 0]) groups.push(['เกรด ' + g, main.filter(([no]) => C[no].type === 'unit' && !C[no].trigger && C[no].grade === g)]);
    groups.push(['ทริกเกอร์', main.filter(([no]) => C[no].trigger)]);
    groups.push(['ออเดอร์', main.filter(([no]) => C[no].type === 'order')]);
    body = '<div class="dlist">' + groups.filter(g => g[1].length).map(g => '<h3>' + g[0] + '</h3>' + g[1].map(([no, n]) => row(no, n)).join('')).join('') + '</div>';
  }
  const m = $('#picker');
  m.innerHTML = '<div class="mbox"><h2>' + esc(d.name) + '</h2><p class="msub">' + esc(d.source || '') + ' · ' + (errs.length ? esc(errs.join(' / ')) : 'ผ่านกฎสร้างเด็ค D Standard (50 ใบ ทริกเกอร์ 16)') + '</p>'
    + '<div class="mtabs"><button type="button" data-dv="cards" aria-pressed="' + (tab !== 'img') + '">การ์ดและสกิล</button><button type="button" data-dv="img" aria-pressed="' + (tab === 'img') + '">รูปการ์ด ' + have + '/' + uniq.length + '</button></div>'
    + '<div class="mscroll">' + body + '</div><div class="mfoot"><button type="button" class="btn pri" data-close="1">ปิด</button></div></div>';
  m.hidden = false; m.classList.remove('peek');
}
