import fs from 'node:fs';
const r = f => fs.readFileSync(new URL('./src/' + f, import.meta.url), 'utf8');
const dbPath = new URL('./src/db.json', import.meta.url);
const db = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf8').trim() : 'null';
const parts = ['engine.js', 'cards.js', 'fx.js', 'db.js', 'bot.js', 'ui.js', 'builder.js'].filter(f => fs.existsSync(new URL('./src/' + f, import.meta.url)));
const jpPath = new URL('./src/jp.json', import.meta.url); const jp = fs.existsSync(jpPath) ? fs.readFileSync(jpPath, 'utf8').trim() : 'null';
const js = 'window.VG_DB_DATA = ' + db + ';\nwindow.VG_JP_DATA = ' + jp + ';\n' + parts.map(r).join('\n');
if (/<\/script/i.test(js)) throw new Error('script close tag inside JS');
const html = r('index.src.html').replace('/*__CSS__*/', () => r('style.css')).replace('/*__JS__*/', () => js);
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/vanguard-d-deck-lab.html', import.meta.url), html);
// local test wrapper mirrors the publish skeleton
fs.writeFileSync(new URL('./dist/test.html', import.meta.url), '<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + html + '</body></html>');
// the copy that runs from the owner's disk: no online rooms; card pictures come from a "cards" folder beside the file, then from the official card list (nothing is stored in the file)
{ const ip = new URL('./src/img.json', import.meta.url); const img = fs.existsSync(ip) ? fs.readFileSync(ip, 'utf8').trim() : '[]';
  const cfgp = new URL('./app.config.json', import.meta.url); const cfg = fs.existsSync(cfgp) ? JSON.parse(fs.readFileSync(cfgp, 'utf8')) : {};   // account server (Supabase URL + public anon key); empty = accounts off
  const sb = process.env.VG_SB_URL ? { url: process.env.VG_SB_URL, key: process.env.VG_SB_KEY || '' } : cfg.supabase && cfg.supabase.url ? { url: cfg.supabase.url, key: cfg.supabase.key } : null;
  const local = 'window.VG_LOCAL = { base: "https://en.cf-vanguard.com/wordpress/wp-content/images/cardlist/", jp: "https://cf-vanguard.com/wordpress/wp-content/images/cardlist/", img: ' + img + ', sb: ' + JSON.stringify(sb) + ', ver: ' + JSON.stringify(process.env.VG_VERSION || '') + ', repo: ' + JSON.stringify(process.env.VG_REPO || 'AclAireZ/vanguard-deck-lab') + ' };\n';
  const pj = fs.readFileSync(new URL('./vendor/peerjs.min.js', import.meta.url), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');   // PeerJS (MIT) for the quick room
  const mq = fs.readFileSync(new URL('./vendor/mqtt.min.js', import.meta.url), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');   // MQTT.js (MIT) for the room list and the relay when a direct link is blocked
  if (/<\/script/i.test(pj) || /<\/script/i.test(mq)) throw new Error('script close tag inside a vendor file');
  const h2 = r('index.src.html').replace('/*__CSS__*/', () => r('style.css')).replace('/*__JS__*/', () => local + pj + '\n;' + mq + '\n;' + js);
  fs.mkdirSync(new URL('./dist/local/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('./dist/local/VanguardDeckLab.html', import.meta.url), '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + h2 + '</body></html>'); }
console.log('built', (html.length / 1024).toFixed(0) + ' KB', db === 'null' ? '(no card db)' : '');
