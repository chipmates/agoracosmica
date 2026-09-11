import { FontLoader, type FontData } from 'three/addons/loaders/FontLoader.js'

/** An original, regenerable vector alphabet. No bitmap, system font, fetched
 * font or undocumented outline is used. Units are one thousand per cap height.
 * The small serifs and deliberately open counters suit letters made in stone.
 * Lowercase is drawn separately: source case and German diacritics survive. */
type Point = readonly [number, number]
type Glyph = FontData['glyphs'][string]
const glyphs: FontData['glyphs'] = {}
const round = (n: number) => Math.round(n * 100) / 100

function polygon(points: readonly Point[]): string {
  if (points.length < 3) return ''
  // FontLoader expects a clockwise exterior contour.
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  const p = area > 0 ? [...points].reverse() : [...points]
  return p.map((q, i) => `${i ? 'l' : 'm'} ${round(q[0])} ${round(q[1])}`).join(' ') +
    ` l ${round(p[0]![0])} ${round(p[0]![1])}`
}

/** Continuous mitered stroke, so curved letters have no segment caps. */
function stroke(points: readonly Point[], weight = 56): string {
  weight *= 1.45
  const normals: Point[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    normals.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l])
  }
  const side = (sign: number): Point[] => points.map((p, i) => {
    const before = normals[Math.max(0, i - 1)]!, after = normals[Math.min(normals.length - 1, i)]!
    const nx = before[0] + after[0], ny = before[1] + after[1]
    const scale = sign * weight / Math.max(0.65, nx * after[0] + ny * after[1]) / 2
    return [p[0] + nx * scale, p[1] + ny * scale]
  })
  return polygon([...side(1), ...side(-1).reverse()])
}
const line = (x1: number, y1: number, x2: number, y2: number, w = 56) =>
  stroke([[x1, y1], [x2, y2]], w)
function arc(cx: number, cy: number, rx: number, ry: number, a: number, b: number, w = 56): string {
  // Twenty segments for a whole counter keeps its silhouette subpixel at the
  // bench's reading distance while the complete six-quote wall stays in tier.
  const steps = Math.max(5, Math.ceil(Math.abs(b - a) / (Math.PI / 10)))
  const points: Point[] = Array.from({ length: steps + 1 }, (_, i) => {
    const t = a + (b - a) * i / steps
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]
  })
  return stroke(points, w)
}
const ring = (cx: number, cy: number, rx: number, ry: number, w = 56) =>
  arc(cx, cy, rx, ry, -Math.PI / 2, Math.PI * 1.5, w)
const dot = (x: number, y: number, r = 35) => polygon(Array.from({ length: 10 }, (_, i) =>
  [x + Math.cos(i * Math.PI / 5) * r, y + Math.sin(i * Math.PI / 5) * r] as Point))
const serif = (x: number, y: number, wide = 80) => line(x - wide, y, x + wide, y, 28)
const stem = (x: number, lo = 0, hi = 1000, w = 65) =>
  line(x, lo, x, hi, w) + ' ' + serif(x, lo) + ' ' + serif(x, hi)
