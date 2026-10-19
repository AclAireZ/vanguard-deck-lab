// A half-automatic skill in the real page: the ACT button is offered, the game then waits with "เสร็จแล้ว" and ✋ ทำเอง, the card is shown in the detail panel,
// a manual action can be done while it waits, and the game goes on afterwards. Screenshots go to shots/.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const lay = process.argv[2] === 'port' ? 'port' : 'land';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: lay === 'port' ? { width: 400, height: 820 } : { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
const stat = await pg.evaluate(() => document.querySelector('#dbStat').textContent);
await pg.click('#goBtn'); await pg.waitForTimeout(600);
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && g.pending && !U.S.busy && !U.S.running; }, null, { timeout: 20000 });
for (let n = 0; n < 300; n++) {
  await ready();
  const done = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; const d = g.pending; if (d.kind === 'main' && g.turnNo >= 3 && (U.S.mode === 'solo' || d.player === U.S.seat)) return true; U.submit(window.VG.bot(g)); return false; });
  if (done) break;
}
// put a half-automatic unit (an ACT on (RC) with no cost and no condition) on the table
const put = await pg.evaluate(() => {
  const VG = window.VG, U = window.VGUI, g = U.S.game, p = g.pending.player;
  const r = VG.DB.rows.find(x => x.semi && x.t === 'U' && x.ast.a.filter(a => a.t === 'k').length === 1 && x.ast.a.some(a => a.t === 'k' && a.as && !a.k && !a.c && a.z === 'R'));
  if (!r) return null; const old = g.rcs(p).find(u => u.pos === 'FL'); if (old) g.move(old.iid, 'drop', { silent: true }); const c = g.newCard(r.no, p, 'new'); g.move(c.iid, 'RC', { pos: 'FL', silent: true }); g.pending.options = g.mainOptions(p);
  const i = g.pending.options.findIndex(o => o.a === 'act' && o.iid === c.iid); U.S.snap = g.snapshot();
  return { no: r.no, name: r.name, iid: c.iid, act: i, tag: U.tagOf(VG.card(r.no)), botSkips: (() => { const a = VG.bot(g); const o = g.pending.options[a[0]]; return !(o.a === 'act' && o.iid === c.iid); })() };
});
if (!put) { console.log('no suitable card'); process.exit(1); }
const hand0 = await pg.evaluate(() => { const g = window.VGUI.S.game; return g.players[g.pending.player].hand.length; });
await pg.evaluate(i => window.VGUI.submit([i]), put.act); await ready(); await pg.waitForTimeout(300);
const wait1 = await pg.evaluate(() => { const g = window.VGUI.S.game, d = g.pending; return { manstep: !!d.manstep, btns: [...document.querySelectorAll('#prompt button')].map(x => x.textContent.trim()), detail: (document.querySelector('#detail') || document.body).textContent.includes('กึ่งออโต้'), title: d.title }; });
await pg.screenshot({ path: 'shots/assist-' + lay + '-1.png' });
await pg.click('#prompt [data-do="manual"]');
await pg.waitForFunction(() => document.querySelector('#picker .mbox.man') && !document.querySelector('#picker').hidden, null, { timeout: 20000 });
await pg.click('#picker [data-man="1,1"]'); await pg.waitForTimeout(400);
const mid = await pg.evaluate(() => { const g = window.VGUI.S.game; return { manstep: !!g.pending.manstep, hand: g.players[g.pending.player].hand.length, panel: !document.querySelector('#picker').hidden }; });
await pg.screenshot({ path: 'shots/assist-' + lay + '-2.png' });
await pg.click('#picker [data-close]'); await pg.waitForTimeout(250);
await pg.click('#prompt button:has-text("เสร็จแล้ว")'); await ready(); await pg.waitForTimeout(200);
const after = await pg.evaluate(() => { const g = window.VGUI.S.game; return { kind: g.pending.kind, manstep: !!g.pending.manstep }; });
const overflow = await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log(JSON.stringify({ lay, stat, put, wait1, mid, hand0, after, overflow }));
const ok = /กึ่งออโต้/.test(stat) && put.act >= 0 && put.botSkips && /กึ่งออโต้/.test(put.tag) && wait1.manstep && wait1.btns.some(t => t.includes('เสร็จแล้ว')) && wait1.btns.some(t => t.includes('ทำเอง')) && wait1.detail && mid.manstep && mid.hand === hand0 + 1 && mid.panel && after.kind === 'main' && !after.manstep && !overflow && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs);
console.log(ok ? 'half-automatic skill ok (' + lay + ')' : 'ASSIST UI FAILED'); if (!ok) process.exitCode = 1;
await b.close();
