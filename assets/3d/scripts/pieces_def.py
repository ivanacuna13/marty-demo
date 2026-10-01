"""Shape definitions for the six Wizard's Chess pieces.

Each build_<type>(H, R) returns a dict:
  adds    - mesh objects unioned (via voxel remesh) into the stone body
  cuts    - mesh objects carved out (slits, sockets, grooves)
  eyes    - mesh objects for the glowing eyes / visor light
  weapon  - mesh objects for the swingable weapon (optional)
  grip    - pivot point of the weapon (in the hand)
  chip_ok - predicate(co) -> bool, where random edge chips are allowed
Front is -Y, the figure's right hand is -X, left hand +X.
"""
import math
from mathutils import Vector, Matrix, Euler
from wc_lib import *

rad = math.radians


def plinth(R, h, adds, cuts, facets=0):
    prof = [(0, 0), (R, 0), (R, 0.20 * h), (R - 0.006, 0.27 * h), (R - 0.02, 0.34 * h),
            (R - 0.02, 0.60 * h), (R - 0.010, 0.68 * h), (R - 0.010, 0.78 * h),
            (R - 0.028, 0.88 * h), (R - 0.036, 1.0 * h), (0, 1.0 * h)]
    mod = None
    if facets:
        mod = lambda t, z, r: r * (math.cos(math.pi / facets) /
                                   math.cos(((t + math.pi / facets) % (TAU / facets)) - math.pi / facets)) ** 0.25
    adds.append(lathe('plinth', prof, seg=128, mod=mod))
    cuts.append(torus('plinth_groove', (0, 0, 0.47 * h), R - 0.02, 0.0055, seg=128, rseg=10))


def shield_round(center, normal_rot, radius, adds, emblem='cross'):
    """Round shield built in local frame (face = +Z), placed by rotation euler."""
    Mx = Matrix.Translation(center) @ Euler(normal_rot).to_matrix().to_4x4()
    r = radius
    prof = [(0, -0.012), (r * 0.97, -0.012), (r, 0.004), (r * 0.99, 0.020), (r * 0.92, 0.022),
            (r * 0.86, 0.014), (r * 0.36, 0.024), (r * 0.30, 0.030), (r * 0.22, 0.048),
            (r * 0.10, 0.058), (0, 0.060)]
    parts = [lathe('shield', prof, seg=64)]
    if emblem == 'cross':
        parts.append(box('sh_c1', (0, 0, 0.022), (r * 1.5, 0.026, 0.016), bevel=0.004))
        parts.append(box('sh_c2', (0, 0, 0.022), (0.026, r * 1.5, 0.016), bevel=0.004))
    for i in range(14):
        a = TAU * i / 14
        parts.append(ellipsoid('rivet', (math.cos(a) * r * 0.93, math.sin(a) * r * 0.93, 0.022),
                               (0.0075, 0.0075, 0.006), seg=10, rings=6))
    for p in parts:
        xform(p, Mx)
    adds += parts
    return Mx


def blade_parts(length, width, thick, guard_w, pommel_r, grip_len, prefix='w', fuller=True):
    """Sword in local frame: grip centred at origin, blade along +Z."""
    parts = []
    g0 = -grip_len / 2
    parts.append(ellipsoid(prefix + 'pommel', (0, 0, g0 - pommel_r * 0.8),
                           (pommel_r, pommel_r * 0.8, pommel_r), seg=16, rings=10))
    parts.append(tube(prefix + 'grip', [(0, 0, g0 - 0.004), (0, 0, 0), (0, 0, -g0 + 0.004)],
                      [width * 0.26, width * 0.30, width * 0.26], seg=12))
    gz = -g0 + 0.012
    parts.append(tube(prefix + 'guard', [(-guard_w / 2, 0, gz + 0.012), (-guard_w / 4, 0, gz),
                                          (0, 0, gz - 0.002), (guard_w / 4, 0, gz), (guard_w / 2, 0, gz + 0.012)],
                      [(0.010, 0.012), (0.012, 0.014), (0.016, 0.016), (0.012, 0.014), (0.010, 0.012)],
                      seg=10, ref=(0, 1, 0)))
    for s in (-1, 1):
        parts.append(ellipsoid(prefix + 'gend', (s * guard_w / 2, 0, gz + 0.014), (0.016, 0.016, 0.016),
                               seg=12, rings=8))
    b0 = gz + 0.01
    pts = [(0, 0, b0), (0, 0, b0 + length * 0.55), (0, 0, b0 + length * 0.85), (0, 0, b0 + length)]
    parts.append(tube(prefix + 'blade', pts,
                      [(width / 2, thick / 2), (width * 0.46, thick * 0.45), (width * 0.33, thick * 0.42),
                       (0.002, 0.002)], seg=8, ref=(1, 0, 0)))
    return parts


def visor_eyes(cx, y, z, sep, size, eyes, prefix='eye'):
    for s in (-1, 1):
        eyes.append(ellipsoid(prefix, (cx + s * sep, y, z), size, seg=14, rings=8))


# ===================================================================================== PAWN
def armored_leg(x, z0, top, adds, foot_y=-0.045):
    prof = [(0, 0), (0.050, 0), (0.052, 0.03), (0.044, 0.05), (0.042, 0.075), (0.046, 0.12),
            (0.048, 0.15), (0.044, 0.158), (0.056, 0.168), (0.058, 0.19), (0.05, 0.205),
            (0.052, 0.22), (0.058, top), (0, top)]
    adds.append(lathe('leg', [(r, z0 + z) for r, z in prof], seg=40, loc=(x, 0, 0)))
    adds.append(box('sabaton', (x, foot_y - 0.02, z0 + 0.025), (0.085, 0.10, 0.05), bevel=0.018, bevel_segs=3))
    adds.append(ellipsoid('toe', (x, foot_y - 0.07, z0 + 0.022), (0.04, 0.035, 0.022)))
    adds.append(ellipsoid('kneewing', (x + (0.03 if x > 0 else -0.03), -0.03, z0 + 0.18), (0.012, 0.035, 0.03)))


def pauldron(side, center, adds, size=1.0):
    s = size
    prof = [(0, 0.062 * s), (0.035 * s, 0.058 * s), (0.055 * s, 0.05 * s), (0.064 * s, 0.042 * s),
            (0.060 * s, 0.039 * s), (0.074 * s, 0.028 * s), (0.070 * s, 0.025 * s), (0.084 * s, 0.012 * s),
            (0.080 * s, 0.009 * s), (0.094 * s, -0.006 * s), (0.088 * s, -0.012 * s), (0, -0.012 * s)]
    ob = lathe('pauldron', prof, seg=48, scale=(1, 0.92, 1))
    xform(ob, Matrix.Translation(center) @ Euler((0, side * rad(52), 0)).to_matrix().to_4x4())
    adds.append(ob)


def gauntlet(center, axis_rot, adds):
    Mx = Matrix.Translation(center) @ Euler(axis_rot).to_matrix().to_4x4()
    parts = [box('fist', (0, 0, 0), (0.06, 0.075, 0.07), bevel=0.02, bevel_segs=3),
             ellipsoid('knuckles', (0, -0.03, 0.0), (0.032, 0.012, 0.03)),
             cyl('cuff', (0, 0.055, 0.0), 0.05, 0.036, 0.05, rot=(rad(90), 0, 0), seg=24)]
    for p in parts:
        xform(p, Mx)
    adds += parts


