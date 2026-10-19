// Tiny stand-in for a Supabase project (auth + the 4 tables of server/supabase.sql with their row rules), for the account tests: node sbmock.cjs <port>
const http = require('http'); const crypto = require('crypto');
const rnd = n => crypto.randomBytes(n).toString('hex');
const users = {}, tokens = {}, refresh = {}, otp = {};
const T = { profiles: [], decks: [], matches: [], friends: [] };
const PK = { profiles: ['id'], decks: ['owner', 'id'], friends: ['owner', 'friend'], matches: ['id'] };
let mid = 1;
const sess = u => { const at = 'at_' + rnd(12), rt = 'rt_' + rnd(12); tokens[at] = u.id; refresh[rt] = u.id; return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: 'bearer', user: { id: u.id, email: u.email } }; };
const tag = () => { let t; do { t = rnd(4).toUpperCase().replace(/[01]/g, 'K').slice(0, 6); } while (T.profiles.some(p => p.tag === t)); return t; };
const can = { // row rules
  profiles: { read: () => true, write: (r, uid) => r.id === uid },
  decks: { read: (r, uid) => r.owner === uid, write: (r, uid) => r.owner === uid },
  matches: { read: (r, uid) => r.owner === uid, write: (r, uid) => r.owner === uid },
  friends: { read: (r, uid) => r.owner === uid || r.friend === uid, write: (r, uid) => r.owner === uid },
};
function filt(rows, q) {
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
    const m = /^(eq|in)\.(.*)$/.exec(v); if (!m) continue;
    if (m[1] === 'eq') rows = rows.filter(r => String(r[k]) === m[2]);
    else { const set = m[2].replace(/^\(|\)$/g, '').split(','); rows = rows.filter(r => set.includes(String(r[k]))); }
  }
  const o = q.get('order'); if (o) { const [c, d] = o.split('.'); rows = rows.slice().sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (d === 'desc' ? -1 : 1)); }
  const l = q.get('limit'); if (l) rows = rows.slice(0, +l);
  return rows;
}
http.createServer((req, res) => {
  const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,prefer', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Private-Network': 'true' };
  const send = (st, o) => { res.writeHead(st, Object.assign({ 'Content-Type': 'application/json' }, H)); res.end(o === undefined ? '' : JSON.stringify(o)); };
  if (req.method === 'OPTIONS') return send(204);
  let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { return send(400, { message: 'bad json' }); }
    const u = new URL(req.url, 'http://x'); const p = u.pathname; const q = u.searchParams;
    const bearer = (req.headers.authorization || '').replace(/^Bearer /, ''); const uid = tokens[bearer];
    if (!req.headers.apikey) return send(401, { message: 'No API key found in request' });
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const e = String(body.email || '').toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return send(400, { error_code: 'email_address_invalid', msg: 'Email address is invalid' });
      if (users[e]) return send(422, { error_code: 'user_already_exists', msg: 'User already registered' });
      if (String(body.password || '').length < 6) return send(422, { error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      const usr = users[e] = { id: crypto.randomUUID(), email: e, pw: body.password, meta: body.data || {} };
      T.profiles.push({ id: usr.id, name: String(usr.meta.name || e.split('@')[0]).slice(0, 16), tag: tag(), created_at: new Date().toISOString() });
      return send(200, sess(usr));
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      if (q.get('grant_type') === 'password') { const usr = users[String(body.email || '').toLowerCase()]; if (!usr || usr.pw !== body.password) return send(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }); return send(200, sess(usr)); }
      if (q.get('grant_type') === 'refresh_token') { const id = refresh[body.refresh_token]; if (!id) return send(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }); delete refresh[body.refresh_token]; return send(200, sess(Object.values(users).find(x => x.id === id))); }
    }
    if (p === '/auth/v1/logout') { delete tokens[bearer]; return send(204); }
    if (p === '/auth/v1/recover') { const e = String(body.email || '').toLowerCase(); if (users[e]) otp[e] = '123456'; return send(200, {}); }
    if (p === '/auth/v1/verify') { const e = String(body.email || '').toLowerCase(); if (!otp[e] || otp[e] !== body.token) return send(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' }); delete otp[e]; return send(200, sess(users[e])); }
    if (p === '/auth/v1/user' && req.method === 'PUT') { const usr = Object.values(users).find(x => x.id === uid); if (!usr) return send(401, { msg: 'not logged in' }); if (body.password) usr.pw = body.password; return send(200, { id: usr.id, email: usr.email }); }
    if (p === '/__reset') { for (const o of [users, tokens, refresh, otp]) for (const k in o) delete o[k]; for (const k in T) T[k] = []; return send(200, {}); }
    if (p === '/__expire') { for (const k in tokens) delete tokens[k]; return send(200, {}); }   // test helper: every access token stops working
    const m = /^\/rest\/v1\/(\w+)$/.exec(p);
    if (m && T[m[1]]) {
      const t = m[1]; const rule = can[t];
      if (!uid) return send(401, { code: 'PGRST301', message: 'JWT expired' });
      const prefer = req.headers.prefer || ''; const minimal = /return=minimal/.test(prefer);
      if (req.method === 'GET') return send(200, filt(T[t].filter(r => rule.read(r, uid)), q));
      if (req.method === 'POST') {
        const rows = Array.isArray(body) ? body : [body]; const keys = q.get('on_conflict') ? q.get('on_conflict').split(',') : PK[t]; const out = [];
        for (let r of rows) {
          r = Object.assign({}, r); if ('owner' in can && false) continue;
          if (t !== 'profiles' && !r.owner) r.owner = uid; if (t === 'matches') { r.id = mid++; r.played_at = new Date().toISOString(); }
          if (!rule.write(r, uid)) return send(403, { code: '42501', message: 'new row violates row-level security policy' });
          if (t === 'friends' && r.owner === r.friend) return send(400, { code: '23514', message: 'check violation' });
          const ex = T[t].find(x => keys.every(k => String(x[k]) === String(r[k])));
          if (ex) { if (/merge-duplicates/.test(prefer)) { Object.assign(ex, r); out.push(ex); continue; } if (/ignore-duplicates/.test(prefer)) continue; return send(409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
          T[t].push(r); out.push(r);
        }
        return minimal ? send(201) : send(201, out);
      }
      if (req.method === 'PATCH') { const rows = filt(T[t], q).filter(r => rule.write(r, uid)); for (const r of rows) Object.assign(r, body); return minimal ? send(204) : send(200, rows); }
      if (req.method === 'DELETE') { const rows = filt(T[t], q).filter(r => rule.write(r, uid)); T[t] = T[t].filter(r => !rows.includes(r)); return send(204); }
    }
    send(404, { message: 'not found ' + p });
  });
}).listen(+process.argv[2] || 9125, '127.0.0.1', () => console.log('supabase mock on', +process.argv[2] || 9125));
