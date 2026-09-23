// THE ROOMS THIS EXPORT KNOWS: where each stands, which object proves the
// wing's scene is the one read, the stops it is filmed from, and what stands
// in it that must be standing before it is read. A box is in three's frame
// (x east, y up, z south), metres, a few centimetres past the room's faces:
// a mesh that meets it comes whole (the building's shell is one body), so the
// rooms seen through a door keep their walls.

export const ROOMS = {
  hall: {
    wing: 'vinci',
    title: 'the mechanism hall',
    marker: 'vinci/collection-hall-fabric',
    stops: ['flight', 'works'],
    // the hall's faces: west -61.66, east -39.02, south -63.66, north -42.04,
    // floor -6.3, roof 1.05 at the clerestory
    box: { min: [-61.96, -7.3, 41.74], max: [-38.72, 2.3, 63.96] },
    // every machine the room stands, by its dossier slug: the read waits for
    // each to hold its parts
    machines: ['aerial-screw', 'miter-lock-gates', 'water-lifting-screw', 'rolling-mill', 'lathe',
      'flywheel', 'ball-bearing', 'camera-obscura', 'multi-barrel-gun'],
    // bodies that meet the box but are not the room: the sky becomes the
    // world, the ground outside is never seen from inside, and the air is
    // translated rather than drawn
    exclude: {
      'vinci/sky': 'the sky dome: photographed into the world instead (see sky.hdr)',
      'vinci/terrain': 'the ground outside the building: not seen from the room',
      'vinci/vegetation': 'the trees outside the building: not seen from the room',
      'vinci/ground-dressing': 'the gravel outside the building: not seen from the room',
      'vinci/collection-hall-air': 'the hall air: a ray-marched volume, translated to a Cycles volume (air.json)',
      'vinci/collection-plates': 'the pictures on the hanging wall face the picture room: not seen from the hall',
      'vinci/table-furniture': 'the reading table stands in the gallery, behind the partition',
    },
    // where the sky seen through the room's openings is photographed from
    skyEye: [-50.4, 0.6, 43.0],
    // THE AIR (hall-air.ts, exhibits.ts HALL_AIR_DENSITY): a box over the
    // hall's plan from the floor to 1.0 m, 3 cm in from every face, marched
    // in 88 steps; densest low down, never quite even, lit by the five spots.
    // The density is read from its source at export time.
    air: { name: 'vinci/collection-hall-air', density: { file: 'src/wings/vinci/collection/exhibits.ts', constant: 'HALL_AIR_DENSITY' }, top: 1.0, inset: 0.03, floor: -6.3, steps: 88,
      low: [0.8, 0.2], drift: { frequency: 0.23, amount: 0.35 }, litBy: 'the five spots, never the clerestory',
      west: -61.66, east: -39.02, south: -63.66, north: -42.04 },
    // THE ROOM'S BOUNCE (hall-light.ts): the probe the engine takes at the
    // middle of the hall, twice, and reads at 1.35 of what it holds
    probe: { at: [-50.3, -4.2, 52.85], gain: 1.35, size: 256 },
    // THE PRINT at each stop (index.ts PRINT, STATION_EXPOSURE, STATION_SHOULDER)
    print: { exposure: { flight: 1.55, works: 1.55 }, shoulder: { flight: 1, works: 1 },
      lift: [0.012, 0.014, 0.018], gamma: [1, 1, 1], gain: [1, 1, 1], warm: [1, 1, 1], cool: [1, 1, 1],
      split: 0.055, saturation: 0.9, vignette: 0.15, grain: 'held (0), as the stills are shot' },
    // the stills' two framings (forge/prerender/stills.mjs FRAMINGS): the
    // canvas each is drawn at and the rail viewport it takes its pose from
    framings: { wide: { viewport: 'desktop', stage: [2400, 1350] }, upright: { viewport: 'phone', stage: [1170, 2532] } },
  },
}
