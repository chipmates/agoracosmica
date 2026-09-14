/** Supplemental, read-only text audit. This does not replace the eyes DOM gate. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { COLLECTIONS, verifyData } from './verify-data.mjs'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const inventory = [], errors = [], omissions = [], comparisons = [], recordDeclarations = []
const read = file => readFileSync(resolve(root, file), 'utf8')
const json = file => JSON.parse(read(file))
const add = (file, field, value, language, register, classification, extra = {}) => {
  if (typeof value !== 'string' || !value.trim()) return
  inventory.push({ file, field, language, register, classification, text: value, ...extra })
}

function offences(value, language) {
  const result = []
  const match = (rule, expression) => {
    for (const found of value.matchAll(expression)) result.push({ rule, match: found[0] })
  }
  match('file path', /\b(?:brief|src|refs)\/[^\s<>"']+|\b[^\s<>"']+\.(?:md|json|csv)\b/gi)
  match('section code', /§|\bS\d+(?:\.\d+)*\b/g)
  match('question id', /\bQ\d{3,}\b/g)
  match('error bar', /±/g)
  match('measured range', /[−-]?\d+(?:[.,]\d+)?\s*[–—-]\s*[−-]?\d+(?:[.,]\d+)?\s*(?:mm|cm|km|m)\b/g)
  match('machine word', /\b(?:procedural\w*|exhibition proposal\w*|scenario range\w*|nominal\w*|dossier\w*|prozedural\p{L}*|Ausstellungsvorschl(?:ag|äg)\p{L}*|Szenariobereich\p{L}*|Nenn(?:höhe|maß|wert|breite|länge)\p{L}*)\b/giu)
  for (const found of value.matchAll(/\d+(?:[.,]\d+)+/g)) {
    const number = found[0]
    // The locked auction/attendance labels use real thousands groups in both languages.
    const grouped = language === 'de' ? /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/ : /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/
    if (grouped.test(number)) continue
    if (/[.,]\d{3,}(?!\d)/.test(number)) result.push({ rule: 'over two decimals', match: number })
  }
  return result
}

function pureExports(file) {
  const source = read(file)
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  if (ast.statements.some(node => ts.isImportDeclaration(node) || ts.isExportDeclaration(node))) throw new Error(`${file}: pure data module gained an import/re-export; explicit review required`)
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  const diagnostics = result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error) ?? []
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: x => x, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
  const exports = {}
  runInNewContext(result.outputText, { exports }, { filename: file, timeout: 1000 })
  return exports
}

try {
  const sourceFile = 'src/wings/vinci/line/bench/visitor-sources.ts'
  const sources = pureExports(sourceFile)
  const timeline = json('src/wings/vinci/line/data/timeline.json')
  const expected = timeline.studs.map(stud => stud.id).sort()
  const actual = Object.keys(sources.SOURCE_READINGS ?? {}).sort()
  if (expected.length !== 56 || new Set(expected).size !== 56 || JSON.stringify(actual) !== JSON.stringify(expected)) errors.push({ file: sourceFile, rule: 'exact 56 life IDs', expected, actual })
  for (const id of expected) for (const language of ['en', 'de']) {
    const value = sources.SOURCE_READINGS?.[id]?.[language]
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) errors.push({ file: sourceFile, field: `${id}.${language}`, rule: 'one nonempty paragraph in each language' })
    add(sourceFile, `SOURCE_READINGS.${id}.${language}`, value, language, 'drawer', 'authored-source-paragraph')
  }
  for (const key of ['INSCRIPTION_SOURCE', 'GRAVE_SOURCE', 'GRAVE_DIAGRAM', 'INGRES_SOURCE']) for (const language of ['en', 'de']) {
    const value = sources[key]?.[language]
    if (typeof value !== 'string' || !value.trim()) errors.push({ file: sourceFile, field: `${key}.${language}`, rule: 'missing source paragraph' })
    add(sourceFile, `${key}.${language}`, value, language, 'drawer', 'authored-source-paragraph')
  }

  // Read the sealed public copies, rather than copying their text into this check.
  // Quotations are classified separately but receive the same mechanical scan.
  const displayField = /^(?:line|date_label|label_first_line|title|certainty_word|text|display_text|question|absence_reason|attribution_line|clearance_sentence)_(en|de)$/
  for (const { name, file } of COLLECTIONS) {
    const collection = json(file)
    const visit = (value, path = '') => {
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`))
      if (!value || typeof value !== 'object') return
      for (const [key, item] of Object.entries(value)) {
        const field = `${path}.${key}`, localized = key.match(displayField)
        if (localized && typeof item === 'string') {
          const quotation = name === 'inscriptions' && /^(?:text|display_text)_/.test(key)
          add(file, field, item, localized[1], key.startsWith('question_') ? 'drawer' : 'label', quotation ? 'locked-verbatim-quotation' : 'locked-display-field', { availability: name === 'paintings' ? 'collection inventory; not mounted by this bench' : 'collection inventory; includes unselected entries' })
        } else if (name === 'inscriptions' && ['quote', 'actual_origin', 'popular_quote', 'source_text_en'].includes(key)) {
          add(file, field, item, 'en', 'label', key === 'actual_origin' ? 'locked-display-field' : 'locked-verbatim-quotation', { availability: path.startsWith('.verified_popular_quotes') ? 'collection inventory; not mounted by this bench' : 'collection inventory' })
        } else visit(item, field)
      }
    }
    visit(collection)
  }
  add('src/wings/vinci/line/data/timeline.json', 'design.afterlife', timeline.design.afterlife, 'en', 'label', 'locked-display-field')
  // The one physically carved folio siglum is required provenance beside the quotation.
  const inscriptions = json('src/wings/vinci/words/data/inscriptions.json')
  const selectedPassage = inscriptions.passages.find(passage => passage.richter_number === 498)
  if (!selectedPassage) errors.push({ rule: 'missing Richter 498 inscription' })
  else add('src/wings/vinci/words/data/inscriptions.json', `${selectedPassage.id}.folio_siglum`, selectedPassage.folio_siglum, 'en', 'label', 'locked-folio-provenance')

  const sealed = verifyData(root)
  comparisons.push(...sealed.checks)
  for (const check of sealed.checks) {
    if (!check.ok) errors.push({ file: check.file, rule: 'sealed public collection changed', check })
  }

  const translationsFile = 'src/wings/vinci/myths/translations.ts'
  const translations = pureExports(translationsFile)
  translations.APOCRYPHA_DE.forEach((entry, index) => add(translationsFile, `APOCRYPHA_DE[${index}].actual_origin`, entry.actual_origin, 'de', 'label', 'authored-translation'))

  // AST extraction is intentionally restricted to known text sinks. It neither
  // scans import paths as visitor copy nor pretends to infer every DOM ancestor.
  for (const file of ['src/wings/vinci/line/bench/index.ts', 'src/wings/vinci/line/index.ts', 'src/wings/vinci/words/index.ts', 'src/wings/vinci/myths/index.ts', 'src/wings/vinci/grave/index.ts']) {
    const source = read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    for (const diagnostic of ast.parseDiagnostics) errors.push({ file, rule: 'could not parse authored UI', message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') })
    const constants = new Map(), records = new Set(), styles = new Set()
    const at = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
    const walk = (node, fn) => { fn(node); ts.forEachChild(node, child => walk(child, fn)) }
    walk(ast, node => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return
      constants.set(node.name.text, node.initializer)
      const expression = node.initializer
      if (ts.isCallExpression(expression) && expression.expression.getText(ast) === 'setRegister' && expression.arguments[1]?.getText(ast) === "'record'") { records.add(node.name.text); recordDeclarations.push({ file, line: at(node), binding: node.name.text, register: 'record' }) }
      if (ts.isCallExpression(expression) && expression.expression.getText(ast) === 'make' && expression.arguments[0]?.getText(ast) === "'style'") styles.add(node.name.text)
    })
    const inRecord = node => {
      for (let cursor = node; cursor; cursor = cursor.parent) {
        if (ts.isCallExpression(cursor) && ts.isPropertyAccessExpression(cursor.expression) && records.has(cursor.expression.expression.getText(ast)) && ['append', 'prepend', 'replaceChildren'].includes(cursor.expression.name.text)) return true
        if (ts.isCallExpression(cursor) && cursor.expression.getText(ast) === 'setRegister' && cursor.arguments[1]?.getText(ast) === "'record'") return true
      }
      return false
    }
    const emitted = new Set()
    const extract = (node, language = 'shared', seen = new Set()) => {
      if (!node) return
      if (ts.isStringLiteralLike(node)) {
        const key = `${node.pos}:${language}`
        if (!emitted.has(key)) { emitted.add(key); add(file, `line ${at(node)}`, node.text, language, 'label-or-drawer', 'authored-static-text-sink') }
      } else if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) extract(node.expression, language, seen)
      else if (ts.isConditionalExpression(node)) { extract(node.whenTrue, language, seen); extract(node.whenFalse, language, seen) }
      else if (ts.isCallExpression(node) && node.expression.getText(ast) === 'text') { extract(node.arguments[0], 'en', seen); extract(node.arguments[1], 'de', seen) }
      else if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) extract(constants.get(node.text), language, new Set([...seen, node.text]))
      else if (ts.isArrayLiteralExpression(node)) node.elements.forEach(item => extract(item, language, seen))
      else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) { extract(node.left, language, seen); extract(node.right, language, seen); omissions.push({ file, line: at(node), kind: 'concatenated string; fragments checked, result requires live DOM' }) }
      else if (ts.isTemplateExpression(node)) {
        // Constant fragments can carry a refusal even when substitutions are dynamic.
        add(file, `line ${at(node)} template head`, node.head.text, language, 'label-or-drawer', 'authored-static-fragment')
        node.templateSpans.forEach(span => add(file, `line ${at(span)} template tail`, span.literal.text, language, 'label-or-drawer', 'authored-static-fragment'))
        omissions.push({ file, line: at(node), kind: 'template substitutions require live DOM' })
      } else omissions.push({ file, line: at(node), kind: 'dynamic text expression', expression: node.getText(ast).slice(0, 180) })
    }
    walk(ast, node => {
      if (inRecord(node)) return
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(ast)
        if (name === 'make') extract(node.arguments[2])
        else if (name === 'createText' || /^(?:build|gableBuild|slabName)\.text$/.test(name) || name === 'document.createTextNode') extract(node.arguments[0])
        else if (name === 'appendFact') extract(node.arguments[1])
        else if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setAttribute' && node.arguments[0]?.getText(ast) === "'aria-label'") extract(node.arguments[1])
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'textContent') {
        const receiver = node.left.expression.getText(ast)
        if (!records.has(receiver) && !styles.has(receiver)) extract(node.right)
      }
    })
    // Static collections selected dynamically by the visitor's state/language.
    for (const name of ['TITLES', 'names', 'AFTERLIFE_DE', 'CERTAINTY']) {
      const expression = constants.get(name)
      if (!expression) continue
      walk(expression, node => {
        if (ts.isStringLiteralLike(node) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) && !/^#/.test(node.text)) extract(node)
      })
    }
  }
} catch (error) { errors.push({ rule: 'audit could not read its declared scope', message: String(error) }) }

const refusals = inventory.flatMap(item => {
  const rules = offences(item.text, item.language)
  return rules.length ? [{ ...item, offences: rules }] : []
})
const counts = key => Object.fromEntries([...new Set(inventory.map(item => item[key]))].sort().map(value => [value, inventory.filter(item => item[key] === value).length]))
const output = {
  instrument: 'supplemental-static-visitor-register-audit',
  ok: errors.length === 0 && refusals.length === 0,
  checked: { stringOccurrences: inventory.length, byLanguage: counts('language'), byRegister: counts('register'), byClassification: counts('classification'), lifeSourceParagraphs: inventory.filter(item => item.field.startsWith('SOURCE_READINGS.life-')).length },
  refusedStringOccurrences: refusals.length,
  refusals,
  errors,
  lockedCopyComparisons: comparisons,
  explicitRecordDeclarations: recordDeclarations,
  scopeLimits: [
    'Collection fingerprints preserve every sealed source byte except the declared portable provenance.source_root replacement. The originals need not be shipped.',
    'No browser was opened. This result is not the shared register gate and cannot replace the eyes /gates result.',
    'Locked display fields are a collection inventory, including unselected inscriptions and paintings outside this bench. Verbatim quotations are classified and scanned, never rewritten or silently exempted.',
    'Only named display fields are audited in collection records. Documents, holders, source locators, licences, qualifications and gaps belong to the purposeful record and are not general visitor prose.',
    'Static UI extraction checks known make/createText/Construction.text, appendFact, aria-label and textContent sinks. Explicit setRegister record append ancestry is excluded; full DOM ancestry, reachability and dynamic interpolation require the live gate.',
    'Static fragments may be counted at more than one source occurrence. Counts are source readings, not visible DOM strings or per-viewport measurements.',
    'A mechanical pass cannot establish source accuracy, natural museum voice, semantic number counts, translation quality, clipping or physical legibility.',
  ],
  dynamicExpressionsNotFullyEvaluated: [...new Map(omissions.map(item => [JSON.stringify(item), item])).values()],
  ...(process.argv.includes('--inventory') ? { inventory } : {}),
}
console.log(JSON.stringify(output, null, 2))
process.exitCode = output.ok ? 0 : 1
