"""Brick, laid as brick is laid.

A wall in this kit is two things: a recessed bed of lime, and the individual
bricks standing proud of it. That is the whole reason to build masonry rather
than photograph it, because what the eye reads on a brick wall at a raking
hour is not the colour of the clay, it is the shadow line under every bed
joint and the arris of every brick catching the sun a little differently. Four
bonds are laid here: stretcher, English (a course of stretchers, a course of
headers), Flemish (both in the same course, the header centred over the
stretcher below) and header. Every brick takes its own small jitter in size,
depth and tone, damp is carried up from the foot, and an opening is a
rectangle the courses stop at.

`nest` is the same wall with pigeon holes in it: a leaf of brick with a grid
of mouths, each opening into a cell with real depth. A dovecote's boulins, a
putlog wall and a columbarium are all one call.
"""

import math

from .mesh import Build, Frame


def _rows(height, course, base):
    n = max(1, int(round(height / course)))
    return [base + (i + 0.5) * course for i in range(n)], n


def _blocked(x, half, z, half_z, openings, margin=0.004):
    for hole in openings:
        if (abs(x - hole['x']) < hole['width'] / 2 + half - margin
                and hole['base'] - margin < z + half_z
                and z - half_z < hole['base'] + hole['height'] + margin):
            return True
    return False


def _runs(z, half_z, length, openings):
    """the clear stretches of one course, after the openings have cut it"""
    cuts = []
    for hole in openings:
        if hole['base'] < z + half_z and z - half_z < hole['base'] + hole['height']:
            cuts.append((hole['x'] - hole['width'] / 2, hole['x'] + hole['width'] / 2))
    cuts.sort()
    runs, at = [], -length / 2
    for a, b in cuts:
        if a > at:
            runs.append((at, min(a, length / 2)))
        at = max(at, b)
    if at < length / 2:
        runs.append((at, length / 2))
    return [(a, b) for a, b in runs if b - a > 0.02]


def bed(build, frame, *, length, height, base=0.0, course=0.070, openings=(), mat=1,
        recess=0.0, tone=(0.86, 1.06), jitter=0.0015):
    """the lime bed the bricks stand on, one strip per course, cut at the
    openings. It is a face and not a box: nothing can see behind a wall."""
    laid = 0
    zs, _ = _rows(height, course, base)
    for z in zs:
        for a, b in _runs(z, course / 2, length, openings):
            depth = -recess + build.jitter(jitter)
            build.raised(frame, ((a + b) / 2, z), (b - a, course), depth,
                         splay=0.001, mat=mat, shade=build.tone(*tone), skirts='none')
            laid += 1
    return laid


def courses(build, frame, *, length, height, base=0.0, brick=(0.24, 0.105, 0.058),
            joint=0.012, bond='flemish', proud=0.018, splay=0.006, mat=0,
            openings=(), tone=(0.74, 1.16), damp=(0.9, 0.14), jitter=0.006,
            start=0.0):
    """the bricks themselves. Returns how many were laid."""
    long_face, header, thick = brick[0], brick[1], brick[2]
    course = thick + joint
    stretch = long_face + joint
    head = header + joint
    zs, rows = _rows(height, course, base)
    laid = 0
    for row, z in enumerate(zs):
        if bond == 'stretcher':
            units = [(long_face, stretch)]
            offset = start + (row % 2) * stretch / 2
        elif bond == 'english':
            if row % 2:
                units = [(header, head)]
                offset = start + head / 2
            else:
                units = [(long_face, stretch)]
                offset = start
        elif bond == 'header':
            units = [(header, head)]
            offset = start + (row % 2) * head / 2
        else:  # flemish: a stretcher and a header in every course
            units = [(long_face, stretch), (header, head)]
            offset = start + (row % 2) * (stretch + head) / 2
        # walk the course from left to right, repeating the unit pattern
        x = -length / 2 - stretch + (offset % (sum(u[1] for u in units)))
        step = 0
        damp_depth, damp_amount = damp
        guard = 0
        while x < length / 2 + stretch and guard < 4000:
            guard += 1
            width, pitch = units[step % len(units)]
            step += 1
            centre = x + pitch / 2
            x += pitch
            if centre - width / 2 > length / 2 or centre + width / 2 < -length / 2:
                continue
            w = width + build.jitter(jitter * 0.35)
            h = thick + build.jitter(jitter * 0.2)
            if _blocked(centre, w / 2, z, h / 2, openings):
                continue
            shade = build.tone(*tone) * (1 - damp_amount * math.exp(-(z - base) / max(0.05, damp_depth)))
            # a brick in a bed shows its arris along the top and the bottom
            # only: the perpend is twelve millimetres of open joint either side
            build.raised(frame, (centre, z), (w, h), proud + build.jitter(jitter * 0.3),
                         splay=splay, mat=mat, shade=shade, skirts='ends')
            laid += 1
    return laid


