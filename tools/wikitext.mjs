// Turns the wiki's markup for a card's skills into the plain form the skill compiler reads (same shape as the official list's wording).
// Used only at build time, on data/wiki.json; nothing produced here is shipped — only the compiled structure is.
const ICON = { 'Counter': 'Counter', 'Soul': 'Soul', 'Energy': 'Energy' };

// {{Name|a|b|k=v}} with nesting → callback(name, args[], named{})
function templates(s, fn) {
  for (let guard = 0; guard < 200; guard++) {
    // innermost template first
    const m = /\{\{([^{}]*)\}\}/.exec(s); if (!m) break;
    const parts = splitBar(m[1]); const name = parts.shift().trim(); const args = []; const named = {};
    for (const p of parts) { const e = /^\s*([A-Za-z0-9]+)\s*=([\s\S]*)$/.exec(p); if (e) named[e[1]] = e[2]; else args.push(p); }
    s = s.slice(0, m.index) + fn(name, args, named) + s.slice(m.index + m[0].length);
  }
  return s;
}
function splitBar(t) { const out = []; let d = 0, cur = ''; for (let i = 0; i < t.length; i++) { const c = t[i]; if (c === '[' && t[i + 1] === '[') { d++; cur += '[['; i++; } else if (c === ']' && t[i + 1] === ']') { d--; cur += ']]'; i++; } else if (c === '|' && d <= 0) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }

const blast = t => t.replace(/\b(Counter|Soul|Energy)[ -]?Blast \((\d+)\)/gi, (m, a, n) => ICON[a[0].toUpperCase() + a.slice(1).toLowerCase()] + '-Blast ' + n);
const charge = t => t.replace(/\[?\b(Counter|Soul|Energy)[ -]?Charge \((\d+)\)\]?/gi, (m, a, n) => '[' + a[0].toUpperCase() + a.slice(1).toLowerCase() + '-Charge ' + n + ']');

export function wikiToPlain(effect, title, std = {}) {
  let s = String(effect || '');
  // a card whose wording differs by language: this pool is the Japanese one
  s = s.replace(/<tabber>([\s\S]*?)<\/tabber>/gi, (m, body) => { const tabs = body.split('|-|').map(t => { const e = /^\s*([^=\n]{1,30})=([\s\S]*)$/.exec(t); return e ? [e[1].trim().toLowerCase(), e[2]] : ['', t]; }); const j = tabs.find(t => /^(japanese|jp|ja)/.test(t[0])) || tabs[0]; return j[1]; });
  s = s.replace(/^-{4,}\s*$/gm, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(?:small|span|u|i|b|nowiki|sup|sub|font|big|center|div)[^>]*>/gi, '');
  s = s.replace(/'''?/g, '');
  s = templates(s, (name, a, k) => {
    const n = name.toLowerCase();
    if (n === 'pagename') return title;
    if (n === 'once') return '[1/turn]';
    if (n === 'cost') return '[COST][' + (a[0] || '').trim() + ']';
    if (n === 'redtext' || n === 'keyword' && false) return a[0] || '';
    if (n === 'reskin') { const nm = a.filter(x => !/^(NoAlso|Also)$/i.test(x.trim()))[0] || ''; return '[CONT]:This card is regarded as "' + nm.trim() + '".'; }
    if (n === 'divineskill') return '[Divine Skill] - ' + (k.ab || '');
    if (n === 'wings') return /^b/i.test(a[0] || '') ? 'Black Wings - ' : 'White Wings - ';
    if (n === 'sentinel') return '[CONT]:Sentinel';
    if (n === 'fv') return std.fv || '⟦FV⟧';
    if (n === 'over' || n === 'critical/trigger' || /^(heal|draw|front|critical)$/.test(n) || n === 'order') return '';
    if (n === 'healc') { const v = (a[0] || '').trim().toLowerCase(); return (v === 'attack' ? std.hcA : v === 'critical' ? std.hcC : '') || '⟦HealC⟧'; }
    if (n === 'od' || n === 'xod') return '[' + (n === 'xod' ? 'X' : '') + 'overDress]-"' + (k.N || '').trim() + '"' + (k.N2 ? ', or ' + k.N2.trim() : '');
    if (n === 'regalispiece') return 'Regalis Piece';
    if (n === 'perfect guard') { const v = (a[0] || '').trim(); return (v === 'D' ? std.pg1 : v === 'D2' ? std.pg2 : '') || '⟦Perfect Guard⟧'; }
    if (n === 'glitter') return '[Glitter]' + (k.N ? '-' + k.N.trim() : '');
    if (n === 'gauge') return /^bf$/i.test((a[0] || '').trim()) || !a[0] ? 'gauge' : a[0].trim() + ' gauge';
    if (n === 'dlink') return (a[1] || a[0] || '').trim();
    if (n === 'callcost') return '[Call Cost]' + (a[0] ? '[' + a[0].trim() + ']' : '');
    if (n === 'powerful') return 'Powerful－[' + (/^c/i.test(a[0] || '') ? 'CONT' : 'AUTO') + '](' + (/^v/i.test(a[1] || '') ? 'VC' : 'RC') + '):';
    if (n === 'overcharge') return 'Overcharge - [' + (/^c/i.test(a[0] || '') ? 'CONT' : 'AUTO') + '](RC)';
    if (n === 'friend') { const t = /vr/i.test(a[0] || '') ? std.friendVR : std.friendR; if (!t) return '⟦Friend⟧'; return a.some(x => /comma/i.test(x)) ? t.replace(/\.\s*$/, ',') : t; }
    if (n === 'du') return 'DressUp - "' + (k.N || '').trim() + '"';
    if (n === 'memory') return 'memory';
    if (n === 'crest') return (a[0] || '').trim() + '" crest⟪q⟫';
    if (n === 'addedability') return a[0] || '';
    if (n === 'soulguard') return '[CONT]:[Soulguard]';
    if (n === 'retry') return '[CONT](VC/RC):[Retry]';
    if (n === 'versionup') return '[VersionUp]';
    if (n === 'hollow') return '[AUTO]:Hollow';
    if (n === 'orderguard') return std.orderGuard ? std.orderGuard.replace(/\d{4,}/, (a[0] || '').trim()) : '⟦OrderGuard⟧';
    if (n === 'keyword') return (a[0] || '').trim() + ' - [' + (/^c/i.test(a[1] || '') ? 'CONT' : 'AUTO') + ']:';
    if (n === 'uniqueskill') return '[Unique Skill] - ' + (k.ab || '');
    return '⟦' + name + (a.length ? '|' + a.join('|') : '') + '⟧';   // unknown template: left as a mark the compiler cannot read (the ability stays manual)
  });
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
  s = s.replace(/"?([^"\n⟪]*" crest)⟪q⟫"?/g, '"$1');   // «a "Name" crest»
  s = s.replace(/«([^»]*)»/g, '<$1>').replace(/^[ \t]*[•·][ \t]*/gm, '・').replace(/\n[ \t]*\*[ \t]*/g, '\n・');
  s = charge(blast(s));
  s = s.replace(/\((Back Row(?: Center)?|Front Row|Back Row Left|Back Row Right) (RC|VC|GC)\)/gi, '$1 ($2)').replace(/^Additional Effect ?- ?/gim, 'Additional Effect - ');
  s = s.replace(/\[(Power|Critical|Shield)\]\s*([+-])/g, '[$1] $2');
  s = s.replace(/(\[(Power|Shield)\] \+\d+[^\n]*?\bgets? )(\+\d+ instead of)/g, '$1[$2] $3').replace(/\]\(Order Zone\)/gi, ']Order Zone').replace(/^Play with this /gim, 'Play this with ');
  return s.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

// standard wordings the wiki writes as a bare template, taken from the official list (eff: card name → official wording)
const line = (t, re) => (String(t || '').split('\n').map(x => x.trim()).find(x => re.test(x)) || '');
export const makeStd = eff => ({ pg1: eff('Escort Stealth Dragon, Hayashi Kaze'), pg2: eff('Planar Prevent Dragon'), hcA: eff('Invigorate Sage'), hcC: eff('Cure Flare Dracokid'), fv: eff('Sunrise Egg'),
  friendVR: line(eff('MiMish, Fortia'), /^Friend/), friendR: line(eff('Cheshire Smile, Larisa'), /^Friend/), orderGuard: line(eff('Dragoenergy'), /guard step/i) });
