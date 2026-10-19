// Packs the Windows game folder: dist/app/VanguardDeckLab/ (launcher, shortcut maker, game file, icon, readme) and dist/VanguardDeckLab-Windows.zip
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const U = f => new URL(f, import.meta.url);
const out = U('../dist/app/VanguardDeckLab/'); fs.rmSync(U('../dist/app/'), { recursive: true, force: true }); fs.mkdirSync(new URL('game/cards/', out), { recursive: true });
for (const f of ['Play Vanguard Deck Lab.bat', 'Create Desktop Shortcut.bat', 'README-อ่านก่อน.txt']) fs.copyFileSync(U('../app/' + f), new URL(f, out));
fs.copyFileSync(U('../dist/local/VanguardDeckLab.html'), new URL('game/VanguardDeckLab.html', out));
fs.copyFileSync(U('../app/vg.ico'), new URL('game/vg.ico', out));
fs.copyFileSync(U('../vendor/peerjs-LICENSE'), new URL('game/peerjs-LICENSE.txt', out));
fs.writeFileSync(new URL('game/cards/วางรูปการ์ดสำรองที่นี่.txt', out), '﻿ใส่รูปการ์ดสำรองในโฟลเดอร์นี้ได้ (ไม่บังคับ) เกมโหลดรูปจากเว็บทางการเองอยู่แล้ว\r\n');
const zip = U('../dist/VanguardDeckLab-Windows.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-q', '-X', zip.pathname, 'VanguardDeckLab'], { cwd: U('../dist/app/').pathname });
console.log('app', (fs.statSync(zip).size / 1024 / 1024).toFixed(1) + ' MB');
