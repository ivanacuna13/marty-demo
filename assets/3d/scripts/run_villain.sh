#!/bin/sh
# Build one villain GLB and render its preview: run_villain.sh <name> [out_dir]
cd "$(dirname "$0")"
OUT=${2:-$(cd .. && pwd)}
B=$HOME/work/wc_build
mkdir -p "$B/logs"
blender -b --factory-startup -P build_villain.py -- "$1" "$OUT" > "$B/logs/v_$1.log" 2>&1
echo "$1 build exit $?"
blender -b --factory-startup -P preview.py -- "$OUT/villain_$1.glb" "$OUT/preview_villain_$1.png" > "$B/logs/prev_v_$1.log" 2>&1
echo "$1 preview exit $?"
