"""Combine the six built pieces into pieces.glb (+ pieces.blend).

usage: blender -b -P assemble_pieces.py -- <build_dir> <out_dir>

Facing: pieces are modelled facing -Y and turned 180 deg about Z here, so the
exported glTF front is -Z (three.js forward).  In Blender the final pieces face +Y.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Matrix
from wc_lib import reset, link, export_glb, tris

argv = sys.argv[sys.argv.index('--') + 1:]
BUILD, OUT = argv[0], argv[1]
AO_SIZE = 512
JPEG_Q = int(argv[2]) if len(argv) > 2 else 90
ORDER = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king']

reset()
for t in ORDER:
    path = os.path.join(BUILD, t + '.blend')
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n == t or n.startswith(t + '_')]
    for ob in dst.objects:
        link(ob)

# one shared 'stone' / 'glow' material
for m in list(bpy.data.materials):
    base = m.name.split('.')[0]
    if base != m.name and base in bpy.data.materials:
        m.user_remap(bpy.data.materials[base])
        bpy.data.materials.remove(m)

# turn every piece 180 deg about Z (bake into mesh data; transforms stay identity)
R = Matrix.Rotation(math.pi, 4, 'Z')
for ob in bpy.context.scene.objects:
    if ob.type == 'MESH':
        ob.data.transform(R)
        ob.data.update()
        ob.location = R @ ob.location
    ob.rotation_euler = (0, 0, 0)
    ob.scale = (1, 1, 1)

# downsize AO maps
for img in bpy.data.images:
    if img.name.endswith('_ao') and img.size[0] > AO_SIZE:
        img.scale(AO_SIZE, AO_SIZE)
        img.pack()

os.makedirs(OUT, exist_ok=True)
glb = os.path.join(OUT, 'pieces.glb')
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', export_apply=True, export_animations=False,
    export_cameras=False, export_lights=False, export_yup=True, export_tangents=True,
    export_draco_mesh_compression_enable=False, export_image_format='JPEG',
    export_jpeg_quality=JPEG_Q, export_materials='EXPORT', export_extras=False,
    export_morph=False, export_skins=False)
print('GLB', glb, os.path.getsize(glb))
for ob in sorted(bpy.context.scene.objects, key=lambda o: o.name):
    if ob.type == 'MESH':
        print('MESH', ob.name, tris(ob), ob.data.materials[0].name, tuple(round(v, 4) for v in ob.location))
bd = os.path.join(OUT, 'blend')
os.makedirs(bd, exist_ok=True)
for img in bpy.data.images:
    if not img.packed_file:
        img.pack()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(bd, 'pieces.blend'), compress=True)
