/* Card definitions + ability scripts. Stats come from the official card list; effect descriptions (text) are our own Thai summaries. */
(function (root) {
'use strict';
const VG = root.VG;
const { CB, SB, EB, discard, soulSelf } = VG.cost;
const C = VG.CARDS;

function unit(no, name, nation, race, grade, power, shield, extra) {
  C[no] = Object.assign({
    no, name, type: 'unit', nation, race, grade, power, shield, crit: 1,
    boost: grade <= 1, intercept: grade === 2, drive: grade >= 3 ? 2 : 1, persona: grade === 3,
    text: [], abilities: [],
  }, extra || {});
}
function trigger(no, name, nation, race, kind, shield, extra) {
  unit(no, name, nation, race, 0, 5000, shield, Object.assign({ trigger: kind, triggerPower: 10000, text: [TRIG_TEXT[kind]] }, extra || {}));
}
const TRIG_TEXT = {
  crit: 'คริติคอลทริกเกอร์: เลือกยูนิทของคุณ 1 ใบ คริติคอล +1 และเลือกยูนิท 1 ใบ พลัง +10000 จนจบเทิร์น',
  draw: 'ดรอว์ทริกเกอร์: จั่ว 1 ใบ และเลือกยูนิท 1 ใบ พลัง +10000 จนจบเทิร์น',
  front: 'ฟรอนต์ทริกเกอร์: ยูนิทแถวหน้าของคุณทั้งหมด พลัง +10000 จนจบเทิร์น',
  heal: 'ฮีลทริกเกอร์: เลือกยูนิท 1 ใบ พลัง +10000 จนจบเทิร์น และถ้าดาเมจของคุณมากกว่าหรือเท่ากับคู่ต่อสู้ ฮีลดาเมจ 1 ใบ (ใส่ได้ไม่เกิน 4 ใบ)',
};

/* ---------- shared pieces ---------- */
C['DZ-TD01/005EN'] = {
  no: 'DZ-TD01/005EN', name: 'Energy Generator', type: 'crest', nation: null, race: null, grade: null,
  text: [
    'AUTO (ไรด์เด็ค): เมื่อคุณไรด์ นำการ์ดนี้ไปวางในเครสต์โซน ถ้าคุณเล่นทีหลัง เอเนอร์จีชาร์จ 3',
    'CONT: มีเอเนอร์จีได้สูงสุด 10',
    'AUTO: ตอนเริ่มไรด์เฟสของคุณ เอเนอร์จีชาร์จ 3',
    'ACT (1/เทิร์น): เอเนอร์จีบลาสต์ 7 → จั่ว 1 ใบ',
  ],
  abilities: [
    { type: 'auto', on: 'toCrest', label: 'เล่นทีหลัง: เอเนอร์จีชาร์จ 3', cond: (G, me) => G.first !== me.owner, *run(G, me) { G.energyCharge(me.owner, 3); } },
    { type: 'auto', on: 'ridePhaseStart', who: 'any', zone: 'crest', label: 'เอเนอร์จีชาร์จ 3', match: (G, me, e) => e.p === me.owner, *run(G, me) { G.energyCharge(me.owner, 3); } },
    { type: 'act', zone: 'crest', limit: 'turn', label: 'เอเนอร์จีบลาสต์ 7: จั่ว 1 ใบ', cost: [EB(7)], *run(G, me) { G.draw(me.owner, 1); } },
  ],
};
const sentinelText = 'CONT: เซนทิเนล (ใส่ได้ไม่เกิน 4 ใบ)';
const starterAbility = { type: 'auto', on: 'rodeUpon', label: 'เล่นทีหลัง: จั่ว 1 ใบ', cond: (G, me) => G.first !== me.owner, *run(G, me) { G.draw(me.owner, 1); } };
const starterText = 'AUTO: เมื่อยูนิทนี้ถูกไรด์ทับ ถ้าคุณเล่นทีหลัง จั่ว 1 ใบ';

/* ================= Lyrical Monasterio — Artisaria ================= */
const LM = 'Lyrical Monasterio';
const TOKEN_SA = 'TOKEN/ShadowArmy';
C[TOKEN_SA] = { no: TOKEN_SA, name: 'Shadow Army', type: 'token', nation: null, race: 'Shadow Army', grade: 1, power: 15000, shield: null, crit: 1, boost: true, drive: 1, text: ['โทเคน: เมื่อออกจากสนามจะหายไป ใส่ในเด็คไม่ได้'], abilities: [] };
C['TOKEN/Plant'] = { no: 'TOKEN/Plant', name: 'Plant', type: 'token', nation: null, race: 'Plant', grade: 0, power: 5000, shield: null, crit: 1, boost: true, drive: 1, text: ['โทเคน: เมื่อออกจากสนามจะหายไป ใส่ในเด็คไม่ได้'], abilities: [] };

const ssCount = (G, p) => G.orderZone(p, d => d.race === 'Sound System').length;
const artisariaVG = (G, p, minGrade) => { const d = G.def(G.vg(p)); return d.name.includes('Artisaria') && d.grade >= (minGrade || 0); };
const leftRCOnOwnTurn = (G, me, e) => e.from === 'RC' && G.active === me.owner && (e.wanted === 'hand' || e.reason === 'retire');

unit('DZ-BT07/016EN', 'PolyPhonicOverDrive, Artisaria', LM, 'Cyberoid', 3, 13000, null, {
  text: [
    'CONT (VC): ในเทิร์นของคุณ ถ้าออเดอร์โซนมี Sound System 2 ใบขึ้นไป ยูนิทนี้คริติคอล +1',
    'ACT (VC) 1/เทิร์น: เอเนอร์จีบลาสต์ 2 → เลือก Sound System 1 ใบจากมือหรือดรอปไปวางในออเดอร์โซน ถ้าวางจากมือ จั่ว 1 ใบ',
    'AUTO (VC) 1/เทิร์น: เมื่อยูนิทนี้โจมตี เคาน์เตอร์บลาสต์ 1 → คอล Shadow Army โทเคนได้สูงสุด 1 ใบต่อ Sound System 1 ใบในออเดอร์โซน และยูนิทแถวหน้าทั้งหมดพลัง +5000 ต่อ Sound System ทุก 2 ใบ จนจบเทิร์น',
  ],
  abilities: [
    { type: 'cont', zone: 'VC', cond: (G, me) => G.active === me.owner && ssCount(G, me.owner) >= 2, mod: { crit: 1 } },
    {
      type: 'act', zone: 'VC', limit: 'turn', label: 'วาง Sound System ลงออเดอร์โซน', cost: [EB(2)],
      cond: (G, me) => { const P = G.players[me.owner]; return [...P.hand, ...P.drop].some(i => G.def(G.cards[i]).race === 'Sound System'); },
      *run(G, me) {
        const p = me.owner, P = G.players[p];
        const c = [...P.hand, ...P.drop].filter(i => G.def(G.cards[i]).race === 'Sound System');
        const sel = yield* G.chooseCards(p, c, { min: 1, max: 1, title: 'เลือก Sound System จากมือหรือดรอป (จากมือจะได้จั่ว 1 ใบ)', hint: 'preferHand', zone: 'mixed', noAuto: c.length > 1 });
        if (!sel[0]) return;
        const fromHand = G.cards[sel[0]].zone === 'hand';
        G.log('วาง ' + G.name(G.cards[sel[0]]) + ' ลงออเดอร์โซน', p);
        G.move(sel[0], 'order', { reason: 'effect' });
        if (fromHand) G.draw(p, 1);
      },
    },
    {
      type: 'auto', on: 'attack', zone: 'VC', limit: 'turn', label: 'คอล Shadow Army + แถวหน้าพลังเพิ่ม', cost: [CB(1)],
      *run(G, me) {
        const p = me.owner; const n = ssCount(G, p);
        for (let i = 0; i < n; i++) { const t = yield* G.callToken(p, TOKEN_SA, { optional: true, title: 'คอล Shadow Army โทเคน (' + (i + 1) + '/' + n + ') — เลือกเซอร์เคิล หรือข้าม' }); if (!t) break; }
        const k = Math.floor(ssCount(G, p) / 2);
        if (k > 0) for (const u of G.front(p)) G.addMod(u.iid, { power: 5000 * k }, 'turn');
      },
    },
  ],
});

unit('DZ-BT07/143EN', 'Sing to the Sky, Rachroea', LM, 'Warbeast', 3, 13000, null, {
  text: [
    'AUTO (RC): เมื่อยูนิทนี้โจมตี พลัง +5000 ต่อ Sound System 1 ใบในออเดอร์โซน จนจบแบทเทิลนั้น',
    'AUTO: เมื่อยูนิทนี้ถูกส่งกลับมือจาก RC หรือถูกรีไทร์จาก RC ในเทิร์นของคุณ ถ้าแวนการ์ดมีชื่อ "Artisaria" โซลบลาสต์ 1 → เลือกยูนิทของคุณ 1 ใบ พลัง +5000 จนจบเทิร์น',
  ],
  abilities: [
    { type: 'auto', on: 'attack', zone: 'RC', label: 'พลัง +5000 ต่อ Sound System', cond: (G, me) => ssCount(G, me.owner) > 0, *run(G, me) { G.addMod(me.iid, { power: 5000 * ssCount(G, me.owner) }, 'battle'); } },
    {
      type: 'auto', on: 'leaveRC', label: 'ออกจาก RC: ยูนิท 1 ใบพลัง +5000', match: leftRCOnOwnTurn, cond: (G, me) => artisariaVG(G, me.owner), cost: [SB(1)],
      *run(G, me) { yield* G.givePower(me.owner, 5000, 'เลือกยูนิทรับพลัง +5000'); },
    },
  ],
});

unit('DZ-BT08/017EN', 'AngelicEcho, Luminoel', LM, 'Angel', 2, 10000, 5000, {
  text: [
    'AUTO: เมื่อวางบน RC เปิดเผยการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Artisaria" จากมือได้สูงสุด 1 ใบ ถ้าเปิดเผย หรือแวนการ์ดเป็น "Artisaria" เกรด 3 ขึ้นไป เอเนอร์จีบลาสต์ 2 → คอล Shadow Army โทเคน 1 ใบ และโทเคนนั้นโจมตีไม่ได้จนจบเทิร์น',
    'AUTO: เมื่อวางบน GC ถ้าแวนการ์ดเป็น "Artisaria" เกรด 3 ขึ้นไป รีไทร์ Shadow Army โทเคน 1–2 ใบ → ชิลด์ +10000 ต่อโทเคนที่รีไทร์ จนจบแบทเทิลนั้น',
  ],
  abilities: [
    {
      type: 'auto', on: 'placeRC', label: 'คอล Shadow Army (โจมตีไม่ได้)',
      *run(G, me) {
        const p = me.owner, P = G.players[p];
        let ok = artisariaVG(G, p, 3);
        if (!ok) {
          const c = P.hand.filter(i => { const d = G.def(G.cards[i]); return d.name.includes('Artisaria') && d.grade >= 3; });
          if (!c.length || !EB(2).can(G, me)) return;
          const sel = yield* G.chooseCards(p, c, { min: 0, max: 1, title: 'เปิดเผย "Artisaria" เกรด 3+ จากมือเพื่อใช้สกิล (ไม่บังคับ)', hint: 'reveal', zone: 'hand', noAuto: true });
          if (!sel.length) return;
          G.ev('reveal', { iid: sel[0], p }); G.log('เปิดเผย ' + G.name(G.cards[sel[0]]), p);
          ok = true;
        }
        if (!(yield* G.payOptional(me, [EB(2)], 'Luminoel: คอล Shadow Army โทเคน?'))) return;
        const t = yield* G.callToken(p, TOKEN_SA, { hint: 'callTokenBack' });
        if (t) G.addMod(t, { cantAttack: true }, 'turn');
      },
    },
    {
      type: 'auto', on: 'placeGC', label: 'รีไทร์โทเคน: ชิลด์ +10000 ต่อใบ', cond: (G, me) => artisariaVG(G, me.owner, 3),
      cost: [{
        label: 'รีไทร์ Shadow Army โทเคน 1–2 ใบ',
        can: (G, me) => G.rcs(me.owner).some(c => c.no === TOKEN_SA),
        *pay(G, me) {
          const c = G.rcs(me.owner).filter(x => x.no === TOKEN_SA).map(x => x.iid);
          const sel = yield* G.chooseCards(me.owner, c, { min: 1, max: 2, title: 'เลือก Shadow Army โทเคนที่จะรีไทร์ (1–2 ใบ)', hint: 'max', zone: 'field', noAuto: true });
          for (const i of sel) G.retire(i, 'cost');
          return sel.length;
        },
      }],
      *run(G, me, e, ctx) { G.addMod(me.iid, { shield: 10000 * ctx.paid[0] }, 'battle'); },
    },
  ],
});

unit('DZ-BT07/018EN', 'DevilishFlanger, Lufur', LM, 'Demon', 2, 10000, 5000, {
  text: [
    'AUTO: เมื่อวางบน RC หรือ GC ถ้าออเดอร์โซนมี Sound System ยูนิทนี้พลัง +5000 / ชิลด์ +5000 จนจบเทิร์น',
    'AUTO: เมื่อยูนิทนี้ถูกส่งกลับมือจาก RC หรือถูกรีไทร์จาก RC ในเทิร์นของคุณ ถ้าแวนการ์ดเป็น "Artisaria" เกรด 3 ขึ้นไป เคาน์เตอร์บลาสต์ 1 → จั่ว 1 ใบ',
  ],
  abilities: [
    { type: 'auto', on: ['placeRC', 'placeGC'], label: 'พลัง/ชิลด์ +5000', cond: (G, me) => ssCount(G, me.owner) > 0, *run(G, me) { G.addMod(me.iid, { power: 5000, shield: 5000 }, 'turn'); } },
    { type: 'auto', on: 'leaveRC', label: 'ออกจาก RC: จั่ว 1 ใบ', match: leftRCOnOwnTurn, cond: (G, me) => artisariaVG(G, me.owner, 3), cost: [CB(1)], *run(G, me) { G.draw(me.owner, 1); } },
  ],
});

unit('DZ-BT07/053EN', 'Trailing Notes, Reverbera', LM, 'Dragoroid', 1, 8000, 5000, {
  text: [
    'CONT (RC): ในเทิร์นของคุณ ถ้าออเดอร์โซนมี Sound System ยูนิทนี้พลัง +5000',
    'AUTO (RC): ตอนจบแบทเทิลที่ยูนิทนี้บูสต์ ถ้าออเดอร์โซนมี Sound System นำยูนิทนี้เข้าโซล → เลือกเรียร์การ์ดของคุณ 1 ใบ ส่งกลับมือ',
  ],
  abilities: [
    { type: 'cont', zone: 'RC', cond: (G, me) => G.active === me.owner && ssCount(G, me.owner) > 0, mod: { power: 5000 } },
    {
      type: 'auto', on: 'battleEnd', who: 'any', zone: 'RC', label: 'เข้าโซล: ส่งเรียร์การ์ดกลับมือ', match: (G, me, e) => e.booster === me.iid,
      cond: (G, me) => ssCount(G, me.owner) > 0, cost: [soulSelf()],
      *run(G, me) {
        const p = me.owner; const c = G.rcs(p).map(x => x.iid);
        const sel = yield* G.chooseCards(p, c, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดที่จะส่งกลับมือ', hint: 'bounce', zone: 'field', noAuto: true });
        if (sel[0]) { G.log('ส่ง ' + G.name(G.cards[sel[0]]) + ' กลับมือ', p); G.move(sel[0], 'hand', { reason: 'bounce' }); }
      },
    },
  ],
});

unit('DZ-BT07/094EN', 'Best Served Hot, Warmia', LM, 'Human', 1, 6000, 0, {
  sentinel: true,
  text: [sentinelText, 'AUTO: เมื่อวางบน GC เลือกยูนิทของคุณ 1 ใบ ยูนิทนั้นจะไม่ถูกโจมตีโดนจนจบแบทเทิลนั้น ถ้ามือมี 2 ใบขึ้นไป ทิ้งการ์ดจากมือ 1 ใบ'],
  abilities: [{
    type: 'auto', on: 'placeGC', label: 'เพอร์เฟกต์การ์ด',
    *run(G, me) {
      const p = me.owner;
      const u = yield* G.chooseUnit(p, 'เลือกยูนิทที่จะไม่ถูกโจมตีโดน', { hint: 'protect' });
      if (u) { G.addMod(u, { cantBeHit: true }, 'battle'); G.log(G.name(G.cards[u]) + ' จะไม่ถูกโจมตีโดนในแบทเทิลนี้', p); }
      const P = G.players[p];
      if (P.hand.length >= 2) {
        const sel = yield* G.chooseCards(p, P.hand.slice(), { min: 1, max: 1, title: 'ทิ้งการ์ดจากมือ 1 ใบ', hint: 'discard', zone: 'hand' });
        if (sel[0]) G.move(sel[0], 'drop', { reason: 'discard' });
      }
    },
  }],
});

unit('DZ-BT02/066EN', 'A Ballad of My Own Someday, Siska', LM, 'Elf', 1, 8000, 5000, {
  text: ['AUTO: เมื่อวางบน RC ถ้าไม่มีเรียร์การ์ดชื่อเดียวกันใบอื่น เลือกทำ 1 อย่าง — (1) ถ้ามียูนิท 4 ใบขึ้นไป: เคาน์เตอร์บลาสต์ 1 → จั่ว 1 ใบ (2) เอเนอร์จีบลาสต์ 3 → ยูนิทนี้พลัง +10000 จนจบเทิร์น'],
  abilities: [{
    type: 'auto', on: 'placeRC', label: 'เลือก: จั่ว หรือ พลัง +10000',
    cond: (G, me) => !G.rcs(me.owner).some(c => c.iid !== me.iid && G.ename(c) === G.ename(me)),
    *run(G, me) {
      const p = me.owner; const opts = [];
      if (G.units(p).length >= 4 && CB(1).can(G, me)) opts.push({ id: 'draw', label: 'เคาน์เตอร์บลาสต์ 1 → จั่ว 1 ใบ' });
      if (EB(3).can(G, me)) opts.push({ id: 'power', label: 'เอเนอร์จีบลาสต์ 3 → พลัง +10000' });
      if (!opts.length) return;
      opts.push({ id: 'none', label: 'ไม่ใช้' });
      const a = yield* G.chooseOption(p, 'Siska: เลือกเอฟเฟกต์', opts, { iid: me.iid });
      if (a === 'draw') { yield* CB(1).pay(G, me); G.draw(p, 1); }
      else if (a === 'power') { yield* EB(3).pay(G, me); G.addMod(me.iid, { power: 10000 }, 'turn'); }
    },
  }],
});

unit('D-LBT01/H19EN', 'Fulfill Sweets, Angelma', LM, 'Ghost', 1, 6000, 5000, {
  text: ['AUTO (RC แถวหลัง) 1/เทิร์น: เมื่อยูนิทอื่นของคุณถูกวางบน RC ในแบทเทิลเฟสของคุณ โซลบลาสต์ 2 → จั่ว 1 ใบ'],
  abilities: [{
    type: 'auto', on: 'placeRC', who: 'any', zone: 'backRC', limit: 'turn', label: 'โซลบลาสต์ 2: จั่ว 1 ใบ',
    match: (G, me, e) => e.iid !== me.iid && e.p === me.owner && G.phase === 'battle' && G.active === me.owner,
    cost: [SB(2)], *run(G, me) { G.draw(me.owner, 1); },
  }],
});

trigger('DZ-BT07/025EN', 'Greatest Star, Esteranza', LM, 'Human', 'over', 50000, {
  triggerPower: 100000000,
  text: [
    'โอเวอร์ทริกเกอร์ (ใส่ได้ 1 ใบ): เมื่อเปิดเป็นทริกเกอร์ นำการ์ดนี้ออกจากเกม จั่ว 1 ใบ เลือกยูนิท 1 ใบ พลัง +100 ล้านจนจบเทิร์น',
    'เอฟเฟกต์เพิ่มเติม (เฉพาะไดรฟ์เช็ค): ตลอดไฟท์นี้ ในเทิร์นของคุณ เรียร์การ์ดของคุณทั้งหมดพลัง +10000',
  ],
  *overEffect(G, p) {
    G.players[p].effects.push({ until: 'fight', label: 'Esteranza: เรียร์การ์ด +10000 ในเทิร์นของคุณ', aura: (G2, c) => (c.owner === p && c.zone === 'RC' && G2.active === p ? { power: 10000 } : null) });
  },
});
trigger('DZ-LBT01/089EN', 'Glutton, Nora', LM, 'Ghost', 'crit', 15000);
trigger('DZ-LBT01/090EN', 'Fluffy Lady, Godelieve', LM, 'Mermaid', 'crit', 15000);
trigger('DZ-LBT01/093EN', 'Spiritoso, Richalda', LM, 'Ghost', 'front', 15000);
trigger('DZ-LBT01/095EN', 'Languid Relaxation, Marguerite', LM, 'Ghost', 'heal', 15000);

function soundSystem(no, name, text, ability) {
  C[no] = { no, name, type: 'order', orderKind: 'set', nation: LM, race: 'Sound System', grade: 3, noPlay: true,
    text: ['CONT: การ์ดนี้เพลย์ไม่ได้ และจะวางในออเดอร์โซนได้ด้วยสกิลของยูนิทที่มีชื่อ "Artisaria" เท่านั้น', text], abilities: [ability] };
}
soundSystem('DZ-BT07/095EN', 'Shout in Shadow', 'AUTO: เมื่อการ์ดนี้ถูกวางในออเดอร์โซน จั่ว 1 ใบ และคอล Shadow Army โทเคนได้สูงสุด 1 ใบ', {
  type: 'auto', on: 'toOrder', label: 'จั่ว 1 ใบ + คอล Shadow Army',
  *run(G, me) { G.draw(me.owner, 1); yield* G.callToken(me.owner, TOKEN_SA, { optional: true, title: 'Shout in Shadow: คอล Shadow Army โทเคน — เลือกเซอร์เคิล หรือข้าม' }); },
});
soundSystem('DZ-BT07/096EN', 'MegaЯoManiA', 'AUTO: เมื่อการ์ดนี้ถูกวางในออเดอร์โซน ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป เลือกเรียร์การ์ดคู่ต่อสู้ได้สูงสุด 1 ใบ แล้วล็อก', {
  type: 'auto', on: 'toOrder', label: 'ล็อกเรียร์การ์ดคู่ต่อสู้',
  cond: (G, me) => G.grade(G.vg(1 - me.owner)) >= 3 && G.rcs(1 - me.owner).length > 0,
  *run(G, me) {
    const u = yield* G.chooseUnit(me.owner, 'เลือกเรียร์การ์ดคู่ต่อสู้ที่จะล็อก (ไม่บังคับ)', { side: 1 - me.owner, rearOnly: true, min: 0, hint: 'lockOpp' });
    if (u) G.lock(u);
  },
});

function rideLine(no, name, race, grade, fromName) {
  unit(no, name, LM, race, grade, grade === 2 ? 10000 : 8000, 5000, {
    text: ['AUTO: เมื่อวางโดยไรด์ทับ "' + fromName + '" เปิดเผยการ์ดเกรด 3 ที่มีชื่อ "Artisaria" จากไรด์เด็ค → ค้นเด็คหา Sound System ได้สูงสุด 1 ใบ เปิดเผยแล้วขึ้นมือ แล้วสับเด็ค'],
    abilities: [{
      type: 'auto', on: 'placeVC', label: 'ค้นหา Sound System', match: (G, me, e) => e.rideFrom === fromName,
      cost: [{
        label: 'เปิดเผย "Artisaria" เกรด 3 จากไรด์เด็ค',
        can: (G, me) => G.players[me.owner].ride.some(i => { const d = G.def(G.cards[i]); return d.grade === 3 && d.name.includes('Artisaria'); }),
        *pay(G, me) { const i = G.players[me.owner].ride.find(x => { const d = G.def(G.cards[x]); return d.grade === 3 && d.name.includes('Artisaria'); }); G.ev('reveal', { iid: i, p: me.owner }); return i; },
      }],
      *run(G, me) { yield* G.searchDeck(me.owner, d => d.race === 'Sound System', { max: 1, title: 'เลือก Sound System จากเด็คขึ้นมือ (สูงสุด 1 ใบ)' }); },
    }],
  });
}
rideLine('DZ-BT07/145EN', 'WitchingVibrato, Lifel', 'Elf', 2, 'DynamicExciter, Eastiera');
rideLine('DZ-BT07/147EN', 'DynamicExciter, Eastiera', 'Warbeast', 1, 'HeapUpOctaver, Proutta');
unit('DZ-BT07/149EN', 'HeapUpOctaver, Proutta', LM, 'Human', 0, 6000, 5000, { text: [starterText], abilities: [starterAbility] });

/* ================= Dragon Empire — DZ Trial Deck 01 ================= */
const DE = 'Dragon Empire';
unit('DZ-TD01/001EN', 'Roaring Thunder Dragon, Triumph Dragon', DE, 'Thunder Dragon', 3, 13000, null, {
  text: [
    'ACT (VC) 1/เทิร์น: เคาน์เตอร์บลาสต์ 1 → ค้นเด็คหาการ์ดชื่อเดียวกับยูนิทนี้ได้สูงสุด 1 ใบ เปิดเผยแล้วขึ้นมือ สับเด็ค และยูนิทนี้พลัง +10000 จนจบเทิร์น',
    'AUTO (VC): เมื่อยูนิทนี้โจมตีแวนการ์ด เอเนอร์จีบลาสต์ 4 → เลือกเรียร์การ์ดคู่ต่อสู้ 1 ใบ รีไทร์ และยูนิทนี้พลัง +5000 / คริติคอล +1 จนจบแบทเทิลนั้น',
  ],
  abilities: [
    {
      type: 'act', zone: 'VC', limit: 'turn', label: 'ค้นหาใบชื่อเดียวกัน + พลัง +10000', cost: [CB(1)],
      *run(G, me) { yield* G.searchDeck(me.owner, d => d.name === G.ename(me), { max: 1, title: 'เลือก Triumph Dragon จากเด็คขึ้นมือ (สูงสุด 1 ใบ)' }); G.addMod(me.iid, { power: 10000 }, 'turn'); },
    },
    {
      type: 'auto', on: 'attack', zone: 'VC', label: 'รีไทร์เรียร์การ์ด + พลัง/คริติคอล', match: (G, me, e) => e.targetZone === 'VC', cost: [EB(4)],
      *run(G, me) {
        const u = yield* G.chooseUnit(me.owner, 'เลือกเรียร์การ์ดคู่ต่อสู้ที่จะรีไทร์', { side: 1 - me.owner, rearOnly: true, hint: 'retireOpp' });
        if (u) { G.log('รีไทร์ ' + G.name(G.cards[u]), me.owner); G.retire(u, 'effect', me.iid); }
        G.addMod(me.iid, { power: 5000, crit: 1 }, 'battle');
      },
    },
  ],
});
const triumphVG = (G, p) => { const d = G.def(G.vg(p)); return d.grade >= 3 && d.name.includes('Triumph Dragon'); };
unit('DZ-TD01/002EN', 'Roaring Thunder Beast, Kitenraiz', DE, 'High Beast', 2, 10000, 5000, {
  text: [
    'AUTO: เมื่อยูนิทนี้ถูกไรด์ทับด้วยเกรด 3 ที่มีชื่อ "Triumph Dragon" จะคอลการ์ดนี้ลง RC ก็ได้ ถ้าไม่คอล เอเนอร์จีชาร์จ 3',
    'CONT (GC): ถ้าแวนการ์ดของคุณเป็น "Triumph Dragon" เกรด 3 ขึ้นไป ยูนิทนี้ชิลด์ +10000',
  ],
  abilities: [
    {
      type: 'auto', on: 'rodeUpon', label: 'คอลลง RC หรือเอเนอร์จีชาร์จ 3', match: (G, me, e) => { const d = G.def(G.cards[e.by]); return d.grade === 3 && d.name.includes('Triumph Dragon'); },
      *run(G, me) {
        const p = me.owner; let called = false;
        if (me.zone === 'soul') {
          const circles = VG.RCS.filter(k => { const c = G.at(p, k); return !c || !c.locked; });
          const circle = yield* G.chooseCircle(p, circles, { min: 0, title: 'คอล ' + G.name(me) + ' จากโซลลง RC — เลือกเซอร์เคิล หรือข้ามเพื่อเอเนอร์จีชาร์จ 3', hint: 'callToken', noAuto: true });
          if (circle) { G.placeRC(me.iid, circle, { reason: 'call' }); called = true; }
        }
        if (!called) G.energyCharge(p, 3);
      },
    },
    { type: 'cont', zone: 'GC', cond: (G, me) => triumphVG(G, me.owner), mod: { shield: 10000 } },
  ],
});
unit('DZ-TD01/003EN', 'Roaring Flame Beast, Karaleor', DE, 'High Beast', 1, 8000, 5000, {
  text: [
    'AUTO: เมื่อยูนิทนี้ถูกไรด์ทับด้วย "Roaring Thunder Beast, Kitenraiz" เอเนอร์จีบลาสต์ 2 → จั่ว 1 ใบ',
    'CONT (RC): ในเทิร์นของคุณ ถ้าแวนการ์ดของคุณเป็น "Triumph Dragon" เกรด 3 ขึ้นไป ยูนิทนี้พลัง +5000',
  ],
  abilities: [
    { type: 'auto', on: 'rodeUpon', label: 'เอเนอร์จีบลาสต์ 2: จั่ว 1 ใบ', match: (G, me, e) => G.ename(G.cards[e.by]) === 'Roaring Thunder Beast, Kitenraiz', cost: [EB(2)], *run(G, me) { G.draw(me.owner, 1); } },
    { type: 'cont', zone: 'RC', cond: (G, me) => G.active === me.owner && triumphVG(G, me.owner), mod: { power: 5000 } },
  ],
});
unit('DZ-TD01/006EN', 'Quaydest Dragon', DE, 'Earth Dragon', 3, 13000, null);
unit('DZ-TD01/008EN', 'Crushing Dragon, Spinoassaulter', DE, 'Dinodragon', 2, 10000, 5000, {
  text: ['AUTO (RC) 1/เทิร์น: เมื่อเรียร์การ์ดคู่ต่อสู้ถูกรีไทร์ด้วยสกิลของแวนการ์ดเกรด 3 ขึ้นไปของคุณ ยูนิทนี้พลัง +10000 จนจบเทิร์น'],
  abilities: [{
    type: 'auto', on: 'leaveRC', who: 'any', zone: 'RC', limit: 'turn', label: 'พลัง +10000',
    match: (G, me, e) => e.p !== me.owner && e.reason === 'retire' && e.by && G.cards[e.by].owner === me.owner && G.cards[e.by].zone === 'VC' && G.grade(G.cards[e.by]) >= 3,
    *run(G, me) { G.addMod(me.iid, { power: 10000 }, 'turn'); },
  }],
});
unit('DZ-TD01/009EN', 'Elecblow Dragon', DE, 'Thunder Dragon', 2, 10000, 5000);
unit('DZ-TD01/011EN', 'Dragritter, Yumna', DE, 'Dragoroid', 1, 8000, 5000, {
  text: ['AUTO (RC): เมื่อยูนิทนี้บูสต์ ถ้าคู่ต่อสู้มีเรียร์การ์ด 2 ใบหรือน้อยกว่า เคาน์เตอร์บลาสต์ 1 + เอเนอร์จีบลาสต์ 2 → จั่ว 1 ใบ และยูนิทนี้พลัง +5000 จนจบแบทเทิลนั้น'],
  abilities: [{ type: 'auto', on: 'boost', zone: 'RC', label: 'จั่ว 1 ใบ + พลัง +5000', cond: (G, me) => G.rcs(1 - me.owner).length <= 2, cost: [CB(1), EB(2)], *run(G, me) { G.draw(me.owner, 1); G.addMod(me.iid, { power: 5000 }, 'battle'); } }],
});
unit('DZ-TD01/012EN', 'Iron Ball Dragon, Ankybowler', DE, 'Dinodragon', 1, 8000, 5000);
unit('DZ-TD01/013EN', 'Escort Stealth Dragon, Hayashi Kaze', DE, 'Abyss Dragon', 1, 7000, 0, {
  sentinel: true,
  text: [sentinelText, 'AUTO: เมื่อวางบน GC ทิ้งการ์ดจากมือ 1 ใบ → เลือกยูนิทของคุณ 1 ใบ ยูนิทนั้นจะไม่ถูกโจมตีโดนจนจบแบทเทิลนั้น'],
  abilities: [{
    type: 'auto', on: 'placeGC', label: 'เพอร์เฟกต์การ์ด', cost: [discard(1)],
    *run(G, me) {
      const u = yield* G.chooseUnit(me.owner, 'เลือกยูนิทที่จะไม่ถูกโจมตีโดน', { hint: 'protect' });
      if (u) { G.addMod(u, { cantBeHit: true }, 'battle'); G.log(G.name(G.cards[u]) + ' จะไม่ถูกโจมตีโดนในแบทเทิลนี้', me.owner); }
    },
  }],
});
trigger('DZ-TD01/014EN', 'Rogue Beast, Sunegosuri', DE, 'High Beast', 'crit', 15000);
trigger('DZ-TD01/015EN', 'Jaggy Dagger Dragon', DE, 'Thunder Dragon', 'draw', 5000);
trigger('DZ-TD01/016EN', 'Electrake Dracokid', DE, 'Thunder Dragon', 'front', 15000);
trigger('DZ-TD01/017EN', 'Refreshing Wind Dragon, Dinobreeze', DE, 'Dinodragon', 'heal', 15000);

// Ardart, Kageichi and Kudenmusubi are not defined here: their skills are shared families and come from the card list (db.js).

/* ================= decks ================= */
VG.DECKS['1MCW2'] = {
  id: '1MCW2', name: 'DeckFlare Artisaria', nation: LM, source: 'Deck Log 1MCW2',
  ride: ['DZ-BT07/016EN', 'DZ-BT07/145EN', 'DZ-BT07/147EN', 'DZ-BT07/149EN', 'DZ-TD01/005EN'],
  main: [
    { no: 'DZ-BT07/016EN', n: 3 }, { no: 'DZ-BT07/143EN', n: 4 }, { no: 'DZ-BT08/017EN', n: 4 }, { no: 'DZ-BT07/018EN', n: 4 },
    { no: 'DZ-BT07/053EN', n: 4 }, { no: 'DZ-BT07/094EN', n: 4 }, { no: 'DZ-BT02/066EN', n: 3 }, { no: 'D-LBT01/H19EN', n: 2 },
    { no: 'DZ-BT07/025EN', n: 1 }, { no: 'DZ-LBT01/089EN', n: 4 }, { no: 'DZ-LBT01/090EN', n: 4 }, { no: 'DZ-LBT01/093EN', n: 3 }, { no: 'DZ-LBT01/095EN', n: 4 },
    { no: 'DZ-BT07/095EN', n: 3 }, { no: 'DZ-BT07/096EN', n: 3 },
  ],
};
VG.DECKS['TD01'] = {
  id: 'TD01', name: 'Triumph Dragon (คู่ซ้อม)', nation: DE, source: 'ประกอบจากการ์ดชุด Triumph Dragon',
  ride: ['DZ-TD01/001EN', 'DZ-TD01/002EN', 'DZ-TD01/003EN', 'DZ-TD01/004EN', 'DZ-TD01/005EN'],
  main: [
    { no: 'DZ-TD01/001EN', n: 3 }, { no: 'DZ-TD01/006EN', n: 4 },
    { no: 'DZ-TD01/007EN', n: 4 }, { no: 'DZ-TD01/008EN', n: 4 }, { no: 'DZ-TD01/009EN', n: 4 },
    { no: 'DZ-TD01/010EN', n: 4 }, { no: 'DZ-TD01/011EN', n: 4 }, { no: 'DZ-TD01/012EN', n: 3 }, { no: 'DZ-TD01/013EN', n: 4 },
    { no: 'DZ-TD01/014EN', n: 4 }, { no: 'DZ-TD01/015EN', n: 4 }, { no: 'DZ-TD01/016EN', n: 4 }, { no: 'DZ-TD01/017EN', n: 4 },
  ],
};

/* skill texts that many cards share word for word: scripted once, attached by family code (see tools/mkdb.mjs) */
const oppG3 = (G, me) => G.grade(G.vg(1 - me.owner)) >= 3;
VG.FAM = {
  a: { text: ['CONT (GC): ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป ยูนิทนี้ชิลด์ +5000'], abilities: [{ type: 'cont', zone: 'GC', cond: oppG3, mod: { shield: 5000 } }] },
  c: { text: ['AUTO (RC): ตอนจบแบทเทิลที่ยูนิทนี้บูสต์ นำยูนิทนี้เข้าโซล → เลือกยูนิทของคุณ 1 ใบ พลัง +2000 จนจบเทิร์น'],
    abilities: [{ type: 'auto', on: 'battleEnd', who: 'any', zone: 'RC', label: 'เข้าโซล: ยูนิท 1 ใบพลัง +2000', match: (G, me, e) => e.booster === me.iid, cost: [soulSelf()], *run(G, me) { yield* G.givePower(me.owner, 2000, 'เลือกยูนิทรับพลัง +2000'); } }] },
  d: { text: ['AUTO: เมื่อวางบน GC ถ้ายูนิทที่โจมตีอยู่โจมตีมาแล้ว 2 ครั้งขึ้นไปในเทิร์นนี้ (นับครั้งนี้ด้วย) ยูนิทนี้ชิลด์ +15000 จนจบแบทเทิลนั้น'],
    abilities: [{ type: 'auto', on: 'placeGC', label: 'ชิลด์ +15000', cond: (G, me) => !!G.battle && (G.cards[G.battle.attacker].atk || 0) >= 2, *run(G, me) { G.addMod(me.iid, { shield: 15000 }, 'battle'); } }] },
  e: { text: ['AUTO: เมื่อวางบน GC ถ้าเกรดแวนการ์ดของคุณต่ำกว่าเกรดแวนการ์ดคู่ต่อสู้ ยูนิทนี้ชิลด์ +10000 จนจบแบทเทิลนั้น'],
    abilities: [{ type: 'auto', on: 'placeGC', label: 'ชิลด์ +10000', cond: (G, me) => G.grade(G.vg(me.owner)) < G.grade(G.vg(1 - me.owner)), *run(G, me) { G.addMod(me.iid, { shield: 10000 }, 'battle'); } }] },
  f: { text: ['AUTO (RC): เมื่อยูนิทนี้บูสต์ ยูนิทนี้พลัง +2000 จนจบเทิร์น'], abilities: [{ type: 'auto', on: 'boost', zone: 'RC', label: 'พลัง +2000', *run(G, me) { G.addMod(me.iid, { power: 2000 }, 'turn'); } }] },
  j: { text: ['CONT (RC): ในเทิร์นของคุณ ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป ยูนิทนี้พลัง +5000'], abilities: [{ type: 'cont', zone: 'RC', cond: (G, me) => G.active === me.owner && oppG3(G, me), mod: { power: 5000 } }] },
};
Object.assign(VG.FAM, {
  k: { text: ['AUTO: เมื่อยูนิทนี้ถูกรีไทร์จาก GC จะนำการ์ดนี้เข้าโซลแทนก็ได้'], abilities: [{ type: 'auto', on: 'retireGC', optional: true, label: 'เข้าโซลแทนดรอป', cond: (G, me) => me.zone === 'drop', *run(G, me) { G.move(me.iid, 'soul', { reason: 'effect' }); } }] },
  m: { text: ['AUTO: เมื่อวางบน GC ถ้ายูนิทที่โจมตีมีคริติคอล 2 ขึ้นไป โดยเพิ่มจากสกิลที่ไม่ใช่ทริกเกอร์หรือมีคริติคอลบนการ์ด 2 ขึ้นไป ยูนิทนี้ชิลด์ +15000 จนจบแบทเทิลนั้น'],
    abilities: [{ type: 'auto', on: 'placeGC', label: 'ชิลด์ +15000', cond: (G, me) => { if (!G.battle) return false; const a = G.cards[G.battle.attacker]; const cr = G.stat(a).crit; const base = G.def(a).crit == null ? 1 : G.def(a).crit; const fromTrig = a.mods.reduce((n, x) => n + (x.trig ? x.crit || 0 : 0), 0); return cr >= 2 && (base >= 2 || cr - fromTrig > base); }, *run(G, me) { G.addMod(me.iid, { shield: 15000 }, 'battle'); } }] },
  n: { text: ['AUTO: เมื่อวางบน GC ถ้าเป็นแบทเทิลครั้งที่ 3 ของเทิร์นนี้ ยูนิทนี้ชิลด์ +10000 จนจบแบทเทิลนั้น'], abilities: [{ type: 'auto', on: 'placeGC', label: 'ชิลด์ +10000', cond: G => G.battleNo === 3, *run(G, me) { G.addMod(me.iid, { shield: 10000 }, 'battle'); } }] },
  q: { text: ['CONT (RC/GC): ถ้าดาเมจโซนของคุณมี 4 ใบขึ้นไป ยูนิทนี้พลัง +10000 / ชิลด์ +10000'], abilities: [{ type: 'cont', zone: ['RC', 'GC'], cond: (G, me) => G.players[me.owner].damage.length >= 4, mod: { power: 10000, shield: 10000 } }] },
  r: { text: ['CONT (RC/GC): ถ้าเกรดแวนการ์ดของคุณต่ำกว่าคู่ต่อสู้ หรือดาเมจโซนของคุณมี 4 ใบขึ้นไป ยูนิทนี้พลัง +5000 / ชิลด์ +5000'], abilities: [{ type: 'cont', zone: ['RC', 'GC'], cond: (G, me) => G.grade(G.vg(me.owner)) < G.grade(G.vg(1 - me.owner)) || G.players[me.owner].damage.length >= 4, mod: { power: 5000, shield: 5000 } }] },
  s: { text: ['AUTO: เมื่อการ์ดนี้ถูกทิ้งจากมือในไรด์เฟสของคุณ จะคอลการ์ดนี้ลง RC ในสภาพเรสต์ก็ได้'],
    abilities: [{ type: 'auto', on: 'discard', label: 'คอลลง RC (เรสต์)', match: (G, me) => G.phase === 'ride' && G.active === me.owner, cond: (G, me) => me.zone === 'drop',
      *run(G, me) { const p = me.owner; const circles = VG.RCS.filter(k => { const c = G.at(p, k); return !c || !c.locked; }); const circle = yield* G.chooseCircle(p, circles, { min: 0, title: 'คอล ' + G.name(me) + ' ลง RC ในสภาพเรสต์ — เลือกเซอร์เคิล หรือข้าม', hint: 'callTokenBack', noAuto: true }); if (circle) G.placeRC(me.iid, circle, { reason: 'call', rest: true }); } }] },
  t: { text: ['AUTO: เมื่อการ์ดนี้ถูกทิ้งจากมือในไรด์เฟสของคุณ โซลบลาสต์ 2 → จั่ว 1 ใบ'], abilities: [{ type: 'auto', on: 'discard', label: 'โซลบลาสต์ 2: จั่ว 1 ใบ', match: (G, me) => G.phase === 'ride' && G.active === me.owner, cost: [SB(2)], *run(G, me) { G.draw(me.owner, 1); } }] },
  u: { text: ['ACT (RC) 1/เทิร์น: เอเนอร์จีบลาสต์ 3 → จนจบเทิร์น ยูนิทนี้ได้ "บูสต์" และพลัง +5000'], abilities: [{ type: 'act', zone: 'RC', limit: 'turn', label: 'ได้บูสต์ + พลัง +5000', cost: [EB(3)], *run(G, me) { G.addMod(me.iid, { boost: true, power: 5000 }, 'turn'); } }] },
  w: { text: ['AUTO (RC): เมื่อยูนิทนี้บูสต์ยูนิทเกรด 3 ขึ้นไป ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป โซลบลาสต์ 1 → ยูนิทนี้พลัง +10000 จนจบแบทเทิลนั้น'],
    abilities: [{ type: 'auto', on: 'boost', zone: 'RC', label: 'พลัง +10000', match: (G, me, e) => G.grade(G.cards[e.attacker]) >= 3, cond: oppG3, cost: [SB(1)], *run(G, me) { G.addMod(me.iid, { power: 10000 }, 'battle'); } }] },
  x: { text: ['AUTO: เมื่อวางบน GC เอเนอร์จีบลาสต์ 3 → ยูนิทนี้ชิลด์ +5000 ต่อเกรดของยูนิทที่โจมตี จนจบแบทเทิลนั้น'],
    abilities: [{ type: 'auto', on: 'placeGC', label: 'ชิลด์ +5000 ต่อเกรดผู้โจมตี', cond: G => !!G.battle, cost: [EB(3)], *run(G, me) { G.addMod(me.iid, { shield: 5000 * G.grade(G.cards[G.battle.attacker]) }, 'battle'); } }] },
});
/* over-trigger additional effects (drive check only), shared across several cards */
const over = (text, fn) => ({ text: ['เอฟเฟกต์เพิ่มเติม (เฉพาะไดรฟ์เช็ค): ' + text], abilities: [], overEffect: fn });
Object.assign(VG.FAM, {
  o1: over('เลือกเรียร์การ์ดที่สแตนด์อยู่ 1 ใบ ใบนั้นจะกลับมาสแตนด์ตอนจบแบทเทิลที่มันโจมตี (1 ครั้งในเทิร์นนี้) ถ้าไม่เลือก จั่ว 1 ใบ แล้วคอลยูนิทจากมือได้สูงสุด 1 ใบ', function* (G, p) {
    const st = G.rcs(p).filter(c => !c.rest).map(c => c.iid);
    const sel = st.length ? yield* G.chooseCards(p, st, { min: 0, max: 1, title: 'เลือกเรียร์การ์ดที่สแตนด์อยู่ 1 ใบให้กลับมาสแตนด์หลังโจมตี — หรือไม่เลือกเพื่อจั่ว 1 ใบและคอลจากมือ', hint: 'max', zone: 'field', noAuto: true }) : [];
    if (sel[0]) { G.addMod(sel[0], { restand: true }, 'turn'); return; }
    G.draw(p, 1);
    const hand = G.players[p].hand.filter(i => G.def(G.cards[i]).type === 'unit');
    const pick = yield* G.chooseCards(p, hand, { min: 0, max: 1, title: 'เลือกยูนิทจากมือเพื่อคอล (ไม่บังคับ)', hint: 'max', zone: 'hand', noAuto: true });
    if (!pick[0]) return;
    const circles = VG.RCS.filter(k => { const c = G.at(p, k); return !c || !c.locked; });
    const circle = yield* G.chooseCircle(p, circles, { title: 'คอล ' + G.name(G.cards[pick[0]]) + ' ลงเซอร์เคิลไหน?', hint: 'callToken', noAuto: true });
    if (circle) G.placeRC(pick[0], circle, { reason: 'call' });
  }),
  o2: over('เลือกการ์ด 1 ใบจากดรอปขึ้นมือ แล้วเลือกยูนิทของคุณ 1 ใบ คริติคอล +1 จนจบเทิร์น', function* (G, p) {
    const sel = yield* G.chooseCards(p, G.players[p].drop.slice(), { min: 1, max: 1, title: 'เลือกการ์ดจากดรอปขึ้นมือ', hint: 'search', zone: 'drop', noAuto: true });
    if (sel[0]) G.move(sel[0], 'hand', { reason: 'effect' });
    const u = yield* G.chooseUnit(p, 'เลือกยูนิทรับคริติคอล +1', { hint: 'crit' }); if (u) G.addMod(u, { crit: 1, trig: 1 }, 'turn');
  }),
  o3: over('ยูนิทแถวหน้าของคุณทั้งหมด พลังและคริติคอลเป็น 2 เท่าจนจบเทิร์น (คิดจากค่าตอนที่เอฟเฟกต์ทำงาน)', function* (G, p) { for (const u of G.front(p)) { const st = G.stat(u); G.addMod(u.iid, { power: st.power, crit: st.crit }, 'turn'); } }),
  o4: over('ตลอดไฟท์นี้ ในเทิร์นของคุณ แวนการ์ดของคุณพลัง +10000 / คริติคอล +1', function* (G, p) { G.players[p].effects.push({ until: 'fight', label: 'โอเวอร์: แวนการ์ด +10000 / ★+1 ในเทิร์นของคุณ', aura: (G2, c) => (c.owner === p && c.zone === 'VC' && G2.active === p ? { power: 10000, crit: 1 } : null) }); }),
  o5: over('แวนการ์ดของคุณกลับมาสแตนด์', function* (G, p) { const v = G.vg(p); v.rest = false; G.ev('stand', { p }); G.log(G.name(v) + ' กลับมาสแตนด์', p); }),
  o6: over('จนจบเทิร์นนี้ แบทเทิลที่เรียร์การ์ดของคุณโจมตีจะทำไดรฟ์เช็คด้วย', function* (G, p) { G.players[p].effects.push({ until: 'turn', rearDrive: true, label: 'โอเวอร์: เรียร์การ์ดไดรฟ์เช็ค' }); }),
  o0: over('เลือกยูนิทของคุณ 1 ใบ พลัง +100 ล้านจนจบเทิร์น (อีกครั้ง)', function* (G, p) { yield* G.givePower(p, 100000000, 'เอฟเฟกต์เพิ่มเติม: เลือกยูนิทรับพลัง +100 ล้าน'); }),
  o8: over('ตลอดไฟท์นี้ ในเทิร์นของคุณ เรียร์การ์ดของคุณทั้งหมดพลัง +10000', function* (G, p) { G.players[p].effects.push({ until: 'fight', label: 'โอเวอร์: เรียร์การ์ด +10000 ในเทิร์นของคุณ', aura: (G2, c) => (c.owner === p && c.zone === 'RC' && G2.active === p ? { power: 10000 } : null) }); }),
  o7: over('จั่ว 1 ใบ เลือกยูนิท 1 ใบคริติคอล +1 ยูนิทแถวหน้าทั้งหมดพลัง +10000 และถ้าดาเมจของคุณมากกว่าหรือเท่ากับคู่ต่อสู้ ฮีล 1 ใบ', function* (G, p) {
    G.draw(p, 1);
    const u = yield* G.chooseUnit(p, 'เลือกยูนิทรับคริติคอล +1', { hint: 'crit' }); if (u) G.addMod(u, { crit: 1, trig: 1 }, 'turn');
    for (const f of G.front(p)) G.addMod(f.iid, { power: 10000 }, 'turn');
    const P = G.players[p];
    if (P.damage.length > 0 && P.damage.length >= G.players[1 - p].damage.length) { const sel = yield* G.chooseCards(p, P.damage.slice(), { min: 1, max: 1, title: 'เลือกดาเมจ 1 ใบเพื่อฮีล', hint: 'heal', zone: 'damage' }); if (sel[0]) { G.move(sel[0], 'drop', { reason: 'heal' }); G.log('ฮีลดาเมจ 1 ใบ', p); } }
  }),
});
/* =====================================================================================================================
   Hand-written skills for cards of the full card list, by card name: VG.HAND[name] = { text, abilities, extra }.
   Stats, pictures and numbers still come from the list; only text + abilities (+ extra fields of the definition) are replaced.
   ===================================================================================================================== */
const HAND = VG.HAND = {};
const FX = () => VG.fx;
const vgIs = (G, p, part, g) => { const d = G.def(G.vg(p)); return d.name.includes(part) && (!g || d.grade >= g); };
const fxRun = function* (G, me, steps, it) { const ctx = FX().mkCtx(me); if (it) ctx.it = it; yield* FX().run(G, ctx, steps); return ctx; };
const atEndOfBattle = (G, me, fn) => G.laters.push({ when: 'b', p: me.owner, src: me.iid, fn });
const myTurn = (G, me) => G.active === me.owner;
const FRONT_RC = ['FL', 'FR'], BACK_RC = ['BL', 'BC', 'BR'];
/* retire every rear-guard of the given circles, both fighters' or only one side */
function retireRow(G, me, circles, sides) { let n = 0; for (const q of sides) for (const k of circles) { const u = G.at(q, k); if (u && !u.locked && u.zone === 'RC') { G.retire(u.iid, 'effect', me.iid); n++; } } return n; }
const retiredByMyVG = (part, g) => (G, me, e) => { const by = e.by != null ? G.cards[e.by] : null; return e.reason === 'retire' && e.cause === 'effect' && !!by && by.owner === me.owner && by.zone === 'VC' && G.def(by).name.includes(part) && (!g || G.grade(by) >= g); };
const bindFrom = (label, zones, filter) => ({
  label,
  can: (G, me) => zones.some(z => G.players[me.owner][z].some(i => i !== me.iid && filter(G, G.cards[i]))),
  *pay(G, me) { const p = me.owner; const list = [].concat(...zones.map(z => G.players[p][z])).filter(i => i !== me.iid && filter(G, G.cards[i])); const sel = yield* G.chooseCards(p, list, { min: 1, max: 1, title: 'คอสต์: ' + label, zone: 'mixed', noAuto: list.length > 1 }); if (sel[0]) G.move(sel[0], 'bind', { reason: 'cost' }); return 1; },
});
const bindSelf = { label: 'ไบนด์การ์ดนี้', can: (G, me) => me.zone !== 'bind' && me.zone !== 'gone', *pay(G, me) { G.move(me.iid, 'bind', { reason: 'cost' }); return 1; } };
const retireSelf = { label: 'รีไทร์ยูนิทนี้', can: (G, me) => me.zone === 'RC' && !me.locked, *pay(G, me) { G.move(me.iid, 'drop', { reason: 'retire', extra: { cause: 'cost' } }); return 1; } };
/* counter-blast 1, or (when allowed) energy-blast 3 instead */
const cbOrEb = allow => ({
  label: 'เคาน์เตอร์บลาสต์ 1 (หรือเอเนอร์จีบลาสต์ 3)',
  can: (G, me) => CB(1).can(G, me) || (allow(G, me) && EB(3).can(G, me)),
  *pay(G, me) { const a = CB(1).can(G, me), b = allow(G, me) && EB(3).can(G, me); let use = a ? 'cb' : 'eb'; if (a && b) use = (yield* G.chooseOption(me.owner, 'จ่ายคอสต์แบบไหน?', [{ id: 'cb', label: 'เคาน์เตอร์บลาสต์ 1' }, { id: 'eb', label: 'เอเนอร์จีบลาสต์ 3' }], { iid: me.iid })) || 'cb'; yield* (use === 'cb' ? CB(1) : EB(3)).pay(G, me); return 1; },
});

/* ---------- Varga (Dragon Empire) ---------- */
const VARGA = 'Varga';
const varga3 = (G, me) => vgIs(G, me.owner, VARGA, 3);
const malwyrmVG = (G, me) => G.hasState(G.vg(me.owner), 'malwyrm');
const sameNameInRow = (G, me, circles) => circles.some(k => { const u = G.at(me.owner, k); return u && u.iid !== me.iid && u.zone === 'RC' && G.def(u).name === G.def(me).name; });
const rowOf = me => (FRONT_RC.includes(me.pos) ? FRONT_RC : BACK_RC);
const attackedVG = (G, me, e) => e.targetZone === 'VC';
const myBattleEnd = minGrade => (G, me, e) => e.attacker === me.iid && (!minGrade || (G.cards[e.target] && G.grade(G.cards[e.target]) >= minGrade));

HAND['Fated One of Unparalleled, Varga Dragres'] = {
  text: [
    'AUTO (VC) 1/เทิร์น: เมื่อยูนิทนี้โจมตีแวนการ์ด [เคาน์เตอร์บลาสต์ 1] → รีไทร์เรียร์การ์ดแถวหน้าของทั้งสองฝั่งทั้งหมด ยูนิทนี้พลัง +10000 จนจบเทิร์น ตอนจบแบทเทิลนั้น สแตนด์ยูนิทนี้ และไดรฟ์ -2 จนจบเทิร์น',
    'AUTO (VC) [Divine Skill — ใช้ได้ 1 ครั้งต่อไฟท์]: ตอนจบแบทเทิลที่ยูนิทนี้โจมตียูนิทเกรด 3 ขึ้นไป ถ้าดาเมจโซนของคู่ต่อสู้มี 4 ใบขึ้นไป และยูนิทนี้โจมตีมาแล้ว 2 ครั้งขึ้นไปในเทิร์นนี้ [เคาน์เตอร์บลาสต์ 1] → สแตนด์ยูนิทนี้ และไดรฟ์ +2 จนจบเทิร์น',
  ],
  abilities: [
    { type: 'auto', on: 'attack', zone: 'VC', limit: 'turn', label: 'รีไทร์แถวหน้าทั้งสองฝั่ง พลัง +10000 แล้วสแตนด์ตอนจบแบทเทิล (ไดรฟ์ -2)', cost: [CB(1)], match: attackedVG,
      *run(G, me) {
        retireRow(G, me, FRONT_RC, [0, 1]); G.addMod(me.iid, { power: 10000 }, 'turn');
        atEndOfBattle(G, me, function* () { if (me.zone !== 'VC') return; G.standUnit(me.iid); me.selfStood = G.turnNo; G.addMod(me.iid, { drive: -2 }, 'turn'); });
      } },
    { type: 'auto', on: 'battleEnd', who: 'any', zone: 'VC', divine: true, label: 'Divine Skill: สแตนด์อีกครั้ง ไดรฟ์ +2', cost: [CB(1)], match: myBattleEnd(3),
      cond: (G, me) => G.players[1 - me.owner].damage.length >= 4 && (me.atk || 0) >= 2,
      *run(G, me) { G.standUnit(me.iid); G.addMod(me.iid, { drive: 2 }, 'turn'); } },
  ],
};

HAND['Unparalleled Drekasleif, Varga Dragres "Rakshasa"'] = {
  text: [
    'Malwyrm — AUTO: เมื่อวางโดยไรด์ทับยูนิทที่มีชื่อ "Varga" ซึ่งชื่อต่างจากยูนิทนี้ หรือไรด์ทับยูนิทที่อยู่ในสถานะ Malwyrm → จนจบไฟท์ ยูนิทนี้อยู่ในสถานะ Malwyrm และถ้าการไรด์ครั้งนี้ยังไม่ได้เป็นเพอร์โซน่าไรด์ ให้ทำเพอร์โซน่าไรด์ (จั่ว 1 ใบ แถวหน้า +10000)',
    'AUTO (VC) 1/เทิร์น: เมื่อยูนิทนี้ในสถานะ Malwyrm โจมตีแวนการ์ด → รีไทร์เรียร์การ์ดแถวหน้าทั้งหมด (ทั้งสองฝั่ง) ยูนิทนี้พลัง +10000 จนจบเทิร์น ตอนจบแบทเทิลนั้น [เคาน์เตอร์บลาสต์ 1] → รีไทร์เรียร์การ์ดแถวหลังทั้งหมด สแตนด์ยูนิทนี้ และไดรฟ์ -2 จนจบเทิร์น',
    'AUTO (VC) [Divine Skill — ใช้ได้ 1 ครั้งต่อไฟท์]: ตอนจบแบทเทิลที่ยูนิทนี้โจมตี ถ้ายูนิทนี้สแตนด์ด้วยสกิล AUTO ของตัวเองมาแล้วในเทิร์นนี้ [เคาน์เตอร์บลาสต์ 1] → สแตนด์ยูนิทนี้ และไดรฟ์ +2 จนจบเทิร์น',
  ],
  abilities: [
    { type: 'auto', on: 'placeVC', label: 'เข้าสู่สถานะ Malwyrm',
      match: (G, me, e) => !!e.ride && ((String(e.rideFrom || '').includes(VARGA) && e.rideFrom !== G.def(me).name) || !!(e.rideFromSt && e.rideFromSt.malwyrm)),
      *run(G, me, e) { G.setState(me, 'malwyrm'); if (!(e && e.persona)) { G.log('Malwyrm: ทำเพอร์โซน่าไรด์', me.owner); G.activatePersona(me.owner); } } },
    { type: 'auto', on: 'attack', zone: 'VC', limit: 'turn', label: 'Malwyrm: รีไทร์แถวหน้าทั้งหมด พลัง +10000', match: attackedVG, cond: (G, me) => G.hasState(me, 'malwyrm'),
      *run(G, me) {
        retireRow(G, me, FRONT_RC, [0, 1]); G.addMod(me.iid, { power: 10000 }, 'turn');
        atEndOfBattle(G, me, function* () {
          if (me.zone !== 'VC') return;
          if (!(yield* G.payOptional(me, [CB(1)], 'รีไทร์แถวหลังทั้งหมด แล้วสแตนด์ ' + G.name(me) + ' (ไดรฟ์ -2)?'))) return;
          retireRow(G, me, BACK_RC, [0, 1]); G.standUnit(me.iid); me.selfStood = G.turnNo; G.addMod(me.iid, { drive: -2 }, 'turn');
        });
      } },
    { type: 'auto', on: 'battleEnd', who: 'any', zone: 'VC', divine: true, label: 'Divine Skill: สแตนด์อีกครั้ง ไดรฟ์ +2', cost: [CB(1)], match: myBattleEnd(0),
      cond: (G, me) => me.selfStood === G.turnNo,
      *run(G, me) { G.standUnit(me.iid); G.addMod(me.iid, { drive: 2 }, 'turn'); } },
  ],
};

HAND['Unparalleled Rakshasa Dragon, Varga Dragres "Heavenwake"'] = {
  extra: { personaAlso: (other, own) => other.grade === 3 && other.name.includes(VARGA) && other.name !== own.name },
  text: [
    'CONT: การไรด์ปกติจากการ์ดนี้ไปเป็น หรือจากการ์ดอื่นมาเป็นการ์ดนี้ กับการ์ดเกรด 3 ที่มีชื่อ "Varga" ซึ่งชื่อต่างกัน นับเป็นเพอร์โซน่าไรด์ด้วย',
    'ACT (VC) 1/เทิร์น: [ไบนด์การ์ดที่มีชื่อ "Varga" 1 ใบ จากมือหรือโซล] → เลือกการ์ดที่ไม่ใช่เซนทิเนลจากดรอปได้สูงสุด 2 ใบ ที่เกรดต่างกันและเกรดรวมไม่เกินจำนวนการ์ดในดาเมจโซนของคุณ แล้วคอลลง RC',
    'AUTO (VC) 1/เทิร์น: เมื่อยูนิทนี้โจมตีแวนการ์ด [เคาน์เตอร์บลาสต์ 1] → รีไทร์เรียร์การ์ดแถวหน้าทั้งหมด (ทั้งสองฝั่ง) ยูนิทนี้พลัง +10000 จนจบเทิร์น ตอนจบแบทเทิลนั้น สแตนด์ยูนิทนี้ จนจบเทิร์นพลัง +5000 / ไดรฟ์ -2 และถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป เรียร์การ์ดแถวหน้าของคุณทั้งหมดพลัง +5000 จนจบเทิร์น',
    'AUTO (VC) [Divine Skill — ใช้ได้ 1 ครั้งต่อไฟท์]: ตอนจบแบทเทิลที่ยูนิทนี้โจมตียูนิทเกรด 3 ขึ้นไป ถ้ายูนิทนี้โจมตีมาแล้ว 2 ครั้งขึ้นไปในเทิร์นนี้ และ (ดาเมจโซนของคุณหรือคู่ต่อสู้มี 4 ใบขึ้นไป หรือคุณเพอร์โซน่าไรด์ในเทิร์นนี้) [เคาน์เตอร์บลาสต์ 1] → สแตนด์ยูนิทนี้ และไดรฟ์ของยูนิทนี้กลายเป็น 2 จนจบเทิร์น',
  ],
  abilities: [
    { type: 'act', zone: 'VC', limit: 'turn', label: 'คอลจากดรอปสูงสุด 2 ใบ (เกรดต่างกัน รวมไม่เกินดาเมจ)', cost: [bindFrom('ไบนด์การ์ดที่มีชื่อ "Varga" 1 ใบจากมือหรือโซล', ['hand', 'soul'], (G, c) => G.def(c).name.includes(VARGA))],
      *run(G, me) {
        const p = me.owner, P = G.players[p]; let left = P.damage.length; const used = [];
        for (let k = 0; k < 2; k++) {
          const list = P.drop.filter(i => { const d = G.def(G.cards[i]); return d.type === 'unit' && !d.sentinel && !d.noCall && d.grade <= left && !used.includes(d.grade); });
          if (!list.length) break;
          const sel = yield* G.chooseCards(p, list, { min: 0, max: 1, title: 'เลือกการ์ดจากดรอปเพื่อคอล (ใบที่ ' + (k + 1) + '/2 · เกรดรวมที่เหลือ ' + left + ')', zone: 'drop', noAuto: true, hint: 'call' });
          if (!sel[0]) break;
          const g = G.grade(G.cards[sel[0]]); used.push(g); left -= g;
          yield* fxRun(G, me, [['cl', 'it', {}]], [sel[0]]);
        }
      } },
    { type: 'auto', on: 'attack', zone: 'VC', limit: 'turn', label: 'รีไทร์แถวหน้าทั้งหมด พลัง +10000 แล้วสแตนด์ตอนจบแบทเทิล (พลัง +5000 ไดรฟ์ -2)', cost: [CB(1)], match: attackedVG,
      *run(G, me) {
        retireRow(G, me, FRONT_RC, [0, 1]); G.addMod(me.iid, { power: 10000 }, 'turn');
        atEndOfBattle(G, me, function* () {
          if (me.zone !== 'VC') return;
          G.standUnit(me.iid); me.selfStood = G.turnNo; G.addMod(me.iid, { power: 5000, drive: -2 }, 'turn');
          if (G.grade(G.vg(1 - me.owner)) >= 3) for (const k of FRONT_RC) { const u = G.at(me.owner, k); if (u && !u.locked) G.addMod(u.iid, { power: 5000 }, 'turn'); }
        });
      } },
    { type: 'auto', on: 'battleEnd', who: 'any', zone: 'VC', divine: true, label: 'Divine Skill: สแตนด์อีกครั้ง ไดรฟ์กลายเป็น 2', cost: [CB(1)], match: myBattleEnd(3),
      cond: (G, me) => (me.atk || 0) >= 2 && (G.players[me.owner].damage.length >= 4 || G.players[1 - me.owner].damage.length >= 4 || !!G.tf['persona' + me.owner]),
      *run(G, me) { G.standUnit(me.iid); G.addMod(me.iid, { drive: 2 - G.stat(me).drive }, 'turn'); } },
  ],
};

HAND['Battle Monk of Raging Flames, Taijou'] = {
  text: ['CONT (RC): ในเทิร์นของคุณ ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ยูนิทนี้พลัง +5000 ต่อเรียร์การ์ดของคู่ต่อสู้ 1 ใบที่ถูกรีไทร์ในเทิร์นนี้'],
  abilities: [{ type: 'cont', zone: 'RC', cond: (G, me) => myTurn(G, me) && varga3(G, me), mod: (G, me) => ({ power: 5000 * (G.tf['ret' + (1 - me.owner)] || 0) }) }],
};

HAND['Storm Slasher Dragon'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้ถูกรีไทร์จาก RC ด้วยสกิลของแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ของคุณ จะคอลการ์ดนี้ลง RC แถวหลังในสภาพเรสต์ก็ได้ ถ้าแวนการ์ดของคุณอยู่ในสถานะ Malwyrm [โซลบลาสต์ 1] → สแตนด์ยูนิทนี้',
    'CONT (RC): ถ้าแวนการ์ดของคุณอยู่ในสถานะ Malwyrm ยูนิทนี้พลัง +5000',
  ],
  abilities: [
    { type: 'auto', on: 'leaveRC', label: 'คอลกลับลงแถวหลัง (เรสต์)', optional: true, match: retiredByMyVG(VARGA, 3),
      *run(G, me) {
        if (me.zone !== 'drop') return;
        yield* fxRun(G, me, [['cl', 'me', { row: 'b', rest: 1 }]]);
        if (me.zone === 'RC' && malwyrmVG(G, me) && (yield* G.payOptional(me, [SB(1)], 'สแตนด์ ' + G.name(me) + '?'))) G.standUnit(me.iid);
      } },
    { type: 'cont', zone: 'RC', cond: malwyrmVG, mod: { power: 5000 } },
  ],
};

HAND['Stealth Beast, Yamihyouri'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้วางบน RC นอกแบทเทิลเฟส เลือกการ์ดเกรด 3 ที่มีชื่อ "Varga" จากไรด์เด็ค จะเปิดเผยก็ได้ ถ้าเปิดเผย หรือคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" [เคาน์เตอร์บลาสต์ 1 — ถ้าแวนการ์ดเกรด 3 ขึ้นไป จ่ายเป็นเอเนอร์จีบลาสต์ 3 แทนได้] → ดูการ์ด 5 ใบบนสุดของเด็ค เลือกการ์ดที่เกรดไม่เกินแวนการ์ดได้สูงสุด 1 ใบ คอลลง RC แล้วสับเด็ค',
    'CONT (RC): ในเทิร์นของคุณ ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ยูนิทนี้พลัง +5000',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'ดู 5 ใบบนสุด คอลได้ 1 ใบ', match: (G, me) => G.phase !== 'battle',
      cond: (G, me) => varga3(G, me) || G.players[me.owner].ride.some(i => { const d = G.def(G.cards[i]); return d.grade === 3 && d.name.includes(VARGA); }),
      cost: [cbOrEb((G, me) => G.grade(G.vg(me.owner)) >= 3)],
      *run(G, me) { yield* fxRun(G, me, [['lk', 5], ['pk', ['looked'], 1, 1, { ty: 'u', gv: 1 }], ['cl', 'it', {}], ['shuf']]); } },
    { type: 'cont', zone: 'RC', cond: (G, me) => myTurn(G, me) && varga3(G, me), mod: { power: 5000 } },
  ],
};

