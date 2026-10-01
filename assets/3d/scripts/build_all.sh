#!/bin/sh
# Rebuild every Wizard's Chess asset from scratch into assets/3d/.
set -e
cd "$(dirname "$0")"
OUT=$(cd .. && pwd)
B=$HOME/work/wc_build
printf "pawn\nrook\nknight\nbishop\nqueen\nking\n" | xargs -P 3 -n 1 ./run_piece.sh
blender -b --factory-startup -P assemble_pieces.py -- "$B" "$OUT"
python3 gltf_fix.py "$OUT/pieces.glb"
blender -b --factory-startup -P preview.py -- "$OUT/pieces.glb" "$OUT/preview_pieces.png"
printf "malvorn\ngrukk\nmorwen\nbasalt\n" | xargs -P 2 -n 1 ./run_villain.sh
python3 gltf_fix.py "$OUT"/villain_*.glb
rm -f "$OUT/validation.json"
blender -b --factory-startup -P validate.py -- "$OUT/pieces.glb" "$OUT"/villain_*.glb
if command -v node >/dev/null; then
  [ -d node_modules/gltf-validator ] || npm i --no-save --no-package-lock gltf-validator >/dev/null 2>&1
  node validate_gltf.mjs "$OUT"/*.glb
fi
python3 make_readme.py "$OUT"
