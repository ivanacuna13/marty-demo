"""Build one seated villain as a rigid object hierarchy and export it.

usage: blender -b -P build_villain.py -- <malvorn|grukk|morwen|basalt> <out_dir> [build_dir]

Hierarchy (all pivots are empties; meshes are children with identity transforms):
  <name>
    throne                      (mesh, base at z=0)
    legs                        (mesh, static)
    body          @ hips
      head        @ neck        -> head_geo, eyes (glow), jaw @ hinge -> jaw_geo
      arm_L/arm_R @ shoulders   -> upperarm_*, fore_* @ elbow -> forearm_*,
                                   finger_*_0..3 @ knuckles -> finger_*_i_geo
Modelled facing -Y, then turned 180 deg so the glTF front is -Z (figure's left = -X in glTF).
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
from wc_lib import *
import villains_def

argv = sys.argv[sys.argv.index('--') + 1:]
NAME = argv[0]
OUT = argv[1]
BUILD = argv[2] if len(argv) > 2 else os.path.expanduser('~/work/wc_build')
TOTAL = 52000
HEAD_TOP = 6.5

reset()
v = getattr(villains_def, 'build_' + NAME)()
wsum = sum(p['w'] for p in v.parts)

# ---- build every part to its triangle budget
built = []
for p in v.parts:
    budget = max(120, int(TOTAL * p['w'] / wsum))
    if p['mode'] == 'sculpt':
        ob = sculpt(p['name'] + '_s', p['adds'], p['cuts'], p['voxel'], chips=p['chips'],
                    chip_size=p['chip_size'], seed=len(built) * 17 + 3, wear=p['wear'], H=6.5,
                    post_adds=p.get('post_adds'))
        ob.name = p['name']
        decimate(ob, budget)
        shade(ob)
    else:
        if p['cuts']:
            ob = join(p['adds'], p['name'])
            ob = remesh(ob, p['voxel'])
            ob = boolean(ob, p['cuts'])
        else:
            ob = join(p['adds'], p['name'])
        if p['mode'] == 'smooth':
            if tris(ob) > budget:
                decimate(ob, budget)
            shade(ob)
        else:  # facet: flat-shaded rocks
            triangulate(ob)
            ob.data.polygons.foreach_set('use_smooth', [False] * len(ob.data.polygons))
    ob.data.name = p['name']
    built.append((p, ob))
    print('PART', p['name'], tris(ob), 'budget', budget)

# ---- enlarge the head subtree about the neck pivot (giant, readable heads)
head_nodes = {'head'} | {n for n in v.nodes if v.ancestor(n, 'head')}
NP = v.nodes['head'][1]
HS = Matrix.Translation(NP) @ Matrix.Scale(v.head_scale, 4) @ Matrix.Translation(-NP)
for p, ob in built:
    if p['node'] in head_nodes:
        ob.data.transform(HS)
for n in head_nodes - {'head'}:
    par, pv = v.nodes[n]
    v.nodes[n] = (par, HS @ pv)

# ---- fit: uniform scale so the top of the head subtree is at HEAD_TOP
head_nodes = {'head'} | {n for n in v.nodes if v.ancestor(n, 'head')}
top = max(max((ob.matrix_world @ vv.co).z for vv in ob.data.vertices)
          for p, ob in built if p['node'] in head_nodes)
s = HEAD_TOP / top
print('FIT top', round(top, 3), 'scale', round(s, 4))
R = Matrix.Rotation(math.pi, 4, 'Z')
F = R @ Matrix.Scale(s, 4)
for p, ob in built:
    ob.data.transform(F)
    ob.data.update()
piv = {n: F @ pv for n, (par, pv) in v.nodes.items()}
for p, ob in built:  # weathering moves the throne bottom a little: sit it exactly on z = 0
    if p['node'] == 'throne':
        zmin = min(vv.co.z for vv in ob.data.vertices)
        ob.data.transform(Matrix.Translation((0, 0, -zmin)))
        print('THRONE snap', round(zmin, 4))

# ---- hierarchy
objs = {}
root = bpy.data.objects.new(NAME, None)
link(root)
mesh_nodes = {p['node'] for p, ob in built if p['name'] == p['node']}
for n in v.order():                      # parents before children
    if n in mesh_nodes:
        continue
    par = v.nodes[n][0]
    e = bpy.data.objects.new(n, None)
    e.empty_display_size = 0.3
    link(e)
    e.parent = objs[par] if par else root
    e.location = piv[n] - (piv[par] if par else Vector())
    objs[n] = e
for p, ob in built:
    node = p['node']
    if node in mesh_nodes:               # the mesh is the node itself (throne, legs)
        par = v.nodes[node][0]
        ob.data.transform(Matrix.Translation(-piv[node]))
        ob.parent = objs[par] if par else root
        ob.location = piv[node] - (piv[par] if par else Vector())
    else:
        ob.data.transform(Matrix.Translation(-piv[node]))
        ob.parent = objs[node]
        ob.location = (0, 0, 0)
    ob.matrix_parent_inverse.identity()

# ---- UVs + materials
mats = {'stone': mat_stone('stone'), 'glow': mat_emit('glow'),
        'emissive': mat_emit('emissive', (1.0, 0.42, 0.06), 3.0)}
for p, ob in built:
    uv_unwrap(ob, margin=0.003)
    set_mat(ob, mats[p['mat']])

total = sum(tris(ob) for p, ob in built)
print('TRIS_TOTAL', NAME, total)
os.makedirs(OUT, exist_ok=True)
glb = os.path.join(OUT, 'villain_%s.glb' % NAME)
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', export_apply=True, export_animations=False,
    export_cameras=False, export_lights=False, export_yup=True, export_tangents=False,
    export_draco_mesh_compression_enable=False, export_materials='EXPORT', export_extras=False,
    export_morph=False, export_skins=False)
print('GLB', glb, os.path.getsize(glb))
bd = os.path.join(OUT, 'blend')
os.makedirs(bd, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(bd, 'villain_%s.blend' % NAME), compress=True)
