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
  for (const id of ['phase', 'menu']) { const e = $('#' + id); e.style.left = 'auto'; e.style.right = (L.W - L[id][0]) + 'px'; e.style.top = L[id][1] + 'px'; }
  const cta = $('#cta'); if (L.cta) { cta.style.display = ''; cta.style.right = (L.W - L.cta[0]) + 'px'; cta.style.bottom = (L.H - L.cta[1]) + 'px'; } else cta.style.display = 'none';
  $('#cutin').style.top = L.cut + 'px';
  if (S.snap) { buildZones(); if (changed) for (const k2 in S.els) S.els[k2].classList.add('nomove'); render(); if (changed) requestAnimationFrame(() => { for (const k2 in S.els) S.els[k2].classList.remove('nomove'); }); }
}
function buildZones() {
  const L = LAY[S.lay]; let h = '<div class="mat"><i class="mid"></i><i class="ring r0"></i><i class="ring r1"></i></div>';
  const box = (cls, x, y, w, hh, attr, inner) => '<div class="zone ' + cls + '" style="left:' + (x - w / 2) + 'px;top:' + (y - hh / 2) + 'px;width:' + w + 'px;height:' + hh + 'px" ' + (attr || '') + '>' + (inner || '') + '</div>';
  h += box('gcband', L.BW / 2, L.gc.y, L.gc.w + 200, L.gc.h, '', '<span class="zl">GUARDIAN CIRCLE</span>');
  for (const p of [0, 1]) {
    const o = p === S.viewer ? '' : ' opp'; const at = 'data-p="' + p + '"';
    for (const k in L.circles) { const [x, y] = mirB(p, L.circles[k]); h += box('circle' + (k === 'V' ? ' vc' : '') + o, x, y, L.cd, L.cd, at + ' data-k="' + k + '"', k === 'V' ? '<i class="sig"></i>' : ''); }
    for (const [z, lb] of [['deck', 'DECK'], ['drop', 'DROP'], ['ride', 'RIDE DECK'], ['removed', 'OUT'], ['bind', 'BIND']]) {
      const [x, y] = mirB(p, L[z]); const s = L[z][2];
      h += box('pile' + o, x, y, 100 * s + 12, 140 * s + 12, at + ' data-z="' + z + '" id="zn-' + p + '-' + z + '"', '<span class="zl">' + lb + '</span>');
    }
    { const O = L.order; const w = 100 * O.s + O.step * 4 + 12; const [x, y] = mirB(p, [O.x + O.step * 2, O.y]); h += box('pile' + o, x, y, w, 140 * O.s + 12, at + ' data-z="order" id="zn-' + p + '-order"', '<span class="zl">ORDER ZONE</span>'); }
    { const D = L.damage; const [x, y] = mirB(p, [D.x, D.y + D.step * 2.5]); h += box('pile dmg' + o, x, y, 140 * D.s + 14, D.step * 5 + 100 * D.s + 14, at + ' data-z="damage"', '<span class="zl">DAMAGE</span>'); }
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
    P.hand.forEach((iid, i) => { const u = n > 1 ? (i - (n - 1) / 2) / Math.max(n - 1, 5) : 0; out[iid] = { x: x0 + step * i, y: H.y + sg * u * u * 110 * H.s, s: H.s, r: sg * u * 18, zf: 4 + i * 0.5, z: 300 + i }; });
    { const m = P.deck.length; P.deck.forEach((iid, i) => { out[iid] = B(p, L.deck, { s: L.deck[2], h: 1 + Math.min(m - 1 - i, 44) * 0.55, z: 90 - Math.min(i, 60) }); }); }
    for (const z of ['drop', 'removed', 'bind']) P[z].forEach((iid, i) => { out[iid] = B(p, L[z], { s: L[z][2], h: 1 + Math.min(i, 44) * 0.45, z: 10 + Math.min(i, 80) }); });
    { const m = P.ride.length; P.ride.forEach((iid, i) => { out[iid] = B(p, [L.ride[0] + i * 3, L.ride[1] - i * 2], { s: L.ride[2], h: 1 + (m - 1 - i) * 0.8, z: 40 - i }); }); }
    P.crest.forEach(iid => { out[iid] = B(p, L.crest, { s: L.crest[2], h: 1, z: 5 }); });
    { const O = L.order; P.order.forEach((iid, i) => { out[iid] = B(p, [O.x + O.step * Math.min(i, 4), O.y], { s: O.s, h: 1 + i * 0.5, z: 20 + i }); }); }
    { const D = L.damage; P.damage.forEach((iid, i) => { out[iid] = B(p, [D.x, D.y + D.step * Math.min(i, 5)], { s: D.s, r: 90, h: 1 + i * 0.6, z: 20 + i }); }); }
    { const G = L.gc; const m = P.GC.length; P.GC.forEach((iid, i) => { out[iid] = { flat: true, bx: L.BW / 2 + (i - (m - 1) / 2) * Math.min(G.step, G.w / Math.max(m, 1)), by: G.y, h: 4 + i * 0.4, s: G.s, z: 400 + i }; }); }
    P.trigger.forEach(iid => { out[iid] = { x: L.trigger[0], y: L.trigger[1], s: L.trigger[2], zf: 60, z: 800 }; });
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
    case 'RC': return !c.locked;
    default: return true;
  }
}
