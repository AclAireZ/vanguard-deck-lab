// The Varga family (hand-written skills): scenario tests on the real cards of the card list, then whole fights with a Varga deck (random answers + bot).
import assert from 'node:assert/strict';
import { mulb, randomAnswer } from './sim.mjs';
const VG = globalThis.VG;
const no = name => { const r = VG.DB.byName[name]; if (!r) throw new Error('card not in the list: ' + name); return r.no; };
const N = {
  varga: no('Fated One of Unparalleled, Varga Dragres'), rak: no('Unparalleled Drekasleif, Varga Dragres "Rakshasa"'), hw: no('Unparalleled Rakshasa Dragon, Varga Dragres "Heavenwake"'),
  taijou: no('Battle Monk of Raging Flames, Taijou'), storm: no('Storm Slasher Dragon'), yami: no('Stealth Beast, Yamihyouri'), zalva: no('Mythisch of Unparalleled, Zalva Dragnia'),
  glaive: no('Obduracy Glaive Dragon'), blade: no('Valorous Blade Dragon'), fugen: no('Boulder Axe Dragon, "Fugen"'), nabilla: no('Dragritter, Nabilla'), rock: no('Rockbound Edge Dragon'),
  ushi: no('Fiend Beast, Ushionimaru'), aero: no('Aero Halberd Dragon'), muta: no('Dragritter, Mutawari'), touen: no('Blazembar Dragon, "Touen"'), shuura: no('Dragritter of Ashen Flower, Shuura'), rokusei: no('Battle Monk of Raging Flames, Rokusei'),
};
let passed = 0; const fails = [];
function test(name, fn) { try { fn(); passed++; if (!process.env.QUIET) console.log('  ok  ' + name); } catch (e) { fails.push(name); console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).map(l => l.slice(0, 300)).join('\n       ')); } }
const D = VG.DECKS.TD01;
const pick = (d, f) => { const i = d.options.findIndex(f); if (i < 0) throw new Error('option not found in ' + d.kind + ' "' + (d.title || '') + '": ' + JSON.stringify(d.options).slice(0, 300)); return [i]; };
function dflt(d) { if (d.kind === 'yesno' || d.kind === 'boost') return [0]; if (d.kind === 'guard') return []; const n = Math.max(d.min, Math.min(1, d.max)); return d.options.slice(0, n).map((_, i) => i); }
function run(G, policy, max = 800) { for (let n = 0; n < max && G.pending; n++) { const r = policy ? policy(G.pending, G) : null; if (r === undefined) return; G.answer(r === null ? dflt(G.pending) : r); } }
const settle = (G, policy) => run(G, (d, g) => { const r = policy ? policy(d, g) : null; if (r !== null && r !== undefined) return r; return d.kind === 'main' || d.kind === 'attack' ? undefined : null; });
function sp(G, p, cardNo, zone, pos, o) { const c = G.newCard(cardNo, p, zone === 'RC' || zone === 'VC' ? 'new' : zone); if (zone === 'RC' || zone === 'VC') G.move(c.iid, zone, Object.assign({ pos, silent: true }, o || {})); return c.iid; }
function dmg(G, p, n) { for (let k = 0; k < n; k++) { const i = G.players[p].deck.find(x => !G.def(G.cards[x]).trigger); G.move(i, 'damage', { silent: true }); } }
const plain = G => G.players[0].deck.concat(G.players[1].deck).map(i => G.cards[i]).filter(c => !G.def(c).trigger);
/* a fight at player 0's main phase, turn 3; player 0's vanguard is `vgNo`, the opponent's a plain grade 3; the decks hold no triggers on top (checks stay quiet) */
function mk(vgNo, seed = 7) {
  const G = new VG.Game({ seed, first: 0, players: [{ name: 'A', deck: D }, { name: 'B', deck: D }] }).start();
  G.answer([]); G.answer([]);
  for (const p of [0, 1]) { const g3 = G.players[p].ride.map(i => G.cards[i]).find(c => G.grade(c) === 3) || G.players[p].deck.map(i => G.cards[i]).find(c => G.grade(c) === 3); const old = G.vg(p); G.move(old.iid, 'soul', { silent: true }); if (p === 0 && vgNo) sp(G, 0, vgNo, 'VC', 'V'); else G.move(g3.iid, 'VC', { pos: 'V', silent: true }); for (const c of G.players[p].ride.slice()) if (G.def(G.cards[c]).type === 'crest') G.move(c, 'crest', { silent: true }); }
  run(G, d => (d.kind === 'ride' ? pick(d, o => o.a === 'skip') : d.kind === 'main' ? (G.active === 0 && G.turnNo >= 3 ? undefined : pick(d, o => o.a === 'next')) : d.kind === 'attack' ? pick(d, o => o.a === 'end') : null));
  for (const p of [0, 1]) { const P = G.players[p]; P.deck.sort((a, b) => (G.def(G.cards[a]).trigger ? 1 : 0) - (G.def(G.cards[b]).trigger ? 1 : 0)); }   // triggers to the bottom
  return G;
}
/* skills that wait after the table was changed by hand resolve at the next action: a harmless manual action (look at the top card) lets them run */
const flush = (G, policy) => { G.answer([-1, VG.MAN.op.look, 1]); settle(G, policy); refresh(G); };
const refresh = G => { const d = G.pending; if (d.kind === 'main') d.options = G.mainOptions(d.player); else if (d.kind === 'attack') d.options = G.attackOptions(d.player); };
const toBattle = G => { refresh(G); G.answer(pick(G.pending, o => o.a === 'next')); settle(G); assert.equal(G.pending.kind, 'attack'); refresh(G); };
const attack = (G, a, policy) => { refresh(G); G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === a && o.target === G.vg(1).iid)); settle(G, policy); refresh(G); };
const pw = (G, i) => G.stat(G.cards[i]).power; const P = (G, p) => G.players[p];
const plainRG = (G, p, pos) => { const c = plain(G).find(c => c.owner === p && c.zone === 'deck' && G.grade(c) <= 2); G.move(c.iid, 'RC', { pos, silent: true }); return c.iid; };

