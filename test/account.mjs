// Accounts in the game, against a local stand-in Supabase (test/srv/sbmock.cjs), local MQTT broker and local PeerJS server:
// sign up, wrong / right password, session kept after reopening, decks follow the account to a fresh computer, friends both ways,
// online status, invite → room → whole online game → both histories record it, forgotten password with the e-mailed code, expired token refresh.
const { chromium } = await import(process.env.PW || '/opt/npm-tools/node_modules/playwright/index.mjs');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/local/VanguardDeckLab.html', import.meta.url), 'utf8');
const kids = [spawn('node', [new URL('./srv/sbmock.cjs', import.meta.url).pathname, '9125'], { stdio: 'ignore' }), spawn('node', [process.env.PEER_SRV || '/tmp/nzt/srv/srv.cjs', '9123'], { stdio: 'ignore' }), spawn('node', [process.env.MQ_SRV || '/tmp/claude-0/-home-claude/713a5eaf-d762-5313-a478-d97ec7af58a7/scratchpad/mq/mqsrv.cjs', '9124'], { stdio: 'ignore' })];
await new Promise(r => setTimeout(r, 1800));
await fetch('http://127.0.0.1:9125/__reset', { headers: { apikey: 'x' } }).catch(() => {});   // a stand-in left over from an earlier run starts empty too
const b = await chromium.launch(); const errs = []; const log = []; let fails = 0;
const check = (ok, what) => { log.push((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
async function open(name, ctx) {
  ctx = ctx || await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.route('http://127.0.0.1:9999/**', async r => { const u = r.request().url(); if (!u.includes('/sb/')) return r.fulfill({ contentType: 'text/html', body: html }); if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); const res = await r.fetch({ url: u.replace('http://127.0.0.1:9999/sb', 'http://127.0.0.1:9125') }); return r.fulfill({ response: res }); });   // the stand-in server sits behind the page's own address (Chromium blocks pages from calling local ports directly)
  await ctx.route(/cf-vanguard\.com|googleapis|cdnjs/, r => r.abort());
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e));
  await pg.addInitScript(() => {
    localStorage.setItem('vg.peerHost', JSON.stringify({ host: '127.0.0.1', port: 9123, path: '/', secure: false }));
    localStorage.setItem('vg.mqtt', JSON.stringify(['ws://127.0.0.1:9124/mqtt']));
    localStorage.setItem('vg.sb', JSON.stringify({ url: 'http://127.0.0.1:9999/sb', key: 'anon-test-key' }));
  });
  await pg.goto('http://127.0.0.1:9999/'); await pg.waitForTimeout(600); return pg;
}
const msg = pg => pg.textContent('#acctMsg').catch(() => '');
const tab = async (pg, t) => { if (await pg.isHidden('#acct')) { if (await pg.isVisible('#acctBtn')) await pg.click('#acctBtn'); else await pg.evaluate(() => window.VGUI.acctOpen()); } await pg.click('[data-atab="' + t + '"]'); await pg.waitForTimeout(150); };
async function signup(pg, name, email, pw) { await tab(pg, 'signup'); await pg.fill('[data-af="signup"] [name="name"]', name); await pg.fill('[data-af="signup"] [name="email"]', email); await pg.fill('[data-af="signup"] [name="pw"]', pw); await pg.fill('[data-af="signup"] [name="pw2"]', pw); await pg.click('[data-af="signup"] button[type="submit"]'); await pg.waitForFunction(() => window.VGUI.Acct.me, null, { timeout: 8000 }).catch(() => {}); }
async function login(pg, email, pw) { await tab(pg, 'login'); await pg.fill('[data-af="login"] [name="email"]', email); await pg.fill('[data-af="login"] [name="pw"]', pw); await pg.click('[data-af="login"] button[type="submit"]'); await pg.waitForTimeout(700); }
const closeAcct = pg => pg.evaluate(() => { const m = document.querySelector('#acct'); m.hidden = true; m.innerHTML = ''; });

