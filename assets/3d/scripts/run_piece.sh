#!/bin/sh
# Build one piece and render its preview: run_piece.sh <type> [build_dir]
cd "$(dirname "$0")"
B=${2:-$HOME/work/wc_build}
mkdir -p "$B/logs"
blender -b --factory-startup -P build_piece.py -- "$1" "$B" > "$B/logs/$1.log" 2>&1
echo "$1 build exit $?"
blender -b --factory-startup -P preview.py -- "$B/$1.blend" "$B/prev_$1.png" > "$B/logs/prev_$1.log" 2>&1
echo "$1 preview exit $?"
