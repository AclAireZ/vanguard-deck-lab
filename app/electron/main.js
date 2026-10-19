// Vanguard D Deck Lab — the game window. It shows game/VanguardDeckLab.html (built by `node build.mjs`); card pictures load from the official sites on each player's machine.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
app.setName('Vanguard Deck Lab');
function open() {
  const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 960, minHeight: 600, backgroundColor: '#070205', autoHideMenuBar: true, title: 'Vanguard D Deck Lab', icon: path.join(__dirname, 'vg.ico'), webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false } });
  win.maximize();
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });   // links (official card pages) open in the normal browser
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, 'game', 'VanguardDeckLab.html'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(open);
  app.on('window-all-closed', () => app.quit());
}
