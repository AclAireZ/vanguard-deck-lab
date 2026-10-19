// The Varga sample deck in the real page: it is offered in the lobby, a whole fight runs with the bot answering for both seats, no page errors; a screenshot of a battle goes to shots/.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
const offered = await pg.evaluate(() => [...document.querySelectorAll('#deckSel0 option')].map(o => o.value + '|' + o.textContent));
await pg.selectOption('#deckSel0', 'VARGA'); await pg.waitForTimeout(200);
const meta = await pg.evaluate(() => document.querySelector('.dk.p0 .meta') ? document.querySelector('.dk.p0 .meta').textContent : '');
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; window.__ab = {}; });
let shot = false, turns = 0;
for (let n = 0; n < 8000; n++) {
  const st = await pg.evaluate(() => {
    const U = window.VGUI, g = U.S.game; if (!g) return 'wait'; if (g.over) return 'over'; if (!g.pending || U.S.busy || U.S.running) return 'wait';
    for (const c of Object.values(g.cards)) if (c.zone === 'VC' && c.st) window.__st = Object.keys(c.st);
    const d = g.pending; const sn = U.S.snap; if (sn && sn.battle && d.kind === 'guard' && window.VG.card(g.cards[sn.battle.attacker].no).name.includes('Varga')) window.__shot = (window.__shot || 0) + 1;
    U.submit(window.VG.bot(g)); return 'go:' + g.turnNo;
  });
  if (st === 'over') break; if (st === 'wait') { await pg.waitForTimeout(40); continue; }
  turns = +st.split(':')[1];
  if (!shot && await pg.evaluate(() => window.__shot === 1)) { shot = true; await pg.waitForTimeout(350); await pg.screenshot({ path: 'shots/varga-battle.png' }); }
}
await pg.waitForSelector('#endov:not([hidden])', { timeout: 20000 }).catch(() => {});
const end = await pg.evaluate(() => { const g = window.VGUI.S.game; const log = [...document.querySelectorAll('#log div')].map(x => x.textContent); return { over: g.over, turn: g.turnNo, skills: log.filter(t => /ใช้สกิล: .*Varga/.test(t)).length, divine: log.filter(t => /Divine/.test(t)).length, stood: log.filter(t => /Varga.*(สแตนด์|Divine)/.test(t)).length, sample: log.filter(t => /ใช้สกิล: /.test(t)).slice(0, 400).map(t => t.replace('ใช้สกิล: ', '').split(' — ')[0]) }; });
const kinds = [...new Set(end.sample)];
console.log(JSON.stringify({ offered: offered.filter(x => x.startsWith('VARGA')), meta: meta.slice(0, 120), over: end.over, turn: end.turn, vargaSkills: end.skills, cardsWithSkillsUsed: kinds.length, kinds: kinds.slice(0, 30), shot, errs }));
const ok = offered.some(x => x.startsWith('VARGA')) && end.over && end.skills >= 1 && kinds.length >= 4 && !errs.length;
console.log(ok ? 'Varga deck ok in the page' : 'VARGA UI FAILED'); if (!ok) process.exitCode = 1;
await b.close();
