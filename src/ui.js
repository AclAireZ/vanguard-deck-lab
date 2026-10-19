/* Table UI: renders engine snapshots, maps clicks to decision answers, plays events back with pacing. */
(function () {
'use strict';
const VG = window.VG;
const C = new Proxy({}, { get: (_, no) => VG.card(no) });
/* the name and number a card is shown with: Japanese when the card is in the Japanese pool */
const dn = d => (d ? d.name : '');                                               // shown name: English first; a card without an English name carries its Japanese name
const dj = d => (d && d.jname && d.jname !== d.name ? d.jname : '');               // the Japanese name, as a second line
const dno = d => (d ? d.jno || d.official || d.no : '');
const dshort = d => (d.jonly ? d.name.split(/[ \u3000]/).pop() : d.name.split(',').pop().trim());
const OFFICIAL = 'https://en.cf-vanguard.com/cardlist/?cardno=';
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
const NAT = { 'Lyrical Monasterio': 'lm', 'Dragon Empire': 'de', 'Dark States': 'ds', 'Brandt Gate': 'bg', 'Keter Sanctuary': 'ks', 'Stoicheia': 'st' };
const TRIG = { crit: 'CRITICAL', draw: 'DRAW', front: 'FRONT', heal: 'HEAL', over: 'OVER' };
const PHASES = [['stand', 'Stand'], ['draw', 'Draw'], ['ride', 'Ride'], ['main', 'Main'], ['battle', 'Battle'], ['end', 'End']];

/* Table geometry. The field is a flat board (board units, origin top-left of the board) tilted away from the viewer around its near edge;
   hand, trigger check and HUD stay in screen space. cx/hy: where the middle of the near edge sits on the stage, th: tilt, D/oy: camera distance and eye height. */
const LAY = {
  land: {
    W: 1600, H: 900, cx: 952, hy: 778, th: 40, D: 1500, oy: 120, BW: 1280, BH: 1000, cs: 1.06, cd: 152,
    circles: { V: [640, 664], FL: [468, 664], FR: [812, 664], BL: [468, 862], BC: [640, 862], BR: [812, 862], V2: [706, 610] },
    deck: [1004, 664, 0.84], drop: [1004, 862, 0.84], ride: [1150, 664, 0.74], removed: [1212, 872, 0.52], bind: [1134, 872, 0.52], gauge: [1216, 770, 0.5], prison: [1296, 872, 0.5], gzone: [1296, 770, 0.5], memory: [1136, 770, 0.5], mbox: [1056, 770, 0.5],
    order: { x: 206, y: 616, s: 0.62, step: 33 }, damage: { x: 272, y: 738, step: 40, s: 0.62 }, crest: [118, 620, 0.5],
    gc: { y: 500, s: 0.86, step: 104, w: 560, h: 132 },
    hand: { x: 952, y: 828, w: 600, s: 1.02, arc: 110 }, oppHand: { x: 952, y: 26, w: 360, s: 0.46 }, trigger: [1330, 356, 1.34],
    side: [8, 8, 296, 372], prompt: [8, 388, 296, 178], log: [8, 574, 296, 318], phase: [1592, 52], menu: [1592, 8],
    plate: [318, 792], oppPlate: [318, 6], cta: [1592, 892], cut: 400, clash: [1592, 284],
  },
  port: {
    W: 720, H: 1280, cx: 360, hy: 966, th: 24, D: 2100, oy: 250, BW: 700, BH: 830, cs: 0.9, cd: 124,
    circles: { V: [350, 546], FL: [216, 546], FR: [484, 546], BL: [216, 706], BC: [350, 706], BR: [484, 706], V2: [398, 506] },
    deck: [628, 546, 0.66], drop: [628, 690, 0.62], ride: [652, 792, 0.5], removed: [590, 796, 0.36], bind: [544, 796, 0.36], gauge: [498, 796, 0.36], prison: [452, 796, 0.36], gzone: [406, 796, 0.36], memory: [360, 796, 0.36], mbox: [314, 796, 0.36],
    order: { x: 38, y: 476, s: 0.36, step: 17 }, damage: { x: 72, y: 566, step: 30, s: 0.5 }, crest: [72, 796, 0.36],
    gc: { y: 415, s: 0.7, step: 80, w: 420, h: 104 },
    hand: { x: 372, y: 1084, w: 590, s: 0.96, arc: 36 }, oppHand: { x: 530, y: 190, w: 280, s: 0.4 }, trigger: [360, 560, 1.5],
    side: [8, 8, 704, 92], prompt: [8, 1160, 704, 114], log: null, phase: [8, 164, 'l'], menu: [712, 106],
    plate: [8, 968], oppPlate: [8, 106], cta: null, cut: 600,
  },
};

const S = {
  mode: 'solo', decks: ['1MCW2', 'TD01'], first: 'rand', speed: 1, lay: 'land', viewer: 0, seat: 0,
  game: null, cfg: null, meta: null, snap: null, pl: {}, busy: false, running: false, again: false,
  src: null, picks: new Set(), picker: null, sending: false, view: 'auto', els: {}, tags: {},
};
const IMG = {}; let IMGN = 0;

/* ================= card faces (original artwork: a colour field and an emblem per card; the owner's own image files replace it) ================= */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const SIGIL = {
  wing: 'M50 88C36 72 14 62 6 32c14 8 24 8 32 2-5-10-5-20 0-30 5 18 13 26 12 46 1-20 7-28 12-46 5 10 5 20 0 30 8 6 18 6 32-2-8 30-30 40-44 56z',
  flame: 'M50 94C30 94 18 80 18 64c0-15 11-23 16-36 3 11 7 15 13 17-2-15 3-28 13-39 0 17 22 28 22 55 0 19-13 33-32 33zm1-12c8 0 13-6 13-13 0-9-6-13-10-21-2 7-6 9-10 13-4 4-7 6-7 10 0 6 6 11 14 11z',
  gear: 'M43 4h14l3 13 8 4 12-7 9 9-7 12 4 8 13 3v14l-13 3-4 8 7 12-9 9-12-7-8 4-3 13H43l-3-13-8-4-12 7-9-9 7-12-4-8L1 57V43l13-3 4-8-7-12 9-9 12 7 8-4zm7 30a16 16 0 100 32 16 16 0 000-32z',
  leaf: 'M50 96C20 82 8 54 20 26 28 9 43 4 50 4s22 5 30 22c12 28 0 56-30 70zm-3-18h6V44l14-12-4-4-10 9V22h-6v22L36 34l-4 4 15 13z',
  star: 'M50 3l13 31 33 4-25 22 8 33-29-18-29 18 8-33L4 38l33-4z',
  blade: 'M50 2l11 56-11 15-11-15zM28 68h44v9H56v19H44V77H28z',
  crown: 'M10 72L5 28l25 21L50 12l20 37 25-21-5 44zM12 80h76v10H12z',
  eye: 'M2 50c15-23 31-34 48-34s33 11 48 34c-15 23-31 34-48 34S17 73 2 50zm48-19a19 19 0 100 38 19 19 0 000-38zm0 11a8 8 0 110 16 8 8 0 010-16z',
  note: 'M36 14l48-9v54a15 13 0 11-9-12V24l-30 6v40a15 13 0 11-9-12z',
  hex: 'M50 3l41 24v46L50 97 9 73V27zm0 17L24 35v30l26 15 26-15V35z',
  scroll: 'M22 8h52a12 12 0 0112 12v10H72v48a12 12 0 01-12 12H18A12 12 0 016 78v-8h16zm10 20v8h28v-8zm0 18v8h28v-8zm0 18v8h20v-8z',
  paw: 'M50 46c15 0 27 14 27 27 0 10-11 15-27 15s-27-5-27-15c0-13 12-27 27-27zM19 30a9 12 0 110 24 9 12 0 010-24zm62 0a9 12 0 110 24 9 12 0 010-24zM36 7a9 12 0 110 24 9 12 0 010-24zm28 0a9 12 0 110 24 9 12 0 010-24z',
};
function sigilOf(d) {
  if (d.type === 'order') return 'scroll'; if (d.type === 'crest') return 'crown'; if (d.type === 'token') return 'hex';
  const r = (d.race || '').toLowerCase();
  if (/dragon|dino|wyvern|drake/.test(r)) return 'flame'; if (/angel|sylph|bird|fairy|valkyrie|pegasus/.test(r)) return 'wing';
  if (/machine|battleroid|cyber|workeroid|robo|golem|android|alien/.test(r)) return 'gear'; if (/plant|bioroid|forest|dryad|insect|elf/.test(r)) return 'leaf';
  if (/beast|animal|cat|wolf|chimera|hyuman/.test(r)) return 'paw'; if (/ghost|demon|vampire|zombie|skeleton|shadow|succubus|abyss|gargoyle/.test(r)) return 'eye';
  if (/mermaid|idol|music|sound|talent/.test(r)) return 'note'; if (/knight|human|warrior|ninja|samurai|giant|gnome|ogre|rogue|man$/.test(r)) return 'blade';
  if (/noble|god|deity|royal|king/.test(r)) return 'crown';
  return ['star', 'hex', 'blade', 'wing'][hash(d.name) % 4];
}
function imgKey(s) { return String(s).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, ''); }
/* the owner's image for a card: matched by card number (any printing of the same card) or by card name */
function imgKeys(d) {
  const r = VG.DB.byNo[d.official || d.no] || VG.DB.byName[d.name]; const nos = [d.no]; if (d.official) nos.push(d.official); if (r) nos.push(r.no, ...r.nos);
  const out = []; if (d.jimg) out.push(imgKey(d.jimg.split('/').pop())); if (d.jno) out.push(imgKey(d.jno)); for (const n of nos) { const k = imgKey(n); out.push(k, k.replace(/en$/, '')); } out.push(imgKey(d.name));
  return [...new Set(out)];
}
function imgFor(d) { if (IMGN) for (const k of imgKeys(d)) if (IMG[k]) return IMG[k]; return autoImg(d); }
/* Local copy only (window.VG_LOCAL): a card's picture is looked for in the "cards" folder beside the game file, then on the official card list site.
   The game file itself holds no pictures; whatever is found is shown straight from where it lives. */
const LOCAL = window.VG_LOCAL || null; const AUTO = {}; const AQ = []; let aBusy = 0, aTimer = 0; const ASTAT = { folder: 0, jp: 0, web: 0, none: 0 };
function imgBase() { const b = store.get('vg.imgBase'); return typeof b === 'string' ? b : LOCAL.base; }
function webOn() { return store.get('vg.imgWeb') !== false; }
function jpOn() { return store.get('vg.imgJp') !== false; }
/* The Japanese card list keeps a picture at <SET CODE>/<file>.png, e.g. D-BT01/dbt01_001.png. The file name is the one the English list uses for the same card number.
   Only plain numbered cards of regular sets are mapped: promo numbers differ between the two lists, and a wrong picture is worse than none. */
/* Checked against the Japanese list on 2026-10-11 (one card per set, name and numbers compared): the main boosters (BT, LBT) and the sets named below use the same card numbers and file names on both lists.
   Others do NOT and are left to the English list: D-TB02 / D-TB03 / D-TB04 and the D-TTD decks carry different cards under the same number, and D-TD01 / DZ-SS02 name their picture files differently. */
const JP_OK = /^(?:dz?bt\d+|dz?lbt\d+|dss0[125]|dzss01|dsd01|dtb01|dztb0[12]|dztbp01)$/;
function jpPath(path) { const f = path.split('/').pop(); const m = /^((dz|d)(bt|lbt|tb|tbp|ss|sd)(\d+))_(\d+)$/.exec(f); return m && JP_OK.test(m[1]) ? m[2].toUpperCase() + '-' + m[3].toUpperCase() + m[4] + '/' + f : ''; }
function autoPath(d) {
  if (!LOCAL.byName) { LOCAL.byName = {}; LOCAL.byNo = {}; VG.DB.rows.forEach((r, i) => { if (!LOCAL.img[i]) return; if (!LOCAL.byName[r.name]) LOCAL.byName[r.name] = LOCAL.img[i]; LOCAL.byNo[r.no] = LOCAL.img[i]; }); }
  return LOCAL.byNo[d.official || d.no] || LOCAL.byName[d.name] || '';
}
/* Addresses that worked are remembered (this browser only), so the next visit shows pictures at once instead of asking the sites again card by card. */
let AMAP = null, aSave = 0; const AKEEP = {}; const ANO = {}; const AKEYS = new Set();
function amap() { if (!AMAP) { const m = store.get('vg.imgMap'); AMAP = m && typeof m === 'object' ? m : {}; } return AMAP; }
const autoKey = d => d.name + (d.jimg ? '|' + d.jimg : d.official ? '|' + d.official : '');   // a same-name remake (icon card) has its own picture
function autoImg(d) {
  if (!LOCAL || d.type === 'token') return null;
  const key = autoKey(d); if (AUTO[key] !== undefined) return AUTO[key] || null;
  ANO[key] = d.no;
  const path = autoPath(d); const safe = d.name.replace(/[\\/:*?"<>|]/g, '').trim(); const tries = [];
  // the official card lists come first; the "cards" folder is only a spare for cards the sites do not give
  if (d.jimg && jpOn() && LOCAL.jp) tries.push(['jp', LOCAL.jp + d.jimg + '.png']);   // the picture file named by the Japanese list for this very card
  else if (!VG.DB.jp && path && jpOn() && LOCAL.jp && jpPath(path)) tries.push(['jp', LOCAL.jp + jpPath(path) + '.png']);
  if (path && webOn() && imgBase()) tries.push(['web', imgBase() + path + '.png']);
  if (d.jimg) tries.push(['folder', 'cards/' + d.jimg.split('/').pop() + '.png']);
  if (path) tries.push(['folder', 'cards/' + path.split('/').pop() + '.png']);
  for (const e of ['png', 'jpg', 'webp']) tries.push(['folder', 'cards/' + encodeURIComponent(safe) + '.' + e]);
  const known = amap()[key];
  if (known && tries.some(t => t[1] === known)) {   // remembered from an earlier visit: use it now, and check quietly that it still loads
    AUTO[key] = known; const im = new Image(); im.referrerPolicy = 'no-referrer'; im.decoding = 'async'; AKEEP[key] = im;
    im.onerror = () => { delete amap()[key]; delete AUTO[key]; store.set('vg.imgMap', amap()); };
    im.src = known; return known;
  }
  AUTO[key] = '';
  AQ.push({ key, tries }); pumpAuto();
  return null;
}
function pumpAuto() {
  while (aBusy < 6 && AQ.length) {
    const job = AQ.shift(); aBusy++;
    const next = () => {
      const t = job.tries.shift();
      if (!t) { ASTAT.none++; aBusy--; autoDone(null); return; }
      const im = new Image(); im.referrerPolicy = 'no-referrer'; im.decoding = 'async';
      im.onload = () => {
        const fin = () => { AUTO[job.key] = t[1]; AKEEP[job.key] = im; ASTAT[t[0]]++; amap()[job.key] = t[1]; aBusy--; autoDone(job.key); };
        if (im.decode) im.decode().then(fin, fin); else fin();   // decoded before it is shown, so putting it on a card does not stall a frame
      };
      im.onerror = next; im.src = t[1];
    };
    next();
  }
}
/* a picture that has arrived replaces the drawn face of exactly the cards that show that card — nothing else is redrawn */
function autoDone(key) {
  pumpAuto(); if (key) AKEYS.add(key);
  clearTimeout(aTimer); aTimer = setTimeout(() => {
    for (const el of document.querySelectorAll('.cf[data-ck]')) { const k = el.dataset.ck; if (AKEYS.has(k) && AUTO[k] && ANO[k]) el.outerHTML = faceHTML(C[ANO[k]]); }
    AKEYS.clear(); imgStatus();
    clearTimeout(aSave); aSave = setTimeout(() => store.set('vg.imgMap', amap()), 1500);
  }, 90);
}
function autoReset() { for (const k in AUTO) delete AUTO[k]; AMAP = {}; store.set('vg.imgMap', {}); ASTAT.folder = ASTAT.jp = ASTAT.web = ASTAT.none = 0; refreshFaces(); imgStatus(); }
/* every card of both decks is asked for when a fight opens, so pictures are ready before the cards are first turned face up */
function autoWarm(g) { if (!LOCAL) return; const seen = new Set(); for (const k in g.cards) { const no = g.cards[k].no; if (!seen.has(no)) { seen.add(no); imgFor(C[no]); } } }

/* ---- card back ----
   The drawn back is the game's own. The owner can use a picture of their own instead: an imported file named "back", a file cards/back.png|jpg|webp beside the local copy,
   or (local copy) an image address typed into the settings. */
function setBack(url) { document.documentElement.style.setProperty('--cbimg', url ? 'url("' + String(url).replace(/["\\\n]/g, '') + '")' : 'none'); document.body.classList.toggle('has-back', !!url); }
function findBack() {
  if (IMG.back || IMG.cardback) return setBack(IMG.back || IMG.cardback);
  if (!LOCAL) return setBack('');
  const u = store.get('vg.backUrl'); const tries = (typeof u === 'string' && /^https?:\/\//.test(u) ? [u] : []).concat(['cards/back.png', 'cards/back.jpg', 'cards/back.webp']);
  const next = () => { const t = tries.shift(); if (!t) return setBack(''); const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => setBack(t); im.onerror = next; im.src = t; };
  next();
}

function fmtK(n) { return n >= 100000000 ? Math.round(n / 1000000) + 'M' : String(n); }
function faceHTML(d) {
  const nk = NAT[d.nation] || 'none'; const url = imgFor(d);
  const hs = hash(d.name); const hue = hs % 360; const ang = (hs >>> 9) % 360; const px = 28 + (hs >>> 18) % 44;
  const unit = d.type === 'unit' || d.type === 'token';
  const kw = unit ? (d.drive === 3 ? 'TRIPLE' : d.drive === 2 ? 'TWIN' : d.intercept ? 'INTERCEPT' : d.boost ? 'BOOST' : '') : d.type === 'order' ? (d.orderKind === 'set' ? 'SET ORDER' : d.orderKind === 'blitz' ? 'BLITZ' : 'ORDER') : d.type === 'crest' ? 'CREST' : '';
  const stats = unit ? '<b class="cf-p">' + fmtK(d.power) + '</b>' + (d.shield != null ? '<b class="cf-s">' + fmtK(d.shield) + '</b>' : '') : '';
  if (url) return '<div class="cf has-img n-' + nk + '"><img class="cf-img" src="' + url + '" alt="" draggable="false" decoding="async" referrerpolicy="no-referrer"></div>';
  return '<div class="cf n-' + nk + (d.trigger ? ' trg t-' + d.trigger : '') + (d.type === 'order' ? ' ord' : '') + '"' + (LOCAL ? ' data-ck="' + esc(autoKey(d)) + '"' : '') + ' style="--h:' + hue + ';--a:' + ang + 'deg;--px:' + px + '%">'
    + '<div class="cf-art"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + SIGIL[sigilOf(d)] + '"/></svg></div>'
    + '<span class="cf-g">' + (d.grade == null ? '◆' : d.grade) + '</span>'
    + '<span class="cf-ks">' + (kw ? '<i>' + kw + '</i>' : '') + (d.persona ? '<i class="pr">PERSONA</i>' : '') + (d.sentinel ? '<i class="sn">SENTINEL</i>' : '') + '</span>'
    + (d.trigger ? '<b class="cf-t">' + TRIG[d.trigger] + '</b>' : '')
    + '<div class="cf-b"><span class="cf-n">' + esc(dn(d)) + '</span><span class="cf-st">' + (stats || '<em>' + esc(kw) + '</em>') + '</span></div></div>';
}
function staticCard(no, up, cls) { return '<div class="card nomove ' + (up === false ? '' : 'up ') + (cls || '') + '"><div class="in"><div class="cb"></div>' + faceHTML(C[no]) + '</div></div>'; }

/* ================= lobby ================= */
function deckMeta(id) {
  const d = VG.DECKS[id]; const r = VG.inspectDeck(d); const k = r.counts;
  return '<i>' + esc(r.nation || 'ยังไม่มีการ์ด') + '</i><i>เมน ' + k.main + ' · ทริกเกอร์ ' + k.trig + (k.order ? ' · ออเดอร์ ' + k.order : '') + '</i><i>' + esc(d.source || '') + '</i>'
    + (r.manual.length ? '<i class="warn">สกิลยังไม่ออโต้ ' + r.manual.length + ' ชนิด</i>' : '<i class="ok">สกิลออโต้ครบ</i>') + (betaCount(d) ? '<i class="beta">ออโต้ β ' + betaCount(d) + ' ชนิด</i>' : '') + (betaCount(d, 1) ? '<i class="warn">กึ่งออโต้/บางส่วน ' + betaCount(d, 1) + ' ชนิด</i>' : '') + (r.errors.length ? '<i class="warn">ไม่ผ่านกฎ ' + r.errors.length + ' ข้อ</i>' : '');
}
function betaCount(d, part) { const s = new Set(); for (const no of d.ride.concat(d.main.map(e => e.no))) { const c = C[no]; if (c && c.beta && !!c.partial === !!part) s.add(c.name); } return s.size; }
function deckFan(id) {
  const d = VG.DECKS[id]; const seen = new Set(); const pick = [];
  const cand = d.ride.slice().sort((a, b) => ((C[b] || {}).grade || 0) - ((C[a] || {}).grade || 0)).concat(d.main.slice().sort((a, b) => ((C[b.no] || {}).grade || 0) - ((C[a.no] || {}).grade || 0)).map(e => e.no));
  for (const no of cand) { const c = VG.card(no); if (!c || seen.has(c.name)) continue; seen.add(c.name); pick.push(no); if (pick.length === 3) break; }
  if (!pick.length) return '';
  const order = pick.length === 3 ? [[pick[1], -1, ''], [pick[2], 1, ''], [pick[0], 0, ' mid']] : pick.map((no, i) => [no, i ? 1 : 0, i ? '' : ' mid']);
  return order.map(([no, k, cls]) => '<div class="fc' + cls + '" style="--k:' + k + '">' + staticCard(no, true) + '</div>').join('');
}
function deckOptions(sel) {
  const ids = Object.keys(VG.DECKS); const mine = ids.filter(id => VG.DECKS[id].custom).sort((a, b) => (VG.DECKS[b].t || 0) - (VG.DECKS[a].t || 0)); const built = ids.filter(id => !VG.DECKS[id].custom);
  const opt = id => '<option value="' + esc(id) + '"' + (sel === id ? ' selected' : '') + '>' + esc(VG.DECKS[id].name) + '</option>';
  return (mine.length ? '<optgroup label="เด็คของฉัน">' + mine.map(opt).join('') + '</optgroup>' : '') + '<optgroup label="เด็คพร้อมเล่น">' + built.map(opt).join('') + '</optgroup>';
}
function renderLobby() {
  const online = S.mode === 'online';
  for (let i = 0; i < 2; i++) if (!VG.DECKS[S.decks[i]]) S.decks[i] = i ? 'TD01' : '1MCW2';
  document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('#firstChips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.first === String(S.first))));
  const labels = online ? ['เด็คของคุณ'] : S.mode === 'bot' ? ['เด็คของคุณ', 'เด็คของบอท'] : ['ฝั่งคุณ (P1)', 'อีกฝั่ง (P2)'];
  const tags = online ? ['YOU'] : S.mode === 'bot' ? ['PLAYER', 'CPU'] : ['PLAYER 1', 'PLAYER 2'];
  $('#slots').className = labels.length === 1 ? 'one' : '';
  $('#slots').innerHTML = labels.map((lb, i) => '<div class="dk p' + i + '"><div class="dk-tag"><span>' + tags[i] + '</span><i>' + lb + '</i></div><div class="dk-fan" aria-hidden="true">' + deckFan(S.decks[i]) + '</div>'
    + '<div class="dk-name">' + esc(VG.DECKS[S.decks[i]].name) + '</div><select id="deckSel' + i + '" aria-label="' + lb + '">' + deckOptions(S.decks[i])
    + '</select><div class="acts"><button type="button" class="ghost" data-view="' + i + '">ดูการ์ด</button><button type="button" class="ghost" data-edit="' + i + '">' + (VG.DECKS[S.decks[i]].custom ? 'แก้ไข' : 'คัดลอกไปแก้') + '</button></div><div class="meta">' + deckMeta(S.decks[i]) + '</div></div>').join(labels.length > 1 ? '<div class="vs" aria-hidden="true"><b>VS</b></div>' : '');
  if (S.lbSwap) { const w = S.lbSwap; S.lbSwap = 0; document.querySelectorAll('#slots .dk').forEach((el, i) => { if (w === true || w === i + 1) el.classList.add('sw'); }); }
  $('#stageMode').textContent = { solo: 'SOLO FIGHT', bot: 'VS CPU', online: 'LINK FIGHT' }[S.mode] || '';
  { const l = store.get('vg.lastRoom'); const ok = online && l && l.code && Date.now() - (l.t || 0) < 12 * 3600e3; $('#rejoinBtn').hidden = !ok; if (ok) $('#rejoinBtn').textContent = 'กลับเข้าห้องล่าสุด ' + l.code.toUpperCase(); }
  if (LOCAL) { if (online) Rooms.start(); else Rooms.stop(); const l = store.get('vg.qlLast'); const ok = online && l && /^[A-Z2-9]{6}$/.test(l.code || '') && Date.now() - (l.t || 0) < 12 * 3600e3; $('#qlBack').hidden = !ok; if (ok) $('#qlBack').textContent = 'กลับเข้าห้องล่าสุด ' + l.code; }
  $('#firstSec').hidden = online; $('#onlineSec').hidden = !online; $('#p2pSec').hidden = !online; $('#goRow').hidden = online;
  const sv = store.get('vg.save');
  $('#resumeBtn').hidden = !(sv && VG.DECKS[sv.decks[0]] && VG.DECKS[sv.decks[1]] && sv.history && sv.history.length);
  const bad = labels.map((_, i) => VG.inspectDeck(VG.DECKS[S.decks[i]])).some(r => !r.playable);
  $('#goBtn').disabled = bad; $('#createBtn').disabled = bad; $('#joinBtn').disabled = bad;
  $('#goNote').textContent = bad ? 'เด็คที่เลือกยังเล่นไม่ได้: ต้องมีเกรด 0 ในไรด์เด็ค และเมนเด็คอย่างน้อย 20 ใบ' : '';
  { const R = VG.DB.jp ? VG.DB.rows.filter(r => r.jno) : VG.DB.rows; const full = R.filter(r => r.auto && !r.part).length, semi = R.filter(r => r.semi).length, part = R.filter(r => r.part && !r.semi).length; const n = x => x.toLocaleString('en-US'); const pc = x => ' (' + Math.round(x / VG.DB.count * 100) + '%)'; $('#dbStat').textContent = VG.DB.count ? (VG.DB.jp ? 'การ์ดชุดญี่ปุ่น ' : 'การ์ด ') + n(VG.DB.count) + ' ใบ · ออโต้ครบ ' + n(full) + pc(full) + ' · กึ่งออโต้ ' + n(semi) + pc(semi) + ' · ออโต้บางส่วน ' + n(part) + pc(part) : ''; }
  if (online && !LOCAL) Net.init().then(ok => { if (!ok) setStatus('โหมดออนไลน์ใช้ได้เมื่อเปิดหน้านี้ใน Claude ขณะลงชื่อเข้าใช้ และมีสิทธิ์แก้ไขหน้านี้', true); });
}
function myName() { if (typeof Acct !== 'undefined' && Acct.me && Acct.me.name) return Acct.me.name; const n = store.get('vg.name'); return typeof n === 'string' ? n.trim().slice(0, 16) : ''; }
function setStatus(t, err) { const el = $('#onStatus'); el.textContent = t || ''; el.classList.toggle('err', !!err); }
function officialLink(c, label) { return '<a href="' + (c.jno ? 'https://cf-vanguard.com/cardlist/?cardno=' + encodeURIComponent(c.jno).replace(/%2F/g, '/') : OFFICIAL + encodeURIComponent(c.official || c.no).replace(/%2F/g, '/')) + '" target="_blank" rel="noopener">' + label + ' ↗</a>'; }
function cardNote(c) {
  const t = (c.text || []).map(x => '<p>' + fmtText(x) + '</p>').join('');
  // a short summary written by hand for cards the game cannot run by itself yet, and a note when the English name is our own translation
  const sum = c.sum && (!c.auto || c.partial) ? '<div class="sumbox"><b>สรุปสกิล (สรุปความเอง ไม่ใช่ข้อความทางการ)</b>' + c.sum.map(x => '<p>' + fmtText(x) + '</p>').join('') + '</div>' : '';
  const un = c.unofficial ? '<p class="betan">ชื่ออังกฤษของใบนี้เป็นคำแปลไม่เป็นทางการ (ยังไม่มีชื่อทางการ)</p>' : '';
  const src = cardLinks(c); const wb = wikiBox(c); if (wb) pumpWiki();
  if (!c.auto) return t + sum + wb + '<p class="manual">สกิลของใบนี้ยังไม่ทำงานอัตโนมัติ (ค่าพลัง ชิลด์ และไอคอนบนการ์ดใช้ได้ตามปกติ) — ระหว่างเล่นให้กดปุ่ม <b>✋ ทำเอง</b> แล้วทำตามข้อความการ์ดด้วยมือ · ' + src + '</p>' + un;
  if (c.semi) return t + sum + wb + '<p class="manual semi">กึ่งออโต้ — สกิล ' + c.miss + ' ข้อของใบนี้ เกมรู้จังหวะ ตรวจเงื่อนไขที่อ่านออก และหักคอสต์ให้ แล้วจะหยุดรอให้คุณทำ<b>เอฟเฟกต์</b>เองด้วยปุ่ม <b>✋ ทำเอง</b> ตามข้อความการ์ด (กด "เสร็จแล้ว" เมื่อทำครบ) · ' + src + '</p>' + un;
  if (c.partial) return t + sum + wb + '<p class="manual">ออโต้บางส่วน — ยังมีสกิลของใบนี้อีก ' + c.miss + ' ข้อที่ไม่ทำงานอัตโนมัติเต็มรูปแบบ' + (c.asst ? ' (ในนั้น ' + c.asst + ' ข้อเป็นกึ่งออโต้: เกมเตือนจังหวะและหักคอสต์ให้ เอฟเฟกต์ทำเอง)' : '') + ' ข้อที่เหลือทำเองได้ด้วยปุ่ม <b>✋ ทำเอง</b> · ' + src + '</p>' + un;
  if (c.beta && c.wiki) return t + wb + '<p class="betan">ออโต้ β (จาก wiki) — ใบนี้ไม่มีในรายการภาษาอังกฤษทางการ ระบบอ่านสกิลจากคำแปลใน wiki จึงมีโอกาสคลาดเคลื่อนมากกว่าใบอื่น ถ้าทำงานไม่ตรงกับการ์ดจริง ใช้ ✋ ทำเอง แก้ได้ · ' + src + '</p>' + un;
  if (c.beta) return t + wb + '<p class="betan">ออโต้ β — ระบบอ่านสกิลใบนี้จากข้อความการ์ดเอง ยังไม่ได้ตรวจด้วยมือ ถ้าทำงานไม่ตรงกับการ์ดจริง ใช้ ✋ ทำเอง แก้ได้ · ' + src + '</p>' + un;
  return t + wb + un;
}
/* where the card's real wording can be read: the official card page (Japanese list for this pool) and the wiki page (English) */
function wikiTitle(c) { return c.wt || (c.jonly || c.unofficial || c.type === 'token' || (c.ticket && !c.official) ? '' : c.name); }
function wikiLink(c) { const w = wikiTitle(c); return w ? '<a href="https://cardfight.fandom.com/wiki/' + encodeURIComponent(w.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':') + '" target="_blank" rel="noopener">wiki (อังกฤษ) ↗</a>' : ''; }
function cardLinks(c) { if (c.ticket && !c.official) return 'ทิกเก็ตการ์ด — ได้มาจากสกิลของการ์ดใบอื่น ไม่มีหน้าการ์ดของตัวเอง'; const w = wikiLink(c); return 'อ่านข้อความการ์ด: ' + officialLink(c, 'เว็บทางการ') + (w ? ' · ' + w : ''); }
/* Local copy only: the card's wording is shown straight from the wiki page (English), fetched when the card is looked at — like the pictures, it is never stored in the game.
   Anything the page needs is read through the wiki's public API; a failed lookup simply leaves the box out. */
const WTXT = {}; let wTimer = 0;
function wikiOn() { return !!LOCAL && store.get('vg.wikiText') !== false; }
function wikiBox(c) { const w = wikiTitle(c); return wikiOn() && w ? '<div class="wtext" data-wt="' + esc(w) + '"></div>' : ''; }
function wikiPlain(src, title) {
  let s = String(src || '');
  s = s.replace(/<tabber>([\s\S]*?)<\/tabber>/gi, (m, body) => { const tabs = body.split('|-|').map(t => { const e = /^\s*([^=\n]{1,30})=([\s\S]*)$/.exec(t); return e ? [e[1].trim().toLowerCase(), e[2]] : ['', t]; }); return (tabs.find(t => /^(japanese|jp|ja)/.test(t[0])) || tabs[0])[1]; });
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/'''?/g, '').replace(/^-{4,}\s*$/gm, '');
  for (let g = 0; g < 80; g++) { const m = /\{\{([^{}]*)\}\}/.exec(s); if (!m) break; const parts = m[1].split('|'); const n = parts[0].trim().toLowerCase(); const a = parts.slice(1).filter(x => !/^\s*[A-Za-z0-9]+\s*=/.test(x)); const k = {}; for (const x of parts.slice(1)) { const e = /^\s*([A-Za-z0-9]+)\s*=([\s\S]*)$/.exec(x); if (e) k[e[1]] = e[2]; }
    const r = n === 'pagename' ? title : n === 'once' ? '[1/Turn]' : n === 'cost' ? '[COST][' + (a[0] || '').trim() + ']' : /^(redtext|dlink|addedability)$/.test(n) ? (a[a.length - 1] || '') : /^(divineskill|uniqueskill)$/.test(n) ? '[' + parts[0].trim() + '] ' + (k.ab || '') : n === 'reskin' ? 'Regarded as "' + (a.filter(x => !/^(NoAlso|Also)$/i.test(x.trim()))[0] || '').trim() + '".' : /^(od|xod|du|glitter)$/.test(n) ? '[' + parts[0].trim() + '] ' + (k.N || '') : '[' + parts[0].trim() + (a.length ? ': ' + a.join(', ') : '') + ']';
    s = s.slice(0, m.index) + r + s.slice(m.index + m[0].length); }
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').split('\n').map(x => x.trim()).filter(Boolean);
}
function pumpWiki() {
  clearTimeout(wTimer); wTimer = setTimeout(async () => {
    const els = [...document.querySelectorAll('.wtext[data-wt]:not([data-done])')]; if (!els.length) return;
    const fill = () => { for (const el of els) { const v = WTXT[el.dataset.wt]; if (v === undefined) continue; el.dataset.done = '1'; el.innerHTML = v && v.length ? '<b>ข้อความการ์ด (อังกฤษ) — โหลดสดจาก Cardfight!! Vanguard Wiki</b>' + v.map(x => '<p>' + esc(x) + '</p>').join('') : ''; } };
    const need = [...new Set(els.map(e => e.dataset.wt).filter(t => WTXT[t] === undefined))].slice(0, 20);
    if (need.length) {
      try {
        const r = await fetch('https://cardfight.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(need.join('|')), { credentials: 'omit' });
        const j = await r.json(); const back = {}; for (const x of ((j.query || {}).normalized || []).concat((j.query || {}).redirects || [])) back[x.to] = back[x.to] || x.from;
        for (const p of Object.values((j.query || {}).pages || {})) { const t = p.revisions ? p.revisions[0].slots.main['*'] : ''; const m = /\n\|\s*effect\s*=[ \t]*([^\n]*(?:\n(?!\||\}\})[^\n]*)*)/i.exec(t); const lines = m ? wikiPlain(m[1], p.title) : []; WTXT[p.title] = lines; let k = p.title; for (let g = 0; g < 3 && back[k]; g++) { k = back[k]; WTXT[k] = lines; } }
      } catch (e) { /* offline or blocked: no box */ }
      for (const t of need) if (WTXT[t] === undefined) WTXT[t] = [];
    }
    fill(); if (document.querySelector('.wtext[data-wt]:not([data-done])')) pumpWiki();
  }, 120);
}

function tagOf(c) { return c.auto ? (c.semi ? ' <span class="tags">กึ่งออโต้</span>' : c.partial ? ' <span class="tagp">ออโต้บางส่วน</span>' : c.beta ? ' <span class="tagb">ออโต้ β</span>' : '') : ' <span class="tagm">ยังไม่ออโต้</span>'; }
/* file name the official site uses for a card's picture, e.g. D-BT04/048EN → dbt04_048 */
function fileHint(c) { if (c.jimg) return c.jimg.split('/').pop(); return String(c.official || c.no).toLowerCase().replace(/-/g, '').replace(/\//g, '_').replace(/en(-[a-z0-9]+)?$/, '$1'); }
function deckViewer(id, tab) {
  const d = VG.DECKS[id]; if (!d) return; const errs = VG.checkDeck(d); S.viewDeck = { id, tab: tab || 'cards' };
  const all = d.ride.map(no => [no, 1]).concat(d.main.map(e => [e.no, e.n]));
  const uniq = []; const seen = {}; for (const [no] of all) { const k = C[no].name; if (!seen[k]) { seen[k] = 1; uniq.push(no); } }
  const have = uniq.filter(no => imgFor(C[no])).length;
  let body;
  if (tab === 'img') {
    body = '<p class="note">เกมนี้ไม่ได้ฝังรูปการ์ดจริงไว้ (ลิขสิทธิ์ของ Bushiroad) แต่ใช้รูปที่คุณมีในเครื่องได้: เปิดหน้าการ์ดทางการจากลิงก์ด้านล่าง บันทึกรูปลงเครื่อง แล้วกดเลือกไฟล์หรือเลือกทั้งโฟลเดอร์ ระบบจับคู่จาก<b>ชื่อไฟล์</b> (เลขการ์ดตามที่เว็บทางการตั้งให้ หรือชื่อการ์ด) รูปเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น</p>'
      + '<div class="row"><label class="btn pri" for="imgIn">เลือกไฟล์รูป…</label><label class="btn" for="imgDir">เลือกทั้งโฟลเดอร์…</label><span class="note">มีรูปแล้ว <b>' + have + '</b> / ' + uniq.length + ' ชนิดในเด็คนี้</span></div>'
      + '<div class="ilist">' + uniq.map(no => { const c = C[no]; const ok = !!imgFor(c); return '<div class="irow' + (ok ? ' ok' : '') + '"><div class="ith">' + staticCard(no, true) + '</div><div><div class="nm">' + esc(dn(c)) + '</div><div class="mt">' + (ok ? '✓ มีรูปแล้ว' : 'ยังไม่มีรูป · ตั้งชื่อไฟล์ว่า <b>' + esc(fileHint(c)) + '</b> (.png .jpg .webp)') + '</div><div class="mt">' + officialLink(c, 'เปิดหน้าการ์ดทางการเพื่อบันทึกรูป') + '</div></div></div>'; }).join('') + '</div>';
  } else {
    const row = (no, n) => { const c = C[no]; return '<div class="drow"><span class="q">' + n + '×</span><div><div class="nm">' + esc(dn(c)) + tagOf(c) + '</div><div class="mt">' + (dj(c) ? esc(dj(c)) + ' · ' : '') + statLine(c) + ' · ' + esc(dno(c)) + '</div>' + cardNote(c) + '</div></div>'; };
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
function statLine(c) {
  const a = [];
  if (c.type === 'order') a.push((c.orderKind === 'set' ? 'เซ็ตออเดอร์' : 'ออเดอร์') + ' เกรด ' + c.grade);
  else if (c.type === 'crest') a.push('ไรด์เด็คเครสต์');
  else { a.push('เกรด ' + c.grade, 'พลัง ' + c.power); if (c.shield != null) a.push('ชิลด์ ' + c.shield); }
  if (c.race) a.push(c.race);
  if (c.trigger) a.push(VG.TRIG_TH[c.trigger]);
  return esc(a.join(' · '));
}
function fmtText(t) { return esc(t).replace(/^((?:AUTO|ACT|CONT)[^:]*:|[^:]{2,26}:)/, '<b>$1</b>'); }

/* ================= layout ================= */
const rad = d => d * Math.PI / 180;
/* board point (bx, by) lifted `h` above the board → position in stage space (x, y, z) */
function b3(L, bx, by, h) { const t = L.BH - by; const c = Math.cos(rad(L.th)), s = Math.sin(rad(L.th)); h = h || 0; return [L.cx - L.BW / 2 + bx, L.hy - t * c - h * s, -t * s + h * c]; }
/* where a stage-space point lands on the screen, and how much the camera shrinks it there */
function prj(L, q) { const k = L.D / (L.D - q[2]); return [L.cx + (q[0] - L.cx) * k, L.oy + (q[1] - L.oy) * k, k]; }
function bscr(bx, by, h) { const L = LAY[S.lay]; return prj(L, b3(L, bx, by, h)); }
/* the far player's side is the point mirror of the near player's through the middle of the board */
function mirB(p, xy) { const L = LAY[S.lay]; return p === S.viewer ? [xy[0], xy[1]] : [L.BW - xy[0], L.BH - xy[1]]; }
function scrOf(p, xy, h) { const b = mirB(p, xy); return bscr(b[0], b[1], h); }
function fit() {
  const w = $('#wrap'); if (!w.clientWidth) return;
  const lay = w.clientWidth / w.clientHeight < 0.92 ? 'port' : 'land';
  const L = LAY[lay]; const k = Math.min(w.clientWidth / L.W, w.clientHeight / L.H);
  const st = $('#stage');
  st.style.width = L.W + 'px'; st.style.height = L.H + 'px';
  st.style.transform = 'translate(' + Math.round((w.clientWidth - L.W * k) / 2) + 'px,' + Math.round((w.clientHeight - L.H * k) / 2) + 'px) scale(' + k + ')';
  st.className = 'stage-' + lay;
  const changed = S.lay !== lay; S.lay = lay;
  const sc = $('#scene'); sc.style.perspective = L.D + 'px'; sc.style.perspectiveOrigin = L.cx + 'px ' + L.oy + 'px';
  const pn = $('#plane'); pn.style.left = (L.cx - L.BW / 2) + 'px'; pn.style.top = (L.hy - L.BH) + 'px'; pn.style.width = L.BW + 'px'; pn.style.height = L.BH + 'px'; pn.style.transform = 'rotateX(' + L.th + 'deg)';
  const sky = $('#sky'); sky.style.setProperty('--hx', L.cx + 'px'); sky.style.setProperty('--hz', (prj(L, b3(L, 0, 0, 0))[1] - 6) + 'px');
  const put = (el, r) => { if (!r) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = r[0] + 'px'; el.style.top = r[1] + 'px'; if (r[2]) el.style.width = r[2] + 'px'; if (r[3]) el.style.height = r[3] + 'px'; };
  put($('#side'), L.side); put($('#prompt'), L.prompt); put($('#log'), L.log);
  for (const id of ['phase', 'menu']) { const e = $('#' + id); const left = L[id][2] === 'l'; e.style.left = left ? L[id][0] + 'px' : 'auto'; e.style.right = left ? 'auto' : (L.W - L[id][0]) + 'px'; e.style.top = L[id][1] + 'px'; }
  const cta = $('#cta'); if (L.cta) { cta.style.display = ''; cta.style.right = (L.W - L.cta[0]) + 'px'; cta.style.bottom = (L.H - L.cta[1]) + 'px'; } else cta.style.display = 'none';
  $('#cutin').style.top = L.cut + 'px';
  { const c = $('#clash'); if (L.clash) { c.style.display = ''; c.style.right = (L.W - L.clash[0]) + 'px'; c.style.top = L.clash[1] + 'px'; } else c.style.display = 'none'; }
  if (S.snap) { buildZones(); if (changed) for (const k2 in S.els) S.els[k2].classList.add('nomove'); render(); if (changed) requestAnimationFrame(() => { for (const k2 in S.els) S.els[k2].classList.remove('nomove'); }); }
}
/* circle ornament of the play mat (the game's own design): rings of ticks, dots and arcs, four small studs, and a diamond plate carrying the circle's letter */
function ringArt(letter) {
  const stud = a => '<path class="z4" d="M100 8l5.5 7-5.5 7-5.5-7z" transform="rotate(' + a + ' 100 100)"/>';
  return '<svg class="zart" viewBox="0 0 200 200" aria-hidden="true">'
    + '<circle cx="100" cy="100" r="97" class="z1"/><circle cx="100" cy="100" r="90.5" class="z2" pathLength="144" stroke-dasharray="1 2"/><circle cx="100" cy="100" r="84" class="z1"/>'
    + '<circle cx="100" cy="100" r="76" class="z3" pathLength="100" stroke-dasharray="21 4" transform="rotate(-37.8 100 100)"/>'
    + '<circle cx="100" cy="100" r="67.5" class="z6" pathLength="90" stroke-dasharray="1 1"/><circle cx="100" cy="100" r="60" class="z1"/>'
    + stud(0) + stud(90) + stud(180) + stud(270)
    + '<circle cx="100" cy="100" r="50" class="z7"/>'
    + '<path class="z4" d="M100 60 140 100 100 140 60 100Z"/><path class="z8" d="M100 60 140 100 60 100Z"/><path class="z5" d="M100 70 130 100 100 130 70 100Z"/>'
    + '<text x="100" y="101" class="zt" text-anchor="middle" dominant-baseline="central">' + letter + '</text></svg>';
}
function buildZones() {
  const L = LAY[S.lay]; let h = '<div class="mat"><i class="frame"></i><i class="mid"></i><i class="cn c0"></i><i class="cn c1"></i><i class="cn c2"></i><i class="cn c3"></i></div>';
  // faint guide lines tie the six circles of each side together
  for (const p of [0, 1]) { const C0 = L.circles; const ln = (a, b) => { const [x1, y1] = mirB(p, a), [x2, y2] = mirB(p, b); const hz = Math.abs(y1 - y2) < 1; h += '<i class="gl' + (hz ? '' : ' v') + '" style="left:' + Math.min(x1, x2) + 'px;top:' + Math.min(y1, y2) + 'px;' + (hz ? 'width:' + Math.abs(x1 - x2) : 'height:' + Math.abs(y1 - y2)) + 'px"></i>'; };
    ln(C0.FL, C0.FR); ln(C0.BL, C0.BR); ln(C0.FL, C0.BL); ln(C0.V, C0.BC); ln(C0.FR, C0.BR); }
  const box = (cls, x, y, w, hh, attr, inner) => '<div class="zone ' + cls + '" style="left:' + (x - w / 2) + 'px;top:' + (y - hh / 2) + 'px;width:' + w + 'px;height:' + hh + 'px" ' + (attr || '') + '>' + (inner || '') + '</div>';
  h += box('gcband', L.BW / 2, L.gc.y, L.gc.w + 200, L.gc.h, '', '<i class="gmark">' + ringArt('G') + '</i><span class="zl">GUARDIAN CIRCLE</span>');
  for (const p of [0, 1]) {
    const o = p === S.viewer ? '' : ' opp'; const at = 'data-p="' + p + '"';
    for (const k in L.circles) { if (k === 'V2') continue; const [x, y] = mirB(p, L.circles[k]); h += box('circle' + (k === 'V' ? ' vc' : '') + o, x, y, L.cd, L.cd, at + ' data-k="' + k + '"', ringArt(k === 'V' ? 'V' : 'R') + (k === 'V' ? '<i class="sig"></i>' : '')); }
    for (const [z, lb] of [['deck', 'DECK'], ['drop', 'DROP ZONE'], ['ride', 'RIDE DECK'], ['removed', 'REMOVED'], ['bind', 'BIND ZONE'], ['gauge', 'GAUGE'], ['prison', 'IN PRISON'], ['gzone', 'G ZONE'], ['memory', 'MEMORY'], ['mbox', 'MONSTER BOX']]) {
      const [x, y] = mirB(p, L[z]); const s = L[z][2];
      h += box('pile' + o, x, y, 100 * s + 12, 140 * s + 12, at + ' data-z="' + z + '" id="zn-' + p + '-' + z + '"', '<span class="zl">' + lb + '</span>');
    }
    { const O = L.order; const w = 100 * O.s + O.step * 4 + 12; const [x, y] = mirB(p, [O.x + O.step * 2, O.y]); h += box('pile' + o, x, y, w, 140 * O.s + 12, at + ' data-z="order" id="zn-' + p + '-order"', '<span class="zl">ORDER ZONE</span>'); }
    { const D = L.damage; const [x, y] = mirB(p, [D.x, D.y + D.step * 2.5]); h += box('pile dmg' + o, x, y, 140 * D.s + 14, D.step * 5 + 100 * D.s + 14, at + ' data-z="damage"', '<span class="zl">DAMAGE ZONE</span>'); }
  }
  $('#zones').innerHTML = h;
  // name plates (screen space): who, hand, energy, soul, damage pips
  let pl = '';
  for (const p of [0, 1]) { const at = p === S.viewer ? L.plate : L.oppPlate; pl += '<div class="plate' + (p === S.viewer ? ' me' : ' opp') + '" id="pl-' + p + '" style="left:' + at[0] + 'px;top:' + at[1] + 'px"></div>'; }
  $('#plates').innerHTML = pl;
  for (const k in S.tags) { S.tags[k].remove(); delete S.tags[k]; }
  $('#tags').innerHTML = '';
}
function placements(sn) {
  const L = LAY[S.lay]; const out = {};
  const B = (p, xy, o) => { const b = mirB(p, xy); return Object.assign({ flat: true, bx: b[0], by: b[1], h: 2 }, o); };
  for (const p of [0, 1]) {
    const P = sn.players[p]; const mine = p === S.viewer; const nS = Math.min(P.soul.length, 14);
    for (const k in P.circles) { const iid = P.circles[k]; if (!iid) continue; out[iid] = B(p, L.circles[k], { s: L.cs, h: k === 'V' ? 3 + nS * 0.9 : 3, z: 110 }); }
    P.soul.forEach((iid, i) => { const k = Math.min(i, 14); out[iid] = B(p, [L.circles.V[0] + 4 + k * 1.6, L.circles.V[1] + 3 + k * 1.2], { s: L.cs, h: 1 + k * 0.9, z: 60 + i, soul: true }); });
    const H = mine ? L.hand : L.oppHand; const n = P.hand.length; const cw = 100 * H.s; const sg = mine ? 1 : -1;
    const step = n > 1 ? Math.min(cw * 0.86, (H.w - cw) / (n - 1)) : 0; const x0 = H.x - step * (n - 1) / 2;
    P.hand.forEach((iid, i) => { const u = n > 1 ? (i - (n - 1) / 2) / Math.max(n - 1, 5) : 0; out[iid] = { x: x0 + step * i, y: H.y + sg * u * u * (H.arc || 60) * H.s, s: H.s, r: sg * u * 18, zf: 4 + i * 0.5, z: 300 + i }; });
    { const m = P.deck.length; P.deck.forEach((iid, i) => { out[iid] = B(p, L.deck, { s: L.deck[2], h: 1 + Math.min(m - 1 - i, 44) * 0.55, z: 90 - Math.min(i, 60) }); }); }
    (P.heart || []).forEach((iid, i) => { const V = L.circles.V; out[iid] = B(p, [V[0] + 26 + i * 8, V[1] - 22], { s: 0.9, h: 0, z: 1 }); });   // the heart lies under the strode G unit
    for (const z of ['drop', 'removed', 'bind', 'gauge', 'prison', 'gzone', 'memory', 'mbox']) (P[z] || []).forEach((iid, i) => { out[iid] = B(p, L[z], { s: L[z][2], h: 1 + Math.min(i, 44) * 0.45, z: 10 + Math.min(i, 80) }); });
    { const m = P.ride.length; P.ride.forEach((iid, i) => { out[iid] = B(p, [L.ride[0] + i * 3, L.ride[1] - i * 2], { s: L.ride[2], h: 1 + (m - 1 - i) * 0.8, z: 40 - i }); }); }
    P.crest.forEach(iid => { out[iid] = B(p, L.crest, { s: L.crest[2], h: 1, z: 5 }); });
    (P.music || []).forEach((iid, i) => { const C0 = L.circles.BC; out[iid] = B(p, [C0[0] + 40 + i * 30, C0[1] - 34], { s: 0.46, h: 3, z: 62 + i }); });   // a played Music lies on the back row center circle
    (P.arms || []).forEach((iid, i) => { const V = L.circles.V; out[iid] = B(p, [V[0] - 46 + i * 46, V[1] + (L.cd / 2) + 18], { s: 0.4, h: 2, z: 60 + i }); });   // armed cards lie at the foot of the vanguard circle
    { const O = L.order; P.order.forEach((iid, i) => { out[iid] = B(p, [O.x + O.step * Math.min(i, 4), O.y], { s: O.s, h: 1 + i * 0.5, z: 20 + i }); }); }
    { const D = L.damage; P.damage.forEach((iid, i) => { out[iid] = B(p, [D.x, D.y + D.step * Math.min(i, 5)], { s: D.s, r: 90, h: 1 + i * 0.6, z: 20 + i }); }); }
    { const G = L.gc; const m = P.GC.length; P.GC.forEach((iid, i) => { out[iid] = { flat: true, bx: L.BW / 2 + (i - (m - 1) / 2) * Math.min(G.step, G.w / Math.max(m, 1)), by: G.y, h: 4 + i * 0.4, s: G.s, z: 400 + i }; }); }
    P.trigger.forEach(iid => { out[iid] = { x: L.trigger[0], y: L.trigger[1], s: L.trigger[2], zf: 60, z: 800 }; });
    // originalDress cards lie under their unit, fanned out a little so they can be seen and clicked
    { const seen = {}; (P.dress || []).forEach(iid => { const h = sn.cards[iid] && sn.cards[iid].host; const hp = out[h]; if (!hp) return; const k = seen[h] = (seen[h] || 0) + 1; out[iid] = hp.flat ? Object.assign({}, hp, { bx: hp.bx + 5 * k, by: hp.by + 4.5 * k, h: Math.max(0.6, hp.h - 0.5 * k), z: hp.z - k, host: h }) : Object.assign({}, hp, { x: hp.x + 6 * k, y: hp.y + 5 * k, z: hp.z - k, host: h }); }); }
  }
  for (const k in out) { const p = out[k]; if (p.flat) { const q = b3(L, p.bx, p.by, p.h); const s = prj(L, q); p.q = q; p.x = s[0]; p.y = s[1]; p.k = s[2]; } else p.k = 1; }
  return out;
}
/* every card uses the same list of transform functions, so a card glides smoothly from the hand (upright) to the board (lying flat) */
function tfOf(L, p) {
  if (p.flat) return 'translate3d(' + p.q[0].toFixed(1) + 'px,' + p.q[1].toFixed(1) + 'px,' + p.q[2].toFixed(1) + 'px) rotateX(' + L.th + 'deg) rotateZ(' + (p.r || 0) + 'deg) scale(' + p.s + ')';
  return 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,' + (p.zf || 0) + 'px) rotateX(0deg) rotateZ(' + (p.r || 0).toFixed(1) + 'deg) scale(' + p.s + ')';
}
function faceVisible(c) {
  const all = S.mode === 'solo';
  switch (c.zone) {
    case 'deck': return false;
    case 'hand': return all || c.owner === S.seat;
    case 'ride': return all || c.owner === S.seat;
    case 'damage': return c.faceup;
    case 'gauge': return c.faceup;
    case 'gzone': return c.faceup; case 'heart': return true; case 'memory': return true; case 'mbox': return c.faceup;
    case 'RC': return !c.locked;
    default: return true;
  }
}

/* ================= rendering ================= */
function canAnswer(d) {
  if (!d || S.busy) return false;
  if (S.mode === 'solo') return true;
  if (S.mode === 'online' && S.sending) return false;
  return d.player === S.seat;
}
function pendingForMe() { const d = S.game && S.game.pending; return d && canAnswer(d) ? d : null; }
function needsPicker(d) {
  if (!['cards', 'mulligan', 'guard'].includes(d.kind)) return false;
  return d.options.some(o => { const c = S.snap.cards[o.iid]; if (!c) return true; if (c.zone === 'hand') return c.owner !== S.viewer; return !(c.zone === 'VC' || c.zone === 'RC' || c.zone === 'GC'); });
}
/* what the open decision lets you do with cards lying in a zone (drop, soul, bind …): ACT skills, orders played from there, calls */
function pileActs(p, z) {
  const d = pendingForMe(); const out = {}; if (!d || !S.snap || (d.kind !== 'main' && d.kind !== 'attack')) return out;
  d.options.forEach((o, i) => { if (o.iid == null || !(o.a === 'act' || o.a === 'order' || o.a === 'call' || o.a === 'varm')) return; const c = S.snap.cards[o.iid]; if (!c || c.zone !== z || c.owner !== p) return;
    const lb = o.a === 'act' ? 'ใช้สกิล: ' + (o.label || 'ACT') : o.a === 'order' ? 'เพลย์ออเดอร์นี้' : o.a === 'varm' ? 'อาร์มให้แวนการ์ด' : 'คอลลง ' + (CIRC_TH[o.circle] || o.circle);
    (out[o.iid] = out[o.iid] || []).push({ i, lb }); });
  return out;
}
function marks() {
  const m = { cards: {}, circles: {}, energy: {} };
  const d = pendingForMe(); if (!d || S.picker) return m;
  const o = d.options;
  if (d.kind === 'main') {
    for (const x of o) {
      if (x.a === 'call' || x.a === 'order' || x.a === 'varm') m.cards[x.iid] = 'can';
      else if (x.a === 'act' && x.iid != null && !m.cards[x.iid]) m.cards[x.iid] = 'can act';
    }
    if (S.src) { m.cards[S.src] = 'can sel'; for (const x of o) if (x.a === 'call' && x.iid === S.src) m.circles[d.player + ':' + x.circle] = true; }
  } else if (d.kind === 'attack') {
    for (const x of o) if (x.a === 'attack') m.cards[x.iid] = 'can';
    if (S.src) { m.cards[S.src] = 'can sel'; for (const x of o) if (x.a === 'attack' && x.iid === S.src) m.cards[x.target] = 'can tgt'; }
  } else if (d.kind === 'ride') { for (const x of o) if (x.iid) m.cards[x.iid] = 'can'; }
  else if (d.kind === 'cards' || d.kind === 'mulligan' || d.kind === 'guard') { o.forEach((x, i) => { m.cards[x.iid] = 'can' + (S.picks.has(i) ? ' sel' : ''); }); }
  else if (d.kind === 'circle') { for (const x of o) m.circles[d.player + ':' + x.circle] = true; }
  if (d.iid && !m.cards[d.iid]) m.cards[d.iid] = 'hl';
  return m;
}
function render() {
  const sn = S.snap; if (!sn) return;
  const L = LAY[S.lay]; const pl = S.pl = placements(sn); const mk = marks(); const layer = $('#cards');
  for (const iid in sn.cards) {
    const c = sn.cards[iid]; const p = pl[iid]; if (!p) continue;
    let el = S.els[iid];
    if (!el) {
      el = document.createElement('div'); el.className = 'card nomove'; el.dataset.iid = iid;
      el.innerHTML = '<div class="in"><div class="cb"></div>' + faceHTML(C[c.no]) + '</div>';
      // new cards (tokens) appear on the spot; everything else starts from its first known place
      layer.appendChild(el); S.els[iid] = el;
      requestAnimationFrame(() => el.classList.remove('nomove'));
    }
    const up = faceVisible(c); const onfield = c.zone === 'VC' || c.zone === 'RC' || c.zone === 'GC';
    el.style.transform = tfOf(L, p);
    el.style.zIndex = p.z;
    const rest = p.soul ? !!(sn.cards[sn.players[c.owner].circles.V] || {}).rest : p.host ? !!(sn.cards[p.host] || {}).rest : c.rest;
    let cls = 'card' + (p.flat ? ' flat' : '');
    for (const k of ['nomove', 'flash', 'shake', 'lunge', 'struck']) if (el.classList.contains(k)) cls += ' ' + k;
    cls += (up ? ' up' : '') + (rest ? ' rest' : '') + (c.locked ? ' locked' : '') + (onfield && up ? ' onfield' : '') + (c.zone === 'hand' ? ' inhand' : '') + (c.zone === 'VC' ? ' vg' : '') + (c.zone === 'trigger' ? ' checking' : '') + (c.owner === S.viewer ? ' mine' : '');
    if (mk.cards[iid]) cls += ' ' + mk.cards[iid];
    if (el.className !== cls) el.className = cls;
  }
  for (const iid in S.els) if (!sn.cards[iid]) { const el = S.els[iid]; el.classList.add('gone'); delete S.els[iid]; setTimeout(() => el.remove(), 320); }
  renderTags(sn, pl); renderPlates(sn); renderSoulBtn(sn);
  // the selected card carries a small "read" button (its click is the action, so reading needs its own handle)
  { const pk = $('#peek'); const q = S.src != null && sn.cards[S.src] && !S.picker ? pl[S.src] : null; if (q) { pk.hidden = false; pk.style.left = q.x + 'px'; pk.style.top = Math.max(26, q.y - 70 * (q.flat ? q.s * q.k : q.s) - 30) + 'px'; } else pk.hidden = true; }
  for (const p of [0, 1]) for (const z of ['removed', 'bind', 'gauge', 'prison', 'gzone', 'memory', 'mbox']) { const e = document.getElementById('zn-' + p + '-' + z); if (e) e.hidden = !(sn.players[p][z] || []).length; }
  document.querySelectorAll('#zones .circle').forEach(e => e.classList.toggle('can', !!mk.circles[e.dataset.p + ':' + e.dataset.k]));
  document.querySelectorAll('#zones .pile[data-z]').forEach(e => e.classList.toggle('can', Object.keys(pileActs(+e.dataset.p, e.dataset.z)).length > 0));
  renderBattle(sn, pl); renderPhase(sn); renderSwaps(); renderPrompt();
}
function fmtP(n) { return n >= 100000000 ? '100M+' : String(n); }
/* power, shield and counters are drawn upright in screen space so they stay readable on the tilted board */
function renderTags(sn, pl) {
  const L = LAY[S.lay]; const box = $('#tags'); const live = {};
  const set = (key, x, y, k, html, cls) => {
    let e = S.tags[key]; if (!e) { e = document.createElement('div'); e.dataset.h = ''; box.appendChild(e); S.tags[key] = e; }
    live[key] = 1; if (e.className !== cls) e.className = cls;
    e.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + k.toFixed(3) + ')';
    if (e.dataset.h !== html) { e.innerHTML = html; e.dataset.h = html; }
  };
  const b = sn.battle;
  for (const iid in sn.cards) {
    const c = sn.cards[iid]; const p = pl[iid]; if (!p || !p.flat) continue;
    if (!(c.zone === 'VC' || c.zone === 'RC' || c.zone === 'GC') || !faceVisible(c)) continue;
    const d = C[c.no]; let h = '';
    if (c.zone === 'GC') h = '<span class="shd">' + fmtP(c.shield) + '</span>';
    else { h = '<span class="pw' + (c.power > d.power ? ' up' : c.power < d.power ? ' dn' : '') + '">' + fmtP(c.power) + '</span>'; if (c.crit > 1) h += '<span class="cr">★' + c.crit + '</span>'; }
    let f = '';
    if (b && b.attacker === +iid) f += '<b class="w">ATTACK</b>';
    if (b && b.booster === +iid) f += '<b>BOOST</b>';
    if (c.cantAttack) f += '<b class="w">โจมตีไม่ได้</b>';
    if (c.cantBeHit) f += '<b class="g">ไม่ถูกโจมตีโดน</b>';
    const s = bscr(p.bx, p.by + (c.rest ? 54 : 72) * p.s, p.h);
    set('c' + iid, s[0], s[1], Math.max(0.74, Math.min(1, s[2] * 1.04)), '<span class="row">' + h + '</span>' + (f ? '<span class="fl">' + f + '</span>' : ''), 'tg st' + (c.owner === S.viewer ? '' : ' opp'));
  }
  for (const p of [0, 1]) {
    const P = sn.players[p];
    const cnt = (z, xy, s, h) => { const n = (P[z] || []).length; if (!n && z !== 'deck' && z !== 'drop') return; const q = scrOf(p, [xy[0] + 44 * s, xy[1] - 62 * s], h); set('n' + p + z, q[0], q[1], Math.max(0.7, q[2]), String(n), 'tg cn' + (z === 'deck' && n <= 5 ? ' low' : '')); };
    cnt('deck', L.deck, L.deck[2], 2 + Math.min(P.deck.length, 44) * 0.55); cnt('drop', L.drop, L.drop[2], 2 + Math.min(P.drop.length, 44) * 0.45);
    cnt('ride', L.ride, L.ride[2], 4); cnt('removed', L.removed, L.removed[2], 2); cnt('bind', L.bind, L.bind[2], 2); cnt('gauge', L.gauge, L.gauge[2], 2); cnt('prison', L.prison, L.prison[2], 2); cnt('gzone', L.gzone, L.gzone[2], 2); cnt('memory', L.memory, L.memory[2], 2); cnt('mbox', L.mbox, L.mbox[2], 2);
    cnt('order', [L.order.x + L.order.step * 4, L.order.y], L.order.s, 2);
  }
  // markers lying on circles (Dragontree, Infinity Eyes…): a small plate at the corner of the circle
  if (sn.markers && sn.markers.length) {
    const by = {}; for (const m of sn.markers) { const key = m.p + m.k; (by[key] = by[key] || { p: m.p, k: m.k, n: {} }).n[m.name] = (by[key].n[m.name] || 0) + 1; }
    for (const key in by) { const e = by[key]; const xy = L.circles[e.k]; if (!xy) continue; const q = scrOf(e.p, [xy[0] - 30, xy[1] - 52], 6); set('m' + key, q[0], q[1], Math.max(0.72, q[2]), Object.entries(e.n).map(([nm, n]) => '<b>◆ ' + esc(nm) + (n > 1 ? ' ×' + n : '') + '</b>').join(''), 'tg mkr'); }
  }
  for (const k in S.tags) if (!live[k]) { S.tags[k].remove(); delete S.tags[k]; }
}
/* fighter gauges: seat badge, name, the six damage cells (the "life bar" of this game), counters and the energy bar */
function renderPlates(sn) {
  for (const p of [0, 1]) {
    const P = sn.players[p]; const e = document.getElementById('pl-' + p); if (!e) continue;
    const dm = P.damage.length; let pips = ''; for (let i = 0; i < 6; i++) pips += '<i class="' + (i < dm ? 'on' : '') + '"></i>';
    const h = '<div class="pl-id" aria-hidden="true"><b>' + (p + 1) + '</b><small>P</small></div><div class="pl-main">'
      + '<div class="pl-n"><b>' + esc(P.name) + '</b><span>' + esc(P.deckName) + '</span>' + (sn.turnNo && sn.first === p ? '<em>เริ่มก่อน</em>' : '') + '</div>'
      + '<div class="pl-dmg' + (dm >= 5 ? ' hot' : dm >= 4 ? ' warn' : '') + '" title="ดาเมจ ' + dm + '/6"><span class="dm">' + pips + '</span><strong>' + dm + '<small>/6</small></strong></div>'
      + '<div class="pl-s"><span class="hd">มือ <b>' + P.hand.length + '</b></span><span class="dkc' + (P.deck.length <= 5 ? ' low' : '') + '">เด็ค <b>' + P.deck.length + '</b></span>'
      + '<button type="button" class="so" data-p="' + p + '" data-z="soul" title="ดูการ์ดในโซล">โซล <b>' + P.soul.length + '</b></button><span class="dr">ดรอป <b>' + P.drop.length + '</b></span>'
      + (P.crest.length ? '<span class="en" title="เอเนอร์จี ' + P.energy + '/10">EN <b>' + P.energy + '</b><i class="enb"><u style="width:' + (P.energy * 10) + '%"></u></i></span>' : '') + '</div>'
      + (P.effects.length ? '<div class="pl-fx">' + P.effects.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' : '') + '</div>';
    e.classList.toggle('turn', sn.active === p && !!sn.turnNo);
    if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
  }
  // the table takes the colour of the fighter whose turn it is
  const st = $('#stage'); const mine = sn.active === S.viewer; st.classList.toggle('turn-me', !!sn.turnNo && mine); st.classList.toggle('turn-opp', !!sn.turnNo && !mine);
  renderClash(sn);
}
/* the numbers of the battle that is being fought, large, at the side of the table */
function renderClash(sn) {
  const el = $('#clash'); const b = sn.battle; const a = b && sn.cards[b.attacker], t = b && sn.cards[b.target];
  if (!b || !a || !t) { if (!el.hidden) { el.hidden = true; el.dataset.h = ''; } return; }
  const hit = b.atk >= b.dfn; const diff = Math.abs(b.atk - b.dfn); const top = Math.max(b.atk, b.dfn, 1); const mineAtk = a.owner === S.viewer;
  const need = hit ? Math.ceil((b.atk - b.dfn + 1) / 5000) * 5000 : 0;
  const h = '<p class="cl-t">BATTLE</p>'
    + '<div class="cl-row atk' + (mineAtk ? ' me' : ' opp') + '"><span>' + esc(dn(C[a.no])) + (b.booster && sn.cards[b.booster] ? ' <i>+ บูสต์</i>' : '') + '</span><b>' + fmtP(b.atk) + (a.crit > 1 ? '<small>★' + a.crit + '</small>' : '') + '</b><em><u style="width:' + (b.atk / top * 100).toFixed(1) + '%"></u></em></div>'
    + '<div class="cl-vs">' + (hit ? '▼' : '✕') + '</div>'
    + '<div class="cl-row dfn' + (mineAtk ? ' opp' : ' me') + '"><span>' + esc(dn(C[t.no])) + '</span><b>' + fmtP(b.dfn) + '</b><em><u style="width:' + (b.dfn / top * 100).toFixed(1) + '%"></u></em></div>'
    + '<p class="cl-r ' + (hit ? 'hit' : 'safe') + '">' + (hit ? 'โจมตีโดน' + (need ? ' · กันได้ถ้าชิลด์ +' + fmtP(need) : '') : 'กันได้ · เกิน ' + fmtP(diff)) + '</p>';
  if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
  el.hidden = false;
}
function renderBattle(sn, pl) {
  const fx = $('#fx'); const L = LAY[S.lay]; const b = sn.battle;
  fx.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
  if (!b || !pl[b.attacker] || !pl[b.target]) { if (fx.dataset.k) { const g = fx.querySelector('.bt'); if (g) g.remove(); fx.dataset.k = ''; } return; }
  const a = pl[b.attacker], t = pl[b.target]; const hit = b.atk >= b.dfn; const key = b.attacker + '>' + b.target + '@' + S.viewer + S.lay;
  const dx = t.x - a.x, dy = t.y - a.y; const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
  const x1 = a.x + ux * 46 * a.k, y1 = a.y + uy * 46 * a.k, x2 = t.x - ux * 52 * t.k, y2 = t.y - uy * 52 * t.k;
  const mx = (x1 + x2) / 2 - uy * 26, my = (y1 + y2) / 2 + ux * 26 - 18;
  const vs = fmtP(b.atk) + (hit ? '  ▶  ' : '  ✕  ') + fmtP(b.dfn);
  if (fx.dataset.k === key) { const tx = fx.querySelector('.vs text'); if (tx && tx.textContent !== vs) { tx.textContent = vs; fx.querySelector('.vs').setAttribute('class', 'vs' + (hit ? ' hit' : ' safe')); } return; }
  const old = fx.querySelector('.bt'); if (old) old.remove();
  const path = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'bt');
  g.innerHTML = '<path class="beam glow" d="' + path + '" pathLength="100"/><path class="beam core" d="' + path + '" pathLength="100"/>'
    + '<g class="ret" transform="translate(' + t.x.toFixed(1) + ',' + t.y.toFixed(1) + ') scale(' + t.k.toFixed(2) + ')"><circle r="62"/><circle r="44"/><path d="M-78 0h26M52 0h26M0-78v26M0 52v26"/></g>'
    + '<g class="vs' + (hit ? ' hit' : ' safe') + '" transform="translate(' + ((x1 + x2) / 2).toFixed(1) + ',' + ((y1 + y2) / 2 - 8).toFixed(1) + ')"><rect x="-104" y="-19" width="208" height="38" rx="19"/><text x="0" y="7" text-anchor="middle">' + vs + '</text></g>';
  fx.appendChild(g); fx.dataset.k = key;
}
function renderPhase(sn) {
  const h = '<div class="turn"><small>TURN</small><b>' + sn.turnNo + '</b><span>' + esc(sn.players[sn.active].name) + '</span></div><ol>' + PHASES.map(([k, lb]) => '<li class="' + (sn.phase === k ? 'on' : '') + '">' + lb + '</li>').join('') + '</ol>';
  const e = $('#phase'); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
}
/* the soul lies under the vanguard where it cannot be clicked: a button at the corner of the vanguard circle opens it */
function renderSoulBtn(sn) {
  const L = LAY[S.lay]; let h = '';
  for (const p of [0, 1]) { const n = sn.players[p].soul.length; if (!n) continue; const v = L.circles.V; const q = scrOf(p, [v[0] + L.cd / 2 + 4, v[1] + L.cd / 2 - 20], 5); h += '<button type="button" data-z="soul" data-p="' + p + '" title="ดูการ์ดในโซล" aria-label="ดูการ์ดในโซล ' + n + ' ใบ" style="left:' + q[0].toFixed(0) + 'px;top:' + q[1].toFixed(0) + 'px">SOUL <b>' + n + '</b></button>'; }
  const e = $('#soulb'); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
}
function renderSwaps() {
  const d = pendingForMe(); const L = LAY[S.lay]; let h = '';
  if (d && d.kind === 'main' && !S.picker) d.options.forEach((o, i) => {
    if (o.a !== 'move') return;
    if (o.row) { const a = L.circles[o.row[0]], b = L.circles[o.row[1]]; const q = scrOf(d.player, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (o.row[0] === 'FL' ? L.cd / 2 + 14 : 0)], 4); h += '<button type="button" data-i="' + i + '" title="สลับตำแหน่งในแถวเดียวกัน" aria-label="สลับตำแหน่งในแถวเดียวกัน" style="left:' + q[0].toFixed(0) + 'px;top:' + q[1].toFixed(0) + 'px">⇆</button>'; return; }
    const f = L.circles[o.col === 'L' ? 'FL' : 'FR'], bk = L.circles[o.col === 'L' ? 'BL' : 'BR'];
    const q = scrOf(d.player, [f[0] + (o.col === 'L' ? -1 : 1) * (L.cd / 2 + 22), (f[1] + bk[1]) / 2], 4);
    h += '<button type="button" data-i="' + i + '" title="สลับแถวหน้า/หลัง" aria-label="สลับแถวหน้าและแถวหลัง" style="left:' + q[0].toFixed(0) + 'px;top:' + q[1].toFixed(0) + 'px">⇅</button>';
  });
  const e = $('#swaps'); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
}
function shieldOf(iid) { return S.game.guardShield(S.game.cards[iid]); }
function guardBad(d) { return !!S.game.guardBadSel(d, [...S.picks]); }
function guardInfo(d) {
  let add = 0; for (const i of S.picks) add += shieldOf(d.options[i].iid);
  const total = d.dfn + add; const hit = d.atk >= total;
  const lim = d.handMin > 1 ? ' · <b>จากมือต้องคอล' + (d.handNs ? 'การ์ดที่ไม่ใช่เซนทิเนล' : '') + 'ครั้งละ ' + d.handMin + ' ใบขึ้นไป' + (d.handDg ? ' เกรดไม่ซ้ำกัน' : '') + '</b>' : '';
  return lim.slice(3) + (lim ? ' · ' : '') + 'โจมตี <b>' + fmtP(d.atk) + '</b> · ป้องกัน <b>' + fmtP(total) + '</b>' + (add ? ' (ชิลด์ที่เลือก +' + add + ')' : '') + ' → ' + (hit ? 'ยังโดน ต้องการชิลด์อีก <b>' + (d.atk - total + 5000 - ((d.atk - total) % 5000)) + '</b>' : '<b>กันได้</b>');
}
function renderPrompt() {
  const el = $('#prompt'); const g = S.game; if (!g) return;
  const d = g.pending; let t = '', s = '', btn = [];
  const B = (label, attr, cls) => '<button type="button" class="btn ' + (cls || '') + '" ' + attr + '>' + esc(label) + '</button>';
  if (g.over) { t = 'จบไฟท์'; }
  else if (S.busy || !d) { t = '…'; }
  else if (!canAnswer(d)) { t = S.mode === 'online' ? (S.sending ? 'กำลังส่ง…' : 'รอ ' + g.players[d.player].name + '…') : 'บอทกำลังคิด…'; }
  else if (S.picker) { t = d.title || ''; s = 'เลือกในหน้าต่างที่เปิดอยู่'; btn.push(B('เปิดหน้าต่างเลือกการ์ด', 'data-do="reopen"', 'pri')); }
  else {
    const who = S.mode === 'solo' ? '[' + g.players[d.player].name + '] ' : '';
    t = who + (d.title || '');
    const n = S.picks.size;
    switch (d.kind) {
      case 'main': {
        s = S.src ? 'คลิกเซอร์เคิลที่เรืองแสงเพื่อคอล (คอลทับยูนิทเดิมได้)' : 'คลิกการ์ดในมือแล้วคลิกเซอร์เคิลเพื่อคอล · ⇅ สลับแถว';
        d.options.forEach((o, i) => {
          if (o.a === 'act') btn.push(B('ACT · ' + dshort(C[S.snap.cards[o.iid].no]) + ': ' + o.label, 'data-i="' + i + '"', 'act sm'));
          if (o.a === 'order' && o.iid === S.src) btn.push(B('เพลย์ออเดอร์นี้', 'data-i="' + i + '"', 'act'));
          if (o.a === 'varm' && o.iid === S.src) btn.push(B('อาร์มให้แวนการ์ด (Völundr)', 'data-i="' + i + '"', 'act'));
          if (o.a === 'next') btn.push(B(g.turnNo === 1 ? 'จบเทิร์น' : 'เข้าแบทเทิลเฟส', 'data-i="' + i + '"', 'pri'));
        });
        break;
      }
      case 'attack': s = S.src ? 'คลิกเป้าหมายที่เรืองแสงสีแดง' : 'คลิกยูนิทแถวหน้าของคุณ แล้วคลิกเป้าหมาย'; d.options.forEach((o, i) => { if (o.a === 'end') btn.push(B('จบเทิร์น', 'data-i="' + i + '"', 'pri')); }); break;
      case 'ride': s = 'คลิกการ์ดที่เรืองแสง (มือหรือไรด์เด็ค)'; d.options.forEach((o, i) => { if (o.a === 'skip') btn.push(B('ไม่ไรด์', 'data-i="' + i + '"')); else if (o.a === 'rideDeck') btn.push(B('ไรด์จากไรด์เด็ค: ' + dn(C[S.snap.cards[o.iid].no]), 'data-i="' + i + '"', 'pri')); }); break;
      case 'guard': s = guardInfo(d); btn.push(B(n ? 'การ์ด (' + n + ' ใบ)' : 'ไม่การ์ด', 'data-do="confirm"' + (guardBad(d) ? ' disabled' : ''), 'pri')); break;
      case 'mulligan': s = 'คลิกการ์ดในมือที่ต้องการเปลี่ยน'; btn.push(B(n ? 'เปลี่ยน ' + n + ' ใบ' : 'ไม่เปลี่ยน', 'data-do="confirm"', 'pri')); break;
      case 'cards': s = d.min === d.max ? 'เลือก ' + d.min + ' ใบ' : 'เลือก ' + d.min + '–' + d.max + ' ใบ'; if (!(d.min === 1 && d.max === 1)) btn.push(B(n ? 'ยืนยัน (' + n + ')' : (d.min === 0 ? 'ไม่เลือก' : 'ยืนยัน'), 'data-do="confirm"' + (n < d.min || n > d.max ? ' disabled' : ''), 'pri')); break;
      case 'circle': s = 'คลิกเซอร์เคิลที่เรืองแสง (คอลทับยูนิทเดิมได้)'; if (d.min === 0) btn.push(B('ข้าม', 'data-do="skip"')); break;
      default: s = d.sub || ''; { const pi = d.prefer ? Math.max(0, d.options.findIndex(o => o.id === d.prefer)) : 0; d.options.forEach((o, i) => btn.push(B(o.label, 'data-i="' + i + '"', i === pi ? 'pri' : ''))); }   // d.prefer: the recommended answer is the highlighted one
    }
  }
  if (d && d.man && !g.over && !S.busy && canAnswer(d) && !S.picker) btn.push(B('✋ ทำเอง', 'data-do="manual" title="ทำตามข้อความการ์ดด้วยมือ สำหรับสกิลที่ยังไม่ออโต้"', 'sm man'));
  const live = !!pendingForMe();
  // a decision about a skill (use it? which option?) is shown as a large panel over the board; the card it belongs to glows
  const ask = live && !S.picker && !!d && !['main', 'attack', 'ride', 'guard', 'mulligan', 'cards', 'circle'].includes(d.kind);
  el.className = (live ? 'live' : '') + (ask ? ' ask' : '');
  for (const k in S.els) S.els[k].classList.toggle('asking', ask && d.iid != null && +k === d.iid);
  const h = '<div class="pt">' + esc(t) + '</div>' + (s ? '<div class="ps">' + (d && d.kind === 'guard' && live && !S.picker ? s : esc(s)) + '</div>' : '') + (btn.length ? '<div class="pb">' + btn.join('') + '</div>' : '');
  if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
  const pri = live && !S.picker ? el.querySelector('.btn.pri:not([disabled])') : null; const cta = $('#cta');
  cta.hidden = !pri; if (pri) cta.textContent = pri.textContent;
}

/* ================= detail panel ================= */
function detailParts(no, iid) {
  const d = C[no]; if (!d) return null;
  const c = iid && S.snap ? S.snap.cards[iid] : null;
  let now = '';
  if (c && c.power !== undefined && (c.zone === 'VC' || c.zone === 'RC')) now = '<b class="now">ตอนนี้ ' + fmtP(c.power) + (c.crit > 1 ? ' ★' + c.crit : '') + '</b>';
  if (c && c.zone === 'GC') now = '<b class="now">ชิลด์ตอนนี้ ' + c.shield + '</b>';
  // overDress: what lies under this unit / which unit this card lies under
  let dress = '';
  if (c && c.dress && c.dress.length) dress = '<p class="betan">' + (c.xod ? 'สถานะ X-overDress' : 'สถานะ overDress') + ' · originalDress ' + c.dress.length + ' ใบ: ' + c.dress.map(i => esc(dn(C[S.snap.cards[i].no]))).join(', ') + '</p>';
  if (c && c.st && c.st.length) dress += '<p class="betan">อยู่ในสถานะ ' + c.st.map(x => esc(x.charAt(0).toUpperCase() + x.slice(1))).join(', ') + ' (จนกว่าจะออกจากสนาม)</p>';
  if (c && c.cbLess) dress += '<p class="betan">คอสต์เคาน์เตอร์บลาสต์ครั้งถัดไปของสกิล AUTO ที่เลือกไว้ลดลง 1 (เทิร์นนี้)</p>';
  if (c && c.zone === 'dress' && S.snap.cards[c.host]) dress = '<p class="betan">เป็น originalDress ของ ' + esc(dn(C[S.snap.cards[c.host].no])) + ' (ไม่นับเป็นยูนิท ไปไหนไปด้วยกันเมื่อยูนิทนั้นออกจากสนาม)</p>';
  if (c && c.zone === 'gauge') dress = '<p class="betan">เป็นเกจ' + (c.gk && !['bf', 'g'].includes(c.gk) ? ' ' + esc(c.gk.charAt(0).toUpperCase() + c.gk.slice(1)) : '') + (c.host != null && S.snap.cards[c.host] ? ' ของ ' + esc(dn(C[S.snap.cards[c.host].no])) : '') + (c.faceup ? '' : ' (คว่ำหน้า)') + '</p>';
  const chips = [];
  if (d.type === 'unit' || d.type === 'token') { chips.push('G' + d.grade, 'พลัง ' + d.power); if (d.shield != null) chips.push('ชิลด์ ' + d.shield); }
  if (d.ticket) chips.push('ทิกเก็ตการ์ด', 'เพลย์แบบบลิตซ์ออเดอร์', 'G' + d.grade);
  else if (d.type === 'order') chips.push(d.orderKind === 'set' ? 'เซ็ตออเดอร์' : d.orderKind === 'blitz' ? 'บลิตซ์ออเดอร์' : 'ออเดอร์', 'G' + d.grade);
  if (d.trigger) chips.push(VG.TRIG_TH[d.trigger]);
  if (d.drive === 2) chips.push('ทวินไดรฟ์'); if (d.drive === 3) chips.push('ทริปเปิลไดรฟ์'); if (d.persona) chips.push('เพอร์โซน่าไรด์'); if (d.boost) chips.push('บูสต์'); if (d.intercept) chips.push('อินเตอร์เซปต์'); if (d.sentinel) chips.push('เซนทิเนล');
  const sub = [d.nation, d.race, d.no.startsWith('TOKEN') ? 'โทเคน' : dno(d)].filter(Boolean).join(' · ');
  return { d, c, now, dress, chips, sub, text: dress + (d.auto && !(d.text || []).length ? '<p class="empty">ไม่มีสกิล</p>' : cardNote(d)) };
}
/* the small preview at the side of the table (pointer over a card); the full text is in the card window */
function showDetail(no, iid) {
  const q = detailParts(no, iid); if (!q) return; const d = q.d;
  const head = '<div class="dn">' + esc(dn(d)) + tagOf(d) + '</div>' + (dj(d) ? '<div class="dm">' + esc(dj(d)) + '</div>' : '') + '<div class="dm">' + esc(q.sub) + '</div>'
    + '<div class="ds">' + q.chips.map(x => '<b>' + esc(x) + '</b>').join('') + q.now + '</div>';
  const text = '<div class="dt">' + q.text + '</div>';
  const more = '<button type="button" class="dmore" data-open-card="1">🔍 เปิดหน้าต่างอ่านการ์ด</button>';
  $('#detail').innerHTML = S.lay === 'port' ? '<div class="dcol">' + head + text + more + '</div>' : '<div class="dtop"><div class="dprev">' + staticCard(no, true) + '</div><div class="dinfo">' + head + '</div></div>' + text + more;
  $('#detail').dataset.no = no; $('#detail').dataset.iid = iid || '';
}
/* ================= card window: click a card → a large window with its face, numbers and skills ================= */
const CW = { no: null, iid: null, foot: null };
function openCard(no, iid, o) {
  const q = detailParts(no, iid); if (!q) return; const d = q.d; const m = $('#cardwin'); const was = !m.hidden;
  CW.no = no; CW.iid = iid || null; CW.foot = (o && o.foot) || null; CW.act = (o && o.act) || null; CW.back = was ? CW.back : document.activeElement;
  const where = q.c ? ({ VC: 'แวนการ์ด', RC: 'เรียร์การ์ด', GC: 'การ์เดี้ยน', hand: 'ในมือ', drop: 'ดรอปโซน', soul: 'โซล', damage: 'ดาเมจโซน', bind: 'ไบนด์โซน', order: 'ออเดอร์โซน', deck: 'เด็ค', ride: 'ไรด์เด็ค', crest: 'เครสต์', removed: 'นอกเกม', dress: 'originalDress', gauge: 'เกจ', prison: 'ถูกขังในพริซัน', gzone: 'G โซน', memory: 'เมมโมรี่', mbox: 'Monster BOX', heart: 'ฮาร์ท (ใต้ G ยูนิท)', arms: 'อาร์มอยู่บน VC', music: 'มิวสิกบน RC แถวหลังกลาง', trigger: 'กำลังเช็ค' }[q.c.zone] || '') : '';
  m.innerHTML = '<div class="cw" role="dialog" aria-modal="true" aria-label="' + esc(dn(d)) + '">'
    + '<button type="button" class="cw-x" data-cwclose="1" aria-label="ปิด">✕</button>'
    + '<div class="cw-face">' + staticCard(no, true) + (where ? '<span class="cw-where">' + where + (q.c && q.c.owner != null && S.snap ? ' · ' + esc(S.snap.players[q.c.owner].name) : '') + '</span>' : '') + '</div>'
    + '<div class="cw-body"><p class="cw-eye">' + esc(q.sub) + '</p><h2>' + esc(dn(d)) + tagOf(d) + '</h2>' + (dj(d) ? '<p class="cw-jp">' + esc(dj(d)) + '</p>' : '')
    + '<div class="cw-stats">' + q.chips.map(x => '<b>' + esc(x) + '</b>').join('') + q.now + '</div>'
    + '<div class="cw-text">' + q.text + '</div>'
    + '<div class="cw-foot">' + (CW.foot ? CW.foot(no) : '')
    + (q.c && q.c.zone === 'VC' && S.snap ? '<button type="button" class="btn" data-cwzone="soul" data-p="' + q.c.owner + '"' + (S.snap.players[q.c.owner].soul.length ? '' : ' disabled') + '>ดูโซล (' + S.snap.players[q.c.owner].soul.length + ' ใบ)</button>' : '')
    + (q.c && q.c.dress && q.c.dress.length ? '<button type="button" class="btn" data-cwzone="dress">ดู originalDress (' + q.c.dress.length + ' ใบ)</button>' : '')
    + '<button type="button" class="btn pri" data-cwclose="1">ปิด</button></div></div></div>';
  m.hidden = false; if (!was) Sfx.open();
  const x = m.querySelector('.cw-x'); if (x) x.focus();
}
function closeCard() { const m = $('#cardwin'); if (m.hidden) return; m.hidden = true; m.innerHTML = ''; Sfx.close(); const b = CW.back; CW.back = null; CW.foot = null; CW.act = null; if (b && b.focus && document.contains(b)) b.focus(); }
/* ================= effects ================= */
function pop(x, y, text, cls) {
  const e = document.createElement('div'); e.className = 'pop ' + (cls || ''); e.textContent = text; e.style.left = x + 'px'; e.style.top = y + 'px';
  $('#hud').appendChild(e); setTimeout(() => e.remove(), 1150);
}
function popAt(iid, text, cls, dy) { const p = S.pl[iid]; if (p) pop(p.x, p.y + (dy || -40) * (p.k || 1), text, cls); }
/* a slanted band sweeping across the table with a title: turn start, ride, trigger, battle */
function cutin(title, sub, cls, ms) {
  const e = $('#cutin'); e.className = '';
  e.innerHTML = '<div class="ci-band"></div><div class="ci-t"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  e.style.setProperty('--ms', Math.max(260, Math.round((ms || 1000) / S.speed)) + 'ms');
  void e.offsetWidth; e.className = 'show ' + (cls || '');
}
function banner(text, sub) { cutin(text, sub, 'gold', 1000); }
function sprite(cls, x, y, ms, k) {
  const e = document.createElement('div'); e.className = 'sp ' + cls; e.style.left = x + 'px'; e.style.top = y + 'px'; if (k) e.style.setProperty('--k', k);
  $('#hud').appendChild(e); setTimeout(() => e.remove(), ms || 700); return e;
}
function skillToast(p, name) {
  const L = LAY[S.lay]; const at = p === S.viewer ? L.plate : L.oppPlate;
  const e = document.createElement('div'); e.className = 'sk' + (p === S.viewer ? ' me' : ' opp'); e.innerHTML = '<small>SKILL</small>' + esc(name);
  e.style.left = at[0] + 'px'; e.style.top = (at[1] + (p === S.viewer ? -40 : 74)) + 'px';
  $('#hud').appendChild(e); setTimeout(() => e.remove(), 1300);
}
function mark(iid, cls, ms) { const el = S.els[iid]; if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
function quake() { const st = $('#scene'); st.classList.remove('quake'); void st.offsetWidth; st.classList.add('quake'); setTimeout(() => st.classList.remove('quake'), 420); }
function logLine(text, cls) { const l = $('#log'); const e = document.createElement('div'); e.className = cls || ''; e.textContent = text; l.appendChild(e); l.scrollTop = l.scrollHeight; }
function dur(e) {
  let d;
  switch (e.t) {
    case 'move': d = e.reason === 'draw' ? (S.snap && S.snap.turnNo === 0 ? 70 : 200) : e.reason === 'guardEnd' ? 70 : /Check$/.test(e.reason) ? 110 : e.reason === 'mulligan' ? 90 : e.reason === 'ride' && e.to === 'VC' ? 620 : e.to === 'damage' ? 420 : 280; break;
    case 'check': d = e.trigger ? 1350 : 780; break;
    case 'attack': d = 700; break; case 'result': d = 820; break; case 'ability': d = 760; break; case 'stand': d = e.iid != null && S.snap && S.snap.phase !== 'stand' ? 260 : 50; break;
    case 'phase': d = e.phase === 'stand' || e.phase === 'draw' || e.phase === 'mulligan' ? 140 : e.phase === 'battle' ? 520 : 300; break;
    case 'turn': d = 1050; break; case 'mod': d = 240; break; case 'cost': case 'energy': d = 220; break;
    case 'marker': d = 420; break;
    case 'persona': case 'standup': d = 1100; break; case 'state': d = 900; break; case 'reveal': d = 800; break; case 'lock': d = 450; break; case 'shuffle': d = 110; break;
    default: d = 50;
  }
  return d / S.speed;
}
function fx(e) {
  const L = LAY[S.lay]; const sn = e.snap; const side = p => (p === S.viewer ? 'me' : 'opp');
  switch (e.t) {
    case 'turn': cutin('TURN ' + e.n, sn.players[e.p].name, side(e.p), 1000); logLine('— เทิร์น ' + e.n + ' · ' + sn.players[e.p].name + ' —', 't'); break;
    case 'standup': cutin('STAND UP', 'VANGUARD!', 'gold', 1050); break;
    case 'phase': if (e.phase === 'battle' && sn.turnNo > 1) cutin('BATTLE', 'PHASE', side(e.p) + ' small', 560); break;
    case 'persona': cutin('PERSONA RIDE', 'จั่ว 1 ใบ · แถวหน้า +10000', 'gold', 1100); { const q = scrOf(e.p, L.circles.V, 4); sprite('ring gold', q[0], q[1], 900, q[2]); sprite('pillar gold', q[0], q[1], 900, q[2]); sprite('sparks gold', q[0], q[1], 700, q[2]); sprite('flashall gold', 0, 0, 480); } break;
    case 'move': {
      if (e.reason === 'ride' && e.to === 'VC') { const q = scrOf(e.p, L.circles.V, 4); sprite('ring ' + side(e.p), q[0], q[1], 800, q[2]); sprite('pillar ' + side(e.p), q[0], q[1], 800, q[2]); sprite('glyph ' + side(e.p), q[0], q[1], 850, q[2]); sprite('sparks ' + side(e.p), q[0], q[1], 600, q[2]); const c = sn.cards[e.iid]; if (c && sn.turnNo > 0) cutin('RIDE', dn(C[c.no]), side(e.p) + ' small', 640); }
      else if (e.to === 'RC' && e.from !== 'RC' && e.from !== 'VC') { const p = S.pl[e.iid]; if (p) { sprite('shock sm ' + side(e.p), p.x, p.y, 460, p.k); sprite('ring sm ' + side(e.p), p.x, p.y, 520, p.k); mark(e.iid, 'landed', 420); } }
      else if (e.from === 'RC' && e.fromPos && L.circles[e.fromPos] && (e.to === 'drop' || e.to === 'gone' || e.to === 'bind') && e.reason !== 'ride') { const q = scrOf(e.p, L.circles[e.fromPos], 4); sprite('xslash', q[0], q[1], 520, q[2]); sprite('shock sm opp', q[0], q[1], 460, q[2]); pop(q[0], q[1] - 34 * q[2], e.to === 'bind' ? 'BIND' : 'RETIRE', 'bad'); }
      else if (e.from === 'RC' && e.fromPos && L.circles[e.fromPos] && e.to === 'hand') { const q = scrOf(e.p, L.circles[e.fromPos], 4); sprite('ring sm ' + side(e.p), q[0], q[1], 520, q[2]); pop(q[0], q[1] - 30 * q[2], 'RETURN'); }
      else if (e.to === 'damage') { sprite('dmgflash ' + side(e.p), 0, 0, 520); quake(); const D = L.damage; const q = scrOf(e.p, [D.x, D.y + D.step * 2], 4); sprite('shock opp', q[0], q[1], 600, q[2]); pop(q[0], q[1] - 50 * q[2], 'DAMAGE', 'bad big'); }
      else if (e.from === 'damage' && e.to === 'drop') { const D = L.damage; const q = scrOf(e.p, [D.x, D.y + D.step * 2], 4); sprite('healfx', q[0], q[1], 900, q[2]); pop(q[0], q[1] - 40 * q[2], 'HEAL', 'ok big'); }
      break;
    }
    case 'check': {
      pop(L.trigger[0], L.trigger[1] - 126, e.kind === 'drive' ? 'DRIVE CHECK' : 'DAMAGE CHECK', e.kind === 'drive' ? '' : 'bad');
      if (e.trigger) { sprite('burst t-' + e.trigger, L.trigger[0], L.trigger[1], 1300); sprite('flashall t-' + e.trigger, 0, 0, 520); cutin(TRIG[e.trigger] + ' TRIGGER', dn(C[e.no]), 'trg t-' + e.trigger, 1150); }
      showDetail(e.no); break;
    }
    case 'attack': { mark(e.attacker, 'lunge', 520); const p = S.pl[e.attacker]; if (p) { sprite('glyph opp', p.x, p.y, 620, p.k); sprite('sparks opp', p.x, p.y, 480, p.k * 0.8); } if (e.booster) { mark(e.booster, 'flash', 520); const b = S.pl[e.booster]; if (b) sprite('buff gold', b.x, b.y, 650, b.k); popAt(e.booster, 'BOOST', '', -20); } break; }
    case 'result': {
      const p = S.pl[e.target];
      const tc = sn.cards[e.target]; const onVG = tc && tc.zone === 'VC';
      if (e.hit) { mark(e.target, 'struck', 560); if (p) { sprite('slash', p.x, p.y, 460, p.k); sprite('shock opp', p.x, p.y, 620, p.k); sprite('sparks opp', p.x, p.y, 560, p.k * (onVG ? 1.25 : 1)); } popAt(e.target, 'HIT!', 'bad big'); if (onVG) { quake(); sprite('flashall opp', 0, 0, 380); } }
      else { if (p) { sprite('guardfx', p.x, p.y, 680, p.k * 1.25); sprite('ring sm me', p.x, p.y, 520, p.k); } popAt(e.target, 'GUARD', 'ok big'); }
      break;
    }
    case 'ability': { mark(e.iid, 'flash', 750); const c = sn.cards[e.iid]; const p = S.pl[e.iid]; if (p) { sprite('glyph gold', p.x, p.y, 850, p.k * 1.1); sprite('sparks gold', p.x, p.y, 600, p.k); pop(p.x, p.y - 62 * (p.k || 1), 'SKILL', 'skl'); } if (c) { showDetail(e.no, e.iid); skillToast(e.p, dn(C[e.no])); } break; }
    case 'stand': { const c = e.iid != null ? sn.cards[e.iid] : null; if (c && !c.rest && sn.phase !== 'stand') { const p = S.pl[e.iid]; if (p) { sprite('ring sm gold', p.x, p.y, 520, p.k); sprite('buff gold', p.x, p.y, 650, p.k); } popAt(e.iid, 'STAND', 'ok', -24); } break; }
    case 'mod': { const m = e.mod; const a = []; if (m.power) a.push((m.power >= 100000000 ? '+100M' : (m.power > 0 ? '+' : '') + m.power)); if (m.crit) a.push('★' + (m.crit > 0 ? '+' : '') + m.crit); if (m.shield && !m.power) a.push('ชิลด์ ' + (m.shield > 0 ? '+' : '') + m.shield); if (m.drive) a.push('ไดรฟ์ ' + (m.drive > 0 ? '+' : '') + m.drive); if (a.length) { popAt(e.iid, a.join(' '), m.power < 0 ? 'bad' : '', -30); const p = S.pl[e.iid]; if (p) sprite('buff ' + (m.power < 0 ? 'opp down' : m.crit ? 'gold' : 'me'), p.x, p.y, 650, p.k); } break; }
    case 'energy': { const at = e.p === S.viewer ? L.plate : L.oppPlate; pop(at[0] + 150, at[1] + 10, 'EN ' + (e.n > 0 ? '+' : '') + e.n, e.n > 0 ? 'ok' : ''); break; }
    case 'cost': { const D = L.damage; const q = e.kind === 'SB' ? scrOf(e.p, L.circles.V, 4) : scrOf(e.p, [D.x, D.y + D.step * 2], 4); pop(q[0], q[1], e.kind + ' ' + e.n, e.kind === 'CC' ? 'ok' : ''); break; }
    case 'lock': popAt(e.iid, 'LOCK', 'bad'); break;
    case 'state': cutin(e.name.toUpperCase(), sn.players[e.p].name, side(e.p), 900); break;
    case 'reveal': if (sn.cards[e.iid]) { showDetail(sn.cards[e.iid].no); cutin('REVEAL', dn(C[sn.cards[e.iid].no]), 'small', 700); } break;
    case 'shuffle': { const q = scrOf(e.p, L.deck, 20); pop(q[0], q[1] - 40, 'SHUFFLE'); break; }
    case 'marker': { const xy = L.circles[e.k]; if (xy) { const q = scrOf(e.p, xy, 4); sprite('ring sm gold', q[0], q[1], 620, q[2]); sprite('glyph gold', q[0], q[1], 700, q[2]); pop(q[0], q[1] - 40 * q[2], e.n > 0 ? 'MARKER' : 'MARKER −', e.n > 0 ? 'ok' : ''); } break; }
  }
}
/* cards turned over by a skill (revealed from the deck, or looked at by their owner) are shown together in one strip, so the player sees what came up */
function showCards(title, nos, who) {
  const box = $('#revealBar'); if (!box || !nos.length) return;
  clearTimeout(S.revT);
  box.innerHTML = '<div class="rv-h"><b>' + esc(title) + '</b><span>' + esc(who) + ' · ' + nos.length + ' ใบ</span><button type="button" class="rv-x" aria-label="ปิด">✕</button></div><div class="rv-row">' + nos.map(no => '<span class="rv-c" data-no="' + esc(no) + '">' + staticCard(no, true) + '<i>' + esc(dn(C[no])) + '</i></span>').join('') + '</div>';
  box.hidden = false; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  S.revT = setTimeout(() => { box.hidden = true; }, Math.max(3200, 900 * nos.length) / Math.min(S.speed, 2));
}
async function play(events) {
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    if (e.t === 'log') { logLine(e.text, e.p === undefined ? '' : 'p' + e.p); continue; }
    if (!e.snap) continue;
    if (e.t === 'reveal') {   // a run of reveals (logs between them included) becomes one strip
      const grp = [e]; let j = k + 1;
      for (; j < events.length; j++) { const x = events[j]; if (x.t === 'log') { logLine(x.text, x.p === undefined ? '' : 'p' + x.p); continue; } if (x.t === 'reveal' && x.p === e.p) { grp.push(x); continue; } break; }
      k = j - 1; const last = grp[grp.length - 1]; S.snap = last.snap; render();
      const nos = grp.map(x => x.snap.cards[x.iid] && x.snap.cards[x.iid].no).filter(Boolean);
      if (nos.length) { showDetail(nos[nos.length - 1]); showCards('การ์ดที่เปิดเผย', nos, last.snap.players[e.p].name); cutin('REVEAL', nos.length > 1 ? nos.length + ' ใบ' : dn(C[nos[0]]), 'small', 700); }
      snd(e); await sleep((700 + 120 * nos.length) / S.speed); continue;
    }
    if (e.t === 'look') { S.snap = e.snap; render(); const mine = S.mode !== 'online' || e.own === S.seat; const nos = (e.iids || []).map(i => e.snap.cards[i] && e.snap.cards[i].no).filter(Boolean); if (mine && nos.length) showCards('ดูการ์ดบนสุดของเด็ค', nos, e.snap.players[e.own].name); else if (nos.length) logLine(e.snap.players[e.p].name + ' ดูการ์ดบนสุดของเด็ค ' + nos.length + ' ใบ', 'p' + e.p); await sleep(250 / S.speed); continue; }
    S.snap = e.snap;
    if (S.mode === 'solo' && S.view === 'auto' && e.t === 'turn' && S.viewer !== e.p) { S.viewer = e.p; buildZones(); }
    render(); fx(e); snd(e);
    await sleep(dur(e));
  }
}

/* ================= game loop ================= */
async function run() {
  if (S.running) { S.again = true; return; }
  S.running = true;
  const g = S.game;
  try {
    for (;;) {
      S.again = false;
      if (S.game !== g) return;
      if (g.events.length) { S.busy = true; renderPrompt(); await play(g.events.splice(0)); if (S.game !== g) return; }
      S.snap = g.snapshot();
      if (g.over || !g.pending) break;
      const d = g.pending;
      if (S.mode === 'online') {
        // each seat keeps its own ordered list of answers; the engine says whose answer comes next
        const raw = Net.lists[d.player][Net.used[d.player]];
        if (raw === undefined) break;
        const sel = raw === '' ? [] : String(raw).split(',').map(Number);
        if (g.validate(sel)) { Net.fail('ข้อมูลห้องไม่ตรงกัน กรุณาเข้าห้องใหม่'); break; }
        const lag = Net.lists[0].length + Net.lists[1].length - g.history.length;
        Net.used[d.player]++;
        if (lag > 4) { g.snapOn = false; g.answer(sel); g.snapOn = true; g.events.length = 0; } else g.answer(sel);
        if (d.player === S.seat) S.sending = false;
        continue;
      }
      if (S.mode === 'bot' && d.player !== S.seat) { S.busy = false; render(); S.busy = true; await sleep(480 / S.speed); if (S.game !== g) return; g.answer(VG.bot(g)); save(); continue; }
      break;
    }
  } finally { S.running = false; S.busy = false; }
  if (S.game !== g) return;
  if (S.mode === 'solo' && S.view === 'auto' && g.pending && S.snap.turnNo === 0 && S.viewer !== g.pending.player && g.pending.kind === 'mulligan') { S.viewer = g.pending.player; buildZones(); }
  S.src = null; S.picks = new Set();
  render();
  if (g.over) showEnd(); else present();
  if (S.again) run();
}
function present() {
  const d = pendingForMe();
  if (!d) { const gp = S.game && S.game.pending; if (!(S.man && gp && gp.man && (S.mode === 'solo' || gp.player === S.seat))) S.man = null; closePicker(); return; }
  // a half-automatic skill is waiting: put its card in the detail panel so the player can read what to do by hand
  { const g = S.game; const ab = d.kind === 'yesno' && d.idx != null && d.iid != null && g ? g.getAb(g.cards[d.iid], d.idx) : null; const key = (g ? g.history.length : 0) + ':' + d.iid;
    if ((d.manstep || (ab && ab.assist)) && d.iid != null && S.shownFor !== key && g && g.cards[d.iid]) { S.shownFor = key; showDetail(g.cards[d.iid].no, d.iid); } }
  if (S.man) { if (d.man) { S.picker = null; openManual(); render(); return; } S.man = null; }
  if (needsPicker(d)) openPicker(d); else closePicker();
  render();
}
function submit(sel) {
  const g = S.game; const d = pendingForMe(); if (!d) return;
  if (g.validate(sel)) return;
  closePicker(); S.src = null; S.picks = new Set();
  if (S.mode === 'online') { S.sending = true; renderPrompt(); Net.send(sel).catch(() => { S.sending = false; Net.fail('ส่งคำสั่งไม่สำเร็จ ลองอีกครั้ง'); render(); }); return; }
  g.answer(sel); save(); run();
}
function save() {
  if (S.mode === 'online' || !S.meta) return;
  store.set('vg.save', Object.assign({}, S.meta, { history: S.game.history }));
}
function newLocal(o) {
  S.mode = o.mode; S.seat = o.mode === 'bot' ? 0 : 0; S.meta = { mode: o.mode, decks: o.decks.slice(), names: o.names, first: o.first, seed: o.seed };
  S.cfg = { seed: o.seed, first: o.first, players: [{ name: o.names[0], deck: VG.DECKS[o.decks[0]] }, { name: o.names[1], deck: VG.DECKS[o.decks[1]] }] };
  let g = null;
  if (o.history && o.history.length) { try { g = VG.Game.replay(S.cfg, o.history); g.snapOn = true; g.events.length = 0; } catch (e) { g = null; store.del('vg.save'); } }
  if (!g) { g = new VG.Game(S.cfg); g.snapOn = true; g.start(); }
  openTable(g);
}
function openTable(g) {
  S.game = g; S.running = false; S.busy = false; S.sending = false; S.src = null; S.picks = new Set(); S.picker = null; S.view = 'auto'; $('#mFlip').textContent = 'มุมมอง: ตามเทิร์น';
  for (const k in S.els) S.els[k].remove(); S.els = {};
  $('#log').innerHTML = '<h3>บันทึกเกม</h3>'; $('#detail').innerHTML = '<div class="empty">ชี้หรือแตะการ์ดเพื่อดูรายละเอียด</div>';
  $('#endov').hidden = true; closePicker(); S.man = null;
  $('#lobby').hidden = true; $('#table').hidden = false;
  $('#mUndo').hidden = S.mode === 'online'; $('#mFlip').hidden = S.mode !== 'solo';
  S.viewer = S.mode === 'solo' ? (g.events.length ? g.first : g.active) : S.seat;
  // first frame: everything where the first snapshot says it is
  const first = g.events.find(e => e.snap); S.snap = first ? first.snap : g.snapshot();
  S.lay = null; fit(); autoWarm(g);
  run();
}
function undo() {
  if (S.mode === 'online' || S.running || !S.game) return;
  const h = S.game.history.slice(); if (!h.length) return;
  let g;
  for (;;) { h.pop(); g = VG.Game.replay(S.cfg, h); if (S.mode !== 'bot' || !h.length || (g.pending && g.pending.player === S.seat)) break; }
  g.snapOn = true; g.events.length = 0; S.game = g; S.snap = g.snapshot(); S.src = null; S.picks = new Set(); closePicker(); S.man = null; $('#endov').hidden = true;
  if (S.mode === 'solo' && S.view === 'auto' && S.viewer !== g.active) { S.viewer = g.active; buildZones(); }
  logLine('↩ ย้อนกลับ 1 การตัดสินใจ', 't'); save(); render(); present();
}
function exitTable() {
  if (S.mode === 'online') Net.leave();
  S.game = null; closePicker(); S.man = null; $('#endov').hidden = true; $('#table').hidden = true; $('#lobby').hidden = false; renderLobby();
}
function showEnd() {
  const g = S.game; const o = g.over; const m = $('#endov');
  try { Acct.record(g); } catch (e) { /* history is best effort */ }
  const why = o.reason === 'damage' ? 'ดาเมจครบ 6' : 'เด็คหมด';
  const solo = S.mode === 'solo'; const won = solo || o.winner === S.seat; const W = g.players[o.winner], Lz = g.players[1 - o.winner];
  m.innerHTML = '<div class="mbox ' + (won ? 'win' : 'lose') + '"><i class="rays" aria-hidden="true"></i><p class="end-eye">Fight result · turn ' + g.turnNo + '</p><h2 class="end-big">' + (solo ? 'FIGHT END' : won ? 'VICTORY' : 'DEFEAT') + '</h2>'
    + '<p class="end-name">' + esc(W.name) + ' ชนะ</p><p class="msub">' + esc(Lz.name) + ' แพ้เพราะ' + why + '</p>'
    + '<div class="end-stats"><b>ดาเมจ ' + g.players[0].damage.length + ' : ' + g.players[1].damage.length + '</b><b>เด็คเหลือ ' + g.players[0].deck.length + ' : ' + g.players[1].deck.length + '</b><b>' + g.history.length + ' การตัดสินใจ</b></div>'
    + '<div class="mfoot">' + (S.mode === 'online' ? '' : '<button type="button" class="btn pri" data-end="again">เล่นอีกครั้ง (สับใหม่)</button><button type="button" class="btn" data-end="undo">ย้อนกลับ 1 ครั้ง</button>') + '<button type="button" class="btn" data-end="exit">กลับหน้าแรก</button></div></div>';
  m.hidden = false; Sfx.play(S.mode === 'solo' || o.winner === S.seat ? 'win' : 'lose');
  if (S.mode !== 'online') store.del('vg.save');
}

/* ================= picker modal ================= */
function openPicker(d, view) {
  const m = $('#picker'); S.picker = { d, view };
  const g = S.game;
  const items = view ? view.iids.map(iid => ({ iid })) : d.options.map((o, i) => ({ iid: o.iid, i, o }));
  if (!view && d.zone === 'deck') items.sort((a, b) => (C[S.snap.cards[b.iid].no].grade || 0) - (C[S.snap.cards[a.iid].no].grade || 0) || C[S.snap.cards[a.iid].no].name.localeCompare(C[S.snap.cards[b.iid].no].name));
  const cardOf = iid => S.snap.cards[iid] || g.cards[iid];
  const tag = it => { const c = cardOf(it.iid); if (it.o && it.o.a === 'intercept') return 'อินเตอร์เซปต์ ' + shieldOf(it.iid); if (it.o && it.o.a === 'blitz') return 'บลิตซ์ออเดอร์'; if (d && d.kind === 'guard') return 'ชิลด์ ' + shieldOf(it.iid); if (c.zone === 'drop') return 'ดรอป'; if (c.zone === 'hand') return 'มือ'; if (c.zone === 'damage') return c.faceup ? 'หงาย' : 'คว่ำ'; return ''; };
  const single = !view && d.min === 1 && d.max === 1;
  const title = view ? view.title : (S.mode === 'solo' ? '[' + g.players[d.player].name + '] ' : '') + d.title;
  const sub = view ? items.length + ' ใบ' : d.kind === 'guard' ? guardInfo(d) : (d.min === d.max ? 'เลือก ' + d.min + ' ใบ' : 'เลือก ' + d.min + '–' + d.max + ' ใบ');
  const n = S.picks.size;
  m.innerHTML = '<div class="mbox"><h2>' + esc(title) + '</h2><p class="msub" id="pkSub">' + sub + '</p><div class="mgrid">'
    + (items.length ? items.map(it => { const c = cardOf(it.iid); const up = view || d.zone !== 'damage' || c.faceup || true; const va = view && view.acts && view.acts[it.iid]; const card = '<button type="button" class="mcard' + (view ? ' view' : '') + (va ? ' act' : '') + (it.i !== undefined && S.picks.has(it.i) ? ' on' : '') + '" data-pk="' + (it.i === undefined ? '' : it.i) + '" data-no="' + esc(c.no) + '">' + staticCard(c.no, up) + '<span class="tagline">' + esc(tag(it)) + '</span></button>'; return va ? '<div class="mact">' + card + va.map(a => '<button type="button" class="btn act sm" data-vi="' + a.i + '">' + esc(a.lb) + '</button>').join('') + '</div>' : card; }).join('') : '<p class="msub">ไม่มีการ์ด</p>')
    + '</div><div class="mfoot"><button type="button" class="btn peekbtn" data-peek="1">ซ่อนเพื่อดูสนาม</button>'
    + (view ? '<button type="button" class="btn pri" data-close="1">ปิด</button>'
      : (single ? '' : '<button type="button" class="btn pri" data-pkok="1"' + (n < d.min || n > d.max || (d.kind === 'guard' && guardBad(d)) ? ' disabled' : '') + '>' + (d.kind === 'guard' ? (n ? 'การ์ด (' + n + ' ใบ)' : 'ไม่การ์ด') : d.kind === 'mulligan' ? (n ? 'เปลี่ยน ' + n + ' ใบ' : 'ไม่เปลี่ยน') : (n ? 'ยืนยัน (' + n + ')' : d.min === 0 ? 'ไม่เลือก' : 'ยืนยัน')) + '</button>'))
    + '</div></div>';
  m.hidden = false; m.classList.remove('peek');
}
function closePicker() { S.picker = null; const m = $('#picker'); m.hidden = true; m.innerHTML = ''; }
function pickToggle(i) {
  const d = S.picker ? S.picker.d : pendingForMe(); if (!d) return;
  if (d.min === 1 && d.max === 1) { submit([i]); return; }
  if (S.picks.has(i)) { S.picks.delete(i); Sfx.play('unselect'); } else { if (S.picks.size >= d.max) { if (d.max === 1) S.picks.clear(); else { Sfx.play('deny'); return; } } S.picks.add(i); Sfx.play('select'); }
  if (S.picker) openPicker(d); else render();
}
function viewZone(p, z) {
  const sn = S.snap; if (!sn) return; const P = sn.players[p];
  if (z === 'deck') return;
  if (z === 'ride' && !(S.mode === 'solo' || p === S.seat)) return;
  const names = { drop: 'ดรอปโซน', order: 'ออเดอร์โซน', damage: 'ดาเมจโซน', soul: 'โซล', removed: 'การ์ดที่นำออกจากเกม', bind: 'ไบนด์โซน', ride: 'ไรด์เด็ค', gauge: 'เกจ', prison: 'การ์ดที่ถูกขังในพริซันของคู่ต่อสู้' };
  const iids = P[z].slice(); if (z === 'damage') { /* face-down damage is still public information about which card it is */ }
  const acts = pileActs(p, z); if (Object.keys(acts).length) iids.sort((a, b) => (acts[b] ? 1 : 0) - (acts[a] ? 1 : 0));
  openPicker(null, { title: names[z] + ' — ' + P.name + (Object.keys(acts).length ? ' · ใช้สกิลจากการ์ดที่เรืองแสงได้' : ''), iids, acts });
}

/* ================= "do it by hand" tools: carry out what a card says when its skill is not automatic ================= */
const MAN_TABS = [['hand', 'มือ'], ['field', 'สนาม'], ['drop', 'ดรอป'], ['soul', 'โซล'], ['damage', 'ดาเมจ'], ['bind', 'ไบนด์'], ['order', 'ออเดอร์'], ['deck', 'เด็ค'], ['ride', 'ไรด์เด็ค'], ['opp', 'เรียร์การ์ดคู่ต่อสู้']];
const CIRC_TH = { FL: 'หน้าซ้าย', BL: 'หลังซ้าย', BC: 'หลังกลาง', BR: 'หลังขวา', FR: 'หน้าขวา' };
function manList(g, p, tab) {
  const P = g.players[p];
  if (tab === 'field') return g.units(p).map(c => c.iid).concat(P.GC);
  if (tab === 'opp') return g.rcs(1 - p).map(c => c.iid);
  if (tab === 'deck') { const n = S.man.look; if (n == null) return []; if (n > 0) return P.deck.slice(0, n); return P.deck.slice().sort((a, b) => (C[g.cards[b].no].grade || 0) - (C[g.cards[a].no].grade || 0) || C[g.cards[a].no].name.localeCompare(C[g.cards[b].no].name)); }
  return P[tab].slice();
}
function openManual() {
  const g = S.game; const d = pendingForMe(); const m = $('#picker');
  if (!d || !d.man) { S.man = null; return; }
  const p = d.player; const P = g.players[p]; const st = S.man || (S.man = { tab: 'hand', sel: null, until: 0, look: null });
  const M = VG.MAN.op; const DEST = k => VG.MAN.dest.indexOf(k); const KEY = k => VG.MAN.key.indexOf(k);
  const ok = a => !g.validate([-1].concat(a));
  const btn = (label, a, keep) => (ok(a) ? '<button type="button" class="btn sm" data-man="' + a.join(',') + '">' + esc(label) + '</button>' : keep ? '<button type="button" class="btn sm" disabled>' + esc(label) + '</button>' : '');
  const quick = btn('จั่ว 1 ใบ', [M.draw, 1], 1) + btn('โซลชาร์จ 1', [M.sc, 1], 1) + btn('เคาน์เตอร์ชาร์จ 1', [M.cc, 1], 1) + btn('เคาน์เตอร์บลาสต์ 1', [M.cb, 1], 1) + (P.crest.length ? btn('พลังงาน +1', [M.ec, 1], 1) + btn('พลังงาน −1', [M.ec, -1], 1) : '') + btn('ทิ้งใบบนสุดของเด็ค', [M.mill, 1], 1) + btn('สับเด็ค', [M.shuf], 1);
  const count = k => (k === 'deck' ? P.deck.length : manList(g, p, k).length);
  const list = manList(g, p, st.tab); if (st.sel != null && !list.includes(st.sel)) st.sel = null;
  const tagOfCard = c => (c.zone === 'VC' ? 'แวนการ์ด' : c.zone === 'RC' ? CIRC_TH[c.pos] + (c.rest ? ' · เรสต์' : '') : c.zone === 'GC' ? 'การ์เดี้ยน' : c.zone === 'damage' ? (c.faceup ? 'หงาย' : 'คว่ำ') : c.zone === 'deck' && st.look > 0 ? 'ใบที่ ' + (P.deck.indexOf(c.iid) + 1) + ' จากบน' : '');
  let deckBar = '';
  if (st.tab === 'deck') deckBar = '<div class="manrow"><span class="lab">ดูการ์ดในเด็ค (บันทึกลงล็อก):</span>' + [1, 2, 3, 5, 7].map(n => '<button type="button" class="btn sm" data-look="' + n + '"' + (P.deck.length < n ? ' disabled' : '') + '>บนสุด ' + n + ' ใบ</button>').join('') + '<button type="button" class="btn sm" data-look="0">ค้นทั้งเด็ค</button>' + (st.look === 0 ? '<span class="lab">ค้นเสร็จแล้วอย่าลืมกด “สับเด็ค”</span>' : '') + '</div>';
  let act = '<p class="msub">คลิกการ์ดด้านบนเพื่อเลือก แล้วเลือกว่าจะทำอะไรกับการ์ดใบนั้น</p>';
  if (st.sel != null) {
    const c = g.cards[st.sel]; const df = C[c.no]; const own = c.owner === p; const onF = c.zone === 'VC' || c.zone === 'RC' || c.zone === 'GC'; const rows = [];
    if (own) {
      const mv = [['hand', 'ขึ้นมือ'], ['drop', onF ? 'รีไทร์ (ลงดรอป)' : 'ลงดรอป'], ['soul', 'เข้าโซล'], ['bind', 'ไบนด์'], ['top', 'บนสุดของเด็ค'], ['bottom', 'ล่างสุดของเด็ค'], ['damage', 'ดาเมจโซน'], ['order', 'ออเดอร์โซน'], ['removed', 'นำออกจากเกม']].map(([k, l]) => btn(l, [M.mv, c.iid, DEST(k)])).join('');
      if (mv) rows.push(['ย้ายไป', mv]);
      const call = VG.RCS.map((k, i) => btn(CIRC_TH[k], [M.mv, c.iid, DEST('rc'), i])).join(''); if (call) rows.push([c.zone === 'RC' ? 'ย้ายเซอร์เคิล' : 'คอลลง', call]);
      const sp = btn('ไรด์ทับแวนการ์ด (สแตนด์)', [M.mv, c.iid, DEST('vc')]) + btn('ลงการ์เดี้ยนเซอร์เคิล', [M.mv, c.iid, DEST('gc')]) + btn(c.faceup ? 'คว่ำหน้า' : 'หงายหน้า', [M.flip, c.iid]); if (sp) rows.push(['พิเศษ', sp]);
    } else rows.push(['เรียร์การ์ดคู่ต่อสู้', [['drop', 'รีไทร์ (ลงดรอป)'], ['hand', 'กลับขึ้นมือเจ้าของ'], ['bind', 'ไบนด์'], ['top', 'บนสุดของเด็ค'], ['bottom', 'ล่างสุดของเด็ค']].map(([k, l]) => btn(l, [M.mv, c.iid, DEST(k)])).join('')]);
    if (onF) {
      const u = st.until; const nums = (c.zone === 'GC' ? [['shield', 5000], ['shield', 10000], ['shield', -5000]] : [['power', 5000], ['power', 10000], ['power', -5000], ['crit', 1], ['crit', -1], ['drive', 1], ['drive', -1]]);
      const TH = { power: 'พลัง', crit: 'คริติคอล', drive: 'ไดรฟ์', shield: 'ชิลด์' };
      rows.push(['ปรับค่า', nums.map(([k, v]) => btn(TH[k] + ' ' + (v > 0 ? '+' : '−') + Math.abs(v), [M.mod, c.iid, KEY(k), v, u])).join('')
        + '<span class="mantog"><button type="button" data-until="0" aria-pressed="' + (u === 0) + '">จนจบเทิร์น</button><button type="button" data-until="1" aria-pressed="' + (u === 1) + '">จนจบแบทเทิล</button></span>']);
      const sr = btn(c.rest ? 'สแตนด์' : 'เรสต์', [M.st, c.iid, c.rest ? 1 : 0]); if (sr) rows.push(['สถานะ', sr]);
    }
    act = '<div class="manname">' + esc(dn(df)) + tagOf(df) + ' <span class="lab">' + esc(tagOfCard(c)) + '</span></div>' + rows.filter(r => r[1]).map(r => '<div class="manrow"><span class="lab">' + r[0] + ':</span>' + r[1] + '</div>').join('');
  }
  const empty = st.tab === 'deck' && st.look == null ? 'เลือกด้านบนว่าจะดูกี่ใบ' : 'ไม่มีการ์ด';
  m.innerHTML = '<div class="mbox man"><h2>ทำเอง — ทำตามข้อความบนการ์ดด้วยมือ</h2>'
    + '<p class="msub">สำหรับสกิลที่ยัง<b>ไม่ออโต้</b>หรือออโต้บางส่วน: จั่ว ย้ายการ์ด ปรับพลังได้เอง ทุกครั้งจะบันทึกลงล็อกให้ทั้งสองฝั่งเห็น' + (S.mode === 'solo' ? ' · ตอนนี้ทำในนามของ <b>' + esc(P.name) + '</b>' : '') + '</p>'
    + '<div class="manrow">' + quick + '</div>'
    + '<div class="mtabs wrap">' + MAN_TABS.map(([k, l]) => '<button type="button" data-mt="' + k + '" aria-pressed="' + (st.tab === k) + '">' + l + ' ' + count(k) + '</button>').join('') + '</div>' + deckBar
    + '<div class="mgrid">' + (list.length ? list.map(iid => { const c = g.cards[iid]; return '<button type="button" class="mcard' + (st.sel === iid ? ' on' : '') + '" data-ms="' + iid + '" data-no="' + esc(c.no) + '">' + staticCard(c.no, true) + '<span class="tagline">' + esc(tagOfCard(c)) + '</span></button>'; }).join('') : '<p class="msub">' + empty + '</p>') + '</div>'
    + '<div class="manact">' + act + '</div>'
    + '<div class="mfoot"><button type="button" class="btn peekbtn" data-peek="1">ซ่อนเพื่อดูสนาม</button><button type="button" class="btn pri" data-close="1">เสร็จแล้ว กลับไปเล่นต่อ</button></div></div>';
  m.hidden = false; m.classList.remove('peek');
}
function manSubmit(a) {
  const st = S.man; const g = S.game; const M = VG.MAN.op; if (!st) return;
  if (a[0] === M.look) st.look = a[1];
  else if (a[0] === M.mv) { const c = g.cards[a[1]]; const dest = VG.MAN.dest[a[2]]; if (c && c.zone === 'deck' && st.look > 0) st.look = st.look > 1 ? st.look - 1 : null; else if (!(c && c.zone === 'deck') && (dest === 'top' || dest === 'bottom')) st.look = null; }
  else if (a[0] !== M.mod && a[0] !== M.st && a[0] !== M.flip && a[0] !== M.cc && a[0] !== M.cb && a[0] !== M.ec) st.look = null;   // the deck changed: what was looked at is no longer on top
  submit([-1].concat(a));
}

/* ================= input ================= */
function onCard(iid) {
  const c = S.snap && S.snap.cards[iid]; if (!c) return;
  const seen = faceVisible(c) || c.zone === 'damage';
  if (seen) showDetail(c.no, iid);
  if (cardAct(iid, c)) return;
  if (seen) openCard(c.no, iid);     // nothing to do with this card right now: read it
}
/* what a click on a card does in the decision that is open; false = nothing (the card window opens instead) */
function cardAct(iid, c) {
  const pile = () => { if (c.zone === 'drop' || c.zone === 'damage' || c.zone === 'soul' || c.zone === 'order' || c.zone === 'removed' || c.zone === 'bind' || c.zone === 'gauge' || c.zone === 'prison' || c.zone === 'gzone' || c.zone === 'memory' || c.zone === 'mbox') { viewZone(c.owner, c.zone); return true; } return false; };
  const d = pendingForMe(); if (!d || S.picker) return !d ? pile() : false;
  const o = d.options; const find = f => o.findIndex(f);
  if (d.kind === 'main') {
    if (S.src && S.src !== iid && c.zone === 'RC' && c.owner === d.player) { const i = find(x => x.a === 'call' && x.iid === S.src && x.circle === c.pos); if (i >= 0) { submit([i]); return true; } }
    if (o.some(x => (x.a === 'call' || x.a === 'order' || x.a === 'varm') && x.iid === iid)) { S.src = S.src === iid ? null : iid; Sfx.play(S.src ? 'select' : 'unselect'); render(); return true; }
    { const acts = o.map((x, i) => (x.a === 'act' && x.iid === iid ? i : -1)).filter(i => i >= 0); if (acts.length === 1) { submit([acts[0]]); return true; } if (acts.length > 1) { const pr = $('#prompt'); pr.classList.remove('flash'); void pr.offsetWidth; pr.classList.add('flash'); Sfx.play('select'); return true; } }
    if (pile()) return true;
    if (S.src) { S.src = null; Sfx.play('unselect'); render(); return true; }
    return false;
  }
  if (d.kind === 'attack') {
    if (S.src) { const i = find(x => x.a === 'attack' && x.iid === S.src && x.target === iid); if (i >= 0) { submit([i]); return true; } }
    if (o.some(x => x.a === 'attack' && x.iid === iid)) { S.src = S.src === iid ? null : iid; Sfx.play(S.src ? 'select' : 'unselect'); render(); return true; }
    if (S.src) { S.src = null; Sfx.play('unselect'); render(); return true; }
    return pile();
  }
  if (d.kind === 'ride') { const i = find(x => x.iid === iid); if (i >= 0) { submit([i]); return true; } return pile(); }
  if (d.kind === 'cards' || d.kind === 'mulligan' || d.kind === 'guard') { const i = find(x => x.iid === iid); if (i >= 0) { pickToggle(i); return true; } return pile(); }
  if (d.kind === 'circle' && (c.zone === 'RC') && c.owner === d.player) { const i = find(x => x.circle === c.pos); if (i >= 0) { submit([i]); return true; } }
  return pile();
}
function onCircle(p, k) {
  const d = pendingForMe(); if (!d || S.picker || +p !== d.player) return;
  if (d.kind === 'main' && S.src) { const i = d.options.findIndex(x => x.a === 'call' && x.iid === S.src && x.circle === k); if (i >= 0) submit([i]); }
  else if (d.kind === 'circle') { const i = d.options.findIndex(x => x.circle === k); if (i >= 0) submit([i]); }
}
function wire() {
  $('#cards').addEventListener('click', e => { const el = e.target.closest('.card'); if (!el) return; if (S.lpFired) { S.lpFired = false; return; } onCard(+el.dataset.iid); });
  // reading a card that also has an action (a hand card you could call, a unit that could attack): right-click, or press and hold
  const readEl = el => { if (!S.snap) return false; const c = S.snap.cards[el.dataset.iid]; if (!c || !(faceVisible(c) || c.zone === 'damage')) return false; openCard(c.no, +el.dataset.iid); return true; };
  $('#cards').addEventListener('contextmenu', e => { const el = e.target.closest('.card'); if (el && readEl(el)) e.preventDefault(); });
  { let t = null, sx = 0, sy = 0; const stop = () => { clearTimeout(t); t = null; };
    $('#cards').addEventListener('pointerdown', e => { const el = e.target.closest('.card'); stop(); S.lpFired = false; if (!el || e.button !== 0) return; sx = e.clientX; sy = e.clientY; t = setTimeout(() => { t = null; if (readEl(el)) S.lpFired = true; }, 480); });
    $('#cards').addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 9) stop(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#cards').addEventListener(ev, stop); }
  $('#peek').addEventListener('click', () => { const c = S.snap && S.snap.cards[S.src]; if (c) openCard(c.no, S.src); });
  $('#detail').addEventListener('click', e => { if (e.target.closest('a, input, label')) return; const el = $('#detail'); if (el.dataset.no) openCard(el.dataset.no, +el.dataset.iid || null); });
  $('#cardwin').addEventListener('click', e => { if (e.target.closest('a')) return; if (e.target === $('#cardwin') || e.target.closest('[data-cwclose]')) return closeCard();
    { const z = e.target.closest('[data-cwzone]'); if (z && !z.disabled) { const iid = CW.iid; const c = S.snap && S.snap.cards[iid]; closeCard(); if (z.dataset.cwzone === 'soul') viewZone(+z.dataset.p, 'soul'); else if (c && c.dress) openPicker(null, { title: 'originalDress ของ ' + dn(C[c.no]), iids: c.dress.slice() }); return; } }
    const b = e.target.closest('[data-cwact]'); if (b && !b.disabled && CW.act) CW.act(b); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#cardwin').hidden) { e.stopPropagation(); closeCard(); } }, true);
  $('#picker').addEventListener('contextmenu', e => { const mc = e.target.closest('.mcard'); if (mc && mc.dataset.no) { e.preventDefault(); openCard(mc.dataset.no); } });
  $('#cards').addEventListener('mouseover', e => { const el = e.target.closest('.card'); if (!el || !S.snap) return; const c = S.snap.cards[el.dataset.iid]; if (c && (faceVisible(c) || c.zone === 'damage')) showDetail(c.no, +el.dataset.iid); });
  $('#zones').addEventListener('click', e => {
    const z = e.target.closest('[data-z]'); if (z) { const d = pendingForMe(); if (z.dataset.z === 'ride' && d && d.kind === 'ride' && +z.dataset.p === d.player) { const i = d.options.findIndex(x => x.a === 'rideDeck'); if (i >= 0) return submit([i]); } return viewZone(+z.dataset.p, z.dataset.z); }
    const c = e.target.closest('.circle'); if (c) onCircle(c.dataset.p, c.dataset.k);
  });
  $('#revealBar').addEventListener('click', e => { if (e.target.closest('.rv-x')) { clearTimeout(S.revT); $('#revealBar').hidden = true; return; } const c = e.target.closest('.rv-c'); if (c) { clearTimeout(S.revT); openCard(c.dataset.no); } });
  $('#prompt').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = pendingForMe(); if (!d) return;
    if (b.dataset.do === 'reopen') { if (S.picker) { $('#picker').hidden = false; $('#picker').classList.remove('peek'); } else present(); return; }
    if (b.dataset.do === 'manual') { closePicker(); S.picks = new Set(); S.src = null; S.man = { tab: 'hand', sel: null, until: 0, look: null }; openManual(); render(); return; }
    if (b.dataset.do === 'confirm') return submit([...S.picks]);
    if (b.dataset.do === 'skip') return submit([]);
    if (b.dataset.i !== undefined) submit([+b.dataset.i]);
  });
  $('#swaps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) submit([+b.dataset.i]); });
  $('#log').addEventListener('click', e => { if (!e.target.closest('h3')) return; const l = $('#log'); l.classList.toggle('min'); store.set('vg.logMin', l.classList.contains('min')); });
  if (store.get('vg.logMin')) $('#log').classList.add('min');
  $('#soulb').addEventListener('click', e => { const b = e.target.closest('button'); if (b) viewZone(+b.dataset.p, 'soul'); });
  $('#plates').addEventListener('click', e => { const z = e.target.closest('[data-z]'); if (z) viewZone(+z.dataset.p, z.dataset.z); });
  $('#cta').addEventListener('click', () => { const b = $('#prompt .btn.pri'); if (b && !b.disabled) b.click(); });
  $('#picker').addEventListener('click', e => {
    const m = $('#picker');
    if (m.classList.contains('peek')) { if (e.target.closest('[data-peek]')) m.classList.remove('peek'); return; }
    if (e.target.closest('[data-peek]')) { m.classList.add('peek'); return; }
    if (S.man && m.querySelector('.man')) {
      const t = e.target.closest('[data-mt]'); if (t) { S.man.tab = t.dataset.mt; S.man.sel = null; openManual(); return; }
      const u = e.target.closest('[data-until]'); if (u) { S.man.until = +u.dataset.until; openManual(); return; }
      const lk = e.target.closest('[data-look]'); if (lk) { if (!lk.disabled) manSubmit([VG.MAN.op.look, +lk.dataset.look]); return; }
      const b = e.target.closest('[data-man]'); if (b) { if (!b.disabled) manSubmit(b.dataset.man.split(',').map(Number)); return; }
      const mc = e.target.closest('[data-ms]'); if (mc) { S.man.sel = S.man.sel === +mc.dataset.ms ? null : +mc.dataset.ms; showDetail(mc.dataset.no); openManual(); return; }
      if (e.target.closest('[data-close]') || e.target === m) { S.man = null; m.hidden = true; m.innerHTML = ''; present(); }
      return;
    }
    { const dv = e.target.closest('[data-dv]'); if (dv && S.viewDeck) { deckViewer(S.viewDeck.id, dv.dataset.dv); return; } }
    if (e.target.closest('[data-close]') || (e.target === m && (!S.picker || S.picker.view))) { S.picker = null; m.hidden = true; m.innerHTML = ''; if (S.game) present(); return; }
    { const vi = e.target.closest('[data-vi]'); if (vi) { S.picker = null; m.hidden = true; m.innerHTML = ''; S.src = null; submit([+vi.dataset.vi]); return; } }
    if (e.target.closest('[data-pkok]')) { if (!e.target.closest('[data-pkok]').disabled) submit([...S.picks]); return; }
    const mc = e.target.closest('.mcard'); if (mc) { if (S.game && S.snap) showDetail(mc.dataset.no); if (mc.dataset.pk !== '' && mc.dataset.pk !== undefined && S.picker && !S.picker.view) pickToggle(+mc.dataset.pk); else if (mc.dataset.no && !S.man) openCard(mc.dataset.no); }
  });
  $('#picker').addEventListener('mouseover', e => { const mc = e.target.closest('.mcard'); if (mc && S.game) showDetail(mc.dataset.no); });
  $('#endov').addEventListener('click', e => {
    const b = e.target.closest('[data-end]'); if (!b) return;
    if (b.dataset.end === 'exit') exitTable();
    else if (b.dataset.end === 'undo') undo();
    else if (b.dataset.end === 'again') newLocal(Object.assign({}, S.meta, { seed: newSeed(), history: null }));
  });
  $('#mUndo').addEventListener('click', undo);
  $('#mExit').addEventListener('click', exitTable);
  $('#mFlip').addEventListener('click', () => { S.view = S.view === 'auto' ? 0 : S.view === 0 ? 1 : 'auto'; $('#mFlip').textContent = 'มุมมอง: ' + (S.view === 'auto' ? 'ตามเทิร์น' : S.game.players[S.view].name + ' อยู่ล่าง'); const v = S.view === 'auto' ? S.snap.active : S.view; if (v !== S.viewer) { S.viewer = v; buildZones(); } render(); present(); });
  $('#mSpeed').addEventListener('click', () => { S.speed = S.speed === 1 ? 2.5 : S.speed === 2.5 ? 6 : 1; $('#mSpeed').textContent = 'ความเร็ว: ' + (S.speed === 1 ? 'ปกติ' : S.speed === 2.5 ? 'เร็ว' : 'เร็วมาก'); store.set('vg.speed', S.speed); });
  $('#detail').addEventListener('click', () => { if (S.lay !== 'port') return; const no = $('#detail').dataset.no; if (!no) return; const d = C[no]; const m = $('#picker'); if (S.picker) return; m.innerHTML = '<div class="mbox"><h2>' + esc(d.name) + '</h2><p class="msub">' + statLine(d) + '</p><div class="dlist">' + (d.text || []).map(t => '<p>' + fmtText(t) + '</p>').join('') + '</div><div class="mfoot"><button type="button" class="btn pri" data-close="1">ปิด</button></div></div>'; m.hidden = false; });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !$('#table').hidden && !/^(BUTTON|INPUT|SELECT)$/.test(document.activeElement.tagName)) { const b = (S.picker || S.man ? $('#picker .btn.pri') : $('#prompt .btn.pri')); if (b && !b.disabled) { e.preventDefault(); b.click(); } } });
  window.addEventListener('resize', () => { if (!$('#table').hidden) fit(); });
  // lobby
  $('#modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.mode; S.lbSwap = true; Sfx.pick(); renderLobby(); });
  $('#firstChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.first = b.dataset.first === 'rand' ? 'rand' : +b.dataset.first; renderLobby(); });
  $('#slots').addEventListener('change', e => { const m = /^deckSel(\d)$/.exec(e.target.id); if (m) { S.decks[+m[1]] = e.target.value; store.set('vg.decks', S.decks); S.lbSwap = +m[1] + 1; Sfx.pick(); renderLobby(); } });
  $('#slots').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) return deckViewer(S.decks[+b.dataset.view]); const ed = e.target.closest('[data-edit]'); if (ed) window.VGBuilder.open(S.decks[+ed.dataset.edit], +ed.dataset.edit); });
  $('#newDeckBtn').addEventListener('click', () => window.VGBuilder.Decks.open());
  $('#goBtn').addEventListener('click', () => {
    Sfx.go(); Lobby.curtain();
    const names = S.mode === 'bot' ? ['คุณ', 'บอท'] : ['P1', 'P2'];
    newLocal({ mode: S.mode, decks: S.decks, names, first: S.first === 'rand' ? null : S.first, seed: newSeed() });
  });
  $('#resumeBtn').addEventListener('click', () => { const sv = store.get('vg.save'); if (sv) { S.decks = sv.decks.slice(); newLocal(sv); } });
  $('#createBtn').addEventListener('click', () => Net.create(S.decks[0]));
  $('#joinBtn').addEventListener('click', () => Net.join($('#codeIn').value.trim().toLowerCase(), S.decks[0]));
  $('#rejoinBtn').addEventListener('click', () => { const l = store.get('vg.lastRoom'); if (l && l.code) Net.join(l.code, S.decks[0]); });
  $('#imgIn').addEventListener('change', e => { addImages(e.target.files); e.target.value = ''; });
  $('#imgDir').addEventListener('change', e => { addImages(e.target.files); e.target.value = ''; });
  $('#imgClear').addEventListener('click', clearImages);
  Lobby.wire();
}
function newSeed() { return (Math.floor(Math.random() * 2147483646) + 1) >>> 0; }

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
  for (const r of VG.DB.rows) { for (const n of [r.no, ...r.nos]) { const k = imgKey(n); KNOWN.add(k); KNOWN.add(k.replace(/en$/, '')); } KNOWN.add(imgKey(r.name)); if (r.jimg) KNOWN.add(imgKey(r.jimg.split('/').pop())); if (r.jno) KNOWN.add(imgKey(r.jno)); }
  return KNOWN;
}
function imgStatus(msg) {
  const keys = Object.keys(IMG); const known = knownKeys();
  $('#imgStat').textContent = msg || (keys.length ? 'มีรูป ' + keys.length + ' ไฟล์ · จับคู่กับการ์ดได้ ' + keys.filter(k => known.has(k)).length + ' ใบ' : 'ยังไม่มีรูป');
  if (LOCAL) { const a = $('#autoStat'); if (a) a.textContent = 'รูปที่หาเจออัตโนมัติรอบนี้: จากเว็บทางการญี่ปุ่น ' + ASTAT.jp + ' ใบ · จากเว็บทางการอังกฤษ ' + ASTAT.web + ' ใบ · จากโฟลเดอร์ cards ' + ASTAT.folder + ' ใบ · หาไม่พบ ' + ASTAT.none + ' ใบ (ใช้หน้าการ์ดที่วาดแทน)'; }
  $('#imgClear').hidden = !keys.length;
}
/* faces already on screen are redrawn so new pictures show at once */
function refreshFaces() {
  if (S.snap) for (const iid in S.els) { const c = S.snap.cards[iid]; if (c) S.els[iid].firstChild.innerHTML = '<div class="cb"></div>' + faceHTML(C[c.no]); }
  if (S.viewDeck && !$('#picker').hidden && !S.picker) deckViewer(S.viewDeck.id, S.viewDeck.tab);
  if ($('#detail').dataset.no && S.snap) showDetail($('#detail').dataset.no);
  if (window.VGBuilder && window.VGBuilder.refreshThumbs) window.VGBuilder.refreshThumbs();
  if (!$('#lobby').hidden) document.querySelectorAll('#slots .dk-fan').forEach((el, i) => { el.innerHTML = deckFan(S.decks[i]); });
}
async function loadImages() { try { const all = await idb.all(); for (const k in all) { IMG[k] = URL.createObjectURL(all[k]); IMGN++; } } catch (e) { /* no local image store */ } imgStatus(); if (IMGN) refreshFaces(); findBack(); }
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
  imgStatus(); refreshFaces(); findBack();
  if (!hit && !(n === 1 && (IMG.back || IMG.cardback))) imgStatus('นำเข้า ' + n + ' ไฟล์ แต่ชื่อไฟล์ยังไม่ตรงกับการ์ดใบไหน — ดูชื่อไฟล์ที่ต้องใช้ได้ที่ปุ่ม "ดูการ์ด" → แท็บรูปการ์ด');
}
async function clearImages() { for (const k of Object.keys(IMG)) { URL.revokeObjectURL(IMG[k]); delete IMG[k]; } IMGN = 0; try { await idb.clear(); } catch (e) { /* nothing stored */ } imgStatus(); refreshFaces(); findBack(); }

/* ================= online rooms ================= */
const Net = {
  ready: undefined, db: null, user: null, uid: null, code: null, room: null, started: false, lists: [[], []], used: [0, 0], mine: [], unsubs: [],
  async init() {
    if (this.ready !== undefined) return this.ready;
    try {
      const cl = window.claude; if (!cl || !cl.use) return (this.ready = false);
      const [db, user, room] = await Promise.all([cl.use('db'), cl.use('user'), cl.use('room').catch(() => null)]);
      this.db = db; this.user = user; this.roomApi = room; this.uid = null;
      try { this.uid = user ? await user.id() : null; } catch (e) { this.uid = null; }
      let w = null; try { w = user && user.can ? await user.can('data.write') : null; } catch (e) { w = null; }
      this.deckDb = !!(db && this.uid && w !== false);
      if (!this.uid && room) { this.uid = store.get('vg.uid') || ('u' + Math.random().toString(36).slice(2, 12)); store.set('vg.uid', this.uid); }
      if (db && this.uid && w !== false) { this.gdb = db; this.via = 'db'; } else if (room) { this.gdb = RoomStore.make(room); this.via = 'room'; } else this.gdb = null;
      this.ready = !!(this.gdb && this.uid);
    } catch (e) { this.ready = false; }
    return this.ready;
  },
  fail(t) { setStatus(t, true); if (!$('#table').hidden) logLine(t, 't'); },
  useRoom() { if (this.via !== 'db' || !this.roomApi) return false; this.gdb = RoomStore.make(this.roomApi); this.via = 'room'; return true; },   // the shared database refused this viewer's write: play through the live room instead
  clear() { for (const u of this.unsubs) { try { u(); } catch (e) { /* already closed */ } } this.unsubs = []; this.started = false; this.lists = [[], []]; this.used = [0, 0]; this.mine = []; this.room = null; },
  leave() { this.clear(); this.code = null; $('#roomBox').hidden = true; setStatus(''); if (LOCAL) p2pReset(); },
  async create(deckId) {
    if (!(await this.init())) return this.fail('ใช้โหมดออนไลน์ไม่ได้ในมุมมองนี้');
    this.clear();
    const code = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
    try {
      await this.gdb.doc('rooms/' + code).set({ host: this.uid, hostName: myName(), hostDeck: VG.packDeck(VG.DECKS[deckId]), guest: null, guestDeck: null, seed: newSeed(), first: Math.random() < 0.5 ? 0 : 1, status: 'waiting', created: Date.now() });
    } catch (e) { if (this.useRoom()) return this.create(deckId); return this.fail(LOCAL ? 'สร้างห้องไม่สำเร็จ ลองอีกครั้ง' : 'สร้างห้องไม่สำเร็จ — เปิดหน้านี้ใน Claude ขณะลงชื่อเข้าใช้'); }
    const old = store.get('vg.rooms') || []; store.set('vg.rooms', [code]);
    $('#roomBox').hidden = false; $('#roomCode').textContent = code.toUpperCase(); setStatus('รอเพื่อนเข้าห้อง…');
    this.watch(code);
    if (this.via === 'db') this.cleanup(old);
  },
  /* rooms this browser created earlier are removed (3 small documents each) so the store stays tiny */
  async cleanup(codes) {
    for (const code of codes) {
      if (code === this.code) continue;
      try { for (const k of ['p0', 'p1']) await this.gdb.doc('rooms/' + code + '/log/' + k).delete(); await this.gdb.doc('rooms/' + code).delete(); } catch (e) { /* best effort */ }
    }
  },
  async join(code, deckId) {
    if (!/^[a-z0-9]{5}$/.test(code)) return this.fail('รหัสห้องมี 5 ตัวอักษร');
    if (!(await this.init())) return this.fail('ใช้โหมดออนไลน์ไม่ได้ในมุมมองนี้');
    this.clear();
    try {
      const ref = this.gdb.doc('rooms/' + code); const s = await ref.get();
      if (!s.exists) return this.fail('ไม่พบห้อง ' + code.toUpperCase() + (this.via === 'room' ? ' — เจ้าของห้องต้องเปิดหน้านี้ค้างไว้' : ''));
      const r = s.data();
      if (r.host !== this.uid && r.guest !== this.uid) {
        if (r.guest) return this.fail('ห้องนี้มีผู้เล่นครบแล้ว');
        await ref.update({ guest: this.uid, guestName: myName(), guestDeck: VG.packDeck(VG.DECKS[deckId]), status: 'playing' });
      }
    } catch (e) { if (this.useRoom()) return this.join(code, deckId); return this.fail('เข้าห้องไม่สำเร็จ — เจ้าของห้องต้องแชร์หน้านี้ให้คุณ (เชิญด้วยอีเมล)'); }
    setStatus('กำลังเข้าห้อง…');
    this.watch(code);
  },
  watch(code) {
    this.code = code; store.set('vg.lastRoom', { code, t: Date.now() });
    this.unsubs.push(this.gdb.doc('rooms/' + code).onSnapshot(s => {
      if (!s.exists) return; const r = s.data(); this.room = r;
      if (r.status === 'playing' && !this.started) { this.started = true; this.begin(r); }
    }, () => this.fail('การเชื่อมต่อห้องหลุด')));
  },
  async begin(r) {
    const hd = VG.unpackDeck('room-host', r.hostDeck), gd = VG.unpackDeck('room-guest', r.guestDeck);
    if (!hd || !gd || !VG.inspectDeck(hd).playable || !VG.inspectDeck(gd).playable) return this.fail('เด็คในห้องนี้ใช้กับหน้าเวอร์ชันนี้ไม่ได้');
    let names = [String(r.hostName || '').slice(0, 16) || 'เจ้าของห้อง', String(r.guestName || '').slice(0, 16) || 'ผู้เข้าร่วม'];
    try { const ps = await this.user.profiles([r.host, r.guest]); names = [(ps[r.host] && ps[r.host].name) || names[0], (ps[r.guest] && ps[r.guest].name) || names[1]]; } catch (e) { /* names stay generic */ }
    S.mode = 'online'; S.seat = r.host === this.uid ? 0 : 1; S.meta = null;
    S.cfg = { seed: r.seed, first: r.first, players: [{ name: names[0], deck: hd }, { name: names[1], deck: gd }] };
    const g = new VG.Game(S.cfg); g.snapOn = true; g.start();
    openTable(g);
    this.unsubs.push(this.gdb.collection('rooms/' + this.code + '/log').onSnapshot(q => {
      for (const d of q.docs) {
        const i = d.id === 'p0' ? 0 : d.id === 'p1' ? 1 : -1; const x = d.data();
        if (i < 0 || !x || !Array.isArray(x.a)) continue;
        const a = x.a.map(String).filter(v => /^(-?\d+(,-?\d+)*)?$/.test(v));   // answers are lists of integers; a manual action starts with -1
        if (a.length >= this.lists[i].length) this.lists[i] = a;
        if (i === S.seat && a.length > this.mine.length) this.mine = a.slice();
      }
      run();
    }, () => this.fail('การเชื่อมต่อห้องหลุด')));
  },
  async send(sel) {
    const next = this.mine.concat([sel.join(',')]);
    await this.gdb.doc('rooms/' + this.code + '/log/p' + S.seat).set({ a: next });
    this.mine = next;
  },
};

/* ================= live-room store =================
   When this viewer may not write the page's shared database (a friend the owner shared the page with as a Viewer), the game room runs in
   the page's live room instead: each player keeps the documents they wrote in their own presence (a room code joins the named room "vg-<code>"),
   and reads merge everyone's copies, latest write winning. Same shape as the database, so Net (rooms, answer logs) runs unchanged.
   Nothing is stored on a server: each player's own documents are also kept in this browser, so a reload re-joins the room where it was. */
const RoomStore = {
  make(api) {
    const R = { api, rooms: {}, mine: {}, subs: [], ver: 0 };
    const codeOf = p => { const m = /^rooms\/([a-z0-9]{5})(\/|$)/.exec(p); return m ? m[1] : null; };
    const keyOf = code => 'vg.rs.' + code;
    const fire = () => { R.ver++; for (const s of R.subs.slice()) { try { s(); } catch (e) { /* one listener */ } } };
    async function ensure(code) {
      if (!code) return null; if (R.rooms[code]) return R.rooms[code];
      const r = await api.join('vg-' + code); R.rooms[code] = r;
      const kept = store.get(keyOf(code)); if (kept && typeof kept === 'object') for (const p in kept) if (!R.mine[p]) R.mine[p] = kept[p];
      r.onPeers(() => fire(), () => { delete R.rooms[code]; });
      await push(code); return r;
    }
    async function push(code) {
      const r = R.rooms[code]; if (!r) return; const docs = Object.keys(R.mine).filter(p => codeOf(p) === code).map(p => { const v = R.mine[p].v; return [p, R.mine[p].t, v && Array.isArray(v.a) ? { as: v.a.length + ':' + v.a.join(';') } : v]; });   // answer logs travel as one string
      const o = {}; for (const p in R.mine) if (codeOf(p) === code) o[p] = R.mine[p]; store.set(keyOf(code), o);
      try { await r.presence({ vg: 2, docs }); } catch (e) { Net.fail('ข้อมูลห้องสดเกินขีดจำกัด (4 KB) — เกมนี้ยาวเกินไปสำหรับห้องสด ลองเล่นแบบ Editor หรือฉบับในเครื่อง'); }
    }
    function all(code) {
      const out = {}; const take = (p, t, v) => { if (!out[p] || out[p].t < t) out[p] = { t, v }; };
      const r = R.rooms[code]; if (r) for (const peer of r.peers()) { const d = peer.presence && peer.presence.docs; if (!Array.isArray(d)) continue; for (const x of d) if (Array.isArray(x) && typeof x[0] === 'string' && codeOf(x[0]) === code) take(x[0], +x[1] || 0, x[2] && typeof x[2].as === 'string' ? { a: (() => { const t = x[2].as; const k = t.indexOf(':'); const n = parseInt(t, 10) || 0; return n ? t.slice(k + 1).split(';').slice(0, n) : []; })() } : x[2]); }
      for (const p in R.mine) if (codeOf(p) === code) take(p, R.mine[p].t, R.mine[p].v);
      return out;
    }
    const val = p => { const c = codeOf(p); const a = all(c)[p]; return a && a.v !== null && a.v !== undefined ? a.v : undefined; };
    const snap = p => { const d = val(p); return { exists: d !== undefined, id: p.split('/').pop(), data: () => d }; };
    let clock = 0; const now = () => (clock = Math.max(clock + 1, Date.now()));
    async function write(p, v) { const c = codeOf(p); await ensure(c); R.mine[p] = { t: now(), v: v === undefined ? null : v }; await push(c); fire(); }
    const sub = (get, cb) => { let last; const f = () => { const v = get(); const s = JSON.stringify(v.key); if (s !== last) { last = s; cb(v.out); } }; R.subs.push(f); setTimeout(f, 0); return () => { const i = R.subs.indexOf(f); if (i >= 0) R.subs.splice(i, 1); }; };
    const doc = p => ({ id: p.split('/').pop(),
      async set(v) { await write(p, v); },
      async get() { const c = codeOf(p); await ensure(c); for (let k = 0; k < 25 && val(p) === undefined; k++) await new Promise(r => setTimeout(r, 120)); return snap(p); },
      async update(v) { await ensure(codeOf(p)); await write(p, Object.assign({}, val(p), v)); },
      async delete() { await write(p, null); },
      onSnapshot(cb) { ensure(codeOf(p)).catch(() => {}); return sub(() => { const s = snap(p); return { key: s.exists ? s.data() : null, out: s }; }, cb); } });
    const list = p => { const c = codeOf(p); const A = all(c); return Object.keys(A).filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/') && A[k].v !== null).sort().map(snap); };
    return { doc, collection: p => ({ doc: id => doc(p + '/' + id), async get() { await ensure(codeOf(p)); return { docs: list(p) }; }, onSnapshot(cb) { ensure(codeOf(p)).catch(() => {}); return sub(() => { const l = list(p); return { key: l.map(d => [d.id, d.data()]), out: { docs: l } }; }, cb); } }) };
  },
};

/* ================= direct link between two local copies =================
   The copy that runs from disk has no shared database, so two players connect browser to browser (WebRTC data channel).
   There is no server in between: the two connection texts are carried by the players themselves (copy, paste into a chat, paste back).
   On top of the channel sits a tiny replicated document store with the same shape as the published page's database, so the room code above works unchanged.
   Only moves travel through it; each side shows card pictures from its own machine. */
const P2P = {
  pc: null, ch: null, role: null, docs: {}, subs: [], open: false, store: null, viaQL: false, resume: false, await: false,
  b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  unb64(t) { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
  async pack(o) {
    const raw = new TextEncoder().encode(JSON.stringify(o));
    if (window.CompressionStream) { try { const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'VGZ' + this.b64(new Uint8Array(buf)); } catch (e) { /* fall through to the plain form */ } }
    return 'VGR' + this.b64(raw);
  },
  async unpack(code) {
    code = String(code || '').replace(/\s+/g, ''); const kind = code.slice(0, 3); if (kind !== 'VGZ' && kind !== 'VGR') throw new Error('not a code');
    let u = this.unb64(code.slice(3));
    if (kind === 'VGZ') u = new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    const o = JSON.parse(new TextDecoder().decode(u)); if (!o || typeof o.s !== 'string' || (o.t !== 'o' && o.t !== 'a')) throw new Error('not a code'); return o;
  },
  mkStore() {
    const P = this;
    const snap = p => { const d = P.docs[p]; return { exists: d !== undefined, id: p.split('/').pop(), data: () => d }; };
    const fire = () => { for (const s of P.subs.slice()) s(); };
    P.write = (p, v, remote) => { if (v === undefined || v === null) delete P.docs[p]; else P.docs[p] = v; if (!remote && P.ch && P.ch.readyState === 'open') P.ch.send(JSON.stringify({ p, v: v === undefined ? null : v })); setTimeout(fire, 0); };
    const sub = (get, cb) => { let last; const f = () => { const v = get(); const s = JSON.stringify(v.key); if (s !== last) { last = s; cb(v.out); } }; P.subs.push(f); setTimeout(f, 0); return () => { const i = P.subs.indexOf(f); if (i >= 0) P.subs.splice(i, 1); }; };
    const doc = p => ({ id: p.split('/').pop(), async set(v) { P.write(p, v); }, async get() { return snap(p); }, async update(v) { P.write(p, Object.assign({}, P.docs[p], v)); }, async delete() { P.write(p, undefined); }, onSnapshot(cb) { return sub(() => ({ key: P.docs[p], out: snap(p) }), cb); } });
    const list = p => Object.keys(P.docs).filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).sort().map(snap);
    return { doc, collection: p => ({ doc: id => doc(p + '/' + id), async get() { return { docs: list(p) }; }, onSnapshot(cb) { return sub(() => { const l = list(p); return { key: l.map(d => [d.id, d.data()]), out: { docs: l } }; }, cb); } }) };
  },
  close() { const pc = this.pc; this.pc = null; this.open = false; this.docs = {}; this.subs = []; try { if (this.ch) this.ch.close(); } catch (e) { /* already closed */ } try { if (pc) pc.close(); } catch (e) { /* already closed */ } this.ch = null; },
  start(role) {
    this.close(); this.role = role; this.store = this.mkStore(); this.viaQL = false;
    const pc = this.pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] });
    pc.addEventListener('connectionstatechange', () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'failed') { const was = this.open; this.open = false; Net.fail(was ? 'การเชื่อมต่อกับเพื่อนหลุด — ต้องสร้างรหัสและเชื่อมต่อใหม่' : 'เชื่อมต่อไม่สำเร็จ — เครือข่ายของฝั่งใดฝั่งหนึ่งไม่ยอมให้เชื่อมตรง ลองเปลี่ยนเครือข่าย (เช่น Wi-Fi บ้านแทนเน็ตมือถือ) แล้วสร้างรหัสใหม่'); }
    });
    if (role === 'host') this.bind(pc.createDataChannel('vg', { ordered: true })); else pc.addEventListener('datachannel', e => this.bind(e.channel));
    return pc;
  },
  gathered(pc) { return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 3500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); },
  async offer() { const pc = this.start('host'); await pc.setLocalDescription(await pc.createOffer()); await this.gathered(pc); return this.pack({ t: 'o', s: pc.localDescription.sdp }); },
  async reply(code) { const o = await this.unpack(code); if (o.t !== 'o') throw new Error('wrong kind'); const pc = this.start('guest'); await pc.setRemoteDescription({ type: 'offer', sdp: o.s }); await pc.setLocalDescription(await pc.createAnswer()); await this.gathered(pc); return this.pack({ t: 'a', s: pc.localDescription.sdp }); },
  async accept(code) { const a = await this.unpack(code); if (a.t !== 'a') throw new Error('wrong kind'); if (!this.pc || this.role !== 'host') throw new Error('no offer'); await this.pc.setRemoteDescription({ type: 'answer', sdp: a.s }); },
  bind(ch) {
    this.ch = ch;
    ch.addEventListener('open', async () => {
      if (this.ch !== ch) return; this.open = true; this.netUp();
      if (this.resume) { this.resume = false; ch.send(JSON.stringify({ sync: this.docs })); setStatus('ต่อกลับกับเพื่อนแล้ว — เล่นต่อได้'); if (!$('#table').hidden) logLine('ต่อกลับกับเพื่อนแล้ว — เล่นต่อจากเดิม', 't'); return; }
      if (this.await) {   // reopened a room after closing the game: wait for the friend's copy of the fight; nothing comes → a new fight
        setStatus('เชื่อมต่อแล้ว กำลังกู้ไฟท์เดิม…');
        setTimeout(async () => { if (this.ch !== ch || !this.await) return; this.await = false; if (this.role === 'host') { setStatus('ไม่มีไฟท์เดิมให้กู้ — เริ่มไฟท์ใหม่'); await Net.create(S.decks[0]); if (Net.code && ch.readyState === 'open') ch.send(JSON.stringify({ room: Net.code })); } }, 4000);
        return;
      }
      setStatus('เชื่อมต่อกับเพื่อนแล้ว กำลังเริ่มไฟท์…');
      if (this.role === 'host') { await Net.create(S.decks[0]); if (Net.code && ch.readyState === 'open') ch.send(JSON.stringify({ room: Net.code })); }
    });
    ch.addEventListener('message', e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (!m || typeof m !== 'object' || this.ch !== ch) return; this.netUp();
      if (m.sync && typeof m.sync === 'object' && String(e.data).length < 400000) { this.merge(m.sync); return; }
      if (typeof m.room === 'string' && this.role === 'guest' && /^[a-z0-9]{5}$/.test(m.room)) { this.await = false; if (Net.code !== m.room) Net.join(m.room, S.decks[0]); return; }
      if (typeof m.p === 'string' && /^rooms\/[a-z0-9]{5}(\/log\/p[01])?$/.test(m.p) && String(e.data).length < 200000) this.write(m.p, m.v, true);
    });
    ch.addEventListener('close', () => { if (this.ch === ch && this.open) { this.open = false; if (this.viaQL && QL.code && (Net.started || Net.code)) QL.lost(); else Net.fail('การเชื่อมต่อกับเพื่อนหลุด — ต้องสร้างรหัสและเชื่อมต่อใหม่'); } });
  },
  netUp() { if (Net.db === this.store && Net.ready) return; Net.db = this.store; Net.gdb = this.store; Net.deckDb = false; Net.via = 'p2p'; Net.uid = this.role; Net.user = { id: async () => this.role, profiles: async () => ({}) }; Net.ready = true; },
  /* the other side's copy of the room after a reconnect: take whatever is newer (answer logs only grow), send back what they miss */
  merge(docs) {
    let room = null; const ok = p => /^rooms\/[a-z0-9]{5}(\/log\/p[01])?$/.test(p); const len = v => v && Array.isArray(v.a) ? v.a.length : -1;
    for (const p in docs) {
      if (!ok(p)) continue; const v = docs[p];
      if (p.includes('/log/')) { if (len(v) > len(this.docs[p])) this.write(p, v, true); }
      else { room = p; if (!this.docs[p] && v && typeof v === 'object') this.write(p, v, true); }
    }
    for (const p in this.docs) if (ok(p) && (p.includes('/log/') ? len(this.docs[p]) > len(docs[p]) : !docs[p]) && this.ch && this.ch.readyState === 'open') this.ch.send(JSON.stringify({ p, v: this.docs[p] }));
    this.await = false;
    if (room && !Net.code) Net.join(room.split('/')[1], S.decks[0]);
    setStatus('ต่อกลับกับเพื่อนแล้ว — เล่นต่อได้');
  },
};
/* ================= quick room: a 6-character code instead of the long connection texts =================
   The two game windows find each other through the free PeerJS meeting service (it only passes the connection handshake; the game itself
   travels window to window, and PeerJS's relay steps in when two networks cannot reach each other directly). The connection then feeds
   the same replicated store as the long-code link above, so the room, the answer logs and the game run unchanged. */
/* ===== online rooms of the game: no account, no Claude =====
   A room has a 6-letter code. Players link directly (PeerJS / WebRTC); when a network blocks that, the same messages go through a public MQTT broker (relay).
   The broker also carries the list of open rooms (retained message per room, cleared by the broker if the host's game closes).
   A dropped link is retried by itself and the game continues: both sides keep the room and the answer logs and swap them when they meet again. */
const MQP = 'vgdl/v1/';
const MQ = {
  urls() { const u = store.get('vg.mqtt'); return Array.isArray(u) && u.length ? u : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt']; },
  /* a connected client from the first broker that answers */
  conn(will) {
    const urls = this.urls(); let i = 0;
    return new Promise((res, rej) => {
      const next = () => {
        if (!window.mqtt) return rej(new Error('no mqtt'));
        if (i >= urls.length) return rej(new Error('no broker'));
        const url = urls[i++]; let done = false; let c;
        try { c = window.mqtt.connect(url, { clientId: 'vgdl_' + Math.random().toString(36).slice(2, 12), connectTimeout: 7000, reconnectPeriod: 0, keepalive: 20, clean: true, will }); } catch (e) { return next(); }
        const t = setTimeout(() => { if (done) return; done = true; try { c.end(true); } catch (e) { /* gone */ } next(); }, 8000);
        c.once('connect', () => { if (done) return; done = true; clearTimeout(t); c.options.reconnectPeriod = 2500; c.vgUrl = url; c.setMaxListeners && c.setMaxListeners(50); res(c); });
        c.once('error', () => { if (done) return; done = true; clearTimeout(t); try { c.end(true); } catch (e) { /* gone */ } next(); });
      };
      next();
    });
  },
  /* a channel through the broker, shaped like an RTCDataChannel for P2P.bind */
  relay(c, code, me, gid) {
    const H = { open: [], message: [], close: [] }; let st = 'connecting'; let seen = Date.now();
    const fire = (t, e) => { for (const f of H[t].slice()) { try { f(e); } catch (x) { /* one listener */ } } };
    const out = MQP + 'r/' + code + '/' + me, inT = MQP + 'r/' + code + '/' + (me === 'h' ? 'g' : 'h');
    const end = () => { if (st === 'closed') return; const was = st; st = 'closed'; clearInterval(beat); c.removeListener('message', onMsg); c.removeListener('offline', onOff); if (was === 'open') fire('close', {}); };
    const onMsg = (t, buf) => {
      if (t !== inT) return; let m; try { m = JSON.parse(String(buf)); } catch (e) { return; }
      if (!m || m.g !== gid) return; seen = Date.now();
      if (m.k === 'm' && st === 'open' && typeof m.x === 'string') fire('message', { data: m.x });
      else if (m.k === 'bye') end();
    };
    const onOff = () => setTimeout(() => { if (!c.connected) end(); }, 6000);   // our own internet went away
    const pub = o => { try { c.publish(out, JSON.stringify(o), { qos: 1 }); } catch (e) { /* offline: the broker client queues or drops */ } };
    const beat = setInterval(() => { if (st !== 'open') return; pub({ k: 'p', g: gid }); if (Date.now() - seen > 25000) end(); }, 5000);   // the other side vanished without saying goodbye
    c.on('message', onMsg); c.on('offline', onOff);
    return {
      g: gid,
      addEventListener(t, f) { if (t === 'open' && st === 'open') queueMicrotask(() => f({})); else if (H[t]) H[t].push(f); },
      send(x) { pub({ k: 'm', g: gid, x }); },
      close() { if (st === 'closed') return; pub({ k: 'bye', g: gid }); end(); },
      get readyState() { return st; },
      _open() { if (st !== 'connecting') return; st = 'open'; seen = Date.now(); fire('open', {}); },
    };
  },
};
/* the list of open rooms (shown on the LINK FIGHT page) */
const Rooms = {
  c: null, busy: false, rooms: {}, timer: 0, want: false,
  async start() {
    this.want = true; if (this.c || this.busy) return this.draw(); this.busy = true; this.draw();
    try {
      const c = await MQ.conn(); this.busy = false;
      if (!this.want) { c.end(true); return; }
      this.c = c; const sub = () => c.subscribe(MQP + 'lobby/+', { qos: 0 });
      c.on('connect', sub); sub();
      c.on('message', (t, buf) => {
        const code = t.split('/').pop(); if (!/^[A-Z2-9]{6}$/.test(code)) return;
        let o = null; try { o = buf.length ? JSON.parse(String(buf)) : null; } catch (e) { o = null; }
        if (!o || typeof o !== 'object' || Math.abs(Date.now() - (+o.t || 0)) > 15 * 60e3) delete this.rooms[code];
        else this.rooms[code] = { n: String(o.n || '').slice(0, 16), d: String(o.d || '').slice(0, 40), seen: Date.now() };
        this.draw();
      });
      this.timer = setInterval(() => this.draw(), 20000);
    } catch (e) { this.busy = false; this.fail = true; }
    this.draw();
  },
  stop() { this.want = false; clearInterval(this.timer); this.timer = 0; if (this.c) { try { this.c.end(true); } catch (e) { /* gone */ } } this.c = null; this.rooms = {}; },
  draw() {
    const el = $('#qlList'); if (!el) return;
    const now = Date.now(); const list = Object.keys(this.rooms).filter(k => k !== QL.code && now - this.rooms[k].seen < 4 * 60e3).sort((a, b) => this.rooms[b].seen - this.rooms[a].seen);
    $('#qlCount').textContent = this.c ? (list.length ? list.length + ' ห้อง' : '') : '';
    if (!this.c) { el.innerHTML = '<p class="note">' + (this.busy ? 'กำลังโหลดรายการห้อง…' : 'โหลดรายการห้องไม่ได้ตอนนี้ — ยังเข้าห้องด้วยรหัสได้') + '</p>'; return; }
    el.innerHTML = list.length ? list.map(k => { const r = this.rooms[k]; return '<div class="qlr"><div class="qlr-t"><b>' + esc(r.n || 'ไม่ระบุชื่อ') + '</b><span>' + esc(r.d) + '</span></div><code>' + k + '</code><button type="button" class="ghost strong" data-qlj="' + k + '">เข้าห้อง</button></div>'; }).join('')
      : '<p class="note">ยังไม่มีห้องเปิดรอ — กด <b>สร้างห้อง</b> แล้วให้เพื่อนกดเข้าจากรายการนี้</p>';
  },
};
const QL = {
  peer: null, mq: null, code: null, role: null, gid: null, tryN: 0, linked: false, rejoin: false, everLinked: false, advT: 0, retryT: 0, lostT: 0,
  cfg() { const h = store.get('vg.peerHost'); return h && typeof h === 'object' ? Object.assign({}, h) : {}; },
  active() { return !!(this.code && P2P.viaQL); },
  adapt(conn) {
    const H = { open: [], message: [], close: [] }; const fire = (t, e) => { for (const f of H[t].slice()) { try { f(e); } catch (x) { /* one listener */ } } };
    let closed = false; const shut = () => { if (closed) return; closed = true; fire('close', {}); };
    conn.on('open', () => fire('open', {})); conn.on('data', d => fire('message', { data: typeof d === 'string' ? d : JSON.stringify(d) })); conn.on('close', shut); conn.on('error', shut);
    try { const pc = conn.peerConnection; if (pc) pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') setTimeout(() => { if (pc.connectionState !== 'connected') shut(); }, pc.connectionState === 'failed' ? 0 : 5000); }); } catch (e) { /* no state events */ }
    return { addEventListener: (t, f) => { if (t === 'open' && conn.open) queueMicrotask(() => f({})); else if (H[t]) H[t].push(f); }, send: x => { try { conn.send(x); } catch (e) { shut(); } }, close: () => { closed = true; try { conn.close(); } catch (e) { /* already closed */ } }, get readyState() { return closed ? 'closed' : conn.open ? 'open' : 'connecting'; } };
  },
  /* put a fresh link under the room; if a game is running in this room already, keep it and catch up instead */
  attach(ch, role) {
    this.linked = true; clearTimeout(this.lostT); clearTimeout(this.retryT);
    if (P2P.store && P2P.viaQL && Net.started && P2P.role === role) { const old = P2P.ch; P2P.ch = null; try { if (old && old !== ch) old.close(); } catch (e) { /* gone */ } P2P.resume = true; P2P.bind(ch); return; }
    P2P.close(); P2P.role = role; P2P.store = P2P.mkStore(); P2P.viaQL = true; P2P.await = this.rejoin || role === 'guest' && this.rejoinGuest; P2P.bind(ch);
    this.everLinked = true; this.advert(); store.set('vg.qlLast', { code: this.code, role, t: Date.now() });
  },
  lobbyT(code) { return MQP + 'lobby/' + code; },
  advert() {
    if (!this.mq || this.role !== 'host' || !this.code) return;
    const show = !!($('#qlPub') && $('#qlPub').checked) && !this.rejoin && !this.everLinked; const d = VG.DECKS[S.decks[0]];
    try { Presence.pub(); } catch (e) { /* no status */ }
    try { this.mq.publish(this.lobbyT(this.code), show ? JSON.stringify({ n: myName(), d: d ? d.name : '', t: Date.now(), v: 1 }) : '', { qos: 1, retain: true }); } catch (e) { /* offline */ }
  },
  drop() {
    clearTimeout(this.retryT); clearTimeout(this.lostT); clearInterval(this.advT); this.tryN++; this.linked = false;
    if (this.mq) { const c = this.mq; this.mq = null; try { if (this.role === 'host' && this.code) c.publish(this.lobbyT(this.code), '', { qos: 1, retain: true }); } catch (e) { /* offline */ } setTimeout(() => { try { c.end(); } catch (e) { /* gone */ } }, 400); }
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* gone */ } } this.peer = null; this.code = null;
  },
  newCode() { return Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join(''); },
  host(opts) {
    opts = opts || {}; this.drop(); const code = opts.code || this.newCode(); const my = this.tryN;
    this.code = code; this.role = 'host'; this.rejoin = !!opts.code; this.everLinked = false; this.rejoinGuest = false;
    setStatus(this.rejoin ? 'กำลังเปิดห้อง ' + code + ' อีกครั้ง…' : 'กำลังสร้างห้อง…');
    let shown = false; let paths = 0, failed = 0;
    const ready = () => { if (shown || this.tryN !== my) return; shown = true; this.up = code; $('#qlCode').textContent = code; $('#qlCode').hidden = false; $('#qlCopy').hidden = false; setStatus(this.rejoin ? 'รอเพื่อนกลับเข้าห้อง ' + code + '…' : 'ส่งรหัส ' + code + ' ให้เพื่อน หรือให้เพื่อนกดเข้าจากรายการห้อง แล้วรอ…'); store.set('vg.qlLast', { code, role: 'host', t: Date.now() }); Rooms.draw(); };
    const bad = () => { if (++failed >= paths && !shown && this.tryN === my) setStatus('ต่ออินเทอร์เน็ตไม่ได้ — ตรวจเน็ตแล้วกดสร้างห้องอีกครั้ง', true); };
    if (window.Peer) {
      paths++;
      const peer = this.peer = new window.Peer('vgdl-' + code.toLowerCase(), this.cfg());
      peer.on('open', () => { if (this.peer === peer) ready(); });
      peer.on('connection', conn => { if (this.peer !== peer) return; if (P2P.open) { conn.on('open', () => conn.close()); return; } setStatus('เพื่อนกำลังเข้าห้อง…'); this.attach(this.adapt(conn), 'host'); });
      peer.on('disconnected', () => { if (this.peer === peer) setTimeout(() => { try { if (this.peer === peer && peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) { /* retried on the next drop */ } }, 2000); });
      peer.on('error', e => { if (this.peer !== peer) return; if (e && e.type === 'unavailable-id' && !this.rejoin && !shown && !this.everLinked) return this.host(); if (!shown) bad(); });
    }
    if (window.mqtt) {
      paths++;
      MQ.conn({ topic: this.lobbyT(code), payload: '', qos: 1, retain: true }).then(c => {
        if (this.tryN !== my) { try { c.end(true); } catch (e) { /* gone */ } return; }
        this.mq = c; const gT = MQP + 'r/' + code + '/g', hT = MQP + 'r/' + code + '/h';
        c.on('connect', () => { c.subscribe(gT, { qos: 1 }); this.advert(); });
        c.subscribe(gT, { qos: 1 });
        c.on('message', (t, buf) => {
          if (t !== gT) return; let m; try { m = JSON.parse(String(buf)); } catch (e) { return; }
          if (!m || m.k !== 'hi' || typeof m.g !== 'string' || m.g.length > 40) return;
          const cur = P2P.viaQL && P2P.ch && P2P.ch.g === m.g && P2P.ch.readyState === 'open';
          if (cur) { c.publish(hT, JSON.stringify({ k: 'ok', g: m.g }), { qos: 1 }); return; }
          if (P2P.open) { c.publish(hT, JSON.stringify({ k: 'full', g: m.g }), { qos: 1 }); return; }
          setStatus('เพื่อนกำลังเข้าห้อง…');
          const ch = MQ.relay(c, code, 'h', m.g); this.attach(ch, 'host'); c.publish(hT, JSON.stringify({ k: 'ok', g: m.g }), { qos: 1 }); ch._open();
        });
        this.advert(); this.advT = setInterval(() => this.advert(), 60000); ready();
      }, bad);
    }
    if (!paths) setStatus('ไฟล์เกมนี้ไม่มีระบบห้องออนไลน์ — ใช้วิธีแลกรหัสยาว', true);
  },
  join(raw, opts) {
    opts = opts || {};
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 6) return setStatus('รหัสห้องมี 6 ตัว', true);
    if (!window.Peer && !window.mqtt) return setStatus('ไฟล์เกมนี้ไม่มีระบบห้องออนไลน์ — ใช้วิธีแลกรหัสยาว', true);
    this.drop(); const my = this.tryN; this.code = code; this.role = 'guest'; this.rejoin = false; this.rejoinGuest = !!opts.rejoin;
    if (!opts.resume || !this.gid) this.gid = 'g' + Math.random().toString(36).slice(2, 12);
    if (!opts.resume) setStatus('กำลังเข้าห้อง ' + code + '…');
    const finish = ch => { if (this.tryN !== my || this.linked) { try { ch.close(); } catch (e) { /* gone */ } return; } this.attach(ch, 'guest'); };
    let relayOn = false, noRoom = 0, full = false;
    const relay = () => {
      if (relayOn || this.linked || this.tryN !== my) return; relayOn = true;
      if (!window.mqtt) { noRoom++; return; }
      MQ.conn().then(c => {
        if (this.tryN !== my || this.linked) { try { c.end(true); } catch (e) { /* gone */ } return; }
        this.mq = c; const hT = MQP + 'r/' + code + '/h', gT = MQP + 'r/' + code + '/g'; const gid = this.gid;
        const ch = MQ.relay(c, code, 'g', gid);
        c.on('message', (t, buf) => { if (t !== hT) return; let m; try { m = JSON.parse(String(buf)); } catch (e) { return; } if (!m || m.g !== gid) return; if (m.k === 'ok' && !this.linked) { finish(ch); ch._open(); } else if (m.k === 'full') full = true; });
        c.subscribe(hT, { qos: 1 }, () => { let n = 0; const hi = () => { if (this.linked || this.tryN !== my || n++ > 6) return; try { c.publish(gT, JSON.stringify({ k: 'hi', g: gid }), { qos: 1 }); } catch (e) { /* offline */ } setTimeout(hi, 2000); }; hi(); });
      }, () => { noRoom++; });
    };
    if (window.Peer) {
      const peer = this.peer = new window.Peer('vgdl-' + this.gid + Math.random().toString(36).slice(2, 5), this.cfg());
      peer.on('open', () => { if (this.peer !== peer) return; const conn = peer.connect('vgdl-' + code.toLowerCase(), { reliable: true, serialization: 'raw' }); const ad = this.adapt(conn); ad.addEventListener('open', () => finish(ad)); });
      peer.on('error', e => { if (this.peer !== peer) return; if (e && e.type === 'peer-unavailable') noRoom++; relay(); });
      setTimeout(relay, 5000);
    } else relay();
    if (!opts.resume) setTimeout(() => { if (this.tryN === my && !this.linked) setStatus(full ? 'ห้องนี้มีผู้เล่นครบแล้ว' : noRoom ? 'ไม่พบห้อง ' + code + ' — ตรวจรหัส หรือให้เพื่อนกดสร้างห้องใหม่' : 'เข้าห้องไม่สำเร็จ — ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', true); }, 18000);
  },
  /* the link dropped during a game: try again by ourselves, the game goes on from where it was */
  lost() {
    P2P.open = false; this.linked = false; const t0 = Date.now();
    setStatus('การเชื่อมต่อหลุด — กำลังต่อกลับเอง…', true); if (!$('#table').hidden) logLine('การเชื่อมต่อกับเพื่อนหลุด — กำลังต่อกลับเอง (เล่นต่อได้เมื่อต่อติด)', 't');
    const give = () => { if (!P2P.open && this.code) Net.fail('ต่อกลับไม่สำเร็จภายใน 3 นาที — ให้เจ้าของห้องกด "กลับเข้าห้องล่าสุด" แล้วอีกฝั่งกดตามเพื่อเล่นต่อ'); };
    if (this.role === 'guest') {
      const code = this.code;
      const again = () => { if (P2P.open || this.role !== 'guest') return; if (Date.now() - t0 > 180000) return give(); this.join(code, { resume: true }); this.retryT = setTimeout(again, 15000); };
      again();
    } else {
      try { if (this.peer && this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect(); } catch (e) { /* the peer retries on its own */ }
      this.lostT = setTimeout(give, 180000);
    }
  },
};
function p2pWire() {
  $('#qlHost').addEventListener('click', () => QL.host());
  $('#qlName').value = myName(); $('#qlName').addEventListener('input', e => { store.set('vg.name', e.target.value.trim().slice(0, 16)); });
  $('#qlPub').addEventListener('change', () => QL.advert());
  $('#qlList').addEventListener('click', e => { const b = e.target.closest('[data-qlj]'); if (b) QL.join(b.dataset.qlj); });
  $('#qlBack').addEventListener('click', () => { const l = store.get('vg.qlLast'); if (!l || !l.code) return; if (l.role === 'host') QL.host({ code: l.code }); else QL.join(l.code, { rejoin: true }); });
  $('#qlJoin').addEventListener('click', () => QL.join($('#qlIn').value));
  $('#qlIn').addEventListener('keydown', e => { if (e.key === 'Enter') QL.join($('#qlIn').value); });
  $('#qlCopy').addEventListener('click', e => { const b = e.currentTarget; const t = QL.code || ''; const done = () => { b.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => { b.textContent = 'คัดลอกรหัส'; }, 1400); }; try { navigator.clipboard.writeText(t).then(done, done); } catch (x) { done(); } });
  const role = r => { for (const b of $('#p2pRole').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.role === r)); $('#p2pHost').hidden = r !== 'host'; $('#p2pGuest').hidden = r !== 'guest'; };
  const copy = (ta, btn) => { const t = $(ta); t.focus(); t.select(); const done = () => { const o = btn.textContent; btn.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => { btn.textContent = o; }, 1400); }; try { navigator.clipboard.writeText(t.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (e) { /* the text stays selected for a manual copy */ } }); } catch (e) { try { document.execCommand('copy'); done(); } catch (x) { /* stays selected */ } } };
  const bad = 'รหัสไม่ถูกต้อง — คัดลอกมาให้ครบทั้งก้อน (ขึ้นต้นด้วย VG) และวางให้ถูกช่อง';
  $('#p2pRole').addEventListener('click', e => { const b = e.target.closest('button'); if (b) role(b.dataset.role); });
  $('#p2pMake').addEventListener('click', async () => { if (!window.RTCPeerConnection) return setStatus('เบราว์เซอร์นี้เชื่อมตรงไม่ได้ ใช้ Chrome หรือ Edge', true); setStatus('กำลังสร้างรหัสห้อง…'); $('#p2pMake').disabled = true; try { $('#p2pOffer').value = await P2P.offer(); $('#p2pHost2').hidden = false; setStatus('ส่งรหัสห้องให้เพื่อน แล้วรอรหัสตอบกลับ'); } catch (e) { setStatus('สร้างรหัสไม่สำเร็จ ลองอีกครั้ง', true); } $('#p2pMake').disabled = false; });
  $('#p2pCopyO').addEventListener('click', e => copy('#p2pOffer', e.currentTarget));
  $('#p2pConnect').addEventListener('click', async () => { try { await P2P.accept($('#p2pAnsIn').value); setStatus('กำลังเชื่อมต่อ…'); } catch (e) { setStatus(e.message === 'no offer' ? 'กด “สร้างรหัสห้อง” ก่อน' : bad, true); } });
  $('#p2pReply').addEventListener('click', async () => { if (!window.RTCPeerConnection) return setStatus('เบราว์เซอร์นี้เชื่อมตรงไม่ได้ ใช้ Chrome หรือ Edge', true); setStatus('กำลังสร้างรหัสตอบกลับ…'); try { $('#p2pAns').value = await P2P.reply($('#p2pOfferIn').value); $('#p2pGuest2').hidden = false; setStatus('ส่งรหัสตอบกลับให้เพื่อน เมื่อเพื่อนกดเชื่อมต่อ ไฟท์จะเริ่มเอง'); } catch (e) { setStatus(bad, true); } });
  $('#p2pCopyA').addEventListener('click', e => copy('#p2pAns', e.currentTarget));
  role('host');
}
function p2pReset() { P2P.close(); P2P.viaQL = false; QL.drop(); if ($('#qlCode')) { $('#qlCode').hidden = true; $('#qlCopy').hidden = true; } for (const id of ['#p2pOffer', '#p2pAnsIn', '#p2pOfferIn', '#p2pAns']) $(id).value = ''; $('#p2pHost2').hidden = true; $('#p2pGuest2').hidden = true; }

/* ===== player accounts (game only): sign up / log in with e-mail + password on the owner's Supabase project =====
   Keeps: profile (name, friend code), decks, match history, friends. Online status and room invites travel over the same MQTT broker as the room list. */
const Acct = {
  s: null, me: null, refreshing: null, tab: 'login', msg: '', err: false, view: null,
  gate() { return !!(LOCAL && this.on() && !this.s); },   // the game needs an account: no session → only the log-in / sign-up window
  cfg() { const o = store.get('vg.sb'); if (o && o.off) return null; if (o && typeof o === 'object' && /^https?:\/\//.test(o.url || '') && o.key) return o; return LOCAL && LOCAL.sb && LOCAL.sb.url && LOCAL.sb.key ? LOCAL.sb : null; },
  on() { return !!this.cfg(); },
  async req(path, opt) {
    const c = this.cfg(); if (!c) throw new Error('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์บัญชี'); opt = opt || {};
    if (opt.auth !== false && this.s) await this.fresh();
    const h = Object.assign({ apikey: c.key, 'Content-Type': 'application/json' }, opt.headers || {});
    h.Authorization = 'Bearer ' + (opt.auth !== false && this.s ? this.s.access_token : c.key);
    let r; try { r = await fetch(c.url.replace(/\/+$/, '') + path, { method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined }); }
    catch (e) { const x = new Error('ต่อเซิร์ฟเวอร์บัญชีไม่ได้ — ตรวจอินเทอร์เน็ต'); x.net = true; throw x; }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    if (!r.ok) { const e = new Error(this.th(j, r.status)); e.status = r.status; throw e; }
    return j;
  },
  /* server answers → Thai */
  th(j, st) {
    const c = String(j && (j.error_code || j.code || j.error) || ''), m = String(j && (j.msg || j.message || j.error_description) || '');
    const k = (c + ' ' + m).toLowerCase();
    if (/invalid_credentials|invalid login/.test(k)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/user_already_exists|already registered/.test(k)) return 'อีเมลนี้สมัครไว้แล้ว — กดเข้าสู่ระบบ';
    if (/email_not_confirmed|not confirmed/.test(k)) return 'ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ในอีเมลก่อน แล้วเข้าสู่ระบบอีกครั้ง';
    if (/weak_password|password should/.test(k)) return 'รหัสผ่านสั้นหรือง่ายเกินไป (อย่างน้อย 6 ตัว)';
    if (/email_address_invalid|invalid.*email|unable to validate email/.test(k)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (/rate|too many|over_email_send_rate/.test(k) || st === 429) return 'ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่';
    if (/otp_expired|token has expired|invalid.*otp|token.*invalid/.test(k)) return 'รหัสจากอีเมลไม่ถูกต้องหรือหมดอายุ — ขอรหัสใหม่';
    if (/signup.*disabled|signups not allowed/.test(k)) return 'ตอนนี้ปิดรับสมัครอยู่';
    if (/same_password|should be different/.test(k)) return 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม';
    if (/duplicate key|23505/.test(k)) return 'มีข้อมูลนี้อยู่แล้ว';
    return 'เซิร์ฟเวอร์ตอบกลับว่า: ' + (m || c || ('HTTP ' + st));
  },
  keep(s) { if (!s || !s.access_token) return; s.expires_at = s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600); this.s = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user: { id: s.user && s.user.id, email: s.user && s.user.email } }; store.set('vg.sess', this.s); },
  fresh() {
    if (!this.s || this.s.expires_at - 90 > Date.now() / 1000) return Promise.resolve();
    if (!this.refreshing) this.refreshing = (async () => {
      try { this.keep(await this.req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: this.s.refresh_token } })); }
      catch (e) { if (!e.net) this.clear(); }
      finally { this.refreshing = null; }
    })();
    return this.refreshing;
  },
  async signup(email, pw, name) {
    const r = await this.req('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password: pw, data: { name } } });
    if (r && r.access_token) { this.keep(r); await this.after(); return 'in'; }
    try { await this.login(email, pw); return 'in'; } catch (e) { return 'confirm'; }   // e-mail confirmation is switched on in the project
  },
  async login(email, pw) { this.keep(await this.req('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password: pw } })); await this.after(); },
  async logout() { try { await this.req('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* the local session goes anyway */ } this.clear(); },
  clear() { this.s = null; this.me = null; store.set('vg.sess', null); Presence.stop(); Friends.list = []; Friends.reqs = []; this.view = null; acctUI(); },
  async recover(email) { await this.req('/auth/v1/recover', { method: 'POST', auth: false, body: { email } }); },
  async resetWith(email, token, pw) { this.keep(await this.req('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'recovery', email, token } })); await this.req('/auth/v1/user', { method: 'PUT', body: { password: pw } }); await this.after(); },
  async after() {
    const id = this.s && this.s.user.id; if (!id) return;
    const p = await this.req('/rest/v1/profiles?select=id,name,tag&id=eq.' + id);
    this.me = p && p[0] || { id, name: (this.s.user.email || '').split('@')[0].slice(0, 16), tag: '' };
    store.set('vg.name', this.me.name); if ($('#qlName')) $('#qlName').value = this.me.name;
    acctUI(); this.syncDecks(); Presence.start(); Friends.load().catch(() => {});
  },
  async boot() {
    acctUI(); const s = store.get('vg.sess'); if (!this.on() || !s || !s.access_token) return;
    this.s = s; acctUI();
    try { await this.fresh(); if (this.s) await this.after(); } catch (e) { if (e.status === 401) this.clear(); }
  },
  async rename(n) { n = n.trim().slice(0, 16); if (!n) throw new Error('ใส่ชื่อก่อน'); await this.req('/rest/v1/profiles?id=eq.' + this.me.id, { method: 'PATCH', body: { name: n }, headers: { Prefer: 'return=minimal' } }); this.me.name = n; store.set('vg.name', n); if ($('#qlName')) $('#qlName').value = n; Presence.pub(); acctUI(); },
  /* decks: newest copy wins, a removed deck stays removed */
  async syncDecks() {
    if (!this.s) return;
    try {
      const rows = await this.req('/rest/v1/decks?select=id,data,deleted,updated_at') || []; const seen = {};
      for (const r of rows) {
        seen[r.id] = r; const loc = My.decks[r.id]; const t = +r.updated_at || 0;
        if (r.deleted) { if (loc && (loc.t || 0) <= t) { delete My.decks[r.id]; delete VG.DECKS[r.id]; } continue; }
        if (!loc || (loc.t || 0) < t) { const d = VG.unpackDeck(r.id, r.data); if (d) { d.t = t; d.custom = true; d.synced = true; My.reg(d); } }
      }
      for (const id of Object.keys(My.decks)) { const r = seen[id]; if (!r || (My.decks[id].t || 0) > (+r.updated_at || 0)) await this.pushDeck(My.decks[id]); }
      My.saveLocal(); if (!$('#lobby').hidden) renderLobby(); if (!$('#mydecks').hidden && window.VGBuilder && VGBuilder.Decks) VGBuilder.Decks.render && VGBuilder.Decks.render();
    } catch (e) { /* decks stay on this computer */ }
  },
  async pushDeck(d) { if (!this.s || !d) return; try { await this.req('/rest/v1/decks?on_conflict=owner,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { owner: this.s.user.id, id: d.id, data: VG.packDeck(d), deleted: false, updated_at: d.t || Date.now() } }); d.synced = true; } catch (e) { /* next sync */ } },
  async delDeck(id) { if (!this.s) return; try { await this.req('/rest/v1/decks?on_conflict=owner,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { owner: this.s.user.id, id, data: {}, deleted: true, updated_at: Date.now() } }); } catch (e) { /* next sync */ } },
  /* match history */
  record(g) {
    if (!this.s || !g || !g.over || g.vgRec || !S.cfg) return; g.vgRec = true;
    const seat = S.mode === 'solo' ? 0 : S.seat || 0; const o = g.over; const P = S.cfg.players || [];
    const res = o.winner === seat ? 'win' : o.winner === 1 - seat ? 'loss' : 'draw';
    const row = { owner: this.s.user.id, mode: S.mode === 'online' || S.mode === 'bot' ? S.mode : 'solo', my_deck: String(P[seat] && P[seat].deck && P[seat].deck.name || '').slice(0, 80), opp_name: String(P[1 - seat] && P[1 - seat].name || (S.mode === 'bot' ? 'CPU' : '')).slice(0, 40), opp_deck: String(P[1 - seat] && P[1 - seat].deck && P[1 - seat].deck.name || '').slice(0, 80), result: res, turns: g.turnNo || 0, reason: String(o.reason || '').slice(0, 40) };
    this.req('/rest/v1/matches', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: row }).catch(() => {});
  },
  async matches() { return await this.req('/rest/v1/matches?select=played_at,mode,my_deck,opp_name,opp_deck,result,turns,reason&order=played_at.desc&limit=300') || []; },
};
const Friends = {
  list: [], reqs: [],
  async load() {
    if (!Acct.s || !Acct.me) return; const me = Acct.me.id;
    const rows = await Acct.req('/rest/v1/friends?select=owner,friend') || [];
    const mine = rows.filter(r => r.owner === me).map(r => r.friend), them = rows.filter(r => r.friend === me).map(r => r.owner);
    const ids = [...new Set(mine.concat(them))];
    const profs = ids.length ? await Acct.req('/rest/v1/profiles?select=id,name,tag&id=in.(' + ids.join(',') + ')') || [] : [];
    const P = {}; for (const p of profs) P[p.id] = p;
    this.list = mine.filter(i => P[i]).map(i => Object.assign({ mutual: them.includes(i) }, P[i])).sort((a, b) => a.name.localeCompare(b.name));
    this.reqs = them.filter(i => !mine.includes(i) && P[i]).map(i => P[i]);
    Presence.watch(this.list.map(f => f.id)); acctDraw();
  },
  async add(tag) {
    tag = String(tag || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (tag.length !== 6) throw new Error('รหัสเพื่อนมี 6 ตัว');
    if (Acct.me && tag === Acct.me.tag) throw new Error('นี่คือรหัสของคุณเอง');
    const p = await Acct.req('/rest/v1/profiles?select=id,name,tag&tag=eq.' + tag); if (!p || !p[0]) throw new Error('ไม่พบผู้เล่นรหัส ' + tag);
    await Acct.req('/rest/v1/friends', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { owner: Acct.me.id, friend: p[0].id } });
    await this.load(); return p[0];
  },
  async addId(id) { await Acct.req('/rest/v1/friends', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { owner: Acct.me.id, friend: id } }); await this.load(); },
  async remove(id) { await Acct.req('/rest/v1/friends?owner=eq.' + Acct.me.id + '&friend=eq.' + id, { method: 'DELETE' }); await this.load(); },
};
/* online status of friends + room invites (MQTT, retained status per player cleared by the broker when the game closes) */
const Presence = {
  c: null, st: {}, watching: [], beat: 0, busy: false,
  async start() {
    if (this.c || this.busy || !window.mqtt || !Acct.me) return; this.busy = true; const me = Acct.me.id;
    try { this.c = await MQ.conn({ topic: MQP + 'u/' + me, payload: '', qos: 1, retain: true }); } catch (e) { this.busy = false; return; }
    this.busy = false; if (!Acct.me || Acct.me.id !== me) { try { this.c.end(true); } catch (e) { /* gone */ } this.c = null; return; }
    const c = this.c; c.on('connect', () => { this.subAll(); this.pub(); }); c.on('message', (t, b) => this.msg(t, b));
    this.subAll(); this.pub(); this.beat = setInterval(() => this.pub(), 60000);
  },
  stop() { clearInterval(this.beat); const c = this.c; this.c = null; this.st = {}; this.watching = []; if (c) { try { if (c.vgMe) c.publish(MQP + 'u/' + c.vgMe, '', { qos: 1, retain: true }); } catch (e) { /* offline */ } setTimeout(() => { try { c.end(); } catch (e) { /* gone */ } }, 300); } },
  subAll() { if (!this.c || !Acct.me) return; this.c.vgMe = Acct.me.id; this.c.subscribe(MQP + 'inv/' + Acct.me.id, { qos: 1 }); for (const id of this.watching) this.c.subscribe(MQP + 'u/' + id, { qos: 0 }); },
  watch(ids) { if (this.c) for (const id of this.watching) if (!ids.includes(id)) { this.c.unsubscribe(MQP + 'u/' + id); delete this.st[id]; } this.watching = ids.slice(); this.subAll(); },
  pub() {
    if (!this.c || !Acct.me) return;
    const room = QL.role === 'host' && QL.code && !QL.everLinked ? QL.code : '';
    try { this.c.publish(MQP + 'u/' + Acct.me.id, JSON.stringify({ n: Acct.me.name, t: Date.now(), room, play: !!(Net.started && !$('#table').hidden) }), { qos: 1, retain: true }); } catch (e) { /* offline */ }
  },
  msg(t, buf) {
    let o = null; try { o = buf.length ? JSON.parse(String(buf)) : null; } catch (e) { o = null; }
    if (t.startsWith(MQP + 'u/')) { const id = t.slice((MQP + 'u/').length); if (!o) delete this.st[id]; else this.st[id] = { n: String(o.n || ''), t: +o.t || 0, room: /^[A-Z2-9]{6}$/.test(o.room || '') ? o.room : '', play: !!o.play, seen: Date.now() }; acctDraw(); return; }
    if (Acct.me && t === MQP + 'inv/' + Acct.me.id && o && typeof o.code === 'string' && /^[A-Z2-9]{6}$/.test(o.code)) {
      if (!Friends.list.concat(Friends.reqs).some(f => f.id === o.from)) return;   // only from people on your list
      showInvite(String(o.n || 'เพื่อน').slice(0, 16), o.code);
    }
  },
  online(id) { const s = this.st[id]; return s && Date.now() - s.seen < 5 * 60e3 && Math.abs(Date.now() - s.t) < 15 * 60e3 ? s : null; },
  invite(id) { if (!this.c || !Acct.me || QL.role !== 'host' || !QL.code || QL.up !== QL.code) return false; this.c.publish(MQP + 'inv/' + id, JSON.stringify({ from: Acct.me.id, n: Acct.me.name, code: QL.code, t: Date.now() }), { qos: 1 }); return true; },
};
function showInvite(name, code) {
  const box = $('#invToast'); if (!box) return;
  const inGame = !$('#table').hidden;
  box.innerHTML = '<b>' + esc(name) + '</b> ชวนคุณเข้าห้อง <code>' + code + '</code>' + (inGame ? '<span class="note">จบไฟท์นี้ก่อนแล้วกดเข้าห้องจากรายชื่อเพื่อน</span>' : '<button type="button" class="go" data-inv="' + code + '">เข้าห้อง</button>') + '<button type="button" class="ghost" data-inv="">ไม่ใช่ตอนนี้</button>';
  box.hidden = false; try { Sfx.pick(); } catch (e) { /* no sound */ } clearTimeout(showInvite.t); showInvite.t = setTimeout(() => { box.hidden = true; }, 60000);
}
function goOnline() { if (!$('#builder').hidden || !$('#mydecks').hidden) { $('#builder').hidden = true; $('#mydecks').hidden = true; $('#lobby').hidden = false; } S.mode = 'online'; renderLobby(); for (const b of document.querySelectorAll('#modeSeg [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === 'online')); }
/* ---- the account window ---- */
function acctUI() {
  const b = $('#acctBtn'); if (!b) return;
  b.hidden = !LOCAL;
  b.innerHTML = Acct.s ? '<i class="dot"></i>' + esc(Acct.me ? Acct.me.name : 'บัญชี') : 'เข้าสู่ระบบ / สมัคร';
  b.classList.toggle('in', !!Acct.s);
  const m = $('#acct'); const g = Acct.gate();
  document.documentElement.classList.toggle('vg-gate', g);
  if (g && m.hidden) { Acct.tab = Acct.tab === 'signup' || Acct.tab === 'forgot' ? Acct.tab : 'login'; m.hidden = false; }
  if (!g && m.classList.contains('gate') && Acct.s) { m.hidden = true; m.innerHTML = ''; }
  m.classList.toggle('gate', g);
  acctDraw();
}
function acctOpen(tab) { Acct.tab = tab || (Acct.s ? 'profile' : 'login'); Acct.msg = ''; $('#acct').hidden = false; acctDraw(); if (Acct.tab === 'stats') acctStats(); if (Acct.s && Acct.tab === 'friends') Friends.load().catch(e => acctSay(e.message, true)); const f = $('#acct input'); if (f) f.focus(); }
function acctSay(t, err) { Acct.msg = t; Acct.err = !!err; const m = $('#acctMsg'); if (m) { m.textContent = t; m.classList.toggle('err', !!err); } }
function acctDraw() {
  const m = $('#acct'); if (!m || m.hidden) return;
  const tabs = Acct.s ? [['profile', 'โปรไฟล์'], ['stats', 'สถิติ'], ['friends', 'เพื่อน' + (Friends.reqs.length ? ' (' + Friends.reqs.length + ')' : '')]] : [['login', 'เข้าสู่ระบบ'], ['signup', 'สมัครสมาชิก'], ['forgot', 'ลืมรหัสผ่าน']];
  if (!tabs.some(t => t[0] === Acct.tab)) Acct.tab = tabs[0][0];
  let body = '';
  if (!Acct.on()) body = '<p class="note">ระบบบัญชียังไม่ได้เชื่อมกับเซิร์ฟเวอร์ — เจ้าของเกมต้องตั้งค่า Supabase ก่อน ตอนนี้เล่นได้ทุกโหมดโดยไม่ต้องมีบัญชี</p>';
  else if (Acct.tab === 'login') body = '<form class="acf" data-af="login"><label>อีเมล<input name="email" type="email" autocomplete="email" required></label><label>รหัสผ่าน<input name="pw" type="password" autocomplete="current-password" required minlength="6"></label><button class="go" type="submit">เข้าสู่ระบบ</button></form><p class="note">ยังไม่มีบัญชี? กดแท็บ <b>สมัครสมาชิก</b> — ใช้เวลาไม่ถึงนาที</p>';
  else if (Acct.tab === 'signup') body = '<form class="acf" data-af="signup"><label>ชื่อในเกม<input name="name" maxlength="16" required autocomplete="nickname"></label><label>อีเมล<input name="email" type="email" autocomplete="email" required></label><label>รหัสผ่าน (อย่างน้อย 6 ตัว)<input name="pw" type="password" autocomplete="new-password" required minlength="6"></label><label>ยืนยันรหัสผ่าน<input name="pw2" type="password" autocomplete="new-password" required minlength="6"></label><button class="go" type="submit">สมัครสมาชิก</button></form><p class="note">เด็คที่จัดไว้ในเครื่องนี้จะถูกเก็บเข้าบัญชีให้เองหลังสมัคร</p>';
  else if (Acct.tab === 'forgot') body = '<form class="acf" data-af="forgot"><label>อีเมลที่ใช้สมัคร<input name="email" type="email" autocomplete="email" required></label><button class="ghost strong" type="submit">ส่งรหัสรีเซ็ตไปที่อีเมล</button></form><form class="acf" data-af="reset"><label>รหัสจากอีเมล<input name="token" inputmode="numeric" autocomplete="one-time-code" required></label><label>รหัสผ่านใหม่<input name="pw" type="password" autocomplete="new-password" required minlength="6"></label><button class="go" type="submit">ตั้งรหัสผ่านใหม่</button></form>';
  else if (Acct.tab === 'profile') {
    const me = Acct.me || {};
    body = '<div class="acme"><div class="acav">' + esc((me.name || '?').slice(0, 1).toUpperCase()) + '</div><div><b class="acn">' + esc(me.name || '') + '</b><div class="note">' + esc(Acct.s.user.email || '') + '</div></div></div>'
      + '<div class="actag"><span class="note">รหัสเพื่อนของคุณ — ให้เพื่อนใส่รหัสนี้เพื่อเพิ่มคุณ</span><div class="row"><code id="acTag">' + esc(me.tag || '—') + '</code><button type="button" class="ghost strong" data-act="copytag">คัดลอก</button></div></div>'
      + '<form class="acf" data-af="rename"><label>เปลี่ยนชื่อในเกม<input name="name" maxlength="16" value="' + esc(me.name || '') + '" required></label><button class="ghost strong" type="submit">บันทึกชื่อ</button></form>'
      + '<div class="row"><button type="button" class="ghost" data-act="sync">ซิงก์เด็คตอนนี้</button><button type="button" class="ghost" data-act="logout">ออกจากระบบ</button></div>';
  } else if (Acct.tab === 'stats') body = '<div id="acStats"><p class="note">กำลังโหลด…</p></div>';
  else if (Acct.tab === 'friends') {
    const row = f => { const on = Presence.online(f.id); const st = on ? (on.play ? 'กำลังเล่น' : on.room ? 'เปิดห้อง ' + on.room : 'ออนไลน์') : 'ออฟไลน์';
      const acts = (on && on.room ? '<button type="button" class="go sm" data-fjoin="' + on.room + '">เข้าห้อง</button>' : '') + (on && !on.play ? '<button type="button" class="ghost strong sm" data-finv="' + f.id + '">ชวนเข้าห้อง</button>' : '') + '<button type="button" class="ghost sm" data-fdel="' + f.id + '" title="ลบเพื่อน">ลบ</button>';
      return '<div class="acfr' + (on ? ' on' : '') + '"><i class="dot"></i><div class="acfr-t"><b>' + esc(f.name) + '</b><span>' + st + (f.mutual ? '' : ' · รอเขาเพิ่มคุณกลับ') + '</span></div><div class="acfr-a">' + acts + '</div></div>'; };
    body = '<form class="acf inline" data-af="addfriend"><label>เพิ่มเพื่อนด้วยรหัส 6 ตัว<input name="tag" maxlength="6" autocomplete="off" required></label><button class="go" type="submit">เพิ่มเพื่อน</button></form>'
      + (Friends.reqs.length ? '<h4 class="ach">คนที่เพิ่มคุณเป็นเพื่อน</h4>' + Friends.reqs.map(f => '<div class="acfr"><i class="dot"></i><div class="acfr-t"><b>' + esc(f.name) + '</b><span>' + esc(f.tag) + '</span></div><div class="acfr-a"><button type="button" class="go sm" data-fadd="' + f.id + '">เพิ่มกลับ</button></div></div>').join('') : '')
      + '<h4 class="ach">เพื่อนของคุณ (' + Friends.list.length + ')</h4>' + (Friends.list.length ? Friends.list.map(row).join('') : '<p class="note">ยังไม่มีเพื่อน — ส่งรหัสเพื่อนในแท็บโปรไฟล์ให้เพื่อน หรือใส่รหัสของเพื่อนด้านบน</p>')
      + '<p class="note">กด <b>ชวนเข้าห้อง</b> เกมจะสร้างห้องให้แล้วส่งคำชวนไปที่เกมของเพื่อน (เพื่อนต้องเปิดเกมและเข้าสู่ระบบอยู่)</p>';
  }
  const gate = Acct.gate();
  m.innerHTML = '<div class="mbox acbox" role="dialog" aria-modal="true" aria-label="บัญชีผู้เล่น"><div class="achead"><h2>' + (gate ? 'Vanguard D <span>Deck Lab</span>' : 'บัญชีผู้เล่น') + '</h2>' + (gate ? '' : '<button type="button" class="ghost" data-close="1">ปิด</button>') + '</div>'
    + (gate ? '<p class="note acgate">เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มเล่น · บัญชีเก็บเด็ค สถิติ และรายชื่อเพื่อนของคุณไว้ทุกเครื่อง</p>' : '')
    + (Acct.on() ? '<div class="mtabs">' + tabs.map(t => '<button type="button" data-atab="' + t[0] + '" aria-pressed="' + (t[0] === Acct.tab) + '">' + t[1] + '</button>').join('') + '</div>' : '')
    + '<div class="mscroll acbody">' + body + '</div><div class="status' + (Acct.err ? ' err' : '') + '" id="acctMsg" role="status">' + esc(Acct.msg || '') + '</div></div>';
}
async function acctStats() {
  const el = () => $('#acStats');
  try {
    const ms = await Acct.matches(); if (!el()) return;
    const tot = r => ({ w: r.filter(x => x.result === 'win').length, l: r.filter(x => x.result === 'loss').length, d: r.filter(x => x.result === 'draw').length, n: r.length });
    const pct = t => t.n ? Math.round(t.w / t.n * 100) + '%' : '—';
    const modes = [['online', 'ออนไลน์'], ['bot', 'VS CPU'], ['solo', 'SOLO']].map(([k, lb]) => { const t = tot(ms.filter(x => x.mode === k)); return '<div class="acst"><span>' + lb + '</span><b>' + t.w + '–' + t.l + (t.d ? '–' + t.d : '') + '</b><small>ชนะ ' + pct(t) + ' · ' + t.n + ' เกม</small></div>'; }).join('');
    const by = {}; for (const x of ms) if (x.mode !== 'solo') (by[x.my_deck || '-'] = by[x.my_deck || '-'] || []).push(x);
    const decks = Object.keys(by).map(k => [k, tot(by[k])]).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    const RES = { win: 'ชนะ', loss: 'แพ้', draw: 'เสมอ' }, MODE = { online: 'ออนไลน์', bot: 'CPU', solo: 'SOLO' };
    el().innerHTML = '<div class="acsts">' + modes + '</div>'
      + (decks.length ? '<h4 class="ach">ผลตามเด็ค (ออนไลน์ + CPU)</h4><table class="actb"><thead><tr><th>เด็ค</th><th>ชนะ</th><th>แพ้</th><th>อัตราชนะ</th></tr></thead><tbody>' + decks.map(([k, t]) => '<tr><td>' + esc(k) + '</td><td>' + t.w + '</td><td>' + t.l + '</td><td>' + pct(t) + '</td></tr>').join('') + '</tbody></table>' : '')
      + '<h4 class="ach">เกมล่าสุด</h4>' + (ms.length ? '<table class="actb"><thead><tr><th>เมื่อ</th><th>โหมด</th><th>เด็คคุณ</th><th>คู่แข่ง</th><th>ผล</th><th>เทิร์น</th></tr></thead><tbody>' + ms.slice(0, 40).map(x => '<tr class="r-' + x.result + '"><td>' + new Date(x.played_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) + '</td><td>' + (MODE[x.mode] || x.mode) + '</td><td>' + esc(x.my_deck || '') + '</td><td>' + esc((x.opp_name || '') + (x.opp_deck ? ' · ' + x.opp_deck : '')) + '</td><td><b>' + (RES[x.result] || x.result) + '</b></td><td>' + (x.turns || '') + '</td></tr>').join('') + '</tbody></table>' : '<p class="note">ยังไม่มีเกมที่บันทึก — เล่นจบไฟท์ขณะเข้าสู่ระบบอยู่ ผลจะถูกบันทึกให้เอง</p>');
  } catch (e) { if (el()) el().innerHTML = '<p class="note err">' + esc(e.message) + '</p>'; }
}
function acctWire() {
  const m = $('#acct');
  $('#acctBtn').addEventListener('click', () => acctOpen());
  m.addEventListener('click', async e => {
    if ((e.target === m || e.target.closest('[data-close]')) && !Acct.gate()) { m.hidden = true; m.innerHTML = ''; return; }
    const t = e.target.closest('[data-atab]'); if (t) { Acct.tab = t.dataset.atab; Acct.msg = ''; acctDraw(); if (Acct.tab === 'stats') acctStats(); if (Acct.tab === 'friends') Friends.load().catch(x => acctSay(x.message, true)); return; }
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act === 'logout') { await Acct.logout(); acctOpen('login'); acctSay('ออกจากระบบแล้ว'); return; }
    if (a && a.dataset.act === 'sync') { acctSay('กำลังซิงก์เด็ค…'); await Acct.syncDecks(); acctSay('ซิงก์เด็คแล้ว (' + Object.keys(My.decks).length + ' เด็ค)'); return; }
    if (a && a.dataset.act === 'copytag') { const tg = Acct.me && Acct.me.tag || ''; try { await navigator.clipboard.writeText(tg); } catch (x) { /* select instead */ } acctSay('คัดลอกรหัสเพื่อน ' + tg + ' แล้ว'); return; }
    const fj = e.target.closest('[data-fjoin]'); if (fj) { m.hidden = true; goOnline(); QL.join(fj.dataset.fjoin); return; }
    const fi = e.target.closest('[data-finv]'); if (fi) { const id = fi.dataset.finv; fi.disabled = true;
      if (!(QL.role === 'host' && QL.code && !QL.everLinked)) { goOnline(); QL.host(); }
      const t0 = Date.now(); const go = () => { if (Presence.invite(id)) { acctSay('ส่งคำชวนแล้ว — รอเพื่อนกดเข้าห้อง ' + QL.code); fi.disabled = false; return; } if (Date.now() - t0 < 20000) setTimeout(go, 500); else { acctSay('ส่งคำชวนไม่ได้ — ต่อบริการห้องไม่ได้', true); fi.disabled = false; } }; go(); return; }
    const fd = e.target.closest('[data-fdel]'); if (fd) { try { await Friends.remove(fd.dataset.fdel); acctSay('ลบเพื่อนแล้ว'); } catch (x) { acctSay(x.message, true); } return; }
    const fa = e.target.closest('[data-fadd]'); if (fa) { try { await Friends.addId(fa.dataset.fadd); acctSay('เพิ่มเพื่อนแล้ว'); } catch (x) { acctSay(x.message, true); } return; }
  });
  m.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; const v = n => (f.elements[n] ? f.elements[n].value : '').trim(); const btn = f.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    try {
      const k = f.dataset.af;
      if (k === 'login') { acctSay('กำลังเข้าสู่ระบบ…'); await Acct.login(v('email'), f.elements.pw.value); Acct.tab = 'profile'; acctSay('เข้าสู่ระบบแล้ว ยินดีต้อนรับ ' + (Acct.me ? Acct.me.name : '')); }
      else if (k === 'signup') { if (f.elements.pw.value !== f.elements.pw2.value) throw new Error('ยืนยันรหัสผ่านไม่ตรงกัน'); if (!v('name')) throw new Error('ใส่ชื่อในเกมก่อน'); acctSay('กำลังสมัคร…'); const r = await Acct.signup(v('email'), f.elements.pw.value, v('name').slice(0, 16)); if (r === 'in') { Acct.tab = 'profile'; acctSay('สมัครสำเร็จ เข้าสู่ระบบแล้ว'); } else { Acct.tab = 'login'; acctSay('สมัครแล้ว — เปิดลิงก์ยืนยันในอีเมล แล้วกลับมาเข้าสู่ระบบ'); } }
      else if (k === 'forgot') { Acct.resetEmail = v('email'); await Acct.recover(v('email')); acctSay('ส่งรหัสไปที่ ' + v('email') + ' แล้ว — ใส่รหัสด้านล่างพร้อมรหัสผ่านใหม่'); if (btn) btn.disabled = false; return; }
      else if (k === 'reset') { const em = Acct.resetEmail || (m.querySelector('[data-af="forgot"] [name="email"]') || {}).value || ''; if (!em) throw new Error('ใส่อีเมลแล้วกดส่งรหัสก่อน'); await Acct.resetWith(em.trim(), v('token'), f.elements.pw.value); Acct.tab = 'profile'; acctSay('ตั้งรหัสผ่านใหม่แล้ว และเข้าสู่ระบบแล้ว'); }
      else if (k === 'rename') { await Acct.rename(v('name')); acctSay('บันทึกชื่อแล้ว'); }
      else if (k === 'addfriend') { const p = await Friends.add(v('tag')); acctSay('เพิ่ม ' + p.name + ' เป็นเพื่อนแล้ว'); }
      acctUI(); if (Acct.tab === 'stats') acctStats();
    } catch (x) { acctSay(x.message, true); }
    if (btn && btn.isConnected) btn.disabled = false;
  });
  $('#invToast').addEventListener('click', e => { const b = e.target.closest('[data-inv]'); if (!b) return; $('#invToast').hidden = true; if (b.dataset.inv) { goOnline(); QL.join(b.dataset.inv); } });
}

/* ================= my decks (this browser + the signed-in account) ================= */
const My = {
  decks: {},
  reg(d) { VG.DECKS[d.id] = d; this.decks[d.id] = d; },
  loadLocal() { const a = store.get('vg.mydecks') || {}; for (const id in a) { const d = VG.unpackDeck(id, a[id]); if (d) { d.synced = !!a[id].synced; this.reg(d); } } },
  saveLocal() { const o = {}; for (const id in this.decks) { o[id] = VG.packDeck(this.decks[id]); o[id].synced = !!this.decks[id].synced; } store.set('vg.mydecks', o); },
  col() { return Net.db.collection('data/users/' + Net.uid); },
  async sync() {
    if (!(await Net.init()) || !Net.deckDb) return;
    try {
      const q = await this.col().get(); const seen = {};
      for (const doc of q.docs) {
        if (!doc.id.startsWith('deck-')) continue;
        const id = doc.id.slice(5); const p = doc.data() || {};
        seen[id] = true;
        if (p.deleted) { if (this.decks[id] && (this.decks[id].t || 0) <= (+p.t || 0)) { delete this.decks[id]; delete VG.DECKS[id]; } continue; } // removed on another device
        const d = VG.unpackDeck(id, p); if (!d) continue;
        d.synced = true;
        if (!this.decks[id] || (this.decks[id].t || 0) <= d.t) this.reg(d);
      }
      for (const id of Object.keys(this.decks)) if (!seen[id] || !this.decks[id].synced) await this.push(id);
      this.saveLocal(); if (!$('#lobby').hidden) renderLobby();
    } catch (e) { /* stays local */ }
  },
  async push(id) { if (!Net.ready || !Net.deckDb) return; try { await this.col().doc('deck-' + id).set(VG.packDeck(this.decks[id])); this.decks[id].synced = true; this.saveLocal(); } catch (e) { /* stays local */ } },
  save(d) { d.t = Date.now(); d.custom = true; d.source = 'เด็คของฉัน'; d.nation = VG.deckNation(d); d.synced = false; this.reg(d); this.saveLocal(); this.push(d.id); Acct.pushDeck(d); },
  remove(id) { delete this.decks[id]; delete VG.DECKS[id]; this.saveLocal(); Acct.delDeck(id); if (Net.ready && Net.deckDb) this.col().doc('deck-' + id).set({ deleted: true, t: Date.now() }).catch(() => {}); },
};

/* ================= title screen extras: living backdrop, side sheets, menu sounds, opening ================= */
/* Menu sounds are made on the spot (a few oscillator blips); nothing is loaded. Off switch in the top bar, remembered. */
/* Sounds: everything is made on the spot with WebAudio (oscillators + filtered noise); no sound files. One switch (vg.sfx) for menu and table. */
const Sfx = {
  ctx: null, on: true, out: null, nz: null, last: {},
  arm() {
    if (this.ctx || !this.on) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return; const c = this.ctx = new A();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      this.out = c.createGain(); this.out.gain.value = 0.9; this.out.connect(comp); comp.connect(c.destination);
      const n = Math.floor(c.sampleRate * 1.2); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); for (let k = 0; k < n; k++) d[k] = Math.random() * 2 - 1; this.nz = b;
    } catch (e) { this.ctx = null; }
  },
  /* one oscillator note: frequency f (gliding to `to`), length dur, starting `at` seconds from now */
  tone(f, dur, type, vol, to, at) {
    if (!this.on || !this.ctx) return;
    try { const c = this.ctx, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.04, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.out || c.destination); o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* no sound */ }
  },
  /* a burst of filtered noise (swish, thud, crackle): band centre f0 gliding to f1 */
  noise(dur, vol, f0, f1, q, kind, at) {
    if (!this.on || !this.ctx || !this.nz) return;
    try { const c = this.ctx, t = c.currentTime + (at || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.nz; s.loop = true; fl.type = kind || 'bandpass'; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.05, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.out || c.destination); s.start(t, Math.random()); s.stop(t + dur + 0.03); } catch (e) { /* no sound */ }
  },
  arp(notes, step, type, vol, dur, at) { notes.forEach((f, i) => this.tone(f, dur || step * 2.2, type || 'triangle', vol || 0.045, 0, (at || 0) + i * step)); },
  /* play a named sound; the same sound is not started twice within 45 ms (five cards drawn at once must not become a wall of noise) */
  play(name) {
    if (!this.on) return; if (!this.ctx) this.arm(); if (!this.ctx) return;
    const now = performance.now(); if (now - (this.last[name] || 0) < 45) return; this.last[name] = now;
    const f = this.S[name]; if (f) f.call(this);
  },
  S: {
    // cards moving
    draw() { this.noise(0.09, 0.05, 3200, 6200, 0.9, 'bandpass'); this.tone(880, 0.05, 'sine', 0.012, 1320, 0.01); },
    flick() { this.noise(0.06, 0.03, 4200, 2600, 1.2); },
    shuffle() { for (let k = 0; k < 5; k++) this.noise(0.05, 0.03, 2600 + k * 500, 4800, 1.4, 'bandpass', k * 0.045); },
    place() { this.tone(170, 0.16, 'sine', 0.09, 62); this.noise(0.07, 0.05, 1800, 500, 0.8); this.tone(660, 0.09, 'triangle', 0.02, 990, 0.03); },
    od() { this.tone(150, 0.2, 'sine', 0.09, 60); this.noise(0.12, 0.05, 900, 3600, 1.2); this.arp([523, 784, 1047], 0.05, 'triangle', 0.04, 0.16, 0.05); },
    guardcall() { this.tone(300, 0.1, 'square', 0.025, 220); this.noise(0.05, 0.04, 2400, 1200, 1); },
    ride() { this.noise(0.5, 0.06, 300, 5200, 1.1); this.tone(98, 0.5, 'sawtooth', 0.05, 392); this.arp([392, 494, 587, 784], 0.07, 'triangle', 0.055, 0.34, 0.28); this.tone(70, 0.3, 'sine', 0.1, 40, 0.3); },
    retire() { this.noise(0.26, 0.08, 2600, 240, 0.9); this.tone(220, 0.24, 'sawtooth', 0.035, 70); },
    bind() { this.tone(520, 0.22, 'square', 0.02, 180); this.noise(0.18, 0.04, 800, 300, 3); },
    bounce() { this.tone(360, 0.14, 'triangle', 0.045, 760); this.noise(0.08, 0.03, 2400, 4800, 1.2); },
    soul() { this.tone(300, 0.2, 'sine', 0.05, 110); this.noise(0.14, 0.025, 1400, 500, 2); },
    discard() { this.noise(0.1, 0.045, 3000, 900, 1); this.tone(240, 0.08, 'triangle', 0.02, 160); },
    order() { this.arp([587, 880], 0.06, 'square', 0.022, 0.14); this.noise(0.1, 0.03, 2000, 5000, 1.4); },
    // battle
    attack() { this.noise(0.22, 0.09, 500, 5200, 0.9); this.tone(240, 0.18, 'sawtooth', 0.045, 620); this.tone(90, 0.14, 'sine', 0.08, 55, 0.16); },
    boost() { this.arp([440, 660], 0.05, 'triangle', 0.04, 0.12); },
    hit() { this.noise(0.2, 0.13, 1500, 160, 0.7, 'lowpass'); this.tone(120, 0.26, 'sine', 0.13, 42); this.noise(0.08, 0.06, 5200, 2200, 1.2); },
    hitbig() { this.noise(0.36, 0.16, 1800, 110, 0.7, 'lowpass'); this.tone(96, 0.48, 'sine', 0.16, 34); this.tone(196, 0.3, 'sawtooth', 0.04, 62); this.noise(0.12, 0.07, 6000, 1800, 1); },
    guard() { this.tone(1245, 0.2, 'triangle', 0.05, 1180); this.tone(1865, 0.28, 'sine', 0.035, 1760); this.noise(0.05, 0.05, 5200, 3200, 2.4); },
    damage() { this.tone(130, 0.5, 'sawtooth', 0.06, 48); this.tone(138, 0.5, 'sawtooth', 0.05, 51); this.noise(0.3, 0.09, 900, 120, 0.8, 'lowpass'); },
    heal() { this.arp([523, 659, 784, 1047, 1319], 0.065, 'sine', 0.05, 0.3); },
    check() { this.noise(0.07, 0.04, 3400, 5400, 1.1); this.tone(740, 0.09, 'triangle', 0.028); },
    'trig-crit'() { this.arp([988, 1319, 1976], 0.05, 'square', 0.03, 0.2); this.noise(0.18, 0.06, 4000, 7000, 2); this.tone(1976, 0.5, 'sine', 0.035, 0, 0.14); },
    'trig-draw'() { this.arp([659, 880, 1109, 1319], 0.06, 'triangle', 0.05, 0.24); this.noise(0.12, 0.03, 3000, 6000, 1.2); },
    'trig-front'() { this.arp([587, 740, 880, 1175], 0.055, 'sawtooth', 0.03, 0.22); this.tone(147, 0.3, 'sine', 0.07, 110); },
    'trig-heal'() { this.arp([523, 659, 784, 1047, 1319, 1568], 0.06, 'sine', 0.05, 0.34); },
    'trig-over'() { this.noise(0.9, 0.08, 200, 7000, 0.8); this.arp([262, 330, 392, 523, 659, 784, 1047, 1319], 0.055, 'sawtooth', 0.035, 0.3); this.tone(65, 0.9, 'sine', 0.12, 40, 0.4); this.arp([1047, 1319, 1568, 2093], 0.09, 'triangle', 0.05, 0.5, 0.5); },
    // skills and numbers
    skill() { this.arp([784, 988, 1175, 1568], 0.04, 'triangle', 0.04, 0.2); this.noise(0.2, 0.03, 2600, 7000, 3); },
    buff() { this.tone(520, 0.14, 'triangle', 0.04, 1040); },
    debuff() { this.tone(520, 0.18, 'triangle', 0.04, 210); },
    stand() { this.arp([392, 587], 0.05, 'triangle', 0.045, 0.14); },
    energy() { this.arp([880, 1175], 0.04, 'sine', 0.035, 0.1); },
    cost() { this.tone(330, 0.07, 'square', 0.02, 247); this.noise(0.04, 0.03, 2200, 1400, 2); },
    lock() { this.tone(110, 0.35, 'square', 0.035, 82); this.noise(0.2, 0.05, 400, 200, 4); },
    reveal() { this.arp([1047, 1568], 0.07, 'sine', 0.04, 0.2); },
    // flow of the fight
    turn() { this.tone(196, 0.32, 'sawtooth', 0.035, 294); this.arp([587, 784], 0.11, 'triangle', 0.05, 0.3, 0.1); },
    phase() { this.tone(880, 0.05, 'sine', 0.02); },
    battle() { this.tone(82, 0.28, 'sine', 0.12, 50); this.tone(82, 0.24, 'sine', 0.1, 50, 0.16); this.noise(0.3, 0.05, 300, 3000, 1, 'bandpass', 0.1); this.tone(294, 0.3, 'sawtooth', 0.035, 440, 0.16); },
    standup() { this.noise(0.6, 0.06, 240, 6000, 0.9); this.arp([294, 392, 494, 587, 784], 0.08, 'sawtooth', 0.04, 0.3); this.arp([784, 988, 1175], 0.1, 'triangle', 0.06, 0.6, 0.42); this.tone(73, 0.7, 'sine', 0.12, 49, 0.4); },
    persona() { this.noise(0.7, 0.07, 300, 8000, 0.9); this.arp([392, 494, 587, 784, 988, 1175], 0.06, 'triangle', 0.05, 0.32); this.arp([1175, 1568], 0.14, 'sine', 0.06, 0.7, 0.42); this.tone(65, 0.8, 'sine', 0.13, 44, 0.3); },
    win() { this.arp([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 'triangle', 0.06, 0.4); this.arp([262, 330, 392], 0.24, 'sawtooth', 0.03, 0.8); this.tone(1568, 1.2, 'sine', 0.045, 0, 0.84); },
    lose() { this.arp([392, 370, 330, 294, 247, 196], 0.16, 'triangle', 0.055, 0.5); this.tone(98, 1.3, 'sawtooth', 0.04, 55, 0.5); },
    // hands on the table
    click() { this.tone(700, 0.045, 'triangle', 0.035, 900); },
    select() { this.tone(900, 0.05, 'sine', 0.035, 1250); this.noise(0.03, 0.02, 5000, 6500, 2); },
    unselect() { this.tone(900, 0.05, 'sine', 0.025, 640); },
    confirm() { this.arp([660, 990], 0.05, 'triangle', 0.05, 0.13); },
    deny() { this.tone(170, 0.14, 'square', 0.03, 130); },
    ask() { this.arp([740, 988], 0.07, 'sine', 0.04, 0.2); },
    win0() { this.arp([988, 1319], 0.08, 'sine', 0.03, 0.2); },
  },
  hover() { this.tone(1480, 0.04, 'sine', 0.018); },
  pick() { this.tone(620, 0.07, 'triangle', 0.05); this.tone(930, 0.1, 'triangle', 0.05, 0, 0.055); },
  open() { this.tone(420, 0.16, 'triangle', 0.05, 840); this.noise(0.12, 0.025, 1500, 5000, 1.5); },
  close() { this.tone(760, 0.13, 'triangle', 0.04, 380); },
  go() { this.tone(196, 0.42, 'sawtooth', 0.045, 784); this.tone(1175, 0.3, 'triangle', 0.06, 0, 0.3); this.noise(0.5, 0.05, 300, 6000, 1); },
  setOn(v) { this.on = !!v; store.set('vg.sfx', this.on); for (const b of document.querySelectorAll('[data-sfx-toggle]')) { b.setAttribute('aria-pressed', String(this.on)); if (b.dataset.sfxLabel) b.textContent = 'เสียง: ' + (this.on ? 'เปิด' : 'ปิด'); } if (this.on) { this.arm(); this.pick(); } },
};
/* the sound of one thing that happened on the table */
function snd(e) {
  switch (e.t) {
    case 'turn': return Sfx.play('turn');
    case 'standup': return Sfx.play('standup');
    case 'phase': return Sfx.play(e.phase === 'battle' ? 'battle' : e.phase === 'ride' || e.phase === 'main' || e.phase === 'end' ? 'phase' : '');
    case 'persona': return Sfx.play('persona');
    case 'move': {
      if (e.reason === 'draw') return Sfx.play('draw');
      if (e.reason === 'ride' && e.to === 'VC') return Sfx.play('ride');
      if (e.to === 'VC') return Sfx.play('ride');
      if (e.to === 'RC' && e.from !== 'RC' && e.from !== 'VC') return Sfx.play(e.od ? 'od' : 'place');
      if (e.to === 'GC') return Sfx.play('guardcall');
      if (e.to === 'damage') return Sfx.play('damage');
      if (e.from === 'damage' && e.to === 'drop') return Sfx.play('heal');
      if (e.to === 'bind') return Sfx.play('bind');
      if ((e.from === 'RC' || e.from === 'VC') && (e.to === 'drop' || e.to === 'gone')) return Sfx.play('retire');
      if (e.from === 'RC' && e.to === 'hand') return Sfx.play('bounce');
      if (e.to === 'soul') return Sfx.play('soul');
      if (e.to === 'order') return Sfx.play('order');
      if (e.to === 'trigger' || e.reason === 'guardEnd') return;
      if (e.to === 'hand') return Sfx.play('draw');
      if (e.to === 'drop' && (e.from === 'hand' || e.from === 'deck')) return Sfx.play('discard');
      return Sfx.play('flick');
    }
    case 'check': return Sfx.play(e.trigger ? 'trig-' + e.trigger : 'check');
    case 'attack': Sfx.play('attack'); if (e.booster) Sfx.play('boost'); return;
    case 'result': { const tc = e.snap && e.snap.cards[e.target]; return Sfx.play(e.hit ? (tc && tc.zone === 'VC' ? 'hitbig' : 'hit') : 'guard'); }
    case 'ability': return Sfx.play('skill');
    case 'stand': { const c = e.iid != null && e.snap ? e.snap.cards[e.iid] : null; if (c && !c.rest && e.snap.phase !== 'stand') Sfx.play('stand'); return; }
    case 'mod': { const m = e.mod || {}; if (m.power || m.crit || m.shield || m.drive) Sfx.play((m.power || m.crit || m.shield || m.drive) < 0 ? 'debuff' : 'buff'); return; }
    case 'energy': return Sfx.play('energy');
    case 'cost': return Sfx.play('cost');
    case 'lock': return Sfx.play('lock');
    case 'state': return Sfx.play('turn');
    case 'reveal': return Sfx.play('reveal');
    case 'shuffle': return Sfx.play('shuffle');
    case 'swap': return Sfx.play('flick');
    case 'marker': return Sfx.play('order');
  }
}
const Lobby = {
  cv: null, g: null, w: 0, h: 0, dpr: 1, parts: [], px: 0.5, py: 0.5, still: false, last: 0,
  wire() {
    Sfx.on = store.get('vg.sfx') !== false;
    for (const b of document.querySelectorAll('[data-sfx-toggle]')) { b.setAttribute('aria-pressed', String(Sfx.on)); if (b.dataset.sfxLabel) b.textContent = 'เสียง: ' + (Sfx.on ? 'เปิด' : 'ปิด'); b.addEventListener('click', () => Sfx.setOn(!Sfx.on)); }
    // every button of the table, the windows and the deck editor answers with a small click
    document.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled || b.closest('#lobby') || b.dataset.sfxToggle !== undefined) return; Sfx.play(b.classList.contains('pri') || b.classList.contains('go') ? 'confirm' : 'click'); }, true);
    document.addEventListener('pointerdown', () => Sfx.arm(), { once: true, capture: true });
    const lob = $('#lobby');
    lob.addEventListener('pointerover', e => { const b = e.target.closest('.lb-menu button, .go.big'); if (b && !b.contains(e.relatedTarget)) Sfx.hover(); });
    lob.addEventListener('click', e => { const d = e.target.closest('[data-drawer]'); if (d) return this.drawer(d.dataset.drawer); if (e.target.closest('[data-dclose]')) this.drawer(null); });
    $('#newDeckBtn').addEventListener('click', () => Sfx.open());
    document.addEventListener('keydown', e => {
      if ($('#lobby').hidden) return;
      if (e.key === 'Escape' && !$('#drawer').hidden) { e.preventDefault(); return this.drawer(null); }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement && document.activeElement.closest('.lb-menu')) { const L = [...document.querySelectorAll('.lb-menu button')]; const i = L.indexOf(document.activeElement); if (i >= 0) { e.preventDefault(); L[(i + (e.key === 'ArrowDown' ? 1 : L.length - 1)) % L.length].focus(); Sfx.hover(); } }
    });
    lob.addEventListener('pointermove', e => { this.px = e.clientX / Math.max(1, window.innerWidth); this.py = e.clientY / Math.max(1, window.innerHeight); });
    this.still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.cv = $('#lbFx'); this.g = this.cv.getContext ? this.cv.getContext('2d') : null;
    window.addEventListener('resize', () => this.size());
    this.size(); if (this.g) requestAnimationFrame(t => this.frame(t));
    this.opening(); this.tip();
  },
  tips: ['ระหว่างเล่น กด ✋ ทำเอง ได้ทุกเมื่อที่เป็นตาคุณ เพื่อทำสกิลที่ยังไม่ออโต้ด้วยมือ', 'โหมด SOLO FIGHT ย้อนกลับได้ทีละการตัดสินใจ เหมาะกับการลองไลน์เล่นซ้ำๆ', 'กด ดูการ์ด ที่เด็คเพื่อดูว่าใบไหนออโต้ครบ ออโต้บางส่วน หรือยังต้องทำเอง', 'DECK EDIT ค้นหาได้ทั้งชื่ออังกฤษ ชื่อญี่ปุ่น และเลขการ์ด', 'เพอร์โซน่าไรด์: ไรด์ใบชื่อเดียวกับแวนการ์ดเกรด 3 แถวหน้าพลัง +10000 และจั่ว 1 ใบ', 'จัดเด็คของตัวเองได้ที่ MY DECKS แล้วใช้ในห้องออนไลน์กับเพื่อนได้เลย'],
  tip() { const el = $('#lbTip'); if (!el) return; let i = Math.floor(Math.random() * this.tips.length); const show = () => { el.textContent = this.tips[i % this.tips.length]; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; i++; }; show(); if (!this.still) setInterval(() => { if (!$('#lobby').hidden) show(); }, 7000); },
  /* side sheet: 'opt' (card pictures) / 'help' / null to close */
  drawer(name) {
    const d = $('#drawer'); if (!name) { if (!d.hidden) { d.hidden = true; Sfx.close(); const b = this.from; this.from = null; if (b) b.focus(); } return; }
    this.from = document.activeElement; d.querySelectorAll('.lb-dbody').forEach(el => { el.hidden = el.dataset.d !== name; });
    $('#drawerT').textContent = name === 'opt' ? 'CARD ART · รูปการ์ด' : 'HOW TO PLAY · วิธีใช้';
    d.hidden = false; Sfx.open(); const c = d.querySelector('[data-dclose].lb-ico'); if (c) c.focus();
  },
  /* opening: the logo card lifts, then the menu and the two deck plates come in. With the animation library present it runs the sequence; otherwise the style sheet's own keyframes do. */
  opening() {
    const done = () => { document.body.classList.add('seen'); document.body.classList.remove('gs', 'gs-run'); };
    if (this.still) return done();
    setTimeout(() => {
      const gs = window.gsap; if (!gs || $('#lobby').hidden) return setTimeout(done, 2300);
      document.body.classList.add('gs', 'gs-run');
      try {
        const tl = gs.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => { gs.set('#lbIntro, .lb-menu button, .lb-stage, .dk, .vs, .fc .card, .go.big, .lb-logo, .lb-tools', { clearProps: 'all' }); done(); } });
        tl.to('#lbIntro .in', { scale: 0.86, opacity: 0, duration: 0.3, ease: 'power2.in' })
          .to('#lbIntro', { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)', duration: 0.55, ease: 'power4.inOut' }, '-=0.08')
          .from('.lb-logo', { x: -40, opacity: 0, duration: 0.5 }, '-=0.35').from('.lb-tools', { x: 40, opacity: 0, duration: 0.5 }, '<')
          .from('.lb-menu button', { x: -70, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'back.out(1.5)' }, '-=0.3')
          .from('.lb-stage', { y: 34, opacity: 0, duration: 0.55 }, '-=0.55')
          .from('.dk.p0', { x: -60, rotationY: 55, opacity: 0, duration: 0.6, transformPerspective: 900 }, '-=0.35').from('.dk.p1', { x: 60, rotationY: -55, opacity: 0, duration: 0.6, transformPerspective: 900 }, '<')
          .from('.fc .card', { y: 90, opacity: 0, rotation: 24, duration: 0.5, stagger: 0.05, ease: 'back.out(1.6)' }, '-=0.35')
          .from('.vs', { scale: 3.2, rotation: -24, opacity: 0, duration: 0.45, ease: 'elastic.out(1, 0.55)' }, '-=0.3')
          .from('.go.big', { scale: 0.7, opacity: 0, duration: 0.4, ease: 'back.out(2.2)' }, '-=0.25');
      } catch (e) { done(); }
    }, 880);
  },
  /* a short curtain over the table when a fight starts (never takes a click) */
  curtain() {
    if (this.still) return; const el = document.createElement('div'); el.className = 'curtain'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '<i></i><i></i><b>STAND UP!</b>'; $('#app').appendChild(el); setTimeout(() => el.remove(), 1000);
  },
  size() {
    if (!this.cv) return; this.dpr = Math.min(1.5, window.devicePixelRatio || 1); this.w = window.innerWidth; this.h = window.innerHeight; this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    const n = Math.round(Math.min(64, Math.max(24, this.w * this.h / 26000))); this.parts = []; for (let i = 0; i < n; i++) this.parts.push(this.ember(true));
    if (this.still && this.g) this.draw(4000);
  },
  ember(any) { return { x: Math.random(), y: any ? Math.random() : 1.05, r: 0.6 + Math.random() * 1.8, v: 0.018 + Math.random() * 0.05, s: Math.random() * 6.28, hue: Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : 2, a: 0.25 + Math.random() * 0.6 }; },
  frame(t) {
    if (this.still) return;
    if ($('#lobby').hidden) { this.last = 0; return setTimeout(() => requestAnimationFrame(x => this.frame(x)), 400); }
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0.016; this.last = t;
    for (const p of this.parts) { p.y -= p.v * dt; p.s += dt * 0.9; p.x += Math.sin(p.s) * 0.0006; if (p.y < -0.05) Object.assign(p, this.ember(false)); }
    this.draw(t); requestAnimationFrame(x => this.frame(x));
  },
  draw(t) {
    const g = this.g, w = this.w, h = this.h; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, w, h);
    const wide = w > 900; const cx = (wide ? w * 0.66 : w * 0.5) + (this.px - 0.5) * -26, cy = (wide ? h * 0.54 : h * 0.42) + (this.py - 0.5) * -18; const R = Math.max(w, h) * (wide ? 0.4 : 0.52); const a = t / 1000;
    // glow behind the stage
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25); gr.addColorStop(0, 'rgba(70, 92, 220, .30)'); gr.addColorStop(0.45, 'rgba(48, 40, 140, .14)'); gr.addColorStop(1, 'rgba(7, 8, 23, 0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gr = g.createRadialGradient(w * 0.08, h * 1.02, 0, w * 0.08, h * 1.02, R * 0.9); gr.addColorStop(0, 'rgba(244, 195, 86, .13)'); gr.addColorStop(1, 'rgba(244, 195, 86, 0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // slow light bars
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const x = ((a * (9 + i * 4) + i * 420) % (w + 700)) - 350; const lg = g.createLinearGradient(x, 0, x + 220, 0); lg.addColorStop(0, 'rgba(90, 130, 255, 0)'); lg.addColorStop(0.5, 'rgba(90, 130, 255, ' + (0.05 + i * 0.012) + ')'); lg.addColorStop(1, 'rgba(90, 130, 255, 0)'); g.fillStyle = lg; g.transform(1, 0, -0.42, 1, 0, 0); g.fillRect(x + h * 0.42, 0, 220, h); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    g.restore();
    // the great circle: rings, ticks, two triangles, six studs — turning against each other
    g.save(); g.translate(cx, cy); g.lineCap = 'round';
    const ring = (r, col, lw, dash, rot) => { g.save(); g.rotate(rot); g.beginPath(); g.setLineDash(dash || []); g.arc(0, 0, r, 0, 6.2832); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); g.restore(); };
    ring(R, 'rgba(244, 195, 86, .30)', 1.6, null, 0); ring(R * 0.965, 'rgba(244, 195, 86, .16)', 1, [2, 9], a * 0.05);
    g.save(); g.rotate(a * 0.03); g.strokeStyle = 'rgba(244, 195, 86, .28)'; g.lineWidth = 1.2; for (let i = 0; i < 72; i++) { const l = i % 6 === 0 ? 0.045 : 0.018; g.beginPath(); g.moveTo(R * (1 - l - 0.045), 0); g.lineTo(R * (1 - 0.045), 0); g.stroke(); g.rotate(6.2832 / 72); } g.restore();
    ring(R * 0.8, 'rgba(86, 220, 236, .26)', 1.3, [22, 14], -a * 0.06); ring(R * 0.62, 'rgba(255, 92, 138, .20)', 1, [3, 7], a * 0.09); ring(R * 0.44, 'rgba(244, 195, 86, .22)', 1.2, null, 0);
    const tri = (rot, col) => { g.save(); g.rotate(rot); g.beginPath(); for (let i = 0; i < 3; i++) { const q = i * 2.0944 - 1.5708; g[i ? 'lineTo' : 'moveTo'](Math.cos(q) * R * 0.8, Math.sin(q) * R * 0.8); } g.closePath(); g.strokeStyle = col; g.lineWidth = 1; g.stroke(); g.restore(); };
    tri(-a * 0.06, 'rgba(86, 220, 236, .15)'); tri(-a * 0.06 + 3.1416, 'rgba(86, 220, 236, .15)');
    g.save(); g.rotate(a * 0.09); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(R * 0.62, 0, 5, 0, 6.2832); g.fillStyle = 'rgba(255, 92, 138, .45)'; g.fill(); g.beginPath(); g.arc(R * 0.62, 0, 12, 0, 6.2832); g.strokeStyle = 'rgba(255, 92, 138, .22)'; g.lineWidth = 1; g.stroke(); g.rotate(1.0472); } g.restore();
    g.restore();
    // embers
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { const x = p.x * w, y = p.y * h; const al = p.a * Math.min(1, (1.05 - p.y) * 3) * (0.6 + 0.4 * Math.sin(p.s * 2.3)); const col = p.hue === 0 ? '244, 195, 86' : p.hue === 1 ? '86, 220, 236' : '255, 92, 138';
      const eg = g.createRadialGradient(x, y, 0, x, y, p.r * 5); eg.addColorStop(0, 'rgba(' + col + ', ' + (al * 0.9).toFixed(3) + ')'); eg.addColorStop(1, 'rgba(' + col + ', 0)'); g.fillStyle = eg; g.fillRect(x - p.r * 5, y - p.r * 5, p.r * 10, p.r * 10); }
    g.restore();
  },
};

/* ================= boot ================= */
function boot() {
  const sp = store.get('vg.speed'); if (sp === 2.5 || sp === 6) { S.speed = sp; $('#mSpeed').textContent = 'ความเร็ว: ' + (sp === 2.5 ? 'เร็ว' : 'เร็วมาก'); }
  if (window.VG_DB_DATA) VG.loadDB(window.VG_DB_DATA);
  if (window.VG_JP_DATA) VG.loadJP(window.VG_JP_DATA);
  for (const id in VG.DECKS) { const d = VG.DECKS[id]; if (!d.custom) { d.ride = d.ride.map(VG.canon); for (const e of d.main) e.no = VG.canon(e.no); } }
  My.loadLocal();
  const dk = store.get('vg.decks'); if (Array.isArray(dk) && VG.DECKS[dk[0]] && VG.DECKS[dk[1]]) S.decks = dk;
  if (LOCAL) {   // the copy on the owner's disk: no online rooms; automatic card pictures
    { const ob = $('#modeSeg [data-mode="online"]'); if (ob) ob.querySelector('small').textContent = 'เชื่อมตรงกับเครื่องเพื่อน ด้วยรหัสห้อง 6 ตัว'; }
    document.documentElement.classList.add('vg-local'); acctWire(); Acct.boot();
    $('#roomPanel').hidden = true; $('#p2pPanel').hidden = false; $('#p2pPanel').appendChild($('#onStatus')); p2pWire();
    $('#autoBox').hidden = false; $('#imgBase').value = imgBase(); $('#imgWeb').checked = webOn(); $('#imgJp').checked = jpOn();
    $('#imgJp').addEventListener('change', e => { store.set('vg.imgJp', e.target.checked); autoReset(); });
    $('#imgBase').addEventListener('change', e => { let v = e.target.value.trim(); const m = /^(https?:\/\/.+\/)[a-z0-9-]+\/[a-z0-9_-]+\.(?:png|jpg|webp)$/i.exec(v); if (m) v = m[1]; if (v && !v.endsWith('/')) v += '/'; e.target.value = v; store.set('vg.imgBase', v); autoReset(); });
    $('#imgWeb').addEventListener('change', e => { store.set('vg.imgWeb', e.target.checked); autoReset(); });
    $('#imgRetry').addEventListener('click', () => { autoReset(); findBack(); });
    { const show = o => { if (!o || o.n == null) return; $('#cacheRow').hidden = false; $('#cacheStat').textContent = 'เก็บรูปไว้ในเครื่องนี้แล้ว ' + o.n.toLocaleString('en-US') + ' รูป (' + (o.bytes / 1048576).toFixed(0) + ' MB) — เปิดครั้งต่อไปขึ้นทันที ไม่ต้องโหลดใหม่'; };
      const ask = p => fetch('vgcache://img/' + p).then(r => r.json()).then(show).catch(() => {});   // only the game app answers this (picture cache on disk)
      ask('stat'); $('#navOpt').addEventListener('click', () => ask('stat'));
      $('#cacheClear').addEventListener('click', () => { ask('clear').then(() => { autoReset(); }); }); }
    $('#wikiOn').checked = wikiOn(); $('#wikiOn').addEventListener('change', e => { store.set('vg.wikiText', e.target.checked); });
    $('#backUrl').value = store.get('vg.backUrl') || ''; $('#backUrl').addEventListener('change', e => { store.set('vg.backUrl', e.target.value.trim()); findBack(); });
  }
  wire(); renderLobby(); loadImages();
  My.sync();
}
window.VGUI = { S, Net, My, P2P, QL, Rooms, MQ, Acct, Friends, Presence, acctOpen, newLocal, submit, undo, renderLobby, store, esc, statLine, fmtText, cardNote, staticCard, tagOf, imgFor, $, openCard, closeCard, CW, Sfx };
boot();
})();
