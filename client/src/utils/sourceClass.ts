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
// the same arrival gets two different labels depending on the surface.

export type SourceClass =
  | 'ad_google'
  | 'ad_reddit'
  | 'search'
  | 'assistant'
  | 'reddit'
  | 'social'
  | 'referral'
  | 'direct';

// AI assistants before search engines: gemini.google.com and bard.google.com
// are suffixes of google.com, so the search test would swallow them.
const ASSISTANT_HOSTS = [
  'chatgpt.com', 'openai.com', 'perplexity.ai', 'claude.ai', 'anthropic.com',
  'copilot.microsoft.com', 'gemini.google.com', 'bard.google.com', 'you.com',
  'phind.com', 'kagi.com', 'mistral.ai', 'x.ai', 'grok.com', 'meta.ai',
];

const SEARCH_HOSTS = [
  'bing.com', 'duckduckgo.com', 'ecosia.org', 'yahoo.com', 'startpage.com',
  'qwant.com', 'brave.com', 'baidu.com',
];

const REDDIT_HOSTS = ['reddit.com', 'redd.it'];

const SOCIAL_HOSTS = [
  'x.com', 'twitter.com', 't.co', 'facebook.com', 'fb.com', 'instagram.com',
  'linkedin.com', 'lnkd.in', 'mastodon.social', 'bsky.app', 'threads.net',
  'youtube.com', 'youtu.be', 'tiktok.com', 'pinterest.com',
  'news.ycombinator.com',
];

const OWN_HOSTS = ['agoracosmica.org'];

// Google and Yandex run a country domain per market, so they have no single
// suffix to match against.
const MULTI_TLD_SEARCH = /(^|\.)(google|yandex)\.[a-z]{2,}(\.[a-z]{2,})?$/;

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
 * own host as its referrer, and the parameter is the more specific fact.
 */
export function sourceClass(landingUrl: string, referrer: string): SourceClass | undefined {
  const ad = adClass(landingUrl);
  if (ad) return ad;

  if (!referrer) return 'direct';
  const host = hostOf(referrer);
  if (!host) return 'direct';
  if (matchesHost(host, OWN_HOSTS) || host === hostOf(landingUrl)) return undefined;

  if (matchesHost(host, ASSISTANT_HOSTS)) return 'assistant';
  if (matchesHost(host, SEARCH_HOSTS) || MULTI_TLD_SEARCH.test(host)) return 'search';
  if (matchesHost(host, REDDIT_HOSTS)) return 'reddit';
  if (matchesHost(host, SOCIAL_HOSTS)) return 'social';
  return 'referral';
}
