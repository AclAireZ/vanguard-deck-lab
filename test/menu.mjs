// Title screen: the opening never blocks a click, the menu switches the match set-up, the side sheets open and close, nothing overflows on a phone.
// Run twice: plain (the animation library cannot be reached → style-sheet animations) and with GSAP_JS=<path to gsap.min.js> (the library runs the opening).
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8'); const lib = process.env.GSAP_JS && fs.existsSync(process.env.GSAP_JS) ? fs.readFileSync(process.env.GSAP_JS) : null;
const b = await chromium.launch(); let ok = true; const out = {};
for (const [w, h, tag] of [[1366, 768, 'land'], [400, 820, 'port']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await ctx.route('https://cdnjs.cloudflare.com/**', r => (lib ? r.fulfill({ contentType: 'text/javascript', body: lib }) : r.abort()));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://vg.test/');
  await pg.click('#modeSeg [data-mode="bot"]');                      // straight away, while the opening card is still up
  const early = await pg.evaluate(() => ({ mode: window.VGUI.S.mode, tag: document.querySelector('.dk.p1 .dk-tag span').textContent, stage: document.querySelector('#stageMode').textContent }));
  await pg.waitForFunction(() => document.body.classList.contains('seen'), null, { timeout: 8000 });
  const st = await pg.evaluate(() => ({ gs: !!window.gsap, fans: document.querySelectorAll('#slots .fc .cf').length, vs: !!document.querySelector('#slots .vs'), sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    op: [...document.querySelectorAll('.lb-menu button, .dk, .vs, .go.big')].map(e => +getComputedStyle(e).opacity).filter(x => x < 0.99).length, intro: getComputedStyle(document.querySelector('#lbIntro')).display }));
  await pg.click('#modeSeg [data-mode="online"]'); const one = await pg.evaluate(() => ({ cls: document.querySelector('#slots').className, n: document.querySelectorAll('#slots .dk').length, go: document.querySelector('#goRow').hidden }));
  await pg.click('#modeSeg [data-mode="solo"]');
  await pg.click('#navHelp'); const d1 = await pg.evaluate(() => ({ open: !document.querySelector('#drawer').hidden, help: !document.querySelector('.lb-dbody[data-d="help"]').hidden, opt: document.querySelector('.lb-dbody[data-d="opt"]').hidden, t: document.querySelector('#drawerT').textContent }));
  await pg.keyboard.press('Escape'); const d2 = await pg.evaluate(() => document.querySelector('#drawer').hidden);
  await pg.click('#navOpt'); await pg.click('.lb-dback', { position: { x: 5, y: 5 } }); const d3 = await pg.evaluate(() => document.querySelector('#drawer').hidden);
  await pg.click('#sfxBtn'); const sfx = await pg.evaluate(() => ({ p: document.querySelector('#sfxBtn').getAttribute('aria-pressed'), s: window.VGUI.store.get('vg.sfx') }));
  await pg.click('#goBtn'); await pg.waitForFunction(() => !document.querySelector('#table').hidden && window.VGUI.S.game, null, { timeout: 5000 });
  const cur = await pg.evaluate(() => !!document.querySelector('.curtain')); await pg.waitForTimeout(1200); const curGone = await pg.evaluate(() => !document.querySelector('.curtain'));
  const good = early.mode === 'bot' && early.tag === 'CPU' && early.stage === 'VS CPU' && st.fans === 6 && st.vs && st.sw <= st.iw && st.op === 0 && st.intro === 'none' && (!lib || st.gs) && one.cls === 'one' && one.n === 1 && one.go
    && d1.open && d1.help && d1.opt && d2 && d3 && sfx.p === 'false' && sfx.s === false && cur && curGone && !errs.length;
  out[tag] = { early, st, one, d1, sfx, cur, errs: errs.slice(0, 3) }; if (!good) ok = false;
  await ctx.close();
}
console.log(JSON.stringify(out)); console.log(ok ? 'menu ok' + (lib ? ' (animation library)' : ' (style-sheet animations)') : 'MENU FAILED'); if (!ok) process.exitCode = 1;
await b.close();
