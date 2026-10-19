#!/bin/bash
# next lines that mention no special mechanic:  tools/nx.sh [n] [from]
cd "$(dirname "$0")/.." && node tools/mkdb.mjs >/dev/null 2>&1; node tools/astcheck.mjs 2>&1 | tail -4 | cut -c1-400; node tools/fl.mjs --stat | tr -d '\n '; echo
node tools/fl.mjs --not "gauge|prison|clan|buddy|\barms?\b|armed|memory|stride|g zone|special move|legion|alchem|operate|scout|garden|engage|retry|explosive|friend|dominat|monster box|hangar|station|overdrive|oversoul|⟦os|finishing|music|song|sing|cursed play|grimoire|tactics|icon|generation break|\bheart|meteor|dragontree|gene\b|regress|automod|token|marker" --alpha --n ${1:-70} --from ${2:-0} 2>&1 | cut -c1-${3:-470}
