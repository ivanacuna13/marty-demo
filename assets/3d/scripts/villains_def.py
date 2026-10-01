"""Seated giant villains for Wizard's Chess (built facing -Y; figure's left = +X here).

Each build_<name>() returns a V with:
  nodes: {node: (parent, pivot)}   pivots in world space (pre-fit)
  parts: mesh parts, each attached to a node
Meshes named like the node ('throne', 'legs') become that node themselves.
"""
import math, random
from mathutils import Vector, Matrix, Euler
from wc_lib import *

rad = math.radians
SEAT = 1.85
ARM_TOP = 2.85


class V:
    def __init__(self):
        self.nodes = {}
        self.parts = []

    def node(self, name, parent, pivot):
        self.nodes[name] = (parent, Vector(pivot))

    def part(self, name, node, adds, cuts=(), mat='stone', w=1.0, mode='sculpt', voxel=0.016,
             chips=0, chip_size=0.08, wear=1.0, post_adds=None):
        self.parts.append(dict(name=name, node=node, adds=[a for a in adds if a], cuts=list(cuts), mat=mat, w=w,
                               mode=mode, voxel=voxel, chips=chips, chip_size=chip_size, wear=wear,
                               post_adds=post_adds))

    def ancestor(self, n, a):
        p = self.nodes[n][0]
        while p:
            if p == a:
                return True
            p = self.nodes[p][0]
        return False

    def order(self):
        out, seen = [], set()

        def visit(n):
            if n in seen:
                return
            p = self.nodes[n][0]
            if p:
                visit(p)
            seen.add(n)
            out.append(n)
        for n in self.nodes:
            visit(n)
        return out


# --------------------------------------------------------------------------- skeleton
class Rig:
    """Standard seated pose. sx widens the shoulders/torso."""

    def __init__(self, sx=1.0, head_z=5.2, head_y=0.42):
        self.HP = Vector((0, 0.55, 2.2))
        self.NP = Vector((0, 0.58, 4.62))
        self.HC = Vector((0, head_y, head_z))
        self.JP = self.HC + Vector((0, -0.02, -0.26))
        self.S = {s: Vector((s * 1.12 * sx, 0.6, 4.25)) for s in (-1, 1)}
        self.E = {s: Vector((s * 1.86, 0.72, 3.22)) for s in (-1, 1)}
        self.W = {s: Vector((s * 1.93, -0.70, 3.16)) for s in (-1, 1)}
        self.PC = {s: Vector((s * 1.93, -0.92, 3.10)) for s in (-1, 1)}

    def nodes(self, v, root_parts=('throne', 'legs')):
        for n in root_parts:
            v.node(n, None, (0, 0, 0))
        v.node('body', None, self.HP)
        v.node('head', 'body', self.NP)
        v.node('jaw', 'head', self.JP)
        for s, L in ((1, 'L'), (-1, 'R')):
            v.node('arm_' + L, 'body', self.S[s])
            v.node('fore_' + L, 'arm_' + L, self.E[s])


def side_name(s):
    return 'L' if s > 0 else 'R'


def resting_fingers(v, rig, s, r, length, claw=0.0, segs_style='plain', w=0.12, extra=None):
    """Four fingers over the front edge of the armrest; finger_X_0 = index (inner side)."""
    L = side_name(s)
    pc = rig.PC[s]
    for i in range(4):
        x = pc.x - s * (0.20 - i * 0.13)          # index nearest the body
        k = Vector((x, pc.y - 0.20, pc.z + 0.02 - 0.012 * abs(i - 1.5)))
        ln = length * (0.86 if i == 3 else 1.0 if i in (1, 2) else 0.95)
        pts = bez(k, k + Vector((0, -ln * 0.42, 0.02)), k + Vector((0, -ln * 0.66, -ln * 0.28)),
                  k + Vector((0, -ln * 0.60, -ln * 0.72)), 12)
        rr = taper(12, r, r * 0.72)
        if claw:
            rr[-3:] = [r * 0.6, r * 0.4, r * 0.05]
            pts[-1] = pts[-1] + (pts[-1] - pts[-2]).normalized() * claw
        adds = [tube('finger', pts, rr, seg=14)]
        for t in (0, 5, 9):
            adds.append(ellipsoid('knuckle', pts[t], (r * 1.12, r * 1.12, r * 1.05), seg=12, rings=8))
        if segs_style == 'armour':
            for t in (2, 7):
                adds.append(seg_cyl('fplate', pts[t], pts[t + 2], r * 1.25, r * 1.15, seg=12))
        if extra:
            adds += extra(pts, r)
        name = 'finger_%s_%d' % (L, i)
        v.node(name, 'fore_' + L, k)
        v.part(name + '_geo', name, adds, w=w, voxel=0.012)


def grip_fingers(v, s, axis_xy, zc, r_obj, r, w=0.12, claw=0.0, armour=False):
    """Four fingers wrapped round a vertical haft at axis_xy; knuckles on its front-inner side."""
    L = side_name(s)
    cx, cy = axis_xy
    R = r_obj + r * 0.9
    for i in range(4):
        z = zc + (1.5 - i) * r * 2.25
        a0 = math.atan2(-1.0, -s * 0.55)             # front-inner
        angs = [a0 + (-s) * k * rad(28) for k in range(9)]  # wrap toward the outside/back
        pts = [Vector((cx + R * math.cos(a), cy + R * math.sin(a), z - 0.01 * k)) for k, a in enumerate(angs)]
        rr = taper(9, r, r * 0.75)
        if claw:
            rr[-1] = r * 0.1
        adds = [tube('gfinger', pts, rr, seg=14)]
        for t in (0, 4):
            adds.append(ellipsoid('knuckle', pts[t], (r * 1.12, r * 1.12, r * 1.05), seg=12, rings=8))
        if armour:
            adds.append(seg_cyl('fplate', pts[1], pts[3], r * 1.25, r * 1.15, seg=12))
        name = 'finger_%s_%d' % (L, i)
        v.node(name, 'fore_' + L, pts[0])
        v.part(name + '_geo', name, adds, w=w, voxel=0.012)


def eye_pair(c, sep, size, rot=0.0):
    return [ellipsoid('eye', c + Vector((s * sep, 0, 0)), size, rot=(0, s * rot, 0), seg=16, rings=10)
            for s in (-1, 1)]


def horn(base, ctrl1, ctrl2, tip, r0, n=18, ridges=24, name='horn'):
    pts = bez(base, ctrl1, ctrl2, tip, n)
    rr = [r0 * (1 - i / (n - 1)) ** 0.85 * (1 + 0.07 * math.sin(i / (n - 1) * ridges)) + 0.004 for i in range(n)]
    return tube(name, pts, rr, seg=18)


def ragged(t, z, r, amp=0.04, freq=13, seed=0.0):
    return r * (1 + amp * math.sin(freq * t + seed) + amp * 0.5 * math.sin(freq * 2.7 * t + 2 * seed))


# --------------------------------------------------------------------------- thrones
def throne_block(v, style, deco):
    """Common throne volume; deco(adds, cuts) adds the villain-specific dressing."""
    adds, cuts, post = [], [], []
    adds.append(box('platform', (0, 0.35, 0.175), (4.9, 4.7, 0.35), bevel=0.06))
    adds.append(box('step', (0, -2.05, 0.09), (4.3, 0.6, 0.18), bevel=0.04))
    adds.append(box('seat', (0, 0.6, 1.1), (3.3, 2.8, 1.5), bevel=0.06))
    adds.append(box('seat_lip', (0, -0.8, SEAT - 0.06), (3.36, 0.12, 0.14), bevel=0.04))
    adds.append(box('back', (0, 2.05, 4.3), (3.4, 0.6, 5.0), bevel=0.06))
    for s in (-1, 1):
        adds.append(box('side', (s * 1.95, 0.4, 1.6), (0.56, 3.0, 2.5), bevel=0.05))
        adds.append(box('armrest', (s * 1.95, 0.35, ARM_TOP - 0.1), (0.66, 3.2, 0.2), bevel=0.05))
        cuts.append(box('side_panel', (s * 2.25, 0.4, 1.55), (0.1, 2.3, 1.7)))
        adds.append(box('back_post', (s * 1.85, 2.05, 3.6), (0.5, 0.75, 7.2 - 0.0), bevel=0.06))
    cuts.append(box('seat_panel', (0, -0.82, 1.05), (2.6, 0.1, 1.05)))
    deco(adds, cuts, post)
    v.part('throne', 'throne', adds, cuts, w=11.0, voxel=0.024, chips=26, chip_size=0.14, wear=1.6,
           post_adds=post)