const A = await open('A');
check(await A.isVisible('#acct.gate') && !(await A.isVisible('#acct [data-close]')), 'game opens on the log-in window (no close button)');
await A.mouse.click(5, 5); await A.waitForTimeout(200); check(await A.isVisible('#acct.gate'), 'clicking outside does not skip the log-in');
await signup(A, 'Aichi', 'aichi@test.dev', 'secret12');
check((await A.textContent('#acctBtn')).includes('Aichi') && await A.isHidden('#acct'), 'sign up → logged in as Aichi, log-in window gone (' + await msg(A) + ')');
await tab(A, 'profile');
console.log('after signup:', await A.textContent('#acctBtn'), '|', await msg(A), '|', errs.join(';'), '|', await A.evaluate(() => document.querySelector('#acct').hidden + ' ' + (document.querySelector('#acct .mtabs') || {}).textContent));
const tagA = (await A.textContent('#acTag', { timeout: 5000 })).trim(); check(/^[A-Z0-9]{6}$/.test(tagA), 'friend code shown: ' + tagA);
// a deck made while logged in goes to the account
await A.evaluate(() => { const U = window.VGUI; const d = window.VG.DECKS['1MCW2']; U.My.save({ id: 'mytest1', name: 'Account Deck', ride: d.ride.slice(), main: d.main.map(e => ({ no: e.no, n: e.n })), g: [] }); });
await A.waitForTimeout(700);
// mismatch + bad e-mail are refused in the form
const B = await open('B');
await tab(B, 'signup'); await B.fill('[data-af="signup"] [name="name"]', 'Kai'); await B.fill('[data-af="signup"] [name="email"]', 'kai@test.dev'); await B.fill('[data-af="signup"] [name="pw"]', 'abcdef1'); await B.fill('[data-af="signup"] [name="pw2"]', 'abcdef2'); await B.click('[data-af="signup"] button[type="submit"]'); await B.waitForTimeout(300);
check(/ไม่ตรงกัน/.test(await msg(B)), 'password confirmation mismatch refused (' + await msg(B) + ')');
await signup(B, 'Kai', 'aichi@test.dev', 'abcdef1'); check(/สมัครไว้แล้ว/.test(await msg(B)), 'same e-mail twice refused (' + await msg(B) + ')');
await signup(B, 'Kai', 'kai@test.dev', 'abcdef1'); check((await B.textContent('#acctBtn')).includes('Kai'), 'second player signs up');
await tab(B, 'profile'); await B.click('[data-act="logout"]'); await B.waitForTimeout(300);
check(/เข้าสู่ระบบ/.test(await B.textContent('#acctBtn')) && await B.isVisible('#acct.gate'), 'log out → back to the log-in window');
await login(B, 'kai@test.dev', 'wrongpw'); check(/ไม่ถูกต้อง/.test(await msg(B)), 'wrong password refused (' + await msg(B) + ')');
await login(B, 'kai@test.dev', 'abcdef1'); check((await B.textContent('#acctBtn')).includes('Kai'), 'log in with the right password');
// session survives reopening the game
await B.reload(); await B.waitForTimeout(900); check((await B.textContent('#acctBtn')).includes('Kai'), 'still logged in after reopening the game');
// decks follow the account to a fresh computer
const A2 = await open('A2'); await login(A2, 'aichi@test.dev', 'secret12'); await A2.waitForTimeout(800);
check(await A2.evaluate(() => !!window.VGUI.My.decks.mytest1 && window.VGUI.My.decks.mytest1.name === 'Account Deck'), 'deck saved on computer 1 appears on computer 2');
await A2.evaluate(() => window.VGUI.My.remove('mytest1')); await A2.waitForTimeout(500);
await A.evaluate(() => window.VGUI.Acct.syncDecks()); await A.waitForTimeout(500);
check(await A.evaluate(() => !window.VGUI.My.decks.mytest1), 'deck removed on computer 2 is removed on computer 1 too');
await A2.context().close();
// friends
await closeAcct(A); await tab(B, 'friends'); await B.fill('[data-af="addfriend"] [name="tag"]', tagA.toLowerCase()); await B.click('[data-af="addfriend"] button[type="submit"]'); await B.waitForTimeout(800);
check(/เพิ่ม Aichi/.test(await msg(B)), 'add friend by code (' + await msg(B) + ')');
await tab(A, 'friends'); await A.waitForTimeout(800);
check(await A.isVisible('[data-fadd]'), 'Aichi sees Kai added them');
await A.click('[data-fadd]'); await A.waitForTimeout(900);
check(await A.evaluate(() => window.VGUI.Friends.list.length === 1 && window.VGUI.Friends.list[0].mutual), 'friends both ways');
await A.waitForFunction(() => document.querySelector('.acfr.on'), null, { timeout: 15000 }).catch(() => {});
check(await A.isVisible('.acfr.on'), 'Kai shows as online');
// invite → room → game
await A.click('[data-finv]');
await B.waitForSelector('#invToast:not([hidden])', { timeout: 30000 }).catch(() => {});
check(await B.isVisible('#invToast'), 'Kai receives the invite: ' + (await B.textContent('#invToast').catch(() => '')).trim().slice(0, 60));
await closeAcct(B); await B.click('#invToast [data-inv]:not([data-inv=""])');
await A.waitForFunction(() => window.VGUI.S.game && !document.querySelector('#table').hidden, null, { timeout: 60000 }).catch(() => {}); await B.waitForFunction(() => window.VGUI.S.game && !document.querySelector('#table').hidden, null, { timeout: 30000 }).catch(() => {});
const dbg = pg => pg.evaluate(() => { const U = window.VGUI; return JSON.stringify({ docs: U.P2P.docs, code: U.Net.code, open: U.P2P.open, role: U.P2P.role, aw: U.P2P.await, ch: U.P2P.ch && U.P2P.ch.readyState, g: U.P2P.ch && U.P2P.ch.g, started: U.Net.started, uid: U.Net.uid }); }); console.log('A', await dbg(A)); console.log('B', await dbg(B));
console.log('status A:', await A.textContent('#onStatus'), '| B:', await B.textContent('#onStatus'), '| A code', await A.evaluate(() => window.VGUI.QL.code + ' ' + window.VGUI.QL.role), '| B code', await B.evaluate(() => window.VGUI.QL.code + ' ' + window.VGUI.QL.role));
const names = await B.evaluate(() => window.VGUI.S.cfg && window.VGUI.S.cfg.players.map(p => p.name).join('/')); check(names === 'Aichi/Kai', 'invite opens the fight, names ' + names);
const drive = pg => pg.evaluate(async () => { const U = window.VGUI, S = U.S; S.speed = 6; const t0 = Date.now(); while (Date.now() - t0 < 240000) { const g = S.game; if (g && g.over) return g.over.winner; const d = g && g.pending; if (d && d.player === S.seat && !S.running && !S.busy && !S.sending) U.submit(window.VG.bot(g)); await new Promise(r => setTimeout(r, 30)); } return 'time'; });
const [wa, wb] = await Promise.all([drive(A), drive(B)]); check(wa === wb && wa !== 'time', 'online game finished, winner seat ' + wa);
await A.waitForTimeout(1500);
const hist = async pg => { await pg.evaluate(() => { document.querySelector('#endov') && (document.querySelector('#endov').hidden = true); }); await tab(pg, 'stats'); await pg.waitForTimeout(800); return pg.evaluate(() => window.VGUI.Acct.matches()); };
const ha = await hist(A), hb = await hist(B);
check(ha.length === 1 && hb.length === 1 && ha[0].mode === 'online' && ha[0].result !== hb[0].result && ha[0].opp_name === 'Kai', 'both histories record the game (' + (ha[0] && ha[0].result) + ' / ' + (hb[0] && hb[0].result) + ')');
check(/ออนไลน์/.test(await A.textContent('#acStats')), 'stats page shows the record');
// forgot password
await tab(B, 'profile'); await B.click('[data-act="logout"]'); await B.waitForTimeout(300);
await tab(B, 'forgot'); await B.fill('[data-af="forgot"] [name="email"]', 'kai@test.dev'); await B.click('[data-af="forgot"] button[type="submit"]'); await B.waitForTimeout(400);
await B.fill('[data-af="reset"] [name="token"]', '000000'); await B.fill('[data-af="reset"] [name="pw"]', 'newpass9'); await B.click('[data-af="reset"] button[type="submit"]'); await B.waitForTimeout(400);
check(/หมดอายุ|ไม่ถูกต้อง/.test(await msg(B)), 'wrong reset code refused (' + await msg(B) + ')');
await B.fill('[data-af="reset"] [name="token"]', '123456'); await B.click('[data-af="reset"] button[type="submit"]'); await B.waitForTimeout(800);
check((await B.textContent('#acctBtn')).includes('Kai'), 'reset with e-mailed code logs in (' + await msg(B) + ')');
await tab(B, 'profile'); await B.click('[data-act="logout"]'); await B.waitForTimeout(300); await login(B, 'kai@test.dev', 'newpass9'); check((await B.textContent('#acctBtn')).includes('Kai'), 'new password works');
// expired token refreshes by itself
await A.evaluate(async () => { await fetch('http://127.0.0.1:9999/sb/__expire', { headers: { apikey: 'x' } }); window.VGUI.Acct.s.expires_at = 1; });
const ok2 = await A.evaluate(async () => { try { const m = await window.VGUI.Acct.matches(); return m.length; } catch (e) { return 'err ' + e.message; } });
check(ok2 === 1, 'expired session renews itself (' + ok2 + ')');
// rename
await tab(A, 'profile'); await A.fill('[data-af="rename"] [name="name"]', 'Aichi S'); await A.click('[data-af="rename"] button[type="submit"]'); await A.waitForTimeout(500);
check((await A.textContent('#acctBtn')).includes('Aichi S'), 'rename');
check(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
await A.screenshot({ path: 'shots/account-profile.png' }); await tab(A, 'stats'); await A.waitForTimeout(600); await A.screenshot({ path: 'shots/account-stats.png' }); await tab(A, 'friends'); await A.waitForTimeout(600); await A.screenshot({ path: 'shots/account-friends.png' });
console.log(log.join('\n')); console.log(fails ? 'ACCOUNT FAILED (' + fails + ')' : 'account ok'); if (fails) process.exitCode = 1;
await b.close(); for (const k of kids) k.kill();