test('Varga Dragres: retires both front rows, stands at the end of the battle with drive -2; Divine Skill on the second attack when the opponent has four damage', () => {
  const G = mk(N.varga); const v = G.vg(0).iid; dmg(G, 0, 3); dmg(G, 1, 3);
  const mine = plainRG(G, 0, 'FL'), back = plainRG(G, 0, 'BL'), theirs = plainRG(G, 1, 'FR'), theirBack = plainRG(G, 1, 'BC');
  toBattle(G); const h = P(G, 0).hand.length;
  attack(G, v);   // yes to the skill (counter-blast 1), no guard, twin drive
  assert.equal(G.cards[mine].zone, 'drop'); assert.equal(G.cards[theirs].zone, 'drop'); assert.equal(G.cards[back].zone, 'RC'); assert.equal(G.cards[theirBack].zone, 'RC');
  assert.equal(P(G, 0).hand.length, h + 2, 'twin drive on the first attack'); assert.equal(G.cards[v].rest, false, 'stood again'); assert.equal(G.stat(G.cards[v]).drive, 0); assert.equal(pw(G, v), 13000 + 10000);
  assert.equal(P(G, 0).damage.filter(i => !G.cards[i].faceup).length, 1);
  assert.equal(P(G, 1).damage.length, 4, 'the hit went through');
  attack(G, v);   // second attack: no drive check; the Divine Skill asks (opponent at 4+ damage, attacked twice)
  assert.equal(P(G, 0).hand.length, h + 2, 'no drive check with drive 0'); assert.equal(G.cards[v].rest, false, 'Divine Skill stood it'); assert.equal(G.stat(G.cards[v]).drive, 2);
  assert.equal(P(G, 0).damage.filter(i => !G.cards[i].faceup).length, 2); assert.equal(P(G, 0).divine, true);
  for (let k = 0; k < 3; k++) G.move(P(G, 1).damage[0], 'drop', { silent: true });   // keep the opponent alive for a third hit
  attack(G, v); assert.equal(P(G, 0).hand.length, h + 4); assert.equal(G.cards[v].rest, true, 'nothing stands it a fourth time');
});
test('Heavenwake: persona ride with another Varga, call from drop by total grade, attack skill, Divine Skill sets drive to 2', () => {
  // riding Heavenwake on a different grade 3 Varga is a persona ride
  const G0 = mk(N.varga); const hwc = sp(G0, 0, N.hw, 'hand'); assert.equal(G0.personaOk(G0.vg(0), G0.cards[hwc]), true);
  const other = plain(G0).find(c => c.owner === 0 && G0.grade(c) === 3); if (other) assert.equal(G0.personaOk(G0.vg(0), other), false);
  const G1 = mk(N.hw); const vr = sp(G1, 0, N.varga, 'hand'); assert.equal(G1.personaOk(G1.vg(0), G1.cards[vr]), true, 'and the other way round'); const hw2 = sp(G1, 0, N.hw, 'hand'); assert.equal(G1.personaOk(G1.vg(0), G1.cards[hw2]), true, 'same name as usual');
  // ACT: bind a Varga from hand or soul, call up to two from drop with different grades, total grade within the damage count
  const G = mk(N.hw); const v = G.vg(0).iid; dmg(G, 0, 3); dmg(G, 1, 2);
  const cost = sp(G, 0, N.varga, 'hand'); const g2 = sp(G, 0, N.fugen, 'drop'), g1 = sp(G, 0, N.touen, 'drop'), g1b = sp(G, 0, N.taijou, 'drop'), g3 = sp(G, 0, N.glaive, 'drop');
  refresh(G); G.answer(pick(G.pending, o => o.a === 'act' && o.iid === v));
  settle(G, d => { if (d.kind === 'cards' && /คอสต์/.test(d.title)) return pick(d, o => o.iid === cost); if (d.kind === 'cards' && /ใบที่ 1/.test(d.title)) { assert.ok(d.options.some(o => o.iid === g3), 'grade 3 fits three damage'); return pick(d, o => o.iid === g2); } if (d.kind === 'cards' && /ใบที่ 2/.test(d.title)) { assert.ok(!d.options.some(o => o.iid === g3), 'total grade would be 5'); assert.ok(d.options.some(o => o.iid === g1) && d.options.some(o => o.iid === g1b)); return pick(d, o => o.iid === g1); } if (d.kind === 'circle') return pick(d, o => o.circle === (G.at(0, 'BL') ? 'BR' : 'BL')); return null; });
  assert.equal(G.cards[cost].zone, 'bind'); assert.equal(G.cards[g2].zone, 'RC'); assert.equal(G.cards[g1].zone, 'RC'); assert.equal(G.cards[g3].zone, 'drop');
  refresh(G); assert.ok(!G.pending.options.some(o => o.a === 'act' && o.iid === v), 'once per turn');
  const fr = plainRG(G, 0, 'FL'); toBattle(G); const h = P(G, 0).hand.length;
  attack(G, v);
  assert.equal(G.cards[fr].zone, 'drop'); assert.equal(G.cards[v].rest, false); assert.equal(pw(G, v), 13000 + 10000 + 5000); assert.equal(G.stat(G.cards[v]).drive, 0); assert.equal(P(G, 0).hand.length, h + 2);
  dmg(G, 1, 4 - P(G, 1).damage.length);
  attack(G, v); assert.equal(G.cards[v].rest, false, 'Divine Skill'); assert.equal(G.stat(G.cards[v]).drive, 2);
});
test('Rakshasa: Malwyrm state when ridden from another Varga (persona ride is activated), both rows go, Divine Skill after standing by its own skill', () => {
  const G = mk(N.varga); dmg(G, 0, 4); const r = sp(G, 0, N.rak, 'hand'); const h = P(G, 0).hand.length;
  G.superRide(0, r, true); flush(G);
  assert.equal(G.hasState(G.cards[r], 'malwyrm'), true); assert.equal(P(G, 0).hand.length, h - 1 + 1, 'persona ride activated: drew a card'); assert.equal(!!G.tf.persona0, true);
  const st = sp(G, 0, N.storm, 'RC', 'BL'); assert.equal(pw(G, st), G.def(G.cards[st]).power + 5000, 'Storm Slasher: vanguard in the Malwyrm state');
  const f1 = plainRG(G, 0, 'FL'), b1 = plainRG(G, 1, 'BC'), f2 = plainRG(G, 1, 'FL');
  toBattle(G); const before = pw(G, r);
  attack(G, r, d => (d.kind === 'yesno' && /Storm Slasher|คอลกลับ/.test((d.title || '') + (d.sub || '')) ? [1] : null));
  assert.equal(G.cards[f1].zone, 'drop'); assert.equal(G.cards[f2].zone, 'drop'); assert.equal(G.cards[b1].zone, 'drop', 'back rows too'); assert.equal(G.cards[st].zone, 'drop');
  assert.equal(G.cards[r].rest, false); assert.equal(G.stat(G.cards[r]).drive, 0); assert.equal(pw(G, r), before + 10000);
  attack(G, r); assert.equal(G.cards[r].rest, false, 'Divine Skill: stood by its own AUTO this turn'); assert.equal(G.stat(G.cards[r]).drive, 2);
  // without the state nothing happens on attack
  const G2 = mk(N.rak); assert.equal(G2.hasState(G2.vg(0), 'malwyrm'), false); const x = plainRG(G2, 0, 'FL'); toBattle(G2); attack(G2, G2.vg(0).iid); assert.equal(G2.cards[x].zone, 'RC');
});
test('support: retired by the vanguard (Ushionimaru, Storm Slasher, Touen), cannot be retired (Obduracy Glaive, Valorous Blade), Taijou counts, Fugen makes the next counter-blast free', () => {
  const G = mk(N.varga); const v = G.vg(0).iid; dmg(G, 0, 2); dmg(G, 1, 1);
  for (let k = 0; k < 2; k++) G.move(P(G, 0).deck[0], 'soul', { silent: true });
  const ushi = sp(G, 0, N.ushi, 'RC', 'FL'), glaive = sp(G, 0, N.glaive, 'RC', 'FR'), tai = sp(G, 0, N.taijou, 'RC', 'BL'); const o1 = plainRG(G, 1, 'FL'), o2 = plainRG(G, 1, 'FR');
  assert.equal(pw(G, glaive), G.def(G.cards[glaive]).power + 10000); assert.equal(G.stat(G.cards[glaive]).boost, true, 'gets Boost with a Varga vanguard'); assert.equal(G.stat(G.cards[glaive]).noRet, true);
  toBattle(G); attack(G, v, d => (d.kind === 'cards' && /รับพลัง/.test(d.title) ? pick(d, o => o.iid === tai) : null));
  assert.equal(G.cards[ushi].zone, 'drop'); assert.equal(G.cards[glaive].zone, 'RC', 'cannot be retired by card effects'); assert.equal(G.cards[o1].zone, 'drop'); assert.equal(G.cards[o2].zone, 'drop');
  assert.equal(pw(G, tai), G.def(G.cards[tai]).power + 5000 * 2 + 5000, 'two rear-guards of the opponent retired this turn, plus Ushionimaru\'s +5000');
  // Valorous Blade from drop
  const G2 = mk(N.varga); const bl = sp(G2, 0, N.blade, 'drop'); G2.move(bl, 'RC', { pos: 'BL', reason: 'call' }); flush(G2);
  const s = G2.stat(G2.cards[bl]); assert.equal(s.intercept, true); assert.equal(s.backInt, true); assert.equal(s.noRet, true);
  G2.retire(bl, 'effect', G2.vg(0).iid); assert.equal(G2.cards[bl].zone, 'RC'); G2.retire(bl, 'battle'); assert.equal(G2.cards[bl].zone, 'drop', 'a battle still retires it');
  // Fugen: rode upon by a grade 3 Varga → called, the vanguard's next counter-blast costs one less
  const G3 = mk(null); const old = G3.vg(0); G3.move(old.iid, 'soul', { silent: true }); const fu = sp(G3, 0, N.fugen, 'VC', 'V'); const top = sp(G3, 0, N.varga, 'hand'); dmg(G3, 0, 1); dmg(G3, 1, 1);
  G3.superRide(0, top, true); flush(G3, d => (d.kind === 'option' ? [0] : d.kind === 'circle' ? pick(d, o => o.circle === 'BL') : null));
  assert.equal(G3.cards[fu].zone, 'RC'); assert.ok(G3.cards[top].cbLess && G3.cards[top].cbLess.key === 0);
  P(G3, 0).damage.forEach(i => { G3.cards[i].faceup = false; });   // no face-up damage: the skill is only possible through the discount
  toBattle(G3); attack(G3, top); assert.equal(pw(G3, top), 13000 + 10000, 'attack skill paid with the discount'); assert.equal(G3.cards[top].cbLess, null);
});
test('support: Nabilla from the drop zone, Zalva Dragnia, Rockbound Edge from drop, Aero Halberd, Mutawari, Rokusei, Yamihyouri', () => {
  const G = mk(N.varga); const v = G.vg(0).iid;
  // Zalva: +5000 and Boost on your turn while no same-named rear-guard shares its row
  const z = sp(G, 0, N.zalva, 'RC', 'FL'); assert.equal(pw(G, z), G.def(G.cards[z]).power + 5000); assert.equal(G.stat(G.cards[z]).boost, true); assert.equal(G.stat(G.cards[z]).noRetOwn, true);
  const z2 = sp(G, 0, N.zalva, 'RC', 'FR'); assert.equal(G.stat(G.cards[z]).noRetOwn, undefined, 'a second copy in the row'); G.move(z2, 'drop', { silent: true });
  G.retire(z, 'effect', v); assert.equal(G.cards[z].zone, 'RC', 'not retired by your own card effects');
  // Rockbound Edge: ACT from the drop zone
  const rk = sp(G, 0, N.rock, 'drop'); P(G, 0).energy = 5; refresh(G); G.answer(pick(G.pending, o => o.a === 'act' && o.iid === rk)); settle(G, d => (d.kind === 'circle' ? pick(d, o => o.circle === 'BL') : null));
  assert.equal(G.cards[rk].zone, 'RC'); assert.equal(P(G, 0).energy, 2);
  // Yamihyouri: counter-blast 1 or energy-blast 3 → look at five, call one
  dmg(G, 0, 1); const y = sp(G, 0, N.yami, 'hand'); refresh(G); G.answer(pick(G.pending, o => o.a === 'call' && o.iid === y && o.circle === 'BC')); const rcs = G.rcs(0).length;
  settle(G, d => (d.kind === 'circle' ? pick(d, o => o.circle === 'BR') : null)); assert.ok(G.rcs(0).length >= rcs, 'looked and called (or nothing fitting)'); assert.equal(pw(G, y), G.def(G.cards[y]).power + 5000);
  // opponent attacks the vanguard: Nabilla in the drop zone gives +10000 once per turn
  const G2 = mk(N.varga); const n1 = sp(G2, 0, N.nabilla, 'drop'), n2 = sp(G2, 0, N.nabilla, 'drop');
  run(G2, d => (d.kind === 'main' ? (G2.active === 1 ? undefined : pick(d, o => o.a === 'next')) : d.kind === 'attack' ? (G2.active === 1 ? undefined : pick(d, o => o.a === 'end')) : d.kind === 'ride' ? pick(d, o => o.a === 'skip') : null));
  if (G2.pending.kind === 'main') { G2.answer(pick(G2.pending, o => o.a === 'next')); run(G2, d => (d.kind === 'attack' ? undefined : null)); }
  const base = pw(G2, G2.vg(0).iid); G2.answer(pick(G2.pending, o => o.a === 'attack' && o.iid === G2.vg(1).iid && o.target === G2.vg(0).iid));
  run(G2, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(pw(G2, G2.vg(0).iid), base + 10000); assert.equal([G2.cards[n1].zone, G2.cards[n2].zone].sort().join(), 'bind,drop', 'only one copy per turn');
  // Aero Halberd stands when a front-row unit of its column is retired; Mutawari chains a second retire; Rokusei trades itself for a card
  const G3 = mk(N.varga); const v3 = G3.vg(0).iid; dmg(G3, 0, 2); G3.move(P(G3, 0).deck[0], 'soul', { silent: true });
  const fl = plainRG(G3, 0, 'FL'); const ah = sp(G3, 0, N.aero, 'RC', 'BL'); G3.cards[ah].rest = true; const ro = sp(G3, 0, N.rokusei, 'RC', 'BR'); const fr = plainRG(G3, 0, 'FR'); const mu = sp(G3, 0, N.muta, 'drop');
  const oF = plainRG(G3, 1, 'FL'), oB = plainRG(G3, 1, 'BL'); const h = P(G3, 0).hand.length;
  toBattle(G3); attack(G3, v3, d => (d.kind === 'cards' && /คอลัมน์เดียวกัน/.test(d.title) ? pick(d, o => o.iid === oB) : null));
  assert.equal(G3.cards[fl].zone, 'drop'); assert.equal(G3.cards[ah].rest, false, 'Aero Halberd stood'); assert.equal(G3.cards[oF].zone, 'drop'); assert.equal(G3.cards[oB].zone, 'drop', 'Mutawari retired the unit behind'); assert.equal(G3.cards[mu].zone, 'bind');
  assert.equal(G3.cards[ro].zone, 'drop', 'Rokusei retired itself'); assert.equal(P(G3, 0).hand.length, h + 2 + 1, 'twin drive + Rokusei\'s card'); void fr;
});

const spy = G => { const list = []; const am = G.addMod.bind(G); G.addMod = (i, m, u) => { list.push([i, m, u]); am(i, m, u); }; return list; };
test('Persona Shield ticket: Nasruddin takes one (once a turn), it is safe from discards on your turn, playing it gives +10000 and sends Nasruddin to (GC)', () => {
  const nas = no('Dragritter, Nasruddin'); const G = mk(N.varga); const v = G.vg(0).iid;
  assert.equal(G.def(G.vg(0)).persona, true); for (let k = 0; k < 2; k++) G.move(P(G, 0).deck[0], 'soul', { silent: true });
  const a = sp(G, 0, nas, 'hand'), b = sp(G, 0, nas, 'hand');
  const ticket = () => P(G, 0).hand.map(i => G.cards[i]).filter(c => c.ticket);
  refresh(G); G.answer(pick(G.pending, o => o.a === 'call' && o.iid === a && o.circle === 'BL')); settle(G);
  assert.equal(ticket().length, 1, 'one ticket in hand'); assert.equal(G.def(ticket()[0]).name, 'Persona Shield');
  refresh(G); G.answer(pick(G.pending, o => o.a === 'call' && o.iid === b && o.circle === 'BR')); settle(G);
  assert.equal(ticket().length, 1, 'not a second one in the same turn');
  const t = ticket()[0].iid; assert.ok(!G.handFor(0).includes(t), 'cannot be picked for a discard on your own turn'); assert.ok(P(G, 0).hand.includes(t));
  refresh(G); assert.ok(!G.pending.options.some(o => o.iid === t), 'not playable in the main phase');
  // the opponent's turn: their vanguard attacks mine
  run(G, d => (d.kind === 'main' ? (G.active === 1 ? undefined : pick(d, o => o.a === 'next')) : d.kind === 'attack' ? (G.active === 1 ? undefined : pick(d, o => o.a === 'end')) : d.kind === 'ride' ? pick(d, o => o.a === 'skip') : null));
  if (G.pending.kind === 'main') { G.answer(pick(G.pending, o => o.a === 'next')); run(G, d => (d.kind === 'attack' ? undefined : null)); }
  assert.ok(G.handFor(0).includes(t), 'on the opponent\'s turn it is an ordinary hand card');
  const base = pw(G, v); const soul = P(G, 0).soul.length;
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === G.vg(1).iid && o.target === v)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.ok(G.pending.options.some(o => o.a === 'blitz' && o.iid === t), 'offered in the guard step');
  const total = Object.values(G.cards).filter(c => !c.token).length;
  const mods = spy(G); const dmg0 = P(G, 0).damage.length; const onRC = () => [a, b].filter(i => G.cards[i].zone === 'RC').length; const rc0 = onRC(); assert.ok(rc0 >= 1);
  G.answer(pick(G.pending, o => o.a === 'blitz' && o.iid === t)); run(G, d => (!G.battle || d.kind === 'guard' ? undefined : d.kind === 'yesno' ? [0] : d.kind === 'option' ? [0] : null));
  assert.deepEqual(mods.filter(m => m[0] === v && m[2] === 'battle').map(m => m[1].power), [10000], 'the attacked vanguard got +10000 for that battle'); void base; void dmg0; assert.equal(G.cards[t].zone, 'gone', 'the ticket leaves the game'); assert.equal(P(G, 0).soul.length, soul - 1, 'one Nasruddin paid soul-blast 1…');
  assert.equal(onRC(), rc0 - 1, '…and moved to (GC) as a guardian (in the drop zone once the battle is over)'); assert.equal(P(G, 0).damage.length, dmg0, 'the attack did not hit'); assert.equal(Object.values(G.cards).filter(c => !c.token).length, total);
});
test('blitz order of the ticket cycle: +15000, going second it hands out a ticket once per fight; the ticket can follow in the same guard step', () => {
  const ori = no('Forefront Oriflamme'); const G = mk(null); const o1 = sp(G, 1, ori, 'hand'), o2 = sp(G, 1, ori, 'hand'); const v1 = G.vg(1).iid;
  toBattle(G); const base = pw(G, v1);
  G.answer(pick(G.pending, o => o.a === 'attack' && o.iid === G.vg(0).iid && o.target === v1)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.ok(G.pending.options.some(o => o.a === 'blitz' && o.iid === o1)); const mods = spy(G);
  G.answer(pick(G.pending, o => o.a === 'blitz' && o.iid === o1)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.equal(G.cards[o1].zone, 'removed'); assert.equal(pw(G, v1), base + 15000);
  const tk = P(G, 1).hand.map(i => G.cards[i]).find(c => c.ticket); assert.ok(tk, 'the fighter going second gets a ticket');
  assert.equal(G.pending.kind, 'guard'); assert.ok(G.pending.options.some(o => o.a === 'blitz' && o.iid === tk.iid), 'the ticket may be played as the additional order');
  assert.ok(!G.pending.options.some(o => o.a === 'blitz' && o.iid === o2), 'but no other order');
  G.answer(pick(G.pending, o => o.a === 'blitz' && o.iid === tk.iid)); run(G, d => (d.kind === 'guard' ? undefined : null));
  assert.deepEqual(mods.filter(m => m[0] === v1 && m[2] === 'battle').map(m => m[1].power), [15000, 10000]); assert.equal(G.cards[tk.iid].zone, 'gone');
});

/* ---------- whole fights with a Varga deck ---------- */
const row = name => VG.DB.byName[name];
const trig = VG.DB.rows.filter(r => r.nation === 'Dragon Empire' && r.trig && r.kind === 'v' && r.jno);
const T = k => trig.find(r => r.trig === k);
const sentinel = VG.DB.rows.find(r => r.nation === 'Dragon Empire' && r.jno && r.flags.includes('s') && !r.trig && r.auto && !r.part);
const g0 = VG.DB.rows.find(r => r.nation === 'Dragon Empire' && r.jno && r.kind === 'g');
export const vargaDeck = (top) => ({ id: 'varga', name: 'Varga', nation: 'Dragon Empire', ride: [g0.no, N.touen, N.fugen, top || N.hw],
  main: [[top || N.hw, 3], [N.varga, 2], [N.rak, 2], [N.shuura, 4], [N.fugen, 3], [N.nabilla, 3], [N.glaive, 2], [N.zalva, 3], [N.muta, 2], [N.touen, 3], [N.taijou, 2], [N.storm, 2], [N.aero, 2], [N.blade, 1], [N.rock, 2], [N.ushi, 2], [N.yami, 2], [N.rokusei, 2],
    [sentinel.no, 4], [T('crit').no, 8], [T('draw') ? T('draw').no : T('crit').no, 2], [T('front') ? T('front').no : T('crit').no, 2], [T('heal').no, 4]].map(([n, k]) => ({ no: n, n: k })) });
const games = +process.argv[2] || 60; let done = 0; const used = {};
for (let s = 1; s <= games; s++) {
  const tops = [N.hw, N.varga, N.rak]; const cfg = { seed: s * 6007, players: [{ name: 'A', deck: vargaDeck(tops[s % 3]) }, { name: 'B', deck: s % 2 ? vargaDeck(tops[(s + 1) % 3]) : D }] };
  for (const mode of ['random', 'bot']) {
    const G = new VG.Game(cfg).start(); const total = Object.values(G.cards).filter(c => !c.token).length; const r2 = mulb(s + 11); let steps = 0;
    while (G.pending) {
      G.answer(mode === 'random' ? randomAnswer(G, r2) : VG.bot(G));
      for (const e of G.events) if (e.t === 'ability') { const nm = VG.card(e.no).name; used[nm] = (used[nm] || 0) + 1; }
      G.events.length = 0;
      const live = Object.values(G.cards).filter(c => !c.token).length; if (live !== total) throw new Error('seed ' + cfg.seed + ': card count');
      for (const p of [0, 1]) if (!G.vg(p) && !G.over) throw new Error('seed ' + cfg.seed + ' ' + mode + ': no vanguard');
      if (++steps > 20000) throw new Error('seed ' + cfg.seed + ' ' + mode + ' did not finish');
    }
    done++;
  }
}
/* the Persona Shield ticket cycle mixed into the same deck: guard-step tickets, order limits, tickets leaving the game */
const TK = { nas: no('Dragritter, Nasruddin'), qaw: no('Dragritter, Qawsqozah'), sai: no('Elegant Flames Sword Dance "Sairei"') };
const ticketDeck = top => { const d = vargaDeck(top); const cut = { [N.nabilla]: 3, [N.blade]: 1, [N.storm]: 2, [N.rock]: 2, [N.ushi]: 2 }; d.main = d.main.filter(x => !cut[x.no]).concat([{ no: TK.nas, n: 4 }, { no: TK.qaw, n: 4 }, { no: TK.sai, n: 2 }]); d.id = 'vargaTicket'; return d; };
let tkDone = 0, tkPlayed = 0, tkGiven = 0;
for (let s = 1; s <= Math.max(10, games >> 1); s++) {
  const cfg = { seed: s * 9001, players: [{ name: 'A', deck: ticketDeck(N.hw) }, { name: 'B', deck: s % 2 ? ticketDeck(N.varga) : D }] };
  for (const mode of ['random', 'bot']) {
    const G = new VG.Game(cfg).start(); const total = Object.values(G.cards).filter(c => !c.token).length; const r2 = mulb(s + 5); let steps = 0;
    const give = G.giveTicket.bind(G); G.giveTicket = (...a) => { tkGiven++; return give(...a); };
    while (G.pending) {
      G.answer(mode === 'random' ? randomAnswer(G, r2) : VG.bot(G));
      for (const e of G.events) { if (e.t === 'ability') { const nm = VG.card(e.no).name; used[nm] = (used[nm] || 0) + 1; if (nm === 'Persona Shield') tkPlayed++; } }
      G.events.length = 0;
      if (Object.values(G.cards).filter(c => !c.token).length !== total) throw new Error('ticket seed ' + cfg.seed + ': card count');
      for (const c of Object.values(G.cards)) if (c.ticket && !['hand', 'gone', 'trigger'].includes(c.zone)) throw new Error('ticket seed ' + cfg.seed + ': a ticket in ' + c.zone);
      for (const p of [0, 1]) if (!G.vg(p) && !G.over) throw new Error('ticket seed ' + cfg.seed + ' ' + mode + ': no vanguard');
      if (++steps > 20000) throw new Error('ticket seed ' + cfg.seed + ' ' + mode + ' did not finish');
    }
    tkDone++;
  }
}
console.log('ticket fights ok ' + tkDone + ' · tickets handed out ' + tkGiven + ', played ' + tkPlayed + ' · ' + ['Dragritter, Nasruddin', 'Dragritter, Qawsqozah', 'Elegant Flames Sword Dance "Sairei"'].map(n => n.split(',').pop().trim() + ' ' + (used[n] || 0)).join(', '));
if (!tkGiven || !tkPlayed) { console.log('  FAIL the ticket was never handed out / played in whole fights'); process.exitCode = 1; }
const inDeck = new Set(vargaDeck().main.map(x => VG.card(x.no).name)); const hand = Object.keys(VG.HAND).filter(n => inDeck.has(n)); const never = hand.filter(n => inDeck.has(n) && !used[n] && !/Taijou|Obduracy/.test(n));   // those two only have continuous abilities
console.log('\n' + passed + ' passed, ' + fails.length + ' failed · Varga fights ok ' + done + ' · hand-written cards whose skill fired: ' + hand.filter(n => used[n]).length + '/' + hand.length + (never.length ? ' · never fired: ' + never.join(' | ') : ''));
if (fails.length) process.exitCode = 1;
