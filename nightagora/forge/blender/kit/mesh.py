"""The two things every other module in this kit is written in: a FRAME and a
BUILD.

A frame is a local right handed set of axes: x runs along a face, y stands out
of it, z runs up it. Every builder takes one and works in millimetres of real
building rather than in world coordinates, so a wall reads as a wall in the
source and a roof slope is the same call with the frame pitched over. A build
is a bag of quads with a material index, a shade value and a per piece texture
offset, flushed to one Blender mesh at the end: one object, one draw, one
atlas. The shade lands in a corner colour attribute (the per brick tone a
photograph cannot give) and the offset lands in the surface uv, so two bricks
side by side sample two different places of the same CC0 plate.

The primitive that carries most of a building is `raised`: a face standing
proud of its bed with its edges splayed back to it. A brick modelled that way
is ten triangles instead of the twenty-six a chamfered box costs, it has no
back face to pay for where no eye can reach, and the splay is the weathered
arris that catches a raking sun.
"""

import math
import random
from mathutils import Matrix, Vector

import bpy


class Frame:
    """origin plus rotation. Local x along the face, y out of it, z up it."""

    __slots__ = ('origin', 'rot')

    def __init__(self, origin=(0.0, 0.0, 0.0), rot=None):
        self.origin = Vector(origin)
        self.rot = rot if rot is not None else Matrix.Identity(3)

    # ---- constructors -----------------------------------------------------
    @staticmethod
    def world():
        return Frame()

    @staticmethod
    def face(index, distance, sides=4, first=180.0):
        """one face of a regular plan, standing `distance` from its axis.
        Face 0 looks south (Blender -Y, which the glTF export turns into +Z)."""
        yaw = math.radians(first) + index * 2 * math.pi / sides
        rot = Matrix.Rotation(yaw, 3, 'Z')
        return Frame(rot @ Vector((0.0, distance, 0.0)), rot)

    @staticmethod
    def faces(sides, distance, first=180.0):
        """every face of a regular plan, in order, face 0 looking south"""
        return [Frame.face(i, distance, sides=sides, first=first) for i in range(sides)]

    def turned(self, degrees, axis='Z'):
        return Frame(self.origin, self.rot @ Matrix.Rotation(math.radians(degrees), 3, axis))

    def pitched(self, degrees):
        """rake the plane back about its own x axis, measured from UPRIGHT: a
        splayed sill, a leaning buttress, a batter"""
        return self.turned(degrees, 'X')

    def sloped(self, pitch):
        """a roof plane at `pitch` degrees above the HORIZONTAL, with z running
        up the slope and y standing out of it. A roof is quoted by its pitch
        and a wall by its rake, and the two are measured from different lines,
        which is worth one method rather than one subtraction at every call."""
        return self.turned(90.0 - pitch, 'X')

    def moved(self, x=0.0, y=0.0, z=0.0):
        return Frame(self.origin + self.rot @ Vector((x, y, z)), self.rot)

    # ---- reading ----------------------------------------------------------
    def point(self, x, y=0.0, z=0.0):
        return self.origin + self.rot @ Vector((x, y, z))

    def direction(self, x, y=0.0, z=0.0):
        return self.rot @ Vector((x, y, z))

    @property
    def normal(self):
        return self.rot @ Vector((0.0, 1.0, 0.0))


WORLD = Frame()


