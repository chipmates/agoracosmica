// The landing's source class, carried into the app by the public page the
// visitor landed on: its door links end in #src=<class> (agc-public.js). A
// fragment never travels with a request, and the app reads it once at boot,
// removes it from the address and holds the class in memory for the entry,
// first-chat and real-use counts. Nothing is stored.
//
// When the app document itself opened the visit (no referrer, or another
// site's), the class is worked out here from this page load, by the same rule
// the page beacon labels the landing with (utils/pageBeacon.ts).

import { sourceClass, type LegacySourceClass, type SourceClass } from './sourceClass';

export type ArrivalClass = SourceClass | LegacySourceClass;

// Same closed list as the worker's SOURCE_CLASSES (utils/analytics.ts there).
// ad_google is still read: a public page loaded before the grant and paid split
// can still hand it over.
const SOURCE_CLASSES: ReadonlySet<string> = new Set<ArrivalClass>([
  'ad_google_grant', 'ad_google_paid', 'ad_google', 'ad_reddit', 'search',
  'assistant', 'edu', 'mail', 'messenger', 'code', 'news', 'wiki', 'directory',
  'reddit', 'social', 'referral', 'direct',
]);

let arrival: ArrivalClass | undefined;

/** The class of this page load when it opened the visit, else undefined. */
function ownLandingClass(): SourceClass | undefined {
  const referrer = document.referrer;
  if (referrer) {
    try {
      if (new URL(referrer).host === window.location.host) return undefined;
    } catch {
      return undefined;
    }
  }
  return sourceClass(window.location.href, referrer);
}

/**
 * Read #src=<class> off the address and remove it; without one, take the class
 * of this page load when the app was the landing. Call once at boot, before
 * anything rewrites the address.
 */
export function captureArrivalSourceFromUrl(): void {
  try {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.length > 1 ? hash.slice(1) : '');
    const value = params.get('src');
    if (value === null) {
      arrival = ownLandingClass();
      return;
    }
    if (SOURCE_CLASSES.has(value)) arrival = value as ArrivalClass;
    params.delete('src');
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search + (rest ? `#${rest}` : '')
    );
  } catch {
    // history or URL unavailable: the counts go without a class
  }
}

/** The class this visit came in with, or undefined. */
export function arrivalSource(): ArrivalClass | undefined {
  return arrival;
}
