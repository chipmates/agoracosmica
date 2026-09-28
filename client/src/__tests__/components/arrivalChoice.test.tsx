// The consent card on the public pages, rendered: when it shows, what each
// answer stores and sends, and what a paid arrival gets (nothing at all).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const CLICK = 'TESTCLICKID0001';
const YES = JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() });

let sent: { url: string; body: Record<string, unknown> }[] = [];

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

async function mountAt(url: string, lang: 'en' | 'de' = 'en') {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<ArrivalChoice lang={lang} />);
  });
  return view;
}

beforeEach(() => {
  sent = [];
  sessionStorage.clear();
  localStorage.clear();
  global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as unknown as typeof fetch;
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((t) => sent.push({ url, body: JSON.parse(t) }));
      return true;
    }),
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'sendBeacon');
  window.history.replaceState({}, '', '/');
});

const conversions = () => sent.filter((s) => s.url.endsWith('/api/conversions'));

describe('ArrivalChoice', () => {
  it('shows on a grant landing and stores nothing before the answer', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).not.toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('yes stores the click ID and the yes, and reports the yes with the click ID', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(true);
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.gclid).toBe(CLICK);
    expect(container.querySelector('.agc-consent')).toBeNull();
    const counts = sent.filter((s) => s.url.endsWith('/v1/funnel'));
    expect(counts.map((c) => c.body.step)).toContain('ad_consent_accepted');
    for (const c of counts) expect(JSON.stringify(c.body)).not.toContain(CLICK);
    expect(storageKeys(sessionStorage).filter((k) => k.startsWith('agc_funnel_fired_'))).toEqual([]);
  });

  it('no stores only the no and sends no conversion', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const [, no] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(no); });
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual(['agc_ad_consent']);
    expect(conversions()).toHaveLength(0);
  });

  it('never shows on a paid arrival, even with an old yes and an old click ID stored', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('never shows on a paid arrival without any answer on record', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`, 'de');
    expect(container.querySelector('.agc-consent')).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('does not show on the next page of the visit', async () => {
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const { container } = await mountAt('/seneca/');
    expect(container.querySelector('.agc-consent')).toBeNull();
  });
});

describe('heard seconds', () => {
  async function loadHeard(url: string) {
    window.history.replaceState({}, '', url);
    vi.resetModules();
    const capture = await import('@client/utils/public/gclidCapture');
    const heard = await import('../../../../marketing/src/utils/heardSeconds');
    return { capture, heard };
  }

  it('counts and writes nothing without a yes, and reads nothing either', async () => {
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1);
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain('agc_listened_seconds');
    getItem.mockRestore();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('counts after a yes and sends listened once at 30 seconds', async () => {
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    capture.grantAdConsent();
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1, 'aurelius');
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.event).toBe('listened');
    expect(Number(sessionStorage.getItem('agc_listened_seconds'))).toBeGreaterThanOrEqual(30);
  });

  it('counts nothing on a paid arrival with an old yes', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { capture, heard } = await loadHeard(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });
});

describe('ArrivalChoice after a year', () => {
  it('asks again when the stored answer is older than 365 days', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.0.0', timestamp: Date.now() - 366 * 86_400_000 }));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).not.toBeNull();
  });
  it('does not ask within the year', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.0.0', timestamp: Date.now() - 100 * 86_400_000 }));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(container.querySelector('.agc-consent')).toBeNull();
  });
});
