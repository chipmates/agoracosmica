// The app's page beacon and its paid-arrival counter: a paid landing URL
// counts when it was navigated to, not when it was reloaded or restored.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let pages: Record<string, unknown>[] = [];
let funnel: Record<string, unknown>[] = [];

function setNavigation(type: string | null): void {
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    writable: true,
    value: (kind: string) => (kind === 'navigation' && type ? [{ type }] : []),
  });
}

async function loadAt(url: string): Promise<void> {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const { sendPageBeacon } = await import('../../utils/pageBeacon');
  sendPageBeacon();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  pages = [];
  funnel = [];
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', (url: string, init: { body: string }) => {
    (String(url).endsWith('/v1/funnel') ? funnel : pages).push(JSON.parse(init.body));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((text) => {
        (String(url).endsWith('/v1/funnel') ? funnel : pages).push(JSON.parse(text));
      });
      return true;
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'sendBeacon');
  Reflect.deleteProperty(performance, 'getEntriesByType');
  window.history.replaceState({}, '', '/');
});

describe('the page beacon: paid arrivals', () => {
  const paid = () => funnel.filter((row) => row.step === 'paid_arrival');

  it('counts a navigation to a paid URL', async () => {
    setNavigation('navigate');
    await loadAt('/app?p=1');
    expect(pages).toHaveLength(1);
    expect(paid()).toHaveLength(1);
  });

  it('does not count a reload or a restored tab, and still counts the page', async () => {
    for (const type of ['reload', 'back_forward']) {
      setNavigation(type);
      await loadAt('/app?p=1');
    }
    expect(pages).toHaveLength(2);
    expect(paid()).toHaveLength(0);
  });

  it('counts as before when there is no navigation entry to read', async () => {
    setNavigation(null);
    await loadAt('/app?p=1');
    expect(paid()).toHaveLength(1);
  });

  it('stores nothing either way', async () => {
    setNavigation('reload');
    await loadAt('/app?p=1');
    setNavigation('navigate');
    await loadAt('/app?p=1');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
