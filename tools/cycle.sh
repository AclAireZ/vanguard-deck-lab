#!/bin/bash
# one round: rebuild the card list with the hand-written lines, check them, show totals and the next unreadable lines (arguments go to tools/fl.mjs)
cd /home/claude/vg
node tools/mkdb.mjs | grep -v '^{' ; node tools/astcheck.mjs | head -30; node tools/fl.mjs --stat | tr -d '\n ' ; echo; node tools/fl.mjs "$@"