HAND['Mythisch of Unparalleled, Zalva Dragnia'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้วางบน RC จากมือ [โซลบลาสต์ 1] → ดูการ์ด 7 ใบบนสุดของเด็ค เลือกยูนิทที่มีชื่อ "Varga" ได้สูงสุด 1 ใบ เปิดเผยแล้วขึ้นมือ แล้วสับเด็ค',
    'CONT (RC): ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" — ในเทิร์นของคุณ ยูนิทนี้พลัง +5000 และถ้าเรียร์การ์ดใบอื่นในแถวเดียวกันชื่อไม่ซ้ำกับยูนิทนี้ ยูนิทนี้ได้รับ "บูสต์" และไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ดของคุณ',
    'AUTO (RC) 1/เทิร์น: ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" — เมื่อแวนการ์ดของคุณสแตนด์ในแบทเทิลเฟส ยูนิทนี้พลัง +5000 จนจบเทิร์น ถ้าเรียร์การ์ดใบอื่นในแถวเดียวกันชื่อไม่ซ้ำกับยูนิทนี้ และคุณใช้ Divine Skill ไปแล้วในไฟท์นี้ [เอเนอร์จีบลาสต์ 3] → คริติคอลของยูนิทนี้กลายเป็น 2',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'ดู 7 ใบบนสุด หา "Varga" ขึ้นมือ', cost: [SB(1)], match: (G, me, e) => e.from === 'hand',
      *run(G, me) { yield* fxRun(G, me, [['lk', 7], ['pk', ['looked'], 1, 1, { ty: 'u', nh: VARGA }], ['to', 'it', 'hand', 1], ['shuf']]); } },
    { type: 'cont', zone: 'RC', cond: (G, me) => myTurn(G, me) && varga3(G, me), mod: (G, me) => (sameNameInRow(G, me, rowOf(me)) ? { power: 5000 } : { power: 5000, boost: true, noRetOwn: true }) },
    { type: 'auto', on: 'stood', who: 'any', zone: 'RC', limit: 'turn', label: 'แวนการ์ดสแตนด์: พลัง +5000', cond: varga3,
      match: (G, me, e) => G.phase === 'battle' && G.vg(me.owner) && e.iid === G.vg(me.owner).iid,
      *run(G, me) {
        G.addMod(me.iid, { power: 5000 }, 'turn');
        if (!sameNameInRow(G, me, rowOf(me)) && G.players[me.owner].divine && (yield* G.payOptional(me, [EB(3)], 'คริติคอลของ ' + G.name(me) + ' กลายเป็น 2?'))) G.addMod(me.iid, { crit: 2 - G.stat(me).crit }, 'turn');
      } },
  ],
};

