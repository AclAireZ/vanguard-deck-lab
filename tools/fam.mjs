// Counts the unreadable lines (not deferred) by the mechanic word they mention.  node tools/fam.mjs [--deferred]
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
VG.loadDB(JSON.parse(fs.readFileSync(U('../src/db.json'), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(U('../src/jp.json'), 'utf8')));
const pool = new Map(VG.DB.rows.filter(r => r.jno).map(r => [r.name, r]));
const FL = fs.readFileSync(U('../data/fails.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => JSON.parse(x)).filter(f => pool.has(f.n) && !(pool.get(f.n).auto && !pool.get(f.n).part));
const by = new Map(); for (const f of FL) { let e = by.get(f.k); if (!e) by.set(f.k, e = { f, cards: [] }); e.cards.push(f.n); }
const defer = new Set(fs.readFileSync(U('./defer.txt'), 'utf8').split(/\s+/).filter(Boolean));
const want = process.argv.includes('--deferred');
const W = ['special move', 'memory', 'gauge', 'buddy', 'soulguard', 'penetrate', 'flag', 'counterattack', 'double attack', 'stride', 'g zone', 'heart', 'g guardian', 'generation break', 'prison', 'imprison', 'arms', 'armed', 'song', 'music', 'sing', 'crest', 'clan', 'token', 'marker', 'state', 'face up', 'face down', 'legion', 'mate', 'limit break', 'world', 'night', 'friend', 'event', 'alchemagic', 'overdress', 'originaldress', 'revoldress', 'delet', 'lock', 'meteor', 'deity', 'dragontree', 'rune', 'mysteries', 'bullet', 'gene', 'astral', 'unmoor', 'hollow', 'operated', 'this attack is used', 'say ', 'stand up!!', 'become', 'regarded', 'sweetlink', 'ticket', 'forge', 'glitter', 'set order', 'blitz', 'regalis', 'malwyrm', 'dress', 'product', 'research', 'item', 'gem', 'trigger zone', 'damage check', 'ride deck', 'energy'];
const cnt = {}; let none = 0, tot = 0;
for (const e of by.values()) {
  if (defer.has(e.f.k) !== want) continue; tot++;
  const t = (e.f.l + ' ' + (e.f.b || []).join(' ') + ' ' + Object.values(e.f.nm || {}).join(' ')).toLowerCase();
  const hit = W.filter(w => t.includes(w)); if (!hit.length) none++;
  for (const w of hit) { cnt[w] = cnt[w] || [0, 0]; cnt[w][0]++; cnt[w][1] += e.cards.length; }
}
console.log('lines ' + tot + ' · plain ' + none);
console.log(Object.entries(cnt).sort((a, b) => b[1][0] - a[1][0]).map(([w, c]) => w + ' ' + c[0] + '/' + c[1]).join(' · '));