# --------------------------------------------------------------------------- legs
def seated_legs(v, rig, thigh_r=0.36, shin_r=0.28, extra=None, w=5.0):
    adds = []
    for s in (-1, 1):
        hip = Vector((s * 0.52, 0.5, 2.18))
        knee = Vector((s * 0.66, -1.05, 2.1))
        ankle = Vector((s * 0.70, -1.30, 0.62))
        adds.append(tube('thigh', bez(hip, hip + Vector((0, -0.5, 0.05)), knee + Vector((0, 0.5, 0.05)), knee, 10),
                         taper(10, thigh_r, thigh_r * 0.86), seg=24))
        adds.append(ellipsoid('knee', knee, (shin_r * 1.15, shin_r * 1.15, shin_r * 1.15)))
        adds.append(tube('shin', [knee, knee.lerp(ankle, 0.4) + Vector((0, -0.05, 0)), ankle],
                         [shin_r, shin_r * 1.02, shin_r * 0.78], seg=24))
        if extra:
            adds += extra(s, hip, knee, ankle)
    v.part('legs', 'legs', adds, w=w, voxel=0.018, chips=6, chip_size=0.07)


def boot(s, ankle, toe_len=0.55, r=0.24, pointed=False):
    out = [ellipsoid('heel', ankle + Vector((0, 0.05, -0.12)), (r, r * 1.1, r * 0.75))]
    toe = ankle + Vector((0, -toe_len, -0.17))
    out.append(tube('foot', [ankle + Vector((0, 0, -0.1)), ankle + Vector((0, -toe_len * 0.6, -0.16)), toe],
                    [(r, r * 0.8), (r * 0.95, r * 0.6), (r * (0.25 if pointed else 0.7), r * (0.2 if pointed else 0.5))],
                    seg=20, ref=(1, 0, 0)))
    if pointed:
        out.append(tube('toe_curl', bez(toe, toe + Vector((0, -0.18, 0.02)), toe + Vector((0, -0.28, 0.15)),
                                        toe + Vector((0, -0.2, 0.28)), 8), taper(8, r * 0.25, 0.01), seg=10))
    return out


