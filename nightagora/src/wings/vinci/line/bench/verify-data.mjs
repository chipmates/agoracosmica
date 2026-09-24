// Verify shipped collection bytes against the sealed collection fingerprints.
// Run from any directory: node src/wings/vinci/line/bench/verify-data.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const sourceRoot = 'program/rounds/wing-vinci'

// The public copies replace only provenance.source_root with the portable path
// above. normalizedSHA256 was measured after that one string replacement in
// each sealed original; all other bytes, including formatting, were retained.
// We compare actual shipped bytes directly, never normalize arbitrary edits.
export const COLLECTIONS = [
  {
    name: 'timeline', file: 'src/wings/vinci/line/data/timeline.json',
    // The public copy carries the life view's record corrections: the event's and the date's
    // certainty apart, every reading in a disputed label, the calendar-style and editor notes,
    // named source links and German gap sentences. The sealed original does not.
    originalSHA256: '01d568f9f6ddb2c1534d2cd73e061f07624b8eda484d718e84be57782b66ee1d',
    normalizedSHA256: 'e955004745ef7fd7477652e899f9e7ee6cd45f5e0de15e74159cad75dee6fd82',
    expected: { studs: 56 },
  },
  {
    name: 'inscriptions', file: 'src/wings/vinci/words/data/inscriptions.json',
    // The public copy carries the first line's corrected folio (Richter 1150 at S. K. M. III. 80b,
    // Codex Forster III f. 80v) and its two gap sentences; the sealed original does not.
    originalSHA256: '95633ee2b45498b6b4be3b9bc388e66b17e8bc5b45c919a5a9848c01d1f64723',
    normalizedSHA256: 'be83cbda69d68f0cda99ff418b599b501c93e54918969d40f8d02fd8643dbc94',
    expected: { passages: 52, apocrypha: 6, verified_popular_quotes: 4, german_catalogue_corrections: 1 },
  },
  {
    name: 'doors', file: 'src/wings/vinci/data/doors.json',
    // The public copy carries the revision's station set, a twentieth question for the west end
    // and its own wording for it; the sealed original does not. Sixteen of the twenty stations stand.
    originalSHA256: 'c6bcb90a55fa4d3ce3ec00928ab276613233432468f05a1566ca306d81c47647',
    normalizedSHA256: '40aefa2f6d559c56ed2e8935cf959d9454e6e6fb4c2805ef3160309a41256e37',
    expected: { doors: 20 },
  },
  {
    name: 'paintings', file: 'src/wings/vinci/pictures/data/paintings.json',
    // The public copy carries the Adoration's corrected height and width, three facts rows taken
    // over from the mining catalogue, one fact reworded plainly, short titles, the Ginevra reverse's
    // own name and a German form of every holder line; the sealed original does not.
    originalSHA256: '7e78e1a73fa55cdd58c75c495332ebe0617387e6b72babbea2695bbb8a3a5d02',
    normalizedSHA256: '84888324fbe37f565c8209ad4be0529d21794fcabc671387cdd2d7e47cc080fc',
    expected: { works: 30, held_assets: 32, catalogue_mentions: 9 },
  },
]

export function verifyData(appRoot = root) {
  const checks = COLLECTIONS.map(({ name, file, originalSHA256, normalizedSHA256, expected }) => {
    try {
      const deployed = readFileSync(resolve(appRoot, file))
      const actualSHA256 = createHash('sha256').update(deployed).digest('hex')
      const data = JSON.parse(deployed.toString('utf8'))
      const counts = Object.fromEntries(Object.keys(expected).map(key =>
        [key, Array.isArray(data[key]) ? data[key].length : null]))
      const countsMatch = Object.entries(expected).every(([key, count]) => counts[key] === count)
      const hashMatches = actualSHA256 === normalizedSHA256
      const portableSourceRoot = data.provenance?.source_root === sourceRoot
      return {
        name, file, bytes: deployed.length, originalSHA256, normalizedSHA256, actualSHA256,
        normalization: { field: 'provenance.source_root', value: sourceRoot, otherBytesUnchanged: hashMatches },
        counts, expected, hashMatches, countsMatch, portableSourceRoot,
        ok: hashMatches && countsMatch && portableSourceRoot,
      }
    } catch (error) {
      return { name, file, ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
  return { ok: checks.every(check => check.ok), lockedCopies: checks.length, checks }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = verifyData()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exitCode = 1
}
