"""THE DOSSIER READER — a machine's numbers, turned into the kit's own frames.

A machine of the mechanism hall arrives as an engineering dossier: parts with
a shape, dimensions in metres, a position and an orientation in the PARENT's
frame, a material class and a certainty. The app reads that file at runtime in
TypeScript; this module reads the same file in Blender, so the two bodies are
the same machine and a parity table can be printed against the source rather
than against a memory of it.

Three things it does and nothing else. It resolves the part tree into world
transforms (the dossier is right handed with +Y up and +Z forward, Blender is
Z up, so one axis map stands between them and every number below is written
exactly as the dossier writes it). It turns the five shapes a dossier may use
into `Build` geometry: box, cylinder, tube, a profile with holes extruded, and
a profile of revolution. And it measures what was built back into the
dossier's own axes, which is the parity table the gate asks for.

What it does NOT do is dress anything. A dossier gives a jib as a rectangle
with two holes in it; the bored mouth, the chamfer, the peg and the iron strap
are the hand's work and live in `machine.py` and in the object's own script.
The reader is the law of the geometry, and the dressing is what the bench
judges.

    d = dossier.read('brief/dossier/revolving-crane.json')
    frame = d.frame('mast')                  # the part's own axes, in Blender
    d.lay(build, 'mast', mat=OAK)            # the plain shape, at its metres
    d.size('mast')                           # (x, y, z) in the dossier's axes
"""

import json
import math
from pathlib import Path

from mathutils import Matrix, Vector, geometry

from .mesh import Build, Frame

# the dossier is +Y up and +Z forward; Blender is +Z up and -Y forward, and
# the glTF export turns Blender back into exactly the dossier's frame
AXES = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def to_blender(point):
    """one dossier point in Blender world metres"""
    return AXES @ Vector(point)


def to_dossier(point):
    """one Blender point back in the dossier's own axes"""
    return AXES.transposed() @ Vector(point)


def _euler(angles):
    """the dossier's XYZ intrinsic euler, in the dossier's own axes"""
    x, y, z = (angles + [0, 0, 0])[:3] if isinstance(angles, list) else angles
    return (Matrix.Rotation(x, 3, 'X') @ Matrix.Rotation(y, 3, 'Y') @ Matrix.Rotation(z, 3, 'Z'))


