import { WING_TEXT, type Lang } from '../../../content'
import { wingBySlug } from '../../../registry'
import { vinciContent, vinciHourArithmetic, vinciHourIntegrity, vinciHourLabel } from '../../content'
import orientationCss from './orientation.css?raw'

/** The caller supplies the currently displayed plate's actual manifest copy. */
export interface OrientationSource {
  title: string
  licence: string
  holder?: string
  source_url?: string
  honesty_en?: string
  honesty_de?: string
}

export interface TableOrientationOptions {
  language?: Lang
  sources: () => readonly OrientationSource[]
}

const COPY = {
  en: {
    hour: 'Wing hour · 10 October 1517 · Julian calendar',
    lamp: 'This reading table is a modern museum display, lit by a reading lamp.',
    sources: 'Sources · L', close: 'Close sources',
    sourceTitle: 'The page and its sources', plate: 'The displayed reproduction',
    sourceLink: 'Source record', hourTitle: 'The wing’s computed hour',
    doorScope: 'The library opens Leonardo’s general question. The question above remains here to copy.',
  },
  de: {
    hour: 'Stunde des Flügels · 10. Oktober 1517 · Julianischer Kalender',
    lamp: 'Dieser Lesetisch ist eine moderne Museumsausstellung im Licht einer Leselampe.',
    sources: 'Quellen · L', close: 'Quellen schließen',
    sourceTitle: 'Das Blatt und seine Quellen', plate: 'Die ausgestellte Reproduktion',
    sourceLink: 'Quellennachweis', hourTitle: 'Die berechnete Stunde des Flügels',
    doorScope: 'Die Bibliothek öffnet Leonardos allgemeine Frage. Die Frage oben bleibt hier zum Kopieren.',
  },
} as const

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

/** Mount the three elements in the bench header, control group and footer.
 * The nav deliberately has no persistent marker: it joins the bench's existing
 * control group. Only the door adds one mark. No route or shared shell is edited.
 * Call refresh after a page changes if the sources are already open.
 */
