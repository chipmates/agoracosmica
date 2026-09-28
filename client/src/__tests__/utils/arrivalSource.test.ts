// The landing's source class: read from the door link's fragment at boot,
// removed from the address at once, held in memory, and sent with the entry
// and first-chat counts only.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  afterEach(() => window.history.replaceState({}, '', '/'));

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
    expect(list.length).toBe(15);
    for (const value of list) {
      const m = await bootAt(`/app#src=${value}`);
      expect(m.arrivalSource()).toBe(value);
    }
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
  });

  it('goes with entry and the first-chat steps, and with nothing else', async () => {
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
    expect(byStep.engaged).toBeUndefined();
  });

  it('is absent when the visit came in without a class', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    global.fetch = fetchMock as unknown as typeof fetch;
    await bootAt('/app?lang=en');
    const { sendEntryBeacon } = await import('../../utils/entryBeacon');
    sendEntryBeacon();
    expect('source' in JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toBe(false);
  });
});
