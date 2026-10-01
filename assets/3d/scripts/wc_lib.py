"""Shared helpers for the Wizard's Chess Blender asset scripts.

Everything is built procedurally with bmesh, sculpted with voxel remesh +
boolean chips + displacement, then decimated to a game-ready low-poly that gets
normal/AO maps baked from the high-poly.

Conventions: 1 BU = 1 board square, Z up, pieces face -Y (figure's right = -X).
"""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Euler

TAU = math.pi * 2


# --------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def obj_from_bm(name, bm, coll=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    return link(ob, coll)


def M(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    if not isinstance(scale, (tuple, list, Vector)):
        scale = (scale, scale, scale)
    return Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale))


def xform(ob, mat):
    ob.data.transform(mat)
    ob.data.update()
    return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def delete(obs):
    for ob in obs:
        me = ob.data if ob.type == 'MESH' else None
        bpy.data.objects.remove(ob, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)


def collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c


# --------------------------------------------------------------------------- primitives
def ellipsoid(name, loc, radii, rot=(0, 0, 0), seg=32, rings=16, coll=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, M(loc, rot, radii))


def box(name, loc, size, rot=(0, 0, 0), bevel=0.0, bevel_segs=2, coll=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel,
                        segments=bevel_segs, profile=0.5, affect='EDGES')
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, M(loc, rot))


def cyl(name, loc, r1, r2, depth, rot=(0, 0, 0), seg=32, coll=None):
    """Cone/cylinder along local Z, centred on loc."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r2, depth=depth)
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, M(loc, rot))


def seg_cyl(name, a, b, r1, r2=None, seg=24, coll=None):
    """Cylinder/cone from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r1 if r2 is None else r2, depth=d.length)
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4())


def torus(name, loc, R, r, rot=(0, 0, 0), seg=48, rseg=12, scale=(1, 1, 1), coll=None):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = TAU * i / seg
        c, s = math.cos(a), math.sin(a)
        ring = []
        for j in range(rseg):
            b = TAU * j / rseg
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * c, rr * s, r * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        r0, r1 = rings[i], rings[(i + 1) % seg]
        for j in range(rseg):
            bm.faces.new((r0[j], r1[j], r1[(j + 1) % rseg], r0[(j + 1) % rseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, M(loc, rot, scale))


def lathe(name, profile, seg=64, mod=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1),
          arc=None, coll=None):
    """Revolve a (r, z) profile about Z.  mod(theta, z, r) -> r lets you add folds.
    arc=(a0, a1) makes an open partial revolve (use solidify for thickness)."""
    bm = bmesh.new()
    closed = arc is None
    a0, a1 = (0, TAU) if closed else arc
    n = seg if closed else seg + 1
    rows = []
    for (r, z) in profile:
        if r < 1e-6 and closed:
            rows.append([bm.verts.new((0, 0, z))])
            continue
        row = []
        for i in range(n):
            t = a0 + (a1 - a0) * i / seg
            rr = mod(t, z, r) if mod else r
            row.append(bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)))
        rows.append(row)
    for k in range(len(rows) - 1):
        A, B = rows[k], rows[k + 1]
        rng = range(seg) if closed else range(n - 1)
        for i in rng:
            j = (i + 1) % n
            if len(A) == 1 and len(B) == 1:
                continue
            if len(A) == 1:
                bm.faces.new((A[0], B[i], B[j]))
            elif len(B) == 1:
                bm.faces.new((A[i], A[j], B[0]))
            else:
                bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = obj_from_bm(name, bm, coll)
    return xform(ob, M(loc, rot, scale))