HAND['Obduracy Glaive Dragon'] = {
  text: [
    'CONT (RC แถวหน้า): ในเทิร์นของคุณ ถ้าแถวหน้าของคุณไม่มีเรียร์การ์ดใบอื่นที่ชื่อเดียวกับยูนิทนี้ ยูนิทนี้ไม่ถูกรีไทร์ด้วยเอฟเฟกต์การ์ด และพลัง +10000',
    'CONT (RC): ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ยูนิทนี้ได้รับ "บูสต์"',
  ],
  abilities: [
    { type: 'cont', zone: 'frontRC', cond: (G, me) => myTurn(G, me) && !sameNameInRow(G, me, FRONT_RC), mod: { power: 10000, noRet: true } },
    { type: 'cont', zone: 'RC', cond: varga3, mod: { boost: true } },
  ],
};

HAND['Valorous Blade Dragon'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้วางบน RC จากดรอป ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" → จนจบเทิร์นถัดไปของคู่ต่อสู้ ยูนิทนี้ได้รับ "อินเตอร์เซปต์" อินเตอร์เซปต์จากแถวหลังได้ และไม่ถูกรีไทร์จาก RC ด้วยเอฟเฟกต์การ์ด',
    'CONT (GC): ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ยูนิทนี้ชิลด์ +5000',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'ได้รับอินเตอร์เซปต์ (จากแถวหลังได้) และไม่ถูกรีไทร์ด้วยเอฟเฟกต์', match: (G, me, e) => e.from === 'drop', cond: varga3,
      *run(G, me) { G.addMod(me.iid, { intercept: true, backInt: true, noRet: true }, 'opp'); } },
    { type: 'cont', zone: 'GC', cond: varga3, mod: { shield: 5000 } },
  ],
};

