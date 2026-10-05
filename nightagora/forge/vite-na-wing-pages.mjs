// WHAT A MACHINE READS AT A WING'S ADDRESS. One document serves every
// address and carries a static mirror of the lobby. A build that names a
// wing's page on the site opens no lobby, so its document says so: the mirror
// is left out and one plain block stands in its place, naming each wing that
// has a page and linking to it in both languages, and the door's and the
// sky's own words are emptied. A build that names no page is not touched.
//
// The block's words are the caller's (the museum's fixed name and line); the
// wing's name is the register's.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIRROR = /[ \t]*<!--(?:(?!-->)[\s\S])*?static mirror(?:(?!-->)[\s\S])*?-->\s*<section class="static-soul"[\s\S]*?<\/section>/
/** THE DOOR'S AND THE SKY'S OWN WORDS in the document's source. The script
    writes every one of them again at its start (the keyed ones) or when their
    layer is shown (the sky's line, the pane's way back), so a build that
    opens no lobby carries none of them. Each must be found exactly once. */
const KEYED = ['firstLight', 'enterMuseum', 'descentTitle', 'descentMuseum', 'descentWalk', 'tonight', 'skipDescent', 'skyReturn', 'paneEnter']
const LOBBY_WORDS = [
  ...KEYED.map((key) => [key, new RegExp(`(<[a-z0-9]+\\b[^>]*\\bdata-lobby="${key}"[^>]*>)[^<]+(</[a-z0-9]+>)`, 'g')]),
  ['sky-invite', /(<p id="sky-invite">)[^<]+(<\/p>)/g],
  ['pane-close', /(<button class="pane-close" type="button">)[^<]+(<\/button>)/g],
]
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** the register's slugs and names, read as text: its modules are the app's */
function register(root) {
  const text = readFileSync(join(root, 'src/wings/registry.ts'), 'utf8')
  return [...text.matchAll(/slug:\s*'([a-z0-9-]+)',\s*name:\s*'([^']+)'/g)].map((m) => ({ slug: m[1], name: m[2] }))
}

/**
 * @param {{ read: (settings: Record<string, unknown>) => { wings: { key: string, en: string, de: string }[], refused: string[] },
 *   words: { name: string, line: { en: string, de: string }, inside: { en: string, de: string } } }} options
 */
export function naWingPages({ read, words }) {
  let wings = [], root = ''
  return {
    name: 'na-wing-pages',
    configResolved(config) {
      root = config.root
      const said = read(config.env)
      // a half-named pair or a far address is a build that would strand a visitor
      if (said.refused.length) throw new Error(`the wing pages' settings cannot be used: ${said.refused.join(', ')}`)
      const known = register(root)
      wings = said.wings.map((w) => {
        const entry = known.find((k) => k.slug.replaceAll('-', '_').toUpperCase() === w.key)
        if (!entry) throw new Error(`the register names no wing for VITE_NA_WING_PAGE_${w.key}_*`)
        return { ...w, name: entry.name }
      })
    },
    transformIndexHtml(html) {
      if (!wings.length) return html
      if (!MIRROR.test(html)) throw new Error('index.html carries no static mirror to replace')
      const rows = wings.flatMap((w) => [
        `    <h2>${esc(w.name)}</h2>`,
        `    <p><a href="${esc(w.en)}" hreflang="en" tabindex="-1">${esc(`${w.name} | ${words.inside.en}`)}</a></p>`,
        `    <p lang="de"><a href="${esc(w.de)}" hreflang="de" tabindex="-1">${esc(`${w.name} | ${words.inside.de}`)}</a></p>`,
      ])
      const block = [
        `  <section class="static-soul" aria-label="${esc(words.name)}">`,
        `    <p>${esc(words.line.en)}</p>`,
        `    <p lang="de">${esc(words.line.de)}</p>`,
        ...rows,
        '  </section>',
      ].join('\n')
      let out = html.replace(MIRROR, () => block)
      for (const [name, pattern] of LOBBY_WORDS) {
        const found = out.match(pattern)?.length ?? 0
        if (found !== 1) throw new Error(`index.html carries the lobby's words "${name}" ${found} times, not once`)
        out = out.replace(pattern, '$1$2')
      }
      return out
    },
  }
}
