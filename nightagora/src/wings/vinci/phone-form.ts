/* THE PHONE'S FROZEN FORM IN THE LIVE WING. One graded box at the foot of
   the glass, control for control the film player's phone (film-wing.ts,
   buildPhone and its paints): the name row, the one line, the key row, and
   the foot row of three seats (back, the book, gold). The drawer is its
   first pull, the record ("Where it comes from") and the museum's panel
   (the book) its tall heights. It shares the film's stylesheet by class, so
   the two phones cannot drift apart in look; the film's own copy of this
   logic stays in film-wing.ts until the two are folded into one. */

import { setRegister } from '../frame'
import { lang, say, WING_TEXT } from '../content'
import { LOBBY_TEXT } from '../../content/lobby'
import { deskMark } from '../desk-chrome'
import { deskControl, deskStoryStop, storySentences } from '../desk-story'
import type { DeskPanelRow } from '../desk-panel'
import { endWith } from './ending-talk'
import { fitGoldName, watchGoldName } from './gold-fit'
import type { VinciText } from './content'

const SVG = 'http://www.w3.org/2000/svg'
const ARROW_ON = 'M3 8h10M9 4l4 4-4 4', ARROW_UP = 'M8 13V3M4 7l4-4 4 4', ARROW_DOWN = 'M8 3v10M4 9l4 4 4-4'
const BOOK = 'M8 3.2a4.8 4.8 0 1 0 0 9.6a4.8 4.8 0 1 0 0-9.6M8 6.2v3.6M6.2 8h3.6'
const TRIANGLE_BACK = 'M11 3.5L4.5 8 11 12.5z'
const STEP_BACK = 'M10 3L5 8l5 5', STEP_ON = 'M6 3l5 5-5 5'
const RING = 2 * Math.PI * 20.5

const text = (value: VinciText): string => say(value)
function make<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (value !== undefined) node.textContent = value
  return node
}
function icon(path: string, cls = 'film-ic'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS(SVG, 'path')
  line.setAttribute('d', path)
  svg.append(line)
  return svg
}
const wordOf = (node: Element | null): string => node?.textContent?.trim() ?? ''
/** A pill's label whose last two words never part, so a wrapped label leaves
    no word alone on its last row; a label under `least` words wraps freely. */
function keepLast(node: HTMLElement, said: string, least = 3): void {
  const words = said.split(' ')
  if (words.length < least) { node.textContent = said; return }
  const tail = words.splice(-2).join(' ')
  node.replaceChildren(words.length ? `${words.join(' ')} ` : '', make('span', 'film-keep', tail))
}
/** the story's clock at his birth repeats what its heading already says */
const atBirth = (age: VinciText): boolean => text(age) === text(deskControl('date', 'age_birth'))

/** A wall the eye stands on: where along it, and the way to its neighbours. */
export interface VinciPhoneWall {
  /** the work the eye stands at, counted from one; 0 at the wall's end */
  at: number
  of: number
  /** the works either side, by name, or null at an end */
  previous: string | null
  next: string | null
  step(direction: 1 | -1): void
}

/** A close look standing, and the ways along the set it belongs to. */
export interface VinciPhoneLook {
  /** the work before and the work after, by name, or null at an end */
  previous: string | null
  next: { title: string; word: VinciText } | null
  step(direction: 1 | -1): void
}

export interface VinciPhoneHost {
  /** the layer the box stands in: over the close look, so its foot row stays */
  layer: HTMLElement
  wing: HTMLElement
  signal: AbortSignal
  count: number
  /** the stop the words stand for */
  at(): number
  id(index: number): string
  /** the stop's own name where the story has none */
  name(index: number): VinciText
  /** a leg or a dip under way, and how much of the leg is walked */
  leg(): { walking: boolean; share: number }
  go(index: number): void
  /** one level up, or the stop before this one */
  back(): void
  hurry(): void
  /** "Where it comes from": the stop's record at the sheet's tall height */
  record(): void
  /** the wall the eye stands on, where the hang is walked work to work */
  wall(): VinciPhoneWall | null
  /** the close look standing, whose foot row this box keeps */
  look(): VinciPhoneLook | null
  words: { next: VinciText; previous: VinciText }
}

export interface VinciPhoneForm {
  readonly element: HTMLElement
  paint(): void
  /** the leg's edge and its ring: cheap, called every frame */
  update(): void
  setDrawer(open: boolean): void
  drawerOpen(): boolean
  /** the box's top edge, which no mark and no panel stands under */
  top(): number
  /** the foot row's top edge, which a close look stands above */
  footTop(): number
  /** the box and the hang's steps over it, which no mark stands in */
  panels(): { left: number; top: number; right: number; bottom: number }[]
  show(shown: boolean): void
  dispose(): void
}

