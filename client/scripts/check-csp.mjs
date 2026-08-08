// Build gate: every inline script in the built HTML must be allowed by BOTH
// enforced policies. Two CSPs cover a page in production and they AND-merge:
// the per-page <meta> tag Astro generates from the scripts it inlined, and the
// response header Cloudflare Pages sends from client/public/_headers. A hash
// present in one and missing from the other blocks the script.
//
// Dev has no CSP at all, so this class of break is invisible until production.
// It is also silent there: a blocked inline script throws no visible error, the
// island simply never hydrates. The trigger is a size threshold, not an edit:
// a component script that drops under the bundler's inline limit turns from an
// external file (always allowed by 'self') into an inline block that needs a
// hash in both lists.
//
// _headers is the derived list. Run with --write to regenerate its script-src
// hashes from what the build actually emitted, instead of hand-copying them.
//
//   node scripts/check-csp.mjs            verify (build gate)
//   node scripts/check-csp.mjs --write    reconcile _headers, then verify
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BUILD = join(HERE, '..', 'build');
const HEADERS_SRC = join(HERE, '..', 'public', '_headers');
const HEADERS_BUILT = join(BUILD, '_headers');

const WRITE = process.argv.includes('--write');

// Script types the browser never executes, so CSP never scores them.
const INERT_TYPE = /^(application\/(ld\+json|json)|importmap|speculationrules|text\/(template|plain))$/i;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (entry.endsWith('.html')) yield path;
  }
}

