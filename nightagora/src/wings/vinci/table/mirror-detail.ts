import type { Texture } from 'three/webgpu'

const WIDTH = 720, HEIGHT = 180
// Normalized coordinates in the upright facsimile, before the stream's flipY.
const CROP = { x: 0.25, y: 0.61, width: 0.40, height: 0.067 }
const COPY = {
  en: {
    heading: 'The same ink, reversed',
    original: 'Facsimile detail',
    mirrored: 'Mirrored reading detail',
    note: 'Enlarged detail · the complete facsimile remains above',
    unavailable: 'Detail unavailable',
  },
  de: {
    heading: 'Dieselbe Tinte, gespiegelt',
    original: 'Faksimile-Detail',
    mirrored: 'Gespiegeltes Lesedetail',
    note: 'Vergrößertes Detail · das vollständige Faksimile bleibt darüber',
    unavailable: 'Detail nicht verfügbar',
  },
}
const CSS = `
.vt-mirror-detail{margin:0;padding:18px 0;color:inherit;min-width:0}
.vt-mirror-detail[hidden]{display:none}
.vt-mirror-detail h3{font:inherit;font-size:20px;line-height:1.25;margin:0 0 12px}
.vt-mirror-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
.vt-mirror-detail-grid[hidden]{display:none}
.vt-mirror-detail-label{font:12px/1.4 system-ui,sans-serif;margin:0 0 6px;overflow-wrap:anywhere}
.vt-mirror-detail canvas{display:block;width:100%;height:auto;aspect-ratio:4/1}
.vt-mirror-detail-note,.vt-mirror-detail-status{font:12px/1.5 system-ui,sans-serif;margin:10px 0 0;opacity:.8}
.vt-mirror-detail-status[hidden]{display:none}
`

/** A labelled crop of an already admitted plate. It never owns or fetches its source. */
export function createMirrorDetail() {
  let disposed = false
  let lang: 'en' | 'de' = 'en'
  const element = document.createElement('figure')
  element.className = 'vt-mirror-detail'
  element.dataset['detail'] = 'DETAIL'
  element.dataset['crop'] = JSON.stringify(CROP)
  const style = document.createElement('style')
  style.textContent = CSS
  const caption = document.createElement('figcaption')
  const heading = document.createElement('h3')
  caption.append(heading)
  const grid = document.createElement('div')
  grid.className = 'vt-mirror-detail-grid'
  const labels: HTMLParagraphElement[] = []
  const canvases = [false, true].map(mirrored => {
    const column = document.createElement('div')
    const label = document.createElement('p')
    label.className = 'vt-mirror-detail-label'
    labels.push(label)
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    canvas.setAttribute('role', 'img')
    canvas.dataset['detail'] = 'DETAIL'
    canvas.dataset['mirrored'] = String(mirrored)
    column.append(label, canvas)
    grid.append(column)
    return canvas
  })
  const original = canvases[0]!, mirrored = canvases[1]!
  const note = document.createElement('p')
  note.className = 'vt-mirror-detail-note'
  const status = document.createElement('p')
  status.className = 'vt-mirror-detail-status'
  status.setAttribute('role', 'status')
  element.append(style, caption, grid, note, status)

  function language(next: 'en' | 'de') {
    if (disposed) return
    lang = next
    const copy = COPY[lang]
    element.lang = lang
    element.setAttribute('aria-label', copy.heading)
    heading.textContent = copy.heading
    labels[0]!.textContent = copy.original
    labels[1]!.textContent = copy.mirrored
    original.setAttribute('aria-label', copy.original)
    mirrored.setAttribute('aria-label', copy.mirrored)
    original.textContent = copy.original
    mirrored.textContent = copy.mirrored
    note.textContent = copy.note
    status.textContent = copy.unavailable
  }

  function clear() {
    for (const canvas of canvases) {
      const context = canvas.getContext('2d')
      context?.setTransform(1, 0, 0, 1, 0, 0)
      context?.clearRect(0, 0, WIDTH, HEIGHT)
    }
    for (const key of ['naClaim', 'naAnchor', 'naAnchorClass', 'page', 'licence']) delete element.dataset[key]
    element.dataset['ready'] = 'false'
    grid.hidden = true
    status.hidden = false
  }

  function update(texture: Texture | null) {
    if (disposed) return
    clear()
    if (!texture) return
    const source: unknown = texture.image
    const manifestId: unknown = texture.userData['manifestId']
    const licence: unknown = texture.userData['licence']
    if (typeof ImageBitmap === 'undefined' || !(source instanceof ImageBitmap)
      || source.width <= 0 || source.height <= 0
      || typeof manifestId !== 'string' || !manifestId
      || typeof licence !== 'string' || !licence) return
    const context = original.getContext('2d')
    const reverse = mirrored.getContext('2d')
    if (!context || !reverse) return
    try {
      const sx = source.width * CROP.x
      const sy = source.height * (1 - CROP.y - CROP.height)
      const sw = source.width * CROP.width, sh = source.height * CROP.height
      // Contain the crop: paper and lettering retain their original proportions.
      const scale = Math.min(WIDTH / sw, HEIGHT / sh)
      const width = sw * scale, height = sh * scale
      context.setTransform(1, 0, 0, -1, 0, HEIGHT)
      context.drawImage(source, sx, sy, sw, sh, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height)
      context.setTransform(1, 0, 0, 1, 0, 0)
      // Copy the same rendered crop one pixel for one pixel. This is an exact
      // horizontal reversal, without a second interpolation or a colour filter.
      reverse.setTransform(-1, 0, 0, 1, WIDTH, 0)
      reverse.drawImage(original, 0, 0)
      reverse.setTransform(1, 0, 0, 1, 0, 0)
      element.dataset['naClaim'] = 'documented'
      element.dataset['naAnchor'] = manifestId
      element.dataset['naAnchorClass'] = 'PD-ART'
      element.dataset['page'] = String(texture.userData['page'] ?? '')
      element.dataset['licence'] = licence
      element.dataset['ready'] = 'true'
      grid.hidden = false
      status.hidden = true
    } catch {
      // A released stream bitmap must not leave a previous folio under a new label.
      clear()
    }
  }

  language('en')
  clear()
  return {
    element, update, language,
    // Exact RGBA8 canvas backing-store bytes; no additional texture or bitmap.
    bytes: () => canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
    dispose() {
      if (disposed) return
      disposed = true
      for (const canvas of canvases) canvas.width = canvas.height = 0
      element.remove()
      style.remove()
    },
  }
}
