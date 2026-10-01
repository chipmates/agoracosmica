/* THE LICENCE A VISITOR READS. The store keeps each source's licence by its
   raw English name; a public-domain line reads in the page's language, and a
   Creative Commons licence keeps its own name. It imports nothing and is
   imported only by the display sites, so a word here moves no film key. */
const SHOWN: Readonly<Record<string, { readonly en: string; readonly de: string }>> = {
  'Public domain': { en: 'Public domain', de: 'Gemeinfrei' },
}

export function shownLicence(raw: string, language: 'en' | 'de'): string {
  return SHOWN[raw.trim()]?.[language] ?? raw
}

/** every licence line a record shows, in the page's language */
export function showLicences(host: ParentNode, language: 'en' | 'de'): void {
  for (const line of host.querySelectorAll<HTMLElement>('.picture-licence, .vinci-statement')) {
    if (line.children.length) continue
    const raw = line.textContent ?? ''
    const shown = shownLicence(raw, language)
    if (shown !== raw) line.textContent = shown
  }
}
