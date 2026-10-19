#!/bin/bash
# tools/ap.sh <patch.py|-> <batch.txt|->   : backup, run the patch, check the sources load, append the batch, drop written keys from defer.txt, rebuild + check
cd "$(dirname "$0")/.." || exit 1
B=/tmp/vgbak; mkdir -p $B; cp src/engine.js src/fx.js src/db.js src/ui.js tools/mkdb.mjs test/sim.mjs tools/hand-ast.txt tools/defer.txt $B/
restore() { cp $B/engine.js $B/fx.js $B/db.js $B/ui.js src/; cp $B/mkdb.mjs $B/hand-ast.txt $B/defer.txt tools/; cp $B/sim.mjs test/; echo RESTORED; exit 1; }
if [ "$1" != "-" ]; then python3 "$1" || restore; fi
node -e "require('./src/engine.js');require('./src/cards.js');require('./src/fx.js');require('./src/db.js')" || restore
if [ "$2" != "-" ]; then cat "$2" >> tools/hand-ast.txt; fi
python3 - <<'PY'
ks=set(l.split(' ',1)[0] for l in open('tools/hand-ast.txt',encoding='utf8') if l.strip())
d=open('tools/defer.txt',encoding='utf8').read().split(); keep=[k for k in d if k not in ks]
open('tools/defer.txt','w',encoding='utf8').write(' '.join(keep)+'\n')
PY
node tools/mkdb.mjs 2>&1 | grep -i "not used\|subtype" | cut -c1-300; node tools/astcheck.mjs 2>&1 | tail -6 | cut -c1-420; node tools/fl.mjs --stat | tr -d '\n '; echo
