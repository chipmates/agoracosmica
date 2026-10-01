// The public pages' script, run whole in jsdom: what it stores, what it sends.
// Every run is a fresh page load of the shipped file; the listeners it adds are
// taken down after each case so one page's clicks never reach another's script.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const SCRIPT_REL = 'marketing/public/agc-public.js';

function scriptPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(dir, SCRIPT_REL);
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, '..');
  }
  throw new Error(`${SCRIPT_REL} not found above ${process.cwd()}`);
}

const SOURCE = readFileSync(scriptPath(), 'utf8');

type Listener = [EventTarget, string, EventListenerOrEventListenerObject, unknown];
let added: Listener[] = [];
let beacons: { url: string; body: Record<string, unknown> }[] = [];
let fetches: { url: string; body: Record<string, unknown> }[] = [];

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

async function drainBeacons(): Promise<void> {
  await Promise.resolve();
}

/** Load the script as a fresh page at `url` (path plus query plus hash). */
function loadPage(url: string, lang = 'en'): void {
  window.history.replaceState({}, '', url);
  document.documentElement.lang = lang;
  for (const target of [document, window] as EventTarget[]) {
    const real = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, fn, opts) => {
      added.push([target, type, fn as EventListenerOrEventListenerObject, opts]);
      real(type, fn as EventListenerOrEventListenerObject, opts as AddEventListenerOptions);
    });
  }
  new Function(SOURCE)();
  vi.mocked(document.addEventListener).mockRestore();
  vi.mocked(window.addEventListener).mockRestore();
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function door(attrs: Record<string, string>, href = '/app/'): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.addEventListener('click', (e) => e.preventDefault());
  document.body.appendChild(a);
  return a;
}

/** The browser's navigation entry for the next page load, or none at all (null). */
function setNavigation(type: string | null): void {
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true,
    writable: true,
    value: (kind: string) => (kind === 'navigation' && type ? [{ type }] : []),
  });
}

beforeEach(() => {
  added = [];
  beacons = [];
  fetches = [];
  sessionStorage.clear();
  localStorage.clear();
  document.body.innerHTML = '';
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((text) => beacons.push({ url, body: JSON.parse(text) }));
      return true;
    }),
  });
  global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    fetches.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as unknown as typeof fetch;
});

afterEach(() => {
  for (const [target, type, fn, opts] of added) {
    target.removeEventListener(type, fn, opts as EventListenerOptions);
  }
  Reflect.deleteProperty(navigator, 'sendBeacon');
  Reflect.deleteProperty(performance, 'getEntriesByType');
  window.history.replaceState({}, '', '/');
});

