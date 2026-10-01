"""Repair zero-length TANGENT vectors (from degenerate UV triangles) in a GLB, in place.

usage: python3 gltf_fix.py file.glb [...]
Each bad tangent is replaced with a unit vector orthogonal to that vertex normal (w = 1).
"""
import json, struct, sys, math


def fix(path):
    data = bytearray(open(path, 'rb').read())
    jlen = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen + 8
    fixed = 0

    def view(acc):
        a = j['accessors'][acc]
        bv = j['bufferViews'][a['bufferView']]
        return bin_off + bv.get('byteOffset', 0) + a.get('byteOffset', 0), a['count'], bv.get('byteStride')

    for mesh in j['meshes']:
        for prim in mesh['primitives']:
            at = prim['attributes']
            if 'TANGENT' not in at:
                continue
            to, n, ts = view(at['TANGENT'])
            no, _, ns = view(at['NORMAL'])
            ts, ns = ts or 16, ns or 12
            for i in range(n):
                x, y, z, w = struct.unpack_from('<4f', data, to + i * ts)
                l = math.sqrt(x * x + y * y + z * z)
                if abs(l - 1) < 1e-3:
                    continue
                if l > 1e-6:
                    t = (x / l, y / l, z / l)
                else:
                    nx, ny, nz = struct.unpack_from('<3f', data, no + i * ns)
                    ax = (1, 0, 0) if abs(nx) < 0.9 else (0, 1, 0)
                    d = ax[0] * nx + ax[1] * ny + ax[2] * nz
                    t = (ax[0] - d * nx, ax[1] - d * ny, ax[2] - d * nz)
                    tl = math.sqrt(sum(c * c for c in t))
                    t = tuple(c / tl for c in t)
                struct.pack_into('<4f', data, to + i * ts, t[0], t[1], t[2], 1.0 if w >= 0 else -1.0)
                fixed += 1
    open(path, 'wb').write(data)
    print('fixed %d tangents in %s' % (fixed, path))


for p in sys.argv[1:]:
    fix(p)
