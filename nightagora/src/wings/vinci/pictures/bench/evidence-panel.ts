/** A typeset transcript of the live hang hook. It performs no measurement.
 * Field and plate geometry are separate rows: a correct empty field cannot
 * certify a reproduction whose geometry has never been measured.
 */
type EvidenceRecord = Record<string, unknown>

const record = (value: unknown): EvidenceRecord => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as EvidenceRecord : {}
const rows = (value: unknown): EvidenceRecord[] => Array.isArray(value) ? value.map(record) : []
const text = (value: unknown, fallback = 'Not supplied'): string => typeof value === 'string' && value.length ? value : fallback

/** Do not round a small measured error to a fictitious zero. */
export function evidenceNumber(value: unknown, significant = 6): string {
  if (typeof value !== 'number') return '—'
  if (!Number.isFinite(value)) return Number.isNaN(value) ? 'NaN' : value < 0 ? '−∞' : '+∞'
  if (value === 0) return Object.is(value, -0) ? '−0' : '0'
  if (Math.abs(value) < .001 || Math.abs(value) >= 1e7) return value.toExponential(significant - 1).replace(/\.?0+e/, 'e')
  return String(Number(value.toPrecision(significant)))
}

const pair = (a: unknown, b: unknown): string => `${evidenceNumber(a)} × ${evidenceNumber(b)}`
const verdict = (value: unknown): string => value === true ? 'Pass' : value === false ? 'Fail' : 'Unmeasured'
const ratio = (value: unknown, limit: unknown): string => `${evidenceNumber(value)} / ${evidenceNumber(limit)}`

/** Layout belongs to the caller. In particular, mount this register below
 * the phone's artwork field; these rules deliberately create no overlay.
 */
export const hangEvidencePanelCSS = `
.picture-evidence { box-sizing:border-box; color:#343c32; background:#f1eee4;
  border-top:1px solid #aaa68f; padding:17px 19px 12px; min-width:0;
  font:13px/1.4 Georgia,'Times New Roman',serif; font-variant-numeric:tabular-nums;
  text-align:left; text-shadow:none; pointer-events:auto; }
.picture-evidence *, .picture-evidence *::before, .picture-evidence *::after { box-sizing:border-box; }
.picture-evidence h2 { margin:0; font:normal 21px/1.2 Georgia,'Times New Roman',serif; }
.picture-evidence p { margin:5px 0; }
.picture-evidence-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.picture-evidence-state { font-size:12px; font-style:italic; white-space:nowrap; }
.picture-evidence-context, .picture-evidence-note { color:#626651; font-size:11px; }
.picture-evidence table { width:100%; border-collapse:collapse; table-layout:fixed; font:inherit; }
.picture-evidence th, .picture-evidence td { text-align:left; vertical-align:top; padding:5px 4px; overflow-wrap:anywhere; }
.picture-evidence thead th { font-weight:normal; color:#626651; border-bottom:1px solid #bdb9a8; font-size:11px; }
.picture-evidence-metrics { margin:10px 0 8px; border-top:1px solid #d1cdbd; border-bottom:1px solid #d1cdbd; font-size:11px!important; }
.picture-evidence-metrics th { width:24%; font-weight:normal; color:#626651; }
.picture-evidence-metrics td { width:26%; }
.picture-evidence-works { margin-top:11px; font-size:11px!important; }
.picture-evidence-works col:first-child { width:14%; }
.picture-evidence-works col:nth-child(2) { width:32%; }
.picture-evidence-works col:nth-child(3) { width:30%; }
.picture-evidence-works col:nth-child(4) { width:24%; }
.picture-evidence-work th { padding-top:10px; padding-bottom:4px; font-weight:normal; font-size:13px; border-top:1px solid #d1cdbd; }
.picture-evidence-work small { display:block; font:10px/1.3 Georgia,'Times New Roman',serif; color:#686c5c; }
.picture-evidence-detail { display:block; margin-top:2px; color:#666b5a; font-size:10px; }
.picture-evidence-datum { padding-top:0!important; color:#666b5a; font-size:10px; }
.picture-evidence-unmeasured { font-style:italic; color:#685a4a; }
.picture-evidence-status { font-style:italic; }
.picture-evidence-pager { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; border-top:1px solid #bdb9a8; }
.picture-evidence-pager button { min-width:44px; min-height:44px; border:0; background:transparent; color:inherit; padding:8px; font:12px/1.2 Georgia,'Times New Roman',serif; cursor:pointer; }
.picture-evidence-pager button:disabled { opacity:.35; cursor:default; }
.picture-evidence-pager button:focus-visible { outline:2px solid #9e7834; outline-offset:1px; }
.picture-evidence-page { margin:0!important; text-align:center; font-size:11px; }
.picture-evidence-errors { margin:9px 0 0; padding:8px 0; border-top:1px solid #bdb9a8; font-size:11px; overflow-wrap:anywhere; }
.picture-evidence-errors p { margin:3px 0; }
.picture-evidence details { margin-top:8px; border-top:1px solid #d1cdbd; }
.picture-evidence summary { display:list-item; min-height:44px; padding:13px 0 9px; cursor:pointer; font-size:12px; }
.picture-evidence summary:focus-visible { outline:2px solid #9e7834; outline-offset:1px; }
.picture-evidence-geometry-detail { font-size:11px; }
.picture-evidence-geometry-detail h3 { margin:9px 0 4px; font-size:12px; font-weight:normal; }
.picture-evidence[data-compact="true"] { padding:0 12px 8px; }
.picture-evidence[data-compact="true"] .picture-evidence-pager { position:sticky; top:0; bottom:auto; z-index:2;
  margin:0 0 7px; border-top:0; border-bottom:1px solid #bdb9a8; background:#f1eee4; }
.picture-evidence[data-compact="true"] h2 { font-size:16px; }
.picture-evidence[data-compact="true"] .picture-evidence-heading { gap:8px; }
.picture-evidence[data-compact="true"] .picture-evidence-context { margin:3px 0; font-size:10px; }
.picture-evidence[data-compact="true"] .picture-evidence-note { display:none; }
.picture-evidence[data-compact="true"] .picture-evidence-works { margin-top:5px; font-size:10px!important; }
.picture-evidence[data-compact="true"] .picture-evidence-works th,
.picture-evidence[data-compact="true"] .picture-evidence-works td { padding:3px; }
.picture-evidence[data-compact="true"] .picture-evidence-work th { font-size:12px; padding-top:6px; }
.picture-evidence[data-compact="true"] .picture-evidence-detail { margin-top:1px; font-size:10px; }
.picture-evidence[data-compact="true"] .picture-evidence-errors { margin-top:5px; padding:4px 0; font-size:10px; }
@media(max-width:699px) {
 .picture-evidence { padding:13px 12px 8px; font-size:12px; }
 .picture-evidence h2 { font-size:19px; }
 .picture-evidence th, .picture-evidence td { padding-left:3px; padding-right:3px; }
 .picture-evidence-metrics { font-size:10px!important; }
 .picture-evidence-works { font-size:10px!important; }
 .picture-evidence-work th { font-size:12px; }
 .picture-evidence-context, .picture-evidence-note { font-size:10px; }
}
`

