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

export function loadManifest(): Promise<ManifestIndex> {
  if (pending) return pending
  pending = (async () => {
    try {
      const res = await fetch(MANIFEST_URL)
      if (!res.ok) return index([])
      const raw = (await res.json()) as Manifest | ManifestEntry[]
      return index(Array.isArray(raw) ? raw : (raw.assets ?? []))
    } catch {
      return index([])
    }
  })()
  return pending
}
