// Prints the wiki wording of cards (kept for looking up words the official list lost, e.g. <Race> names): node tools/wk.mjs <name regexp>…   (reads data/wiki.json — build-time data, never published)
import fs from 'node:fs';
const W = JSON.parse(fs.readFileSync(new URL('../data/wiki.json', import.meta.url), 'utf8')); const a = Object.values(W.recs || W);
for (const q of process.argv.slice(2)) { const re = new RegExp(q, 'i'); for (const r of a.filter(x => re.test(x.t || '')).slice(0, 4)) console.log('# ' + r.t + '\n' + (r.e || '').replace(/<br>/g, '\n').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').slice(0, 900) + '\n'); }
