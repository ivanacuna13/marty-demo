"""Render a 1024px EEVEE preview with three-point lighting.

usage: blender -b -P preview.py -- <file.glb|file.blend> <out.png> [view]
Pieces files (several top-level empties) are laid out in a row.
view: 'front3q' (default), 'front', 'side'
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
from wc_lib import reset, link

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
VIEW = argv[2] if len(argv) > 2 else 'front3q'

if SRC.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=SRC)
else:
    reset()
    bpy.ops.import_scene.gltf(filepath=SRC)
sc = bpy.context.scene

ORDER = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king']
roots = [o for o in sc.objects if o.parent is None and o.type == 'EMPTY']
piece_roots = [o for o in roots if o.name.split('.')[0] in ORDER]
if len(piece_roots) > 1:
    piece_roots.sort(key=lambda o: ORDER.index(o.name.split('.')[0]))
    x = 0.0
    for o in piece_roots:
        o.location.x = -x if SRC.endswith('.glb') else x
        x += 0.95

# preview look: light marble tone with the AO map multiplied in, glowing eyes
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    if m.name.startswith('glow') or m.name.startswith('emissive'):
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.25, 0.05, 1) if m.name.startswith('glow') \
            else (1.0, 0.45, 0.08, 1)
        bsdf.inputs['Emission Strength'].default_value = 12.0
        continue
    bsdf.inputs['Base Color'].default_value = (0.50, 0.49, 0.47, 1)
    ao = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and
               ('ao' in n.image.name.lower() or 'occlusion' in n.image.name.lower())), None)
    if ao is None:
        # glTF import puts occlusion in a separate group/texture; find any non-normal image
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image and not any(
                    l.to_node.type == 'NORMAL_MAP' for l in n.outputs['Color'].links):
                ao = n
    if ao is not None:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[6].default_value = (0.50, 0.49, 0.47, 1)
        nt.links.new(ao.outputs['Color'], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])

# frame
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in sc.objects:
    if o.type == 'MESH':
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2
size = hi - lo

W, Hh = (1024, 640) if len(piece_roots) > 1 else (1024, 1024)
sc.render.resolution_x, sc.render.resolution_y = W, Hh
sc.render.resolution_percentage = 100
sc.render.engine = 'BLENDER_EEVEE'
try:
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_shadows = True
    sc.eevee.use_raytracing = True
except Exception:
    pass
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = -0.8

dirs = {'front3q': Vector((0.55, -1.0, 0.32)), 'front': Vector((0, -1, 0.12)),
        'side': Vector((1, 0, 0.12)), 'back': Vector((0, 1, 0.2))}
d = dirs.get(VIEW, dirs['front3q']).normalized()
if SRC.endswith('.glb'):  # delivered files face -Z in glTF == +Y in Blender
    d = Vector((-d.x, -d.y, d.z))
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 70
cam = bpy.data.objects.new('cam', cam_data)
link(cam)
sc.camera = cam
aspect = W / Hh
fov_v = 2 * math.atan(cam_data.sensor_width / 2 / cam_data.lens / max(aspect, 1) * (1 if aspect >= 1 else 1))
fov_h = 2 * math.atan(math.tan(fov_v / 2) * aspect)
need_h = (abs(size.x * abs(d.y)) + abs(size.y * abs(d.x))) * 0.5 + 0.1
need_v = size.z * 0.5 + 0.08
dist = max(need_h / math.tan(fov_h / 2), need_v / math.tan(fov_v / 2)) * 1.08 + max(size.x, size.y) * 0.5
cam.location = ctr + d * dist
cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()


def area(name, loc, energy, color, sz):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy = energy
    l.color = color
    l.size = sz
    o = bpy.data.objects.new(name, l)
    link(o)
    o.location = loc
    o.rotation_euler = (ctr - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


s = max(size.x, size.z)
area('key', ctr + Vector((-1.6, -2.0, 1.8)) * s, 220 * s * s, (1.0, 0.93, 0.85), 1.2 * s)
area('fill', ctr + Vector((2.0, -1.6, 0.6)) * s, 60 * s * s, (0.80, 0.88, 1.0), 1.6 * s)
area('rim', ctr + Vector((0.6, 2.2, 1.6)) * s, 320 * s * s, (0.9, 0.95, 1.0), 0.8 * s)

w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
bg = w.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.035, 0.037, 0.045, 1)
bg.inputs[1].default_value = 1.0

# ground
bpy.ops.mesh.primitive_plane_add(size=60, location=(ctr.x, ctr.y, 0))
g = bpy.context.active_object
gm = bpy.data.materials.new('ground')
gm.use_nodes = True
gb = gm.node_tree.nodes['Principled BSDF']
gb.inputs['Base Color'].default_value = (0.05, 0.05, 0.055, 1)
gb.inputs['Roughness'].default_value = 0.5
g.data.materials.append(gm)

sc.render.filepath = OUT
sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('WROTE', OUT)