function add(char: string, advance: number, ...outlines: string[]): void {
  glyphs[char] = { ha: advance, x_min: 0, x_max: advance - 45, o: outlines.join(' ') }
}
const cap = (char: string, ...parts: string[]) => add(char, 780, ...parts)
cap('A', line(90, 0, 365, 1000), line(365, 1000, 680, 0, 76), line(205, 375, 565, 375, 40), serif(90, 0), serif(680, 0))
cap('B', stem(135), arc(140, 750, 440, 250, -Math.PI / 2, Math.PI / 2, 70), arc(140, 255, 480, 255, -Math.PI / 2, Math.PI / 2, 70))
cap('C', arc(390, 500, 310, 500, Math.PI / 4, Math.PI * 1.77, 63), line(620, 790, 620, 975, 38))
cap('D', stem(135), arc(140, 500, 490, 500, -Math.PI / 2, Math.PI / 2, 67))
cap('E', stem(140), line(140, 1000, 630, 1000, 40), line(140, 0, 630, 0, 40), line(140, 510, 545, 510, 40), line(630, 0, 660, 160, 35), line(630, 1000, 650, 850, 35), line(545, 420, 545, 600, 30))
cap('F', stem(140), line(140, 1000, 630, 1000, 40), line(140, 510, 545, 510, 40), line(630, 1000, 650, 850, 35), line(545, 420, 545, 600, 30))
cap('G', arc(390, 500, 310, 500, Math.PI / 4, Math.PI * 1.93, 63), line(680, 440, 680, 115, 65), line(500, 450, 725, 450, 36))
cap('H', stem(140), stem(635), line(140, 505, 635, 505, 39))
add('I', 400, stem(200, 0, 1000, 68))
cap('J', stem(570, 200), arc(345, 210, 225, 210, Math.PI, Math.PI * 2, 63), dot(120, 230, 46))
cap('K', stem(140), line(155, 430, 630, 1000, 42), line(330, 650, 665, 0, 80), serif(630, 1000), serif(665, 0))
cap('L', stem(140), line(140, 0, 635, 0, 42), line(635, 0, 675, 195, 35))
add('M', 1020, stem(130, 0, 1000, 44), stem(875, 0, 1000, 65), line(130, 1000, 510, 110, 70), line(510, 110, 875, 1000, 44))
cap('N', stem(140, 0, 1000, 42), stem(640, 0, 1000, 42), line(140, 1000, 640, 0, 74))
cap('O', ring(390, 500, 305, 500, 66))
cap('P', stem(140), arc(145, 740, 460, 260, -Math.PI / 2, Math.PI / 2, 67))
cap('Q', ring(390, 500, 305, 500, 66), line(435, 180, 740, -180, 62))
cap('R', stem(140), arc(145, 750, 450, 250, -Math.PI / 2, Math.PI / 2, 67), line(335, 495, 665, 0, 75), serif(665, 0))
cap('S', arc(385, 755, 275, 245, Math.PI / 7, Math.PI * 1.5, 66), arc(375, 265, 285, 265, -Math.PI * .86, Math.PI / 2, 66), line(115, 0, 95, 215, 34), line(650, 1000, 650, 795, 34))
cap('T', stem(390), line(70, 1000, 710, 1000, 42), line(70, 1000, 40, 815, 32), line(710, 1000, 740, 815, 32))
cap('U', stem(140, 275), stem(640, 275, 1000, 42), arc(390, 270, 250, 270, Math.PI, Math.PI * 2, 60))
cap('V', line(80, 1000, 390, 0, 75), line(390, 0, 700, 1000, 43), serif(80, 1000), serif(700, 1000))
add('W', 1100, line(80, 1000, 295, 0, 72), line(295, 0, 540, 865, 42), line(500, 1000, 760, 0, 72), line(760, 0, 1010, 1000, 42), serif(80, 1000), serif(500, 1000), serif(1010, 1000))
// A crossing's thinner contour must be split at the intersection: r185's
// ShapePath containment test otherwise mistakes it for a redundant interior
// contour of the broader diagonal. Endpoints and stroke widths stay exact.
cap('X', line(100, 1000, 675, 0, 75), line(100, 0, 387.5, 500, 42), line(387.5, 500, 675, 1000, 42), serif(100, 0), serif(100, 1000), serif(675, 0), serif(675, 1000))
cap('Y', stem(390, 0, 460), line(80, 1000, 390, 460, 73), line(390, 460, 700, 1000, 42), serif(80, 1000), serif(700, 1000))
cap('Z', line(105, 1000, 680, 1000, 40), line(680, 1000, 100, 0, 71), line(100, 0, 680, 0, 40), line(105, 1000, 80, 850, 31), line(680, 0, 710, 175, 31))

