/* THE FILM'S TWO WAYS THROUGH THE WING: the plan and the life. The live
   wing's two controls, keys and sheets, pressed in the film's own way: a
   station is the bar's press (walked to a neighbour, faded to any other), a
   work is the film's own press on its list, a date of the floor opens the
   life at the floor. The sheets arrive on the first press (film-sheets). */

import { lang, WING_TEXT } from '../content'
import { PLAN_WORDS } from '../plan/words'
import { LIFE_WORDS } from '../life/words'
import { deskControl } from '../desk-story'
import { vinciWelcomeText, type VinciCertainty, type VinciText } from './content'
import type { WingHosts } from '../frame'
import type { DeskPanelRow } from '../desk-panel'
import type { DeskOverviewCell } from '../overview'
import type { FilmRelease } from '../picture/film'
import type { PictureSource } from '../picture/seam'
import type { PlanHighlight } from '../plan/types'
import type { LifeEvent } from '../life/types'
import type { WingPlan } from '../plan'
import type { WingLife } from '../life'
import css from './film-ways.css?inline'

/** the line's floor as one mark: the live registry's own id (LINE_FLOOR_PICK) */
export const FILM_LINE_FLOOR = 'line/floor'

export interface FilmWaysHost {
  hosts: WingHosts
  narrow(): boolean
  /** the walk the film was rendered along */
  stops: readonly { id: string; station: string; name: VinciText }[]
  carried(index: number): boolean
  /** the stop the card names */
  standing(): number
  /** the stops stood at tonight, by id */
  stood(): readonly string[]
  release(): FilmRelease | undefined
  picture(): PictureSource | undefined
  /** the room's list as the film names it */
  cells(ids: readonly string[]): Promise<DeskOverviewCell[]>
  /** the film's press on a work of its list: walked or dipped to, then opened */
  open(id: string): void
  /** an open close look shut without its step back; true where one stood */
  quiet(): boolean
  openRecord(id: string, title: VinciText, certainty: VinciCertainty, render: (host: HTMLElement) => void): void
  floor(): number
  signal: AbortSignal
}

type Sheets = typeof import('./film-sheets')

