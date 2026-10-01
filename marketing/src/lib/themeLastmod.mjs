// The date a theme page's own content last changed, for its JSON-LD
// dateModified and its sitemap lastmod. Read from git per theme and language:
// the theme's strings in the public translation file and the quotes the list
// holds for the page. A template edit, or an edit to another theme in the same
// file, moves nothing.
// Plain ESM: the theme pages and the Node sitemap script both import it, so
// the two dates cannot drift apart.
import { execSync } from 'node:child_process';
import { listedQuotes } from '../data/quotes/themeQuotes.mjs';

// Never today: without git history the date stays put instead of moving with
// every build.
const FALLBACK = '2026-05-06';

const STRINGS = {
  en: 'client/src/assets/translations/public-en.json',
  de: 'client/src/assets/translations/public-de.json',
};
const QUOTES = 'marketing/src/data/quotes/themes.json';

let root = null;
const git = (args) => {
  root ??= execSync('git rev-parse --show-toplevel', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return execSync(`git -C '${root}' ${args}`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
};

const commitsOf = new Map();
/** The commits that touched a file, newest first. */
function commits(path) {
  if (!commitsOf.has(path)) {
    const lines = git(`log --format=%H%x09%cI -- '${path}'`).trim().split('\n').filter(Boolean);
    commitsOf.set(path, lines.map((line) => {
      const [sha, date] = line.split('\t');
      return { sha, date: date.split('T')[0] };
    }));
  }
  return commitsOf.get(path);
}

const parsed = new Map();
/** A file as one commit left it, or null where it is missing or not JSON. */
function fileAt(sha, path) {
  const key = `${sha}:${path}`;
  if (!parsed.has(key)) {
    let json = null;
    try {
      json = JSON.parse(git(`show '${sha}:${path}'`));
    } catch {
      json = null;
    }
    parsed.set(key, json);
  }
  return parsed.get(key);
}

/** The date of the newest commit that changed what `pick` reads from a file. */
function lastChange(path, pick) {
  const list = commits(path);
  if (list.length === 0) return null;
  let newer = pick(fileAt(list[0].sha, path));
  for (let i = 0; i < list.length; i++) {
    const older = i + 1 < list.length ? pick(fileAt(list[i + 1].sha, path)) : pick(null);
    if (older !== newer) return list[i].date;
    newer = older;
  }
  return null;
}

const dates = new Map();

/** The last content date of one theme page, as YYYY-MM-DD. */
export function themeLastmod(themeId, lang) {
  const key = `${themeId}:${lang}`;
  if (!dates.has(key)) {
    let found = [];
    try {
      found = [
        lastChange(STRINGS[lang], (json) => JSON.stringify(json?.themes?.[themeId] ?? null)),
        lastChange(QUOTES, (json) =>
          JSON.stringify(
            listedQuotes(json?.quotes ?? [], themeId, lang).map((q) => [q.text, q.source?.line, q.speaker]),
          ),
        ),
      ].filter(Boolean);
    } catch {
      found = [];
    }
    dates.set(key, found.sort().at(-1) ?? FALLBACK);
  }
  return dates.get(key);
}