def build_pawn(H, R):
    adds, cuts, eyes = [], [], []
    ph = 0.11
    z0 = ph
    plinth(R, ph, adds, cuts)
    for s in (-1, 1):
        armored_leg(s * 0.072, z0 - 0.004, 0.32, adds)
    # mail skirt with pleats + hem
    adds.append(lathe('skirt', [(0, z0 + 0.20), (0.148, z0 + 0.20), (0.152, z0 + 0.215),
                                (0.138, z0 + 0.44), (0, z0 + 0.44)], seg=96,
                      mod=lambda t, z, r: r * (1 + 0.035 * abs(math.cos(10 * t)) ** 0.5), scale=(1, 0.86, 1)))
    # tassets (two curved plates on the front of the hips)
    for a0, a1 in ((rad(-150), rad(-95)), (rad(-85), rad(-30))):
        t = lathe('tasset', [(0.150, z0 + 0.43), (0.156, z0 + 0.37), (0.150, z0 + 0.365), (0.160, z0 + 0.31),
                              (0.154, z0 + 0.305), (0.165, z0 + 0.25)], seg=16, arc=(a0, a1), scale=(1, 0.88, 1))
        adds.append(solidify(t, 0.014, -1))
    # torso: breastplate with lames
    prof = [(0, 0.40), (0.142, 0.40), (0.150, 0.44), (0.140, 0.445), (0.154, 0.49), (0.146, 0.495),
            (0.160, 0.545), (0.166, 0.60), (0.160, 0.66), (0.136, 0.71), (0.08, 0.745), (0, 0.75)]
    adds.append(lathe('torso', [(r, z0 + z) for r, z in prof], seg=96, scale=(1, 0.74, 1)))
    adds.append(tube('ridge', [(0, -0.110, z0 + 0.50), (0, -0.122, z0 + 0.60), (0, -0.112, z0 + 0.69)],
                     [(0.010, 0.012)] * 3, seg=8, ref=(1, 0, 0)))
    adds.append(torus('belt', (0, 0, z0 + 0.425), 0.146, 0.019, scale=(1, 0.8, 1), seg=64, rseg=8))
    adds.append(box('buckle', (0, -0.12, z0 + 0.425), (0.054, 0.02, 0.048), bevel=0.006))
    cuts.append(box('buckle_hole', (0, -0.135, z0 + 0.425), (0.032, 0.02, 0.026)))
    for i in range(-3, 4):
        if i:
            adds.append(ellipsoid('stud', (i * 0.035, -0.135 + abs(i) * 0.004, z0 + 0.425),
                                  (0.008, 0.008, 0.008), seg=10, rings=6))
    # mail aventail flaring from the helmet onto the shoulders
    hz = z0 + 0.845
    adds.append(lathe('aventail', [(0, hz - 0.06), (0.085, hz - 0.06), (0.10, hz - 0.10), (0.135, hz - 0.135),
                                   (0.150, z0 + 0.695), (0, z0 + 0.69)], seg=72,
                      mod=lambda t, z, r: r * (1 + 0.012 * math.cos(40 * t)), scale=(1, 0.82, 1)))
    # pauldrons and arms
    for s in (-1, 1):
        pauldron(s, Vector((s * 0.158, 0, z0 + 0.665)), adds)
    S, E, W = (-0.17, 0, z0 + 0.64), (-0.205, -0.03, z0 + 0.52), (-0.165, -0.12, z0 + 0.475)
    adds.append(tube('uarm_r', [S, E], [0.042, 0.041], seg=16))
    adds.append(seg_cyl('vamb_r', E, W, 0.042, 0.038, seg=20))
    adds.append(ellipsoid('cop_r', E, (0.034, 0.046, 0.046)))
    grip = Vector((-0.162, -0.160, z0 + 0.47))
    gauntlet(grip, (rad(-10), 0, rad(-20)), adds)
    S, E, W = (0.17, 0, z0 + 0.64), (0.21, -0.02, z0 + 0.52), (0.18, -0.11, z0 + 0.50)
    adds.append(tube('uarm_l', [S, E], [0.042, 0.041], seg=16))
    adds.append(seg_cyl('vamb_l', E, W, 0.042, 0.038, seg=20))
    adds.append(ellipsoid('cop_l', E, (0.034, 0.046, 0.046)))
    gauntlet(Vector((0.178, -0.14, z0 + 0.50)), (0, 0, rad(25)), adds)
    shield_round(Vector((0.205, -0.19, z0 + 0.50)), (rad(90), 0, rad(35)), 0.165, adds)
    # helmet (bascinet) with crest, brow band, visor slit and breaths
    adds.append(lathe('helm', [(0, hz + 0.118), (0.03, hz + 0.112), (0.062, hz + 0.095), (0.085, hz + 0.065),
                               (0.097, hz + 0.025), (0.098, hz - 0.02), (0.094, hz - 0.065), (0.092, hz - 0.078),
                               (0.099, hz - 0.086), (0.084, hz - 0.09), (0, hz - 0.09)], seg=72, scale=(1, 1.07, 1)))
    adds.append(ellipsoid('faceplate', (0, -0.055, hz - 0.018), (0.082, 0.06, 0.07)))
    adds.append(torus('brow', (0, 0, hz + 0.03), 0.098, 0.010, scale=(1, 1.07, 1), seg=72, rseg=8))
    crest = bez((0, -0.10, hz + 0.04), (0, -0.06, hz + 0.145), (0, 0.06, hz + 0.145), (0, 0.112, hz + 0.01), 16)
    adds.append(tube('crest', crest, [(0.009, 0.02)] * 16, seg=10, ref=(1, 0, 0)))
    for i in range(6):
        a = TAU * i / 6 + rad(30)
        adds.append(ellipsoid('helm_rivet', (math.cos(a) * 0.1, math.sin(a) * 0.107, hz + 0.03),
                              (0.007, 0.007, 0.007), seg=8, rings=6))
    cuts.append(box('slit', (0, -0.13, hz), (0.13, 0.12, 0.018)))
    cuts.append(box('slit_v', (0, -0.13, hz - 0.016), (0.015, 0.12, 0.045)))
    for i in (-2, -1, 1, 2):
        for j in (0, 1):
            cuts.append(seg_cyl('breath', (i * 0.017, -0.17, hz - 0.045 - j * 0.017),
                                (i * 0.017, -0.08, hz - 0.045 - j * 0.017), 0.0048, seg=10))
    visor_eyes(0, -0.084, hz + 0.0005, 0.032, (0.021, 0.009, 0.0085), eyes)
    # short sword in the right hand, angled up and forward
    wM = Matrix.Translation(grip) @ Euler((rad(18), 0, 0)).to_matrix().to_4x4()
    weapon = blade_parts(0.33, 0.052, 0.016, 0.15, 0.022, 0.085)
    for p in weapon:
        xform(p, wM)
    face = lambda co: not (co.z > hz - 0.10 and co.y < -0.04) and co.z > 0.004
    return dict(adds=adds, cuts=cuts, eyes=eyes, weapon=weapon, grip=grip, chip_ok=face,
                chips=26, chip_size=0.02)


FRONT = rad(-90)


