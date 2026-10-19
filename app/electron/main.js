// Vanguard D Deck Lab — the game window. It shows game/VanguardDeckLab.html (built by `node build.mjs`); card pictures load from the official sites on each player's machine.
// Updates: the installed game checks GitHub Releases at start, downloads a new version in the background and asks to restart. The portable exe only tells you a new version is out.
const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
app.setName('Vanguard Deck Lab');
// look like a normal Chrome to the card sites, so both players get the official card pictures without uploading anything
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + process.versions.chrome + ' Safari/537.36';
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
  app.whenReady().then(() => { open(); updates(); });
  app.on('window-all-closed', () => app.quit());
}
