import type { PolicyPaintingEntry } from './policy';

/** Pixel-edge coordinates are measured from the source image's top-left.
 * These are display crops, not authenticated registrations to centimetres.
 * The original bytes and complete source remain available through Sources.
 */
export interface PictureDisplayWindow {
  readonly sourceId: string;
  readonly sourceSha256: string;
  readonly evidenceId: string;
  readonly evidenceSha256: string;
  readonly referenceWidth: number;
  readonly referenceHeight: number;
  /** Left, top, right, bottom. Null when no complete content boundary exists. */
  readonly boundsPx: readonly [number, number, number, number] | null;
  /** Approximate visible corners, clockwise from top-left; not a homography. */
  readonly cornersPx: readonly (readonly [number, number] | null)[];
  /** Optional apex/spring observations for an arch; never use as quad corners. */
  readonly archLandmarksPx?: readonly (readonly [number, number])[];
  readonly uncertaintyPx: number;
  readonly shape: 'rectangle' | 'arch' | 'clipped';
  readonly extent: 'visible-painting-aperture' | 'printed-illustration' | 'photographed-support' | 'clipped-painting';
  readonly approvedForDisplayCrop: boolean;
  /** Remains false: a visible aperture/print is not an authenticated support extent. */
  readonly physicalRegistration: false;
  readonly note: string;
}

/** Manual visible-edge evidence, checked against the complete hashed sources.
 * A narrow uncertain border is retained to avoid trimming painted content.
 * No bounds were computed from the target centimetre ratio.
 */