# =========================================================================== MALVORN
def build_malvorn():
    v = V()
    rig = Rig(sx=1.0, head_z=5.22)
    rig.nodes(v)

    def deco(adds, cuts, post):
        # gothic spires, pointed arch back, skull knobs, side spikes
        for x, h in ((0, 2.2), (-1.85, 1.2), (1.85, 1.2)):
            adds.append(cyl('spire', (x, 2.05, 6.85 + h / 2 if x == 0 else 7.2 + h / 2), 0.32 if x == 0 else 0.22,
                            0.02, h, seg=8))
            adds.append(ellipsoid('finial', (x, 2.05, 6.9 if x == 0 else 7.25), (0.3, 0.3, 0.16), seg=16, rings=8))
        adds.append(cyl('arch_top', (0, 2.05, 6.85), 1.7, 0.4, 0.9, seg=4, rot=(0, 0, rad(45))))
        cuts.append(box('arch_recess', (0, 1.72, 4.6), (2.2, 0.2, 3.4)))
        cuts.append(cyl('arch_round', (0, 1.72, 6.3), 1.1, 0.05, 1.1, seg=24, rot=(rad(90), 0, 0)))
        for s in (-1, 1):
            k = Vector((s * 1.95, -1.15, ARM_TOP + 0.18))
            adds.append(ellipsoid('skull_knob', k, (0.28, 0.3, 0.27)))
            adds.append(ellipsoid('skull_jaw', k + Vector((0, -0.08, -0.2)), (0.18, 0.2, 0.12)))
            for e in (-1, 1):
                cuts.append(ellipsoid('skull_eye', k + Vector((e * 0.1, -0.27, 0.04)), (0.07, 0.08, 0.07)))
            for z in (2.6, 3.4, 4.2, 5.0, 5.8, 6.6):
                adds.append(seg_cyl('side_spike', (s * 2.08, 2.05, z), (s * 2.6, 2.0, z + 0.25), 0.11, 0.01, seg=8))
    throne_block(v, 'gothic', deco)

    def leg_extra(s, hip, knee, ankle):
        out = [seg_cyl('cuisse', hip.lerp(knee, 0.15), hip.lerp(knee, 0.85), 0.4, 0.37, seg=24),
               ellipsoid('poleyn', knee + Vector((0, -0.12, 0.05)), (0.3, 0.2, 0.3)),
               seg_cyl('knee_spike', knee + Vector((0, -0.25, 0.1)), knee + Vector((0, -0.65, 0.35)), 0.11, 0.01, seg=8),
               seg_cyl('greave', knee.lerp(ankle, 0.15), knee.lerp(ankle, 0.95), 0.32, 0.27, seg=24)]
        out += boot(s, ankle, 0.6, 0.27, pointed=False)
        out.append(seg_cyl('sabaton_tip', ankle + Vector((0, -0.55, -0.15)), ankle + Vector((0, -0.85, -0.12)), 0.12, 0.01))
        return out
    seated_legs(v, rig, 0.33, 0.25, leg_extra)

    # ---- torso: black spiked armour with a ribcage breastplate
    adds, cuts = [], []
    prof = [(0.0, 2.0), (0.78, 2.0), (0.80, 2.3), (0.74, 2.33), (0.80, 2.6), (0.74, 2.63), (0.84, 2.95),
            (0.96, 3.4), (1.06, 3.85), (1.02, 4.2), (0.80, 4.45), (0.38, 4.62), (0.0, 4.65)]
    adds.append(lathe('cuirass', [(r, z) for r, z in prof], seg=72, loc=(0, 0.6, 0), scale=(1, 0.72, 1)))
    adds.append(tube('sternum', [(0, -0.12, 3.0), (0, -0.17, 3.55), (0, -0.12, 4.15)], [0.07, 0.08, 0.07], seg=12))
    for k in range(5):
        z = 3.2 + k * 0.2
        for s in (-1, 1):
            adds.append(tube('rib', bez((0, -0.14, z), (s * 0.45, -0.18, z - 0.06), (s * 0.85, 0.05, z - 0.2),
                                        (s * 0.98, 0.45, z - 0.32), 12), taper(12, 0.06, 0.04), seg=10))
    adds.append(torus('belt', (0, 0.6, 2.32), 0.8, 0.07, scale=(1, 0.74, 1), seg=64, rseg=10))
    adds.append(ellipsoid('belt_skull', (0, -0.02, 2.33), (0.2, 0.12, 0.2)))
    for e in (-1, 1):
        cuts.append(ellipsoid('belt_skull_eye', (e * 0.07, -0.13, 2.36), (0.05, 0.05, 0.045)))
    for s in (-1, 1):
        f = lathe('fauld', [(0.86, 2.3), (0.95, 2.05), (0.92, 2.02), (1.0, 1.85)], seg=10,
                  arc=(rad(-90) + s * rad(15), rad(-90) + s * rad(60)), loc=(0, 0.6, 0), scale=(1, 0.8, 1))
        adds.append(solidify(f, 0.06, -1))
    # gorget / high spiked collar
    col = lathe('collar', [(0.42, 4.45), (0.52, 4.7), (0.62, 4.95)], seg=32, arc=(rad(-20), rad(200)), loc=(0, 0.6, 0),
                mod=lambda t, z, r: r * (1 + (0.18 * max(0, math.sin(9 * t)) ** 3 if z > 4.9 else 0)))
    adds.append(solidify(col, 0.07, -1))
    # spiked pauldrons
    for s in (-1, 1):
        c = Vector((s * 1.12, 0.6, 4.32))
        prof = [(0, 0.42), (0.25, 0.4), (0.4, 0.33), (0.45, 0.27), (0.42, 0.25), (0.53, 0.17), (0.5, 0.15),
                (0.62, 0.05), (0.58, 0.02), (0.66, -0.1), (0.6, -0.12), (0, -0.12)]
        p = lathe('pauldron', prof, seg=40)
        xform(p, Matrix.Translation(c) @ Euler((0, s * rad(50), 0)).to_matrix().to_4x4())
        adds.append(p)
        for k, (dy, l) in enumerate(((-0.25, 0.65), (0.05, 0.85), (0.35, 0.6))):
            b = c + Vector((s * 0.3, dy, 0.3))
            adds.append(seg_cyl('pspike', b, b + Vector((s * 0.35, dy * 0.4, l)), 0.12, 0.012, seg=8))
    v.part('torso', 'body', adds, cuts, w=8.0, voxel=0.015, chips=10, chip_size=0.08)

    # ---- tattered cloak
    adds, cuts = [], []
    cl = lathe('cloak', [(0.62, 4.62), (0.95, 4.45), (1.2, 4.0), (1.35, 3.2), (1.42, 2.4), (1.48, 1.95)], seg=72,
               arc=(rad(-28), rad(208)), loc=(0, 0.75, 0), mod=lambda t, z, r: ragged(t, z, r, 0.05, 11))
    adds.append(solidify(cl, 0.07, 1))
    rnd = random.Random(3)
    for i in range(26):
        a = rad(-28) + rad(236) * (i + 0.5) / 26
        r = 1.5
        h = rnd.uniform(0.25, 0.75)
        cuts.append(box('tatter', (r * math.cos(a), 0.75 + r * math.sin(a), 1.95 + h * 0.35),
                        (0.22, 0.6, h), rot=(0, rnd.uniform(-0.4, 0.4), a + math.pi / 2)))
    for i in range(6):
        a = rnd.uniform(rad(10), rad(170))
        z = rnd.uniform(2.6, 3.8)
        cuts.append(ellipsoid('hole', (1.4 * math.cos(a), 0.75 + 1.4 * math.sin(a), z), (0.1, 0.1, 0.16)))
    v.part('cloak', 'body', adds, cuts, w=4.0, voxel=0.018)

    # ---- head: skull face, hood, spiked crown, curved horns
    HC = rig.HC
    adds, cuts = [], []
    adds.append(ellipsoid('cranium', HC + Vector((0, 0.06, 0.1)), (0.42, 0.48, 0.45)))
    adds.append(ellipsoid('maxilla', HC + Vector((0, -0.2, -0.12)), (0.32, 0.26, 0.24)))
    for s in (-1, 1):
        adds.append(ellipsoid('zygoma', HC + Vector((s * 0.27, -0.22, -0.06)), (0.12, 0.14, 0.08)))
        cuts.append(ellipsoid('socket', HC + Vector((s * 0.15, -0.42, 0.0)), (0.12, 0.16, 0.1), rot=(0, s * -0.2, 0)))
        cuts.append(ellipsoid('temple', HC + Vector((s * 0.36, -0.12, -0.02)), (0.06, 0.14, 0.1)))
    adds.append(tube('brow', bez(HC + Vector((-0.32, -0.3, 0.1)), HC + Vector((-0.1, -0.47, 0.16)),
                                  HC + Vector((0.1, -0.47, 0.16)), HC + Vector((0.32, -0.3, 0.1)), 12),
                     [0.06] * 12, seg=10))
    cuts.append(ellipsoid('nasal', HC + Vector((0, -0.45, -0.13)), (0.065, 0.1, 0.085), rot=(rad(-15), 0, 0)))
    for i in range(10):
        a = rad(-90) + (i - 4.5) * rad(10)
        p = HC + Vector((0.27 * math.cos(a), 0.27 * math.sin(a) - 0.1, -0.31))
        adds.append(box('tooth', p, (0.045, 0.05, 0.08), rot=(0, 0, a + math.pi / 2), bevel=0.012))
    hood = ellipsoid('hood', HC + Vector((0, 0.1, 0.06)), (0.6, 0.64, 0.62), seg=48, rings=24)
    hood = boolean(hood, [ellipsoid('hood_open', HC + Vector((0, -0.52, -0.05)), (0.42, 0.42, 0.5)),
                          ellipsoid('hood_inner', HC + Vector((0, 0.05, 0.02)), (0.5, 0.52, 0.52))])
    adds.append(hood)
    post = []
    adds.append(lathe('hood_drape', [(0.0, HC.z - 0.25), (0.55, HC.z - 0.25), (0.66, HC.z - 0.45), (0.0, HC.z - 0.5)],
                      seg=48, loc=(0, HC.y + 0.15, 0)))
    zb = HC.z + 0.42
    post.append(lathe('crown_band', [(0.5, zb), (0.6, zb), (0.62, zb + 0.06), (0.58, zb + 0.18), (0.5, zb + 0.18)],
                      seg=64, loc=(0, HC.y + 0.08, 0), scale=(1, 1.04, 1)))
    for i in range(9):
        a = rad(-90) + TAU * i / 9
        h = 0.5 if i == 0 else (0.38 if i in (1, 8) else 0.26)
        b = Vector((0.57 * math.cos(a), HC.y + 0.08 + 0.59 * math.sin(a), zb + 0.12))
        post.append(seg_cyl('crown_spike', b, b + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, h)), 0.08, 0.008, seg=6))
    for s in (-1, 1):
        b = HC + Vector((s * 0.48, 0.05, 0.22))
        post.append(horn(b, b + Vector((s * 0.45, 0.05, 0.12)), b + Vector((s * 0.75, 0.4, 0.5)),
                         b + Vector((s * 0.62, 0.62, 0.95)), 0.15))
    v.part('head_geo', 'head', adds, cuts, w=7.0, voxel=0.011, post_adds=post)
    v.part('eyes', 'head', eye_pair(HC + Vector((0, -0.335, 0.0)), 0.15, (0.075, 0.04, 0.055), 0.2),
           mat='glow', w=0.5, mode='smooth')
    # ---- jaw: mandible with lower teeth
    adds = []
    J = rig.JP
    mand = [J + Vector((0.3, 0.04, 0.0)), J + Vector((0.3, -0.12, -0.16)), J + Vector((0.18, -0.32, -0.22)),
            J + Vector((0, -0.38, -0.22)), J + Vector((-0.18, -0.32, -0.22)), J + Vector((-0.3, -0.12, -0.16)),
            J + Vector((-0.3, 0.04, 0.0))]
    adds.append(tube('mandible', mand, [0.06, 0.08, 0.08, 0.09, 0.08, 0.08, 0.06], seg=14))
    adds.append(ellipsoid('chin', J + Vector((0, -0.38, -0.25)), (0.12, 0.08, 0.08)))
    for i in range(8):
        a = rad(-90) + (i - 3.5) * rad(11)
        p = J + Vector((0.25 * math.cos(a), 0.25 * math.sin(a) - 0.12, -0.12))
        adds.append(box('ltooth', p, (0.04, 0.045, 0.08), rot=(0, 0, a + math.pi / 2), bevel=0.01))
    v.part('jaw_geo', 'jaw', adds, w=1.5, voxel=0.01)

    # ---- arms: armoured, spiked, clawed gauntlets
    for s in (-1, 1):
        L = side_name(s)
        S, E, W = rig.S[s], rig.E[s], rig.W[s]
        adds = [tube('uarm', [S, S.lerp(E, 0.5), E], [0.27, 0.26, 0.24], seg=24)]
        for k in range(3):
            adds.append(seg_cyl('rerebrace', S.lerp(E, 0.3 + 0.17 * k), S.lerp(E, 0.42 + 0.17 * k), 0.31 - 0.01 * k, 0.29, seg=24))
        v.part('upperarm_' + L, 'arm_' + L, adds, w=2.0, voxel=0.014)
        adds = [tube('farm', [E, E.lerp(W, 0.5), W], [0.24, 0.24, 0.2], seg=24),
                ellipsoid('couter', E, (0.3, 0.3, 0.3)),
                seg_cyl('couter_spike', E + Vector((0, 0.2, 0.05)), E + Vector((s * 0.15, 0.75, 0.25)), 0.12, 0.01, seg=8),
                seg_cyl('vambrace', E.lerp(W, 0.15), E.lerp(W, 0.85), 0.29, 0.25, seg=24),
                seg_cyl('cuff', E.lerp(W, 0.82), W + Vector((0, -0.05, 0)), 0.3, 0.33, seg=24),
                box('palm', rig.PC[s] + Vector((0, 0.05, 0)), (0.5, 0.42, 0.2), bevel=0.07),
                tube('thumb', bez(rig.PC[s] + Vector((-s * 0.22, 0.05, 0)), rig.PC[s] + Vector((-s * 0.36, -0.12, -0.02)),
                                  rig.PC[s] + Vector((-s * 0.36, -0.28, -0.1)), rig.PC[s] + Vector((-s * 0.3, -0.36, -0.2)), 8),
                     taper(8, 0.075, 0.04), seg=12)]
        for k in range(3):
            b = E.lerp(W, 0.3 + 0.2 * k) + Vector((0, 0, 0.26))
            adds.append(seg_cyl('vspike', b, b + Vector((s * 0.1, 0.12, 0.35)), 0.075, 0.008, seg=8))
        v.part('forearm_' + L, 'fore_' + L, adds, w=2.6, voxel=0.013)
        resting_fingers(v, rig, s, 0.072, 0.5, claw=0.14, segs_style='armour', w=0.35)
    return v