export function createVinciPhoneForm(host: VinciPhoneHost): VinciPhoneForm {
  const { signal } = host
  const root = make('div', 'film-box vinci-phone')
  const name = make('div', 'film-name')
  const line = make('p', 'film-line')
  const drawer = make('div', 'film-drawer')
  drawer.id = 'vinci-phone-drawer'
  setRegister(drawer, 'drawer')
  drawer.hidden = true
  const keys = make('div', 'film-keys')
  const more = make('button', 'film-key film-more')
  more.type = 'button'
  more.setAttribute('aria-controls', drawer.id)
  const from = make('button', 'film-key film-from')
  from.type = 'button'
  const count = make('span', 'film-count')
  keys.append(more, from, count)
  /* THE HANG'S OWN STEPS, where the eye stands on a wall: the work before and
     the work after, two 44 px glyphs standing on the picture's foot just over
     the box, each spoken as the work it walks to. The name under the painting
     already says which work stands here. */
  const wall = make('div', 'vinci-phone-wall')
  const wallBack = make('button', 'vinci-phone-step vinci-phone-step-back')
  wallBack.type = 'button'
  wallBack.append(icon(STEP_BACK))
  const wallOn = make('button', 'vinci-phone-step vinci-phone-step-on')
  wallOn.type = 'button'
  wallOn.append(icon(STEP_ON))
  wall.append(wallBack, wallOn)
  wall.hidden = true
  const foot = make('div', 'film-foot')
  const back = make('button', 'film-back')
  back.type = 'button'
  back.append(icon(TRIANGLE_BACK, 'film-ic film-ic-fill'))
  const book = make('button', 'film-book')
  book.type = 'button'
  book.append(icon(BOOK))
  // IN A CLOSE LOOK the book's seat is the work before, as the desk's band
  // stands its way back beside gold; gold is the work after
  const earlier = make('button', 'film-book vinci-phone-earlier')
  earlier.type = 'button'
  earlier.append(icon(STEP_BACK))
  // the walk's other ending, standing in the book's seat at the last stop only
  const talk = make('button', 'film-talk')
  talk.type = 'button'
  const gold = make('button', 'film-gold')
  gold.type = 'button'
  const goldName = make('span', 'film-gold-name')
  const arrow = make('span', 'film-gold-arrow')
  const ring = document.createElementNS(SVG, 'svg')
  ring.setAttribute('viewBox', '0 0 44 44')
  ring.setAttribute('class', 'film-gold-ring')
  ring.setAttribute('aria-hidden', 'true')
  const ringLine = document.createElementNS(SVG, 'circle')
  ringLine.setAttribute('cx', '22'); ringLine.setAttribute('cy', '22'); ringLine.setAttribute('r', '20.5')
  ring.append(ringLine)
  const goldIcon = icon(ARROW_ON)
  const goldPath = goldIcon.querySelector('path')!
  arrow.append(ring, goldIcon)
  gold.append(goldName, arrow)
  foot.append(back, book, earlier, talk, gold)
  wall.setAttribute('role', 'group')
  root.append(wall, name, line, drawer, keys, foot)
  host.layer.append(root)
  // whether the age had to drop under a long heading, read wherever the row's size changes;
  // written a frame later, since the answer resizes the row it observes
  const nameRows = new ResizeObserver(() => requestAnimationFrame(() => {
    const chapter = name.querySelector<HTMLElement>('.film-chapter'), clock = name.querySelector<HTMLElement>('.film-clock')
    root.dataset['nameRows'] = chapter && clock && clock.offsetTop > chapter.offsetTop + 4 ? '2' : '1'
  }))
  nameRows.observe(name)
  signal.addEventListener('abort', () => nameRows.disconnect())
  watchGoldName(goldName, signal)

  let open = false
  let walkingPainted: boolean | null = null
  const lobby = (): HTMLElement | null => host.wing.querySelector<HTMLElement>('.wing-lobby')
  const next = (): number | null => host.at() + 1 < host.count ? host.at() + 1 : null

  function setDrawer(want: boolean): void {
    const stop = deskStoryStop(host.id(host.at()))
    open = want && Boolean(stop?.drawer)
    root.dataset['drawer'] = String(open)
    drawer.hidden = !open
    line.hidden = open
    more.setAttribute('aria-expanded', String(open))
    paint()
  }

  function paintWall(): void {
    const at = host.wall()
    const shown = Boolean(at && at.of > 1)
    wall.hidden = !shown
    root.dataset['wall'] = String(shown)
    if (!at || !shown) return
    const place = at.at >= 1 ? ` (${text(deskControl('picture', 'place')).replace('{n}', String(at.at)).replace('{total}', String(at.of))})` : ''
    wall.setAttribute('aria-label', `${text(deskControl('picture', 'whole_wall'))}${place}`)
    wallBack.disabled = at.previous === null
    wallOn.disabled = at.next === null
    wallBack.setAttribute('aria-label', at.previous ?? text(host.words.previous))
    wallOn.setAttribute('aria-label', at.next ? `${text(deskControl('walk', 'next_work'))} · ${at.next}` : text(deskControl('walk', 'next_work')))
  }

  function paintGold(): void {
    const { walking } = host.leg()
    walkingPainted = walking
    const to = next()
    const look = host.look()
    root.dataset['walking'] = String(walking)
    gold.dataset['leg'] = String(walking)
    if (look?.next && !walking) {
      keepLast(goldName, look.next.title)
      gold.setAttribute('aria-label', `${text(look.next.word)} · ${look.next.title}`)
    } else if (walking) {
      goldName.textContent = text(deskControl('walk', 'walk_faster'))
      gold.setAttribute('aria-label', `${text(deskControl('walk', 'walking'))} · ${text(deskControl('walk', 'walk_faster'))}`)
    } else if (to !== null) {
      const title = text(deskStoryStop(host.id(to))?.chapter ?? host.name(to))
      keepLast(goldName, title)
      gold.setAttribute('aria-label', `${text(host.words.next)} · ${title}`)
    } else {
      /* THE WALK ENDS IN TWO WAYS, side by side as the desktop's panel stands
         them: gold looks up, and the talk choice beside it opens the door */
      const end = text(deskControl('walk', 'the_end')), look = text(deskControl('ending', 'lookup'))
      keepLast(goldName, look, 2)
      gold.setAttribute('aria-label', `${end} · ${look}`)
      const said = make('span', 'film-talk-name')
      keepLast(said, text(deskControl('ending', 'talk')))
      talk.replaceChildren(said)
    }
    const end = !walking && to === null && !look?.next
    gold.dataset['end'] = String(end)
    root.dataset['end'] = String(end)
    goldPath.setAttribute('d', end ? ARROW_UP : ARROW_ON)
    fitGoldName(goldName)
  }

  /* A PAINT IS ASKED FOR ON EVERY FRAME A CLOSE LOOK STANDS, so the box is
     written again only when what it shows has changed */
  let painted = ''
  function paint(): void {
    const look = host.look(), at = host.wall()
    const said = [host.at(), lang(), open, Boolean(look), look?.previous, look?.next?.title, at?.at, at?.of, at?.previous, at?.next,
      host.leg().walking, document.getElementById('rail-instruments')?.getAttribute('aria-label'), host.wing.querySelector('.wing-door')?.textContent, host.wing.querySelector('.wing-question')?.textContent].join('|')
    if (said === painted) { publish(); return }
    painted = said
    root.dataset['look'] = String(Boolean(look))
    if (look && open) { open = false; root.dataset['drawer'] = 'false'; drawer.hidden = true; line.hidden = false }
    earlier.disabled = !look?.previous
    earlier.setAttribute('aria-label', look?.previous ?? text(host.words.previous))
    const index = host.at()
    const stop = deskStoryStop(host.id(index))
    name.textContent = ''
    name.append(deskMark(stop?.certainty ?? 'reconstructed'), make('span', 'film-chapter', text(stop?.chapter ?? host.name(index))))
    if (stop?.age && !atBirth(stop.age)) name.append(make('span', 'film-clock', text(stop.age)))
    line.textContent = stop ? text(stop.line) : ''
    drawer.textContent = ''
    if (open && stop?.drawer) {
      for (const sentence of storySentences(text(stop.drawer), lang())) drawer.append(make('p', '', sentence))
      // THE DOOR STANDS AT THE DRAWER'S FOOT: the frame's own door, pressed
      // from here, so its disclosure still comes before the first press
      const door = host.wing.querySelector<HTMLElement>('.wing-door')
      if (door) {
        // the question the door carries stands over it, the one italic on the sheet
        const asked = host.wing.querySelector('.wing-question')?.textContent?.trim()
        if (asked) drawer.append(make('p', 'vinci-phone-question', asked))
        const ask = make('button', 'film-ask', door.textContent ?? '')
        ask.type = 'button'
        ask.append(icon('M5 11l6-6M6 5h5v5', 'film-ic film-ic-out'))
        ask.addEventListener('click', () => door.click())
        drawer.append(ask)
      }
    }
    more.textContent = ''
    more.append(document.createTextNode(text(open ? LOBBY_TEXT.close : deskControl('shared', 'read_more'))), icon(open ? ARROW_DOWN : ARROW_UP))
    more.hidden = !stop?.drawer
    from.textContent = text(deskControl('machine', 'provenance'))
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${host.count}`
    // in a close look the way back is always the way out of it
    back.disabled = index === 0 && !host.wall()?.at && !look
    back.setAttribute('aria-label', text(host.words.previous))
    book.setAttribute('aria-label', document.getElementById('rail-instruments')?.getAttribute('aria-label') || text(deskControl('ways', 'chapters')))
    paintWall()
    paintGold()
    publish()
  }

  /* THE BOOK OPENS THE MUSEUM'S PANEL, and the wing's own rows stand at its
     head, Lobby first, as the desktop's panel publishes them. Every word is
     the wing's own control's or the card data's. */
  function rows(): DeskPanelRow[] {
    const list: DeskPanelRow[] = [{ id: 'lobby', label: wordOf(lobby()) || text(WING_TEXT.lobby), mark: 'back' }]
    const plan = wordOf(host.wing.querySelector('.wing-plan-open'))
    if (plan) list.push({ id: 'plan', label: plan })
    const life = wordOf(host.wing.querySelector('.wing-life-open'))
    if (life) list.push({ id: 'life', label: life })
    if (plan) list.push({ id: 'chapters', label: text(deskControl('ways', 'chapters')), count: `${host.at() + 1} / ${host.count}` })
    return list
  }
  let said = ''
  function publish(): void {
    const list = rows()
    const json = JSON.stringify(list)
    if (json === said) return
    said = json
    dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: list } }))
  }
  addEventListener('na-wing-instrument', event => {
    const id = (event as CustomEvent<{ row?: string }>).detail?.row
    if (id === 'lobby') lobby()?.click()
    else if (id === 'plan' || id === 'chapters') host.wing.querySelector<HTMLElement>('.wing-plan-open')?.click()
    else if (id === 'life') host.wing.querySelector<HTMLElement>('.wing-life-open')?.click()
  }, { signal })

  function pressOn(): void {
    if (host.leg().walking) { host.hurry(); return }
    const look = host.look()
    if (look?.next) { look.step(1); return }
    const to = next()
    if (to !== null) { host.go(to); return }
    if (!endWith('lookup')) lobby()?.click()
  }

  more.addEventListener('click', () => setDrawer(!open), { signal })
  from.addEventListener('click', () => host.record(), { signal })
  back.addEventListener('click', () => host.back(), { signal })
  book.addEventListener('click', () => document.getElementById('rail-instruments')?.click(), { signal })
  talk.addEventListener('click', () => { endWith('talk') }, { signal })
  gold.addEventListener('click', () => pressOn(), { signal })
  earlier.addEventListener('click', () => host.look()?.step(-1), { signal })
  wallBack.addEventListener('click', () => host.wall()?.step(-1), { signal })
  wallOn.addEventListener('click', () => host.wall()?.step(1), { signal })
  // a swipe up raises the words, a swipe down folds them; sideways on a wall
  // it steps the hang, as the two glyphs beside the place do
  let fromX = 0, fromY = 0, held = false
  root.addEventListener('pointerdown', e => { held = true; fromX = e.clientX; fromY = e.clientY }, { signal })
  root.addEventListener('pointerup', e => {
    if (!held) return
    held = false
    const dx = e.clientX - fromX, dy = e.clientY - fromY
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const along = host.look() ?? host.wall()
      along?.step(dx < 0 ? 1 : -1)
      if (along) return
    }
    if (dy < -24 && !open) setDrawer(true)
    else if (dy > 24 && open) setDrawer(false)
  }, { signal })
  root.addEventListener('pointercancel', () => { held = false }, { signal })

  return {
    element: root,
    paint,
    update() {
      const { walking, share } = host.leg()
      if (walking !== walkingPainted) {
        if (walking && open) setDrawer(false)
        else paintGold()
      }
      ringLine.setAttribute('stroke-dasharray', `${(RING * (walking ? share : 0)).toFixed(1)} ${RING.toFixed(1)}`)
    },
    setDrawer,
    drawerOpen: () => open,
    top: () => root.hidden ? innerHeight : root.getBoundingClientRect().top,
    footTop: () => root.hidden ? innerHeight : innerHeight - foot.getBoundingClientRect().height,
    panels: () => {
      if (root.hidden) return []
      const boxes = [root.getBoundingClientRect()]
      if (!wall.hidden) for (const step of [wallBack, wallOn]) boxes.push(step.getBoundingClientRect())
      return boxes.filter(b => b.width > 0 && b.height > 0).map(b => ({ left: b.left, top: b.top, right: b.right, bottom: b.bottom }))
    },
    show(shown) { root.hidden = !shown },
    dispose() { nameRows.disconnect(); root.remove(); dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: [] } })) },
  }
}