class Dossier:
    """one machine's numbers, and the frames they stand in"""

    def __init__(self, document):
        self.doc = document
        self.slug = document['slug']
        self.parts = {part['id']: part for part in document['parts']}
        self.joints = {joint['id']: joint for joint in document.get('joints', [])}
        self._world = {}

    # ---- the tree ---------------------------------------------------------
    def world(self, part_id):
        """(rotation, position) of a part in the dossier's WORLD axes"""
        if part_id in self._world:
            return self._world[part_id]
        part = self.parts[part_id]
        rot = _euler(part['orientation_rad'])
        pos = Vector(part['position_m'])
        parent = part['parent']
        if parent != 'world':
            up_rot, up_pos = self.world(parent)
            rot = up_rot @ rot
            pos = up_pos + up_rot @ pos
        self._world[part_id] = (rot, pos)
        return self._world[part_id]

    def frame(self, part_id):
        """the part's own axes as a kit Frame: local x, y, z are the dossier's
        own local x, y, z, and the origin is where the dossier puts it"""
        rot, pos = self.world(part_id)
        return Frame(AXES @ pos, AXES @ rot)

    def at(self, part_id, x=0.0, y=0.0, z=0.0):
        """one point of the part's local frame, in Blender world metres"""
        return self.frame(part_id).point(x, y, z)

    def dims(self, part_id):
        return self.parts[part_id]['dimensions_m']

    def material(self, part_id):
        return self.parts[part_id]['material']['class']

    def size(self, part_id):
        """the part's declared box in the DOSSIER'S WORLD axes.

        A drum lying on its side is a cylinder 0.3 long about its own +Y and
        0.3 wide in the world, so the declared size is the local box turned by
        the part's own orientation: that is the number a built body can be
        measured against."""
        local = self.local_size(part_id)
        rot, _ = self.world(part_id)
        turned = [sum(abs(rot[row][col]) * local[col] for col in range(3)) for row in range(3)]
        return tuple(turned)

    def local_size(self, part_id):
        """the part's own box in its own axes, from its declared shape"""
        part = self.parts[part_id]
        shape = part['shape'] if isinstance(part['shape'], str) else part['shape'].get('type')
        d = part['dimensions_m']
        if shape == 'box':
            return (d['x'], d['y'], d['z'])
        if shape in ('cylinder', 'cone'):
            r = d.get('radius', d.get('radius_bottom'))
            return (2 * r, d['height'], 2 * r)
        if shape == 'sphere':
            return (2 * d['radius'], 2 * d['radius'], 2 * d['radius'])
        if shape == 'profile of revolution':
            profile = d['closed_axial_radial_profile']
            radius = max(p[1] for p in profile)
            axial = max(p[0] for p in profile) - min(p[0] for p in profile)
            return (2 * radius, axial, 2 * radius)
        if shape == 'profile':
            outline, plane = self._outline(d)
            depth = d['extrusion_depth']
            width = max(p[0] for p in outline) - min(p[0] for p in outline)
            run = max(p[1] for p in outline) - min(p[1] for p in outline)
            return (width, depth, run) if plane == 'XZ' else (depth, width, run)
        if shape == 'tube':
            return _tube_box(d['centreline'], d.get('radius', d.get('outer_radius', 0.0)))
        raise SystemExit(f'the reader has no shape named {shape} ({part_id})')

    @staticmethod
    def _outline(d):
        if 'coordinates_xz' in d:
            return d['coordinates_xz'], 'XZ'
        return d['coordinates_yz'], 'YZ'

    @staticmethod
    def _holes(d):
        return d.get('holes_xz') or d.get('holes_yz') or []

    # ---- the plain shapes -------------------------------------------------
    def lay(self, build, part_id, mat=0, **kw):
        """the part's declared shape, at its own metres, undressed.

        This is the floor a machine stands on before a hand touches it: it is
        right, it is at the dossier's numbers, and it is the thing the parity
        table measures. Anything a joiner would recognise is added on top."""
        part = self.parts[part_id]
        shape = part['shape'] if isinstance(part['shape'], str) else part['shape'].get('type')
        frame = self.frame(part_id)
        d = part['dimensions_m']
        if shape == 'box':
            return build.box(frame, (0, 0, 0), (d['x'], d['y'], d['z']), mat=mat, **kw)
        if shape == 'cylinder':
            return cylinder(build, frame, d['radius'], d['height'], mat=mat, **kw)
        if shape == 'sphere':
            return sphere(build, frame, d['radius'], mat=mat, **kw)
        if shape == 'profile of revolution':
            return revolve(build, frame, d['closed_axial_radial_profile'],
                           segments=d.get('segments', 48), mat=mat, **kw)
        if shape == 'profile':
            outline, plane = self._outline(d)
            return extrude(build, frame, outline, holes=self._holes(d),
                           depth=d['extrusion_depth'], plane=plane, mat=mat, **kw)
        if shape == 'tube':
            line = [self.frame(part_id).point(*p) for p in d['centreline']]
            return build.tube(line, d.get('radius', d.get('outer_radius')), mat=mat, **kw)
        raise SystemExit(f'the reader has no shape named {shape} ({part_id})')


def _tube_box(line, radius):
    """the box a swept round section really fills.

    A cylinder's end cap stands r across the axis and nothing along it, so a
    tube quoted as centreline plus radius is not its centreline box plus two
    radii: that number is up to a quarter of a metre wrong on a raking brace
    and it would show in the parity table as a fault that is not there."""
    low = [1e9, 1e9, 1e9]
    high = [-1e9, -1e9, -1e9]
    for i, point in enumerate(line):
        ahead = Vector(line[min(i + 1, len(line) - 1)])
        behind = Vector(line[max(i - 1, 0)])
        axis = ahead - behind
        axis = axis.normalized() if axis.length > 1e-9 else Vector((0, 1, 0))
        for k in range(3):
            reach = radius * math.sqrt(max(0.0, 1.0 - axis[k] ** 2))
            low[k] = min(low[k], point[k] - reach)
            high[k] = max(high[k], point[k] + reach)
    return tuple(high[k] - low[k] for k in range(3))


def read(path):
    return Dossier(json.loads(Path(path).read_text()))


