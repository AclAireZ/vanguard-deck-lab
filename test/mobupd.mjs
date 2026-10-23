// Phone app update gate: a stand-in Capacitor + a stand-in GitHub answer.  VG_VERSION=1.0.5 node build.mjs && node test/mobupd.mjs
const { chromium } = await import(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const b = await chromium.launch(); let bad = 0;
async function run(plat, tag, expect) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.route('http://127.0.0.1:9999/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await pg.route(/cf-vanguard|googleapis|cdnjs|emqx|hivemq|mosquitto|peerjs|supabase|wikia/, r => r.abort());
  await pg.route('https://api.github.com/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ tag_name: tag, html_url: 'https://github.com/x/y/releases/tag/' + tag, assets: [{ name: 'VanguardDeckLab-' + tag + '.apk', browser_download_url: 'https://github.com/x/y/releases/download/' + tag + '/a.apk' }, { name: 'VanguardDeckLab-' + tag + '.ipa', browser_download_url: 'https://github.com/x/y/releases/download/' + tag + '/a.ipa' }] }) }));
  await pg.addInitScript(p => { localStorage.setItem('vg.sb', JSON.stringify({ off: true })); if (p) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => p }; }, plat);
  await pg.goto('http://127.0.0.1:9999/'); await pg.waitForTimeout(1200);
  const g = await pg.evaluate(() => { const e = document.getElementById('updGate'); return e ? { href: e.querySelector('#ugGo').getAttribute('href'), text: e.innerText.slice(0, 80) } : null; });
  const ok = expect ? g && (plat === 'ios' ? /releases\/tag/.test(g.href) : /\.apk$/.test(g.href)) : !g;
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + (plat || 'web') + ' latest ' + tag + ' → ' + (g ? 'gate ' + g.href : 'no gate'));
  if (!ok) bad++; if (plat === 'android' && expect) await pg.screenshot({ path: 'shots/phone-update.png' }); await pg.close();
}
await run('android', 'v1.0.9', true); await run('ios', 'v1.0.9', true); await run('android', 'v1.0.5', false); await run('android', 'v1.0.4', false); await run(null, 'v1.0.9', false);
await b.close(); if (bad) process.exitCode = 1;
