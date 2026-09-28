// The ad click ID: held in page memory until the visitor answers, stored only
// after a yes, never kept or sent for a paid arrival (?p=1), and nothing about
// a paid visit is written anywhere.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CLICK = 'TESTCLICKID0001';
const OLD_CLICK = 'OLDCLICKID00001';
const YES = { granted: true, version: '1.0.0', timestamp: Date.now() };
const NO = { granted: false, version: '1.0.0', timestamp: Date.now() };

type Capture = typeof import('../../utils/public/gclidCapture');

async function loadAt(url: string): Promise<Capture> {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  return import('../../utils/public/gclidCapture');
}

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('a grant landing without an answer', () => {
  it('holds the click ID in memory for the question and stores nothing', async () => {
    const m = await loadAt(`/marcus-aurelius/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    expect(m.getGclid()).toBe(CLICK);
    expect(m.isPaidVisitor()).toBe(false);
    expect(m.adConsentDecided()).toBe(false);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('sends nothing before the answer', async () => {
    const m = await loadAt(`/marcus-aurelius/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    await m.sendConversion('start_exploring');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a yes stores the click ID and the answer, and steps are sent with it', async () => {
    const m = await loadAt(`/marcus-aurelius/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    m.grantAdConsent();
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(true);
    await m.sendConversion('dialogue_started');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).gclid).toBe(CLICK);
  });

  it('a no stores only the no and drops the click ID', async () => {
    const m = await loadAt(`/marcus-aurelius/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    m.revokeAdConsent();
    expect(m.getGclid()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual(['agc_ad_consent']);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(false);
  });

  it('a stored no keeps the click ID out of memory too', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(NO));
    const m = await loadAt(`/marcus-aurelius/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    expect(m.getGclid()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

describe('a stored yes', () => {
  it('stores the click ID of a later grant arrival at once', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    const m = await loadAt(`/seneca/?gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
  });

  it('picks the stored click ID up on a later page of the tab', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    sessionStorage.setItem('agc_gclid', CLICK);
    const m = await loadAt('/app/');
    m.captureGclid();
    expect(m.getGclid()).toBe(CLICK);
  });

  it('a stored click ID whose yes is gone is dropped at load', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(NO));
    sessionStorage.setItem('agc_gclid', CLICK);
    const m = await loadAt('/app/');
    expect(m.getGclid()).toBeNull();
    expect(sessionStorage.getItem('agc_gclid')).toBeNull();
  });
});

describe('the app, which has no question', () => {
  it('drops a click ID when no yes is on record', async () => {
    const m = await loadAt(`/app/?gclid=${CLICK}`);
    m.captureGclid();
    expect(m.getGclid()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('keeps it when a yes is on record', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    const m = await loadAt(`/app/?gclid=${CLICK}`);
    m.captureGclid();
    expect(m.getGclid()).toBe(CLICK);
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
  });
});

describe('a paid arrival (?p=1)', () => {
  it('keeps no click ID and stores nothing, with no answer on record', async () => {
    const m = await loadAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    expect(m.isPaidVisitor()).toBe(true);
    expect(m.getGclid()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('drops an old stored click ID even when an old yes is stored, before anyone asks', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    sessionStorage.setItem('agc_gclid', OLD_CLICK);
    const m = await loadAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    // Module load alone, before captureGclid: no importer can see a click ID.
    expect(m.getGclid()).toBeNull();
    expect(sessionStorage.getItem('agc_gclid')).toBeNull();
    m.captureGclid({ holdUntilAnswer: true });
    expect(m.getGclid()).toBeNull();
    await m.sendConversion('start_exploring');
    await m.sendConversion('listened');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('keeps nothing on a later page of the visit either', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    const landing = await loadAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    landing.captureGclid({ holdUntilAnswer: true });
    const later = await loadAt('/seneca/');
    later.captureGclid({ holdUntilAnswer: true });
    expect(later.getGclid()).toBeNull();
    await later.sendConversion('dialogue_started');
    const app = await loadAt('/app/');
    app.captureGclid();
    await app.sendConversion('profile_created');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('never writes a paid marker anywhere', async () => {
    const m = await loadAt(`/?p=1&gclid=${CLICK}`);
    m.captureGclid({ holdUntilAnswer: true });
    expect(storageKeys(sessionStorage)).not.toContain('agc_paid');
    expect(storageKeys(localStorage)).not.toContain('agc_paid');
  });
});

describe('withdrawal', () => {
  it('clears the click ID, the step markers and the listening seconds, and records the no', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify(YES));
    sessionStorage.setItem('agc_gclid', CLICK);
    sessionStorage.setItem('agc_conv_fired_start_exploring', '1');
    sessionStorage.setItem('agc_conv_fired_listened', '1');
    sessionStorage.setItem('agc_listened_seconds', '12.00');
    sessionStorage.setItem('agc_listened_pending', JSON.stringify({ event: 'listened', timestamp: 1 }));
    sessionStorage.setItem('agc_intended_figure', 'aurelius');
    const m = await loadAt('/seneca/');
    expect(m.getGclid()).toBe(CLICK);
    m.revokeAdConsent();
    expect(m.getGclid()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual(['agc_intended_figure']);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(false);
    await m.sendConversion('dialogue_started');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
