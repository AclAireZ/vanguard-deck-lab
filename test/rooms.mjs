// Online rooms of the game, end to end, with a local PeerJS server and a local MQTT broker standing in for the internet services:
//   list    — A creates a room, B picks it from the room list, whole game, same end state
//   relay   — B's direct link service is unreachable → the game goes through the broker relay
//   drop    — the link is cut mid-game → both sides reconnect by themselves and finish the same game
//   restart — B closes the game mid-fight, opens it again, presses "back to last room" → the fight continues
// CLOUD=1 runs 'list' and 'relay' against the real public services (PeerJS cloud + public MQTT brokers).
// node test/rooms.mjs [list,relay,drop,restart]
const CLOUD = !!process.env.CLOUD;
const { chromium } = await import(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.mjs');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const want = (process.argv[2] || (CLOUD ? 'list,relay' : 'list,relay,drop,restart')).split(',');
const kids = CLOUD ? [] : [spawn('node', [process.env.PEER_SRV || '/tmp/nzt/srv/srv.cjs', '9123'], { stdio: 'ignore' }), spawn('node', [process.env.MQ_SRV || '/tmp/claude-0/-home-claude/713a5eaf-d762-5313-a478-d97ec7af58a7/scratchpad/mq/mqsrv.cjs', '9124'], { stdio: 'ignore' })];
if (kids.length) await new Promise(r => setTimeout(r, 1800));
const b = await chromium.launch(); let errs = []; const out = [];
async function open(name, opts) {
  const ctx = opts && opts.ctx || await b.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('http://127.0.0.1:9999/**', r => r.fulfill({ contentType: 'text/html', body: html }));
  await ctx.route(/cf-vanguard\.com|googleapis|cdnjs/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e));
  const deadPeer = !!(opts && opts.deadPeer);
  await pg.addInitScript(([cloud, dead]) => {
    if (!cloud) { localStorage.setItem('vg.peerHost', JSON.stringify({ host: '127.0.0.1', port: 9123, path: '/', secure: false })); localStorage.setItem('vg.mqtt', JSON.stringify(['ws://127.0.0.1:9124/mqtt'])); }
    if (dead) localStorage.setItem('vg.peerHost', JSON.stringify({ host: '127.0.0.1', port: 9, path: '/', secure: false }));
  }, [CLOUD, deadPeer]);
  await pg.goto('http://127.0.0.1:9999/'); await pg.waitForTimeout(400); await pg.click('#modeSeg [data-mode="online"]'); await pg.waitForTimeout(200);
  return pg;
}
const sig = pg => pg.evaluate(() => { const g = window.VGUI.S.game; return g ? { over: g.over, n: g.history.length, seat: window.VGUI.S.seat, s: g.players.map(P => [P.hand.length, P.deck.length, P.soul.length, P.drop.length, P.damage.length].join('.')).join('|') } : null; });
const drive = (pg, ms) => pg.evaluate(async ms => {
  const U = window.VGUI; const S = U.S; const t0 = Date.now(); S.speed = 6;
  while (Date.now() - t0 < ms) { const g = S.game; if (g && g.over) return 'over'; const d = g && g.pending; if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) U.submit(window.VG.bot(g)); await new Promise(r => setTimeout(r, 30)); }
  return 'time';
}, ms);
const status = pg => pg.textContent('#onStatus');
async function start(A, B, how) {
  await A.fill('#qlName', 'Aichi'); await B.fill('#qlName', 'Kai');
  await A.click('#qlHost'); await A.waitForSelector('#qlCode:not([hidden])', { timeout: 30000 }); const code = (await A.textContent('#qlCode')).trim();
  await B.selectOption('#deckSel0', 'TD01');
  if (how === 'list') { await B.waitForSelector('[data-qlj="' + code + '"]', { timeout: 30000 }); const row = await B.textContent('.qlr'); if (!/Aichi/.test(row)) errs.push('room list row has no host name: ' + row); await B.click('[data-qlj="' + code + '"]'); }
  else { await B.fill('#qlIn', code); await B.click('#qlJoin'); }
  try { await A.waitForSelector('#table:not([hidden])', { timeout: 40000 }); await B.waitForSelector('#table:not([hidden])', { timeout: 20000 }); }
  catch (e) { console.log('no table (' + how + '): A=' + await status(A) + ' | B=' + await status(B) + ' | errs ' + errs.join(' ; ')); const dbg = pg => pg.evaluate(() => { const U = window.VGUI; return JSON.stringify({ docs: Object.keys(U.P2P.docs), code: U.Net.code, open: U.P2P.open, role: U.P2P.role, aw: U.P2P.await, rs: U.P2P.resume, ch: U.P2P.ch && U.P2P.ch.readyState, started: U.Net.started, linked: U.QL.linked }); }); console.log('A', await dbg(A), 'B', await dbg(B)); throw e; }
  return code;
}
async function finish(A, B, label) {
  const [x, y] = await Promise.all([drive(A, 240000), drive(B, 240000)]);
  const [sa, sb] = await Promise.all([sig(A), sig(B)]);
  const ok = x === 'over' && y === 'over' && sa && sb && sa.s === sb.s && sa.n === sb.n && sa.seat !== sb.seat && !errs.length;
  out.push((ok ? 'ok   ' : 'FAIL ') + label + ' ' + JSON.stringify({ x, y, sa, sb, errs: errs.slice(0, 3) })); errs = [];
  return ok;
}
let allOk = true;
for (const w of want) {
  if (w === 'list') { const A = await open('A'), B = await open('B'); await start(A, B, 'list'); const via = await A.evaluate(() => window.VGUI.P2P.ch && window.VGUI.P2P.ch.g ? 'relay' : 'direct'); const names = await B.evaluate(() => window.VGUI.S.cfg.players.map(p => p.name).join('/')); if (names !== 'Aichi/Kai') errs.push('names ' + names); allOk = await finish(A, B, 'list (' + via + ', names ' + names + ')') && allOk; await A.context().close(); await B.context().close(); }
  if (w === 'relay') { const A = await open('A'), B = await open('B', { deadPeer: !CLOUD }); if (CLOUD) await B.evaluate(() => { window.Peer = undefined; }); await start(A, B, 'code'); const via = await B.evaluate(() => window.VGUI.P2P.ch && window.VGUI.P2P.ch.g ? 'relay' : 'direct'); if (via !== 'relay') errs.push('expected relay, got ' + via); allOk = await finish(A, B, 'relay (' + via + ')') && allOk; await A.context().close(); await B.context().close(); }
  if (w === 'drop') {
    const A = await open('A'), B = await open('B'); await start(A, B, 'code');
    await Promise.all([drive(A, 5000), drive(B, 5000)]);
    const before = await sig(A);
    await B.evaluate(() => { const ch = window.VGUI.P2P.ch; if (ch && ch.g) ch.close(); else { const cs = Object.values(window.VGUI.QL.peer.connections).flat(); for (const c of cs) c.close(); } });
    await B.waitForTimeout(1500); const mid = [await status(A), await status(B)];
    for (let i = 0; i < 60 && !(await B.evaluate(() => window.VGUI.P2P.open)); i++) await B.waitForTimeout(500);
    allOk = await finish(A, B, 'drop (cut at ' + before.n + ' answers; status while cut: ' + mid.join(' / ') + ')') && allOk; await A.context().close(); await B.context().close();
  }
  if (w === 'start') { const A = await open('A'), B = await open('B'); await start(A, B, 'code'); out.push('ok start'); await A.context().close(); await B.context().close(); }
  if (w === 'restart') {
    const A = await open('A'); let B = await open('B'); await start(A, B, 'code');
    await Promise.all([drive(A, 5000), drive(B, 5000)]);
    const n0 = (await sig(B)).n; const ctx = B.context(); await B.close();
    await A.waitForTimeout(1500);
    B = await open('B2', { ctx }); await B.waitForSelector('#qlBack:not([hidden])', { timeout: 5000 }); await B.click('#qlBack');
    await B.waitForSelector('#table:not([hidden])', { timeout: 60000 });
    const n1 = (await sig(B)).n;
    allOk = await finish(A, B, 'restart (B had ' + n0 + ' answers, reopened at ' + n1 + ')') && allOk; await A.context().close(); await ctx.close();
  }
}
console.log(out.join('\n')); console.log(allOk ? 'rooms ok' : 'ROOMS FAILED'); if (!allOk) process.exitCode = 1;
await b.close(); for (const k of kids) k.kill();