export function createTableOrientation(options: TableOrientationOptions) {
  let language: Lang = options.language ?? 'en'
  let disposed = false
  const controller = new AbortController()
  const station = vinciContent.find(item => item.id === 'reading-table')!
  const wing = wingBySlug('vinci')!
  const style = node('style', 'table-orientation-style', orientationCss)
  const headerHour = node('div', 'table-orientation-hour')
  const navSource = node('div', 'table-orientation-navigation')
  const stations = node('nav', 'table-orientation-stations')
  const sourceButton = node('button', 'table-orientation-source')
  sourceButton.type = 'button'
  sourceButton.setAttribute('aria-haspopup', 'dialog')
  sourceButton.setAttribute('aria-controls', 'table-orientation-sources')
  const drawer = node('dialog', 'table-orientation-drawer')
  drawer.id = 'table-orientation-sources'
  drawer.setAttribute('aria-labelledby', 'table-orientation-source-title')
  const doorFooter = node('footer', 'table-orientation-footer')
  const question = node('p', 'table-orientation-question')
  const door = node('a', 'table-orientation-door')
  door.dataset['naPersistent'] = ''
  door.target = '_blank'
  door.rel = 'noopener noreferrer'
  const doorNote = node('p', 'table-orientation-door-note')
  const doorScope = node('p', 'table-orientation-door-scope')
  doorFooter.append(question, door, doorNote, doorScope)
  navSource.append(style, stations, sourceButton, drawer)

  function centerStation() {
    if (disposed || !stations.isConnected) return
    const selected = stations.querySelector<HTMLElement>('[aria-current="page"]')
    if (selected) stations.scrollLeft = selected.offsetLeft - stations.clientWidth / 2 + selected.clientWidth / 2
  }

  function refreshSources() {
    const copy = COPY[language]
    const heading = node('header', 'table-orientation-drawer-heading')
    const title = node('h2', 'table-orientation-source-title', copy.sourceTitle)
    title.id = 'table-orientation-source-title'
    const close = node('button', 'table-orientation-close', copy.close)
    close.type = 'button'
    close.addEventListener('click', () => drawer.close())
    heading.append(title, close)
    const body = node('div', 'table-orientation-drawer-body')
    for (const source of options.sources()) {
      const section = node('section', 'table-orientation-plate-source')
      section.append(node('p', 'table-orientation-eyebrow', copy.plate), node('h3', '', source.title))
      const honesty = language === 'de' ? source.honesty_de : source.honesty_en
      if (honesty) section.append(node('p', 'table-orientation-source-copy', honesty))
      if (source.holder) section.append(node('p', 'table-orientation-holder', source.holder))
      section.append(node('p', 'table-orientation-licence', source.licence))
      if (source.source_url) {
        const link = node('a', 'table-orientation-source-link', copy.sourceLink)
        link.href = source.source_url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        section.append(link)
      }
      body.append(section)
    }
    const doorContext = node('section', 'table-orientation-plate-source table-orientation-door-source')
    doorContext.append(
      node('h3', '', WING_TEXT.door[language]),
      node('p', 'table-orientation-source-copy', station.door[language]),
      node('p', 'table-orientation-source-copy', copy.doorScope),
    )
    body.append(doorContext)
    const hour = node('section', 'table-orientation-hour-source')
    hour.append(
      node('h3', '', copy.hourTitle),
      node('p', 'table-orientation-lamp-note', copy.lamp),
      node('p', 'table-orientation-arithmetic', vinciHourArithmetic[language]),
      node('p', 'table-orientation-integrity', vinciHourIntegrity[language]),
      node('p', 'table-orientation-source-copy', vinciHourLabel[language]),
    )
    body.append(hour)
    drawer.replaceChildren(heading, body)
    drawer.lang = language
  }

  function toggleSources() {
    if (drawer.open) drawer.close()
    else {
      refreshSources()
      drawer.showModal()
      sourceButton.setAttribute('aria-expanded', 'true')
    }
  }

  function paint() {
    const copy = COPY[language]
    headerHour.lang = navSource.lang = doorFooter.lang = language
    headerHour.replaceChildren(
      node('p', 'table-orientation-position', `${String(station.number).padStart(2, '0')} / ${vinciContent.length} · ${station.name[language]}`),
      node('p', 'table-orientation-hour-caption', copy.hour),
      node('p', 'table-orientation-arithmetic', vinciHourArithmetic[language]),
      node('p', 'table-orientation-lamp-note', copy.lamp),
    )
    stations.setAttribute('aria-label', WING_TEXT.rail[language])
    stations.replaceChildren(...vinciContent.map(item => {
      const link = node('a', 'table-orientation-station')
      const query = new URLSearchParams({ lang: language })
      link.href = `/w/${wing.slug}?${query.toString()}#s=${item.id}`
      link.setAttribute('aria-label', `${WING_TEXT.station[language]} ${item.number} · ${item.name[language]}`)
      if (item.id === station.id) link.setAttribute('aria-current', 'page')
      link.append(node('span', 'table-orientation-station-number', String(item.number).padStart(2, '0')), node('span', 'table-orientation-station-name', item.name[language]))
      return link
    }))
    sourceButton.textContent = copy.sources
    sourceButton.setAttribute('aria-expanded', String(drawer.open))
    question.textContent = station.door[language]
    door.textContent = WING_TEXT.door[language]
    const query = new URLSearchParams({ figure: wing.publicSlug ?? wing.slug })
    if (wing.askTag) query.set('ask', wing.askTag)
    query.set('lang', language)
    door.href = `https://agoracosmica.org/?${query.toString()}`
    doorNote.textContent = WING_TEXT.doorNote[language]
    doorScope.textContent = copy.doorScope
    if (drawer.open) refreshSources()
    requestAnimationFrame(centerStation)
  }

  sourceButton.addEventListener('click', toggleSources)
  stations.addEventListener('keydown', event => {
    if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('.table-orientation-station') : null
    if (!target || !stations.contains(target)) return
    const links = Array.from(stations.querySelectorAll<HTMLAnchorElement>('.table-orientation-station'))
    const current = links.indexOf(target)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : Math.max(0, Math.min(links.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
    const focused = links[next]
    if (!focused) return
    event.preventDefault()
    event.stopPropagation()
    focused.focus({ preventScroll: true })
    const railBounds = stations.getBoundingClientRect()
    const linkBounds = focused.getBoundingClientRect()
    const left = railBounds.left + stations.clientLeft
    const right = left + stations.clientWidth
    if (linkBounds.left < left) stations.scrollLeft += linkBounds.left - left
    else if (linkBounds.right > right) stations.scrollLeft += linkBounds.right - right
  }, { signal: controller.signal })
  drawer.addEventListener('close', () => {
    sourceButton.setAttribute('aria-expanded', 'false')
    if (!disposed && sourceButton.isConnected) sourceButton.focus({ preventScroll: true })
  })
  document.addEventListener('keydown', event => {
    if (disposed || !navSource.isConnected || event.defaultPrevented) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('input, select, textarea, [contenteditable="true"]')) return
    if (event.key === 'Escape' && drawer.open) {
      event.preventDefault()
      event.stopPropagation()
      drawer.close()
    } else if (event.key.toLowerCase() === 'l' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      event.stopPropagation()
      toggleSources()
    } else if (drawer.open && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      // Keep the bench's page-turn shortcut behind its modal source drawer.
      event.stopPropagation()
    }
  }, { capture: true, signal: controller.signal })
  paint()

  return {
    headerHour, navSource, doorFooter,
    closeSources() { if (drawer.open) drawer.close() },
    language(next: Lang) { if (next !== language) { language = next; paint() } },
    refresh() { if (drawer.open) refreshSources() },
    dispose() {
      disposed = true
      controller.abort()
      if (drawer.open) drawer.close()
      headerHour.remove()
      navSource.remove()
      doorFooter.remove()
    },
  }
}