HAND['Boulder Axe Dragon, "Fugen"'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้ถูกไรด์ทับด้วยเกรด 3 ที่มีชื่อ "Varga" → คอลการ์ดนี้ลง RC เลือกสกิล AUTO ตั้งต้นของแวนการ์ดคุณ 1 ข้อ คอสต์เคาน์เตอร์บลาสต์ครั้งถัดไปของสกิลนั้นลดลง 1 จนจบเทิร์น',
    'AUTO (RC): เมื่อยูนิทนี้โจมตีแวนการ์ด ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" → ยูนิทนี้พลัง +5000 จนจบแบทเทิลนั้น ตอนจบแบทเทิลนั้น รีไทร์ยูนิทนี้ แล้วจั่ว 1 ใบ (บังคับ)',
  ],
  abilities: [
    { type: 'auto', on: 'rodeUpon', label: 'คอลลง RC + ลดคอสต์เคาน์เตอร์บลาสต์ของแวนการ์ด 1', match: (G, me, e) => { const d = G.def(G.cards[e.by]); return d.grade === 3 && d.name.includes(VARGA); },
      *run(G, me) {
        const p = me.owner; yield* fxRun(G, me, [['cl', 'me', {}]]);
        const v = G.vg(p); const list = (G.def(v).abilities || []).map((ab, i) => ({ ab, i })).filter(x => x.ab.type === 'auto' && (x.ab.cost || []).some(k => /^เคาน์เตอร์บลาสต์/.test(k.label)));
        if (!list.length) return;
        let pick = list[0].i;
        if (list.length > 1) { const id = yield* G.chooseOption(p, 'ลดคอสต์เคาน์เตอร์บลาสต์ครั้งถัดไปของสกิลไหน?', list.map(x => ({ id: String(x.i), label: (x.ab.label || 'AUTO').slice(0, 60) })), { iid: v.iid }); if (id != null) pick = +id; }
        v.cbLess = { key: pick, t: G.turnNo }; G.log('คอสต์เคาน์เตอร์บลาสต์ครั้งถัดไปของ ' + G.name(v) + ' ลดลง 1', p);
      } },
    { type: 'auto', on: 'attack', zone: 'RC', label: 'พลัง +5000 แล้วรีไทร์ตอนจบแบทเทิล จั่ว 1 ใบ', match: attackedVG, cond: varga3,
      *run(G, me) { G.addMod(me.iid, { power: 5000 }, 'battle'); atEndOfBattle(G, me, function* () { if (me.zone === 'RC') G.retire(me.iid, 'effect', me.iid); G.draw(me.owner, 1); }); } },
  ],
};

