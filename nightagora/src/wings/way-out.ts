/* WHERE A WING LEADS BACK TO. On the museum's site every wing has a page of
   its own per language, with its own slug, so the addresses are settings a
   build carries and never a pattern: VITE_NA_WING_PAGE_<SLUG>_<LANG> for a
   wing, VITE_NA_SITE_PAGE_<LANG> for an address that names no wing. A build
   that carries none keeps the lobby.

   No import with a value: the build's own step reads this file too. */

import type { Lang } from './content'

export type Settings = Readonly<Record<string, unknown>>

const WING_PAGE = 'VITE_NA_WING_PAGE_'
const SITE_PAGE = 'VITE_NA_SITE_PAGE_'
const LANGS: readonly Lang[] = ['en', 'de']

/** the fragment of a page for a visitor who has finished the walk */
export const FINISHED = '#more'

export const wingPageKey = (slug: string, language: Lang): string =>
  `${WING_PAGE}${slug.replaceAll('-', '_').toUpperCase()}_${language.toUpperCase()}`

export const sitePageKey = (language: Lang): string => `${SITE_PAGE}${language.toUpperCase()}`

/** A path on this site, or nothing: a setting never names another origin,
    and never one of the app's own addresses, which would lead back in. */
export function sitePath(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(?![/\\])[^\s\\#]*$/.test(value)) return null
  return /^\/(w|bench)(\/|$)/.test(value) ? null : value
}

const other = (language: Lang): Lang => (language === 'de' ? 'en' : 'de')

/** The wing's page in the visitor's language; the other language's page
    where only one is named, so a wing with a page never opens a lobby. */
export function wingPage(settings: Settings, slug: string, language: Lang): string | null {
  if (!slug) return null
  return sitePath(settings[wingPageKey(slug, language)]) ?? sitePath(settings[wingPageKey(slug, other(language))])
}

/** Where an address that names no wing leads: the site's front page. */
export function sitePage(settings: Settings, language: Lang): string | null {
  return sitePath(settings[sitePageKey(language)]) ?? sitePath(settings[sitePageKey(other(language))])
}

/** The way out of a wing: its page, with the fragment once the walk is finished. */
export function wayOut(settings: Settings, slug: string, language: Lang, finished: boolean): string | null {
  const page = wingPage(settings, slug, language)
  return page === null ? null : finished ? `${page}${FINISHED}` : page
}

/** What a build's settings say, for the build's own step: every wing named
    with its two pages, and every setting that cannot be used. */
export function readSettings(settings: Settings): { wings: { key: string; en: string; de: string }[]; refused: string[] } {
  const refused: string[] = []
  const found = new Map<string, Partial<Record<Lang, string>>>()
  for (const [name, value] of Object.entries(settings)) {
    const site = name.startsWith(SITE_PAGE), wing = name.startsWith(WING_PAGE)
    // an empty setting is a setting left out
    if ((!site && !wing) || value === '') continue
    const at = name.lastIndexOf('_')
    const language = LANGS.find(l => l.toUpperCase() === name.slice(at + 1))
    const path = sitePath(value)
    const named = site ? at + 1 === SITE_PAGE.length : at > WING_PAGE.length
    if (!language || !path || !named) { refused.push(`${name}=${String(value)}`); continue }
    if (site) continue
    const key = name.slice(WING_PAGE.length, at)
    found.set(key, { ...found.get(key), [language]: path })
  }
  const wings: { key: string; en: string; de: string }[] = []
  for (const [key, pages] of found) {
    if (pages.en && pages.de) wings.push({ key, en: pages.en, de: pages.de })
    else refused.push(`${WING_PAGE}${key}_${pages.en ? 'DE' : 'EN'} is not set`)
  }
  for (const language of LANGS)
    if (sitePath(settings[sitePageKey(language)]) && !sitePath(settings[sitePageKey(other(language))]))
      refused.push(`${sitePageKey(other(language))} is not set`)
  return { wings, refused: [...new Set(refused)] }
}
