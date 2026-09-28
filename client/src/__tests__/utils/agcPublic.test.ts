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
  const YES = JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() });
  const conversions = () => fetches.filter((f) => f.url.endsWith('/api/conversions'));

  it('stores nothing on a grant landing without an answer', () => {
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
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

describe('agc-public.js: the 12-month memory', () => {
  const CLICK = 'TESTCLICKID0001';
  const DAY = 24 * 60 * 60 * 1000;
  it('stores no click ID under a yes older than a year', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() - 366 * DAY }));
    loadPage(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
  it('stores it under a yes younger than a year', () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() - 300 * DAY }));
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

  it('marks a door an island renders later, when it is used', () => {
    setReferrer('https://chatgpt.com/');
    loadPage('/marcus-aurelius/');
    const late = door({}, '/app?figure=seneca&lang=en');
    click(late);
    expect(late.getAttribute('href')).toBe('/app?figure=seneca&lang=en#src=assistant');
  });
});