export function mountFilmWays(host: FilmWaysHost): void {
  const { hosts, signal } = host
  const wing = hosts.stage.parentElement!
  const say = (value: VinciText): string => value[lang()]
  const make = (cls: string, words: string, key: string, controls: string): HTMLButtonElement => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = cls
    button.textContent = words
    button.setAttribute('aria-keyshortcuts', key)
    button.setAttribute('aria-controls', controls)
    return button
  }
  /* THE TWO CONTROLS STAND IN THE BAR'S OWN GROUP, as the live wing's: the
     panel names its rows from them and presses them */
  const planControl = make('wing-plan-open', say(PLAN_WORDS.plan), 'p', 'wing-plan')
  const lifeControl = make('wing-life-open', say(LIFE_WORDS.door), 'e', 'wing-life')
  planControl.addEventListener('click', () => openPlan())
  lifeControl.addEventListener('click', () => openLife())
  wing.querySelector('.wing-rail-group')?.append(planControl, lifeControl)
  const style = document.createElement('style')
  style.textContent = css
  hosts.stage.append(style)

  let sheets: Promise<{ m: Sheets; plan: WingPlan; life: WingLife }> | undefined
  let planAdopt = false, lifeAdopt = false
  /** the works under each station, in the language they were read in */
  let works: { language: string; list: PlanHighlight[] } | null = null
  const returnFocus = (): void => { wing.querySelector<HTMLElement>('.desk-on, .film-gold')?.focus({ preventScroll: true }) }
  const hangs = (exhibit: string): boolean => Boolean(host.release()?.nodes[`view:${exhibit}`])

  function load() {
    sheets ??= import('./film-sheets').then(m => {
      const plan = m.createWingPlan({ host: hosts.labels, lang, narrow: host.narrow, floor: host.floor,
        title: () => say(vinciWelcomeText.title),
        site: () => {
          const release = host.release()!
          return m.filmPlanSite(release, host.stops, host.carried, works?.language === lang() ? works.list : [])
        },
        standing: () => host.stops[host.standing()]?.station ?? '',
        stood: () => host.stood().map(id => host.stops.find(stop => stop.id === id)?.station ?? id),
        // THE QUICK SELECT IS THE PRESS THE BAR ALREADY MAKES
        station: id => { const index = host.stops.findIndex(stop => stop.id === id); if (index >= 0) hosts.navigate(index) },
        highlight: id => openWork(id),
        life: () => ({ word: say(LIFE_WORDS.life), open: () => openLife() }),
        // a phone's glass, upright or sideways, reads the plate's words at 13 px
        reading: () => wing.dataset['film'] === 'upright' || wing.dataset['film'] === 'cinema',
        returnFocus, adopt: () => planAdopt })
      const life = m.createWingLife({ host: hosts.labels, lang, narrow: host.narrow, floor: host.floor,
        record: () => m.vinciLifeRecord(hangs),
        walk: id => openWork(id),
        openRecord: (event, back) => openLifeRecord(m, event, back),
        returnFocus, adopt: () => lifeAdopt })
      signal.addEventListener('abort', () => { plan.dispose(); life.dispose() })
      return { m, plan, life }
    })
    return sheets
  }
  /** the works are read once per language, and the plan composed again when they land */
  async function readWorks(m: Sheets, plan: WingPlan): Promise<void> {
    const release = host.release(), language = lang()
    if (!release || works?.language === language) return
    const list = await m.filmPlanHighlights(release, host.stops, host.carried, host.cells, { floor: FILM_LINE_FLOOR, table: m.filmTableSet() }, language)
    if (language !== lang() || signal.aborted) return
    works = { language, list }
    plan.repaint()
  }

  /** ONE SHEET AT A TIME: a close look stands down for the plan, which takes
      the history entry it pushed, so Back is one press either way */
  function openPlan(): void {
    void load().then(async ({ m, plan }) => {
      if (signal.aborted) return
      if (plan.standing) { plan.close(); return }
      if (works?.language !== lang()) await readWorks(m, plan).catch(() => undefined)
      if (signal.aborted || plan.standing) return
      planAdopt = host.quiet()
      plan.show()
      planAdopt = false
    })
  }
  /** the same for the life: opened from a date, it stands at that date */
  function openLife(at?: string): void {
    void load().then(({ life }) => {
      if (signal.aborted) return
      if (life.standing) { life.close(); return }
      lifeAdopt = host.quiet()
      life.show(at)
      lifeAdopt = false
    })
  }
  /** THE RECORD BEHIND ONE DATE, in the window the close look opens, over the
      life; the hand goes back to the door it was opened from */
  function openLifeRecord(m: Sheets, event: LifeEvent, back: () => void): void {
    const stud = m.vinciLifeStud(event.id)
    if (!stud) return
    host.openRecord(`stud/${stud.id}`, { en: stud.date_label_en, de: stud.date_label_de },
      stud.certainty === 'documented' ? 'documented' : 'conjectural', panel => m.renderVinciLifeRecord(stud, panel))
    document.getElementById('vinci-source-card')?.addEventListener('close', () => back(), { once: true, signal })
  }

  /** A WORK ASKED FOR FROM A SHEET: the film's own press on its list; a date
      of the floor, or the floor itself, is the life opened at the line,
      walked or faded to first as the bar reaches a stop */
  function openWork(id: string): void {
    if (id !== FILM_LINE_FLOOR && !id.startsWith('stud/')) { host.open(id); return }
    const at = id === FILM_LINE_FLOOR ? undefined : id.slice('stud/'.length)
    const station = works?.list.find(work => work.id === id)?.station
    const index = station ? host.stops.findIndex(stop => stop.id === station) : -1
    if (index < 0 || index === host.standing()) { openLife(at); return }
    void reach(index).then(there => { if (there) openLife(at) })
  }
  /** THE BAR'S PRESS TO ONE STOP, answered when the picture rests there. A
      rest on the way (a walk already under way ends first, then the press
      queued behind it goes) is passed; a rest that stays elsewhere is a
      visitor gone another way, and nothing opens. */
  function reach(index: number): Promise<boolean> {
    const picture = host.picture()
    if (!picture || !host.carried(index)) return Promise.resolve(false)
    const target = `stop:${host.stops[index]!.id}`
    return new Promise(resolve => {
      let done = false
      const end = (there: boolean): void => { if (done) return; done = true; off(); resolve(there && !signal.aborted) }
      const off = picture.on('rest', state => {
        if (state.kind !== 'rest') return
        if (state.node === target) { end(true); return }
        setTimeout(() => { const now = picture.state(); if (now.kind === 'rest' && now.node !== target) end(false) }, 300)
      })
      signal.addEventListener('abort', () => end(false), { once: true })
      hosts.navigate(index)
    })
  }

  /* THE FLOOR IS THE DOOR INTO THE LIFE: a press on the line's mark opens the
     life whole, and a date's own mark opens it at that date, where the visitor
     stands, as the live wing's floor does */
  addEventListener('click', event => {
    const mark = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-exhibit]') : null
    const id = mark?.dataset['exhibit'] ?? ''
    if (!mark || !hosts.labels.contains(mark) || (id !== FILM_LINE_FLOOR && !id.startsWith('stud/'))) return
    event.preventDefault()
    event.stopPropagation()
    openLife(id === FILM_LINE_FLOOR ? undefined : id.slice('stud/'.length))
  }, { capture: true, signal })

  addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat) return
    const key = event.key.toLowerCase()
    if (key !== 'p' && key !== 'e') return
    if (document.querySelector('dialog[open]')) return
    const target = event.target instanceof Element ? event.target : document.body
    // what is typed inside a field or an open close look stays there
    if (target.closest('input,textarea,select,[contenteditable="true"],.vitrine')) return
    event.preventDefault()
    if (key === 'p') openPlan()
    else openLife()
  }, { signal })
  // the museum's panel opens the plan of the wing standing
  addEventListener('na-wing-plan', () => openPlan(), { signal })
  addEventListener('na-language', () => {
    planControl.textContent = say(PLAN_WORDS.plan)
    lifeControl.textContent = say(LIFE_WORDS.door)
    publish()
  }, { signal })

  /* ON THE PHONE THE BOOK OPENS THE MUSEUM'S PANEL, and the wing's own rows
     stand at its head as the live phone form publishes them: Lobby, Plan,
     Life, and the chapters with the walk's count */
  const upright = wing.dataset['film'] === 'upright'
  let said = ''
  function publish(): void {
    if (!upright || signal.aborted) return
    const rows: DeskPanelRow[] = [
      { id: 'lobby', label: wing.querySelector('.wing-lobby')?.textContent?.trim() || say(WING_TEXT.lobby), mark: 'back' },
      { id: 'plan', label: planControl.textContent ?? '' },
      { id: 'life', label: lifeControl.textContent ?? '' },
      // the count as the phone's own key row writes it
      { id: 'chapters', label: say(deskControl('ways', 'chapters')), count: `${String(host.standing() + 1).padStart(2, '0')} / ${host.stops.length}` },
    ]
    const line = JSON.stringify(rows)
    if (line === said) return
    said = line
    dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows } }))
  }
  if (upright) {
    publish()
    const off = host.picture()?.on('rest', () => publish())
    addEventListener('na-wing-instrument', event => {
      const row = (event as CustomEvent<{ row?: string }>).detail?.row
      if (row === 'plan' || row === 'chapters') openPlan()
      else if (row === 'life') openLife()
    }, { signal })
    signal.addEventListener('abort', () => { off?.(); dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: [] } })) })
  }
  /* the band puts the borrowed sources button back before its old neighbour,
     the plan control, when it is struck after this signal: the controls leave
     once the stop has run */
  signal.addEventListener('abort', () => queueMicrotask(() => { planControl.remove(); lifeControl.remove(); style.remove() }))
}