export const PICTURE_DISPLAY_WINDOWS: readonly PictureDisplayWindow[] = [
{
  "sourceId": "vinci/painting-plate/virgin-and-child-with-st-anne__3081x4096",
  "sourceSha256": "1105bfb980ac0333fa68eaaffcc07dfd65470aefcf9ce81a0d4fe7bdabb9edd3",
  "evidenceId": "vinci/painting-plate/virgin-and-child-with-st-anne__3081x4096",
  "evidenceSha256": "1105bfb980ac0333fa68eaaffcc07dfd65470aefcf9ce81a0d4fe7bdabb9edd3",
  "referenceWidth": 3081,
  "referenceHeight": 4096,
  "boundsPx": [
    466,
    477,
    2607,
    3630
  ],
  "cornersPx": [
    [
      478,
      486
    ],
    [
      2601,
      481
    ],
    [
      2603,
      3626
    ],
    [
      469,
      3627
    ]
  ],
  "uncertaintyPx": 8,
  "shape": "rectangle",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "Full-source inspection and RGB edge statistics identify the photographed frame aperture. The conservative window retains its narrow shadow/rebate boundary. The original 113 cm field versus enlarged 130 cm support is not authenticated by these visible aperture edges."
},
{
  "sourceId": "vinci/painting-plate/virgin-of-the-rocks-london",
  "sourceSha256": "1c84b73ff94b3ef2b04a217b5484a7f287c11ec7089b8c20966210ceeae0bc25",
  "evidenceId": "vinci/painting-plate/virgin-of-the-rocks-london",
  "evidenceSha256": "1c84b73ff94b3ef2b04a217b5484a7f287c11ec7089b8c20966210ceeae0bc25",
  "referenceWidth": 3244,
  "referenceHeight": 4096,
  "boundsPx": [
    774,
    912,
    2444,
    3483
  ],
  "cornersPx": [
    null,
    null,
    [
      2440,
      3477
    ],
    [
      780,
      3476
    ]
  ],
  "archLandmarksPx": [[1605, 923], [2440, 1635]],
  "uncertaintyPx": 12,
  "shape": "arch",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "The central arched aperture is visible inside an architectural frame. Top rectangular corners do not exist: apex and right-spring observations are separate arch landmarks. This window alone retains gilded spandrels; an independently checked arch mask is needed to conceal them. Rebate-hidden support and the roughly 3 percent content aspect mismatch prevent a true-size claim."
},
{
  "sourceId": "vinci/painting-plate/madonna-litta",
  "sourceSha256": "4b7b5522ff9e2959b0953140a475ebe282d5b4a3e94ec86af44be7e4b4294bc2",
  "evidenceId": "vinci/painting-plate/madonna-litta",
  "evidenceSha256": "4b7b5522ff9e2959b0953140a475ebe282d5b4a3e94ec86af44be7e4b4294bc2",
  "referenceWidth": 3219,
  "referenceHeight": 4096,
  "boundsPx": [
    170,
    43,
    3200,
    3910
  ],
  "cornersPx": [
    [
      211,
      58
    ],
    [
      3180,
      48
    ],
    [
      3187,
      3902
    ],
    [
      176,
      3863
    ]
  ],
  "uncertaintyPx": 12,
  "shape": "rectangle",
  "extent": "photographed-support",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "The source includes greyscale at left and a colour chart below. This conservative window removes those charts while retaining narrow uncertain mounting/support edges. The skewed perimeter and unclear support-versus-painted-field identity prevent physical registration; the apparently matching whole-raster ratio was coincidental."
},
{
  "sourceId": "vinci/painting-plate/mona-lisa",
  "sourceSha256": "20a5bc9706932c222c7b9c4b22763ac76d1f2d1abb932f8035b77c5513da9a8e",
  "evidenceId": "vinci/painting-plate/mona-lisa",
  "evidenceSha256": "20a5bc9706932c222c7b9c4b22763ac76d1f2d1abb932f8035b77c5513da9a8e",
  "referenceWidth": 3203,
  "referenceHeight": 4096,
  "boundsPx": [
    576,
    577,
    2380,
    3140
  ],
  "cornersPx": [
    [
      580,
      583
    ],
    [
      2353,
      586
    ],
    [
      2375,
      3114
    ],
    [
      602,
      3133
    ]
  ],
  "uncertaintyPx": 6,
  "shape": "rectangle",
  "extent": "printed-illustration",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "Crop scope is the historical printed illustration only. The printed quadrilateral is slightly sheared and differs from the locked panel ratio by about 4 percent. Paper, book binding and captions belong in the complete source view; the print is not authenticated evidence of original panel edges or colour."
},
{
  "sourceId": "vinci/painting-plate/annunciation",
  "sourceSha256": "2eddb9bb502a12c4fbc029d85225592922cca0d12d3e1eda4a696a20b3c7a410",
  "evidenceId": "vinci/painting-plate/annunciation",
  "evidenceSha256": "2eddb9bb502a12c4fbc029d85225592922cca0d12d3e1eda4a696a20b3c7a410",
  "referenceWidth": 4096,
  "referenceHeight": 1880,
  "boundsPx": [
    40,
    26,
    4070,
    1858
  ],
  "cornersPx": [
    [
      50,
      40
    ],
    [
      4060,
      35
    ],
    [
      4060,
      1843
    ],
    [
      48,
      1847
    ]
  ],
  "uncertaintyPx": 8,
  "shape": "rectangle",
  "extent": "photographed-support",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "Four thin support edges are visible. The conservative window retains narrow uncertain edges rather than cropping paint. The source has slight edge irregularity, and the locked 98 by 217 cm measurement conflicts with a supplied holder measurement of 90 by 222 cm; no source crop settles that conflict."
},
{
  "sourceId": "vinci/painting-plate/portrait-of-a-musician",
  "sourceSha256": "e81d45b33accbb4f33eeff4996fbc423423399c6e46879fb5ec761545e36fc74",
  "evidenceId": "vinci/painting-preview/portrait-of-a-musician",
  "evidenceSha256": "b53ffb599a05925414ce57e0bfd779b8b736744e68ab169e1b0a5aa0b68c6d63",
  "referenceWidth": 780,
  "referenceHeight": 1024,
  "boundsPx": [
    39,
    23,
    737,
    1000
  ],
  "cornersPx": [
    [
      45,
      28
    ],
    [
      733,
      27
    ],
    [
      734,
      995
    ],
    [
      42,
      996
    ]
  ],
  "uncertaintyPx": 3,
  "shape": "rectangle",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "Preview inspection identifies a narrow bluish mounting edge within the larger dark photographic surround. The conservative crop retains the uncertain inner edge and all unfinished torso/hand. Full-resolution corner review remains desirable; this is a display crop, not support authentication."
},
{
  "sourceId": "vinci/painting-plate/saint-john-the-baptist",
  "sourceSha256": "381a02a0b49ef784b69d4aca5bd959e9f9a78f5dc241aa5fcb54d5c82f52bb4a",
  "evidenceId": "vinci/painting-preview/saint-john-the-baptist",
  "evidenceSha256": "c5187b097691d44368c1ade22b8ff7c268081d5c421944b05701ba78a45ed025",
  "referenceWidth": 813,
  "referenceHeight": 1024,
  "boundsPx": [
    15,
    14,
    797,
    1018
  ],
  "cornersPx": [
    [
      21,
      19
    ],
    [
      791,
      18
    ],
    [
      793,
      1013
    ],
    [
      18,
      1014
    ]
  ],
  "uncertaintyPx": 3,
  "shape": "rectangle",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "Preview inspection identifies a thin photographed frame. The conservative window removes the larger outer frame while retaining its uncertain dark rebate. Photograph perspective and the hidden panel edge remain unregistered."
},
{
  "sourceId": "vinci/painting-plate/last-supper",
  "sourceSha256": "11c424a90c8277b7bd5d68c4be1e9a5bf300eaf0d62c1b58c7b77b3f7ddcce70",
  "evidenceId": "vinci/painting-preview/last-supper",
  "evidenceSha256": "977a2e44b2b521b47a7620c0824f16a3fb54b9fefc59aa90c1e6ddb0d3309097",
  "referenceWidth": 1024,
  "referenceHeight": 569,
  "boundsPx": [
    0,
    30,
    1024,
    569
  ],
  "cornersPx": [
    [
      0,
      37
    ],
    [
      1024,
      35
    ],
    null,
    null
  ],
  "uncertaintyPx": 4,
  "shape": "rectangle",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": false,
  "physicalRegistration": false,
  "note": "A non-painted cornice is visible at the top, but the full lower and lateral physical field boundary is not established from this preview. Preserve the doorway loss; do not approve a field crop from an aspect-ratio match alone."
},
{
  "sourceId": "vinci/painting-plate/yarnwinder-lansdowne__1992x2401",
  "sourceSha256": "6af4134f6d1952000b4ba7d94319000e866f7c076890e256ae6e3a93171de99a",
  "evidenceId": "vinci/painting-preview/yarnwinder-lansdowne__850x1024",
  "evidenceSha256": "df3b964d68dcdcac9992375ba86707d3ba7d352030b582497add78697b9cea5c",
  "referenceWidth": 850,
  "referenceHeight": 1024,
  "boundsPx": [
    174,
    169,
    692,
    869
  ],
  "cornersPx": [
    [
      178,
      175
    ],
    [
      687,
      172
    ],
    [
      690,
      864
    ],
    [
      177,
      863
    ]
  ],
  "uncertaintyPx": 3,
  "shape": "rectangle",
  "extent": "visible-painting-aperture",
  "approvedForDisplayCrop": true,
  "physicalRegistration": false,
  "note": "The exhibition photograph includes a broad gilt frame. Conservative bounds remove that context while retaining uncertain rebate pixels. The visible quadrilateral is slightly skewed and is not documented as the Met measurement extent."
},
{
  "sourceId": "vinci/painting-plate/leda-spiridon",
  "sourceSha256": "1e38e455690aed880f3bd5aa6a111f9c279adb21de172ed3a046f4603739f4dd",
  "evidenceId": "vinci/painting-plate/leda-spiridon",
  "evidenceSha256": "1e38e455690aed880f3bd5aa6a111f9c279adb21de172ed3a046f4603739f4dd",
  "referenceWidth": 2534,
  "referenceHeight": 3648,
  "boundsPx": null,
  "cornersPx": [
    null,
    [
      2340,
      128
    ],
    null,
    null
  ],
  "uncertaintyPx": 12,
  "shape": "clipped",
  "extent": "clipped-painting",
  "approvedForDisplayCrop": false,
  "physicalRegistration": false,
  "note": "The photograph is oblique, its upper-left and lower panel boundary are clipped, and glass reflections obscure the lower content. No complete rectangular content window can be verified without deleting or inventing painting."
},
{
  "sourceId": "vinci/painting-plate/tavola-doria",
  "sourceSha256": "ae8ef563706d00fe581732b5aee953dbb04c5c13dea6666954c5326d09f6d717",
  "evidenceId": "vinci/painting-preview/tavola-doria",
  "evidenceSha256": "f17b57dd69e91fa2fb0bf077702c5e35f86778fff53299c11abfe2478d0abb4d",
  "referenceWidth": 1024,
  "referenceHeight": 619,
  "boundsPx": null,
  "cornersPx": [
    null,
    null,
    null,
    null
  ],
  "uncertaintyPx": 4,
  "shape": "clipped",
  "extent": "clipped-painting",
  "approvedForDisplayCrop": false,
  "physicalRegistration": false,
  "note": "The photographed painting continues beyond raster edges, with only partial frame visible. A complete physical rectangle cannot be reconstructed from this clipped source."
}
];