export interface HangEvidencePanelOptions {
  document?: Document
  page?: number
  /** Works per page. Six remains the normal register-page convention. */
  pageSize?: number
  /** Put geometry first; full renderer and calibration detail stays expandable. */
  compact?: boolean
  /** The control downloads the exact latest supplied JSON, including all pages. */
  download?: boolean
  onPageChange?: (page: number) => void
}

export interface HangEvidencePanel {
  root: HTMLElement
  update(value: unknown, page?: number): void
  page(): number
  /** Latest supplied hook data, independent of the displayed page. */
  snapshot(): unknown
  dispose(): void
}

export function createHangEvidencePanel(options: HangEvidencePanelOptions = {}): HangEvidencePanel {
  const doc = options.document ?? document
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', value?: string): HTMLElementTagNameMap[K] => {
    const result = doc.createElement(tag)
    if (className) result.className = className
    if (value !== undefined) result.textContent = value
    return result
  }
  const root = node('section', 'picture-evidence')
  const compact = options.compact === true
  root.dataset['compact'] = String(compact)
  root.setAttribute('aria-label', 'Picture register and measured dimensions')
  const heading = node('div', 'picture-evidence-heading')
  const status = node('span', 'picture-evidence-state')
  heading.append(node('h2', '', 'The measured register'), status)
  const context = node('p', 'picture-evidence-context')
  const metrics = node('table', 'picture-evidence-metrics')
  metrics.setAttribute('aria-label', 'Live rendering measurements')
  const metricsBody = node('tbody')
  metrics.append(metricsBody)
  const note = node('p', 'picture-evidence-note', compact
    ? 'Width × height · physical cm / CSS px · X / Y scale'
    : 'Width × height. Physical extents in centimetres; screen extents in CSS pixels. Each plate is measured separately from its field.')
  const table = node('table', 'picture-evidence-works')
  table.setAttribute('aria-label', 'Field and reproduction measurements by work')
  const columns = node('colgroup')
  for (let i = 0; i < 4; i++) columns.append(node('col'))
  const head = node('thead')
  const headRow = node('tr')
  for (const title of ['Extent', 'cm · CSS px', 'Pixels per cm', 'Scale check']) {
    const cell = node('th', '', title)
    cell.scope = 'col'
    headRow.append(cell)
  }
  head.append(headRow)
  table.append(columns, head)
  const errors = node('div', 'picture-evidence-errors')
  const geometryDisclosure = node('details', 'picture-evidence-geometry')
  geometryDisclosure.append(node('summary', '', 'Full field and plate measurements'))
  const geometryDetail = node('div', 'picture-evidence-geometry-detail')
  geometryDisclosure.append(geometryDetail)
  const metricsDisclosure = node('details', 'picture-evidence-rendering')
  metricsDisclosure.append(node('summary', '', 'Rendering measurements'), metrics)
  const pager = node('nav', 'picture-evidence-pager')
  pager.setAttribute('aria-label', 'Measured register pages')
  const previous = node('button', '', '←')
  previous.type = 'button'
  previous.setAttribute('aria-label', 'Previous register page')
  const next = node('button', '', '→')
  next.type = 'button'
  next.setAttribute('aria-label', 'Next register page')
  const pageLine = node('p', 'picture-evidence-page')
  pager.append(previous, pageLine, next)
  const download = options.download ? node('button', '', 'Save JSON') : null
  if (download) {
    download.type = 'button'
    download.setAttribute('aria-label', 'Save all current register measurements as JSON')
    pager.append(download)
  }
  if (compact) root.append(pager, heading, context, note, table, errors, geometryDisclosure, metricsDisclosure)
  else root.append(heading, context, metrics, note, table, errors, pager)
  const pageSize = typeof options.pageSize === 'number' && Number.isFinite(options.pageSize)
    ? Math.max(1, Math.floor(options.pageSize)) : 6
  let page = options.page ?? 1
  let pageCount = 1
  let latest: unknown = null
  let disposed = false
  let pendingRevoke: number | null = null
  let downloadURL: string | null = null
  const win = doc.defaultView

  function metric(a: string, av: string, b: string, bv: string): void {
    const row = node('tr')
    const first = node('th', '', a), second = node('th', '', b)
    first.scope = second.scope = 'row'
    row.append(first, node('td', '', av), second, node('td', '', bv))
    metricsBody.append(row)
  }

  function detail(cell: HTMLElement, value: string): void {
    cell.append(node('span', 'picture-evidence-detail', value))
  }

  function measurementRow(body: HTMLTableSectionElement, title: string, raw: unknown, visibility: string, identity?: string): void {
    const row = node('tr')
    const name = node('th', '', title)
    name.scope = 'row'
    if (identity) name.title = identity
    row.append(name)
    const m = record(raw)
    if (raw === null || raw === undefined || Object.keys(m).length === 0) {
      const missing = node('td', 'picture-evidence-unmeasured', 'No geometry measurement supplied')
      missing.colSpan = 3
      if (identity) detail(missing, identity)
      row.append(missing)
      body.append(row)
      return
    }
    const physicalWidth = typeof m['worldWidthM'] === 'number' ? m['worldWidthM'] * 100 : undefined
    const physicalHeight = typeof m['worldHeightM'] === 'number' ? m['worldHeightM'] * 100 : undefined
    const extent = node('td', '', `${pair(physicalWidth, physicalHeight)} cm`)
    detail(extent, `${pair(m['widthPx'], m['heightPx'])} px`)
    if (!compact) detail(extent, `Record ${pair(m['width_cm'], m['height_cm'])} cm`)
    const scale = node('td', '', `${evidenceNumber(m['pxPerCmX'])} / ${evidenceNumber(m['pxPerCmY'])}`)
    detail(scale, `Expected ${evidenceNumber(m['expectedPxPerCm'])}`)
    if (!compact) detail(scale, `Expected ${pair(m['expectedWidthPx'], m['expectedHeightPx'])} px`)
    const check = node('td', 'picture-evidence-status', verdict(m['passes']))
    detail(check, `${evidenceNumber(m['maxErrorPercent'], 3)}% error`)
    if (!compact) detail(check, visibility)
    row.append(extent, scale, check)
    body.append(row)
    if (compact) {
      geometryDetail.append(node('h3', '', `${title}${identity ? ` · ${identity}` : ''}`))
      geometryDetail.append(node('p', '', visibility))
      geometryDetail.append(node('p', '', `Record ${pair(m['width_cm'], m['height_cm'])} cm · actual ${pair(physicalWidth, physicalHeight)} cm`))
      geometryDetail.append(node('p', '', `Actual ${pair(m['widthPx'], m['heightPx'])} px · expected ${pair(m['expectedWidthPx'], m['expectedHeightPx'])} px`))
      geometryDetail.append(node('p', '', `Pixels per cm: X ${evidenceNumber(m['pxPerCmX'])} · Y ${evidenceNumber(m['pxPerCmY'])} · expected ${evidenceNumber(m['expectedPxPerCm'])}`))
      geometryDetail.append(node('p', '', `Width error ${evidenceNumber(m['widthErrorPercent'], 3)}% · height error ${evidenceNumber(m['heightErrorPercent'], 3)}% · ${verdict(m['passes'])}`))
    }
  }

  function render(): void {
    if (disposed) return
    const audit = record(latest)
    const cost = record(audit['cost']), budget = record(cost['budget'])
    const labels = record(audit['labelAudit']), viewport = record(audit['viewport'])
    const works = rows(audit['works'])
    pageCount = Math.max(1, Math.ceil(works.length / pageSize))
    // The component is created before the first hook result exists. Preserve
    // its requested page across empty/loading snapshots until works arrive.
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1)
    if (works.length) page = Math.min(pageCount, page)
    const start = (page - 1) * pageSize
    const pending = audit['texturesPending']
    status.textContent = audit['auditReady'] === true && pending === 0 ? 'Measured' : 'Settling'
    context.textContent = `${text(audit['segment'], 'No segment')} · ${text(cost['tier'], 'Tier unknown')} · ${text(cost['backend'], 'Backend unknown')} · ${pair(viewport['width'], viewport['height'])} CSS px`
    const plates = works.flatMap(work => rows(work['plates']))
    const previews = plates.filter(plate => record(plate['residency'])['preview'] === true).length
    const full = plates.filter(plate => record(plate['residency'])['full'] === true).length
    metricsBody.replaceChildren()
    metric('Draws', ratio(cost['draws'], budget['draws']), 'Triangles', ratio(cost['triangles'], budget['triangles']))
    metric('Textures MiB', ratio(cost['textureMB'], budget['textureMB']), 'Frame MiB', ratio(cost['frameMB'], budget['frameMB']))
    metric('Frame p50 / p95', `${evidenceNumber(cost['frameMsP50'])} / ${evidenceNumber(cost['frameMsP95'])} ms`, 'Samples', evidenceNumber(cost['frames']))
    metric('Plate MiB', evidenceNumber(cost['plateTextureMB']), 'Previews / full', `${previews}/${plates.length} · ${full}/1`)
    metric('Smallest target', `${evidenceNumber(labels['smallestTargetPx'])} px`, 'Marks / brand', `${evidenceNumber(labels['persistentMarks'])} / ${evidenceNumber(labels['brandLines'])}`)
    metric('Pending', evidenceNumber(pending), 'Diffuse GI', `${verdict(record(audit['diffuseGI'])['ready'])} · ${evidenceNumber(cost['diffuseGIMB'])} MiB`)
    geometryDetail.replaceChildren()
    for (const body of Array.from(table.tBodies)) body.remove()
    for (const [offset, work] of works.slice(start, start + pageSize).entries()) {
      const body = node('tbody')
      const workHeading = node('tr', 'picture-evidence-work')
      const id = text(work['id'], 'Unnamed work')
      const suppliedTitle = work['title'] ?? work['title_en']
      const caption = node('th', '', `${String(start + offset + 1).padStart(2, '0')} · ${text(suppliedTitle, id)}`)
      caption.colSpan = 4
      caption.scope = 'rowgroup'
      if (!compact) caption.append(node('small', '', `${suppliedTitle ? `${id} · ` : ''}${text(work['class'], 'Class unreported')}`))
      else {
        caption.title = `${id} · ${text(work['class'], 'Class unreported')}`
        geometryDetail.append(node('h3', '', `${id} · ${text(work['class'], 'Class unreported')}`))
      }
      workHeading.append(caption)
      body.append(workHeading)
      const field = record(work['measurement'])
      const visibility = work['exhibited'] === false ? 'Hidden field' : field['visible'] === true ? 'In view' : field['visible'] === false ? 'Offscreen' : 'Visibility unmeasured'
      measurementRow(body, 'Field', work['measurement'], visibility)
      const workPlates = rows(work['plates'])
      for (const [plateIndex, plate] of workPlates.entries()) {
        const measured = record(plate['measurement'])
        const visible = plate['exhibited'] === false ? 'Hidden plate' : measured['visible'] === true ? 'In view' : measured['visible'] === false ? 'Offscreen' : 'Visibility unmeasured'
        const residency = record(plate['residency'])
        const resolution = residency['full'] === true ? 'full' : residency['preview'] === true ? 'preview' : 'not resident'
        measurementRow(body, workPlates.length > 1 ? `Plate ${plateIndex + 1}` : 'Plate', plate['measurement'], `${visible} · ${resolution}`, text(plate['id']))
      }
      if (!workPlates.length) {
        const absent = node('tr'), noteCell = node('td', 'picture-evidence-datum', 'No reproduction plate in this record.')
        noteCell.colSpan = 4
        absent.append(noteCell)
        body.append(absent)
      }
      const datum = node('tr'), datumCell = node('td', 'picture-evidence-datum')
      datumCell.colSpan = 4
      datumCell.textContent = field['datumErrorCm'] === null ? 'Datum not assigned in the register.'
        : `Centre ${evidenceNumber(field['centerHeightM'])} m · datum error ${evidenceNumber(field['datumErrorCm'], 3)} cm`
      datum.append(datumCell)
      body.append(datum)
      table.append(body)
    }
    if (!works.length) {
      const body = node('tbody'), row = node('tr'), cell = node('td', 'picture-evidence-unmeasured', 'No work measurements supplied.')
      cell.colSpan = 4
      row.append(cell); body.append(row); table.append(body)
    }
    const failures = Array.isArray(audit['errors']) ? audit['errors'].filter(value => value !== null && value !== undefined && value !== '') : []
    if (audit['error']) failures.push(audit['error'])
    errors.replaceChildren()
    errors.append(node('p', '', failures.length ? `${failures.length} reported error${failures.length === 1 ? '' : 's'}` : 'No errors reported.'))
    for (const failure of failures) errors.append(node('p', '', typeof failure === 'string' ? failure : JSON.stringify(failure)))
    if (audit['auditReady'] !== true || pending !== 0) errors.append(node('p', '', 'Readings remain provisional until the fresh frame window is complete and all images have settled.'))
    pageLine.textContent = !works.length ? `Page ${page} · awaiting records`
      : compact && pageSize === 1 ? `Work ${start + 1} of ${works.length}`
      : `Page ${page} of ${pageCount} · works ${start + 1}–${Math.min(start + pageSize, works.length)} of ${works.length}`
    previous.disabled = !works.length || page <= 1
    next.disabled = !works.length || page >= pageCount
    if (download) download.disabled = latest === null
    root.dataset['page'] = String(page)
    root.dataset['ready'] = String(audit['auditReady'] === true && pending === 0 && failures.length === 0)
  }

  function changePage(delta: number): void {
    page = Math.max(1, Math.min(pageCount, page + delta))
    render()
    options.onPageChange?.(page)
  }
  const previousPage = (): void => changePage(-1)
  const nextPage = (): void => changePage(1)
  function revoke(): void {
    if (pendingRevoke !== null) win?.clearTimeout(pendingRevoke)
    pendingRevoke = null
    if (downloadURL) URL.revokeObjectURL(downloadURL)
    downloadURL = null
  }
  function save(): void {
    if (latest === null || disposed) return
    revoke()
    downloadURL = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2) + '\n'], { type: 'application/json' }))
    const link = node('a')
    const audit = record(latest), cost = record(audit['cost'])
    const safe = (value: unknown): string => text(value, 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '-')
    link.download = `picture-register-${safe(audit['segment'])}-${safe(cost['tier'])}.json`
    link.href = downloadURL
    link.hidden = true
    root.append(link)
    link.click()
    link.remove()
    pendingRevoke = win?.setTimeout(revoke, 1000) ?? null
  }
  previous.addEventListener('click', previousPage)
  next.addEventListener('click', nextPage)
  download?.addEventListener('click', save)
  render()
  return {
    root,
    update(value, requestedPage) {
      if (disposed) return
      latest = value
      if (requestedPage !== undefined) page = requestedPage
      render()
    },
    page: () => page,
    snapshot: () => latest,
    dispose() {
      disposed = true
      revoke()
      previous.removeEventListener('click', previousPage)
      next.removeEventListener('click', nextPage)
      download?.removeEventListener('click', save)
      root.remove()
    },
  }
}
