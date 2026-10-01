"""Write assets/3d/README.md from validation.json (produced by validate.py).

usage: python3 make_readme.py <assets_3d_dir>
"""
import json, os, sys

D = sys.argv[1]
V = json.load(open(os.path.join(D, 'validation.json')))
mb = lambda b: '%.2f MB' % (b / 1048576)
L = []
w = L.append

w("# Wizard's Chess 3D assets")
w('')
w('Carved-stone chess pieces and seated villain giants for the browser game, built procedurally in '
  'Blender 5.2 (Python API, headless) and exported as glTF 2.0 binaries for three.js r128 `GLTFLoader`.')
w('')
w('![pieces](preview_pieces.png)')
w('')
w('## Conventions (read this first)')
w('')
w('- **Units:** 1 unit = 1 board square. **Up:** +Y in glTF (exported with "+Y Up").')
w('- **Facing:** every piece and villain faces **−Z in glTF** (three.js forward). In Blender the delivered '
  'models face +Y. The original brief also said "faces −Y in Blender", but that and "−Z in glTF" cannot both '
  'hold with the default +Y-up export, so −Z in glTF was chosen. Rotate Black by π about Y to face White.')
w('- **Origin:** each piece\'s plinth bottom is at y = 0, centred on x = z = 0. Villain thrones sit on y = 0.')
w('- **Transforms:** every mesh has identity rotation and scale. A weapon node is translated to its grip; '
  'everything else has zero translation relative to its parent. No animations, cameras, lights or Draco.')
w('- **Materials:** `stone` / `stone_<piece>` are neutral grey (base 0.5, roughness 0.6) for the game to '
  'replace with marble or obsidian. `glow` = eyes and visor light (tint per side). `emissive` = lava cracks and '
  'orbs. three.js r128 uses `uv2` for `aoMap`; `GLTFLoader` copies `uv` to `uv2` automatically when an '
  'occlusion texture is present.')
w('')

p = V.get('pieces.glb')
if p:
    w('## pieces.glb (%s)' % mb(p['bytes']))
    w('')
    w('Six top-level empties: `pawn`, `rook`, `knight`, `bishop`, `queen`, `king`. Each body has its own '
      '`stone_<piece>` material with an embedded **1024² tangent-space normal map** (JPEG) and a **512² ambient '
      'occlusion map** (JPEG, red channel), both baked from the high-poly voxel sculpt (chips, chisel wear and grain live in these maps).')
    w('')
    w('| Piece | Child nodes | Triangles (body / eyes / weapon = total) | Height | Plinth radius | Maps |')
    w('|---|---|---|---|---|---|')
    for t in ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king']:
        q = p['pieces'][t]
        tri = q['tris']
        parts = ' / '.join(str(tri.get('%s_%s' % (t, k), '–')) for k in ('body', 'eyes', 'weapon'))
        w('| %s | %s | %s = **%d** | %.3f | %.3f | normal + AO |' % (
            t, ', '.join('`%s`' % n for n in q['nodes']), parts, q['total_tris'], q['height'], q['plinth_radius']))
    w('')
    w('Weapons (`pawn_weapon` short sword, `bishop_weapon` crooked staff, `king_weapon` point-down greatsword) '
      'have their origin at the hand grip, so `weapon.rotation` swings them around the grip. They use the plain '
      '`stone` material with no baked maps.')
    w('')
    w('Embedded images: ' + ', '.join('`%s` (%s)' % (i['name'], i['mimeType']) for i in p['images']) + '.')
    w('')

vill = {k: v for k, v in V.items() if k.startswith('villain_')}
if vill:
    w('## Villains')
    w('')
    w('One GLB per villain, seated on its throne, about 6.5 units tall at the top of the head. They are rigged as '
      'a plain object hierarchy (no skinning). Every pivot is an empty, and the meshes are its children:')
    w('')
    w('```')
    w('<name>')
    w('├─ throne                    mesh, base at y = 0')
    w('├─ legs                      mesh (static, seated)')
    w('└─ body                      pivot at the hips')
    w('   ├─ torso (+ cloak / lava_torso)')
    w('   ├─ head                   pivot at the neck → head_geo, eyes (glow)')
    w('   │  └─ jaw                 pivot at the hinge → jaw_geo')
    w('   ├─ arm_L / arm_R          pivot at the shoulders → upperarm_*')
    w('   │  └─ fore_L / fore_R     pivot at the elbows → forearm_* (+ weapon)')
    w('   │     └─ finger_L_0..3 / finger_R_0..3   pivots at the knuckles → finger_*_geo')
    w('```')
    w('')
    w('`_L` is the villain\'s own left (−X in glTF while facing −Z). `finger_*_0` is the index finger and '
      '`finger_*_3` the little finger. Curl a finger by rotating its node about its local X axis; open the jaw '
      'by rotating `jaw` about X. No baked maps are embedded in the villains; their detail is in the geometry.')
    w('')
    w('Basalt comes in a little under the 40k target (about 37k): his faceted rocks need fewer triangles to read well.')
    w('')
    w('| File | Size | Triangles | Materials | Meshes (triangles) |')
    w('|---|---|---|---|---|')
    for k in sorted(vill):
        x = vill[k]
        meshes = ', '.join('`%s` %d' % (n, t) for n, t in x['meshes'].items())
        w('| `%s` | %s | %d | %s | %s |' % (k, mb(x['bytes']), x['total_tris'], ', '.join(x['materials']), meshes))
    w('')
    for k in sorted(vill):
        n = k[len('villain_'):-4]
        w('![%s](preview_villain_%s.png)' % (n, n))
    w('')

w('## Rebuilding')
w('')
w('```sh')
w('cd assets/3d/scripts')
w('./build_all.sh            # all pieces + villains + previews + validation + README (~25 min on an M4)')
w('```')
w('')
w('| Script | Purpose |')
w('|---|---|')
w('| `wc_lib.py` | Shape builders, sculpt pipeline (voxel remesh, boolean chips, weathering), decimation, UVs, baking, materials |')
w('| `pieces_def.py` / `build_piece.py` | Shapes for the six pieces; builds one piece (high-poly sculpt, 11.5k-tri low-poly, normal + AO bake) |')
w('| `assemble_pieces.py` | Merges the pieces, turns them to face −Z in glTF, and exports `pieces.glb` |')
w('| `villains_def.py` / `build_villain.py` | Villain shapes and the rigid hierarchy; exports `villain_<name>.glb` |')
w('| `preview.py` | 1024 px EEVEE render with three-point lighting |')
w('| `validate.py` | Re-imports each GLB and checks node names, sizes (±5%), facing, materials, budgets and limits |')
w('| `gltf_fix.py`, `validate_gltf.mjs` | Repairs degenerate tangents, then runs the Khronos glTF validator |')
w('')
w('`blend/` holds the assembled `.blend` scenes with textures packed.')
open(os.path.join(D, 'README.md'), 'w').write('\n'.join(L) + '\n')
print('README written')
