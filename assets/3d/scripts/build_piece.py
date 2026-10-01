"""Build one Wizard's Chess piece: high-poly sculpt -> low-poly + baked maps.

usage: blender -b -P build_piece.py -- <pawn|rook|knight|bishop|queen|king> [build_dir]
Writes <build_dir>/<type>.blend containing empty <type> with <type>_body,
<type>_eyes and (pawn/bishop/king) <type>_weapon.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
from wc_lib import *
import pieces_def

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TYPE = argv[0]
BUILD = argv[1] if len(argv) > 1 else os.path.expanduser('~/work/wc_build')
TEX = int(argv[2]) if len(argv) > 2 else 1024
os.makedirs(BUILD, exist_ok=True)

# Target sizes: total height, plinth radius
SIZES = {'pawn': (1.06, 0.34), 'rook': (1.45, 0.37), 'knight': (1.50, 0.36),
         'bishop': (1.70, 0.35), 'queen': (1.90, 0.37), 'king': (2.10, 0.38)}
BODY_TRIS = 11500
WEAPON_TRIS = 1300

reset()
H, R = SIZES[TYPE]
spec = getattr(pieces_def, 'build_' + TYPE)(H, R)

voxel = H / 520.0
hi = sculpt(TYPE, spec['adds'], spec['cuts'], voxel, chips=spec.get('chips', 24),
            chip_size=spec.get('chip_size', 0.022), chip_ok=spec.get('chip_ok'),
            seed=sum(map(ord, TYPE)), wear=spec.get('wear', 1.0), H=1.0,
            final_cuts=spec.get('final_cuts'), post_adds=spec.get('post_adds'))

# --- fit exact height (scale Z only; plinth radius is modelled exactly)
top = max(v.co.z for v in hi.data.vertices)
sz = H / top
fit = Matrix.Diagonal((1, 1, sz, 1))
xform(hi, fit)
print('FIT', TYPE, 'top', round(top, 4), 'scale z', round(sz, 4))

lo = make_low(hi, TYPE + '_body', BODY_TRIS)
ext = 0.012 * H
nimg, aimg = bake(lo, hi, TYPE, TEX, BUILD, extrusion=ext, ray=ext * 2.5, ao_dist=0.12 * H)
for im in (nimg, aimg):
    im.pack()
set_mat(lo, mat_stone('stone_' + TYPE, nimg, aimg))
delete([hi])

# --- eyes
eyes = join(spec['eyes'], TYPE + '_eyes')
eyes.data.name = TYPE + '_eyes'
xform(eyes, fit)
triangulate(eyes)
shade(eyes, weighted=False)
uv_unwrap(eyes)
set_mat(eyes, mat_emit('glow'))

children = [lo, eyes]

# --- weapon, origin at the grip
if spec.get('weapon'):
    w = join(spec['weapon'], TYPE + '_weapon_hi')
    xform(w, fit)
    w = remesh(w, spec.get('weapon_voxel', 0.0025))
    displace(w, 'CLOUDS', 0.02, 0.0015, seed=5)
    wl = bpy.data.objects.new(TYPE + '_weapon', w.data.copy())
    link(wl)
    wl.data.name = TYPE + '_weapon'
    delete([w])
    decimate(wl, WEAPON_TRIS)
    grip = fit @ Vector(spec['grip'])
    xform(wl, Matrix.Translation(-grip))
    wl.location = grip
    shade(wl)
    uv_unwrap(wl)
    set_mat(wl, mat_stone('stone'))
    children.append(wl)

root = bpy.data.objects.new(TYPE, None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.3
link(root)
for c in children:
    c.parent = root
    c.matrix_parent_inverse.identity()

for c in children:
    print('TRIS', c.name, tris(c))
print('TRIS_TOTAL', TYPE, sum(tris(c) for c in children))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, TYPE + '.blend'), compress=True)
