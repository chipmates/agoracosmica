/* THE WINGS — the museum's register. One row per figure whose wing is
   built or being built, and the lazy module that draws it. The lobby
   reads its own plate out of this file, so the promise the wheel makes
   and the rooms that exist can never drift apart.

   A row exists as soon as work on a wing starts, which is what makes
   `/w/<slug>` a working deep link before the wing is finished. */

import type { WingModule } from './frame'

export type WingStatus = 'open' | 'preparing'

export interface WingEntry {
  /** the night's own slug, and the last part of /w/<slug> */
  slug: string
  name: string
  status: WingStatus
  /** the public figure page's slug, which the app's deep link accepts */
  publicSlug?: string
  /** the app's ask tag for this figure: it NAMES a question, never carries
      one, so nothing a stranger writes into a link reaches the composer */
  askTag?: string
  load: () => Promise<{ createWing: () => WingModule }>
}

export const WINGS: WingEntry[] = [
  {
    slug: 'vinci',
    name: 'Leonardo da Vinci',
    status: 'preparing',
    publicSlug: 'leonardo-da-vinci',
    askTag: 'f:vinci:1',
    load: () => import('./vinci/index'),
  },
]

export const wingBySlug = (slug: string): WingEntry | undefined =>
  WINGS.find((w) => w.slug === slug)

export const wingsOpen = (): number => WINGS.filter((w) => w.status === 'open').length
export const wingsPreparing = (): number => WINGS.filter((w) => w.status === 'preparing').length