def face_features(hc, scale, adds, cuts, eyes, brow_angry=0.25, eye_sep=0.03, eye_drop=0.0, depth=0.0):
    """Carved stone face on a head centred at hc (head ~0.08 radius * scale)."""
    s = scale
    x, y, z = hc
    fy = y - 0.078 * s - depth
    ez = z + 0.008 * s - eye_drop
    # brow ridge (angled down toward the nose = stern)
    for side in (-1, 1):
        adds.append(ellipsoid('brow', (x + side * eye_sep * s, fy + 0.006 * s, ez + 0.018 * s),
                              (0.026 * s, 0.012 * s, 0.009 * s), rot=(0, side * -brow_angry, 0)))
        adds.append(ellipsoid('cheekbone', (x + side * 0.038 * s, fy + 0.02 * s, ez - 0.028 * s),
                              (0.022 * s, 0.015 * s, 0.014 * s)))
        cuts.append(ellipsoid('socket', (x + side * eye_sep * s, fy - 0.004 * s, ez),
                              (0.017 * s, 0.016 * s, 0.0105 * s), rot=(0, side * -brow_angry * 0.5, 0)))
        eyes.append(ellipsoid('eye', (x + side * eye_sep * s, fy + 0.008 * s, ez),
                              (0.0135 * s, 0.008 * s, 0.0075 * s), rot=(0, side * -brow_angry * 0.5, 0),
                              seg=14, rings=8))
    adds.append(tube('nose', [(x, fy + 0.004 * s, ez + 0.006 * s), (x, fy - 0.010 * s, ez - 0.022 * s),
                              (x, fy - 0.013 * s, ez - 0.034 * s)],
                     [(0.008 * s, 0.006 * s), (0.011 * s, 0.009 * s), (0.014 * s, 0.009 * s)], seg=12))
    adds.append(ellipsoid('lips', (x, fy + 0.006 * s, ez - 0.058 * s), (0.02 * s, 0.008 * s, 0.009 * s)))
    cuts.append(box('mouth', (x, fy - 0.006 * s, ez - 0.058 * s), (0.034 * s, 0.02 * s, 0.003 * s)))
    adds.append(ellipsoid('chin', (x, fy + 0.012 * s, ez - 0.085 * s), (0.022 * s, 0.014 * s, 0.016 * s)))


def robe(z0, prof, adds, folds=9, amp=0.06, back_train=0.0, seg=128, name='robe'):
    ztop = prof[-1][1]

    def mod(t, z, r):
        k = max(0.0, 1.0 - (z - z0) / max(1e-6, (ztop - z0)))
        f = amp * k * (0.7 * math.sin(folds * t) + 0.3 * math.sin(folds * 2.6 * t + 1.3))
        tr = back_train * k * k * max(0.0, math.sin(t)) ** 2
        return r * (1 + f + tr)
    adds.append(lathe(name, [(0, z0 - 0.004)] + [(r, z0 + z) for r, z in prof] + [(0, z0 + prof[-1][1])],
                      seg=seg, mod=mod))


# ===================================================================================== ROOK
def build_rook(H, R):
    adds, cuts, eyes, post = [], [], [], []
    ph = 0.13
    z0 = ph
    plinth(R, ph, adds, cuts)
    top = H - z0  # 1.32
    wall = lambda zr: 0.252 - 0.012 * (zr / 0.98)
    prof = [(0, z0 - 0.004), (0.292, z0 - 0.004), (0.292, z0 + 0.035), (0.262, z0 + 0.13), (wall(0.13), z0 + 0.135),
            (wall(0.58), z0 + 0.58), (0.266, z0 + 0.585), (0.268, z0 + 0.62), (wall(0.63) + 0.004, z0 + 0.635),
            (wall(0.98), z0 + 0.98), (wall(0.98), z0 + 1.035), (0.30, z0 + 1.035), (0.30, z0 + 1.06),
            (0.292, z0 + 1.07), (0.292, z0 + top - 0.012), (0.30, z0 + top - 0.006), (0.30, z0 + top), (0, z0 + top)]
    adds.append(lathe('tower', prof, seg=160))
    # corbels / machicolation brackets
    for i in range(20):
        a = TAU * i / 20
        for k in range(3):
            adds.append(radial_box('corbel', a, wall(0.98) + 0.012 + 0.012 * k, z0 + 1.03 - 0.02 * k,
                                   0.03, 0.034, 0.02))
    # string-course rope of studs
    for i in range(48):
        a = TAU * i / 48
        adds.append(ellipsoid('stud', (0.27 * math.cos(a), 0.27 * math.sin(a), z0 + 0.60), (0.008, 0.008, 0.008),
                              seg=8, rings=6))
    # ashlar coursing
    courses = [(z0 + 0.135, z0 + 0.58), (z0 + 0.635, z0 + 0.98)]
    ci = 0
    for za, zb in courses:
        n = int(round((zb - za) / 0.074))
        hgt = (zb - za) / n
        for k in range(1, n):
            zz = za + k * hgt
            cuts.append(torus('course', (0, 0, zz), wall(zz - z0) + 0.001, 0.0045, seg=120, rseg=6))
        for k in range(n):
            zz = za + (k + 0.5) * hgt
            off = (0.5 if ci % 2 else 0.0)
            ci += 1
            for j in range(11):
                a = TAU * (j + off) / 11 + 0.05
                cuts.append(radial_box('joint', a, wall(zz - z0) + 0.004, zz, 0.018, 0.008, hgt - 0.002))
    # parapet ashlar
    for k in (1,):
        cuts.append(torus('course_p', (0, 0, z0 + 1.07 + 0.075 * k), 0.293, 0.004, seg=120, rseg=6))
    # crenellations: 8 merlons, embrasures cut out
    for i in range(8):
        a = TAU * (i + 0.5) / 8 + FRONT
        cuts.append(radial_box('embrasure', a, 0.27, z0 + top - 0.055 + 0.03, 0.2, 0.095, 0.11))
        am = TAU * i / 8 + FRONT
        cuts.append(radial_box('loop', am, 0.29, z0 + top - 0.05, 0.06, 0.012, 0.05))
    cuts.append(cyl('hollow', (0, 0, z0 + top + 0.02), 0.235, 0.235, 0.24, seg=96))
    # arrow slits (cross loops) around the lower drum
    for i, a in enumerate([FRONT + rad(60), FRONT + rad(150), FRONT + rad(210), FRONT + rad(300)]):
        cuts.append(radial_box('slit', a, 0.25, z0 + 0.40, 0.12, 0.018, 0.15))
        cuts.append(radial_box('slit_h', a, 0.25, z0 + 0.40, 0.12, 0.06, 0.016))
        cuts.append(radial_box('splay', a, 0.262, z0 + 0.40, 0.03, 0.04, 0.18))
    # upper slits; the two front ones are the glowing "eyes", tilted inward (angry)
    for i, a in enumerate([FRONT + rad(110), FRONT + rad(180), FRONT + rad(250)]):
        cuts.append(radial_box('slit_u', a, 0.24, z0 + 0.82, 0.12, 0.018, 0.13))
    for side in (-1, 1):
        a = FRONT + side * rad(17)
        tilt = side * rad(14)
        cuts.append(radial_box('eye_slit', a, 0.245, z0 + 0.83, 0.10, 0.026, 0.12, tilt=tilt))
        cuts.append(radial_box('eye_splay', a, 0.262, z0 + 0.83, 0.03, 0.05, 0.15, tilt=tilt))
        eyes.append(radial_box('eye', a, 0.205, z0 + 0.83, 0.012, 0.03, 0.125, tilt=tilt))
    # arched door with planks
    dz = z0 + 0.135
    cuts.append(radial_box('door', FRONT, 0.24, dz + 0.10, 0.085, 0.15, 0.20))
    door_arch = seg_cyl('door_arch', (0, -0.198, dz + 0.20), (0, -0.33, dz + 0.20), 0.075, seg=40)
    cuts.append(door_arch)
    for j in (-1, 1):
        post.append(box('plank_gap', (j * 0.026, -0.202, dz + 0.13), (0.006, 0.012, 0.26)))
    for zz in (dz + 0.06, dz + 0.17):
        post.append(box('door_band', (0, -0.205, zz), (0.15, 0.012, 0.018), bevel=0.003))
    post.append(torus('door_ring', (0.035, -0.212, dz + 0.115), 0.016, 0.004, rot=(rad(90), 0, 0), seg=24, rseg=6))
    # voussoirs around the door arch
    for k in range(9):
        a = math.pi * k / 8
        p = Vector((math.cos(a) * 0.085, 0, math.sin(a) * 0.085 + dz + 0.20))
        if p.z < dz + 0.2 - 0.001 and 0 < k < 8:
            continue
        cuts.append(box('vous', (p.x, -0.255, p.z), (0.006, 0.03, 0.03),
                        rot=(0, -a + math.pi / 2, 0)))
    ok = lambda co: co.z > 0.004 and not (co.y < -0.12 and abs(co.z - (z0 + 0.83)) < 0.1)
    return dict(adds=adds, cuts=cuts, eyes=eyes, post_adds=post, chip_ok=ok, chips=42, chip_size=0.026,
                weapon=None)