HAND['Dragritter, Nabilla'] = {
  extra: { actOff: true },
  text: [
    'AUTO: เมื่อการ์ดนี้ถูกทิ้งจากมือในเทิร์นของคุณ จะนำการ์ดนี้เข้าโซลก็ได้',
    'AUTO (ดรอป): เมื่อแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ของคุณถูกโจมตี [ไบนด์การ์ดนี้] → ยูนิทนั้นพลัง +10000 จนจบแบทเทิลนั้น (ในเทิร์นนั้นไบนด์การ์ดชื่อเดียวกันจากดรอปอีกไม่ได้)',
  ],
  abilities: [
    { type: 'auto', on: 'discard', label: 'นำการ์ดนี้เข้าโซล', optional: true, match: (G, me) => G.active === me.owner, *run(G, me) { if (me.zone === 'drop') G.move(me.iid, 'soul', { reason: 'effect' }); } },
    { type: 'auto', on: 'attack', who: 'any', zone: 'drop', label: 'แวนการ์ดพลัง +10000 จนจบแบทเทิล', cost: [bindSelf],
      match: (G, me, e) => { const v = G.vg(me.owner); return !!v && e.target === v.iid && varga3(G, me); }, cond: (G, me) => !G.tf['nabilla' + me.owner],
      *run(G, me) { G.tf['nabilla' + me.owner] = 1; G.addMod(G.vg(me.owner).iid, { power: 10000 }, 'battle'); } },
  ],
};

