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
    const rest = p.soul ? !!(sn.cards[sn.players[c.owner].circles.V] || {}).rest : c.rest;
    let cls = 'card' + (p.flat ? ' flat' : '');
    for (const k of ['nomove', 'flash', 'shake', 'lunge', 'struck']) if (el.classList.contains(k)) cls += ' ' + k;
    cls += (up ? ' up' : '') + (rest ? ' rest' : '') + (c.locked ? ' locked' : '') + (onfield && up ? ' onfield' : '') + (c.zone === 'hand' ? ' inhand' : '') + (c.zone === 'VC' ? ' vg' : '') + (c.zone === 'trigger' ? ' checking' : '') + (c.owner === S.viewer ? ' mine' : '');
    if (mk.cards[iid]) cls += ' ' + mk.cards[iid];
    if (el.className !== cls) el.className = cls;
  }
  for (const iid in S.els) if (!sn.cards[iid]) { const el = S.els[iid]; el.classList.add('gone'); delete S.els[iid]; setTimeout(() => el.remove(), 320); }
  renderTags(sn, pl); renderPlates(sn);
  for (const p of [0, 1]) for (const z of ['removed', 'bind']) { const e = document.getElementById('zn-' + p + '-' + z); if (e) e.hidden = !sn.players[p][z].length; }
  document.querySelectorAll('#zones .circle').forEach(e => e.classList.toggle('can', !!mk.circles[e.dataset.p + ':' + e.dataset.k]));
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
    const cnt = (z, xy, s, h) => { const n = P[z].length; if (!n && z !== 'deck' && z !== 'drop') return; const q = scrOf(p, [xy[0] + 44 * s, xy[1] - 62 * s], h); set('n' + p + z, q[0], q[1], Math.max(0.7, q[2]), String(n), 'tg cn' + (z === 'deck' && n <= 5 ? ' low' : '')); };
    cnt('deck', L.deck, L.deck[2], 2 + Math.min(P.deck.length, 44) * 0.55); cnt('drop', L.drop, L.drop[2], 2 + Math.min(P.drop.length, 44) * 0.45);
    cnt('ride', L.ride, L.ride[2], 4); cnt('removed', L.removed, L.removed[2], 2); cnt('bind', L.bind, L.bind[2], 2);
    cnt('order', [L.order.x + L.order.step * 4, L.order.y], L.order.s, 2);
  }
  for (const k in S.tags) if (!live[k]) { S.tags[k].remove(); delete S.tags[k]; }
}
function renderPlates(sn) {
  for (const p of [0, 1]) {
    const P = sn.players[p]; const e = document.getElementById('pl-' + p); if (!e) continue;
    const dm = P.damage.length; let pips = ''; for (let i = 0; i < 6; i++) pips += '<i class="' + (i < dm ? 'on' : '') + '"></i>';
    const h = '<div class="pl-n"><b>' + esc(P.name) + '</b><span>' + esc(P.deckName) + '</span>' + (sn.turnNo && sn.first === p ? '<em>เริ่มก่อน</em>' : '') + '</div>'
      + '<div class="pl-s"><span class="hd">มือ <b>' + P.hand.length + '</b></span>' + (P.crest.length ? '<span class="en">EN <b>' + P.energy + '</b><small>/10</small></span>' : '')
      + '<button type="button" class="so" data-p="' + p + '" data-z="soul" title="ดูการ์ดในโซล">โซล <b>' + P.soul.length + '</b></button>'
      + '<span class="dm' + (dm >= 5 ? ' hot' : '') + '" title="ดาเมจ ' + dm + '/6">' + pips + '</span></div>'
      + (P.effects.length ? '<div class="pl-fx">' + P.effects.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' : '');
    e.classList.toggle('turn', sn.active === p && !!sn.turnNo);
    if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
  }
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
function renderSwaps() {
  const d = pendingForMe(); const L = LAY[S.lay]; let h = '';
  if (d && d.kind === 'main' && !S.picker) d.options.forEach((o, i) => {
    if (o.a !== 'move') return;
    const f = L.circles[o.col === 'L' ? 'FL' : 'FR'], bk = L.circles[o.col === 'L' ? 'BL' : 'BR'];
    const q = scrOf(d.player, [f[0] + (o.col === 'L' ? -1 : 1) * (L.cd / 2 + 22), (f[1] + bk[1]) / 2], 4);
    h += '<button type="button" data-i="' + i + '" title="สลับแถวหน้า/หลัง" aria-label="สลับแถวหน้าและแถวหลัง" style="left:' + q[0].toFixed(0) + 'px;top:' + q[1].toFixed(0) + 'px">⇅</button>';
  });
  const e = $('#swaps'); if (e.dataset.h !== h) { e.innerHTML = h; e.dataset.h = h; }
}