# ---------------------------------------------------------------- the shapes
def cylinder(build, frame, radius, height, sides=24, axis='+Y', mat=0, shade=1.0,
             offset=None, caps=True, grain=None):
    """a cylinder on the frame's own axis, the dossier's way: local +Y, centred"""
    up = {'+Y': (0, 1, 0), '+X': (1, 0, 0), '+Z': (0, 0, 1)}[axis]
    a = frame.point(*(-height / 2 * c for c in up))
    b = frame.point(*(height / 2 * c for c in up))
    build.tube([a, b], radius, sides=sides, mat=mat, shade=shade, offset=offset,
               close=caps, grain=grain)
    return build


def sphere(build, frame, radius, rings=12, sides=16, mat=0, shade=1.0, offset=None):
    """a sphere, for the one thing in a machine that is one (a rope's eye)"""
    points, faces = [], []
    for i in range(rings + 1):
        v = math.pi * i / rings
        for j in range(sides):
            u = 2 * math.pi * j / sides
            points.append(frame.point(radius * math.sin(v) * math.cos(u),
                                      radius * math.cos(v),
                                      radius * math.sin(v) * math.sin(u)))
    for i in range(rings):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    return build.add(points, faces, mat, shade, offset)


def revolve(build, frame, profile, segments=48, axis='+Y', mat=0, shade=1.0, offset=None,
            wobble=0.0, rng=None, grain=None):
    """a closed axial/radial section swept about the frame's own axis.

    The dossier writes the section as (axial, radial) pairs and closes the last
    point to the first, so a turntable is an annulus and a sheave is a wheel
    with a bore. `wobble` is the hand on the lathe: a fraction of the radius,
    varying slowly around the turn, which is what stops a turned body reading
    as a primitive."""
    pairs = [tuple(p) for p in profile]
    n = len(pairs)
    rings = []
    for s in range(segments):
        angle = 2 * math.pi * s / segments
        wave = 1.0 if not wobble else 1.0 + wobble * (
            math.sin(angle * 3 + 0.7) * 0.6 + math.sin(angle * 7 + 2.1) * 0.4)
        ring = []
        for axial, radial in pairs:
            r = radial * (wave if radial > 1e-5 else 1.0)
            local = (r * math.cos(angle), axial, r * math.sin(angle)) if axis == '+Y' else \
                    (axial, r * math.cos(angle), r * math.sin(angle))
            ring.append(frame.point(*local))
        rings.append(ring)
    points = [p for ring in rings for p in ring]
    faces = []
    for s in range(segments):
        t = (s + 1) % segments
        for i in range(n):
            j = (i + 1) % n
            faces.append((s * n + i, s * n + j, t * n + j, t * n + i))
    return build.add(points, faces, mat, shade, offset, grain)


def _plane_point(plane, a, b, depth):
    """the dossier's two profile planes, in the part's own local axes.

    XZ: the outline is (x, z) and the extrusion runs along local +Y.
    YZ: the outline is (y, z) and the extrusion runs along local +X.
    XY: the outline is (x, y) and the extrusion runs along local +Z, which no
    dossier asks for and every swept section of a machine does."""
    if plane == 'XZ':
        return (a, depth, b)
    if plane == 'XY':
        return (a, b, depth)
    return (depth, a, b)


def _area(ring):
    """twice the signed area of a closed 2d ring, which is its handedness"""
    total = 0.0
    for i, (a, b) in enumerate(ring):
        c, d = ring[(i + 1) % len(ring)]
        total += a * d - c * b
    return total


def _shrink(ring, amount):
    """every vertex of a closed ring moved `amount` metres toward its inside.

    A bored hole and a planed arris are the same operation with the sign
    turned over, which is why one function does both: the mouth of a hole is
    the hole shrunk by a negative amount."""
    if abs(amount) < 1e-9:
        return [tuple(p) for p in ring]
    hand = 1.0 if _area(ring) > 0 else -1.0
    count = len(ring)
    out = []
    for i, point in enumerate(ring):
        before = Vector(ring[(i - 1) % count])
        here = Vector(point)
        after = Vector(ring[(i + 1) % count])
        first = (here - before)
        second = (after - here)
        normals = []
        for edge in (first, second):
            if edge.length > 1e-9:
                normals.append(Vector((-edge.y, edge.x)).normalized() * hand)
        if not normals:
            out.append(tuple(here))
            continue
        normal = sum(normals, Vector((0.0, 0.0)))
        if normal.length < 1e-9:
            normal = normals[-1]
        normal.normalize()
        out.append(tuple(here + normal * amount))
    return out


