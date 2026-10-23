/* Heuristic bot: answers any pending decision. Deterministic (no randomness) so online replays stay in sync. */
(function (root) {
'use strict';
const VG = root.VG;
const { RCS, FRONT, BACK, BEHIND } = VG;

function keepValue(G, c, p) {
  const d = G.def(c); const vg = G.def(G.vg(p));
  if (d.sentinel) return 90;
  if (d.type === 'order') return 60;
  if (d.trigger === 'over') return 85;
  if (d.trigger === 'heal') return 55;
  if (d.trigger) return 50 + (d.shield || 0) / 1000;
  if (d.grade >= 3) return d.name === vg.name ? 70 : 30;
  return 35 + d.grade * 3 + (d.abilities && d.abilities.length ? 4 : 0);
}
const idxOf = (d, pred) => { for (let i = 0; i < d.options.length; i++) if (pred(d.options[i], i)) return i; return -1; };

function pickCards(G, d) {
  const p = d.player, opts = d.options; const hint = d.hint || '';
  const card = o => G.cards[o.iid];
  const order = opts.map((o, i) => i);
  const by = f => order.sort((a, b) => f(opts[b]) - f(opts[a]));
  let n = d.max;
  if (hint === 'mulligan') {
    const vgName = G.def(G.cards[G.players[p].ride.find(i => G.def(G.cards[i]).grade === 3)] || G.vg(p)).name;
    let g3 = 0; const out = [];
    opts.forEach((o, i) => { const dd = G.def(card(o)); if (dd.grade >= 3 && dd.type === 'unit') { if (dd.name !== vgName || g3 >= 1) out.push(i); else g3++; } });
    return out;
  }
  if (hint === 'discard' || hint === 'soulblast') { by(o => -keepValue(G, card(o), p)); n = d.min; }
  else if (hint === 'retireOpp' || hint === 'lockOpp') by(o => G.stat(card(o)).power + (FRONT.includes(card(o).pos) ? 3000 : 0));
  else if (hint === 'protect') { const t = G.battle && G.battle.targets[0]; by(o => (o.iid === t ? 1 : 0)); n = 1; }
  else if (hint === 'heal') by(o => (card(o).faceup ? 0 : 1));
  else if (hint === 'preferHand') by(o => (card(o).zone === 'hand' ? 1 : 0));
  else if (hint === 'bounce') by(o => { const c = card(o); return (c.token ? -100 : 0) + (c.rest ? 20 : 0) + G.grade(c); });
  else if (hint === 'buff' || hint === 'crit') {
    const mine = G.active === p; const b = G.battle;
    by(o => {
      const c = card(o); let s = 0;
      if (!mine) return c.zone === 'VC' ? 10 : 0;
      if (b && b.attacker === c.iid) s += hint === 'crit' ? (b.targetZone === 'VC' ? 8 : 0) : 3;
      if (!c.rest && FRONT.includes(c.pos)) s += hint === 'crit' ? 5 : 6;
      if (c.zone === 'VC') s += 1;
      return s;
    });
    n = 1;
  } else if (hint === 'reveal' || hint === 'max' || hint === 'search') n = d.max;
  if (n < d.min) n = d.min;
  return order.slice(0, n);
}

function pickCircle(G, d) {
  const p = d.player; const has = k => idxOf(d, o => o.circle === k);
  const empty = k => !G.at(p, k);
  const pref = d.hint === 'callTokenBack' ? ['BL', 'BR', 'BC', 'FL', 'FR'] : ['FL', 'FR', 'BL', 'BR', 'BC'];
  for (const k of pref) if (empty(k) && has(k) >= 0) return [has(k)];
  // no empty circle: replace a rested non-token front unit (it has already attacked), else skip if allowed
  for (const k of ['FL', 'FR']) { const c = G.at(p, k); if (c && c.rest && !c.token && has(k) >= 0) return [has(k)]; }
  if (d.min === 0) return [];
  for (const k of ['BC', 'BL', 'BR', 'FL', 'FR']) if (has(k) >= 0) return [has(k)];
  return [0];
}

function pickMain(G, d, keepN) {
  const p = d.player, P = G.players[p]; const o = d.options;
  /* half-automatic skills end in a manual step the bot cannot do: it leaves them alone */
  const act = idxOf(d, x => x.a === 'act' && !(G.getAb(G.cards[x.iid], x.idx) || {}).assist); if (act >= 0) return [act];
  const va = idxOf(d, x => x.a === 'varm'); if (va >= 0) return [va];   // Völundr arms
  const ord = idxOf(d, x => x.a === 'order' && !(G.def(G.cards[x.iid]).play || {}).assist); if (ord >= 0) return [ord];
  const calls = o.map((x, i) => [x, i]).filter(([x]) => x.a === 'call');
  const keep = keepN != null ? keepN : G.grade(G.vg(p)) >= 3 ? 3 : 4;
  if (calls.length && P.hand.length > keep) {
    const callable = [...new Set(calls.map(([x]) => x.iid))].map(i => G.cards[i]);
    const attackers = callable.filter(c => !G.def(c).sentinel && !G.def(c).trigger).sort((a, b) => G.def(b).power - G.def(a).power);
    for (const k of ['FL', 'FR']) if (!G.at(p, k)) { for (const c of attackers) { const f = calls.find(([x]) => x.iid === c.iid && x.circle === k); if (f) return [f[1]]; } }   // some cards may only be called to certain circles
    const boosters = callable.filter(c => G.def(c).boost && !G.def(c).sentinel && G.def(c).trigger !== 'heal' && G.def(c).trigger !== 'over').sort((a, b) => G.def(b).power - G.def(a).power);
    if (P.hand.length > keep + 1) for (const k of ['BC', 'BL', 'BR']) if (!G.at(p, k)) { for (const c of boosters) { const f = calls.find(([x]) => x.iid === c.iid && x.circle === k); if (f) return [f[1]]; } }
  }
  return [idxOf(d, x => x.a === 'next')];
}

function pickAttack(G, d) {
  const p = d.player; const o = d.options;
  const atkPower = c => { const b = G.at(p, BEHIND[c.pos]); return G.stat(c).power + (b && !b.rest && !b.locked && G.stat(b).boost ? G.stat(b).power : 0); };
  const canHit = c => { const pw = atkPower(c); return FRONT.some(k => { const t = G.at(1 - p, k); return t && !t.locked && G.stat(t).power <= pw; }); };
  const attackers = [...new Set(o.filter(x => x.a === 'attack').map(x => x.iid))].map(i => G.cards[i]).filter(canHit);
  if (!attackers.length) return [idxOf(d, x => x.a === 'end')];
  // vanguard first when it has an on-attack skill worth leading with, otherwise weakest rear first
  attackers.sort((a, b) => (a.zone === 'VC' ? -1 : 0) - (b.zone === 'VC' ? -1 : 0) || atkPower(a) - atkPower(b));
  const hasRearFirst = attackers.find(c => c.zone !== 'VC' && !G.at(p, BEHIND[c.pos]));
  const a = hasRearFirst || attackers[0];
  const pw = atkPower(a); const ov = G.vg(1 - p);
  let target = ov;
  if (pw < G.stat(ov).power) {
    const rear = ['FL', 'FR'].map(k => G.at(1 - p, k)).filter(c => c && !c.locked && G.stat(c).power <= pw).sort((x, y) => G.stat(y).power - G.stat(x).power)[0];
    if (rear) target = rear;
  }
  // the wanted target may be barred by a skill ("cannot attack the vanguard", "cannot be attacked"): take any target this attacker may hit, else any, else end
  let i = o.findIndex(x => x.a === 'attack' && x.iid === a.iid && x.target === target.iid);
  if (i < 0) i = o.findIndex(x => x.a === 'attack' && x.iid === a.iid && G.stat(G.cards[x.target]).power <= pw);
  if (i < 0) i = o.findIndex(x => x.a === 'attack' && x.iid === a.iid);
  if (i < 0) i = o.findIndex(x => x.a === 'attack');
  return [i >= 0 ? i : idxOf(d, x => x.a === 'end')];
}


function pickGuard(G, d) {
  const sel = pickGuard0(G, d); const m = d.handMin || 0; if (m < 2 || !G.guardBadSel(d, sel)) return sel;
  const hand = i => d.options[i].a === 'guard'; let n = sel.filter(hand).length; if (n === 0) return sel;
  // top up with the weakest hand cards, or give up the hand cards altogether
  const spare = d.options.map((o, i) => i).filter(i => hand(i) && !sel.includes(i) && !(G.def(G.cards[d.options[i].iid]).sentinel)).sort((a, b) => G.guardShield(G.cards[d.options[a].iid]) - G.guardShield(G.cards[d.options[b].iid]));
  const out = sel.slice(); while (n < m && spare.length) { out.push(spare.shift()); n++; }
  if (n >= m && !G.guardBadSel(d, out)) return out; const r = sel.filter(i => !hand(i) || (d.handNs && G.def(G.cards[d.options[i].iid]).sentinel)); return G.guardBadSel(d, r) ? sel.filter(i => !hand(i)) : r;
}
function pickGuard0(G, d) {
  const p = d.player, P = G.players[p]; const b = G.battle; const t = G.cards[d.target]; const a = G.cards[d.attacker];
  const need = d.atk - d.dfn; // shield must exceed this
  if (need < 0) return [];
  const dmg = P.damage.length; const crit = G.stat(a).crit; const isVG = t.zone === 'VC';
  const lethal = isVG && dmg + crit >= 6;
  const cards = d.options.map((o, i) => ({ i, o, c: G.cards[o.iid], sh: G.guardShield(G.cards[o.iid]), sent: !!G.def(G.cards[o.iid]).sentinel && (G.def(G.cards[o.iid]).abilities || []).length > 0 && o.a === 'guard' }));
  if (!isVG) {
    if (need >= 5000 || P.hand.length < 5) return [];
    const one = cards.filter(x => !x.sent && x.sh > need).sort((x, y) => x.sh - y.sh)[0];
    return one ? [one.i] : [];
  }
  // a Persona Shield ticket costs no hand card worth keeping: play it first from three damage on (the guard step comes back when the attack still hits)
  { const tk = cards.find(x => x.o.a === 'blitz' && x.c.ticket); if (tk && (lethal || dmg >= 3)) return [tk.i]; }
  const limit = lethal ? Infinity : [0, 0, 5000, 10000, 20000, 30000][Math.min(dmg, 5)];
  const margin = a.zone === 'VC' && lethal ? 10000 : 0;
  const want = need + 1 + margin;
  const normal = cards.filter(x => !x.sent && x.sh > 0).sort((x, y) => x.sh - y.sh);
  const total = normal.reduce((s, x) => s + x.sh, 0);
  const sent = cards.find(x => x.sent && (G.def(x.c).abilities[0].cost ? P.hand.length >= 2 : true));
  const pickNormal = target => {
    const out = []; let sum = 0; const pool = normal.slice();
    while (sum < target && pool.length) {
      const rest = target - sum;
      let k = pool.findIndex(x => x.sh >= rest); if (k < 0) k = pool.length - 1;
      sum += pool[k].sh; out.push(pool[k].i); pool.splice(k, 1);
    }
    return sum >= target ? out : null;
  };
  if (!lethal && need + 1 > limit) return [];
  if (sent && (need + 1 > 15000 || (lethal && total < want))) return [sent.i];
  let r = pickNormal(want) || pickNormal(need + 1);
  if (!r && sent) return [sent.i];
  return r || [];
}

/* levels: 'easy' plays loosely (a third of its choices are off, guards only to survive, wastes shields), 'normal' is the plain heuristic,
   'hard' reads the drive check: guards a dangerous vanguard attack with room for triggers, guards cheap hits more readily, keeps five cards before calling, attacks with the vanguard first. */
function chance(G) { let t = ((G.history.length + 1) * 0x9E3779B1 + (G.players[0].deck.length << 8) + G.turnNo) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }   // deterministic: same table → same answer (replays stay in sync)

function easy(G, d) {
  const r = chance(G); const p = d.player;
  switch (d.kind) {
    case 'main': { if (r < 0.35) return [idxOf(d, x => x.a === 'next')]; const calls = d.options.map((x, i) => [x, i]).filter(([x]) => x.a === 'call' && !G.at(p, x.circle)); if (calls.length && G.players[p].hand.length > 2 && r < 0.75) return [calls[Math.floor(r * 997) % calls.length][1]]; return pickMain(G, d); }
    case 'attack': { if (r < 0.15) return [idxOf(d, x => x.a === 'end')]; const at = d.options.map((x, i) => [x, i]).filter(([x]) => x.a === 'attack' && x.target === G.vg(1 - p).iid); if (at.length) return [at[Math.floor(r * 991) % at.length][1]]; return pickAttack(G, d); }
    case 'guard': {
      const t = G.cards[d.target], a = G.cards[d.attacker]; const P = G.players[p]; const need = d.atk - d.dfn; if (need < 0) return [];
      const lethal = t.zone === 'VC' && P.damage.length + G.stat(a).crit >= G.loseAt(p); if (!lethal && (t.zone !== 'VC' || r < 0.6)) return [];
      const out = []; let sum = 0; for (let i = 0; i < d.options.length && sum <= need; i++) { if (d.options[i].a !== 'guard' && d.options[i].a !== 'intercept') continue; out.push(i); sum += G.guardShield(G.cards[d.options[i].iid]); }   // first cards that do it, big or small
      return sum > need && !G.guardBadSel(d, out) ? out : [];
    }
    case 'mulligan': return [];
    case 'boost': return r < 0.3 ? [1] : [0];
  }
  return null;
}

function hardGuard(G, d) {
  const p = d.player, P = G.players[p]; const t = G.cards[d.target], a = G.cards[d.attacker]; const need = d.atk - d.dfn; if (need < 0) return [];
  if (t.zone !== 'VC') return pickGuard(G, d);
  const dmg = P.damage.length, lose = G.loseAt(p), crit = G.stat(a).crit; const drive = a.zone === 'VC' ? Math.max(0, G.stat(a).drive || 0) : 0;
  const lethal = dmg + crit >= lose; const near = dmg + crit + (drive ? 1 : 0) >= lose;   // a critical trigger in the drive check would finish it
  const cards = d.options.map((o, i) => ({ i, o, c: G.cards[o.iid], sh: G.guardShield(G.cards[o.iid]), sent: o.a === 'guard' && !!G.def(G.cards[o.iid]).sentinel && (G.def(G.cards[o.iid]).abilities || []).length > 0 }));
  { const tk = cards.find(x => x.o.a === 'blitz' && x.c.ticket); if (tk && (near || dmg >= 3)) return [tk.i]; }
  const normal = cards.filter(x => !x.sent && x.sh > 0).sort((x, y) => x.sh - y.sh); const total = normal.reduce((s, x) => s + x.sh, 0);
  const sent = cards.find(x => x.sent && (G.def(x.c).abilities[0].cost ? P.hand.length >= 2 : true));
  const pickN = target => { const out = []; let sum = 0; const pool = normal.slice(); while (sum < target && pool.length) { const rest = target - sum; let k = pool.findIndex(x => x.sh >= rest); if (k < 0) k = pool.length - 1; sum += pool[k].sh; out.push(pool[k].i); pool.splice(k, 1); } return sum >= target ? out : null; };
  if (lethal || near) {
    const want = need + 1 + 10000 * (lethal ? drive : Math.min(drive, 1));   // every drive check may add a trigger's +10000
    if (sent && (total < want || want > 20000)) return [sent.i];
    return pickN(want) || (sent ? [sent.i] : pickN(need + 1)) || [];
  }
  // not dangerous: take the damage early (it feeds counter-blasts and heal triggers), pay only cheap guards later on
  if (dmg <= 1) return [];
  const cheap = dmg >= lose - 2 ? 30000 : dmg >= lose - 3 ? 20000 : 10000;   // tuned on bot-vs-bot games (test/botlevels.mjs)
  if (need + 1 > cheap || P.hand.length <= 3) return [];
  return pickN(need + 1) || [];
}

function hardAttack(G, d) {
  const p = d.player; const v = G.vg(p); const ov = G.vg(1 - p);
  const vi = d.options.findIndex(x => x.a === 'attack' && x.iid === v.iid && x.target === ov.iid);   // the vanguard first: its drive triggers can still go to rear-guards that have not attacked
  if (vi >= 0) { const b = G.at(p, 'BC'); const pw = G.stat(v).power + (b && !b.rest && G.stat(b).boost ? G.stat(b).power : 0); if (pw >= G.stat(ov).power) return [vi]; }
  return pickAttack(G, d);
}

function bot(G, d) {
  switch (d.kind) {
    case 'mulligan': case 'cards': return pickCards(G, d);
    case 'circle': return pickCircle(G, d);
    case 'main': return pickMain(G, d);
    case 'attack': return pickAttack(G, d);
    case 'guard': return pickGuard(G, d);
    case 'ride': { let i = idxOf(d, o => o.a === 'rideDeck'); if (i < 0) i = idxOf(d, o => o.a === 'ride' && o.persona); if (i < 0) i = idxOf(d, o => o.a === 'ride' && G.grade(G.cards[o.iid]) > G.grade(G.vg(d.player))); if (i < 0) i = idxOf(d, o => o.a === 'skip'); return [i]; }
    case 'yesno': { if (d.idx != null && d.iid != null) { const ab = G.getAb(G.cards[d.iid], d.idx); if (ab && ab.assist) return [1]; } return [0]; }
    case 'boost': return d.prefer === 'no' ? [1] : [0];   // keep the vanguard unboosted for its own multi-boost skill
    case 'option': case 'order': return [0];
    default: return d.min > 0 ? d.options.slice(0, d.min).map((o, i) => i) : [];
  }
}
VG.BOT_LEVELS = ['easy', 'normal', 'hard'];
VG.bot = function (G, level) {
  const d = G.pending; if (!d) return null;
  level = level || VG.botLevel || 'normal';
  if (level === 'easy') { const r = easy(G, d); if (r) return r; }
  if (level === 'hard') { if (d.kind === 'guard') return hardGuard(G, d); if (d.kind === 'attack') return hardAttack(G, d); if (d.kind === 'main') return pickMain(G, d, 5); }   // keeps five cards for guarding before calling more
  return bot(G, d);
};
VG.keepValue = keepValue;
})(typeof globalThis !== 'undefined' ? globalThis : this);