# ===================================================================================== KNIGHT
def build_knight(H, R):
    adds, cuts, eyes, post = [], [], [], []
    ph = 0.12
    z0 = ph
    plinth(R, ph, adds, cuts)
    # rocky chest/breast bust with barding (peytral)
    adds.append(ellipsoid('chest', (0, 0.04, z0 + 0.19), (0.25, 0.235, 0.25)))
    adds.append(ellipsoid('shoulder_l', (0.11, -0.04, z0 + 0.30), (0.13, 0.13, 0.15)))
    adds.append(ellipsoid('shoulder_r', (-0.11, -0.04, z0 + 0.30), (0.13, 0.13, 0.15)))
    pey = lathe('peytral', [(0.248, z0 + 0.06), (0.262, z0 + 0.16), (0.258, z0 + 0.26), (0.232, z0 + 0.34),
                            (0.20, z0 + 0.39)], seg=40, arc=(rad(-165), rad(-15)), loc=(0, 0.035, 0))
    adds.append(solidify(pey, 0.06, -1))
    for i in range(13):
        a = rad(-160) + rad(140) * i / 12
        adds.append(ellipsoid('pey_rivet', (0.24 * math.cos(a), 0.035 + 0.24 * math.sin(a), z0 + 0.335 - 0.02 * abs(math.cos(a))),
                              (0.01, 0.01, 0.01), seg=8, rings=6))
    adds.append(tube('pey_ridge', [(0, -0.215, z0 + 0.08), (0, -0.235, z0 + 0.22), (0, -0.20, z0 + 0.35)],
                     [(0.012, 0.012)] * 3, seg=8))
    # neck
    neck = bez((0, 0.06, z0 + 0.22), (0, 0.07, z0 + 0.55), (0, 0.04, z0 + 0.78), (0, -0.03, z0 + 0.98), 14)
    nr = [(lerp(0.165, 0.10, t), lerp(0.22, 0.15, t)) for t in [i / 13 for i in range(14)]]
    adds.append(tube('neck', neck, nr, seg=36, ref=(1, 0, 0)))
    adds.append(tube('neck_crest', [p + Vector((0, nr[i][1] * 0.55, 0.02)) for i, p in enumerate(neck)],
                     [(r[0] * 0.55, r[1] * 0.4) for r in nr], seg=20, ref=(1, 0, 0)))
    # head: poll -> nose
    P = Vector((0, -0.02, z0 + 1.07))
    Nt = Vector((0, -0.45, z0 + 0.85))
    ax = (Nt - P).normalized()
    up = Vector((0, 0, 1)) - Vector((0, 0, 1)).dot(ax) * ax
    up.normalize()
    hp = lambda t, u=0.0, x=0.0: P + (Nt - P) * t + up * u + Vector((x, 0, 0))
    radii = [(0.085, 0.10), (0.103, 0.125), (0.100, 0.122), (0.082, 0.104), (0.070, 0.090), (0.072, 0.082),
             (0.064, 0.068), (0.034, 0.034)]
    ts = [0.0, 0.14, 0.30, 0.48, 0.66, 0.84, 0.95, 1.0]
    adds.append(tube('head', [hp(t) for t in ts], radii, seg=36, ref=(1, 0, 0)))
    for side in (-1, 1):
        adds.append(ellipsoid('cheek', hp(0.30, -0.04, side * 0.052), (0.045, 0.085, 0.07), rot=(rad(-28), 0, 0)))
        adds.append(ellipsoid('nostril_flare', hp(0.93, -0.005, side * 0.036), (0.026, 0.03, 0.03)))
        cuts.append(ellipsoid('nostril', hp(0.98, 0.0, side * 0.034), (0.013, 0.03, 0.02), rot=(rad(-28), 0, side * 0.3)))
        # angry brow ridges and eye sockets
        adds.append(ellipsoid('brow', hp(0.22, 0.072, side * 0.07), (0.028, 0.06, 0.02),
                              rot=(rad(-40), 0, side * rad(10))))
        cuts.append(ellipsoid('socket', hp(0.25, 0.04, side * 0.088), (0.026, 0.034, 0.02), rot=(rad(-30), 0, side * rad(-25))))
        eyes.append(ellipsoid('eye', hp(0.25, 0.038, side * 0.079), (0.018, 0.026, 0.0135),
                              rot=(rad(-30), 0, side * rad(-25)), seg=14, rings=8))
        # veins on the face
        adds.append(tube('vein', [hp(0.40, 0.03, side * 0.07), hp(0.55, 0.0, side * 0.06), hp(0.70, -0.02, side * 0.052)],
                         [0.007, 0.006, 0.004], seg=8))
        # ears, laid slightly back
        b = hp(0.02, 0.07, side * 0.045)
        adds.append(tube('ear', [b, b + Vector((side * 0.014, 0.025, 0.07)), b + Vector((side * 0.022, 0.055, 0.135))],
                         [(0.04, 0.03), (0.032, 0.022), (0.003, 0.003)], seg=14, ref=(1, 0, 0)))
        cuts.append(ellipsoid('ear_hollow', b + Vector((side * 0.014, -0.004, 0.07)), (0.013, 0.016, 0.045),
                              rot=(rad(-18), 0, 0)))
    # open mouth with teeth
    cuts.append(box('mouth', hp(0.80, -0.065), (0.2, 0.30, 0.022), rot=(rad(-28) + rad(8), 0, 0)))
    for side in (-1, 1):
        cuts.append(box('mouth_side', hp(0.68, -0.055, side * 0.058), (0.03, 0.2, 0.02), rot=(rad(-20), 0, 0)))
    for k in range(5):
        x = (k - 2) * 0.016
        post.append(box('tooth', hp(0.94, -0.052, x), (0.012, 0.01, 0.016), rot=(rad(-28), 0, 0), bevel=0.003))
        post.append(box('tooth_l', hp(0.91, -0.08, x), (0.012, 0.01, 0.014), rot=(rad(-28), 0, 0), bevel=0.003))
    # forelock
    for k, x in enumerate((-0.03, 0.0, 0.03)):
        b = hp(0.03, 0.085, x)
        adds.append(tube('forelock', bez(b, b + Vector((x * 0.5, -0.06, 0.03)), b + Vector((x, -0.11, -0.01)),
                                         b + Vector((x * 1.4, -0.14, -0.06)), 8),
                         [(0.022, 0.009)] * 4 + [(0.016, 0.007), (0.012, 0.005), (0.006, 0.003), (0.002, 0.002)],
                         seg=10, ref=(1, 0, 0)))
    # flame-like mane down the back of the neck
    for i in range(26):
        t = i / 25
        k = min(13, int(t * 13))
        base = neck[13 - k] + Vector((0, nr[13 - k][1] * 0.75, 0.02))
        side = 0.022 if i % 2 else -0.022
        L = 0.19 - 0.06 * t
        d = Vector((0, 0.8, 0.35 - 0.6 * t)).normalized()
        pts = bez(base + Vector((side, 0, 0)), base + d * L * 0.4 + Vector((side, 0, 0.03)),
                  base + d * L * 0.8 + Vector((side * 1.6, 0, 0.0)), base + d * L + Vector((side * 2.0, 0.02, -0.05)), 8)
        adds.append(tube('mane', pts, [(0.042, 0.015), (0.04, 0.015), (0.035, 0.013), (0.028, 0.011),
                                       (0.016, 0.007), (0.011, 0.005), (0.006, 0.003), (0.002, 0.002)],
                         seg=10, ref=(1, 0, 0)))
    # bridle: noseband, cheek straps + crownpiece, browband, bit rings, reins
    c = hp(0.72)
    u = Vector((1, 0, 0))
    v = up
    adds.append(tube('noseband', ring_pts(c, u, v, 0.074, 0.093, 40), [(0.014, 0.007)] * 42, seg=8, ref=ax))
    adds.append(tube('browband', bez(hp(0.10, 0.07, -0.085), hp(0.16, 0.10, -0.03), hp(0.16, 0.10, 0.03),
                                     hp(0.10, 0.07, 0.085), 12), [(0.007, 0.012)] * 12, seg=8))
    for side in (-1, 1):
        a = hp(0.72, 0.0, side * 0.076)
        b = hp(0.30, 0.03, side * 0.094)
        cpt = hp(-0.04, 0.09, side * 0.07)
        adds.append(tube('cheekstrap', bez(a, a + (b - a) * 0.4, b, cpt, 14), [(0.013, 0.007)] * 14, seg=8, ref=(1, 0, 0)))
        ring = hp(0.86, -0.045, side * 0.066)
        adds.append(torus('bit', ring, 0.024, 0.006, rot=(0, rad(90), 0), seg=24, rseg=8))
        rein = bez(ring, Vector((side * 0.11, -0.20, z0 + 0.80)), Vector((side * 0.145, -0.02, z0 + 0.62)),
                   Vector((side * 0.175, 0.0, z0 + 0.42)), 16)
        adds.append(tube('rein', rein, [(0.012, 0.008)] * 16, seg=8))
        for t in (0.55, 0.35):
            adds.append(ellipsoid('strapstud', hp(t, 0.01, side * 0.1), (0.009, 0.009, 0.009), seg=8, rings=6))
    adds.append(tube('crownpiece', bez(hp(-0.04, 0.09, -0.07), hp(-0.05, 0.13, -0.03), hp(-0.05, 0.13, 0.03),
                                       hp(-0.04, 0.09, 0.07), 10), [(0.007, 0.013)] * 10, seg=8))
    for k in range(-2, 3):
        adds.append(ellipsoid('nosestud', hp(0.72, 0.096, k * 0.025), (0.009, 0.009, 0.009), seg=8, rings=6))
    ok = lambda co: co.z > 0.004 and co.z < z0 + 0.6
    return dict(adds=adds, cuts=cuts, eyes=eyes, post_adds=post, chip_ok=ok, chips=26, chip_size=0.024,
                weapon=None)


