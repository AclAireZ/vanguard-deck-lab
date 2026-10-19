// Plays a whole game against the bot through the real page with real mouse clicks (cards on the tilted board, circles, prompt buttons, picker).
// usage: node test/click.mjs [land|port] [seed-ish runs]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const mode = process.argv[2] || 'land'; const vp = mode === 'port' ? { width: 400, height: 820 } : { width: 1366, height: 800 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: vp, hasTouch: mode === 'port' });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push(m.text()); });
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.click('#modeSeg [data-mode="bot"]');
await pg.evaluate(() => { window.VGUI.S.speed = 6; });
await pg.click('#goBtn');
const idle = () => pg.evaluate(async () => { const S = window.VGUI.S; for (let k = 0; k < 2400 && (S.running || S.busy); k++) await new Promise(r => setTimeout(r, 25)); return !S.running && !S.busy; });
/* click an element at a point where it really is the top-most thing (cards overlap in the hand fan) */
async function hit(sel) {
  // wait until the element has stopped gliding
  const find = () => pg.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect();
    for (const fy of [0.5, 0.3, 0.7, 0.15, 0.85]) for (const fx of [0.5, 0.2, 0.8, 0.08, 0.92, 0.35, 0.65]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy; const t = document.elementFromPoint(x, y);
      if (t && (t === el || el.contains(t))) return [x, y, Math.round(r.left * 2) + ',' + Math.round(r.top * 2)];
    }
    return [0, 0, 'covered ' + Math.round(r.left) + ',' + Math.round(r.top)];
  }, sel);
  let pt = null, same = 0, last = '';
  for (let k = 0; k < 60 && same < 3; k++) { await pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); const q = await find(); if (q && q[2] === last && !q[2].startsWith('covered')) same++; else same = 0; last = q ? q[2] : ''; pt = q && !q[2].startsWith('covered') ? q : null; await pg.waitForTimeout(40); }
  if (!pt) { const why = await pg.evaluate(sel => { const el = document.querySelector(sel); if (!el) return 'no element'; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const S = window.VGUI.S; const c = S.snap.cards[el.dataset.iid]; return JSON.stringify({ rect: [r.left, r.top, r.width, r.height].map(Math.round), top: t ? (t.id || t.className) + ' < ' + (t.parentElement.id || t.parentElement.className) + ' < ' + (t.parentElement.parentElement.id || t.parentElement.parentElement.className) : null, cls: el.className, zone: c && c.zone, pending: S.game.pending && S.game.pending.kind, picker: !!S.picker }); }, sel); await pg.screenshot({ path: 'shots/click-fail.png' }); throw new Error('cannot reach ' + sel + ' ' + why); }
  await pg.mouse.click(pt[0], pt[1]);
}
let steps = 0, clicks = { card: 0, circle: 0, button: 0, picker: 0 };
for (; steps < 900; steps++) {
  if (!(await idle())) throw new Error('table stayed busy');
  const st = await pg.evaluate(() => {
    const S = window.VGUI.S; const g = S.game; if (!g) return { none: 1 }; if (g.over) return { over: g.over, turn: g.turnNo };
    const d = g.pending; if (!d) return { none: 1 }; if (d.player !== S.seat) return { wait: 1 };
    const sel = window.VG.bot(g);
    return { kind: d.kind, sel, opts: sel.map(i => d.options[i]), min: d.min, max: d.max, n: d.options.length, picker: !!S.picker, turn: g.turnNo, p: d.player };
  });
  if (st.over) { console.log(mode, 'game over on turn', st.turn, JSON.stringify(st.over), 'after', steps, 'decisions; clicks', JSON.stringify(clicks)); break; }
  if (st.none || st.wait) { await pg.waitForTimeout(60); continue; }
  const o = st.opts[0];
  const card = async iid => { await hit('#cards .card[data-iid="' + iid + '"]'); clicks.card++; };
  const btn = async sel => { await hit(sel); clicks.button++; };
  if (st.kind === 'main') {
    if (o.a === 'call') { await card(o.iid); await hit('#zones .circle[data-p="' + st.p + '"][data-k="' + o.circle + '"], #cards .card.mine.onfield'); /* fallthrough target chosen below */ }
    if (o.a === 'call') {
      // the circle may be covered by the unit standing on it: then the unit itself is the click target
      const done = await pg.evaluate(() => !window.VGUI.S.src);
      if (!done) { const occ = await pg.evaluate(([p, k]) => { const g = window.VGUI.S.game; const c = g.at(p, k); return c ? c.iid : null; }, [st.p, o.circle]); if (occ) await card(occ); else await hit('#zones .circle[data-p="' + st.p + '"][data-k="' + o.circle + '"]'); clicks.circle++; }
    } else if (o.a === 'order') { await card(o.iid); await btn('#prompt .btn.act[data-i="' + st.sel[0] + '"]'); }
    else if (o.a === 'move') await btn('#swaps button[data-i="' + st.sel[0] + '"]');
    else await btn('#prompt [data-i="' + st.sel[0] + '"]');
  } else if (st.kind === 'attack') {
    if (o.a === 'attack') { await card(o.iid); await card(o.target); } else await btn('#prompt [data-i="' + st.sel[0] + '"]');
  } else if (st.kind === 'ride') {
    if (o.a === 'ride') await card(o.iid); else await btn('#prompt [data-i="' + st.sel[0] + '"]');
  } else if (st.kind === 'cards' || st.kind === 'mulligan' || st.kind === 'guard') {
    const single = st.min === 1 && st.max === 1;
    if (st.picker) { for (const i of st.sel) { await hit('#picker .mcard[data-pk="' + i + '"]'); clicks.picker++; } if (!single) await btn('#picker [data-pkok]'); }
    else { for (const x of st.opts) await card(x.iid); if (!single) await btn('#prompt [data-do="confirm"]'); }
  } else if (st.kind === 'circle') {
    if (!st.sel.length) await btn('#prompt [data-do="skip"]');
    else { const occ = await pg.evaluate(([p, k]) => { const c = window.VGUI.S.game.at(p, k); return c ? c.iid : null; }, [st.p, o.circle]); if (occ) await card(occ); else { await hit('#zones .circle[data-p="' + st.p + '"][data-k="' + o.circle + '"]'); clicks.circle++; } }
  } else await btn('#prompt [data-i="' + st.sel[0] + '"]');
  await pg.waitForTimeout(30);
}
const fin = await pg.evaluate(() => { const g = window.VGUI.S.game; return { over: !!g.over, turn: g.turnNo, end: !document.querySelector('#endov').hidden }; });
if (errs.length) { console.log('PAGE ERRORS', errs.slice(0, 6)); process.exitCode = 1; }
if (!fin.over || !fin.end) { console.log('game did not finish', JSON.stringify(fin), 'steps', steps); process.exitCode = 1; }
await pg.screenshot({ path: 'shots/click-' + mode + '-end.png' });
await b.close();
