/* The manifest as the app reads it: fetched once, indexed by id, and by the
   path family for the assets that live on the media origin. A missing
   manifest is not an error at runtime (the app still draws), because the
   build already refused to produce a bundle whose assets are unrecorded. */

import { MANIFEST_URL, matchesPath, type Manifest, type ManifestEntry } from './schema'

export * from './schema'

/** where a scope's bytes stand: the store in dev, the media origin in build.
    `path` is relative to the scope, so one base serves the whole museum. */
export function assetUrl(base: string, entry: ManifestEntry): string {
  return entry.source_url ?? `${base}${entry.wing}/${entry.path}`
}

export interface ManifestIndex {
  byId: Map<string, ManifestEntry>
  /** every entry, in the order the scopes were merged */
  all: ManifestEntry[]
  /** what covers this path or URL, family entries included */
  forPath: (candidate: string) => ManifestEntry | undefined
}

let pending: Promise<ManifestIndex> | null = null

function index(list: ManifestEntry[]): ManifestIndex {
  const byId = new Map(list.map((e) => [e.id, e]))
  return {
    byId,
    all: list,
    forPath: (candidate) =>
      list.find((e) => matchesPath(e.path, candidate) || (e.source_url !== undefined && matchesPath(e.source_url, candidate))),
  }
}

/** AN UNREAD STORE IS SAID, NOT SWALLOWED. A manifest that answers with a
    page, with an error or with nothing leaves every plate unadmitted and
    every cell blank, and the room reads as a room whose art failed. The
    reason is named once in the console, and the page carries the mark so the
    hang can show an absence instead of an empty mount. */
function unread(said: string): ManifestIndex {
  console.error(`The asset manifest was not read: ${said}. The museum draws, its store does not.`)
  if (typeof document !== 'undefined') document.documentElement.dataset['naManifest'] = 'unread'
  return index([])
}

export function loadManifest(): Promise<ManifestIndex> {
  if (pending) return pending
  pending = (async () => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) return unread(`${MANIFEST_URL} answered ${res.status}`)
      const body = await res.text()
      let raw: Manifest | ManifestEntry[]
      try {
        raw = JSON.parse(body) as Manifest | ManifestEntry[]
      } catch {
        // A dev server that has not written the file answers the app's own
        // index page here, which parses as nothing and reads as no store.
        return unread(`${MANIFEST_URL} is not JSON but ${body.trimStart().slice(0, 24).replace(/\s+/g, ' ')}`)
      }
      const list = Array.isArray(raw) ? raw : (raw.assets ?? [])
      return list.length ? index(list) : unread(`${MANIFEST_URL} names no asset`)
    } catch (error) {
      return unread(`${MANIFEST_URL} could not be fetched (${String(error)})`)
    }
  })()
  return pending
}