def tube(name, pts, radii, seg=16, ref=(1, 0, 0), cap=True, twist=0.0, coll=None):
    """Sweep an ellipse along a polyline.  radii[i] is r or (r_ref, r_other)."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    T = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
        T.append(t.normalized())
    ref = Vector(ref)
    N = ref - ref.dot(T[0]) * T[0]
    if N.length < 1e-4:
        N = Vector((0, 1, 0)) - T[0].y * T[0]
    N.normalize()
    bm = bmesh.new()
    rings = []
    for i in range(n):
        N = (N - N.dot(T[i]) * T[i]).normalized()
        B = T[i].cross(N)
        r = radii[i]
        rx, ry = (r, r) if not isinstance(r, (tuple, list)) else r
        rx, ry = max(rx, 1e-4), max(ry, 1e-4)
        tw = twist * i / max(1, n - 1)
        ring = []
        for k in range(seg):
            a = TAU * k / seg + tw
            ring.append(bm.verts.new(pts[i] + N * math.cos(a) * rx + B * math.sin(a) * ry))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg],
                          rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, coll)


def bez(p0, p1, p2, p3, n):
    p0, p1, p2, p3 = map(Vector, (p0, p1, p2, p3))
    out = []
    for i in range(n):
        t = i / (n - 1)
        u = 1 - t
        out.append(u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3)
    return out


def ring_pts(center, u, v, ru, rv, n=32, extra=2):
    c, u, v = Vector(center), Vector(u).normalized(), Vector(v).normalized()
    return [c + u * math.cos(TAU * i / n) * ru + v * math.sin(TAU * i / n) * rv for i in range(n + extra)]


def radial_box(name, angle, r, z, depth, width, height, tilt=0.0, coll=None):
    """Box whose depth axis points radially out from Z at `angle` (front = -90 deg)."""
    ob = box(name, (0, 0, 0), (depth, width, height), coll=coll)
    return xform(ob, Matrix.Translation((r * math.cos(angle), r * math.sin(angle), z)) @
                 Matrix.Rotation(angle, 4, 'Z') @ Matrix.Rotation(tilt, 4, 'X'))


def lerp(a, b, t):
    return a + (b - a) * t


def taper(n, r0, r1, power=1.0):
    return [lerp(r0, r1, (i / (n - 1)) ** power) for i in range(n)]


# --------------------------------------------------------------------------- modifiers
def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bm = bmesh.new()
    for o in objs:
        tmp = o.data.copy()
        tmp.transform(o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    delete(objs)
    return obj_from_bm(name, bm)


def remesh(ob, voxel):
    m = ob.modifiers.new('rm', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    m.adaptivity = 0.0
    return apply_mods(ob)


def solidify(ob, thick, offset=0.0):
    m = ob.modifiers.new('sd', 'SOLIDIFY')
    m.thickness = thick
    m.offset = offset
    m.use_even_offset = True
    return apply_mods(ob)


def boolean(ob, cutters, op='DIFFERENCE'):
    if not cutters:
        return ob
    c = collection('_cut_' + ob.name)
    for o in cutters:
        for uc in list(o.users_collection):
            uc.objects.unlink(o)
        c.objects.link(o)
    m = ob.modifiers.new('bo', 'BOOLEAN')
    m.operation = op
    m.operand_type = 'COLLECTION'
    m.collection = c
    m.solver = 'EXACT'
    m.use_self = False
    m.use_hole_tolerant = True
    apply_mods(ob)
    delete(list(c.objects))
    bpy.data.collections.remove(c)
    return ob


def displace(ob, kind, size, strength, seed=0, depth=2):
    tex = bpy.data.textures.new('tx_%s_%d' % (kind, seed), kind)
    if kind == 'CLOUDS':
        tex.noise_scale = size
        tex.noise_depth = depth
        tex.noise_basis = 'ORIGINAL_PERLIN'
    elif kind == 'VORONOI':
        tex.noise_scale = size
        tex.distance_metric = 'DISTANCE'
        tex.color_mode = 'INTENSITY'
    elif kind == 'MUSGRAVE':
        tex.noise_scale = size
    e = bpy.data.objects.new('tx_off', None)
    link(e)
    rnd = random.Random(seed)
    e.location = (rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50))
    m = ob.modifiers.new('dp', 'DISPLACE')
    m.texture = tex
    m.texture_coords = 'OBJECT'
    m.texture_coords_object = e
    m.strength = strength
    m.mid_level = 0.5
    apply_mods(ob)
    bpy.data.objects.remove(e)
    return ob


def smooth(ob, factor=0.5, iters=2):
    m = ob.modifiers.new('sm', 'SMOOTH')
    m.factor = factor
    m.iterations = iters
    return apply_mods(ob)


def decimate(ob, target):
    for _ in range(3):
        cur = tris(ob)
        if cur <= target * 1.03:
            break
        m = ob.modifiers.new('dc', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = target / cur
        m.use_collapse_triangulate = True
        apply_mods(ob)
    return ob


def triangulate(ob):
    m = ob.modifiers.new('tr', 'TRIANGULATE')
    return apply_mods(ob)


def shade(ob, weighted=True, bevel=0.0, bevel_segs=2, angle=None):
    if bevel > 0:
        m = ob.modifiers.new('bv', 'BEVEL')
        m.width = bevel
        m.segments = bevel_segs
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(40)
        m.harden_normals = False
        apply_mods(ob)
    ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))
    if weighted:
        m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
        m.mode = 'FACE_AREA'
        m.weight = 50
        m.keep_sharp = True
        m.thresh = 0.01
        apply_mods(ob)
    return ob


def uv_unwrap(ob, margin=0.004, angle=66):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin,
                             area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.data.uv_layers[0].name = 'UVMap'
    return ob


# --------------------------------------------------------------------------- sculpting
def chip_cutters(ob, n, size, seed, ok=None, frac=0.04):
    """Random cube 'chips' on convex edges of a (remeshed) mesh."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    cand = []
    for v in bm.verts:
        if not v.link_edges:
            continue
        if ok and not ok(v.co):
            continue
        c = 0.0
        for e in v.link_edges:
            c += v.normal.dot(v.co - e.other_vert(v).co)
        cand.append((c / len(v.link_edges), v.co.copy(), v.normal.copy()))
    bm.free()
    cand.sort(key=lambda t: -t[0])
    cand = cand[:max(n * 4, int(len(cand) * frac))]
    rnd.shuffle(cand)
    picked = []
    for c, co, no in cand:
        if len(picked) >= n:
            break
        if any((co - p).length < size * 2.2 for p, _ in picked):
            continue
        picked.append((co, no))
    cutters = []
    for i, (co, no) in enumerate(picked):
        s = size * rnd.uniform(0.6, 1.4)
        cutters.append(box('chip%d' % i, co + no * s * rnd.uniform(0.15, 0.35),
                           (s * rnd.uniform(0.7, 1.3), s * rnd.uniform(0.7, 1.3), s * rnd.uniform(0.5, 1.0)),
                           rot=(rnd.uniform(0, TAU), rnd.uniform(0, TAU), rnd.uniform(0, TAU))))
    return cutters


