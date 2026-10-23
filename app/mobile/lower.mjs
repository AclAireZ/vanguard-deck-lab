// Phone build: the local game page with its scripts lowered to older syntax (Android WebView 87+, iOS 14+), two small polyfills,
// and a note for phones whose built-in WebView is too old (instead of a blank screen).   node lower.mjs <in.html> <out.html>
import fs from 'node:fs';
import { transformSync } from 'esbuild';
const [src, out] = process.argv.slice(2);
let h = fs.readFileSync(src, 'utf8');
const poly = `if(!Array.prototype.at){Object.defineProperty(Array.prototype,'at',{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n]},writable:true,configurable:true});Object.defineProperty(String.prototype,'at',{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n]},writable:true,configurable:true})}
if(!Object.hasOwn){Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k)}}`;
const old = `(function(){var ok=window.CSS&&CSS.supports&&CSS.supports('aspect-ratio','1');if(ok)return;document.addEventListener('DOMContentLoaded',function(){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;top:0;left:0;right:0;bottom:0;z-index:99999;background:#05060f;color:#eef0ff;padding:32px 20px;font:16px/1.6 system-ui,sans-serif;text-align:center';d.innerHTML='<h2 style="margin:40px 0 12px">ตัวแสดงผลของเครื่องเก่าเกินไป</h2><p>เกมต้องใช้ Android System WebView หรือ Chrome เวอร์ชันใหม่<br>เปิด Play Store ค้นหา <b>Android System WebView</b> แล้วกดอัปเดต จากนั้นเปิดเกมใหม่</p><p style="margin-top:20px"><a style="color:#f9b912" href="https://play.google.com/store/apps/details?id=com.google.android.webview">เปิดหน้า Android System WebView</a></p><p style="margin-top:28px"><button style="padding:12px 22px;border-radius:10px;border:1px solid #556;background:#1a1f4a;color:#fff;font-size:15px">ลองเล่นต่อ</button></p>';d.querySelector('button').onclick=function(){d.remove()};document.body.appendChild(d)})})();`;
let n = 0;
h = h.replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => { n++; const r = transformSync(code, { loader: 'js', target: ['chrome87', 'safari14'], charset: 'utf8', legalComments: 'inline' }); if (/<\/script/i.test(r.code)) throw new Error('script close tag after lowering'); return '<script>' + r.code + '</script>'; });
h = h.replace('<head>', '<head><script>' + old + '\n' + poly + '</script>');
fs.writeFileSync(out, h); console.log('lowered', n, 'scripts →', out, (h.length / 1024).toFixed(0) + ' KB');