# ===================================================================================== BISHOP
def build_bishop(H, R):
    adds, cuts, eyes, post = [], [], [], []
    ph = 0.12
    z0 = ph
    plinth(R, ph, adds, cuts)
    robe(z0, [(0.272, 0.0), (0.276, 0.02), (0.255, 0.05), (0.22, 0.30), (0.185, 0.55), (0.158, 0.72)], adds,
         folds=9, amp=0.07)
    # chasuble front/back panels with orphrey cross
    for a0, a1 in ((rad(-128), rad(-52)), (rad(52), rad(128))):
        ch = lathe('chasuble', [(0.205, z0 + 0.40), (0.19, z0 + 0.55), (0.172, z0 + 0.72), (0.172, z0 + 0.86),
                                (0.17, z0 + 0.96)], seg=20, arc=(a0, a1), scale=(1, 0.8, 1))
        adds.append(solidify(ch, 0.014, 1))
    orph = lathe('orphrey', [(0.215, z0 + 0.41), (0.20, z0 + 0.55), (0.183, z0 + 0.72), (0.183, z0 + 0.86),
                             (0.181, z0 + 0.95)], seg=4, arc=(rad(-95), rad(-85)), scale=(1, 0.8, 1))
    adds.append(solidify(orph, 0.012, 1))
    bar = lathe('orph_bar', [(0.183, z0 + 0.80), (0.183, z0 + 0.835)], seg=12, arc=(rad(-120), rad(-60)),
                scale=(1, 0.8, 1))
    adds.append(solidify(bar, 0.012, 1))
    # torso
    adds.append(lathe('torso', [(0, z0 + 0.70), (0.158, z0 + 0.70), (0.168, z0 + 0.85), (0.17, z0 + 0.95),
                                (0.14, z0 + 1.02), (0.06, z0 + 1.055), (0, z0 + 1.06)], seg=72, scale=(1, 0.78, 1)))
    adds.append(torus('cincture', (0, 0, z0 + 0.71), 0.162, 0.012, scale=(1, 0.86, 1), seg=72, rseg=8))
    # short cape (mozzetta) with scalloped hem and buttons
    adds.append(lathe('mozzetta', [(0, z0 + 1.07), (0.10, z0 + 1.07), (0.18, z0 + 1.0), (0.215, z0 + 0.93),
                                   (0.218, z0 + 0.905), (0.20, z0 + 0.90), (0, z0 + 0.92)], seg=96,
                      mod=lambda t, z, r: r * (1 + (0.035 * abs(math.sin(8 * t)) if z < z0 + 0.93 else 0)),
                      scale=(1, 0.85, 1)))
    for k in range(4):
        adds.append(ellipsoid('button', (0, -0.183 + k * 0.008, z0 + 1.03 - k * 0.04), (0.01, 0.008, 0.01), seg=10, rings=6))
    # hood (deep, with the face lost in shadow) and drape
    hc = Vector((0, 0.005, z0 + 1.15))
    adds.append(ellipsoid('hood', hc, (0.118, 0.13, 0.13)))
    adds.append(lathe('hood_drape', [(0, z0 + 1.10), (0.10, z0 + 1.10), (0.135, z0 + 1.06), (0.17, z0 + 1.02),
                                     (0, z0 + 1.0)], seg=64, scale=(1, 0.9, 1)))
    adds.append(torus('hood_rim', (0, -0.085, z0 + 1.135), 0.082, 0.016, rot=(rad(78), 0, 0), scale=(0.95, 1.12, 1),
                      seg=48, rseg=10))
    cuts.append(ellipsoid('hood_open', (0, -0.115, z0 + 1.13), (0.075, 0.09, 0.095)))
    cuts.append(ellipsoid('hood_deep', (0, -0.04, z0 + 1.135), (0.06, 0.06, 0.075)))
    for side in (-1, 1):
        eyes.append(ellipsoid('eye', (side * 0.026, -0.005, z0 + 1.15), (0.015, 0.007, 0.0085),
                              rot=(0, side * rad(-14), 0), seg=14, rings=8))
    # mitre on the hood, with the cleft (slit), bands and lappets
    mb = z0 + 1.215
    adds.append(lathe('mitre', [(0, mb - 0.01), (0.104, mb - 0.01), (0.11, mb + 0.05), (0.106, mb + 0.15),
                                (0.082, mb + 0.24), (0.042, mb + 0.31), (0.012, mb + 0.345), (0, mb + 0.352)],
                      seg=72, scale=(1, 0.64, 1)))
    cuts.append(box('mitre_cleft', (0, 0, mb + 0.30), (0.4, 0.016, 0.22)))
    adds.append(torus('circulus', (0, 0, mb + 0.015), 0.108, 0.013, scale=(1, 0.66, 1), seg=72, rseg=8))
    tit = [(0, -0.64 * r - 0.003, mb + z) for r, z in ((0.108, 0.02), (0.11, 0.05), (0.106, 0.15), (0.082, 0.24),
                                                         (0.05, 0.295))]
    adds.append(tube('titulus', tit, [(0.014, 0.006)] * 5, seg=8, ref=(1, 0, 0)))
    for k, z in enumerate((0.09, 0.17)):
        r = 0.108 if k == 0 else 0.098
        adds.append(ellipsoid('mitre_jewel', (0, -0.64 * r - 0.01, mb + z), (0.014, 0.01, 0.018), seg=12, rings=8))
    for side in (-1, 1):
        adds.append(box('lappet', (side * 0.045, 0.085, z0 + 1.10), (0.035, 0.01, 0.20), rot=(rad(-8), 0, 0),
                        bevel=0.004))
        adds.append(box('lappet_fringe', (side * 0.045, 0.098, z0 + 0.995), (0.04, 0.014, 0.02), rot=(rad(-8), 0, 0),
                        bevel=0.004))
    # right arm (staff hand)
    S, E, W = Vector((-0.16, 0, z0 + 0.99)), Vector((-0.225, -0.01, z0 + 0.84)), Vector((-0.205, -0.085, z0 + 0.79))
    adds.append(tube('sleeve_r', [S, E], [0.05, 0.05], seg=16))
    adds.append(seg_cyl('cuff_r', E, W, 0.05, 0.072, seg=24))
    grip = Vector((-0.205, -0.112, z0 + 0.79))
    adds.append(ellipsoid('hand_r', grip, (0.034, 0.04, 0.045)))
    # left arm holding a book against the chest
    S, E, W = Vector((0.16, 0, z0 + 0.99)), Vector((0.205, -0.05, z0 + 0.84)), Vector((0.12, -0.13, z0 + 0.84))
    adds.append(tube('sleeve_l', [S, E], [0.05, 0.05], seg=16))
    adds.append(seg_cyl('cuff_l', E, W, 0.05, 0.07, seg=24))
    bk = Matrix.Translation((0.05, -0.18, z0 + 0.86)) @ Euler((rad(-12), 0, rad(12))).to_matrix().to_4x4()
    for p in [box('book', (0, 0, 0), (0.15, 0.046, 0.19), bevel=0.008),
              box('book_cross_v', (0, -0.026, 0.005), (0.018, 0.012, 0.12), bevel=0.003),
              box('book_cross_h', (0, -0.026, 0.03), (0.08, 0.012, 0.018), bevel=0.003),
              box('book_clasp', (0.078, -0.005, 0), (0.012, 0.03, 0.035), bevel=0.003)]:
        adds.append(xform(p, bk))
    for p in [box('pages', (-0.004, 0.0, 0), (0.15, 0.03, 0.17)), box('pages2', (0, 0.0, -0.004), (0.13, 0.03, 0.19))]:
        cuts.append(xform(p, bk @ Matrix.Translation((0.012, 0, 0))))
    adds.append(ellipsoid('hand_l', (0.115, -0.16, z0 + 0.85), (0.032, 0.035, 0.045)))
    # crooked staff
    import random as _r
    rnd = _r.Random(7)
    shaft = []
    for i in range(12):
        t = i / 11
        z = lerp(z0 + 0.012, z0 + 1.44, t)
        shaft.append(Vector((-0.205 + rnd.uniform(-0.008, 0.008) + 0.012 * math.sin(t * 7),
                             -0.112 + rnd.uniform(-0.008, 0.008), z)))
    crook = bez(shaft[-1], shaft[-1] + Vector((0, 0, 0.10)), shaft[-1] + Vector((-0.12, 0, 0.17)),
                shaft[-1] + Vector((-0.13, 0, 0.06)), 10)[1:]
    curl = bez(crook[-1], crook[-1] + Vector((0.0, 0, -0.04)), crook[-1] + Vector((0.05, 0, -0.05)),
               crook[-1] + Vector((0.055, 0, -0.01)), 6)[1:]
    pts = shaft + crook + curl
    rr = [0.019] * len(shaft) + taper(len(crook), 0.019, 0.015) + taper(len(curl), 0.015, 0.008)
    weapon = [tube('staff', pts, rr, seg=12)]
    for k in (2, 5, 8):
        weapon.append(ellipsoid('knot', shaft[k] + Vector((rnd.uniform(-0.01, 0.01), -0.006, 0)),
                                (0.025, 0.024, 0.03), seg=12, rings=8))
    weapon.append(cyl('ferrule', shaft[0] + Vector((0, 0, 0.02)), 0.021, 0.021, 0.04, seg=16))
    weapon.append(torus('staff_band', shaft[-1], 0.02, 0.007, seg=20, rseg=6))
    ok = lambda co: co.z > 0.004 and not (co.z > z0 + 1.05 and co.y < -0.02)
    return dict(adds=adds, cuts=cuts, eyes=eyes, post_adds=post, weapon=weapon, grip=grip, chip_ok=ok, chips=26,
                chip_size=0.022, weapon_voxel=0.0028)


