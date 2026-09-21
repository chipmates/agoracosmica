// Source class of a landing pageview: one value from a closed list, derived
// from the host of the referrer and whether the landing URL carried an ad
// parameter. Pure by design, the caller passes location.href and
// document.referrer, so nothing here reaches for a browser global.
//
// Privacy: the referrer string and every click id are read here and discarded.
// Nothing is stored, nothing is read from the device, and only the class value
// leaves the browser, which makes it a property of the request like country and
// device class. Disclosed in docs/MEASUREMENT.md.
//
// The twin of this table lives in marketing/public/agc-public.js (plain JS, no
// build step). Both lists must stay identical, same hosts in the same order, or
// the same arrival gets two different labels depending on the surface. The
// drift test in __tests__/utils/sourceClass.test.ts compares them list by list.

export type SourceClass =
  | 'ad_google'
  | 'ad_reddit'
  | 'search'
  | 'assistant'
  | 'edu'
  | 'mail'
  | 'messenger'
  | 'code'
  | 'news'
  | 'wiki'
  | 'directory'
  | 'reddit'
  | 'social'
  | 'referral'
  | 'direct';

// One object so the twin can be compared key for key. The keys are in the
// order the classifier tests them: every specific host list runs before the
// search test, because classroom.google.com and mail.google.com are suffixes
// of google.com and the search rule would otherwise swallow them, as it would
// gemini.google.com.
export const HOST_LISTS = {
  assistant: [
    'chatgpt.com', 'openai.com', 'perplexity.ai', 'claude.ai', 'anthropic.com',
    'copilot.microsoft.com', 'gemini.google.com', 'bard.google.com', 'you.com',
    'phind.com', 'kagi.com', 'mistral.ai', 'x.ai', 'grok.com', 'meta.ai',
  ],
  edu: [
    'instructure.com', 'schoology.com', 'blackboard.com', 'brightspace.com',
    'd2l.com', 'moodlecloud.com', 'classroom.google.com', 'edmodo.com',
    'seesaw.me', 'clever.com', 'itslearning.com', 'padlet.com',
    'mebis.bycs.de', 'lernraum-berlin.de', 'schul.cloud', 'iserv.de',
  ],
  mail: [
    'mail.google.com', 'outlook.live.com', 'outlook.office.com',
    'outlook.office365.com', 'mail.yahoo.com', 'mail.proton.me',
    'navigator.gmx.net', 'navigator.web.de', 'mail.zoho.com', 'substack.com',
    'beehiiv.com', 'mailchi.mp', 'buttondown.email', 'buttondown.com',
  ],
  messenger: [
    'discord.com', 'discordapp.com', 'web.whatsapp.com', 'web.telegram.org',
    't.me', 'teams.microsoft.com', 'teams.live.com', 'app.slack.com',
    'slack.com', 'signal.me', 'element.io', 'matrix.to',
  ],
  code: [
    'github.com', 'gitlab.com', 'codeberg.org', 'bitbucket.org', 'sr.ht',
    'gitea.com',
  ],
  news: [
    'news.ycombinator.com', 'lobste.rs', 'slashdot.org', 'tildes.net',
    'indiehackers.com', 'producthunt.com',
  ],
  wiki: [
    'wikipedia.org', 'wikimedia.org', 'wikiquote.org', 'wikisource.org',
    'wikidata.org', 'wikiversity.org',
  ],
  directory: [
    'alternativeto.net', 'openalternative.co', 'european-alternatives.eu',
    'theresanaiforthat.com', 'futuretools.io', 'toolify.ai', 'futurepedia.io',
    'saashub.com', 'libhunt.com', 'opensourcealternative.to',
  ],
  reddit: ['reddit.com', 'redd.it'],
  social: [
    'x.com', 'twitter.com', 't.co', 'facebook.com', 'fb.com', 'instagram.com',
    'linkedin.com', 'lnkd.in', 'mastodon.social', 'bsky.app', 'threads.net',
    'youtube.com', 'youtu.be', 'tiktok.com', 'pinterest.com',
  ],
  search: [
    'bing.com', 'duckduckgo.com', 'ecosia.org', 'yahoo.com', 'startpage.com',
    'qwant.com', 'brave.com', 'baidu.com',
  ],
  own: ['agoracosmica.org'],
};

