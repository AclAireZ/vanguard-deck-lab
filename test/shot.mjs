// Screenshots of the built page: node test/shot.mjs [name] → shots/<name>-*.png  (lobby, table mid-game in landscape + phone portrait)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const name = process.argv[2] || 'ui'; const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' in {} ? undefined : undefined });
async function shoot(w, h, tag, steps) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('http://vg.test/'); await pg.waitForTimeout(500);
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-lobby.png', fullPage: false });
  await pg.evaluate(() => { window.VGUI.S.speed = 6; });
  await pg.click('#goBtn'); await pg.waitForTimeout(1500);
  // let the bot play both seats for a while to reach a mid-game board
  await pg.evaluate(async (steps) => { const U = window.VGUI; const S = U.S; for (let i = 0; i < steps; i++) { for (let k = 0; k < 400 && (S.running || S.busy); k++) await new Promise(r => setTimeout(r, 25)); const g = S.game; if (!g || !g.pending || g.over) break; if (g.pending.kind === 'attack' && g.turnNo >= 5 && i > steps - 30) break; U.submit(window.VG.bot(g)); } }, steps);
  await pg.waitForTimeout(1800);
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-table.png' });
  // battle frames at normal speed: beam on a pending guard, then a few frames of the drive check
  await pg.evaluate(async () => { const U = window.VGUI; const S = U.S; S.speed = 1; for (let i = 0; i < 60; i++) { for (let k = 0; k < 600 && (S.running || S.busy); k++) await new Promise(r => setTimeout(r, 25)); const g = S.game; if (!g || !g.pending || g.over) break; if (g.pending.kind === 'guard' && g.cards[g.battle.attacker].zone === 'VC') break; U.submit(window.VG.bot(g)); } });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-battle.png' });
  await pg.evaluate(() => { const U = window.VGUI; const g = U.S.game; if (g && g.pending && !g.over) U.submit([]); });
  for (let f = 0; f < 4; f++) { await pg.waitForTimeout(f === 0 ? 450 : 520); await pg.screenshot({ path: 'shots/' + name + '-' + tag + '-fx' + f + '.png' }); }
  if (errs.length) console.log(tag, 'ERRORS', errs.slice(0, 5));
  await ctx.close();
}
fs.mkdirSync('shots', { recursive: true });
await shoot(1440, 860, 'land', 150);
await shoot(400, 820, 'port', 150);
await b.close(); console.log('shots written');