const lower = (char: string, ...parts: string[]) => add(char, 635, ...parts)
lower('a', ring(285, 255, 205, 250, 53), stem(510, 0, 530, 56), arc(305, 495, 205, 175, 0, Math.PI * .82, 53))
lower('b', stem(125, 0, 1000, 59), arc(125, 335, 395, 335, -Math.PI / 2, Math.PI / 2, 55))
lower('c', arc(330, 335, 245, 335, .65, Math.PI * 1.8, 55), dot(520, 540, 34))
lower('d', stem(510, 0, 1000, 59), arc(510, 335, 395, 335, Math.PI / 2, Math.PI * 1.5, 55))
lower('e', arc(325, 335, 245, 335, 0, Math.PI * 1.82, 55), line(90, 335, 570, 335, 40))
add('f', 420, stem(180, 0, 800, 58), arc(325, 795, 145, 220, .05, Math.PI, 53), line(45, 670, 365, 670, 37))
lower('g', ring(290, 350, 205, 285, 55), line(505, 630, 505, -80, 54), arc(280, -75, 225, 200, Math.PI, Math.PI * 2, 54), serif(505, 635, 62))
lower('h', stem(125, 0, 1000, 59), arc(320, 435, 195, 235, 0, Math.PI, 54), stem(515, 0, 440, 55))
add('i', 330, stem(165, 0, 670, 56), dot(165, 900, 42))
add('j', 340, stem(205, -70, 670, 56), arc(75, -70, 130, 220, Math.PI, Math.PI * 2, 52), dot(205, 900, 42))
lower('k', stem(125, 0, 1000, 58), line(130, 225, 500, 670, 42), line(290, 405, 540, 0, 64), serif(500, 670, 60), serif(540, 0, 58))
add('l', 335, stem(170, 0, 1000, 58))
add('m', 945, stem(125, 0, 670, 56), arc(305, 445, 180, 225, 0, Math.PI, 53), stem(485, 0, 450, 55), arc(665, 445, 180, 225, 0, Math.PI, 53), stem(845, 0, 450, 55))
lower('n', stem(125, 0, 670, 57), arc(320, 440, 195, 230, 0, Math.PI, 54), stem(515, 0, 440, 55))
lower('o', ring(320, 335, 235, 335, 57))
lower('p', stem(125, -280, 670, 57), arc(125, 335, 400, 335, -Math.PI / 2, Math.PI / 2, 55))
lower('q', stem(510, -280, 670, 57), arc(510, 335, 400, 335, Math.PI / 2, Math.PI * 1.5, 55))
add('r', 480, stem(125, 0, 670, 57), arc(320, 450, 195, 220, .2, Math.PI, 52), dot(485, 525, 36))
lower('s', arc(320, 507, 205, 170, .35, Math.PI * 1.5, 55), arc(310, 171, 220, 171, -Math.PI * .87, Math.PI / 2, 55))
add('t', 445, line(190, 910, 190, 140, 60), line(65, 670, 370, 670, 37), arc(295, 130, 105, 130, Math.PI, Math.PI * 1.92, 53))
lower('u', stem(125, 230, 670, 57), arc(320, 235, 195, 235, Math.PI, Math.PI * 2, 54), stem(515, 0, 670, 54))
lower('v', line(70, 670, 315, 0, 61), line(315, 0, 560, 670, 38), serif(70, 670, 55), serif(560, 670, 55))
add('w', 930, line(65, 670, 250, 0, 62), line(250, 0, 450, 620, 39), line(450, 670, 640, 0, 60), line(640, 0, 845, 670, 37), serif(65, 670, 53), serif(450, 670, 53), serif(845, 670, 53))
lower('x', line(85, 670, 550, 0, 62), line(85, 0, 317.5, 335, 39), line(317.5, 335, 550, 670, 39), serif(85, 0, 53), serif(550, 0, 53), serif(85, 670, 53), serif(550, 670, 53))
lower('y', line(70, 670, 325, 0, 61), line(565, 670, 215, -280, 40), serif(70, 670, 55), serif(565, 670, 55), arc(125, -145, 120, 140, Math.PI, Math.PI * 1.79, 49))
lower('z', line(90, 670, 555, 670, 38), line(555, 670, 85, 0, 62), line(85, 0, 555, 0, 38), line(90, 670, 70, 555, 28), line(555, 0, 575, 125, 28))
lower('ß', stem(125, 0, 780, 57), arc(320, 790, 195, 220, -.7, Math.PI, 53), arc(300, 285, 255, 285, -Math.PI / 2, Math.PI / 2, 57), line(315, 515, 465, 635, 45))

