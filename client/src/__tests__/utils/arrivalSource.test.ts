// The landing's source class: read from the door link's fragment at boot,
// removed from the address at once, held in memory, and sent with the entry,
// first-chat and real-use counts only. Without a fragment, the class of the
// app's own page load when that load opened the visit.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true });
}

/** A page of our own as the referrer: the app was opened from the site. */
function fromOurSite(): void {
  setReferrer(`${window.location.origin}/figures/seneca/`);
}

async function bootAt(url: string) {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const mod = await import('../../utils/arrivalSource');
  mod.captureArrivalSourceFromUrl();
  return mod;
}

function workerClasses(): string[] {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(dir, 'workers/llm-proxy/src/utils/analytics.ts');
    if (existsSync(candidate)) {
      const src = readFileSync(candidate, 'utf8');
      const block = /SOURCE_CLASSES = new Set\(\[([\s\S]*?)\]\)/.exec(src)![1];
      return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    }
    dir = resolve(dir, '..');
  }
  throw new Error('worker analytics.ts not found');
}

describe('arrivalSource', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    setReferrer('');
  });

  it('reads the class and strips the fragment, keeping path and query', async () => {
    const m = await bootAt('/app?figure=seneca&lang=en#src=search');
    expect(m.arrivalSource()).toBe('search');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/app?figure=seneca&lang=en');
  });

  it('strips an unlisted value without keeping it', async () => {
    const m = await bootAt('/app#src=https%3A%2F%2Fexample.com');
    expect(m.arrivalSource()).toBeUndefined();
    expect(window.location.hash).toBe('');
  });

  it('leaves any other fragment alone', async () => {
    fromOurSite();
    let m = await bootAt('/app#section-2');
    expect(m.arrivalSource()).toBeUndefined();
    expect(window.location.hash).toBe('#section-2');
    m = await bootAt('/app#other=1&src=mail');
    expect(m.arrivalSource()).toBe('mail');
    expect(window.location.hash).toBe('#other=1');
  });

  it('writes nothing to storage', async () => {
    sessionStorage.clear();
    localStorage.clear();
    await bootAt('/app#src=wiki');
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('accepts exactly the worker list', async () => {
    const list = workerClasses();
    expect(list.length).toBe(17);
    expect(list).toEqual(expect.arrayContaining(['ad_google_grant', 'ad_google_paid', 'ad_google']));
    for (const value of list) {
      const m = await bootAt(`/app#src=${value}`);
      expect(m.arrivalSource()).toBe(value);
    }
  });

  it('still takes the shared Google value from a page loaded before the split', async () => {
    fromOurSite();
    const m = await bootAt('/app?lang=en#src=ad_google');
    expect(m.arrivalSource()).toBe('ad_google');
    expect(window.location.hash).toBe('');
  });
});

describe('arrivalSource when the app opened the visit', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    setReferrer('');
  });

  it('is direct for an app opened with no referrer', async () => {
    const m = await bootAt('/app?lang=en');
    expect(m.arrivalSource()).toBe('direct');
  });

  it('takes the class of another site the app was opened from', async () => {
    setReferrer('https://www.google.de/');
    expect((await bootAt('/app')).arrivalSource()).toBe('search');
    setReferrer('https://museumofages.org/');
    expect((await bootAt('/app?lang=de')).arrivalSource()).toBe('referral');
  });

  it('splits grant and paid on an app landing too', async () => {
    setReferrer('https://www.google.com/');
    expect((await bootAt('/app?gclid=TESTCLICKID0001')).arrivalSource()).toBe('ad_google_grant');
    expect((await bootAt('/app?p=1')).arrivalSource()).toBe('ad_google_paid');
    expect((await bootAt('/app?p=1&utm_source=reddit')).arrivalSource()).toBe('ad_reddit');
  });

  it('lets the door fragment win over the page load', async () => {
    setReferrer('https://www.google.com/');
    const m = await bootAt('/app#src=mail');
    expect(m.arrivalSource()).toBe('mail');
  });

  it('has none for an app opened from our own pages without a fragment', async () => {
    fromOurSite();
    const m = await bootAt('/app?p=1');
    expect(m.arrivalSource()).toBeUndefined();
  });

  it('writes nothing to storage and leaves the address as it was', async () => {
    sessionStorage.clear();
    localStorage.clear();
    setReferrer('https://duckduckgo.com/');
    await bootAt('/app?figure=seneca#section-2');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/app?figure=seneca#section-2');
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });
});

describe('the counts that carry it', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
    window.history.replaceState({}, '', '/');
    setReferrer('');
  });

  it('goes with entry, the first-chat and the real-use steps, and with nothing else', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    global.fetch = fetchMock as unknown as typeof fetch;
    await bootAt('/app?lang=en#src=assistant');
    const { sendEntryBeacon } = await import('../../utils/entryBeacon');
    const funnel = await import('../../utils/funnelBeacon');
    sendEntryBeacon();
    funnel.sendFunnelBeaconOnce('first_turn', { figureId: 'aurelius', mode: 'free_conversation' });
    funnel.sendFunnelBeaconOnce('first_turn_prefilled', { figureId: 'aurelius' });
    funnel.sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });
    funnel.sendFunnelBeaconOnce('welcome_shown', { mode: 'figure' });
    const entry = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(entry.source).toBe('assistant');
    const bodies = await Promise.all(sendBeacon.mock.calls.map(async (c) => JSON.parse(await (c[1] as Blob).text())));
    const byStep = Object.fromEntries(bodies.map((b) => [b.step, b.source]));
    expect(byStep.first_turn).toBe('assistant');
    expect(byStep.first_turn_prefilled).toBe('assistant');
    expect(byStep.figure_selected).toBeUndefined();
    expect(byStep.welcome_shown).toBeUndefined();
    expect(byStep.engaged).toBe('assistant');
    funnel.noteCouncilHeardMilestone();
    const calls = sendBeacon.mock.calls;
    const heard = JSON.parse(await (calls[calls.length - 1][1] as Blob).text());
    expect(heard.step).toBe('council_heard');
    expect(heard.source).toBe('assistant');
  });

  it('is absent when the visit came in from our pages without a class', async () => {
    fromOurSite();
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    global.fetch = fetchMock as unknown as typeof fetch;
    await bootAt('/app?lang=en');
    const { sendEntryBeacon } = await import('../../utils/entryBeacon');
    sendEntryBeacon();
    expect('source' in JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toBe(false);
  });
});
