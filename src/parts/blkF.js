/* ================= own card images (kept in this browser only; nothing is uploaded) ================= */
const idb = {
  open() { return new Promise((res, rej) => { try { const r = indexedDB.open('vgimg', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async all() { const db = await this.open(); return new Promise((res, rej) => { const out = {}; const rq = db.transaction('img').objectStore('img').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; rq.onerror = () => rej(rq.error); }); },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('img', 'readwrite'); tx.objectStore('img').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async clear() { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('img', 'readwrite'); tx.objectStore('img').clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
};
let KNOWN = null;
function knownKeys() {
  if (KNOWN) return KNOWN; KNOWN = new Set();
  for (const r of VG.DB.rows) { for (const n of [r.no, ...r.nos]) { const k = imgKey(n); KNOWN.add(k); KNOWN.add(k.replace(/en$/, '')); } KNOWN.add(imgKey(r.name)); }
  return KNOWN;
}
function imgStatus(msg) {
  const keys = Object.keys(IMG); const known = knownKeys();
  $('#imgStat').textContent = msg || (keys.length ? 'มีรูป ' + keys.length + ' ไฟล์ · จับคู่กับการ์ดได้ ' + keys.filter(k => known.has(k)).length + ' ใบ' : 'ยังไม่มีรูป');
  $('#imgClear').hidden = !keys.length;
}
/* faces already on screen are redrawn so new pictures show at once */
function refreshFaces() {
  if (S.snap) for (const iid in S.els) { const c = S.snap.cards[iid]; if (c) S.els[iid].firstChild.innerHTML = '<div class="cb"></div>' + faceHTML(C[c.no]); }
  if (S.viewDeck && !$('#picker').hidden && !S.picker) deckViewer(S.viewDeck.id, S.viewDeck.tab);
  if ($('#detail').dataset.no && S.snap) showDetail($('#detail').dataset.no);
}
async function loadImages() { try { const all = await idb.all(); for (const k in all) { IMG[k] = URL.createObjectURL(all[k]); IMGN++; } } catch (e) { /* no local image store */ } imgStatus(); if (IMGN) refreshFaces(); }
/* pictures are scaled down to card size before they are stored, so a whole folder stays small */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file); const k = Math.min(1, 440 / bmp.width);
    if (k >= 1 && file.size < 160000) return file;
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(b => r(b || file), 'image/webp', 0.86));
  } catch (e) { return file; }
}
async function addImages(files) {
  const list = [...files].filter(f => /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name)); if (!list.length) { imgStatus('ไม่พบไฟล์รูป (.png .jpg .webp)'); return; }
  const known = knownKeys(); let n = 0, hit = 0;
  for (const f of list) {
    let k = imgKey(f.name); if (!known.has(k) && known.has(k.replace(/en$/, ''))) k = k.replace(/en$/, '');
    if (known.has(k)) hit++;
    const blob = await shrink(f);
    if (!IMG[k]) IMGN++; else URL.revokeObjectURL(IMG[k]);
    IMG[k] = URL.createObjectURL(blob);
    try { await idb.put(k, blob); } catch (e) { /* kept for this visit only */ }
    if (++n % 12 === 0) imgStatus('กำลังนำเข้า ' + n + ' / ' + list.length + ' ไฟล์…');
  }
  imgStatus(); refreshFaces();
  if (!hit) imgStatus('นำเข้า ' + n + ' ไฟล์ แต่ชื่อไฟล์ยังไม่ตรงกับการ์ดใบไหน — ดูชื่อไฟล์ที่ต้องใช้ได้ที่ปุ่ม "ดูการ์ด" → แท็บรูปการ์ด');
}
async function clearImages() { for (const k of Object.keys(IMG)) { URL.revokeObjectURL(IMG[k]); delete IMG[k]; } IMGN = 0; try { await idb.clear(); } catch (e) { /* nothing stored */ } imgStatus(); refreshFaces(); }