class Build:
    """quads, flushed to one mesh. Deterministic: one seed, one building."""

    def __init__(self, seed=0):
        self.v = []
        self.f = []
        self.mi = []
        self.shade = []
        self.off = []
        self.rng = random.Random(seed)

    # ---- the accumulator --------------------------------------------------
    def add(self, points, faces, mat=0, shade=1.0, offset=None):
        start = len(self.v)
        self.v.extend(tuple(p) for p in points)
        off = offset if offset is not None else (self.rng.uniform(0, 1), self.rng.uniform(0, 1))
        for face in faces:
            self.f.append(tuple(start + i for i in face))
            self.mi.append(mat)
            self.shade.append(shade)
            self.off.append(off)
        return self

    def jitter(self, amount):
        return self.rng.uniform(-amount, amount)

    def tone(self, low, high):
        return self.rng.uniform(low, high)

    # ---- primitives -------------------------------------------------------
    def box(self, frame, centre, size, mat=0, shade=1.0, offset=None, skip=()):
        """a real box in frame local coordinates. `skip` drops faces by name
        for a piece built into a wall, where a back nobody reaches is bytes."""
        cx, cy, cz = centre
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        p = [
            (cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
            (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
            (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
            (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz),
        ]
        named = {
            'back': (0, 3, 2, 1), 'bottom': (0, 1, 5, 4), 'right': (1, 2, 6, 5),
            'front': (2, 3, 7, 6), 'left': (3, 0, 4, 7), 'top': (4, 5, 6, 7),
        }
        faces = [f for name, f in named.items() if name not in skip]
        return self.add([frame.point(*q) for q in p], faces, mat, shade, offset)

    def raised(self, frame, centre, size, proud, splay=0.006, mat=0, shade=1.0,
               offset=None, base=0.0, skirts='all'):
        """a face standing `proud` of the frame's plane, its four edges splayed
        back to the bed. Ten triangles, no back, a real arris.

        `proud` may be a pair, and then the face is tilted: the bottom edge
        stands at the first value and the top edge at the second. That is a
        roof tile lapping the course below it, and a sill weathering away from
        a window, for no triangles at all.

        `skirts` is where the triangles of a whole wall are decided. A brick
        laid in a bed only ever shows the arris along its top and bottom, so
        `ends` drops the two quads down its sides and the wall costs six
        triangles a brick instead of ten. `none` is a flat panel."""
        cx, cz = centre
        hx, hz = size[0] / 2, size[1] / 2
        low, high = proud if isinstance(proud, (tuple, list)) else (proud, proud)
        sx = min(splay, hx * 0.45)
        sz = min(splay, hz * 0.45)
        rise = (high - low) / max(1e-6, 2 * hz)
        near = low + rise * sz
        far = high - rise * sz
        bed = [(cx - hx, base, cz - hz), (cx + hx, base, cz - hz),
               (cx + hx, base, cz + hz), (cx - hx, base, cz + hz)]
        top = [(cx - hx + sx, near, cz - hz + sz), (cx + hx - sx, near, cz - hz + sz),
               (cx + hx - sx, far, cz + hz - sz), (cx - hx + sx, far, cz + hz - sz)]
        points = [frame.point(*q) for q in bed + top]
        # wound so the face looks OUT of the frame it stands on: three culls
        # a back face, and a wall wound the other way is a wall with no wall
        faces = [(7, 6, 5, 4)]
        if skirts in ('all', 'ends'):
            faces += [(4, 5, 1, 0), (6, 7, 3, 2)]
        if skirts in ('all', 'sides'):
            faces += [(5, 6, 2, 1), (7, 4, 0, 3)]
        if skirts == 'none':
            points = points[4:]
            faces = [(3, 2, 1, 0)]
        return self.add(points, faces, mat, shade, offset)

    def quad(self, frame, corners, mat=0, shade=1.0, offset=None):
        """one flat face, given four local points"""
        return self.add([frame.point(*c) for c in corners], [(3, 2, 1, 0)], mat, shade, offset)

    def prism(self, frame, centre, size, mat=0, shade=1.0, offset=None):
        """a triangular prism running along local x: a hip roll, a chamfer stop"""
        cx, cy, cz = centre
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        p = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
             (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
             (cx - hx, cy, cz + hz), (cx + hx, cy, cz + hz)]
        faces = [(0, 3, 2, 1), (0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)]
        return self.add([frame.point(*q) for q in p], faces, mat, shade, offset)

    def tube(self, points, radius, sides=6, mat=0, shade=1.0, offset=None, close=True):
        """a swept ring along a polyline: a peg, a bar, a rod, the core of a rope"""
        points = [Vector(p) for p in points]
        if len(points) < 2:
            return self
        rings = []
        for i, p in enumerate(points):
            ahead = points[min(i + 1, len(points) - 1)]
            behind = points[max(i - 1, 0)]
            axis = (ahead - behind)
            if axis.length < 1e-9:
                axis = Vector((0, 0, 1))
            axis.normalize()
            up = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
            u = axis.cross(up).normalized()
            w = axis.cross(u).normalized()
            r = radius(i / max(1, len(points) - 1)) if callable(radius) else radius
            rings.append([p + (u * math.cos(a) + w * math.sin(a)) * r
                          for a in [2 * math.pi * k / sides for k in range(sides)]])
        verts = [v for ring in rings for v in ring]
        faces = []
        for i in range(len(rings) - 1):
            for k in range(sides):
                a = i * sides + k
                b = i * sides + (k + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        if close:
            faces.append(tuple(range(sides - 1, -1, -1)))
            faces.append(tuple(range((len(rings) - 1) * sides, len(rings) * sides)))
        return self.add(verts, faces, mat, shade, offset)

    def disc(self, centre, normal, radius, sides=12, mat=0, shade=1.0, offset=None):
        n = Vector(normal).normalized()
        up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
        u = n.cross(up).normalized()
        w = n.cross(u).normalized()
        c = Vector(centre)
        ring = [c + (u * math.cos(2 * math.pi * k / sides) + w * math.sin(2 * math.pi * k / sides)) * radius
                for k in range(sides)]
        return self.add([c] + ring, [(0, 1 + k, 1 + (k + 1) % sides) for k in range(sides)], mat, shade, offset)

    # ---- the flush --------------------------------------------------------
    @property
    def tris(self):
        return sum(len(f) - 2 for f in self.f)

    def object(self, name, materials, repeats=None, atlas=None):
        """one Blender object out of everything added so far.

        Two layers land with it. `SurfaceUV` is the library's own scale: each
        face is projected on its dominant axis in metres and shifted by its
        piece's offset, so a photographed set repeats at its physical size and
        no two bricks show the same corner of it. `Variation` is the shade,
        which is the per piece tone the plate cannot carry."""
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.v, [], self.f)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        for m in materials:
            mesh.materials.append(m)
        rep = list(repeats or [1.0] * len(materials))
        while len(rep) < len(materials):
            rep.append(1.0)
        uv = mesh.uv_layers.new(name='SurfaceUV')
        colour = mesh.color_attributes.new(name='Variation', type='FLOAT_COLOR', domain='CORNER')
        for i, poly in enumerate(mesh.polygons):
            index = self.mi[i]
            poly.material_index = index
            scale = 1.0 / max(1e-4, rep[index])
            n = poly.normal
            axes = (0, 1) if abs(n.z) > 0.577 else (0, 2) if abs(n.y) > abs(n.x) else (1, 2)
            ox, oz = self.off[i]
            tone = self.shade[i]
            for li in poly.loop_indices:
                co = mesh.vertices[mesh.loops[li].vertex_index].co
                uv.data[li].uv = (ox + co[axes[0]] * scale, oz + co[axes[1]] * scale)
                colour.data[li].color = (tone, tone, tone, 1.0)
        if atlas:
            obj['atlas'] = atlas
        obj['kit_faces'] = len(self.f)
        return obj


def select(objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    if objects or active:
        bpy.context.view_layer.objects.active = active or objects[0]


def join(objects, name, atlas=None):
    """one body per atlas: a hundred kit calls become one draw"""
    if not objects:
        return None
    select(objects)
    if len(objects) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    if atlas:
        ob['atlas'] = atlas
    return ob
