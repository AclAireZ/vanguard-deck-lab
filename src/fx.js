/* Compiled skills: turns the structured skill data stored with the card list into working abilities and a Thai description. */
(function (root) {
'use strict';
const jn = n => n;   // a card name inside a skill description: shown as the card shows it (English first)
const VG = root.VG; const { RCS, FRONT, BACK } = VG; const isField = VG.isField;
const ZN = { V: 'VC', R: 'RC', G: 'GC', VR: 'field', RG: ['RC', 'GC'], Rf: 'frontRC', Rb: 'backRC', Rc: 'bcRC', D: 'drop', S: 'soul', H: 'hand', O: 'order', B: 'bind', M: 'damage', X: 'removed', K: 'deck', C: 'crest', T: 'ride', Y: 'dress', Z: 'gauge', A: 'arms', MB: 'mbox', GZ: 'gzone', VO: ['VC', 'order'], SD: ['soul', 'drop'] };
const zn = z => (Array.isArray(z) ? z.map(x => ZN[x]) : ZN[z]);
const ZTH = { SD: 'โซล/ดรอป', VO: 'VC/ออเดอร์โซน', GZ: 'โซนท่าพิเศษ', MB: 'Monster BOX', Y: 'originalDress', Z: 'เกจโซน', A: 'VC (อาร์มอยู่)', V: 'VC', R: 'RC', G: 'GC', VR: 'VC/RC', RG: 'RC/GC', Rf: 'RC แถวหน้า', Rb: 'RC แถวหลัง', Rc: 'RC แถวหลังกลาง', D: 'ดรอป', S: 'โซล', H: 'มือ', O: 'ออเดอร์โซน', B: 'ไบนด์', M: 'ดาเมจโซน', X: 'นอกเกม', K: 'เด็ค', C: 'เครสต์โซน', T: 'ไรด์เด็ค' };
const ZONE_TH = { mbox: 'Monster BOX', memory: 'เมมโมรี่', gzone: 'G โซน', heart: 'ฮาร์ท', bs: 'บัดดี้โซลของการ์ดนี้', top: 'บนสุดของเด็ค', music: 'มิวสิกบน RC', arms: 'อาร์มบน VC', gauge: 'เกจ', prison: 'การ์ดที่ถูกขังในพริซัน', GC: 'GC', VC: 'VC', hand: 'มือ', drop: 'ดรอป', soul: 'โซล', damage: 'ดาเมจโซน', bind: 'ไบนด์โซน', order: 'ออเดอร์โซน', ride: 'ไรด์เด็ค', crest: 'เครสต์โซน', deck: 'เด็ค', looked: 'การ์ดที่ดู', RC: 'RC', removed: 'นอกเกม', top: 'บนสุดของเด็ค', bottom: 'ล่างสุดของเด็ค', tb: 'บนสุดหรือล่างสุดของเด็ค' };
const TOKENS = { 'shadow army': 'TOKEN/ShadowArmy', plant: 'TOKEN/Plant' };
/* a token by its name: the two built in, the extra ones of db.js (XTOK), or a token row of the card list */
/* clans of a card: its icon, or (cards that say so) the vanguard's clan while the vanguard has only that one */
function clansOf(G, c) { const d = G.def(c); if (d.clans && d.clans.length) return d.clans; if (d.clanIf && c.owner != null && G.players[c.owner]) { const v = G.vg(c.owner); const vc = v ? G.def(v).clans || [] : []; if (vc.length === 1 && vc[0] === d.clanIf) return [d.clanIf]; } return []; }
function tokNo(name) { const k = String(name).toLowerCase(); if (TOKENS[k]) return TOKENS[k]; if (VG.XTOK && VG.XTOK[k]) return 'TOKEN/x:' + k; const r = VG.DB.rows.find(x => x.t === 'X' && x.power != null && x.name.toLowerCase() === k); return r ? r.no : null; }
const GK = { bf: '', g: '', regress: 'Regress', automod: 'AutoMOD', plant: 'Plant', astral: 'Astral Plane', undercover: 'Undercover', charm: 'Protection Charm', arma: 'Arma', bs: 'Buddy Soul', scout: 'Scout (เบส)', station: 'Toy Hangar', attach: 'Attach', garden: 'Garden (Engage)', growth: 'Growth Factor' };
const gkTh = k => 'เกจ' + (GK[k] ? ' ' + GK[k] : '');
const gzHost = (ctx, h) => (h === 'me' || h === 1 ? ctx.me.iid : h === 'it' ? ctx.it[0] : h === 'h' ? ((ctx.v && ctx.v.$h) || [])[0] : typeof h === 'string' && h[0] === '$' ? ((ctx.v && ctx.v[h]) || [])[0] : null);
const gzDestTh = d => { const [a, kind, hs] = String(d).split(':'); return 'ไปเป็น' + gkTh(kind) + (hs === 'me' ? 'ของการ์ดนี้' : hs ? 'ของยูนิทที่เลือกไว้' : 'ของคุณ') + (a === 'gzfd' ? ' แบบคว่ำหน้า' : ''); };
const COL = { FL: 'L', BL: 'L', V: 'C', BC: 'C', FR: 'R', BR: 'R' };
/* same column: across the table the opponent's left column faces your right column */
const sameCol = (a, b) => { const x = COL[a.pos], y = COL[b.pos]; if (!x || !y) return false; return a.owner === b.owner ? x === y : (x === 'C' ? y === 'C' : x !== y && y !== 'C'); };
const DUR = { t: 'turn', b: 'battle', o: 'opp', f: 'fight', n: 'next' };
const DUR_TH = { n: 'จนจบเทิร์นถัดไปของคุณ', f: 'จนจบไฟท์นี้', t: 'จนจบเทิร์น', b: 'จนจบแบทเทิลนั้น', o: 'จนจบเทิร์นถัดไปของคู่ต่อสู้', c: '' };
const fmtN = n => (n >= 100000000 ? (n / 1000000) + ' ล้าน' : String(n));

function cmp(a, op, b) { return op === '>=' ? a >= b : op === '<=' ? a <= b : a === b; }
/* your World: decided by the World cards in your order zone (one → Dark Night, two or more → Abyssal Dark Night) */
function worldOf(G, p) { if (G.stat(G.vg(p)).worldSG) return 's'; const O = G.players[p].order; if (!O.length || !O.every(i => G.def(G.cards[i]).world)) return ''; return O.length === 1 ? 'd' : 'a'; }
const inState = (G, p, n) => G.players[p].effects.some(e => e.state === n);
/* ---------- matching ---------- */
function hasRace(d, rc) { return !!d.race && d.race.toLowerCase().split('/').some(x => x.trim() === rc); }
/* the parts of a ["vg", {...}] filter the vanguard check itself does not read (icon, clan, or, stand state, tag …), passed on to the card filter */
function vgX(f) { const x = {}; for (const k of ['ico', 'cln', 'or', 'st', 'gle', 'tag', 'na', 'ty', 'tr']) if (f[k] != null) x[k] = f[k]; return Object.keys(x).length ? x : null; }
const deckIf = (G, c, k) => c.zone === 'deck' && (k === 1 || (G.vg(c.owner) && G.def(G.vg(c.owner)).name.includes(k)));   // a card in the deck (being revealed / looked at) whose condition holds (1, or the vanguard's name contains k)
function mf(G, me, c, F) {
  if (!F) return true; const d = G.def(c);
  if (F.or && !F.or.some(x => mf(G, me, c, x))) return false;
  if (F.nnh && d.name.includes(F.nnh)) return false; if (F.nnh2 && d.name.includes(F.nnh2)) return false;
  if (F.rch && !(d.race || '').toLowerCase().includes(F.rch)) return false;
  if (F.nin && (F.nin === 'rc' ? G.rcs(c.owner).map(u => u.iid) : G.players[c.owner][F.nin]).some(i => i !== c.iid && G.def(G.cards[i]).name === d.name)) return false;   // no card of that name in the owner's zone
  if (F.inz && c.zone !== F.inz) return false; if (F.ngz && G.players[me.owner][F.ngz].some(i => i !== c.iid && (G.def(G.cards[i]).grade || 0) === (d.grade || 0))) return false;   // ngz: no card of that grade in my zone
  if (F.snz) { const P = G.players[me.owner]; const names = [].concat(F.snz).flatMap(z => (z === 'rc' ? G.rcs(me.owner).map(u => u.iid) : z === 'u' ? G.units(me.owner).map(u => u.iid) : P[z] || [])).filter(i => i !== c.iid).map(i => G.def(G.cards[i]).name); if (!names.includes(d.name)) return false; }   // same name as a card in my zone(s) (rc, u = all my units, or a zone list)
  if (F.pos && !F.pos.includes(c.pos)) return false;
  if (F.gpar != null && !(d.grade != null && d.grade % 2 === F.gpar)) return false;   // odd (1) / even (0) grade
  if (F.natk && G.battle && G.battle.targets.includes(c.iid)) return false; if (F.colt && !(G.battle && G.cards[G.battle.targets[0]] && sameCol(c, G.cards[G.battle.targets[0]]))) return false;
  if (F.ntlos && G.tl.some(e => e.k === 'mv' && e.p === me.owner && e.from === 'order' && e.to === 'soul' && VG.card(e.no) && VG.card(e.no).name === d.name)) return false;   // no card with the same name was put into soul from your order zone this turn
  if (F.pfrom && !(c.placed === G.turnNo && c.placedFrom === F.pfrom)) return false;
  if (F.snu && !G.units(me.owner).some(u => G.def(u).name === d.name && mf(G, me, u, F.snu === 1 ? null : F.snu))) return false;   // same card name as one of your units (matching a sub-filter)
  if (F.ncb && (c.chosen || []).some(x => x.t === G.turnNo && x.by === me.iid)) return false;   // not yet chosen by this card's ability this turn
  if (F.ntr && F.ntr.includes(d.trigger)) return false;
  if (F.gva != null && !(d.grade != null && d.grade >= G.grade(G.vg(me.owner)) + F.gva)) return false;   // grade at least my vanguard's + n
  if (F.pbyf && !(c.placed === G.turnNo && c.placedBy && c.placedBy.no && mfDef(G, me, VG.card(c.placedBy.no), F.pbyf))) return false;
  if (F.pby && !(c.placed === G.turnNo && c.placedBy && c.placedBy.p === me.owner && (F.pby !== 'v' || c.placedBy.vg))) return false;   // placed this turn by your (vanguard's) ability
  if (F.srv && !((d.race || '').toLowerCase().split('/').some(x => x.trim() && hasRace(G.def(G.vg(me.owner)), x.trim())))) return false;   // shares a race with your vanguard
  if (F.faceup != null && !!c.faceup !== !!F.faceup) return false;
  if (F.pw && !(isField(c.zone) && cmp(G.stat(c).power, F.pw[0], F.pw[1]))) return false;   // current power
  if (F.placed && c.placed !== G.turnNo) return false;
  if (F.kw && !(isField(c.zone) ? G.stat(c)[F.kw] : d[F.kw])) return false;                 // has boost / intercept …
  if (F.ng && d.grade != null && d.grade >= F.ng[0] && d.grade <= F.ng[1]) return false;
  if (F.nty && ((F.nty === 'tu' && d.trigger) || (F.nty === 'u' && (d.type === 'unit' || d.type === 'token')) || (F.nty === 'o' && d.type === 'order') || (F.nty === 'no' && d.type === 'order' && (d.orderKind || 'normal') === 'normal') || (F.nty === 'nu' && (d.type === 'unit' || d.type === 'token') && !d.trigger))) return false;
  if (F.stt && !G.hasState(c, F.stt)) return false;
  if (F.tru && !d.trigger) return false;
  if (F.gle && !(d.grade != null && d.grade <= G.grade(G.vg(1 - me.owner)))) return false;   // grade not above the opponent's vanguard
  const dg = d.dropG && c.zone === 'drop' && ev(G, mkCtx(c), ['vg', d.dropG.vg]) ? d.dropG.g : d.grade;
  if (F.g && !(dg != null && dg >= F.g[0] && dg <= F.g[1]) && !(d.g12Deck && deckIf(G, c, d.g12Deck) && F.g[0] <= 2 && F.g[1] >= 1) && !(d.sg0 && c.zone === 'soul' && me && me.zone === 'VC' && me.owner === c.owner && F.g[0] <= 0)) return false;   // def.sg0: in soul, may be chosen as grade 0 for your vanguard's ability   // "while revealed … also regarded as grade 1 and 2"
  const hn = c.heart != null && c.zone === 'VC' && G.cards[c.heart] ? G.def(G.cards[c.heart]).name : (G.aliasOf && (F.nm || F.nh) ? G.aliasOf(c) : null);   // a G unit has its heart's name too; a pickup gacha gives another name   // a G unit has its heart's name too
  if (F.nm && d.name !== F.nm && !(hn && [].concat(hn).includes(F.nm)) && d.as !== F.nm && d.as2 !== F.nm && !(c.asx && c.asx.t === G.turnNo && c.asx.name === F.nm)) return false;
  if (F.nh && !(d.name.includes(F.nh) || (F.nh2 && d.name.includes(F.nh2)) || (hn && [].concat(hn).some(h => h.includes(F.nh))))) return false;
  if (F.gu != null && !!d.gunit !== !!F.gu) return false;
  if (F.pug && !d.pug) return false; if (F.bud && !(d.type === 'unit' && G.players[c.owner].order.some(i => { const x = G.def(G.cards[i]); return x.type === 'unit' && x.name === d.name; }))) return false;   // a buddy monster: the unit chosen for the order zone, or a card with its name if (F.rv3 && !(d.rv3 && c.zone === 'hand')) return false; if (F.ssk && !(d.abilities || []).some(ab => ab.src && ab.src.on && ab.src.on.e === 'hit' && ab.src.on.tg && ab.src.on.tg.k === 'r' && JSON.stringify(ab.src.d || []).includes('"dmg"'))) return false;   // has spirit strike (hits a rear-guard → damage to the vanguard) if (F.evt && !d.event) return false;
  if (F.rty && !d.retry) return false;
  if (F.nrg && G.rcs(me.owner).some(u => u.iid !== c.iid && G.def(u).name === d.name)) return false;   // no rear-guard of mine has its name   // has the [Retry] ability
  if (F.egs && !(isField(c.zone) && G.gaugeOf(c.iid, 'growth').length)) return false;   // in the [Explosive Growth] state   // a pickup gacha card   // a G unit
  if (F.rc && !hasRace(d, F.rc) && !(F.rc === 'crimson moon' && d.cmDeck && deckIf(G, c, d.cmDeck)) && !(d.raceDeck && F.rc === d.raceDeck.rc && c.zone === 'deck' && ev(G, mkCtx(c), ['vg', d.raceDeck.vg]))) return false;   // "while revealed from deck … regarded as a crimson moon card"
  if (F.na && d.nation !== F.na && d.nation2 !== F.na) return false;
  if (F.dn && d.name === G.def(me).name) return false;
  if (F.dnv && d.name === G.def(G.vg(me.owner)).name) return false;
  if (F.gl && !d.glitter) return false;
  if (F.op && !cmp(d.power || 0, F.op[0], F.op[1])) return false;
  if (F.ty) {
    const unit = d.type === 'unit' || d.type === 'token' || (d.unitInDeck && c.zone === 'deck') || (d.nuDeck && c.zone === 'deck' && me && G.def(me).name.includes(d.nuDeck.by) && ev(G, mkCtx(c), ['vg', { nh: d.nuDeck.by }])), ord = d.type === 'order' || ((!!d.asSet || !!c.asSetX) && c.zone === 'order');
    if (F.ty === 'u' && !unit) return false; if (F.ty === 'nu' && !(unit && !d.trigger)) return false; if (F.ty === 'tu' && !(unit && (d.trigger || (c.mods && c.mods.some(m => m.asTU))))) return false;
    if (F.ty === 'o' && !ord) return false; if (F.ty === 'no' && !(ord && d.orderKind === 'normal')) return false; if (F.ty === 'so' && !(ord && (d.orderKind === 'set' || d.asSet || c.asSetX))) return false; if (F.ty === 'bo' && !(ord && d.orderKind === 'blitz')) return false;
  }
  if (F.tr && !F.tr.includes(d.trigger)) return false;
  if (F.sn && d.name !== G.def(me).name) return false;
  if (F.snv && d.name !== G.def(G.vg(me.owner)).name) return false;
  if (F.ns && d.sentinel) return false; if (F.sen && !d.sentinel) return false;
  if (F.nov && d.trigger === 'over') return false;
  if (F.nn && d.name === F.nn) return false;
  if (F.pr && !d.persona) return false;
  if (F.oda && !(d.od && (F.oda === 'ox' || (F.oda === 'x') === !!d.od.x))) return false;                      // has the overDress / X-overDress ability
  if (F.ods) { const n = (c.dress || []).length; if (!n || (F.ods === 'x' && !c.xod) || (F.ods === 'o' && c.xod)) return false; }   // is in the overDress / X-overDress state
  if (F.odn && (c.dress || []).length < F.odn) return false;
  if (F.mk && !(c.zone === 'RC' && G.markerCount(c.owner, c.pos, F.mk === 1 ? null : F.mk) > 0)) return false;                     // stands on a circle with the marker
  if (F.tag && !(d.tags || []).includes(F.tag)) return false;
  if (F.trn && !(c.training && c.zone === 'order')) return false;
  if (F.vol && !d.volundr) return false;   // a card conducting Training
  if (F.skmin != null) { const t = (d.tags || []).find(x => /^skill ?\d+$/i.test(x)); if (!t || +t.replace(/\D/g, '') < F.skmin) return false; }   // Mushi: "Skill N or greater"
  if (F.fin && !(d.tags || []).some(x => x.toLowerCase() === 'finishing attack:' + F.fin)) return false;   // Mushi: "Finishing Attack is …"
  if (F.sup && !(d.tags || []).some(x => x.toLowerCase() === 'super finishing attack:' + F.sup.toLowerCase())) return false;   // Mushi: "Super Finishing Attack is …"
  if (F.gnv && F.gnv.some(k => G.fxv && G.fxv[k] != null && (d.grade || 0) === G.fxv[k])) return false;   // grade different from the kept values
  if (F.gv && !(d.grade != null && d.grade <= G.grade(G.vg(me.owner)) - (F.gv === 2 ? 1 : 0))) return false;
  if (F.ot && c.iid === me.iid) return false;
  if (F.tk && !((c.token || (d.tokenAs && c.zone === 'RC')) && (F.tk === 1 || d.name.toLowerCase() === String(F.tk).toLowerCase() || d.tokenAs === String(F.tk).toLowerCase()))) return false;
  if (F.reg != null && !!d.regalis !== !!F.reg) return false; if (F.gvar && (d.grade || 0) !== ((G.fxv || {})[F.gvar] || 0)) return false; if (F.gvle && !((d.grade || 0) <= ((G.fxv || {})[F.gvle] || 0))) return false;
  if (F.dup && !d.as) return false;   // has the DressUp ability
  if (F.osh && !cmp(d.shield || 0, F.osh[0], F.osh[1])) return false;   // printed shield
  if (F.rd && !c.rd) return false; if (F.rfu != null && !!c.rfu !== !!F.rfu) return false;   // was in the ride deck / lies face up in the ride deck
  if (F.cln != null || F.cl1 || F.clsv) { const cs = clansOf(G, c);   // cln: 'name' = only that clan · 1 = has a clan icon · 0 = has none; cl1 = only one clan; clsv = only the same clan as my vanguard
    if (F.cln === 1 && !cs.length) return false; if (F.cln === 0 && cs.length) return false; if (typeof F.cln === 'string' && !(cs.length === 1 && cs[0] === F.cln.toLowerCase())) return false;
    if (F.cl1 && cs.length !== 1) return false;
    if (F.clsv) { const v = G.vg(me.owner); const vc = v ? clansOf(G, v) : []; if (!(vc.length === 1 && cs.length === 1 && cs[0] === vc[0])) return false; } }
  if (F.ico && d.icon !== F.ico) return false;   // has that character icon
  if (F.arm && !d.arms) return false; if (F.arml && !(d.arms && d.arms.s === 'L')) return false; if (F.armr && !(d.arms && d.arms.s === 'R')) return false;   // an arms card / left / right deity arms
  if (F.natkd && G.battle && G.battle.targets.includes(c.iid)) return false;   // is not being attacked
  if (F.hostme && c.iid !== me.gh) return false;
  if (F.bsx && (c.iid === me.iid || G.gaugeOf(c.iid, 'bs').some(i => G.def(G.cards[i]).name === G.def(me).name))) return false;   // another unit whose buddy soul has no card named as this card
  if (F.lnk && !(G.battle && (G.battle.link || []).includes(c.iid))) return false;   // in the link attack state
  if (F.bsn != null && G.gaugeOf(c.iid, 'bs').length < F.bsn) return false;   // has n+ cards in its buddy soul
  if (F.bsf && !G.gaugeOf(c.iid, 'bs').some(i => mf(G, me, G.cards[i], F.bsf))) return false;   // its buddy soul has a card matching                               // the unit this gauge card belongs to
  if (F.gk && !(c.zone === 'gauge' && (F.gk === 1 || c.gk === F.gk))) return false;   // is a gauge (of that kind)
  if (F.gh && !(c.zone === 'gauge' && c.gh === me.iid)) return false;                  // is a gauge of this card
  if (F.hgz && !G.players[c.owner].gauge.some(i => G.cards[i].gh === c.iid && (F.hgz === 1 || G.cards[i].gk === F.hgz))) return false;   // has a gauge (of that kind)
  if (F.nogz && G.players[c.owner].gauge.some(i => G.cards[i].gh === c.iid && (F.nogz === 1 || G.cards[i].gk === F.nogz))) return false;
  if (F.tkt && !c.ticket) return false; if (F.noab && d.abilities && d.abilities.length) return false;
  if (F.nsz) { const P2 = G.players[me.owner]; if ([].concat(F.nsz).some(z => (P2[z] || []).some(i => i !== c.iid && G.def(G.cards[i]).name === d.name))) return false; }   // no card of that name in any of my zones listed
  if (F.usd && !((d.tags || []).includes('unisondress') || G.hasState(c, 'unisondress'))) return false;   // in the UnisonDress state
  if (F.me && c.iid !== me.iid) return false; if (F.ovz && !G.oversized(c)) return false;
  if (F.frd && !((c.zone === 'VC' || c.zone === 'RC') && G.units(c.owner).some(u => u.iid !== c.iid && COL[u.pos] === COL[c.pos] && ((d.tags || []).includes('friend') || (G.def(u).tags || []).includes('friend'))))) return false;   // is "Friends": shares a column with another unit and one of the two has the friend ability
  if (F.unl && c.unlockT !== G.turnNo) return false;
  if (F.swl && !((d.tags || []).includes('sweetlink') && G.players[c.owner].soul.some(i => G.def(G.cards[i]).name === d.name))) return false;   // in the SweetLink state
  if (F.chby && !(c.chosen || []).some(x => x.t === G.turnNo && x.p === me.owner && choseOk(G, me, F.chby, x))) return false;   // chosen this turn by the ability of your card (by-spec)
  if (F.mylast && c.pos !== me.lastPos) return false; if (F.nrc && hasRace(d, F.nrc)) return false;
  if (F.col && !sameCol(c, me)) return false; if (F.ncol && sameCol(c, me)) return false;
  if (F.row && !(F.row === 'f' ? FRONT : BACK).includes(c.pos)) return false;
  if (F.st && (F.st === 's') === !!c.rest) return false;
  // unit descriptions used by triggers
  if (F.gmin && !(d.grade >= F.gmin)) return false;
  if (F.gmax != null && !(d.grade <= F.gmax)) return false;
  if (F.k === 'v' && c.zone !== 'VC') return false;
  if (F.k === 'r' && c.zone !== 'RC') return false;
  return true;
}
const nameCount = (G, list) => new Set(list.map(c => G.def(c).name)).size;
/* def.pd2: when your vanguard's ability counts the cards its cost took, this card counts as two */
const pdLen = (G, me, x) => x.reduce((n, i) => n + (me && me.zone === 'VC' && G.cards[i] && G.def(G.cards[i]).pd2 ? 2 : 1), 0);
/* "when you would choose … for that ability, choose up to N instead of one" — tf.pkx<p> = [{ nm, iid, zone, to }] */
const pkxFor = (G, ctx, zones, n) => { if (n !== 1) return null; const L = G.tf['pkx' + ctx.p]; if (!L || !L.length || !ctx.me) return null; const d = G.def(ctx.me); return L.find(e => (!e.nm || d.name.includes(e.nm)) && (e.iid == null || e.iid === ctx.me.iid) && [].concat(zones).includes(e.zone)) || null; };
const cnt = (G, list, F) => (F && F.dist ? nameCount(G, list) : list.reduce((n, c) => { const w = c && G.def(c).cnt2; return n + (w && c.zone === w.z && F && ((F.rc || '') + ' ' + (F.rch || '')).includes(w.rc) ? 2 : 1); }, 0));   // def.cnt2 {z, rc}: counted as two cards when a count of that race is made in that zone
/* choose up to n cards one after another so that no two share a card name */
function* pickDistinct(G, ctx, list, n, up, o, byGrade) {
  const out = []; const names = new Set(); const key = i => (byGrade ? (o.wild && G.def(G.cards[i]).name.includes(o.wild) ? 'w' + i : 'g' + G.def(G.cards[i]).grade) : G.def(G.cards[i]).name);   // o.wild: cards with that name part may count as any grade
  while (out.length < n) { const rest = list.filter(i => !out.includes(i) && !names.has(key(i))); if (!rest.length) break; const sel = yield* G.chooseCards(ctx.p, rest, Object.assign({}, o, { min: up || out.length ? 0 : 1, max: 1, noAuto: true, title: o.title + ' (' + (out.length + 1) + '/' + n + (byGrade ? ' เกรดไม่ซ้ำกัน)' : ' ชื่อไม่ซ้ำกัน)') })); if (!sel.length) break; out.push(sel[0]); names.add(key(sel[0])); }
  return out;
}
function unitsOf(G, ctx, sel, all) {
  if (sel.s === 'x') return unitsOf(G, ctx, Object.assign({}, sel, { s: 'm' }), all).concat(unitsOf(G, ctx, Object.assign({}, sel, { s: 'o' }), all));   // either player's
  const p = sel.s === 'o' ? 1 - ctx.p : ctx.p; let list;
  if (sel.k === 'atkd') list = G.battle ? G.battle.targets.map(i => G.cards[i]).filter(c => c.owner === ctx.p && isField(c.zone)) : [];
  else list = sel.k === 'lk' ? ['FL', 'FR', 'BL', 'BC', 'BR'].map(k => G.at(p, k)).filter(c => c && c.locked) : sel.k === 'v' ? [G.vg(p)] : sel.k === 'r' ? G.rcs(p) : sel.k === 'g' ? G.players[p].GC.map(i => G.cards[i]) : G.units(p);
  list = list.filter(c => c && mf(G, ctx.me, c, sel.f));
  if (sel.f && sel.f.colit) { const o = G.cards[ctx.it[0]]; list = o ? list.filter(c => sameCol(c, o)) : []; }
  if (sel.f && sel.f.sit) { const names = ctx.it.map(i => G.cards[i] && G.def(G.cards[i]).name); list = list.filter(c => names.includes(G.def(c).name)); }   // same card name as the card chosen before
  if (p !== ctx.p && !all) list = list.filter(c => { const st = G.stat(c); return !st.resist && !st.immune; });
  return list;
}
function group(G, ctx, t) {
  const p = ctx.p, me = ctx.me; const on = c => c && (c.zone === 'VC' || c.zone === 'RC' || c.zone === 'GC');
  if (t && typeof t === 'object') return unitsOf(G, ctx, t, true).map(c => c.iid);
  switch (t) {
    case 'me': return on(me) ? [me.iid] : [];
    case 'it': return ctx.it.filter(i => on(G.cards[i]));
    case 'it+me': return [...new Set(ctx.it.concat([me.iid]))].filter(i => on(G.cards[i]));
    case 'all': return G.units(p).map(c => c.iid);
    case 'front': return G.front(p).map(c => c.iid);
    case 'rgs': return G.rcs(p).map(c => c.iid);
    case 'vgs': return [G.vg(p).iid];
    case 'backrg': return G.back(p).map(c => c.iid);
    case 'frontrg': return G.front(p).filter(c => c.zone === 'RC').map(c => c.iid);
    case 'others': return G.units(p).filter(c => c.iid !== me.iid).map(c => c.iid);
    case 'otherrg': return G.rcs(p).filter(c => c.iid !== me.iid).map(c => c.iid);
    case 'col': return G.units(p).filter(c => sameCol(c, me)).map(c => c.iid);
    case 'colo': return G.units(p).filter(c => sameCol(c, me) && c.iid !== me.iid).map(c => c.iid);
    case 'boosted': return G.battle && G.battle.booster === me.iid && on(G.cards[G.battle.attacker]) ? [G.battle.attacker] : [];
    case 'attacker': return G.battle && on(G.cards[G.battle.attacker]) ? [G.battle.attacker] : [];
    case 'otgt': return G.battle ? G.battle.targets.filter(i => G.cards[i] && G.cards[i].owner !== p && on(G.cards[i])) : [];   // your opponent's unit(s) being attacked
    case 'smu': return ctx.evt && ctx.evt.user != null && on(G.cards[ctx.evt.user]) ? [ctx.evt.user] : [];   // the unit that used this special move
    case 'tgt': return G.battle ? G.battle.targets.filter(i => G.cards[i] && G.cards[i].owner === p && on(G.cards[i])) : [];   // your unit(s) being attacked
    case 'gc': return G.players[p].GC.slice();
    case 'ogc': return G.players[1 - p].GC.slice();
    case 'oall': return G.units(1 - p).map(c => c.iid);
    case 'orgs': return G.rcs(1 - p).map(c => c.iid);
    case 'ofront': return G.front(1 - p).map(c => c.iid);
    case 'ovgs': return [G.vg(1 - p).iid];
    case 'evt': return ctx.evt && ctx.evt.iid != null && on(G.cards[ctx.evt.iid]) ? [ctx.evt.iid] : [];
  }
  return [];
}
function zoneCards(G, ctx, zones) {
  const P = G.players[ctx.p]; let out = [];
  for (const z of zones) {
    if (z === 'looked') out = out.concat(ctx.looked.filter(i => G.cards[i].zone === 'deck'));
    else if (z === 'it') out = out.concat(ctx.it);
    else if (z === 'bs') out = out.concat(G.gaugeOf(ctx.me.iid, 'bs'));   // this card's buddy soul
    else if (z[0] === '$') out = out.concat((ctx.v && ctx.v[z]) || []);                 // a kept selection
    else if (z.startsWith('o:')) out = out.concat(G.players[1 - ctx.p][z.slice(2)] || []);   // the opponent's zone
    else if (z === 'rc') out = out.concat(G.rcs(ctx.p).map(c => c.iid));
    else if (z === 'gc') out = out.concat(P.GC);
    else if (z === 'units') out = out.concat(G.units(ctx.p).filter(Boolean).map(c => c.iid));
    else out = out.concat(z === 'hand' ? G.handFor(ctx.p) : z === 'soul' ? G.soulFor(ctx.p) : P[z] || []);
  }
  return out;
}
/* a number written in a skill: plain, or computed from the table (a count expression) */
function nv(G, ctx, x) { return Array.isArray(x) ? count(G, ctx, x) : x; }
/* one unit named by a word: me, it (first chosen), vg, ovg, atk (attacker), tgt (attacked), bst (booster) */
function unitOf(G, ctx, w) {
  const b = G.battle;
  switch (w) { case 'smu': return ctx.evt && ctx.evt.user != null ? G.cards[ctx.evt.user] : null; case 'me': return ctx.me; case 'it': return G.cards[ctx.it[0]] || null; case 'vg': return G.vg(ctx.p); case 'ovg': return G.vg(1 - ctx.p); case 'atk': return b ? G.cards[b.attacker] : null; case 'tgt': return b ? G.cards[b.targets[0]] : null; case 'bst': return b && b.booster ? G.cards[b.booster] : null; case 'evt': return ctx.evt && ctx.evt.iid != null ? G.cards[ctx.evt.iid] : null; case 'by': return ctx.evt && ctx.evt.by != null ? G.cards[ctx.evt.by] : null; }
  return null;
}
/* how many records of this turn (q.fight: of the whole fight) match: q = { k: kind (mv ab atk hit chk ord cost stand), s: whose (m o x), to, from, reason, by (a v o x c n), f, byf, kind, tz, az, trig, n, me, ride, normal, type, zone, divine } */
function tlCount(G, ctx, q) {
  const p = ctx.p, me = ctx.me; let n = 0; const k = q.k || 'mv'; let seen = null;
  for (const r of (q.fight ? G.fl : q.prev ? G.ptl : G.tl) || []) {
    if (q.pwmin && !(r.pw >= q.pwmin)) continue;
    if (r.k !== k) continue;
    if (q.s !== 'x' && (q.s === 'o' ? r.p === p : r.p !== p)) continue;
    if (q.to && ![].concat(q.to).includes(r.to)) continue; if (q.wanted && ![].concat(q.wanted).includes(r.wanted)) continue; if (q.from && ![].concat(q.from).includes(r.from)) continue; if (q.nfrom && [].concat(q.nfrom).includes(r.from)) continue;
    if (q.reason && ![].concat(q.reason).includes(r.reason)) continue; if (q.nreason && [].concat(q.nreason).includes(r.reason)) continue;
    if (q.dom && !r.dom) continue;
    if (q.usr && r.user !== me.iid) continue;   // special moves used by this unit   // only attacks / hits by a unit dominated by that player
    if (q.kind && ![].concat(q.kind).includes(r.kind)) continue; if (q.tz && r.tz !== q.tz) continue; if (q.az && r.az !== q.az) continue;
    if (q.trig && !(q.trig === 1 ? r.trigger : q.trig === 0 ? !r.trigger : [].concat(q.trig).includes(r.trigger))) continue;
    if (q.ph && r.ph !== q.ph) continue; if (q.bottom && !r.bottom) continue;
    if (q.rf && r.rf !== q.rf) continue; if (q.rfg != null && r.rfg !== q.rfg) continue; if (q.rfh && !(r.rf && r.rf.includes(q.rfh))) continue; if (q.battle && r.bn !== (G.battleNo || 0)) continue;
    if (q.gk && r.gk !== q.gk) continue; if (q.n && !(r.n >= q.n)) continue; if (q.me && r.iid !== me.iid) continue; if (q.notme && r.iid === me.iid) continue; if (q.ride && !r.ride) continue; if (q.normal && !r.normal) continue; if (q.type && r.type !== q.type) continue; if (q.zone && r.zone !== q.zone) continue; if (q.divine && !r.divine) continue;
    if (q.boosted != null && !!r.boosted !== !!q.boosted) continue; if (q.col && COL[r.pos || r.toPos || r.fromPos] !== q.col) continue; if (q.row && !(q.row === 'f' ? FRONT : BACK).includes(r.pos || r.toPos || r.fromPos)) continue;
    if (q.by) {
      const src = r.by != null ? G.cards[r.by] : null;
      if (q.by === 'n') { if (src) continue; }
      else if (q.by === 'x') { if (!src) continue; }
      else if (q.by === 'o') { if (r.byP !== 1 - p) continue; }
      else { if (!src || r.byP !== p) continue; if (q.by === 'v' && !r.byVG) continue; if (q.by === 'c' && !r.byCost) continue; if (q.by === 'me' && r.by !== me.iid) continue; if (q.by === 'sn' && !(r.byNo && VG.card(r.byNo).name === G.def(me).name)) continue; }
      if (q.byf && !(r.byNo && mfDef(G, me, VG.card(r.byNo), q.byf))) continue;
    }
    if (q.f && !(G.cards[r.iid] && mf(G, me, G.cards[r.iid], Object.assign({}, q.f, { k: null })))) continue;
    if (q.tgt && !(G.battle && r.target === G.battle.targets[0])) continue;   // against the unit being attacked now
    if (q.dist) { seen = seen || new Set(); if (seen.has(r.no)) continue; seen.add(r.no); }   // different cards only
    n += q.sum ? (r.n || 0) : 1;
  }
  return n;
}
/* the filter applied to a printed card (no card on the table at hand) */
function mfDef(G, me, d, F) { if (!F) return true; if (F.ico && d.icon !== F.ico) return false; if (F.cln != null || F.cl1) { const cs = d.clans || []; if (F.cln === 1 && !cs.length) return false; if (F.cln === 0 && cs.length) return false; if (typeof F.cln === 'string' && !(cs.length === 1 && cs[0] === F.cln.toLowerCase())) return false; if (F.cl1 && cs.length !== 1) return false; } if (F.or) return F.or.some(x => mfDef(G, me, d, x)); if (F.g && !(d.grade != null && d.grade >= F.g[0] && d.grade <= F.g[1])) return false; if (F.nm && d.name !== F.nm && d.as !== F.nm) return false; if (F.nh && !(d.name.includes(F.nh) || (F.nh2 && d.name.includes(F.nh2)))) return false; if (F.rc && !hasRace(d, F.rc)) return false; if (F.na && d.nation !== F.na && d.nation2 !== F.na) return false; if (F.sn && d.name !== G.def(me).name) return false; if (F.ty === 'u' && d.type !== 'unit') return false; if (F.ty === 'o' && d.type !== 'order') return false; return true; }
function count(G, ctx, c) {
  const p = ctx.p, P = G.players[p], O = G.players[1 - p];
  switch (c[0]) {
    case 'n': return c[1];
    case 'pd': { const x = (ctx.paid || [])[c[1] || 0]; return typeof x === 'number' ? x : Array.isArray(x) ? pdLen(G, ctx.me, x) : 0; }   // what the i-th cost of this ability took
    case 'looked': return ctx.looked.filter(i => G.cards[i].zone === 'deck').length;
    case 'fm': { const want = (G.def(ctx.me).tags || []).filter(t => t.startsWith('fm:')).map(t => t.slice(3)); return new Set(P.order.map(i => G.def(G.cards[i]).name.toLowerCase()).filter(n => want.includes(n))).size; }   // different cards in the order zone that this card names (fashion magic)
    case 'ztr': return new Set(zoneCards(G, ctx, [].concat(c[1])).map(i => G.def(G.cards[i]).trigger).filter(Boolean)).size;   // kinds of trigger icons in a zone
    case 'zg': return zoneCards(G, ctx, [].concat(c[1])).filter(i => mf(G, ctx.me, G.cards[i], c[2])).reduce((n, i) => n + G.grade(G.cards[i]), 0);   // sum of grades in a zone
    case 'pdpw': { const x = (ctx.paid || [])[c[1] || 0]; return Array.isArray(x) ? x.reduce((n, i) => n + (G.cards[i] ? G.def(G.cards[i]).power || 0 : 0), 0) : 0; }   // printed power of the cards the i-th cost took
    case 'pdg': { const x = (ctx.paid || [])[c[1] || 0]; return Array.isArray(x) ? x.reduce((n, i) => n + (G.cards[i] ? G.def(G.cards[i]).grade || 0 : 0), 0) : 0; }   // sum of the grades of the cards the i-th cost took
    case 'mkcn': { const u = c[3] === 'it' ? G.cards[ctx.it[0]] : ctx.me; const k0 = u && (u.zone === 'RC' || u.zone === 'VC' ? u.pos : u.lastPos); return k0 ? G.markers.filter(m => m.name === c[1] && m.p === u.owner && (!c[2] || m.by === p) && COL[m.k] === COL[k0]).length : 0; }   // markers (c[2]: mine) in the column of this unit / of it
    case 'colpw': { const o = G.cards[ctx.it[0]]; if (!o || !o.pos) return 0; return G.rcs(o.owner).filter(u => u.iid !== o.iid && COL[u.pos] === COL[o.pos] && mf(G, ctx.me, u, c[1] || {})).reduce((n, u) => n + G.stat(u).power, 0); }   // total power of the other rear-guards (matching F) in the chosen unit's column
    case 'chby': return (G.tf['chl' + ctx.p] || []).filter(x => x.p === ctx.p && (!c[2] || x.z === c[2]) && (!c[1] || (VG.card(x.no) && mfDef(G, ctx.me, VG.card(x.no), c[1])))).length;   // times your units were chosen this turn by your abilities of cards matching F (in zone)
    case 'ofdv': return (G.tf['ofdv' + ctx.p] || []).filter(x => (!c[1] || x.nm.includes(c[1])) && x.g >= (c[2] == null ? 3 : c[2])).reduce((n, x) => n + x.n, 0);   // cards in the order zone turned face down this turn by the cost of your (grade 3+) vanguard with that name part
    case 'jailn': return O.prison.length;   // the opponent's cards imprisoned in my prison
    case 'gz': return P.gauge.filter(i => { const x = G.cards[i]; return (!c[1] || x.gk === c[1]) && (!c[2] || mf(G, ctx.me, x, c[2])); }).length;   // my gauges (of that kind, matching F)
    case 'memd': return G.memCount(c[1] === 'o' ? 1 - ctx.p : ctx.p, true);   // <Quintuplet> with different card names in my memory
    case 'memn': return G.memCount(c[1] === 'o' ? 1 - ctx.p : ctx.p, false);
    case 'gzu': return G.players[c[1] === 'o' ? 1 - ctx.p : ctx.p].gzone.filter(i => G.cards[i].faceup).length;   // face-up cards in a G zone
    case 'gzme': return P.gauge.filter(i => G.cards[i].gh === ctx.me.iid && (!c[1] || G.cards[i].gk === c[1])).length;   // gauges of this card
    case 'gzit': return P.gauge.filter(i => G.cards[i].gh === ctx.it[0] && (!c[1] || G.cards[i].gk === c[1])).length;
    case 'gztr': { const hs = P.order.filter(i => !c[1] || G.def(G.cards[i]).name.includes(c[1])); return new Set(P.gauge.filter(i => hs.includes(G.cards[i].gh)).map(i => G.def(G.cards[i]).trigger).filter(Boolean)).size; }   // different trigger icons among the gauges of my set orders named …
    case 'itsn': { const x = G.cards[ctx.it[0]]; if (!x) return 0; const nm = G.def(x).name; return zoneCards(G, ctx, [].concat(c[1])).filter(i => G.cards[i] && G.def(G.cards[i]).name === nm).length; }   // cards in the zone(s) that share the chosen card's name
    case 'itg': return ctx.it.reduce((n, i) => n + (G.cards[i] ? G.def(G.cards[i]).grade || 0 : 0), 0);
    case 'rest': return ctx.rest || 0;
    case 'it': return c[1] ? ctx.it.filter(i => G.cards[i] && mf(G, ctx.me, G.cards[i], c[1])).length : ctx.it.length;
    case 'var': return (ctx.v && typeof ctx.v[c[1]] === 'number' ? ctx.v[c[1]] : 0);
    case 'ozf': return cnt(G, O[c[1]].filter(i => mf(G, ctx.me, G.cards[i], c[2])).map(i => G.cards[i]), c[2]);
    case 'zd': return new Set(zoneCards(G, ctx, [].concat(c[1])).filter(i => mf(G, ctx.me, G.cards[i], c[3])).map(i => (c[2] === 'g' ? G.def(G.cards[i]).grade : G.def(G.cards[i]).dname && G.cards[i].zone === 'soul' ? 'dn#' + i : G.def(G.cards[i]).name))).size;   // different grades / names in a zone
    case 'zs': return cnt(G, zoneCards(G, ctx, [].concat(c[1])).filter(i => i !== ctx.me.iid && mf(G, ctx.me, G.cards[i], c[2])).map(i => G.cards[i]), c[2]);   // cards of several zones (hand soul drop bind order o:… rc gc)
    case 'tl': return tlCount(G, ctx, c[1]);
    case 'add': return count(G, ctx, c[1]) + nv(G, ctx, c[2]);
    case 'sub': return Math.max(0, count(G, ctx, c[1]) - nv(G, ctx, c[2]));
    case 'mul': return count(G, ctx, c[1]) * nv(G, ctx, c[2]);
    case 'min': return Math.min(count(G, ctx, c[1]), nv(G, ctx, c[2]));
    case 'max': return Math.max(count(G, ctx, c[1]), nv(G, ctx, c[2]));
    case 'pw': { const u = unitOf(G, ctx, c[1]); return u && isField(u.zone) ? (G.statTmp && G.statTmp.iid === u.iid ? G.statTmp.s : G.stat(u)).power : 0; }
    case 'dr': { const u = unitOf(G, ctx, c[1]); return u && isField(u.zone) ? G.stat(u).drive : 0; }
    case 'ev': { const x = ctx.evt ? ctx.evt[c[1]] : 0; return typeof x === 'number' ? x : x ? 1 : 0; }   // a number the event carries (batch = cards called to GC together, over = placed over a unit)
    case 'atkn': { const u = unitOf(G, ctx, c[1]); return u ? u.atk || 0 : 0; }   // how many times that unit attacked this turn
    case 'psh': { const u = c[1] === 'it' ? G.cards[ctx.it[0]] : unitOf(G, ctx, c[1]); return u ? (G.def(u).shield || 0) : 0; }   // printed shield
    case 'cr': { const u = unitOf(G, ctx, c[1]); return u && isField(u.zone) ? (G.statTmp && G.statTmp.iid === u.iid ? G.statTmp.s : G.stat(u)).crit : 0; }
    case 'gr': { const u = unitOf(G, ctx, c[1]); return u ? G.grade(u) : 0; }
    case 'ppw': { const u = unitOf(G, ctx, c[1]); return u ? G.def(u).power || 0 : 0; }   // printed power
    case 'odn': return (ctx.me.dress || []).length;   // how many originalDress cards this unit has
    case 'odpw': return (ctx.me.dress || []).reduce((n, i) => n + (G.cards[i] ? (G.def(G.cards[i]).power || 0) : 0), 0);   // printed power of this unit's originalDress cards, added up
    case 'lockn': return (c[1] === 'm' ? [p] : c[1] === 'o' ? [1 - p] : [0, 1]).reduce((a, q) => a + RCS.filter(k => { const u = G.at(q, k); return u && u.locked; }).length, 0);   // locked cards (m / o / x)
    case 'energy': return P.energy || 0;
    case 'bno': return G.battleNo || 0;
    case 'vcn': return ['V', 'V2'].filter(k => G.players[c[1] === 'o' ? 1 - p : p].circles[k] != null).length;   // cards on (VC)
    case 'formula': return G.formula(c[1] === 'o' ? 1 - ctx.p : ctx.p);   // your formula count
    case 'turn': return G.turnNo || 0;
    case 'open': return RCS.filter(k => !P.circles[k]).length;
    case 'ff': return (P.fight && P.fight[c[1]]) || 0;
    case 'tf': return G.tf[c[1] + (c[2] === 'o' ? 1 - p : p)] || 0;
    case 'u': { const q = c[1] === 'o' ? 1 - p : p; const L = (c[2] === 'v' ? [G.vg(q)] : c[2] === 'r' ? G.rcs(q) : G.units(q)).filter(x => mf(G, ctx.me, x, c[3])); return cnt(G, L, c[3]) + (q === p && !(c[3] && c[3].dist) ? L.filter(x => { const w = G.def(x).u2; return w && G.def(ctx.me).name.includes(w); }).length : 0); }   // def.u2: counted as two units for abilities of cards with that name
    case 'z': return P[c[1]].length;
    case 'oz': return O[c[1]].length;
    case 'dmgUp': return P.damage.filter(i => G.cards[i].faceup).length;
    case 'zf': return cnt(G, P[c[1]].filter(i => mf(G, ctx.me, G.cards[i], c[2])).map(i => G.cards[i]), c[2]);
    case 'grade': return c[1] === 'atk' ? (G.battle ? G.grade(G.cards[G.battle.attacker]) : 0) : c[1] === 'it' ? (ctx.it.length && G.cards[ctx.it[0]] ? G.grade(G.cards[ctx.it[0]]) : 0) : G.grade(G.vg(c[1] === 'ovg' ? 1 - p : p));
    case 'div': return Math.floor(count(G, ctx, c[1]) / c[2]);
    case 'oopen': return RCS.filter(k => !G.players[1 - p].circles[k] && (!c[1] || (c[1] === 'col' ? sameCol({ pos: k, owner: 1 - p }, ctx.me) : (c[1] === 'f' ? FRONT : BACK).includes(k)))).length;
    case 'odc': return (ctx.me.dress || []).length;
    case 'mkn': return c[2] === 'rc' ? RCS.filter(k => G.markerCount(p, k, c[1])).length : G.markerCount(c[2] === 'mine' ? null : p, null, c[1], c[2] === 'mine' ? p : null);   // markers on your circles / circles holding one / your markers anywhere
    case 'paid': return ctx.count || 0;
  }
  return 0;
}

/* ---------- conditions ---------- */

function ev(G, ctx, c) {
  const p = ctx.p, me = ctx.me, P = G.players[p], O = G.players[1 - p]; const b = G.battle;
  switch (c[0]) {
    case 'and': return ev(G, ctx, c[1]) && ev(G, ctx, c[2]);
    case 'cmp': return cmp(count(G, ctx, c[1]), c[2], nv(G, ctx, c[3]));
    case 'sameIn': { const t = G.cards[ctx.it[0]]; return !!t && zoneCards(G, ctx, [].concat(c[1])).some(i => i !== t.iid && G.def(G.cards[i]).name === G.def(t).name); }   // a zone holds a card with the same name as the chosen one
    case 'itSame': return ctx.it.length >= (c[1] || 2) && new Set(ctx.it.map(i => G.def(G.cards[i]).name)).size === 1;
    case 'itDiff': return ctx.it.length >= (c[1] || 2) && new Set(ctx.it.map(i => G.def(G.cards[i]).name)).size === ctx.it.length;
    case 'lastpos': return c.slice(1).includes(me.lastPos);
    case 'tgMe': return !!b && b.targets.includes(me.iid);
    case 'placedByF': return !!me.placedBy && me.placedBy.p === p && !!me.placedBy.no && mfDef(G, me, VG.card(me.placedBy.no), c[1]);   // placed by the ability of your card matching F
    case 'atkSameCol': { const a = b && G.cards[b.attacker]; return !!a && sameCol(a, me); }
    case 'bstBy': { const x = b && b.attacker === me.iid && b.booster ? G.cards[b.booster] : null; return !!x && mf(G, me, x, c[1]); }
    case 'playedFrom': return me.playedFrom === c[1];
    case 'itDiffEx': { const l = ctx.it.map(i => G.def(G.cards[i]).name).filter(n => n !== c[1]); return new Set(l).size === l.length; }   // the chosen cards not named X all have different names
    case 'itDg': return ctx.it.length >= (c[1] || 2) && new Set(ctx.it.map(i => G.def(G.cards[i]).grade)).size === ctx.it.length;
    case 'pdIs': { const x = (ctx.paid || [])[c[1] || 0]; return Array.isArray(x) && x.some(i => G.cards[i] && mf(G, me, G.cards[i], c[2])); }   // a card used for the i-th cost matches
    case 'gt': return count(G, ctx, c[1]) > nv(G, ctx, c[2]);
    case 'tlq': return cmp(tlCount(G, ctx, c[1]), c[2] || '>=', c[3] == null ? 1 : c[3]);
    case 'v': return !!(ctx.v && ctx.v[c[1]]);
    case 'uis': { const u = unitOf(G, ctx, c[1]); return !!u && mf(G, me, u, c[2]); }
    case 'ff': return !!(P.fight && P.fight[c[1]]);
    case 'itn': return cmp(ctx.it.length, c[1], c[2]);
    case 'stn': { const u = unitOf(G, ctx, c[2] || 'me'); return !!u && G.hasState(u, c[1]); }
    case 'pos': return c.slice(1).includes(me.pos);
    case 'evf': { const u = ctx.evt && ctx.evt.iid != null ? G.cards[ctx.evt.iid] : null; return !!u && mf(G, me, u, c[1]); }
    case 'first': return G.first === p;
    case 'turnN': return cmp(G.turnNo, c[1], c[2]);
    case 'battle': return !!b;
    case 'rested': { const u = unitOf(G, ctx, c[1] || 'me'); return !!u && !!u.rest; }
    case 'critUp': { const u = unitOf(G, ctx, c[1] || 'me'); return !!u && u.critUpT === G.turnNo; }   // its critical was raised by an ability (not a trigger) this turn
    case 'tgIs': { const t = b && G.cards[b.targets[0]]; return !!t && mf(G, me, t, Object.assign({}, c[1], { k: null })) && (!c[1].k || (c[1].k === 'v') === (b.targetZone === 'VC')); }
    case 'atkF': { const a = b && G.cards[b.attacker]; return !!a && mf(G, me, a, c[1]); }
    case 'energy': return cmp(P.energy || 0, c[1], c[2]);
    case 'or': return ev(G, ctx, c[1]) || ev(G, ctx, c[2]);
    case 'not': return !ev(G, ctx, c[1]);
    case 'true': return true;
    case 'did': return !!ctx.did;
    case 'got': return !!ctx.got;
    case 'none': return !ctx.got;
    case 'vg': { const v = G.vg(p), d = G.def(v), f = c[1]; if (f.gmin && d.grade < f.gmin) return false; if (f.gmax != null && d.grade > f.gmax) return false; if (f.nh && !(d.name.includes(f.nh) || (f.nh2 && d.name.includes(f.nh2)))) return false; if (f.nm && !(d.name === f.nm || d.as === f.nm || (f.nm2 && d.name === f.nm2))) return false; if (f.rc && !hasRace(d, f.rc)) return false; const xf = vgX(f); if (xf && !mf(G, ctx.me, v, xf)) return false; return true; }
    case 'ovg': return G.grade(G.vg(1 - p)) >= c[1];
    case 'vgLt': return G.grade(G.vg(p)) < G.grade(G.vg(1 - p));
    case 'vgLe': return G.grade(G.vg(p)) <= G.grade(G.vg(1 - p));
    case 'second': return G.first !== p;
    case 'persona': return !!G.tf['persona' + p]; case 'opersona': return !!G.tf['persona' + (1 - p)];
    case 'ods': return isField(me.zone) && mf(G, me, me, { ods: c[1] });
    case 'evod': return !!(ctx.evt && ctx.evt.od);
    case 'nopst': return !G.tf['pst' + p];
    case 'chosen': { const u = c[2] ? unitOf(G, ctx, c[2]) : me; return !!u && (u.chosen || []).some(x => x.t === G.turnNo && x.p === p && choseOk(G, me, c[1], x)); }   // ['chosen', by, who]
    case 'mkc': return cmp(count(G, ctx, ['mkn', c[1], c[4]]), c[2], c[3]);
    case 'mkon': return me.zone === 'RC' && G.markerCount(me.owner, me.pos, c[1], c[2] ? p : null) > 0;
    case 'mkcol': return isField(me.zone) && G.markers.some(m => m.name === c[1] && (!c[2] || m.by === p) && (c[3] || m.p === p) && COL[m.k] === COL[me.pos]);
    case 'mkopp': return G.markerCount(1 - p, null, c[1], p) > 0;
    case 'evby': { const e = ctx.evt; if (!e) return false; if (c[1] === 'me') return e.by === ctx.me.iid; return byOk(G, ctx.me, { by: c[1], byf: c[2] }, e); }   // how the event came about: v your vanguard's ability · a your card's · o the opponent's · c a cost · x any ability · me this card's own
    case 'wings': { if (P.effects.some(e => e.bothWings)) return true; const g = P.bind.map(i => G.grade(G.cards[i]) % 2); return g.length > 0 && g.every(x => x === (c[1] === 'w' ? 1 : 0)); }   // White Wings: bind zone holds only odd grades; Black Wings: only even grades
    case 'noRide': return !G.tf['rode' + p];
    case 'ord': return c[1] ? (G.tf['ordk' + p] || '').includes(c[1]) : !!G.tf['ord' + p];
    case 'noOrd': return !G.tf['ord' + p];
    case 'cnt': return cmp(P[c[1]].length, c[2], c[3]);
    case 'ocnt': return cmp(O[c[1]].length, c[2], c[3]);
    case 'noCB': return !P.damage.some(i => G.cards[i].faceup);
    case 'units': return cmp((c[1] === 'r' ? G.rcs(p) : G.units(p)).filter(x => mf(G, me, x, c[4])).length, c[2], c[3]);
    case 'orgs': return cmp(G.rcs(1 - p).length, c[1], c[2]);
    case 'ofront0': return !G.front(1 - p).some(x => x.zone === 'RC');
    case 'front0': return !G.front(p).some(x => x.zone === 'RC');
    case 'back0': return !G.back(p).length;
    case 'rgMore': return G.rcs(p).length > G.rcs(1 - p).length;
    case 'noSame': return !G.rcs(p).some(x => x.iid !== me.iid && G.def(x).name === G.def(me).name);
    case 'noSameIt': { const t = G.cards[ctx.it[0]]; return !t || !G.rcs(p).some(x => x.iid !== t.iid && G.def(x).name === G.def(t).name); }
    case 'whereIs': return ctx.fromZ === c[1];
    case 'cntD': return new Set(P[c[1]].map(i => (c[2] === 'g' ? G.def(G.cards[i]).grade : G.def(G.cards[i]).name))).size >= c[3];
    case 'atkCritFx': { const a = b && G.cards[b.attacker]; if (!a) return false; const base = G.def(a).crit == null ? 1 : G.def(a).crit; const trig = a.mods.reduce((t, m) => t + (m.trig && m.crit ? m.crit : 0), 0); const cr = G.stat(a).crit; return cr >= c[1] && (base >= c[1] || cr - trig > base); }
    case 'boosted': return !!b && b.attacker === me.iid && !!b.booster;
    case 'row': return (c[1] === 'f' ? FRONT : BACK).includes(me.pos);
    case 'placedNow': return me.placed === G.turnNo;
    case 'nbtl': return !G.tl.some(e => e.k === 'mv' && e.bn != null && e.bn === G.battleNo && e.p === me.owner && (c[1].from || ['RC', 'VC']).includes(e.from) && e.to === (c[1].to || 'deck') && VG.card(e.no) && mfDef(G, me, VG.card(e.no), c[1].f || {}));
    case 'dvcr': { const v = G.vg(p); return !!v && (G.tf['dvcr' + p] || []).includes(v.iid) && mf(G, me, v, c[1] || {}); }
    case 'nsnret': return !G.tl.some(e => e.k === 'mv' && e.p === me.owner && e.from === 'RC' && e.to === 'drop' && e.iid !== me.iid && VG.card(e.no) && VG.card(e.no).name === G.def(me).name);
    case 'bno': return cmp(G.battleNo || 0, c[1], c[2]);
    case 'atkVG': return !!b && b.targetZone === 'VC';
    case 'didHit': return !!b && b.hit;
    case 'noHit': return !!b && !b.hit;
    case 'stw': return !!(ctx.me.stWas && ctx.me.stWas[c[1]]);   // this card had that state when it left the field
    case 'dleg': return !!G.players[c[1] === 'o' ? 1 - p : p].circles.V2;   // your vanguard is in the D-legion state
    case 'dlegd': return !!G.tf['dleg' + p];   // you D-legioned this turn
    case 'candl': return G.canDLegion(p);
    case 'hitV': return !!b && !!b.hit && b.targets.some(i => G.cards[i] && G.cards[i].zone === 'VC');   // this battle's attack hit a vanguard
    case 'atk2': return !!b && (G.cards[b.attacker].atk || 0) >= 2;
    case 'noGuard': return !!b && !b.guards;
    case 'oretT': return !!G.tf['ret' + (1 - p)];
    case 'otrigT': return !!G.tf['trig' + (1 - p)];
    case 'phase': return (c[2] === 'x' || G.active === p) && G.phase[0] === c[1];   // ['phase', m|b|r|s, 'x' = either player's]
    case 'trigPw': return c[1] === 'me' ? me.mods.some(m => m.trig && m.power) : G.units(p).some(u => u.iid !== ctx.me.iid && u.mods.some(m => m.trig && m.power > 0));   // another unit of yours got power from a trigger this turn
    case 'my': return G.active === p;
    case 'opp': return G.active !== p;
    case 'attacking': return !!b && b.attacker === me.iid;
    case 'gfirst': return !!(ctx.evt && ctx.evt.gfirst);   // the guardian(s) placed first in this battle
    case 'boosting': return !!b && b.booster === me.iid;
    case 'bstIs': return !!b && b.booster === me.iid && !!G.cards[b.attacker] && mf(G, me, G.cards[b.attacker], c[1]);
    case 'crest': return P.crest.some(i => G.def(G.cards[i]).name === c[1]);
    case 'in': return inState(G, p, c[1]);
    case 'world': { const w = worldOf(G, p); return !!w && c[1].includes(w); }
    case 'tl': return (G.tl || []).some(r => r.k === c[1] && (c[2] === 'o' ? r.p !== p : r.p === p) && (!c[3] || (r.byP === p && (c[3] !== 'v' || r.byVG))) && (!c[4] || r.from === c[4]));
    case 'placedBy': return !!me.placedBy && me.placedBy.p === p && (c[1] !== 'v' || me.placedBy.vg);
    case 'placedFrom': return me.placedFrom === c[1];
    case 'uq': { const q = c[1] === 'o' ? 1 - p : p; const list = (c[2] === 'v' ? [G.vg(q)] : c[2] === 'r' ? G.rcs(q) : G.units(q)).filter(x => x && mf(G, me, x, c[5])); return cmp(cnt(G, list, c[5]), c[3], c[4]); }
    case 'allSt': { const list = (c[1] === 'v' ? [G.vg(p)] : c[1] === 'r' ? G.rcs(p) : G.units(p)).filter(x => mf(G, me, x, c[2])); return list.length > 0 && list.every(x => (c[3] === 'r') === !!x.rest); }
    case 'drew': return ctx.drew > 0;
    case 'itIs': return ctx.it.length > 0 && ctx.it.every(i => G.cards[i] && mf(G, me, G.cards[i], c[1]));
    case 'putTo': return ctx.where === c[1];
    case 'ordN': return cmp(G.tf['ord' + p] || 0, c[1], c[2]);
    case 'dmgDown': return cmp(P.damage.filter(i => !G.cards[i].faceup).length, c[1], c[2]);
    case 'dmgUpN': return cmp(P.damage.filter(i => G.cards[i].faceup).length, c[1], c[2]);
    case 'zone': return me.zone === c[1];
    case 'overIs': return !!ctx.evt && ctx.evt.overNo != null && mfDef(G, me, VG.card(ctx.evt.overNo), c[1]);   // this unit was placed over a unit matching the filter
    case 'evcol': { const e = ctx.evt; const pos = e && (e.fromPos || e.toPos || (G.cards[e.iid] && G.cards[e.iid].pos)); return !!pos && COL[pos] === COL[me.pos]; }   // the event's card is / was in this unit's column
    case 'evmk': { const u = ctx.evt && G.cards[ctx.evt.iid]; return !!u && u.zone === 'RC' && G.markerCount(u.owner, u.pos, c[1], c[2] ? p : null) > 0; }   // the event's unit stands on a circle with that marker (c[2]: one I put)
    case 'itOpp': return ctx.it.length > 0 && !!G.cards[ctx.it[0]] && G.cards[ctx.it[0]].owner !== p;
    case 'mklast': { const k = me.zone === 'RC' ? me.pos : me.lastPos; return !!k && G.markerCount(me.owner, k, c[1], c[2] ? p : null) > 0; }   // the circle this unit is / was on has the marker
    case 'mkoc': return me.zone === 'RC' && RCS.some(k => k !== me.pos && COL[k] === COL[me.pos] && G.markerCount(me.owner, k, c[1], c[2] ? p : null) > 0);   // the other circle of this unit's column has the marker
    case 'noG': return !(P.gzone && P.gzone.length);   // my G zone has no cards
    case 'gb': return G.gbCount(ctx.p) >= c[1] || !!(me && me.mods && me.mods.some(m => m.gbAny));   // generation break n
    case 'gzhas': return G.players[c[1] === 'o' ? 1 - ctx.p : ctx.p].gzone.filter(i => (!c[2] || G.cards[i].faceup) && !G.def(G.cards[i]).special).length >= (c[3] || 1);   // [gzhas, 'm'|'o', faceupOnly, n]
    case 'heartIs': { const v = G.vg(ctx.p); return !!(v && v.heart != null && mf(G, ctx.me, G.cards[v.heart], c[1] || {})); }
    case 'osd': return !!G.tf['os' + ctx.p];
    case 'alcd': return !!G.tf['alcd' + ctx.p];   // I did alchemagic this turn
    case 'alcing': return !!G.alcNow;   // this is part of alchemagic   // my vanguard is [Over Soul] this turn
    case 'oz': return P.order.some(i => mf(G, ctx.me, G.cards[i], c[1] || {}));   // my order zone has a card matching
    case 'bsh': return G.gaugeOf(ctx.me.iid, 'bs').some(i => mf(G, ctx.me, G.cards[i], c[1] || {}));   // this card's buddy soul has a card matching
    case 'armw': return P.arms.some(i => mf(G, ctx.me, G.cards[i], c[1] || {}));   // my vanguard is armed with a card matching
    case 'noimp': return !P.fight.imp;   // no impact resolved this fight
    case 'fin': return !!G.tf['fin' + ctx.p];   // I declared the final phase this turn
    case 'jail': return cmp(O.prison.length, c[1], c[2]);   // ['jail', op, n]: the opponent's cards imprisoned in my prison
    case 'pfxOn': return P.effects.some(e => e[c[1]]);
    case 'overTok': return !!ctx.evt && !!ctx.evt.over && !!ctx.evt.overTok && (c[1] === 1 || VG.card(ctx.evt.overNo).name.toLowerCase() === String(c[1]).toLowerCase());   // placed onto a circle that held a token unit (of that name)
    case 'gzIs': return ctx.me.zone === 'gauge' && (!c[1] || ctx.me.gk === c[1]);   // this card is a gauge (of that kind)
    case 'gzok': return G.canGauge(ctx.p, c[1]);
    case 'rfst': return !!ctx.evt && !!ctx.evt.rideFromSt && !!ctx.evt.rideFromSt[c[1]];   // the unit ridden upon was in that state
    case 'rfIs': { const o = ctx.evt && ctx.evt.rideFromIid != null ? G.cards[ctx.evt.rideFromIid] : null; return !!o && mf(G, me, o, c[1]); }   // the unit ridden upon matches F
    case 'evz': return !!ctx.evt && ctx.evt[c[1]] === c[2];   // ['evz', 'from' | 'to', zone]: where the event's card came from / went
    case 'unlT': return me.unlockT === G.turnNo; case 'unlPrev': return me.unlockT != null && me.unlockT === G.turnNo - 1;   // unlocked this turn / during the preceding turn
    case 'stIs': return (c[1] === 'r') === !!me.rest;
    case 'atkIs': return !!b && G.cards[b.attacker] && (c[1] === 'v') === (G.cards[b.attacker].zone === 'VC');
    case 'atkBoosted': return !!b && !!b.booster;
    case 'atkGrade': return !!b && cmp(G.grade(G.cards[b.attacker]), c[1], c[2]);
    case 'atkPow': return !!b && cmp(G.battlePower(), c[1], c[2]);
    case 'tgGrade': { if (!b) return false; const t = G.cards[b.targets[0]]; return !!t && G.grade(t) >= c[1][0] && G.grade(t) <= c[1][1]; }
    case 'has': return cnt(G, P[c[1]].filter(i => i !== me.iid && mf(G, me, G.cards[i], c[3])).map(i => G.cards[i]), c[3]) >= c[2];
  }
  throw new Error('fx: unknown condition ' + c[0]);
}

/* ---------- costs ---------- */
function pickCost(title, list, n, to, hint) {
  return { n, list, title, to, hint };
}
function allOf(list) { if (list.length === 1) return list[0]; return { label: list.map(x => x.label).join(' + '), can: (G, me, e) => list.every(x => x.can(G, me, e)), *pay(G, me, e) { let out = []; for (const x of list) { const r = yield* x.pay(G, me, e); if (Array.isArray(r)) out = out.concat(r); } return out; } }; }
/* a unit that takes Plant tokens as its plant gauge also lets retire-costs a Plant token could pay be paid with its plant gauges */
function plantAlt(G, me, F) {
  F = F || {}; if (!Object.keys(F).every(x => ['tk', 'g', 'ot'].includes(x)) || (F.tk && F.tk !== 1 && F.tk !== 'plant') || (F.g && F.g[0] > 0)) return [];
  const v = G.vg(me.owner); const hosts = G.rcs(me.owner).filter(c => { const d = G.def(c); return d.plantSink && v && G.def(v).name.includes(d.plantSink); }).map(c => c.iid);
  return hosts.length ? G.players[me.owner].gauge.filter(i => G.cards[i].gk === 'plant' && hosts.includes(G.cards[i].gh)) : [];
}
const gsLessOn = (G, me) => G.def(me).type === 'order' && G.def(me).name.includes('Great Spell') && (G.players[me.owner].arms || []).some(i => G.def(G.cards[i]).gsLess);   // Rune Staff: Great Spell orders cost one gauge less and no damage-zone card
function mkCost(k) {
  const C = VG.cost;
  switch (k[0]) {
    case 'cb': return C.CB(k[1]);
    case 'cbx': { const mn = k[1] || 1; const up = (G, me) => G.players[me.owner].damage.filter(i => G.cards[i].faceup);   // counter-blast any number (at least mn); the cards flipped are the result
      return { label: 'เคาน์เตอร์บลาสต์ ' + mn + ' ใบขึ้นไป', can: (G, me) => up(G, me).length >= mn,
        *pay(G, me) { const src = up(G, me); const sel = yield* G.chooseCards(me.owner, src, { min: mn, max: src.length, title: 'คอสต์: เคาน์เตอร์บลาสต์กี่ใบก็ได้ (อย่างน้อย ' + mn + ' ใบ)', hint: 'discard', zone: 'damage', noAuto: true }); for (const i of sel) G.cards[i].faceup = false; G.ev('cost', { p: me.owner, kind: 'CB', n: sel.length }); G.tlog({ k: 'cost', kind: 'cb', n: sel.length, p: me.owner, by: me.iid }); return sel; } }; }
    case 'ebx': { const mn = k[1] || 1;   // energy-blast any number (at least mn); the result is the number paid
      return { label: 'เอเนอร์จีบลาสต์ ' + mn + ' ขึ้นไป (กี่แต้มก็ได้)', can: (G, me) => (G.players[me.owner].energy || 0) >= mn,
        *pay(G, me) { const P = G.players[me.owner]; const opts = []; for (let i = mn; i <= (P.energy || 0); i++) opts.push({ id: String(i), label: 'เอเนอร์จีบลาสต์ ' + i }); const id = opts.length === 1 ? opts[0].id : yield* G.chooseOption(me.owner, 'คอสต์: เอเนอร์จีบลาสต์เท่าไร?', opts, { iid: me.iid }); const n = +(id || mn); P.energy -= n; G.ev('energy', { p: me.owner, n: -n, total: P.energy }); G.tlog({ k: 'cost', kind: 'eb', n, p: me.owner, by: me.iid, type: G.cur ? G.cur.type : null }); return n; } }; }
    case 'ebr': { const need = (G, me) => Math.max(0, k[1] - count(G, { p: me.owner, me, it: [] }, k[2]));
      return { label: 'เอเนอร์จีบลาสต์ ' + k[1] + ' (ลดลงตาม' + thCount(k[2]) + ')', can: (G, me) => (G.players[me.owner].energy || 0) >= need(G, me),
        *pay(G, me) { const n = need(G, me); const P = G.players[me.owner]; if (n > 0) { P.energy -= n; G.ev('energy', { p: me.owner, n: -n, total: P.energy }); G.tlog({ k: 'cost', kind: 'eb', n, p: me.owner, by: me.iid, type: G.cur ? G.cur.type : null }); } return n; } }; }
    case 'dz': { const src = (G, me) => (me.dress || []).filter(i => G.cards[i] && mf(G, me, G.cards[i], k[2]));
      return { label: 'นำ originalDress ของยูนิทนี้' + thFtail(k[2]) + ' ' + k[1] + ' ใบลงดรอป', can: (G, me) => src(G, me).length >= k[1], *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: k[1], max: k[1], title: 'คอสต์: เลือก originalDress ลงดรอป', hint: 'discard', zone: 'mixed' }); for (const i of sel) G.move(i, 'drop', { reason: 'cost' }); return sel; } }; }
    case 'mkx': return { label: 'นำ ' + k[1] + ' marker ของคุณออก 1 อัน', can: (G, me) => G.markerCount(null, null, k[1], me.owner) > 0, *pay(G, me) { G.removeMarker(null, null, k[1], me.owner); return 1; } };   // remove one of the markers I put
    case 'mkcard': { const src = (G, me) => G.players[me.owner][k[2]].filter(i => mf(G, me, G.cards[i], k[1])); const free = (G, me) => RCS.filter(c => !G.markerCount(me.owner, c, k[3]));   // a card becomes a marker on one of my circles without that marker: ['mkcard', F, zone, marker name]
      return { label: 'นำ' + thF(k[1], 1) + 'จาก' + (ZONE_TH[k[2]] || k[2]) + 'ไปวางหงายหน้าเป็น ' + k[3] + ' marker บน RC ที่ยังไม่มี', can: (G, me) => src(G, me).length > 0 && free(G, me).length > 0,
        *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: 1, max: 1, title: 'คอสต์: เลือกการ์ดที่จะวางเป็น ' + k[3] + ' marker', hint: 'discard', zone: k[2] }); const cs = free(G, me); const c = cs.length === 1 ? cs[0] : yield* G.chooseCircle(me.owner, cs, { title: 'วาง ' + k[3] + ' marker บนเซอร์เคิลไหน?', hint: 'marker', noAuto: true }); if (sel[0] == null || !c) return []; G.move(sel[0], 'gauge', { reason: 'cost', gk: 'mk' }); G.addMarker(me.owner, c, k[3], me.owner); G.markers[G.markers.length - 1].card = sel[0]; return sel; } }; }
    case 'gp': { const need = (G, me) => Math.max(0, k[1] - (me.mods.some(m => m.gLess) ? 1 : 0) - (G.def(me).type === 'order' && G.tf['gless' + me.owner] ? 1 : 0) - (gsLessOn(G, me) ? 1 : 0)); const src = (G, me) => G.players[me.owner].gauge.filter(i => G.cards[i].gk === 'bf');   // pay n gauge (Buddyfight)
      return { label: 'จ่ายเกจ ' + k[1], can: (G, me) => src(G, me).length >= need(G, me), *pay(G, me) { const n = need(G, me); if (G.def(me).type === 'order' && G.tf['gless' + me.owner]) G.tf['gless' + me.owner] = 0; const sel = n ? src(G, me).slice(-n) : []; for (const i of sel) G.move(i, 'drop', { reason: 'cost' }); G.tlog({ k: 'cost', kind: 'gp', n: sel.length, p: me.owner, by: me.iid }); return sel; } }; }
    case 'gd': { const o = k[3] || {}; const src = (G, me) => G.players[me.owner].gauge.filter(i => { const x = G.cards[i]; return (!k[2] || x.gk === k[2]) && (!o.host || x.gh === me.iid) && (!o.f || mf(G, me, x, o.f)); }).concat(o.plus ? G.rcs(me.owner).filter(c => mf(G, me, c, o.plus)).map(c => c.iid) : []); const mn = o.min != null ? o.min : k[1];   // plus: rear-guards matching it may be put into drop as well   // discard gauges: ['gd', n, kind, { host: 1 (this card's), min, f }]
      return { label: 'ทิ้ง' + gkTh(k[2]) + (o.host ? 'ของยูนิทนี้' : '') + (o.plus ? ' หรือนำ' + thF(o.plus, 0).trim() + 'ลงดรอป' : '') + ' ' + (o.min != null ? o.min + ' ใบขึ้นไป' + (k[1] < 50 ? ' (ไม่เกิน ' + k[1] + ')' : '') : k[1] + ' ใบ'), can: (G, me) => src(G, me).length >= mn,
        *pay(G, me) { const s0 = src(G, me); const sel = yield* G.chooseCards(me.owner, s0, { min: mn, max: Math.min(k[1], s0.length), title: 'คอสต์: ทิ้งเกจ', hint: 'discard', zone: 'mixed', noAuto: o.min != null }); for (const i of sel) G.move(i, 'drop', { reason: 'cost' }); if (sel.length) { G.emit('gdisc', { p: me.owner, n: sel.length, gk: k[2], by: me.iid }); G.tlog({ k: 'cost', kind: 'gd', n: sel.length, p: me.owner, by: me.iid }); } return sel; } }; }
    case 'osc': { const src = (G, me) => G.rcs(me.owner).filter(c => mf(G, me, c, k[1] || {})).map(c => c.iid);   // [Over Soul] cost: put a matching rear-guard into soul
      return { label: '[Over Soul] นำเรียร์การ์ด' + thF(k[1] || {}, 0).trim() + ' 1 ใบเข้าโซล', can: (G, me) => src(G, me).length > 0, *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: 1, max: 1, title: 'คอสต์ Over Soul', hint: 'discard', zone: 'field' }); for (const i of sel) G.move(i, 'soul', { reason: 'cost' }); G.tf['os' + me.owner] = 1; G.log('Over Soul!', me.owner); G.emit('osSoul', { p: me.owner, ids: sel }); G.tlog({ k: 'cost', kind: 'osc', p: me.owner, by: me.iid }); return sel; } }; }
    case 'lockrg': { const src = (G, me) => G.rcs(me.owner).filter(c => !c.locked && c.iid !== me.iid && (!k[2] || mf(G, me, c, k[2]))).map(c => c.iid);   // lock n of your rear-guards
      return { label: 'ล็อคเรียร์การ์ด' + (k[2] ? thF(k[2], 0).trim() : '') + ' ' + k[1] + ' ใบ', can: (G, me) => src(G, me).length >= k[1], *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: k[1], max: k[1], title: 'คอสต์: ล็อคเรียร์การ์ด', hint: 'discard', zone: 'field' }); for (const i of sel) G.lock(i); return sel; } }; }
    case 'gzup': { const src = (G, me) => (G.players[me.owner].gzone || []).filter(i => !G.cards[i].faceup);   // turn n face-down cards in my G zone face up
      return { label: 'หงายการ์ดในโซน G ' + k[1] + ' ใบ', can: (G, me) => src(G, me).length >= k[1], *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: k[1], max: k[1], title: 'คอสต์: หงายการ์ดในโซน G', hint: 'discard', zone: 'gzone' }); for (const i of sel) G.cards[i].faceup = true; return sel; } }; }
    case 'h2mb': { const src = (G, me) => G.handFor(me.owner).filter(i => i !== me.iid);   // put a card from hand into my Monster BOX face up
      return { label: 'นำการ์ดจากมือ ' + k[1] + ' ใบเข้า Monster BOX แบบหงาย', can: (G, me) => src(G, me).length >= k[1], *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: k[1], max: k[1], title: 'คอสต์: นำการ์ดจากมือเข้า Monster BOX', hint: 'discard', zone: 'hand' }); for (const i of sel) G.move(i, 'mbox', { reason: 'cost' }); return sel; } }; }
    case 'ozd': { const [, n, F, mn0] = k; const mn = mn0 == null ? n : mn0; const src = (G, me) => G.players[me.owner].order.filter(i => mf(G, me, G.cards[i], F || {}));   // put cards from my order zone into drop: ['ozd', n, F, min]
      return { label: 'นำ' + thF(F || {}, 0).trim() + 'จากออเดอร์โซนลงดรอป' + (n >= 99 ? ' ' + mn + ' ใบขึ้นไป' : ' ' + n + ' ใบ'), can: (G, me) => src(G, me).length >= mn, *pay(G, me) { const s0 = src(G, me); const sel = yield* G.chooseCards(me.owner, s0, { min: mn, max: Math.min(n, s0.length), title: 'คอสต์: นำการ์ดจากออเดอร์โซนลงดรอป', hint: 'discard', zone: 'order', noAuto: true }); for (const i of sel) G.move(i, 'drop', { reason: 'cost' }); return sel; } }; }
    case 'fin': return { label: 'ประกาศ Final Phase', can: (G, me) => true, *pay(G, me) { G.tf['fin' + me.owner] = 1; G.players[me.owner].fight.imp = 1; G.log('ประกาศ Final Phase!', me.owner); G.tlog({ k: 'cost', kind: 'fin', p: me.owner, by: me.iid }); return 1; } };   // declare the final phase (impact)
    case 'gzc': { const [, n, F, froms, kind, o0] = k; const o = o0 || {}; const dest = (o.fd ? 'gzfd:' : 'gz:') + kind + (o.host ? ':me' : '');   // put cards as a gauge: ['gzc', n, F, [zones | 'rc'], kind, { self: 1, host: 1, fd: 1, min, inc }]
      if (o.self) return { label: 'นำการ์ดนี้ไปเป็น' + gkTh(kind) + (o.fd ? ' แบบคว่ำหน้า' : ''), can: (G, me) => me.zone !== 'gauge' && me.zone !== 'gone' && G.canGauge(me.owner, kind), *pay(G, me) { G.move(me.iid, dest, { reason: 'cost' }); return [me.iid]; } };
      const src = (G, me) => froms.flatMap(z => (z === 'rc' ? G.rcs(me.owner).map(c => c.iid) : z === 'top' ? G.players[me.owner].deck.slice(0, 1) : G.players[me.owner][z]).filter(i => (o.inc || i !== me.iid) && mf(G, me, G.cards[i], F || {}))); const mn = o.min != null ? o.min : n;
      const label = 'นำ' + thF(F || {}, n) + 'จาก' + froms.map(z => ZONE_TH[z] || z).join('/') + 'ไปเป็น' + gkTh(kind) + (o.host ? 'ของการ์ดนี้' : '') + (o.fd ? ' แบบคว่ำหน้า' : '') + (o.min != null ? ' (อย่างน้อย ' + o.min + ' ใบ)' : '');
      return { label, can: (G, me) => src(G, me).length >= mn && G.canGauge(me.owner, kind), *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: mn, max: n, title: 'คอสต์: ' + label, hint: 'discard', zone: 'mixed', noAuto: o.min != null }); for (const i of sel) G.move(i, dest, { reason: 'cost' }); return sel; } }; }
    case 'sb': return C.SB(k[1]);
    case 'bsd': return { label: 'ทิ้งการ์ด ' + k[1] + ' ใบจากบัดดี้โซลของการ์ดนี้', can: (G, me) => G.gaugeOf(me.iid, 'bs').length >= k[1], *pay(G, me) { const L = G.gaugeOf(me.iid, 'bs'); const sel = yield* G.chooseCards(me.owner, L, { min: k[1], max: k[1], title: 'คอสต์: ทิ้งการ์ดจากบัดดี้โซล', hint: 'discard', zone: 'mixed' }); for (const i of sel) G.move(i, 'drop', { reason: 'cost' }); return sel; } };
    case 'td': return { label: 'นำการ์ดบนสุดของเด็ค ' + k[1] + ' ใบไปดาเมจโซน', can: (G, me) => gsLessOn(G, me) || G.players[me.owner].deck.length >= k[1], *pay(G, me) { const ids = gsLessOn(G, me) ? [] : G.players[me.owner].deck.slice(0, k[1]); for (const i of ids) G.move(i, 'damage', { reason: 'cost' }); return ids; } };   // put the top n cards of your deck into your damage zone
    case 'eb': return C.EB(k[1]);
    /* a way of paying that is only open under a condition: ['if', cond, [costs]] (used inside 'alt') */
    case 'if': { const a = allOf(k[2].map(mkCost)); const ok = (G, me, e) => ev(G, mkCtx(me, e), k[1]); return { label: a.label + ' (ถ้า' + thC(k[1]) + ')', can: (G, me, e) => ok(G, me, e) && a.can(G, me, e), pay: a.pay }; }
    case 'alt': { const a = allOf(k[1].map(mkCost)), b = allOf(k[2].map(mkCost)); return { label: a.label + ' หรือ ' + b.label, can: (G, me, e) => a.can(G, me, e) || b.can(G, me, e), *pay(G, me, e) { const ca = a.can(G, me, e), cb = b.can(G, me, e); let pick = ca ? a : b; if (ca && cb && !/^ ?\(ถ้า/.test(a.label)) { const id = yield* G.chooseOption(me.owner, 'เลือกวิธีจ่ายคอสต์', [{ id: 'a', label: a.label }, { id: 'b', label: b.label }], { iid: me.iid }); pick = id === 'b' ? b : a; } return yield* pick.pay(G, me, e); } }; }
    case 'self': {
      const w = k[1];
      const L = { mbox: 'นำการ์ดนี้เข้า Monster BOX', soul: 'นำการ์ดนี้เข้าโซล', retire: 'รีไทร์ยูนิทนี้', bind: 'ไบนด์การ์ดนี้', rest: 'เรสต์ยูนิทนี้', drop: 'นำการ์ดนี้ลงดรอป', bottom: 'นำการ์ดนี้ไว้ล่างสุดของเด็ค', removed: 'นำการ์ดนี้ออกจากเกม', ridefu: 'นำการ์ดนี้กลับไรด์เด็คแบบหงายหน้า', bindfd: 'ไบนด์การ์ดนี้แบบคว่ำหน้า', damage: 'นำยูนิทนี้ไปวางในดาเมจโซน', hand: 'นำยูนิทนี้กลับขึ้นมือ', order: 'นำการ์ดนี้ไปวางในออเดอร์โซน', reveal: 'เปิดเผยการ์ดนี้' }[w];
      if (w === 'lock') return { label: 'ล็อคยูนิทนี้', can: (G, me) => me.zone === 'RC' && !me.locked, *pay(G, me) { G.lock(me.iid); return 1; } };
      if (w === 'reveal') return { label: L, can: () => true, *pay(G, me) { G.ev('reveal', { iid: me.iid, p: me.owner }); return 0; } };
      return { label: L, can: (G, me) => (w === 'retire' ? me.zone === 'RC' : w === 'rest' ? (me.zone === 'RC' || me.zone === 'VC' || me.zone === 'order') && !me.rest && !G.noRestFor(me) : w === 'hand' ? me.zone === 'RC' : me.zone !== w && me.zone !== 'gone' && me.zone !== 'VC'),
        *pay(G, me) { if (w === 'retire') G.retire(me.iid, 'cost'); else if (w === 'rest') { if (me.zone === 'order') { me.rest = true; G.tlog({ k: 'orest', iid: me.iid, no: me.no, p: me.owner, by: me.iid }); } else G.restUnit(me.iid); } else if (w === 'bottom') G.move(me.iid, 'deck', { bottom: true, reason: 'cost' }); else G.move(me.iid, w, { reason: w === 'drop' && me.zone === 'hand' ? 'discard' : 'cost' }); return 1; } };
    }
    case 'disc': return Object.assign(C.discard(k[1], Object.keys(k[2]).length ? (G, c) => mf(G, c, c, k[2]) || (k[2].ty === 'o' && !!G.def(c).discOrd && mf(G, c, c, Object.assign({}, k[2], { ty: null }))) : null), { label: 'ทิ้ง' + thF(k[2], k[1]) + 'จากมือ' });   // def.discOrd: may be discarded as an order card
    case 'rrgd': { const src = (G, me) => G.rcs(me.owner).filter(c => c.iid !== me.iid && mf(G, me, c, k[2] || {})).map(c => c.iid);   // ['rrgd', n, F]: retire 1 to n of your rear-guards with different card names
      return { label: 'รีไทร์เรียร์การ์ด' + thFtail(k[2] || {}) + ' ชื่อไม่ซ้ำกัน 1–' + k[1] + ' ใบ', can: (G, me) => src(G, me).length >= 1, *pay(G, me) { const sel = yield* pickDistinct(G, { p: me.owner }, src(G, me), k[1], false, { title: 'คอสต์: รีไทร์เรียร์การ์ด', hint: 'discard', zone: 'field' }); for (const i of sel) G.retire(i, 'cost'); return sel; } }; }
    case 'h2s': case 'd2b': case 'rrg': case 'rg2s': case 'rrest': {
      const n = k[1]; const F = k[0] === 'rrest' ? (k[2] ? { ot: 1 } : {}) : k[2];
      const src0 = (G, me) => (k[0] === 'h2s' ? G.handFor(me.owner).filter(i => i !== me.iid) : k[0] === 'd2b' ? G.players[me.owner].drop.filter(i => i !== me.iid) : G.rcs(me.owner).filter(c => k[0] !== 'rrest' || !c.rest).map(c => c.iid)).filter(i => mf(G, me, G.cards[i], F));
      const src = (G, me) => (k[0] === 'rrg' ? src0(G, me).concat(plantAlt(G, me, F)) : src0(G, me));
      const label = { h2s: 'นำ' + thF(F, n) + 'จากมือเข้าโซล', d2b: 'นำ' + thF(F, n) + 'จากดรอปไว้ล่างสุดของเด็ค', rrg: 'รีไทร์เรียร์การ์ด' + thFtail(F) + ' ' + n + ' ใบ', rg2s: 'นำเรียร์การ์ด' + thFtail(F) + ' ' + n + ' ใบเข้าโซล', rrest: 'เรสต์เรียร์การ์ด ' + n + ' ใบ' }[k[0]];
      const dk = { rrg: 'retire', rg2s: 'soul' }[k[0]] || 'none';
      return { label, can: (G, me) => G.dblCan(me, dk, src(G, me), n),
        *pay(G, me) {
          const sel = yield* G.dblChoose(me, dk, src(G, me), n, { title: 'คอสต์: ' + label, hint: 'discard', zone: k[0] === 'h2s' ? 'hand' : k[0] === 'd2b' ? 'drop' : src(G, me).some(i => G.cards[i].zone === 'gauge') ? 'mixed' : 'field' });
          for (const i of sel) { if (k[0] === 'h2s' || k[0] === 'rg2s') G.move(i, 'soul', { reason: 'cost' }); else if (k[0] === 'd2b') G.move(i, 'deck', { bottom: true, reason: 'cost' }); else if (k[0] === 'rrg') { if (G.cards[i].zone === 'gauge') G.move(i, 'drop', { reason: 'cost' }); else G.retire(i, 'cost'); } else G.restUnit(i); }
          return sel;
        } };
    }
    case 'trio': { const names = k[1]; const cand = (G, me, nm) => G.rcs(me.owner).filter(u => G.def(u).name.includes(nm)).map(u => u.iid).concat(G.players[me.owner].drop.filter(i => G.def(G.cards[i]).type === 'unit' && G.def(G.cards[i]).name.includes(nm)));   // ['trio', [name parts]]: one unit card for each name part from (RC) (1+) and drop (up to 2) to the bottom of the deck
      const ok = (G, me, k0, used, rc) => { if (k0 === names.length) return rc; for (const i of cand(G, me, names[k0])) if (!used.includes(i) && ok(G, me, k0 + 1, used.concat(i), rc || G.cards[i].zone === 'RC')) return true; return false; };
      return { label: 'นำยูนิท ' + names.map(n => '"' + n + '"').join(', ') + ' อย่างละ 1 ใบจาก RC (1 ใบขึ้นไป) และดรอป (ไม่เกิน 2 ใบ) ไว้ล่างสุดของเด็ค', can: (G, me) => ok(G, me, 0, [], false),
        *pay(G, me) { const sel = []; let rc = false; for (let j = 0; j < names.length; j++) { let L = cand(G, me, names[j]).filter(i => !sel.includes(i) && ok(G, me, j + 1, sel.concat(i), rc || G.cards[i].zone === 'RC')); const [i] = yield* G.chooseCards(me.owner, L, { min: 1, max: 1, title: 'คอสต์: เลือกการ์ด "' + names[j] + '"', hint: 'discard', zone: 'mixed' }); if (i == null) return sel; sel.push(i); if (G.cards[i].zone === 'RC') rc = true; } for (const i of sel) G.move(i, 'deck', { bottom: true, reason: 'cost' }); return sel; } }; }
    case 'gzfu': { const src = (G, me) => G.players[me.owner].gzone.filter(i => !G.cards[i].faceup && mf(G, me, G.cards[i], k[1] || {})); return { label: 'หงายการ์ด' + thF(k[1] || {}, 0).trim() + 'ใน G โซน 1 ใบ', can: (G, me) => src(G, me).length >= 1, *pay(G, me) { const [i] = yield* G.chooseCards(me.owner, src(G, me), { min: 1, max: 1, title: 'คอสต์: หงายการ์ดใน G โซน', hint: 'discard', zone: 'gzone' }); if (i != null) G.cards[i].faceup = true; return i != null ? [i] : []; } }; }   // turn a face-down G zone card face up
    case 'bsdeck': { const src = (G, me) => G.gaugeOf(me.iid, 'bs'); return { label: 'คืนบัดดี้โซลของยูนิทนี้กี่ใบก็ได้เข้าเด็คแล้วสับ', can: () => true, *pay(G, me) { const s0 = src(G, me); const sel = s0.length ? yield* G.chooseCards(me.owner, s0, { min: 0, max: s0.length, title: 'คอสต์: เลือกบัดดี้โซลที่จะคืนเข้าเด็ค', hint: 'discard', zone: 'mixed', noAuto: true }) : []; for (const i of sel) G.move(i, 'deck', { reason: 'cost' }); if (sel.length) G.shuffle(me.owner); return sel; } }; }   // return any number of this unit's buddy soul to the deck
    case 'dhand': return { label: 'ทิ้งการ์ดทั้งหมดในมือ (1 ใบขึ้นไป)', can: (G, me) => G.players[me.owner].hand.length >= 1, *pay(G, me) { const sel = G.players[me.owner].hand.slice(); for (const i of sel) G.move(i, 'drop', { reason: 'discard' }); return sel; } };   // discard your whole hand (at least one card)
    case 'ofd': { const src = (G, me) => G.players[me.owner].order.filter(i => G.cards[i].faceup && mf(G, me, G.cards[i], k[1] || {}));   // ['ofd', F]: turn any number of face-up cards in your order zone face down
      return { label: 'คว่ำหน้า' + thF(k[1] || {}, 0) + 'ในออเดอร์โซนกี่ใบก็ได้', can: () => true,
        *pay(G, me) { const s0 = src(G, me); const sel = s0.length ? yield* G.chooseCards(me.owner, s0, { min: 0, max: s0.length, title: 'คอสต์: เลือกการ์ดในออเดอร์โซนที่จะคว่ำหน้า (กี่ใบก็ได้)', hint: 'discard', zone: 'order', noAuto: true }) : []; for (const i of sel) G.cards[i].faceup = false; if (sel.length && me.zone === 'VC') (G.tf['ofdv' + me.owner] = G.tf['ofdv' + me.owner] || []).push({ n: sel.length, nm: G.def(me).name, g: G.grade(me) }); return sel; } }; }
    case 'zc': {
      /* ['zc', n, F, from zone(s) (also 'rc'), to, 'inc' = this card may be one of them]; F.dist = different card names */
      const [, n, F, from0, to, inc, zmin] = k; const froms = Array.isArray(from0) ? from0 : [from0]; const from = froms.length === 1 ? froms[0] : 'multi';
      const src = (G, me) => froms.flatMap(z => (z === 'rc' ? G.rcs(me.owner).map(c => c.iid) : G.players[me.owner][z]).filter(i => (inc || i !== me.iid) && mf(G, me, G.cards[i], F)));
      if (F && F.distg) return { label: 'นำ' + thF(F, n) + 'จาก' + froms.map(z => ZONE_TH[z] || z).join('/') + ({ soul: 'เข้าโซล', drop: (from === 'soul' ? ' (โซลบลาสต์)' : 'ลงดรอป'), bind: 'ไปไบนด์', removed: 'ออกจากเกม', hand: 'ขึ้นมือ', top: 'ไว้บนสุดของเด็ค', bottom: 'ไว้ล่างสุดของเด็ค', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', bindfd: 'ไปไบนด์แบบคว่ำหน้า', damage: 'ไปดาเมจโซน', damagefd: 'ไปดาเมจโซนแบบคว่ำหน้า', order: 'ไปออเดอร์โซน', mbox: 'เข้า Monster BOX แบบหงาย', memory: 'เข้าเมมโมรี่' }[to] || ''), can: (G, me) => new Set(src(G, me).map(i => (F.wild && G.def(G.cards[i]).name.includes(F.wild) ? 'w' + i : G.def(G.cards[i]).grade || 0))).size >= n,
        *pay(G, me) { const sel = yield* pickDistinct(G, { p: me.owner }, src(G, me), n, false, { title: 'คอสต์ (เกรดไม่ซ้ำกัน)', hint: 'discard', zone: from, wild: F.wild }, true); for (const i of sel) { const fz = G.cards[i].zone; if (to === 'top' || to === 'bottom') G.move(i, 'deck', { bottom: to === 'bottom', reason: 'cost' }); else G.move(i, to, { reason: fz === 'soul' && to === 'drop' ? 'sb' : 'cost' }); } if (from === 'soul' && to === 'drop') { G.emit('sbcost', { p: me.owner, n: sel.length, by: me.iid }); G.tlog({ k: 'cost', kind: 'sb', n: sel.length, p: me.owner, by: me.iid }); } return sel; } };
      if (F && F.dist) return { label: 'นำ' + thF(F, n) + 'จาก' + froms.map(z => ZONE_TH[z] || z).join('/') + { soul: 'เข้าโซล', drop: 'ลงดรอป', bind: 'ไปไบนด์', removed: 'ออกจากเกม', hand: 'ขึ้นมือ', top: 'ไว้บนสุดของเด็ค', bottom: 'ไว้ล่างสุดของเด็ค', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', bindfd: 'ไปไบนด์แบบคว่ำหน้า', damage: 'ไปดาเมจโซน', damagefd: 'ไปดาเมจโซนแบบคว่ำหน้า', order: 'ไปออเดอร์โซน', mbox: 'เข้า Monster BOX แบบหงาย', memory: 'เข้าเมมโมรี่' }[to], can: (G, me) => nameCount(G, src(G, me).map(i => G.cards[i])) >= n,
        *pay(G, me) { const sel = yield* pickDistinct(G, { p: me.owner }, src(G, me), n, false, { title: 'คอสต์', hint: 'discard', zone: 'mixed' }); for (const i of sel) { if (to === 'top' || to === 'bottom') G.move(i, 'deck', { bottom: to === 'bottom', reason: 'cost' }); else G.move(i, to, { reason: 'cost' }); } return sel; } };
      const label = (from === 'soul' && to === 'drop' ? 'โซลบลาสต์' : to === 'bind' ? 'ไบนด์' : to === 'removed' ? 'นำออกจากเกม' : 'นำ') + thF(F, n) + (from === 'soul' && to === 'drop' ? '' : 'จาก' + froms.map(z => ZONE_TH[z]).join('/') + (to === 'bind' || to === 'removed' ? '' : { soul: 'เข้าโซล', drop: 'ลงดรอป', hand: 'ขึ้นมือ', top: 'ไว้บนสุดของเด็ค', bottom: 'ไว้ล่างสุดของเด็ค', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', bindfd: 'ไปไบนด์แบบคว่ำหน้า', damage: 'ไปดาเมจโซน', damagefd: 'ไปดาเมจโซนแบบคว่ำหน้า', order: 'ไปออเดอร์โซน', mbox: 'เข้า Monster BOX แบบหงาย', memory: 'เข้าเมมโมรี่' }[to]));
      if (n === 'all') { const lab = 'นำการ์ดทั้งหมด' + (F && Object.keys(F).length ? ' (' + thF(F, 0).trim() + ')' : '') + 'จาก' + froms.map(z => ZONE_TH[z] || z).join('/') + ({ soul: 'เข้าโซล', drop: 'ลงดรอป', bind: 'ไปไบนด์', removed: 'ออกจากเกม', hand: 'ขึ้นมือ', top: 'ไว้บนสุดของเด็ค', bottom: 'ไว้ล่างสุดของเด็ค', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', bindfd: 'ไปไบนด์แบบคว่ำหน้า', damage: 'ไปดาเมจโซน', damagefd: 'ไปดาเมจโซนแบบคว่ำหน้า', order: 'ไปออเดอร์โซน', mbox: 'เข้า Monster BOX แบบหงาย', memory: 'เข้าเมมโมรี่' }[to] || ''); return { label: lab, can: () => true, *pay(G, me) { const sel = src(G, me).slice(); for (const i of sel) { if (to === 'top' || to === 'bottom') G.move(i, 'deck', { bottom: to === 'bottom', reason: 'cost' }); else { const fz = G.cards[i].zone; G.move(i, to, { reason: fz === 'soul' && to === 'drop' ? 'sb' : fz === 'hand' && to === 'drop' ? 'discard' : 'cost' }); } } if (from === 'soul' && to === 'drop') { G.emit('sbcost', { p: me.owner, n: sel.length, by: me.iid }); G.tlog({ k: 'cost', kind: 'sb', n: sel.length, p: me.owner, by: me.iid }); } return sel; } }; }
      const nOf = (G, me, use) => (to === 'removed' && typeof n === 'number' ? Math.max(0, n - VG.lessFor(G, me, 'rem', use)) : n);   // "reduce the number of cards you remove for that cost"
      return { label, can: (G, me) => src(G, me).length >= (zmin != null ? zmin : nOf(G, me)), *pay(G, me) { const n1 = nOf(G, me, true); const sel = n1 === 0 ? [] : yield* G.chooseCards(me.owner, src(G, me), { min: zmin != null ? zmin : n1, max: n1, title: 'คอสต์: ' + label, hint: 'discard', zone: from, noAuto: zmin != null });
 for (const i of sel) { if (to === 'top' || to === 'bottom') G.move(i, 'deck', { bottom: to === 'bottom', reason: 'cost' }); else { const fz = G.cards[i].zone; G.move(i, to, { reason: fz === 'soul' && to === 'drop' ? 'sb' : fz === 'hand' && to === 'drop' ? 'discard' : 'cost' }); } } if (from === 'soul' && to === 'drop') { G.emit('sbcost', { p: me.owner, n: sel.length, by: me.iid }); G.tlog({ k: 'cost', kind: 'sb', n: sel.length, p: me.owner, by: me.iid }); } return sel; } };
    }
    /* rest n cards of your order zone: ['orest', n, F] */
    case 'orest': { const src = (G, me) => G.players[me.owner].order.filter(i => !G.cards[i].rest && mf(G, me, G.cards[i], k[2])); return { label: 'เรสต์' + thF(k[2], k[1]) + 'ในออเดอร์โซน', can: (G, me) => src(G, me).length >= k[1], *pay(G, me) { const sel = yield* G.chooseCards(me.owner, src(G, me), { min: k[1], max: k[1], title: 'คอสต์: เรสต์การ์ดในออเดอร์โซน', hint: 'discard', zone: 'order' }); for (const i of sel) { G.cards[i].rest = true; G.tlog({ k: 'orest', iid: i, no: G.cards[i].no, p: me.owner, by: me.iid }); } return sel; } }; }
    case 'mill': return { label: 'ทิ้งการ์ด ' + k[1] + ' ใบบนสุดของเด็ค', can: (G, me) => G.players[me.owner].deck.length >= k[1], *pay(G, me) { const out = []; for (let i = 0; i < k[1]; i++) { const t = G.players[me.owner].deck[0]; if (t == null) break; out.push(t); G.move(t, 'drop', { reason: 'discard' }); } return out; } };
    case 'rgc': {
      /* ['rgc', n (99 = any number), F, how (rest hand bottom bind retire soul stand), 'u' = any unit incl. the vanguard, min] */
      const [, n, F, how, kind, min0] = k; const all = min0 === 'all'; const min = all ? 0 : min0 != null ? min0 : n >= 99 ? 0 : n;
      if (all) { const srcA = (G, me) => (kind === 'u' ? G.units(me.owner) : G.rcs(me.owner)).filter(c => mf(G, me, c, F)).map(c => c.iid); const lab = { hand: 'นำกลับขึ้นมือ', retire: 'รีไทร์', soul: 'นำเข้าโซล', bottom: 'นำไว้ล่างสุดของเด็ค', bind: 'ไบนด์', rest: 'เรสต์' }[how] + 'เรียร์การ์ด' + thFtail(F) + 'ทั้งหมด';
        return { label: lab, can: () => true, *pay(G, me) { const sel = srcA(G, me); for (const i of sel) { if (how === 'rest') G.restUnit(i); else if (how === 'retire') G.retire(i, 'cost'); else if (how === 'bottom') G.move(i, 'deck', { bottom: true, reason: 'cost' }); else G.move(i, how, { reason: how === 'hand' ? 'bounce' : 'cost' }); } return sel; } }; }
      const src = (G, me) => (kind === 'u' ? G.units(me.owner) : G.rcs(me.owner)).filter(c => (how !== 'rest' || !c.rest) && (how !== 'stand' || c.rest) && mf(G, me, c, F)).map(c => c.iid);
      const label = { mbox: 'นำเข้า Monster BOX', rest: 'เรสต์', hand: 'นำกลับขึ้นมือ', bottom: 'นำไว้ล่างสุดของเด็ค', bindfd: 'ไบนด์แบบคว่ำหน้า', bind: 'ไบนด์', retire: 'รีไทร์', soul: 'นำเข้าโซล', stand: 'สแตนด์' }[how] + (kind === 'u' ? 'ยูนิท' : 'เรียร์การ์ด') + thFtail(F) + (n >= 99 ? (min ? ' ' + min + ' ใบขึ้นไป' : ' กี่ใบก็ได้') : ' ' + n + ' ใบ');
      const w2 = (G, me, i) => (how === 'retire' && G.def(G.cards[i]).rt2 && me.zone === 'VC' && mf(G, me, me, G.def(G.cards[i]).rt2) ? 2 : 1);   // def.rt2: may be retired as two units for the cost of such a vanguard's ability
      if (n < 99) { const anyW = (G, me) => src(G, me).some(i => w2(G, me, i) === 2); const lab2 = label; const base2 = { label: lab2, can: (G, me) => src(G, me).reduce((s, i) => s + w2(G, me, i), 0) >= min, *pay(G, me) { if (!anyW(G, me)) { const list = src(G, me); const sel = yield* G.chooseCards(me.owner, list, { min, max: Math.min(n, list.length), title: 'คอสต์: ' + lab2, hint: 'discard', zone: 'field' }); for (const i of sel) G.retire(i, 'cost'); return sel; } const sel = []; let need = n; while (need > 0) { const list = src(G, me).filter(i => !sel.includes(i)); if (!list.length) break; const [i] = yield* G.chooseCards(me.owner, list, { min: 1, max: 1, title: 'คอสต์: ' + lab2 + ' (เหลือ ' + need + ')', hint: 'discard', zone: 'field' }); if (i == null) break; need -= w2(G, me, i); sel.push(i); } for (const i of sel) G.retire(i, 'cost'); return sel; } }; if (how === 'retire') return base2; }
      return { label, can: (G, me) => src(G, me).length >= min, *pay(G, me) { const list = src(G, me); const sel = yield* G.chooseCards(me.owner, list, { min, max: Math.min(n, list.length), title: 'คอสต์: ' + label, hint: 'discard', zone: 'field', noAuto: n >= 99 }); for (const i of sel) { if (how === 'rest') G.restUnit(i); else if (how === 'stand') G.standUnit(i); else if (how === 'retire') G.retire(i, 'cost'); else if (how === 'bottom') G.move(i, 'deck', { bottom: true, reason: 'cost' }); else G.move(i, how, { reason: how === 'hand' ? 'bounce' : 'cost' }); } return sel; } };
    }
    case 'rride': case 'rhand': { const z = k[0] === 'rride' ? 'ride' : 'hand'; const F0 = k[1]; const F = z === 'hand' && F0 && F0.g && F0.g[0] <= 3 && F0.g[1] >= 3 ? { or: [F0, Object.assign({}, F0, { g: null, rv3: 1 })] } : F0; return { label: 'เปิดเผย' + thF(F, k[2] || 1) + 'จาก' + ZONE_TH[z], can: (G, me) => G.dblCan(me, z === 'hand' ? 'rvh' : 'none', G.players[me.owner][z].filter(i => i !== me.iid && mf(G, me, G.cards[i], F)), k[2] || 1), *pay(G, me) { const c = G.players[me.owner][z].filter(i => i !== me.iid && mf(G, me, G.cards[i], F)); const sel = z === 'hand' ? yield* G.dblChoose(me, 'rvh', c, k[2] || 1, { title: 'เลือกการ์ดที่จะเปิดเผย', hint: 'reveal', zone: 'hand' }) : c.slice(0, k[2] || 1); for (const x of sel) { G.ev('reveal', { iid: x, p: me.owner }); G.tlog({ k: 'rev', iid: x, no: G.cards[x].no, p: me.owner, by: me.iid }); } return sel; } }; }
  }
  throw new Error('fx: unknown cost ' + k[0]);
}

/* ---------- steps ---------- */
function hintFor(next, own) {
  if (!next) return own ? 'buff' : 'retireOpp';
  const k = next[0];
  if (k === 'rt' || (k === 'to' && (next[2] === 'drop' || next[2] === 'soul' || next[2] === 'bind' || next[2] === 'bottom'))) return own ? 'discard' : 'retireOpp';
  if (k === 'to' && next[2] === 'hand') return own ? 'bounce' : 'retireOpp';
  if (k === 'st') return 'max';
  if (k === 'lock') return 'lockOpp';
  return own ? 'buff' : 'retireOpp';
}
function* moveTo(G, ctx, iid, dest, reveal) {
  const c = G.cards[iid]; if (!c || c.zone === 'gone') return false;
  if (c.zone === 'RC' && !isField(dest === 'tb' ? 'deck' : dest) && dest !== 'dress' && (yield* G.wouldLeave(iid))) return false;
  if (c.zone === 'RC' && c.owner !== ctx.me.owner && !c.locked && (G.stat(c).stayRC || G.stat(c).immune)) { G.log(G.name(c) + ' ไม่ถูกนำออกจาก RC ด้วยเอฟเฟกต์ของคู่ต่อสู้', c.owner); return false; }
  if (c.zone === 'RC' && c.owner !== ctx.me.owner && ['top', 'bottom', 'deck', 'tb', 'bind', 'bindfd'].includes(dest)) { const o = G.ozKey(c.owner, 'saien'); if (o && G.def(c).name.includes(o.nh)) { for (const di of (c.dress || []).slice()) if (G.cards[di] && G.def(G.cards[di]).name.includes(o.tk)) G.move(di, 'hand', { reason: 'effect' }); G.move(iid, 'drop', { reason: 'effect' }); G.log(G.name(c) + ' ลงดรอปแทน (originalDress "' + o.tk + '" ขึ้นมือ)', c.owner); return true; } }
  if (dest === 'tb') dest = (yield* G.chooseOption(ctx.p, 'นำ ' + G.name(c) + ' ไว้ที่ไหน?', [{ id: 'top', label: 'บนสุดของเด็ค' }, { id: 'bottom', label: 'ล่างสุดของเด็ค' }], { iid })) || 'top';
  ctx.where = dest;
  if (reveal) G.ev('reveal', { iid, p: c.owner });
  const from = c.zone; ctx.fromZ = from;
  if (dest === 'top' || dest === 'bottom') ctx.looked = ctx.looked.filter(x => x !== iid);   // placed by choice: no longer one of "the rest"
  if (dest === 'top') G.move(iid, 'deck', { reason: 'effect' });
  else if (dest === 'bottom') G.move(iid, 'deck', { bottom: true, reason: 'effect' });
  else if (dest === 'drop') { if (from === 'RC' || from === 'GC') G.retire(iid, 'effect', ctx.me.iid); else G.move(iid, 'drop', { reason: from === 'hand' || from === 'deck' ? 'discard' : 'effect' }); }
  else if (dest === 'hand') G.move(iid, 'hand', { reason: from === 'RC' ? 'bounce' : from === 'deck' ? 'search' : 'effect' });
  else if (dest === 'dropnr') G.move(iid, 'drop', { reason: 'effect' });   // put into drop (not a retire)
  else if (dest === 'bindfd') { G.move(iid, 'bind', { reason: 'effect' }); if (c.zone === 'bind') c.faceup = false; }   // bound face down
  else if (dest === 'dress') { if (!isField(ctx.me.zone) || iid === ctx.me.iid) return false; G.move(iid, 'dress', { host: ctx.me.iid, reason: 'effect' }); }   // as an originalDress of this unit
  else if (typeof dest === 'string' && dest.startsWith('gz') && dest !== 'gzone') { const [a, kind, hs] = dest.split(':'); const host = hs ? gzHost(ctx, hs) : null; if (hs && host == null) return false; if (!G.toGauge(iid, kind, host, a === 'gzfd')) return false; }   // as a gauge: 'gz:kind' | 'gzfd:kind' (+ ':me' | ':it' | ':h' = of this card / the chosen unit / the unit kept as "h")
  else if (G.move(iid, dest, { reason: 'effect' }) === false) return false;
  return true;
}
function* callOne(G, ctx, iid, o) {
  const c = G.cards[iid]; if (!c || c.zone === 'gone') return false; const d = G.def(c); const p = c.owner;
  if (!(d.type === 'unit' || d.type === 'token' || (o.asu && d.type === 'order'))) return false;
  if (d.noCall && !o.gc && iid !== ctx.me.iid && !G.tf['ncont' + iid]) return false;
  if (d.mateVg && !(G.vg(p) && G.def(G.vg(p)).name.includes(d.mateVg))) return false;
  if (c.zone === 'drop' && G.tf['ncd' + p]) return false;   // "you cannot call cards from drop this turn"   // "cannot be called other than by this card's own ability"
  { const vd = G.def(G.vg(p)); if (vd.callFilter && !o.gc && !mf(G, c, c, vd.callFilter)) return false; }
  { const of = G.players[p].order.map(i => G.def(G.cards[i]).ozCallF).find(Boolean); if (of && !o.gc && !mf(G, c, c, of)) return false; }
  if (d.callBar && !o.gc && d.callBar(G, c)) return false;
  if (o.gc) { if (!G.battle || G.active === p) return false; G.battle.guards++; G.move(iid, 'GC', { reason: 'effect' }); return true; }
  let circles = RCS.filter(k => { const x = G.at(p, k); return (!x || !x.locked) && (!x || x.iid !== iid); });
  if (o.open) circles = circles.filter(k => !G.at(p, k));
  if (o.col) circles = circles.filter(k => COL[k] === COL[ctx.me.pos] && ctx.me.owner === p);
  if (o.row) circles = circles.filter(k => (o.row === 'f' ? FRONT : BACK).includes(k));
  if (o.pos) circles = circles.filter(k => k === o.pos);
  if (o.onv) { const u = G.cards[((ctx.v || {})['$' + o.onv] || [])[0]]; circles = u && u.pos && u.owner === p ? circles.filter(k => k === u.pos) : []; }   // onto the circle of the unit kept under that name (it is replaced)
  if (o.mypos) circles = circles.filter(k => k === ctx.me.pos && ctx.me.owner === p);   // onto the circle this unit is on (it is replaced)
  if (o.last) circles = circles.filter(k => k === ctx.me.lastPos);   // the circle this unit was on
  if (o.colevt) { const u = ctx.evt && ctx.evt.iid != null ? G.cards[ctx.evt.iid] : null; circles = u && u.pos && u.owner === p ? circles.filter(k => COL[k] === COL[u.pos]) : []; }   // the column of the unit that was just placed
  if (o.colf) { const cols = G.units(p).filter(u => u.iid !== iid && mf(G, ctx.me, u, o.colf)).map(u => COL[u.pos]); circles = circles.filter(k => cols.includes(COL[k])); }   // the column of one of your units matching a filter
  if (o.scol && ctx.colUsed) circles = circles.filter(k => COL[k] === ctx.colUsed);   // every call into the same column
  if (o.drow && ctx.rowsUsed && ctx.rowsUsed.length) circles = circles.filter(k => !ctx.rowsUsed.includes(FRONT.includes(k) ? 'f' : 'b'));   // each call into a different row
  if (d.onlyBC) circles = circles.filter(k => k === 'BC');
  if (!o.gc && G.bcBlocked(p)) circles = circles.filter(k => k !== 'BC');
  if (o.mk) circles = circles.filter(k => G.markerCount(p, k, o.mk) > 0);   // only onto a circle with that marker
  if (!circles.length) return false;
  const circle = yield* G.chooseCircle(p, circles, { title: 'คอล ' + d.name + ' ลงเซอร์เคิลไหน?', hint: o.rest ? 'callTokenBack' : 'callToken', noAuto: circles.length > 1 });
  if (!circle) return false;
  G.log('คอล ' + d.name, p);
  G.placeRC(iid, circle, { reason: 'call', rest: !!o.rest, repl: o.repl, silent: !!o.na || !!G.def(ctx.me).callNa });   // na: the called unit's own "when placed" abilities do not trigger
  if (o.drow) (ctx.rowsUsed = ctx.rowsUsed || []).push(FRONT.includes(circle) ? 'f' : 'b'); if (o.scol) ctx.colUsed = COL[circle];
  return true;
}
const PFX_TH = { noAutoP: 'ใช้สกิล AUTO ของการ์ดตัวเองไม่ได้', rideTax: 'ตอนเริ่มไรด์เฟส เลือกการ์ดในมือ 1 ใบแล้วทิ้งได้ ถ้าไม่ทิ้ง ไรด์และสไตรด์ไม่ได้จนจบเทิร์น', personaBack: 'เพอร์โซน่าไรด์ของคุณเพิ่มพลังให้ยูนิทแถวหลังด้วย', jailNa: 'เมื่อคู่ต่อสู้คอลยูนิทด้วยสกิลของพริซันของคุณ AUTO ของยูนิทนั้นไม่ทำงานจากการคอลนั้น', noTrigPwB: 'เพิ่มพลังด้วยเอฟเฟกต์ทริกเกอร์ที่มีไอคอนเดียวกับการ์ดในไบนด์โซนของคู่ต่อสู้ไม่ได้', rowMv: 'ในเมนเฟส ย้าย/สลับเรียร์การ์ดภายในแถวเดียวกันได้ด้วย', noJail: 'คอลการ์ดออกจากพริซันด้วยความสามารถของพริซันไม่ได้', bindSafe: 'การ์ดในไบนด์โซนของคุณไม่ถูกย้ายด้วยสกิลการ์ดของคู่ต่อสู้', noAutoAll: 'ใช้ AUTO ของการ์ดตัวเองไม่ได้', noBlitz: 'เพลย์บลิทซ์ออเดอร์ไม่ได้', lose7: 'แพ้เมื่อดาเมจถึง 7 ใบ (แทน 6)', bothWings: 'White Wings และ Black Wings ของการ์ดคุณทำงานทั้งคู่', scPlus: 'โซลชาร์จด้วยสกิลการ์ดของคุณเพิ่มขึ้น', rearDrive: 'เรียร์การ์ดของคุณทำไดรฟ์เช็คได้', trigPlus: 'พลังที่ได้จากทริกเกอร์ในไดรฟ์เช็คของคุณเพิ่มขึ้น' };
const X = {
  *draw(G, ctx, s) { ctx.drew = G.draw(ctx.p, nv(G, ctx, s[1])); },
  *sc(G, ctx, s) { const S = G.players[ctx.p].soul; const n0 = S.length; G.soulCharge(ctx.p, nv(G, ctx, s[1])); ctx.it = S.slice(n0); ctx.got = ctx.it.length > 0; ctx.count = ctx.it.length; },
  *cc(G, ctx, s) { G.counterCharge(ctx.p, nv(G, ctx, s[1])); },
  *ec(G, ctx, s) { G.energyCharge(ctx.p, nv(G, ctx, s[1])); },
  /* ----- general building blocks for hand-written lines ----- */
  *set(G, ctx, s) { (ctx.v = ctx.v || {})[s[1]] = nv(G, ctx, s[2]); },
  *keep(G, ctx, s) { (ctx.v = ctx.v || {})['$' + s[1]] = ctx.it.slice(); },                      // remember the chosen cards under a name
  *use(G, ctx, s) { ctx.it = ((ctx.v && ctx.v['$' + s[1]]) || []).slice(); ctx.got = ctx.it.length > 0; },
  *also(G, ctx, s) { ctx.it = [...new Set(ctx.it.concat((ctx.v && ctx.v['$' + s[1]]) || []))]; ctx.got = ctx.it.length > 0; },
  *itf(G, ctx, s) { ctx.it = ctx.it.filter(i => G.cards[i] && mf(G, ctx.me, G.cards[i], s[1])); ctx.got = ctx.it.length > 0; },
  *itg(G, ctx, s) { ctx.it = group(G, ctx, s[1]).slice(); ctx.got = ctx.it.length > 0; },             // "it" = a whole group of units
  *itz(G, ctx, s) { ctx.it = zoneCards(G, ctx, s[1]).filter(i => i !== ctx.me.iid && mf(G, ctx.me, G.cards[i], s[2])); ctx.got = ctx.it.length > 0; },   // "it" = every matching card of the zones
  *itu(G, ctx, s) { const u = unitOf(G, ctx, s[1]); ctx.it = u ? [u.iid] : []; ctx.got = ctx.it.length > 0; },   // "it" = one named unit (vg ovg atk tgt bst evt by me)
  *opp(G, ctx, s) { const c2 = Object.assign({}, ctx, { p: 1 - ctx.p, it: ctx.it.slice(), looked: [], stop: false }); yield* run(G, c2, s[1]); ctx.it = c2.it; ctx.got = c2.got; ctx.count = c2.count; ctx.did = c2.did; },
  *each(G, ctx, s) { const all = ctx.it.slice(); let n = 0; for (const i of all) { ctx.it = [i]; ctx.stop = false; yield* run(G, ctx, s[1]); if (ctx.got) n++; } ctx.it = all; ctx.count = n; },
  *rep(G, ctx, s) { const n = nv(G, ctx, s[1]); for (let i = 0; i < n && !ctx.stop; i++) yield* run(G, ctx, s[2]); },
  *stop(G, ctx) { ctx.stop = true; },
  *itin(G, ctx, s) { ctx.it = ctx.it.filter(i => G.cards[i] && [].concat(s[1]).includes(G.cards[i].zone)); ctx.got = ctx.it.length > 0; },   // of the chosen cards, those still in a zone
  /* reveal cards from the top of the deck until one matches (it = that card; the others are "looked") */
  *rvu(G, ctx, s) { const D = G.players[ctx.p].deck; const need = s[2] != null ? nv(G, ctx, s[2]) : 1; ctx.looked = []; ctx.it = []; if (need > 0) for (const i of D.slice()) { ctx.looked.push(i); G.ev('reveal', { iid: i, p: ctx.p }); if (mf(G, ctx.me, G.cards[i], s[1])) { ctx.it.push(i); G.log('เปิดเผยจนเจอ ' + G.name(G.cards[i]), ctx.p); if (ctx.it.length >= need) break; } } ctx.got = ctx.it.length > 0; },   // ['rvu', F, n]: reveal from the top until n matching cards (default 1) show up

  *persona(G, ctx) { if (G.tf['nopersona' + ctx.p]) return; G.activatePersona(ctx.p); },
  /* for each card the i-th cost took: choose up to one of your rear-guards with the same card name → it */
  *chpd(G, ctx, s) { const x = (ctx.paid || [])[s[1] || 0]; const out = []; for (const i of (Array.isArray(x) ? x : [])) { const nm = G.def(G.cards[i]).name; const pool = G.rcs(ctx.p).filter(u => !out.includes(u.iid) && G.def(u).name === nm).map(u => u.iid); if (!pool.length) continue; const sel = yield* G.chooseCards(ctx.p, pool, { min: 0, max: 1, noAuto: true, title: 'เลือกเรียร์การ์ดชื่อ ' + nm, hint: 'max', zone: 'field' }); if (sel[0]) out.push(sel[0]); } ctx.it = out; ctx.got = out.length > 0; },
  *cbless(G, ctx, s) { for (const i of ctx.it) { const c = G.cards[i]; if (c) c.cbLess = { key: null, t: G.turnNo, n: s[1] || 1 }; } },   // the next counter-blast of that unit's ability costs less this turn
  /* set stats of the chosen units to fixed values for this turn: ['statto', it|me, { crit: 1, drive: 1, power: n }] */
  *statto(G, ctx, s) { for (const i of (s[1] === 'me' ? [ctx.me.iid] : ctx.it)) { const c = G.cards[i]; if (!c || !isField(c.zone)) continue; const st = G.stat(c); const m = {}; for (const k of ['power', 'crit', 'drive', 'shield']) if (s[2][k] != null) m[k] = s[2][k] - st[k]; G.addMod(i, m, DUR[s[3]] || 'turn'); } },
  *xbattle(G, ctx) { G.tf['xbattle' + ctx.p] = (G.tf['xbattle' + ctx.p] || 0) + 1; },
  *minus(G, ctx, s) { const k = (ctx.v && ctx.v['$' + s[1]]) || []; ctx.it = ctx.it.filter(i => !k.includes(i)); ctx.got = ctx.it.length > 0; },   // drop the kept cards from the chosen ones
  /* choose a column of yours and swap the rear-guards of its front and back circle */
  *colswap(G, ctx) { const P = G.players[ctx.p]; const cols = [['L', 'FL', 'BL'], ['R', 'FR', 'BR']].filter(([, f, b]) => (P.circles[f] || P.circles[b]) && !(G.at(ctx.p, f) && G.at(ctx.p, f).locked) && !(G.at(ctx.p, b) && G.at(ctx.p, b).locked)); if (!cols.length) { ctx.got = false; return; } const id = cols.length === 1 ? cols[0][0] : yield* G.chooseOption(ctx.p, 'สลับแถวหน้า-หลังของคอลัมน์ไหน?', cols.map(c => ({ id: c[0], label: c[0] === 'L' ? 'คอลัมน์ซ้าย' : 'คอลัมน์ขวา' })), { iid: ctx.me.iid }); const [, f, b] = cols.find(c => c[0] === id) || cols[0]; const cf = P.circles[f], cb = P.circles[b]; P.circles[f] = cb; P.circles[b] = cf; if (cf) G.cards[cf].pos = b; if (cb) G.cards[cb].pos = f; G.ev('swap', { p: ctx.p }); if (cf) G.shifted(cf); if (cb) G.shifted(cb); ctx.got = true; },
  *ordonly(G, ctx, s) { (G.ordOnly = G.ordOnly || {})[ctx.p] = { t: G.turnNo, f: s[1] || { nm: '\u0000' } }; },
   // this turn only orders matching the filter may be played
  /* choose up to n cards with different names whose grades add up to at most a limit: ['pksum', zones, n, F, limit] */
  /* ['pksum', zones, n, F, limit, { eq: 1 (the total must equal the limit), any: 1 (same names allowed), dg: 1 (different grades) }] */
  *pksum(G, ctx, s) { const [, zones, n, F, lim0] = s; const po = s[5] || {}; const lim = nv(G, ctx, lim0); const out = []; let sum = 0;
    while (out.length < n) { const pool = zoneCards(G, ctx, zones).filter(i => i !== ctx.me.iid && !out.includes(i) && mf(G, ctx.me, G.cards[i], F) && (G.def(G.cards[i]).grade || 0) + sum <= lim && (po.any || !out.some(o => G.def(G.cards[o]).name === G.def(G.cards[i]).name)) && (!po.dg || !out.some(o => (G.def(G.cards[o]).grade || 0) === (G.def(G.cards[i]).grade || 0)))); if (!pool.length) break; const sel = yield* G.chooseCards(ctx.p, pool, { min: 0, max: 1, noAuto: true, title: 'เลือก' + thF(F, 0).trim() + ' (ผลรวมเกรดไม่เกิน ' + lim + ' · ' + (out.length + 1) + '/' + n + ')', hint: 'search', zone: zones.length === 1 ? zones[0] : 'mixed' }); if (!sel.length) break; out.push(sel[0]); sum += G.def(G.cards[sel[0]]).grade || 0; }
    if (po.eq && sum !== lim) { out.length = 0; G.log('ผลรวมเกรดไม่เท่ากับ ' + lim + ' — ไม่ได้เลือกการ์ด', ctx.p); }
    ctx.it = out; ctx.got = out.length > 0; },
  *itpd(G, ctx, s) { const x = (ctx.paid || [])[s[1] || 0]; ctx.it = Array.isArray(x) ? x.slice() : []; ctx.got = ctx.it.length > 0; },   // "it" = the cards the i-th cost took
  *itgr(G, ctx, s) { const g = nv(G, ctx, s[1]); ctx.it = ctx.it.filter(i => G.cards[i] && ((G.def(G.cards[i]).grade || 0) === g) === (s[2] !== 'ne')); ctx.got = ctx.it.length > 0; },   // ['itgr', n, 'ne' = every grade but n]
  *itnk(G, ctx, s) { const names = ((ctx.v && ctx.v['$' + s[1]]) || []).map(i => G.cards[i] && G.def(G.cards[i]).name); ctx.it = ctx.it.filter(i => G.cards[i] && names.includes(G.def(G.cards[i]).name) === (s[2] === 'same')); ctx.got = ctx.it.length > 0; },   // ['itnk', kept name, 'same'?]: drop the cards named like a remembered card (or keep only those)   // of the chosen cards, those of exactly that grade
  /* the chosen unit's power and critical become equal to this unit's for this turn */
  *match(G, ctx, s) { const a = G.cards[ctx.it[0]], b = ctx.me; if (!a || !isField(a.zone) || !isField(b.zone)) return; const sa = G.stat(a), sb = G.stat(b); if (s[1] === 'rev') G.addMod(b.iid, { power: sa.power - sb.power }, 'turn'); else G.addMod(a.iid, { power: sb.power - sa.power, crit: sb.crit - sa.crit }, 'turn'); },
  /* move a rear-guard (me | it) to another circle: { row: 'f'|'b', open: 1 } */
  *mv(G, ctx, s) { const u = s[1] === 'me' ? ctx.me : G.cards[ctx.it[0]]; const o = s[2] || {}; if (!u || u.zone !== 'RC') { ctx.got = false; return; } const circles = RCS.filter(k => k !== u.pos && !G.at(u.owner, k) && (!o.row || (o.row === 'f' ? FRONT : BACK).includes(k)) && (!o.col || COL[k] === COL[u.pos]) && (!o.pos || k === o.pos)); if (!circles.length) { ctx.got = false; return; } const k = yield* G.chooseCircle(ctx.p, circles, { title: 'ย้าย ' + G.name(u) + ' ไปเซอร์เคิลไหน?', hint: 'callToken', noAuto: circles.length > 1 }); ctx.got = !!k && G.moveUnit(u.iid, k); },
  /* declare one of several things: ['declare', [labels…], var] → ctx.v[var] = 1, 2, … */
  *declare(G, ctx, s) { const id = yield* G.chooseOption(ctx.p, G.name(ctx.me) + ': ประกาศ', s[1].map((l, i) => ({ id: String(i + 1), label: l })), { iid: ctx.me.iid }); (ctx.v = ctx.v || {})[s[2] || 'd'] = +(id || 1); G.log('ประกาศ: ' + s[1][+(id || 1) - 1], ctx.p); },
  *swap(G, ctx, s) { const [a, b] = (s[1] === 'me' ? [ctx.it[0], ctx.me.iid] : ctx.it).map(i => G.cards[i]); if (!a || !b || a.zone !== 'RC' || b.zone !== 'RC' || a.owner !== b.owner) { ctx.got = false; return; } const P = G.players[a.owner]; const pa = a.pos, pb = b.pos; P.circles[pa] = b.iid; P.circles[pb] = a.iid; a.pos = pb; b.pos = pa; G.ev('swap', { p: a.owner }); G.shifted(a.iid); G.shifted(b.iid); G.log('สลับตำแหน่ง ' + G.name(a) + ' กับ ' + G.name(b), ctx.p); ctx.got = true; },
  *actfree(G, ctx) { ctx.got = ctx.it.length ? yield* G.actFree(ctx.p, ctx.it[0], ctx.me) : false; },   // use an [ACT] of the chosen card without paying its cost
  *t1atk(G, ctx) { (G.tf.t1atk = G.tf.t1atk || []).push(ctx.me.iid); },                       // may attack although it is the first turn
  /* an order card may be played from where it lies this turn; after being played it goes to `after` (bottom / bind) instead of the drop zone */
  *playfrom(G, ctx, s) { for (const i of ctx.it) { const c = G.cards[i]; if (c) c.pf = { t: G.turnNo, z: s[1] || c.zone, after: s[2] || null }; } },
  *play(G, ctx) { let n = 0; for (const i of ctx.it.slice()) if (yield* G.playFree(ctx.p, i)) n++; ctx.got = n > 0; },   // play the chosen order without paying its cost
  *colit(G, ctx) { const u = G.cards[ctx.it[0]]; if (u && u.pos) { const c = COL[u.pos]; (ctx.v = ctx.v || {}).col = u.owner === ctx.p ? c : { L: 'R', R: 'L', C: 'C' }[c]; } },   // the column of the chosen unit
  /* choose up to n cards that all share one card name */
  *pkn(G, ctx, s) {
    const [, zones, n0, up, F] = s; const n = nv(G, ctx, n0); const list = zoneCards(G, ctx, zones).filter(i => i !== ctx.me.iid && mf(G, ctx.me, G.cards[i], F)); const out = [];
    while (out.length < n) { const pool = list.filter(i => !out.includes(i) && (!out.length || G.def(G.cards[i]).name === G.def(G.cards[out[0]]).name)); if (!pool.length) break; const sel = yield* G.chooseCards(ctx.p, pool, { min: up || out.length ? 0 : 1, max: 1, noAuto: true, title: 'เลือก' + thF(F, 0).trim() + 'ชื่อเดียวกัน (' + (out.length + 1) + '/' + n + ')', hint: 'search', zone: zones.length === 1 ? zones[0] : 'mixed' }); if (!sel.length) break; out.push(sel[0]); }
    ctx.it = out; ctx.got = out.length > 0;
  },
  *trset(G, ctx, s) { const [, val, Fl, n0] = s; const P = G.players[ctx.p]; const list = P.order.filter(i => mf(G, ctx.me, G.cards[i], Fl)); const n = Math.min(nv(G, ctx, n0), list.length); if (!n) { ctx.got = false; return; }   // ['trset', N, F, count]: choose count order-zone cards; drive/damage-check triggers sharing an icon with their gauges give +N until end of opponent's next turn
    const sel = yield* G.chooseCards(ctx.p, list, { min: n, max: n, title: 'เลือก' + thF(Fl, n) + 'จากออเดอร์โซน', zone: 'order', hint: 'search' });
    const icons = [...new Set(P.gauge.filter(i => sel.includes(G.cards[i].gh)).map(i => G.def(G.cards[i]).trigger).filter(Boolean))]; if (!icons.length) { ctx.got = false; return; }
    P.effects.push({ trigSet: val, icons, label: 'ทริกเกอร์ ' + icons.map(t => VG.TRIG_TH[t]).join('/') + ' +' + val, until: 'exp', exp: G.expTurn(ctx.p) }); ctx.got = true; },
  *dmgless(G, ctx, s) { G.players[ctx.p].effects.push({ dmgLess: s[1] || 1, label: 'ดาเมจจากความสามารถ -' + (s[1] || 1), until: 'exp', exp: G.expTurn(ctx.p) }); },   // until end of opponent's next turn, damage your vanguard takes from card abilities is reduced
  *bsdrop(G, ctx) { let n = 0; for (const h of ctx.it) for (const i of G.gaugeOf(h, 'bs')) { G.move(i, 'drop', { reason: 'effect' }); n++; } ctx.got = n > 0; ctx.count = n; },   // all of the chosen cards' buddy souls go to drop
  *npm(G, ctx, s) { const Fg = G.players[ctx.p].fight; (Fg.npm = Fg.npm || []).push(s[1] || G.def(ctx.me).name); },   // this fight you cannot play that card name in your main phase
  *obindh(G, ctx) { const q = 1 - ctx.p; const H = G.handFor(q); if (!H.length) { ctx.got = false; return; } const [c] = yield* G.chooseCards(q, H, { min: 1, max: 1, title: 'เลือกการ์ดจากมือ 1 ใบเพื่อไบนด์แบบคว่ำหน้า', hint: 'discard', zone: 'hand' }); if (c == null) { ctx.got = false; return; } G.move(c, 'bindfd', { reason: 'effect' }); G.cards[c].boundBy = ctx.me.iid; ctx.got = true; },   // the opponent binds a card from their hand face down (remembered by this card)
  *oreth(G, ctx) { const q = 1 - ctx.p; let n = 0; for (const i of G.players[q].bind.slice()) if (G.cards[i].boundBy === ctx.me.iid) { G.cards[i].boundBy = null; G.move(i, 'hand', { reason: 'effect' }); n++; } ctx.got = n > 0; },   // the opponent puts the cards this card bound into their hand
  *swaphm(G, ctx) { const P = G.players[ctx.p]; const H = G.handFor(ctx.p), B = (P.mbox || []).slice(); if (!H.length || !B.length) { ctx.got = false; return; }   // choose a card from hand and one from Monster BOX and swap them
    const [h] = yield* G.chooseCards(ctx.p, H, { min: 1, max: 1, title: 'เลือกการ์ดจากมือที่จะสลับ', zone: 'hand', hint: 'search' }); const [b] = yield* G.chooseCards(ctx.p, B, { min: 1, max: 1, title: 'เลือกการ์ดจาก Monster BOX ที่จะสลับ', zone: 'mbox', hint: 'search' }); if (h == null || b == null) { ctx.got = false; return; }
    G.move(h, 'mbox', { reason: 'effect' }); G.move(b, 'hand', { reason: 'effect' }); ctx.got = true; },
  *pcf(G, ctx) { const sum = [0, 0]; for (const q of [ctx.p, 1 - ctx.p]) { const D = G.players[q].deck; const top = D.slice(0, 3); for (const i of top) { G.ev('reveal', { iid: i, p: q }); sum[q === ctx.p ? 0 : 1] += G.def(G.cards[i]).grade || 0; } for (const i of top) G.move(i, 'deck', { bottom: true, reason: 'effect' }); }   // both reveal the top 3 and put them on the bottom; the higher grade total draws (tie: both)
    G.log('เกรดรวม ' + sum[0] + ' ต่อ ' + sum[1], ctx.p); if (sum[0] >= sum[1]) G.draw(ctx.p, 1); if (sum[0] <= sum[1]) G.draw(1 - ctx.p, 1); },
  *oallbot(G, ctx) { const q = 1 - ctx.p; let L = G.rcs(q).filter(c => FRONT.includes(c.pos)).map(c => c.iid); let n = 0;   // the opponent puts all of their front-row rear-guards on the bottom of their deck in the order they choose
    while (L.length) { const [i] = L.length > 1 ? yield* G.chooseCards(q, L, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดที่จะวางไว้ล่างสุดของเด็คก่อน', zone: 'field', hint: 'discard' }) : L; if (i == null) break; L = L.filter(x => x !== i); if (yield* G.wouldLeave(i)) continue; G.move(i, 'deck', { bottom: true, reason: 'effect' }); n++; } ctx.got = n > 0; },
  *osb1(G, ctx) { const q = 1 - ctx.p; const S = G.soulFor(q); if (!S.length) { ctx.got = false; return; } const [i] = yield* G.chooseCards(q, S, { min: 1, max: 1, title: 'เลือกการ์ดในโซลของคุณ 1 ใบลงดรอป', hint: 'soulblast', zone: 'soul' }); if (i != null) G.move(i, 'drop', { reason: 'effect' }); ctx.got = i != null; },   // the opponent chooses a card from their soul and puts it into drop
  *togc(G, ctx) { let n = 0; for (const i of ctx.it) { const c = G.cards[i]; if (!c || c.zone !== 'RC' || c.locked || !G.battle) continue; if (yield* G.wouldLeave(i)) continue; G.move(i, 'GC', { reason: 'effect' }); n++; } ctx.got = n > 0; },   // move the chosen rear-guards to (GC)
  *cset(G, ctx, s) { const k = 'cset' + ctx.p; for (const i of ctx.it) (G.tf[k] = G.tf[k] || []).push({ iid: i, type: s[1], cost: s[2].map(mkCost) }); },   // ['cset', 'auto'|'act', [costs]]: for the rest of this turn the chosen unit's original abilities of that type cost this instead
  *nofs(G, ctx) { const Fg = G.players[ctx.p].fight; (Fg.nofs = Fg.nofs || []).push(G.def(ctx.me).name); },   // this fight: cannot pay the cost of FantômeSkill abilities of units with this card's name
  *markrb(G, ctx) { ctx.me.rideBack = ctx.it[0]; },
  *ridebv(G, ctx) { const old = G.vg(ctx.p); if (!old) { ctx.got = false; return; } const oi = old.iid; ctx.got = G.superRide(ctx.p, ctx.me.iid, true, 'bind'); if (ctx.got) { ctx.me.rideBack = oi; ctx.it = [oi]; } },   // bind your vanguard and ride this card as [stand] in its place (rideBack / it = the bound card)
  *oputvc(G, ctx) { const q = 1 - ctx.p; const L = G.rcs(q).filter(u => !u.token && G.def(u).type !== 'token').map(u => u.iid); const old = G.vg(q); if (!L.length || !old) { ctx.got = false; return; } const [i] = yield* G.chooseCards(ctx.p, L, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดของคู่ต่อสู้ที่จะวางบน VC (เรสต์)', zone: 'field', hint: 'move' }); if (i == null) { ctx.got = false; return; } (G.tf['oput' + q] = G.tf['oput' + q] || []).push(G.def(old).name); G.move(old.iid, 'soul', { reason: 'ride', silent: true }); G.move(i, 'VC', { pos: 'V', rest: true, reason: 'effect', extra: { superior: true } }); G.log(G.name(G.cards[i]) + ' ถูกวางบน VC ของคู่ต่อสู้', ctx.p); ctx.it = [i]; ctx.got = true; },   // put a chosen opponent rear-guard (not a token) on their (VC) as [rest]
  *oreride(G, ctx) { const q = 1 - ctx.p; const names = G.tf['oput' + q] || []; const P = G.players[q]; const L = P.soul.filter(i => names.includes(G.def(G.cards[i]).name)); const old = G.vg(q); if (!L.length || !old) return; const [i] = yield* G.chooseCards(q, L, { min: 1, max: 1, title: 'เลือกการ์ดจากโซลเพื่อไรด์กลับ (เรสต์)', zone: 'soul', hint: 'search' }); if (i == null) return; G.move(old.iid, 'soul', { reason: 'ride', silent: true }); G.move(i, 'VC', { pos: 'V', rest: true, reason: 'ride', silent: true, extra: { ride: true, superior: true } }); G.log('คู่ต่อสู้ไรด์ ' + G.name(G.cards[i]) + ' กลับ (สกิลของการ์ดนั้นไม่ทำงาน)', q); },   // the opponent rides back, as [rest] and silently, a card from soul named like the vanguard put into soul this turn
  *del(G, ctx) { let n = 0; for (const i of ctx.it) { const c = G.cards[i]; if (!c || (c.zone !== 'VC' && c.zone !== 'RC')) continue; c.deleted = true; c.faceup = false; n++; G.log(G.name(c) + ' ถูก Delete (คว่ำหน้า เสียสกิลที่พิมพ์ไว้ พลังลดเท่าพลังตั้งต้น จนถึงเอนด์เฟสของเจ้าของ)', ctx.p); } ctx.got = n > 0; },   // delete the chosen units
  *trigact(G, ctx) { const i = ctx.it[0]; const c = G.cards[i]; if (!c || !G.def(c).trigger) { ctx.got = false; return; } G.log('เอฟเฟกต์ทริกเกอร์ของ ' + G.name(c) + ' ทำงาน', ctx.p); const prev = G.cur; G.cur = { iid: i, p: ctx.p, cost: false, trig: true }; try { yield* G.applyTrigger(ctx.p, c, 'drive'); } finally { G.cur = prev; } if (G.cards[i].zone !== 'removed' && G.cards[i].zone !== 'hand') G.move(i, 'removed', { reason: 'effect' }); ctx.got = true; },   // activate all trigger effects (and additional effects) of the chosen trigger card, then remove it
  *asname(G, ctx, s) { const src = G.cards[ctx.it[0]]; if (!src || !isField(ctx.me.zone)) return; G.addMod(ctx.me.iid, { asName: G.def(src).name }, DUR[s[1] || 'f'] || 'fight'); },   // this unit also gets the chosen card's name
  *gabnull(G, ctx) { G.players[1 - ctx.p].effects.push({ nullCrit: ctx.p, label: 'คริติคอลทริกเกอร์ถัดไปจากไดรฟ์เช็คถูกยกเลิกเอฟเฟกต์ 1 อย่าง', until: 'exp', exp: G.expTurn(ctx.p) }); },   // until the end of the opponent's next turn: their next drive-check critical trigger loses one effect (you choose)
  *gabget(G, ctx, s) { const P = G.players[ctx.p]; const m = P.gabNulled; P.gabNulled = null; const v = G.vg(ctx.p); if (!m || !v || G.grade(v) < 3 || !G.def(v).name.includes(s[1] || '')) return; G.addMod(v.iid, Object.assign({}, m), 'turn'); G.log('แวนการ์ดได้รับเอฟเฟกต์ทริกเกอร์ที่ยกเลิกไว้', ctx.p); },   // your grade 3+ vanguard (name part) gets the trigger effect you nullified
  *actauto(G, ctx) { let n = 0; for (const i of ctx.it.slice()) { const c = G.cards[i]; if (!c) continue; const L = (G.def(c).abilities || []).map((ab, idx) => ({ ab, idx })).filter(x => x.ab.type === 'auto' && x.ab.run); for (const { ab, idx } of L) { if (ab.cost) { if (!G.canPay(ab, c, {}, idx)) continue; const y = yield* G.yesNo(ctx.p, { title: 'ใช้สกิล AUTO ของ ' + G.name(c) + '?', sub: (ab.label || '') + ' · คอสต์: ' + ab.cost.map(k => k.label).join(' + '), iid: c.iid, idx }); if (!y) continue; } yield* G.useAbility(c, idx, {}); n++; } } ctx.got = n > 0; },   // activate all original [AUTO] abilities of the chosen cards
  *ncont(G, ctx) { G.tf['ncont' + ctx.me.iid] = 1; G.log('CONT ของ ' + G.name(ctx.me) + ' ถูกยกเลิกจนจบเทิร์น', ctx.p); },   // this card's [CONT] abilities (cannot ride / be called) are nullified this turn
  *srfm(G, ctx) { const src = G.cards[ctx.it[0]]; if (!src) return; const want = (G.def(src).tags || []).filter(t => t.startsWith('fm:')).map(t => t.slice(3)); const P = G.players[ctx.p]; const L = P.deck.concat(P.drop).filter(i => want.includes(G.def(G.cards[i]).name.toLowerCase())); if (!L.length) return; const [i] = yield* G.chooseCards(ctx.p, L, { min: 0, max: 1, title: 'เลือกแฟชั่นเมจิกการ์ดที่เขียนบนการ์ดนั้น (วางในออเดอร์โซน)', zone: 'mixed', hint: 'search', noAuto: true }); if (i != null) G.move(i, 'order', { reason: 'effect' }); },   // search deck or drop for a fashion magic card the chosen card names, into the order zone
  *gleipcall(G, ctx) { const P = G.players[ctx.p]; const L = P.gauge.filter(i => G.cards[i].pendG === ctx.me.iid); if (L.length) { const [i] = yield* G.chooseCards(ctx.p, L, { min: 0, max: 1, title: 'เลือกบัดดี้โซลของ ' + G.name(ctx.me) + ' เพื่อคอลลง RC (ไม่ต้องจ่ายคอลคอสต์)', zone: 'mixed', hint: 'search', noAuto: true }); if (i != null) { G.cards[i].pendG = null; if (yield* callOne(G, ctx, i, {})) { const u = G.cards[i]; const v = G.vg(ctx.p); if (!(G.def(u).name === 'Demon Wolf, Fenrir' && v && G.def(v).name.includes('Kiri'))) G.addMod(i, { cantAttack: 1 }, 'turn'); } } } for (const g of P.gauge.filter(i => G.cards[i].pendG === ctx.me.iid)) { G.cards[g].pendG = null; G.move(g, 'drop', { reason: 'gauge' }); } },   // Gleipnir: call one of its former buddy soul cards
  *srarm(G, ctx, s) { const x = (ctx.paid || [])[s[2] == null ? 1 : s[2]]; const names = (Array.isArray(x) ? x : []).map(i => G.def(G.cards[i]).name); const P = G.players[ctx.p]; const L = P.deck.concat(P.drop).filter(i => mf(G, ctx.me, G.cards[i], s[1] || {}) && !names.includes(G.def(G.cards[i]).name)); const [i] = L.length ? yield* G.chooseCards(ctx.p, L, { min: 0, max: 1, title: 'เลือกการ์ดที่จะติดตั้ง', zone: 'mixed', hint: 'search', noAuto: true }) : []; const fromDeck = i != null && G.cards[i].zone === 'deck'; ctx.got = i != null && G.armCard(i, ctx.p); if (fromDeck) G.shuffle(ctx.p); },   // search deck or drop for a card (other name than the i-th cost's cards) and arm it
  *unstr(G, ctx) { ctx.got = G.unstrideP(ctx.p); },   // your G unit goes back to the G zone face up (its heart becomes the vanguard again)
  *rdfree(G, ctx) { G.players[ctx.p].effects.push({ rdFree: 1, label: 'ไรด์เฟสเทิร์นถัดไป: ไรด์จากไรด์เด็คโดยไม่ต้องทิ้งการ์ดได้', until: 'exp', exp: G.active === ctx.p ? G.turnNo + 2 : G.turnNo + 1 }); },   // in your next turn's ride phase you may ride from the ride deck without discarding
  *riderb(G, ctx) { const i = ctx.me.rideBack; ctx.me.rideBack = null; if (i == null || !G.cards[i] || G.cards[i].zone !== 'bind') return; G.superRide(ctx.p, i, 'rest'); },
  *gcas(G, ctx, s) { if (!G.battle) { ctx.got = false; return; } let n = 0; for (const i of ctx.it) { const c = G.cards[i]; if (!c) continue; G.battle.guards++; G.move(i, 'GC', { reason: 'effect' }); if (c.zone !== 'GC') continue; c.asG = { shield: s[1] || 0 }; if (s[2]) G.addMod(i, { gcBind: 1 }, 'battle'); n++; } ctx.got = n > 0; },   // ['gcas', shield, bindInsteadOfRetire]: call the chosen card to (GC) as a grade 0 trigger unit with that shield
  *mgc(G, ctx) { if (!G.battle || G.active === ctx.p) { ctx.got = false; return; } G.battle.guards++; G.move(ctx.me.iid, 'GC', { reason: 'effect' }); ctx.got = ctx.me.zone === 'GC'; },   // move this card (from originalDress) to (GC)
  *xtgt(G, ctx) { const u = G.cards[ctx.it[0]]; if (!u || u.zone !== 'RC') { ctx.got = false; return; } ctx.me.xtPos = u.pos; ctx.me.xtT = G.turnNo; ctx.got = true; },   // the chosen opponent's rear-guard's (RC): this turn, when this unit attacks a vanguard it also battles the unit there
  *musto(G, ctx, s) { for (const i of ctx.it) { const c = G.cards[i]; if (c) c.musTo = s[1] || 'soul'; } },   // the music played by this goes to soul (or s[1]) instead of drop at the end phase
  *vgc4(G, ctx) { G.players[ctx.p].effects.push({ noVgCont4: 1, label: 'แบทเทิลที่ 4: CONT ของแวนการ์ดถูกยกเลิก', until: 'turn' }); },   // this turn: from the fourth battle, your vanguard's CONT abilities are nullified
  *swapsg(G, ctx) { const h = ctx.it[0]; if (h == null || !G.cards[h] || G.cards[h].zone !== 'hand') { ctx.got = false; return; } G.ev('reveal', { iid: h, p: ctx.p }); const g = G.def(G.cards[h]).grade; const anyG = !!G.def(G.cards[h]).mbAny; const B = (G.players[ctx.p].mbox || []).filter(i => G.def(G.cards[i]).type === 'unit' && (anyG || G.def(G.cards[i]).grade === g)); if (!B.length) { ctx.got = false; return; } const [b] = yield* G.chooseCards(ctx.p, B, { min: 1, max: 1, title: 'เลือกยูนิทเกรดเดียวกันจาก Monster BOX เพื่อสลับ', zone: 'mbox', hint: 'search' }); if (b == null) { ctx.got = false; return; } G.move(h, 'mbox', { reason: 'effect' }); G.move(b, 'hand', { reason: 'effect' }); ctx.got = true; },   // swap the revealed hand unit with a same-grade unit from Monster BOX
  *nooc(G, ctx) { const Fg = G.players[ctx.p].fight; (Fg.nooc = Fg.nooc || []).push(G.def(ctx.me).name); },   // this fight: the overcharge abilities of cards with this name cannot be activated
  *ngg(G, ctx) { ctx.me.ngg = { t: G.turnNo, g: ctx.it.map(i => G.def(G.cards[i]).grade).filter(g => g != null) }; },   // in the battle this unit attacks this turn, the opponent cannot call cards of those grades from hand to (GC)
  *rtsg(G, ctx) { const gs = ctx.it.map(i => G.def(G.cards[i]).grade); const L = G.rcs(1 - ctx.p).filter(c => gs.includes(G.def(c).grade)).filter(c => { const st = G.stat(c); return !st.resist && !st.immune; }).map(c => c.iid); if (!L.length) { ctx.got = false; return; } const [t] = yield* G.chooseCards(ctx.p, L, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดคู่ต่อสู้ที่เกรดเท่ากับใบที่คอล แล้วรีไทร์', zone: 'field', hint: 'retire' }); if (t != null && !(yield* G.wouldLeave(t))) G.retire(t, 'effect', ctx.me.iid); ctx.got = t != null; },   // retire an opponent's rear-guard with the same grade as any of the chosen cards
  *pwmatch(G, ctx) { const v = G.stat(ctx.me).power; for (const i of ctx.it) { const c = G.cards[i]; if (!c || c.zone !== 'RC') continue; const d = v - G.stat(c).power; if (d) G.addMod(i, { power: d }, 'turn'); } },   // increase or decrease the chosen units' power to match this unit's power
  *pw0(G, ctx) { for (const c of G.front(1 - ctx.p)) { const d = -G.stat(c).power; if (d) G.addMod(c.iid, { power: d }, 'turn'); } },   // the opponent's front row units' power becomes 0
  *pkg1(G, ctx) { const g = ctx.it[0] != null && G.cards[ctx.it[0]] ? (G.def(G.cards[ctx.it[0]]).grade || 0) + 1 : null; (G.fxv = G.fxv || {}).g1 = g; },   // remember the chosen card grade + 1 (filter gvar g1)
  *omvf(G, ctx) { const q = 1 - ctx.p; const open = ['FL', 'FR'].filter(k => !G.at(q, k)); const L = G.rcs(q).filter(c => BACK.includes(c.pos) && !c.locked).map(c => c.iid); if (!open.length || !L.length) { ctx.got = false; return; } const [i] = yield* G.chooseCards(q, L, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดแถวหลังของคุณเพื่อย้ายไปแถวหน้าที่ว่าง', zone: 'field', hint: 'move' }); if (i == null) { ctx.got = false; return; } const pos = open.length === 1 ? open[0] : yield* G.chooseCircle(q, open, { title: 'ย้ายไปเซอร์เคิลไหน?', hint: 'move' }); if (!pos) { ctx.got = false; return; } G.move(i, 'RC', { pos, reason: 'effect' }); ctx.got = true; },   // the opponent moves one of their back row rear-guards to an open front row (RC)
  *or2(G, ctx, s) { (G.tf['or2' + ctx.p] = G.tf['or2' + ctx.p] || []).push(s[1]); },   // for the rest of this turn, that card's "perform one of the following" performs two (different) instead
  *less(G, ctx, s) { const o = Object.assign({}, s[1]); if (o.it) { o.iid = ctx.it[0]; delete o.it; if (o.iid == null) return; } (G.tf['less' + ctx.p] = G.tf['less' + ctx.p] || []).push(o); },   // ['less', { kind: disc|rem, nm | it, n, keep }]
  *pkx(G, ctx, s) { const o = Object.assign({}, s[1]); if (o.it) { o.iid = ctx.it[0]; delete o.it; if (o.iid == null) return; } (G.tf['pkx' + ctx.p] = G.tf['pkx' + ctx.p] || []).push(o); },   // ['pkx', { nm | it, zone, to }]
  *ncd(G, ctx) { G.tf['ncd' + ctx.p] = 1; },   // no calls from drop for the rest of this turn
  *asset(G, ctx) { for (const i of ctx.it) { const c = G.cards[i]; if (c && c.zone === 'order') c.asSetX = true; } },   // those cards in the order zone are regarded as set orders until end of this fight
  *malg(G, ctx, s) { const h = ctx.it[0]; if (h == null || !G.cards[h] || G.cards[h].zone !== 'order') { ctx.got = false; return; } const P = G.players[ctx.p];   // Malefics: search deck / hand / drop for up to one trigger card, put it face up as the gauge of that card; shuffle if from deck; draw if it came from one of s[1]
    const list = ['deck', 'hand', 'drop'].flatMap(z => P[z].filter(i => G.def(G.cards[i]).trigger));
    const sel = yield* G.chooseCards(ctx.p, list, { min: 0, max: 1, title: 'ค้นหาทริกเกอร์การ์ด 1 ใบจากเด็ค มือ หรือดรอป มาเป็นเกจของ ' + G.name(G.cards[h]), zone: 'mixed', hint: 'search', noAuto: true });
    if (!sel.length) { if (P.deck.length) G.shuffle(ctx.p); ctx.got = false; return; } const z = G.cards[sel[0]].zone; G.toGauge(sel[0], 'mal', h, false); G.cards[sel[0]].faceup = true;
    G.shuffle(ctx.p); if ((s[1] || []).includes(z)) G.draw(ctx.p, 1); ctx.got = true; },
  *alccb(G, ctx, s) { const k = 'alccb' + ctx.p; G.tf[k] = (G.tf[k] || 0) + (s[1] || 1); },   // the next alchemagic this turn costs counter-blast n less
  *cbl(G, ctx, s) { const k = 'cbl' + ctx.p; (G.tf[k] = G.tf[k] || []).push(Object.assign({}, s[1])); },   // ['cbl', { play:1 (when you play it), nm, nh, rc, n, keep:1 (every time this turn) }]
  *otk(G, ctx, s) { const key = String(s[1]).toLowerCase(); const r = VG.DB.rows.find(x => x.name.toLowerCase() === key); const no = VG.XTOK && VG.XTOK[key] ? 'TOKEN/x:' + key : r ? r.no : null; if (!no) { ctx.got = false; return; } const c = G.newCard(no, ctx.p, 'new', true); G.move(c.iid, 'order', { reason: 'effect' }); ctx.it = [c.iid]; ctx.got = c.zone === 'order'; G.log('วาง ' + VG.card(no).name + ' โทเคนในออเดอร์โซน', ctx.p); },   // ['otk', name]: put that token into your order zone
  *rideonly(G, ctx, s) { const F = G.players[ctx.p].fight; (F.rideOnly = F.rideOnly || []).push(Object.assign({}, s[1])); },   // ['rideonly', { nh, gmin }]: until end of this fight you cannot ride (grade gmin+) cards without nh in the name
  *nocall(G, ctx, s) { const k = 'nocall' + ctx.p; (G.tf[k] = G.tf[k] || []).push(s[1] === 'sn' ? G.def(ctx.me).name : s[1]); },   // this turn you cannot normal call a card of that name
  *itrd(G, ctx) { const i = G.tf['rdisc' + ctx.p]; ctx.it = i != null && G.cards[i] && G.cards[i].zone === 'drop' ? [i] : []; ctx.got = ctx.it.length > 0; },   // it = the card discarded for this turn's ride-deck ride (if still in drop)
  *itgin(G, ctx, s) { const gs = new Set(((ctx.v && ctx.v['$' + s[1]]) || []).map(i => G.cards[i] ? (G.def(G.cards[i]).grade || 0) : -1)); ctx.it = ctx.it.filter(i => G.cards[i] && gs.has(G.grade(G.cards[i]))); ctx.got = ctx.it.length > 0; },   // keep the chosen units whose grade is among the grades of the kept cards
  *stx(G, ctx, s) { for (const i of ctx.it) { const c = G.cards[i]; if (c && c.st) delete c.st[s[1]]; } },   // the chosen units leave a named state
  *od(G, ctx, s) { const i = s[1] === 'me' ? ctx.me.iid : ctx.it[0]; const list = i == null ? [] : G.rcs(ctx.p).filter(u => !u.locked && u.iid !== i && mf(G, ctx.me, u, s[2])).map(u => u.iid); if (!list.length) { ctx.got = false; return; } const sel = yield* G.chooseCards(ctx.p, list, { min: 1, max: 1, title: 'overDress ทับยูนิทไหน?', hint: 'buff', zone: 'field' }); const t = G.cards[sel[0]]; if (!t) { ctx.got = false; return; } G.overDress(i, t.pos, [t.iid], false); ctx.it = [i]; ctx.got = true; },   // ['od', 'me' | 'it', F]: overDress that card on one of your rear-guards matching F (stand)
  *win(G, ctx) { G.log(G.players[ctx.p].name + ' ชนะด้วยเอฟเฟกต์ของ ' + G.name(ctx.me), ctx.p); G.lose(1 - ctx.p, 'effect'); },
  *regoff(G, ctx) { G.players[ctx.p].fight.regalis = false; },   // this play does not count as your Regalis Piece of the fight
  *fus(G, ctx) { const P = G.players[ctx.p]; const list = RCS.map(k => G.at(ctx.p, k)).filter(c => c && (c.locked || c.rest)).map(c => c.iid); if (!list.length) { ctx.got = false; return; } const sel = yield* G.chooseCards(ctx.p, list, { min: 1, max: 1, title: 'เลือกการ์ดบนเซอร์เคิลของคุณเพื่อหงายหน้าและสแตนด์', hint: 'buff', zone: 'field' }); const c = G.cards[sel[0]]; if (!c) { ctx.got = false; return; } if (c.locked) G.unlock(c.iid); G.standUnit(c.iid); ctx.it = [c.iid]; ctx.got = true; },   // turn one of your circle cards face up (unlock) and stand it
  *asrf(G, ctx) { if (ctx.evt && ctx.evt.rideFrom) ctx.me.asx = { t: G.turnNo, name: ctx.evt.rideFrom }; },   // this turn this unit also counts as the card it rode upon
  *gcrest(G, ctx, s) { const P = G.players[ctx.p]; if (P.crest.some(i => G.def(G.cards[i]).name === s[1])) { ctx.got = false; return; } const r = VG.DB.rows.find(x => x.name === s[1]); if (!r) { ctx.got = false; return; } const c = G.newCard(r.no, ctx.p, 'new', true); G.move(c.iid, 'crest', { reason: 'effect' }); ctx.got = c.zone === 'crest'; G.log('ได้รับเครสต์ ' + s[1], ctx.p); },   // ['gcrest', name]: you get that crest
  *unmoor(G, ctx) { for (const i of ctx.it) { const c = G.cards[i]; if (c && c.zone === 'RC') G.emit('unmoor', { iid: i, p: c.owner }); } },   // the chosen units unmoor (their Unmoor abilities activate)
  *sing(G, ctx) { let n = 0; for (const i of ctx.it.slice()) if (G.sing(i)) n++; ctx.got = n > 0; ctx.count = n; },   // sing the chosen face-up song (its "when sung" ability goes off, then it turns face down)
  *playn(G, ctx) { let n = 0; for (const i of ctx.it.slice()) { const c = G.cards[i]; if (c && G.def(c).type === 'order' && G.canPlayOrder(ctx.p, c)) { yield* G.playOrder(ctx.p, c); n++; } } ctx.got = n > 0; ctx.count = n; },   // play the chosen order now as this turn's order play (cost and limit as usual)
  *musto(G, ctx, s) { for (const i of ctx.it) if (G.cards[i]) G.cards[i].musTo = s[1]; },   // the chosen music goes there instead of drop at the end of the turn
  *unlockall(G, ctx) { let n = 0; const P = G.players[ctx.p]; for (const k of RCS) { const i = P.circles[k]; if (i && G.cards[i].locked && G.unlock(i)) n++; } ctx.got = n > 0; ctx.count = n; },
  *fatk(G, ctx, s) { const ids = s[1] === 'vg' ? [G.vg(ctx.p).iid] : ctx.it.slice(); (G.fatk = G.fatk || []).push(...(s[1] === 'dom' ? ids.map(i => ({ i, dom: 1 })) : ids)); ctx.got = ids.length > 0; },   // the unit attacks the opponent's vanguard (at the end of this turn's end-phase timing)
  *opr(G, ctx, s) { let n = 0; for (const i of ctx.it.slice()) if (G.operate(i, ctx.p, ctx.me.iid)) n++; ctx.got = n > 0; ctx.count = n; },   // operate the chosen product(s)
  *asu(G, ctx, s) { const c = ctx.me; if (c.zone !== 'order' && c.zone !== 'hand' && c.zone !== 'drop') { ctx.got = false; return; } c.asU = Object.assign({}, s[1]); const ok = yield* callOne(G, ctx, c.iid, { open: 1, asu: 1 }); if (!ok || c.zone !== 'RC') delete c.asU; ctx.got = !!ok && c.zone === 'RC'; },   // call this order card to an open (RC) as a normal unit with those stats
  *retry(G, ctx, s) { const ids = s[1] === 'me' ? [ctx.me.iid] : s[1] === 'atk' ? (G.battle ? [G.battle.attacker] : []) : ctx.it.slice(); let n = 0; for (const i of ids) if (G.retry(i, ctx.me.iid)) n++; ctx.got = n > 0; },   // retry a unit (it needs the [Retry] ability)
  *dom(G, ctx, s) { const o = s[1] || {}; let n = 0; for (const i of ctx.it.slice()) if (yield* G.dominate(ctx.p, i, { mods: o.m, ret: o.ret, bot: o.bot, tgt: o.tgt, vc: o.vc })) n++; ctx.got = n > 0; },   // stand and dominate the chosen opponent's rear-guard(s); each attacks the opponent's other unit ({ m: mods for the rest of the turn, ret: retire it after that battle })
  *useatk(G, ctx, s) { const att = G.battle ? G.battle.attacker : null; for (const i of ctx.it) { G.log('ใช้ท่า ' + G.name(G.cards[i]), ctx.p); G.tlog({ k: 'atkuse', iid: i, no: G.cards[i].no, p: ctx.p, att }); G.emit('atkUsed', { iid: i, p: ctx.p, att }); } ctx.got = ctx.it.length > 0; },   // Mushiking: use that attack card's Attack
  *retgt(G, ctx, s) { const b = G.battle; const t = ctx.it[0]; if (!b || t == null || !G.cards[t] || G.cards[t].zone !== 'RC') { ctx.got = false; return; } if (s[1] === 'add') { if (!b.targets.includes(t)) b.targets.push(t); } else { b.targets = [t]; b.targetZone = G.cards[t].zone; } G.log('เปลี่ยนเป้าหมายการโจมตีเป็น ' + G.name(G.cards[t]), ctx.p); },   // change the unit being attacked to that unit ('add': it also battles it)
  *addvg(G, ctx) { const b = G.battle; if (!b) return; const v = G.vg(1 - ctx.p); if (v && !b.targets.includes(v.iid)) { b.targets = [v.iid].concat(b.targets); b.targetZone = 'VC'; } },   // the attacking unit also battles the opponent's vanguard
  *usesm(G, ctx, s) { const P = G.players[ctx.p]; const gv = G.grade(G.vg(ctx.p)); const u = ctx.me.iid; const pool = P.gzone.filter(i => !G.cards[i].faceup && G.def(G.cards[i]).special && (G.def(G.cards[i]).grade || 0) <= gv && G.smOk(i, u)); if (!pool.length) { ctx.got = false; return; }
    const [i] = yield* G.chooseCards(ctx.p, pool, { min: 1, max: 1, title: 'เลือกท่าพิเศษที่จะใช้', zone: 'gzone', hint: 'search' }); ctx.got = i != null && (yield* G.useSM(ctx.p, i, u)); },   // choose a face-down special move (grade ≤ your vanguard) this unit may use, and use it
  *nogg(G, ctx) { const b = G.battle; if (!b) return; const gs = ctx.it.map(i => G.def(G.cards[i]).grade).filter(g => g != null); (b.noGuardGr = b.noGuardGr || []).push(...gs); },   // for this battle your opponent cannot call cards with the same grade as the chosen card(s) from hand to (GC)
  *smup(G, ctx, s) { const P = G.players[ctx.p]; const pool = P.gzone.filter(i => !G.cards[i].faceup && G.def(G.cards[i]).name === G.def(ctx.me).name); if (!pool.length) { ctx.got = false; return; } const sel = yield* G.chooseCards(ctx.p, pool, { min: 0, max: 1, title: 'หงายท่าพิเศษชื่อเดียวกัน?', zone: 'gzone', hint: 'search' }); for (const i of sel) G.cards[i].faceup = true; ctx.got = sel.length > 0; },   // you may turn a face-down copy of this special move face up
  *mbtop(G, ctx, s) { const ids = G.players[ctx.p].deck.slice(0, nv(G, ctx, s[1])); for (const i of ids) { G.move(i, 'mbox', { reason: 'effect' }); G.cards[i].faceup = true; } ctx.it = ids; ctx.got = ids.length > 0; },   // the top n cards of the deck into my Monster BOX face up
  *memo2(G, ctx) { const P = G.players[ctx.p]; const q = i => { const d = G.def(G.cards[i]); return !!d.race && /(^|\/)\s*quintuplet\s*($|\/)/i.test(d.race); }; const list = P.drop.filter(q);
    const sel = yield* G.chooseCards(ctx.p, list, { min: 0, max: Math.min(2, list.length), title: 'เลือก <Quintuplet> ชื่อเดียวกันจากดรอป สูงสุด 2 ใบ', hint: 'search', zone: 'drop', noAuto: true });
    const ok = sel.length < 2 || G.def(G.cards[sel[0]]).name === G.def(G.cards[sel[1]]).name; const pick = ok ? sel : sel.slice(0, 1); ctx.got = pick.length > 0; if (!pick.length) return;
    G.move(pick[0], 'deck', { bottom: true, reason: 'effect' }); for (const i of pick.slice(1)) G.move(i, 'memory', { reason: 'effect' }); },   // up to two quintuplets of one name: one to the bottom of the deck, the rest into memory
  *win(G, ctx) { G.log('ชนะเกมด้วยเอฟเฟกต์การ์ด!', ctx.p); G.lose(1 - ctx.p, 'effect'); },
  *alcok(G, ctx, s) { G.tf['alc' + ctx.p] = Object.assign({ from: 'drop' }, s[1] || {}); },   // this turn normal orders may alchemagic ({nm: same|diff|any, from})
  *alcnosb(G, ctx) { G.tf['alcnosb' + ctx.p] = 1; },   // the next alchemagic need not pay its soul blast
  *sfree(G, ctx) { G.tf['sfree' + ctx.p] = 1; },   // this turn you may stride without paying its cost
  *stride(G, ctx) { if (!G.canStride(ctx.p) && !(G.players[ctx.p].gzone.some(i => !G.cards[i].faceup) && G.vg(ctx.p) && G.vg(ctx.p).heart == null)) { ctx.got = false; return; } ctx.got = yield* G.doStride(ctx.p, true); },   // stride now without paying the cost
  *link(G, ctx, s) { if (!G.battle) { ctx.got = false; return; } const pd = (ctx.paid || [])[0]; const ids = [ctx.me.iid].concat(Array.isArray(pd) ? pd : []).concat(s[1] === 'it' ? ctx.it : []); const L = G.battle.link = G.battle.link || []; for (const i of ids) if (!L.includes(i)) { L.push(i); G.emit('linked', { iid: i, p: G.cards[i].owner }); } G.log('ลิงก์แอทแทค!', ctx.p); },   // this unit and the unit(s) paid for the cost are in the link attack state until end of the battle
  *ctop(G, ctx, s) { const c = ctx.it[0]; const h = ctx.me.iid; ctx.got = c != null && h != null && G.callOnTop(c, h, ctx.p); },   // call the chosen card on top of this unit (it becomes its buddy soul), without paying its call cost
  *arm(G, ctx, s) { const ids = s[1] === 'me' ? [ctx.me.iid] : ctx.it.slice(); let n = 0; for (const i of ids) if (G.armCard(i, ctx.p)) n++; ctx.got = n > 0; ctx.count = n; },   // arm the card(s) to my vanguard
  *jcall(G, ctx) { let n = 0; for (const i of ctx.it.slice()) { const c = G.cards[i]; if (!c || c.zone !== 'prison') continue; const d = G.def(c); if (d.type === 'unit') { if (yield* callOne(G, ctx, i, { na: G.players[1 - ctx.p].effects.some(e => e.jailNa) })) n++; else if (c.zone === 'prison') G.move(i, 'drop', { reason: 'effect' }); } else G.move(i, 'drop', { reason: 'effect' }); } ctx.got = n > 0; ctx.count = n; },   // the chosen imprisoned cards are called to (RC); a card that cannot be called goes to drop
  *opt(G, ctx, s) { const was = ctx.stop; ctx.stop = false; yield* run(G, ctx, s[1]); ctx.did = !ctx.stop; ctx.stop = was; },   // an optional part: a declined payment inside it only ends this part
  *sb(G, ctx, s) { const src = G.soulFor(ctx.p); const n = Math.min(nv(G, ctx, s[1]), src.length); if (!n) { ctx.got = false; return; } const sel = yield* G.chooseCards(ctx.p, src, { min: n, max: n, title: 'โซลบลาสต์ ' + n + ' ใบ', hint: 'discard', zone: 'soul' }); for (const i of sel) G.move(i, 'drop', { reason: 'sb' }); G.emit('sbcost', { p: ctx.p, n: sel.length, by: ctx.me.iid }); G.tlog({ k: 'cost', kind: 'sb', n: sel.length, p: ctx.p, by: ctx.me.iid }); ctx.got = sel.length > 0; ctx.count = sel.length; },   // soul-blast as an effect
  *asn(G, ctx, s) { ctx.me.asx = { t: G.turnNo, name: s[1] }; },   // this turn the card's name also counts as …
  *gzun(G, ctx, s) { for (const i of G.players[ctx.p].gauge) if (G.cards[i].gk === s[1]) G.cards[i].gh = null; },   // my gauges of that kind let go of their units (before they are gathered on a new one)
  *ith(G, ctx) { const h = ctx.me.gh; ctx.it = h != null && G.cards[h] ? [h] : []; ctx.got = ctx.it.length > 0; },   // it = the card this gauge belongs to
  *xturn(G, ctx, s) { (G.xtq = G.xtq || []).push(Object.assign({ p: ctx.p }, s[1] || {})); G.log('จะได้เทิร์นเพิ่มเติมหลังจบเทิร์นนี้', ctx.p); },   // an additional turn after this one ({ skipRM: no ride / main phase, vmod: mod on the vanguard })
  *gzt(G, ctx, s) { const o = s[3] || {}; const n = nv(G, ctx, s[1]); const host = o.host ? gzHost(ctx, o.host) : null; if (o.host && host == null) { ctx.got = false; return; } const ids = G.players[ctx.p].deck.slice(0, n); let k = 0; for (const i of ids) if (G.toGauge(i, s[2], host, !!o.fd)) k++; ctx.it = ids.filter(i => G.cards[i].zone === 'gauge'); ctx.got = k > 0; ctx.count = k; },   // ['gzt', n, kind, { fd, host: 'me'|'it'|'h' }]: the top n cards of my deck become gauges
  *gzre(G, ctx, s) { const h = ctx.it[0]; if (h == null || !G.cards[h] || !isField(G.cards[h].zone)) { ctx.got = false; return; } for (const i of G.players[ctx.p].gauge) if (G.cards[i].gk === s[1]) { G.cards[i].gh = h; G.cards[i].faceup = true; } },   // all my gauges of that kind go onto the chosen unit
  *gzok(G, ctx, s) { const P = G.players[ctx.p]; (P.fight.gz = P.fight.gz || []).push(s[1]); },   // until the end of the fight I can have gauges of that kind
  *gztk(G, ctx, s) { const host = gzHost(ctx, s[3] || 'it'); const no = tokNo(s[1]); if (host == null || !no) { ctx.got = false; return; } let k = 0; const N = nv(G, ctx, s[2]); for (let i = 0; i < N; i++) { const t = G.newCard(no, ctx.p, 'new', true); if (G.toGauge(t.iid, s[4] || 'plant', host, false)) k++; } ctx.got = k > 0; ctx.count = k; },   // n tokens are put straight in as plant gauges of the host
  *gless(G, ctx) { G.tf['gless' + ctx.p] = 1; },   // the next order I play costs one gauge less
  *noact(G, ctx, s) { const k = 'noact' + ctx.p; const nm = s[1] === 'sn' ? G.def(ctx.me).name : s[1]; (G.tf[k] = G.tf[k] || []).push(nm); G.log('จนจบเทิร์น ใช้ ACT ของ ' + nm + ' ไม่ได้', ctx.p); },   // ['noact', 'sn' | name]
  *noride(G, ctx) { G.tf['noride' + ctx.p] = 1; },
  *noautok(G, ctx) { (G.tf['noautok' + ctx.p] = G.tf['noautok' + ctx.p] || []).push(G.def(ctx.me).name); },   // this turn you cannot pay the cost of [AUTO] abilities of cards with this card's name
  *loseg(G, ctx) { G.lose(ctx.p, 'effect'); },   // you lose this fight
  /* choose a column (seen from the chooser); itcol: "it" = the units of a side (m o x) and kind (u v r) standing in it */
  *col(G, ctx) { const id = yield* G.chooseOption(ctx.p, G.name(ctx.me) + ': เลือกคอลัมน์', [{ id: 'L', label: 'คอลัมน์ซ้าย' }, { id: 'C', label: 'คอลัมน์กลาง' }, { id: 'R', label: 'คอลัมน์ขวา' }], { iid: ctx.me.iid }); (ctx.v = ctx.v || {}).col = id || 'C'; },
  *itcol(G, ctx, s) {
    const col = (ctx.v && ctx.v.col) || COL[ctx.me.pos] || 'C'; const flip = { L: 'R', R: 'L', C: 'C' }; const out = [];
    for (const q of (s[1] === 'x' ? [ctx.p, 1 - ctx.p] : [s[1] === 'o' ? 1 - ctx.p : ctx.p])) { const want = q === ctx.p ? col : flip[col]; for (const u of (s[2] === 'v' ? [G.vg(q)] : s[2] === 'r' ? G.rcs(q) : G.units(q))) if (u && COL[u.pos] === want && mf(G, ctx.me, u, s[3])) out.push(u.iid); }
    ctx.it = out; ctx.got = out.length > 0;
  },
  *gup(G, ctx, s) { for (const i of ctx.it) { const c = G.cards[i]; if (c) c.gmod = { t: G.turnNo, n: (c.gmod && c.gmod.t === G.turnNo ? c.gmod.n : 0) + (s[1] || 1) }; } },
  *ffset(G, ctx, s) { const F = G.players[ctx.p].fight; F[s[1]] = (F[s[1]] || 0) + 1; },
  *tfset(G, ctx, s) { const k = s[1] + (s[3] === 'o' ? 1 - ctx.p : ctx.p); G.tf[k] = (G.tf[k] || 0) + (s[2] == null ? 1 : nv(G, ctx, s[2])); },
  *dmg(G, ctx, s) { const q = s[2] === 'me' ? ctx.p : 1 - ctx.p; const n = Math.max(0, nv(G, ctx, s[1] == null ? 1 : s[1]) - G.players[q].effects.reduce((a, e) => a + (e.dmgLess || 0), 0)); for (let i = 0; i < n; i++) yield* G.triggerCheck(q, 'damage'); },   // deal damage to a vanguard (damage checks)
  *heal(G, ctx, s) { const P = G.players[ctx.p]; let n = 0; for (let i = 0; i < nv(G, ctx, s[1] == null ? 1 : s[1]); i++) { if (!P.damage.length) break; const sel = yield* G.chooseCards(ctx.p, P.damage.slice(), { min: 1, max: 1, title: 'เลือกดาเมจ 1 ใบเพื่อฮีล', hint: 'heal', zone: 'damage' }); if (!sel[0]) break; G.move(sel[0], 'drop', { reason: 'heal' }); n++; } ctx.got = n > 0; ctx.count = n; },
  *cb(G, ctx, s) { const P = G.players[ctx.p]; const up = P.damage.filter(i => G.cards[i].faceup).length; const n = Math.min(nv(G, ctx, s[1]), up); if (n > 0) G.counterBlast(ctx.p, n); ctx.got = n > 0; ctx.count = n; },   // turn damage face down as an effect
  *eb(G, ctx, s) { const P = G.players[ctx.p]; const n = Math.min(nv(G, ctx, s[1]), P.energy || 0); P.energy -= n; if (n) { G.ev('energy', { p: ctx.p, n: -n, total: P.energy }); G.tlog({ k: 'cost', kind: 'eb', n, p: ctx.p, by: ctx.me.iid, eff: 1 }); } ctx.got = n > 0; ctx.count = n; },
  *stu(G, ctx, s) { const u = unitOf(G, ctx, s[2] || 'me'); if (u && isField(u.zone)) G.setState(u, s[1]); },   // a unit enters a named state
  *say(G, ctx, s) { G.log(s[1], ctx.p); },
  *shuf(G, ctx) { G.shuffle(ctx.p); },
  *pay(G, ctx, s) {
    const ks = s[1].map(mkCost);
    if (!ks.every(k => k.can(G, ctx.me, ctx.evt))) { ctx.stop = true; ctx.did = false; return; }
    const y = yield* G.yesNo(ctx.p, { title: 'จ่ายคอสต์เพื่อใช้สกิลของ ' + G.name(ctx.me) + '?', sub: 'คอสต์: ' + ks.map(k => k.label).join(' + '), iid: ctx.me.iid });
    if (!y) { ctx.stop = true; ctx.did = false; return; }
    const prev = G.cur; G.cur = { iid: ctx.me.iid, p: ctx.p, cost: true };
    const res = []; try { for (const k of ks) res.push(yield* k.pay(G, ctx.me, ctx.evt)); } finally { G.cur = prev; }
    ctx.did = true; (ctx.v = ctx.v || {}).$paid = [].concat(...res.filter(Array.isArray));   // ['use','paid'] = the cards this payment took
  },
  /* ['sina', 'me' | 'it']: use the Sinastery of this unit / of the chosen card (its cost is asked for; "this unit" stays the unit using it) */
  *sina(G, ctx, s) {
    const src = s[1] === 'it' ? G.cards[ctx.it[0]] : ctx.me; const S = src && G.def(src).sina; if (!S) return;
    if (S.c && !S.c.every(c => ev(G, ctx, c))) return;
    const ks = (S.k || []).map(mkCost); if (!ks.every(k => k.can(G, ctx.me, ctx.evt))) return;
    const y = yield* G.yesNo(ctx.p, { title: 'ใช้ Sinastery ของ ' + G.name(src) + '?', sub: (ks.length ? 'คอสต์: ' + ks.map(k => k.label).join(' + ') + ' → ' : '') + thSteps(S.d).slice(0, 120), iid: ctx.me.iid }); if (!y) return;
    const res = []; const prev = G.cur; G.cur = { iid: ctx.me.iid, p: ctx.p, cost: true }; try { for (const k of ks) res.push(yield* k.pay(G, ctx.me, ctx.evt)); } finally { G.cur = prev; }
    const c2 = Object.assign({}, ctx, { paid: res, it: [], stop: false }); yield* run(G, c2, S.d);
  },
  *ch(G, ctx, s, next) {
    const sel0 = s[1]; const X = pkxFor(G, ctx, ['field'], nv(G, ctx, sel0.n)); const sel = X ? Object.assign({}, sel0, { n: X.to, up: 1 }) : sel0; const list = unitsOf(G, ctx, sel).map(c => c.iid); const n = Math.min(nv(G, ctx, sel.n), list.length);
    const o1 = { title: 'เลือก' + thSel(sel), hint: hintFor(next, sel.s !== 'o'), zone: 'field' };
    ctx.it = sel.f && (sel.f.dist || sel.f.distg) && n > 1 ? yield* pickDistinct(G, ctx, list, n, sel.up, o1, !!sel.f.distg) : yield* G.chooseCards(ctx.p, list, Object.assign(o1, { min: sel.up ? 0 : n, max: n, noAuto: !!sel.up }));
    ctx.got = ctx.it.length > 0;
    // units remember which ability chose them (some skills ask "chosen by the ability of your vanguard this turn")
    for (const i of ctx.it) { const u = G.cards[i]; if (!u || !isField(u.zone)) continue; (u.chosen = u.chosen || []).push({ t: G.turnNo, by: ctx.me.iid, no: ctx.me.no, p: ctx.p, z: ctx.me.zone }); (G.tf['chl' + u.owner] = G.tf['chl' + u.owner] || []).push({ no: ctx.me.no, z: ctx.me.zone, p: ctx.p }); G.emit('chosen', { iid: i, by: ctx.me.iid, byP: ctx.p, byZone: ctx.me.zone, p: u.owner }); }
  },
  *pk(G, ctx, s, next) {
    const [, zones, n0, up0, F] = s; let n = nv(G, ctx, n0); let up = up0; { const X = pkxFor(G, ctx, zones, n); if (X) { n = X.to; up = 1; } } const list = zoneCards(G, ctx, zones).filter(i => i !== ctx.me.iid && mf(G, ctx.me, G.cards[i], F)); const m = Math.min(n, list.length);
    const zone = zones.length === 1 ? (zones[0] === 'looked' ? 'deck' : zones[0][0] === '$' || zones[0] === 'it' ? 'mixed' : zones[0].replace(/^o:/, '')) : 'mixed';
    const hint = zones[0] === 'hand' && next && next[0] === 'to' && next[2] !== 'order' ? 'discard' : zones[0] === 'hand' && next && next[0] === 'cl' ? 'max' : 'search';
    const o1 = { title: 'เลือก' + thF(F, n, up) + 'จาก' + zones.map(zth).join('หรือ'), hint, zone };
    ctx.it = F && (F.dist || F.distg) && m > 1 ? yield* pickDistinct(G, ctx, list, m, up, o1, !!F.distg) : yield* G.chooseCards(ctx.p, list, Object.assign(o1, { min: up ? 0 : m, max: m, noAuto: !!up || zones[0] === 'looked' }));
    ctx.got = ctx.it.length > 0;
    for (const i of ctx.it) { const u = G.cards[i]; if (u && u.zone === 'drop') G.emit('chosen', { iid: i, by: ctx.me.iid, byP: ctx.p, byZone: ctx.me.zone, p: u.owner, abType: G.cur ? G.cur.type : null }); }   // cards chosen from drop can react ("when this card is chosen by …")
  },
  *sr(G, ctx, s) {
    const [, zones, n0, up, F] = s; if (zones.includes('deck')) G.tlog({ k: 'look', p: ctx.p, by: ctx.me.iid }); const n = nv(G, ctx, n0); const list = zoneCards(G, ctx, zones).filter(i => mf(G, ctx.me, G.cards[i], F)); const m = Math.min(n, list.length);
    const o1 = { title: 'ค้นหา' + thF(F, n, up) + 'จาก' + zones.map(z => ZONE_TH[z]).join('หรือ'), hint: 'search', zone: zones.length === 1 ? zones[0] : 'mixed' };
    ctx.it = F && F.dist && m > 1 ? yield* pickDistinct(G, ctx, list, m, up, o1) : yield* G.chooseCards(ctx.p, list, Object.assign(o1, { min: up ? 0 : m, max: m, noAuto: true }));
    ctx.got = ctx.it.length > 0;
  },
  *lk(G, ctx, s) { if (s[2] !== 'o') G.tlog({ k: 'look', p: ctx.p, by: ctx.me.iid, byP: ctx.p, byNo: ctx.me.no }); const look1 = s[2] !== 'o' && G.rcs(ctx.p).some(u => G.def(u).look1); ctx.looked = G.players[s[2] === 'o' ? 1 - ctx.p : ctx.p].deck.slice(0, look1 ? 1 : nv(G, ctx, s[1])); ctx.it = ctx.looked.slice(); ctx.got = ctx.it.length > 0; if (ctx.looked.length) G.ev('look', { iids: ctx.looked.slice(), p: ctx.p, own: s[2] === 'o' ? 1 - ctx.p : ctx.p }); },
  *rvt(G, ctx, s) { ctx.looked = G.players[ctx.p].deck.slice(0, nv(G, ctx, s[1])); ctx.it = ctx.looked.slice(); for (const i of ctx.it) { G.ev('reveal', { iid: i, p: ctx.p }); G.log('เปิดเผย ' + G.name(G.cards[i]), ctx.p); } ctx.got = ctx.it.length > 0; },
  /* ['mboost', group]: those units all boost this attacking unit (rested; their power is added for the battle) */
  *mboost(G, ctx, s) { let n = 0; if (!G.battle) { ctx.count = 0; return; } for (const i of group(G, ctx, s[1])) { const u = G.cards[i]; if (!u || u.zone !== 'RC' || u.rest || u.iid === ctx.me.iid || G.stat(u).cantBoost) continue; const pw = G.stat(u).power; G.restUnit(i); G.addMod(ctx.me.iid, { power: pw }, 'battle'); if (!G.battle.booster) G.battle.booster = i; G.emit('boost', { iid: i, attacker: ctx.me.iid, p: ctx.p }); n++; } ctx.count = n; ctx.got = n > 0; (ctx.v = ctx.v || {}).boosters = n; G.log(G.name(ctx.me) + ' ถูกบูสต์พร้อมกัน ' + n + ' ใบ', ctx.p); },
  *copyab(G, ctx, s) { const src = G.cards[ctx.it[0]]; if (!src || !isField(ctx.me.zone)) return; for (const ab of G.def(src).abilities || []) if (!s[2] || ab.type === s[2]) G.grant(ctx.me.iid, ab, s[1] === 'f' ? 'fight' : 'turn'); G.log(G.name(ctx.me) + ' ได้รับสกิลทั้งหมดของ ' + G.name(src), ctx.p); },   // ['copyab', 'f' | 't']: this unit gets every ability of the chosen card
  *tgall(G, ctx, s) { if (!G.battle) return; const q = 1 - ctx.p; const us = G.units(q).filter(u => s[1] !== 'front' || u.zone === 'VC' || FRONT.includes(u.pos)); if (!us.length) return; const v = G.vg(q); G.battle.targets = [...new Set((v && us.includes(v) ? [v.iid] : []).concat(us.map(u => u.iid)))]; if (v && us.includes(v)) G.battle.targetZone = 'VC'; G.log(G.name(ctx.me) + ' สู้กับยูนิท' + (s[1] === 'front' ? 'แถวหน้า' : '') + 'ทั้งหมดของคู่ต่อสู้', ctx.p); },   // ['tgall', 'front']: this attack now battles all (front row) enemy units
  *itev(G, ctx, s) { const x = ctx.evt ? ctx.evt[s[1]] : null; ctx.it = x != null && G.cards[x] ? [x] : []; ctx.got = ctx.it.length > 0; },   // it = the card the event names (iid, rideFromIid, by, booster …)
  *note(G, ctx, s) { G.tlog({ k: s[1], p: ctx.p, by: ctx.me.iid }); },   // ['note', key]: leaves a mark in the turn log (ask with ["tlq", { k: key, battle: 1, th: '…' }])
  *bst(G, ctx) { const me = ctx.me; if (!G.battle || me.zone !== 'RC' || me.rest || G.battle.booster || G.stat(me).cantBoost) { ctx.got = false; return; } const a = G.cards[G.battle.attacker]; if (!a) return; const pw = G.stat(me).power; G.restUnit(me.iid); G.addMod(a.iid, { power: pw }, 'battle'); G.battle.booster = me.iid; G.emit('boost', { iid: me.iid, attacker: a.iid, p: ctx.p }); ctx.got = true; G.log(G.name(me) + ' บูสต์ ' + G.name(a), ctx.p); },   // this unit boosts the attacking unit now
  *retarget(G, ctx) { const u = G.cards[ctx.it[0]]; if (!G.battle || !u || !isField(u.zone)) { ctx.got = false; return; } G.battle.targets = [u.iid]; G.battle.targetZone = u.zone; ctx.got = true; G.log('เปลี่ยนเป้าโจมตีเป็น ' + G.name(u), ctx.p); },   // the attack now targets the chosen unit
  *reveal(G, ctx) { for (const i of ctx.it) { G.ev('reveal', { iid: i, p: ctx.p }); G.log('เปิดเผย ' + G.name(G.cards[i]), ctx.p); } ctx.got = ctx.it.length > 0; },
  *to(G, ctx, s) {
    const ids = s[1] === 'me' ? [ctx.me.iid] : ctx.it.slice(); let n = 0;
    for (const i of ids) if (yield* moveTo(G, ctx, i, s[2], s[3])) n++;
    ctx.got = n > 0; ctx.count = n;
  },
  *rs(G, ctx, s) {
    const rest = ctx.looked.filter(i => G.cards[i].zone === 'deck');
    for (const i of rest) { if (s[1] === 'bottom') G.move(i, 'deck', { bottom: true, reason: 'effect' }); else if (s[1] === 'drop') G.move(i, 'drop', { reason: 'discard' }); else if (s[1] === 'soul') G.move(i, 'soul', { reason: 'effect' }); else if (s[1] === 'bind' || s[1] === 'hand' || s[1] === 'removed') G.move(i, s[1], { reason: 'effect' }); }
    ctx.looked = []; ctx.count = rest.length; ctx.rest = rest.length;
  },
  *cl(G, ctx, s) {
    const ids = s[1] === 'me' ? [ctx.me.iid] : ctx.it.slice(); let n = 0;
    for (const i of ids) if (yield* callOne(G, ctx, i, s[2] || {})) n++;
    ctx.got = n > 0; ctx.count = n;
  },
  *rt(G, ctx, s) { const ids = s[1] === 'me' ? [ctx.me.iid] : s[1] === 'it' ? ctx.it.slice() : group(G, ctx, s[1]); let n = 0; for (const i of ids) { const c = G.cards[i]; if (c && isField(c.zone) && c.zone !== 'VC') { if (yield* G.wouldLeave(i)) continue; const wasGC = c.zone === 'GC'; G.log('รีไทร์ ' + G.name(c), ctx.p); G.retire(i, 'effect', ctx.me.iid); n++; if (wasGC && isField(ctx.me.zone) && G.stat(ctx.me).gcNoHit) for (const u of G.units(c.owner)) if (u) u.mods = u.mods.filter(m => !m.cantBeHit); } } ctx.got = n > 0; ctx.count = n; },
  *rtall(G, ctx, s) { let n = 0; for (const c of G.rcs(1 - ctx.p)) { if (s[1] && !(s[1] === 'f' ? FRONT : BACK).includes(c.pos)) continue; if (s[2] && COL[c.pos] !== COL[ctx.me.pos]) continue; if (yield* G.wouldLeave(c.iid)) continue; G.retire(c.iid, 'effect', ctx.me.iid); n++; } ctx.got = n > 0; ctx.count = n; },
  *st(G, ctx, s) { let n = 0; const dbl = (G.def(ctx.me).tags || []).some(t => String(t).toLowerCase() === 'double attack'); for (const i of group(G, ctx, s[1])) { const c = G.cards[i]; if (dbl && c && isField(c.zone) && G.stat(c).noDblSt) continue; if (c && c.zone === 'order') { if (c.rest) { c.rest = false; n++; } } else if (G.standUnit(i)) n++; } ctx.got = n > 0; ctx.count = n; },
  *re(G, ctx, s) { for (const i of group(G, ctx, s[1])) G.restUnit(i); },
  *bf(G, ctx, s) {
    const mod = Object.assign({}, s[2]);
    if (s[4]) { const k = count(G, ctx, s[4]); for (const key of ['power', 'shield', 'crit', 'drive']) if (mod[key]) mod[key] *= k; if (!k) return; }
    for (const i of group(G, ctx, s[1])) { const x = G.cards[i]; if (x && x.owner !== ctx.p && isField(x.zone) && G.stat(x).immune) continue; G.addMod(i, mod, DUR[s[3]] || 'turn'); }   // "cannot be affected by your opponent's cards"
  },
  *pget(G, ctx, s) {
    const me = ctx.me; const abs = s[1].map(a => mkAbility(a, { type: 'unit' }));
    const fxo = { until: s[2] === 'f' ? 'fight' : s[2] === 'o' ? 'exp' : s[2] === 'b' ? 'battle' : 'turn', exp: s[2] === 'o' ? G.expTurn(ctx.p) : undefined, label: s[1].map(thAbility).join(' / '), aura: (G2, c) => { let out = null; for (const ab of abs) { if ((ab.cond && !ab.cond(G2, me)) || !ab.aura) continue; const m = ab.aura(G2, me, c); if (m) { out = out || {}; for (const k in m) out[k] = typeof m[k] === 'number' ? (out[k] || 0) + m[k] : m[k]; } } return out; } };
    if (s[1].some(a => a.t === 'c' || (!a.t && a.m))) { G.players[ctx.p].effects.push(fxo); if (s[1].some(a => typeof a.s === 'object' && a.s.s !== 'm')) G.players[1 - ctx.p].effects.push(fxo); }
    for (const a of s[1]) if (a.t === 'a' || a.t === 'k') for (const ab of [].concat(mkAbility(a, { type: 'unit' }))) { const P = G.players[ctx.p]; (P.pabs = P.pabs || []).push({ id: G.gid++, ab, until: fxo.until, exp: fxo.exp }); }   // AUTO / ACT the player got: carried by the vanguard   // an effect on the opponent's units is looked up on their side
  },
  *grant(G, ctx, s) { const abs = [].concat(...[].concat(s[2]).map(x => mkAbility(x, { type: 'unit' }))); for (const a of abs) for (const i of group(G, ctx, s[1])) G.grant(i, a, s[3] === 'o' ? 'exp' : DUR[s[3]] || 'turn'); },
  /* ['tk', name, n, optional, open, pos, { col: 1 another RC of this unit's column | 2 any RC of it, row: 'f'|'b', mypos: 1 (the circle this unit is / was on), unit: 1 (a circle with a unit), rest: 1, it: 1 (it = the tokens) }] */
  *tk(G, ctx, s) { const no = tokNo(s[1]); const o = s[6] || {}; if (!no) { ctx.got = false; return; } const out = []; const N = nv(G, ctx, s[2]); const me = ctx.me;
    for (let i = 0; i < N; i++) { let circles = null;
      if (o.col) { const mp = me.zone === 'RC' || me.zone === 'VC' ? me.pos : me.lastPos; circles = RCS.filter(k => mp && COL[k] === COL[mp] && (o.col === 2 || k !== mp)); }
      if (o.row) circles = (circles || RCS).filter(k => (o.row === 'f' ? FRONT : BACK).includes(k));
      if (o.mypos) circles = me.zone === 'RC' ? [me.pos] : me.lastPos && RCS.includes(me.lastPos) ? [me.lastPos] : [];
      if (o.unit) circles = (circles || RCS).filter(k => G.at(ctx.p, k));
      if (s[4] && !(circles || RCS).some(k => !G.at(ctx.p, k))) break;
      const t = yield* G.callToken(ctx.p, no, { optional: !!s[3], pos: s[5], open: !!s[4], circles, rest: !!o.rest }); if (!t) break; out.push(t); }
    ctx.got = out.length > 0; ctx.count = out.length; if (o.it) ctx.it = out; },
  *or(G, ctx, s) {
    if ((G.tf['or2' + ctx.p] || []).some(nm => G.def(ctx.me).name.includes(nm))) { yield* run(G, ctx, s[1]); yield* run(G, ctx, s[2]); return; }   // "when you would perform one of these, perform two instead"
    const id = yield* G.chooseOption(ctx.p, G.name(ctx.me) + ': เลือก', [{ id: 'a', label: thSteps(s[1]).slice(0, 80) }, { id: 'b', label: thSteps(s[2]).slice(0, 80) }], { iid: ctx.it[0] != null ? ctx.it[0] : ctx.me.iid });
    yield* run(G, ctx, id === 'b' ? s[2] : s[1]);
  },
  *topTo(G, ctx, s) { const D = G.players[ctx.p].deck; ctx.it = []; const n = nv(G, ctx, s[1]); for (let i = 0; i < n && D.length; i++) { const t = D[0]; ctx.it.push(t); G.move(t, s[2], { reason: s[2] === 'drop' ? 'discard' : s[2] === 'soul' ? 'sc' : 'effect' }); } ctx.got = ctx.it.length > 0; ctx.count = ctx.it.length; },
  /* ['ride', it|me, 'rest' (ride as rest; default stand), 'carry' (the new vanguard keeps the trigger power / critical the old one got this turn)] */
  *ride(G, ctx, s) { const i = s[1] === 'me' ? ctx.me.iid : ctx.it[0]; const keep = s[3] === 'carry' ? G.vg(ctx.p).mods.filter(m => m.trig).map(m => Object.assign({}, m)) : []; ctx.got = i != null && G.superRide(ctx.p, i, s[2] === 'rest' ? 'rest' : true); if (ctx.got) { for (const m of keep) G.cards[i].mods.push(m); ctx.it = [i]; } },
  *if(G, ctx, s) { if (ev(G, ctx, s[1])) yield* run(G, ctx, s[2]); else if (s[3]) yield* run(G, ctx, s[3]); },
  *may(G, ctx, s) {
    const y = yield* G.yesNo(ctx.p, { title: G.name(ctx.me) + ': ' + thSteps(s[1]).slice(0, 90) + '?', iid: ctx.me.iid, options: [{ id: 'yes', label: 'ทำ' }, { id: 'no', label: 'ไม่ทำ' }] });
    ctx.did = y; if (y) yield* run(G, ctx, s[1]); else ctx.got = false;
  },
  /* later: when = b (end of this battle) · t (end of this turn) · S R M B (start of MY next turn / ride / main / battle phase) · E (end of my next own turn) · oS oM oB oE (the opponent's) */
  *later(G, ctx, s) {
    const c2 = Object.assign({}, ctx, { it: ctx.it.slice(), v: ctx.v ? Object.assign({}, ctx.v) : undefined }); let when = s[1], lp = ctx.p;
    if (when[0] === 'o') { when = when[1]; lp = 1 - ctx.p; }
    const rec = { when, p: lp, src: ctx.me.iid, fn: function* () { c2.stop = false; yield* run(G, c2, s[2]); } };
    if ('SRMBE'.includes(when)) rec.from = G.turnNo + 1;
    G.laters.push(rec);
  },
  *modal(G, ctx, s) {
    if (s[2]) {   // perform every listed effect in order
      for (const o of s[1]) {
        if (ctx.stop) return; if (o.c && !ev(G, ctx, o.c)) continue;
        if (o.k) { const ks = o.k.map(mkCost); if (!ks.every(k => k.can(G, ctx.me, ctx.evt))) continue; const y = yield* G.yesNo(ctx.p, { title: 'จ่ายคอสต์เพื่อใช้เอฟเฟกต์ของ ' + G.name(ctx.me) + '?', sub: 'คอสต์: ' + ks.map(k => k.label).join(' + '), iid: ctx.me.iid }); if (!y) continue; const prev = G.cur; G.cur = { iid: ctx.me.iid, p: ctx.p, cost: true }; try { for (const k of ks) yield* k.pay(G, ctx.me, ctx.evt); } finally { G.cur = prev; } }
        yield* run(G, ctx, o.d);
      }
      return;
    }
    if (s[3] != null) {   // ['modal', options, 0, count]: perform that many different options (all when the count covers them)
      const k = nv(G, ctx, s[3]); const used = new Set();
      for (let r = 0; r < k && !ctx.stop; r++) { const left = s[1].map((o, i) => ({ o, i })).filter(({ o, i }) => !used.has(i) && (!o.c || ev(G, ctx, o.c))); if (!left.length) break; const id = left.length === 1 || k >= s[1].length ? String(left[0].i) : yield* G.chooseOption(ctx.p, G.name(ctx.me) + ': เลือกเอฟเฟกต์ (' + (r + 1) + '/' + k + ')', left.map(({ o, i }) => ({ id: String(i), label: thSteps(o.d).slice(0, 80) })), { iid: ctx.me.iid }); if (id == null) break; used.add(+id); yield* run(G, ctx, s[1][+id].d); }
      return;
    }
    const opts = s[1].map((o, i) => ({ o, i })).filter(({ o }) => (!o.c || ev(G, ctx, o.c)) && (!o.k || o.k.map(mkCost).every(k => k.can(G, ctx.me, ctx.evt))));
    if (!opts.length) return;
    const list = opts.map(({ o, i }) => ({ id: String(i), label: (o.k ? o.k.map(k => mkCost(k).label).join(' + ') + ' → ' : '') + thSteps(o.d).slice(0, 80) }));
    if (opts.every(({ o }) => o.k)) list.push({ id: 'none', label: 'ไม่ใช้' });
    const id = yield* G.chooseOption(ctx.p, G.name(ctx.me) + ': เลือกเอฟเฟกต์', list, { iid: ctx.me.iid });
    if (id == null || id === 'none') return;
    const o = s[1][+id];
    if (o.k) { const prev = G.cur; G.cur = { iid: ctx.me.iid, p: ctx.p, cost: true }; ctx.paid = []; try { for (const k of o.k.map(mkCost)) ctx.paid.push(yield* k.pay(G, ctx.me, ctx.evt)); } finally { G.cur = prev; } }
    yield* run(G, ctx, o.d);
  },
  *odisc(G, ctx, s) { const q = 1 - ctx.p, H = G.players[q].hand; const n = Math.min(nv(G, ctx, s[1]), H.length); const sel = yield* G.chooseCards(q, H.slice(), { min: n, max: n, title: 'เลือกการ์ดจากมือเพื่อทิ้ง ' + n + ' ใบ', hint: 'discard', zone: 'hand' }); for (const i of sel) G.move(i, 'drop', { reason: 'discard' }); ctx.got = sel.length > 0; },
  *oret(G, ctx, s) { const q = 1 - ctx.p; const list = G.rcs(q).filter(c => !s[2] || mf(G, ctx.me, c, s[2])).map(c => c.iid); const n = Math.min(nv(G, ctx, s[1]), list.length); const sel = yield* G.chooseCards(q, list, { min: n, max: n, title: 'เลือกเรียร์การ์ดของคุณเพื่อรีไทร์ ' + n + ' ใบ', hint: 'discard', zone: 'field' }); for (const i of sel) G.retire(i, 'effect', ctx.me.iid); ctx.got = sel.length > 0; },
  *odraw(G, ctx, s) { G.draw(1 - ctx.p, nv(G, ctx, s[1])); },
  *lock(G, ctx) { for (const i of ctx.it) G.lock(i); },
  *unlock(G, ctx) { let n = 0; for (const i of ctx.it) if (G.unlock(i)) n++; ctx.got = n > 0; ctx.count = n; },
  *itfd(G, ctx) { for (const i of ctx.it) { const c = G.cards[i]; if (c && (c.zone === 'damage' || c.zone === 'bind' || c.zone === 'order')) c.faceup = false; } },
  *itfu(G, ctx) { let n = 0; for (const i of ctx.it) { const c = G.cards[i]; if (c && !c.faceup && (c.zone === 'damage' || c.zone === 'bind' || c.zone === 'order')) { c.faceup = true; n++; } } ctx.got = n > 0; ctx.count = n; },   // turn the chosen face-down cards face up   // turn the chosen damage / bind cards face down
  *ebonly(G, ctx, s) { G.tf['ebonly' + ctx.p] = s[1].slice(); },   // this turn you may energy-blast only for abilities of cards with these name parts
  *man(G, ctx) { yield* G.manualStep(ctx.p, ctx.me); },
  /* put a marker on one of your rear-guard circles: s = ['mk', name, { no: only circles without it, n }] */
  *mk(G, ctx, s) {
    const o = s[2] || {}; let n = 0;
    if (o.opp || o.any) {   // on the opponent's circles ({ opp: 1 }) or any fighter's ({ any: 1 }): asked as a list
      const CT = { FL: 'หน้าซ้าย', FR: 'หน้าขวา', BL: 'หลังซ้าย', BC: 'หลังกลาง', BR: 'หลังขวา' }; const used = new Set();
      for (let k = 0; k < (o.n || 1); k++) { const opts = []; for (const q of o.any ? [ctx.p, 1 - ctx.p] : [1 - ctx.p]) for (const c of RCS) { if (used.has(q + c) || (o.no && G.markerCount(q, c, s[1]))) continue; const u = G.at(q, c); opts.push({ id: q + ':' + c, label: (q === ctx.p ? 'RC ของคุณ ' : 'RC ของคู่ต่อสู้ ') + CT[c] + (u ? ' (' + G.name(u) + ')' : '') }); }
        if (!opts.length) break; const id = yield* G.chooseOption(ctx.p, 'วาง ' + s[1] + ' marker บนเซอร์เคิลไหน? (' + (k + 1) + '/' + (o.n || 1) + ')', opts, { iid: ctx.me.iid }); if (!id) break; const [q, c] = id.split(':'); used.add(q + c); G.addMarker(+q, c, s[1], ctx.p); n++; }
      ctx.got = n > 0; ctx.count = n; return; }
    for (let k = 0; k < (o.n || 1); k++) {
      const circles = RCS.filter(c => !o.no || !G.markerCount(ctx.p, c, s[1])); if (!circles.length) break;
      const c = circles.length === 1 ? circles[0] : yield* G.chooseCircle(ctx.p, circles, { title: 'วาง ' + s[1] + ' marker บนเซอร์เคิลไหน?', hint: 'marker', noAuto: true });
      if (!c) break; G.addMarker(ctx.p, c, s[1], ctx.p); n++;
    }
    ctx.got = n > 0; ctx.count = n;
  },
  /* ['mkrm', name ('' = any), { it: 1 (from the circle of the chosen unit), mine: 1 (only markers I put), opp: 1 (on the opponent's circles), all: 1 }] */
  *mkrm(G, ctx, s) { const o = s[2] || {}; const nm = s[1] || null; let n = 0; const by = o.mine ? ctx.p : null;
    if (o.it) { const u = G.cards[ctx.it[0]]; if (u && u.zone === 'RC' && G.removeMarker(u.owner, u.pos, nm, by)) n++; }
    else if (o.all) { const q = o.opp ? 1 - ctx.p : ctx.p; while (G.removeMarker(q, null, nm, by)) n++; }
    else { const q = o.opp ? 1 - ctx.p : null; if (G.removeMarker(q, null, nm, by)) n++; }
    for (const P of G.players) for (const i of P.gauge.slice()) { const x = G.cards[i]; if (x.gk === 'mk' && !G.markers.some(m => m.card === i)) G.move(i, 'drop', { reason: 'effect' }); }   // a card that served as a marker goes to drop with it
    ctx.got = n > 0; ctx.count = n; },
  *trstart(G, ctx) { const P = G.players[ctx.p]; if (ctx.me.zone === 'ride') G.move(ctx.me.iid, 'order', { reason: 'effect' }); const pool = P.ride.filter(i => G.def(G.cards[i]).type === 'unit' && !G.def(G.cards[i]).name.includes('Kiwame')); if (!pool.length) return; const [i] = yield* G.chooseCards(ctx.p, pool, { min: 1, max: 1, title: 'เลือกยูนิทที่จะฝึก (Training)', zone: 'ride', hint: 'search' }); if (i == null) return; G.move(i, 'order', { reason: 'effect' }); G.cards[i].faceup = true; G.cards[i].training = true; G.log('เริ่มฝึก ' + G.name(G.cards[i]), ctx.p); },   // Training Equipment at Stand Up
  *kiwride(G, ctx) { const t = G.cards[ctx.it[0]]; if (!t) { ctx.got = false; return; } const base = VG.card(t.no).name; const P = G.players[ctx.p]; const pool = P.deck.concat(G.handFor(ctx.p)).filter(i => { const d = G.def(G.cards[i]); return d.type === 'unit' && d.name.includes(base) && d.name.includes('Kiwame'); });
    const sel = pool.length ? yield* G.chooseCards(ctx.p, pool, { min: 0, max: 1, title: 'เลือกการ์ด "' + base + '" Kiwame ที่จะไรด์', zone: 'deck', hint: 'search' }) : []; let rode = false;
    if (sel.length) rode = G.superRide(ctx.p, sel[0], 'stand'); G.shuffle(ctx.p); ctx.got = rode;
    if (rode) { G.move(ctx.me.iid, 'soul', { reason: 'effect' }); const race = (G.def(G.vg(ctx.p)).race || ''); const m = /-\s*([A-Za-z]+)/.exec(race); if (m) { const nm = m[1] + "'s Ability Kiwame"; if (VG.DB.rows.find(x => x.name === nm)) yield* X.gcrest(G, ctx, ["gcrest", nm]); G.kiwOn = true; G.kiwCache = {}; } yield* G.checkTiming(); } },   // ride the Kiwame form of the trained card; then get the crest of your vanguard's weapon type
  *egon(G, ctx, s) { const t = G.cards[ctx.it[0]]; if (!t || t.zone !== 'RC' || t.owner !== ctx.p) { ctx.got = false; return; } const P = G.players[ctx.p]; const zs = s[1] || ['hand'];
    const pool = zs.flatMap(z => z === 'hand' ? G.handFor(ctx.p) : P[z] || []).filter(i => { const d = G.def(G.cards[i]); return d.egF && d.type === 'unit' && mf(G, G.cards[i], t, d.egF); }); if (!pool.length) { ctx.got = false; return; }
    const sel = yield* G.chooseCards(ctx.p, pool, { min: s[2] ? 0 : 1, max: 1, title: 'เลือกการ์ดที่จะ Explosive Growth ให้ ' + G.name(t), zone: zs[0], hint: 'search' }); if (!sel.length) { ctx.got = false; return; }
    const c = G.cards[sel[0]]; const pos = t.pos; G.pendBS = c.iid; const ok = G.toGauge(t.iid, 'growth', c.iid, false, { reason: 'call' }); G.pendBS = null; if (!ok) { ctx.got = false; return; }
    G.log('Explosive Growth! ' + G.name(c), ctx.p); G.placeRC(c.iid, pos, { reason: 'call', extra: { od: 'e' } }); c.rest = false; G.tlog({ k: 'eg', iid: c.iid, p: ctx.p }); ctx.got = true; },   // [Explosive Growth] a card from hand (or drop) onto that rear-guard, as [Stand]
  *egsplit(G, ctx) { const me = ctx.me; if (me.zone !== 'RC') return; const fs = G.gaugeOf(me.iid, 'growth'); if (!fs.length) return; const pos = me.pos; const f = fs[0]; G.cards[f].gh = null; G.move(me.iid, 'hand', { reason: 'effect' }); if (G.cards[f].zone !== 'RC' && !G.at(ctx.p, pos)) { G.move(f, 'RC', { pos, rest: true, reason: 'effect' }); } },   // leave the growth factor on this circle as [Rest] and return this unit to hand
  *alcx(G, ctx, s) {   // alchemix (魔獣合成): choose your rear-guards (different names, matching F); if two or more, stack them all under an Ubermensch token on (RC)
    const F = s[1] || {}; const pool = G.rcs(ctx.p).filter(u => !u.token && mf(G, ctx.me, u, F)).map(u => u.iid); const toks = G.rcs(ctx.p).filter(u => G.def(u).name.includes('Ubermensch')).map(u => u.iid);
    if (!toks.length) { ctx.got = false; return; }
    const sel = yield* G.chooseCards(ctx.p, pool, { min: 0, max: pool.length, title: 'เลือกเรียร์การ์ดชื่อต่างกันที่จะ Alchemix (2 ใบขึ้นไป)', zone: 'field', hint: 'discard' });
    const seen = new Set(); const ids = sel.filter(i => { const n = G.def(G.cards[i]).name; if (seen.has(n)) return false; seen.add(n); return true; }); if (ids.length < 2) { ctx.got = false; return; }
    const [h] = toks.length === 1 ? toks : yield* G.chooseCards(ctx.p, toks, { min: 1, max: 1, title: 'เลือกโทเค็น Ubermensch', zone: 'field', hint: 'buff' });
    for (const i of ids) G.toGauge(i, 'alcx', h, false, { reason: 'effect' }); G.log('Alchemix! ' + ids.length + ' ใบ ใต้ ' + G.name(G.cards[h]), ctx.p); G.tlog({ k: 'alcx', iid: h, p: ctx.p, n: ids.length });
    ctx.it = [h]; ctx.got = true; G.emit('alchemixed', { p: ctx.p, host: h, ids }); },
  *tofront(G, ctx) { const me = ctx.me; if (me.zone !== 'RC') return; const f = { BL: 'FL', BR: 'FR' }[me.pos]; if (!f || G.at(ctx.p, f)) return; const y = yield* G.yesNo(ctx.p, { kind: 'tofront', title: 'ย้าย ' + G.name(me) + ' ไปแถวหน้า?', iid: me.iid, options: [{ id: 'yes', label: 'ย้าย' }, { id: 'no', label: 'ไม่ย้าย' }] }); if (y) G.moveUnit(me.iid, f); },   // you may move this unit to the open front row circle of its column
  *fplus(G, ctx, s) { G.formulaUp(ctx.p, nv(G, ctx, s[1] || 1)); },   // your formula count gets +n
  *guessg(G, ctx, s) { const q = 1 - ctx.p; const H = G.handFor(q); if (!H.length) { ctx.got = false; return; } const [c] = yield* G.chooseCards(q, H, { min: 1, max: 1, title: 'เลือกการ์ดในมือ 1 ใบ (คู่ต่อสู้จะทายเกรด)', zone: 'hand', hint: 'search' });
    const id = yield* G.chooseOption(ctx.p, 'ประกาศเกรด', [0, 1, 2, 3, 4].map(g => ({ id: String(g), label: 'เกรด ' + g })), { iid: ctx.me.iid }); G.ev('reveal', { iid: c, p: q }); G.log('เปิดเผย ' + G.name(G.cards[c]) + ' (ประกาศเกรด ' + id + ')', ctx.p); ctx.got = String(G.def(G.cards[c]).grade || 0) === String(id); },   // your opponent chooses a card from hand, you declare a grade, they reveal it: got = the grade matched
  *vswap(G, ctx, s) { const r = s[1] === 'me' ? ctx.me : G.cards[ctx.it[0]]; ctx.got = !!r && G.swapVR(ctx.p, r.iid); if (ctx.got && s[2] === 'rest') G.vg(ctx.p).rest = true; },   // swap your vanguard with that rear-guard (or this unit)
  *dlegion(G, ctx, s) { ctx.got = yield* G.dLegion(ctx.p, s[1]); },   // [D-Legion] with the named card(s)
  *ghand(G, ctx) { G.giveTicket(ctx.p, VG.TICKET_GH, ctx.me); ctx.got = true; },   // put a God Hand ticket into hand
  *pst(G, ctx) { G.giveTicket(ctx.p, VG.ticketNo(), ctx.me); ctx.got = true; },
  *odrop(G, ctx) { let n = 0; for (const d of (ctx.me.dress || []).slice()) { G.move(d, 'drop', { reason: 'effect' }); n++; } ctx.got = n > 0; ctx.count = n; },
  *hostsel(G, ctx) { const h = ctx.me.zone === 'dress' ? G.cards[ctx.me.host] : null; ctx.it = h && isField(h.zone) ? [h.iid] : []; ctx.got = ctx.it.length > 0; },   // the unit this card lies under
  *state(G, ctx, s) { const P = G.players[ctx.p]; if (!inState(G, ctx.p, s[1])) { P.effects.push(Object.assign({ state: s[1], label: s[1] }, s[2] === 'o' ? { until: 'exp', exp: G.expTurn(ctx.p) } : { until: DUR[s[2]] || 'turn' })); G.log(P.name + ' เข้าสู่ "' + s[1] + '"', ctx.p); G.ev('state', { p: ctx.p, name: s[1] }); G.emit('state', { p: ctx.p, st: s[1] }); } },
  *pfx(G, ctx, s) { if (s[1] === 'guardMin') G.players[1 - ctx.p].effects.push(Object.assign({ guardMin: s[3], label: 'การ์ดจากมือต้องคอลครั้งละ ' + s[3] + ' ใบขึ้นไป' }, s[2] === 'o' ? { until: 'exp', exp: G.expTurn(ctx.p) } : { until: DUR[s[2]] || 'turn' }));
    if (s[1] === 'noInt') G.players[1 - ctx.p].effects.push(Object.assign({ noInt: 1, label: 'อินเตอร์เซปต์ไม่ได้' }, s[2] === 'o' ? { until: 'exp', exp: G.expTurn(ctx.p) } : { until: DUR[s[2]] || 'turn' }));
    /* effects on yourself: scPlus (soul-charge +n by your card's abilities), rearDrive … — ['pfx', key, dur, n, 'o' = on the opponent] */
    if (!['guardMin', 'noInt'].includes(s[1])) G.players[s[4] === 'o' ? 1 - ctx.p : ctx.p].effects.push(Object.assign({ [s[1]]: s[3] == null ? 1 : s[3], label: PFX_TH[s[1]] || s[1] }, s[2] === 'o' ? { until: 'exp', exp: G.expTurn(ctx.p) } : { until: s[2] === 'f' ? 'fight' : DUR[s[2]] || 'turn' })); },
};
/* markers that carry rules for the unit standing on their circle */
const MKAB_SRC = { 'x-ceed net': [
  { t: 'c', z: 'R', c: [['vg', { nh: 'Impauldio' }], ['my']], m: { power: 5000 }, per: ['div', ['gz', 'automod'], 2] },
  { t: 'a', z: 'R', on: { e: 'tend' }, c: [['vg', { nh: 'Impauldio' }], ['uis', 'me', { nh: 'X-CeeDaNCe' }]], k: [['eb', 2]], d: [['to', 'me', 'hand']] }] };
const MKAB = {};
VG.fx_mkab = name => { if (!(name in MKAB)) MKAB[name] = MKAB_SRC[name] ? [].concat(...MKAB_SRC[name].map(a => mkAbility(a, { type: 'unit' }))) : null; return MKAB[name]; };
VG.JAIL = null;
VG.fx_initJail = function () { if (VG.JAIL) return; VG.JAIL = [
  mkAbility({ t: 'k', z: 'V', c: [['not', ['pfxOn', 'noJail']], ['cnt', 'prison', '>=', 1]], k: [['sb', 1]], d: [['pk', ['prison'], 1, 0, {}], ['jcall']] }, { type: 'unit' }),
  mkAbility({ t: 'k', z: 'V', c: [['not', ['pfxOn', 'noJail']], ['cnt', 'prison', '>=', 1]], k: [['cb', 1]], d: [['pk', ['prison'], 2, 0, {}], ['jcall']] }, { type: 'unit' })].map((a, i) => { const ab = [].concat(a)[0]; ab.label = 'ออกจากพริซัน: ' + (i ? 'เคาน์เตอร์บลาสต์ 1 → คอลการ์ดที่ถูกขัง 2 ใบ' : 'โซลบลาสต์ 1 → คอลการ์ดที่ถูกขัง 1 ใบ'); return ab; }); };
function* run(G, ctx, steps) {
  for (let i = 0; i < steps.length; i++) {
    if (ctx.stop) return; G.stepNo = (G.stepNo || 0) + 1; G.fxv = ctx.v = ctx.v || {};
    const s = steps[i]; const f = X[s[0]]; if (!f) throw new Error('fx: unknown step ' + s[0]);
    yield* f(G, ctx, s, steps[i + 1]);
  }
}
const mkCtx = (me, evt) => ({ p: me.owner, me, evt: evt || {}, it: [], looked: [], did: false, got: false, count: 0, stop: false, drew: 0, where: null });

/* ---------- triggers ---------- */
function phOk(G, me, ph) {
  if (!ph) return true; const mine = G.active === me.owner;
  if (ph === 't') return mine; if (ph === 'o') return !mine; if (ph === 'nb') return G.phase !== 'battle';
  return mine && G.phase[0] === ph;
}
function byOk(G, me, t, e) {
  if (!t.by) return true; const src = e.by != null ? G.cards[e.by] : null;
  if (t.by === 'o') return e.byP === 1 - me.owner || (e.cause === 'battle' && false);
  if (t.by === 'x') return !!src;
  if (t.by === 'c') return e.byP === me.owner && !!e.byCost && (!t.byv || (src && src.zone === 'VC')) && (!t.byf || (src && mf(G, me, src, t.byf)));
  if (t.by === 'nu') return !src || !(G.def(src).type === 'unit' || G.def(src).type === 'token');
  if (!src || e.byP !== me.owner) return false;
  if (t.by === 'v' && src.zone !== 'VC') return false;
  return !t.byf || mf(G, me, src, t.byf);
}
const tgOk = (G, me, f, iid) => !f || (G.cards[iid] && mf(G, me, G.cards[iid], f.k ? Object.assign({}, f, { k: null }) : f) && (!f.k || (f.k === 'v') === (G.cards[iid].zone === 'VC' || (G.battle && G.battle.targets[0] === iid && G.battle.targetZone === 'VC'))));
/* was the choosing ability the one a skill asks for?  by = { k: 'v' vanguard | 'o' order zone | 'u' unit, gmin, nh, nh2, nm } */
function choseOk(G, me, by, x) {
  if (!by) return true; const d = VG.card(x.no); if (!d) return false;
  if (by.k === 'v' && x.z !== 'VC') return false; if (by.k === 'o' && x.z !== 'order') return false; if (by.k === 'u' && !(x.z === 'VC' || x.z === 'RC')) return false;
  if (by.gmin && !(d.grade >= by.gmin)) return false; if (by.nm && d.name !== by.nm && d.as !== by.nm) return false;
  if (by.nh && !(d.name.includes(by.nh) || (by.nh2 && d.name.includes(by.nh2)))) return false;
  return true;
}
function mkTrig(t, z) {
  const zone = z ? zn(z) : undefined;
  const self = (on, match, zo) => ({ on, zone: zo === undefined ? zone : zo, match });
  const any = (on, match) => ({ on, who: 'any', zone: zone || ['VC', 'RC', 'order'], match });
  switch (t.e) {
    case 'dress': return self('toDress', () => true, null);
    case 'trigz': return self('dcheck', () => true, null);
    case 'sung': return t.me ? self('sung', () => true, null) : any('sung', (G, me, e) => e.p === me.owner && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)));   // this song is sung / I sing a song
    case 'rtd': return any('retried', (G, me, e) => (t.me ? e.iid === me.iid : e.p === me.owner && (!t.col || (G.cards[e.iid].pos && COL[G.cards[e.iid].pos] === COL[me.pos])) && (!t.wf || mf(G, me, G.cards[e.iid], t.wf))));
    case 'ustood': return any('stood', (G, me, e) => e.p === me.owner && (!t.own || e.by === e.iid) && (!t.ab || (e.by != null && e.byP === me.owner)) && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)));   // your unit stands ({ wf, own: by its own ability })   // a unit retries ({me, col})
    case 'ossoul': return any('osSoul', (G, me, e) => e.ids.includes(me.iid));   // this card was put into soul for the cost of [Over Soul] (ability zone S)
    case 'strd': return any('strode', (G, me, e) => e.p === me.owner && phOk(G, me, t.ph) && (!t.f || mf(G, me, G.cards[e.iid], t.f)));   // your G unit strides ({ ph, f })
    case 'sdisc': return any('strideDisc', (G, me, e) => e.ids.includes(me.iid));
    case 'sbme': return any('sbcost', (G, me, e) => (e.ids || []).includes(me.iid) && (t.by !== 'v' || (e.by != null && !!G.cards[e.by] && G.cards[e.by].zone === 'VC')));   // this card was soul-blasted for a cost (by: 'v' = of your vanguard's ability)   // this card was discarded from hand for the cost of stride (ability zone D)
    case 'alcxd': return { on: 'alchemixed', who: 'any', zone: ['gauge'], match: (G, me, e) => e.ids.includes(me.iid) };   // this card is alchemixed (stacked under the token)
    case 'alcxh': return any('alchemixed', (G, me, e) => e.host === me.iid);   // this unit alchemixes (cards were stacked under it)
    case 'ualcx': return any('alchemixed', (G, me, e) => e.p === me.owner);   // you alchemix
    case 'dlpl': return self('dLegion', (G, me, e) => e.iid === me.iid, null);   // this card is placed by the [D-Legion] ability
    case 'smUsed': return self('smUsed', () => true, null);   // this special move is used
    case 'smFlip': return any('smFlip', (G, me, e) => e.p === me.owner && (!t.off || e.off));   // a special move of yours turns face up ({ off: only Offence moves })   // a special move of yours turns face up
    case 'atkUsed': return self('atkUsed', () => true, null);   // Mushiking: this attack (card in the order zone) is used
    case 'gotc': return self('toCrest', () => true, null);   // you get this crest
    case 'oprd': return self('operated', (G, me, e) => phOk(G, me, t.ph) && byOk(G, me, t, e), null);   // this card is operated ({ ph, by, byf })
    case 'domAtk': return any('attack', (G, me, e) => e.p === me.owner && G.cards[e.iid] && G.cards[e.iid].dom && G.cards[e.iid].dom.p === me.owner);   // a unit dominated by you attacks
    case 'domHit': return any('hit', (G, me, e) => e.p === me.owner && G.cards[e.iid] && G.cards[e.iid].dom && G.cards[e.iid].dom.p === me.owner);   // the attack by a unit dominated by you hits
    case 'uopr': return any('operated', (G, me, e) => e.p === me.owner && (!t.f || mf(G, me, G.cards[e.iid], t.f)) && (!t.ot || (e.by != null && e.by !== e.iid)));   // you operate a product ({ f, ot: by another card's ability })
    case 'lnkd': return self('linked', (G, me, e) => true, null);
    case 'opwdn': return any('powerDown', (G, me, e) => e.p !== me.owner && G.cards[e.iid] && G.cards[e.iid].zone === 'RC' && e.byP === me.owner && (!t.byf || mf(G, me, G.cards[e.by], t.byf)), zone || 'field');   // an opponent's rear-guard's power is reduced by your card's ability   // this unit becomes in the link attack state
    case 'stup': return any('stoodUp', (G, me, e) => me.zone === 'VC' || me.zone === 'ride');   // Stand Up (also from the ride deck: Training Equipment)   // when you stand up (the game begins)
    case 'armd': return t.me ? self('armed', (G, me, e) => phOk(G, me, t.ph), null) : any('armed', (G, me, e) => e.p === me.owner && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)));   // this card is armed / my vanguard is armed
    case 'gzd': return t.me ? self('gauged', (G, me, e) => (!t.gk || e.gk === t.gk) && phOk(G, me, t.ph) && byOk(G, me, t, e) && (!t.from || t.from.includes(e.from)), null)   // this card is put as a gauge ({ gk, ph, by, from })
      : any('gauged', (G, me, e) => e.p === me.owner && (!t.gk || e.gk === t.gk) && (!t.ot || e.iid !== me.iid) && phOk(G, me, t.ph) && byOk(G, me, t, e) && (!t.from || t.from.includes(e.from)) && (!t.col || (e.from === 'RC' && me.pos && COL[e.fromPos] === COL[me.pos])) && (!t.hf || (e.gh != null && G.cards[e.gh] && mf(G, me, G.cards[e.gh], t.hf))));   // a card of mine is put as a gauge ({ gk, ot, col, hf: its host matches })
    case 'gzdisc': return t.me ? self('ungauged', (G, me, e) => e.to === 'drop' && (!t.gk || e.gkWas === t.gk) && phOk(G, me, t.ph) && (!t.cost || e.reason === 'cost'), null) : any('gdisc', (G, me, e) => e.p === me.owner && (!t.gk || e.gk === t.gk) && e.n >= (t.n || 1));   // this gauge is discarded / n or more gauges are discarded for a cost
    case 'unmoor': return self('unmoor', () => true, zone || 'field');   // this unit unmoors (moved to another RC, or told to)
    case 'cbd': return any('cbpaid', (G, me, e) => e.p === me.owner);   // you counter-blast (["ev","n"] = how many)
    case 'lockd': return any('locked', (G, me, e) => (t.s === 'm' ? e.p === me.owner : e.p !== me.owner) && byOk(G, me, t, e));   // a card is locked ({ s: 'o' (default) | 'm', by, byf })
    case 'unlockd': return t.me ? self('unlocked', (G, me, e) => phOk(G, me, t.ph), zone || 'field') : any('unlocked', (G, me, e) => (t.s === 'o' ? e.p !== me.owner : t.s === 'x' ? true : e.p === me.owner) && (!t.ot || e.iid !== me.iid) && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)) && phOk(G, me, t.ph) && (!t.end || G.phase === 'end'));   // a card is unlocked ({ me, s, ot, wf, ph, end })   // this card is put in the trigger zone (drive or damage check)
    case 'uboost': return any('boost', (G, me, e) => (t.s === 'x' || (t.s === 'o' ? e.p !== me.owner : e.p === me.owner)) && (!t.ot || e.iid !== me.iid) && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)) && (!t.tg || tgOk(G, me, t.tg, e.attacker)));   // a unit of yours boosts ({ tg: the boosted unit, ot })
    case 'scd': return any('soulCharged', (G, me, e) => e.p === me.owner && e.byP === me.owner);   // you soul-charged by your card's ability
    case 'actd': return any('actUsed', (G, me, e) => e.p === me.owner && (!t.zone || e.zone === t.zone) && (!t.f || mf(G, me, G.cards[e.iid], t.f)));   // you used an [ACT] ({ zone, f })
    case 'pwup': return self('powerUp', (G, me, e) => (!t.act || e.act) && byOk(G, me, t, e), zone || 'field');   // this unit's power was raised by an ability ({ act: 1, by, byf })
    case 'uchosen': return any('chosen', (G, me, e) => { const c = G.cards[e.iid]; return !!c && c.owner === me.owner && (t.my ? e.byP === me.owner && choseOk(G, me, t.by, { by: e.by, z: e.byZone, no: G.cards[e.by] && G.cards[e.by].no }) : e.byP !== me.owner) && (!t.k || (t.k === 'v' ? c.zone === 'VC' : (t.k === 'r') === (c.zone === 'RC'))) && (!t.wf || mf(G, me, c, t.wf)); });   // a unit of yours was chosen by the opponent's card's ability
    case 'restd': return self('rested', (G, me, e) => byOk(G, me, t, e), zone || 'field');   // this unit was rested by an ability / as a cost ({ by, byv, byf })
    /* a card was revealed by an ability: { s: m | o | x (whose card), f, by, byf } */
    case 'rvd': return any('revealedBy', (G, me, e) => { const c = G.cards[e.iid]; if (!c) return false; if ((t.s || 'm') === 'm' && c.owner !== me.owner) return false; if (t.s === 'o' && c.owner === me.owner) return false; return (!t.f || mf(G, me, c, t.f)) && byOk(G, me, t, e); });
    /* any card changed zone: { s: m (default) | o | x, me: 1 (this card), ot: 1 (another card), to, from, nfrom, reason, f, ph, by, byv, byf, z: 0 } — this card may be anywhere unless a zone is given */
    case 'mvd': return { on: 'moved', who: t.me ? undefined : 'any', zone: t.me ? (zone === undefined ? null : zone) : (zone || ['VC', 'RC', 'order']), match: (G, me, e) => {
      const c = G.cards[e.iid]; if (!c) return false; if (t.me && e.iid !== me.iid) return false; if (t.ot && e.iid === me.iid) return false;
      if (!t.me) { if ((t.s || 'm') === 'm' && c.owner !== me.owner) return false; if (t.s === 'o' && c.owner === me.owner) return false; }
      if (t.to && ![].concat(t.to).includes(e.to)) return false; if (t.from && ![].concat(t.from).includes(e.from)) return false; if (t.nfrom && [].concat(t.nfrom).includes(e.from)) return false;
      if (t.reason && ![].concat(t.reason).includes(e.reason)) return false; if (t.f && !mf(G, me, c, t.f)) return false;
      if (t.multi) { const k = (G.tl || []).filter(r => r.k === 'mv' && r.st === e.st && r.p === c.owner && (!t.to || [].concat(t.to).includes(r.to)) && (!t.from || [].concat(t.from).includes(r.from)) && (!t.f || (G.cards[r.iid] && mf(G, me, G.cards[r.iid], t.f)))).length; if (k !== t.multi) return false; }   // multi: n cards moved together (fires on the n-th)
      return phOk(G, me, t.ph) && byOk(G, me, t, e); } };
    /* the beginning of the guard step of a battle in which your unit (w: 'v' vanguard, 'me' this unit, else any unit; wf filter) is attacked */
    case 'dstep': return self('driveStep', (G, me, e) => true, zone || 'field');   // the beginning of the drive step of the battle this unit attacks
    case 'agstart': return any('guardStart', (G, me, e) => e.p === me.owner && !!G.battle && G.battle.attacker === me.iid);   // the beginning of the guard step of the battle this unit attacked
    case 'gstart': return any('guardStart', (G, me, e) => { if (e.p === me.owner) return false; const c = G.cards[e.target]; if (!c || c.owner !== me.owner) return false; if (t.w === 'me') return c.iid === me.iid; if (t.w === 'v' && e.targetZone !== 'VC') return false; return !t.wf || mf(G, me, c, t.wf); });
    /* the end of a battle in which this unit (or with w:'v' your vanguard) was attacked; by: 'r' rear-guard / 'v' vanguard attacker */
    case 'endAtked': return any('battleEnd', (G, me, e) => { if (e.p === me.owner) return false; if (!(t.w === 'v' ? e.targets.includes(G.vg(me.owner).iid) : t.w === 'u' ? e.targets.some(i => G.cards[i] && G.cards[i].owner === me.owner) : e.targets.includes(me.iid))) return false; const a = G.cards[e.attacker]; if (t.by === 'r' && !(a && (a.zone === 'RC' || a.lastPos && a.lastPos !== 'V'))) return false; if (t.by === 'v' && !(a && a.zone === 'VC')) return false; return true; });
    case 'leave': return self('leaveRC', (G, me, e) => (!t.row || (t.row === 'f' ? FRONT : BACK).includes(e.fromPos)) && phOk(G, me, t.ph) && byOk(G, me, t, e), 'RC');   // this unit leaves (RC) for any reason
    case 'oGuard': return any('placeGC', (G, me, e) => e.p !== me.owner);   // the opponent puts a guardian on (GC)
    case 'astep': return any('attackStep', (G, me, e) => (t.opp ? e.p !== me.owner : e.p === me.owner));
    case 'pst': return any('ticketPlayed', (G, me, e) => e.p === me.owner);
    case 'retCol': return any('leaveRC', (G, me, e) => e.reason === 'retire' && e.iid !== me.iid && (t.row === 'f' ? FRONT : BACK).includes(e.fromPos) && sameCol(me, { pos: e.fromPos, owner: e.p }) && phOk(G, me, t.ph));
    case 'chosen': return self('chosen', (G, me, e) => e.byP === me.owner && (!t.abt || e.abType === t.abt) && choseOk(G, me, t.by, { by: e.by, z: e.byZone, no: G.cards[e.by] && G.cards[e.by].no }), zone || 'field');
    case 'placeRC': return self(t.vc ? ['placeRC', 'placeVC', 'musicOn'] : ['placeRC', 'musicOn'], (G, me, e) => (!t.od || (e.to !== 'VC' && (t.od === 'a' ? !!e.od : e.od === t.od))) && (e.to === 'VC' || ((!t.from || t.from.includes(e.from)) && (!t.nfrom || !t.nfrom.includes(e.from)) && (!t.pos || e.toPos === t.pos) && (!t.row || (t.row === 'f' ? FRONT : BACK).includes(e.toPos)))) && phOk(G, me, t.ph) && byOk(G, me, t, e), null);
    case 'placeVC': return self('placeVC', (G, me, e) => (!t.ride || e.ride) && phOk(G, me, t.ph) && byOk(G, me, t, e), null);
    case 'rideFrom': return self('placeVC', (G, me, e) => !!e.ride && e.rideFromIid != null && mf(G, me, G.cards[e.rideFromIid], t.f), null);
    case 'placeGC': return self('placeGC', (G, me, e) => (!t.from || t.from.includes(e.from)) && (!t.ic || e.reason === 'intercept') && byOk(G, me, t, e), null);
    case 'atk': return self(t.ob ? ['attack', 'boost'] : 'attack', (G, me, e) => (e.name === 'boost' || (tgOk(G, me, t.tg, e.target) && (t.bo == null || !!G.battle.booster === !!t.bo) && (!t.bof || (G.battle.booster && mf(G, me, G.cards[G.battle.booster], t.bof))))) && phOk(G, me, t.ph), zone || 'field');
    case 'boost': return self('boost', (G, me, e) => !t.tg || mf(G, me, G.cards[e.attacker], t.tg), zone || 'RC');
    case 'boosted': return self('boosted', (G, me, e) => !t.tg || mf(G, me, G.cards[e.booster], t.tg), zone || 'field');
    case 'hit': return self('hit', (G, me, e) => !t.tg || (t.tg.k === 'v' ? e.targetZone === 'VC' : t.tg.k === 'r' ? e.targetZone === 'RC' : true), zone || 'field');
    case 'bhit': return any('hit', (G, me, e) => e.booster === me.iid && (!t.tg || (t.tg.k === 'v' ? e.targetZone === 'VC' : true)));
    case 'vhit': return any('hit', (G, me, e) => e.p === me.owner && G.cards[e.iid].zone === 'VC' && (!t.tg || (t.tg.k === 'v' ? e.targetZone === 'VC' : true)));
    case 'end': return any('battleEnd', (G, me, e) => {
      if (t.w) { const a = G.cards[e.attacker]; if (e.p !== me.owner || !a || (t.w === 'v' && a.zone !== 'VC') || (t.w === 'r' && a.zone !== 'RC') || !mf(G, me, a, t.wf)) return false; if (t.tg) { if (t.tg.k === 'v' && e.targetZone !== 'VC') return false; if (t.tg.k === 'r' && e.targetZone !== 'RC') return false; } return true; }
      else if (!((t.a && e.attacker === me.iid) || (t.b && e.booster === me.iid))) return false;
      if (t.hit && !e.hit) return false; if (t.nohit && e.hit) return false;
      if (t.bo != null && !!e.booster !== !!t.bo) return false;
      if (t.bof && !(e.booster && G.cards[e.booster] && mf(G, me, G.cards[e.booster], t.bof))) return false;
      if (t.tg && t.a && e.attacker === me.iid) { if (t.tg.k === 'v' && e.targetZone !== 'VC') return false; if (t.tg.k === 'r' && e.targetZone !== 'RC') return false; }
      if (t.tg && t.b && !t.a) { const a = G.cards[e.attacker]; if (!a || !mf(G, me, a, t.tg)) return false; }
      return true;
    });
    case 'rode': return self('rodeUpon', (G, me, e) => !t.by || mf(G, me, G.cards[e.by], t.by), null);
    case 'disc': return self('discard', (G, me, e) => (t.from ? t.from.includes(e.from) : e.from === 'hand') && (!t.sdisc || (e.by != null && G.cards[e.by] && !!G.def(G.cards[e.by]).gunit)) && (t.ph === 'rd' ? !!e.rideCost : phOk(G, me, t.ph)) && byOk(G, me, t, e), null);
    case 'toOrder': return self('toOrder', null, null);
    case 'revealed': return self('dcheck', (G, me, e) => e.kind === 'drive', null);
    case 'stood': return self('stood', (G, me, e) => phOk(G, me, t.ph) && byOk(G, me, t, e), zone || 'field');
    case 'sbcost': return any('sbcost', (G, me, e) => e.p === me.owner && e.n >= t.n && (t.by !== 'v' || (e.by != null && G.cards[e.by].zone === 'VC')) && (!t.byf || (e.by != null && mf(G, me, G.cards[e.by], t.byf))));
    case 'endChk': return any('battleEnd', (G, me, e) => e.p === me.owner && (e.checks || []).some(i => mf(G, me, G.cards[i], t.f)));
    case 'uDisc': return any('discard', (G, me, e) => e.p === me.owner && e.iid !== me.iid && e.from === 'hand' && phOk(G, me, t.ph) && byOk(G, me, t, e));
    case 'uAtk': case 'uPlace': case 'uStood': case 'uRet': case 'uAtked': case 'uHit': case 'uSoul': case 'uBounce': {
      const evn = { uAtk: 'attack', uPlace: ['placeRC', 'placeVC'], uStood: 'stood', uRet: t.gc ? ['leaveRC', 'retireGC'] : 'leaveRC', uAtked: 'attack', uHit: 'hit', uSoul: 'toSoul', uBounce: 'leaveRC' }[t.e];
      return any(evn, (G, me, e) => {
        const id = t.e === 'uAtked' ? e.target : e.iid; const c = G.cards[id]; if (!c) return false;
        if (t.s === 'm' && c.owner !== me.owner) return false; if (t.s === 'o' && c.owner === me.owner) return false;
        if (t.e === 'uRet' && e.reason !== 'retire' && e.name !== 'retireGC') return false;
        if (t.e === 'uBounce' && e.wanted !== 'hand') return false;
        if (t.e === 'uSoul' && e.from !== 'RC') return false;
        if (t.e === 'uPlace') { if (t.k === 'v' && e.to !== 'VC') return false; if (t.k === 'r' && e.to !== 'RC') return false; if (t.from && !t.from.includes(e.from)) return false; if (t.nfrom && t.nfrom.includes(e.from)) return false; }
        else if (t.e === 'uRet' || t.e === 'uSoul') { if (t.k === 'v') return false; }
        else { const z = t.e === 'uAtked' ? e.targetZone : c.zone; if (t.k === 'v' && z !== 'VC') return false; if (t.k === 'r' && z !== 'RC') return false; }
        if (t.wf && !mf(G, me, c, t.wf)) return false;
        if (t.tg && !tgOk(G, me, t.tg, e.target)) return false;
        return phOk(G, me, t.ph) && byOk(G, me, t, e);
      });
    }
    case 'retGC': return self('retireGC', null, null);
    case 'retRC': return self(t.gc ? ['leaveRC', 'retireGC'] : 'leaveRC', (G, me, e) => (e.name === 'retireGC' || e.reason === 'retire') && phOk(G, me, t.ph) && byOk(G, me, t, e), t.gc ? null : 'RC');
    case 'bounced': return self('leaveRC', (G, me, e) => e.wanted === 'hand' && phOk(G, me, t.ph) && byOk(G, me, t, e), 'RC');
    case 'toSoul': return self('toSoul', (G, me, e) => (!t.from || t.from.includes(e.from)) && phOk(G, me, t.ph) && byOk(G, me, t, e), null);
    case 'bound': return self('bound', (G, me, e) => e.from === 'RC' && phOk(G, me, t.ph) && byOk(G, me, t, e), null);
    case 'atked': return any('attack', (G, me, e) => { const c = G.cards[e.target]; if (!c || c.owner !== me.owner) return false; if (t.w === 'me') return c.iid === me.iid; if (t.w === 'v' && e.targetZone !== 'VC') return false; return !t.wf || mf(G, me, c, t.wf); });
    case 'tstart': return any('turnStart', (G, me, e) => (t.opp ? e.p !== me.owner : e.p === me.owner));   // at the beginning of your turn
    case 'tend': return any('turnEnd', (G, me, e) => t.each || (t.opp ? e.p !== me.owner : e.p === me.owner));
    case 'phase': return any({ r: 'ridePhaseStart', m: 'mainStart', b: 'battleStart' }[t.ph], (G, me, e) => (t.opp ? e.p !== me.owner : e.p === me.owner));
    case 'vatk': case 'uatk': return any('attack', (G, me, e) => { const a = G.cards[e.iid]; if (e.p !== me.owner) return false; if (t.e === 'vatk' && a.zone !== 'VC') return false; if (t.ot && a.iid === me.iid) return false; if (t.col && COL[a.pos] !== COL[me.pos]) return false; return (!t.wf || mf(G, me, a, t.wf)) && tgOk(G, me, t.tg, e.target); });
    case 'vplace': return any('placeVC', (G, me, e) => e.p === me.owner && e.iid !== me.iid && (!t.ride || !!e.ride) && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)) && phOk(G, me, t.ph) && byOk(G, me, t, e));
    case 'uplace': return any('placeRC', (G, me, e) => e.p === me.owner && (!t.ot || e.iid !== me.iid) && e.iid !== me.iid && (!t.wf || mf(G, me, G.cards[e.iid], t.wf)) && (!t.from || t.from.includes(e.from)) && phOk(G, me, t.ph) && byOk(G, me, t, e));
    case 'dcheck': return any('dcheck', (G, me, e) => (t.s === 'o' ? e.p !== me.owner : t.s === 'x' ? true : e.p === me.owner) && e.kind === (t.kind || 'drive') && (t.k === 't' ? !!e.trigger : t.k === 'a' ? true : !e.trigger && G.def(G.cards[e.iid]).type === 'unit') && (!t.f || mf(G, me, G.cards[e.iid], t.f)));
    case 'order': return any('playOrder', (G, me, e) => (!t.alc || e.alc) && (t.s === 'o' ? e.p !== me.owner : e.p === me.owner) && e.iid !== me.iid && (!t.k || e.kind === t.k) && (!t.from || t.from.includes(e.from)) && (!t.f || mf(G, me, G.cards[e.iid], t.f)));
    case 'oret': return any(t.gc ? ['leaveRC', 'retireGC'] : 'leaveRC', (G, me, e) => e.p !== me.owner && (e.name === 'retireGC' || e.reason === 'retire') && phOk(G, me, t.ph) && byOk(G, me, t, e));
    case 'pride': return any('personaRide', (G, me, e) => e.p === me.owner);
    case 'state': return any('state', (G, me, e) => e.p === me.owner && e.st === t.n);
    case 'ustate': return self('ustate', (G, me, e) => e.st === t.n && phOk(G, me, t.ph), zone || 'field');   // this unit enters a named state ({ n, ph })
  }
  throw new Error('fx: unknown trigger ' + t.e);
}

/* ---------- building abilities ---------- */
let LK = 1;
function mkAbility(a, def) {
  const isOrder = def.type === 'order';
  const zone = a.z ? zn(a.z) : undefined;
  if (a.t === 'c' && a.m && a.m.grade) VG.hasGradeAura = true;
  if (a.tg && a.tg.includes('versionup') && !a.vu) { a.vu = 1; a.c = (a.c || []).concat([['or', ['persona'], ['cmp', ['z', 'damage'], '>=', 4]]]); }   // [Version Up] (開眼, Japanese official Q10899): active if you persona rode this turn or have four or more damage
  const cond = a.c ? (G, me, evt) => { const ctx = mkCtx(me, evt); return a.c.every(c => ev(G, ctx, c)); } : null;
  if (a.t === 'c') {
    const ab = { type: 'cont', zone: zone || (isOrder ? 'order' : ['VC', 'RC', 'GC']), cond, src: a };
    if (!a.s && /"(?:pw|cr)","me"/.test(JSON.stringify([a.c || [], a.per || []]))) ab.late = true;
    const scaled = (G, sc) => { if (!a.per) return a.m; const k = count(G, mkCtx(sc), a.per); const m = Object.assign({}, a.m); for (const key of ['power', 'shield', 'crit', 'drive', 'guardMin', 'grade']) if (m[key]) m[key] *= k; return m; };
    if ([].concat(zone || []).some(z => ['soul', 'drop', 'hand', 'bind', 'damage', 'removed', 'deck', 'ride'].includes(z)) || [].concat(zone || []).includes('gauge')) def.contOff = true;
    if (a.s) ab.aura = (G, sc, c) => ((typeof a.s === 'object' || c.owner === sc.owner || /^o(?!ther)/.test(a.s)) && group(G, mkCtx(sc), a.s).includes(c.iid) ? scaled(G, sc) : null);
    else ab.mod = a.per ? scaled : a.m;
    return ab;
  }
  const cost = a.k ? a.k.map(mkCost) : null;
  const label = a.as ? 'กึ่งออโต้ — ทำเอฟเฟกต์เอง' + (a.mc ? ' (ตรวจเงื่อนไขบนการ์ดเอง)' : '') + (a.mk ? ' (จ่ายคอสต์เอง)' : '') : thSteps(a.d).slice(0, 46);
  /* "paid" = how many cards the costs took (counter- / soul- / energy-blast numbers are not cards chosen for the cost) */
  const runner = function* (G, me, evt, used) { const ctx = mkCtx(me, evt); if (used && used.paid) { ctx.paid = used.paid; ctx.count = used.paid.reduce((n, x, i) => n + (a.k && a.k[i] && ['cb', 'sb', 'eb'].includes(a.k[i][0]) ? 0 : typeof x === 'number' ? x : Array.isArray(x) ? pdLen(G, me, x) : 0), 0); ctx.did = true; } yield* run(G, ctx, a.d); };
  if (a.t === 'k') { const ab = { type: 'act', zone: zone || (isOrder ? 'order' : 'field'), limit: a.l === 'f' ? 'fight' : a.l ? 'turn' : undefined, cost, cond, label, run: runner, src: a }; if (a.lk) ab.lkey = 'K' + a.lk; if (a.as) ab.assist = true; if (a.dv) ab.divine = true; if ([].concat(ab.zone).some(z => ['drop', 'soul', 'hand', 'bind', 'damage', 'gauge', 'mbox'].includes(z))) def.actOff = true; return ab; }
  const mk = t => { const tr = mkTrig(t, a.z); if (isOrder && tr.who === 'any' && !a.z) tr.zone = 'order'; return Object.assign({ type: 'auto', limit: a.l === 'f' ? 'fight' : a.l ? 'turn' : undefined, cost, cond, label, run: runner, src: a }, a.as ? { assist: true, optional: true } : {}, a.dv ? { divine: true } : {}, tr); };
  if (a.on.alt) { const k = 'L' + (LK++); const x = mk(a.on), y = mk(a.on.alt); if (a.l) { x.lkey = k + 'a'; y.lkey = k + 'a'; } return [x, y]; }
  return mk(a.on);
}
/* Fill a card definition from its compiled skills */
const ABS_CACHE = new WeakMap();
VG.fx_absCopy = function (ab, alt) { let m = ABS_CACHE.get(ab); if (!m) ABS_CACHE.set(ab, m = {}); const k = alt ? JSON.stringify(alt) : '-'; if (m[k]) return m[k]; const o = Object.assign({}, ab, { zone: 'VC' }); if (alt && ab.src && ab.src.k) o.cost = [mkCost(['alt', ab.src.k, alt])]; return (m[k] = o); };   // a copy of an ability for the vanguard (alt: its cost may also be paid that way)
VG.fx = {
  apply(def, ast) {
    def.abilities = (def.abilities || []).slice(); def.text = (def.text || []).slice();
    for (const a of ast.a || []) { const ab = mkAbility(a, def); if (Array.isArray(ab)) def.abilities.push(...ab); else def.abilities.push(ab); def.text.push(thAbility(a)); }
    // shared once-per-turn keys must be unique per ability slot
    const seen = {}; def.abilities.forEach((ab, i) => { if (ab.lkey) { if (seen[ab.lkey] === undefined) seen[ab.lkey] = i; } });
    if (def.type === 'order') {
      const p = ast.p || { d: [] };
      if (p.from) def.playFrom = p.from;
      if (p.il) { const ic = p.il; def.ignoreLimit = (G, me) => { const ctx = mkCtx(me); return ic.every(c => ev(G, ctx, c)); }; def.text.push('ถ้า' + ic.map(thC).join(' และ') + ' เพลย์การ์ดนี้ได้โดยไม่นับจำนวนออเดอร์ต่อเทิร์น'); }
      if (p.fc) { const fc2 = p.fc; def.playFree = (G, me) => { const ctx = mkCtx(me); return fc2.every(c => ev(G, ctx, c)); }; def.text.push('ถ้า' + fc2.map(thC).join(' และ') + ' เพลย์การ์ดนี้ได้โดยไม่ต้องจ่ายคอสต์'); }
      if (p.fromC) {
 const fc = p.fromC; def.playFromC = (G, me) => { const ctx = mkCtx(me); return fc.every(c => ev(G, ctx, c)); }; }
      def.play = { assist: !!p.as, cost: p.k ? p.k.map(mkCost) : null, cond: p.c ? (G, me) => { const ctx = mkCtx(me); return p.c.every(c => ev(G, ctx, c)); } : null, run: function* (G, me, evt, used) { const ctx = mkCtx(me); if (used && used.paid) { ctx.paid = used.paid; ctx.count = used.paid.reduce((n, x, i) => n + (p.k && p.k[i] && ['cb', 'sb', 'eb'].includes(p.k[i][0]) ? 0 : typeof x === 'number' ? x : Array.isArray(x) ? x.length : 0), 0); } yield* run(G, ctx, p.d); } };
      if (ast.rp) def.regalis = true;
      const head = (def.orderKind === 'blitz' ? 'บลิตซ์ออเดอร์ (เพลย์ในการ์ดสเต็ปเมื่อยูนิทของคุณถูกโจมตี)' : def.orderKind === 'set' ? 'เซ็ตออเดอร์ (เพลย์แล้ววางในออเดอร์โซน)' : 'ออเดอร์') + (ast.rp ? ' · เรกาลิสพีซ: ใช้ได้ 1 ครั้งต่อไฟท์' : '');
      const fxTxt = thSteps(p.d); const body = (p.from ? 'เพลย์จาก' + p.from.map(z => ZONE_TH[z]).join('/') + 'ได้ · ' : '') + (p.c ? 'เงื่อนไข: ' + p.c.map(thC).join(' และ ') + ' · ' : '') + (p.k ? 'คอสต์: ' + p.k.map(k => mkCost(k).label).join(' + ') + (fxTxt ? ' → ' : '') : '') + fxTxt;
      def.text.unshift(head + (body ? ': ' + body : ''));
    }
    if (ast.o) { def.overEffect = function* (G, p, c) { yield* run(G, mkCtx(c), ast.o); }; def.text.push('เอฟเฟกต์เพิ่มเติม (เฉพาะไดรฟ์เช็ค): ' + thSteps(ast.o)); }
    if (ast.gl) def.glitter = true;
    if (ast.nr) { def.noRide = true; def.text.unshift('CONT: การ์ดใบนี้ไรด์ไม่ได้' + (ast.bc ? ' และคอลได้เฉพาะเซอร์เคิลแถวหลังตรงกลาง' : ast.nc ? ' และคอลลง (RC) ไม่ได้' : ast.nnc ? ' และคอลปกติจากมือไม่ได้' : '')); }
    else if (ast.nnc) def.text.unshift('CONT: การ์ดใบนี้คอลปกติลง (RC) ไม่ได้');
    if (ast.ncm) { def.callOnMarker = ast.ncm; def.text.unshift('CONT: คอลปกติได้เฉพาะบน RC ที่มี ' + ast.ncm + ' marker'); }
    if (ast.ncc) { const cc = ast.ncc; def.normOnly = (G, me) => { const ctx = mkCtx(me); return cc.every(c => ev(G, ctx, c)); }; def.text.unshift('CONT: คอลการ์ดนี้ตามปกติได้ก็ต่อเมื่อ' + cc.map(thC).join(' และ')); }
    if (ast.bc) def.onlyBC = true;
 if (ast.nc) def.noCall = true; if (ast.nnc || ast.nc) def.noNormalCall = true;
    if (ast.ra) { const ra = ast.ra; def.rideAlt = (G, me, nc) => { const ctx = mkCtx(me); const out = []; for (const a of ra) { { const zz = a.z || 'V'; if (!((zz.includes('V') && me.zone === 'VC') || (zz.includes('R') && me.zone === 'RC'))) continue; } if (a.f && !mf(G, me, nc, a.f)) continue; if (a.c && !a.c.every(c => ev(G, ctx, c))) continue; const ks = (a.k || []).map(mkCost); out.push({ label: ks.length ? ks.map(k => k.label).join(' + ') + ' (แทนการทิ้งการ์ด)' : 'ไม่ต้องทิ้งการ์ด (' + G.def(me).name + ')', can: () => ks.every(k => k.can(G, me)), pay: function* () { const prev = G.cur; G.cur = { iid: me.iid, p: me.owner, cost: true }; try { for (const k of ks) yield* k.pay(G, me); } finally { G.cur = prev; } } }); } return out; };
      for (const a of ra) def.text.push('CONT (' + (a.z === 'VR' ? 'VC/RC' : a.z === 'R' ? 'RC' : 'VC') + '): ' + (a.c ? 'ถ้า' + a.c.map(thC).join(' และ') + ' ' : '') + 'เมื่อจะไรด์' + (a.f && Object.keys(a.f).length ? thF(a.f, 0).trim() : 'การ์ด') + 'จากไรด์เด็ค ' + (a.k && a.k.length ? 'จ่าย ' + a.k.map(k => mkCost(k).label).join(' + ') + ' แทนการทิ้งการ์ดจากมือได้' : 'ไรด์ได้โดยไม่ต้องทิ้งการ์ดจากมือ')); }
    if (ast.rf) { const f = ast.rf; def.canRideOn = (G, v) => { const d = G.def(v); return (f.g == null || d.grade === f.g) && (d.name.includes(f.nh) || (!!f.nh2 && d.name.includes(f.nh2))); }; def.text.unshift('CONT: ไรด์ได้จาก' + (f.g != null ? 'เกรด ' + f.g + ' ' : 'ยูนิท') + 'ที่มี "' + f.nh + '" ในชื่อเท่านั้น'); }
    if (ast.world) { def.world = true; def.text.push('CONT (ออเดอร์โซน): เวิลด์ — ถ้าออเดอร์โซนของคุณมีแต่การ์ดเวิลด์: 1 ใบ = Dark Night, 2 ใบขึ้นไป = Abyssal Dark Night'); }
    if (ast.sentinel) { def.sentinel = true; def.text.unshift('CONT: เซนทิเนล (ใส่ได้ไม่เกิน 4 ใบ)'); }
    if (ast.og != null) { def.orderGuard = ast.og; def.text.push('CONT: ในการ์ดสเต็ปของเทิร์นคู่ต่อสู้ คอลการ์ดนี้ลง GC เป็นการ์ดเดี้ยนได้ (นับเป็นทริกเกอร์ยูนิท เกรด 0 · ชิลด์ ' + ast.og + ')'); }
    if (ast.nobc) { def.noBC = true; def.text.push('CONT (RC): ขณะการ์ดนี้อยู่บน RC คุณวางยูนิทลง RC แถวหลังกลางไม่ได้'); }
    if (ast.musto) { def.musTo = ast.musto; def.text.push(ast.musto.self ? 'CONT (RC): เมื่อการ์ดนี้จะลงดรอปจาก RC ตอนเอนด์เฟสของคุณ ให้' + (ast.musto.to === 'soul' ? 'นำเข้าโซล' : 'ไบนด์') + 'แทน' : 'CONT (VC): เมื่อมิวสิก' + (ast.musto.f ? thFtail(ast.musto.f) : '') + 'ของคุณจะลงดรอปจาก RC คุณ' + (ast.musto.to === 'bind' ? 'ไบนด์' : 'นำเข้าโซล') + 'แทนได้'); }
    if (ast.trigAdd) { const ta = ast.trigAdd; def.trigAdd = { ok: (G, me) => (ta.c || []).every(c => ev(G, mkCtx(me), c)), run: function* (G, me) { yield* run(G, mkCtx(me), ta.d); } }; def.text.push('CONT (ดรอป): ' + (ta.c ? 'ถ้า' + ta.c.map(thC).join(' และ') + ' ' : '') + 'ทริกเกอร์ยูนิทที่เปิดจากไดรฟ์เช็คของคุณได้เอฟเฟกต์ทริกเกอร์เพิ่ม: ' + thSteps(ta.d)); }
    if (ast.rt2) { def.rt2 = ast.rt2; def.text.push('CONT (RC): เมื่อยูนิทนี้จะถูกรีไทร์เป็นคอสต์ของสกิลแวนการ์ด' + thFtail(ast.rt2) + 'ของคุณ รีไทร์เป็น 2 ใบได้'); }
    if (ast.strideIf) { def.strideIf = ast.strideIf; def.text.push('CONT: สไตรด์การ์ดนี้ได้เฉพาะเมื่อแวนการ์ดของคุณ' + thFtail(ast.strideIf)); }
    if (ast.crestEG) { def.crestEG = 1; def.text.push('CONT: ไรด์การ์ดนี้ได้เฉพาะเมื่อเครสต์โซนไม่มีการ์ดอื่นนอกจาก "Energy Generator"'); }
    if (ast.race2) { def.race = (def.race ? def.race + '/' : '') + ast.race2; def.text.push('CONT: การ์ดนี้มีเผ่า <' + ast.race2 + '> เพิ่มด้วย'); }
    if (ast.bsStay3) { def.bsStay3 = 1; def.text.push('CONT (RC แถวหลังกลาง): เมื่อจะออกจาก RC คืนบัดดี้โซล 3 ใบเข้าเด็คเพื่ออยู่ต่อได้'); }
    if (ast.bsToDeck) { def.bsToDeck = 1; def.text.push('AUTO: เมื่อยูนิทนี้ที่มีบัดดี้โซลออกจาก RC แถวหลังกลางไปที่อื่นนอกจาก RC บัดดี้โซลทั้งหมดกลับเข้าเด็ค แล้วสับ'); }
    if (ast.noSG) { def.noSG = 1; def.text.push('CONT (RC): ยูนิทนี้ไม่ได้รับ Soulguard'); }
    if (ast.frozenStars) { def.frozenStars = 1; def.text.push('CONT (ออเดอร์โซน): ในเทิร์นคุณ ถ้าแวนการ์ดชื่อ "Sofia" เกรด 3 ขึ้นไป และ RC แถวหน้าซ้ายและขวามียูนิท <Star> คู่ต่อสู้อินเตอร์เซปต์ไม่ได้ และสกิลการ์ดที่ไม่ใช่ออเดอร์ของคู่ต่อสู้บน VC/RC/GC/โซลที่ไม่ใช่เซนทิเนลถูกลบล้าง / ถ้าแวนการ์ดชื่อ "Sofia" เกรด 3 ขึ้นไปและเพอร์โซน่าไรด์เทิร์นนี้ สกิลยูนิทเซนทิเนลของคู่ต่อสู้ถูกลบล้าง'); }
    if (ast.gsLess) { def.gsLess = 1; def.text.push('CONT (VC): เมื่อคุณเพลย์ออเดอร์ที่มีชื่อ "Great Spell" เกจที่จ่ายเป็นคอสต์ลดลง 1 และการ์ดที่วางลงดาเมจโซนเป็นคอสต์เป็น 0 ใบ'); }
    if (ast.gleip) { def.gleip = 1; }
    if (ast.saien) { def.saien = ast.saien; def.text.push('CONT (ออเดอร์โซน): ถ้าแวนการ์ดมีชื่อ "' + ast.saien.vg + '" เมื่อเรียร์การ์ด "' + ast.saien.nh + '" ของคุณจะถูกนำเข้าเด็คหรือไบนด์โซนด้วยสกิลการ์ดของคู่ต่อสู้ นำ "' + ast.saien.tk + '" ทั้งหมดใน originalDress ขึ้นมือ แล้วนำยูนิทนั้นและ originalDress ที่เหลือลงดรอปแทน'); }
    if (ast.xod2) { def.xod2 = 1; def.text.push('CONT (RC): เมื่อจะเลือก originalDress สำหรับ X-overDress เลือกยูนิทนี้เป็นทั้งการ์ด "Trickstar" 1 ใบ และ <prayer dragon> 1 ใบ รวม 2 ใบได้'); }
    if (ast.ozShield) { def.ozShield = ast.ozShield; def.text.push('CONT (ออเดอร์โซน): ถ้าแวนการ์ดมีชื่อ "' + ast.ozShield.vg + '" และมีเรียร์การ์ด "' + ast.ozShield.rg + '" ชีลด์ดั้งเดิมของ "' + ast.ozShield.nm + '" ของคุณเป็น ' + ast.ozShield.sh); }
    if (ast.ozTrig) { def.ozTrig = ast.ozTrig; def.text.push('CONT (ออเดอร์โซน): ถ้าแวนการ์ดมีชื่อ "' + ast.ozTrig.vg + '" และมีเรียร์การ์ด "' + ast.ozTrig.rg + '" เมื่อไดรฟ์เช็คของแวนการ์ดเปิดได้ "' + ast.ozTrig.nm + '" เอฟเฟกต์ทริกเกอร์ (นอกจากพลัง) เป็น จั่ว 1 ใบ และเลือกยูนิท 1 ใบ คริติคอล +' + ast.ozTrig.crit + ' จนจบเทิร์น'); }
    if (ast.mbAny) { def.mbAny = 1; def.text.push('CONT (มือ): เมื่อจะสลับการ์ดนี้กับการ์ดใน Monster BOX สลับกับการ์ดที่ไม่ใช่เกรด 1 ได้'); }
    if (ast.secretSword) { def.secretSword = 1; def.text.push('CONT (ออเดอร์โซน): เมื่อไดรฟ์เช็คของคู่ต่อสู้จะเปิดได้ทริกเกอร์ที่ไม่ใช่ฮีลหรือโอเวอร์ ถ้าบัดดี้โซลคว่ำหน้าของการ์ดนี้มีไอคอนเดียวกัน หงายได้ ถ้าหงาย ยกเลิกการเพิ่มพลังของทริกเกอร์นั้น แล้ว: คริติคอล→แวนการ์ดคู่ต่อสู้คริติคอล -1 จนจบแบทเทิล / ดรอว์→คู่ต่อสู้ทิ้งการ์ด 1 ใบจากมือ / ฟรอนต์→ยูนิทแถวหน้าคู่ต่อสู้ทั้งหมดพลัง -10000 จนจบเทิร์น'); }
    if (ast.vgBlank) { def.vgBlank = 1; def.text.push('CONT (ออเดอร์โซน): แวนการ์ดของคุณเสียสกิลที่พิมพ์ไว้ทั้งหมด และเป็นยูนิทเกรด 3 / พลัง 13000 / คริติคอล 1 ที่มี Twin Drive'); }
    if (ast.noRideMy) { def.noRideMy = 1; def.text.push('CONT (ออเดอร์โซน): ในเทิร์นของคุณ คุณไรด์ไม่ได้'); }
    if (ast.absFrom) { def.absFrom = ast.absFrom; def.text.push('CONT (VC): ' + (ast.absFrom.my ? 'ในเทิร์นของคุณ ' : '') + 'ถ้า' + ast.absFrom.z.map(z => ZONE_TH[z] || z).join('หรือ') + 'มีการ์ด "' + ast.absFrom.nm + '"' + (ast.absFrom.one ? ' 1 ใบ' : '') + ' ยูนิทนี้ได้รับ ' + ast.absFrom.ty.map(t => t.toUpperCase()).join('/') + ' ทั้งหมดของการ์ดนั้น' + (ast.absFrom.alt ? ' และจ่ายคอสต์ ACT ของยูนิทนี้ด้วย [' + ast.absFrom.alt.map(k => mkCost(k).label).join(' + ') + '] แทนได้' : '')); }
    if (ast.gzAbs) { def.gzAbs = ast.gzAbs; def.text.push('CONT (RC): ยูนิทนี้ได้รับสกิล [' + ast.gzAbs.tag + '] ทั้งหมดของ Buddy Soul ของยูนิทนี้'); }
    if (ast.dvFrom) { def.dvFrom = ast.dvFrom; def.text.push('CONT (VC): ในเทิร์นของคุณ ถ้าโซลหรือดรอปมีการ์ด "' + ast.dvFrom + '" ยูนิทนี้ได้รับ Divine Skill ทั้งหมดของการ์ดนั้น'); }
    if (ast.atkBackCol) { def.atkBackCol = 1; def.text.push('CONT (RC แถวหน้า): เมื่อยูนิทของคุณจะโจมตี โจมตียูนิทแถวหลังของคู่ต่อสู้ในแถวตั้งเดียวกันได้'); }
    if (ast.overHand) { def.overHand = 1; def.text.push('CONT (RC แถวหน้า): เมื่อโอเวอร์ทริกเกอร์ของคุณจะถูกนำออกจากเกมด้วยเอฟเฟกต์ทริกเกอร์ นำขึ้นมือแทนได้'); }
    if (ast.handDbl) { def.handDbl = 1; def.text.push('CONT (RC แถวหน้า): การ์ดในมือของคุณทั้งหมด เมื่อถูกทิ้งเป็นคอสต์ของสกิลแวนการ์ดของคุณ นับเป็นการทิ้ง 2 ใบได้'); }
    if (ast.callNa) { def.callNa = 1; def.text.push('CONT (ออเดอร์โซน): ยูนิทที่ถูกคอลด้วยสกิลของการ์ดนี้ AUTO ของยูนิทนั้นไม่ทำงานจากการคอลนั้น'); }
    if (ast.dropG) { def.dropG = ast.dropG; def.text.push('CONT (ดรอป): ถ้า' + thC(['vg', ast.dropG.vg]) + ' การ์ดนี้นับเป็นเกรด ' + ast.dropG.g); }
    if (ast.discLess) { def.discLess = ast.discLess; def.text.push('CONT (RC): เมื่อคุณจะทิ้งการ์ดจากมือเพื่อสกิลของ "' + ast.discLess.nm + '"' + (ast.discLess.vg ? ' ถ้า' + thC(['vg', ast.discLess.vg]) : '') + ' รีไทร์ยูนิทนี้ได้ ถ้าทำ จำนวนการ์ดที่ทิ้งลดลง 1'); }
    if (ast.dressDrop) { def.dressDrop = 1; def.text.push('CONT (RC): เมื่อยูนิทนี้ออกจาก RC ไปที่อื่นนอกจากดรอป originalDress ทั้งหมดของยูนิทนี้ลงดรอป'); }
    if (ast.dressDropDB) { def.dressDropDB = 1; def.text.push('CONT: เมื่อ outerDress ของการ์ดนี้จะถูกนำเข้าเด็คหรือไบนด์โซน originalDress ทั้งหมดของยูนิทนั้นลงดรอป'); }
    if (ast.look1) { def.look1 = 1; def.text.push('CONT (RC): เมื่อคุณจะดูการ์ดในเด็ค ดูได้เฉพาะใบบนสุดเท่านั้น'); }
    if (ast.rcSave) { def.rcSave = ast.rcSave; def.text.push('CONT (RC): เมื่อยูนิท' + thFtail(ast.rcSave) + 'ของคุณจะถูกรีไทร์จาก RC รีไทร์ยูนิทนี้แทนได้ ถ้าทำ ยูนิทนั้นอยู่บน RC ต่อ'); }
    if (ast.dname) { def.dname = 1; def.text.push('CONT (โซล): เมื่อนับจำนวนชื่อการ์ดที่ต่างกันในโซล การ์ดชื่อนี้แต่ละใบนับเป็นชื่อที่ต่างกัน'); }
    if (ast.atkTax) { def.atkTax = 1; def.text.push('CONT (VC): ยูนิทของทั้งสองฝ่ายได้รับ "ตั้งแต่แบทเทิลที่ 4 ของเทิร์น เมื่อยูนิทนี้จะโจมตี โจมตีไม่ได้ถ้าไม่ทิ้งการ์ดจากมือ 1 ใบ"'); }
    if (ast.mkPw) { def.text.push('CONT: ในเทิร์นของคุณ ถ้าแวนการ์ดของคุณมีชื่อ "Dragontree" หรือ "Masques" ยูนิทบนเซอร์เคิลที่มีการ์ดนี้ (marker) พลัง +5000'); }
    if (ast.strideAlt) { def.strideAlt = 1; def.text.push('CONT (มือ/ดรอป): เมื่อจะทิ้งการ์ดจากมือเป็นคอสต์สไตรด์ ถ้าแวนการ์ดของคุณมีไอคอนแคลน จ่ายแทนได้ด้วยการนำการ์ดนี้จากมือหรือดรอปออกจากเกม แล้วหงายดาเมจได้สูงสุด 1 ใบ'); }
    if (ast.dressGrant) { def.dressGrant = [].concat(...ast.dressGrant.map(a => [].concat(mkAbility(a, { type: 'unit' })))); def.text.push('CONT: outerDress ของการ์ดนี้ได้รับ: ' + ast.dressGrant.map(thAbility).join(' / ')); }
    if (ast.nuDeck) { def.nuDeck = ast.nuDeck; def.text.push('CONT: เมื่อการ์ดนี้ถูกเปิดเผยจากเด็คหรือนำเข้าโซลจากเด็คด้วยความสามารถของแวนการ์ดที่มี "' + ast.nuDeck.by + '" ในชื่อ การ์ดนี้นับเป็นนอร์มอลยูนิท'); }
    if (ast.raceDeck) { def.raceDeck = ast.raceDeck; def.text.push('CONT (เด็ค): ถ้า' + thC(['vg', ast.raceDeck.vg]) + ' เมื่อค้นหาหรือเลือกการ์ด <' + ast.raceDeck.rc + '> จากเด็ค เลือกการ์ดนี้ได้'); }
    if (ast.soulNames) { def.soulNames = ast.soulNames; def.text.push('CONT (เด็ค): ถ้า' + thC(['vg', ast.soulNames.vg]) + ' การ์ดนี้มีชื่อเดียวกับการ์ดทุกใบที่มี "' + ast.soulNames.nh + '" ในชื่อในโซลด้วย'); }
    if (ast.deckAs) { def.deckAs = ast.deckAs; def.text.push('CONT' + (ast.deckAs.any ? '' : ' (เด็ค)') + ': ถ้า' + thC(['vg', ast.deckAs.vg]) + ' การ์ดนี้นับเป็น "' + ast.deckAs.as + '" ด้วย'); }
    if (ast.alias) { def.pug = ast.alias; def.text.push('CONT (ออเดอร์โซน): การ์ดของคุณที่มีชื่อ ' + ast.alias.names.map(x => '"' + x + '"').join(' / ') + ' เป็น "' + ast.alias.as + '" ด้วย'); }
    if (ast.noRestNm) { def.noRestNm = ast.noRestNm; def.text.push('CONT (ออเดอร์โซน): คุณเรสต์ "' + ast.noRestNm + '" ไม่ได้'); }
    if (ast.gcWith) { const g = ast.gcWith; def.gcWith = { f: g.f, ok: (G, me) => { const ctx = mkCtx(me); return (g.c || []).every(c => ev(G, ctx, c)); } }; def.text.push('CONT (RC): ' + (g.c ? 'ถ้า' + g.c.map(thC).join(' และ') + ' ' : '') + 'เมื่อยูนิทนี้ย้ายไป GC ย้ายเรียร์การ์ด' + thFtail(g.f) + 'ในแถวตั้งเดียวกันไป GC พร้อมกันได้'); }
    if (ast.retryc) { const rc = ast.retryc; def.retry = true; def.retryC = (G, me) => { const ctx = mkCtx(me); return rc.every(c => ev(G, ctx, c)); }; def.text.push('[Retry] เมื่อ' + rc.map(thC).join(' และ') + ' (เมื่อถูก Retry: สแตนด์ จนจบเทิร์น Retry ซ้ำไม่ได้ พาวเวอร์+5000 คริติคอลและไดรฟ์เป็น 1)'); }
    if (ast.retry) { def.retry = true; def.text.push('[Retry] (เมื่อถูก Retry: สแตนด์ จนจบเทิร์น Retry ซ้ำไม่ได้ พาวเวอร์+5000 คริติคอลและไดรฟ์เป็น 1)'); }
    if (ast.eg) { def.egF = ast.eg; def.text.push('[Explosive Growth] เมื่อจะคอลปกติลง RC สามารถวางทับ' + thF(ast.eg, 0).trim() + 'บน RC แทน (ใบล่างเป็น Growth Factor)'); }
    if (ast.evn) { def.pug = ast.evn; def.event = 1; def.text.push('[Event] CONT (ออเดอร์โซน): การ์ดของคุณที่มีชื่อ ' + ast.evn.names.map(x => '"' + x + '"').join(' / ') + ' เป็น "' + ast.evn.as + '" ด้วย (เซ็ตออเดอร์ [Event] ในออเดอร์โซนมีได้ใบเดียว)'); }
    if (ast.event) { def.event = 1; def.text.push('[Event]: เซ็ตออเดอร์ [Event] ในออเดอร์โซนมีได้ใบเดียว ถ้ามี 2 ใบขึ้นไปให้เหลือ 1 ใบ ที่เหลือลงดรอป'); }
    if (ast.pug) { def.pug = ast.pug; def.text.push('[Pickup Gacha] CONT (ออเดอร์โซน): การ์ดของคุณที่มีชื่อ ' + ast.pug.names.map(x => '"' + x + '"').join(' / ') + ' มีชื่อ "' + ast.pug.as + '" ด้วย และ Gacha Redora ในออเดอร์โซนได้ ACT [เรสต์]: ดูการ์ด 5 ใบบนสุด เลือก "' + ast.pug.as + '" 1 ใบเข้า Monster BOX'); }
    if (ast.memord) { def.memOrd = true; def.text.push('CONT: ออเดอร์โซนนับเป็นเมมโมรี่ด้วย'); }
    if (ast.alc) { def.alc = ast.alc; def.text.push('CONT (VC): เมื่อคุณจะเพลย์นอร์มอลออเดอร์ เลือกนอร์มอลออเดอร์' + ({ same: 'ชื่อเดียวกัน', diff: 'ชื่อต่างกัน' }[ast.alc.nm] || '') + 'จาก' + (ast.alc.from === 'bind' ? 'ไบนด์โซน' : 'ดรอปมาไบนด์') + ' แล้ว Alchemagic ได้ (รวมคอสต์ เพิ่มเอฟเฟกต์ต่อท้าย)'); }
    if (ast.scost) { def.scost = ast.scost; def.text.unshift('สไตรด์ — สเต็ปสไตรด์: [คอสต์] ทิ้ง' + thF(ast.scost, 0).trim() + ' จากมือ 1 ใบ แล้วสไตรด์การ์ดนี้บน VC จากที่คว่ำอยู่'); }
    if (ast.sg3) { def.strideG3 = true; def.text.push('CONT (มือ): ตอนจ่ายคอสต์สไตรด์ ทิ้งการ์ดนี้แทนเกรด 3 ได้'); }
    if (ast.kiw) { def.kiwame = [].concat(...ast.kiw.map(x => mkAbility(x, { type: 'unit' }))); def.kiwameText = ast.kiw.map(thAbility); def.text.push('CONT: การ์ดทุกใบที่ชื่อเดียวกับแวนการ์ดของคุณ กลายเป็นยูนิทเกรด 3 / พลัง 13000 / คริติคอล 1 ที่มี Twin Drive และ Persona Ride และได้รับ:'); for (const t of def.kiwameText) def.text.push('・' + t); }
    if (ast.cmdeck) { def.cmDeck = ast.cmdeck; def.contOff = def.contOff || false; def.text.push('CONT (เด็ค): ' + (ast.cmdeck === 1 ? '' : 'ถ้าแวนการ์ดมีชื่อ "' + ast.cmdeck + '" ') + 'ขณะถูกเปิดจากเด็คด้วยสกิล การ์ดนี้นับเป็นการ์ด Crimson Moon'); }
    if (ast.g12deck) { def.g12Deck = ast.g12deck; def.text.push('CONT (เด็ค): ขณะถูกเปิดด้วยสกิลของแวนการ์ดที่มีชื่อ "' + ast.g12deck + '" การ์ดนี้นับเป็นเกรด 1 และ 2 ด้วย'); }
    if (ast.rv3) { def.rv3 = 1; def.text.push('CONT (มือ): เมื่อเปิดเผยการ์ดเกรด 3 จากมือเป็นคอสต์ของความสามารถการ์ดของคุณ เปิดเผยการ์ดนี้เป็นเกรด 3 ได้'); }
    if (ast.discOrd) { def.discOrd = 1; def.text.push('CONT (มือ): เมื่อทิ้งออเดอร์การ์ดจากมือเป็นคอสต์ของความสามารถการ์ดของคุณ ทิ้งการ์ดนี้เป็นออเดอร์การ์ดได้'); }
    if (ast.mate) { const nm = ast.mate; def.mateVg = nm; def.noRide = true; def.normOnly = (G, me) => !!G.vg(me.owner) && G.def(G.vg(me.owner)).name.includes(nm); def.text.unshift('[Mate Unit] ไรด์การ์ดนี้ไม่ได้ และคอลลง RC หรือ GC ได้เฉพาะเมื่อแวนการ์ดของคุณมีชื่อ "' + nm + '"'); }
    if (ast.ozCallF) { def.ozCallF = ast.ozCallF; def.text.push('CONT (ออเดอร์โซน): คุณคอลยูนิทได้เฉพาะ' + thF(ast.ozCallF, 0).trim() + 'ลง RC'); }
    if (ast.ozOne) { def.ozOne = 1; def.text.push('CONT: การ์ดชื่อนี้อยู่ในออเดอร์โซนของคุณได้ใบเดียว'); }
    if (ast.dropSave) { def.dropSave = ast.dropSave; def.text.push('CONT (ดรอป): เมื่อเรียร์การ์ด' + thFtail(ast.dropSave) + 'ของคุณจะออกจาก RC ด้วยเหตุอื่นนอกจากคอสต์ ไบนด์การ์ดนี้ได้ ถ้าทำ เรียร์การ์ดนั้นอยู่บน RC ต่อ'); }
    if (ast.sg0) { def.sg0 = 1; def.text.push('CONT (โซล): เมื่อเลือกการ์ดจากโซลสำหรับความสามารถของแวนการ์ดของคุณ เลือกการ์ดนี้เป็นเกรด 0 ได้'); }
    if (ast.u2) { def.u2 = ast.u2; def.text.push('CONT (RC): เมื่อนับจำนวนยูนิทของคุณสำหรับความสามารถของยูนิทที่มี "' + ast.u2 + '" ในชื่อ ยูนิทนี้นับเป็น 2 ยูนิท'); }
    if (ast.pd2) { def.pd2 = 1; def.text.push('CONT: เมื่อความสามารถของแวนการ์ดของคุณนับจำนวนการ์ดที่ใช้จ่ายคอสต์ การ์ดนี้นับเป็น 2 ใบ'); }
    if (ast.cnt2) { def.cnt2 = ast.cnt2; def.text.push('CONT (' + (ZONE_TH[ast.cnt2.z] || ast.cnt2.z) + '): เมื่อนับจำนวนการ์ดเผ่า ' + ast.cnt2.rc + ' ใน' + (ZONE_TH[ast.cnt2.z] || ast.cnt2.z) + ' การ์ดนี้นับเป็น 2 ใบ'); }
    if (ast.dbl) { const b = ast.dbl; def.dbl = { k: b.k, ok: (G, me, c) => (!b.c || b.c.every(x => ev(G, mkCtx(c), x))) && (!b.v || (me.zone === 'VC' && ev(G, mkCtx(me), ['vg', b.v]))) && (!b.m || mf(G, me, me, b.m)) };
      def.text.push('CONT: ' + (b.c ? 'ถ้า' + b.c.map(thC).join(' และ') + ' ' : '') + 'เมื่อการ์ดนี้จะถูก' + { retire: 'รีไทร์', soul: 'นำเข้าโซล', disc: 'ทิ้งจากมือ', sb: 'โซลบลาสต์', rvh: 'เปิดเผยจากมือ' }[b.k] + 'เป็นคอสต์ของ' + (b.v ? 'แวนการ์ด' + thFtail(b.v) : b.m ? thF(b.m, 0).trim() : 'การ์ดของคุณ') + ' นับเป็น 2 ใบได้'); }
    if (ast.h2o) { def.handToOrder = 1; def.text.push('CONT: เมื่อการ์ดนี้จะขึ้นมือ ให้วางในออเดอร์โซนแทน'); }
    if (ast.udeck) { def.unitInDeck = 1; def.text.push('CONT (เด็ค): เมื่อคุณจะค้นหาหรือเลือกยูนิทจากเด็ค เลือกการ์ดนี้ได้'); }
    if (ast.c2h) { def.callToHand = 1; def.text.push('CONT: เมื่อการ์ดนี้จะถูกคอลจากเด็คลง RC ให้ขึ้นมือแทนลงดรอป'); }
    if (ast.cpx) { def.cpx = 1; def.text.push('CONT (VC): C+P=X (ทุกครั้งที่คอลยูนิทหรือเพลย์ออเดอร์ในเมนเฟสของคุณ Formula Count ของคุณ +1 จนจบเทิร์นถัดไปของคู่ต่อสู้)'); }
    if (ast.callonly) { def.callOnly = ast.callonly; def.text.push('CONT: เมื่อการ์ดนี้จะถูกคอลลง RC ด้วยวิธีอื่นที่ไม่ใช่สกิลของ' + thF(ast.callonly, 0).trim() + ' ให้นำลงดรอปแทน'); }
    if (ast.vol) { def.volundr = ast.vol; def.arms = { s: 'V', f: { nm: ast.vol } }; def.text.push('Völundr — "' + ast.vol + '": เพลย์การ์ดนี้เป็นออเดอร์อาร์มให้แวนการ์ดที่ชื่อนั้นได้ (นับเป็นการเพลย์ออเดอร์) เมื่ออาร์มแล้วไม่ใช่ยูนิท และถ้าอาร์ม Völundr ใบใหม่ ใบเก่าลงดรอป'); }
    if (ast.volm) { def.volundrMan = 1; def.text.push('Völundr — Valkyrie ที่มีชื่อการ์ดนี้ อาร์มให้การ์ดนี้ได้'); }
    if (ast.sslock) { def.ssLock = 1; def.text.push('CONT (ออเดอร์โซน): ถ้าเทิร์นนี้คุณใช้ ACT ของเซ็ตออเดอร์อื่นที่ไม่ใช่ Training Equipment แล้ว จะใช้ ACT ของเซ็ตออเดอร์อื่น (ที่ไม่ใช่ Training Equipment) ไม่ได้อีก'); }
    if (ast.treq) { def.trainEq = 1; def.rideDeckOK = 1; def.text.push('CONT (ออเดอร์โซน): แวนการ์ดของคุณเสียสกิล AUTO และ ACT ทั้งหมด'); def.text.push('CONT (ออเดอร์โซน): คุณไรด์ปกติจากมือไม่ได้ และไรด์จากไรด์เด็คได้โดยไม่ต้องทิ้งการ์ด'); }
    if (ast.smc) { const cs = ast.smc; def.smCond = (G, me, user) => { const ctx = mkCtx(me); ctx.evt = { user }; return cs.every(c => ev(G, ctx, c)); }; def.text.push('CONT (โซนท่าพิเศษ): ใช้ท่านี้ได้เฉพาะเมื่อ ' + cs.map(thC).join(' และ')); }
    if (ast.smu) { def.smOff = ast.smoff != null ? !!ast.smoff : !ast.smu.some(k => k.pos === 'f');   // Shoot moves are used from the front row; the others are Offence moves (checked against the Japanese list)
      def.smUse = ast.smu; def.text.push('เงื่อนไขการใช้: ' + ast.smu.map(k => (k.nh ? k.nh.map(n => '"' + n + '"').join(' หรือ ') : k.rc || k.tags ? '' : 'ยูนิทใดก็ได้') + (k.rc ? ' <' + k.rc + '>' : '') + (k.tags ? ' ตำแหน่ง ' + k.tags.join('/') : '') + (k.pos === 'f' ? ' (แถวหน้า)' : k.pos === 'b' ? ' (แถวหลัง)' : k.pos === 'v' ? ' (แวนการ์ด)' : '')).join(' / ')); }
    if (ast.noso) { def.noSetPlay = 1; def.text.push('CONT: คุณเพลย์เซ็ตออเดอร์ไม่ได้'); }
    if (ast.ronly) { def.rideOnlyC = ast.ronly; def.text.push('CONT: คุณไรด์การ์ดอื่นนอกจาก' + thF(ast.ronly, 0).trim() + 'ไม่ได้'); }
    if (ast.oprby) { def.oprBy = ast.oprby; def.text.push('CONT: การ์ดนี้ถูกโอเปอเรตได้ด้วยความสามารถของ' + thF(ast.oprby, 0).trim() + 'เท่านั้น'); }
    if (ast.cc) { def.callCost = ast.cc.map(mkCost); def.text.push('[Call Cost] ' + def.callCost.map(k => k.label).join(' + ') + ' (จ่ายเมื่อคอลจากมือในเมนเฟส)'); }
    if (ast.ctop) { def.callOnTop = ast.ctop; def.text.push('[Call Cost] คอลทับ' + thF(ast.ctop, 0).trim() + 'บน RC (ใบเดิมกลายเป็นบัดดี้โซลของการ์ดนี้)'); }
    if (ast.arm) { def.arms = { s: ast.arm.s || null, f: ast.arm.f || {} }; def.text.push((ast.arm.s === 'L' ? 'Left Deity Arms' : ast.arm.s === 'R' ? 'Right Deity Arms' : 'Arms') + ' — อาร์มให้' + (Object.keys(def.arms.f).length ? thF(def.arms.f, 0).trim() : 'แวนการ์ด') + ' (อาร์มได้ฝั่งละ 1 ใบ ใบเก่าฝั่งเดียวกันลงดรอป)'); }
    if (ast.armby) { def.armBy = ast.armby; def.text.push('CONT: อาร์มได้ด้วยความสามารถของการ์ดที่มี "' + ast.armby + '" ในชื่อเท่านั้น'); }
    if (ast.jail) { def.jail = true; def.text.push('CONT (ออเดอร์โซน): ในเมนเฟสของคู่ต่อสู้ คู่ต่อสู้ทำได้ดังนี้ — [โซลบลาสต์ 1] เลือกการ์ดของตนที่ถูกขัง 1 ใบแล้วคอลลง RC / [เคาน์เตอร์บลาสต์ 1] เลือก 2 ใบแล้วคอลลง RC (แสดงเป็น ACT ที่แวนการ์ดของคู่ต่อสู้)'); }
    if (ast.prsc) { def.prSC = true; def.text.push('CONT (VC): การ์ด [Prisoner] ที่ถูกนำเข้าโซลด้วยความสามารถของการ์ดคุณ นับเป็นการ์ดที่เข้าโซลด้วยโซลชาร์จด้วย'); }
    if (ast.cot) { def.callOnTok = true; def.text.push('CONT: คอลปกติได้เฉพาะลง RC ที่มีโทเคนยูนิทอยู่'); }
    if (ast.gz) { def.gz = ast.gz; def.text.push('CONT: คุณมี' + gkTh(ast.gz) + 'ได้'); }
    if (ast.psink) { def.plantSink = ast.psink; def.text.push('CONT (RC): ถ้าแวนการ์ดของคุณมี "' + ast.psink + '" ในชื่อ เมื่อจะวาง Plant โทเคนลง RC ให้วางเป็นเกจ Plant ของยูนิทนี้แทน'); }
    if (ast.tkas) { def.tokenAs = ast.tkas; def.text.push('CONT (RC): ขณะอยู่บน RC นับเป็นโทเคนยูนิทชื่อ "' + ast.tkas.replace(/\b\w/g, x => x.toUpperCase()) + '" ด้วย'); }
    if (ast.charm) { def.charmStay = true; def.text.push('CONT (เกจโซน): ในเทิร์นของคู่ต่อสู้ เมื่อยูนิทที่มีการ์ดนี้เป็นเกจจะออกจาก RC (ไม่ใช่เพื่อจ่ายคอสต์) คุณทิ้งการ์ดนี้เพื่อให้ยูนิทนั้นอยู่ต่อได้'); }
    if (ast.cf) { def.callFilter = ast.cf; def.text.push('CONT (VC): คุณคอลได้เฉพาะยูนิท' + thF(ast.cf, 0).trim()); }
    if (ast.cag) { def.callAnyF = ast.cag; def.text.push('CONT (VC): คอลยูนิท' + thF(ast.cag, 0).trim() + 'ได้โดยไม่สนเกรด'); }
    if (ast.roo) { def.rideBarO = ast.roo; def.text.push('CONT (ออเดอร์โซน): คุณไรด์การ์ด' + (ast.roo.gmin ? 'เกรด ' + ast.roo.gmin + ' ขึ้นไป' : '') + 'ที่ไม่มี "' + ast.roo.nh + '" ในชื่อไม่ได้'); }
    if (ast.pa) { const f = ast.pa; def.personaOn = (other, own) => other.name !== own.name && (!f.nh || other.name.includes(f.nh)); def.text.push('CONT: การนอร์มอลไรด์จากมือทับยูนิทนี้ด้วยยูนิท' + (f.nh ? 'ที่มีชื่อ "' + f.nh + '" ' : '') + 'ชื่อต่างกันก็นับเป็นเพอร์โซน่าไรด์'); }
    if (ast.pf) { const f = ast.pf; def.personaFrom = (od, nd) => (f.g == null || od.grade === f.g) && (f.ico ? od.icon === f.ico && (!nd || od.name !== nd.name) : (od.name.includes(f.nh) || (!!f.nh2 && od.name.includes(f.nh2)))); def.text.push('CONT: การนอร์มอลไรด์การ์ดนี้ทับการ์ดเหล่านั้นนับเป็นเพอร์โซน่าไรด์ด้วย'); }
    if (ast.rby) { def.rideBy = ast.rby; def.text.unshift('CONT: การ์ดนี้ถูกไรด์ได้ด้วยสกิลของ "' + jn(ast.rby) + '" เท่านั้น'); }
    if (ast.rov) { def.rideOnlyV = ast.rov; def.text.push('CONT (VC): คุณไรด์ได้เฉพาะการ์ดที่มีชื่อ "' + ast.rov + '"'); }
    if (ast.rc2) { def.race = (def.race ? def.race + '/' : '') + ast.rc2; def.text.push('CONT: การ์ดนี้นับเป็น ' + ast.rc2 + ' ด้วย'); }
    if (ast.asSet) { def.asSet = true; def.text.push('CONT (ออเดอร์โซน): การ์ดนี้นับเป็นเซ็ตออเดอร์'); }
    if (ast.ovp) { def.ovp = ast.ovp; def.text.push('CONT (RC แถวหลัง): ถ้ามียูนิทที่มีชื่อ "' + ast.ovp + '" ในคอลัมน์เดียวกัน ยูนิทนั้นและยูนิทนี้อยู่ในสถานะ Oversized!'); }
    if (ast.as2) { def.as2 = ast.as2; def.text.unshift('CONT: ระหว่างไฟท์นี้ นับเป็นการ์ดชื่อ "' + jn(ast.as2) + '" ด้วย'); }
    if (ast.of) { def.ordFilter = ast.of; def.text.push('CONT (VC): ในเทิร์นของคุณ เพลย์ได้เฉพาะออเดอร์' + thF(ast.of, 0).trim()); }
    if (ast.as && !def.as) { def.as = ast.as; def.text.unshift('DressUp: ระหว่างไฟท์นี้ นับเป็นการ์ดชื่อ "' + jn(ast.as) + '" ด้วย'); }
    if (ast.np) { def.noPlay = true; def.text.unshift('CONT: การ์ดนี้เพลย์ไม่ได้'); }
    if (ast.tg) { def.tags = ast.tg.slice(); if (def.tags.includes('event')) def.event = 1; }
    if (ast.sina) { def.sina = ast.sina; def.text.push('Sinastery: ' + (ast.sina.c ? 'ถ้า' + ast.sina.c.map(thC).join(' และ') + ' ' : '') + (ast.sina.k ? '[' + ast.sina.k.map(k => mkCost(k).label).join(' + ') + '] → ' : '') + thSteps(ast.sina.d)); }
    if (ast.na2) { def.nation2 = ast.na2; def.text.unshift('CONT: การ์ดนี้นับเป็นของเนชั่น ' + ast.na2 + ' ด้วย'); }
    if (ast.x) for (const t of [].concat(ast.x)) def.text.push('CONT: ' + t);   // a rule that another entry of this card (or the engine) enforces — text only
    if (ast.cl) { const ce = ast.cl; def.costLess = (G, me) => nv(G, mkCtx(me), ce); def.text.push('CONT: คอสต์เคาน์เตอร์บลาสต์ของการ์ดนี้ลดลงเท่ากับ ' + thN(ce)); }
    if (ast.bind) { def.bindRule = [].concat(ast.bind); for (const b of def.bindRule) def.text.unshift('CONT: ' + ({ self: 'การ์ดนี้ถูกไบนด์ได้ด้วยสกิลของการ์ดนี้เท่านั้น', cost: 'การ์ดนี้ถูกไบนด์ได้เฉพาะเป็นคอสต์ของสกิลคุณ', lock: 'ขณะอยู่ในไบนด์โซน การ์ดนี้ไม่ถูกเลือกและไม่ถูกย้ายโซนด้วยสกิลการ์ด' }[b] || '')); }

    if (ast.noOrdAb) { def.noOrdAb = true; def.text.unshift('CONT: การ์ดนี้ถูกนำไปออเดอร์โซนด้วยสกิลการ์ดไม่ได้'); }
    if (ast.ig) { const cc = ast.ig; def.ignoreGrade = (G, p) => { const ctx = mkCtx({ owner: p, iid: -1, zone: 'hand', mods: [] }); return cc.every(c => ev(G, ctx, c)); }; def.text.push('ถ้า' + cc.map(thC).join(' และ') + ' เพลย์การ์ดนี้ได้โดยไม่สนเกรด'); }
    if (ast.ss) { const cc = ast.ss.c || [];
 def.soulStay = (G, me) => { const ctx = mkCtx(me); return cc.every(c => ev(G, ctx, c)); }; def.text.push('CONT (โซล): ' + (cc.length ? 'ถ้า' + cc.map(thC).join(' และ') + ' ' : '') + 'การ์ดนี้ไม่ออกจากโซลด้วยเอฟเฟกต์การ์ด'); }
    if (ast.cb) { const cc = ast.cb.c; def.callBar = (G, me) => { const ctx = mkCtx(me); return cc.every(c => ev(G, ctx, c)); }; def.text.unshift('CONT: ถ้า' + cc.map(thC).join(' และ') + ' คอลการ์ดนี้ลง RC ไม่ได้'); }
    if (ast.cp) { def.copy = ast.cp.map(x => ({ zones: x.z, f: x.f, types: x.ty, divine: !!x.dv, cond: x.c ? (G, me) => { const ctx = mkCtx(me); return x.c.every(c => ev(G, ctx, c)); } : null })); for (const x of ast.cp) def.text.push('CONT: ' + (x.c ? 'ถ้า' + x.c.map(thC).join(' และ') + ' ' : '') + 'ยูนิทนี้ได้รับ ' + x.ty.map(t => ({ act: 'ACT', cont: 'CONT', auto: 'AUTO' }[t])).join(' / ') + (x.dv ? ' (Divine Skill)' : '') + ' ทั้งหมดของ' + thF(x.f, 0).trim() + 'ใน' + x.z.map(zth).join('/') + 'ของคุณ'); }
    if (ast.miss) def.miss = ast.miss; if (ast.asst) def.asst = ast.asst;
    if (ast.od) { def.od = ast.od; def.text.unshift((ast.od.x ? 'X-overDress' : 'overDress') + ' — ตอนคอลจากมือ วางซ้อนบน' + ast.od.p.map(x => (x.n ? '' : x.min + ' ใบขึ้นไป ') + thF(x.f, 0).trim() + (x.dist ? ' (ชื่อไม่ซ้ำกัน)' : '')).join(' และ ') + ' บน RC ของคุณได้ ใบที่ถูกซ้อนกลายเป็น originalDress (ไปไหนไปด้วยกันเมื่อยูนิทนี้ออกจากสนาม)'); }
    def.compiled = true;
    return def;
  },
  ev, mf, run, mkCtx, thAbility, thSteps,
};

/* ---------- Thai descriptions ---------- */
function thFtail(F) {
  if (!F) return ''; const a = [];
  if (F.g) a.push(F.g[0] === F.g[1] ? 'เกรด ' + F.g[0] : F.g[1] >= 99 ? 'เกรด ' + F.g[0] + ' ขึ้นไป' : 'เกรด ' + F.g[1] + ' หรือต่ำกว่า');
  if (F.gmin) a.push('เกรด ' + F.gmin + ' ขึ้นไป');
  if (F.nm) a.push('"' + jn(F.nm) + '"');
  if (F.nh) a.push('ที่มีชื่อ "' + F.nh + '"' + (F.nh2 ? ' หรือ "' + F.nh2 + '"' : ''));
  if (F.rc) a.push('<' + F.rc + '>'); if (F.na) a.push('เนชั่น ' + F.na); if (F.gl) a.push('[Glitter]'); if (F.op) a.push('พลังตั้งต้น ' + F.op[1] + (F.op[0] === '>=' ? ' ขึ้นไป' : ' หรือต่ำกว่า')); if (F.dn) a.push('ชื่อต่างจากการ์ดนี้'); if (F.dnv) a.push('ชื่อต่างจากแวนการ์ด'); if (F.sit) a.push('ชื่อเดียวกับใบที่เลือกไว้'); if (F.dist) a.push('ชื่อไม่ซ้ำกัน'); if (F.distg) a.push('เกรดไม่ซ้ำกัน'); if (F.colit) a.push('ในคอลัมน์เดียวกับใบที่เลือก');
  if (F.tr) a.push(F.tr.map(t => VG.TRIG_TH[t]).join('หรือ'));
  if (F.sn) a.push('ชื่อเดียวกับการ์ดนี้'); if (F.snv) a.push('ชื่อเดียวกับแวนการ์ด');
  if (F.ns) a.push('ที่ไม่ใช่เซนทิเนล'); if (F.sen) a.push('ที่เป็นเซนทิเนล'); if (F.nov) a.push('ที่ไม่ใช่โอเวอร์ทริกเกอร์'); if (F.nn) a.push('ที่ไม่ใช่ "' + jn(F.nn) + '"');
  if (F.oda) a.push('ที่มีความสามารถ ' + (F.oda === 'x' ? 'X-overDress' : F.oda === 'o' ? 'overDress' : 'overDress หรือ X-overDress')); if (F.ods) a.push('ที่อยู่ในสถานะ ' + (F.ods === 'x' ? 'X-overDress' : F.ods === 'o' ? 'overDress' : 'overDress หรือ X-overDress')); if (F.odn) a.push('ที่มี originalDress ' + F.odn + ' ใบขึ้นไป');
  if (F.mk) a.push('บน RC ที่มี ' + (F.mk === 1 ? '' : F.mk + ' ') + 'marker'); if (F.tag) a.push('ที่มี [' + F.tag + ']'); if (F.ssk) a.push('ที่มีสกิลเรย์เกกิ (Spirit Strike)'); if (F.trn) a.push('ที่กำลังฝึก (Training)'); if (F.skmin != null) a.push('ที่มี Skill ' + F.skmin + ' ขึ้นไป'); if (F.fin) a.push('ที่มี Finishing Attack เป็น ' + F.fin); if (F.sup) a.push('ที่มี Super Finishing Attack เป็น "' + F.sup + '"'); if (F.gnv) a.push('เกรดต่างจากใบที่เลือกไว้');
  if (F.pr) a.push('ที่มีเพอร์โซน่าไรด์'); if (F.gv) a.push(F.gv === 2 ? 'เกรดต่ำกว่าแวนการ์ด' : 'เกรดไม่เกินแวนการ์ด');
  if (F.or) a.push('(' + F.or.map(x => thF(x, 0).trim()).join(' หรือ ') + ')');
  if (F.nnh) a.push('ที่ไม่มีชื่อ "' + F.nnh + '"'); if (F.rch) a.push('ที่เผ่ามีคำว่า ' + F.rch); if (F.nin) a.push('ที่ชื่อไม่ซ้ำกับการ์ดใน' + (F.nin === 'rc' ? 'RC ของคุณ' : ZONE_TH[F.nin])); if (F.snz) a.push('ที่ชื่อเดียวกับการ์ดใน' + [].concat(F.snz).map(z => ({ rc: 'RC ของคุณ', u: 'ยูนิทของคุณ' }[z] || ZONE_TH[z] || z)).join('/')); if (F.ngz) a.push('ที่เกรดไม่ซ้ำกับการ์ดใน' + (ZONE_TH[F.ngz] || F.ngz)); if (F.inz) a.push('ใน' + (ZONE_TH[F.inz] || F.inz)); if (F.faceup != null) a.push(F.faceup ? 'ที่หงายอยู่' : 'ที่คว่ำอยู่');
  if (F.ntlos) a.push('ที่ชื่อต่างจากการ์ดที่ถูกนำจากออเดอร์โซนเข้าโซลในเทิร์นนี้'); if (F.gpar != null) a.push(F.gpar ? 'เกรดคี่' : 'เกรดคู่'); if (F.natk) a.push('ที่ไม่ได้ถูกโจมตีอยู่'); if (F.pfrom) a.push('ที่วางจาก' + ZONE_TH[F.pfrom] + 'ในเทิร์นนี้');
  if (F.snu) a.push('ชื่อเดียวกับยูนิท' + (F.snu === 1 ? '' : thFtail(F.snu)) + 'ของคุณ');
  if (F.ncb) a.push('ที่ยังไม่ถูกเลือกด้วยสกิลนี้ในเทิร์นนี้'); if (F.ntr) a.push('ที่ไม่ใช่' + F.ntr.map(t => VG.TRIG_TH[t]).join('/')); if (F.gva != null) a.push('เกรดตั้งแต่เกรดแวนการ์ดของคุณ' + (F.gva ? ' +' + F.gva : '') + 'ขึ้นไป');

  if (F.pby) a.push('ที่วางในเทิร์นนี้ด้วยสกิล' + (F.pby === 'v' ? 'แวนการ์ด' : 'การ์ด') + 'ของคุณ');
  if (F.pos) a.push('บนเซอร์เคิล ' + F.pos.join('/')); if (F.srv) a.push('เผ่าเดียวกับแวนการ์ดของคุณ');
  if (F.pw) a.push('พลัง '
 + F.pw[1] + (F.pw[0] === '>=' ? ' ขึ้นไป' : ' หรือต่ำกว่า')); if (F.placed) a.push('ที่วางในเทิร์นนี้'); if (F.kw) a.push('ที่มี ' + F.kw); if (F.ng) a.push('ที่ไม่ใช่เกรด ' + F.ng[0] + (F.ng[1] > F.ng[0] ? '–' + (F.ng[1] >= 99 ? '' : F.ng[1]) : '')); if (F.nty) a.push('ที่ไม่ใช่' + { tu: 'ทริกเกอร์ยูนิท', u: 'ยูนิท', o: 'ออเดอร์', nu: 'นอร์มอลยูนิท', no: 'นอร์มอลออเดอร์' }[F.nty]); if (F.stt) a.push('ในสถานะ ' + F.stt); if (F.tru) a.push('ที่เป็นทริกเกอร์'); if (F.gle) a.push('เกรดไม่เกินแวนการ์ดคู่ต่อสู้');
  if (F.reg != null) a.push(F.reg ? 'ที่มี Regalis Piece' : 'ที่ไม่มี Regalis Piece'); if (F.gvar) a.push('เกรดเท่ากับที่กำหนดไว้'); if (F.gvle) a.push('เกรดไม่เกินที่กำหนดไว้');
  if (F.dup) a.push('ที่มีความสามารถ DressUp');
  if (F.osh) a.push('ชิลด์ดั้งเดิม ' + F.osh[1] + (F.osh[0] === '>=' ? ' ขึ้นไป' : F.osh[0] === '<=' ? ' หรือน้อยกว่า' : ''));
  if (F.rd) a.push('ที่เคยอยู่ในไรด์เด็ค'); if (F.rfu != null) a.push(F.rfu ? 'ที่หงายหน้าอยู่' : 'ที่คว่ำหน้าอยู่');
  if (F.cln != null) a.push(F.cln === 1 ? 'ที่มีไอคอนแคลน' : F.cln === 0 ? 'ที่ไม่มีไอคอนแคลน' : 'ที่มีแคลน ' + String(F.cln).replace(/\b\w/g, y => y.toUpperCase()) + ' เพียงแคลนเดียว'); if (F.cl1) a.push('ที่มีแคลนเดียว'); if (F.clsv) a.push('ที่มีแคลนเดียวกับแวนการ์ดของคุณเท่านั้น');
  if (F.ico) a.push('ที่มีไอคอน ' + F.ico.replace(/\b\w/g, y => y.toUpperCase())); if (F.arm) a.push('ที่เป็นอาร์มการ์ด'); if (F.arml) a.push('ที่เป็น Left Deity Arms'); if (F.armr) a.push('ที่เป็น Right Deity Arms');
  if (F.natkd) a.push('ที่ไม่ได้ถูกโจมตี'); if (F.hostme) a.push('ที่มีการ์ดนี้เป็นเกจ'); if (F.bsx) a.push('ใบอื่นที่บัดดี้โซลไม่มีการ์ดชื่อเดียวกับการ์ดนี้'); if (F.lnk) a.push('ที่อยู่ในสถานะลิงก์แอทแทค'); if (F.bsn != null) a.push('ที่มีบัดดี้โซล ' + F.bsn + ' ใบขึ้นไป'); if (F.bsf) a.push('ที่บัดดี้โซลมี' + thF(F.bsf, 0).trim());
  if (F.gk) a.push('ที่เป็น' + gkTh(F.gk === 1 ? '' : F.gk)); if (F.gh) a.push('ที่เป็นเกจของการ์ดนี้'); if (F.hgz) a.push('ที่มี' + gkTh(F.hgz === 1 ? '' : F.hgz)); if (F.nogz) a.push('ที่ไม่มี' + gkTh(F.nogz === 1 ? '' : F.nogz));
  if (F.tkt) a.push('ที่เป็นทิกเก็ต'); if (F.noab) a.push('ที่ไม่มีความสามารถ'); if (F.nsz) a.push('ที่ชื่อไม่ซ้ำกับการ์ดใน' + [].concat(F.nsz).map(z => ZONE_TH[z] || z).join('/'));
  if (F.usd) a.push('ที่อยู่ในสถานะ UnisonDress'); if (F.me) a.push('(ยูนิทนี้)'); if (F.ovz) a.push('ที่อยู่ในสถานะ Oversized!'); if (F.frd) a.push('ที่เป็น Friends');
  if (F.unl) a.push('ที่ถูกปลดล็อกในเทิร์นนี้'); if (F.swl) a.push('ที่อยู่ในสถานะ SweetLink'); if (F.chby) a.push('ที่ถูกเลือกด้วยสกิลของ' + thBy(F.chby) + 'ในเทิร์นนี้');
  if (F.mylast) a.push('บนเซอร์เคิลที่ยูนิทนี้เคยอยู่'); if (F.nrc) a.push('ที่ไม่ใช่ <' + F.nrc + '>');
  if (F.col) a.push('ในคอลัมน์เดียวกับยูนิทนี้'); if (F.ncol) a.push('ในคอลัมน์อื่น'); if (F.row) a.push(F.row === 'f' ? 'แถวหน้า' : 'แถวหลัง'); if (F.st) a.push(F.st === 's' ? 'ที่สแตนด์อยู่' : 'ที่เรสต์อยู่');
  if (F.tk) a.push(F.tk === 1 ? 'โทเคน' : F.tk + ' โทเคน'); if (F.ot) a.push('ใบอื่น');
  return a.length ? ' ' + a.join(' ') : '';
}
function thF(F, n, up) {
  const ty = { u: 'ยูนิท', nu: 'นอร์มอลยูนิท', tu: 'ทริกเกอร์ยูนิท', o: 'ออเดอร์', no: 'นอร์มอลออเดอร์', so: 'เซ็ตออเดอร์', bo: 'บลิตซ์ออเดอร์' }[(F && F.ty) || ''] || 'การ์ด';
  const q = n >= 99 ? ' กี่ใบก็ได้' : n ? (up ? ' สูงสุด ' : ' ') + n + ' ใบ' : '';
  return ty + thFtail(F) + q + ' ';
}
function thFn(F, n, up) { return Array.isArray(n) ? thF(F, 0).trim() + (up ? ' สูงสุด' : ' ') + 'จำนวน' + thN(n) + ' ' : thF(F, n, up); }
function thSel(sel) {
  if (sel.k === 'atkd') return 'ยูนิทของคุณที่ถูกโจมตีอยู่ 1 ใบ';
  if (Array.isArray(sel.n)) return KTH[sel.k] + (sel.s === 'o' ? 'ของคู่ต่อสู้' : sel.s === 'x' ? 'ของผู้เล่นคนใดก็ได้' : 'ของคุณ') + thFtail(sel.f) + (sel.up ? ' สูงสุด' : ' ') + 'จำนวน' + thN(sel.n);
  const who = sel.s === 'o' ? 'ของคู่ต่อสู้' : sel.s === 'x' ? 'ของผู้เล่นคนใดก็ได้' : 'ของคุณ'; const k = KTH[sel.k];
  return k + who + thFtail(sel.f) + (sel.n >= 99 ? ' กี่ใบก็ได้' : (sel.up ? ' สูงสุด ' : ' ') + sel.n + ' ใบ');
}
function thMod(m) {
  const a = [];
  if (m.power) a.push('พลัง ' + (m.power > 0 ? '+' : '') + fmtN(m.power)); if (m.shield) a.push('ชิลด์ ' + (m.shield > 0 ? '+' : '') + m.shield); if (m.crit) a.push('คริติคอล ' + (m.crit > 0 ? '+' : '') + m.crit); if (m.drive) a.push('ไดรฟ์ ' + (m.drive > 0 ? '+' : '') + m.drive);
  if (m.boost) a.push('ได้ "บูสต์"'); if (m.intercept && !m.backInt) a.push('ได้ "อินเตอร์เซปต์"'); if (m.driveMin) a.push(m.driveMin === 3 ? 'ได้ "ทริปเปิลไดรฟ์"' : 'ได้ "ทวินไดรฟ์"');
  if (m.cantBeHit) a.push('ไม่ถูกโจมตีโดน'); if (m.cantAttack) a.push('โจมตีไม่ได้'); if (m.cantIntercept) a.push('อินเตอร์เซปต์ไม่ได้'); if (m.cantBoost) a.push('บูสต์ไม่ได้');
  if (m.guardMin) a.push('คู่ต่อสู้ต้องคอลการ์ดเดี้ยน' + (m.guardNs ? 'ที่ไม่ใช่เซนทิเนล' : '') + 'จากมือครั้งละ ' + m.guardMin + ' ใบขึ้นไป' + (m.guardDg ? ' โดยเกรดไม่ซ้ำกัน' : '')); if (m.noRetOpp) a.push('ไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ดของคู่ต่อสู้');
  if (m.resist) a.push('ไม่ถูกเลือกโดยเอฟเฟกต์การ์ดของคู่ต่อสู้'); if (m.backAtk) a.push('โจมตีจากแถวหลังได้'); if (m.backInt) a.push('อินเตอร์เซปต์จากแถวหลังได้');
  if (m.trigPlus) a.push('พลังที่ได้จากทริกเกอร์ของคุณ +' + m.trigPlus); if (m.cantAtkVG) a.push('โจมตีแวนการ์ดไม่ได้'); if (m.noAtkByRG) a.push('ไม่ถูกเรียร์การ์ดของคู่ต่อสู้โจมตี'); if (m.cantBeAtk) a.push('ไม่ถูกโจมตี'); if (m.backAtkRG) a.push('โจมตีเรียร์การ์ดแถวหน้าของคู่ต่อสู้จากแถวหลังได้'); if (m.backAtkC) a.push('โจมตีจากแถวหลังกลางได้'); if (m.atkColRG) a.push('เมื่อโจมตีเรียร์การ์ด จะสู้กับยูนิทของคู่ต่อสู้ทั้งคอลัมน์นั้น'); if (m.alsoHitByVG) a.push('ถูกสู้ไปด้วยทุกครั้งที่แวนการ์ดของคู่ต่อสู้โจมตี');
  if (m.grade) a.push('เกรด ' + (m.grade > 0 ? '+' : '') + m.grade); if (m.atkPlus2) a.push('เมื่อโจมตี เลือก RC ของคู่ต่อสู้ 2 ช่อง สู้กับยูนิทบนนั้นและแวนการ์ดพร้อมกัน');
  if (m.noHandGuard) a.push('คู่ต่อสู้คอลการ์ดจากมือลง GC ไม่ได้'); if (m.noSentGuard) a.push('คู่ต่อสู้คอลเซนทิเนลจากมือลง GC ไม่ได้'); if (m.noNuGuard) a.push('คู่ต่อสู้คอลนอร์มอลยูนิทจากมือลง GC ไม่ได้'); if (m.noTrigGuard) a.push('คู่ต่อสู้คอลทริกเกอร์ยูนิทจากมือลง GC ไม่ได้'); if (m.hitBind) a.push('เรียร์การ์ดที่ถูกยูนิทนี้โจมตีโดนจะถูกไบนด์แทนการรีไทร์');
  if (m.ordDiff) a.push('เพลย์ออเดอร์ชื่อเดียวกับที่เพลย์ไปแล้วในเทิร์นนี้ไม่ได้'); if (m.worldSG) a.push('เวิลด์ของคุณเป็น Stray Garden');
  if (m.callBounce) a.push('เมื่อสกิลของยูนิทนี้คอลทับยูนิทบน RC ยูนิทที่ถูกทับจะกลับขึ้นมือแทนการลงดรอป'); if (m.atk3) a.push('เมื่อโจมตี เลือกยูนิทคู่ต่อสู้ได้ถึง 3 ใบ (VC/RC) แล้วสู้พร้อมกันทั้งหมด'); if (m.oSoulBottom) a.push('นอร์มอลยูนิทของคู่ต่อสู้ที่จะถูกนำจาก RC เข้าโซลด้วยสกิลแวนการ์ดคุณ จะไปอยู่ล่างสุดของเด็คแทน'); if (m.boostAny) a.push('บูสต์ยูนิทในแถวตั้งอื่นได้');
  if (m.atkVG1f) a.push('เมื่อโจมตี เลือก RC แถวหน้าของคู่ต่อสู้ 1 ช่อง แล้วสู้กับแวนการ์ดและยูนิทบนช่องนั้นพร้อมกัน');
  if (m.sentBind) a.push('เซนทิเนลของคู่ต่อสู้ที่จะถูกรีไทร์จาก GC จะถูกไบนด์แทน');
  if (m.noSoulByVG) a.push('ไม่ถูกนำเข้าโซลด้วยสกิลแวนการ์ดของคุณ');
  if (m.trigToVG) a.push('แวนการ์ดของคุณได้รับเอฟเฟกต์ทริกเกอร์เดียวกับที่ยูนิทนี้ได้รับ');
  if (m.vgTrig) a.push('ได้รับเอฟเฟกต์ทริกเกอร์เดียวกับที่แวนการ์ดของคุณได้รับ');
  if (m.gbAny) a.push('สกิล Generation Break ทำงานโดยไม่สนจำนวน G ยูนิทหงาย'); if (m.gcNoHit) a.push('เมื่อการ์เดี้ยนของคู่ต่อสู้ถูกรีไทร์ด้วยสกิลของยูนิทนี้ เอฟเฟกต์ "ไม่ถูกโจมตีโดน" ทั้งหมดของการ์ดนั้นถูกยกเลิก');   if (m.driveBottom) a.push('การ์ดที่เปิดจากไดรฟ์เช็คของยูนิทนี้ไปไว้ล่างสุดของเด็คแทนขึ้นมือ'); if (m.noAct) a.push('ใช้ ACT ไม่ได้'); if (m.callBounceN) a.push('เมื่อความสามารถของยูนิทนี้คอลลง RC ที่มีนอร์มอลยูนิทที่ไม่มีเซนทิเนล ยูนิทเดิมกลับขึ้นมือแทนลงดรอป'); if (m.overPw) a.push('ยูนิทชื่ออื่นที่ความสามารถของแวนการ์ดคอลทับยูนิทเดิม ได้รับพลังเพิ่มเท่าพลังดั้งเดิมของยูนิทเดิมจนจบเทิร์น');   if (m.noShoot) a.push('ใช้ท่าพิเศษประเภทชู้ตไม่ได้');   if (m.atk3) a.push('ไม่เรสต์เมื่อโจมตี และโจมตีได้สูงสุด 3 ครั้งในเทิร์นนี้'); if (m.driveSet != null) a.push('ไดรฟ์กลายเป็น ' + m.driveSet);
  if (m.critSet) a.push('คริติคอลเป็น ' + m.critSet);
  if (m.trigX2) a.push('ทริกเกอร์เอฟเฟกต์ของคุณทำงาน 2 ครั้ง');
  if (m.soulguard) a.push('[Soulguard] เมื่อยูนิทนี้จะออกจาก RC ทิ้งบัดดี้โซล 1 ใบแทนเพื่อให้อยู่ต่อได้');
  if (m.asTU) a.push('นับเป็นทริกเกอร์ยูนิท'); if (m.atkAllRG) a.push('เมื่อโจมตีเรียร์การ์ด จะสู้กับเรียร์การ์ดของคู่ต่อสู้ทั้งหมด');   if (m.atkAll) a.push('เมื่อโจมตี จะสู้กับยูนิทของคู่ต่อสู้ทั้งหมด');
  if (m.driveToSoul) a.push('การ์ดที่เปิดจากไดรฟ์เช็คของยูนิทนี้เข้าโซลแทนขึ้นมือ'); if (m.noStandFx) a.push('สแตนด์ด้วยความสามารถของการ์ดไม่ได้');
  if (m.immune) a.push('ไม่ได้รับผลจากการ์ดของคู่ต่อสู้'); if (m.gLess) a.push('คอสต์ของ ACT ลดเกจลง 1');
  if (m.gcBindFd) a.push('เมื่อจะถูกรีไทร์จาก GC ให้ไบนด์แบบคว่ำหน้าแทน');
  if (m.gcSoul) a.push('เมื่อจะถูกรีไทร์จาก GC ให้นำเข้าโซลแทน');
  if (m.baseCr != null) a.push('คริติคอลดั้งเดิมกลายเป็น ' + m.baseCr);
  if (m.baseSh != null) a.push('ชิลด์ดั้งเดิมกลายเป็น ' + m.baseSh); if (m.lose7) a.push('คุณแพ้เมื่อดาเมจถึง 7 ใบ (แทน 6)');
  if (m.basePw != null) a.push('พลังดั้งเดิมกลายเป็น ' + m.basePw); if (m.ord3) a.push('เพลย์ออเดอร์ได้ 3 ใบในเทิร์นนี้'); if (m.ord2) a.push('เพลย์ออเดอร์ได้ 2 ใบในเทิร์นนี้'); if (m.noBlitzG) a.push('ในแบทเทิลที่ยูนิทนี้โจมตี คู่ต่อสู้เพลย์บลิทซ์ออเดอร์จากมือไม่ได้'); if (m.energyMax5) a.push('เอเนอร์จีสูงสุดที่มีได้ +5');
  if (m.noHitRet) a.push('แม้ถูกโจมตีโดนก็ไม่ถูกรีไทร์');
  if (m.noIntercept) a.push('คู่ต่อสู้อินเตอร์เซปต์ไม่ได้');

 if (m.cbLess1) a.push('คอสต์เคาน์เตอร์บลาสต์ของสกิลดั้งเดิมลดลง 1'); if (m.stayDisc) a.push('เมื่อจะออกจาก RC ทิ้งการ์ด 1 ใบจากมือเพื่ออยู่ต่อได้'); if (m.ord2) a.push('คุณเพลย์ออเดอร์ได้ 2 ใบ');
  if (m.noIntAll) a.push('คู่ต่อสู้อินเตอร์เซปต์ไม่ได้');
  if (m.personaBack) a.push('เพอร์โซน่าไรด์ของคุณเพิ่มพลังให้ยูนิทแถวหลังด้วย');
 if (m.nullAb) a.push('สกิลทั้งหมดถูกลบล้าง'); if (m.noDblSt) a.push('สแตนด์ด้วยสกิล [Double Attack] ไม่ได้'); if (typeof m.asName === 'string') a.push('ได้รับชื่อ "' + m.asName + '"'); if (m.dcLook2) a.push('ไดรฟ์เช็ค: ดูการ์ด 2 ใบบนสุด เลือก 1 ใบไปทริกเกอร์โซน ที่เหลือไว้ล่างสุดของเด็ค'); if (m.bindNm) a.push('ได้รับชื่อของการ์ดเกรด 1 ขึ้นไปแบบหงายในไบนด์โซนที่มี "' + m.bindNm + '" ในชื่อ'); if (m.trigNuP) a.push('ทริกเกอร์ยูนิทของคุณใน RC และเด็คถือเป็นนอร์มอลยูนิท'); if (m.ocritSh) a.push('คริติคอลทริกเกอร์ทั้งหมดของคู่ต่อสู้ ชีลด์ -5000'); if (m.ominaB) a.push('การ์ดของคู่ต่อสู้ที่มีไอคอนทริกเกอร์เดียวกับการ์ดในไบนด์โซนของคุณ ชีลด์ -5000 และเพิ่มพลังด้วยเอฟเฟกต์ทริกเกอร์นั้นไม่ได้'); if (m.personaPlus) a.push('เมื่อคุณเพอร์โซน่าไรด์ จั่ว 2 ใบแทน 1 ใบ และพลัง +15000 แทน +10000'); if (m.backAtkV3) a.push('โจมตีแวนการ์ดเกรด 3 ขึ้นไปจากแถวหลังได้'); if (m.atkVGplusG2) a.push('เมื่อโจมตีแวนการ์ด จะสู้กับเรียร์การ์ดเกรด 2 ขึ้นไปของคู่ต่อสู้ทั้งหมดด้วย');

  if (m.noBoosted) a.push('ไม่รับการบูสต์');
 if (m.atkFrontRG) a.push('เมื่อโจมตีเรียร์การ์ด จะสู้กับเรียร์การ์ดแถวหน้าของคู่ต่อสู้ทั้งหมด');

  if (m.noAuto) a.push('เสีย AUTO ทั้งหมด');


 if (m.noDriveDown) a.push('ไดรฟ์ไม่ลดลงด้วยเอฟเฟกต์ของตัวเอง'); if (m.frozen) a.push('สแตนด์ไม่ได้'); if (m.stayRC) a.push('ไม่ถูกนำออกจาก RC ด้วยเอฟเฟกต์การ์ดของคู่ต่อสู้');

  if (m.atkCol) a.push('เมื่อโจมตี จะสู้กับยูนิทของคู่ต่อสู้ทั้งคอลัมน์');
 if (m.g0guard) a.push('คู่ต่อสู้คอลการ์ดเกรด 1 ขึ้นไปจากมือลง GC ไม่ได้ในแบทเทิลที่ยูนิทนี้โจมตี'); if (m.noCont) a.push('เสีย CONT ดั้งเดิม');
  if (m.noStand) a.push('สแตนด์ในสแตนด์เฟสไม่ได้');
 if (m.noMove) a.push('ย้ายไป RC อื่นไม่ได้'); if (m.hitUnlessSh) a.push('การโจมตีโดนโดยไม่สนพลัง ถ้าชีลด์รวมของการ์ดป้องกันคู่ต่อสู้ไม่ถึง ' + m.hitUnlessSh); if (m.hitUnlessGr) a.push('การโจมตีโดนโดยไม่สนพลัง ถ้าเกรดรวมของการ์ดป้องกันคู่ต่อสู้ไม่ถึง ' + m.hitUnlessGr); if (m.icptMute) a.push('ในเทิร์นของคุณ อินเตอร์เซปต์ของคู่ต่อสู้ไม่ทำให้สกิล AUTO ทำงาน และยูนิทคู่ต่อสู้ที่ย้ายจาก RC ไป GC เสียสกิล CONT และ AUTO ทั้งหมด'); if (m.optStand) a.push('ในสแตนด์เฟสของคุณ เลือกไม่สแตนด์ยูนิทนี้ได้'); if (m.trigPw2) a.push('พลังที่ได้จากทริกเกอร์ของคุณเพิ่มเป็นสองเท่า'); if (m.rowMove) a.push('ในเมนเฟส ย้าย/สลับภายในแถวเดียวกันได้ด้วย'); if (m.atkBack) a.push('โจมตียูนิทแถวหลังของคู่ต่อสู้ได้'); if (m.atkAllFront) a.push('เมื่อโจมตี จะสู้กับยูนิทแถวหน้าของคู่ต่อสู้ทั้งหมด'); if (m.rgDrive) a.push('ทำไดรฟ์เช็คในแบทเทิลที่ยูนิทนี้โจมตี');
  if (m.noRet) a.push('ไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ด'); if (m.noRetOwn) a.push('ไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ดของคุณ'); if (m.cantGuardTrig) a.push('คู่ต่อสู้คอลทริกเกอร์ยูนิทลง GC ไม่ได้'); if (m.restand) a.push('กลับมาสแตนด์ตอนจบแบทเทิลที่โจมตี (1 ครั้ง)');

  return a.join(' / ');
}
const TG_TH = { gc: 'การ์เดี้ยนของคุณทั้งหมด', ogc: 'การ์เดี้ยนของคู่ต่อสู้ทั้งหมด', oall: 'ยูนิทของคู่ต่อสู้ทั้งหมด', orgs: 'เรียร์การ์ดของคู่ต่อสู้ทั้งหมด', ofront: 'ยูนิทแถวหน้าของคู่ต่อสู้ทั้งหมด', ovgs: 'แวนการ์ดคู่ต่อสู้', evt: 'ยูนิทใบนั้น', me: 'ยูนิทนี้',
 it: 'ยูนิทที่เลือก', 'it+me': 'ยูนิทที่เลือกและยูนิทนี้', all: 'ยูนิทของคุณทั้งหมด', front: 'ยูนิทแถวหน้าของคุณทั้งหมด', rgs: 'เรียร์การ์ดของคุณทั้งหมด', vgs: 'แวนการ์ดของคุณ', backrg: 'เรียร์การ์ดแถวหลังของคุณทั้งหมด', frontrg: 'เรียร์การ์ดแถวหน้าของคุณทั้งหมด', others: 'ยูนิทอื่นของคุณทั้งหมด', otherrg: 'เรียร์การ์ดอื่นของคุณทั้งหมด', col: 'ยูนิทของคุณในคอลัมน์เดียวกับยูนิทนี้', colo: 'ยูนิทอื่นของคุณในคอลัมน์เดียวกับยูนิทนี้', boosted: 'ยูนิทที่ถูกบูสต์', attacker: 'ยูนิทที่โจมตี', tgt: 'ยูนิทของคุณที่ถูกโจมตี', smu: 'ยูนิทที่ใช้ท่าพิเศษนี้', otgt: 'ยูนิทของคู่ต่อสู้ที่ถูกโจมตี' };
const KTH = { u: 'ยูนิท', v: 'แวนการ์ด', r: 'เรียร์การ์ด', g: 'การ์เดี้ยน', lk: 'การ์ดที่ถูกล็อก' };

function thT(t) { if (t && typeof t === 'object') return KTH[t.k] + (t.s === 'o' ? 'ของคู่ต่อสู้' : 'ของคุณ') + thFtail(t.f) + 'ทั้งหมด'; return TG_TH[t] || ''; }
const TLK = { rev: 'ถูกเปิดเผย', cc: 'เคาน์เตอร์ชาร์จ', sc: 'โซลชาร์จ', place: 'ถูกวางบน RC', ret: 'ถูกรีไทร์', mv: 'การ์ดถูกย้าย', ab: 'ใช้สกิล', atk: 'โจมตี', hit: 'โจมตีโดน', chk: 'เช็คเปิดการ์ด', ord: 'เพลย์ออเดอร์', cost: 'จ่ายคอสต์', stand: 'กลับมาสแตนด์' };
function thTl(q) {
  if (q.th) return q.th;
  const who = q.s === 'o' ? 'ของคู่ต่อสู้' : q.s === 'x' ? 'ของผู้เล่นคนใดก็ตาม' : 'ของคุณ'; const k = q.k || 'mv'; const z = x => [].concat(x).map(y => ZONE_TH[y] || y).join('/');
  let t;
  if (k === 'mv') t = (q.f ? thF(q.f, 0).trim() : 'การ์ด') + who + (q.me ? ' (ใบนี้)' : '') + 'ถูกนำ' + (q.from ? 'จาก' + z(q.from) : '') + (q.to || q.wanted ? 'ไป' + z(q.to || q.wanted) : '') + (q.reason ? ' (' + [].concat(q.reason).join('/') + ')' : '');
  else if (k === 'cost') t = 'คุณจ่าย ' + { cb: 'เคาน์เตอร์บลาสต์', sb: 'โซลบลาสต์', eb: 'เอเนอร์จีบลาสต์' }[q.kind] + (q.n ? ' ' + q.n + ' ขึ้นไปพร้อมกัน' : '') + 'เป็นคอสต์';
  else if (k === 'chk') t = 'เช็ค' + who + 'เปิดได้' + (q.trig === 1 ? 'ทริกเกอร์' : q.trig === 0 ? 'การ์ดที่ไม่ใช่ทริกเกอร์' : q.trig ? [].concat(q.trig).map(x => VG.TRIG_TH[x]).join('/') : 'การ์ด') + (q.kind ? ' (' + (q.kind === 'drive' ? 'ไดรฟ์เช็ค' : 'ดาเมจเช็ค') + ')' : '');
  else if (k === 'atk' || k === 'hit') t = (q.f ? thF(q.f, 0).trim() : q.az === 'VC' ? 'แวนการ์ด' : q.az === 'RC' ? 'เรียร์การ์ด' : 'ยูนิท') + who + (q.me ? ' (ใบนี้)' : '') + TLK[k] + (q.tz === 'VC' ? 'แวนการ์ด' : q.tz === 'RC' ? 'เรียร์การ์ด' : '');
  else if (k === 'ab') t = 'มีการใช้สกิล' + (q.divine ? ' Divine Skill' : '') + (q.type === 'act' ? ' ACT' : '') + (q.f ? 'ของ' + thF(q.f, 0).trim() : '') + who + (q.me ? ' (ใบนี้)' : '');
  else t = (q.f ? thF(q.f, 0).trim() : '') + who + TLK[k];
  const by = q.by ? ({ a: ' ด้วยสกิลการ์ดของคุณ', v: ' ด้วยสกิลแวนการ์ดของคุณ', c: ' เป็นคอสต์ของสกิลคุณ', o: ' ด้วยสกิลการ์ดของคู่ต่อสู้', x: ' ด้วยสกิลการ์ด', n: ' โดยไม่ใช่สกิลการ์ด', me: ' ด้วยสกิลของการ์ดนี้', sn: ' ด้วยสกิลของการ์ดชื่อเดียวกับการ์ดนี้' }[q.by] || '') + (q.byf ? ' (' + thFtail(q.byf).trim() + ')' : '') : '';
  return t + by + (q.fight ? 'ในไฟท์นี้' : 'ในเทิร์นนี้');
}
const UW = { smu: 'ยูนิทที่ใช้ท่าพิเศษนี้', me: 'ยูนิทนี้', it: 'ใบที่เลือก', vg: 'แวนการ์ดของคุณ', ovg: 'แวนการ์ดคู่ต่อสู้', atk: 'ยูนิทที่โจมตี', tgt: 'ยูนิทที่ถูกโจมตี', bst: 'ยูนิทที่บูสต์', evt: 'การ์ดใบนั้น', by: 'การ์ดเจ้าของสกิลนั้น' };
/* a number in a description: plain, or "the number of …" */
function thN(x) { return Array.isArray(x) ? 'เท่ากับ' + thNum(x) : String(x); }
function thNum(c) {
  switch (c[0]) {
    case 'n': return String(c[1]); case 'it': return 'จำนวนใบที่เลือก' + (c[1] ? ' (' + thF(c[1], 0).trim() + ')' : ''); case 'var': return 'จำนวนที่นับไว้';
    case 'tl': return 'จำนวนครั้งที่' + thTl(c[1]);
    case 'add': return thNum(c[1]) + ' บวก ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]); case 'sub': return thNum(c[1]) + ' ลบ ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]); case 'mul': return thNum(c[1]) + ' คูณ ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]);
    case 'min': return thNum(c[1]) + ' (สูงสุด ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]) + ')'; case 'max': return thNum(c[1]) + ' (อย่างน้อย ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]) + ')';
    case 'dr': return 'ไดรฟ์ของ' + UW[c[1]]; case 'ev': return ({ batch: 'จำนวนการ์ดที่คอลลง GC พร้อมกัน', over: 'จำนวนยูนิทที่ถูกคอลทับ' }[c[1]] || c[1]); case 'atkn': return 'จำนวนครั้งที่' + UW[c[1]] + 'โจมตีในเทิร์นนี้'; case 'psh': return 'ชิลด์ตั้งต้นของ' + (c[1] === 'it' ? 'การ์ดใบนั้น' : UW[c[1]]);
    case 'pw': return 'พลังของ' + UW[c[1]]; case 'cr': return 'คริติคอลของ' + UW[c[1]]; case 'gr': return 'เกรดของ' + UW[c[1]]; case 'ppw': return 'พลังตั้งต้นของ' + UW[c[1]];
    case 'mkcn': return c[1] + ' marker' + (c[2] ? ' ของคุณ' : '') + 'ในคอลัมน์เดียวกับ' + (c[3] === 'it' ? 'ยูนิทนั้น' : 'ยูนิทนี้');
    case 'colpw': return 'พลังรวมของเรียร์การ์ด' + thF(c[1] || {}, 0).trim() + 'อื่นในคอลัมน์เดียวกับยูนิทนั้น';
    case 'chby': return 'จำนวนครั้งที่ยูนิทของคุณถูกเลือกในเทิร์นนี้ด้วยสกิลของ' + thF(c[1] || {}, 0).trim() + (c[2] === 'order' ? 'ในออเดอร์โซน' : '');
    case 'ofdv': return 'จำนวนการ์ดในออเดอร์โซนที่ถูกคว่ำหน้าในเทิร์นนี้ด้วยสกิลแวนการ์ด' + (c[1] ? 'ที่มีชื่อ "' + c[1] + '"' : '') + 'ของคุณ';
    case 'jailn': return 'การ์ดของคู่ต่อสู้ที่ถูกขังในพริซันของคุณ';
    case 'gz': return gkTh(c[1]) + 'ของคุณ' + (c[2] ? thFtail(c[2]) : ''); case 'gzme': return 'เกจของการ์ดนี้'; case 'memd': return 'จำนวน <Quintuplet> ชื่อต่างกันในเมมโมรี่'; case 'memn': return 'จำนวน <Quintuplet> ในเมมโมรี่'; case 'gzu': return 'จำนวนการ์ดหงายใน G โซน' + (c[1] === 'o' ? 'ของคู่ต่อสู้' : 'ของคุณ'); case 'gzit': return 'เกจของยูนิทนั้น'; case 'gztr': return 'ชนิดทริกเกอร์ที่ต่างกันในเกจของเซ็ตออเดอร์ "' + jn(c[1]) + '" ของคุณ';
    case 'itsn': return 'การ์ดชื่อเดียวกับใบที่เลือกใน' + [].concat(c[1]).map(zth).join('/'); case 'odn': return 'originalDress ของยูนิทนี้'; case 'odpw': return 'พลังดั้งเดิมรวมของ originalDress ของยูนิทนี้'; case 'lockn': return 'การ์ดที่ถูกล็อก' + (c[1] === 'm' ? 'ของคุณ' : c[1] === 'o' ? 'ของคู่ต่อสู้' : 'ของผู้เล่นทุกคน'); case 'energy': return 'เอเนอร์จีของคุณ'; case 'bno': return 'ลำดับแบทเทิลของเทิร์นนี้'; case 'formula': return 'Formula Count ของคุณ'; case 'turn': return 'ลำดับเทิร์น'; case 'open': return 'จำนวน RC ที่ว่างของคุณ'; case 'ff': case 'tf': return 'จำนวนครั้งที่นับไว้ (' + c[1] + ')';
    case 'zd': return 'จำนวน' + (c[2] === 'g' ? 'เกรด' : 'ชื่อ') + 'ที่ต่างกันของ' + thF(c[3], 0).trim() + 'ใน' + [].concat(c[1]).map(zth).join('/');
    case 'zs': return 'จำนวน' + thF(c[2], 0).trim() + 'ใน' + [].concat(c[1]).map(zth).join('/');
    case 'ozf': return 'จำนวน' + thF(c[2], 0).trim() + 'ใน' + ZONE_TH[c[1]] + 'ของคู่ต่อสู้';
  }
  return 'จำนวน' + thCount(c).replace(/ 1 (ใบ|อัน|ช่อง|ระดับ)/, '').replace(/^การ์ดใน/, 'การ์ดใน');
}
const zth = z => (z === 'it' ? 'ใบที่เลือก' : z[0] === '$' ? 'ใบที่จำไว้' : z.startsWith('o:') ? (ZONE_TH[z.slice(2)] || z.slice(2)) + 'ของคู่ต่อสู้' : z === 'rc' ? 'RC' : z === 'gc' ? 'GC' : ZONE_TH[z] || z);
function thCount(c) {
  switch (c[0]) {
    case 'zg': return 'ผลรวมเกรดของ' + thF(c[2], 0).trim() + 'ใน' + [].concat(c[1]).map(zth).join('/') + ' 1 หน่วย';
    case 'fm': return 'แฟชั่นเมจิกการ์ดในออเดอร์โซนที่ตรงกับการ์ดนี้ (ชื่อไม่ซ้ำ) 1 ใบ';
    case 'ztr': return 'ชนิดของทริกเกอร์ไอคอนใน' + [].concat(c[1]).map(zth).join('/') + ' 1 ชนิด';
    case 'pdpw': return 'พลังตั้งต้นของการ์ดที่ใช้จ่ายคอสต์ 1 หน่วย';
    case 'pdg': return 'ผลรวมเกรดของการ์ดที่ใช้จ่ายคอสต์ 1 หน่วย'; case 'itg': return 'ผลรวมเกรดของใบที่เลือก 1 หน่วย';
    case 'pd': return 'การ์ด 1 ใบที่ใช้จ่ายคอสต์นี้'; case 'looked': return 'ใบที่เหลือจากที่ดู 1 ใบ'; case 'rest': return 'ใบที่เหลือ 1 ใบ';
    case 'n': case 'it': case 'var': case 'tl': case 'add': case 'sub': case 'mul': case 'min': case 'max': case 'pw': case 'cr': case 'dr': case 'ev': case 'atkn': case 'psh': case 'gr': case 'ppw': case 'energy': case 'bno': case 'turn': case 'open': case 'ff': case 'tf': case 'zd': case 'zs': case 'ozf': return thNum(c) + ' 1 หน่วย';
    case 'u': return (c[2] === 'r' ? 'เรียร์การ์ด' : 'ยูนิท') + (c[1] === 'o' ? 'ของคู่ต่อสู้' : 'ของคุณ') + thFtail(c[3]) + ' 1 ใบ';
    case 'z': return 'การ์ด 1 ใบใน' + ZONE_TH[c[1]]; case 'oz': return 'การ์ด 1 ใบใน' + ZONE_TH[c[1]] + 'ของคู่ต่อสู้';
    case 'dmgUp': return 'ดาเมจหงาย 1 ใบ'; case 'zf': return thF(c[2], 0).trim() + ' 1 ใบใน' + ZONE_TH[c[1]];
    case 'grade': return 'เกรด 1 ระดับของ' + (c[1] === 'atk' ? 'ยูนิทที่โจมตี' : c[1] === 'ovg' ? 'แวนการ์ดคู่ต่อสู้' : c[1] === 'it' ? 'ยูนิทที่เลือก' : 'แวนการ์ดของคุณ');
    case 'div': return 'ทุก ๆ ' + c[2] + ' หน่วยของ (' + thCount(c[1]) + ')';
    case 'odc': return 'originalDress ของยูนิทนี้ 1 ใบ';
    case 'mkn': return c[2] === 'rc' ? 'RC ของคุณ 1 ช่องที่มี ' + c[1] + ' marker' : c[1] + ' marker ' + (c[2] === 'mine' ? 'ของคุณ' : 'บน RC ของคุณ') + ' 1 อัน';
    case 'oopen': return 'RC ที่ว่างของคู่ต่อสู้ 1 ช่อง'; case 'paid': return 'การ์ด 1 ใบที่ใช้ไป';
  }
  return '';
}
function thC(c) {
  const op = (o, n, unit) => (o === '>=' ? n + ' ' + unit + 'ขึ้นไป' : o === '<=' ? (n === 0 ? '0 ' + unit : 'ไม่เกิน ' + n + ' ' + unit) : n + ' ' + unit + 'พอดี');
  switch (c[0]) {
    case 'and': return thC(c[1]) + ' และ' + thC(c[2]); case 'or': return thC(c[1]) + ' หรือ' + thC(c[2]); case 'not': return 'ไม่ใช่กรณีที่' + thC(c[1]);
    case 'placedByF': return 'ยูนิทนี้ถูกวางด้วยสกิลของ' + thF(c[1], 0).trim() + 'ของคุณ';
    case 'tgMe': return 'ยูนิทนี้ถูกโจมตีอยู่'; case 'atkSameCol': return 'ยูนิทที่โจมตีอยู่คอลัมน์เดียวกับยูนิทนี้'; case 'bstBy': return 'ยูนิทนี้ถูกบูสต์โดย' + thF(c[1], 0).trim();
    case 'playedFrom': return 'การ์ดนี้ถูกเพลย์จาก' + ZONE_TH[c[1]];
    case 'lastpos': return 'ยูนิทนี้เคยอยู่บนเซอร์เคิล ' + c.slice(1).join('/');
    case 'itDiffEx': return 'ใบเหล่านั้นที่ไม่ใช่ "' + c[1] + '" ชื่อต่างกันทั้งหมด';
    case 'itDg': return 'ใบเหล่านั้นเกรดต่างกันทั้งหมด';
    case 'pdIs': return 'การ์ดที่ใช้จ่ายคอสต์เป็น' + thF(c[2], 0).trim();
    case 'sameIn': return [].concat(c[1]).map(zth).join('/') + 'มีการ์ดชื่อเดียวกับใบที่เลือก'; case 'itSame': return 'ใบที่เลือกชื่อเดียวกันทั้งหมด'; case 'itDiff': return 'ใบที่เลือกชื่อต่างกันทั้งหมด';
    case 'cmp': return thNum(c[1]) + ' ' + (c[2] === '>=' ? 'ตั้งแต่ ' : c[2] === '<=' ? 'ไม่เกิน ' : 'เท่ากับ ') + (Array.isArray(c[3]) ? thNum(c[3]) : c[3]);
    case 'gt': return thNum(c[1]) + ' มากกว่า ' + (Array.isArray(c[2]) ? thNum(c[2]) : c[2]);
    case 'tlq': return thTl(c[1]) + (c[3] != null && !(c[2] === '>=' && c[3] === 1) ? (c[2] === '<=' && c[3] === 0 ? ' (ไม่มีเลย)' : ' ' + op(c[2] || '>=', c[3], 'ครั้ง')) : '');
    case 'v': return 'เข้าเงื่อนไขที่จดไว้'; case 'uis': return UW[c[1]] + 'เป็น' + thF(c[2], 0).trim(); case 'ff': return 'ในไฟท์นี้เคยทำแล้ว (' + c[1] + ')';
    case 'itn': return 'เลือกได้ ' + op(c[1], c[2], 'ใบ'); case 'stn': return UW[c[2] || 'me'] + 'อยู่ในสถานะ ' + c[1]; case 'pos': return 'ยูนิทนี้อยู่บนเซอร์เคิล ' + c.slice(1).join('/');
    case 'evf': return 'การ์ดใบนั้นเป็น' + thF(c[1], 0).trim(); case 'first': return 'คุณเล่นก่อน'; case 'turnN': return 'เป็นเทิร์นที่ ' + op(c[1], c[2], '');
    case 'critUp': return 'คริติคอลของ' + UW[c[1] || 'me'] + 'ถูกเพิ่มด้วยสกิลในเทิร์นนี้ (ไม่นับทริกเกอร์)';
    case 'battle': return 'อยู่ระหว่างแบทเทิล'; case 'rested': return UW[c[1] || 'me'] + 'อยู่ในสภาพเรสต์';
    case 'nbtl': return 'ยูนิท' + thFtail(c[1].f || {}) + 'ของคุณไม่ได้ถูกนำเข้าเด็คในแบทเทิลนี้'; case 'dvcr': return 'คริติคอลของแวนการ์ด' + thFtail(c[1] || {}) + 'ของคุณถูกเพิ่มด้วยสกิล Divine Skill ในเทิร์นนี้'; case 'nsnret': return 'ยูนิทอื่นชื่อเดียวกับการ์ดนี้ของคุณไม่ได้ถูกรีไทร์ในเทิร์นนี้';
    case 'tgIs': return 'ยูนิทที่ถูกโจมตีเป็น' + thTg(c[1]).trim(); case 'atkF': return 'ยูนิทที่โจมตีเป็น' + thF(c[1], 0).trim(); case 'energy': return 'เอเนอร์จีของคุณมี ' + op(c[1], c[2], '');
    case 'true': return 'คุณมีแวนการ์ด'; case 'did': return 'ทำเช่นนั้น'; case 'got': return 'ทำสำเร็จอย่างน้อย 1 ใบ'; case 'none': return 'ไม่ได้ทำ';
    case 'vg': { const f = c[1]; return 'แวนการ์ดของคุณ' + (f.nm ? 'เป็น "' + jn(f.nm) + '"' + (f.nm2 ? ' หรือ "' + jn(f.nm2) + '"' : '') : '') + (f.nh ? 'มีชื่อ "' + f.nh + '"' + (f.nh2 ? ' หรือ "' + f.nh2 + '"' : '') : '') + (f.rc ? 'เป็น <' + f.rc + '>' : '') + (f.gmin ? ' เกรด ' + f.gmin + ' ขึ้นไป' : '') + (f.gmax != null ? ' เกรด ' + f.gmax + ' หรือต่ำกว่า' : '') + (vgX(f) ? ' (' + thF(vgX(f), 0).trim() + ')' : ''); }
    case 'ovg': return 'แวนการ์ดคู่ต่อสู้เกรด ' + c[1] + ' ขึ้นไป';
    case 'vgLt': return 'เกรดแวนการ์ดของคุณต่ำกว่าคู่ต่อสู้'; case 'vgLe': return 'เกรดแวนการ์ดของคุณไม่เกินคู่ต่อสู้';
    case 'mkc': return 'มี ' + c[1] + ' marker ' + (c[4] === 'mine' ? 'ของคุณ' : 'บน RC ของคุณ') + ' ' + c[3] + (c[2] === '>=' ? ' อันขึ้นไป' : ' อันหรือน้อยกว่า');
    case 'mkon': return 'ยูนิทนี้อยู่บน RC ที่มี ' + (c[1] || '') + ' marker' + (c[2] ? ' ของคุณ' : ''); case 'mkcol': return 'มี ' + c[1] + ' marker' + (c[2] ? ' ของคุณ' : '') + ' ในคอลัมน์เดียวกับยูนิทนี้'; case 'mkopp': return 'RC ของคู่ต่อสู้มี ' + c[1] + ' marker ของคุณ';
    case 'chosen': return 'ยูนิทนี้ถูกเลือกด้วยสกิลของ' + thBy(c[1]) + 'ในเทิร์นนี้';
    case 'nopst': return 'คุณยังไม่ได้รับ Persona Shield ทิกเก็ตขึ้นมือในเทิร์นนี้';
    case 'ods': return 'ยูนิทนี้อยู่ในสถานะ ' + (c[1] === 'x' ? 'X-overDress' : 'overDress'); case 'evod': return 'วางด้วย overDress';
    case 'overIs': return 'ยูนิทนี้ถูกคอลทับ' + thF(c[1], 0).trim();
    case 'evcol': return 'การ์ดนั้นอยู่ในคอลัมน์เดียวกับยูนิทนี้';
    case 'evmk': return 'ยูนิทนั้นอยู่บน RC ที่มี ' + c[1] + ' marker' + (c[2] ? ' ของคุณ' : ''); case 'itOpp': return 'ยูนิทนั้นเป็นของคู่ต่อสู้'; case 'mklast': return 'RC ที่ยูนิทนี้อยู่มี ' + c[1] + ' marker' + (c[2] ? ' ของคุณ' : ''); case 'mkoc': return 'RC อีกช่องในคอลัมน์เดียวกับยูนิทนี้มี ' + c[1] + ' marker' + (c[2] ? ' ของคุณ' : '');
    case 'noG': return 'G โซนของคุณไม่มีการ์ด';
    case 'gb': return '[Generation Break ' + c[1] + '] (G ยูนิทหงายใน G โซน + บน VC ' + c[1] + ' ใบขึ้นไป)'; case 'gzhas': return 'G โซนของ' + (c[1] === 'o' ? 'คู่ต่อสู้' : 'คุณ') + 'มีการ์ด' + (c[2] ? 'หงายหน้า ' : ' ') + (c[3] || 1) + ' ใบขึ้นไป'; case 'heartIs': return 'ฮาร์ทของคุณเป็น' + thF(c[1] || {}, 0).trim();
    case 'osd': return 'แวนการ์ดของคุณ Over Soul ในเทิร์นนี้'; case 'alcd': return 'คุณ Alchemagic ในเทิร์นนี้แล้ว'; case 'alcing': return 'นี่เป็นส่วนหนึ่งของ Alchemagic';
    case 'oz': return 'ออเดอร์โซนของคุณมี' + thF(c[1] || {}, 0).trim(); case 'bsh': return 'บัดดี้โซลของการ์ดนี้มี' + thF(c[1] || {}, 0).trim();
    case 'armw': return 'แวนการ์ดของคุณอาร์ม' + (c[1] && Object.keys(c[1]).length ? thF(c[1], 0).trim() : 'การ์ดอยู่'); case 'noimp': return 'ในไฟท์นี้คุณยังไม่ได้แก้ผลอิมแพคออเดอร์'; case 'fin': return 'คุณประกาศ Final Phase ในเทิร์นนี้แล้ว';
    case 'jail': return 'การ์ดของคู่ต่อสู้ถูกขังในพริซันของคุณ ' + op(c[1], c[2], 'ใบ'); case 'pfxOn': return 'คุณอยู่ภายใต้ผล "' + (PFX_TH[c[1]] || c[1]) + '"';
    case 'overTok': return 'ถูกวางบน RC ที่มี' + (c[1] === 1 ? 'โทเคนยูนิท' : c[1] + ' โทเคน') + 'อยู่';
    case 'gzIs': return 'การ์ดนี้เป็น' + gkTh(c[1]); case 'gzok': return 'คุณมี' + gkTh(c[1]) + 'ได้';
    case 'rfst': return 'ยูนิทที่ถูกไรด์ทับอยู่ในสถานะ ' + c[1]; case 'rfIs': return 'ยูนิทที่ถูกไรด์ทับเป็น' + thF(c[1], 0).trim();
    case 'evz': return 'การ์ดนั้น' + (c[1] === 'from' ? 'มาจาก' : 'ไปที่') + (ZONE_TH[c[2]] || c[2]);
    case 'evby': return 'สิ่งนี้เกิดขึ้น' + ({ v: 'ด้วยสกิลแวนการ์ดของคุณ', a: 'ด้วยสกิลการ์ดของคุณ', o: 'ด้วยสกิลการ์ดของคู่ต่อสู้', c: 'เป็นคอสต์ของสกิลคุณ', x: 'ด้วยสกิลการ์ด', me: 'ด้วยสกิลของการ์ดนี้เอง' }[c[1]] || '') + (c[2] ? ' (' + thFtail(c[2]).trim() + ')' : '');
    case 'wings': return c[1] === 'w' ?
 'White Wings (ไบนด์โซนของคุณมีแต่การ์ดเกรดคี่)' : 'Black Wings (ไบนด์โซนของคุณมีแต่การ์ดเกรดคู่)';
    case 'second': return 'คุณเล่นทีหลัง'; case 'persona': return 'คุณเพอร์โซน่าไรด์ในเทิร์นนี้'; case 'opersona': return 'คู่ต่อสู้เพอร์โซน่าไรด์ในเทิร์นนี้'; case 'noRide': return 'คุณยังไม่ได้ไรด์ในเทิร์นนี้';
    case 'ord': return 'คุณเพลย์' + ({ n: 'นอร์มอลออเดอร์', s: 'เซ็ตออเดอร์', b: 'บลิตซ์ออเดอร์' }[c[1]] || 'ออเดอร์') + 'ในเทิร์นนี้'; case 'noOrd': return 'คุณยังไม่ได้เพลย์ออเดอร์ในเทิร์นนี้';
    case 'cnt': return ZONE_TH[c[1]] + 'ของคุณมี ' + op(c[2], c[3], 'ใบ'); case 'ocnt': return ZONE_TH[c[1]] + 'ของคู่ต่อสู้มี ' + op(c[2], c[3], 'ใบ');
    case 'noCB': return 'ดาเมจโซนของคุณไม่มีใบหงาย';
    case 'units': return 'คุณมี' + (c[1] === 'r' ? 'เรียร์การ์ด' : 'ยูนิท') + thFtail(c[4]) + ' ' + op(c[2], c[3], 'ใบ');
    case 'orgs': return 'คู่ต่อสู้มีเรียร์การ์ด ' + op(c[1], c[2], 'ใบ');
    case 'ofront0': return 'แถวหน้าของคู่ต่อสู้ไม่มีเรียร์การ์ด'; case 'front0': return 'แถวหน้าของคุณไม่มีเรียร์การ์ด'; case 'back0': return 'แถวหลังของคุณไม่มีเรียร์การ์ด';
    case 'rgMore': return 'เรียร์การ์ดของคุณมากกว่าคู่ต่อสู้'; case 'noSame': return 'ไม่มีเรียร์การ์ดชื่อเดียวกันใบอื่น'; case 'noSameIt': return 'คุณไม่มีเรียร์การ์ดชื่อเดียวกับการ์ดใบนั้น'; case 'whereIs': return 'การ์ดใบนั้นมาจาก' + ZONE_TH[c[1]];
    case 'cntD': return ZONE_TH[c[1]] + 'ของคุณมีการ์ด' + (c[2] === 'g' ? 'ต่างเกรด' : 'ต่างชื่อ') + 'กัน ' + c[3] + ' ใบขึ้นไป'; case 'atkCritFx': return 'ยูนิทที่โจมตีมีคริติคอล ' + c[1] + ' ขึ้นไป (จากสกิลที่ไม่ใช่ทริกเกอร์ หรือคริติคอลดั้งเดิม)';
    case 'boosted': return 'ยูนิทนี้ถูกบูสต์'; case 'row': return 'ยูนิทนี้อยู่แถว' + (c[1] === 'f' ? 'หน้า' : 'หลัง'); case 'placedNow': return 'ยูนิทนี้ถูกวางในเทิร์นนี้';
    case 'bno': return 'เป็นแบทเทิลครั้งที่ ' + c[2] + (c[1] === '>=' ? ' ขึ้นไป' : '') + 'ของเทิร์นนี้';
    case 'atkVG': return 'โจมตีแวนการ์ด'; case 'didHit': return 'การโจมตีโดน'; case 'noHit': return 'การโจมตีไม่โดน'; case 'dleg': return 'แวนการ์ดของคุณอยู่ในสถานะ D-Legion'; case 'stw': return 'การ์ดนี้อยู่ในสถานะ ' + c[1] + ' ตอนออกจากสนาม'; case 'dlegd': return 'คุณ D-Legion ในเทิร์นนี้'; case 'candl': return 'D-Legion ได้'; case 'hitV': return 'การโจมตีนั้นโดนแวนการ์ด';
    case 'atk2': return 'ยูนิทที่โจมตีโจมตีมาแล้ว 2 ครั้งขึ้นไปในเทิร์นนี้'; case 'noGuard': return 'ไม่มีการ์ดถูกวางบน GC ในแบทเทิลนี้';
    case 'oretT': return 'เรียร์การ์ดคู่ต่อสู้ถูกรีไทร์ในเทิร์นนี้'; case 'otrigT': return 'คู่ต่อสู้เปิดได้ทริกเกอร์ในเทิร์นนี้';
    case 'phase': return 'อยู่ใน' + { m: 'เมนเฟส', b: 'แบทเทิลเฟส', r: 'ไรด์เฟส', s: 'สแตนด์เฟส', e: 'เอนด์เฟส', d: 'ดรอว์เฟส' }[c[1]] + (c[2] === 'x' ? '' : 'ของคุณ'); case 'trigPw': return c[1] === 'me' ? 'พลังของยูนิทนี้ถูกเปลี่ยนด้วยทริกเกอร์ในเทิร์นนี้' : 'ยูนิทอื่นของคุณได้รับพลังจากทริกเกอร์ในเทิร์นนี้'; case 'my': return 'ในเทิร์นของคุณ'; case 'opp': return 'ในเทิร์นของคู่ต่อสู้';
    case 'attacking': return 'ระหว่างแบทเทิลที่ยูนิทนี้โจมตี'; case 'gfirst': return 'เป็นการ์เดี้ยนที่วางเป็นอันดับแรกในแบทเทิลนี้'; case 'boosting': return 'ระหว่างแบทเทิลที่ยูนิทนี้บูสต์'; case 'bstIs': return 'ยูนิทที่ถูกบูสต์เป็น' + thF(c[1], 1);
    case 'has': return ZONE_TH[c[1]] + 'ของคุณมี' + thF(c[3], 0).trim() + ' ' + c[2] + ' ใบขึ้นไป';
    case 'crest': return 'คุณมีเครสต์ "' + c[1] + '"';
    case 'in': return 'คุณอยู่ในสถานะ "' + c[1] + '"'; case 'world': return 'เวิลด์ของคุณเป็น ' + { d: 'Dark Night', a: 'Abyssal Dark Night', da: 'Dark Night หรือ Abyssal Dark Night', s: 'Stray Garden' }[c[1]];
    case 'tl': if (c[1] === 'cc' || c[1] === 'sc') return 'คุณ' + (c[1] === 'cc' ? 'เคาน์เตอร์ชาร์จ' : 'โซลชาร์จ') + 'ในเทิร์นนี้แล้ว';
      return (c[1] === 'ret' ? 'เรียร์การ์ด' + (c[2] === 'o' ? 'ของคู่ต่อสู้' : 'ของคุณ') + 'ถูกรีไทร์' : 'ยูนิทของคุณถูกวางบน RC' + (c[4] ? ' จาก' + ZONE_TH[c[4]] : '')) + (c[3] === 'v' ? ' ด้วยสกิลแวนการ์ดของคุณ' : c[3] ? ' ด้วยสกิลการ์ดของคุณ' : '') + 'ในเทิร์นนี้';
    case 'placedBy': return 'ถูกวางด้วยสกิล' + (c[1] === 'v' ? 'แวนการ์ด' : 'การ์ด') + 'ของคุณ'; case 'placedFrom': return 'ยูนิทนี้ถูกวางจาก' + ZONE_TH[c[1]];
    case 'uq': { const who = c[1] === 'o' ? 'คู่ต่อสู้' : 'คุณ'; const what = KTH[c[2]] + thFtail(c[5]); if (c[3] === '>=' && c[4] === 1) return who + 'มี' + what; if (c[3] === '<=' && c[4] === 0) return who + 'ไม่มี' + what; return who + 'มี' + what + ' ' + op(c[3], c[4], 'ใบ'); }
    case 'allSt': return KTH[c[1]] + 'ของคุณ' + thFtail(c[2]) + 'ทั้งหมดอยู่ในสภาพ' + (c[3] === 'r' ? 'เรสต์' : 'สแตนด์');
    case 'drew': return 'จั่วได้'; case 'itIs': return 'ใบนั้นเป็น' + thF(c[1], 0).trim(); case 'putTo': return 'นำไปไว้ที่' + ZONE_TH[c[1]];
    case 'ordN': return 'คุณเพลย์ออเดอร์ ' + op(c[1], c[2], 'ใบ') + 'ในเทิร์นนี้';
    case 'dmgDown': return 'ดาเมจโซนมีใบคว่ำ ' + op(c[1], c[2], 'ใบ'); case 'dmgUpN': return 'ดาเมจโซนมีใบหงาย ' + op(c[1], c[2], 'ใบ');
    case 'unlT': return 'ยูนิทนี้ถูกปลดล็อกในเทิร์นนี้'; case 'unlPrev': return 'ยูนิทนี้ถูกปลดล็อกในเทิร์นก่อนหน้า';
    case 'zone': return 'ยูนิทนี้อยู่บน ' + c[1]; case 'stIs': return 'ยูนิทนี้อยู่ในสภาพ' + (c[1] === 'r' ? 'เรสต์' : 'สแตนด์');
    case 'atkIs': return 'ยูนิทที่โจมตีเป็น' + (c[1] === 'v' ? 'แวนการ์ด' : 'เรียร์การ์ด'); case 'atkBoosted': return 'ยูนิทที่โจมตีถูกบูสต์';
    case 'atkGrade': return 'ยูนิทที่โจมตีเกรด ' + op(c[1], c[2], ''); case 'atkPow': return 'พลังของยูนิทที่โจมตี ' + op(c[1], c[2], '');
    case 'tgGrade': return 'เป้าหมายเป็นเกรด ' + (c[1][1] >= 99 ? c[1][0] + ' ขึ้นไป' : c[1][0] === c[1][1] ? c[1][0] : c[1][1] + ' หรือต่ำกว่า');
  }
  return '?';
}
function thStep(s) {
  const tgt = t => (t === 'me' ? 'การ์ดนี้' : 'การ์ดที่เลือก');
  switch (s[0]) {
    case 'draw': return 'จั่ว ' + thN(s[1]) + ' ใบ'; case 'sc': return 'โซลชาร์จ ' + thN(s[1]); case 'cc': return 'เคาน์เตอร์ชาร์จ ' + thN(s[1]); case 'ec': return 'เอเนอร์จีชาร์จ ' + thN(s[1]); case 'shuf': return 'สับเด็ค';
    case 'set': return 'นับ' + thNum(s[2]); case 'keep': return 'จำใบที่เลือกไว้'; case 'use': return 'กลับมาที่ใบที่จำไว้'; case 'also': return 'รวมกับใบที่จำไว้';
    case 'itf': return 'เฉพาะใบที่เป็น' + thF(s[1], 0).trim(); case 'itg': return 'สำหรับ' + thT(s[1]); case 'itz': return 'สำหรับ' + thF(s[2], 0).trim() + 'ทั้งหมดใน' + s[1].map(zth).join('/'); case 'itu': return 'สำหรับ' + UW[s[1]];
    case 'col': return 'เลือกคอลัมน์ 1 คอลัมน์'; case 'itcol': return 'สำหรับ' + KTH[s[2]] + (s[1] === 'o' ? 'ของคู่ต่อสู้' : s[1] === 'x' ? 'ของทั้งสองฝ่าย' : 'ของคุณ') + thFtail(s[3]) + 'ทั้งหมดในคอลัมน์นั้น'; case 'gup': return 'ใบที่เลือกเกรด +' + (s[1] || 1) + ' จนจบเทิร์น';
    case 'minus': return 'ยกเว้นใบที่จำไว้'; case 'colswap': return 'เลือกคอลัมน์ของคุณ 1 คอลัมน์ สลับตำแหน่งเรียร์การ์ดหน้า-หลัง';
    case 'ordonly': return s[1] ? 'ในเทิร์นนี้คุณเพลย์ได้เฉพาะ' + thF(s[1], 0).trim() : 'ในเทิร์นนี้คุณเพลย์ออเดอร์ไม่ได้อีก';
    case 'pksum': return 'เลือก' + thF(s[3], 0).trim() + ' สูงสุด ' + s[2] + ' ใบ ชื่อไม่ซ้ำกัน ผลรวมเกรดไม่เกิน ' + thN(s[4]).replace(/^เท่ากับ/, '') + ' จาก' + s[1].map(zth).join('หรือ');
    case 'copyab': return 'ยูนิทนี้ได้รับสกิลทั้งหมดของการ์ดที่เลือก' + (s[1] === 'f' ? ' จนจบไฟท์' : ' จนจบเทิร์น'); case 'tgall': return 'การโจมตีนี้สู้กับยูนิท' + (s[1] === 'front' ? 'แถวหน้า' : '') + 'ทั้งหมดของคู่ต่อสู้'; case 'itev': return 'สำหรับการ์ดใบนั้น'; case 'note': return '(จดไว้ว่าใช้แล้ว)'; case 'bst': return 'ยูนิทนี้บูสต์ยูนิทที่กำลังโจมตี'; case 'retarget': return 'เปลี่ยนยูนิทที่ถูกโจมตีเป็นยูนิทที่เลือก'; case 'mboost': return 'ให้' + tgt(s[1]) + 'ทั้งหมดบูสต์ยูนิทนี้พร้อมกัน'; case 'itpd': return 'สำหรับการ์ดที่ใช้จ่ายคอสต์'; case 'sina': return 'ใช้ Sinastery ของ' + (s[1] === 'it' ? 'การ์ดใบนั้น' : 'ยูนิทนี้') + ' (จ่ายคอสต์ของมันก่อน)';
    case 'itgr': return 'เฉพาะใบที่เกรด' + (s[2] === 'ne' ? 'ไม่ใช่ ' : '') + thN(s[1]); case 'itnk': return s[2] === 'same' ? 'เฉพาะใบที่ชื่อเดียวกับใบที่จำไว้' : 'เฉพาะใบที่ชื่อต่างจากใบที่จำไว้'; case 'match': return s[1] === 'rev' ? 'พลังของยูนิทนี้เท่ากับใบที่เลือกจนจบเทิร์น' : 'พลังและคริติคอลของใบที่เลือกเท่ากับยูนิทนี้จนจบเทิร์น'; case 'mv': return 'ย้าย' + (s[1] === 'me' ? 'ยูนิทนี้' : 'ใบที่เลือก') + 'ไป RC อื่น' + (s[2] && s[2].row ? (s[2].row === 'f' ? 'แถวหน้า' : 'แถวหลัง') : '') + 'ที่ว่าง';
    case 'chpd': return 'สำหรับการ์ดแต่ละใบที่จ่ายคอสต์ เลือกเรียร์การ์ดชื่อเดียวกันได้ 1 ใบ'; case 'cbless': return 'เคาน์เตอร์บลาสต์ของสกิลใบนั้นลดลง ' + (s[1] || 1) + ' ในเทิร์นนี้'; case 'statto': return (s[1] === 'me' ? 'ยูนิทนี้' : 'ใบที่เลือก') + 'มี' + Object.entries(s[2]).map(([k, v]) => ({ power: 'พลัง', crit: 'คริติคอล', drive: 'ไดรฟ์', shield: 'ชิลด์' }[k] + 'เป็น ' + v)).join(' / ') + ' จนจบเทิร์น'; case 'xbattle': return 'คุณได้แบทเทิลเฟสเพิ่มอีก 1 ครั้งหลังแบทเทิลเฟสนี้';
    case 'swap': return s[1] === 'me' ? 'สลับตำแหน่งใบที่เลือกกับยูนิทนี้' : 'สลับตำแหน่งของ 2 ใบที่เลือก'; case 'actfree': return 'เลือก ACT ดั้งเดิมของใบนั้น 1 ข้อ ใช้โดยไม่จ่ายคอสต์';
    case 'declare': return 'ประกาศ 1 อย่าง (' + s[1].join(' / ') + ')';
    case 't1atk': return 'ยูนิทนี้โจมตีได้แม้เป็นเทิร์นแรก'; case 'playfrom': return 'ใบนั้นเพลย์จาก' + (ZONE_TH[s[1]] || 'ที่อยู่ตอนนี้') + 'ได้ในเทิร์นนี้' + (s[2] ? ' (เพลย์แล้ว' + { bottom: 'ไปไว้ล่างสุดของเด็ค', bind: 'ไปไบนด์' }[s[2]] + 'แทนลงดรอป)' : ''); case 'play': return 'เพลย์ใบที่เลือกโดยไม่จ่ายคอสต์'; case 'colit': return 'ดูคอลัมน์ของใบที่เลือก';
    case 'pkn': return 'เลือก' + thFn(s[4], s[2], s[3]) + 'ชื่อเดียวกันจาก' + s[1].map(zth).join('หรือ');
    case 'trset': return 'เลือก' + thF(s[2], 0).trim() + ' จากออเดอร์โซน จำนวนเท่ากับ' + thCount(s[3]) + ' จนจบเทิร์นถัดไปของคู่ต่อสู้ พลังที่เพิ่มจากทริกเกอร์ที่มีไอคอนเดียวกับเกจของการ์ดเหล่านั้นจากไดรฟ์เช็คหรือดาเมจเช็คของคุณกลายเป็น +' + s[1]; case 'dmgless': return 'จนจบเทิร์นถัดไปของคู่ต่อสู้ ดาเมจที่แวนการ์ดของคุณได้รับจากความสามารถของการ์ดลดลง ' + (s[1] || 1); case 'bsdrop': return 'นำบัดดี้โซลทั้งหมดของการ์ดนั้นลงดรอป'; case 'npm': return 'ในไฟต์นี้ คุณเพลย์ "' + (s[1] || 'การ์ดชื่อเดียวกับการ์ดนี้') + '" ในเมนเฟสของคุณไม่ได้'; case 'obindh': return 'คู่ต่อสู้เลือกการ์ดจากมือ 1 ใบ แล้วไบนด์แบบคว่ำหน้า'; case 'oreth': return 'คู่ต่อสู้นำการ์ดที่ถูกไบนด์ด้วยความสามารถของยูนิทนี้ขึ้นมือ'; case 'swaphm': return 'เลือกการ์ดจากมือ 1 ใบ และจาก Monster BOX 1 ใบ แล้วสลับที่กัน'; case 'pcf': return 'คุณและคู่ต่อสู้เปิดเผยการ์ด 3 ใบบนสุดของเด็คแล้ววางไว้ล่างสุด ถ้าเกรดรวมของคุณสูงกว่า คุณจั่ว 1 ใบ เท่ากัน ทั้งสองฝ่ายจั่ว 1 ใบ ต่ำกว่า คู่ต่อสู้จั่ว 1 ใบ'; case 'oallbot': return 'คู่ต่อสู้นำเรียร์การ์ดแถวหน้าทั้งหมดของตนไว้ล่างสุดของเด็คตามลำดับที่ต้องการ'; case 'osb1': return 'คู่ต่อสู้เลือกการ์ดจากโซลของตน 1 ใบลงดรอป'; case 'togc': return 'ย้ายยูนิทที่เลือกไปที่ GC'; case 'cset': return 'จนจบเทิร์น คอสต์ของสกิล ' + s[1].toUpperCase() + ' ดั้งเดิมของยูนิทนั้นกลายเป็น [' + s[2].map(k => mkCost(k).label).join(' + ') + ']'; case 'nofs': return 'ในไฟต์นี้ คุณจ่ายคอสต์ของสกิล FantômeSkill ของยูนิทชื่อเดียวกับการ์ดนี้ไม่ได้'; case 'markrb': return ''; case 'riderb': return 'ไรด์การ์ดที่ไบนด์เป็นคอสต์นั้นแบบเรสต์'; case 'gcas': return 'คอลการ์ดนั้นลง GC เป็นทริกเกอร์ยูนิทเกรด 0 ชิลด์ ' + (s[1] || 0) + (s[2] ? ' และจนจบแบทเทิลนั้น เมื่อจะถูกรีไทร์จาก GC ให้ไบนด์แทน' : ''); case 'mgc': return 'ย้ายการ์ดนี้ไปที่ GC'; case 'xtgt': return 'จนจบเทิร์น เมื่อยูนิทนี้โจมตีแวนการ์ด จะสู้กับแวนการ์ดและยูนิทบน RC ของใบที่เลือกด้วย'; case 'musto': return 'ตอนเอนด์เฟสของเทิร์นนั้น เมื่อมิวสิกนั้นจะลงดรอปจาก RC ให้นำเข้าโซลแทน'; case 'vgc4': return 'จนจบเทิร์น ถ้าเป็นแบทเทิลที่ 4 ของเทิร์น สกิล CONT ทั้งหมดของแวนการ์ดของคุณถูกยกเลิก'; case 'swapsg': return 'ถ้าเปิดเผยแล้ว เลือกยูนิทเกรดเดียวกันจาก Monster BOX แล้วสลับกับการ์ดนั้น'; case 'nooc': return 'ในไฟต์นี้ ใช้สกิล Overcharge ของการ์ดชื่อเดียวกับการ์ดนี้ไม่ได้'; case 'ngg': return 'ในแบทเทิลที่ยูนิทนี้โจมตีในเทิร์นนี้ คู่ต่อสู้คอลการ์ดเกรดเดียวกับยูนิทที่เลือกจากมือลง GC ไม่ได้'; case 'rtsg': return 'เลือกเรียร์การ์ดของคู่ต่อสู้ที่มีเกรดเท่ากับการ์ดที่คอลใบใดใบหนึ่ง แล้วรีไทร์'; case 'pwmatch': return 'เพิ่มหรือลดพลังของยูนิทที่เลือกให้เท่ากับพลังของยูนิทนี้จนจบเทิร์น'; case 'pw0': return 'จนจบเทิร์น เพิ่มหรือลดพลังของยูนิทแถวหน้าทั้งหมดของคู่ต่อสู้ให้เป็น 0'; case 'pkg1': return ''; case 'omvf': return 'คู่ต่อสู้เลือกเรียร์การ์ดแถวหลังของตน 1 ใบ แล้วย้ายไป RC แถวหน้าที่ว่าง'; case 'or2': return 'จนจบเทิร์น เมื่อทำเอฟเฟกต์ "เลือก 1 อย่าง" ของ "' + s[1] + '" ให้ทำ 2 อย่างแทน'; case 'less': return 'จนจบเทิร์น ' + (s[1].it ? 'การ์ดที่ใช้สกิลของยูนิทที่เลือก' : 'การ์ดที่' + (s[1].kind === 'rem' ? 'นำออกจากเกม' : 'ทิ้งจากมือ') + 'เป็นคอสต์ของ "' + s[1].nm + '"') + ' ลดลง ' + (s[1].n || 1) + ' ใบ' + (s[1].keep ? '' : ' (ครั้งถัดไป)'); case 'pkx': return 'จนจบเทิร์น เมื่อสกิลของ' + (s[1].it ? 'ยูนิทที่เลือก' : ' "' + s[1].nm + '"') + 'ต้องเลือกการ์ด 1 ใบจาก' + (s[1].zone === 'field' ? 'ยูนิท' : ZONE_TH[s[1].zone]) + ' ให้เลือกได้สูงสุด ' + s[1].to + ' ใบแทน'; case 'ncd': return 'จนจบเทิร์น คุณคอลการ์ดจากดรอปไม่ได้'; case 'asset': return 'การ์ดนั้นนับเป็นเซ็ตออเดอร์จนจบไฟต์นี้'; case 'malg': return 'ค้นหาทริกเกอร์การ์ดได้สูงสุด 1 ใบจากเด็ค มือ หรือดรอป วางแบบหงายเป็นเกจของการ์ดนั้น แล้วสับเด็ค' + ((s[1] || []).length ? ' ถ้านำมาจาก' + s[1].map(z => ZONE_TH[z]).join('หรือ') + ' จั่วการ์ด 1 ใบ' : ''); case 'alccb': return 'ในเทิร์นนี้ ครั้งถัดไปที่คุณ Alchemagic คอสต์ลดลง เคาน์เตอร์บลาสต์ ' + (s[1] || 1); case 'cbl': return 'จนจบเทิร์น เคาน์เตอร์บลาสต์' + (s[1].keep ? '' : 'ครั้งถัดไป') + 'ที่จ่าย' + (s[1].play ? 'เพื่อเพลย์' : 'เป็นคอสต์สกิลของ') + (s[1].nm ? ' "' + jn(s[1].nm) + '"' : s[1].nh ? 'การ์ดที่มีชื่อ "' + s[1].nh + '"' : s[1].rc ? ' <' + s[1].rc + '>' : 'การ์ด') + ' ลดลง ' + (s[1].n || 1);
    case 'otk': return 'วาง "' + jn(s[1]) + '" โทเคนในออเดอร์โซน';
    case 'rideonly': return 'จนจบไฟท์นี้ คุณไรด์การ์ด' + (s[1].gmin ? 'เกรด ' + s[1].gmin + ' ขึ้นไป' : '') + 'ที่ไม่มี "' + s[1].nh + '" ในชื่อไม่ได้'; case 'nocall': return 'จนจบเทิร์น คุณคอลการ์ด' + (s[1] === 'sn' ? 'ชื่อเดียวกับยูนิทนี้' : ' "' + jn(s[1]) + '"') + 'จากมือลง RC ไม่ได้'; case 'itrd': return 'สำหรับการ์ดที่ทิ้งตอนไรด์จากไรด์เด็คในเทิร์นนี้';
    case 'itgin': return 'เฉพาะใบที่เกรดตรงกับการ์ดที่เปิดได้'; case 'stx': return 'ยูนิทเหล่านั้นออกจากสถานะ ' + s[1];
    case 'od': return 'overDress ' + (s[1] === 'me' ? 'การ์ดนี้' : 'การ์ดใบนั้น') + 'ทับ' + thF(s[2], 1).trim() + 'บน RC ของคุณ (สแตนด์)';
    case 'win': return 'คุณชนะไฟท์นี้'; case 'regoff': return 'การ์ดนี้ไม่นับเป็น Regalis Piece ของไฟท์นี้'; case 'fus': return 'เลือกการ์ดบนเซอร์เคิลของคุณ 1 ใบ หงายหน้าแล้วสแตนด์';
    case 'asrf': return 'จนจบเทิร์น ยูนิทนี้นับเป็นการ์ดชื่อเดียวกับใบที่ถูกไรด์ทับด้วย'; case 'gcrest': return 'คุณได้รับเครสต์ "' + jn(s[1]) + '"';
    case 'unmoor': return 'ยูนิทเหล่านั้น Unmoor';
    case 'sing': return 'ร้องเพลงใบนั้น (สกิล "เมื่อเพลงนี้ถูกร้อง" ทำงาน แล้วคว่ำหน้าเพลง)'; case 'playn': return 'เพลย์ใบนั้น'; case 'musto': return 'ตอนจบเทิร์น มิวสิกใบนั้น' + (s[1] === 'soul' ? 'เข้าโซล' : 'ไปไบนด์') + 'แทนการลงดรอป'; case 'unlockall': return 'ปลดล็อกการ์ดที่ถูกล็อกของคุณทั้งหมด';
    case 'dom': { const o = s[1] || {}; return 'สแตนด์และ Dominate ยูนิทนั้น' + (o.m && o.m.power ? ' (พลัง +' + o.m.power + ' จนจบเทิร์น)' : '') + (o.m && o.m.driveSet ? ' (ไดรฟ์กลายเป็น ' + o.m.driveSet + ' และทำไดรฟ์เช็ค)' : '') + ' แล้วให้มันโจมตี' + (o.tgt === 'v' ? 'แวนการ์ด' : o.tgt === 'r' ? 'เรียร์การ์ด' : 'ยูนิทอื่น') + 'ของคู่ต่อสู้' + (o.ret ? ' แล้วรีไทร์มันเมื่อจบแบทเทิลนั้น' : ''); }
    case 'usesm': return 'เลือกท่าพิเศษที่คว่ำอยู่ เกรดไม่เกินแวนการ์ดของคุณ ที่ยูนิทนี้ใช้ได้ แล้วใช้มัน'; case 'trstart': return 'นำการ์ดนี้ไปออเดอร์โซน แล้วเลือกยูนิทที่ไม่มีชื่อ Kiwame จากไรด์เด็ค วางในออเดอร์โซนแบบหงาย ให้มันฝึก (Training)'; case 'kiwride': return 'ค้นเด็คหรือมือหาการ์ดที่มีทั้งชื่อของการ์ดที่ใช้เป็นคอสต์และชื่อ Kiwame แล้วไรด์แบบสแตนด์ ถ้าไรด์ได้ นำการ์ดนี้เข้าโซล แล้วรับเครสต์ Kiwame ตามสายอาวุธของแวนการ์ด'; case 'egon': return 'เลือกการ์ดที่มีสกิล Explosive Growth จาก' + ((s[1] || ['hand']).includes('drop') ? 'มือหรือดรอป' : 'มือ') + (s[2] ? ' สูงสุด 1 ใบ' : ' 1 ใบ') + ' แล้ว Explosive Growth ให้ยูนิทนั้นแบบสแตนด์'; case 'egsplit': return 'ทิ้ง growth factor ของยูนิทนี้ไว้ใน RC นี้แบบเรสต์ แล้วนำยูนิทนี้ขึ้นมือ'; case 'alcx': return 'เลือกเรียร์การ์ด' + thF(s[1] || {}, 0).trim() + 'ชื่อต่างกันกี่ใบก็ได้ ถ้าเลือก 2 ใบขึ้นไป เลือกโทเค็น Ubermensch บน RC แล้ว Alchemix ใบที่เลือกทั้งหมด (ซ้อนไว้ใต้โทเค็น)'; case 'tofront': return 'ถ้ายูนิทนี้อยู่แถวหลัง ย้ายไป RC แถวหน้าที่ว่างในคอลัมน์เดียวกันได้'; case 'fplus': return 'Formula Count ของคุณ +' + (s[1] || 1); case 'guessg': return 'คู่ต่อสู้เลือกการ์ดในมือ 1 ใบ คุณประกาศเกรด แล้วคู่ต่อสู้เปิดเผยการ์ดนั้น'; case 'vswap': return 'สลับตำแหน่งแวนการ์ดของคุณกับ' + (s[1] === 'me' ? 'ยูนิทนี้' : 'ยูนิทนั้น'); case 'dlegion': return '[D-Legion] กับ "' + [].concat(s[1]).join('" หรือ "') + '" (ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป ไฟท์ละครั้ง: นำการ์ด 4 ใบจากดรอปกลับเด็ค (ทริกเกอร์ยูนิทไม่เกิน 2 ใบ ห้ามฮีล/โอเวอร์) แล้วค้นเด็คหาการ์ดนั้นมาเป็นแวนการ์ดคู่)'; case 'ghand': return 'นำ God Hand ทิกเก็ตขึ้นมือ'; case 'nogg': return 'ในแบทเทิลนั้น คู่ต่อสู้คอลการ์ดเกรดเดียวกับใบนั้นจากมือลง GC ไม่ได้'; case 'smup': return 'เลือกท่าพิเศษชื่อเดียวกันที่คว่ำอยู่ แล้วหงายได้';
    case 'useatk': return 'ใช้ท่าของการ์ดนั้น'; case 'retgt': return s[1] === 'add' ? 'ยูนิทที่โจมตีสู้กับยูนิทนั้นด้วย' : 'เปลี่ยนยูนิทที่ถูกโจมตีเป็นยูนิทนั้น'; case 'addvg': return 'ยูนิทที่โจมตีสู้กับแวนการ์ดของคู่ต่อสู้ด้วยในแบทเทิลนั้น';
    case 'opr': return 'โอเปอเรตโปรดักท์นั้น'; case 'asu': return 'คอลการ์ดนี้ลง RC ที่ว่างเป็นยูนิทปกติ [พาวเวอร์ ' + (s[1].power || 0) + (s[1].shield ? ' / ชีลด์ ' + s[1].shield : '') + ' / คริติคอล ' + (s[1].crit || 1) + (s[1].boost ? ' / บูสท์' : '') + (s[1].intercept ? ' / อินเตอร์เซปต์' : '') + ']';
    case 'retry': return 'Retry ' + (s[1] === 'atk' ? 'ยูนิทที่โจมตี' : s[1] === 'me' ? 'ยูนิทนี้' : 'ยูนิทนั้น') + ' (สแตนด์ จนจบเทิร์น พาวเวอร์+5000 คริติคอลและไดรฟ์เป็น 1)';
    case 'mbtop': return 'นำการ์ดบนสุดของเด็ค ' + thN(s[1]) + ' ใบเข้า Monster BOX แบบหงาย';
    case 'memo2': return 'เลือก <Quintuplet> ชื่อเดียวกันจากดรอปสูงสุด 2 ใบ นำ 1 ใบไว้ล่างสุดของเด็ค ที่เหลือเข้าเมมโมรี่'; case 'win': return 'คุณชนะเกม';
    case 'alcok': return 'จนจบเทิร์น เมื่อคุณจะเพลย์นอร์มอลออเดอร์ สามารถ Alchemagic ได้'; case 'alcnosb': return 'ครั้งถัดไปที่ Alchemagic ไม่ต้องจ่ายโซลบลาสต์ของคอสต์';
    case 'sfree': return 'จนจบเทิร์น คุณสไตรด์ได้โดยไม่ต้องจ่ายคอสต์'; case 'stride': return 'สไตรด์โดยไม่ต้องจ่ายคอสต์';
    case 'fatk': return (s[1] === 'vg' ? 'แวนการ์ดของคุณ' : 'ยูนิทนั้น') + 'โจมตีแวนการ์ดของคู่ต่อสู้'; case 'link': return 'ยูนิทนี้และยูนิทที่เรสต์เป็นคอสต์อยู่ในสถานะลิงก์แอทแทคจนจบการต่อสู้นั้น'; case 'ctop': return 'คอลใบนั้นทับยูนิทนี้ (ยูนิทนี้กลายเป็นบัดดี้โซลของมัน) โดยไม่จ่ายคอลคอสต์';
    case 'arm': return 'อาร์ม' + (s[1] === 'me' ? 'การ์ดนี้' : 'ใบนั้น') + 'ให้แวนการ์ดของคุณ';
    case 'jcall': return 'คอลใบที่เลือกลง RC';
    case 'mkrm': { const o = s[2] || {}; return 'นำ ' + (s[1] ? s[1] + ' ' : '') + 'marker ' + (o.mine ? 'ของคุณ ' : '') + (o.all ? 'ทั้งหมด' : '1 อัน') + 'ออกจาก' + (o.it ? ' RC ของยูนิทนั้น' : o.opp ? ' RC ของคู่ต่อสู้' : ' RC'); }
    case 'opt': return thSteps(s[1]); case 'sb': return 'โซลบลาสต์ ' + thN(s[1]); case 'asn': return 'จนจบเทิร์น การ์ดนี้เปลี่ยนชื่อเป็น "' + jn(s[1]) + '"'; case 'gzun': return ''; case 'ith': return '';
    case 'xturn': { const o = s[1] || {}; return 'คุณได้เทิร์นเพิ่มเติม 1 เทิร์น' + (o.skipRM ? ' (ข้ามไรด์เฟสและเมนเฟส' + (o.vmod && o.vmod.drive ? ' และแวนการ์ดได้ไดรฟ์ ' + o.vmod.drive : '') + ')' : '') + (o.skipR ? ' (ข้ามไรด์เฟส' + (o.noStr ? ' และสไตรด์ไม่ได้' : '') + ')' : ''); }
    case 'gzt': { const o = s[3] || {}; return 'นำการ์ด ' + thN(s[1]) + ' ใบจากบนสุดของเด็คไปเป็น' + gkTh(s[2]) + (o.host === 'me' ? 'ของการ์ดนี้' : o.host ? 'ของยูนิทนั้น' : '') + (o.fd ? ' แบบคว่ำหน้า' : ' แบบหงายหน้า'); }
    case 'gzre': return 'นำ' + gkTh(s[1]) + 'ทั้งหมดของคุณไปไว้ที่ยูนิทนั้น'; case 'gzok': return 'จนจบไฟท์ คุณมี' + gkTh(s[1]) + 'ได้'; case 'gztk': return 'นำ ' + s[1].replace(/\b\w/g, x => x.toUpperCase()) + ' โทเคน ' + thN(s[2]) + ' ใบไปเป็นเกจ Plant ของยูนิทนั้น'; case 'gless': return 'จนจบเทิร์น ออเดอร์ใบถัดไปที่คุณเพลย์ลดคอสต์เกจลง 1';
    case 'noact': return 'จนจบเทิร์น คุณใช้ ACT ของ' + (s[1] === 'sn' ? 'การ์ดชื่อเดียวกับใบนี้' : ' "' + jn(s[1]) + '"') + 'ไม่ได้';
    case 'itin': return 'เฉพาะใบที่ยังอยู่ใน' + [].concat(s[1]).map(z => ZONE_TH[z] || z).join('/'); case 'rvu': return 'เปิดเผยการ์ดจากบนสุดของเด็คจนกว่าจะเจอ' + thF(s[1], 0).trim(); case 'persona': return 'เพอร์โซน่าไรด์ทำงาน (จั่ว 1 ใบ แถวหน้า +10000)'; case 'noride': return 'คุณไรด์ไม่ได้อีกจนจบเทิร์น';
    case 'opp': return 'คู่ต่อสู้: ' + thSteps(s[1]); case 'each': return 'ทำกับแต่ละใบ: ' + thSteps(s[1]); case 'rep': return 'ทำซ้ำ ' + thN(s[1]) + ' ครั้ง: ' + thSteps(s[2]); case 'stop': return 'จบเอฟเฟกต์';
    case 'ffset': case 'tfset': return ''; case 'say': return s[1];
    case 'dmg': return 'ทำดาเมจ ' + thN(s[1] == null ? 1 : s[1]) + ' แก่แวนการ์ด' + (s[2] === 'me' ? 'ของคุณ' : 'คู่ต่อสู้'); case 'heal': return 'ฮีลดาเมจ ' + thN(s[1] == null ? 1 : s[1]) + ' ใบ';
    case 'cb': return 'เคาน์เตอร์บลาสต์ ' + thN(s[1]); case 'eb': return 'เอเนอร์จีบลาสต์ ' + thN(s[1]); case 'stu': return UW[s[2] || 'me'] + 'เข้าสู่สถานะ ' + s[1];
    case 'pay': return 'จ่าย [' + s[1].map(k => mkCost(k).label).join(' + ') + '] แล้ว';
    case 'ch': return 'เลือก' + thSel(s[1]);
    case 'pk': return 'เลือก' + thFn(s[4], s[2], s[3]) + 'จาก' + s[1].map(zth).join('หรือ');
    case 'sr': return 'ค้นหา' + thFn(s[4], s[2], s[3]) + 'จาก' + s[1].map(zth).join('หรือ');
    case 'lk': return 'ดูการ์ด ' + thN(s[1]) + ' ใบบนสุดของเด็ค' + (s[2] === 'o' ? 'คู่ต่อสู้' : ''); case 'rvt': return 'เปิดเผยการ์ด ' + thN(s[1]) + ' ใบบนสุดของเด็ค'; case 'reveal': return 'เปิดเผย';
    case 'to': return (s[3] ? 'เปิดเผยแล้ว' : '') + 'นำ' + tgt(s[1]) + ({ hand: 'ขึ้นมือ', soul: 'เข้าโซล', drop: 'ลงดรอป', top: 'ไว้บนสุดของเด็ค', bottom: 'ไว้ล่างสุดของเด็ค', tb: 'ไว้บนสุดหรือล่างสุดของเด็ค', order: 'ไปวางในออเดอร์โซน', damage: 'ไปดาเมจโซน', bindfd: 'ไปไบนด์โซนแบบคว่ำหน้า', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', dropnr: 'ลงดรอป (ไม่นับเป็นรีไทร์)', bind: 'ไปไบนด์', removed: 'ออกจากเกม', dress: 'ไปซ้อนเป็น originalDress ของยูนิทนี้', prison: 'ไปขังในพริซัน', crest: 'ไปวางในเครสต์โซน' }[s[2]] || gzDestTh(s[2]));
    case 'rs': return 'นำใบที่เหลือ' + { bottom: 'ไว้ล่างสุดของเด็ค', top: 'ไว้บนสุดของเด็ค', drop: 'ลงดรอป', soul: 'เข้าโซล' }[s[1]];
    case 'cl': { const o = s[2] || {}; return 'คอล' + tgt(s[1]) + (o.gc ? 'ลง GC' : 'ลง RC' + (o.open ? ' ที่ว่าง' : '') + (o.col ? ' ในคอลัมน์เดียวกับยูนิทนี้' : '') + (o.row ? (o.row === 'f' ? ' แถวหน้า' : ' แถวหลัง') : '') + (o.pos ? ' ' + ({ BC: 'แถวหลังกลาง', FL: 'แถวหน้าซ้าย', FR: 'แถวหน้าขวา', BL: 'แถวหลังซ้าย', BR: 'แถวหลังขวา' }[o.pos] || o.pos) : '') + (o.last ? ' ช่องที่ยูนิทนี้เคยอยู่' : '') + (o.colf ? ' ในคอลัมน์เดียวกับ' + thF(o.colf, 0).trim() + 'ของคุณ' : '') + (o.colevt ? ' ในคอลัมน์เดียวกับยูนิทใบนั้น' : '') + (o.drow ? ' คนละแถวกัน' : '')
 + (o.scol ? ' ในคอลัมน์เดียวกัน' : '')
 + (o.rest ? ' ในสภาพเรสต์' : '') + (o.repl === 'soul' ? ' (ยูนิทที่ถูกคอลทับเข้าโซลแทนการลงดรอป)' : '')); }
    case 'rt': return 'รีไทร์' + (s[1] === 'me' ? 'ยูนิทนี้' : s[1] === 'it' ? 'ใบที่เลือก' : thT(s[1])); case 'rtall': return 'รีไทร์เรียร์การ์ด' + (s[1] ? (s[1] === 'f' ? 'แถวหน้า' : 'แถวหลัง') : '') + 'ของคู่ต่อสู้ทั้งหมด' + (s[2] ? 'ในคอลัมน์เดียวกับยูนิทนี้' : '');
    case 'st': return 'สแตนด์' + thT(s[1]); case 're': return 'เรสต์' + thT(s[1]);
    case 'bf': return thT(s[1]) + ' ' + thMod(s[2]) + (s[4] ? ' ต่อ' + thCount(s[4]) : '') + (DUR_TH[s[3]] ? ' ' + DUR_TH[s[3]] : '');
    case 'pget': return 'คุณได้รับเอฟเฟกต์ "' + s[1].map(thAbility).join(' / ') + '" ' + (s[2] === 'f' ? 'จนจบไฟท์' : s[2] === 'o' ? 'จนจบเทิร์นถัดไปของคู่ต่อสู้' : 'จนจบเทิร์น');
    case 'grant': return thT(s[1]) + ' ได้รับสกิล "' + [].concat(s[2]).map(thAbility).join(' / ') + '" ' + DUR_TH[s[3]];
    case 'tk': { const o = s[6] || {}; return 'คอล ' + s[1].replace(/\b\w/g, x => x.toUpperCase()) + ' โทเคน' + (s[3] ? 'สูงสุด ' : ' ') + thN(s[2]) + ' ใบลง RC' + (s[5] ? ' แถวหลังกลาง' : '') + (s[4] ? ' ที่ว่าง' : '') + (o.col === 1 ? ' ช่องอื่นในคอลัมน์เดียวกับยูนิทนี้' : o.col ? ' ในคอลัมน์เดียวกับยูนิทนี้' : '') + (o.row ? (o.row === 'f' ? ' แถวหน้า' : ' แถวหลัง') : '') + (o.mypos ? ' ช่องของยูนิทนี้' : '') + (o.unit ? ' ที่มียูนิทอยู่' : '') + (o.rest ? ' ในสภาพเรสต์' : ''); }
    case 'ride': return 'ไรด์' + (s[1] === 'me' ? 'การ์ดนี้' : 'ใบที่เลือก') + (s[2] === 'rest' ? 'ในสภาพเรสต์' : 'ในสภาพสแตนด์') + (s[3] === 'carry' ? ' (คงพลัง/คริติคอลจากทริกเกอร์ของเทิร์นนี้ไว้)' : '');
    case 'or': return 'เลือกอย่างใดอย่างหนึ่ง: ' + thSteps(s[1]) + ' หรือ ' + thSteps(s[2]);
    case 'topTo': return 'นำการ์ด ' + thN(s[1]) + ' ใบบนสุดของเด็ค' + { prison: 'ไปขังในพริซัน', drop: 'ลงดรอป', soul: 'เข้าโซล', bind: 'ไปไบนด์', damage: 'ไปดาเมจโซน', bindfd: 'ไปไบนด์โซนแบบคว่ำหน้า', ridefu: 'กลับไรด์เด็คแบบหงายหน้า', dropnr: 'ลงดรอป (ไม่นับเป็นรีไทร์)', hand: 'ขึ้นมือ', removed: 'ออกจากเกม', order: 'ไปออเดอร์โซน', mbox: 'เข้า Monster BOX แบบหงาย', memory: 'เข้าเมมโมรี่' }[s[2]];
    case 'if': return 'ถ้า' + thC(s[1]) + ' → ' + thSteps(s[2]) + (s[3] ? ' (ถ้าไม่ใช่ → ' + thSteps(s[3]) + ')' : '');
    case 'may': return 'จะ' + thSteps(s[1]) + 'ก็ได้';
    case 'later': return ({ b: 'ตอนจบแบทเทิลนั้น ', t: 'ตอนจบเทิร์นนั้น ', S: 'ตอนเริ่มเทิร์นถัดไปของคุณ ', R: 'ตอนเริ่มไรด์เฟสถัดไปของคุณ ', M: 'ตอนเริ่มเมนเฟสถัดไปของคุณ ', B: 'ตอนเริ่มแบทเทิลเฟสถัดไปของคุณ ', E: 'ตอนจบเทิร์นถัดไปของคุณ ', oS: 'ตอนเริ่มเทิร์นถัดไปของคู่ต่อสู้ ', oM: 'ตอนเริ่มเมนเฟสถัดไปของคู่ต่อสู้ ', oB: 'ตอนเริ่มแบทเทิลเฟสถัดไปของคู่ต่อสู้ ', oE: 'ตอนจบเทิร์นถัดไปของคู่ต่อสู้ ' }[s[1]] || '') + thSteps(s[2]);
    case 'modal': return (s[3] != null ? 'เลือกทำตามจำนวนที่กำหนด (ไม่ซ้ำกัน) — ' : s[2] ? 'ทำทั้งหมดตามลำดับ — ' : 'เลือกทำ 1 อย่าง — ') + s[1].map((o, i) => '(' + (i + 1) + ') ' + (o.c ? 'ถ้า' + thC(o.c) + ': ' : '') + (o.k ? o.k.map(k => mkCost(k).label).join(' + ') + ' → ' : '') + thSteps(o.d)).join(' ');
    case 'odisc': return 'คู่ต่อสู้เลือกทิ้งการ์ดจากมือ ' + thN(s[1]) + ' ใบ'; case 'oret': return 'คู่ต่อสู้เลือกรีไทร์เรียร์การ์ดของตัวเอง' + thFtail(s[2]) + ' ' + thN(s[1]) + ' ใบ'; case 'odraw': return 'คู่ต่อสู้จั่ว ' + thN(s[1]) + ' ใบ';
    case 'man': return 'ทำเอฟเฟกต์ด้วยมือตามข้อความการ์ด ✋';
    case 'mk': if (s[2] && (s[2].opp || s[2].any)) return 'เลือก RC ของ' + (s[2].any ? 'ผู้เล่นคนใดก็ได้' : 'คู่ต่อสู้') + ' ' + (s[2].n || 1) + ' ช่อง แล้ววาง ' + s[1] + ' marker'; return 'เลือก RC ของคุณ' + (s[2] && s[2].no ? 'ที่ยังไม่มี ' + s[1] + ' marker' : '') + ' ' + ((s[2] && s[2].n) || 1) + ' ช่อง แล้ววาง ' + s[1] + ' marker';
    case 'pst': return 'รับ Persona Shield ทิกเก็ต 1 ใบขึ้นมือ';
    case 'odrop': return 'นำ originalDress ทั้งหมดของยูนิทนี้ลงดรอป'; case 'hostsel': return 'เลือกยูนิทที่การ์ดนี้ซ้อนอยู่ข้างใต้';
    case 'lock': return 'ล็อกใบที่เลือก'; case 'unlock': return 'ปลดล็อกใบนั้น'; case 'itfd': return 'คว่ำหน้าใบนั้น'; case 'unstr': return 'นำ G ยูนิทของคุณกลับไป G โซนแบบหงาย'; case 'rdfree': return 'ไรด์เฟสในเทิร์นถัดไปของคุณ เมื่อไรด์จากไรด์เด็ค ไรด์ได้โดยไม่ต้องทิ้งการ์ดจากมือ'; case 'srarm': return 'ค้นเด็คหรือดรอปหา' + thF(s[1] || {}, 0).trim() + ' ชื่อต่างจากการ์ดที่จ่ายเป็นคอสต์ สูงสุด 1 ใบ แล้วติดตั้งให้ยูนิทนี้'; case 'srfm': return 'ค้นเด็คหรือดรอปหาแฟชั่นเมจิกการ์ดที่เขียนบนใบนั้นสูงสุด 1 ใบ แล้ววางในออเดอร์โซน'; case 'gleipcall': return 'เลือกบัดดี้โซลของการ์ดนี้สูงสุด 1 ใบ คอลลง RC โดยไม่จ่ายคอลคอสต์ (เทิร์นนั้นโจมตีไม่ได้ ยกเว้น Fenrir เมื่อแวนการ์ดชื่อ Kiri)'; case 'ncont': return 'CONT ของการ์ดนี้ถูกยกเลิกจนจบเทิร์น'; case 'actauto': return 'ให้ AUTO ที่มีอยู่แต่เดิมทั้งหมดของใบที่เลือกทำงาน'; case 'gabnull': return 'จนจบเทิร์นถัดไปของคู่ต่อสู้ เมื่อไดรฟ์เช็คของคู่ต่อสู้จะเปิดได้คริติคอลทริกเกอร์ครั้งถัดไป เลือกเอฟเฟกต์ทริกเกอร์ 1 อย่างแล้วยกเลิก'; case 'gabget': return 'แวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "' + s[1] + '" ได้รับเอฟเฟกต์ทริกเกอร์ที่ยกเลิกไว้จนจบเทิร์น'; case 'asname': return 'ยูนิทนี้ได้รับชื่อของใบนั้น' + (DUR_TH[s[1] || 'f'] || ''); case 'trigact': return 'ทำเอฟเฟกต์ทริกเกอร์และเอฟเฟกต์เพิ่มเติมทั้งหมดของใบนั้น แล้วนำออกจากเกม'; case 'del': return 'Delete ใบนั้น'; case 'oputvc': return 'เลือกเรียร์การ์ดของคู่ต่อสู้ที่ไม่ใช่โทเคน 1 ใบ แล้ววางบน VC ของคู่ต่อสู้ในสภาพเรสต์'; case 'oreride': return 'คู่ต่อสู้เลือกการ์ดจากโซลที่ชื่อเดียวกับการ์ดที่ถูกนำจาก VC เข้าโซลในเทิร์นนี้ แล้วไรด์ในสภาพเรสต์โดยไม่สนสกิลของการ์ดนั้น'; case 'ridebv': return 'ไบนด์แวนการ์ดของคุณ แล้วไรด์การ์ดนี้แทนในสภาพสแตนด์'; case 'noautok': return 'จนจบเทิร์น คุณจ่ายคอสต์ AUTO ของการ์ดชื่อเดียวกับการ์ดนี้ไม่ได้'; case 'loseg': return 'คุณแพ้ไฟท์นี้'; case 'itfu': return 'หงายหน้าใบนั้น'; case 'ebonly': return 'จนจบเทิร์น คุณเอเนอร์จีบลาสต์ได้เฉพาะด้วยสกิลของการ์ดที่มีชื่อ ' + s[1].map(x => '"' + x + '"').join(' หรือ '); case 'state': return 'คุณเข้าสู่สถานะ "' + s[1] + '" ' + DUR_TH[s[2]]; case 'pfx': return (s[1] === 'guardMin' ? 'คู่ต่อสู้ต้องคอลการ์ดเดี้ยนจากมือครั้งละ ' + s[3] + ' ใบขึ้นไป ' : s[1] === 'noInt' ? 'คู่ต่อสู้อินเตอร์เซปต์ไม่ได้ ' : (s[4] === 'o' ? 'คู่ต่อสู้: ' : '') + (PFX_TH[s[1]] || s[1]) + (typeof s[3] === 'number' && s[3] !== 1 ? ' ' + s[3] : '') + ' ') + (s[2] === 'f' ? 'จนจบไฟท์' : DUR_TH[s[2]] || '');
  }
  return '?';
}
function thSteps(steps) { return (steps || []).map(thStep).filter(Boolean).join(' แล้ว').replace(/แล้ว แล้ว/g, 'แล้ว'); }
function thTg(f) { if (!f) return ''; return ' ' + (f.k === 'v' ? 'แวนการ์ด' : f.k === 'r' ? 'เรียร์การ์ด' : f.tk ? 'โทเคน' : 'ยูนิท') + thFtail(Object.assign({}, f, { k: null, tk: null })); }
function thBy(by) { by = by || {}; return (by.k === 'o' ? 'การ์ดในออเดอร์โซน' : by.k === 'v' ? 'แวนการ์ดของคุณ' : 'ยูนิทของคุณ') + (by.gmin ? ' เกรด ' + by.gmin + ' ขึ้นไป' : '') + (by.nm ? ' "' + by.nm + '"' : '') + (by.nh ? ' ที่มีชื่อ "' + by.nh + '"' + (by.nh2 ? ' หรือ "' + by.nh2 + '"' : '') : ''); }
function thTrig(t) {
  const ph = { m: ' ในเมนเฟสของคุณ', b: ' ในแบทเทิลเฟสของคุณ', r: ' ในไรด์เฟสของคุณ', t: ' ในเทิร์นของคุณ', o: ' ในเทิร์นของคู่ต่อสู้', nb: ' นอกแบทเทิลเฟส', rd: ' ตอนไรด์จากไรด์เด็ค' }[t.ph] || '';
  const by = t.by ? ({ a: ' ด้วยสกิลการ์ดของคุณ', x: ' ด้วยสกิลการ์ด', nu: ' โดยไม่ใช่สกิลของยูนิท', o: ' ด้วยสกิลการ์ดของคู่ต่อสู้', v: ' ด้วยสกิลแวนการ์ดของคุณ', c: ' เป็นคอสต์ของสกิล' + (t.byv ? 'แวนการ์ด' : 'การ์ด') + 'ของคุณ' }[t.by] || '') + (t.byf ? ' (' + thFtail(t.byf).trim() + ')' : '') : '';
  const from = t.from ? ' จาก' + t.from.map(z => ZONE_TH[z] || z).join('หรือ') : '';
  let s;
  switch (t.e) {
    case 'dress': s = 'เมื่อการ์ดนี้กลายเป็น originalDress'; break;
    case 'trigz': s = 'เมื่อการ์ดนี้ถูกวางในทริกเกอร์โซน'; break;
    case 'sung': s = t.me ? 'เมื่อเพลงนี้ถูกร้อง' : 'เมื่อแวนการ์ดของคุณร้องเพลง' + (t.wf ? thFtail(t.wf) : ''); break;
    case 'ustood': s = 'เมื่อยูนิท' + thFtail(t.wf || {}) + 'ของคุณสแตนด์' + (t.own ? 'ด้วยสกิลของตัวเอง' : ''); break;
    case 'rtd': s = t.me ? 'เมื่อยูนิทนี้ Retry' : t.col ? 'เมื่อยูนิทของคุณในคอลัมน์เดียวกับยูนิทนี้ Retry' : 'เมื่อยูนิทของคุณ Retry'; break;
    case 'ossoul': s = 'เมื่อยูนิทนี้ถูกนำจาก RC เข้าโซลเพื่อเป็นคอสต์ Over Soul'; break;
    case 'tstart': s = 'ตอนเริ่มเทิร์น' + (t.opp ? 'ของคู่ต่อสู้' : 'ของคุณ'); break;
    case 'strd': s = 'เมื่อ G ยูนิทของคุณสไตรด์' + (t.ph === 't' ? 'ในเทิร์นของคุณ' : ''); break; case 'sdisc': s = 'เมื่อการ์ดนี้ถูกทิ้งจากมือเพื่อจ่ายคอสต์สไตรด์'; break; case 'sbme': s = 'เมื่อการ์ดนี้ถูกโซลบลาสต์เป็นคอสต์ของสกิล' + (t.by === 'v' ? 'แวนการ์ด' : 'การ์ด') + 'ของคุณ'; break;
    case 'domAtk': s = 'เมื่อยูนิทที่คุณ Dominate โจมตี'; break; case 'domHit': s = 'เมื่อการโจมตีของยูนิทที่คุณ Dominate โดน'; break;
    case 'alcxd': s = 'เมื่อการ์ดนี้ถูก Alchemix'; break; case 'alcxh': s = 'เมื่อยูนิทนี้ Alchemix'; break; case 'ualcx': s = 'เมื่อคุณ Alchemix'; break;
    case 'dlpl': s = 'เมื่อการ์ดนี้ถูกวางด้วย D-Legion'; break;
    case 'smUsed': s = 'เมื่อท่าพิเศษนี้ถูกใช้'; break; case 'smFlip': s = 'เมื่อท่าพิเศษในโซนของคุณถูกหงาย'; break;
    case 'atkUsed': s = 'เมื่อท่านี้ถูกใช้'; break; case 'gotc': s = 'เมื่อคุณได้รับเครสต์นี้'; break;
    case 'oprd': s = 'เมื่อการ์ดนี้ถูกโอเปอเรต'; break; case 'uopr': s = 'เมื่อคุณโอเปอเรต' + (t.f ? thF(t.f, 0).trim() : 'โปรดักท์'); break;
    case 'lnkd': s = 'เมื่อยูนิทนี้เข้าสู่สถานะลิงก์แอทแทค'; break; case 'opwdn': s = 'เมื่อพลังของเรียร์การ์ดคู่ต่อสู้ถูกลดด้วยความสามารถของการ์ด' + thFtail(t.byf) + 'ของคุณ'; break; case 'stup': s = 'เมื่อคุณ Stand up'; break;
    case 'armd': s = t.me ? 'เมื่อการ์ดนี้ถูกอาร์ม' : 'เมื่อแวนการ์ดของคุณถูกอาร์ม'; break;
    case 'gzd': s = (t.me ? 'เมื่อการ์ดนี้ถูกวางเป็น' : 'เมื่อการ์ด' + (t.ot ? 'ใบอื่น' : '') + 'ของคุณ' + (t.col ? 'ในคอลัมน์เดียวกับยูนิทนี้' : '') + 'ถูกวางเป็น') + gkTh(t.gk) + (t.hf ? 'ของ' + thF(t.hf, 0).trim() : '') + (t.from ? 'จาก' + t.from.map(z => ZONE_TH[z] || z).join('/') : '') + ph + by; break;
    case 'gzdisc': s = t.me ? 'เมื่อการ์ดนี้ถูกทิ้งจากการเป็น' + gkTh(t.gk) + ph : 'เมื่อ' + gkTh(t.gk) + 'ของคุณถูกทิ้งพร้อมกัน ' + (t.n || 1) + ' ใบขึ้นไปเพื่อจ่ายคอสต์'; break;
    case 'unmoor': s = 'เมื่อยูนิทนี้ Unmoor (ย้ายไป RC อื่น)'; break; case 'cbd': s = 'เมื่อคุณเคาน์เตอร์บลาสต์'; break; case 'lockd': s = 'เมื่อเรียร์การ์ดของ' + (t.s === 'm' ? 'คุณ' : 'คู่ต่อสู้') + 'ถูกล็อก' + by; break;
    case 'ustate': s = 'เมื่อยูนิทนี้เข้าสู่สถานะ ' + t.n + ph; break;
    case 'unlockd': s = 'เมื่อ' + (t.me ? 'ยูนิทนี้' : (t.s === 'o' ? 'เรียร์การ์ดของคู่ต่อสู้' : 'ยูนิท' + (t.ot ? 'อื่น' : '') + 'ของคุณ') + thFtail(t.wf)) + 'ถูกปลดล็อก' + (t.end ? 'ในเอนด์เฟส' : '') + ph; break;
    case 'uboost': s = 'เมื่อยูนิท' + (t.ot ? 'อื่น' : '') + (t.s === 'x' ? 'ของผู้เล่นคนใดก็ตาม' : t.s === 'o' ? 'ของคู่ต่อสู้' : 'ของคุณ') + 'บูสต์' + thTg(t.tg); break;
    case 'scd': s = 'เมื่อคุณโซลชาร์จด้วยสกิลการ์ดของคุณ'; break; case 'actd': s = 'เมื่อคุณใช้ ACT' + (t.zone === 'order' ? ' ของการ์ดในออเดอร์โซน' : '') + (t.f ? ' (' + thF(t.f, 0).trim() + ')' : ''); break;
    case 'pwup': s = 'เมื่อพลังของยูนิทนี้ถูกเพิ่มด้วย' + (t.act ? ' ACT' : 'สกิล') + by; break; case 'uchosen': s = 'เมื่อ' + (t.k === 'r' ? 'เรียร์การ์ด' : 'ยูนิท') + 'ของคุณ' + thFtail(t.wf) + 'ถูกเลือกด้วยสกิล' + (t.my ? 'ของ' + thBy(t.by) : 'การ์ดของคู่ต่อสู้'); break;
    case 'restd': s = 'เมื่อยูนิทนี้ถูกเรสต์' + by; break;
    case 'rvd': s = 'เมื่อการ์ด' + ({ o: 'ของคู่ต่อสู้', x: '' }[t.s] || 'ของคุณ') + thFtail(t.f) + 'ถูกเปิดเผย' + by; break;
    case 'mvd': s = 'เมื่อ' + (t.multi ? 'การ์ด ' + t.multi + ' ใบขึ้นไป' : '') + (t.me ? 'การ์ดนี้' : (t.multi ? '' : 'การ์ด') + (t.ot ? 'ใบอื่น' : '') + ({ o: 'ของคู่ต่อสู้', x: 'ของผู้เล่นคนใดก็ตาม' }[t.s] || 'ของคุณ') + thFtail(t.f)) + 'ถูกนำ' + from + (t.nfrom ? ' (ไม่ใช่จาก' + [].concat(t.nfrom).map(z => ZONE_TH[z] || z).join('/') + ')' : '') + (t.to ? 'ไป' + [].concat(t.to).map(z => ZONE_TH[z] || z).join('หรือ') : '') + (t.reason ? ' (' + [].concat(t.reason).join('/') + ')' : '') + ph + by; break;

    case 'dstep': s = 'ตอนเริ่มไดรฟ์สเต็ปของแบทเทิลที่ยูนิทนี้โจมตี'; break;
    case 'agstart': s = 'ตอนเริ่มการ์ดสเต็ปของแบทเทิลที่ยูนิทนี้โจมตี'; break;
    case 'gstart': s = 'ตอนเริ่มการ์ดสเต็ปของแบทเทิลที่' + (t.w === 'me' ? 'ยูนิทนี้' : (t.w === 'v' ? 'แวนการ์ด' : 'ยูนิท') + 'ของคุณ' + thFtail(t.wf)) + 'ถูกโจมตี'; break;
    case 'endAtked': s = 'ตอนจบแบทเทิลที่' + (t.w === 'v' ? 'แวนการ์ดของคุณ' : t.w === 'u' ? 'ยูนิทของคุณ' : 'ยูนิทนี้') + 'ถูก' + (t.by === 'r' ? 'เรียร์การ์ด' : t.by === 'v' ? 'แวนการ์ด' : 'ยูนิท') + 'โจมตี'; break;
    case 'leave': s = 'เมื่อยูนิทนี้ออกจาก RC' + (t.row ? (t.row === 'f' ? ' แถวหน้า' : ' แถวหลัง') : '') + ph + by; break;
    case 'oGuard': s = 'เมื่อคู่ต่อสู้วางการ์เดี้ยนบน GC'; break;
    case 'astep': s = 'ตอนเริ่มแอทแทคสเต็ป' + (t.opp ? 'ของคู่ต่อสู้' : 'ของคุณ'); break;
    case 'pst': s = 'เมื่อคุณเพลย์ Persona Shield ทิกเก็ต'; break;
    case 'retCol': s = 'เมื่อยูนิทของผู้เล่นคนใดก็ตามถูกรีไทร์จาก RC แถว' + (t.row === 'f' ? 'หน้า' : 'หลัง') + 'ในคอลัมน์เดียวกับยูนิทนี้' + ph; break;
    case 'chosen': s = 'เมื่อยูนิทนี้ถูกเลือกด้วยสกิลของ' + thBy(t.by); break;
    case 'placeRC': s = 'เมื่อวางบน ' + (t.vc ? 'VC หรือ RC' : 'RC' + (t.row ? (t.row === 'f' ? ' แถวหน้า' : ' แถวหลัง') : '') + (t.pos ? ' แถวหลังกลาง' : '')) + from + (t.nfrom ? ' โดยไม่ใช่จาก' + t.nfrom.map(z => ZONE_TH[z]).join('/') : '') + ph + by + (t.od ? (t.od === 'x' ? ' ด้วย X-overDress' : ' ด้วย overDress') : ''); break;
    case 'placeVC': s = 'เมื่อวางบน VC' + (t.ride ? ' ด้วยการไรด์' : '') + ph + by; break;
    case 'rideFrom': s = 'เมื่อวางโดยไรด์ทับ' + thFtail(t.f); break;
    case 'placeGC': s = (t.ic ? 'เมื่อยูนิทนี้อินเตอร์เซปต์' : 'เมื่อวางบน GC' + from) + by; break;
    case 'atk': s = (t.ob ? 'เมื่อยูนิทนี้โจมตีหรือบูสต์' : 'เมื่อยูนิทนี้โจมตี' + thTg(t.tg)) + (t.bo === 1 ? ' ขณะถูกบูสต์' + (t.bof ? 'โดย' + thTg(t.bof) : '') : t.bo === 0 ? ' ขณะไม่ถูกบูสต์' : ''); break;
    case 'boost': s = 'เมื่อยูนิทนี้บูสต์' + thTg(t.tg); break; case 'boosted': s = 'เมื่อยูนิทนี้ถูกบูสต์' + (t.tg ? 'โดย' + thTg(t.tg) : ''); break;
    case 'hit': s = 'เมื่อการโจมตีของยูนิทนี้โดน' + thTg(t.tg); break; case 'bhit': s = 'เมื่อการโจมตีที่ยูนิทนี้บูสต์โดน' + thTg(t.tg); break; case 'vhit': s = 'เมื่อการโจมตีของแวนการ์ดคุณโดน' + thTg(t.tg); break;
    case 'end': s = 'ตอนจบแบทเทิลที่' + (t.w ? (KTH[t.w] || 'ยูนิท') + 'ของคุณ' + thFtail(t.wf) + 'โจมตี' : 'ยูนิทนี้' + (t.a && t.b ? 'โจมตีหรือบูสต์' : t.a ? 'โจมตี' : 'บูสต์')) + thTg(t.tg) + (t.hit ? ' และโจมตีโดน' : '') + (t.bo === 1 ? ' ขณะถูกบูสต์' + (t.bof ? 'โดย' + thTg(t.bof) : '') : ''); break;
    case 'rode': s = 'เมื่อยูนิทนี้ถูกไรด์ทับ' + (t.by ? 'ด้วย' + thFtail(t.by) : ''); break;
    case 'disc': s = 'เมื่อการ์ดนี้ถูกทิ้งจาก' + (t.from ? t.from.map(z => ZONE_TH[z]).join('หรือ') : 'มือ') + (t.sdisc ? ' ขณะจ่ายคอสต์สไตรด์' : '') + ph + by; break;
    case 'toOrder': s = 'เมื่อการ์ดนี้ถูกวางในออเดอร์โซน'; break; case 'retGC': s = 'เมื่อยูนิทนี้ถูกรีไทร์จาก GC'; break;
    case 'retRC': s = 'เมื่อยูนิทนี้ถูกรีไทร์จาก RC' + (t.gc ? ' หรือ GC' : '') + ph + by; break; case 'bounced': s = 'เมื่อยูนิทนี้ถูกส่งกลับมือจาก RC' + ph + by; break;
    case 'toSoul': s = 'เมื่อการ์ดนี้ถูกนำเข้าโซล' + from + ph + by; break; case 'bound': s = 'เมื่อยูนิทนี้ถูกไบนด์จาก RC' + ph + by; break;
    case 'atked': s = 'เมื่อ' + (t.w === 'me' ? 'ยูนิทนี้' : (t.w === 'v' ? 'แวนการ์ด' : 'ยูนิท') + 'ของคุณ' + thFtail(t.wf)) + 'ถูกโจมตี'; break;
    case 'tend': s = t.each ? 'ตอนจบทุกเทิร์น' : t.opp ? 'ตอนจบเทิร์นของคู่ต่อสู้' : 'ตอนจบเทิร์นของคุณ'; break;
    case 'phase': s = 'ตอนเริ่ม' + { r: 'ไรด์เฟส', m: 'เมนเฟส', b: 'แบทเทิลเฟส' }[t.ph] + (t.opp ? 'ของคู่ต่อสู้' : 'ของคุณ'); break;
    case 'vatk': s = 'เมื่อแวนการ์ดของคุณ' + thFtail(t.wf) + 'โจมตี' + thTg(t.tg); break;
    case 'uatk': s = 'เมื่อยูนิท' + (t.ot ? 'อื่น' : '') + 'ของคุณ' + thFtail(t.wf) + (t.col ? 'ในคอลัมน์เดียวกับยูนิทนี้' : '') + 'โจมตี' + thTg(t.tg); break;
    case 'vplace': s = 'เมื่อแวนการ์ดของคุณ' + thFtail(t.wf) + 'ถูกวาง' + ph; break; case 'uplace': s = 'เมื่อยูนิท' + (t.ot ? 'อื่น' : '') + 'ของคุณ' + thFtail(t.wf) + 'ถูกวางบน RC' + from + ph + by; break;
    case 'dcheck': s = 'เมื่อ' + (t.kind === 'damage' ? 'ดาเมจเช็ค' : 'ไดรฟ์เช็ค') + (t.s === 'o' ? 'ของคู่ต่อสู้' : t.s === 'x' ? 'ของผู้เล่นคนใดก็ตาม' : 'ของคุณ') + 'เปิดได้' + (t.f ? thF(t.f, 0).trim() : t.k === 't' ? 'ทริกเกอร์' : t.k === 'a' ? 'การ์ด' : 'นอร์มอลยูนิท'); break;
    case 'order': s = 'เมื่อ' + (t.s === 'o' ? 'คู่ต่อสู้' : 'คุณ') + 'เพลย์' + (t.f ? thF(t.f, 0).trim() : ({ n: 'นอร์มอลออเดอร์', s: 'เซ็ตออเดอร์', b: 'บลิตซ์ออเดอร์' }[t.k] || 'ออเดอร์')); break;
    case 'endChk': s = 'ตอนจบแบทเทิลที่ไดรฟ์เช็คของคุณเปิดได้' + thF(t.f, 0).trim(); break;
    case 'uDisc': s = 'เมื่อการ์ดใบอื่นของคุณถูกทิ้งจากมือ' + ph + by; break;
    case 'revealed': s = 'เมื่อการ์ดนี้ถูกเปิดในไดรฟ์เช็คของคุณ'; break;
    case 'stood': s = 'เมื่อยูนิทนี้กลับมาสแตนด์' + ph + by; break;
    case 'sbcost': s = 'เมื่อคุณโซลบลาสต์ ' + t.n + ' ใบขึ้นไปพร้อมกันเป็นคอสต์ของสกิล' + (t.by === 'v' ? 'แวนการ์ด' : 'การ์ด') + 'ของคุณ'; break;
    case 'uAtk': case 'uPlace': case 'uStood': case 'uRet': case 'uAtked': case 'uHit': case 'uSoul': case 'uBounce':
      s = 'เมื่อ' + KTH[t.k] + (t.s === 'o' ? 'ของคู่ต่อสู้' : t.s === 'x' ? 'ของผู้เล่นคนใดก็ตาม' : 'ของคุณ') + thFtail(t.wf) + ' ' + { uAtk: 'โจมตี', uPlace: 'ถูกวาง', uStood: 'กลับมาสแตนด์', uRet: 'ถูกรีไทร์', uAtked: 'ถูกโจมตี', uHit: 'โจมตีโดน', uSoul: 'ถูกนำเข้าโซล', uBounce: 'ถูกส่งกลับขึ้นมือ' }[t.e] + thTg(t.tg) + from + (t.nfrom ? ' โดยไม่ใช่จาก' + t.nfrom.map(z => ZONE_TH[z]).join('/') : '') + ph + by; break;
    case 'oret': s = 'เมื่อ' + (t.gc ? 'ยูนิทของคู่ต่อสู้ถูกรีไทร์จาก RC หรือ GC' : 'เรียร์การ์ดคู่ต่อสู้ถูกรีไทร์') + ph + by; break; case 'pride': s = 'เมื่อคุณเพอร์โซน่าไรด์'; break; case 'state': s = 'เมื่อคุณเข้าสู่สถานะ "' + jn(t.n) + '"'; break;
    default: s = '?';
  }
  return s + (t.alt ? ' หรือ' + thTrig(t.alt) : '');
}
/* "during …" conditions read as a lead-in, the rest as "if …" */
function thConds(list) {
  if (!list || !list.length) return '';
  const when = list.filter(c => ['my', 'opp', 'phase', 'attacking', 'boosting'].includes(c[0])), rest = list.filter(c => !when.includes(c));
  return (when.length ? when.map(thC).join(' ') + ' ' : '') + (rest.length ? 'ถ้า' + rest.map(thC).join(' และ') + ' ' : '');
}
function thAbility(a) {
  const head = { a: 'AUTO', k: 'ACT', c: 'CONT' }[a.t] + (a.z ? ' (' + (Array.isArray(a.z) ? a.z.map(z => ZTH[z]).join('/') : ZTH[a.z]) + ')' : '') + (a.l === 'f' ? ' 1/ไฟท์' : a.l ? ' 1/เทิร์น' : '') + (a.dv ? ' [Divine Skill — ใช้ได้ 1 ครั้งต่อไฟท์]' : '') + ': ';
  const cond = thConds(a.c);
  const cost = a.k ? '[' + a.k.map(k => mkCost(k).label).join(' + ') + '] → ' : '';
  if (a.t === 'c') return head + cond + (a.s ? thT(a.s) : 'ยูนิทนี้') + ' ' + thMod(a.m) + (a.per ? ' ต่อ' + thCount(a.per) : '');
  if (a.as) return head + (a.on ? thTrig(a.on) + ' ' : '') + cond + (a.mc ? '(มีเงื่อนไขเพิ่มบนการ์ด) ' : '') + cost + (a.mk ? '[จ่ายคอสต์ตามการ์ดเอง] → ' : '') + 'ทำเอฟเฟกต์ด้วยมือตามข้อความการ์ด ✋ (กึ่งออโต้: เกมเตือนจังหวะให้)';
  return head + (a.on ? thTrig(a.on) + ' ' : '') + cond + cost + thSteps(a.d);
}
})(typeof globalThis !== 'undefined' ? globalThis : this);
