// Starts the built game app (Electron) and checks the title screen comes up with the card list loaded and no script errors.
import { _electron as electron } from 'playwright';
const app = await electron.launch({ args: ['.'], cwd: new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
const win = await app.firstWindow(); const errs = []; win.on('pageerror', e => errs.push(String(e)));
await win.waitForSelector('#lobby', { timeout: 30000 }); await win.waitForTimeout(3000);
const st = await win.evaluate(() => ({ cards: window.VG && window.VG.DB && window.VG.DB.count, local: !!window.VG_LOCAL, peer: typeof window.Peer, stat: (document.querySelector('#dbStat') || {}).textContent }));
await win.screenshot({ path: 'smoke.png' });
console.log(JSON.stringify({ st, errs }));
await app.close();
if (!st.cards || !st.local || st.peer !== 'function' || errs.length) { console.log('SMOKE FAILED'); process.exit(1); } else console.log('app smoke ok');
