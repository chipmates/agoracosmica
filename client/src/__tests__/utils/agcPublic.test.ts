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
