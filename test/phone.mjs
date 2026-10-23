// Phone check: lobby (VS CPU + level), a game vs the hard bot with taps, portrait and landscape, iPhone and small Android sizes.  node test/phone.mjs
const { chromium } = await import(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const sizes = (process.env.SIZES || 'ip-port:390x844,ip-land:844x390,sa-port:360x740,sa-land:740x360').split(',').map(x => { const [n, wh] = x.split(':'); const [w, h] = wh.split('x').map(Number); return { n, w, h }; });
const b = await chromium.launch(); let bad = 0;
for (const z of sizes) {
  const ctx = await b.newContext({ viewport: { width: z.w, height: z.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.route('http://127.0.0.1:9999/**', r => r.fulfill({ contentType: 'text/html', body: html })); await pg.route(/cf-vanguard|googleapis|cdnjs|emqx|hivemq|mosquitto|peerjs|supabase|wikia/, r => r.abort());
  await pg.addInitScript(() => { localStorage.setItem('vg.sb', JSON.stringify({ off: true })); });
  await pg.goto('http://127.0.0.1:9999/'); await pg.waitForTimeout(700);
  const wide = async tag => { const o = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (o.sw > o.cw + 2) { console.log('  ' + z.n + ' ' + tag + ': sideways scroll ' + o.sw + ' > ' + o.cw); bad++; } };
  await pg.screenshot({ path: 'shots/phone-' + z.n + '-title.png' });
  // enter the lobby if a title screen is in front
  const enter = await pg.$('#titleGo, #tStart, .title-go'); if (enter && await enter.isVisible()) { await enter.tap(); await pg.waitForTimeout(500); }
  await pg.tap('#modeSeg [data-mode="bot"]'); await pg.waitForTimeout(200);
  const lv = await pg.$('#lvlChips [data-lvl="hard"]'); if (!lv || !(await lv.isVisible())) { console.log('  ' + z.n + ': level chips not visible'); bad++; } else { await lv.scrollIntoViewIfNeeded(); await lv.tap(); }
  const pressed = await pg.$eval('#lvlChips [data-lvl="hard"]', e => e.getAttribute('aria-pressed')); if (pressed !== 'true') { console.log('  ' + z.n + ': level not chosen'); bad++; }
  await wide('lobby'); await pg.screenshot({ path: 'shots/phone-' + z.n + '-lobby.png' });
  const go = await pg.$('#goBtn'); await go.scrollIntoViewIfNeeded(); await go.tap(); await pg.waitForTimeout(900);
  // play: the human side is answered by the bot through the page's own submit, with a tap on a hand card now and then
  const r = await pg.evaluate(async () => { const U = window.VGUI, S = U.S, VG = window.VG; S.speed = 6; let taps = 0;
    for (let n = 0; n < 4000; n++) { const g = S.game; if (!g || g.over) return { over: g && g.over, turn: g && g.turnNo, level: S.level, taps }; const d = g.pending;
      if (d && d.player === 0 && !S.busy && !S.running) U.submit(VG.bot(g, 'normal'));
      if (g.turnNo >= 6) return { turn: g.turnNo, level: S.level, taps };
      await new Promise(r => setTimeout(r, 15)); } return { stuck: true, level: S.level }; });
  await pg.waitForTimeout(500); await wide('field');
  await pg.screenshot({ path: 'shots/phone-' + z.n + '-field.png' });
  // touch: tap a card on the field opens its details; long press reads it
  const card = await pg.$('#cards .card'); if (card) { const bx = await card.boundingBox(); if (bx) { await pg.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.waitForTimeout(300); } }
  await pg.screenshot({ path: 'shots/phone-' + z.n + '-tap.png' });
  // Android back button: closes the open window first, in a fight only reminds
  const back = await pg.evaluate(() => { const open = () => ['cardwin', 'picker'].some(id => !document.getElementById(id).hidden); const a = open(); window.VGUI.phoneBack(); const b = open(); window.VGUI.phoneBack(); return { before: a, after: b, table: !document.getElementById('table').hidden }; });
  if (back.after || !back.table) { console.log('  ' + z.n + ': back button ' + JSON.stringify(back)); bad++; }
  const small = await pg.evaluate(() => [...document.querySelectorAll('#prompt button, .hud button, #menuBtn, button.go')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.id).trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.h < 32 || x.w < 32));
  r.docked = await pg.evaluate(() => [matchMedia('(pointer: coarse)').matches, localStorage.getItem('vg.dock'), getComputedStyle(document.documentElement).getPropertyValue('--sa-t'), window.VGUI.S.docked, document.getElementById('prompt').parentNode.id, document.getElementById('wrap').clientWidth]);
  console.log(z.n, JSON.stringify(r), 'errors', errs.length, small.length ? 'small buttons ' + JSON.stringify(small.slice(0, 6)) : '');
  if (!r.docked[3]) { console.log('  ' + z.n + ': answer box not docked'); bad++; }
  if (errs.length) { console.log('  ' + errs.slice(0, 3).join('\n  ')); bad++; } if (!r || r.stuck || r.level !== 'hard') bad++;
  // deck builder
  await pg.evaluate(() => { const x = document.getElementById('mExit'); if (x) x.click(); }); await pg.waitForTimeout(400);
  const nd = await pg.$('#newDeckBtn'); if (nd && await nd.isVisible()) { await nd.tap(); await pg.waitForTimeout(500); await wide('my decks'); await pg.screenshot({ path: 'shots/phone-' + z.n + '-decks.png' });
    const ed = await pg.$('#dkNew'); if (ed && await ed.isVisible()) { await ed.tap(); await pg.waitForTimeout(600); await wide('builder'); await pg.screenshot({ path: 'shots/phone-' + z.n + '-builder.png' }); } }
  await ctx.close();
}
await b.close(); console.log(bad ? 'FAIL ' + bad : 'ok'); if (bad) process.exitCode = 1;