# ===================================================================================== QUEEN
def crown(zb, r_in, r_out, band_h, spikes, adds, tall=0.16, short=0.09, balls=True, front=FRONT, sy=1.0,
          jewels=True):
    adds.append(lathe('crown_band', [(r_in, zb), (r_out, zb), (r_out + 0.006, zb + 0.01), (r_out, zb + 0.02),
                                     (r_out - 0.002, zb + band_h - 0.012), (r_out + 0.006, zb + band_h - 0.006),
                                     (r_out, zb + band_h), (r_in, zb + band_h)], seg=96, scale=(1, sy, 1)))
    for i in range(spikes):
        a = front + TAU * i / spikes
        h = tall if i % 2 == 0 else short
        r = r_out - 0.008
        base = Vector((r * math.cos(a), r * math.sin(a) * sy, zb + band_h - 0.01))
        tip = base + Vector((math.cos(a) * 0.012, math.sin(a) * 0.012 * sy, h))
        adds.append(seg_cyl('spike', base, tip, 0.024 if i % 2 == 0 else 0.018, 0.004, seg=4))
        if balls:
            adds.append(ellipsoid('spike_ball', tip, (0.013, 0.013, 0.013), seg=12, rings=8))
        if jewels:
            jp = Vector(((r_out + 0.002) * math.cos(a), (r_out + 0.002) * math.sin(a) * sy, zb + band_h * 0.5))
            adds.append(ellipsoid('jewel', jp, (0.012, 0.012, 0.014), seg=12, rings=8))