// Google and Yandex run a country domain per market, so they have no single
// suffix to match against.
const MULTI_TLD_SEARCH = /(^|\.)(google|yandex)\.[a-z]{2,}(\.[a-z]{2,})?$/;

// Schools and universities the world over share a naming shape rather than a
// host list. Anchored at the end on purpose, so a lookalike like
// ac.uk.example.net cannot borrow the pattern, and label-bounded, so a word
// inside a label (education.example.com) is not a match.
const EDU_NAME_PATTERN = /(\.edu|\.(?:edu|ac|sch)\.[a-z]{2}|\.k12\.[a-z]{2}\.us|\.schule)$/;

/** Exposed with the same shape in the twin, so drift in either is a test failure. */
export const HOST_PATTERNS = {
  search: MULTI_TLD_SEARCH,
  edu: EDU_NAME_PATTERN,
};

/** Suffix match on a hostname: the host itself, or any subdomain of it. */
function matchesHost(hostname: string, hosts: readonly string[]): boolean {
  return hosts.some(host => hostname === host || hostname.endsWith('.' + host));
}

/** Lower-cased hostname of a URL, or '' when it does not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Ad class of a landing URL, from the presence of an ad parameter. The
 * parameter's value is never read, only whether it is there.
 */
function adClass(landingUrl: string): SourceClass | undefined {
  let params: URLSearchParams;
  try {
    params = new URL(landingUrl).searchParams;
  } catch {
    return undefined;
  }
  if (params.has('gclid') || params.get('p') === '1') return 'ad_google';
  const utmSource = (params.get('utm_source') || '').toLowerCase();
  if (utmSource === 'reddit' || params.has('rdt_cid')) return 'ad_reddit';
  return undefined;
}

/**
 * Where a landing pageview came from, as one closed-list value, or undefined
 * when the referrer is one of our own hosts (an internal navigation, which the
 * caller never labels). An absent or unparsable referrer is 'direct'.
 *
 * Ad parameters win over the referrer: an ad click can carry the ad network's
 * own host as its referrer, and the parameter is the more specific fact. Then
 * the specific host lists, then the search engines, then the education name
 * patterns (they are the widest rule, so they run last and never shadow a
 * named host), then everything else is a referral.
 */
export function sourceClass(landingUrl: string, referrer: string): SourceClass | undefined {
  const ad = adClass(landingUrl);
  if (ad) return ad;

  if (!referrer) return 'direct';
  const host = hostOf(referrer);
  if (!host) return 'direct';
  if (matchesHost(host, HOST_LISTS.own) || host === hostOf(landingUrl)) return undefined;

  if (matchesHost(host, HOST_LISTS.assistant)) return 'assistant';
  if (matchesHost(host, HOST_LISTS.edu)) return 'edu';
  if (matchesHost(host, HOST_LISTS.mail)) return 'mail';
  if (matchesHost(host, HOST_LISTS.messenger)) return 'messenger';
  if (matchesHost(host, HOST_LISTS.code)) return 'code';
  if (matchesHost(host, HOST_LISTS.news)) return 'news';
  if (matchesHost(host, HOST_LISTS.wiki)) return 'wiki';
  if (matchesHost(host, HOST_LISTS.directory)) return 'directory';
  if (matchesHost(host, HOST_LISTS.reddit)) return 'reddit';
  if (matchesHost(host, HOST_LISTS.social)) return 'social';
  if (matchesHost(host, HOST_LISTS.search) || MULTI_TLD_SEARCH.test(host)) return 'search';
  if (EDU_NAME_PATTERN.test(host)) return 'edu';
  return 'referral';
}
