// The app's counts and conversions go to the production worker, so a build
// posts them only from a page served on the production site: a local build, a
// preview or a copy of the app hosted elsewhere sends nothing. Same hosts as
// PRODUCTION_HOSTS in marketing/public/agc-public.js.
// File name stays free of ad-tech words: the public pages' islands reach it
// through gclidCapture.ts (client/scripts/check-asset-names.mjs).

export const PRODUCTION_HOSTS: readonly string[] = ['agoracosmica.org', 'www.agoracosmica.org'];

/** Is this page served from the production site? Read on every call: no state. */
export function onProductionHost(): boolean {
  try {
    return typeof window !== 'undefined' && PRODUCTION_HOSTS.includes(window.location.hostname);
  } catch {
    return false;
  }
}

// An absolute address on our domain is the production worker. An empty or
// relative one stays on the page's own server.
function reachesProductionWorker(base: string): boolean {
  try {
    const host = new URL(base).hostname;
    return host === 'agoracosmica.org' || host.endsWith('.agoracosmica.org');
  } catch {
    return false;
  }
}

/**
 * May a count or a conversion addressed to `base` leave this page? A build
 * posts only from the production site. The dev server may also post to a
 * worker of its own, which the end-to-end suites read; never to production.
 */
export function mayPostTo(base: string): boolean {
  if (onProductionHost()) return true;
  return import.meta.env.DEV === true && !reachesProductionWorker(base);
}
