// How many still-failing cards mention each special mechanic (to decide which engine mechanics unlock the most cards).
import fs from 'node:fs';
import { compileCard } from './skillc.mjs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/raw.json', import.meta.url), 'utf8')).recs;
const byName = new Map(); for (const r of raw) { const c = byName.get(r.name); if (r.name && (!c || (r.effect || '').length > (c.effect || '').length)) byName.set(r.name, r); }
const races = new Set(); for (const r of raw) for (const x of (r.race || '').toLowerCase().split('/')) if (x && x !== '-') races.add(x.trim());
const KW = { overdress: /overdress/i, arms: /\barm(s|ed)?\b/i, prison: /prison/i, dragontree: /dragontree/i, world: /\bworld\b|dark night|abyssal/i, finalrush: /final rush|you are in "/i, gauge: /gauge/i, song: /\bsong|sing\b|sung/i, product: /product|operate/i, memory: /memory/i, glitter: /glitter/i, stride: /stride|g zone|g unit|g guardian/i, crest: /crest/i, divine: /divine skill/i, revol: /revoldress/i, friend: /\bfriend\b/i, powerful: /powerful/i, hollow: /hollow/i, ticket: /ticket/i, clan: /\bclan\b/i, legion: /legion|mate/i, lock: /\block|omega/i, marker: /marker/i, 'original power': /original \[/i, bindface: /face down/i, imaginary: /imaginary/i, scout: /scout|base\b/i, token: /token/i, heart: /heart/i, 'would': /\bwould\b/i, alchemagic: /alchemagic/i, 'different name': /different card name/i, 'this fight': /this fight/i, damage: /deal(s)? (one|two|\d) damage|takes? .* damage/i, limit: /limit break|generation break/i, restand_phase: /stand phase/i, 'drive check': /drive check/i, 'energy total': /energy-blast \d+\] or more/i, cantguard: /cannot (call|guard)|must call/i, protect: /quick shield|protect|force|accel/i };
const tot = {}, only = {}; let fail = 0;
for (const r of byName.values()) {
  if (!r.effect || r.effect.trim() === '-') continue; const res = compileCard(r, races); if (!res.fail) continue; fail++;
  const hit = Object.keys(KW).filter(k => KW[k].test(r.effect)); for (const k of hit) tot[k] = (tot[k] || 0) + 1; if (hit.length === 1) only[hit[0]] = (only[hit[0]] || 0) + 1; if (!hit.length) only['(none)'] = (only['(none)'] || 0) + 1;
}
console.log('failing cards', fail);
console.log(Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v + ' (only: ' + (only[k] || 0) + ')').join('\n'));
console.log('no special keyword:', only['(none)']);
