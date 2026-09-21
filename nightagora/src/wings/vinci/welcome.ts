/* THE ENTRANCE PANEL. The wing's title wall at its door, over the arrival
   frame, shown ONCE PER VISIT and never again: the name, the one sentence,
   one way in, and the leaflet's five words under them.

   Three rules live here.

   · ONCE PER VISIT, AND NOTHING KEPT. The flag is a session flag. A visitor
     who comes back tomorrow is welcomed again, and nothing about them
     survives the tab. A browser that refuses session storage counts as seen,
     so a blocked store can never hold the door shut on a reload.
   · THE RIG NEVER MEETS IT. Every frame the eyes shoot arrives through the
     forge marker, and a sheet over the arrival frame would be in every one
     of them. The panel opens by hand or by its own named view, never by
     itself while the rig drives.
   · THE WORDS ARE NOT HERE. They are in the wing's own content, with their
     certainty word, so this file holds a sheet and no claims. */

import { lang } from '../content'
import { LIFE_WORDS } from '../life/words'
import { createTitlePlate, plateGroups, type PlateGroup, type PlateLeaf } from '../title-plate'
import { loadManifest, type ManifestEntry } from '../../manifest'
import {
  vinciCertaintyWords, vinciSourceGroups, vinciSourceScopes, vinciThroughLine,
  vinciWelcomeBlocks, vinciWelcomeText, type VinciText,
} from './content'

const FLAG = 'vinci-welcome'

/** Read as seen when the store refuses, so the door never sticks. */
export function vinciWelcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(FLAG, '1')
  } catch {
    // A session store that refuses is not a reason to stop at the door.
  }
}

export interface VinciWelcome {
  element: HTMLDialogElement
  open(): void
  dispose(): void
}

export function createVinciWelcome(
  host: HTMLElement,
  onEnter: (route: 'house' | 'collection' | 'life') => void
): VinciWelcome {
  const text = (value: VinciText): string => value[lang()]
  const document_ = host.ownerDocument
  const phone = (): boolean => innerWidth / innerHeight <= 0.9
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const node = document_.createElement(tag)
    if (cls) node.className = cls
    if (words) node.textContent = words
    return node
  }
  let route: 'house' | 'collection' | 'life' = 'house'
  /* A LEAF PAINTED FROM THE STORE FILLS WHEN THE STORE ANSWERS, and a plate
     repainted meanwhile must not be written into: each paint carries a
     number, and a late answer for an older number is dropped. */
  let painting = 0

  /** The block as the plate opened it: the sentences and their certainty
   *  words, in one column, exactly as the wing records them. */
  function renderBlock(host_: HTMLElement, index: number): void {
    const block = vinciWelcomeBlocks[index]
    if (!block) return
    const narrow = phone()
    for (const line of block.lines) {
      if (line.only === 'phone' && !narrow) continue
      if (line.only === 'desktop' && narrow) continue
      const paragraph = make('p', 'vinci-statement')
      if (line.certainty) {
        paragraph.dataset['certainty'] = line.certainty
        paragraph.append(make('span', 'vinci-certainty-word', text(vinciCertaintyWords[line.certainty])))
      }
      paragraph.append(document_.createTextNode(text(line.text)))
      host_.append(paragraph)
    }
  }

  /* THE SOURCES ARE COUNTED, NEVER RESTATED. Every group is the store's own
     records, grouped by the role each one declares and named by the holder it
     names, or by its licence line where it names no holder. A group the
     records do not fill is left out. */
  function sourceRows(entries: readonly ManifestEntry[]): PlateGroup[] {
    const own = new Set<string>(vinciSourceScopes.own)
    const shared = new Set<string>(vinciSourceScopes.shared)
    const mine = entries.filter(entry =>
      own.has(entry.wing ?? '') || shared.has(entry.id.split('/')[0] ?? ''))
    const groups: PlateGroup[] = []
    for (const group of vinciSourceGroups) {
      const family = new Set(group.roles)
      const held = mine.filter(entry => {
        const head = (entry.role ?? '').split('-')[0] ?? ''
        const named = vinciSourceGroups.some(other => other.roles.includes(head))
        return group.rest ? !named : family.has(head)
      })
      const names = new Map<string, number>()
      for (const entry of held) {
        const named = entry.holder ?? entry.licence
        names.set(named, (names.get(named) ?? 0) + 1)
      }
      if (!names.size) continue
      const sorted = [...names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      groups.push({
        id: group.id,
        name: text(group.name),
        count: sorted.length,
        render(into) {
          const list = make('ul', 'vinci-welcome-sources')
          for (const [named] of sorted) list.append(make('li', '', named))
          into.append(list)
        },
      })
    }
    return groups
  }

  function renderSources(host_: HTMLElement): void {
    const mine = ++painting
    /* The record register: holders and licence lines are the store's own
       wording, complete, and they are read on purpose. */
    host_.dataset['register'] = 'record'
    // The store answers in the same tick once it is read, while the leaf is
    // still off the page: only the paint number may decide.
    void loadManifest().then(index => {
      if (mine === painting) plateGroups(host_, sourceRows(index.all))
    })
  }

  function leaves(): PlateLeaf[] {
    const list: PlateLeaf[] = vinciWelcomeBlocks.map((block, index) => ({
      id: block.id,
      tab: text(block.tab),
      name: text(block.heading),
      render: (into: HTMLElement) => renderBlock(into, index),
    }))
    list.push({ id: 'sources', tab: text(vinciWelcomeText.sources), render: renderSources })
    return list
  }

  const plate = createTitlePlate(host, {
    id: 'vinci-welcome',
    className: 'vinci-welcome',
    words: () => ({
      label: text(vinciWelcomeText.label),
      kicker: text(vinciWelcomeText.kicker),
      title: text(vinciWelcomeText.title),
      // The wing's one sentence, the same one the recap carries at the exit.
      line: text(vinciThroughLine),
      leaflet: text(vinciWelcomeText.leaflet),
      handle: text(vinciWelcomeText.handle),
    }),
    leaves,
    controls: () => [
      { word: text(vinciWelcomeText.enter), rank: 'primary', press: () => { route = 'house' } },
      { word: text(vinciWelcomeText.collection), rank: 'second', press: () => { route = 'collection' } },
      /* THE THIRD DOOR IS NOT A THIRD WAY IN. The two controls above choose
         where the visitor arrives; this one opens the years over the house
         they arrive in, so it stands under them and carries less weight. */
      {
        word: text(LIFE_WORDS.life), rank: 'third', className: 'wing-life-door',
        attributes: { 'aria-controls': 'wing-life' }, press: () => { route = 'life' },
      },
    ],
    onClose() {
      markSeen()
      onEnter(route)
    },
  })

  return {
    element: plate.element,
    open() {
      route = 'house'
      painting++
      plate.open()
    },
    dispose() {
      painting++
      plate.dispose()
    },
  }
}