def build_queen(H, R):
    adds, cuts, eyes, post = [], [], [], []
    ph = 0.13
    z0 = ph
    plinth(R, ph, adds, cuts)
    robe(z0, [(0.30, 0.0), (0.305, 0.02), (0.282, 0.05), (0.24, 0.30), (0.19, 0.60), (0.138, 0.86), (0.135, 0.88)],
         adds, folds=11, amp=0.07, back_train=0.12, seg=144, name='gown')
    adds.append(lathe('hem', [(0.29, z0 + 0.05), (0.296, z0 + 0.06), (0.296, z0 + 0.085), (0.28, z0 + 0.09)], seg=144,
                      mod=lambda t, z, r: r * (1 + 0.055 * (0.7 * math.sin(11 * t) + 0.3 * math.sin(28.6 * t + 1.3))
                                               * 0.92 + 0.12 * 0.85 * max(0.0, math.sin(t)) ** 2)))
    # front underskirt panel with lozenge pattern
    pan = lathe('panel', [(0.27, z0 + 0.06), (0.235, z0 + 0.30), (0.19, z0 + 0.60), (0.145, z0 + 0.84)], seg=10,
                arc=(rad(-112), rad(-68)))
    adds.append(solidify(pan, 0.012, 1))
    for k in range(6):
        zz = z0 + 0.12 + k * 0.12
        rr = lerp(0.285, 0.155, (zz - z0 - 0.06) / 0.78) + 0.012
        adds.append(ellipsoid('lozenge', (0, -rr, zz), (0.028, 0.008, 0.036), seg=4, rings=4))
    # girdle with long pendant
    adds.append(torus('girdle', (0, 0, z0 + 0.88), 0.14, 0.013, scale=(1, 0.8, 1), seg=72, rseg=8))
    adds.append(tube('pendant', [(0, -0.115, z0 + 0.87), (0, -0.155, z0 + 0.70), (0, -0.20, z0 + 0.50)],
                     [0.008, 0.008, 0.008], seg=8))
    adds.append(ellipsoid('pendant_jewel', (0, -0.205, z0 + 0.47), (0.02, 0.012, 0.032), seg=12, rings=8))
    # bodice
    adds.append(lathe('bodice', [(0, z0 + 0.86), (0.138, z0 + 0.86), (0.15, z0 + 1.0), (0.158, z0 + 1.12),
                                 (0.148, z0 + 1.22), (0.10, z0 + 1.28), (0.05, z0 + 1.30), (0, z0 + 1.30)],
                      seg=96, scale=(1, 0.72, 1)))
    for k in range(5):
        adds.append(tube('lacing', [(-0.03, -0.106 + 0.002 * k, z0 + 0.90 + k * 0.05), (0.03, -0.108 + 0.002 * k, z0 + 0.925 + k * 0.05)],
                         [0.005, 0.005], seg=6))
    chain = bez((-0.072, -0.035, z0 + 1.29), (-0.045, -0.105, z0 + 1.20), (0.045, -0.105, z0 + 1.20),
                (0.072, -0.035, z0 + 1.29), 12)
    adds.append(tube('necklace', chain, [0.006] * 12, seg=8))
    for p in chain[2:-2]:
        adds.append(ellipsoid('pearl', p + Vector((0, -0.004, 0)), (0.009, 0.009, 0.009), seg=8, rings=6))
    adds.append(ellipsoid('pendant_n', (0, -0.112, z0 + 1.185), (0.016, 0.01, 0.022), seg=10, rings=6))
    # puffed, slashed sleeves and arms with hands clasped at the waist
    for side in (-1, 1):
        adds.append(ellipsoid('puff', (side * 0.152, 0, z0 + 1.19), (0.07, 0.068, 0.07)))
        for k in range(5):
            a = rad(-60) + k * rad(30)
            cuts.append(box('slash', (side * (0.152 + 0.07 * math.cos(a)), 0.07 * math.sin(a) * 0 - 0.0, z0 + 1.19),
                            (0.01, 0.16, 0.05), rot=(0, 0, side * a)))
        S, E, W = Vector((side * 0.16, 0, z0 + 1.16)), Vector((side * 0.195, -0.04, z0 + 0.98)), \
            Vector((side * 0.05, -0.15, z0 + 0.905))
        adds.append(tube('arm', [S, E], [0.04, 0.038], seg=16))
        adds.append(tube('forearm', [E, W], [0.036, 0.03], seg=16))
        adds.append(seg_cyl('cuff', E.lerp(W, 0.55), E.lerp(W, 0.75), 0.036, 0.045, seg=20))
    adds.append(ellipsoid('hands', (0, -0.165, z0 + 0.90), (0.06, 0.035, 0.04)))
    # Medici collar fanning up behind the head
    col = lathe('collar', [(0.085, z0 + 1.27), (0.12, z0 + 1.36), (0.17, z0 + 1.46), (0.19, z0 + 1.50)], seg=40,
                arc=(rad(15), rad(165)), mod=lambda t, z, r: r * (1 + (0.04 * abs(math.sin(12 * t)) if z > z0 + 1.45 else 0)))
    adds.append(solidify(col, 0.012, -1))
    # neck and head
    adds.append(cyl('neck', (0, 0, z0 + 1.30), 0.04, 0.036, 0.1))
    hc = Vector((0, -0.005, z0 + 1.40))
    adds.append(ellipsoid('head', hc, (0.078, 0.088, 0.10)))
    face_features(hc + Vector((0, -0.004, 0)), 1.12, adds, cuts, eyes, brow_angry=0.2, eye_sep=0.027)
    # veil falling behind the head
    veil = lathe('veil', [(0.08, z0 + 1.44), (0.088, z0 + 1.38), (0.10, z0 + 1.30), (0.13, z0 + 1.20)], seg=40,
                 arc=(rad(10), rad(170)), mod=lambda t, z, r: r * (1 + 0.03 * math.sin(14 * t)), loc=(0, 0.0, 0))
    adds.append(solidify(veil, 0.012, 1))
    crown(z0 + 1.445, 0.055, 0.082, 0.07, 10, adds, tall=0.15, short=0.085)
    adds.append(ellipsoid('crown_cap', (0, 0, z0 + 1.49), (0.068, 0.07, 0.06)))
    ok = lambda co: co.z > 0.004 and not (co.z > z0 + 1.28)
    return dict(adds=adds, cuts=cuts, eyes=eyes, post_adds=post, chip_ok=ok, chips=30, chip_size=0.022, weapon=None)


