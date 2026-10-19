#!/bin/bash
# Packs the project (source, tests, tools, task list) for saving to the owner's PC.
set -e
cd /home/claude/vg
mkdir -p /mnt/user-data/outputs/vgsave
tar czf /mnt/user-data/outputs/vgsave/vanguard-deck-lab-source.tar.gz --exclude=dist --exclude=shots --exclude=node_modules --exclude=data/raw.json --exclude=data/published.html --exclude=data/full.json --exclude=data/jp.json --exclude=data/wiki.json --exclude=data/wiki-extra.json --exclude=data/jp-map.json --exclude=data/todo.json --exclude=data/wiki-todo.json --exclude=data/wiki2.json --exclude=data/jp-text.json --exclude='data/jp-rest*.json' --exclude=data/failed.json --exclude=data/fails.txt --exclude=data/fails.jsonl --exclude='tools/*.bak' .
cp TASKS.md /mnt/user-data/outputs/vgsave/TASKS.md
ls -la /mnt/user-data/outputs/vgsave