def _face_normal(points, face):
    """Newell, on the local points, so a winding can be decided before the
    frame turns it into the world"""
    normal = Vector((0.0, 0.0, 0.0))
    count = len(face)
    for i in range(count):
        a = Vector(points[face[i]])
        b = Vector(points[face[(i + 1) % count]])
        normal.x += (a.y - b.y) * (a.z + b.z)
        normal.y += (a.z - b.z) * (a.x + b.x)
        normal.z += (a.x - b.x) * (a.y + b.y)
    return normal


def _wound(points, face, want):
    """the face, ordered so that it looks the way it is meant to look.

    Every hollow shape in this kit is a ring swept between two depths, and the
    one thing that makes a swept shape read as broken is a face wound the
    wrong way: three culls it and the object has a hole in it. So no winding
    here is reasoned about at the call site. It is measured."""
    return face if _face_normal(points, face).dot(Vector(want)) > 0 else tuple(reversed(face))


def _cap(build, frame, plane, rings, at, want, mat, shade, offset, grain):
    """one capped face of a profile: the boundary, its holes, triangulated"""
    local, loops, index = [], [], []
    for ring in rings:
        index.append(list(range(len(local), len(local) + len(ring))))
        local.extend(_plane_point(plane, a, b, at) for a, b in ring)
        loops.append([Vector((a, b, 0.0)) for a, b in ring])
    flat = [i for loop in index for i in loop]
    faces = [_wound(local, tuple(flat[i] for i in tri), want)
             for tri in geometry.tessellate_polygon(loops)]
    return build.add([frame.point(*p) for p in local], faces, mat, shade, offset, grain)


def _band(build, frame, plane, near_ring, near_at, far_ring, far_at, outward,
          mat, shade, offset, grain):
    """the surface between two rings at two depths: a wall, a chamfer, the
    worn mouth of a bored hole. `outward` says which side is the outside."""
    local = []
    for (a, b), (c, d) in zip(near_ring, far_ring):
        local.append(_plane_point(plane, a, b, near_at))
        local.append(_plane_point(plane, c, d, far_at))
    count = len(near_ring)
    faces = []
    for i in range(count):
        j = (i + 1) % count
        quad = (2 * i, 2 * i + 1, 2 * j + 1, 2 * j)
        edge = Vector(near_ring[j]) - Vector(near_ring[i])
        # a ring wound anticlockwise keeps its material on the left, so the
        # face of that edge looks to the RIGHT of it
        side = Vector((edge.y, -edge.x))
        if side.length < 1e-9:
            continue
        side.normalize()
        # the outward direction of this edge, in the profile's own plane, and
        # then in the part's local axes
        reference = Vector(_plane_point(plane, side.x, side.y, 0.0)) - \
            Vector(_plane_point(plane, 0.0, 0.0, 0.0))
        hand = 1.0 if _area(near_ring) > 0 else -1.0
        want = reference * hand * (1.0 if outward else -1.0)
        faces.append(_wound(local, quad, want))
    return build.add([frame.point(*p) for p in local], faces, mat, shade, offset, grain)


def _pair(value):
    """one amount, or one for each end of the sweep"""
    if isinstance(value, (tuple, list)):
        return float(value[0]), float(value[1])
    return float(value), float(value)


