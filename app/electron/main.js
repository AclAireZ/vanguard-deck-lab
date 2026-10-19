// Vanguard D Deck Lab — the game window. It shows game/VanguardDeckLab.html (built by `node build.mjs`); card pictures load from the official sites on each player's machine.
// Updates: the installed game checks GitHub Releases at start, downloads a new version in the background and asks to restart. The portable exe only tells you a new version is out.
const { app, BrowserWindow, shell, dialog, protocol, net, session } = require('electron');
const fs = require('fs'); const crypto = require('crypto');
const path = require('path');
app.setName('Vanguard Deck Lab');
if (process.env.VG_USERDATA) app.setPath('userData', process.env.VG_USERDATA);   // tests: a throw-away profile
// look like a normal Chrome to the card sites, so both players get the official card pictures without uploading anything
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + process.versions.chrome + ' Safari/537.36';
/* ---- card picture cache: pictures from the official card lists are kept on this computer after the first load (userData/cardcache) ----
   The page asks the official sites as before; those requests are redirected to vgcache://, which answers from disk, or fetches once from the site and keeps the file.
   Pictures that a site does not have are remembered for a week, so the game does not ask again and again. Nothing is shared with anyone. */
protocol.registerSchemesAsPrivileged([{ scheme: 'vgcache', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const CACHE_HOSTS = ['https://cf-vanguard.com/wordpress/wp-content/images/', 'https://en.cf-vanguard.com/wordpress/wp-content/images/'].concat((process.env.VG_CACHE_HOSTS || '').split(',').filter(Boolean));
function setupCache() {
  const dir = path.join(app.getPath('userData'), 'cardcache'); fs.mkdirSync(dir, { recursive: true });
  const missF = path.join(dir, 'missing.json'); let miss = {}; try { miss = JSON.parse(fs.readFileSync(missF, 'utf8')) || {}; } catch (e) { miss = {}; }
  let missT = 0; const saveMiss = () => { clearTimeout(missT); missT = setTimeout(() => { try { fs.writeFileSync(missF, JSON.stringify(miss)); } catch (e) { /* best effort */ } }, 2000); };
  const WEEK = 7 * 24 * 3600e3; const inflight = new Map(); const fetchSes = session.fromPartition('vgcache-fetch'); fetchSes.setUserAgent(app.userAgentFallback);
  const type = u => /\.jpe?g(\?|$)/i.test(u) ? 'image/jpeg' : /\.webp(\?|$)/i.test(u) ? 'image/webp' : 'image/png';
  const fileOf = u => path.join(dir, crypto.createHash('sha1').update(u).digest('hex') + (u.match(/\.(png|jpe?g|webp)(?:\?|$)/i) || ['', 'png'])[1].toLowerCase().replace('jpeg', 'jpg'));
  const stat = () => { let n = 0, bytes = 0; for (const f of fs.readdirSync(dir)) { if (f === 'missing.json' || f.endsWith('.tmp')) continue; try { bytes += fs.statSync(path.join(dir, f)).size; n++; } catch (e) { /* gone */ } } return { n, bytes, miss: Object.keys(miss).length, dir }; };
  protocol.handle('vgcache', async req => {
    const q = new URL(req.url); const json = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    if (q.pathname === '/stat') return json(stat());
    if (q.pathname === '/clear') { for (const f of fs.readdirSync(dir)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* in use */ } } miss = {}; return json(stat()); }
    const real = q.searchParams.get('u') || ''; if (!CACHE_HOSTS.some(h => real.startsWith(h))) return new Response(null, { status: 400 });
    const file = fileOf(real); const H = { 'content-type': type(real), 'cache-control': 'max-age=31536000', 'access-control-allow-origin': '*' };
    try { return new Response(await fs.promises.readFile(file), { headers: H }); } catch (e) { /* not kept yet */ }
    if (miss[real] && Date.now() - miss[real] < WEEK) return new Response(null, { status: 404 });
    let job = inflight.get(real);
    if (!job) { job = (async () => {
      const r = await fetchSes.fetch(real);   // its own session: the redirect below only watches the game window's session
      if (!r.ok) { if (r.status === 404 || r.status === 403 || r.status === 410) { miss[real] = Date.now(); saveMiss(); } return { status: r.status }; }
      const ct = r.headers.get('content-type') || ''; const buf = Buffer.from(await r.arrayBuffer());
      if (!/^image\//.test(ct) || buf.length < 200) { miss[real] = Date.now(); saveMiss(); return { status: 404 }; }   // a page instead of a picture
      const tmp = file + '.' + process.pid + '.tmp'; fs.promises.writeFile(tmp, buf).then(() => fs.promises.rename(tmp, file)).catch(() => {});
      return { status: 200, buf };
    })().finally(() => inflight.delete(real)); inflight.set(real, job); }
    try { const out = await job; return out.buf ? new Response(out.buf, { headers: H }) : new Response(null, { status: out.status || 502 }); }
    catch (e) { if (process.env.VG_CACHE_LOG) console.log('cache fetch failed', real, e && e.message); return new Response(null, { status: 502 }); }   // offline: the page tries its next source
  });
  const urls = CACHE_HOSTS.map(h => h.replace(/\/$/, '') + '/*');
  session.defaultSession.webRequest.onBeforeRequest({ urls }, (d, cb) => cb(d.url.startsWith('vgcache:') ? {} : { redirectURL: 'vgcache://img/get?u=' + encodeURIComponent(d.url) }));
}
const RELEASES = 'https://github.com/AclAireZ/vanguard-deck-lab/releases/latest';
let win = null;
function open() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 600, backgroundColor: '#070205', autoHideMenuBar: true, title: 'Vanguard D Deck Lab ' + app.getVersion(), icon: path.join(__dirname, 'vg.ico'), webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false, devTools: !app.isPackaged } });
  win.maximize();
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });   // links (official card pages) open in the normal browser
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on('page-title-updated', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'game', 'VanguardDeckLab.html'));
}
function updates() {
  if (!app.isPackaged || process.env.VG_NO_UPDATE) return;
  let au; try { au = require('electron-updater').autoUpdater; } catch (e) { return; }
  const portable = !!process.env.PORTABLE_EXECUTABLE_DIR;
  au.autoDownload = !portable; au.autoInstallOnAppQuit = true;
  au.on('update-available', info => {
    if (!portable) { if (win) win.setTitle('Vanguard D Deck Lab ' + app.getVersion() + ' — กำลังโหลดเวอร์ชัน ' + info.version + '…'); return; }
    dialog.showMessageBox(win, { type: 'info', title: 'มีเวอร์ชันใหม่', message: 'Vanguard Deck Lab เวอร์ชัน ' + info.version + ' ออกแล้ว', detail: 'ไฟล์ Portable อัปเดตเองไม่ได้ กดดาวน์โหลดเพื่อเปิดหน้าโหลดไฟล์ใหม่ (หรือใช้ตัว Setup ซึ่งอัปเดตเองอัตโนมัติ)', buttons: ['ดาวน์โหลด', 'ไว้ทีหลัง'], defaultId: 0, cancelId: 1 })
      .then(r => { if (r.response === 0) shell.openExternal(RELEASES); });
  });
  au.on('download-progress', p => { if (win) win.setProgressBar(Math.max(0, Math.min(1, p.percent / 100))); });
  au.on('update-downloaded', info => {
    if (win) { win.setProgressBar(-1); win.setTitle('Vanguard D Deck Lab ' + app.getVersion() + ' — เวอร์ชัน ' + info.version + ' พร้อมติดตั้ง'); }
    dialog.showMessageBox(win, { type: 'info', title: 'อัปเดตพร้อมแล้ว', message: 'โหลดเวอร์ชัน ' + info.version + ' เสร็จแล้ว', detail: 'รีสตาร์ทเกมเพื่อใช้เวอร์ชันใหม่ตอนนี้เลยไหม? ถ้ากด "ไว้ทีหลัง" เกมจะอัปเดตเองตอนปิดเกม', buttons: ['รีสตาร์ทเลย', 'ไว้ทีหลัง'], defaultId: 0, cancelId: 1 })
      .then(r => { if (r.response === 0) setImmediate(() => au.quitAndInstall(true, true)); });
  });
  au.on('error', e => { if (win) win.setProgressBar(-1); console.log('update check failed:', e && e.message); });
  const check = () => au.checkForUpdates().catch(() => {});
  setTimeout(check, 4000); setInterval(check, 3 * 60 * 60 * 1000);   // at start, then every 3 hours while the game is open
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { try { setupCache(); } catch (e) { console.log('picture cache off:', e && e.message); } open(); updates(); });
  app.on('window-all-closed', () => app.quit());
}