def sculpt(name, adds, cuts, voxel, chips=0, chip_size=0.02, chip_ok=None, seed=1,
           wear=1.0, H=1.0, final_cuts=None, post_adds=None):
    """adds/cuts: lists of mesh objects.  Returns the high-poly object."""
    hi = join(adds, name + '_hi')
    hi = remesh(hi, voxel * 1.6)
    cc = list(cuts)
    if chips:
        cc += chip_cutters(hi, chips, chip_size, seed, chip_ok)
    hi = boolean(hi, cc)
    if post_adds:
        hi = join([hi] + list(post_adds), name + '_hi')
    hi = remesh(hi, voxel)
    # broad weathering + fine grain + pitting
    displace(hi, 'CLOUDS', 0.09 * H, 0.0035 * wear * H, seed=seed, depth=3)
    displace(hi, 'CLOUDS', 0.012 * H, 0.0011 * wear * H, seed=seed + 7, depth=2)
    displace(hi, 'VORONOI', 0.02 * H, 0.0016 * wear * H, seed=seed + 13)
    if final_cuts:
        hi = boolean(hi, final_cuts)
    return hi


def make_low(hi, name, target):
    lo = bpy.data.objects.new(name, hi.data.copy())
    link(lo)
    lo.data.name = name
    decimate(lo, target)
    shade(lo)
    uv_unwrap(lo)
    return lo


