/* THE FOLIO DOOR beside a machine, the island's and the filmed cycle's alike:
   the sheet's thumbnail where the store holds one, else its name. On the
   phone the door is a 44 px glass in the views' row, where no name fits whole,
   so a drawn leaf stands in the glass and the name stays the door's own. */

export type FolioSheet = { src: Promise<string | null> | null; label: string; open(): void }

const SVG = 'http://www.w3.org/2000/svg'

function drawnLeaf(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg')
  svg.setAttribute('class', 'vitrine-folio-leaf')
  svg.setAttribute('viewBox', '0 0 20 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = doc.createElementNS(SVG, 'path')
  path.setAttribute('d', 'M3.5 1.5h9l4.5 4.5v16.5h-13.5z M12.5 1.5v4.5h4.5 M6.5 10.5h7.5 M6.5 14h7.5 M6.5 17.5h5')
  svg.append(path)
  return svg
}

export function folioDoor(doc: Document, sheet: FolioSheet, narrow: boolean, signal: AbortSignal, live: () => boolean): HTMLButtonElement {
  const door = doc.createElement('button')
  door.className = narrow ? 'vitrine-folio vitrine-folio-glass' : 'vitrine-folio'
  door.type = 'button'
  door.setAttribute('aria-label', sheet.label)
  const named = (): void => { if (narrow) door.append(drawnLeaf(doc)); else door.textContent = sheet.label }
  if (sheet.src) {
    void sheet.src.then(src => {
      if (!live()) return
      if (!src) { named(); return }
      const image = doc.createElement('img')
      image.className = 'vitrine-folio-thumb'
      image.alt = ''
      image.decoding = 'async'
      image.src = src
      door.append(image)
    })
  } else named()
  door.addEventListener('click', () => sheet.open(), { signal })
  return door
}