HAND['Rockbound Edge Dragon'] = {
  extra: { actOff: true },
  text: [
    'AUTO (RC): เมื่อยูนิทนี้โจมตี ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ยูนิทนี้พลัง +5000 จนจบแบทเทิลนั้น แล้วจะโซลชาร์จ 1 ก็ได้',
    'ACT (ดรอป): ถ้าคุณมีแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" [เอเนอร์จีบลาสต์ 3] → คอลการ์ดนี้ลง RC ถ้าแวนการ์ดของคุณอยู่ในสถานะ Malwyrm ยูนิทนี้พลัง +5000 จนจบเทิร์น',
  ],
  abilities: [
    { type: 'auto', on: 'attack', zone: 'RC', label: 'พลัง +5000 (โซลชาร์จ 1 ได้)', cond: varga3,
      *run(G, me) { G.addMod(me.iid, { power: 5000 }, 'battle'); if (G.players[me.owner].deck.length > 1 && (yield* G.yesNo(me.owner, { title: 'โซลชาร์จ 1?', iid: me.iid, options: [{ id: 'yes', label: 'โซลชาร์จ' }, { id: 'no', label: 'ไม่ทำ' }] }))) G.soulCharge(me.owner, 1); } },
    { type: 'act', zone: 'drop', label: 'คอลการ์ดนี้จากดรอป', cond: varga3, cost: [EB(3)],
      *run(G, me) { yield* fxRun(G, me, [['cl', 'me', {}]]); if (me.zone === 'RC' && malwyrmVG(G, me)) G.addMod(me.iid, { power: 5000 }, 'turn'); } },
  ],
};