# ===================================================================================== KING
def build_king(H, R):
    adds, cuts, eyes, post = [], [], [], []
    ph = 0.14
    z0 = ph
    plinth(R, ph, adds, cuts)
    robe(z0, [(0.29, 0.0), (0.295, 0.02), (0.272, 0.05), (0.245, 0.35), (0.205, 0.70), (0.185, 0.88), (0.18, 0.90)],
         adds, folds=10, amp=0.06, seg=144)
    adds.append(lathe('hem', [(0.28, z0 + 0.05), (0.286, z0 + 0.06), (0.286, z0 + 0.09), (0.27, z0 + 0.095)], seg=144,
                      mod=lambda t, z, r: r * (1 + 0.06 * 0.92 * (0.7 * math.sin(10 * t) + 0.3 * math.sin(26 * t + 1.3)))))
    # cloak around the back and sides, open at the front
    cl = lathe('cloak', [(0.19, z0 + 1.33), (0.225, z0 + 1.25), (0.24, z0 + 1.12), (0.255, z0 + 0.90),
                         (0.285, z0 + 0.45), (0.315, z0 + 0.03)], seg=96, arc=(rad(-38), rad(218)),
               mod=lambda t, z, r: r * (1 + 0.055 * max(0, 1 - (z - z0) / 1.3) * math.sin(11 * t + 0.5)))
    adds.append(solidify(cl, 0.024, 1))
    adds.append(lathe('cloak_fill', [(0, z0 + 1.27), (0.215, z0 + 1.27), (0.215, z0 + 1.345), (0, z0 + 1.37)], seg=72,
                      scale=(1, 0.92, 1)))
    # ermine mantle collar
    adds.append(torus('mantle', (0, 0.005, z0 + 1.33), 0.165, 0.048, scale=(1, 0.86, 0.8), seg=72, rseg=16))
    for i in range(16):
        a = TAU * i / 16
        post.append(ellipsoid('ermine_tail', (0.19 * math.cos(a), 0.005 + 0.165 * math.sin(a), z0 + 1.305),
                              (0.008, 0.008, 0.022), seg=8, rings=6))
    # torso, belt, chain of office
    adds.append(lathe('torso', [(0, z0 + 0.88), (0.185, z0 + 0.88), (0.195, z0 + 1.0), (0.2, z0 + 1.12),
                                (0.19, z0 + 1.25), (0.15, z0 + 1.33), (0.07, z0 + 1.37), (0, z0 + 1.37)],
                      seg=96, scale=(1, 0.76, 1)))
    adds.append(torus('belt', (0, 0, z0 + 0.92), 0.19, 0.018, scale=(1, 0.78, 1), seg=72, rseg=8))
    adds.append(box('buckle', (0, -0.15, z0 + 0.92), (0.06, 0.02, 0.05), bevel=0.006))
    chain = bez((-0.12, -0.11, z0 + 1.29), (-0.08, -0.17, z0 + 1.16), (0.08, -0.17, z0 + 1.16), (0.12, -0.11, z0 + 1.29), 16)
    for i, p in enumerate(chain):
        adds.append(ellipsoid('link', p, (0.013, 0.008, 0.009) if i % 2 else (0.009, 0.008, 0.013), seg=10, rings=6))
    adds.append(cyl('medallion', (0, -0.158, z0 + 1.10), 0.04, 0.04, 0.016, rot=(rad(90), 0, 0), seg=32))
    adds.append(ellipsoid('medallion_boss', (0, -0.166, z0 + 1.10), (0.02, 0.01, 0.02), seg=12, rings=8))
    # arms reaching to the sword grip, hands stacked on it
    grip = Vector((0, -0.27, z0 + 0.985))
    for side in (-1, 1):
        S, E = Vector((side * 0.19, 0, z0 + 1.27)), Vector((side * 0.245, -0.07, z0 + 1.07))
        W = Vector((side * 0.06, -0.245, z0 + (1.01 if side < 0 else 0.955)))
        adds.append(tube('arm', [S, E], [0.052, 0.05], seg=16))
        adds.append(tube('forearm', [E, W], [0.048, 0.04], seg=16))
        adds.append(seg_cyl('cuff', E.lerp(W, 0.62), E.lerp(W, 0.78), 0.048, 0.06, seg=24))
    for zz, rz in ((z0 + 1.02, rad(-8)), (z0 + 0.95, rad(8))):
        adds.append(box('fist', (0, -0.27, zz), (0.085, 0.07, 0.06), rot=(0, 0, rz), bevel=0.02, bevel_segs=3))
        adds.append(ellipsoid('knuckle', (0, -0.302, zz), (0.04, 0.012, 0.025)))
    # head with stern face, beard, moustache, hair
    adds.append(cyl('neck', (0, 0, z0 + 1.40), 0.05, 0.048, 0.1))
    hc = Vector((0, -0.01, z0 + 1.50))
    adds.append(ellipsoid('head', hc, (0.092, 0.10, 0.11)))
    face_features(hc + Vector((0, -0.008, 0.008)), 1.26, adds, cuts, eyes, brow_angry=0.32, eye_sep=0.028)
    adds.append(ellipsoid('hair', hc + Vector((0, 0.035, -0.035)), (0.098, 0.082, 0.11)))
    for k in range(7):
        x = (k - 3) * 0.022
        top = Vector((x, -0.085 + abs(x) * 0.6, z0 + 1.435))
        pts = bez(top, top + Vector((x * 0.2, -0.04, -0.06)), top + Vector((x * 0.3, -0.06, -0.14)),
                  Vector((x * 0.5, -0.135 + abs(x) * 0.5, z0 + 1.25 + abs(x) * 0.6)), 10)
        adds.append(tube('beard', pts, [(0.03, 0.023)] * 4 + [(0.028, 0.021), (0.025, 0.018), (0.02, 0.015),
                                                            (0.013, 0.01), (0.008, 0.006), (0.003, 0.003)],
                         seg=10, ref=(1, 0, 0), twist=1.2))
    for side in (-1, 1):
        m0 = hc + Vector((0, -0.112, -0.04))
        adds.append(tube('moustache', bez(m0, m0 + Vector((side * 0.03, -0.006, -0.002)),
                                          m0 + Vector((side * 0.05, 0.0, -0.02)), m0 + Vector((side * 0.06, 0.01, -0.05)), 8),
                         taper(8, 0.012, 0.004), seg=10))
    # crown with arches, orb and cross
    zb = z0 + 1.555
    crown(zb, 0.06, 0.096, 0.08, 8, adds, tall=0.12, short=0.075)
    adds.append(ellipsoid('cap', (0, 0, zb + 0.07), (0.085, 0.085, 0.085)))
    for a in (0.0, math.pi / 2):
        pts = [Vector((math.cos(a) * 0.09 * math.cos(t), math.sin(a) * 0.09 * math.cos(t), zb + 0.07 + 0.12 * math.sin(t)))
               for t in [math.pi * i / 20 for i in range(21)]]
        adds.append(tube('arch', pts, [(0.013, 0.009)] * 21, seg=10, ref=(0, 0, 1)))
    adds.append(ellipsoid('orb', (0, 0, zb + 0.205), (0.026, 0.026, 0.026), seg=20, rings=12))
    adds.append(box('cross_v', (0, 0, zb + 0.275), (0.024, 0.024, 0.11), bevel=0.005))
    adds.append(box('cross_h', (0, 0, zb + 0.29), (0.075, 0.024, 0.024), bevel=0.005))
    # greatsword held point-down in front (weapon, pivot at the grip)
    weapon = blade_parts(0.86, 0.085, 0.022, 0.34, 0.034, 0.16, prefix='gs')
    wM = Matrix.Translation(grip) @ Euler((rad(176), 0, 0)).to_matrix().to_4x4()
    for p in weapon:
        xform(p, wM)
    ok = lambda co: co.z > 0.004 and not (co.z > z0 + 1.38 and co.y < 0)
    return dict(adds=adds, cuts=cuts, eyes=eyes, post_adds=post, weapon=weapon, grip=grip, chip_ok=ok, chips=30,
                chip_size=0.024, weapon_voxel=0.003)
