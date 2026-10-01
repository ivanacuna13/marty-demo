"""Re-import a delivered GLB into a fresh scene and assert the game contract.

usage: blender -b -P validate.py -- <file.glb> [more.glb ...]
Exit code 1 if any check fails.  Prints a JSON summary per file (used by README).
"""
import sys, os, json, struct, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from wc_lib import reset, tris

FILES = sys.argv[sys.argv.index('--') + 1:]
SIZES = {'pawn': (1.06, 0.34), 'rook': (1.45, 0.37), 'knight': (1.50, 0.36),
         'bishop': (1.70, 0.35), 'queen': (1.90, 0.37), 'king': (2.10, 0.38)}
WEAPONS = {'pawn', 'bishop', 'king'}
TOL = 0.05
fails = []
summary = {}


def check(ok, msg):
    print(('  PASS ' if ok else '  FAIL ') + msg)
    if not ok:
        fails.append(msg)


def gltf_json(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, ver, length = struct.unpack_from('<4sII', data, 0)
    clen, ctype = struct.unpack_from('<I4s', data, 12)
    return json.loads(data[20:20 + clen])


def world_verts(ob):
    mw = ob.matrix_world
    return [mw @ v.co for v in ob.data.vertices]


def identity(ob):
    return all(abs(a) < 1e-5 for a in ob.rotation_euler) and all(abs(s - 1) < 1e-5 for s in ob.scale)


def common_file_checks(path, j, limit_mb):
    size = os.path.getsize(path)
    check(size < limit_mb * 1024 * 1024, '%s size %.2f MB < %d MB' % (os.path.basename(path), size / 1048576, limit_mb))
    check(not j.get('animations'), 'no animations')
    check(not j.get('cameras'), 'no cameras')
    check('KHR_lights_punctual' not in j.get('extensionsUsed', []), 'no lights')
    check('KHR_draco_mesh_compression' not in j.get('extensionsUsed', []), 'no Draco')
    return size


def accessor_bounds(j, node_name):
    for n in j['nodes']:
        if n.get('name') == node_name and 'mesh' in n:
            mn = [1e9] * 3
            mx = [-1e9] * 3
            for p in j['meshes'][n['mesh']]['primitives']:
                a = j['accessors'][p['attributes']['POSITION']]
                mn = [min(x, y) for x, y in zip(mn, a['min'])]
                mx = [max(x, y) for x, y in zip(mx, a['max'])]
            t = n.get('translation', [0, 0, 0])
            return [m + o for m, o in zip(mn, t)], [m + o for m, o in zip(mx, t)]
    return None


def validate_pieces(path):
    j = gltf_json(path)
    size = common_file_checks(path, j, 8)
    reset()
    bpy.ops.import_scene.gltf(filepath=path)
    info = {'file': os.path.basename(path), 'bytes': size, 'pieces': {}}
    imgs = {im.name for im in bpy.data.images}
    for t, (H, R) in SIZES.items():
        print('[%s]' % t)
        root = bpy.data.objects.get(t)
        check(root is not None and root.type == 'EMPTY' and root.parent is None, 'top-level empty "%s"' % t)
        if root is None:
            continue
        check(root.location.length < 1e-5 and identity(root), '%s empty at origin, identity transform' % t)
        kids = {c.name: c for c in root.children}
        need = {t + '_body', t + '_eyes'} | ({t + '_weapon'} if t in WEAPONS else set())
        check(set(kids) == need, '%s children %s' % (t, sorted(kids)))
        body, eyes = kids.get(t + '_body'), kids.get(t + '_eyes')
        if not body or not eyes:
            continue
        vs = world_verts(body) + world_verts(eyes)
        zmin, zmax = min(v.z for v in vs), max(v.z for v in vs)
        base = [v for v in world_verts(body) if v.z < 0.02]
        rad = max(math.hypot(v.x, v.y) for v in base)
        cx = (max(v.x for v in base) + min(v.x for v in base)) / 2
        cy = (max(v.y for v in base) + min(v.y for v in base)) / 2
        check(abs(zmin) < 0.005, '%s plinth bottom at z=0 (%.4f)' % (t, zmin))
        check(abs(zmax - H) / H <= TOL, '%s height %.3f vs %.2f' % (t, zmax - zmin, H))
        check(abs(rad - R) / R <= TOL, '%s plinth radius %.3f vs %.2f' % (t, rad, R))
        check(abs(cx) < 0.01 and abs(cy) < 0.01, '%s centred (%.4f, %.4f)' % (t, cx, cy))
        mats = {}
        tri = {}
        for name, ob in kids.items():
            check(identity(ob), '%s no rotation/scale' % name)
            check(len(ob.data.uv_layers) > 0, '%s has UVs' % name)
            check(len(ob.data.materials) == 1, '%s single material' % name)
            mats[name] = ob.data.materials[0].name if ob.data.materials else None
            tri[name] = tris(ob)
        check(mats[t + '_eyes'] == 'glow', '%s eyes material glow (%s)' % (t, mats[t + '_eyes']))
        check(mats[t + '_body'] in ('stone', 'stone_' + t), '%s body material %s' % (t, mats[t + '_body']))
        if t in WEAPONS:
            w = kids[t + '_weapon']
            check(mats[t + '_weapon'].startswith('stone'), '%s weapon material %s' % (t, mats[t + '_weapon']))
            bb = [min(v.z for v in world_verts(body)), max(v.z for v in world_verts(body))]
            check(w.location.length > 0.05 and bb[0] < w.location.z < bb[1],
                  '%s weapon pivot at grip %s' % (t, tuple(round(c, 3) for c in w.location)))
        total = sum(tri.values())
        check(8000 <= total <= 15000, '%s triangles %d in 8k-15k' % (t, total))
        # front is +Y in Blender (== -Z in glTF): the eyes must sit on the +Y side
        ey = sum(v.y for v in world_verts(eyes)) / len(eyes.data.vertices)
        check(ey > 0.0, '%s eyes on the front (+Y in Blender / -Z glTF), mean y %.3f' % (t, ey))
        maps = sorted(i for i in imgs if i.startswith(t + '_') or ('stone_' + t) in i)
        info['pieces'][t] = {'nodes': sorted(kids), 'tris': tri, 'total_tris': total,
                             'height': round(zmax - zmin, 4), 'plinth_radius': round(rad, 4),
                             'materials': mats}
    # knight nose: the forward-most point above the plinth is on the head
    kb = bpy.data.objects.get('knight_body')
    if kb:
        vs = [v for v in world_verts(kb) if v.z > 0.2]
        front = max(vs, key=lambda v: v.y)
        check(front.z > 0.55 * 1.5 and front.y > 0.36,
              'knight nose points forward: front-most point y=%.3f z=%.3f' % (front.y, front.z))
    b = accessor_bounds(j, 'knight_body')
    if b:
        mn, mx = b
        check(-mn[2] > mx[2] + 0.03, 'glTF: knight extends further toward -Z (%.3f) than +Z (%.3f)' % (mn[2], mx[2]))
        check(abs(mn[1]) < 0.005 and abs(mx[1] - 1.5) / 1.5 <= TOL, 'glTF: knight y range %.3f..%.3f (Y up)' % (mn[1], mx[1]))
    info['images'] = [{'name': im.get('name'), 'mimeType': im.get('mimeType')} for im in j.get('images', [])]
    info['materials'] = [m.get('name') for m in j.get('materials', [])]
    return info


VILLAIN_NODES = ['throne', 'body', 'head', 'jaw', 'arm_L', 'arm_R', 'fore_L', 'fore_R'] + \
                ['finger_%s_%d' % (s, i) for s in 'LR' for i in range(4)]
PARENT = {'jaw': 'head', 'fore_L': 'arm_L', 'fore_R': 'arm_R'}
PARENT.update({'finger_%s_%d' % (s, i): 'fore_' + s for s in 'LR' for i in range(4)})


def descendants(ob):
    out = []
    for c in ob.children:
        out.append(c)
        out += descendants(c)
    return out


def validate_villain(path):
    j = gltf_json(path)
    size = common_file_checks(path, j, 6)
    reset()
    bpy.ops.import_scene.gltf(filepath=path)
    name = os.path.basename(path)
    info = {'file': name, 'bytes': size}
    for n in VILLAIN_NODES:
        check(n in bpy.data.objects, '%s node %s' % (name, n))
    for c, p in PARENT.items():
        ob = bpy.data.objects.get(c)
        anc = []
        x = ob.parent if ob else None
        while x:
            anc.append(x.name)
            x = x.parent
        check(ob is not None and p in anc, '%s %s inside %s' % (name, c, p))
    for n in ('head', 'arm_L', 'arm_R', 'body'):
        ob = bpy.data.objects.get(n)
        check(ob is not None and ob.type == 'EMPTY', '%s %s is a pivot empty' % (name, n))
    # arm_L is on the figure's left: front = +Y in Blender, so left = -X
    aL, aR = bpy.data.objects.get('arm_L'), bpy.data.objects.get('arm_R')
    if aL and aR:
        check(aL.matrix_world.translation.x < 0 < aR.matrix_world.translation.x,
              '%s arm_L on figure left (x=%.2f), arm_R on right (x=%.2f)' %
              (name, aL.matrix_world.translation.x, aR.matrix_world.translation.x))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    th = bpy.data.objects.get('throne')
    if th:
        tv = world_verts(th) if th.type == 'MESH' else sum((world_verts(o) for o in descendants(th) if o.type == 'MESH'), [])
        check(abs(min(v.z for v in tv)) < 0.01, '%s throne base at z=0' % name)
    head = bpy.data.objects.get('head')
    if head:
        hv = sum((world_verts(o) for o in descendants(head) if o.type == 'MESH'), [])
        top = max(v.z for v in hv)
        check(abs(top - 6.5) / 6.5 <= TOL, '%s head top %.3f vs 6.5' % (name, top))
        eyes = [o for o in descendants(head) if o.type == 'MESH' and o.data.materials and o.data.materials[0].name == 'glow']
        check(len(eyes) > 0, '%s glow eye meshes under head' % name)
        if eyes:
            ey = sum(sum(v.y for v in world_verts(o)) / len(o.data.vertices) for o in eyes) / len(eyes)
            check(ey > head.matrix_world.translation.y, '%s faces front (+Y Blender / -Z glTF)' % name)
    total = sum(tris(o) for o in meshes)
    check(35000 <= total <= 65000, '%s triangles %d (~40-60k)' % (name, total))
    check(all(len(o.data.uv_layers) for o in meshes), '%s all meshes have UVs' % name)
    mats = sorted({o.data.materials[0].name for o in meshes if o.data.materials})
    check('glow' in mats, '%s uses glow' % name)
    info.update(total_tris=total, nodes=sorted(o.name for o in bpy.context.scene.objects if o.type == 'EMPTY'),
                meshes={o.name: tris(o) for o in sorted(meshes, key=lambda o: o.name)}, materials=mats,
                images=[{'name': im.get('name'), 'mimeType': im.get('mimeType')} for im in j.get('images', [])])
    return info


for f in FILES:
    print('==', f)
    summary[os.path.basename(f)] = validate_pieces(f) if os.path.basename(f) == 'pieces.glb' else validate_villain(f)

out = os.path.join(os.path.dirname(os.path.abspath(FILES[0])), 'validation.json')
old = {}
if os.path.exists(out):
    try:
        old = json.load(open(out))
    except Exception:
        old = {}
old.update(summary)
json.dump(old, open(out, 'w'), indent=1)
print('FAILS', len(fails))
for m in fails:
    print('  -', m)
sys.exit(1 if fails else 0)
