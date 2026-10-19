const NAT = { 'Lyrical Monasterio': 'lm', 'Dragon Empire': 'de', 'Dark States': 'ds', 'Brandt Gate': 'bg', 'Keter Sanctuary': 'ks', 'Stoicheia': 'st' };
const TRIG = { crit: 'CRITICAL', draw: 'DRAW', front: 'FRONT', heal: 'HEAL', over: 'OVER' };
const PHASES = [['stand', 'Stand'], ['draw', 'Draw'], ['ride', 'Ride'], ['main', 'Main'], ['battle', 'Battle'], ['end', 'End']];

/* Table geometry. The field is a flat board (board units, origin top-left of the board) tilted away from the viewer around its near edge;
   hand, trigger check and HUD stay in screen space. cx/hy: where the middle of the near edge sits on the stage, th: tilt, D/oy: camera distance and eye height. */
const LAY = {
  land: {
    W: 1600, H: 900, cx: 952, hy: 778, th: 40, D: 1500, oy: 120, BW: 1280, BH: 1000, cs: 1.06, cd: 152,
    circles: { V: [640, 664], FL: [468, 664], FR: [812, 664], BL: [468, 862], BC: [640, 862], BR: [812, 862] },
    deck: [1004, 862, 0.84], drop: [1004, 672, 0.84], ride: [276, 862, 0.74], removed: [1226, 672, 0.52], bind: [1144, 672, 0.52],
    order: { x: 1128, y: 862, s: 0.64, step: 40 }, damage: { x: 276, y: 566, step: 42, s: 0.62 }, crest: [150, 862, 0.5],
    gc: { y: 500, s: 0.86, step: 104, w: 560, h: 132 },
    hand: { x: 952, y: 828, w: 600, s: 1.02 }, oppHand: { x: 952, y: 26, w: 360, s: 0.46 }, trigger: [1330, 356, 1.34],
    side: [8, 8, 296, 372], prompt: [8, 388, 296, 178], log: [8, 574, 296, 318], phase: [1592, 50], menu: [1592, 8],
    plate: [318, 700], oppPlate: [318, 12], cta: [1592, 892], cut: 400,
  },
  port: {
    W: 720, H: 1280, cx: 360, hy: 1010, th: 24, D: 2100, oy: 250, BW: 700, BH: 830, cs: 0.9, cd: 124,
    circles: { V: [350, 546], FL: [216, 546], FR: [484, 546], BL: [216, 706], BC: [350, 706], BR: [484, 706] },
    deck: [628, 708, 0.66], drop: [628, 590, 0.66], ride: [72, 708, 0.6], removed: [608, 482, 0.36], bind: [654, 482, 0.36],
    order: { x: 574, y: 800, s: 0.44, step: 26 }, damage: { x: 72, y: 470, step: 30, s: 0.5 }, crest: [72, 800, 0.36],
    gc: { y: 415, s: 0.7, step: 80, w: 420, h: 104 },
    hand: { x: 360, y: 1098, w: 600, s: 1.08 }, oppHand: { x: 360, y: 150, w: 300, s: 0.42 }, trigger: [360, 560, 1.5],
    side: [8, 8, 704, 92], prompt: [8, 1178, 704, 96], log: null, phase: [712, 108], menu: [712, 142],
    plate: [8, 1004], oppPlate: [8, 108], cta: null, cut: 600,
  },
};

const S = {
  mode: 'solo', decks: ['1MCW2', 'TD01'], first: 'rand', speed: 1, lay: 'land', viewer: 0, seat: 0,
  game: null, cfg: null, meta: null, snap: null, pl: {}, busy: false, running: false, again: false,
  src: null, picks: new Set(), picker: null, sending: false, view: 'auto', els: {}, tags: {},
};
const IMG = {};

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
  const out = []; for (const n of nos) { const k = imgKey(n); out.push(k, k.replace(/en$/, '')); } out.push(imgKey(d.name));
  return [...new Set(out)];
}
function imgFor(d) { if (!IMG.n) return null; for (const k of imgKeys(d)) if (IMG[k]) return IMG[k]; return null; }
function fmtK(n) { return n >= 100000000 ? Math.round(n / 1000000) + 'M' : String(n); }
function faceHTML(d) {
  const nk = NAT[d.nation] || 'none'; const url = imgFor(d);
  const hs = hash(d.name); const hue = hs % 360; const ang = (hs >>> 9) % 360; const px = 28 + (hs >>> 18) % 44;
  const unit = d.type === 'unit' || d.type === 'token';
  const kw = unit ? (d.drive === 3 ? 'TRIPLE' : d.drive === 2 ? 'TWIN' : d.intercept ? 'INTERCEPT' : d.boost ? 'BOOST' : '') : d.type === 'order' ? (d.orderKind === 'set' ? 'SET ORDER' : d.orderKind === 'blitz' ? 'BLITZ' : 'ORDER') : d.type === 'crest' ? 'CREST' : '';
  const stats = unit ? '<b class="cf-p">' + fmtK(d.power) + '</b>' + (d.shield != null ? '<b class="cf-s">' + fmtK(d.shield) + '</b>' : '') : '';
  if (url) return '<div class="cf has-img n-' + nk + '"><img class="cf-img" src="' + url + '" alt="" draggable="false"></div>';
  return '<div class="cf n-' + nk + (d.trigger ? ' trg t-' + d.trigger : '') + (d.type === 'order' ? ' ord' : '') + '" style="--h:' + hue + ';--a:' + ang + 'deg;--px:' + px + '%">'
    + '<div class="cf-art"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + SIGIL[sigilOf(d)] + '"/></svg></div>'
    + '<span class="cf-g">' + (d.grade == null ? '◆' : d.grade) + '</span>'
    + '<span class="cf-ks">' + (kw ? '<i>' + kw + '</i>' : '') + (d.persona ? '<i class="pr">PERSONA</i>' : '') + (d.sentinel ? '<i class="sn">SENTINEL</i>' : '') + '</span>'
    + (d.trigger ? '<b class="cf-t">' + TRIG[d.trigger] + '</b>' : '')
    + '<div class="cf-b"><span class="cf-n">' + esc(d.name) + '</span><span class="cf-st">' + (stats || '<em>' + esc(kw) + '</em>') + '</span></div></div>';
}
function staticCard(no, up, cls) { return '<div class="card nomove ' + (up === false ? '' : 'up ') + (cls || '') + '"><div class="in"><div class="cb"></div>' + faceHTML(C[no]) + '</div></div>'; }