HAND['Fiend Beast, Ushionimaru'] = {
  text: ['AUTO: เมื่อยูนิทนี้ถูกรีไทร์จาก RC ด้วยสกิลของแวนการ์ดเกรด 3 ขึ้นไปที่มีชื่อ "Varga" ของคุณ → เลือกยูนิทของคุณ 1 ใบ พลัง +5000 จนจบเทิร์น (ถ้าแวนการ์ดอยู่ในสถานะ Malwyrm เป็น +10000 แทน)'],
  abilities: [
    { type: 'auto', on: 'leaveRC', label: 'ยูนิท 1 ใบพลังเพิ่ม', match: retiredByMyVG(VARGA, 3),
      *run(G, me) { const n = malwyrmVG(G, me) ? 10000 : 5000; yield* G.givePower(me.owner, n, 'เลือกยูนิทรับพลัง +' + n); } },
  ],
};

/* ---------- Dragon Empire cards that go with the retiring of front rows ---------- */
const COLK = { FL: 'L', BL: 'L', V: 'C', BC: 'C', FR: 'R', BR: 'R' };
HAND['Aero Halberd Dragon'] = {
  text: [
    'AUTO: เมื่อยูนิทนี้วางบน RC จากดรอป [เอเนอร์จีบลาสต์ 3] → เลือกเรียร์การ์ดแถวหลังของคู่ต่อสู้ 1 ใบ แล้วรีไทร์',
    'AUTO (RC แถวหลัง) 1/เทิร์น: เมื่อยูนิทของผู้เล่นคนใดก็ตามถูกรีไทร์จาก RC แถวหน้าในคอลัมน์เดียวกับยูนิทนี้ ในเทิร์นของคุณ จะสแตนด์ยูนิทนี้ก็ได้ ถ้าสแตนด์ ตอนจบเทิร์นนั้น นำยูนิทนี้เข้าโซล',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'รีไทร์เรียร์การ์ดแถวหลังของคู่ต่อสู้ 1 ใบ', cost: [EB(3)], match: (G, me, e) => e.from === 'drop',
      *run(G, me) { yield* fxRun(G, me, [['ch', { s: 'o', k: 'r', n: 1, f: { row: 'b' } }], ['rt', 'it']]); } },
    { type: 'auto', on: 'leaveRC', who: 'any', zone: 'backRC', limit: 'turn', optional: true, label: 'สแตนด์ยูนิทนี้ (จบเทิร์นเข้าโซล)',
      match: (G, me, e) => G.active === me.owner && e.reason === 'retire' && e.iid !== me.iid && FRONT_RC.includes(e.fromPos) && (e.p === me.owner ? COLK[e.fromPos] === COLK[me.pos] : COLK[e.fromPos] !== COLK[me.pos] && COLK[me.pos] !== 'C'),
      cond: (G, me) => me.rest,
      *run(G, me) { if (G.standUnit(me.iid)) G.laters.push({ when: 't', p: me.owner, src: me.iid, fn: function* () { if (me.zone === 'RC') G.move(me.iid, 'soul', { reason: 'effect' }); } }); } },
  ],
};
HAND['Dragritter, Mutawari'] = {
  text: [
    'AUTO (ดรอป): เมื่อยูนิทของคู่ต่อสู้ถูกรีไทร์จาก RC ด้วยสกิลการ์ดของคุณ ในเทิร์นของคุณ [โซลบลาสต์ 1 + ไบนด์การ์ดนี้] → เลือกเรียร์การ์ดของคู่ต่อสู้ 1 ใบในคอลัมน์เดียวกับยูนิทที่ถูกรีไทร์ แล้วรีไทร์ (ในเทิร์นนั้นไบนด์การ์ดชื่อเดียวกันจากดรอปอีกไม่ได้)',
    'CONT (RC/GC): ถ้าแวนการ์ดคู่ต่อสู้เกรด 3 ขึ้นไป ยูนิทนี้ชิลด์ +5000 และถ้าดรอปของคู่ต่อสู้มี 8 ใบขึ้นไป พลัง +5000 ด้วย',
  ],
  abilities: [
    { type: 'auto', on: 'leaveRC', who: 'any', zone: 'drop', label: 'รีไทร์เรียร์การ์ดคู่ต่อสู้ในคอลัมน์เดียวกันอีก 1 ใบ', cost: [SB(1), bindSelf],
      match: (G, me, e) => G.active === me.owner && e.p !== me.owner && e.reason === 'retire' && e.cause === 'effect' && e.byP === me.owner && !e.byCost,
      cond: (G, me, e) => !G.tf['mutawari' + me.owner] && !!e && G.rcs(1 - me.owner).some(u => COLK[u.pos] === COLK[e.fromPos] && !G.stat(u).resist),
      *run(G, me, e) {
        G.tf['mutawari' + me.owner] = 1; const p = me.owner;
        const list = G.rcs(1 - p).filter(u => COLK[u.pos] === COLK[e.fromPos] && !G.stat(u).resist).map(u => u.iid); if (!list.length) return;
        const sel = yield* G.chooseCards(p, list, { min: 1, max: 1, title: 'เลือกเรียร์การ์ดคู่ต่อสู้ในคอลัมน์เดียวกันเพื่อรีไทร์', zone: 'field', hint: 'retire' });
        if (sel[0]) G.retire(sel[0], 'effect', me.iid);
      } },
    { type: 'cont', zone: ['RC', 'GC'], cond: (G, me) => G.grade(G.vg(1 - me.owner)) >= 3, mod: (G, me) => (G.players[1 - me.owner].drop.length >= 8 ? { shield: 5000, power: 5000 } : { shield: 5000 }) },
  ],
};

