// The landing's source class, carried into the app by the public page the
// visitor landed on: its door links end in #src=<class> (agc-public.js). A
// fragment never travels with a request, and the app reads it once at boot,
// removes it from the address and holds the class in memory for the entry and
// first-chat counts. Nothing is stored.

import type { SourceClass } from './sourceClass';

// Same closed list as the worker's SOURCE_CLASSES (utils/analytics.ts there).
const SOURCE_CLASSES: ReadonlySet<string> = new Set<SourceClass>([
  'ad_google', 'ad_reddit', 'search', 'assistant', 'edu', 'mail', 'messenger',
  'code', 'news', 'wiki', 'directory', 'reddit', 'social', 'referral', 'direct',
]);

let arrival: SourceClass | undefined;

/** Read #src=<class> off the address and remove it. Call once at boot. */
export function captureArrivalSourceFromUrl(): void {
  try {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    const value = params.get('src');
    if (value === null) return;
    if (SOURCE_CLASSES.has(value)) arrival = value as SourceClass;
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
export function arrivalSource(): SourceClass | undefined {
  return arrival;
}