add('0', 700, ring(350, 500, 245, 500, 62))
add('1', 570, stem(325), line(130, 850, 325, 1000, 44))
add('2', 700, arc(350, 760, 245, 240, 0, Math.PI, 60), stroke([[595, 765], [565, 620], [475, 505], [120, 0], [615, 0]], 57), line(615, 0, 645, 160, 30))
add('3', 700, arc(305, 765, 270, 235, -Math.PI / 2, Math.PI * .87, 59), arc(305, 265, 285, 265, -Math.PI * .86, Math.PI / 2, 59))
add('4', 700, stroke([[490, 0], [490, 1000], [70, 310], [635, 310]], 55), serif(490, 0))
add('5', 700, stroke([[590, 1000], [140, 1000], [115, 510]], 54), arc(325, 265, 280, 280, -Math.PI * .87, Math.PI * .73, 59))
add('6', 700, arc(340, 510, 250, 490, Math.PI * .27, Math.PI * 1.55, 59), ring(345, 300, 250, 295, 61))
add('7', 700, stroke([[90, 1000], [620, 1000], [230, 0]], 57), line(80, 1000, 65, 850, 30))
add('8', 700, ring(350, 750, 225, 250, 59), ring(350, 255, 265, 255, 59))
add('9', 700, ring(350, 700, 250, 295, 61), arc(355, 490, 250, 490, Math.PI * 1.25, Math.PI * 2.5, 59))

add(' ', 335)
add('\t', 1340)
add('.', 280, dot(140, 38, 40))
add(',', 280, dot(140, 45, 40), arc(78, 10, 72, 120, -Math.PI / 2, Math.PI / 6, 28))
add(':', 280, dot(140, 38, 38), dot(140, 580, 38))
add(';', 280, glyphs[',']!.o!, dot(140, 580, 38))
add('!', 350, line(175, 260, 175, 1000, 55), dot(175, 38, 42))
add('?', 650, arc(320, 755, 235, 245, -.7, Math.PI, 57), stroke([[500, 597], [320, 445], [320, 270]], 52), dot(320, 38, 42))
add('-', 485, line(70, 360, 415, 360, 45))
add('–', 800, line(55, 360, 745, 360, 42))
add('—', 1100, line(40, 360, 1060, 360, 42))
add('_', 680, line(20, -130, 660, -130, 36))
add('/', 520, line(70, -110, 450, 1060, 39))
add('\\', 520, line(70, 1060, 450, -110, 39))
add('|', 270, line(135, -180, 135, 1050, 35))
add('(', 420, arc(475, 435, 320, 675, Math.PI * .65, Math.PI * 1.35, 43))
add(')', 420, arc(-55, 435, 320, 675, -Math.PI * .35, Math.PI * .35, 43))
add('[', 370, stroke([[290, 1040], [130, 1040], [130, -200], [290, -200]], 42))
add(']', 370, stroke([[80, 1040], [240, 1040], [240, -200], [80, -200]], 42))
add("'", 260, line(140, 1000, 105, 775, 48))
add('"', 440, glyphs["'"]!.o!, line(325, 1000, 290, 775, 48))
add('’', 280, dot(155, 945, 37), arc(95, 925, 70, 130, -Math.PI / 2, Math.PI / 7, 28))
add('‘', 280, dot(135, 790, 37), arc(195, 810, 70, 130, Math.PI / 2, Math.PI * 1.14, 28))
add('“', 500, glyphs['‘']!.o!, dot(345, 790, 37), arc(405, 810, 70, 130, Math.PI / 2, Math.PI * 1.14, 28))
add('”', 500, glyphs['’']!.o!, dot(365, 945, 37), arc(305, 925, 70, 130, -Math.PI / 2, Math.PI / 7, 28))
add('„', 500, dot(155, 45, 37), arc(95, 25, 70, 130, -Math.PI / 2, Math.PI / 7, 28), dot(365, 45, 37), arc(305, 25, 70, 130, -Math.PI / 2, Math.PI / 7, 28))
add('…', 770, dot(130, 38, 38), dot(385, 38, 38), dot(640, 38, 38))
add('·', 285, dot(143, 405, 35))
add('°', 430, ring(215, 820, 125, 140, 37))
add('+', 700, line(80, 440, 620, 440, 45), line(350, 165, 350, 715, 45))
add('=', 700, line(80, 295, 620, 295, 43), line(80, 575, 620, 575, 43))
add('×', 700, line(105, 170, 595, 705, 43), line(105, 705, 350, 437.5, 43), line(350, 437.5, 595, 170, 43))
add('%', 900, ring(220, 800, 130, 190, 43), ring(680, 205, 130, 190, 43), line(160, 0, 740, 1000, 40))
add('&', 820, arc(415, 260, 280, 260, .2, Math.PI * 1.83, 60), arc(340, 780, 195, 220, -.65, Math.PI * 1.6, 52), line(225, 625, 715, 0, 60), line(520, 405, 725, 405, 36))
add('*', 510, line(255, 540, 255, 1000, 35), line(50, 660, 460, 880, 35), line(50, 880, 255, 770, 35), line(255, 770, 460, 660, 35))

