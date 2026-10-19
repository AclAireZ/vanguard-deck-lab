/* ================= detail panel ================= */
function showDetail(no, iid) {
  const d = C[no]; if (!d) return;
  const c = iid && S.snap ? S.snap.cards[iid] : null;
  let now = '';
  if (c && c.power !== undefined && (c.zone === 'VC' || c.zone === 'RC')) now = '<b class="now">ตอนนี้ ' + fmtP(c.power) + (c.crit > 1 ? ' ★' + c.crit : '') + '</b>';
  if (c && c.zone === 'GC') now = '<b class="now">ชิลด์ตอนนี้ ' + c.shield + '</b>';
  const chips = [];
  if (d.type === 'unit' || d.type === 'token') { chips.push('G' + d.grade, 'พลัง ' + d.power); if (d.shield != null) chips.push('ชิลด์ ' + d.shield); }
  if (d.type === 'order') chips.push(d.orderKind === 'set' ? 'เซ็ตออเดอร์' : d.orderKind === 'blitz' ? 'บลิตซ์ออเดอร์' : 'ออเดอร์', 'G' + d.grade);
  if (d.trigger) chips.push(VG.TRIG_TH[d.trigger]);
  if (d.drive === 2) chips.push('ทวินไดรฟ์'); if (d.drive === 3) chips.push('ทริปเปิลไดรฟ์'); if (d.persona) chips.push('เพอร์โซน่าไรด์'); if (d.boost) chips.push('บูสต์'); if (d.intercept) chips.push('อินเตอร์เซปต์'); if (d.sentinel) chips.push('เซนทิเนล');
  const head = '<div class="dn">' + esc(d.name) + tagOf(d) + '</div><div class="dm">' + esc([d.nation, d.race, d.no.startsWith('TOKEN') ? 'โทเคน' : d.no].filter(Boolean).join(' · ')) + '</div>'
    + '<div class="ds">' + chips.map(x => '<b>' + esc(x) + '</b>').join('') + now + '</div>';
  const text = '<div class="dt">' + (d.auto && !(d.text || []).length ? '<p class="empty">ไม่มีสกิล</p>' : cardNote(d)) + '</div>';
  $('#detail').innerHTML = S.lay === 'port' ? '<div class="dcol">' + head + text + '</div>' : '<div class="dtop"><div class="dprev">' + staticCard(no, true) + '</div><div class="dinfo">' + head + '</div></div>' + text;
  $('#detail').dataset.no = no;
}

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
function quake() { const st = $('#stage'); st.classList.remove('quake'); void st.offsetWidth; st.classList.add('quake'); setTimeout(() => st.classList.remove('quake'), 420); }
function logLine(text, cls) { const l = $('#log'); const e = document.createElement('div'); e.className = cls || ''; e.textContent = text; l.appendChild(e); l.scrollTop = l.scrollHeight; }
function dur(e) {
  let d;
  switch (e.t) {
    case 'move': d = e.reason === 'draw' ? (S.snap && S.snap.turnNo === 0 ? 70 : 200) : e.reason === 'guardEnd' ? 70 : /Check$/.test(e.reason) ? 110 : e.reason === 'mulligan' ? 90 : e.reason === 'ride' && e.to === 'VC' ? 620 : e.to === 'damage' ? 420 : 280; break;
    case 'check': d = e.trigger ? 1350 : 780; break;
    case 'attack': d = 640; break; case 'result': d = 720; break; case 'ability': d = 600; break;
    case 'phase': d = e.phase === 'stand' || e.phase === 'draw' || e.phase === 'mulligan' ? 140 : e.phase === 'battle' ? 520 : 300; break;
    case 'turn': d = 1050; break; case 'mod': d = 150; break; case 'cost': case 'energy': d = 220; break;
    case 'persona': case 'standup': d = 1100; break; case 'reveal': d = 800; break; case 'lock': d = 450; break; case 'shuffle': d = 110; break;
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
    case 'persona': cutin('PERSONA RIDE', 'จั่ว 1 ใบ · แถวหน้า +10000', 'gold', 1100); { const q = scrOf(e.p, L.circles.V, 4); sprite('ring gold', q[0], q[1], 900, q[2]); } break;
    case 'move': {
      if (e.reason === 'ride' && e.to === 'VC') { const q = scrOf(e.p, L.circles.V, 4); sprite('ring ' + side(e.p), q[0], q[1], 800, q[2]); sprite('pillar ' + side(e.p), q[0], q[1], 700, q[2]); const c = sn.cards[e.iid]; if (c && sn.turnNo > 0) cutin('RIDE', C[c.no].name, side(e.p) + ' small', 640); }
      else if (e.to === 'RC' && e.from !== 'RC' && e.from !== 'VC') { const p = S.pl[e.iid]; if (p) sprite('ring sm ' + side(e.p), p.x, p.y, 520, p.k); }
      else if (e.to === 'damage') { sprite('dmgflash ' + side(e.p), 0, 0, 520); if (e.p === S.viewer) quake(); }
      break;
    }
    case 'check': {
      pop(L.trigger[0], L.trigger[1] - 126, e.kind === 'drive' ? 'DRIVE CHECK' : 'DAMAGE CHECK', e.kind === 'drive' ? '' : 'bad');
      if (e.trigger) { sprite('burst t-' + e.trigger, L.trigger[0], L.trigger[1], 1300); cutin(TRIG[e.trigger] + ' TRIGGER', C[e.no].name, 'trg t-' + e.trigger, 1150); }
      showDetail(e.no); break;
    }
    case 'attack': mark(e.attacker, 'lunge', 520); if (e.booster) mark(e.booster, 'flash', 520); break;
    case 'result': {
      const p = S.pl[e.target];
      if (e.hit) { mark(e.target, 'struck', 520); if (p) sprite('slash', p.x, p.y, 460, p.k); popAt(e.target, 'HIT!', 'bad'); }
      else { if (p) sprite('guardfx', p.x, p.y, 560, p.k); popAt(e.target, 'GUARD', 'ok'); }
      break;
    }
    case 'ability': { mark(e.iid, 'flash', 650); const c = sn.cards[e.iid]; if (c) { showDetail(e.no, e.iid); skillToast(e.p, C[e.no].name); } break; }
    case 'mod': { const m = e.mod; const a = []; if (m.power) a.push((m.power >= 100000000 ? '+100M' : (m.power > 0 ? '+' : '') + m.power)); if (m.crit) a.push('★' + (m.crit > 0 ? '+' : '') + m.crit); if (m.shield && !m.power) a.push('ชิลด์ ' + (m.shield > 0 ? '+' : '') + m.shield); if (m.drive) a.push('ไดรฟ์ ' + (m.drive > 0 ? '+' : '') + m.drive); if (a.length) popAt(e.iid, a.join(' '), m.power < 0 ? 'bad' : '', -30); break; }
    case 'energy': { const at = e.p === S.viewer ? L.plate : L.oppPlate; pop(at[0] + 150, at[1] + 10, 'EN ' + (e.n > 0 ? '+' : '') + e.n, e.n > 0 ? 'ok' : ''); break; }
    case 'cost': { const D = L.damage; const q = e.kind === 'SB' ? scrOf(e.p, L.circles.V, 4) : scrOf(e.p, [D.x, D.y + D.step * 2], 4); pop(q[0], q[1], e.kind + ' ' + e.n, e.kind === 'CC' ? 'ok' : ''); break; }
    case 'lock': popAt(e.iid, 'LOCK', 'bad'); break;
    case 'reveal': if (sn.cards[e.iid]) { showDetail(sn.cards[e.iid].no); cutin('REVEAL', C[sn.cards[e.iid].no].name, 'small', 700); } break;
    case 'shuffle': { const q = scrOf(e.p, L.deck, 20); pop(q[0], q[1] - 40, 'SHUFFLE'); break; }
  }
}
async function play(events) {
  for (const e of events) {
    if (e.t === 'log') { logLine(e.text, e.p === undefined ? '' : 'p' + e.p); continue; }
    if (!e.snap) continue;
    S.snap = e.snap;
    if (S.mode === 'solo' && S.view === 'auto' && e.t === 'turn' && S.viewer !== e.p) { S.viewer = e.p; buildZones(); }
    render(); fx(e);
    await sleep(dur(e));
  }
}
