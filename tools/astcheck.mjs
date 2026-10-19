// Checks tools/hand-ast.txt: every step / condition / cost / trigger / count name must exist in src/fx.js, and every entry must build and describe itself.
// node tools/astcheck.mjs [--show key…]   (—show prints the Thai text the game will display)
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js';
const VG = globalThis.VG; const U = f => new URL(f, import.meta.url);
const src = fs.readFileSync(U('../src/fx.js'), 'utf8');
const sect = (a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + a.length); return src.slice(i, j < 0 ? undefined : j); };
const cases = t => new Set([...t.matchAll(/case '([A-Za-z0-9+]+)'/g)].map(m => m[1]));
const COND = cases(sect('function ev(G, ctx, c)', '/* ---------- costs')), COST = cases(sect('function mkCost(k)', '/* ---------- steps')), TRIG = cases(sect('function mkTrig(t, z)', '/* ---------- building')), CNT = cases(sect('function count(G, ctx, c)', '/* ---------- conditions'));
const STEP = new Set([...sect('const X = {', 'function* run(').matchAll(/^\s*\*?([a-zA-Z0-9]+)\(G, ctx/gm)].map(m => m[1]));
const FK = new Set([...sect('function mf(G, me, c, F)', 'const nameCount').matchAll(/F\.([a-zA-Z0-9]+)/g)].map(m => m[1])); ['dist', 'distg', 'colit', 'sit', 'k', 'nh2', 'nm2', 'or'].forEach(x => FK.add(x));
const GROUPS = new Set(['gc', 'ogc', 'oall', 'orgs', 'ofront', 'ovgs', 'evt', 'me', 'it', 'it+me', 'all', 'front', 'rgs', 'vgs', 'backrg', 'frontrg', 'others', 'otherrg', 'col', 'colo', 'boosted', 'attacker', 'tgt', 'otgt', 'smu']);
const errs = [];
function F(f, at) { if (!f || typeof f !== 'object') return; if (f.or) { f.or.forEach(x => F(x, at)); return; } for (const k of Object.keys(f)) if (!FK.has(k)) errs.push(at + ': filter key ' + k); }
function cond(c, at) { if (!Array.isArray(c)) { errs.push(at + ': cond not a list ' + JSON.stringify(c)); return; } if (!COND.has(c[0])) errs.push(at + ': cond ' + c[0]); if (['and', 'or'].includes(c[0])) { cond(c[1], at); cond(c[2], at); } if (c[0] === 'not') cond(c[1], at); }
function cost(k, at) { if (!Array.isArray(k) || !COST.has(k[0])) errs.push(at + ': cost ' + JSON.stringify(k)); else if (k[0] === 'alt') { k[1].forEach(x => cost(x, at)); k[2].forEach(x => cost(x, at)); } else if (k[0] === 'if') { cond(k[1], at); k[2].forEach(x => cost(x, at)); } }
function grp(t, at) { if (typeof t === 'string') { if (!GROUPS.has(t)) errs.push(at + ': group ' + t); } else if (t && typeof t === 'object') F(t.f, at); else errs.push(at + ': group ' + JSON.stringify(t)); }
function steps(d, at) {
  if (!Array.isArray(d)) { errs.push(at + ': steps not a list'); return; }
  for (const s of d) {
    if (!Array.isArray(s) || !STEP.has(s[0])) { errs.push(at + ': step ' + JSON.stringify(s).slice(0, 60)); continue; }
    switch (s[0]) {
      case 'if': cond(s[1], at); steps(s[2], at); if (s[3]) steps(s[3], at); break;
      case 'may': steps(s[1], at); break; case 'later': steps(s[2], at); break; case 'or': steps(s[1], at); steps(s[2], at); break;
      case 'modal': for (const o of s[1]) { if (o.c) cond(o.c, at); if (o.k) o.k.forEach(k => cost(k, at)); steps(o.d, at); } break;
      case 'grant': grp(s[1], at); [].concat(s[2]).forEach(a => ability(a, at)); break; case 'pget': s[1].forEach(a => ability(a, at)); break;
      case 'pay': s[1].forEach(k => cost(k, at)); break;
      case 'ch': F(s[1].f, at); if (!s[1].k || !s[1].n) errs.push(at + ': ch needs k and n'); break;
      case 'pk': case 'sr': if (!Array.isArray(s[1]) || !(typeof s[2] === 'number' || Array.isArray(s[2]))) errs.push(at + ': ' + s[0] + ' shape'); F(s[4], at); break;
      case 'bf': grp(s[1], at); if (!s[2] || typeof s[2] !== 'object' || !['t', 'b', 'o', 'c', 'f', 'n', undefined].includes(s[3])) errs.push(at + ': bf shape'); if (s[4] && !CNT.has(s[4][0])) errs.push(at + ': count ' + s[4][0]); break;
      case 'st': case 're': grp(s[1], at); break;
      case 'rt': if (s[1] !== 'me' && s[1] !== 'it') grp(s[1], at); break;
      case 'to': case 'cl': if (s[1] !== 'me' && s[1] !== 'it') errs.push(at + ': ' + s[0] + ' target ' + s[1]); break;
    }
  }
}
function ability(a, at) {
  if (!a || typeof a !== 'object' || !['a', 'k', 'c'].includes(a.t)) { errs.push(at + ': ability type ' + JSON.stringify(a).slice(0, 50)); return; }
  if (a.t === 'a') { if (!a.on || !TRIG.has(a.on.e)) errs.push(at + ': trigger ' + JSON.stringify(a.on)); else { for (const k of ['f', 'wf', 'byf', 'bof', 'tg']) F(a.on[k] && (k === 'tg' ? Object.assign({}, a.on[k], { k: undefined, tk: undefined }) : a.on[k]), at); if (a.on.by && typeof a.on.by === 'object' && a.on.e === 'rode') F(a.on.by, at); if (a.on.alt && !TRIG.has(a.on.alt.e)) errs.push(at + ': trigger ' + a.on.alt.e); } }
  (a.c || []).forEach(c => cond(c, at)); (a.k || []).forEach(k => cost(k, at));
  if (a.t === 'c') { if (!a.m && !a.d) errs.push(at + ': cont without m'); if (a.s) grp(a.s, at); if (a.per && !CNT.has(a.per[0])) errs.push(at + ': count ' + a.per[0]); }
  else steps(a.d, at);
}
const show = process.argv.includes('--show') ? process.argv.slice(process.argv.indexOf('--show') + 1) : null;
let n = 0;
for (const ln of fs.readFileSync(U('./hand-ast.txt'), 'utf8').split('\n')) {
  if (!ln.trim() || ln[0] === '#') continue; n++;
  let key, v; if (ln[0] === '@') { const t = ln.indexOf('\t'); key = ln.slice(0, t); v = JSON.parse(ln.slice(t + 1)); } else { const sp = ln.indexOf(' '); key = ln.slice(0, sp); v = JSON.parse(ln.slice(sp + 1)); }
  if (Array.isArray(v)) v = { a: v }; else if (!v.a && (v.d || v.m || v.on)) v = { a: [v] };
  const e0 = errs.length;
  for (const a of v.a || []) { if (!a.t) a.t = a.on ? 'a' : a.m ? 'c' : 'k'; ability(a, key); }
  if (v.p) { (v.p.c || []).forEach(c => cond(c, key)); (v.p.k || []).forEach(k => cost(k, key)); if (v.p.d) steps(v.p.d, key); }
  if (v.o) steps(v.o, key);
  if (errs.length === e0) { try { const def = VG.fx.apply({ type: v.p ? 'order' : 'unit', orderKind: 'normal', name: 'x', abilities: [], text: [] }, JSON.parse(JSON.stringify(v).replace(/«(\d+)»/g, 'Name$1'))); const t = def.text.join(' | '); if (/\?(?![^"]*")|undefined|NaN/.test(t.replace(/"[^"]*"/g, ''))) errs.push(key + ': text has a hole: ' + t.slice(0, 200)); if (show && show.includes(key)) console.log(key + ' → ' + t); } catch (e) { errs.push(key + ': ' + e.message); } }
}
console.log('hand-written entries ' + n + (errs.length ? ' · PROBLEMS ' + errs.length : ' · all names known'));
for (const e of errs.slice(0, 40)) console.log('  ' + e);
if (errs.length) process.exitCode = 1;
