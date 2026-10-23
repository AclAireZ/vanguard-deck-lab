// Bot levels: bot-vs-bot games between levels; the stronger level must win more.  node test/botlevels.mjs [games per pairing]
import fs from 'node:fs';
import '../src/engine.js'; import '../src/cards.js'; import '../src/fx.js'; import '../src/db.js'; import '../src/bot.js';
const VG = globalThis.VG;
VG.loadDB(JSON.parse(fs.readFileSync(new URL('../src/db.json', import.meta.url), 'utf8'))); VG.loadJP(JSON.parse(fs.readFileSync(new URL('../src/jp.json', import.meta.url), 'utf8')));
const N = +process.argv[2] || 200; const decks = (process.env.DECKS || 'TD01,1MCW2').split(',');
function game(seed, lv, da, db) { const cfg = { seed, players: [{ name: 'A', deck: VG.DECKS[da] }, { name: 'B', deck: VG.DECKS[db] }] }; const G = new VG.Game(cfg).start(); let n = 0;
  while (G.pending && n++ < 9000) G.answer(VG.bot(G, lv[G.pending.player])); if (!G.over) throw new Error('no result seed ' + seed);
  const R = VG.Game.replay(cfg, G.history); if (!R.over || R.over.winner !== G.over.winner) throw new Error('replay mismatch ' + seed); return G; }
const res = {}; let bad = 0;
for (const [a, b] of [['hard', 'normal'], ['normal', 'easy'], ['hard', 'easy']]) {
  let wa = 0, games = 0, turns = 0;
  for (const da of decks) for (const db of decks) for (let s = 1; s <= N; s++) {   // each level plays both seats and both decks
    for (const flip of [0, 1]) { const lv = flip ? [b, a] : [a, b]; const G = game(s * 7919 + flip, lv, da, db); if (G.over.winner === flip ? 1 : 0) {} if ((G.over.winner === 0) !== !!flip) wa++; games++; turns += G.turnNo; }
  }
  const pct = Math.round(1000 * wa / games) / 10; res[a + '-' + b] = pct; console.log(a.padEnd(6), 'vs', b.padEnd(6), 'wins', pct + '%', '(' + games + ' games, avg ' + (turns / games).toFixed(1) + ' turns)');
  if (pct <= 52) bad++;
}
if (bad) { console.log('FAIL: a stronger level did not win clearly'); process.exitCode = 1; } else console.log('ok');
