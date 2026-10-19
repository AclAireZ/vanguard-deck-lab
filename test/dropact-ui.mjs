// A skill used from the drop zone by clicking: two "Adoring Dragon" in the drop, the drop zone glows, the viewer lists the card with a "use skill" button, the button uses it.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); await pg.goto('http://vg.test/'); await pg.waitForTimeout(400);
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
const ready = () => pg.waitForFunction(() => { const U = window.VGUI, g = U.S.game; return g && (g.over || (g.pending && !U.S.busy && !U.S.running)); }, null, { timeout: 30000 });
for (let n = 0; n < 300; n++) { await ready(); const st = await pg.evaluate(() => { const g = window.VGUI.S.game; return { k: g.pending.kind, t: g.turnNo }; }); if (st.k === 'main' && st.t >= 3) break; await pg.evaluate(() => { const U = window.VGUI; U.submit(window.VG.bot(U.S.game)); }); }
const p = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game, p = g.pending.player; const no = window.VG.DB.rows.find(r => r.name === 'Adoring Dragon').no; for (let k = 0; k < 2; k++) { const c = g.newCard(no, p, 'drop'); } U.submit([-1, window.VG.MAN.op.shuf]); return p; });
await ready(); await pg.waitForTimeout(500);
const glow = await pg.evaluate(p => { const e = document.querySelector('#zn-' + p + '-drop'); return !!e && e.classList.contains('can'); }, p);
await pg.screenshot({ path: 'shots/dropact-field.png' });
await pg.evaluate(p => document.querySelector('#zn-' + p + '-drop').click(), p); await pg.waitForTimeout(300);
const btns = await pg.$$eval('#picker [data-vi]', e => e.map(x => x.textContent));
await pg.screenshot({ path: 'shots/dropact-viewer.png' });
const before = await pg.evaluate(p => window.VGUI.S.game.players[p].bind.length, p);
if (btns.length) await pg.click('#picker [data-vi]'); await pg.waitForTimeout(800);
for (let n = 0; n < 10; n++) { const k = await pg.evaluate(() => { const g = window.VGUI.S.game; return g.pending && g.pending.kind; }); if (k === 'main') break; await pg.evaluate(() => { const U = window.VGUI; U.submit(window.VG.bot(U.S.game)); }); await pg.waitForTimeout(300); }
const after = await pg.evaluate(p => window.VGUI.S.game.players[p].bind.length, p);
const ok = glow && btns.length > 0 && after > before && !errs.length;
console.log(JSON.stringify({ glow, btns, before, after, errs })); console.log(ok ? 'drop skill ui ok' : 'DROP SKILL UI FAILED'); if (!ok) process.exitCode = 1;
await b.close();