// Quote-delimiter aware: a CSP value is full of single quotes, so the closing
// delimiter has to be the same character the value opened with.
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\s${name}=(["'])([\\s\\S]*?)\\1`, 'i'));
  return m ? m[2] : null;
};

/** The inline scripts a browser would run on this page, hashed the way CSP does. */
function inlineScripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, attrs, body] = m;
    if (/\ssrc=/i.test(attrs)) continue;
    const type = attr(attrs, 'type');
    if (type && INERT_TYPE.test(type.trim())) continue;
    if (!body.trim()) continue;
    out.push({
      hash: `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
      body,
    });
  }
  return out;
}

const directive = (policy, name) => {
  const m = policy.match(new RegExp(`(?:^|;)\\s*${name}\\s([^;]*)`, 'i'));
  return m ? m[1].trim() : null;
};

const hashesIn = value => new Set(value ? value.match(/'sha(?:256|384|512)-[^']*'/g) || [] : []);

/**
 * A source list allows an inline block only by hash or by 'unsafe-inline', and
 * a hash or nonce in the list makes the browser ignore 'unsafe-inline'.
 */
function allowsInline(value, hash) {
  if (value === null) return true; // directive absent, falls back to default-src or nothing
  const hashes = hashesIn(value);
  if (hashes.has(hash)) return true;
  const hasNonce = /'nonce-/.test(value);
  return value.includes("'unsafe-inline'") && hashes.size === 0 && !hasNonce;
}

// The capture keeps the leading whitespace: attr() anchors on it, and
// http-equiv is the first attribute on this tag.
const metaCsp = html => {
  const re = /<meta(\s[^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/^content-security-policy$/i.test(attr(m[1], 'http-equiv') || '')) return attr(m[1], 'content');
  }
  return null;
};

const headerCsp = text => {
  const m = text.match(/^\s*Content-Security-Policy:\s*(.+)$/mi);
  return m ? m[1].trim() : null;
};

function fail(lines) {
  for (const l of lines) console.error(l);
  process.exit(1);
}

if (!statSync(BUILD, { throwIfNoEntry: false })) {
  fail(['check-csp: client/build/ not found. Run the build first.']);
}

// The built _headers is the one that ships; the source file is what we edit.
const headersPath = statSync(HEADERS_BUILT, { throwIfNoEntry: false }) ? HEADERS_BUILT : HEADERS_SRC;
const headerPolicy = headerCsp(readFileSync(headersPath, 'utf8'));
if (!headerPolicy) fail([`check-csp: no Content-Security-Policy line in ${headersPath}`]);
const headerScriptSrc = directive(headerPolicy, 'script-src');

const pages = [...walk(BUILD)];

// --write: _headers takes its script hashes from the generated meta policies,
// so there is one source of truth (what the build inlined) and no hand-copying.
if (WRITE) {
  const union = new Set();
  for (const page of pages) {
    const policy = metaCsp(readFileSync(page, 'utf8'));
    if (policy) for (const h of hashesIn(directive(policy, 'script-src'))) union.add(h);
  }
  const before = hashesIn(headerScriptSrc);
  const added = [...union].filter(h => !before.has(h));
  const dropped = [...before].filter(h => !union.has(h));

  if (added.length === 0 && dropped.length === 0) {
    console.log('check-csp --write: _headers script-src already matches the build.');
  } else {
    const source = readFileSync(HEADERS_SRC, 'utf8');
    // Keep every surviving token where it already sits and append only what is
    // new, so a hash change reads as a hash change and not as a reordered policy.
    const tokens = headerScriptSrc.split(/\s+/);
    const isHash = t => /^'sha(256|384|512)-/.test(t);
    const kept = tokens.filter(t => !isHash(t) || union.has(t));
    const fresh = [...union].filter(h => !tokens.includes(h));
    const lastHash = kept.map(isHash).lastIndexOf(true);
    const at = lastHash >= 0 ? lastHash + 1 : Math.max(kept.indexOf("'self'"), 0) + 1;
    const rebuilt = [...kept.slice(0, at), ...fresh, ...kept.slice(at)].join(' ');
    const updated = source.replace(headerScriptSrc, rebuilt);
    if (updated === source) fail(['check-csp --write: could not locate script-src in client/public/_headers']);
    writeFileSync(HEADERS_SRC, updated);
    console.log(`check-csp --write: client/public/_headers script-src reconciled (+${added.length} / -${dropped.length}).`);
    for (const h of added) console.log('  + ' + h);
    for (const h of dropped) console.log('  - ' + h);
    console.log('Rebuild so the change reaches client/build/_headers.');
  }
}

const effectiveHeaderScriptSrc = WRITE
  ? directive(headerCsp(readFileSync(HEADERS_SRC, 'utf8')), 'script-src')
  : headerScriptSrc;

const violations = [];
let scriptCount = 0;
let metaPages = 0;
const seen = new Set();

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const meta = metaCsp(html);
  if (meta) metaPages++;
  const metaScriptSrc = meta ? directive(meta, 'script-src') : null;

  for (const { hash, body } of inlineScripts(html)) {
    scriptCount++;
    seen.add(hash);
    const inMeta = meta === null || allowsInline(metaScriptSrc, hash);
    const inHeader = allowsInline(effectiveHeaderScriptSrc, hash);
    if (inMeta && inHeader) continue;
    const missing = [!inMeta && 'the page meta CSP', !inHeader && 'client/public/_headers']
      .filter(Boolean)
      .join(' and ');
    violations.push({
      page: relative(BUILD, page),
      hash,
      missing,
      head: body.trim().replace(/\s+/g, ' ').slice(0, 90),
    });
  }
}

// A page with no meta CSP is only held by the header, which is legitimate, but
// zero across the whole build means this script stopped reading the tag rather
// than the build stopping emitting it, and every meta-side check silently passed.
if (metaPages === 0) {
  fail([
    'check-csp: not one built page yielded a meta CSP.',
    'The meta half of the policy went unchecked. Fix the parser before trusting a pass.',
  ]);
}

if (violations.length > 0) {
  console.error('CSP would block inline scripts in production:');
  const byHash = new Map();
  for (const v of violations) {
    if (!byHash.has(v.hash)) byHash.set(v.hash, { ...v, pages: [] });
    byHash.get(v.hash).pages.push(v.page);
  }
  for (const v of byHash.values()) {
    console.error(`  ${v.hash}`);
    console.error(`    missing from: ${v.missing}`);
    console.error(`    on ${v.pages.length} page(s), e.g. ${v.pages[0]}`);
    console.error(`    script: ${v.head}...`);
  }
  console.error('');
  console.error('Both policies AND-enforce, so the script is dead in every browser');
  console.error('while dev keeps working. Fix: node scripts/check-csp.mjs --write');
  process.exit(1);
}

// The other direction is drift, not breakage: a hash nothing needs any more.
const stale = [...hashesIn(effectiveHeaderScriptSrc)].filter(h => !seen.has(h));
if (stale.length > 0) {
  console.log(`check-csp: ${stale.length} hash(es) in _headers match no inline script in the build`);
  console.log('           (allowed but unused; --write trims what the meta policies also dropped)');
}
console.log(
  `check-csp: ${scriptCount} inline script(s) across ${pages.length} page(s) allowed by both policies ` +
    `(${metaPages} carry a meta CSP)`
);