# --------------------------------------------------------------------------- materials
def gltf_output_group():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g:
        return g
    g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    g.nodes.new('NodeGroupInput')
    return g


def mat_stone(name='stone', normal_img=None, ao_img=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (0.5, 0.5, 0.5, 1)
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    if normal_img:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = normal_img
        t.name = 'normal_tex'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.uv_map = 'UVMap'
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])
    if ao_img:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = ao_img
        t.name = 'ao_tex'
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], sep.inputs[0])
        g = nt.nodes.new('ShaderNodeGroup')
        g.node_tree = gltf_output_group()
        nt.links.new(sep.outputs[0], g.inputs['Occlusion'])
    return m


def mat_emit(name, color=(1.0, 0.35, 0.08), strength=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    b.inputs['Roughness'].default_value = 0.4
    nt.links.new(b.outputs[0], out.inputs[0])
    return m


def set_mat(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


# --------------------------------------------------------------------------- baking
def setup_cycles(samples=32):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception:
        sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')


def bake(lo, hi, label, size, outdir, extrusion, ray, ao_dist, ao_samples=96):
    """Bake tangent normal (hi->lo) and AO into images; returns (normal_img, ao_img)."""
    setup_cycles(ao_samples)
    sc = bpy.context.scene
    sc.world.light_settings.distance = ao_dist
    nimg = bpy.data.images.new(label + '_normal', size, size, alpha=False)
    nimg.colorspace_settings.name = 'Non-Color'
    aimg = bpy.data.images.new(label + '_ao', size, size, alpha=False)
    aimg.colorspace_settings.name = 'Non-Color'
    tmp = bpy.data.materials.new('bake_tmp')
    tmp.use_nodes = True
    nt = tmp.node_tree
    tn = nt.nodes.new('ShaderNodeTexImage')
    set_mat(lo, tmp)
    if not hi.data.materials:
        set_mat(hi, mat_stone('bake_hi'))
    # keep the low-poly out of the high-poly's AO rays
    for attr in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_shadow',
                 'visible_volume_scatter'):
        setattr(lo, attr, False)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bk = sc.render.bake
    bk.margin = 8
    bk.margin_type = 'EXTEND'
    bk.use_selected_to_active = True
    bk.cage_extrusion = extrusion
    bk.max_ray_distance = ray
    for img, kind in ((nimg, 'NORMAL'), (aimg, 'AO')):
        tn.image = img
        nt.nodes.active = tn
        if kind == 'NORMAL':
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                                cage_extrusion=extrusion, max_ray_distance=ray, margin=8)
        else:
            bpy.ops.object.bake(type='AO', use_selected_to_active=True,
                                cage_extrusion=extrusion, max_ray_distance=ray, margin=8)
        path = os.path.join(outdir, img.name + '.png')
        img.filepath_raw = path
        img.file_format = 'PNG'
        img.save()
    for attr in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_shadow',
                 'visible_volume_scatter'):
        setattr(lo, attr, True)
    bpy.data.materials.remove(tmp)
    return nimg, aimg


# --------------------------------------------------------------------------- export
def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_apply=True, export_animations=False,
        export_cameras=False, export_lights=False, export_yup=True, export_tangents=True,
        export_draco_mesh_compression_enable=False, export_image_format='AUTO',
        export_materials='EXPORT', export_extras=False, export_morph=False, export_skins=False)