/** Match exact source identity and bytes. A same-work substitute never inherits a crop. */
export function pictureDisplayWindow(source: Pick<PolicyPaintingEntry, 'id' | 'sha256'>): PictureDisplayWindow | null {
  return PICTURE_DISPLAY_WINDOWS.find(window => window.sourceId === source.id
    && window.sourceSha256 === source.sha256) ?? null;
}

export interface PictureSourceUVWindow {
  /** Image top-left convention. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  /** Three UV convention: v=0 at the bottom, with unchanged source bitmap orientation. */
  readonly offsetU: number;
  readonly offsetV: number;
  readonly scaleU: number;
  readonly scaleV: number;
  readonly contentAspect: number;
}

/** An affine UV window only: no image editing, projective rectification or colour operation. */
export function pictureDisplayUV(window: PictureDisplayWindow): PictureSourceUVWindow | null {
  if (!window.approvedForDisplayCrop || !window.boundsPx) return null;
  const [x0, y0, x1, y1] = window.boundsPx;
  if (![x0, y0, x1, y1, window.referenceWidth, window.referenceHeight].every(Number.isFinite)
    || x0 < 0 || y0 < 0 || x1 > window.referenceWidth || y1 > window.referenceHeight || x1 <= x0 || y1 <= y0) {
    throw new RangeError('Source content bounds must lie inside the exact evidence raster.');
  }
  const left = x0 / window.referenceWidth;
  const right = x1 / window.referenceWidth;
  const top = y0 / window.referenceHeight;
  const bottom = y1 / window.referenceHeight;
  return { left, right, top, bottom, offsetU: left, offsetV: 1 - bottom,
    scaleU: right - left, scaleV: bottom - top, contentAspect: (x1 - x0) / (y1 - y0) };
}

