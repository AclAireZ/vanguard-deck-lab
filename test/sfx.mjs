// Sounds: every named sound can be started without an error, a whole fight asks for many different ones (one per kind of action), and the switch silences them.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.mouse.click(5, 5);
const all = await pg.evaluate(() => { const S = window.VGUI.Sfx; S.arm(); const names = Object.keys(S.S); let bad = []; for (const n of names) { try { S.last = {}; S.S[n].call(S); } catch (e) { bad.push(n + ': ' + e.message); } } return { n: names.length, bad, ctx: !!S.ctx, state: S.ctx && S.ctx.state, out: !!S.out, noise: !!S.nz }; });
await pg.evaluate(() => { const S = window.VGUI.Sfx; window.__played = {}; const p = S.play.bind(S); S.play = name => { if (name) window.__played[name] = (window.__played[name] || 0) + 1; return p(name); }; });
await pg.click('#goBtn'); await pg.waitForTimeout(500); await pg.evaluate(() => { window.VGUI.S.speed = 6; });
for (let n = 0; n < 6000; n++) {   // a long fight needs many answers; the end sound is part of the check
  const st = await pg.evaluate(() => { const U = window.VGUI, g = U.S.game; if (!g) return 'wait'; if (g.over) return 'over'; if (!g.pending || U.S.busy || U.S.running) return 'wait'; U.submit(window.VG.bot(g)); return 'go'; });
  if (st === 'over') break; if (st === 'wait') await pg.waitForTimeout(40);
}
await pg.waitForSelector('#endov:not([hidden])', { timeout: 20000 }).catch(() => {});   // the end screen (and its sound) comes after the last animations
await pg.waitForTimeout(300);
const played = await pg.evaluate(() => window.__played);
const toggle = await pg.evaluate(() => { const S = window.VGUI.Sfx; const b = document.querySelector('#mSfx'); const before = [S.on, b.textContent]; b.click(); const mid = [S.on, b.textContent, document.querySelector('#sfxBtn').getAttribute('aria-pressed')]; b.click(); return { before, mid, after: [S.on, b.textContent] }; });
const kinds = Object.keys(played);
console.log(JSON.stringify({ all, kinds: kinds.length, played, toggle, errs }));
const need = ['draw', 'ride', 'place', 'attack', 'check', 'damage', 'turn', 'battle', 'standup'];
const ok = all.n >= 40 && !all.bad.length && all.ctx && all.out && all.noise && kinds.length >= 14 && need.every(k => played[k]) && (played.hit || played.hitbig) && (played.win || played.lose) && toggle.before[0] === true && toggle.mid[0] === false && /ปิด/.test(toggle.mid[1]) && toggle.mid[2] === 'false' && toggle.after[0] === true && !errs.length;
console.log(ok ? 'sounds ok' : 'SOUNDS FAILED'); if (!ok) process.exitCode = 1;
await b.close();