/* ---------- Persona Shield ticket (a ticket card: never in a deck, only in hand; played like a blitz order when one of your units is attacked) ---------- */
const TICKET_PS = 'TICKET/PersonaShield';
C[TICKET_PS] = {
  no: TICKET_PS, name: 'Persona Shield', type: 'order', orderKind: 'blitz', ticket: true, nation: null, race: null, grade: 0, power: null, shield: null,
  text: [
    'ทิกเก็ตการ์ด (ใส่ในเด็คไม่ได้ อยู่ได้เฉพาะในมือ) — เพลย์ตอนยูนิทของคุณถูกโจมตีแบบบลิตซ์ออเดอร์: เลือกยูนิทที่ถูกโจมตี 1 ใบ พลัง +10000 จนจบแบทเทิลนั้น และในเทิร์นนี้คุณเพลย์บลิตซ์ออเดอร์ได้สูงสุด 2 ใบ ถ้าเครสต์โซนของคู่ต่อสู้มีการ์ดอื่นนอกจาก "Energy Generator" พลัง +5000 เพิ่ม',
    'CONT (มือ): ในเทิร์นของคุณ การ์ดนี้ไม่ถูกเลือกทิ้งตอนไรด์จากไรด์เด็ค และไม่ถูกเลือกจากมือด้วยสกิลการ์ดของคุณ',
  ],
  abilities: [],
  play: {
    cond: (G, me) => !!G.battle && G.active !== me.owner && G.battle.targets.some(i => G.cards[i] && G.cards[i].owner === me.owner && (G.cards[i].zone === 'VC' || G.cards[i].zone === 'RC')),
    *run(G, me) {
      const p = me.owner; const list = G.battle.targets.filter(i => G.cards[i] && G.cards[i].owner === p && (G.cards[i].zone === 'VC' || G.cards[i].zone === 'RC'));
      const sel = list.length > 1 ? yield* G.chooseCards(p, list, { min: 1, max: 1, title: 'Persona Shield: เลือกยูนิทที่ถูกโจมตี', zone: 'field', hint: 'buff' }) : list;
      const more = G.players[1 - p].crest.some(i => G.def(G.cards[i]).name !== 'Energy Generator');
      if (sel[0]) G.addMod(sel[0], { power: more ? 15000 : 10000 }, 'battle');
      G.tf['bmax' + p] = Math.max(G.tf['bmax' + p] || 0, 2);
    },
  },
};
/* ---------- God Hand ticket (Inazuma Eleven: handed out by "Legendary Goalkeeper, Mark Evans"; a blitz ticket) ---------- */
const TICKET_GH = 'TICKET/GodHand'; VG.TICKET_GH = TICKET_GH;
C[TICKET_GH] = {
  no: TICKET_GH, name: 'God Hand', type: 'order', orderKind: 'blitz', ticket: true, nation: null, race: null, grade: 0, power: null, shield: null,
  text: ['ทิกเก็ตการ์ด (ใส่ในเด็คไม่ได้) — เพลย์ตอนยูนิทของคุณถูกโจมตี: เลือกยูนิทที่ถูกโจมตี 1 ใบ พลัง +5000 ต่อการ์ด 1 ใบในดาเมจโซนของคุณ จนจบแบทเทิลนั้น'],
  abilities: [],
  play: {
    cond: (G, me) => !!G.battle && G.active !== me.owner && G.battle.targets.some(i => G.cards[i] && G.cards[i].owner === me.owner && (G.cards[i].zone === 'VC' || G.cards[i].zone === 'RC')),
    *run(G, me) {
      const p = me.owner; const list = G.battle.targets.filter(i => G.cards[i] && G.cards[i].owner === p && (G.cards[i].zone === 'VC' || G.cards[i].zone === 'RC'));
      const sel = list.length > 1 ? yield* G.chooseCards(p, list, { min: 1, max: 1, title: 'God Hand: เลือกยูนิทที่ถูกโจมตี', zone: 'field', hint: 'buff' }) : list;
      if (sel[0]) G.addMod(sel[0], { power: 5000 * G.players[p].damage.length }, 'battle');
    },
  },
};
/* the card list has the ticket as a card of its own (number, picture): tickets handed out are that card when the list is loaded */
const ticketNo = () => { const r = VG.DB && VG.DB.byName && VG.DB.byName['Persona Shield']; return r ? r.no : TICKET_PS; }; VG.ticketNo = ticketNo;
/* "placed from deck or hand: if you took no Persona Shield ticket this turn, take one (reveal a Persona Ride card of the ride deck, or have a vanguard with Persona Ride)" + "when you play a ticket: soul-blast 1, this unit moves to (GC)" — one card of this shape per nation */
const personaInRide = (G, p) => G.players[p].ride.map(i => G.cards[i]).find(c => G.def(c).persona);
const ticketGuard = {
  text: [
    'AUTO: เมื่อยูนิทนี้วางบน RC จากเด็คหรือมือ ถ้าเทิร์นนี้คุณยังไม่ได้รับ Persona Shield ทิกเก็ตขึ้นมือ → เปิดเผยการ์ดที่มีเพอร์โซน่าไรด์จากไรด์เด็ค หรือมีแวนการ์ดที่มีเพอร์โซน่าไรด์ แล้วรับ Persona Shield ทิกเก็ต 1 ใบขึ้นมือ',
    'AUTO (RC): เมื่อคุณเพลย์ Persona Shield ทิกเก็ต [โซลบลาสต์ 1] → ย้ายยูนิทนี้ไป GC (เป็นการ์เดี้ยนของแบทเทิลนั้น)',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'รับ Persona Shield ทิกเก็ต', match: (G, me, e) => e.from === 'deck' || e.from === 'hand',
      cond: (G, me) => !G.tf['pst' + me.owner] && (!!G.def(G.vg(me.owner)).persona || !!personaInRide(G, me.owner)),
      *run(G, me) { const p = me.owner; if (!G.def(G.vg(p)).persona) { const c = personaInRide(G, p); if (!c) return; G.ev('reveal', { iid: c.iid, p }); G.log('เปิดเผย ' + G.name(c) + ' จากไรด์เด็ค', p); } G.giveTicket(p, ticketNo(), me); } },
    { type: 'auto', on: 'ticketPlayed', who: 'any', zone: 'RC', label: 'ย้ายยูนิทนี้ไป GC', cost: [SB(1)], match: (G, me, e) => e.p === me.owner, cond: (G, me) => !!G.battle && G.active !== me.owner,
      *run(G, me) { if (!G.battle || me.zone !== 'RC') return; G.battle.guards++; G.log(G.name(me) + ' ย้ายไป GC', me.owner); G.move(me.iid, 'GC', { reason: 'effect' }); } },
  ],
};
for (const n of ['Dragritter, Nasruddin', 'Fiendish Calamity Dragon, Maidirogue', 'Mad Flame Monster, Blezergas', 'Knight of All Night, Esnia', 'Fairy of Bereavement, Aptschied',
  'Dragritter, Nasrudin', 'Fiendish Misfortune Dragon, Miderotgd', 'Frenetic Blaze Monster, Blaazelgas', 'Knight of the Allnight, Ethnya']) HAND[n] = ticketGuard;

/* "placed on (RC) from hand (not by a unit's skill) or discarded while riding from the ride deck: soul-blast 1 → Persona Shield ticket" + "+5000 when attacking a grade 3 or greater" — one per nation */
const ticketCond = (G, me) => !!G.def(G.vg(me.owner)).persona || !!personaInRide(G, me.owner);
const ticketRun = function* (G, me) { const p = me.owner; if (!G.def(G.vg(p)).persona) { const c = personaInRide(G, p); if (!c) return; G.ev('reveal', { iid: c.iid, p }); G.log('เปิดเผย ' + G.name(c) + ' จากไรด์เด็ค', p); } G.giveTicket(p, ticketNo(), me); };
const notByUnit = (G, e) => !(e.by != null && G.cards[e.by] && G.def(G.cards[e.by]).type === 'unit' && e.by !== e.iid);
const ticketSeeker = extra => ({
  text: [
    'AUTO: เมื่อการ์ดนี้วางบน RC จากมือ (ไม่ใช่ด้วยสกิลของยูนิท)' + (extra ? ' หรือวางบน RC ด้วยสกิลของ "' + extra + '" ของคุณ' : '') + ' หรือถูกทิ้งจากมือตอนไรด์จากไรด์เด็ค → เปิดเผยการ์ดที่มีเพอร์โซน่าไรด์จากไรด์เด็ค หรือมีแวนการ์ดที่มีเพอร์โซน่าไรด์ แล้ว [โซลบลาสต์ 1] → รับ Persona Shield ทิกเก็ต 1 ใบขึ้นมือ',
    'AUTO (RC): เมื่อยูนิทนี้โจมตียูนิทเกรด 3 ขึ้นไป ยูนิทนี้พลัง +5000 จนจบแบทเทิลนั้น',
  ],
  abilities: [
    { type: 'auto', on: 'placeRC', label: 'รับ Persona Shield ทิกเก็ต', cost: [SB(1)], cond: ticketCond, run: ticketRun,
      match: (G, me, e) => (e.from === 'hand' && notByUnit(G, e)) || (!!extra && e.by != null && G.cards[e.by] && G.cards[e.by].owner === me.owner && G.def(G.cards[e.by]).name === extra) },
    { type: 'auto', on: 'discard', label: 'รับ Persona Shield ทิกเก็ต', cost: [SB(1)], cond: ticketCond, run: ticketRun, match: (G, me, e) => !!e.rideCost },
    { type: 'auto', on: 'attack', zone: 'RC', label: 'พลัง +5000', match: (G, me, e) => G.cards[e.target] && G.grade(G.cards[e.target]) >= 3, *run(G, me) { G.addMod(me.iid, { power: 5000 }, 'battle'); } },
  ],
});
for (const n of ['Dragritter, Qawsqozah', 'Colorful Magician, Rayvos', 'Wandel Regenbork', 'Sage of Heavenly Rainbow, Luviron', 'Sea Rainbow Dragon, Ouranioxo', 'Seven Hues Bridge, Lucciel']) HAND[n] = ticketSeeker('');
HAND['Shokudaikiri Mitsutada Ceremonial Attire'] = ticketSeeker('Forge');
/* blitz orders "remove this card: a unit being attacked gets +15000; going second: once per fight a Persona Shield ticket" (two per deck) — one per nation */
const attackedMine = (G, p) => (G.battle ? G.battle.targets.filter(i => G.cards[i] && G.cards[i].owner === p && (G.cards[i].zone === 'VC' || G.cards[i].zone === 'RC')) : []);
const pickAttacked = function* (G, p, n, title) { const list = attackedMine(G, p); const sel = list.length > 1 ? yield* G.chooseCards(p, list, { min: 1, max: 1, title, zone: 'field', hint: 'buff' }) : list; if (sel[0]) G.addMod(sel[0], { power: n }, 'battle'); };
const ticketBlitz = {
  extra: {
    ignoreGrade: (G, p) => G.grade(G.vg(p)) < G.grade(G.vg(1 - p)),
    play: {
      cond: (G, me) => G.active !== me.owner && attackedMine(G, me.owner).length > 0,
      *run(G, me) {
        const p = me.owner; const name = G.def(me).name;
        if (me.zone !== 'gone') G.move(me.iid, 'removed', { reason: 'effect' });
        yield* pickAttacked(G, p, 15000, 'เลือกยูนิทที่ถูกโจมตี (พลัง +15000)');
        const F = G.players[p].fight;
        if (G.first !== p && !(F.ticketBy && F.ticketBy[name])) { G.giveTicket(p, ticketNo(), me); G.tf['bmax' + p] = (G.tf['ord' + p] || 0) + 1; G.tf['onlyTicket' + p] = 1; }
        if (G.tf['persona' + (1 - p)]) yield* pickAttacked(G, p, 5000, 'คู่ต่อสู้เพอร์โซน่าไรด์ในเทิร์นนี้: เลือกยูนิทที่ถูกโจมตี (พลัง +5000)');
      },
    },
  },
  text: [
    'CONT: ใส่ในเด็คได้สูงสุด 2 ใบ',
    'บลิตซ์ออเดอร์ — ถ้าเกรดแวนการ์ดของคุณต่ำกว่าแวนการ์ดคู่ต่อสู้ เพลย์ได้โดยไม่สนเกรด · นำการ์ดนี้ออกจากเกม เลือกยูนิทที่ถูกโจมตี 1 ใบ พลัง +15000 จนจบแบทเทิลนั้น แล้วทำทั้งหมดต่อไปนี้: (1) ถ้าคุณเล่นทีหลัง และในไฟท์นี้ยังไม่ได้รับ Persona Shield ทิกเก็ตจากการ์ดชื่อเดียวกันนี้ → รับ Persona Shield ทิกเก็ต 1 ใบขึ้นมือ และจนจบเทิร์นเพลย์ออเดอร์ได้เพิ่มอีก 1 ใบ แต่เพลย์ได้เฉพาะ Persona Shield ทิกเก็ต (2) ถ้าคู่ต่อสู้เพอร์โซน่าไรด์ในเทิร์นนี้ → เลือกยูนิทที่ถูกโจมตี 1 ใบ พลัง +5000 จนจบแบทเทิลนั้น',
  ],
  abilities: [],
};
for (const n of ['Elegant Flames Sword Dance "Sairei"', 'Mystery Creepy Artillery', "Let's Go! Blitz Securities!", 'Forefront Oriflamme', 'Insetti Omertà', 'Elegant Flames Sword Dance, "Sairei"', 'Go! Blitz Securities!', 'Insetti Omerta']) HAND[n] = ticketBlitz;

/* shared standard pieces, reused for cards built from the full card list */
VG.std = {
  TRIG_TEXT, sentinelText, starterText, starterAbility,
  pgCost: { text: 'AUTO: เมื่อวางบน GC ทิ้งการ์ดจากมือ 1 ใบ → เลือกยูนิทของคุณ 1 ใบ ยูนิทนั้นจะไม่ถูกโจมตีโดนจนจบแบทเทิลนั้น', ability: C['DZ-TD01/013EN'].abilities[0] },
  pgHand2: { text: 'AUTO: เมื่อวางบน GC เลือกยูนิทของคุณ 1 ใบ ยูนิทนั้นจะไม่ถูกโจมตีโดนจนจบแบทเทิลนั้น ถ้ามือมี 2 ใบขึ้นไป ทิ้งการ์ดจากมือ 1 ใบ', ability: C['DZ-BT07/094EN'].abilities[0] },
};
})(typeof globalThis !== 'undefined' ? globalThis : this);