def face(build, frame, *, length, height, base=0.0, mat=0, bed_mat=1, recess=0.016,
         openings=(), **kw):
    """one whole brick face: the recessed lime bed, then the bricks on it"""
    brick = kw.get('brick', (0.24, 0.105, 0.058))
    joint = kw.get('joint', 0.012)
    bed(build, frame, length=length, height=height, base=base, course=brick[2] + joint,
        openings=openings, mat=bed_mat, recess=recess)
    return courses(build, frame, length=length, height=height, base=base, mat=mat,
                   openings=openings, **kw)


def nest(build, frame, *, length, height, base=0.0, mouth=(0.28, 0.24), depth=0.43,
         pitch=(0.48, 0.35), margin=0.30, mat=0, bed_mat=1, cell_mat=None,
         openings=(), **kw):
    """a leaf of brick with a grid of pigeon holes in it.

    Every mouth is an opening in the courses AND a cell behind them: a floor,
    a ceiling, two cheeks and a back, so a hole in this wall has depth from
    every angle a visitor can stand at. A hole that is only a dark rectangle
    on a wall is the one thing a nesting wall may not be."""
    cell_mat = mat if cell_mat is None else cell_mat
    columns = max(1, int((length - 2 * margin) / pitch[0]))
    rows = max(1, int((height - 2 * margin) / pitch[1]))
    left = -((columns - 1) * pitch[0]) / 2
    holes = []
    for row in range(rows):
        z = base + margin + row * pitch[1] + mouth[1] / 2
        if z + mouth[1] / 2 > base + height - margin * 0.5:
            continue
        for col in range(columns):
            x = left + col * pitch[0]
            hole = {'x': x, 'base': z - mouth[1] / 2, 'width': mouth[0], 'height': mouth[1]}
            if any(abs(x - o['x']) < (o['width'] + mouth[0]) / 2 + 0.06
                   and o['base'] - 0.06 < hole['base'] + mouth[1]
                   and hole['base'] < o['base'] + o['height'] + 0.06 for o in openings):
                continue
            holes.append(hole)
    laid = face(build, frame, length=length, height=height, base=base, mat=mat,
                bed_mat=bed_mat, openings=list(openings) + holes, **kw)
    # the cells: five faces each, sunk behind the leaf
    w, h = mouth
    for hole in holes:
        x, z = hole['x'], hole['base'] + h / 2
        shade = build.tone(0.52, 0.78)
        back = frame.moved(0, -depth, 0)
        build.raised(back, (x, z), (w, h), 0.0, splay=0.0, mat=cell_mat, shade=shade * 0.86,
                     skirts='none')
        for a, b, size in ((x - w / 2, z, (depth, h)), (x + w / 2, z, (depth, h))):
            side = frame.moved(a, -depth / 2, b).turned(90, 'Z')
            build.raised(side, (0, 0), size, 0.0, splay=0.0, mat=cell_mat, shade=shade,
                         skirts='none')
        for zz, tilt in ((z - h / 2, 90), (z + h / 2, -90)):
            # the floor of a cell looks up and takes what the mouth lets in;
            # the ceiling looks down and is the darkest face of the building
            deck = frame.moved(x, -depth / 2, zz).turned(tilt, 'X')
            build.raised(deck, (0, 0), (w, depth), 0.0, splay=0.0, mat=cell_mat,
                         shade=shade * (1.12 if tilt > 0 else 0.78), skirts='none')
    return {'bricks': laid, 'cells': len(holes), 'columns': columns, 'rows': rows}