/** Numerical containment is reported separately from physical edge identity.
 * Calling this function never upgrades a display crop to a true-size registration.
 */
export function assessPictureDisplayWindow(
  window: PictureDisplayWindow,
  extent: { readonly width_cm: number | null; readonly height_cm: number | null },
) {
  const uv = pictureDisplayUV(window);
  if (!uv || extent.width_cm === null || extent.height_cm === null) return null;
  if (!(extent.width_cm > 0 && extent.height_cm > 0)
    || !Number.isFinite(extent.width_cm + extent.height_cm)) throw new RangeError('Physical extent must be finite and positive.');
  const [x0, y0, x1, y1] = window.boundsPx!;
  const p = x1 - x0;
  const q = y1 - y0;
  const scale = Math.min(extent.width_cm / p, extent.height_cm / q);
  const widthCm = p * scale;
  const heightCm = q * scale;
  const errorForRatio = (ratio: number) => 100 * (1 - Math.min(ratio / (extent.width_cm! / extent.height_cm!), (extent.width_cm! / extent.height_cm!) / ratio));
  const nominalErrorPercent = errorForRatio(p / q);
  const margin = 2 * window.uncertaintyPx;
  const worstCaseErrorPercent = p > margin && q > margin
    ? Math.max(errorForRatio((p - margin) / (q + margin)), errorForRatio((p + margin) / (q - margin))) : Infinity;
  return {
    widthM: widthCm / 100, heightM: heightCm / 100,
    nominalErrorPercent, nominalWithinOnePercent: nominalErrorPercent <= 1,
    worstCaseErrorPercent, boundaryUncertaintyWithinOnePercent: worstCaseErrorPercent <= 1,
    physicalRegistration: window.physicalRegistration,
    registeredReproductionPass: false as const,
  };
}
