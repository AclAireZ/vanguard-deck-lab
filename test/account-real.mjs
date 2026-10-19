// The real account server (Supabase project in app.config.json), straight through its web API like the game does:
// two throw-away players sign up, get profiles with friend codes, save a deck, record a match, add each other, and cannot see each other's decks or history.
// Prints whether e-mail confirmation is switched off (needed for sign-up inside the game to log in at once). Test accounts are named vgci-*.
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(new URL('../app.config.json', import.meta.url), 'utf8')).supabase;
const U = cfg.url.replace(/\/+$/, ''); const out = []; let fails = 0; const ok = (c, w) => { out.push((c ? 'ok   ' : 'FAIL ') + w); if (!c) fails++; };
async function req(path, { method = 'GET', body, tok, prefer } = {}) {
  const h = { apikey: cfg.key, Authorization: 'Bearer ' + (tok || cfg.key), 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
  const r = await fetch(U + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  return { st: r.status, j };
}
const run = Date.now().toString(36); const pw = 'Vg-' + Math.random().toString(36).slice(2, 10) + '9!';
async function player(n) {
  const email = 'vgci-' + run + '-' + n + '@vgdl-test.dev';
  const s = await req('/auth/v1/signup', { method: 'POST', body: { email, password: pw, data: { name: 'CI ' + n } } });
  if (s.st >= 400) { ok(false, 'sign up ' + n + ': ' + s.st + ' ' + JSON.stringify(s.j).slice(0, 200)); return null; }
  let tok = s.j && s.j.access_token, id = s.j && (s.j.user ? s.j.user.id : s.j.id);
  ok(!!tok, 'sign up ' + n + ' logs in at once' + (tok ? '' : ' — NO: e-mail confirmation is ON in Authentication → Sign In / Providers → Email (turn "Confirm email" off)'));
  if (!tok) return null;
  const l = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: pw } }); ok(l.st === 200 && l.j.access_token, 'log in ' + n);
  const bad = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: pw + 'x' } }); ok(bad.st === 400, 'wrong password refused (' + bad.st + ' ' + (bad.j && (bad.j.error_code || bad.j.msg)) + ')');
  return { email, tok: l.j.access_token, refresh: l.j.refresh_token, id };
}
const A = await player('a'), B = await player('b');
if (A && B) {
  const pa = await req('/rest/v1/profiles?select=id,name,tag&id=eq.' + A.id, { tok: A.tok }); ok(pa.st === 200 && pa.j[0] && /^[A-Z0-9]{6}$/.test(pa.j[0].tag) && pa.j[0].name === 'CI a', 'profile made on sign up: ' + JSON.stringify(pa.j && pa.j[0] && { name: pa.j[0].name, tag: pa.j[0].tag }));
  const pb = await req('/rest/v1/profiles?select=id,name,tag&id=eq.' + B.id, { tok: B.tok });
  const rn = await req('/rest/v1/profiles?id=eq.' + A.id, { method: 'PATCH', tok: A.tok, body: { name: 'CI A2' }, prefer: 'return=minimal' }); ok(rn.st < 300, 'rename own profile (' + rn.st + ')');
  const tg = await req('/rest/v1/profiles?id=eq.' + A.id, { method: 'PATCH', tok: A.tok, body: { tag: 'HACKED' }, prefer: 'return=minimal' }); ok(tg.st >= 400, 'cannot change own friend code (' + tg.st + ')');
  const ot = await req('/rest/v1/profiles?id=eq.' + B.id, { method: 'PATCH', tok: A.tok, body: { name: 'pwned' }, prefer: 'return=representation' }); ok(!ot.j || !ot.j.length, 'cannot rename someone else');
  const dk = await req('/rest/v1/decks?on_conflict=owner,id', { method: 'POST', tok: A.tok, prefer: 'resolution=merge-duplicates,return=minimal', body: { owner: A.id, id: 'myci1', data: { name: 'CI deck', ride: [], main: [] }, deleted: false, updated_at: Date.now() } }); ok(dk.st < 300, 'save deck (' + dk.st + ' ' + JSON.stringify(dk.j).slice(0, 120) + ')');
  const dk2 = await req('/rest/v1/decks?on_conflict=owner,id', { method: 'POST', tok: A.tok, prefer: 'resolution=merge-duplicates,return=minimal', body: { owner: A.id, id: 'myci1', data: { name: 'CI deck 2', ride: [], main: [] }, deleted: false, updated_at: Date.now() + 1 } }); ok(dk2.st < 300, 'update same deck (' + dk2.st + ')');
  const rd = await req('/rest/v1/decks?select=id,data', { tok: A.tok }); ok(rd.j.length === 1 && rd.j[0].data.name === 'CI deck 2', 'read own decks');
  const spy = await req('/rest/v1/decks?select=id', { tok: B.tok }); ok(Array.isArray(spy.j) && spy.j.length === 0, 'other player cannot see the deck');
  const fake = await req('/rest/v1/decks', { method: 'POST', tok: B.tok, prefer: 'return=minimal', body: { owner: A.id, id: 'evil', data: {} } }); ok(fake.st >= 400, 'cannot write a deck into someone else\'s account (' + fake.st + ')');
  const m = await req('/rest/v1/matches', { method: 'POST', tok: A.tok, prefer: 'return=minimal', body: { owner: A.id, mode: 'online', my_deck: 'CI deck 2', opp_name: 'CI b', opp_deck: 'x', result: 'win', turns: 7, reason: 'damage' } }); ok(m.st < 300, 'record match (' + m.st + ')');
  const mh = await req('/rest/v1/matches?select=result,mode&order=played_at.desc', { tok: A.tok }); ok(mh.j.length === 1 && mh.j[0].result === 'win', 'read history');
  const mspy = await req('/rest/v1/matches?select=result', { tok: B.tok }); ok(mspy.j.length === 0, 'other player cannot see the history');
  const f1 = await req('/rest/v1/friends', { method: 'POST', tok: B.tok, prefer: 'resolution=ignore-duplicates,return=minimal', body: { owner: B.id, friend: A.id } }); ok(f1.st < 300, 'add friend (' + f1.st + ')');
  const fA = await req('/rest/v1/friends?select=owner,friend', { tok: A.tok }); ok(fA.j.some(r => r.owner === B.id && r.friend === A.id), 'friend request visible to the other player');
  const pfind = await req('/rest/v1/profiles?select=id,name&tag=eq.' + (pb.j[0] && pb.j[0].tag), { tok: A.tok }); ok(pfind.j.length === 1, 'find player by friend code');
  const anon = await req('/rest/v1/profiles?select=id'); ok(anon.st >= 400 || (Array.isArray(anon.j) && anon.j.length === 0), 'signed-out visitor reads no profiles (' + anon.st + ')');
  const rf = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: A.refresh } }); ok(rf.st === 200 && rf.j.access_token, 'session renew');
  const rec = await req('/auth/v1/recover', { method: 'POST', body: { email: 'nobody-' + run + '@vgdl-test.dev' } }); ok(rec.st < 300 || rec.st === 429, 'forgot-password endpoint answers (' + rec.st + ')');
}
console.log(out.join('\n')); console.log(fails ? 'ACCOUNT SERVER FAILED (' + fails + ')' : 'account server ok'); if (fails) process.exitCode = 1;