describe('agc-public.js: counting stores nothing', () => {
  it('sends cta_click once per page load and writes no flag', async () => {
    loadPage('/marcus-aurelius/');
    const cta = door({ 'data-agc-cta': 'start-exploring', 'data-agc-door': 'hero' });
    click(cta);
    click(cta);
    await drainBeacons();
    await new Promise((r) => setTimeout(r, 0));
    const ctaRows = beacons.filter((b) => b.body.step === 'cta_click');
    expect(ctaRows).toHaveLength(1);
    expect(ctaRows[0].body.mode).toBe('hero');
    expect(storageKeys(sessionStorage).filter((k) => k.startsWith('agc_funnel_fired_'))).toEqual([]);
  });

  it('counts again on the next page load, since nothing is remembered', async () => {
    loadPage('/marcus-aurelius/');
    click(door({ 'data-agc-cta': 'start-exploring' }));
    for (const [target, type, fn, opts] of added) target.removeEventListener(type, fn, opts as EventListenerOptions);
    added = [];
    document.body.innerHTML = '';
    loadPage('/seneca/');
    click(door({ 'data-agc-cta': 'start-exploring' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(beacons.filter((b) => b.body.step === 'cta_click')).toHaveLength(2);
  });
});

describe('agc-public.js: the ad click ID', () => {
  const CLICK = 'TESTCLICKID0001';
  const YES = JSON.stringify({ granted: true, version: '1.2.0', timestamp: Date.now() });
  const conversions = () => fetches.filter((f) => f.url.endsWith('/api/conversions'));

  it('stores nothing on a grant landing without an answer', () => {
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('looks up no click ID on a CTA click without a yes', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    click(door({ 'data-agc-cta': 'start-exploring' }));
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain('agc_gclid');
    expect(conversions()).toHaveLength(0);
    getItem.mockRestore();
  });

  it('stores the click ID when a yes is on record, and the CTA reports it', () => {
    localStorage.setItem('agc_ad_consent', YES);
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    click(door({ 'data-agc-cta': 'start-exploring', 'data-agc-figure': 'aurelius' }));
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.gclid).toBe(CLICK);
    expect(conversions()[0].body.event).toBe('start_exploring');
  });

  it('on a paid landing drops an old click ID despite an old yes, and sends nothing', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    loadPage(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
    click(door({ 'data-agc-cta': 'start-exploring' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(conversions()).toHaveLength(0);
    const paid = beacons.filter((b) => b.body.step === 'paid_arrival');
    expect(paid).toHaveLength(1);
    expect(JSON.stringify(paid[0].body)).not.toContain(CLICK);
    expect(storageKeys(sessionStorage)).not.toContain('agc_paid');
    expect(storageKeys(localStorage)).not.toContain('agc_paid');
  });

  it('never puts a click ID in any count', async () => {
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    click(door({ 'data-agc-cta': 'start-exploring' }));
    await new Promise((r) => setTimeout(r, 0));
    const counts = [...beacons, ...fetches.filter((f) => !f.url.endsWith('/api/conversions'))];
    expect(counts.length).toBeGreaterThan(0);
    for (const c of counts) expect(JSON.stringify(c.body)).not.toContain(CLICK);
  });
});

describe('agc-public.js: a paid arrival is a fresh navigation', () => {
  const paidRows = () => beacons.filter((b) => b.body.step === 'paid_arrival');

  it('counts a navigation to a paid landing URL once', async () => {
    setNavigation('navigate');
    loadPage('/marcus-aurelius/?p=1&gclid=TESTCLICKID0001', 'de');
    await new Promise((r) => setTimeout(r, 0));
    expect(paidRows()).toHaveLength(1);
    expect(paidRows()[0].body).toEqual({ step: 'paid_arrival', language: 'de' });
  });

  it('does not count a reload, a restored tab or a prerender of the same URL', async () => {
    for (const type of ['reload', 'back_forward', 'prerender']) {
      setNavigation(type);
      loadPage('/marcus-aurelius/?p=1&gclid=TESTCLICKID0001');
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(paidRows()).toHaveLength(0);
    // The page itself is still counted, and the click ID is still dropped.
    expect(fetches.filter((f) => f.url.endsWith('/v1/page'))).toHaveLength(3);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('counts as before when the browser has no navigation entry', async () => {
    setNavigation(null);
    loadPage('/marcus-aurelius/?p=1');
    await new Promise((r) => setTimeout(r, 0));
    expect(paidRows()).toHaveLength(1);
  });

  it('never counts a page without the paid parameter', async () => {
    setNavigation('navigate');
    loadPage('/marcus-aurelius/?gclid=TESTCLICKID0001');
    await new Promise((r) => setTimeout(r, 0));
    expect(paidRows()).toHaveLength(0);
  });
});

describe('agc-public.js: the read counter', () => {
  const VIEWPORT = 800;
  let visibility: 'visible' | 'hidden' = 'visible';

  /** A reading page whose main content is `height` px tall, starting at the top. */
  function readingPage(height: number, marked = true): void {
    const main = document.createElement('main');
    if (marked) main.setAttribute('data-agc-read', '');
    main.getBoundingClientRect = () =>
      ({ top: -window.scrollY, height, bottom: height - window.scrollY }) as DOMRect;
    document.body.appendChild(main);
  }
  function scrollTo(y: number): void {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
    window.dispatchEvent(new Event('scroll'));
  }
  function setVisibility(state: 'visible' | 'hidden'): void {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  }
  // The recorded bodies land a tick late, so "nothing yet" is read off the
  // transport itself, which is called in the same tick as the count.
  const sentSoFar = () => vi.mocked(navigator.sendBeacon).mock.calls.length;
  /** Leave the fake clock and let the recorded beacons land. */
  async function reads(): Promise<Record<string, unknown>[]> {
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 0));
    return beacons.filter((b) => b.body.step === 'read').map((b) => b.body);
  }

  beforeEach(() => {
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    Object.defineProperty(window, 'innerHeight', { value: VIEWPORT, configurable: true, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('counts one read after thirty visible seconds, with the path and the language only', async () => {
    readingPage(4000);
    loadPage('/figures/rumi/poems/?utm_source=x#top', 'de');
    vi.advanceTimersByTime(29_000);
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(sentSoFar()).toBe(1);
    vi.advanceTimersByTime(120_000);
    expect(sentSoFar()).toBe(1);
    const rows = await reads();
    expect(rows).toEqual([{ step: 'read', path: '/figures/rumi/poems/', language: 'de' }]);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('counts on a scroll past the middle of the main content, and only once', async () => {
    readingPage(4000); // middle at 2000
    loadPage('/themes/moral-life/');
    scrollTo(1100); // viewport bottom at 1900
    vi.advanceTimersByTime(1_000);
    expect(sentSoFar()).toBe(0);
    scrollTo(1250); // viewport bottom at 2050
    expect(sentSoFar()).toBe(1);
    scrollTo(3000);
    vi.advanceTimersByTime(60_000);
    expect(await reads()).toEqual([{ step: 'read', path: '/themes/moral-life/', language: 'en' }]);
  });

  it('does not take a scroll on a page whose middle is on the first screen', async () => {
    readingPage(1200); // middle at 600, already in view
    loadPage('/figures/william-blake/poems/the-tyger/');
    scrollTo(300);
    vi.advanceTimersByTime(29_000);
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(await reads()).toHaveLength(1);
  });

  it('counts nothing while the tab is in the background', async () => {
    visibility = 'hidden';
    readingPage(4000);
    loadPage('/figures/marcus-aurelius/meditations/');
    scrollTo(3000);
    vi.advanceTimersByTime(300_000);
    expect(sentSoFar()).toBe(0);
    setVisibility('visible');
    vi.advanceTimersByTime(29_000);
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(await reads()).toHaveLength(1);
  });

  it('adds up visible stretches and leaves the hidden ones out', async () => {
    readingPage(4000);
    loadPage('/figures/marcus-aurelius/');
    vi.advanceTimersByTime(20_000);
    setVisibility('hidden');
    vi.advanceTimersByTime(600_000);
    setVisibility('visible');
    vi.advanceTimersByTime(9_000);
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(await reads()).toHaveLength(1);
  });

  it('takes no scroll on a reload, a restored tab or an address with an anchor', async () => {
    for (const [type, url] of [['reload', '/themes/moral-life/'], ['back_forward', '/themes/moral-life/'], ['navigate', '/themes/moral-life/#debate']]) {
      setNavigation(type);
      readingPage(4000);
      loadPage(url);
      scrollTo(3000);
    }
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(29_000);
    expect(sentSoFar()).toBe(0);
    vi.advanceTimersByTime(1_000);
    // Three page loads, each counted by its own clock.
    expect(await reads()).toHaveLength(3);
  });

  it('stays silent on a page the layout has not marked for reading', async () => {
    readingPage(4000, false);
    loadPage('/about/');
    scrollTo(3000);
    vi.advanceTimersByTime(120_000);
    expect(await reads()).toEqual([]);
  });

  it('carries the probe constant from a marked browser', async () => {
    readingPage(4000);
    loadPage('/figures/rumi/poems/?probe=1');
    vi.advanceTimersByTime(30_000);
    expect(await reads()).toEqual([{ step: 'read', path: '/figures/rumi/poems/', language: 'en', probe: 1 }]);
  });
});

describe('agc-public.js: the audio play counter', () => {
  function audioInPage(): HTMLAudioElement {
    const audio = document.createElement('audio');
    document.body.appendChild(audio);
    return audio;
  }
  // Media events do not bubble: only a capture-phase listener sees them.
  const fire = (el: EventTarget, type: string) => el.dispatchEvent(new Event(type));
  const sentSoFar = () => vi.mocked(navigator.sendBeacon).mock.calls.length;
  async function plays(): Promise<Record<string, unknown>[]> {
    await new Promise((r) => setTimeout(r, 0));
    return beacons.filter((b) => b.body.step === 'audio_play').map((b) => b.body);
  }

  it('counts the first play of an audio element in the page, once per page load', async () => {
    const first = audioInPage();
    const second = audioInPage();
    loadPage('/figures/emily-dickinson/poems/?utm_source=x#theme-hope');
    fire(first, 'playing');
    fire(first, 'pause');
    fire(first, 'playing');
    fire(second, 'playing');
    expect(await plays()).toEqual([
      { step: 'audio_play', path: '/figures/emily-dickinson/poems/', language: 'en' },
    ]);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('waits for sound: a play that never starts counts nothing', async () => {
    const audio = audioInPage();
    loadPage('/de/', 'de');
    fire(audio, 'play');
    fire(audio, 'waiting');
    fire(audio, 'error');
    expect(sentSoFar()).toBe(0);
    fire(audio, 'playing');
    expect(await plays()).toEqual([{ step: 'audio_play', path: '/de/', language: 'de' }]);
  });

  it('does not see a player that keeps its audio outside the document', async () => {
    loadPage('/figures/marcus-aurelius/');
    fire(new Audio(), 'playing');
    expect(sentSoFar()).toBe(0);
    expect(await plays()).toEqual([]);
  });

  it('leaves a video alone, and still counts the audio after it', async () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    const audio = audioInPage();
    loadPage('/');
    fire(video, 'playing');
    expect(sentSoFar()).toBe(0);
    fire(audio, 'playing');
    expect(await plays()).toHaveLength(1);
  });

  it('carries the probe constant from a marked browser', async () => {
    const audio = audioInPage();
    loadPage('/figures/emily-dickinson/poems/?probe=1');
    fire(audio, 'playing');
    expect(await plays()).toEqual([
      { step: 'audio_play', path: '/figures/emily-dickinson/poems/', language: 'en', probe: 1 },
    ]);
  });
});

describe('agc-public.js: the 12-month memory', () => {
  const CLICK = 'TESTCLICKID0001';
  const DAY = 24 * 60 * 60 * 1000;
  it('stores no click ID under a yes older than a year', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.2.0', timestamp: Date.now() - 366 * DAY }));
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
  it('stores no click ID under a yes given to the earlier card text', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.1.0', timestamp: Date.now() }));
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
  it('stores it under a yes younger than a year', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.2.0', timestamp: Date.now() - 300 * DAY }));
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
  });
});

describe('agc-public.js: the source class on the app doors', () => {
  function setReferrer(value: string) {
    Object.defineProperty(document, 'referrer', { value, configurable: true });
  }
  afterEach(() => setReferrer(''));

  it('marks the app doors of a landing page with the class, and nothing else', () => {
    setReferrer('https://www.google.de/');
    const a = door({}, '/app?figure=marcus-aurelius&lang=en');
    const b = door({}, '/app/');
    const own = door({}, '/app?lang=en#already');
    const other = door({}, '/figures/seneca/');
    const outside = door({}, 'https://github.com/chipmates/agoracosmica');
    loadPage('/marcus-aurelius/');
    expect(a.getAttribute('href')).toBe('/app?figure=marcus-aurelius&lang=en#src=search');
    expect(b.getAttribute('href')).toBe('/app/#src=search');
    expect(own.getAttribute('href')).toBe('/app?lang=en#already');
    expect(other.getAttribute('href')).toBe('/figures/seneca/');
    expect(outside.getAttribute('href')).toBe('https://github.com/chipmates/agoracosmica');
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('marks direct arrivals as direct', () => {
    const a = door({}, '/app?lang=de');
    loadPage('/de/');
    expect(a.getAttribute('href')).toBe('/app?lang=de#src=direct');
  });

  it('leaves the doors alone on a page reached from our own site', () => {
    setReferrer(`${window.location.origin}/figures/`);
    const a = door({}, '/app?lang=en');
    loadPage('/marcus-aurelius/');
    expect(a.getAttribute('href')).toBe('/app?lang=en');
  });

  it('still counts a reload after the card\'s answer as an ad arrival', async () => {
    // The card leaves an empty gclid key in the address: no click ID, the class kept.
    setReferrer('https://www.google.com/');
    const a = door({}, '/app?figure=marcus-aurelius&lang=en');
    loadPage('/marcus-aurelius/?gclid=');
    const page = fetches.find((f) => f.url.endsWith('/v1/page'))!;
    expect(page.body.source).toBe('ad_google');
    expect(page.body.landing).toBe(1);
    expect(a.getAttribute('href')).toBe('/app?figure=marcus-aurelius&lang=en#src=ad_google');
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('marks a door an island renders later, when it is used', () => {
    setReferrer('https://chatgpt.com/');
    loadPage('/marcus-aurelius/');
    const late = door({}, '/app?figure=seneca&lang=en');
    click(late);
    expect(late.getAttribute('href')).toBe('/app?figure=seneca&lang=en#src=assistant');
  });
});

describe('agc-public.js: an answer under the earlier card text', () => {
  it('stores no click ID under a 1.0.0 yes', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() }));
    loadPage('/marcus-aurelius/?gclid=TESTCLICKID0001');
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
});
