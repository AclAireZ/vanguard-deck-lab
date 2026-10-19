// Quick room (6-character code) between two copies of the game app, through a local PeerJS meeting server standing in for the free cloud one:
// A creates a room, B types the code, both play a whole game with the bot answering; both must end in the same state.
// CLOUD=1: use the real free PeerJS service on the internet (as players do) and let card pictures load from the official sites, checking both windows show some.
const CLOUD = !!process.env.CLOUD;
const { chromium } = await import(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.mjs');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const srv = CLOUD ? null : spawn('node', [process.env.PEER_SRV || '/tmp/nzt/srv/srv.cjs', '9123'], { stdio: 'ignore' });
if (srv) await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch(); const errs = [];
async function open(name) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('http://127.0.0.1:9999/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  if (!CLOUD) await ctx.route(/cf-vanguard\.com|googleapis|cdnjs/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e));
  if (!CLOUD) await pg.addInitScript(() => { localStorage.setItem('vg.peerHost', JSON.stringify({ host: '127.0.0.1', port: 9123, path: '/', secure: false })); });
  pg.on('console', m => { if (/peer|PeerJS|ERROR/i.test(m.text())) errs.push(name + ' console: ' + m.text().slice(0, 200)); }); await pg.goto('http://127.0.0.1:9999/'); await pg.waitForTimeout(400); await pg.click('#modeSeg [data-mode="online"]'); await pg.waitForTimeout(200); return pg;
}
const A = await open('A'), B = await open('B');
await A.click('#qlHost'); await A.waitForSelector('#qlCode:not([hidden])', { timeout: 30000 });
const code = (await A.textContent('#qlCode')).trim(); console.log('room code', code);
await B.selectOption('#deckSel0', 'TD01'); await B.fill('#qlIn', code.toLowerCase()); await B.click('#qlJoin');
await B.waitForTimeout(CLOUD ? 3000 : 6000); console.log('A:', await A.textContent('#onStatus'), '| B:', await B.textContent('#onStatus'), errs); await A.waitForSelector('#table:not([hidden])', { timeout: 60000 }); await B.waitForSelector('#table:not([hidden])', { timeout: 60000 });
const pics = async pg => { await pg.waitForTimeout(CLOUD ? 6000 : 0); return pg.evaluate(() => [...document.querySelectorAll('img.cf-img')].filter(i => i.complete && i.naturalWidth > 0).length); };
const [pa, pb] = await Promise.all([pics(A), pics(B)]); console.log('card pictures shown: A', pa, 'B', pb);
const drive = pg => pg.evaluate(async () => {
  const U = window.VGUI; const S = U.S; const t0 = Date.now(); const sig = g => g.players.map(P => [P.hand.length, P.deck.length, P.soul.length, P.drop.length, P.damage.length].join('.')).join('|');
  S.speed = 6; while (Date.now() - t0 < 240000) { const g = S.game; if (!g) break; if (g.over) return { over: g.over, n: g.history.length, seat: S.seat, sig: sig(g) }; const d = g.pending; if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) U.submit(window.VG.bot(g)); await new Promise(r => setTimeout(r, 30)); }
  const g = S.game; return { timeout: true, turn: g && g.turnNo, pend: g && g.pending && g.pending.kind, pl: g && g.pending && g.pending.player, seat: S.seat, hist: g && g.history.length, busy: S.busy, run: S.running, send: S.sending, lists: window.VGUI.Net.lists.map(l => l.length), mine: window.VGUI.Net.mine.length, docs: Object.keys(window.VGUI.P2P.docs) };
});
const [ra, rb] = await Promise.all([drive(A), drive(B)]);
console.log('A', JSON.stringify(ra), 'B', JSON.stringify(rb));
const ok = ra.over && rb.over && ra.sig === rb.sig && ra.n === rb.n && ra.seat !== rb.seat && !errs.filter(e => !/console/.test(e)).length && (!CLOUD || (pa > 0 && pb > 0));
if (errs.length) console.log(errs.slice(0, 5));
console.log(ok ? 'quick room ok' + (CLOUD ? ' (real internet service, pictures on both sides)' : '') + ': both windows finished the same game' : 'QUICK ROOM FAILED'); if (!ok) process.exitCode = 1;
await b.close(); if (srv) srv.kill();