def extrude(build, frame, outline, holes=(), depth=0.1, plane='XZ', centred=True,
            mat=0, shade=1.0, offset=None, mouth=0.0, chamfer=0.0, grain=None):
    """a closed profile with holes, extruded along the plane's own normal.

    `mouth` is the worn lip a bored hole keeps after a rope has run through it
    for a season: the hole opens out at both faces by that many metres. It is
    geometry and not a map, because at arm's length a painted chamfer is
    exactly what a printed reconstruction looks like. `chamfer` does the same
    to the outline, which is the arris a plane took off.

    Both take one number for the whole sweep, or a pair for its two ends, and
    `mouth` also takes one entry per hole. That is what lets a body be built
    in LAYERS: a beam whose lower plate is chamfered at the soffit only and
    whose upper plate is chamfered at the top only meets flush in the middle,
    with no groove where the two halves touch, and every housing and bore in
    it falls out of the section rather than out of a boolean."""
    near, far = (-depth / 2, depth / 2) if centred else (0.0, depth)
    body = [tuple(p) for p in outline]
    bores = [[tuple(p) for p in hole] for hole in holes]
    axis = Vector(_plane_point(plane, 0.0, 0.0, 1.0)) - Vector(_plane_point(plane, 0.0, 0.0, 0.0))
    cham = _pair(chamfer)
    if isinstance(mouth, (tuple, list)) and bores and len(mouth) == len(bores):
        lips = [_pair(m) for m in mouth]
    else:
        lips = [_pair(mouth) for _ in bores]

    stops = [[near, far], [near, far]]  # where the body wall and each hole start
    for side, (at, direction) in enumerate(((near, 1.0), (far, -1.0))):
        cut = cham[side]
        worn = [_shrink(hole, -lip[side]) if lip[side] > 0 else hole
                for hole, lip in zip(bores, lips)]
        rim = _shrink(body, cut) if cut > 0 else body
        _cap(build, frame, plane, [rim] + worn, at, axis * -direction,
             mat, shade, offset, grain)
        if cut > 0:
            _band(build, frame, plane, rim, at, body, at + direction * cut, True,
                  mat, shade, offset, grain)
        for hole, lip, opened in zip(bores, lips, worn):
            if lip[side] > 0:
                _band(build, frame, plane, opened, at, hole, at + direction * lip[side],
                      False, mat, shade, offset, grain)
        stops[0][side] = at + direction * cut
    _band(build, frame, plane, body, stops[0][0], body, stops[0][1], True,
          mat, shade, offset, grain)
    for hole, lip in zip(bores, lips):
        _band(build, frame, plane, hole, near + lip[0], hole, far - lip[1], False,
              mat, shade, offset, grain)
    return build


def polygon(build, frame, ring, plane='XZ', at=0.0, want=None, mat=0, shade=1.0,
            offset=None, grain=None, holes=()):
    """one capped face of a profile, for a piece whose walls another call lays"""
    axis = Vector(_plane_point(plane, 0.0, 0.0, 1.0)) - Vector(_plane_point(plane, 0.0, 0.0, 0.0))
    return _cap(build, frame, plane, [list(ring)] + [list(h) for h in holes], at,
                Vector(want) if want else axis, mat, shade, offset, grain)


# ------------------------------------------------------------- the parity
class Parity:
    """what was BUILT, measured back into the dossier's own axes.

    A gate that reads the source and calls it parity is a gate that measures
    the intention. This measures the vertices: every call between `mark` and
    its close is attributed to one part id, and the table at the end is the
    built box against the declared one."""

    def __init__(self, doc):
        self.doc = doc
        self.rows = {}
        self._open = []

    def mark(self, build, part_id):
        self._open.append((build, part_id, len(build.v)))
        return self

    def close(self):
        build, part_id, start = self._open.pop()
        points = [to_dossier(p) for p in build.v[start:]]
        if not points:
            return
        low = [min(p[i] for p in points) for i in range(3)]
        high = [max(p[i] for p in points) for i in range(3)]
        row = self.rows.get(part_id)
        if row:
            low = [min(low[i], row['low'][i]) for i in range(3)]
            high = [max(high[i], row['high'][i]) for i in range(3)]
        self.rows[part_id] = {'low': low, 'high': high,
                              'faces': row['faces'] + 1 if row else 1}

    def of(self, build, part_id):
        parity = self

        class _Scope:
            def __enter__(self):
                parity.mark(build, part_id)
                return parity

            def __exit__(self, *_):
                parity.close()
                return False
        return _Scope()

    def table(self, tolerance=0.02):
        """one row per part: declared size, built size, and whether it holds"""
        out = []
        for part_id, row in self.rows.items():
            built = tuple(round(row['high'][i] - row['low'][i], 4) for i in range(3))
            declared = tuple(round(v, 4) for v in self.doc.size(part_id))
            worst = max(abs(built[i] - declared[i]) / max(1e-6, declared[i]) for i in range(3))
            out.append({'id': part_id, 'declared': declared, 'built': built,
                        'drift': round(worst, 4), 'ok': worst <= tolerance,
                        'material': self.doc.material(part_id)})
        return sorted(out, key=lambda r: r['id'])

    def missing(self):
        return sorted(set(self.doc.parts) - set(self.rows))
