/* Vanguard D-format rules engine. Deterministic: (seed + ordered answers) fully define a game. */
(function (root) {
'use strict';
const VG = root.VG = root.VG || {};
VG.CARDS = VG.CARDS || {};
VG.DECKS = VG.DECKS || {};
/* card lookup; db.js replaces this with one that also builds cards from the full card list */
VG.card = VG.card || (no => VG.CARDS[no]);

const RCS = ['FL', 'BL', 'BC', 'BR', 'FR'];
const FRONT = ['FL', 'V', 'FR'];
const BACK = ['BL', 'BC', 'BR'];
const BEHIND = { FL: 'BL', V: 'BC', FR: 'BR' };
const COLOF = { FL: 'L', BL: 'L', V: 'C', BC: 'C', FR: 'R', BR: 'R' };
const LISTS = ['deck', 'hand', 'drop', 'damage', 'soul', 'bind', 'removed', 'ride', 'order', 'crest', 'trigger', 'GC', 'dress', 'gauge', 'prison', 'arms', 'music', 'gzone', 'heart', 'memory', 'mbox'];   // gzone = the G zone (G units, face down until they have strode); heart = the card under a strode G unit   // music = a played Music order lying on the back row center circle until the end of the turn   // prison = this fighter's cards imprisoned in the opponent's Prison   // dress = originalDress cards lying under an overDress unit (card.host = that unit)
const MOVE_EVENTS = new Set(['placeRC', 'placeVC', 'placeGC', 'leaveRC', 'toOrder', 'toCrest', 'discard', 'rodeUpon', 'retireGC', 'toSoul', 'bound', 'toDress']);
const NUMERIC = new Set(['power', 'crit', 'shield', 'drive', 'grade', 'trigPlus']);
const META = new Set(['until', 'exp', 'trig', 'restand', 'used', 'driveMin']);
const GAME_OVER = { gameOver: true };
const isField = z => z === 'VC' || z === 'RC' || z === 'GC';

VG.RCS = RCS; VG.FRONT = FRONT; VG.BACK = BACK; VG.BEHIND = BEHIND;
/* codes used by manual actions (kept numeric so an answer is always a list of integers) */
VG.MAN = { op: { draw: 1, sc: 2, mill: 3, cc: 4, cb: 5, ec: 6, shuf: 7, look: 8, st: 9, mod: 10, flip: 11, mv: 12 }, dest: ['hand', 'drop', 'soul', 'bind', 'top', 'bottom', 'damage', 'order', 'removed', 'rc', 'vc', 'gc'], key: ['power', 'crit', 'drive', 'shield'] };
const MAN_FROM = new Set(['hand', 'drop', 'soul', 'bind', 'damage', 'order', 'removed', 'deck', 'ride', 'RC', 'GC']);

/* ---------- costs ---------- */
const cblFor = (G, me, use) => { const L = G.tf['cbl' + me.owner]; if (!L || !L.length) return 0; const d = G.def(me); const playing = d.type === 'order' && me.zone !== 'order'; const races = (d.race || '').toLowerCase().split('/').map(x => x.trim());
  const i = L.findIndex(e => (e.any || (e.play ? playing : !playing)) && (!e.nm || d.name === e.nm) && (!e.nh || d.name.includes(e.nh)) && (!e.rc || races.includes(e.rc))); if (i < 0) return 0; const n = L[i].n || 1; if (use && !L[i].keep) L.splice(i, 1); return n; };
/* "reduce the number of cards you discard / remove for the cost of …'s ability by n" — tf.less<p> = [{ kind, nm, iid, n, keep }] */
const lessFor = (G, me, kind, use) => { const L = G.tf['less' + me.owner]; if (!L || !L.length) return 0; const d = G.def(me); const i = L.findIndex(e => e.kind === kind && (!e.nm || d.name.includes(e.nm)) && (e.iid == null || e.iid === me.iid)); if (i < 0) return 0; const n = L[i].n || 1; if (use && !L[i].keep) L.splice(i, 1); return n; };
VG.lessFor = lessFor;
const cost = VG.cost = {
  CB: n => ({
    label: 'เคาน์เตอร์บลาสต์ ' + n,
    can: (G, me) => G.players[me.owner].damage.filter(i => G.cards[i].faceup).length >= Math.max(0, n - (G.cbDisc || 0) - (G.def(me).costLess ? G.def(me).costLess(G, me) : 0) - cblFor(G, me)),
    *pay(G, me) { const k = Math.max(0, n - (G.cbDisc || 0) - (G.def(me).costLess ? G.def(me).costLess(G, me) : 0) - cblFor(G, me, true)); if (G.cbDisc) { G.cbDisc = 0; if (G.cbDiscCard) G.cbDiscCard.cbLess = null; G.log('คอสต์เคาน์เตอร์บลาสต์ลดลง 1', me.owner); } if (k > 0) G.counterBlast(me.owner, k); G.tlog({ k: 'cost', kind: 'cb', n, p: me.owner, by: me.iid }); return n; },
  }),
  SB: n => ({
    label: 'โซลบลาสต์ ' + n,
    can: (G, me) => G.dblCan(me, 'sb', G.soulFor(me.owner), Math.max(0, n - lessFor(G, me, 'sb'))),
    *pay(G, me) {
      const P = G.players[me.owner];
      const n1 = Math.max(0, n - lessFor(G, me, 'sb', true)); const sel = n1 ? yield* G.dblChoose(me, 'sb', G.soulFor(me.owner), n1, { title: 'เลือกการ์ดในโซลเพื่อโซลบลาสต์ ' + n1 + ' ใบ', hint: 'soulblast', zone: 'soul' }) : [];

      for (const i of sel) G.move(i, 'drop', { reason: 'sb' });
      G.ev('cost', { p: me.owner, kind: 'SB', n }); G.tlog({ k: 'cost', kind: 'sb', n: sel.length, p: me.owner, by: me.iid });
      G.emit('sbcost', { p: me.owner, n: sel.length, ids: sel.slice(), by: G.cur ? G.cur.iid : null });
      return sel;
    },
  }),
  EB: n => ({
    label: 'เอเนอร์จีบลาสต์ ' + n,
    can: (G, me) => G.players[me.owner].energy >= Math.max(0, n - lessFor(G, me, 'eb')) && (!G.tf['ebonly' + me.owner] || G.tf['ebonly' + me.owner].some(h => G.def(me).name.includes(h))),
    *pay(G, me) { const P = G.players[me.owner]; const n1 = Math.max(0, n - lessFor(G, me, 'eb', true)); P.energy -= n1; G.ev('energy', { p: me.owner, n: -n, total: P.energy }); G.tlog({ k: 'cost', kind: 'eb', n, p: me.owner, by: me.iid, type: G.cur ? G.cur.type : null }); return n; },
  }),
  discard: (n, filter) => ({
    label: 'ทิ้งการ์ดจากมือ ' + n + ' ใบ',
    can: (G, me) => G.dblCan(me, 'disc', G.players[me.owner].hand.filter(i => i !== me.iid && (!filter || filter(G, G.cards[i]))), Math.max(0, n - lessFor(G, me, 'disc'))),
    *pay(G, me) {
      const P = G.players[me.owner];
      const c = G.handFor(me.owner).filter(i => i !== me.iid && (!filter || filter(G, G.cards[i])));
      let n1 = Math.max(0, n - lessFor(G, me, 'disc', true));
      if (n1 > 0) { const u = G.rcs(me.owner).find(x => { const dl = G.def(x).discLess; return dl && G.def(me).name.includes(dl.nm) && (!dl.vg || VG.fx.ev(G, VG.fx.mkCtx(x), ['vg', dl.vg])); }); if (u && (yield* G.yesNo(me.owner, { title: 'รีไทร์ ' + G.name(u) + ' เพื่อลดการ์ดที่ต้องทิ้ง 1 ใบ?', iid: u.iid, options: [{ id: 'yes', label: 'รีไทร์' }, { id: 'no', label: 'ไม่' }] }))) { G.retire(u.iid, 'cost'); n1--; } }
      const sel = n1 ? yield* G.dblChoose(me, 'disc', c, n1, { title: 'เลือกการ์ดจากมือเพื่อทิ้ง ' + n1 + ' ใบ', hint: 'discard', zone: 'hand' }) : [];
      for (const i of sel) G.move(i, 'drop', { reason: 'discard' });
      return sel;
    },
  }),
  soulSelf: () => ({
    label: 'นำยูนิทนี้เข้าโซล',
    can: (G, me) => me.zone === 'RC' || me.zone === 'GC',
    *pay(G, me) { G.move(me.iid, 'soul', { reason: 'cost' }); return 1; },
  }),
};

/* ---------- game ---------- */
class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.rs = (cfg.seed >>> 0) || 1;
    this.cards = {};
    this.nid = 1;
    this.turnNo = 0;
    this.active = 0;
    this.first = 0;
    this.phase = 'setup';
    this.pendingAutos = [];
    this.battle = null;
    this.over = null;
    this.cur = null;       // card whose ability is resolving (source of moves)
    this.tf = {};          // per-turn facts, cleared every turn
    this.laters = [];      // delayed effects: end of battle / end of turn
    this.markers = [];     // markers lying on rear-guard circles: { p: whose circle, k: circle, name, by: who put it }
    this.gid = 1;
    this.events = [];
    this.history = [];
    this.pending = null;
    this.players = [0, 1].map(i => this.mkPlayer(i, cfg.players[i]));
    this.it = this.flow();
  }

  /* ----- construction ----- */
  mkPlayer(i, pc) {
    const P = { idx: i, name: pc.name || ('ผู้เล่น ' + (i + 1)), deckName: pc.deck.name || '', circles: { V: null, FL: null, BL: null, BC: null, BR: null, FR: null, V2: null }, energy: 0, effects: [], flags: {}, fight: {} };
    for (const z of LISTS) P[z] = [];
    this.players = this.players || [];
    this.players[i] = P;
    for (const e of pc.deck.main) for (let k = 0; k < e.n; k++) this.newCard(e.no, i, 'deck');
    for (const no of pc.deck.ride) this.newCard(no, i, 'ride');
    for (const e of pc.deck.g || []) for (let k = 0; k < (e.n || 1); k++) { const c = this.newCard(e.no || e, i, 'gzone'); c.faceup = false; }   // the G deck
    P.ride.sort((a, b) => (this.def(this.cards[a]).grade ?? 9) - (this.def(this.cards[b]).grade ?? 9));
    return P;
  }
  newCard(no, owner, zone, token) {
    if (!VG.card(no)) throw new Error('unknown card ' + no);
    const c = { iid: this.nid++, no, owner, zone, pos: null, rest: false, faceup: true, locked: false, token: !!token, mods: [], used: {}, granted: [] };
    this.cards[c.iid] = c;
    if (VG.card(no).kiwame) { this.kiwOn = true; this.kiwCache = {}; }   // a Kiwame crest exists in this game
    if (VG.card(no).contOff) (this.offIds = this.offIds || []).push(c.iid);   // has a continuous ability that works outside the field (soul, drop, hand, bind…)
    if (LISTS.includes(zone)) this.players[owner][zone].push(c.iid);
    return c;
  }

  /* ----- abilities: printed ones plus any granted for a while ----- */
  abs(c) {
    const def = this.def(c); const d = def.abilities || [];
    if ((c.mods && c.mods.length && c.mods.some(m => m.nullAb)) || this.oppNull(c)) return [];
    let out = d.map((ab, i) => ({ ab, key: ab.lkey || i })); if ((c.zone === 'VC' && this.vgBlank(c)) || c.deleted) out = [];
    { const L = this.tf['cset' + c.owner]; if (L && L.length) out = out.map(o => { const e = L.find(x => x.iid === c.iid && x.type === o.ab.type && o.ab.cost); return e ? { ab: Object.assign({}, o.ab, { cost: e.cost }), key: o.key } : o; }); }   // "the cost of that unit's original [AUTO]/[ACT] abilities becomes …"
    if (c.granted.length) out = out.concat(c.granted.map(g => ({ ab: g.ab, key: 'g' + g.id })));
    if (def.absFrom && c.zone === 'VC' && VG.fx_absCopy) { const A = def.absFrom; const P = this.players[c.owner]; if (!A.my || this.active === c.owner) { const pool = []; for (const z of A.z) { if (z === 'RC') pool.push(...this.rcs(c.owner)); else pool.push(...P[z].map(i => this.cards[i])); } const src = pool.filter(x => x.iid !== c.iid && this.def(x).name === A.nm); if (A.one ? src.length === 1 : src.length > 0) { out = out.concat((this.def(src[0]).abilities || []).filter(ab => A.ty.includes(ab.type)).map((ab, j) => ({ ab: VG.fx_absCopy(ab, null), key: 'af' + j }))); if (A.alt) out = out.map(o => o.ab.type === 'act' && o.ab.src && o.ab.src.k ? { ab: VG.fx_absCopy(o.ab, A.alt), key: o.key } : o); } } }   // def.absFrom {nm, z, ty, my, one, alt}: gets those abilities of a card with that name there (and its [ACT] costs may be paid with alt)
    if (def.gzAbs && c.zone === 'RC') { const P = this.players[c.owner]; for (const gi of P.gauge) { const g = this.cards[gi]; if (g.gh !== c.iid || g.gk !== def.gzAbs.gk) continue; const gd = this.def(g); if (def.gzAbs.tag && !(gd.tags || []).some(t => t.toLowerCase() === def.gzAbs.tag)) continue; out = out.concat((gd.abilities || []).filter(ab => ab.zone === 'RC' || ab.zone === 'field' || (Array.isArray(ab.zone) && ab.zone.includes('RC'))).map((ab, j) => ({ ab, key: 'gz' + gi + '_' + j }))); } }   // def.gzAbs {gk, tag}: gets the abilities of its gauges of that kind (with that tag)
    if (def.dvFrom && c.zone === 'VC' && this.active === c.owner) { const P = this.players[c.owner]; const sc = P.soul.concat(P.drop).map(i => this.cards[i]).find(x => this.def(x).name === def.dvFrom); if (sc) out = out.concat((this.def(sc).abilities || []).filter(ab => ab.divine).map((ab, j) => ({ ab, key: 'dv' + j }))); }   // def.dvFrom: gets all the [Divine Skill] abilities of that card while it is in soul or drop
    if (c.dress && c.dress.length) for (const di of c.dress) { const dg = this.cards[di] && this.def(this.cards[di]).dressGrant; if (dg) out = out.concat(dg.map((ab, j) => ({ ab, key: 'gd' + di + '_' + j }))); }   // an originalDress card gives its outerDress abilities
    else if (c.grantedOut && c.grantedOut.t === this.turnNo && !isField(c.zone)) out = out.concat(c.grantedOut.list.map(g => ({ ab: g.ab, key: 'g' + g.id })));
    if (c.zone === 'RC' && this.markers.length && VG.fx_mkab) for (const m of this.markers) if (m.p === c.owner && m.k === c.pos) { const L = VG.fx_mkab(m.name); if (L) out = out.concat(L.map((ab, i) => ({ ab, key: 'm' + m.name + i }))); }
    if (c.zone === 'VC' && this.players[c.owner].prison.length && this.players[1 - c.owner].order.some(i => this.def(this.cards[i]).jail)) { if (!VG.JAIL && VG.fx_initJail) VG.fx_initJail(); if (VG.JAIL) out = out.concat(VG.JAIL.map((ab, i) => ({ ab, key: 'j' + i }))); }
    if (c.zone === 'VC') { const pa = this.players[c.owner].pabs; if (pa && pa.length) out = out.concat(pa.map(g => ({ ab: g.ab, key: 'p' + g.id }))); }
    // "this unit gets all of the [ACT] / [CONT] / [AUTO] abilities of the X in your soul / bind zone / (RC)": the printed abilities of those cards count as this unit's while the condition holds
    if (def.copy && isField(c.zone) && !this.inCopy) {
      this.inCopy = true;
      try {
        for (const cp of def.copy) {
          if (cp.cond && !cp.cond(this, c)) continue; const seen = new Set();
          for (const z of cp.zones) for (const i of (z === 'rc' ? this.rcs(c.owner).map(u => u.iid) : this.players[c.owner][z] || [])) {
            const sc = this.cards[i]; if (!sc || sc.iid === c.iid || !VG.fx.mf(this, c, sc, cp.f)) continue; const sd = this.def(sc); if (seen.has(sd.name)) continue; seen.add(sd.name);
            (sd.abilities || []).forEach((ab, k) => { if (cp.types.includes(ab.type) && (!cp.divine || ab.divine)) out.push({ ab, key: 'c' + sc.no + ':' + k }); });
          }
        }
      } finally { this.inCopy = false; }
    }
    return out;
  }
  getAb(c, key) { const x = this.abs(c).find(a => a.key === key); return x ? x.ab : null; }
  grant(iid, ab, until) { const c = this.cards[iid]; if (!c || !isField(c.zone)) return; const g = { id: this.gid++, ab, until: until || 'turn' }; if (g.until === 'exp' || g.until === 'opp') { g.until = 'exp'; g.exp = this.expTurn(this.cur ? this.cur.p : c.owner); } else if (g.until === 'next') { g.until = 'exp'; g.exp = this.active === c.owner ? this.turnNo + 2 : this.turnNo + 1; } c.granted.push(g); this.ev('mod', { iid, mod: { grant: 1 }, until }); }

  /* ----- small helpers ----- */
  rand() { let t = (this.rs += 0x6D2B79F5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  def(c) {
    const cc = typeof c === 'number' ? this.cards[c] : c; const d = VG.card(cc.no);
    if (!this.kiwOn || cc.owner == null || d.type !== 'unit') return d;
    const P = this.players[cc.owner]; if (!P) return d; const kc = P.crest.find(i => VG.card(this.cards[i].no).kiwame); if (kc == null) return d;
    const v = P.circles && P.circles.V != null ? this.cards[P.circles.V] : null; if (!v || VG.card(v.no).name !== d.name) return d;
    const kd = VG.card(this.cards[kc].no); const key = d.no + '|' + kd.no; const cache = this.kiwCache = this.kiwCache || {};
    return cache[key] || (cache[key] = Object.assign({}, d, { grade: 3, power: 13000, shield: 0, crit: 1, drive: 2, persona: true, boost: false, intercept: false, abilities: kd.kiwame.slice(), text: ['(เครสต์ ' + kd.name + ': เกรด 3 / พลัง 13000 / คริติคอล 1 / Twin Drive / Persona Ride)'].concat(kd.kiwameText || []), kiwamed: true }));
  }
  icptMuted(c) { if (this.inIcpt) return false; this.inIcpt = true; try { return this.active !== c.owner && this.units(1 - c.owner).some(u => u.zone === 'RC' && this.stat(u).icptMute); } finally { this.inIcpt = false; } }   // the opponent has an "intercepts lose their [CONT]/[AUTO]" unit
  trainLock(c) { return c.zone === 'VC' && this.players[c.owner] && this.players[c.owner].order.some(i => VG.card(this.cards[i].no).trainEq); }   // Training Equipment: "your vanguard loses all of its [AUTO] and [ACT] abilities"
  ev(t, data) { if (t === 'reveal' && this.cur && !this.cur.cost && data && data.iid != null && this.cards[data.iid]) { this.tlog({ k: 'rev', iid: data.iid, no: this.cards[data.iid].no, p: data.p, by: this.cur.iid }); this.emit('revealedBy', { iid: data.iid, p: data.p, by: this.cur.iid, byP: this.cur.p }); }   // "when a card is revealed by an ability"
    const e = Object.assign({ t }, data); if (this.snapOn) e.snap = this.snapshot(); this.events.push(e); }
  /* plain-data picture of the table for the UI (one per event while snapOn) */
  snapshot() {
    const cards = {};
    for (const k in this.cards) {
      const c = this.cards[k]; if (c.zone === 'gone' || c.zone === 'new') continue;
      const o = { no: c.no, owner: c.owner, zone: c.zone, pos: c.pos, rest: c.rest, faceup: c.faceup, locked: c.locked, token: c.token };
      if (c.st) o.st = Object.keys(c.st); if (c.cbLess && c.cbLess.t === this.turnNo) o.cbLess = 1;
      if (c.zone === 'dress') o.host = c.host; if (c.zone === 'gauge') { o.gk = c.gk; if (c.gh != null) o.host = c.gh; } if (c.dress && c.dress.length) { o.dress = c.dress.slice(); if (c.xod) o.xod = true; }
      if (isField(c.zone) && !c.locked) { const s = this.stat(c); o.power = s.power; o.crit = s.crit; o.shield = s.shield; o.cantAttack = s.cantAttack; o.cantBeHit = s.cantBeHit; }
      cards[k] = o;
    }
    let battle = null;
    if (this.battle) {
      const b = this.battle; const t = this.cards[b.targets[0]];
      battle = { p: b.p, attacker: b.attacker, booster: b.booster, target: b.targets[0], atk: this.battlePower(), dfn: t && isField(t.zone) && !t.locked ? this.defensePower(t) : 0 };
    }
    return {
      turnNo: this.turnNo, active: this.active, phase: this.phase, first: this.first, over: this.over, battle, cards, markers: this.markers.map(m => Object.assign({}, m)),
      players: this.players.map(P => {
        const o = { name: P.name, deckName: P.deckName, energy: P.energy, circles: Object.assign({}, P.circles), effects: P.effects.map(e => e.label) };
        for (const z of LISTS) o[z] = P[z].slice();
        return o;
      }),
    };
  }
  log(text, p) { this.events.push({ t: 'log', text, p }); }
  /* things that happened this turn (asked by "if … this turn" conditions); records with fight:1 are also kept for the whole fight */
  tlog(rec) { if (rec.bn === undefined) rec.bn = this.battle ? this.battleNo : 0; if (rec.ph === undefined) rec.ph = this.phase; if (rec.by != null && rec.byVG === undefined) { const sc = this.cards[rec.by]; rec.byVG = !!sc && sc.zone === 'VC'; rec.byNo = sc ? sc.no : null; if (rec.byP === undefined) rec.byP = sc ? sc.owner : null; } if (this.tl) this.tl.push(rec); if (rec.fight) (this.fl = this.fl || []).push(rec); }
  name(c) { return this.def(c).name; }   // the name shown to the players: English first (the owner's choice); a card with no English name carries its Japanese one here
  ename(c) { return this.def(c).name; }                             // the name skills compare (always the English one)   /* shown in the log and in questions; skills compare def.name */
  isUnit(c) { const d = this.def(c); return d.type === 'unit' || d.type === 'token'; }
  vg(p) { return this.cards[this.players[p].circles.V]; }
  at(p, circle) { const i = this.players[p].circles[circle]; return i ? this.cards[i] : null; }
  rcs(p) { return RCS.map(k => this.at(p, k)).filter(c => c && !c.locked); }
  units(p) { return [this.vg(p), ...this.rcs(p)]; }
  front(p) { return FRONT.map(k => this.at(p, k)).filter(c => c && !c.locked); }
  back(p) { return BACK.map(k => this.at(p, k)).filter(c => c && !c.locked); }
  ozKey(p, key, nm) { const P = this.players[p]; const v = this.vg(p); for (const i of P.order) { const x = this.cards[i]; const o = x.faceup && this.def(x)[key]; if (!o || (nm && o.nm !== nm)) continue; if (o.vg && !(v && this.def(v).name.includes(o.vg))) continue; if (o.rg && !this.rcs(p).some(u => this.def(u).name.includes(o.rg))) continue; return o; } return null; }   // an order zone card's keyed rule that currently applies
  frozenA(q) { const P = this.players[q]; const v = this.vg(q); if (this.active !== q || !v || !P.order.length) return false; const vd = this.def(v); if (!vd.name.includes('Sofia') || (vd.grade || 0) < 3) return false; if (!P.order.some(i => this.cards[i].faceup && this.def(this.cards[i]).frozenStars)) return false; const star = k => { const u = this.at(q, k); return !!u && (this.def(u).race || '').toLowerCase().split('/').some(x => x.trim() === 'star'); }; return star('FL') && star('FR'); }   // Great Fate, Frozen Stars (first CONT)
  oppNull(c) { const q = 1 - c.owner; const P = this.players[q]; if (!P || !P.order.length) return false; if (!P.order.some(i => this.cards[i].faceup && this.def(this.cards[i]).frozenStars)) return false; const d = this.def(c); if (d.type === 'order') return false; if (!['VC', 'RC', 'GC', 'soul'].includes(c.zone)) return false; if (!d.sentinel) return this.frozenA(q); const v = this.vg(q); return !!v && this.def(v).name.includes('Sofia') && (this.def(v).grade || 0) >= 3 && !!this.tf['persona' + q]; }   // abilities of the opponent's cards nullified by Frozen Stars
  vgBlank(c) { return c.zone === 'VC' && this.players[c.owner].order.some(i => this.cards[i].faceup && this.def(this.cards[i]).vgBlank); }   // Conflicts Hidden in Their Hearts: the vanguard loses its printed abilities and is a 3/13000/1 twin drive unit
  noRideNow(p) { return !!this.tf['noride' + p] || (this.active === p && this.players[p].order.some(i => this.cards[i].faceup && this.def(this.cards[i]).noRideMy)); }
  grade(c) {
    let g = (this.vgBlank(c) ? 3 : (this.def(c).grade || 0)) + (c.gmod && c.gmod.t === this.turnNo ? c.gmod.n : 0);
    if (VG.hasGradeAura && !this.inStat && isField(c.zone) && !c.locked) return Math.max(0, g + this.stat(c).grade);   // a continuous ability somewhere changes grades
    if (c.mods && c.mods.length) for (const m of c.mods) if (m.grade) g += m.grade;
    if (!isField(c.zone) && this.def(c).contOff && !this.inStat) { this.inStat = true; try { for (const ab of this.def(c).abilities || []) if (ab.type === 'cont' && ab.mod && ab.mod.grade && this.inZone(c, ab.zone) && (!ab.cond || ab.cond(this, c))) g += ab.mod.grade; } finally { this.inStat = false; } }   // "this card gets grade +1" while in hand
    return Math.max(0, g);
  }   // gmod: a grade change that lasts for this turn
  orderZone(p, pred) { return this.players[p].order.map(i => this.cards[i]).filter(c => !pred || pred(this.def(c), c)); }
  inZone(c, z) {
    if (c.locked) return false;
    if (!z) return true;
    if (Array.isArray(z)) return z.some(x => this.inZone(c, x));
    if (c.zone === 'heart') return z === 'VC' || z === 'field' || z === 'heart';   // a heart works as if on the vanguard circle
    if (c.zone === 'music') return z === 'RC' || z === 'order' || z === 'backRC' || z === 'bcRC' || z === 'music';
    if (z === 'field') return c.zone === 'VC' || c.zone === 'RC';
    if (z === 'backRC') return c.zone === 'RC' && BACK.includes(c.pos);
    if (z === 'frontRC') return c.zone === 'RC' && FRONT.includes(c.pos);
    if (z === 'bcRC') return c.zone === 'RC' && c.pos === 'BC';
    return c.zone === z;
  }
  activeCards() {
    const out = [];
    for (const P of this.players) {
      for (const k in P.circles) if (P.circles[k]) out.push(this.cards[P.circles[k]]);
      for (const z of ['GC', 'order', 'crest', 'music', 'heart']) for (const i of P[z]) out.push(this.cards[i]);
    }
    if (this.offIds) for (const i of this.offIds) { const c = this.cards[i]; if (['soul', 'drop', 'hand', 'bind', 'damage', 'removed', 'deck', 'ride', 'gauge', 'mbox'].includes(c.zone)) out.push(c); }
    for (const P of this.players) for (const i of P.arms) out.push(this.cards[i]);   // armed cards work from the vanguard circle
    return out;
  }

  /* ----- stats ----- */
  stat(c) {
    const d = this.def(c);
    const s = { power: d.power || 0, crit: d.crit == null ? 1 : d.crit, shield: d.shield || d.orderGuard || 0, drive: d.drive || 1, grade: 0, trigPlus: 0, boost: !!d.boost, intercept: !!d.intercept, cantAttack: false, cantBeHit: false, cantIntercept: false };
    if (c.zone === 'VC' && this.vgBlank(c)) { s.power = 13000; s.crit = 1; s.drive = 2; }
    if ((c.zone === 'hand' || c.zone === 'GC') && this.players[c.owner].order.length) { const o = this.ozKey(c.owner, 'ozShield', d.name); if (o) s.shield += o.sh - (d.shield || 0); }
    if (c.deleted && isField(c.zone)) s.power -= d.power || 0;   // deleted: power down by its original power
    if (c.heart != null && c.zone === 'VC' && this.cards[c.heart]) s.power += this.def(this.cards[c.heart]).power || 0;   // G unit + heart
    if (c.asG && c.zone === 'GC') { s.shield = c.asG.shield || 0; }
    if (c.asU && c.zone === 'RC') Object.assign(s, { power: c.asU.power || 0, crit: c.asU.crit || 1, shield: c.asU.shield || 0, boost: !!c.asU.boost, intercept: !!c.asU.intercept });   // an order called as a normal unit
    // a condition inside a continuous ability asks for stats: another unit's are worked out one level deep; this unit's own (and anything deeper) are answered with printed values
    if ((this.statDepth || 0) >= 2 || (this.statOf && this.statOf.includes(c.iid))) return s;
    let dmin = 0, gmin = 0, late = null, dset = null, cset = 0;

    const add = m => {
      if (!m) return;
      for (const k in m) {
        const v = m[k];
        if (k === 'driveSet') { dset = v; continue; }
        if (k === 'critSet') { cset = v; continue; }
        if (k === 'basePw') s.power += v - (d.power || 0); else if (k === 'baseCr') s.crit += v - (d.crit == null ? 1 : d.crit); else if (k === 'baseSh') s.shield += v - (d.shield || 0); else if (NUMERIC.has(k)) s[k] += v; else if (k === 'driveMin') dmin = Math.max(dmin, v); else if (k === 'guardMin') gmin = Math.max(gmin, v); else if (v && !META.has(k)) s[k] = true;
      }
    };
    for (const m of c.mods) add(m);
    if (c.zone === 'RC' && this.active === c.owner && this.markers.length) { const n = this.markerCount(c.owner, c.pos, 'dragontree'); if (n) { const vn = this.vg(c.owner) ? this.def(this.vg(c.owner)).name : ''; if (vn.includes('Dragontree') || vn.includes('Masques')) s.power += 5000 * n; } }   // the Dragontree marker card: during your turn, units on its circle get +5000 if your vanguard has Dragontree or Masques in its name
    if (isField(c.zone)) {
      this.inStat = true; this.statDepth = (this.statDepth || 0) + 1; (this.statOf = this.statOf || []).push(c.iid);
      try {
        for (const sc of this.activeCards()) {
          if (sc.locked) continue;
          if (sc.fromRC && sc.zone === 'GC' && this.icptMuted(sc)) continue;   // "units put on (GC) from (RC) lose their [CONT] abilities"
          const mute = sc.mods.length && sc.mods.some(m => m.noCont);   // "loses its original [CONT] abilities"
          for (const { ab, key } of this.abs(sc)) {
            if (ab.type !== 'cont') continue;
            if (mute && !String(key).startsWith('g')) continue;
            if (ab.late) { if (sc === c) (late = late || []).push(ab); continue; }   // its condition looks at this unit's own power / critical: judged after everything else
            if (!this.inZone(sc, ab.zone || 'field')) continue;
            if (ab.cond && !ab.cond(this, sc)) continue;
            if (ab.aura) add(ab.aura(this, sc, c));
            else if (sc === c && ab.mod) add(typeof ab.mod === 'function' ? ab.mod(this, sc) : ab.mod);
          }
        }
        for (const e of this.players[c.owner].effects) if (e.aura) add(e.aura(this, c));
        if (late) { this.statTmp = { iid: c.iid, s }; try { for (const ab of late) { if (!this.inZone(c, ab.zone || 'field')) continue; if (ab.cond && !ab.cond(this, c)) continue; if (ab.mod) add(typeof ab.mod === 'function' ? ab.mod(this, c) : ab.mod); } } finally { this.statTmp = null; } }
      } finally { this.statOf.pop(); this.statDepth--; this.inStat = this.statDepth > 0; }
    }
    if (d.trigger && (c.zone === 'GC' || c.zone === 'hand') && this.ominaSh(c, d.trigger)) s.shield -= 5000;
    if (s.power < 0) s.power = 0; if (s.shield < 0) s.shield = 0; if (s.crit < 0) s.crit = 0;
    if (cset) s.crit = cset; if (dset != null) s.drive = dset; s.drive = Math.max(dmin, s.drive, 0); if (gmin) s.guardMin = gmin;
    return s;
  }
  ominaSh(c, t) { const q = 1 - c.owner; const ov = this.vg(q); if (!ov || (this.statOf || []).includes(ov.iid)) return false; const st = this.stat(ov); return (!!st.ominaB && this.players[q].bind.some(i => this.def(this.cards[i]).trigger === t)) || (t === 'crit' && !!st.ocritSh); }
  addMod(iid, mod, until) {
    const c = this.cards[iid]; if (!c || !isField(c.zone)) return;
    const m = Object.assign({ until: until || 'turn' }, mod);
    if (m.trig && m.power > 0 && this.stat(c).trigPw2) m.power *= 2;   // "when this unit's power would be increased by your trigger effect, double the value"
    if (m.crit > 0 && !m.trig) c.critUpT = this.turnNo;
    if (m.power < 0 && this.cur && this.cards[this.cur.iid]) this.emit('powerDown', { iid, p: c.owner, by: this.cur.iid, byP: this.cur.p, n: m.power });
    if (m.crit > 0 && this.cur && this.cur.divine) (this.tf['dvcr' + c.owner] = this.tf['dvcr' + c.owner] || []).push(iid);
    if (m.power > 0 && !m.trig && this.cur && this.cur.iid !== iid) this.emit('powerUp', { iid, p: c.owner, by: this.cur.iid, byP: this.cur.p, act: this.cur.type === 'act', n: m.power });   // "when this unit's power is increased by …"
    if (m.drive < 0
 && this.cur && this.cur.iid === iid && this.stat(c).noDriveDown) { delete m.drive; if (Object.keys(m).length <= 1) return; }   // "its drive does not decrease by its own effects"
    if (until === 'opp') { m.until = 'exp'; m.exp = this.expTurn(this.cur ? this.cur.p : c.owner); }
    if (until === 'next') { m.until = 'exp'; m.exp = this.active === c.owner ? this.turnNo + 2 : this.turnNo + 1; }   // through its owner's next turn ("during your next stand phase")
    c.mods.push(m);
    this.ev('mod', { iid, mod, until });
  }
  /* turn number at whose end "until end of your opponent's next turn" runs out, for player p */
  expTurn(p) { return this.active === p ? this.turnNo + 1 : this.turnNo + 2; }
  expire(until) {
    const dead = x => x.until === until || (until === 'turn' && x.until === 'exp' && x.exp <= this.turnNo);
    for (const k in this.cards) { const c = this.cards[k]; if (c.mods.length) c.mods = c.mods.filter(m => !dead(m)); if (c.granted.length) c.granted = c.granted.filter(g => !dead(g)); }
    for (const P of this.players) { P.effects = P.effects.filter(e => !dead(e)); if (P.pabs && P.pabs.length) P.pabs = P.pabs.filter(e => !dead(e)); }
  }

  /* ----- zone movement ----- */
  move(iid, to, o) {
    o = o || {};
    if (typeof to === 'string' && to.startsWith('gz') && to !== 'gz' && to !== 'gzone') { const [ga, gkind, ghs] = to.split(':'); return this.toGauge(iid, gkind, ghs === 'me' && this.cur ? this.cur.iid : null, ga === 'gzfd', o); }
    if (to === 'memory') { const d0 = this.def(this.cards[iid]); if (!(d0.race && d0.race.toLowerCase().split('/').some(x => x.trim() === 'quintuplet'))) to = 'drop'; }   // only <Quintuplet> stay in memory
    if (to === 'prison' && !this.hasPrison(1 - this.cards[iid].owner)) return false;   // imprisoned only while the other fighter has a Prison in the order zone
    if (to === 'damagefd') { const r = this.move(iid, 'damage', o); const x = this.cards[iid]; if (x && x.zone === 'damage') x.faceup = false; return r; }   // into the damage zone face down
    if (to === 'bindfd') { const r = this.move(iid, 'bind', o); const x = this.cards[iid]; if (x && x.zone === 'bind') x.faceup = false; return r; }   // bound face down
    if (to === 'ridefu') { const r = this.move(iid, 'ride', o); const x = this.cards[iid]; if (x && x.zone === 'ride') x.rfu = true; return r; }
    const c = this.cards[iid], P = this.players[c.owner];
    const from = c.zone, fromPos = c.pos;
    { const dd = this.def(c);   // card-level movement bars ("cannot be bound other than …", "cannot be put into the order zone by a card's ability")
      if (dd.bindRule) { const br = dd.bindRule; if (to === 'bind' && from !== 'bind' && ((br.includes('self') && !(this.cur && this.cur.iid === iid)) || (br.includes('cost') && !(this.cur && this.cur.cost)))) return false; if (br.includes('lock') && from === 'bind' && to !== 'bind' && this.cur) return false; }
      if (dd.noOrdAb && to === 'order' && this.cur && o.reason !== 'play') return false;
      if (to === 'hand' && dd.handToOrder && from !== 'order') return this.move(iid, 'order', o);   // "when it would be put into hand, put it in order zone instead"
      if (to === 'RC' && from === 'deck' && dd.callToHand && dd.type === 'order') return this.move(iid, 'hand', o);
      if (to === 'RC' && from !== 'RC' && dd.callOnly && !(this.cur && this.cards[this.cur.iid] && VG.fx.mf(this, this.cards[this.cur.iid], this.cards[this.cur.iid], dd.callOnly))) { this.log(dd.name + ' ลงดรอปแทน (คอลได้ด้วยสกิลที่กำหนดเท่านั้น)', c.owner); return this.move(iid, 'drop', { reason: 'effect' }); }   // "when this card would be called to (RC) other than by the ability of …, put it into drop instead"
      if (to === 'soul' && from === 'RC' && this.cur && !this.cur.cost && this.cur.p === c.owner && c.mods.length && c.mods.some(m => m.noSoulByVG)) { const src = this.cards[this.cur.iid]; if (src && src.zone === 'VC') return false; }   // "cannot be put into soul by your vanguard's ability"
      if (from === 'bind' && to !== 'bind' && this.cur && this.cur.p !== c.owner && P.effects.length) { const e = P.effects.find(x => x.bindSafe); if (e && (e.bindSafe === 1 || dd.name.includes(e.bindSafe))) return false; }   // "cards in your bind zone cannot be moved by your opponent's card's ability"
      if (to === 'soul' && from === 'RC' && this.cur && this.cur.p !== c.owner && dd.type === 'unit' && !dd.trigger) { const src = this.cards[this.cur.iid]; if (src && src.zone === 'VC' && this.hasFlag(this.cur.p, 'oSoulBottom')) { to = 'deck'; o = Object.assign({}, o, { bottom: true }); } } }   // "the opponent puts those units on the bottom of their deck instead of into soul"

    if (from === 'VC' || from === 'RC') P.circles[fromPos] = null;

    else if (LISTS.includes(from)) { const k = P[from].indexOf(iid); if (k >= 0) P[from].splice(k, 1); }
    const mateOut = from === 'VC' && fromPos === 'V' && P.circles.V2 && P.circles.V2 !== iid ? P.circles.V2 : null;   // D-legion: the mate leaves with the leader
    if (from === 'dress') { const h = this.cards[c.host]; if (h && h.dress) h.dress = h.dress.filter(x => x !== iid); c.host = null; }
    let dest = to;
    if (c.token && !(c.ticket ? (to === 'hand' || to === 'order') : (isField(to) || to === 'gauge' || ((to === 'order' || to === 'crest') && this.def(c).type !== 'token')))) dest = 'gone';   // tokens exist only on the field, ticket cards only in hand
    if (isField(from)) c.lastPos = fromPos;
    c.grantedOut = null; if (isField(from) && !isField(dest) && c.granted.length) c.grantedOut = { t: this.turnNo, list: c.granted };
    if (!(isField(from) && isField(dest))) c.stWas = c.st || null;   // the states it had on the field ("when this hollowed unit is retired")
    if (!(isField(from) && isField(dest))) { c.mods = []; c.granted = []; c.rest = false; c.locked = false; c.used = {}; c.faceup = true; c.deleted = false; c.atk = 0; c.chosen = null; c.st = null; c.cbLess = null; c.selfStood = 0; }
    c.rfu = false; if (from === 'ride') c.rd = true; if (from === 'order') c.asSetX = false;
    c.fromRC = from === 'RC' && dest === 'GC';   // an interceptor (put on (GC) from (RC))
    const gkWas = from === 'gauge' ? c.gk : null; if (from === 'gauge') { c.gk = null; c.gh = null; }
    c.zone = dest; c.pos = null;
    if (dest === 'gauge') { c.gk = o.gk || 'g'; c.gh = o.gh == null ? null : o.gh; if (o.fd) c.faceup = false; }
    if (dest === 'VC' || dest === 'RC') {
      if (P.circles[o.pos]) throw new Error('circle occupied ' + o.pos);
      P.circles[o.pos] = iid; c.pos = o.pos;
      if (o.rest !== undefined) c.rest = !!o.rest;
      if (from !== 'RC' && from !== 'VC') c.placed = this.turnNo;
    } else if (dest === 'deck') { if (o.bottom) P.deck.push(iid); else P.deck.unshift(iid); }
    else if (dest !== 'gone') P[dest].push(iid);
    if (dest === 'dress') { const h = this.cards[o.host]; c.host = o.host; (h.dress = h.dress || []).push(iid); }
    if (!isField(dest)) c.xod = false;
    const evt = Object.assign({ iid, p: c.owner, from, fromPos, to: dest, wanted: to, toPos: o.pos || null, reason: o.reason || '' }, o.extra || {});
    if (this.cur && evt.by == null) { evt.by = this.cur.iid; evt.byP = this.cur.p; evt.byCost = !!this.cur.cost; }
    evt.st = this.stepNo || 0; if (dest === 'gauge') { evt.gk = c.gk; evt.gh = c.gh; } if (gkWas) evt.gkWas = gkWas;
    this.ev('move', evt);
    if (!o.silent && this.tl) {   // things that happened this turn, for "if … this turn" conditions
      const src = evt.by != null ? this.cards[evt.by] : null; const rec = { p: c.owner, from, by: evt.by, byP: evt.byP, byVG: !!src && src.zone === 'VC' };
      this.tl.push({ k: 'mv', st: this.stepNo || 0, bn: this.battle ? this.battleNo : null, iid, no: c.no, p: c.owner, from, fromPos, to: dest, toPos: o.pos || null, wanted: to, reason: o.reason || '', by: evt.by, byP: evt.byP, byVG: rec.byVG, byNo: src ? src.no : null, byCost: !!evt.byCost, ride: !!(o.extra && o.extra.ride), rf: o.extra && o.extra.rideFrom, rfg: o.extra ? o.extra.rideFromG : undefined, normal: !!(o.extra && o.extra.normal), bn: this.battle ? this.battleNo : 0, ph: this.phase, bottom: !!o.bottom });
      if (from === 'RC' && dest !== 'RC' && o.reason === 'retire') this.tl.push(Object.assign({ k: 'ret' }, rec));
      if (dest === 'gauge') this.tl.push({ k: 'gauge', iid, no: c.no, p: c.owner, gk: c.gk, from, by: evt.by, byP: evt.byP, byVG: rec.byVG, byNo: src ? src.no : null });
      if (dest === 'RC' && from !== 'RC') { this.tl.push(Object.assign({ k: 'place', iid }, rec)); c.placedBy = evt.by != null ? { p: evt.byP, vg: rec.byVG, no: src ? src.no : null } : null; c.placedFrom = from; }
    }
    if (mateOut != null && this.cards[mateOut].zone === 'VC') { this.move(mateOut, 'soul', { reason: 'legion' }); this.log('D-Legion จบ (เลเจียนเมทเข้าโซล)', c.owner); }
    if (!o.silent) {
      if (dest === 'RC' && from !== 'RC' && o.reason === 'call') this.cpx(c.owner);
      if (dest === 'RC' && from !== 'RC') this.emit('placeRC', evt);
      if (dest === 'GC') this.emit('placeGC', evt);
      if (dest === 'VC') this.emit('placeVC', evt);
      if (from === 'RC' && dest !== 'RC' && dest !== 'dress') this.emit('leaveRC', evt);   // becoming an originalDress is not leaving for another zone
      if (dest === 'dress') this.emit('toDress', evt);
      if (dest === 'order') this.emit('toOrder', evt);
      if (dest === 'prison') this.emit('imprisoned', evt);
      if (dest === 'gauge') this.emit('gauged', evt); if (from === 'gauge' && dest !== 'gauge') this.emit('ungauged', evt);
      if (dest === 'crest') this.emit('toCrest', evt);
      if ((from === 'hand' || from === 'deck') && to === 'drop' && o.reason === 'discard') this.emit('discard', evt);
      if (from === 'GC' && to === 'drop') this.emit('retireGC', evt);
      if (to === 'soul' && from !== 'soul') this.emit('toSoul', evt);
      if (to === 'bind' && from !== 'bind') this.emit('bound', evt);
      this.emit('moved', evt);

      if (from === 'RC' && dest !== 'RC' && o.reason === 'retire') this.tf['ret' + c.owner] = (this.tf['ret' + c.owner] || 0) + 1;
    }
    // originalDress cards belong to their unit: they pass on to a unit placed on top of it, and go where the unit goes when it leaves the field
    if (isField(from) && !isField(dest) && c.dress && c.dress.length) {
      const list = c.dress.slice(); c.dress = [];
      if (dest === 'dress') { const h = this.cards[o.host]; for (const d of list) { this.cards[d].host = o.host; h.dress.push(d); } }
      else { const z0 = ['hand', 'soul', 'bind', 'deck', 'drop', 'removed', 'damage'].includes(to) ? to : 'drop'; const allDrop = this.def(c).dressDrop || ((z0 === 'deck' || z0 === 'bind') && list.some(d => this.def(this.cards[d]).dressDropDB)); const z = allDrop ? 'drop' : z0; for (const d of list) { this.cards[d].host = null; this.move(d, z, { bottom: o.bottom, reason: 'dress', silent: o.silent }); } }
    }
    if (dest === 'VC' && P.arms.length) for (const i of P.arms.slice()) { const f = this.def(this.cards[i]).arms && this.def(this.cards[i]).arms.f; if (f && Object.keys(f).length && !VG.fx.mf(this, c, c, f)) this.move(i, 'drop', { reason: 'arm', silent: o.silent }); }
    // the last Prison leaves the order zone: every card imprisoned in it goes to its owner's drop
    if (from === 'order' && dest !== 'order' && this.isPrison(c) && !this.hasPrison(c.owner)) for (const i of this.players[1 - c.owner].prison.slice()) this.move(i, 'drop', { reason: 'prison', silent: o.silent });
    // "the [Prisoner] put into soul by your card's ability is also regarded as a card put by soul charge"
    if (to === 'soul' && from !== 'soul' && o.reason !== 'sc' && !o.silent && this.cur && this.cur.p === c.owner && (this.def(c).tags || []).includes('prisoner')) { const v = this.vg(c.owner); if (v && this.def(v).prSC) { if (this.tl) this.tl.push({ k: 'sc', p: c.owner }); this.emit('soulCharged', { p: c.owner, n: 1, by: this.cur.iid, byP: this.cur.p }); } }
    // gauges belong to their card: they go to drop when it leaves the field / the order zone (they stay, without a host, when the host itself becomes a gauge)
    if (c.asU && from === 'RC' && dest !== 'RC') delete c.asU;
    if (c.asG && from === 'GC' && dest !== 'GC') delete c.asG;
    if (P.gauge.length && from !== dest && (isField(from) || from === 'order') && !(isField(from) && isField(dest)) && dest !== 'dress') { for (const g of P.gauge.filter(x => this.cards[x].gh === iid)) { if (dest === 'gauge') this.cards[g].gh = null; else if (from === 'order' && dest === 'drop' && this.def(c).gleip) { this.cards[g].gh = null; this.cards[g].pendG = iid; } else if (this.def(c).bsToDeck && from === 'RC' && fromPos === 'BC' && dest !== 'RC' && this.cards[g].gk === 'bs') { this.move(g, 'deck', { bottom: true, reason: 'effect', silent: o.silent }); this.shuffle(c.owner); } else this.move(g, 'drop', { reason: 'gauge', silent: o.silent }); } }
    return evt;
  }
  /* gauges: cards set aside in the gauge zone. kind: bf (Buddyfight gauge, face down) regress automod astral plant undercover charm arma g; host = the card they belong to (or none = the fighter's) */
  /* Arms: order cards armed to the vanguard (zone 'arms'); one per side (left / right deity arms / plain arms) */
  sing(iid) { const c = this.cards[iid]; if (!c || c.zone !== 'order' || !c.faceup) return false; this.tlog({ k: 'sing', iid, no: c.no, p: c.owner }); this.log('ร้องเพลง ' + this.name(c), c.owner); this.emit('sung', { iid, p: c.owner, by: this.cur ? this.cur.iid : null }); c.faceup = false; this.ev('flip', { iid, p: c.owner }); return true; }
  armCard(iid, p) {
    const c = this.cards[iid]; const d = c && this.def(c); const v = this.vg(p); if (!c || !d.arms || !v || c.owner !== p || c.zone === 'arms' || this.tf['noarm' + p]) return false;
    if (d.arms.f && Object.keys(d.arms.f).length && !VG.fx.mf(this, v, v, d.arms.f)) return false;
    if (d.armBy && !(this.cur && this.cards[this.cur.iid] && this.def(this.cards[this.cur.iid]).name.includes(d.armBy))) return false;
    const side = d.arms.s || 'A'; for (const i of this.players[p].arms.slice()) if ((this.def(this.cards[i]).arms.s || 'A') === side) this.move(i, 'drop', { reason: 'arm' });
    this.move(iid, 'arms', { reason: 'effect' }); if (c.zone !== 'arms') return false;
    this.tlog({ k: 'arm', iid, no: c.no, p }); this.log('อาร์ม ' + d.name + ' ให้แวนการ์ด', p);
    this.emit('armed', { iid, p, by: this.cur ? this.cur.iid : null, byP: this.cur ? this.cur.p : null }); return true;
  }
  /* Music orders: when played they lie on the back row center (RC) until the end of the turn (not units); their (RC) abilities work from there */
  putMusic(iid) { const c = this.cards[iid]; const from = c.zone; this.move(iid, 'music', { reason: 'play' }); if (c.zone !== 'music') return; this.emit('musicOn', { iid, p: c.owner, from, to: 'RC', toPos: 'BC', by: this.cur ? this.cur.iid : null, byP: this.cur ? this.cur.p : null }); }
  bcBlocked(p) { return this.players[p].music.some(i => this.def(this.cards[i]).noBC); }   // "you cannot put a unit card on the back row center (RC)"
  *clearMusic(p) {
    const P = this.players[p]; const v = this.vg(p); const vd = v ? this.def(v) : {};
    for (const i of P.music.slice()) { const c = this.cards[i]; const d = this.def(c); let to = 'drop';
      if (c.musTo) to = c.musTo; else if (d.musTo && d.musTo.self) to = d.musTo.to;
      else if (vd.musTo && (!vd.musTo.f || VG.fx.mf(this, v, c, vd.musTo.f))) { if (!vd.musTo.may || (yield* this.yesNo(p, { title: d.name + ' กำลังจะลงดรอป — ' + (vd.musTo.to === 'bind' ? 'ไบนด์แทน?' : 'นำเข้าโซลแทน?'), iid: i }))) to = vd.musTo.to; }
      c.musTo = null; this.move(i, to, { reason: 'music' }); }
  }
  /* Buddyfight [call cost]: paid when the card is called from hand in the main phase; cards put "into this card's buddy soul" wait under it */
  *payCall(p, c, circle) {
    const d = this.def(c); const prev = this.cur; this.cur = { iid: c.iid, p, cost: true }; this.pendBS = c.iid;
    try { for (const k of d.callCost || []) yield* k.pay(this, c); if (d.callOnTop) { const ex = this.at(p, circle); if (ex) this.toGauge(ex.iid, 'bs', c.iid, false, { reason: 'call' }); } }
    finally { this.cur = prev; this.pendBS = null; }
    this.tlog({ k: 'callcost', iid: c.iid, p });
  }
  /* call a card on top of a unit: that unit becomes its buddy soul */
  callOnTop(iid, host, p) {
    const h = this.cards[host]; const c = this.cards[iid]; if (!h || !c || h.zone !== 'RC') return false; const circle = h.pos;
    this.pendBS = iid; const ok = this.toGauge(host, 'bs', iid, false, { reason: 'call' }); this.pendBS = null; if (!ok) return false;
    this.placeRC(iid, circle, { reason: 'call' }); return this.cards[iid].zone === 'RC';
  }
  /* products: operating a product in the order zone fires its "when this card is operated" abilities */
  operate(iid, p, by) {
    const c = this.cards[iid]; if (!c || c.zone !== 'order' || c.owner !== p) return false; const d = this.def(c);
    if (d.oprBy && !(by != null && this.cards[by] && VG.fx.mf(this, this.cards[by], this.cards[by], d.oprBy))) return false;
    this.tf['opr' + p] = (this.tf['opr' + p] || 0) + 1; this.tlog({ k: 'operate', iid, no: c.no, p, by }); this.log('โอเปอเรต ' + d.name, p);
    this.emit('operated', { iid, p, by: by == null ? null : by, byP: by == null ? null : this.cards[by].owner, byVG: by != null && this.cards[by].zone === 'VC' }); return true;
  }
  /* ----- stride (G zone) ----- */
  gbCount(p) { const P = this.players[p]; const v = this.vg(p); return P.gzone.filter(i => this.cards[i].faceup && !this.def(this.cards[i]).special).length + (v && v.heart != null ? 1 : 0); }   // generation break: face-up G units in the G zone + on (VC)
  strideGrade(i) { const d = this.def(this.cards[i]); return d.strideG3 ? Math.max(3, d.grade || 0) : (d.grade || 0); }
  strideIfOk(p, i) { const s = this.def(this.cards[i]).strideIf; const v = this.vg(p); return !s || (!!v && VG.fx.mf(this, v, v, s)); }   // def.strideIf: may stride only onto a vanguard matching it
  canStride(p) {
    const P = this.players[p]; const v = this.vg(p), ov = this.vg(1 - p); if (!v || v.heart != null || this.tf['strode' + p] || this.tf['nostride' + p]) return false;
    if (!((this.grade(v) >= 3 && ov && this.grade(ov) >= 3) || (this.tf['g0' + p] || 0) >= 3)) return false;
    return P.gzone.some(i => !this.cards[i].faceup && !this.def(this.cards[i]).special && this.strideIfOk(p, i) && this.strideCostOk(p, i));
  }
  /* the stride cost of this G unit: the usual "hand grades 3 or more", or def.scost = discard one hand card matching that filter */
  strideCostOk(p, i) { if (this.tf['sfree' + p]) return true; const sc = this.def(this.cards[i]).scost; const v = this.vg(p); if (sc) return this.handFor(p).some(h => VG.fx.mf(this, v, this.cards[h], sc)); return this.handFor(p).reduce((n, h) => n + this.strideGrade(h), 0) >= 3; }
  *strideStep(p) {
    if (!this.canStride(p)) return;
    const y = yield* this.yesNo(p, { title: 'สไตรด์?', sub: 'ทิ้งการ์ดจากมือที่เกรดรวม 3 ขึ้นไป แล้ววาง G ยูนิทจาก G โซนบน VC (แวนการ์ดเดิมกลายเป็นฮาร์ท จนจบเทิร์น)', options: [{ id: 'yes', label: 'สไตรด์' }, { id: 'no', label: 'ไม่สไตรด์' }] });
    if (!y) return;
    yield* this.doStride(p);
  }
  *doStride(p, free) {
    const P = this.players[p]; const gs = P.gzone.filter(i => !this.cards[i].faceup && !this.def(this.cards[i]).special && this.strideIfOk(p, i) && (free || this.strideCostOk(p, i))); if (!gs.length) return false;
    const [gi] = yield* this.chooseCards(p, gs, { min: 1, max: 1, title: 'เลือก G ยูนิทที่จะสไตรด์', zone: 'gzone', hint: 'search' }); if (gi == null) return false; const g0 = this.cards[gi];
    let altPaid = false;
    if (!(free || this.tf['sfree' + p]) && (this.def(this.vg(p)).clans || []).length) { const P0 = this.players[p]; const alt = P0.hand.concat(P0.drop).find(i => this.def(this.cards[i]).strideAlt); if (alt != null && (yield* this.yesNo(p, { title: 'จ่ายคอสต์สไตรด์ด้วยการนำ ' + this.name(this.cards[alt]) + ' ออกจากเกมแทนการทิ้งการ์ด?', iid: alt, options: [{ id: 'yes', label: 'ใช้' }, { id: 'no', label: 'ทิ้งการ์ดตามปกติ' }] }))) { this.move(alt, 'removed', { reason: 'cost' }); const fd = P0.damage.filter(i => !this.cards[i].faceup); if (fd.length) { const [u] = yield* this.chooseCards(p, fd, { min: 0, max: 1, title: 'หงายดาเมจได้สูงสุด 1 ใบ', zone: 'damage', hint: 'search', noAuto: true }); if (u != null) this.cards[u].faceup = true; } altPaid = true; } }
    if (free || this.tf['sfree' + p]) this.tf['sfree' + p] = 0;
    else if (altPaid) {}
    else if (this.def(g0).scost) {   // this G unit's own stride cost: discard one matching card
      const v0 = this.vg(p); const ok = this.handFor(p).filter(h => VG.fx.mf(this, v0, this.cards[h], this.def(g0).scost)); if (!ok.length) return false;
      const sel = yield* this.chooseCards(p, ok, { min: 1, max: 1, title: 'ทิ้งการ์ดเพื่อสไตรด์ ' + this.name(g0), hint: 'discard', zone: 'hand' }); if (sel[0] == null) return false;
      const prev = this.cur; this.cur = { iid: gi, p, cost: true }; this.move(sel[0], 'drop', { reason: 'discard' }); this.cur = prev;
      this.emit('strideDisc', { p, ids: sel });
    }
    else {
      let tot = 0; const paid = [];
      while (tot < 3) { const left = this.handFor(p).filter(i => !paid.includes(i)); if (!left.length) return false; const sel = yield* this.chooseCards(p, left, { min: 1, max: 1, title: 'ทิ้งการ์ดเพื่อสไตรด์ (เกรดรวม ' + tot + '/3)', hint: 'discard', zone: 'hand' }); if (sel[0] == null) return false; paid.push(sel[0]); tot += this.strideGrade(sel[0]); }
      const prev = this.cur; this.cur = { iid: gi, p, cost: true }; for (const i of paid) this.move(i, 'drop', { reason: 'discard' }); this.cur = prev;
      this.emit('strideDisc', { p, ids: paid });
    }
    const old = this.vg(p); const g = this.cards[gi];
    this.move(old.iid, 'heart', { reason: 'stride', silent: true });
    g.faceup = true; this.move(gi, 'VC', { pos: 'V', rest: old.rest, reason: 'stride', extra: { stride: true, heart: old.iid } }); g.faceup = true; g.heart = old.iid;
    this.tf['strode' + p] = 1; this.tlog({ k: 'stride', iid: gi, no: g.no, p });
    this.log('สไตรด์! ' + this.name(g) + ' (ฮาร์ท: ' + this.name(old) + ')', p);
    this.emit('strode', { iid: gi, p, heart: old.iid }); return true;
  }
  unstrideP(p) { const v = this.vg(p); if (!v || v.heart == null) return false; const h = v.heart; delete v.heart; const rest = v.rest; this.move(v.iid, 'gzone', { reason: 'stride', silent: true }); v.faceup = true; if (this.cards[h] && this.cards[h].zone === 'heart') this.move(h, 'VC', { pos: 'V', rest, reason: 'stride', silent: true, extra: { unstride: true } }); this.log('G ยูนิทกลับไป G โซน', p); return true; }
  unstride() {
    for (const P of this.players) { const p = P.idx; const v = this.vg(p); if (!v || v.heart == null) continue;
      const h = v.heart; delete v.heart; const rest = v.rest;
      this.move(v.iid, 'gzone', { reason: 'stride', silent: true }); v.faceup = true;
      if (this.cards[h] && this.cards[h].zone === 'heart') this.move(h, 'VC', { pos: 'V', rest, reason: 'stride', silent: true, extra: { unstride: true } });
      this.log('G ยูนิทกลับไป G โซน', p); }
  }
  memCount(p, distinct) { const P = this.players[p]; const q = i => { const d = this.def(this.cards[i]); return !!d.race && d.race.toLowerCase().split('/').some(x => x.trim() === 'quintuplet'); };
    let ids = P.memory.filter(q); if (P.crest.concat(P.order).some(i => this.def(this.cards[i]).memOrd)) ids = ids.concat(P.order.filter(q));   // "order zone is also regarded as memory"
    return distinct ? new Set(ids.map(i => this.def(this.cards[i]).name)).size : ids.length; }
  /* pickup gacha: an order in my order zone makes my cards with those names also be named "as" */
  atkTax() { return [0, 1].some(q => { const v = this.vg(q); return v && !v.locked && this.def(v).atkTax && !((this.battleNo || 0) + 1 >= 4 && this.players[q].effects.some(e => e.noVgCont4)); }); }   // Absolute Zero: from the fourth battle of a turn, attacking needs a discard
  noRestFor(c) { const P = this.players[c.owner]; if (!P) return false; const n = this.def(c).name; return P.order.some(i => { const r = this.def(this.cards[i]).noRestNm; return r && n.includes(r); }); }   // an order: "you cannot [Rest] …"
  aliasOf(c) { const P = this.players[c.owner]; if ((c.zone === 'VC' || c.zone === 'RC') && c.mods && c.mods.length) { const L = c.mods.filter(m => typeof m.asName === 'string').map(m => m.asName); const bm = c.mods.find(m => m.bindNm); if (bm && P) L.push(...P.bind.filter(i => this.cards[i].faceup && (this.def(this.cards[i]).grade || 0) >= 1 && this.def(this.cards[i]).name.includes(bm.bindNm)).map(i => this.def(this.cards[i]).name)); if (L.length) return L; } { const d0 = this.def(c); if (d0.soulNames && c.zone === 'deck' && VG.fx.ev(this, VG.fx.mkCtx(c), ['vg', d0.soulNames.vg])) { const L = P.soul.map(i => this.def(this.cards[i]).name).filter(n => n.includes(d0.soulNames.nh)); if (L.length) return L; } if (d0.deckAs && (c.zone === 'deck' || d0.deckAs.any) && VG.fx.ev(this, VG.fx.mkCtx(c), ['vg', d0.deckAs.vg])) return d0.deckAs.as; } if (!P || !P.order.length) return null; const n = this.def(c).name; for (const i of P.order) { const g = this.def(this.cards[i]).pug; if (g && g.names.some(x => n.includes(x))) return g.as; } return null; }
  /* Retry: stand the unit; for the rest of the turn it cannot retry, gets [Power]+5000, and its [Critical] and drive become 1 */
  retry(iid, by) { const c = this.cards[iid]; if (!c || !isField(c.zone) || !this.def(c).retry || (this.def(c).retryC && !this.def(c).retryC(this, c)) || this.tf['retried' + iid]) return false;
    this.tf['retried' + iid] = 1; this.standUnit(iid); this.addMod(iid, { power: 5000, critSet: 1, driveSet: 1 }, 'turn'); this.log(this.name(c) + ' รีทราย (Retry)', c.owner); this.tlog({ k: 'retry', iid, no: c.no, p: c.owner, by }); this.emit('retried', { iid, p: c.owner }); return true; }
  /* dominate (rules 7.39): player p stands one of the opponent's rear-guards and uses it as their own for one attack against the opponent's other unit */
  *dominate(p, iid, o) {
    o = o || {}; const c = this.cards[iid]; if (!c || !(c.zone === 'RC' || (o.vc && c.zone === 'VC')) || c.owner === p || c.locked) return false;
    const tg = this.units(1 - p).filter(u => u.iid !== iid && (!o.tgt || (o.tgt === 'v' ? u.zone === 'VC' : u.zone === 'RC'))).map(u => u.iid); if (!tg.length) return false;   // o.tgt: it must attack the vanguard ('v') / a rear-guard ('r'); o.vc: a vanguard may be dominated too
    c.rest = false; c.dom = { p, t: this.turnNo }; if (o.mods) this.addMod(iid, o.mods, 'turn');
    this.log('Dominate! ' + this.name(c), p); this.tf['dom' + p] = (this.tf['dom' + p] || 0) + 1;
    const sel = yield* this.chooseCards(p, tg, { min: 1, max: 1, title: 'เลือกยูนิทของคู่ต่อสู้ที่ ' + this.name(c) + ' จะโจมตี', hint: 'retire', zone: 'field' });
    const ph = this.phase, prevB = this.battle; this.phase = 'battle'; this.battle = null;
    if (sel.length && (this.cards[iid].zone === 'RC' || (o.vc && this.cards[iid].zone === 'VC'))) yield* this.doBattle(p, iid, sel[0]);
    this.phase = ph; this.battle = prevB;
    const cc = this.cards[iid]; if (cc) delete cc.dom;
    if (o.ret && cc && cc.zone === 'RC') { if (!(yield* this.wouldLeave(iid))) this.move(iid, 'drop', { reason: 'retire' }); }
    if (o.bot && cc && cc.zone === 'RC') this.move(iid, 'deck', { bottom: true, reason: 'effect' });
    yield* this.checkTiming(); return true;
  }
  /* Inazuma Eleven special moves (kept face down in the G zone, which works as the special move zone): turn one face up for a unit that meets its usage condition, then it resolves */
  smOk(iid, user) { const d = this.def(this.cards[iid]); const u = this.cards[user]; if (!d.special || !u || !(u.zone === 'VC' || u.zone === 'RC')) return false; if (!d.smOff && this.stat(u).noShoot) return false; const conds = d.smUse || []; if (!conds.length) return true; const nm = this.def(u).name; const pos = u.zone === 'VC' ? 'v' : ['FL', 'FR'].includes(u.pos) ? 'f' : 'b';
    if (d.smCond && !d.smCond(this, this.cards[iid], user)) return false; const ud = this.def(u);
    return conds.some(k => (!k.nh || k.nh.some(n => nm.includes(n))) && (!k.pos || k.pos === pos || (k.pos === 'f' && pos === 'v')) && (!k.rc || VG.fx.mf(this, u, u, { rc: k.rc })) && (!k.tags || k.tags.some(t => (ud.tags || []).includes(t)))); }   // usage condition: name / row / race (Story, Chronicle) / position (FW, MF, DF, GK)   // "Front" = front row (the vanguard circle is in the front row)
  *useSM(p, iid, user) { const c = this.cards[iid]; if (!c || c.zone !== 'gzone' || c.owner !== p || !this.smOk(iid, user)) return false; c.faceup = true; this.log('ใช้ท่าพิเศษ ' + this.name(c) + ' (' + this.name(this.cards[user]) + ')', p); this.tlog({ k: 'smuse', iid, no: c.no, p, user }); this.emit('smFlip', { iid, p, user, off: !!this.def(c).smOff }); this.emit('smUsed', { iid, p, user }); yield* this.checkTiming(); return true; }
  /* D-legion (DZ, rules 6.4 / Japanese Q&A): if the opponent's vanguard is grade 3 or greater, once a fight, return four cards from drop to deck (up to two trigger units; never heal or over triggers), search the deck for the named card and put it next to the vanguard as the legion mate */
  canDLegion(p) { const P = this.players[p]; const v = this.vg(p); if (!v || P.circles.V2 || P.fight.dleg || this.grade(this.vg(1 - p)) < 3) return false; const d = P.drop.map(i => this.def(this.cards[i])); const tr = d.filter(x => x.trigger && x.trigger !== 'heal' && x.trigger !== 'over').length; const nt = d.filter(x => !x.trigger).length; return nt + Math.min(2, tr) >= 4; }
  *dLegion(p, names) {
    if (!this.canDLegion(p)) return false; const P = this.players[p]; P.fight.dleg = 1;
    const okT = i => { const d = this.def(this.cards[i]); return d.trigger && d.trigger !== 'heal' && d.trigger !== 'over'; }; const nonT = i => !this.def(this.cards[i]).trigger;
    const nt = P.drop.filter(nonT).length; const tmin = Math.max(0, 4 - nt);
    const ts = yield* this.chooseCards(p, P.drop.filter(okT), { min: tmin, max: Math.min(2, 4), title: 'D-Legion: เลือกทริกเกอร์ยูนิทจากดรอปกลับเด็ค (ไม่เกิน 2 ใบ)', zone: 'drop', hint: 'discard' });
    const rest = yield* this.chooseCards(p, P.drop.filter(i => nonT(i)), { min: 4 - ts.length, max: 4 - ts.length, title: 'D-Legion: เลือกการ์ดอีก ' + (4 - ts.length) + ' ใบจากดรอปกลับเด็ค', zone: 'drop', hint: 'discard' });
    for (const i of ts.concat(rest)) this.move(i, 'deck', { reason: 'cost' });
    const pool = P.deck.filter(i => [].concat(names).some(n => this.def(this.cards[i]).name === n || this.def(this.cards[i]).name.includes(n)));
    const sel = pool.length ? yield* this.chooseCards(p, pool, { min: 1, max: 1, title: 'D-Legion: เลือกการ์ดคู่', zone: 'deck', hint: 'search' }) : [];
    if (sel.length) { const v = this.vg(p); this.move(sel[0], 'VC', { pos: 'V2', rest: v.rest, reason: 'legion', extra: { dlegion: true } }); this.tf['dleg' + p] = 1; this.log('D-Legion! ' + this.name(v) + ' + ' + this.name(this.cards[sel[0]]), p); this.emit('dLegion', { p, iid: sel[0], leader: v.iid }); }
    this.shuffle(p); yield* this.checkTiming(); return sel.length > 0;
  }
  /* Formulights "C+P=X": whenever a unit is called or an order is played during your main phase, your formula count gets +1 until the end of your opponent's next turn */
  cpx(p) { if (this.phase !== 'main' || this.active !== p) return; const v = this.vg(p); if (!v || !this.def(v).cpx) return; this.formulaUp(p, 1); }
  formulaUp(p, n) { for (let k = 0; k < n; k++) this.players[p].effects.push({ formula: 1, label: 'Formula Count +1', until: 'exp', exp: this.expTurn(p) }); }
  formula(p) { return this.players[p].effects.filter(e => e.formula).length; }
  /* swap the positions of your vanguard and one of your rear-guards (the cards keep their state; not a ride) */
  swapVR(p, rid) { const P = this.players[p]; const v = this.vg(p), r = this.cards[rid]; if (!v || !r || r.zone !== 'RC' || r.owner !== p || P.circles.V2) return false; const pos = r.pos; P.circles.V = r.iid; P.circles[pos] = v.iid; r.zone = 'VC'; r.pos = 'V'; v.zone = 'RC'; v.pos = pos; this.ev('swap', { p }); this.log('สลับตำแหน่ง ' + this.name(v) + ' กับ ' + this.name(r), p); return true; }
  isPrison(c) { return String(this.def(c).race || '').split('/').includes('Prison'); }
  hasPrison(p) { return this.players[p].order.some(i => this.isPrison(this.cards[i])); }
  canGauge(p, k) { if (!['regress', 'automod', 'astral', 'bf'].includes(k)) return true; const P = this.players[p]; if ((P.fight.gz || []).includes(k)) return true; return P.order.concat(P.crest).some(i => this.def(this.cards[i]).gz === k) || this.units(p).some(c => c && this.def(c).gz === k); }
  toGauge(iid, kind, host, fd, o) {
    const c = this.cards[iid]; if (!c || c.zone === 'gone') return false;
    if (!this.canGauge(c.owner, kind)) { this.log('ยังมีเกจชนิดนี้ไม่ได้ (ไม่มีการ์ดที่อนุญาต)', c.owner); return false; }
    if (host != null) { const h = this.cards[host]; if (!h || !(isField(h.zone) || h.zone === 'order' || this.pendBS === host)) return false; }
    const evt = this.move(iid, 'gauge', Object.assign({ reason: 'effect' }, o || {}, { gk: kind, gh: host == null ? null : host, fd: !!fd }));
    return c.zone === 'gauge' ? evt : false;
  }
  gaugeOf(iid, kind) { const c = this.cards[iid]; return c ? this.players[c.owner].gauge.filter(g => this.cards[g].gh === iid && (!kind || this.cards[g].gk === kind)) : []; }
  shuffle(p) {
    const d = this.players[p].deck;
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    this.ev('shuffle', { p });
  }
  draw(p, n) {
    const P = this.players[p]; let k = 0;
    const m = n === undefined ? 1 : n;
    for (let i = 0; i < m; i++) { if (!P.deck.length) break; this.move(P.deck[0], 'hand', { reason: 'draw' }); k++; }
    return k;
  }
  soulCharge(p, n) { const P = this.players[p]; if (n > 0 && this.cur) n += P.effects.reduce((t, e) => t + (e.scPlus || 0), 0); if (n > 0 && P.deck.length && this.tl) this.tl.push({ k: 'sc', p }); for (let i = 0; i < n && P.deck.length; i++) this.move(P.deck[0], 'soul', { reason: 'sc' }); if (n > 0 && this.cur) this.emit('soulCharged', { p, n, by: this.cur.iid, byP: this.cur.p }); }
  counterBlast(p, n) {
    const P = this.players[p]; let k = 0;
    for (const i of P.damage) { if (k >= n) break; const c = this.cards[i]; if (c.faceup) { c.faceup = false; k++; } }
    this.ev('cost', { p, kind: 'CB', n }); if (k > 0) this.emit('cbpaid', { p, n: k });
  }
  counterCharge(p, n) {
    this.tf['ccd' + p] = (this.tf['ccd' + p] || 0) + 1;   // "if you did not [Counter-Charge] this turn"
    const P = this.players[p]; let k = 0;
    for (const i of P.damage) { if (k >= n) break; const c = this.cards[i]; if (!c.faceup) { c.faceup = true; k++; } }
    if (k > 0 && this.tl) this.tl.push({ k: 'cc', p });
    this.ev('cost', { p, kind: 'CC', n: k });
  }
  energyCharge(p, n) {
    const P = this.players[p]; if (!P.crest.length) return;
    P.energy = Math.min(10 + (this.vg(p) && this.stat(this.vg(p)).energyMax5 ? 5 : 0), P.energy + n);
    this.tlog({ k: 'ec', n, p, by: this.cur ? this.cur.iid : null });
    this.ev('energy', { p, n, total: P.energy });
  }
  standUnit(iid) { const c = this.cards[iid]; if (!c || !(c.zone === 'VC' || c.zone === 'RC') || c.locked) return false; if (c.rest && this.cur && this.stat(c).noStandFx) return false; if (c.rest && this.stat(c).frozen) return false; const was = c.rest; c.rest = false; this.ev('stand', { p: c.owner, iid }); if (was) this.tlog({ k: 'stand', iid, no: c.no, p: c.owner, by: this.cur ? this.cur.iid : null, zone: c.zone }); if (was) this.emit('stood', { iid, p: c.owner, by: this.cur ? this.cur.iid : null, byP: this.cur ? this.cur.p : null }); return was; }
  restUnit(iid) { const c = this.cards[iid]; if (!c || !(c.zone === 'VC' || c.zone === 'RC') || c.locked) return; if (this.noRestFor(c)) return; const was = c.rest; c.rest = true; this.ev('stand', { p: c.owner, iid }); if (!was && this.cur) this.emit('rested', { iid, p: c.owner, by: this.cur.iid, byP: this.cur.p, byCost: !!this.cur.cost }); }   // 'rested': rested by an ability or as a cost
  retire(iid, cause, by) { const c = this.cards[iid]; if (!c || !isField(c.zone)) return;
    if (cause === 'effect' && c.zone === 'RC' && !c.locked) { const s = this.stat(c); if (s.noRet || (s.noRetOwn && by && this.cards[by] && this.cards[by].owner === c.owner)) { this.log(this.name(c) + ' ไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ด', c.owner); return; } }
    if (by && cause === 'effect' && this.cards[by] && this.cards[by].owner !== c.owner && c.zone === 'RC' && !c.locked && (this.stat(c).noRetOpp || this.stat(c).stayRC || this.stat(c).immune))
 { this.log(this.name(c) + ' ไม่ถูกรีไทร์ด้วยเอฟเฟกต์ของคู่ต่อสู้', c.owner); return; } this.move(iid, 'drop', { reason: 'retire', extra: Object.assign({ cause: cause || 'effect' }, by ? { by, byP: this.cards[by].owner } : {}) }); }
  /* "when this unit would leave (RC), you may discard a card: it stays" (stat flag stayDisc) — asked wherever a rear-guard is about to leave by a battle or an effect; true = it stays */
  *wouldLeave(iid) {
    { const cb = this.cards[iid]; if (cb && cb.zone === 'RC' && cb.pos === 'BC' && !cb.locked && this.def(cb).bsStay3) { const bs = this.gaugeOf(iid, 'bs'); if (bs.length >= 3) { const y = yield* this.yesNo(cb.owner, { title: this.name(cb) + ' กำลังจะออกจาก RC — คืนบัดดี้โซล 3 ใบเข้าเด็คเพื่ออยู่ต่อ?', iid, options: [{ id: 'yes', label: 'คืน 3 ใบ' }, { id: 'no', label: 'ไม่' }] }); if (y) { const sel = bs.length > 3 ? yield* this.chooseCards(cb.owner, bs, { min: 3, max: 3, title: 'เลือกบัดดี้โซล 3 ใบ', hint: 'discard', zone: 'mixed' }) : bs; for (const g of sel) this.move(g, 'deck', { reason: 'effect' }); this.shuffle(cb.owner); this.log(this.name(cb) + ' อยู่บน RC ต่อ', cb.owner); return true; } } } }   // Death Tallica
    { const c0 = this.cards[iid]; if (c0 && c0.zone === 'RC' && !c0.locked && this.active !== c0.owner) { const g = this.players[c0.owner].gauge.find(i => this.cards[i].gh === iid && this.def(this.cards[i]).charmStay); if (g != null) {   // a charm gauge: discard it and the unit stays
      const y = yield* this.yesNo(c0.owner, { title: this.name(c0) + ' กำลังจะออกจาก RC — ทิ้งเกจ ' + this.name(this.cards[g]) + ' เพื่อให้อยู่ต่อ?', iid, options: [{ id: 'yes', label: 'ทิ้งเกจ' }, { id: 'no', label: 'ไม่ทิ้ง' }] });
      if (y) { this.move(g, 'drop', { reason: 'effect' }); this.log(this.name(c0) + ' อยู่บน RC ต่อ', c0.owner); return true; } } } }
    { const c1 = this.cards[iid]; if (c1 && c1.zone === 'RC' && !c1.locked && this.stat(c1).soulguard && !this.def(c1).noSG) { const bs = this.gaugeOf(iid, 'bs'); if (bs.length) {   // Soulguard: a buddy soul card goes to drop instead
      const y = yield* this.yesNo(c1.owner, { title: this.name(c1) + ' กำลังจะออกจาก RC — Soulguard: ทิ้งบัดดี้โซล 1 ใบเพื่อให้อยู่ต่อ?', iid, options: [{ id: 'yes', label: 'Soulguard' }, { id: 'no', label: 'ไม่ใช้' }] });
      if (y) { const sel = bs.length > 1 ? yield* this.chooseCards(c1.owner, bs, { min: 1, max: 1, title: 'เลือกบัดดี้โซลที่จะทิ้ง', hint: 'discard', zone: 'mixed' }) : bs; if (sel[0] != null) { this.move(sel[0], 'drop', { reason: 'effect' }); this.log(this.name(c1) + ' อยู่บน RC ต่อ (Soulguard)', c1.owner); return true; } } } } }
    { const c2 = this.cards[iid]; if (c2 && c2.zone === 'RC' && !c2.locked) { const sv = this.players[c2.owner].drop.find(i => { const d = this.def(this.cards[i]); return d.dropSave && VG.fx.mf(this, this.cards[i], c2, d.dropSave); }); if (sv != null) {   // a card in drop: "you may bind this card; if you do, that rear-guard stays"
      const y = yield* this.yesNo(c2.owner, { title: this.name(c2) + ' กำลังจะออกจาก RC — ไบนด์ ' + this.name(this.cards[sv]) + ' จากดรอปเพื่อให้อยู่ต่อ?', iid, options: [{ id: 'yes', label: 'ไบนด์' }, { id: 'no', label: 'ไม่ใช้' }] });
      if (y) { this.move(sv, 'bind', { reason: 'effect' }); this.log(this.name(c2) + ' อยู่บน RC ต่อ', c2.owner); return true; } } } }
    { const c3 = this.cards[iid]; if (c3 && c3.zone === 'RC' && !c3.locked) { const sv = this.rcs(c3.owner).find(u => u.iid !== iid && !u.locked && this.def(u).rcSave && VG.fx.mf(this, u, c3, this.def(u).rcSave)); if (sv) {
      const y = yield* this.yesNo(c3.owner, { title: this.name(c3) + ' กำลังจะถูกรีไทร์ — รีไทร์ ' + this.name(sv) + ' แทนเพื่อให้อยู่ต่อ?', iid, options: [{ id: 'yes', label: 'รีไทร์แทน' }, { id: 'no', label: 'ไม่ใช้' }] });
      if (y) { this.retire(sv.iid, 'effect'); this.log(this.name(c3) + ' อยู่บน RC ต่อ', c3.owner); return true; } } } }
    const c = this.cards[iid]; if (!c || c.zone !== 'RC' || c.locked) return false; const st = this.stat(c); if (!st.stayDisc) return false;
    const p = c.owner; const hand = this.handFor(p); if (!hand.length) return false;
    const y = yield* this.yesNo(p, { title: this.name(c) + ' กำลังจะออกจาก RC — ทิ้งการ์ด 1 ใบจากมือเพื่อให้อยู่ต่อ?', iid, options: [{ id: 'yes', label: 'ทิ้ง 1 ใบ' }, { id: 'no', label: 'ไม่ทิ้ง' }] });
    if (!y) return false;
    const sel = yield* this.chooseCards(p, hand, { min: 1, max: 1, title: 'เลือกการ์ดจากมือเพื่อทิ้ง', hint: 'discard', zone: 'hand' });
    if (!sel[0]) return false; this.move(sel[0], 'drop', { reason: 'discard' }); this.log(this.name(c) + ' อยู่บน RC ต่อ', p); return true;
  }
  lock(iid) {
 const c = this.cards[iid]; if (!c || c.zone !== 'RC') return; c.locked = true; c.faceup = false; c.rest = false; c.mods = []; this.tlog({ k: 'lock', iid, no: c.no, p: c.owner, by: this.cur ? this.cur.iid : null }); this.emit('locked', { iid, p: c.owner, by: this.cur ? this.cur.iid : null, byP: this.cur ? this.cur.p : null }); this.ev('lock', { iid, p: c.owner }); this.log('ล็อก ' + this.name(c), 1 - c.owner); }
  loseAt(p) { const v = this.vg(p); return (v && this.stat(v).lose7) || this.players[p].effects.some(e => e.lose7) ? 7 : 6; }   // "the number of cards in damage zone for you to lose becomes seven"
  /* [Oversized!]: a lower-body unit in the back row (def.ovp = part of the upper body's name) and that upper body in the same column */
  oversized(c) { if (!c || !(c.zone === 'VC' || c.zone === 'RC')) return false; const col = COLOF[c.pos]; const d = this.def(c); const back = u => ['BL', 'BC', 'BR'].includes(u.pos); return this.units(c.owner).some(u => u.iid !== c.iid && COLOF[u.pos] === col && ((d.ovp && back(c) && this.def(u).name.includes(d.ovp)) || (this.def(u).ovp && back(u) && d.name.includes(this.def(u).ovp)))); }
  unlock(iid) { const c = this.cards[iid]; if (!c || !c.locked) return false; c.locked = false; c.faceup = true; c.rest = false; c.unlockT = this.turnNo; this.ev('unlock', { iid, p: c.owner }); this.tlog({ k: 'unlock', iid, no: c.no, p: c.owner }); this.emit('unlocked', { iid, p: c.owner }); this.log('ปลดล็อก ' + this.name(c), c.owner); return true; }
  dressOf(c) { return (c.dress || []).map(i => this.cards[i]); }
  /* cards of the hand that may be picked for a discard or by the fighter's own skills: ticket cards are protected during their owner's turn */
  handFor(p) { return this.players[p].hand.filter(i => !(this.cards[i].ticket && this.active === p)); }
  /* put a ticket card (it is not part of any deck) into a fighter's hand */
  giveTicket(p, no, by) {
    const c = this.newCard(no, p, 'new', true); c.ticket = true; this.move(c.iid, 'hand', { reason: 'ticket' });
    this.tf['pst' + p] = (this.tf['pst' + p] || 0) + 1; if (by) { const F = this.players[p].fight; (F.ticketBy = F.ticketBy || {})[this.def(by).name] = true; }
    this.log('ได้รับ ' + this.def(c).name + ' ทิกเก็ตขึ้นมือ', p); return c;
  }
  /* markers (Dragontree, Infinity Eyes, X-ceed Net…): they lie on a circle, not on a unit, and stay when the unit changes */
  markerCount(p, k, name, by) { let n = 0; for (const m of this.markers) if ((p == null || m.p === p) && (k == null || m.k === k) && (!name || m.name === name) && (by == null || m.by === by)) n++; return n; }
  addMarker(p, k, name, by) { this.markers.push({ p, k, name, by }); this.ev('marker', { p, k, name, by, n: 1 }); this.log('วาง ' + name + ' marker บน RC ' + k, by); }
  removeMarker(p, k, name, by) { const i = this.markers.findIndex(m => (p == null || m.p === p) && (k == null || m.k === k) && (!name || m.name === name) && (by == null || m.by === by)); if (i < 0) return false; const m = this.markers.splice(i, 1)[0]; this.ev('marker', { p: m.p, k: m.k, name: m.name, by: m.by, n: -1 }); return true; }
  /* overDress / X-overDress: can card c be put on top of the unit on `circle` (and, for X, on other rear-guards as well)? → null or { x, sets: [[iids…], …] } (each set includes the unit on the circle) */
  odPlan(p, c, circle) {
    const od = this.def(c).od; const ex = this.at(p, circle); if (!od || !ex || ex.locked || !VG.fx) return null;
    const ok = (u, f) => VG.fx.mf(this, c, u, f);
    const fixed = od.p.filter(x => x.n), vary = od.p.find(x => !x.n) || null;
    const valid = set => {
      const go = (k, left) => {
        if (k === fixed.length) { if (!vary) return left.length === 0; return left.length >= vary.min && left.length <= vary.max && left.every(u => ok(u, vary.f)) && (!vary.dist || new Set(left.map(u => this.def(u).name)).size === left.length); }
        return left.some((u, i) => ok(u, fixed[k].f) && go(k + 1, left.filter((_, j) => j !== i)));
      };
      return go(0, set);
    };
    const others = this.rcs(p).filter(u => u.iid !== ex.iid); const sets = [];
    for (let m = 0; m < (1 << others.length); m++) { const set = [ex].concat(others.filter((_, i) => m & (1 << i))); const dup = set.filter(u => this.def(u).xod2); if (valid(set) || (dup.length && valid(set.concat(dup)))) sets.push(set.map(u => u.iid)); }
    if (!sets.length) return null;
    sets.sort((a, b) => a.length - b.length);
    return { x: !!od.x, sets };
  }
  /* the specified units become originalDress of the card, which is placed on the circle (stand). Not a normal call. */
  overDress(iid, circle, mats, x, o) {
    const c = this.cards[iid];
    for (const m of mats) this.move(m, 'dress', { host: iid, reason: 'od' });
    this.move(iid, 'RC', Object.assign({ pos: circle, reason: 'call', extra: { od: x ? 'x' : 'o' } }, o || {}));
    c.xod = !!x;
    this.log((x ? 'X-overDress: ' : 'overDress: ') + this.name(c) + ' ทับ ' + mats.map(m => this.name(this.cards[m])).join(' + '), c.owner);
  }
  placeRC(iid, circle, o) {
    const c = this.cards[iid]; const ex = this.at(c.owner, circle);
    if (ex) { if (ex.locked) throw new Error('circle locked'); const src = this.cur && this.cards[this.cur.iid]; if (src && src.zone === 'VC' && src.owner === c.owner && (this.stat(src).callBounce || (this.stat(src).callBounceN && this.def(ex).type === 'unit' && !this.def(ex).trigger && !this.def(ex).sentinel))) this.move(ex.iid, 'hand', { reason: 'replace' }); else if (o && o.repl === 'soul') this.move(ex.iid, 'soul', { reason: 'replace' }); else this.retire(ex.iid, 'replace'); }   // callBounce: "the unit on that circle returns to hand instead"
    const exPw = ex ? (this.def(ex).power || 0) : 0, exNm = ex ? this.def(ex).name : null; const src2 = this.cur && this.cards[this.cur.iid];
    this.move(iid, 'RC', Object.assign({ pos: circle }, o || {}, ex ? { extra: Object.assign({}, o && o.extra, { over: 1, overNo: ex.no, overTok: !!(ex.token || this.def(ex).tokenAs) }) } : {}));
    if (ex && src2 && src2.zone === 'VC' && src2.owner === c.owner && this.stat(src2).overPw && exNm !== this.def(c).name && c.zone === 'RC') this.addMod(iid, { power: exPw }, 'turn');   // the unit placed over another by the vanguard's ability gets that unit's original power
  }

  /* ----- events / abilities ----- */
  emit(name, evt) {
    evt = Object.assign({}, evt, { name });
    for (const k in this.cards) {
      const c = this.cards[k];
      if (c.zone === 'gone' && c.iid !== evt.iid) continue;
      if (c.locked) continue;
      if (!c.granted.length && !this.def(c).abilities) continue;
      if (this.players[c.owner] && this.players[c.owner].effects.length && this.players[c.owner].effects.some(e => e.noAutoAll)) continue;   // "your opponent cannot activate the [AUTO] abilities of their cards"
      const noAuto = (c.mods.length && c.mods.some(m => m.noAuto)) || this.trainLock(c) || (c.fromRC && c.zone === 'GC' && this.icptMuted(c));   // "loses all of its [AUTO] abilities"
      for (const { ab, key } of this.abs(c)) {
        const i = key;
        if (ab.type !== 'auto') continue;
        if (noAuto) continue;
        if (!(ab.on === name || (Array.isArray(ab.on) && ab.on.includes(name)))) continue;
        if (ab.who === 'any') { if (!this.inZone(c, ab.zone)) continue; }
        else {
          if (evt.iid !== c.iid) continue;
          if (ab.zone) { if (name === 'leaveRC') { if (ab.zone !== 'RC') continue; } else if (!this.inZone(c, ab.zone)) continue; }
        }
        if (ab.match && !ab.match(this, c, evt)) continue;
        this.pendingAutos.push({ iid: c.iid, idx: i, evt, p: c.owner });
      }
    }
  }
  limitOk(c, idx, ab) {
    if (ab.divine && this.players[c.owner].divine) return false;   // a fighter may use only one Divine Skill in a fight
    if (!ab.limit) return true;
    const u = c.used[idx];
    if (ab.limit === 'turn') return u !== this.turnNo;
    return !u;
  }
  /* a unit may hold one "next counter-blast of this ability costs 1 less" (c.cbLess = { key, t }) */
  discFor(c, idx) { const own = c.cbLess && c.cbLess.t === this.turnNo && (c.cbLess.key == null || c.cbLess.key === idx) ? (c.cbLess.n || 1) : 0; return own || (isField(c.zone) && typeof idx === 'number' && this.stat(c).cbLess1 ? 1 : 0); }   // cbLess1: a continuous ability lowers the cost of this unit's printed abilities

  canPay(ab, c, evt, idx) { { const no = this.players[c.owner].fight.nooc; if (no && no.includes(this.def(c).name) && (this.def(c).tags || []).includes('overcharge') && ab.type !== 'cont') return false; } if (!ab.cost) return true; { const na = this.tf['noautok' + c.owner]; if (na && ab.type === 'auto' && na.includes(this.def(c).name)) return false; } { const nf = this.players[c.owner].fight.nofs; if (nf && nf.includes(this.def(c).name) && (this.def(c).tags || []).some(t => /fant[oô]me ?skill/.test(t)) && ab.type !== 'cont') return false; } this.cbDisc = idx === undefined ? 0 : this.discFor(c, idx); try { return ab.cost.every(k => k.can(this, c, evt)); } finally { this.cbDisc = 0; } }
  abilityLabel(c, idx) { const d = this.def(c); const ab = this.getAb(c, idx); return d.name + (ab && ab.label ? ' — ' + ab.label : ''); }
  *useAbility(c, idx, evt) {
    const ab = this.getAb(c, idx); const ctx = { paid: [] };
    c.used[idx] = ab.limit === 'turn' ? this.turnNo : true; if (ab.divine) this.players[c.owner].divine = true;
    this.ev('ability', { iid: c.iid, idx, p: c.owner, no: c.no });
    this.tlog({ k: 'ab', iid: c.iid, no: c.no, p: c.owner, idx, zone: c.zone, type: ab.type, divine: !!ab.divine, fight: 1 });
    this.log('ใช้สกิล: ' + this.abilityLabel(c, idx), c.owner);
    const prev = this.cur;
    try {
      this.cur = { iid: c.iid, p: c.owner, cost: true, type: ab.type };
      this.cbDisc = this.discFor(c, idx); this.cbDiscCard = c;
      try { if (ab.cost) for (const k of ab.cost) ctx.paid.push(yield* k.pay(this, c, evt)); } finally { this.cbDisc = 0; this.cbDiscCard = null; }
      this.cur = { iid: c.iid, p: c.owner, cost: false, type: ab.type, divine: !!ab.divine };
      if (ab.type === 'act') this.emit('actUsed', { iid: c.iid, p: c.owner, zone: c.zone });
      yield* ab.run(this, c, evt || {}, ctx);
    } finally { this.cur = prev; }
  }
  *resolveAuto(e) {
    const c = this.cards[e.iid], ab = this.getAb(c, e.idx);
    if (!ab) return;
    if (this.players[c.owner].effects.some(x => x.noAutoP)) return;
    if (!this.limitOk(c, e.idx, ab)) return;
    if (ab.who === 'any' || !MOVE_EVENTS.has(e.evt.name)) { if (ab.zone && !this.inZone(c, ab.zone)) return; }
    if (ab.cond && !ab.cond(this, c, e.evt)) return;
    if (ab.cost) {
      if (!this.canPay(ab, c, e.evt, e.idx)) return;
      const y = yield* this.yesNo(c.owner, { title: 'ใช้สกิลของ ' + this.name(c) + '?', sub: (ab.label || '') + ' · คอสต์: ' + ab.cost.map(k => k.label).join(' + '), iid: c.iid, idx: e.idx });
      if (!y) return;
    } else if (ab.optional) {
      const y = yield* this.yesNo(c.owner, { title: 'ใช้สกิลของ ' + this.name(c) + '?', sub: ab.label || '', iid: c.iid, idx: e.idx });
      if (!y) return;
    }
    yield* this.useAbility(c, e.idx, e.evt);
  }
  ruleCheck() {
    for (const p of [this.active, 1 - this.active]) {
      const P = this.players[p];
      if (P.damage.length >= this.loseAt(p)) this.lose(p, 'damage');
      if (P.deck.length === 0) this.lose(p, 'deck');
      { const seen = new Map(); for (const i of P.order.slice().reverse()) { const d = this.def(this.cards[i]); if (!d.ozOne) continue; if (seen.has(d.name)) { this.move(i, 'drop', { reason: 'rule' }); this.log('"' + d.name + '" อยู่ในออเดอร์โซนได้ใบเดียว', p); } else seen.set(d.name, 1); } }   // "only one card named … in your order zone"
      const evs = P.order.filter(i => this.def(this.cards[i]).event); if (evs.length > 1) for (const i of evs.slice(0, -1)) { this.move(i, 'drop', { reason: 'rule' }); this.log('[Event] เซ็ตออเดอร์อีเวนต์มีได้ใบเดียว: ' + this.name(this.cards[i]) + ' ลงดรอป', p); }   // [Event]: two or more → keep one (the newest), the rest go to drop
    }
  }
  lose(p, reason) {
    this.over = { winner: 1 - p, reason };
    this.ev('win', { winner: 1 - p, reason });
    throw GAME_OVER;
  }
  *checkTiming() {
    for (;;) {
      this.ruleCheck();
      if (!this.pendingAutos.length) return;
      let p = this.active;
      let q = this.pendingAutos.filter(e => e.p === p);
      if (!q.length) { p = 1 - p; q = this.pendingAutos.filter(e => e.p === p); }
      // drop entries that can no longer resolve, so the player is not asked to order dead triggers
      q = q.filter(e => this.couldResolve(e));
      if (!q.length) { this.pendingAutos = this.pendingAutos.filter(e => e.p !== p); continue; }
      let pick = q[0];
      if (q.length > 1) {
        const [o] = yield* this.ask({ player: p, kind: 'order', title: 'เลือกสกิลที่จะทำงานก่อน', options: q.map(e => ({ iid: e.iid, idx: e.idx, label: this.abilityLabel(this.cards[e.iid], e.idx), e })) });
        pick = o.e;
      }
      this.pendingAutos.splice(this.pendingAutos.indexOf(pick), 1);
      yield* this.resolveAuto(pick);
    }
  }
  couldResolve(e) {
    const c = this.cards[e.iid], ab = this.getAb(c, e.idx);
    if (!ab) return false;
    if (!this.limitOk(c, e.idx, ab)) return false;
    if (ab.who === 'any' || !MOVE_EVENTS.has(e.evt.name)) { if (ab.zone && !this.inZone(c, ab.zone)) return false; }
    if (ab.cond && !ab.cond(this, c, e.evt)) return false;
    if (ab.cost && !this.canPay(ab, c, e.evt, e.idx)) return false;
    return true;
  }

  /* ----- decisions ----- */
  *ask(d) {
    d.min = d.min === undefined ? 1 : d.min;
    d.max = d.max === undefined ? 1 : d.max;
    if (!d.options.length) return [];
    if (d.max > d.options.length) d.max = d.options.length;
    if (d.min > d.max) d.min = d.max;
    if (d.options.length === d.min && !d.noAuto) return d.options.slice();
    const sel = yield d;
    if (sel[0] === -1) return [{ a: 'man', m: sel }];
    return sel.map(i => d.options[i]);
  }
  /* ----- manual tools -----
     What a card says can always be carried out by hand, for skills the program does not run by itself.
     A manual action is an answer of the form [-1, op, a, b, c] (all integers, see VG.MAN); it is allowed whenever the pending decision has `man` set
     (main phase, attack choice, guard step). After it the same decision is asked again. */
  manualErr(p, m) {
    const P = this.players[p]; const M = VG.MAN.op; const op = m[1];
    const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    for (let i = 1; i < m.length; i++) if (!Number.isInteger(m[i])) return 'manual: numbers only';
    if (m.length > 6) return 'manual: too long';
    switch (op) {
      case M.draw: case M.sc: case M.mill: return int(m[2], 1, 10) ? (P.deck.length >= m[2] ? null : 'manual: not enough cards in deck') : 'manual: bad number';
      case M.cc: return int(m[2], 1, 6) && P.damage.filter(i => !this.cards[i].faceup).length >= m[2] ? null : 'manual: no face-down damage';
      case M.cb: return int(m[2], 1, 6) && P.damage.filter(i => this.cards[i].faceup).length >= m[2] ? null : 'manual: no face-up damage';
      case M.ec: return int(m[2], -10, 10) && m[2] !== 0 && P.crest.length ? null : 'manual: no energy';
      case M.shuf: return null;
      case M.look: return int(m[2], 0, 60) ? null : 'manual: bad number';
      case M.st: { const c = this.cards[m[2]]; return c && (c.zone === 'VC' || c.zone === 'RC') && !c.locked && (m[3] === 0 || m[3] === 1) ? null : 'manual: bad unit'; }
      case M.mod: { const c = this.cards[m[2]]; return c && isField(c.zone) && !c.locked && int(m[3], 0, 3) && int(m[4], -100000, 100000) && m[4] !== 0 && (m[5] === 0 || m[5] === 1) ? null : 'manual: bad change'; }
      case M.flip: { const c = this.cards[m[2]]; return c && c.owner === p && c.zone === 'damage' ? null : 'manual: bad card'; }
      case M.mv: {
        const c = this.cards[m[2]]; const dest = VG.MAN.dest[m[3]];
        if (!c || !dest || !MAN_FROM.has(c.zone) || c.locked) return 'manual: bad card';
        if (c.owner !== p) return c.zone === 'RC' && ['drop', 'hand', 'top', 'bottom', 'bind'].includes(dest) ? null : 'manual: only the other player\'s rear-guards can be moved';
        const d = this.def(c);
        if (dest === 'rc') { if (!(d.type === 'unit' || d.type === 'token')) return 'manual: not a unit'; const k = RCS[m[4]]; if (!k) return 'manual: bad circle'; const ex = this.at(p, k); return ex && (ex.locked || ex.iid === c.iid) ? 'manual: circle not free' : null; }
        if (dest === 'vc') return d.type === 'unit' && c.zone !== 'VC' && this.rideOk(c, this.vg(p)) ? null : 'manual: cannot ride that';
        if (c.zone === 'VC') return 'manual: a vanguard cannot be moved';
        if (dest === 'gc') return this.battle && this.active !== p && d.type === 'unit' && c.zone !== 'GC' ? null : 'manual: only while you are being attacked';
        if (d.type === 'token' && !isField(dest)) return null;
        return dest === 'top' || dest === 'bottom' || c.zone !== dest ? null : 'manual: already there';
      }
    }
    return 'manual: unknown action';
  }
  *manual(p, m) {
    const P = this.players[p]; const M = VG.MAN.op; const op = m[1]; const tag = '[ทำเอง] ';
    const prev = this.cur; this.cur = null;
    try {
      switch (op) {
        case M.draw: this.log(tag + 'จั่ว ' + m[2] + ' ใบ', p); this.draw(p, m[2]); break;
        case M.sc: this.log(tag + 'โซลชาร์จ ' + m[2], p); this.soulCharge(p, m[2]); break;
        case M.mill: this.log(tag + 'ทิ้งการ์ดใบบนสุดของเด็ค ' + m[2] + ' ใบลงดรอป', p); for (let i = 0; i < m[2] && P.deck.length; i++) this.move(P.deck[0], 'drop', { reason: 'discard' }); break;
        case M.cc: this.log(tag + 'เคาน์เตอร์ชาร์จ ' + m[2], p); this.counterCharge(p, m[2]); break;
        case M.cb: this.log(tag + 'เคาน์เตอร์บลาสต์ ' + m[2], p); this.counterBlast(p, m[2]); break;
        case M.ec: P.energy = Math.max(0, Math.min(10, P.energy + m[2])); this.log(tag + 'พลังงาน ' + (m[2] > 0 ? '+' : '') + m[2] + ' (เหลือ ' + P.energy + ')', p); this.ev('energy', { p, n: m[2], total: P.energy }); break;
        case M.shuf: this.log(tag + 'สับเด็ค', p); this.shuffle(p); break;
        case M.look: this.log(tag + (m[2] ? 'ดูการ์ด ' + m[2] + ' ใบบนสุดของเด็ค' : 'ค้นดูการ์ดในเด็ค'), p); break;
        case M.st: { const c = this.cards[m[2]]; this.log(tag + (m[3] ? 'สแตนด์ ' : 'เรสต์ ') + this.name(c), p); if (m[3]) this.standUnit(c.iid); else this.restUnit(c.iid); break; }
        case M.mod: { const c = this.cards[m[2]]; const key = VG.MAN.key[m[3]]; this.log(tag + this.name(c) + ' ' + { power: 'พลัง', crit: 'คริติคอล', drive: 'ไดรฟ์', shield: 'ชิลด์' }[key] + ' ' + (m[4] > 0 ? '+' : '') + m[4] + (m[5] ? ' จนจบแบทเทิล' : ' จนจบเทิร์น'), p); this.addMod(c.iid, { [key]: m[4] }, m[5] ? 'battle' : 'turn'); break; }
        case M.flip: { const c = this.cards[m[2]]; c.faceup = !c.faceup; this.log(tag + (c.faceup ? 'หงาย' : 'คว่ำ') + 'การ์ดในดาเมจโซน 1 ใบ', p); this.ev('cost', { p, kind: c.faceup ? 'CC' : 'CB', n: 1 }); break; }
        case M.mv: {
          const c = this.cards[m[2]]; const dest = VG.MAN.dest[m[3]]; const from = c.zone; const nm = this.name(c); const own = c.owner === p ? '' : ' ของคู่ต่อสู้';
          const Z = { hand: 'มือ', drop: 'ดรอป', soul: 'โซล', bind: 'ไบนด์โซน', damage: 'ดาเมจโซน', order: 'ออเดอร์โซน', removed: 'นอกเกม', deck: 'เด็ค', ride: 'ไรด์เด็ค', RC: 'สนาม', GC: 'การ์เดี้ยนเซอร์เคิล', VC: 'แวนการ์ดเซอร์เคิล', top: 'บนสุดของเด็ค', bottom: 'ล่างสุดของเด็ค' };
          if (dest === 'rc') { this.log(tag + 'คอล ' + nm + ' จาก' + Z[from], p); this.placeRC(c.iid, RCS[m[4]], { reason: 'call' }); }
          else if (dest === 'vc') { this.log(tag + 'ไรด์ ' + nm + ' จาก' + Z[from], p); this.superRide(p, c.iid, true); }
          else if (dest === 'gc') { this.log(tag + 'นำ ' + nm + ' ลงการ์เดี้ยนเซอร์เคิล', p); this.battle.guards++; this.move(c.iid, 'GC', { reason: 'effect' }); }
          else {
            this.log(tag + 'ย้าย ' + nm + own + ' จาก' + Z[from] + ' → ' + Z[dest], p);
            if (dest === 'top' || dest === 'bottom') this.move(c.iid, 'deck', { bottom: dest === 'bottom', reason: 'effect' });
            else if (dest === 'drop') { if (from === 'RC' || from === 'GC') this.retire(c.iid, 'effect'); else this.move(c.iid, 'drop', { reason: from === 'hand' ? 'discard' : 'effect' }); }
            else if (dest === 'hand') this.move(c.iid, 'hand', { reason: from === 'RC' ? 'bounce' : from === 'deck' ? 'search' : 'effect' });
            else this.move(c.iid, dest, { reason: 'effect' });
          }
          break;
        }
      }
    } finally { this.cur = prev; }
    yield* this.checkTiming();
  }

  /* "when this card would be retired / put into soul / discarded / soul blasted for the cost of …, it may be regarded as two cards" (def.dbl) */
  dblOf(me, kind, pool, n) { if (n < 2) return []; return pool.filter(i => { const d = this.def(this.cards[i]).dbl; if (kind === 'disc' && me.zone === 'VC' && this.cards[i].zone === 'hand' && this.rcs(me.owner).some(u => FRONT.includes(u.pos) && !u.locked && this.def(u).handDbl)) return true; return d && d.k === kind && d.ok(this, me, this.cards[i]); }); }
  dblCan(me, kind, pool, n) { return pool.length + Math.min(this.dblOf(me, kind, pool, n).length, Math.floor(n / 2)) >= n; }
  *dblChoose(me, kind, pool, n, o) {
    const p = me.owner; const dd = this.dblOf(me, kind, pool, n);
    if (!dd.length) return yield* this.chooseCards(p, pool, Object.assign({}, o, { min: n, max: n }));
    const two = yield* this.chooseCards(p, dd, { min: Math.max(0, n - pool.length), max: Math.min(dd.length, Math.floor(n / 2)), title: 'เลือกการ์ดที่จะนับเป็น 2 ใบ (ไม่เลือกก็ได้)', hint: o.hint, zone: o.zone, noAuto: true });
    for (const i of two) this.log(this.name(this.cards[i]) + ' นับเป็น 2 ใบสำหรับคอสต์', p);
    const rest = n - 2 * two.length; const sel = rest > 0 ? yield* this.chooseCards(p, pool.filter(i => !two.includes(i)), Object.assign({}, o, { min: rest, max: rest })) : [];
    return two.concat(sel);
  }
  *chooseCards(p, iids, o) {
    o = o || {}; if (o.max != null && o.max <= 0) return [];   // nothing may be chosen
    const d = Object.assign({ player: p, kind: 'cards', title: 'เลือกการ์ด', options: iids.map(iid => ({ iid })) }, o);
    return (yield* this.ask(d)).map(x => x.iid);
  }
  *chooseUnit(p, title, o) {
    o = o || {};
    const side = o.side === undefined ? p : o.side;
    let list = o.rearOnly ? this.rcs(side) : this.units(side);
    if (o.filter) list = list.filter(c => o.filter(c));
    if (side !== p) list = list.filter(c => { const st = this.stat(c); return !st.resist && !st.immune; });
    const sel = yield* this.chooseCards(p, list.map(c => c.iid), { min: o.min === undefined ? 1 : o.min, max: 1, title, hint: o.hint || 'buff', zone: 'field' });
    return sel[0] || null;
  }
  *givePower(p, n, title) {
    const u = yield* this.chooseUnit(p, title || ('เลือกยูนิทรับพลัง +' + n), { hint: 'buff' });
    if (u) this.addMod(u, { power: n }, 'turn');
    return u;
  }
  *yesNo(p, o) {
    const [a] = yield* this.ask(Object.assign({ player: p, kind: 'yesno', options: [{ id: 'yes', label: 'ใช้' }, { id: 'no', label: 'ไม่ใช้' }] }, o));
    return a.id === 'yes';
  }
  /* The effect of a half-automatic ability: the player does it with the manual tools, then confirms. */
  *manualStep(p, c, note) {
    for (;;) {
      const sel = yield* this.ask({ player: p, kind: 'option', title: 'ทำเอฟเฟกต์ของ ' + this.name(c) + ' ด้วยมือ', sub: note || 'สกิลนี้เกมรู้จังหวะและคอสต์แล้ว ส่วนเอฟเฟกต์ให้กด ✋ ทำเอง ทำตามข้อความการ์ด เสร็จแล้วกด "เสร็จแล้ว"', options: [{ id: 'done', label: 'เสร็จแล้ว' }], iid: c.iid, man: true, noAuto: true, manstep: true });
      if (sel.length === 1 && sel[0].a === 'man') { yield* this.manual(p, sel[0].m); continue; }
      return;
    }
  }
  *chooseOption(p, title, options, o) {
    const [a] = yield* this.ask(Object.assign({ player: p, kind: 'option', title, options }, o || {}));
    return a ? a.id : null;
  }
  *chooseCircle(p, circles, o) {
    o = o || {};
    const sel = yield* this.ask(Object.assign({ player: p, kind: 'circle', title: 'เลือกเซอร์เคิล', options: circles.map(c => ({ circle: c })) }, o));
    return sel[0] ? sel[0].circle : null;
  }
  *payOptional(c, costs, title) {
    if (!costs.every(k => k.can(this, c))) return false;
    const y = yield* this.yesNo(c.owner, { title, sub: 'คอสต์: ' + costs.map(k => k.label).join(' + '), iid: c.iid });
    if (!y) return false;
    for (const k of costs) yield* k.pay(this, c);
    return true;
  }
  /* call a token; returns the token iid or null when declined / impossible */
  *callToken(p, no, o) {
    o = o || {};
    if (no === 'TOKEN/Plant' && !o.noSink) { const v = this.vg(p); const sink = this.rcs(p).find(c => { const d = this.def(c); return d.plantSink && v && this.def(v).name.includes(d.plantSink); }); if (sink) { const t = this.newCard(no, p, 'new', true); this.toGauge(t.iid, 'plant', sink.iid, false); this.log('Plant โทเคนถูกวางเป็นเกจ Plant ของ ' + this.name(sink) + ' แทน', p); return null; } }
    let circles = (o.circles || RCS).filter(k => { const c = this.at(p, k); return (!c || !c.locked) && !(k === 'BC' && this.bcBlocked(p)); });
    if (o.pos) circles = circles.filter(k => k === o.pos); if (o.open) circles = circles.filter(k => !this.at(p, k));
    if (!circles.length) return null;
    const circle = yield* this.chooseCircle(p, circles, { min: o.optional ? 0 : 1, title: o.title || ('คอล ' + VG.card(no).name + ' โทเคนลงเซอร์เคิลไหน?'), hint: o.hint || 'callToken', noAuto: true });
    if (!circle) return null;
    const t = this.newCard(no, p, 'new', true);
    this.placeRC(t.iid, circle, o.rest ? { reason: 'call', rest: true } : { reason: 'call' });
    this.log('คอล ' + VG.card(no).name + ' โทเคน', p);
    return t.iid;
  }
  *searchDeck(p, pred, o) {
    o = o || {};
    const P = this.players[p];
    const c = P.deck.filter(i => pred(this.def(this.cards[i]), this.cards[i]));
    const sel = yield* this.chooseCards(p, c, { min: o.min || 0, max: o.max || 1, title: o.title || 'เลือกการ์ดจากเด็ค', hint: 'search', zone: 'deck', noAuto: true });
    for (const i of sel) { this.ev('reveal', { iid: i, p }); this.move(i, o.to || 'hand', { reason: 'search' }); this.log('นำ ' + this.name(this.cards[i]) + ' จากเด็คขึ้นมือ', p); }
    this.shuffle(p);
    return sel;
  }

  /* ----- main flow ----- */
  *flow() {
    try {
      yield* this.setup();
      for (;;) yield* this.turn();
    } catch (e) { if (e !== GAME_OVER) throw e; }
  }
  *setup() {
    this.first = this.cfg.first === 0 || this.cfg.first === 1 ? this.cfg.first : (this.rand() < 0.5 ? 0 : 1);
    this.active = this.first;
    for (const p of [0, 1]) {
      const P = this.players[p];
      const g0 = P.ride.find(i => this.def(this.cards[i]).type === 'unit' && this.grade(this.cards[i]) === 0);
      if (!g0) throw new Error('ride deck needs a grade 0');
      this.move(g0, 'VC', { pos: 'V', silent: true });
      this.shuffle(p);
      this.draw(p, 5);
    }
    this.ev('phase', { phase: 'mulligan', p: this.first });
    for (const p of [this.first, 1 - this.first]) {
      const P = this.players[p];
      const sel = yield* this.chooseCards(p, P.hand.slice(), { kind: 'mulligan', min: 0, max: 5, title: 'เลือกการ์ดที่จะเปลี่ยน (มัลลิแกน)', hint: 'mulligan', zone: 'hand' });
      for (const i of sel) this.move(i, 'deck', { bottom: true, reason: 'mulligan' });
      this.draw(p, sel.length);
      if (sel.length) this.shuffle(p);
      this.log('เปลี่ยนมือ ' + sel.length + ' ใบ', p);
    }
    this.ev('standup', {}); this.emit('stoodUp', {});
    this.log('Stand up, Vanguard! — ' + this.players[this.first].name + ' เริ่มก่อน');
  }
  *turn() {
    const p = this.active, P = this.players[p];
    this.turnNo++; this.battleNo = 0; this.tf = {}; this.ptl = this.tl; this.tl = [];
    const xt = this.xt; if (xt && xt.vmod && this.vg(p)) this.addMod(this.vg(p).iid, Object.assign({}, xt.vmod), 'turn');
    P.flags = {};
    this.ev('turn', { p, n: this.turnNo });
    this.tf['g0' + p] = this.vg(p) ? this.grade(this.vg(p)) : 0;
    this.emit('turnStart', { p });   // stride: "you started the turn with a grade 3 or greater vanguard"
    this.setPhase('stand');
    yield* this.runLaters('S', p);
    const keepRest = new Set(); for (const c of this.units(p)) if (c.rest && this.stat(c).optStand && !this.stat(c).noStand) { const y = yield* this.yesNo(p, { kind: 'optStand', title: 'ไม่สแตนด์ ' + this.name(c) + ' ในสแตนด์เฟสนี้?', iid: c.iid, options: [{ id: 'yes', label: 'ไม่สแตนด์' }, { id: 'no', label: 'สแตนด์ตามปกติ' }] }); if (y) keepRest.add(c.iid); }   // "you may choose to not [Stand] this unit in your stand phase"
    for (const c of this.units(p)) if (!(c.rest && this.stat(c).noStand) && !keepRest.has(c.iid)) c.rest = false;
    if (P.circles.V2 && this.vg(p)) this.cards[P.circles.V2].rest = this.vg(p).rest;   // D-legion: the mate stands with the leader
    for (const i of P.order) this.cards[i].rest = false;   // rested set orders stand again
    this.ev('stand', { p });
    this.setPhase('draw');
    this.draw(p, 1);
    yield* this.checkTiming();
    if (!(xt && xt.skipRM)) {
    if (xt && xt.noStr) this.tf['nostride' + p] = 1;   // additional turn: "you cannot stride"
    if (!(xt && xt.skipR)) {   // additional turn: "skip the ride phase"
    this.setPhase('ride');
    this.emit('ridePhaseStart', { p });
    yield* this.checkTiming(); yield* this.runLaters('R', p);
    yield* this.ridePhase(p);
    yield* this.strideStep(p);
    }
    this.setPhase('main');
    this.emit('mainStart', { p });
    yield* this.checkTiming(); yield* this.runLaters('M', p);
    yield* this.mainPhase(p);
    }
    if (this.turnNo > 1 || (this.tf.t1atk || []).length) {
      this.setPhase('battle');
      this.emit('battleStart', { p });
      yield* this.checkTiming(); yield* this.runLaters('B', p);
      yield* this.battlePhase(p);
      while (this.tf['xbattle' + p] > 0) {   // "you perform an additional battle phase after this one"
        this.tf['xbattle' + p]--; this.log('แบทเทิลเฟสเพิ่มเติม', p); this.setPhase('battle'); this.emit('battleStart', { p }); yield* this.checkTiming(); yield* this.battlePhase(p);
      }
    }
    this.setPhase('end');
    this.unstride();   // face-up G units go back to the G zone before anything else happens at the end of the turn
    // locked cards of the turn player turn face up and stand at the start of the end phase
    if (!this.tf['keeplock' + p]) for (const k of RCS) { const c = this.at(p, k); if (c && c.locked) this.unlock(c.iid); }   // keeplock: "your locked cards cannot be unlocked during that turn's end phase"
    for (const u of this.units(p)) if (u.deleted) { u.deleted = false; u.faceup = true; this.log(this.name(u) + ' หงายหน้า (สิ้นสุดการ Delete)', p); }   // deleted units turn face up at their owner's end phase
    this.emit('turnEnd', { p });
    yield* this.checkTiming();
    while (this.fatk && this.fatk.length) { const a0 = this.fatk.shift(); const dom = typeof a0 === 'object'; const a = dom ? a0.i : a0; const c = this.cards[a], v = this.vg(1 - p); if (c && v && (dom ? c.owner === 1 - p : c.owner === p) && isField(c.zone)) { this.log(this.name(c) + ' โจมตีแวนการ์ดของคู่ต่อสู้ (Final Phase)', p); this.phase = 'battle'; yield* this.doBattle(p, a, v.iid); this.phase = 'end'; yield* this.checkTiming(); } }   // impact: "it attacks your opponent's vanguard" at the end of the turn
    yield* this.runLaters('t'); yield* this.runLaters('E', p);
    yield* this.clearMusic(p); yield* this.clearMusic(1 - p);
    this.expire('turn');
    for (const k in this.cards) this.cards[k].atk = 0;
    if (this.xtq && this.xtq.length && this.xtq[0].p === p) { this.xt = this.xtq.shift(); this.log('ได้เทิร์นเพิ่มเติม', p); } else { this.xt = null; this.active = 1 - p; }
  }
  setPhase(ph) { this.phase = ph; this.ev('phase', { phase: ph, p: this.active }); }
  /* delayed effects: 'b' end of this battle, 't' end of this turn; with a player: 'S' start of that player's turn, 'R' / 'M' / 'B' start of their ride / main / battle phase, 'E' end of their turn (only from turn `from` on) */
  *runLaters(when, p) {
    const is = l => l.when === when && (p === undefined || (l.p === p && (l.from == null || this.turnNo >= l.from)));
    const due = this.laters.filter(is); if (!due.length) return;
    this.laters = this.laters.filter(l => !is(l));
    for (const l of due) { const prev = this.cur; this.cur = l.src ? { iid: l.src, p: l.p, cost: false } : prev; try { yield* l.fn(); } finally { this.cur = prev; } yield* this.checkTiming(); }
  }

  /* ----- ride ----- */
  *ridePhase(p) {
    const P = this.players[p]; const v = this.vg(p); const g = this.grade(v);
    if (P.effects.some(e => e.rideTax)) { const H = P.hand.slice(); const sel = H.length ? yield* this.chooseCards(p, H, { min: 0, max: 1, title: 'เลือกการ์ดในมือ 1 ใบเพื่อทิ้ง (ถ้าไม่ทิ้ง ไรด์และสไตรด์ไม่ได้ในเทิร์นนี้)', hint: 'discard', zone: 'hand', noAuto: true }) : []; if (sel.length) this.move(sel[0], 'drop', { reason: 'discard' }); else { this.tf['noride' + p] = 1; this.tf['nostride' + p] = 1; this.log('ไม่ได้ทิ้งการ์ด: ไรด์และสไตรด์ไม่ได้ในเทิร์นนี้', p); } }
    if (this.noRideNow(p)) return;
    const opts = [];
    const train = P.order.some(i => this.def(this.cards[i]).trainEq);   // Training Equipment: no normal ride from hand; riding from the ride deck needs no discard
    const next = P.ride.find(i => this.def(this.cards[i]).type === 'unit' && this.grade(this.cards[i]) === g + 1 && this.rideOk(this.cards[i], v));
    const alts = next ? this.rideAlts(p, this.cards[next]) : [];
    const rdFree = P.effects.some(e => e.rdFree);
    if (next && (this.handFor(p).length >= 1 || alts.length || train || rdFree)) opts.push({ a: 'rideDeck', iid: next });
    if (!train) for (const i of P.hand) {
      const c = this.cards[i], d = this.def(c);
      if (d.type !== 'unit' || !this.rideOk(c, v)) continue;
      const cg = this.grade(c); if (cg === g + 1 || (cg === g && g >= 3)) opts.push({ a: 'ride', iid: i, persona: this.personaOk(v, c) });
    }
    if (!opts.length) return;
    opts.push({ a: 'skip' });
    const [o] = yield* this.ask({ player: p, kind: 'ride', title: 'ไรด์เฟส — เลือกการ์ดที่จะไรด์', options: opts });
    if (o.a === 'skip') return;
    if (o.a === 'rideDeck') {
      let alt = null;
      if (alts.length) { const ol = (this.handFor(p).length ? [{ id: 'd', label: 'ทิ้งการ์ด 1 ใบจากมือ' }] : []).concat(alts.map((a, i) => ({ id: String(i), label: a.label }))); const id = ol.length === 1 ? ol[0].id : yield* this.chooseOption(p, 'ไรด์จากไรด์เด็ค — จ่ายอย่างไร?', ol, { iid: next }); if (id == null) alt = this.handFor(p).length ? null : alts[0]; else if (id !== 'd') alt = alts[+id]; }
      if (alt) yield* alt.pay();
      else if (train || rdFree) {}
      else { const sel = yield* this.chooseCards(p, this.handFor(p), { min: 1, max: 1, title: 'ทิ้งการ์ด 1 ใบเพื่อไรด์จากไรด์เด็ค', hint: 'discard', zone: 'hand' }); this.move(sel[0], 'drop', { reason: 'discard', extra: { rideCost: true } }); this.tf['rdisc' + p] = sel[0]; }
    }
    yield* this.doRide(p, o.iid, o.a === 'rideDeck');
  }
  rideAlts(p, nc) { const out = []; for (const c of this.units(p)) { const d = this.def(c); if (d.rideAlt) for (const a of d.rideAlt(this, c, nc)) out.push(a); } return out.filter(a => a.can()); }
  rideOk(c, v) { const d = this.def(c); if (d.crestEG && this.players[c.owner].crest.some(i => this.def(this.cards[i]).name !== 'Energy Generator')) return false; if (d.rideBy) return !!this.cur && !!this.cards[this.cur.iid] && this.def(this.cards[this.cur.iid]).name === d.rideBy;   // "can only be ridden by the ability of X"
    { const vd = this.def(v); if (vd.rideOnlyV && !d.name.includes(vd.rideOnlyV)) return false; }
    for (const i of this.players[c.owner].order) { const ro = this.def(this.cards[i]).rideBarO; if (ro && (d.grade || 0) >= (ro.gmin || 0) && !d.name.includes(ro.nh)) return false; }   // an order in the order zone bars riding cards without X in the name
    const crs = this.players[c.owner].crest; if (crs && crs.some(i => { const cd = this.def(this.cards[i]); return cd.rideOnlyC && !VG.fx.mf(this, c, c, cd.rideOnlyC); })) return false;   // a crest: "you cannot ride cards other than …"
    const ro = this.players[c.owner].fight.rideOnly; if (ro && ro.some(r => (d.grade || 0) >= (r.gmin || 0) && !(r.ico ? d.icon === r.ico : d.name.includes(r.nh)))) return false; return (!d.noRide || !!this.tf['ncont' + c.iid]) && (!d.canRideOn || d.canRideOn(this, v)); }
  /* ride by a card effect (does not use up the normal ride, never a persona ride) */
  guardBadSel(d, sel) {
    if (!(d.handMin > 1)) return null; let g = sel.filter(i => d.options[i] && d.options[i].a === 'guard').map(i => this.cards[d.options[i].iid]);
    if (d.handNs) g = g.filter(c => !this.def(c).sentinel); if (!g.length) return null;
    if (g.length < d.handMin) return 'must call ' + d.handMin + ' or more from hand';
    if (d.handDg && new Set(g.map(c => this.def(c).grade)).size < g.length) return 'grades must all differ';
    return null;
  }
  superRide(p, iid, stand, oldTo) {
    const old = this.vg(p); const nc = this.cards[iid]; if (!nc || nc.zone === 'gone' || nc.iid === old.iid || this.def(nc).type !== 'unit' || !this.rideOk(nc, old) || this.noRideNow(p)) return false;

    const od = this.def(old);
    this.move(old.iid, oldTo || 'soul', { reason: oldTo ? 'cost' : 'ride', silent: !oldTo });
    this.move(iid, 'VC', { pos: 'V', rest: stand === 'rest' ? true : stand ? false : old.rest, reason: 'ride', extra: { ride: true, rideFrom: od.name, rideFromG: od.grade, rideFromIid: old.iid, superior: true } });
    this.log('ไรด์ ' + this.name(nc) + ' ด้วยเอฟเฟกต์', p);
    this.emit('rodeUpon', { iid: old.iid, by: iid, p });
    return true;
  }
  *doRide(p, iid, fromRideDeck) {
    const P = this.players[p]; const old = this.vg(p); const nc = this.cards[iid];
    const od = this.def(old), nd = this.def(nc);
    const persona = !fromRideDeck && this.personaOk(old, nc);
    const rest = old.rest; const fromSt = old.st ? Object.assign({}, old.st) : null;
    const carry = this.tf['carry' + p] ? old.mods.filter(m => m.trig).map(m => Object.assign({}, m)).concat(old.granted.filter(g => g.strat).map(g => g)) : null;
    this.move(old.iid, 'soul', { reason: 'ride', silent: true });
    this.move(iid, 'VC', { pos: 'V', rest, reason: 'ride', extra: { ride: true, rideFrom: od.name, rideFromG: od.grade, rideFromIid: old.iid, rideFromSt: fromSt, fromRideDeck, persona } });
    if (carry) for (const m of carry) { if (m.ab) nc.granted.push(m); else nc.mods.push(m); }   // "the riding unit is placed with the trigger effects and Strategy-given abilities your vanguard got this turn"
    P.flags.rode = true; this.tf['rode' + p] = 1;
    this.log('ไรด์ ' + nd.name + (persona ? ' (เพอร์โซน่าไรด์!)' : ''), p);
    this.emit('rodeUpon', { iid: old.iid, by: iid, p });
    for (const i of P.ride.slice()) if (this.def(this.cards[i]).type === 'crest') this.move(i, 'crest', { reason: 'crest' });
    if (persona) this.activatePersona(p);
    yield* this.checkTiming();
  }
  /* use one of a card's printed [ACT] abilities by an effect, without paying its cost */
  *actFree(p, iid, src) {
    const c = this.cards[iid]; if (!c) return false; const list = (this.def(c).abilities || []).map((ab, i) => ({ ab, i })).filter(x => x.ab.type === 'act' && x.ab.run); if (!list.length) return false;
    let pick = list[0];
    if (list.length > 1) { const id = yield* this.chooseOption(p, 'เลือก ACT ของ ' + this.name(c) + ' ที่จะใช้ (ไม่ต้องจ่ายคอสต์)', list.map((x, k) => ({ id: String(k), label: x.ab.label || 'ACT ' + (k + 1) })), { iid }); pick = list[+id] || list[0]; }
    this.log('ใช้ ACT ของ ' + this.name(c) + ' โดยไม่จ่ายคอสต์', p);
    const prev = this.cur; try { this.cur = { iid: src ? src.iid : iid, p, cost: false }; yield* pick.ab.run(this, src && src.zone !== 'gone' && !isField(c.zone) ? src : c, {}, { paid: [] }); } finally { this.cur = prev; }
    return true;
  }
  /* play an order by an effect, without paying its cost
 (it does not use up the turn's order) */
  *playFree(p, iid) {
    const c = this.cards[iid]; if (!c) return false; const d = this.def(c); if (d.type !== 'order' || !d.play) return false;
    this.log('เพลย์ออเดอร์ ' + d.name + ' โดยไม่จ่ายคอสต์', p); this.ev('ability', { iid: c.iid, p, no: c.no });
    const prev = this.cur;
    try { this.cur = { iid: c.iid, p, cost: false }; if (d.orderKind === 'set') this.move(c.iid, 'order', { reason: 'play' }); else if (d.music) this.putMusic(c.iid); else this.move(c.iid, 'trigger', { reason: 'play', silent: true }); if (d.play.run) yield* d.play.run(this, c, {}, { paid: [] }); if (c.zone === 'trigger') this.move(c.iid, 'drop', { reason: 'played' }); } finally { this.cur = prev; }
    this.emit('playOrder', { p, iid: c.iid, kind: (d.orderKind || 'normal')[0], from: c.playedFrom, alc: !!c.alcT && c.alcT === this.turnNo });
    return true;
  }
  /* is riding card nc on vanguard v a persona ride?
 the same card name on a grade 3 with Persona Ride; some cards widen it (def.personaAlso(other def, own def)) */
  personaOk(v, nc) {
    if (v && v.zone === 'VC' && this.players[v.owner].circles.V2) return false;   // D-legion: the cards lose the persona ride icon
    const od = this.def(v), nd = this.def(nc); if (!(od.grade >= 3)) return false;
    if (od.persona && od.name === nd.name) return true;
    if ((od.personaOn && od.personaOn(nd, od)) || (nd.personaFrom && nd.personaFrom(od, nd))) return true;   // "the normal ride … on this unit / from those cards also becomes a persona ride"
    return !!((od.personaAlso && od.personaAlso(nd, od)) || (nd.personaAlso && nd.personaAlso(od, nd)));
  }
  /* the effect of a persona ride: draw a card, front row +10000 for this turn */
  activatePersona(p) {
    const P = this.players[p]; this.tf['persona' + p] = 1;
    this.ev('persona', { p });
    this.emit('personaRide', { p });
    const plus = this.hasFlag(p, 'personaPlus'); const pw15 = plus || this.hasFlag(p, 'personaPw');   // personaPw: only the +15000   // "when you persona ride, draw two cards instead of one, +15000 instead of +10000"
    this.draw(p, plus ? 2 : 1);
    P.effects.push({ until: 'turn', label: 'เพอร์โซน่าไรด์: แถวหน้า +' + (pw15 ? 15000 : 10000), aura: (G, c) => (c.owner === p && isField(c.zone) && c.zone !== 'GC' && (FRONT.includes(c.pos) || G.hasFlag(p, 'personaBack')) ? { power: plus ? 15000 : 10000 } : null) });
  }
  /* move a rear-guard to another (free) circle of its owner */
  moveUnit(iid, k) { const c = this.cards[iid]; if (!c || c.zone !== 'RC' || !RCS.includes(k)) return false; const P = this.players[c.owner]; if (P.circles[k]) return false; P.circles[c.pos] = null; P.circles[k] = iid; c.pos = k; this.ev('swap', { p: c.owner }); this.shifted(iid); return true; }
  /* a rear-guard changed circles (move / swap): raises 'moved' RC → RC */
  shifted(iid) { const c = this.cards[iid]; if (!c) return; this.emit('unmoor', { iid, p: c.owner });   // Unmoor: this unit moved to another (RC)
    this.emit('moved', { iid, p: c.owner, from: 'RC', to: 'RC', toPos: c.pos, reason: 'move', by: this.cur ? this.cur.iid : null, byP: this.cur ? this.cur.p : null, byCost: !!(this.cur && this.cur.cost) }); }
  /* does one of player p's units have a continuous ability (printed, condition met) that sets this flag for the player? ("your persona ride also increases the power of your back row units") */
  hasFlag(p, flag) { for (const u of this.units(p).concat(this.players[p].order.map(i => this.cards[i]))) { if (!u || u.locked) continue; for (const ab of this.def(u).abilities || []) if (ab.type === 'cont' && ab.mod && typeof ab.mod === 'object' && ab.mod[flag] && this.inZone(u, ab.zone || 'field') && (!ab.cond || ab.cond(this, u))) return true; } return this.players[p].effects.some(e => e[flag]); }
  /* soul cards that may be taken out by costs / effects (a card may say it cannot leave the soul) */
  soulFor(p) { return this.players[p].soul.filter(i => { const d = this.def(this.cards[i]); return !(d.soulStay && d.soulStay(this, this.cards[i])); }); }
  /* a named state a unit is in
 (Malwyrm…): kept while it stays on the field */
  hasState(c, name) { return !!(c && c.st && c.st[name]); }
  setState(c, name) { const had = !!(c.st && c.st[name]); (c.st = c.st || {})[name] = true; this.ev('state', { p: c.owner, name, iid: c.iid }); if (!had) this.emit('ustate', { iid: c.iid, p: c.owner, st: name }); this.log(this.name(c) + ' เข้าสู่สถานะ ' + name, c.owner); }

  /* ----- main ----- */
  mainOptions(p) {
    const P = this.players[p]; const g = this.grade(this.vg(p)); const opts = [];
    for (const i of P.hand) {
      const c = this.cards[i], d = this.def(c);
      { const vd = this.def(this.vg(p)); if (vd.callFilter && d.type === 'unit' && !VG.fx.mf(this, c, c, vd.callFilter)) continue; }
      { const of = this.players[p].order.map(i => this.def(this.cards[i]).ozCallF).find(Boolean); if (of && d.type === 'unit' && !VG.fx.mf(this, c, c, of)) continue; }   // an order-zone card bars calling some cards   // the vanguard bars calling some cards
      if (d.type === 'unit' && (this.grade(c) <= g || (this.def(this.vg(p)).callAnyF && VG.fx.mf(this, c, c, this.def(this.vg(p)).callAnyF))) && !d.noNormalCall && !(this.tf['nocall' + p] && this.tf['nocall' + p].includes(d.name)) && !(d.callBar && d.callBar(this, c)) && !(d.normOnly && !d.normOnly(this, c)) && !(d.callCost && !d.callCost.every(k => k.can(this, c)))) {
 for (const k of RCS) { if (d.onlyBC && k !== 'BC') continue; if (k === 'BC' && this.bcBlocked(p)) continue; if (d.callOnMarker && !this.markerCount(p, k, d.callOnMarker)) continue; const ex = this.at(p, k); if (d.callOnTok && !(ex && (ex.token || this.def(ex).tokenAs))) continue; if (d.callOnTop && !(ex && VG.fx.mf(this, c, ex, d.callOnTop))) continue; if (d.egF && ex && !ex.locked && VG.fx.mf(this, c, ex, d.egF)) opts.push({ a: 'call', iid: i, circle: k, eg: true }); if (!ex || !ex.locked) opts.push({ a: 'call', iid: i, circle: k }); } }
      if (d.type === 'order' && d.orderKind !== 'blitz' && this.canPlayOrder(p, c)) opts.push({ a: 'order', iid: i });
      if (d.volundr && this.canVolundr(p, c)) opts.push({ a: 'varm', iid: i });   // Völundr: play this unit card as an equip order onto the named vanguard
    }
    for (const [f, b, col] of [['FL', 'BL', 'L'], ['FR', 'BR', 'R']]) {
      const cf = this.at(p, f), cb = this.at(p, b);
      if ((cf || cb) && !(cf && cf.locked) && !(cb && cb.locked) && !(cf && this.stat(cf).noMove) && !(cb && this.stat(cb).noMove)) opts.push({ a: 'move', col });
    }
    /* "you can also move it within the same row": swaps along a row, for units that have rowMove, or for all your rear-guards under a rowMv effect */
    const rowAll = P.effects.some(e => e.rowMv);
    for (const row of [['BL', 'BC'], ['BC', 'BR'], ['FL', 'FR']]) {
      if (!P.circles[row[0]] && !P.circles[row[1]]) continue; if (row.includes('BC') && this.bcBlocked && this.bcBlocked(p)) continue;
      const us = row.map(k => this.at(p, k)).filter(Boolean); if (us.some(u => u.locked || this.stat(u).noMove)) continue;
      if (rowAll || us.some(u => this.stat(u).rowMove)) opts.push({ a: 'move', row });
    }
    for (const z of ['drop', 'soul', 'bind']) for (const i of P[z]) { const c = this.cards[i], d = this.def(c); if (d.type === 'order' && d.orderKind !== 'blitz' && ((d.playFrom && d.playFrom.includes(z) && (!d.playFromC || d.playFromC(this, c))) || (c.pf && c.pf.t === this.turnNo && c.pf.z === z)) && this.canPlayOrder(p, c)) opts.push({ a: 'order', iid: i }); }
    const acts = this.activeCards().filter(c => c.owner === p && !c.locked);
    for (const z of ['hand', 'drop', 'soul', 'bind', 'damage', 'gauge', 'mbox']) for (const i of P[z]) if (this.def(this.cards[i]).actOff) acts.push(this.cards[i]);
    for (const c of acts) {
      for (const { ab, key: idx } of this.abs(c)) {
        if (ab.type !== 'act') continue;
        if (this.tf['noact' + p] && this.tf['noact' + p].includes(this.def(c).name)) continue;
        if (this.trainLock(c) && !String(idx).startsWith('g')) continue;
        if (c.mods.length && c.mods.some(m => m.noAct)) continue;
        if (c.zone === 'order' && this.def(c).orderKind === 'set' && this.def(c).name !== 'Training Equipment' && P.order.some(i => this.def(this.cards[i]).ssLock) && this.tl.some(r => r.k === 'ab' && r.p === p && r.type === 'act' && r.zone === 'order' && r.iid !== c.iid && this.cards[r.iid] && this.def(this.cards[r.iid]).orderKind === 'set' && this.def(this.cards[r.iid]).name !== 'Training Equipment')) continue;   // Seaside Camp: one set order's [ACT] (other than Training Equipment) a turn   // ACT of the named cards is barred for the rest of the turn
        if (!this.inZone(c, ab.zone || 'field')) continue;
        if (!this.limitOk(c, idx, ab)) continue;
        if (ab.cond && !ab.cond(this, c)) continue;
        if (!this.canPay(ab, c, undefined, idx)) continue;
        opts.push({ a: 'act', iid: c.iid, idx, label: ab.label || 'ACT' });
      }
    }
    opts.push({ a: 'next' });
    return opts;
  }
  /* one order per turn per player; regalis pieces once per fight */
  canPlayOrder(p, c) {
    if (this.def(c).orderKind === 'set' && this.players[p].crest.some(i => this.def(this.cards[i]).noSetPlay)) return false;   // Mushiking crest: "cannot play set orders"
    const d = this.def(c), P = this.players[p]; const ab = d.play;
    if ((P.fight.npm || []).includes(d.name) && this.phase === 'main' && this.active === p) return false;   // "this fight you cannot play cards named … in your main phase"
    if (d.noPlay || !ab || (d.grade > this.grade(this.vg(p)) && !(d.ignoreGrade && d.ignoreGrade(this, p)))) return false;
    if (this.tf['onlyTicket' + p] && !d.ticket) return false;
    { const vf = this.def(this.vg(p)).ordFilter; if (vf && this.active === p && !VG.fx.mf(this, c, c, vf)) return false; }   // the vanguard says "during your turn you cannot play orders other than …"
    if (d.orderKind === 'blitz' && P.effects.length && P.effects.some(e => e.noBlitz)) return false;   // "your opponent cannot play blitz orders"
    if (this.ordOnly && this.ordOnly[p] && this.ordOnly[p].t === this.turnNo && !VG.fx.mf(this, c, c, this.ordOnly[p].f)) return false;   // "you cannot play orders other than …" this turn
    if (this.stat(this.vg(p)).ordDiff && (this.tf['ordn' + p] || []).includes(d.name)) return false;   // "you cannot play an order with the same name as one played this turn"
    { const used = this.tf['ord' + p] || 0; const max = Math.max(1, this.tf['omax' + p] || 0, this.stat(this.vg(p)).ord3 ? 3 : this.stat(this.vg(p)).ord2 ? 2 : 0, d.orderKind === 'blitz' ? this.tf['bmax' + p] || 0 : 0); if (used >= max && !(d.ignoreLimit && d.ignoreLimit(this, c))) return false; }   // omax: "you may play two orders this turn"
   // one order a turn; a Persona Shield ticket allows a second blitz order
    if (d.regalis && P.fight.regalis) return false;
    const prev = this.cur; this.cur = { iid: c.iid, p, cost: true };
    try { return (!ab.cond || ab.cond(this, c)) && (!ab.cost || (d.playFree && d.playFree(this, c)) || (this.tf['freeset' + p] && d.orderKind === 'set') || ab.cost.every(k => k.can(this, c))); } finally { this.cur = prev; }
  }
  /* alchemagic: the vanguard (def.alc) or an effect this turn (tf.alc<p>) lets a normal order take a second one from drop (bound) or bind zone */
  alcRule(p) { const v = this.vg(p); const r = (v && this.def(v).alc) || this.tf['alc' + p]; return r || null; }
  *alchemagic(p, c) {
    const d = this.def(c); if (d.type !== 'order' || (d.orderKind && d.orderKind !== 'normal')) return null; const r = this.alcRule(p); if (!r) return null;
    const P = this.players[p]; const from = r.from || 'drop';
    const cands = P[from].filter(i => { const x = this.cards[i], dx = this.def(x); if (i === c.iid || dx.type !== 'order' || (dx.orderKind && dx.orderKind !== 'normal') || !dx.play) return false; if (r.nm === 'same' && dx.name !== d.name) return false; if (r.nm === 'diff' && dx.name === d.name) return false; return !dx.play.cost || dx.play.cost.every(k => this.alcFreeOk(p, k) || k.can(this, x)); });
    if (!cands.length) return null;
    const y = yield* this.yesNo(p, { title: 'Alchemagic?', sub: 'เลือกนอร์มอลออเดอร์อีกใบจาก' + (from === 'bind' ? 'ไบนด์โซน' : 'ดรอป (ไบนด์)') + ' รวมคอสต์ แล้วเพิ่มเอฟเฟกต์ของมันต่อท้าย', iid: c.iid, options: [{ id: 'yes', label: 'Alchemagic' }, { id: 'no', label: 'ไม่ใช้' }] });
    if (!y) return null;
    if (this.tf['alccb' + p]) { (this.tf['cbl' + p] = this.tf['cbl' + p] || []).push({ any: 1, n: this.tf['alccb' + p] }); this.tf['alccb' + p] = 0; }   // "the next time you alchemagic this turn, that cost is reduced by counter-blast n"
    const [bi] = yield* this.chooseCards(p, cands, { min: 1, max: 1, title: 'เลือกออเดอร์ที่จะ Alchemagic', zone: from, hint: 'search' }); if (bi == null) return null;
    if (from === 'drop') this.move(bi, 'bind', { reason: 'cost' });
    const b = this.cards[bi], db = this.def(b); const paid = [];
    const prev = this.cur; this.cur = { iid: bi, p, cost: true };
    try { for (const k of db.play.cost || []) { if (this.alcFreeOk(p, k)) { paid.push(0); continue; } if (!k.can(this, b)) break; paid.push(yield* k.pay(this, b)); } } finally { this.cur = prev; }
    this.tf['alcnosb' + p] = 0; this.tf['alcd' + p] = 1; c.alcT = this.turnNo; this.log('Alchemagic! ' + d.name + ' + ' + db.name, p); this.tlog({ k: 'alc', iid: c.iid, with: bi, p });
    this.emit('alchemagic', { p, iid: c.iid, with: bi }); return { iid: bi, paid };
  }
  alcFreeOk(p, k) { return !!this.tf['alcnosb' + p] && /โซลบลาสต์/.test(k.label || ''); }   // "you may choose not to pay all of that cost's [soul-blast]"
  canVolundr(p, c) { const d = this.def(c), v = this.vg(p); if (!v || c.zone !== 'hand' || this.def(v).name !== d.volundr || this.tf['noarm' + p]) return false; if (this.tf['onlyTicket' + p]) return false; const used = this.tf['ord' + p] || 0; const max = Math.max(1, this.tf['omax' + p] || 0, this.stat(v).ord3 ? 3 : this.stat(v).ord2 ? 2 : 0); return used < max; }
  *playVolundr(p, c) { const d = this.def(c); this.tf['ord' + p] = (this.tf['ord' + p] || 0) + 1; this.players[p].flags.orderPlayed = true; this.log('เพลย์ ' + d.name + ' เป็นออเดอร์อาร์ม (Völundr)', p); this.tlog({ k: 'ord', iid: c.iid, no: c.no, p, kind: 'a', fight: 1 }); this.armCard(c.iid, p); yield* this.checkTiming(); }
  *playOrder(p, c) {
    this.cpx(p);
    const d = this.def(c), P = this.players[p]; const ctx = { paid: [] }; c.playedFrom = c.zone;
    P.flags.orderPlayed = true;
 this.tf['ord' + p] = (this.tf['ord' + p] || 0) + 1; this.tf['ordk' + p] = (this.tf['ordk' + p] || '') + (d.orderKind || 'normal')[0];
    if (d.regalis) P.fight.regalis = true;
    (this.tf['ordn' + p] = this.tf['ordn' + p] || []).push(d.name);
    this.log('เพลย์ออเดอร์ ' + d.name, p); this.tlog({ k: 'ord', iid: c.iid, no: c.no, p, kind: (d.orderKind || 'normal')[0], fight: 1 });
    this.ev('ability', { iid: c.iid, p, no: c.no });
    const prev = this.cur;
    try {
      this.cur = { iid: c.iid, p, cost: true };
      if (this.tf['freeset' + p] && d.orderKind === 'set') this.tf['freeset' + p] = 0;   // "play the next set order without paying its cost"
      else if (d.play.cost && !(d.playFree && d.playFree(this, c))) for (const k of d.play.cost) ctx.paid.push(yield* k.pay(this, c));
      const alc = yield* this.alchemagic(p, c);   // alchemagic: a second normal order adds its cost and its effect
      this.cur = { iid: c.iid, p, cost: false };
      if (d.orderKind === 'set') this.move(c.iid, 'order', { reason: 'play' });
      else if (d.music) this.putMusic(c.iid); else this.move(c.iid, 'trigger', { reason: 'play', silent: true });
      const after = c.pf && c.pf.t === this.turnNo ? c.pf.after : d.afterPlay;   // "when it would be put into drop after being played, put it … instead"
      if (alc) this.alcNow = true;
      try { if (d.play.run) yield* d.play.run(this, c, {}, ctx); if (alc) { const d2 = this.def(this.cards[alc.iid]); this.cur = { iid: alc.iid, p, cost: false }; if (d2.play && d2.play.run) yield* d2.play.run(this, this.cards[alc.iid], {}, { paid: alc.paid }); } } finally { this.alcNow = false; }
      if (c.zone === 'trigger') { if (after === 'bottom') this.move(c.iid, 'deck', { bottom: true, reason: 'played' }); else this.move(c.iid, after || 'drop', { reason: 'played' }); }
    } finally { this.cur = prev; }
    this.emit('playOrder', { p, iid: c.iid, kind: (d.orderKind || 'normal')[0], from: c.playedFrom, alc: !!c.alcT && c.alcT === this.turnNo });
    if (d.ticket) this.emit('ticketPlayed', { p, iid: c.iid, name: d.name });
  }
  *mainPhase(p) {
    const P = this.players[p];
    for (;;) {
      const opts = this.mainOptions(p);
      const [o] = yield* this.ask({ player: p, kind: 'main', title: 'เมนเฟส', options: opts, noAuto: true, man: true });
      if (o.a === 'man') { yield* this.manual(p, o.m); continue; }
      if (o.a === 'next') return;
      if (o.a === 'call') {
        const c = this.cards[o.iid]; const plan = this.odPlan(p, c, o.circle); let done = false;
        if (plan) {
          const ex = this.at(p, o.circle);
          const y = yield* this.yesNo(p, { title: (plan.x ? 'X-overDress ' : 'overDress ') + this.name(c) + ' ทับ ' + this.name(ex) + '?', sub: 'ใบที่ถูกทับจะกลายเป็น originalDress ของยูนิทนี้ (ไม่ถูกรีไทร์) · เลือก "คอลทับปกติ" เพื่อรีไทร์ใบเดิมตามปกติ', iid: o.iid, options: [{ id: 'yes', label: plan.x ? 'X-overDress' : 'overDress' }, { id: 'no', label: 'คอลทับปกติ' }] });
          if (y) {
            let mats = plan.sets[0];
            if (plan.sets.length > 1) {
              const pool = [...new Set(plan.sets.flat())].filter(i => i !== ex.iid); const sizes = plan.sets.map(x => x.length - 1);
              const sel = yield* this.chooseCards(p, pool, { min: Math.min(...sizes), max: Math.max(...sizes), title: 'เลือกยูนิทอื่นที่จะซ้อนเป็น originalDress ด้วย', zone: 'field' });
              const key = [ex.iid].concat(sel).sort((a, b) => a - b).join(','); mats = plan.sets.find(x => x.slice().sort((a, b) => a - b).join(',') === key) || plan.sets[0];
            }
            this.overDress(o.iid, o.circle, mats, plan.x); done = true;
          }
        }
        if (!done && o.eg) { const ex = this.at(p, o.circle); this.pendBS = c.iid; const ok = ex && this.toGauge(ex.iid, 'growth', c.iid, false, { reason: 'call' }); this.pendBS = null; if (ok) { this.log('Explosive Growth! ' + this.name(c), p); this.placeRC(o.iid, o.circle, { reason: 'call', extra: { od: 'e' } }); this.tlog({ k: 'eg', iid: c.iid, p }); done = true; } }
        if (!done) { const d0 = this.def(c); if (d0.callCost || d0.callOnTop) yield* this.payCall(p, c, o.circle); this.log('คอล ' + this.name(c), p); this.placeRC(o.iid, o.circle, { reason: 'call', extra: { normal: true } }); }
      }
      else if (o.a === 'move') {
        const [f, b] = o.row ? o.row : o.col === 'L' ? ['FL', 'BL'] : ['FR', 'BR'];
        const cf = P.circles[f], cb = P.circles[b];
        P.circles[f] = cb; P.circles[b] = cf;
        if (cf) this.cards[cf].pos = b; if (cb) this.cards[cb].pos = f;
        this.ev('swap', { p, col: o.col }); if (cf) this.shifted(cf); if (cb) this.shifted(cb);
      } else if (o.a === 'act') yield* this.useAbility(this.cards[o.iid], o.idx, {});
      else if (o.a === 'order') yield* this.playOrder(p, this.cards[o.iid]);
      else if (o.a === 'varm') yield* this.playVolundr(p, this.cards[o.iid]);
      yield* this.checkTiming();
    }
  }

  /* ----- battle ----- */
  attackOptions(p) {
    const opts = [];
    for (const k of ['FL', 'V', 'FR', 'BL', 'BC', 'BR']) {
      const c = this.at(p, k);
      if (!c || c.locked || c.rest) continue;
      const st = this.stat(c); if (st.cantAttack || (BACK.includes(k) && !(st.backAtk || st.backAtkRG || st.backAtkV3 || (k === 'BC' && st.backAtkC)))) continue;
      if (this.turnNo === 1 && !(this.tf.t1atk || []).includes(c.iid)) continue;
      if (st.atk3 && (c.atk || 0) >= 3) continue;
      if (this.atkTax() && (this.battleNo || 0) + 1 >= 4 && !this.handFor(p).length) continue;   // "can attack up to three times"   // nobody attacks in the first turn, unless a skill says so
      const colBack = !st.atkBack && this.rcs(p).some(u => FRONT.includes(u.pos) && !u.locked && this.def(u).atkBackCol);
      for (const t of (st.atkBack || colBack ? FRONT.concat(BACK) : FRONT)) {
        const tc = this.at(1 - p, t); if (!tc || tc.locked) continue; if (!st.atkBack && BACK.includes(t) && COLOF[t] !== COLOF[k]) continue;
        if (tc.zone === 'VC' && (st.cantAtkVG || (BACK.includes(k) && !st.backAtk && !(k === 'BC' && st.backAtkC) && !(st.backAtkV3 && this.grade(tc) >= 3)))) continue;
        if (tc.zone === 'RC' && BACK.includes(k) && !st.backAtk && !(k === 'BC' && st.backAtkC) && !st.backAtkRG) continue;
        const ts = this.stat(tc); if (ts.cantBeAtk || (ts.noAtkByRG && c.zone === 'RC')) continue;
        opts.push({ a: 'attack', iid: c.iid, target: tc.iid });
      }
    }
    opts.push({ a: 'end' });
    return opts;
  }
  battlePower() {
    const b = this.battle; const a = this.cards[b.attacker];
    if (!isField(a.zone)) return 0;
    let pw = this.stat(a).power;
    if (b.booster) { const bc = this.cards[b.booster]; if (bc.zone === 'RC' && !bc.locked) pw += this.stat(bc).power; }
    if (a.zone === 'VC' && a.pos === 'V' && b.mate != null && this.cards[b.mate] && this.cards[b.mate].zone === 'VC') pw += this.stat(this.cards[b.mate]).power;   // D-legion: the leader and the mate attack together (powers added)
    return pw;
  }
  /* shield this card would give as a guardian right now (printed shield + its own "while on GC" bonuses) */
  guardShield(c) {
    if (c.zone === 'GC') return this.stat(c).shield;
    let sh = this.stat(c).shield;
    for (const { ab } of this.abs(c)) if (ab.type === 'cont' && (ab.zone === 'GC' || (Array.isArray(ab.zone) && ab.zone.includes('GC'))) && ab.mod && (!ab.cond || ab.cond(this, c))) sh += (typeof ab.mod === 'function' ? ab.mod(this, c) : ab.mod).shield || 0;
    return sh;
  }
  defensePower(t) {
    let pw = this.stat(t).power;
    for (const i of this.players[t.owner].GC) pw += this.stat(this.cards[i]).shield;
    return pw;
  }
  guardOptions(dp) {
    const b = this.battle, P = this.players[dp]; const g = this.grade(this.vg(dp)); const opts = [];
    const as = this.stat(this.cards[b.attacker]); const g0only = !!as.g0guard;   // "your opponent cannot call grade 1 or greater cards from hand to (GC)"; also: no cards at all / no sentinels / no normal units / no trigger units from hand
    const vgn = this.vg(dp) ? this.def(this.vg(dp)).name : '';
    const bar = d => (d.mateVg && !vgn.includes(d.mateVg)) || as.noHandGuard || (g0only && d.grade >= 1) || (as.noSentGuard && d.sentinel) || (as.noNuGuard && !d.trigger) || (as.noTrigGuard && d.trigger) || !!(this.battle && this.battle.noGuardGr && this.battle.noGuardGr.includes(d.grade));   // "cannot call cards with the same grade as … to (GC)"
    for (const i of P.hand) { const c = this.cards[i], d = this.def(c); if ((d.type === 'unit' && this.grade(c) <= g && !bar(d))
 || (d.type === 'order' && d.orderGuard != null && !as.noHandGuard)) opts.push({ a: 'guard', iid: i }); else if (d.type === 'order' && d.orderKind === 'blitz' && !as.noBlitzG && this.canPlayOrder(dp, c)) opts.push({ a: 'blitz', iid: i }); }
    const noInt = P.effects.some(e => e.noInt) || !!as.noIntercept || this.frozenA(b.p) || this.hasFlag(b.p, 'noIntAll') ||
 !!(b.booster && this.cards[b.booster] && this.cards[b.booster].zone === 'RC' && this.stat(this.cards[b.booster]).noIntercept);
    for (const k of ['FL', 'FR', 'BL', 'BC', 'BR']) {
      const c = this.at(dp, k);
      if (!c || c.locked || noInt || b.targets.includes(c.iid)) continue;
      const s = this.stat(c); if (s.intercept && !s.cantIntercept && (!BACK.includes(k) || s.backInt)) opts.push({ a: 'intercept', iid: c.iid });
    }
    return opts;
  }
  *battlePhase(p) {
    for (;;) {
      this.emit('attackStep', { p }); yield* this.checkTiming();
      const opts = this.attackOptions(p);
      if (opts.length === 1) return;
      const [o] = yield* this.ask({ player: p, kind: 'attack', title: 'แบทเทิลเฟส — เลือกยูนิทโจมตีและเป้าหมาย', options: opts, noAuto: true, man: true });
      if (o.a === 'man') { yield* this.manual(p, o.m); continue; }
      if (o.a === 'end') return;
      yield* this.doBattle(p, o.iid, o.target);
    }
  }
  /* 'nb' = the attacker has a "when this unit attacks while not boosted" skill that boosts it with several units; 'mb' = a multi-boost skill on attack; null = none (or already used this turn) */
  selfBoostSkill(a) {
    const abs = this.def(a).abilities || []; for (let idx = 0; idx < abs.length; idx++) { const ab = abs[idx]; const x = ab.src; if (!x || ab.type !== 'auto' || !x.on || x.on.e !== 'atk' || !JSON.stringify(x.d || []).includes('"mboost"')) continue; if (!this.limitOk(a, idx, ab)) continue; return x.on.bo === 0 ? 'nb' : 'mb'; }
    return null;
  }
  *doBattle(p, aiid, tiid) {
    const a = this.cards[aiid], t = this.cards[tiid];
    let booster = null;
    if (a.owner === p && (a.zone === 'RC' || a.zone === 'VC')) {   // a dominated unit (owned by the opponent) is never boosted
      const bc = this.at(p, BEHIND[a.pos]);
      if (bc && !bc.locked && !bc.rest && this.stat(bc).boost && !this.stat(bc).cantBoost && FRONT.includes(a.pos) && !this.stat(a).noBoosted) {

        const mb = this.selfBoostSkill(a);   // the attacker's own "when this unit attacks (while not boosted), boost it with all your back row units": a normal boost first would spoil it
        const y = yield* this.yesNo(p, Object.assign({ kind: 'boost', title: 'บูสต์ด้วย ' + this.name(bc) + '?', iid: bc.iid, attacker: aiid, options: [{ id: 'yes', label: 'บูสต์' }, { id: 'no', label: mb ? 'ไม่บูสต์ (ใช้สกิลบูสต์ของ ' + this.name(a) + ')' : 'ไม่บูสต์' }] }, mb ? { prefer: 'no', sub: 'แนะนำ "ไม่บูสต์": ' + this.name(a) + ' มีสกิลบูสต์ด้วยยูนิทแถวหลังหลายใบพร้อมกันตอนโจมตี' + (mb === 'nb' ? ' (ใช้ได้เฉพาะตอนไม่ถูกบูสต์)' : ' (ใบที่บูสต์ตามปกติไม่นับรวม)') } : {}));
        if (y) booster = bc.iid;
      }
    }
    if (!booster && a.owner === p && (a.zone === 'RC' || a.zone === 'VC') && FRONT.includes(a.pos) && !this.stat(a).noBoosted) for (const u of this.rcs(p)) {   // "can boost a unit of another column"
      if (u.iid === aiid || u.rest || u.locked || !BACK.includes(u.pos) || u.pos === BEHIND[a.pos]) continue; const su = this.stat(u); if (!su.boostAny || !su.boost || su.cantBoost) continue;
      const y = yield* this.yesNo(p, { kind: 'boost', title: 'บูสต์ด้วย ' + this.name(u) + ' (ข้ามแถว)?', iid: u.iid, attacker: aiid, options: [{ id: 'yes', label: 'บูสต์' }, { id: 'no', label: 'ไม่บูสต์' }] }); if (y) { booster = u.iid; break; }
    }
    if (this.atkTax() && (this.battleNo || 0) + 1 >= 4) { const H = this.handFor(p); const [di] = yield* this.chooseCards(p, H, { min: 1, max: 1, title: 'แบทเทิลที่ 4 ขึ้นไป: ทิ้งการ์ด 1 ใบเพื่อโจมตี', hint: 'discard', zone: 'hand' }); if (di != null) this.move(di, 'drop', { reason: 'discard' }); }
    a.rest = !this.stat(a).atk3; a.atk = (a.atk || 0) + 1; this.battleNo = (this.battleNo || 0) + 1;

    this.battle = { p, attacker: aiid, booster, targets: [tiid], targetZone: t.zone, hit: false, guards: 0 };
    if (this.stat(a).atkPlus2) {   // "choose two of your opponent's (RC): battles the units there and the vanguard"
      const pool = this.rcs(1 - p).map(u => u.iid).filter(i => i !== tiid);
      const sel = pool.length ? yield* this.chooseCards(p, pool, { min: 0, max: 2, title: 'เลือกเรียร์การ์ดคู่ต่อสู้ที่จะสู้ด้วยพร้อมกัน (สูงสุด 2 ใบ)', hint: 'retireOpp', zone: 'field', noAuto: true }) : [];
      const v = this.vg(1 - p).iid; this.battle.targets = [...new Set([v].concat(t.zone === 'RC' ? [tiid] : [], sel))]; this.battle.targetZone = 'VC';
    }
    if (this.stat(a).atkVG1f) {   // picks one enemy front-row circle: battles the vanguard and the units there
      const pool = this.rcs(1 - p).filter(u => FRONT.includes(u.pos)).map(u => u.iid); const sel = pool.length ? yield* this.chooseCards(p, pool, { min: 0, max: 1, title: 'เลือกเรียร์การ์ดแถวหน้าของคู่ต่อสู้ที่จะสู้พร้อมกับแวนการ์ด', hint: 'retireOpp', zone: 'field', noAuto: true }) : [];
      const v = this.vg(1 - p).iid; this.battle.targets = [...new Set([v].concat(sel))]; this.battle.targetZone = 'VC';
    }
    if (this.stat(a).atk3) {   // "choose three of your opponent's (VC) or (RC): battles all the units there"
      const pool = this.units(1 - p).map(u => u.iid).filter(i => i !== tiid);
      const sel = pool.length ? yield* this.chooseCards(p, pool, { min: 0, max: 2, title: 'เลือกยูนิทคู่ต่อสู้ที่จะสู้ด้วยพร้อมกันอีก (สูงสุด 2 ใบ)', hint: 'retireOpp', zone: 'field', noAuto: true }) : [];
      const v = this.vg(1 - p).iid; this.battle.targets = [...new Set([tiid].concat(sel))]; if (this.battle.targets.includes(v)) { this.battle.targets = [v].concat(this.battle.targets.filter(i => i !== v)); this.battle.targetZone = 'VC'; }
    }
    if (a.zone === 'VC') { const more = this.rcs(1 - p).filter(u => this.stat(u).alsoHitByVG).map(u => u.iid); if (more.length) this.battle.targets = [...new Set(this.battle.targets.concat(more))]; }
    if (this.stat(a).atkCol || (this.stat(a).atkColRG && t.zone === 'RC')) { const col = COLOF[t.pos]; const all = this.units(1 - p).filter(u => COLOF[u.pos] === col).map(u => u.iid); if (all.length) this.battle.targets = [tiid].concat(all.filter(i => i !== tiid)); }   // battles every unit of that column
    if (this.stat(a).atkVGplusG2 && t.zone === 'VC') { const more = this.rcs(1 - p).filter(u => this.grade(u) >= 2).map(u => u.iid); if (more.length) this.battle.targets = [tiid].concat(more); }
    if (this.stat(a).atkFrontRG && t.zone === 'RC') {
 const all = this.front(1 - p).filter(u => u.zone === 'RC').map(u => u.iid); if (all.length) this.battle.targets = [tiid].concat(all.filter(i => i !== tiid)); }
    if (a.xtPos && a.xtT === this.turnNo && this.cards[tiid] && this.cards[tiid].zone === 'VC') { const u = this.at(1 - p, a.xtPos); if (u && u.iid !== tiid) this.battle.targets = [tiid, u.iid]; }
    if (this.stat(a).atkAllRG && this.cards[tiid] && this.cards[tiid].zone === 'RC') { const all = this.rcs(1 - p).map(u => u.iid); this.battle.targets = [tiid].concat(all.filter(i => i !== tiid)); }   // attacking a rear-guard: battles every rear-guard
    if (this.stat(a).atkAll) { const all = this.units(1 - p).filter(u => u).map(u => u.iid); if (all.length) this.battle.targets = [tiid].concat(all.filter(i => i !== tiid)); }   // battles every unit of the opponent
    if (this.stat(a).atkAllFront) { const all = this.front(1 - p).map(u => u.iid); if (all.length) this.battle.targets = [tiid].concat(all.filter(i => i !== tiid)); }   // battles every front-row unit of the opponent
    if (booster) this.cards[booster].rest = true;
    { const P0 = this.players[p]; if (a.zone === 'VC' && a.pos === 'V' && P0.circles.V2) { this.battle.mate = P0.circles.V2; this.cards[P0.circles.V2].rest = true; } }   // D-legion: both rest
    this.ev('attack', { p, attacker: aiid, target: tiid, booster });
    this.log(this.name(a) + ' โจมตี ' + this.name(t) + (booster ? ' (บูสต์โดย ' + this.name(this.cards[booster]) + ')' : ''), p);
    if (a.ngg && a.ngg.t === this.turnNo) this.battle.noGuardGr = (this.battle.noGuardGr || []).concat(a.ngg.g);
    this.tlog({ k: 'atk', dom: !!a.dom, iid: aiid, no: a.no, p, target: tiid, tz: t.zone, az: a.zone, pos: a.pos, boosted: !!booster, booster, pw: this.stat(a).power });
    this.emit('attack', { iid: aiid, target: tiid, targetZone: t.zone, p });
    if (this.battle.mate != null && this.cards[this.battle.mate]) { const m = this.cards[this.battle.mate]; m.atk = (m.atk || 0) + 1; this.emit('attack', { iid: m.iid, target: tiid, targetZone: t.zone, p, mate: true }); }   // D-legion: the mate attacks together with the leader
    if (booster) { this.emit('boost', { iid: booster, attacker: aiid, p }); this.emit('boosted', { iid: aiid, booster, p }); }
    yield* this.checkTiming();
    yield* this.guardStep();
    // drive step
    this.emit('driveStep', { iid: aiid, p }); yield* this.checkTiming();
    const rearDrive = a.zone === 'RC' && (this.players[p].effects.some(e => e.rearDrive) || this.stat(a).rgDrive);
    if (a.zone === 'VC' || rearDrive) {
      let n = this.stat(a).drive;   // a rear-guard that performs drive checks uses its own drive too
      for (let i = 0; i < n; i++) {
        yield* this.triggerCheck(p, 'drive');
        if (a.zone === 'VC') n = Math.max(n, this.stat(a).drive); else if (a.zone !== 'RC') break;
      }
    }
    // damage step
    const dp = 1 - p;
    for (const ti of this.battle.targets) {
      const tc = this.cards[ti];
      if (!isField(tc.zone) || tc.zone === 'GC' || !isField(a.zone)) continue;
      const atk = this.battlePower(), dfn = this.defensePower(tc);
      const sa = this.stat(a), gcs = this.players[1 - p].GC.map(i => this.cards[i]);
      const hitAny = (sa.hitUnlessSh && gcs.reduce((n, g) => n + this.guardShield(g), 0) < sa.hitUnlessSh) || (sa.hitUnlessGr && gcs.reduce((n, g) => n + this.grade(g), 0) < sa.hitUnlessGr);   // "will hit regardless of [Power] if the sum of your opponent's guardians' shield / grades is not N or greater"
      const hit = (atk >= dfn || hitAny) && !this.stat(tc).cantBeHit;
      this.ev('result', { attacker: aiid, target: ti, atk, dfn, hit });
      if (!hit) { this.log('โจมตีไม่โดน (' + fmt(atk) + ' ต่อ ' + fmt(dfn) + ')', p); continue; }
      this.log('โจมตีโดน! (' + fmt(atk) + ' ต่อ ' + fmt(dfn) + ')', p);
      if (tc.zone === 'VC') {
        const crit = this.stat(a).crit;
        for (let i = 0; i < crit; i++) yield* this.triggerCheck(dp, 'damage');
      } else if (this.stat(a).hitBind) { this.log(this.name(tc) + ' ถูกไบนด์แทนการรีไทร์', p); this.move(ti, 'bind', { reason: 'effect' }); }   // "when a rear-guard hit by this unit would be retired, bind it instead"
      else if (this.stat(this.cards[ti]).noHitRet) this.log(this.name(this.cards[ti]) + ' ถูกโจมตีโดนแต่ไม่ถูกรีไทร์', this.cards[ti].owner);
      else if (!(yield* this.wouldLeave(ti))) this.retire(ti, 'battle');
      this.battle.hit = true; if (this.battle.targetZone === 'VC') this.tf['vhit' + dp] = 1;
      this.tlog({ k: 'hit', dom: !!a.dom, iid: aiid, no: a.no, p, tz: this.battle.targetZone, az: a.zone });
      this.emit('hit', { iid: aiid, target: ti, targetZone: this.battle.targetZone, booster: this.battle.booster, p });
    }
    yield* this.checkTiming();
    // close step
    this.emit('battleEnd', { attacker: aiid, booster, targets: this.battle.targets, target: tiid, targetZone: this.battle.targetZone, hit: this.battle.hit, checks: this.battle.checks || [], p });
    // granted "stand this unit at the end of the battle it attacked (1/turn)"
    { const m = a.zone === 'RC' && a.rest ? a.mods.find(x => x.restand && !x.used) : null; if (m) { m.used = true; a.rest = false; this.ev('stand', { p }); this.log(this.name(a) + ' กลับมาสแตนด์', p); } }
    yield* this.checkTiming();
    yield* this.runLaters('b');
    for (const i of this.players[dp].GC.slice()) { if (this.cards[i].mods.length && this.cards[i].mods.some(m => m.gcSoul)) { this.move(i, 'soul', { reason: 'effect' }); continue; } if (this.cards[i].mods.length && this.cards[i].mods.some(m => m.gcBindFd)) { this.move(i, 'bindfd', { reason: 'effect' }); continue; } if (this.cards[i].mods.length && this.cards[i].mods.some(m => m.gcBind)) { this.move(i, 'bind', { reason: 'effect' }); continue; }   // "when this unit would be retired from (GC), put it into soul instead"
      if (this.def(this.cards[i]).sentinel && this.stat(this.vg(1 - dp)).sentBind) { this.log(this.name(this.cards[i]) + ' ถูกไบนด์แทนการรีไทร์จาก GC', dp); this.move(i, 'bind', { reason: 'effect' }); } else this.move(i, 'drop', { reason: 'guardEnd' }); }   // sentBind: "your opponent's sentinel is bound instead of retired from (GC)"
    this.expire('battle');
    this.battle = null;
    this.ev('battleEnd', {});
    yield* this.checkTiming();
  }
  *guardStep() {
    const b = this.battle, dp = 1 - b.p;
    this.emit('guardStart', { p: b.p, iid: b.attacker, target: b.targets[0], targetZone: b.targetZone }); yield* this.checkTiming();
    let first = true, more = false;   // more: a ticket came to hand during this guard step — it may still be played although the attack no longer hits
    const tickets = () => this.players[dp].hand.filter(i => this.cards[i].ticket).length;
    for (;;) {
      const t = this.cards[b.targets[0]];
      if (!t || !isField(t.zone) || !isField(this.cards[b.attacker].zone)) return;
      const opts = this.guardOptions(dp);
      if (!opts.length) return;
      const atk = this.battlePower(), dfn = this.defensePower(t);
      const safe = atk < dfn || !!this.stat(t).cantBeHit;
      if (more && !opts.some(o => o.a === 'blitz' && this.cards[o.iid].ticket)) more = false;
      if (!first && safe && !more) return;
      const handMin = Math.max(this.stat(this.cards[b.attacker]).guardMin || 0, ...this.players[dp].effects.map(e => e.guardMin || 0), 0); const asg = this.stat(this.cards[b.attacker]); const handNs = !!(asg.guardNs || this.players[dp].effects.some(e => e.guardNs)); const handDg = !!(asg.guardDg || this.players[dp].effects.some(e => e.guardDg));
      const sel = yield* this.ask({ player: dp, kind: 'guard', title: first ? 'การ์ดสเต็ป — เลือกการ์ดเดี้ยน' : safe ? 'ได้ทิกเก็ตขึ้นมือ — เพลย์ต่อในการ์ดสเต็ปนี้?' : 'ยังโดนโจมตีอยู่ — เพิ่มการ์ดเดี้ยน?', options: opts, min: 0, max: opts.length, atk, dfn, target: t.iid, attacker: b.attacker, handMin, handNs, handDg, noAuto: true, man: true });
      if (sel.length === 1 && sel[0].a === 'man') { yield* this.manual(dp, sel[0].m); continue; }
      if (!sel.length) return;
      const tk0 = tickets();
      for (const o of sel) if (o.a === 'blitz' && this.canPlayOrder(dp, this.cards[o.iid])) { yield* this.playOrder(dp, this.cards[o.iid]); yield* this.checkTiming(); }
      for (const o of sel) { if (o.a === 'blitz' || !isField(t.zone)) continue; this.log((o.a === 'intercept' ? 'อินเตอร์เซปต์ด้วย ' : 'การ์ดด้วย ') + this.name(this.cards[o.iid]), dp); this.battle.guards++; const fromPos = this.cards[o.iid].zone === 'RC' ? this.cards[o.iid].pos : null; this.move(o.iid, 'GC', { reason: o.a, extra: { batch: sel.filter(x => x.a === 'guard').length, gfirst: first ? 1 : 0 } }); if (fromPos) yield* this.gcWith(o.iid, fromPos); }
      yield* this.checkTiming();
      first = false; more = tickets() > tk0;
    }
  }
  /* "when this unit would be moved to (GC), you may move rear-guards with … in the same column to (GC) at the same time" (def.gcWith = { f, ok }) */
  *gcWith(iid, pos) { const c = this.cards[iid]; const d = this.def(c); if (!d.gcWith || !d.gcWith.ok(this, c)) return; const col = COLOF[pos];
    const L = this.rcs(c.owner).filter(u => COLOF[u.pos] === col && !u.locked && VG.fx.mf(this, c, u, d.gcWith.f)).map(u => u.iid); if (!L.length) return;
    const sel = yield* this.chooseCards(c.owner, L, { min: 0, max: L.length, title: 'ย้ายเรียร์การ์ดในแถวตั้งเดียวกันไป GC พร้อมกันด้วยไหม?', zone: 'field', hint: 'guard', noAuto: true });
    for (const i of sel) { this.battle.guards++; this.move(i, 'GC', { reason: 'intercept' }); } }
  nationOk(p, d) { return !d.nation || this.units(p).some(u => this.def(u).nation === d.nation); }
  *triggerCheck(p, kind) {
    const P = this.players[p];
    if (!P.deck.length) this.lose(p, 'deck');
    { const at = this.battle && this.cards[this.battle.attacker]; if (kind === 'drive' && at && at.owner === p && P.deck.length >= 2 && this.stat(at).dcLook2) { const top2 = P.deck.slice(0, 2); const [ch] = yield* this.chooseCards(p, top2, { min: 1, max: 1, title: 'ดูการ์ด 2 ใบบนสุด: เลือกใบที่จะนำไปทริกเกอร์โซน (ที่เหลือไว้ล่างสุดของเด็ค)', zone: 'deck', hint: 'search', noAuto: true }); for (const i of top2) if (i !== ch) this.move(i, 'deck', { bottom: true, silent: true }); } }   // dcLook2: look at the top two, choose the one to check, the rest to the bottom
    const iid = P.deck[0]; const c = this.cards[iid], d = this.def(c);
    this.move(iid, 'trigger', { reason: kind + 'Check' });
    this.ev('check', { p, iid, kind, trigger: d.trigger || null, no: c.no });
    this.log((kind === 'drive' ? 'ไดรฟ์เช็ค: ' : 'ดาเมจเช็ค: ') + d.name + (d.trigger ? ' — ' + TRIG_TH[d.trigger] + '!' : ''), p);
    if (d.trigger) this.tf['trig' + p] = 1;
    this.tlog({ k: 'chk', iid, no: c.no, p, kind, trigger: d.trigger || null, az: this.battle && this.cards[this.battle.attacker] ? this.cards[this.battle.attacker].zone : null });
    if (d.trigger && this.rcs(p).some(u => this.stat(u).trigNuP)) this.log('ทริกเกอร์ยูนิทในเด็คถือเป็นนอร์มอลยูนิท ทริกเกอร์ไม่ทำงาน', p);
    else if (d.trigger && this.nationOk(p, d)) { const prev = this.cur; this.cur = { iid, p, cost: false, trig: true }; try { yield* this.applyTrigger(p, c, kind); const at = this.battle && this.cards[this.battle.attacker]; if (kind === 'drive' && at && at.owner === p && this.stat(at).trigX2) { this.log('ทริกเกอร์ทำงานซ้ำอีกครั้ง', p); yield* this.applyTrigger(p, c, kind); } } finally { this.cur = prev; } }   // trigX2: "your trigger effects activate twice"
    if (kind === 'drive' && this.battle) (this.battle.checks = this.battle.checks || []).push(iid);
    this.emit('dcheck', { p, iid, kind, trigger: d.trigger || null });
    yield* this.checkTiming();
    if (c.zone === 'trigger') { const at = kind === 'drive' && this.battle && this.cards[this.battle.attacker]; if (kind === 'drive' && at && this.stat(at).driveBottom) this.move(iid, 'deck', { bottom: true, reason: kind }); else this.move(iid, kind === 'drive' ? (at && at.zone === 'RC' && this.stat(at).driveToSoul ? 'soul' : 'hand') : 'damage', { reason: kind }); }   // driveToSoul: an astral plane unit's drive checks go to soul
    this.ruleCheck();
  }
  trigShare(p, u, mod) { const x = this.cards[u]; if (x && x.zone === 'RC' && this.stat(x).trigToVG && this.vg(p)) this.addMod(this.vg(p).iid, Object.assign({}, mod), 'turn'); if (!x || x.zone !== 'VC') return; for (const r of this.rcs(p)) if (this.stat(r).vgTrig) this.addMod(r.iid, Object.assign({}, mod), 'turn'); }
  *applyTrigger(p, c, kind) {
    const d = this.def(c), t = d.trigger; const tset = this.players[p].effects.find(e => e.trigSet && e.icons.includes(t)); let bonus = tset ? tset.trigSet : d.triggerPower || 10000;   // "the power increase of trigger effects with that icon becomes +N"
    if (kind === 'drive' && t !== 'over') bonus += this.players[p].effects.reduce((n, e) => n + (e.trigPlus || 0), 0);
    if (t !== 'over') bonus += this.stat(this.vg(p)).trigPlus || 0;
    if (t !== 'over' && this.players[1 - p].bind.some(i => this.def(this.cards[i]).trigger === t) && (this.players[p].effects.some(e => e.noTrigPwB) || (this.vg(1 - p) && this.stat(this.vg(1 - p)).ominaB))) { bonus = 0; this.log('ทริกเกอร์นี้เพิ่มพลังไม่ได้ (ไอคอนเดียวกับการ์ดในไบนด์โซนของคู่ต่อสู้)', p); }   // "the power increase of trigger effects revealed for your drive checks gets +5000"
    const P = this.players[p], O = this.players[1 - p];
    let nullC = false;
    if (t === 'crit' && kind === 'drive') { const ne = P.effects.find(e => e.nullCrit != null && !e.used); if (ne) { ne.used = 1; const who = ne.nullCrit; const id = yield* this.chooseOption(who, 'เลือกเอฟเฟกต์ของคริติคอลทริกเกอร์ที่จะยกเลิก', [{ id: 'c', label: 'คริติคอล +1' }, { id: 'p', label: 'พลัง +' + bonus }], {}); if (id === 'c') { nullC = true; this.players[who].gabNulled = { crit: 1 }; } else { this.players[who].gabNulled = { power: bonus }; bonus = 0; } this.log('เอฟเฟกต์ทริกเกอร์ถูกยกเลิก: ' + (id === 'c' ? 'คริติคอล +1' : 'พลัง'), who); } }   // Gabwelius: the next critical trigger of the opponent's drive check loses one of its effects
    let secret = null;
    if (kind === 'drive' && t !== 'heal' && t !== 'over') for (const oi of O.order) { const oc = this.cards[oi]; if (!oc.faceup || !this.def(oc).secretSword) continue; const g = O.gauge.find(i => this.cards[i].gh === oi && this.cards[i].gk === 'bs' && !this.cards[i].faceup && this.def(this.cards[i]).trigger === t); if (g == null) continue; const y = yield* this.yesNo(1 - p, { title: 'หงายบัดดี้โซลของ ' + this.name(oc) + ' เพื่อยกเลิกการเพิ่มพลังของทริกเกอร์นี้?', iid: oi }); if (!y) continue; this.cards[g].faceup = true; bonus = 0; secret = t; this.log(this.name(oc) + ': ยกเลิกการเพิ่มพลังของทริกเกอร์', 1 - p); break; }   // Secret Sword, Lethal Formation
    if (secret === 'crit') { const v = this.vg(p); if (v) this.addMod(v.iid, { crit: -1 }, 'battle'); }
    if (secret === 'draw' && P.hand.length) { const [dc] = yield* this.chooseCards(p, P.hand.slice(), { min: 1, max: 1, title: 'เลือกการ์ดในมือ 1 ใบเพื่อทิ้ง', hint: 'discard', zone: 'hand' }); if (dc != null) this.move(dc, 'drop', { reason: 'discard' }); }
    if (secret === 'front') for (const u of this.front(p)) this.addMod(u.iid, { power: -10000 }, 'turn');
    if (t === 'over') {
      { const kg = this.rcs(p).find(u => FRONT.includes(u.pos) && !u.locked && this.def(u).overHand); if (kg && (yield* this.yesNo(p, { title: 'นำโอเวอร์ทริกเกอร์ขึ้นมือแทนการนำออกจากเกม?', iid: c.iid, options: [{ id: 'yes', label: 'ขึ้นมือ' }, { id: 'no', label: 'นำออก' }] }))) this.move(c.iid, 'hand', { reason: 'over' }); else this.move(c.iid, 'removed', { reason: 'over' }); }
      this.draw(p, 1);
      yield* this.givePower(p, 100000000, 'โอเวอร์ทริกเกอร์: เลือกยูนิทรับพลัง +100 ล้าน');
      if (kind === 'drive' && d.overEffect) { this.log('เอฟเฟกต์เพิ่มเติมของโอเวอร์ทริกเกอร์ทำงาน', p); yield* d.overEffect(this, p, c); }
      return;
    }
    if (t === 'crit' && !nullC) { const u = yield* this.chooseUnit(p, 'คริติคอลทริกเกอร์: เลือกยูนิทรับคริติคอล +1', { hint: 'crit' }); if (u) { this.addMod(u, { crit: 1, trig: 1 }, 'turn'); this.trigShare(p, u, { crit: 1, trig: 1 }); } }
    if (t === 'draw') this.draw(p, 1);
    if (kind === 'drive' && P.order.length) { const at = this.battle && this.cards[this.battle.attacker]; const o = at && at.zone === 'VC' && at.owner === p ? this.ozKey(p, 'ozTrig', d.name) : null; if (o && o.crit) { const u = yield* this.chooseUnit(p, d.name + ': เลือกยูนิทรับคริติคอล +' + o.crit, { hint: 'crit' }); if (u) this.addMod(u, { crit: o.crit, trig: 1 }, 'turn'); } }   // ozTrig: that card's trigger effect also gives critical
    if (t === 'front') { for (const u of this.front(p)) this.addMod(u.iid, { power: bonus, trig: 1 }, 'turn'); }
    else { const u = yield* this.chooseUnit(p, TRIG_TH[t] + ': เลือกยูนิทรับพลัง +' + bonus, { hint: 'buff' }); if (u) { this.addMod(u, { power: bonus, trig: 1 }, 'turn'); this.trigShare(p, u, { power: bonus, trig: 1 }); } }
    if (t === 'heal' && P.damage.length > 0 && P.damage.length >= O.damage.length) {
      const sel = yield* this.chooseCards(p, P.damage.slice(), { min: 1, max: 1, title: 'ฮีลทริกเกอร์: เลือกดาเมจ 1 ใบเพื่อฮีล', hint: 'heal', zone: 'damage' });
      if (sel[0]) { this.move(sel[0], 'drop', { reason: 'heal' }); this.log('ฮีลดาเมจ 1 ใบ', p); }
    }
    if (kind === 'drive' && d.type === 'unit') for (const i of P.drop.slice()) { const x = this.cards[i]; const ta = this.def(x).trigAdd; if (ta && ta.ok(this, x)) { this.log('เอฟเฟกต์ทริกเกอร์เพิ่มเติมจาก ' + this.name(x), p); yield* ta.run(this, x); } }   // a drop card gives drive-check trigger units an additional trigger effect
  }

  /* ----- driver ----- */
  start() { this.step(undefined); return this; }
  step(v) {
    try { const r = this.it.next(v); this.pending = r.done ? null : r.value; }
    catch (e) { if (e === GAME_OVER) this.pending = null; else throw e; }
  }
  validate(sel) {
    const d = this.pending;
    if (!d) return 'no pending decision';
    if (!Array.isArray(sel)) return 'answer must be an array';
    if (sel[0] === -1) return d.man ? this.manualErr(d.player, sel) : 'manual actions are not possible at this moment';
    if (sel.length < d.min || sel.length > d.max) return 'bad count';
    const seen = new Set();
    for (const i of sel) { if (!Number.isInteger(i) || i < 0 || i >= d.options.length || seen.has(i)) return 'bad index'; seen.add(i); }
    if (d.kind === 'guard') { const gb = this.guardBadSel(d, sel); if (gb) return gb; }
    return null;
  }
  answer(sel) {
    const err = this.validate(sel);
    if (err) throw new Error('invalid answer: ' + err);
    this.history.push(sel.slice());
    this.step(sel);
  }
  static replay(cfg, history) {
    const g = new Game(cfg).start();
    for (const h of history) { if (!g.pending) break; g.answer(h); }
    return g;
  }
}

const TRIG_TH = { crit: 'คริติคอลทริกเกอร์', draw: 'ดรอว์ทริกเกอร์', front: 'ฟรอนต์ทริกเกอร์', heal: 'ฮีลทริกเกอร์', over: 'โอเวอร์ทริกเกอร์' };
function fmt(n) { return n >= 100000000 ? Math.floor(n / 100000000) * 100 + 'M+' + (n % 100000000) : String(n); }
VG.TRIG_TH = TRIG_TH;
VG.fmt = fmt;
VG.Game = Game;
VG.isField = isField;
})(typeof globalThis !== 'undefined' ? globalThis : this);