for (const [marked, base, kind] of [
  ['ä', 'a', 'umlaut'], ['ö', 'o', 'umlaut'], ['ü', 'u', 'umlaut'],
  ['Ä', 'A', 'umlaut'], ['Ö', 'O', 'umlaut'], ['Ü', 'U', 'umlaut'],
  ['é', 'e', 'acute'], ['è', 'e', 'grave'], ['à', 'a', 'grave'],
  ['ì', 'i', 'grave'], ['â', 'a', 'circumflex'], ['ê', 'e', 'circumflex'],
  ['É', 'E', 'acute'], ['à', 'a', 'grave'], ['ô', 'o', 'circumflex'],
] as const) {
  const g = glyphs[base]!, cx = g.ha / 2, y = base === base.toUpperCase() ? 1170 : 865
  let accent = kind === 'umlaut' ? `${dot(cx - 105, y, 35)} ${dot(cx + 105, y, 35)}` :
    kind === 'acute' ? line(cx - 70, y - 45, cx + 105, y + 125, 42) :
    kind === 'grave' ? line(cx - 105, y + 125, cx + 70, y - 45, 42) :
    stroke([[cx - 145, y - 15], [cx, y + 115], [cx + 145, y - 15]], 35)
  if (base === 'i') {
    // The accent replaces the dot; the literal character remains ì.
    glyphs[marked] = { ...g, o: `${stem(165, 0, 670, 56)} ${accent}` }
  } else glyphs[marked] = { ...g, o: `${g.o} ${accent}` }
}

export const font = new FontLoader().parse({
  glyphs,
  familyName: 'Vinci Bench Roman',
  ascender: 1230,
  descender: -330,
  underlinePosition: -150,
  underlineThickness: 40,
  boundingBox: { xMin: -60, xMax: 1160, yMin: -340, yMax: 1250 },
  resolution: 1000,
  original_font_information: {
    copyright: 'Original procedural outlines generated for the Vinci line bench, 2026-09-09.',
    description: 'Reproducible source geometry; no copied or extracted typeface.',
  },
})

export function textAdvance(text: string, size: number): number {
  return Array.from(text).reduce((n, ch) => n + (glyphs[ch]?.ha ?? glyphs['?']!.ha), 0) * size / 1000
}

/** Never silently substitute a question mark for a catalogue character. */
export function assertGlyphs(text: string): void {
  for (const ch of text) {
    if (ch !== '\n' && ch !== '\r' && !glyphs[ch]) throw new Error(`Vinci vector font has no glyph for ${JSON.stringify(ch)}`)
  }
}

export type { Glyph }