# =========================================================================== GRUKK
def build_grukk():
    v = V()
    rig = Rig(sx=1.18, head_z=5.12, head_y=0.25)
    rig.nodes(v)
    AX = (2.48, -1.0)

    def deco(adds, cuts, post):
        # crude, heavy blocks; great curved horns on the back; skulls on the arm posts
        adds.append(box('back_cap', (0, 2.05, 6.95), (3.8, 0.8, 0.5), bevel=0.08))
        for s in (-1, 1):
            b = Vector((s * 1.4, 2.0, 7.1))
            adds.append(horn(b, b + Vector((s * 0.6, 0, 0.3)), b + Vector((s * 1.25, -0.3, 0.9)),
                             b + Vector((s * 0.95, -0.7, 1.55)), 0.32, name='throne_horn'))
            k = Vector((s * 1.95, -1.1, ARM_TOP + 0.2))
            adds.append(ellipsoid('skull_knob', k, (0.3, 0.32, 0.28)))
            for e in (-1, 1):
                cuts.append(ellipsoid('skull_eye', k + Vector((e * 0.11, -0.29, 0.03)), (0.08, 0.08, 0.075)))
            for z in (1.0, 2.0):
                post.append(torus('lash', (s * 1.95, -1.05, z), 0.33, 0.045, rot=(0, rad(90), 0), scale=(1, 1, 1),
                                  seg=24, rseg=6))
        adds.append(ellipsoid('back_skull', (0, 1.72, 6.3), (0.45, 0.4, 0.5)))
        for e in (-1, 1):
            cuts.append(ellipsoid('bs_eye', (e * 0.17, 1.35, 6.35), (0.12, 0.12, 0.11)))
        for i in range(7):
            cuts.append(box('crack', (random.Random(i).uniform(-1.3, 1.3), 1.74, random.Random(i + 9).uniform(2.6, 5.6)),
                            (0.04, 0.2, random.Random(i + 4).uniform(0.4, 0.9)),
                            rot=(0, random.Random(i + 2).uniform(-0.6, 0.6), 0)))
    throne_block(v, 'crude', deco)

    def leg_extra(s, hip, knee, ankle):
        out = []
        for k in range(3):
            out.append(torus('wrap', knee.lerp(ankle, 0.25 + 0.2 * k), 0.33, 0.05, rot=(rad(12), 0, 0), seg=32, rseg=8))
        out.append(ellipsoid('fur_cuff', ankle + Vector((0, 0, 0.12)), (0.38, 0.38, 0.2)))
        out += boot(s, ankle, 0.62, 0.32)
        return out
    seated_legs(v, rig, 0.46, 0.36, leg_extra, w=5.5)

    # ---- torso: barrel chest, belly, fur mantle, crossed straps, loincloth
    adds = [ellipsoid('belly', (0, 0.3, 2.75), (1.12, 0.98, 0.9)),
            ellipsoid('chest', (0, 0.5, 3.72), (1.3, 0.86, 0.85)),
            ellipsoid('pec_l', (0.48, -0.2, 3.72), (0.5, 0.25, 0.38)),
            ellipsoid('pec_r', (-0.48, -0.2, 3.72), (0.5, 0.25, 0.38)),
            ellipsoid('traps', (0, 0.62, 4.3), (0.95, 0.6, 0.4)),
            torus('belt', (0, 0.35, 2.32), 1.02, 0.1, scale=(1, 0.86, 1), seg=64, rseg=10),
            box('loincloth', (0, -0.62, 1.82), (0.75, 0.12, 0.95), rot=(rad(-6), 0, 0), bevel=0.04)]
    fur = torus('fur', (0, 0.58, 4.32), 1.0, 0.36, scale=(1.05, 0.72, 0.85), seg=48, rseg=16)
    adds.append(fur)
    for s in (-1, 1):
        adds.append(tube('strap', [(s * 0.95, 0.3, 4.1), (s * 0.3, -0.31, 3.45), (-s * 0.55, -0.42, 2.75),
                                   (-s * 1.0, 0.0, 2.4)], [(0.12, 0.035)] * 4, seg=8, ref=(0, 1, 0)))
        c = Vector((s * 1.3, 0.6, 4.35))
        p = lathe('pauldron', [(0, 0.38), (0.32, 0.35), (0.5, 0.25), (0.6, 0.08), (0.62, -0.12), (0, -0.12)], seg=40)
        xform(p, Matrix.Translation(c) @ Euler((0, s * rad(55), 0)).to_matrix().to_4x4())
        adds.append(p)
        for k in range(6):
            a = TAU * k / 6
            q = Matrix.Translation(c) @ Euler((0, s * rad(55), 0)).to_matrix().to_4x4() @ \
                Vector((0.5 * math.cos(a), 0.5 * math.sin(a), 0.27))
            adds.append(ellipsoid('rivet', q, (0.06, 0.06, 0.06), seg=10, rings=6))
    adds.append(ellipsoid('buckle_skull', (0, -0.55, 2.35), (0.22, 0.13, 0.22)))
    cuts = [ellipsoid('bsk_eye', (e * 0.08, -0.67, 2.38), (0.055, 0.05, 0.05)) for e in (-1, 1)]
    cuts.append(ellipsoid('navel', (0, -0.67, 2.78), (0.06, 0.05, 0.06)))
    v.part('torso', 'body', adds, cuts, w=9.0, voxel=0.016, chips=8, chip_size=0.08, wear=1.3)

    # ---- head: orc face under an iron helmet with forward-curving horns
    HC = rig.HC
    adds, cuts, post = [], [], []
    adds.append(ellipsoid('skull', HC + Vector((0, 0.05, 0.05)), (0.55, 0.55, 0.5)))
    adds.append(ellipsoid('muzzle', HC + Vector((0, -0.38, -0.18)), (0.36, 0.25, 0.22)))
    adds.append(tube('brow', bez(HC + Vector((-0.45, -0.3, 0.12)), HC + Vector((-0.2, -0.56, 0.06)),
                                  HC + Vector((0.2, -0.56, 0.06)), HC + Vector((0.45, -0.3, 0.12)), 12),
                     [0.11] * 12, seg=12))
    adds.append(ellipsoid('nose', HC + Vector((0, -0.6, -0.1)), (0.16, 0.12, 0.12)))
    for s in (-1, 1):
        cuts.append(ellipsoid('nostril', HC + Vector((s * 0.07, -0.7, -0.14)), (0.045, 0.06, 0.04)))
        adds.append(ellipsoid('cheek', HC + Vector((s * 0.3, -0.36, -0.08)), (0.16, 0.14, 0.12)))
        cuts.append(ellipsoid('socket', HC + Vector((s * 0.2, -0.5, -0.02)), (0.1, 0.1, 0.06), rot=(0, s * 0.25, 0)))
        ear = HC + Vector((s * 0.52, 0.05, -0.02))
        adds.append(tube('ear', bez(ear, ear + Vector((s * 0.25, 0.05, 0.05)), ear + Vector((s * 0.45, 0.15, 0.12)),
                                    ear + Vector((s * 0.6, 0.25, 0.22)), 8),
                         [(0.06, 0.16), (0.06, 0.14), (0.05, 0.11), (0.04, 0.08), (0.03, 0.06), (0.02, 0.04),
                          (0.01, 0.02), (0.004, 0.004)], seg=12, ref=(1, 0, 0)))
        for k in range(2):
            post.append(torus('earring', ear + Vector((s * (0.18 + 0.12 * k), 0.06, -0.12)), 0.06, 0.016,
                              rot=(0, rad(90), 0), seg=20, rseg=6))
    # iron helmet
    post.append(lathe('helm', [(0, HC.z + 0.62), (0.3, HC.z + 0.58), (0.5, HC.z + 0.42), (0.59, HC.z + 0.22),
                               (0.61, HC.z + 0.12), (0.66, HC.z + 0.1), (0.66, HC.z + 0.04), (0.56, HC.z + 0.03),
                               (0, HC.z + 0.03)], seg=64, loc=(0, HC.y + 0.04, 0), scale=(1, 1.02, 1)))
    post.append(box('nasal', HC + Vector((0, -0.62, 0.09)), (0.1, 0.06, 0.3), bevel=0.02))
    for i in range(12):
        a = TAU * i / 12
        post.append(ellipsoid('hrivet', (0.64 * math.cos(a), HC.y + 0.04 + 0.65 * math.sin(a), HC.z + 0.07),
                              (0.04, 0.04, 0.04), seg=8, rings=6))
    post.append(tube('helm_ridge', bez(HC + Vector((0, -0.55, 0.3)), HC + Vector((0, -0.3, 0.68)),
                                        HC + Vector((0, 0.3, 0.68)), HC + Vector((0, 0.6, 0.25)), 14),
                     [(0.05, 0.08)] * 14, seg=10, ref=(1, 0, 0)))
    for s in (-1, 1):
        b = HC + Vector((s * 0.55, 0.0, 0.35))
        post.append(horn(b, b + Vector((s * 0.55, 0.05, 0.0)), b + Vector((s * 0.95, -0.35, 0.3)),
                         b + Vector((s * 0.75, -0.75, 0.62)), 0.17))
    v.part('head_geo', 'head', adds, cuts, w=7.0, voxel=0.012, post_adds=post, chips=4, chip_size=0.05)
    v.part('eyes', 'head', eye_pair(HC + Vector((0, -0.455, -0.02)), 0.2, (0.06, 0.035, 0.035), 0.25),
           mat='glow', w=0.5, mode='smooth')
    # ---- jaw: heavy underbite with tusks
    J = rig.JP
    adds = [ellipsoid('jaw', J + Vector((0, -0.3, -0.12)), (0.42, 0.3, 0.17)),
            ellipsoid('lip', J + Vector((0, -0.55, -0.05)), (0.3, 0.08, 0.07))]
    for s in (-1, 1):
        b = J + Vector((s * 0.24, -0.5, -0.05))
        adds.append(tube('tusk', bez(b, b + Vector((s * 0.03, -0.05, 0.14)), b + Vector((s * 0.1, -0.06, 0.3)),
                                     b + Vector((s * 0.06, 0.02, 0.42)), 10), taper(10, 0.07, 0.008), seg=12))
    for k in (-1, 1):
        adds.append(box('ltooth', J + Vector((k * 0.09, -0.56, 0.03)), (0.05, 0.04, 0.07), bevel=0.012))
    v.part('jaw_geo', 'jaw', adds, w=1.6, voxel=0.011)

    # ---- arms
    for s in (-1, 1):
        L = side_name(s)
        S, E = rig.S[s], rig.E[s]
        if s > 0:  # left hand round the axe haft
            E = rig.E[s] = Vector((1.95, 0.45, 3.35))
            W = rig.W[s] = Vector((2.3, -0.72, 3.3))
            v.nodes['fore_L'] = ('arm_L', E)
        else:
            W = rig.W[s]
        adds = [tube('uarm', [S, S.lerp(E, 0.5) + Vector((s * 0.06, 0, 0)), E], [0.36, 0.38, 0.32], seg=24),
                ellipsoid('bicep', S.lerp(E, 0.45) + Vector((0, -0.12, 0)), (0.32, 0.3, 0.42))]
        v.part('upperarm_' + L, 'arm_' + L, adds, w=2.2, voxel=0.015)
        adds = [tube('farm', [E, E.lerp(W, 0.4) + Vector((0, 0, 0.04)), W], [0.32, 0.33, 0.25], seg=24),
                ellipsoid('elbow', E, (0.33, 0.33, 0.33)),
                seg_cyl('bracer', E.lerp(W, 0.45), E.lerp(W, 0.95), 0.36, 0.31, seg=24)]
        for k in range(3):
            b = E.lerp(W, 0.55 + 0.13 * k) + Vector((0, 0, 0.32))
            adds.append(seg_cyl('bspike', b, b + Vector((0, 0.05, 0.22)), 0.07, 0.008, seg=8))
        if s > 0:
            pc = Vector((AX[0] - 0.2, AX[1] + 0.05, 3.25))
            adds.append(box('palm', pc, (0.24, 0.5, 0.56), rot=(0, 0, rad(-20)), bevel=0.09))
            adds.append(tube('thumb', bez(pc + Vector((0, -0.1, 0.25)), pc + Vector((0.1, -0.25, 0.3)),
                                          Vector((AX[0] - 0.05, AX[1] - 0.2, 3.5)),
                                          Vector((AX[0] + 0.12, AX[1] - 0.18, 3.48)), 8), taper(8, 0.1, 0.07), seg=12))
        else:
            pc = rig.PC[s]
            adds.append(box('palm', pc + Vector((0, 0.05, 0)), (0.6, 0.5, 0.24), bevel=0.09))
            adds.append(tube('thumb', bez(pc + Vector((-s * 0.26, 0.05, 0)), pc + Vector((-s * 0.42, -0.14, -0.02)),
                                          pc + Vector((-s * 0.42, -0.32, -0.1)), pc + Vector((-s * 0.34, -0.4, -0.22)), 8),
                             taper(8, 0.1, 0.07), seg=12))
        v.part('forearm_' + L, 'fore_' + L, adds, w=2.8, voxel=0.014)
        if s > 0:
            grip_fingers(v, s, AX, 3.25, 0.13, 0.095, w=0.35)
        else:
            resting_fingers(v, rig, s, 0.095, 0.55, w=0.35)
    # ---- the huge axe (held in the left hand)
    hx, hy = AX
    adds = [cyl('haft', (hx, hy, 3.05), 0.13, 0.12, 5.4, seg=20)]
    for k in range(4):
        adds.append(torus('binding', (hx, hy, 2.65 - 0.2 * k), 0.14, 0.03, seg=24, rseg=6))
    adds.append(ellipsoid('pommel', (hx, hy, 0.42), (0.2, 0.2, 0.12)))
    head_z = 5.3
    adds.append(box('socket', (hx, hy, head_z), (0.34, 0.34, 0.7), bevel=0.05))
    adds.append(seg_cyl('top_spike', (hx, hy, head_z + 0.3), (hx, hy, head_z + 1.0), 0.13, 0.01, seg=8))
    for d in (-1, 1):
        bm = bmesh.new()
        outline = [(0.12, -0.25), (0.55, -0.42), (0.95, -0.82), (1.12, -0.6), (1.2, 0.0), (1.12, 0.6), (0.95, 0.82),
                   (0.55, 0.42), (0.12, 0.25)]
        vs_front = [bm.verts.new((0.06, d * u, w)) for u, w in outline]
        vs_back = [bm.verts.new((-0.06, d * u, w)) for u, w in outline]
        bm.faces.new(vs_front)
        bm.faces.new(list(reversed(vs_back)))
        n = len(outline)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((vs_front[i], vs_front[j], vs_back[j], vs_back[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bl = obj_from_bm('blade', bm)
        xform(bl, Matrix.Translation((hx, hy, head_z)))
        adds.append(bl)
        adds.append(tube('edge', [Vector((hx, hy + d * u, head_z + w)) for u, w in outline[2:7]],
                         [(0.03, 0.02)] * 5, seg=8, ref=(1, 0, 0)))
    v.part('axe', 'fore_L', adds, w=3.0, voxel=0.014, chips=8, chip_size=0.07)
    return v


# =========================================================================== MORWEN
def build_morwen():
    v = V()
    rig = Rig(sx=0.82, head_z=5.02, head_y=0.42)
    rig.nodes(v)
    ST = (-2.42, -1.0)

    def deco(adds, cuts, post):
        # roots and branches growing over the throne
        rnd = random.Random(5)
        for i in range(9):
            x = -1.5 + 3.0 * i / 8
            b = Vector((x, 1.78, 0.4))
            top = Vector((x * 1.1 + rnd.uniform(-0.2, 0.2), 1.85 + rnd.uniform(-0.1, 0.2), 6.6 + rnd.uniform(-0.5, 0.9)))
            mid1 = b.lerp(top, 0.35) + Vector((rnd.uniform(-0.35, 0.35), -0.12, 0))
            mid2 = b.lerp(top, 0.7) + Vector((rnd.uniform(-0.35, 0.35), -0.1, 0))
            pts = bez(b, mid1, mid2, top, 16)
            curl = bez(top, top + Vector((rnd.choice((-1, 1)) * 0.35, -0.1, 0.25)),
                       top + Vector((rnd.choice((-1, 1)) * 0.5, -0.2, 0.0)), top + Vector((0.0, -0.25, -0.15)), 8)[1:]
            adds.append(tube('root', pts + curl, taper(16, 0.2, 0.09) + taper(7, 0.08, 0.015), seg=14))
        for s in (-1, 1):
            b = Vector((s * 1.95, 1.9, ARM_TOP))
            pts = bez(b, b + Vector((s * 0.1, -1.0, 0.1)), b + Vector((s * 0.05, -2.6, 0.1)),
                      b + Vector((s * 0.25, -3.25, 0.45)), 14)
            adds.append(tube('arm_branch', pts, taper(14, 0.3, 0.12), seg=16))
            adds.append(ellipsoid('burl', b + Vector((s * 0.1, -3.1, 0.25)), (0.3, 0.3, 0.3)))
            for k in range(4):
                g = Vector((s * (1.75 + rnd.uniform(0, 0.4)), rnd.uniform(-1.2, 1.6), 0.35))
                adds.append(tube('leg_root', bez(g, g + Vector((0, 0, 0.8)), g + Vector((0, 0.1, 1.6)),
                                                 g + Vector((0, 0.2, ARM_TOP - 0.3)), 10), taper(10, 0.17, 0.1), seg=12))
        for k in range(6):
            cuts.append(ellipsoid('knot', (rnd.uniform(-1.4, 1.4), 1.74, rnd.uniform(2.5, 6)), (0.1, 0.1, 0.16)))
    throne_block(v, 'roots', deco)

    # ---- legs under a draped robe, pointed curling shoes
    def leg_extra(s, hip, knee, ankle):
        return boot(s, ankle, 0.55, 0.2, pointed=True)
    seated_legs(v, rig, 0.3, 0.22, leg_extra, w=3.0)
    adds = []
    sk = lathe('skirt', [(1.05, 2.25), (1.1, 2.1), (1.12, 1.4), (1.16, 0.85), (1.2, 0.62)], seg=48,
               arc=(rad(-160), rad(-20)), loc=(0, -0.05, 0), mod=lambda t, z, r: ragged(t, z, r, 0.06, 15))
    adds.append(solidify(sk, 0.07, -1))
    lap = lathe('lap', [(0.0, 2.38), (0.95, 2.38), (1.08, 2.25), (0.0, 2.1)], seg=48, loc=(0, -0.05, 0),
                scale=(1, 1.15, 1), mod=lambda t, z, r: ragged(t, z, r, 0.04, 9))
    adds.append(lap)
    v.part('robe_skirt', 'legs', adds, w=3.0, voxel=0.018)

    # ---- torso: gaunt, bodice, ragged shawl, charms
    adds, cuts = [], []
    prof = [(0, 2.05), (0.62, 2.05), (0.62, 2.4), (0.55, 2.9), (0.6, 3.4), (0.66, 3.9), (0.6, 4.25), (0.38, 4.5),
            (0.18, 4.62), (0, 4.62)]
    adds.append(lathe('bodice', prof, seg=64, loc=(0, 0.58, 0), scale=(1, 0.72, 1)))
    for k in range(5):
        z = 3.2 + k * 0.18
        for s in (-1, 1):
            cuts.append(tube('ribgroove', bez((s * 0.08, 0.1, z), (s * 0.3, 0.06, z - 0.03), (s * 0.48, 0.2, z - 0.1),
                                              (s * 0.55, 0.45, z - 0.15), 8), [0.025] * 8, seg=8))
    sh = lathe('shawl', [(0.2, 4.6), (0.6, 4.4), (0.82, 4.05), (0.9, 3.6), (0.92, 3.3)], seg=64,
               arc=(rad(-75), rad(255)), loc=(0, 0.58, 0), scale=(1, 0.85, 1),
               mod=lambda t, z, r: ragged(t, z, r, 0.06 if z < 3.7 else 0.01, 17))
    adds.append(solidify(sh, 0.05, 1))
    rnd = random.Random(11)
    for i in range(18):
        a = rad(-70) + rad(320) * i / 17
        cuts.append(box('shawl_tear', (0.92 * math.cos(a), 0.58 + 0.78 * math.sin(a), 3.3 + rnd.uniform(0.0, 0.2)),
                        (0.12, 0.4, rnd.uniform(0.25, 0.5)), rot=(0, rnd.uniform(-0.5, 0.5), a + math.pi / 2)))
    neck = bez((-0.32, 0.25, 4.45), (-0.2, -0.05, 4.1), (0.2, -0.05, 4.1), (0.32, 0.25, 4.45), 14)
    adds.append(tube('cord', neck, [0.025] * 14, seg=8))
    for k, p in enumerate(neck[2:-2:2]):
        if k % 2:
            adds.append(tube('bone', [p, p + Vector((0.02, -0.03, -0.2))], [0.035, 0.03], seg=8))
            adds.append(ellipsoid('bone_end', p + Vector((0.02, -0.03, -0.22)), (0.05, 0.04, 0.04), seg=10, rings=6))
        else:
            adds.append(ellipsoid('charm', p + Vector((0, -0.03, -0.1)), (0.06, 0.03, 0.08), seg=10, rings=6))
    v.part('torso', 'body', adds, cuts, w=7.0, voxel=0.014, chips=4, chip_size=0.06)

    # ---- head: gaunt hag, hooked nose, long hair, tall crooked hat
    HC = rig.HC
    adds, cuts, post = [], [], []
    adds.append(ellipsoid('skull', HC + Vector((0, 0.06, 0.08)), (0.36, 0.42, 0.42)))
    adds.append(ellipsoid('face', HC + Vector((0, -0.18, -0.1)), (0.27, 0.24, 0.3)))
    for s in (-1, 1):
        adds.append(ellipsoid('cheekbone', HC + Vector((s * 0.2, -0.3, -0.04)), (0.1, 0.08, 0.07)))
        cuts.append(ellipsoid('hollow', HC + Vector((s * 0.24, -0.32, -0.2)), (0.07, 0.1, 0.1)))
        cuts.append(ellipsoid('socket', HC + Vector((s * 0.12, -0.39, 0.03)), (0.08, 0.08, 0.05), rot=(0, s * 0.35, 0)))
        adds.append(ellipsoid('brow', HC + Vector((s * 0.13, -0.38, 0.1)), (0.1, 0.05, 0.035), rot=(0, s * -0.45, 0)))
    nose = bez(HC + Vector((0, -0.38, 0.04)), HC + Vector((0, -0.62, -0.02)), HC + Vector((0, -0.72, -0.22)),
               HC + Vector((0, -0.6, -0.32)), 12)
    adds.append(tube('nose', nose, [(0.05, 0.06), (0.06, 0.07), (0.065, 0.07), (0.06, 0.065), (0.055, 0.06),
                                    (0.05, 0.055), (0.045, 0.05), (0.04, 0.045), (0.035, 0.04), (0.03, 0.03),
                                    (0.02, 0.02), (0.008, 0.008)], seg=12, ref=(1, 0, 0)))
    adds.append(ellipsoid('wart', HC + Vector((0.05, -0.66, -0.1)), (0.03, 0.03, 0.03), seg=10, rings=6))
    adds.append(ellipsoid('upper_lip', HC + Vector((0, -0.38, -0.27)), (0.14, 0.06, 0.04)))
    rnd = random.Random(2)
    for s in (-1, 1):
        for k in range(5):
            b = HC + Vector((s * (0.3 + 0.03 * k), 0.05 + 0.08 * k, 0.12))
            pts = bez(b, b + Vector((s * 0.15, -0.05, -0.4)), b + Vector((s * 0.2, -0.1 + rnd.uniform(-0.1, 0.1), -0.9)),
                      b + Vector((s * (0.15 + rnd.uniform(0, 0.15)), -0.05, -1.35 - rnd.uniform(0, 0.25))), 12)
            post.append(tube('hair', pts, taper(12, 0.07, 0.015), seg=10, twist=2.0))
    # hat
    hz = HC.z + 0.3
    post.append(lathe('brim', [(0.0, hz - 0.02), (0.95, hz - 0.03), (1.0, hz), (0.95, hz + 0.04), (0.0, hz + 0.05)],
                      seg=64, loc=(0, HC.y + 0.05, 0), rot=(rad(-6), rad(4), 0),
                      mod=lambda t, z, r: ragged(t, z, r, 0.05, 7)))
    cone = [Vector((0, HC.y + 0.06, hz)), Vector((0, HC.y + 0.06, hz + 0.3)), Vector((0.02, HC.y + 0.1, hz + 0.6)),
            Vector((0.0, HC.y + 0.2, hz + 0.85)), Vector((-0.06, HC.y + 0.42, hz + 1.02)),
            Vector((-0.12, HC.y + 0.68, hz + 1.1)), Vector((-0.1, HC.y + 0.9, hz + 1.24)),
            Vector((-0.06, HC.y + 1.02, hz + 1.42))]
    post.append(tube('hat', cone, [0.52, 0.46, 0.37, 0.28, 0.2, 0.13, 0.07, 0.01], seg=40))
    post.append(torus('hatband', (0, HC.y + 0.06, hz + 0.12), 0.5, 0.05, scale=(1, 1, 1), seg=48, rseg=8))
    post.append(box('buckle', (0, HC.y - 0.47, hz + 0.12), (0.22, 0.06, 0.18), bevel=0.02))
    cuts.append(box('buckle_hole', (0, HC.y - 0.52, hz + 0.12), (0.12, 0.1, 0.09)))
    v.part('head_geo', 'head', adds, cuts, w=7.0, voxel=0.011, post_adds=post)
    v.part('eyes', 'head', eye_pair(HC + Vector((0, -0.36, 0.03)), 0.12, (0.05, 0.03, 0.03), 0.3),
           mat='glow', w=0.5, mode='smooth')
    # ---- jaw: long pointed chin, crooked teeth
    J = rig.JP
    adds = [ellipsoid('jaw', J + Vector((0, -0.2, -0.08)), (0.24, 0.22, 0.12)),
            tube('chin', bez(J + Vector((0, -0.3, -0.12)), J + Vector((0, -0.45, -0.2)), J + Vector((0, -0.55, -0.18)),
                             J + Vector((0, -0.6, -0.08)), 8), taper(8, 0.1, 0.03), seg=12),
            ellipsoid('lower_lip', J + Vector((0, -0.36, 0.0)), (0.12, 0.05, 0.035))]
    for k in (-1, 0.4, 1.2):
        adds.append(box('tooth', J + Vector((k * 0.07, -0.36, 0.06)), (0.035, 0.03, 0.08), rot=(0, k * 0.2, 0),
                        bevel=0.008))
    v.part('jaw_geo', 'jaw', adds, w=1.2, voxel=0.009)

    # ---- arms: thin, bell sleeves, long bony fingers; right hand on the staff
    for s in (-1, 1):
        L = side_name(s)
        S, E = rig.S[s], rig.E[s]
        if s < 0:
            E = rig.E[s] = Vector((-1.85, 0.4, 3.45))
            W = rig.W[s] = Vector((-2.2, -0.75, 3.55))
            v.nodes['fore_R'] = ('arm_R', E)
        else:
            W = rig.W[s]
        adds = [tube('uarm', [S, E], [0.17, 0.16], seg=18),
                seg_cyl('sleeve', S.lerp(E, 0.05), E, 0.24, 0.27, seg=24)]
        v.part('upperarm_' + L, 'arm_' + L, adds, w=1.6, voxel=0.013)
        adds = [tube('farm', [E, W], [0.15, 0.1], seg=18),
                ellipsoid('elbow', E, (0.17, 0.17, 0.17))]
        bell = lathe('bell', [(0.27, 0.0), (0.33, 0.45), (0.45, 0.85), (0.5, 0.9)], seg=40,
                     mod=lambda t, z, r: ragged(t, z, r, 0.07 if z > 0.6 else 0.0, 9))
        d = (W - E)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        xform(bell, Matrix.Translation(E) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((1, 1, d.length / 0.9, 1)))
        adds.append(solidify(bell, 0.04, -1))
        if s < 0:
            pc = Vector((ST[0] + 0.17, ST[1] + 0.05, 3.55))
            adds.append(box('palm', pc, (0.16, 0.3, 0.42), rot=(0, 0, rad(20)), bevel=0.06))
            adds.append(tube('thumb', bez(pc + Vector((0, -0.08, 0.18)), pc + Vector((-0.08, -0.2, 0.22)),
                                          Vector((ST[0], ST[1] - 0.16, 3.78)), Vector((ST[0] - 0.12, ST[1] - 0.1, 3.8)), 8),
                             taper(8, 0.055, 0.03), seg=12))
        else:
            pc = rig.PC[s]
            adds.append(box('palm', pc + Vector((0, 0.05, 0)), (0.42, 0.38, 0.13), bevel=0.05))
            adds.append(tube('thumb', bez(pc + Vector((-s * 0.18, 0.05, 0)), pc + Vector((-s * 0.3, -0.14, -0.02)),
                                          pc + Vector((-s * 0.32, -0.32, -0.1)), pc + Vector((-s * 0.28, -0.42, -0.24)), 8),
                             taper(8, 0.055, 0.02), seg=12))
        v.part('forearm_' + L, 'fore_' + L, adds, w=2.0, voxel=0.012)
        if s < 0:
            grip_fingers(v, s, ST, 3.52, 0.09, 0.055, claw=0.05, w=0.3)
        else:
            resting_fingers(v, rig, s, 0.055, 0.62, claw=0.12, w=0.3)
    # ---- staff with a glowing orb in a claw cage
    sx, sy = ST
    rnd = random.Random(21)
    shaft = [Vector((sx + rnd.uniform(-0.05, 0.05) + 0.05 * math.sin(i * 0.9), sy + rnd.uniform(-0.05, 0.05), 0.38 + i * 0.4))
             for i in range(16)]
    top = shaft[-1]
    adds = [tube('staff', shaft, taper(16, 0.1, 0.085), seg=14)]
    for k in (3, 7, 11):
        adds.append(ellipsoid('knot', shaft[k], (0.14, 0.13, 0.17), seg=12, rings=8))
    orb_c = top + Vector((0, 0, 0.48))
    for k in range(4):
        a = TAU * k / 4 + 0.4
        u = Vector((math.cos(a), math.sin(a), 0))
        pts = bez(top, top + u * 0.3 + Vector((0, 0, 0.12)), orb_c + u * 0.42 + Vector((0, 0, 0.05)),
                  orb_c + u * 0.12 + Vector((0, 0, 0.42)), 12)
        adds.append(tube('prong', pts, taper(12, 0.07, 0.012), seg=10))
    v.part('staff', 'fore_R', adds, w=2.0, voxel=0.012)
    v.part('orb', 'fore_R', [ellipsoid('orb', orb_c, (0.3, 0.3, 0.3), seg=32, rings=18)], mat='emissive', w=0.6,
           mode='smooth')
    return v


# =========================================================================== BASALT
def rock(name, c, n, size, rnd, flat=0.6, jitter=0.28):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    for vv in bm.verts:
        vv.co *= 1 + rnd.uniform(-jitter, jitter)
    ob = obj_from_bm(name, bm)
    n = Vector(n).normalized()
    q = Vector((0, 0, 1)).rotation_difference(n)
    spin = Matrix.Rotation(rnd.uniform(0, TAU), 4, 'Z')
    sc = Matrix.Diagonal((size * rnd.uniform(0.85, 1.25), size * rnd.uniform(0.85, 1.25), size * flat, 1))
    return xform(ob, Matrix.Translation(c) @ q.to_matrix().to_4x4() @ spin @ sc)


def rock_skin(core_objs, spacing, size, rnd, flat=0.6, push=0.35, keep=None):
    """Cover the union of core primitives with rocks, leaving lava gaps."""
    tmp = join(core_objs, 'core_tmp')
    tmp = remesh(tmp, spacing * 0.5)
    bm = bmesh.new()
    bm.from_mesh(tmp.data)
    bm.normal_update()
    pts = []
    vs = list(bm.verts)
    rnd.shuffle(vs)
    for vv in vs:
        if keep and not keep(vv.co):
            continue
        if all((vv.co - p).length > spacing for p, _ in pts):
            pts.append((vv.co.copy(), vv.normal.copy()))
    bm.free()
    rocks = [rock('rk', p + n * size * flat * push, n, size, rnd, flat) for p, n in pts]
    return tmp, rocks


def build_basalt():
    v = V()
    rig = Rig(sx=1.12, head_z=5.18, head_y=0.35)
    rig.nodes(v)
    rnd = random.Random(42)

    def golem_part(name, node, core_adds, spacing, size, w_rock, w_core, flat=0.6, keep=None, extra_rocks=()):
        core, rocks = rock_skin(core_adds, spacing, size, rnd, flat, keep=keep)
        v.part(name, node, rocks + list(extra_rocks), w=w_rock, mode='facet')
        v.part('lava_' + name, node, [core], mat='emissive', w=w_core, mode='smooth')

    # throne: rough-hewn slabs
    adds = []
    tr = random.Random(7)
    adds.append(rock('base', (0, 0.35, 0.18), (0, 0, 1), 2.6, tr, flat=0.08, jitter=0.12))
    adds.append(rock('seat', (0, 0.6, 1.1), (0, 0, 1), 1.75, tr, flat=0.45, jitter=0.1))
    adds.append(rock('back', (0, 2.1, 4.3), (0, 1, 0), 1.9, tr, flat=0.22, jitter=0.12))
    for s in (-1, 1):
        adds.append(rock('side', (s * 1.95, 0.4, 1.55), (1, 0, 0), 1.55, tr, flat=0.2, jitter=0.12))
        adds.append(rock('arm', (s * 1.95, 0.35, ARM_TOP - 0.12), (0, 0, 1), 1.6, tr, flat=0.1, jitter=0.1))
        adds.append(rock('post', (s * 1.85, 2.05, 5.6), (1, 0, 0), 0.9, tr, flat=0.5, jitter=0.25))
    for k in range(10):
        a = tr.uniform(0, TAU)
        adds.append(rock('rubble', (2.6 * math.cos(a), 0.35 + 2.4 * math.sin(a), 0.3), (0, 0, 1), tr.uniform(0.2, 0.45), tr, 0.6))
    for k in range(5):
        adds.append(rock('crown_rock', (tr.uniform(-1.4, 1.4), 2.1, 6.4 + tr.uniform(0, 0.8)), (0, 1, 0.3), tr.uniform(0.35, 0.6), tr, 0.7))
    v.part('throne', 'throne', adds, w=6.0, mode='facet')

    # legs
    core = []
    for s in (-1, 1):
        hip, knee, ankle = Vector((s * 0.55, 0.5, 2.2)), Vector((s * 0.7, -1.05, 2.1)), Vector((s * 0.72, -1.3, 0.62))
        core += [seg_cyl('thigh', hip, knee, 0.4, 0.35), ellipsoid('knee', knee, (0.38, 0.38, 0.38)),
                 seg_cyl('shin', knee, ankle, 0.34, 0.3), ellipsoid('foot', ankle + Vector((0, -0.25, -0.2)), (0.38, 0.5, 0.22))]
    core_obj, rocks = rock_skin(core, 0.34, 0.25, rnd, 0.55)
    v.part('legs', 'legs', rocks + [core_obj], w=5.0, mode='facet')
    # legs share one mesh with the lava core inside; keep lava separate for the material
    v.parts[-1]['adds'] = rocks
    v.part('lava_legs', 'legs', [core_obj], mat='emissive', w=0.8, mode='smooth')

    # torso
    core = [ellipsoid('chest', (0, 0.5, 3.6), (1.25, 0.9, 1.0)), ellipsoid('belly', (0, 0.4, 2.6), (0.95, 0.8, 0.65)),
            ellipsoid('shoulders', (0, 0.6, 4.25), (1.3, 0.6, 0.45))]
    big = [rock('shoulder_slab', Vector((s * 1.25, 0.6, 4.45)), (s * 0.6, 0, 1), 0.6, rnd, 0.45) for s in (-1, 1)]
    big += [rock('pec', Vector((s * 0.5, -0.38, 3.75)), (0, -1, 0.1), 0.55, rnd, 0.35) for s in (-1, 1)]
    golem_part('torso', 'body', core, 0.36, 0.27, 9.0, 1.2, extra_rocks=big)
    # head: boulder, brow ledge, crystal crown
    HC = rig.HC
    core = [ellipsoid('head', HC, (0.5, 0.5, 0.48))]
    extra = [rock('brow', HC + Vector((0, -0.42, 0.12)), (0, -1, 0.6), 0.48, rnd, 0.32, 0.15)]
    for k in range(7):
        a = rad(-90) + (k - 3) * rad(32)
        b = HC + Vector((0.38 * math.cos(a), 0.38 * math.sin(a), 0.38))
        extra.append(seg_cyl('shard', b, b + Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, 0.55 - 0.1 * abs(k - 3))),
                             0.1, 0.01, seg=5))
    golem_part('head_geo', 'head', core, 0.24, 0.2, 4.0, 0.6, flat=0.55,
               keep=lambda co: not (co.y < HC.y - 0.3 and abs(co.z - HC.z) < 0.15), extra_rocks=extra)
    v.part('eyes', 'head', eye_pair(HC + Vector((0, -0.44, -0.02)), 0.18, (0.08, 0.04, 0.045)), mat='glow', w=0.5,
           mode='smooth')
    J = rig.JP
    core = [ellipsoid('jaw', J + Vector((0, -0.25, -0.12)), (0.4, 0.3, 0.16))]
    golem_part('jaw_geo', 'jaw', core, 0.2, 0.17, 1.2, 0.3, flat=0.5)
    # arms
    for s in (-1, 1):
        L = side_name(s)
        S, E, W = rig.S[s], rig.E[s], rig.W[s]
        golem_part('upperarm_' + L, 'arm_' + L, [seg_cyl('ua', S, E, 0.36, 0.32), ellipsoid('sh', S, (0.42, 0.42, 0.42))],
                   0.3, 0.22, 2.2, 0.3)
        pc = rig.PC[s]
        golem_part('forearm_' + L, 'fore_' + L, [seg_cyl('fa', E, W, 0.32, 0.3), ellipsoid('el', E, (0.34, 0.34, 0.34)),
                                                 box('palm', pc + Vector((0, 0.05, 0)), (0.6, 0.5, 0.26))],
                   0.28, 0.21, 2.6, 0.3)
        for i in range(4):
            x = pc.x - s * (0.2 - i * 0.13)
            k = Vector((x, pc.y - 0.2, pc.z))
            ln = 0.55
            pts = bez(k, k + Vector((0, -ln * 0.42, 0.02)), k + Vector((0, -ln * 0.66, -ln * 0.28)),
                      k + Vector((0, -ln * 0.6, -ln * 0.72)), 6)
            name = 'finger_%s_%d' % (L, i)
            v.node(name, 'fore_' + L, k)
            rk = [rock('fr', pts[j], (pts[min(j + 1, 5)] - pts[j]).cross(Vector((1, 0, 0))) * -1 + Vector((0, 0, 0.01)),
                       0.1, rnd, 0.8, 0.18) for j in (0, 2, 4)]
            rk.append(rock('ftip', pts[5], (0, -0.3, -1), 0.085, rnd, 1.0, 0.3))
            v.part(name + '_geo', name, rk, w=0.25, mode='facet')
            v.part(name + '_lava', name, [tube('fcore', pts, [0.075] * 6, seg=10)], mat='emissive', w=0.08, mode='smooth')
    return v
