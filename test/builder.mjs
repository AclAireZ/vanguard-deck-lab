// Deck builder through the real page: build a legal deck out of machine-read (β) cards by clicking, save it, see it in the lobby after a reload, and play it against the bot.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../dist/test.html', import.meta.url), 'utf8');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route('http://vg.test/**', r => r.fulfill({ contentType: 'text/html', body: html }));
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto('http://vg.test/'); await pg.waitForTimeout(300);
await pg.click('#newDeckBtn'); await pg.click('#dkNew'); await pg.fill('#bdName', 'เด็คทดสอบ β'); await pg.selectOption('#bdNation', 'Dragon Empire');
// a plan made from the card list: β cards where possible
const plan = await pg.evaluate(() => {
  const VG = window.VG; const L = VG.DB.rows.filter(r => r.nation === 'Dragon Empire' && r.t !== 'X' && r.t !== 'C' && (!VG.DB.jp || r.jno)); const pick = (f, n) => { const a = L.filter(f); const be = a.filter(r => r.beta); return (be.length >= n ? be : a).slice(0, n); };
  const ride = [0, 1, 2, 3].map(g => pick(r => r.t === 'U' && r.grade === g && !r.trig, 1)[0].no);
  const main = []; const add = (rows, n) => { for (const r of rows) main.push([r.no, Math.min(n, r.lim || 4)]); };
  add(pick(r => r.trig === 'heal', 1), 4); add(pick(r => r.trig === 'crit', 2), 4); add(pick(r => r.trig === 'draw', 1), 4);
  add(pick(r => r.flags.includes('s') && !r.trig, 1), 4);
  add(L.filter(r => r.t === 'U' && !r.trig && !r.flags.includes('s') && r.grade >= 1 && r.grade <= 3 && r.beta && !ride.includes(r.no)).slice(0, 7), 4); add(pick(r => r.t === 'O' && r.beta, 1), 2);
  return { ride, main };
});
const row = no => '#bdList .crow[data-no="' + no + '"]';
async function find(no) { await pg.fill('#bdQ', no); await pg.waitForFunction(no => { const r = document.querySelector('#bdList .crow'); return r && r.dataset.no === no; }, no, { timeout: 4000 }); }
for (const no of plan.ride) { await find(no); await pg.click(row(no) + ' [data-add="ride"]'); }
for (const [no, n] of plan.main) { await find(no); for (let i = 0; i < n; i++) await pg.click(row(no) + ' [data-add="main"]'); }
const sum = await pg.evaluate(() => { const d = { ride: window.VGBuilder.B.ride.slice(), main: [...window.VGBuilder.B.main].map(([no, n]) => ({ no, n })) }; const r = window.VG.inspectDeck(d); return { errors: r.errors, main: r.counts.main, trig: r.counts.trig, beta: d.main.filter(e => window.VG.card(e.no).beta).length }; });
console.log('built', JSON.stringify(sum));
await pg.click('#bdSave'); await pg.click('#bdBack'); await pg.waitForSelector('#mydecks:not([hidden])'); await pg.click('#dkBack'); await pg.waitForSelector('#lobby:not([hidden])');
await pg.reload(); await pg.waitForTimeout(400);
const saved = await pg.evaluate(() => Object.values(window.VG.DECKS).filter(d => d.custom).map(d => d.name));
console.log('after reload, my decks:', JSON.stringify(saved));
const id = await pg.evaluate(() => Object.values(window.VG.DECKS).find(d => d.custom).id);
await pg.click('#modeSeg [data-mode="bot"]'); await pg.selectOption('#deckSel0', id); await pg.evaluate(() => { window.VGUI.S.speed = 6; }); await pg.click('#goBtn');
const res = await pg.evaluate(async () => { const U = window.VGUI; const S = U.S; const t0 = Date.now(); let used = 0; while (Date.now() - t0 < 160000) { const g = S.game; if (g.over) return { over: g.over, turn: g.turnNo, used }; const d = g.pending; if (d && d.player === S.seat && !S.running && !S.busy) { U.submit(window.VG.bot(g)); } await new Promise(r => setTimeout(r, 25)); } return { timeout: 1, turn: S.game.turnNo }; });
console.log('played the saved deck vs bot:', JSON.stringify(res));
const ok = sum.main === 50 && sum.trig === 16 && saved.includes('เด็คทดสอบ β') && res.over && !errs.length;
if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 5));
console.log(ok ? 'builder ok' : 'BUILDER FAILED'); if (!ok) process.exitCode = 1;
await b.close();
