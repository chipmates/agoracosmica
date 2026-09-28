// The boot-time URL reader: what it stages, what it counts, and that the
// counting labels come from memory rather than from storage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const funnel = vi.hoisted(() => ({ sendFunnelBeaconOnce: vi.fn(), sendFunnelBeacon: vi.fn() }));
vi.mock('../../utils/funnelBeacon', () => funnel);

async function bootAt(url: string) {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const mod = await import('../../utils/public/entryIntent');
  mod.captureEntryIntentFromUrl();
  return mod;
}

describe('the welcome_shown class', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    funnel.sendFunnelBeaconOnce.mockClear();
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('comes from the landing URL', async () => {
    expect((await bootAt('/app?figure=marcus-aurelius&lang=de')).classifyEntryForFunnel()).toBe('figure');
    expect((await bootAt('/app?council=free-will&lang=en')).classifyEntryForFunnel()).toBe('council');
    expect((await bootAt('/app?figure=seneca&q=free-will&lang=en')).classifyEntryForFunnel()).toBe('council');
    expect((await bootAt('/app?ask=life&lang=en')).classifyEntryForFunnel()).toBe('ask');
    expect((await bootAt('/app?figure=seneca&mode=story&chapter=3')).classifyEntryForFunnel()).toBe('chapter');
    expect((await bootAt('/app?figure=seneca&mode=story&chapter=13')).classifyEntryForFunnel()).toBe('figure');
    expect((await bootAt('/app?lang=de')).classifyEntryForFunnel()).toBe('generic');
    expect((await bootAt('/app')).classifyEntryForFunnel()).toBe('generic');
  });

  it('reads no storage, even when an intent is staged there', async () => {
    const mod = await bootAt('/app?lang=en');
    sessionStorage.setItem('agc_intended_figure', 'aurelius');
    sessionStorage.setItem('agc_intended_council', 'free-will');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    expect(mod.classifyEntryForFunnel()).toBe('generic');
    expect(getItem).not.toHaveBeenCalled();
    getItem.mockRestore();
  });

  it('still stages the intent for routing', async () => {
    await bootAt('/app?figure=marcus-aurelius&lang=de');
    expect(sessionStorage.getItem('agc_intended_figure')).toBe('aurelius');
    expect(window.location.search).toBe('');
  });
});

describe('the homepage forward', () => {
  beforeEach(() => {
    funnel.sendFunnelBeaconOnce.mockClear();
    localStorage.clear();
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('counts nothing for an old forward URL and strips its marker', async () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const getItem = vi.mocked(localStorage.getItem);
    getItem.mockClear();
    await bootAt('/app/?entry=return&utm_source=x');
    expect(funnel.sendFunnelBeaconOnce).not.toHaveBeenCalled();
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain('agb_consent');
    expect(window.location.search).toBe('?utm_source=x');
  });
});
