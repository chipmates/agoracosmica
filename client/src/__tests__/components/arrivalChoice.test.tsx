// The consent card on the public pages, rendered: when it asks in each arm of
// the split (the later arm after a minute of story audio or at a poem's end,
// the arrival arm at once), what each answer stores and sends, what a paid
// arrival gets (nothing at all), that nothing about the ad is stored before the
// answer, and the counts that carry the arm. Most cases run the later arm.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

const CLICK = 'TESTCLICKID0001';
const YES = JSON.stringify({ granted: true, version: '1.3.0', timestamp: Date.now() });
const CONTROLLER = '../../../../marketing/src/player/controller';
const AD_KEYS = /^(agc_gclid|agc_listened_seconds|agc_listened_pending|agc_conv_fired_.*)$/;

let sent: { url: string; body: Record<string, unknown> }[] = [];
let clock = 1000;

// The islands post only from the production hosts, so the suite serves its
// pages from one; the last block moves it elsewhere on purpose.
function serveFrom(url: string): void {
  (globalThis as unknown as { jsdom: { reconfigure(o: { url: string }): void } }).jsdom.reconfigure({ url });
}

function storageKeys(store: Storage): string[] {
  return Array.from({ length: store.length }, (_, i) => store.key(i) as string);
}

// ---- a stand-in for the story player's state ------------------------------

interface FakeState {
  queue: { figureId: string; lang: string } | null;
  current: number | null;
  status: string;
  time: number;
  readerOpen: boolean;
}

function makePlayer() {
  let state: FakeState = { queue: null, current: null, status: 'idle', time: 0, readerOpen: false };
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    set(patch: Partial<FakeState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
  };
}

let player = makePlayer();
let heard: typeof import('../../../../marketing/src/utils/heardSeconds');

type Kind = 'story' | 'poem' | 'plain';

function pageFor(kind: Kind): void {
  document.body.innerHTML = '';
  if (kind === 'story') {
    const mount = document.createElement('div');
    mount.setAttribute('data-astro-transition-persist', 'story-dock');
    mount.className = 'story-dock-mount';
    document.body.appendChild(mount);
  }
  if (kind === 'poem') {
    // Four verse lines: a reading time of eight seconds.
    const text = document.createElement('div');
    text.className = 'pm-poem__text';
    text.innerHTML = '<div class="pm-poem__stanza">' +
      ['Hope is the thing', 'with feathers', 'that perches', 'in the soul'].map((l) => `<span class="pm-poem__line">${l}</span>`).join('') +
      '</div>';
    document.body.appendChild(text);
  }
}

/** Put the poem's last line at `top` in the viewport (null: not rendered). */
function placeLastLine(top: number | null): void {
  const lines = document.querySelectorAll('.pm-poem__line');
  const last = lines[lines.length - 1] as HTMLElement;
  last.getBoundingClientRect = () =>
    (top === null
      ? { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 }
      : { top, bottom: top + 30, left: 20, right: 300, width: 280, height: 30, x: 20, y: top }) as DOMRect;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** A fresh page load at `url`: the island's module runs anew. */
async function mountAt(url: string, lang: 'en' | 'de' = 'en', kind: Kind = 'story') {
  window.history.replaceState({}, '', url);
  document.documentElement.lang = lang;
  pageFor(kind);
  vi.resetModules();
  player = makePlayer();
  vi.doMock(CONTROLLER, () => ({ subscribe: player.subscribe, getState: player.getState }));
  heard = await import('../../../../marketing/src/utils/heardSeconds');
  const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<ArrivalChoice lang={lang} />);
  });
  await settle();
  return view;
}

/**
 * Story audio as the player reports it: the playhead moves in quarter seconds
 * while playing, and the player's own tracker feeds the shared seconds.
 */
async function hear(seconds: number, figureId = 'aurelius'): Promise<void> {
  await act(async () => {
    if (player.getState().current === null) {
      player.set({ queue: { figureId, lang: 'en' }, current: 1, status: 'playing', time: 0 });
    }
    player.set({ status: 'playing' });
    for (let i = 0; i < seconds * 4; i++) {
      player.set({ time: player.getState().time + 0.25 });
      heard.addHeardSeconds(0.25, figureId);
    }
  });
}

/** Wall time passing, nothing else. */
async function pass(ms: number): Promise<void> {
  clock += ms;
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
  });
}

const card = (c: HTMLElement) => c.querySelector('.agc-consent');
const shownCard = (c: HTMLElement) => c.querySelector('.agc-consent:not(.agc-consent--held)');

/** A grant arrival on a story page that has heard its minute, past the tap guard. */
async function arriveAndListen(url = `/marcus-aurelius/?gclid=${CLICK}`, lang: 'en' | 'de' = 'en') {
  const view = await mountAt(url, lang, 'story');
  await hear(60);
  await pass(1000);
  return view;
}

type ArmWindow = Window & { __agcCardArm?: unknown };
function forceArm(arm: 'arrival' | 'later' | undefined): void {
  if (arm === undefined) Reflect.deleteProperty(window as ArmWindow, '__agcCardArm');
  else (window as ArmWindow).__agcCardArm = arm;
}

beforeEach(() => {
  serveFrom('https://agoracosmica.org/');
  forceArm('later');
  sent = [];
  clock = 1000;
  sessionStorage.clear();
  localStorage.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
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
  forceArm(undefined);
  Reflect.deleteProperty(navigator, 'sendBeacon');
  vi.doUnmock(CONTROLLER);
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

const conversions = () => sent.filter((s) => s.url.endsWith('/api/conversions'));
const funnelRows = () => sent.filter((s) => s.url.endsWith('/v1/funnel')).map((s) => s.body);
const CARD_STEP = /^ad_consent_(shown|accepted|declined|dismissed)$/;

describe('ArrivalChoice: the moment', () => {
  it('does not ask on arrival, and the click ID leaves the address at once', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?utm_source=x&gclid=${CLICK}&lang=de#chapter-2`);
    expect(card(container)).toBeNull();
    expect(window.location.search).toBe('?utm_source=x&gclid=&lang=de');
    expect(window.location.hash).toBe('#chapter-2');
    expect(window.location.href).not.toContain(CLICK);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('asks after 60 seconds of story audio, and not at 59', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(59);
    expect(card(container)).toBeNull();
    await hear(1);
    expect(shownCard(container)).not.toBeNull();
  });

  it('counts the story\'s own seconds, never wall time', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(20);
    // paused for two minutes of wall time
    await act(async () => { player.set({ status: 'paused' }); });
    await pass(120_000);
    expect(card(container)).toBeNull();
    // playing, but the playhead stalls
    await act(async () => { player.set({ status: 'playing' }); });
    await pass(120_000);
    expect(card(container)).toBeNull();
    // a seek forward is not listening
    await act(async () => { player.set({ time: player.getState().time + 45 }); });
    expect(card(container)).toBeNull();
    await hear(40);
    expect(shownCard(container)).not.toBeNull();
  });

  it('holds nothing in storage before the answer, read back from the storage itself', async () => {
    const sessionGet = vi.spyOn(Storage.prototype, 'getItem');
    const sessionSet = vi.spyOn(Storage.prototype, 'setItem');
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(90);
    expect(shownCard(container)).not.toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
    expect(sessionSet).not.toHaveBeenCalled();
    expect(vi.mocked(localStorage.setItem)).not.toHaveBeenCalled();
    const read = [...sessionGet.mock.calls, ...vi.mocked(localStorage.getItem).mock.calls].map((c) => String(c[0]));
    expect(read.filter((k) => AD_KEYS.test(k))).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('never asks on a page with neither a story player nor a poem, and lets the click ID go', async () => {
    const { container } = await mountAt(`/themes/stoicism/?gclid=${CLICK}`, 'en', 'plain');
    const capture = await import('@client/utils/public/gclidCapture');
    expect(capture.getGclid()).toBeNull();
    expect(heard.clickId()).toBeNull();
    await pass(120_000);
    expect(card(container)).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('ignores a tap in its first 700 ms, then takes the answer', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(60);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    expect(shownCard(container)).not.toBeNull();
    expect(storageKeys(localStorage)).toEqual([]);
    expect(storageKeys(sessionStorage)).toEqual([]);
    await pass(650);
    const privacy = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'Privacy policy')!;
    expect(fireEvent.click(privacy)).toBe(false); // default prevented
    await pass(100);
    expect(fireEvent.click(privacy)).toBe(true);
    await act(async () => { fireEvent.click(yes); });
    expect(card(container)).toBeNull();
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(true);
  });

  it('leaves the audio alone when it appears', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const before = vi.fn();
    player.subscribe(before);
    await hear(60);
    expect(shownCard(container)).not.toBeNull();
    expect(player.getState().status).toBe('playing');
  });

  it('steps back while the reading view is open and comes back when it closes', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await act(async () => { player.set({ readerOpen: true }); });
    await hear(60);
    expect(card(container)).not.toBeNull();
    expect(shownCard(container)).toBeNull();
    expect(card(container)!.getAttribute('aria-hidden')).toBe('true');
    await act(async () => { player.set({ readerOpen: false }); });
    expect(shownCard(container)).not.toBeNull();
    expect(card(container)!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('waits while it would cover the poem\'s last line, and appears once the line is clear', async () => {
    const { container } = await mountAt(`/figures/emily-dickinson/poems/hope/?gclid=${CLICK}`, 'en', 'poem');
    const cardBox = { top: 400, bottom: 760, left: 0, right: 390, width: 390, height: 360, x: 0, y: 400 } as DOMRect;
    const none = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('agc-consent') ? cardBox : none;
    });
    placeLastLine(600); // in view, where the card would stand
    await pass(9000);
    expect(card(container)).not.toBeNull();
    expect(shownCard(container)).toBeNull();
    placeLastLine(100);
    await pass(10);
    expect(shownCard(container)).not.toBeNull();
  });
});

describe('ArrivalChoice: the answers', () => {
  it('yes stores the click ID and the yes, sends Start Exploring and Listened dated at its crossing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(30); // the crossing, at 10:00:00
    vi.setSystemTime(new Date('2026-10-26T10:00:40Z'));
    await hear(30);
    await pass(1000);
    expect(conversions()).toHaveLength(0);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted).toBe(true);
    const events = conversions().map((c) => c.body);
    expect(events.map((e) => e.event)).toEqual(['start_exploring', 'listened']);
    for (const e of events) expect(e.gclid).toBe(CLICK);
    expect(events[1].timestamp).toBe(Date.parse('2026-10-26T10:00:00Z'));
    expect(events[1].figureId).toBe('aurelius');
    expect(events[0].timestamp).toBe(Date.parse('2026-10-26T10:00:40Z'));
    for (const e of events) expect(e.arm).toBe('later');
    expect(card(container)).toBeNull();
    const counts = funnelRows();
    expect(counts.filter((c) => CARD_STEP.test(String(c.step))).map((c) => c.step)).toEqual(['ad_consent_shown', 'ad_consent_accepted']);
    expect(counts.filter((c) => c.step === 'ad_consent_arm')).toEqual([
      { step: 'ad_consent_arm', path: '/marcus-aurelius/', language: 'en', mode: 'later' },
    ]);
    for (const c of counts) expect(JSON.stringify(c)).not.toContain(CLICK);
  });

  it('no stores only the no, sends no conversion, and never asks again', async () => {
    const { container } = await arriveAndListen();
    const [, no] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(no); });
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual(['agc_ad_consent']);
    await hear(120);
    expect(card(container)).toBeNull();
    expect(conversions()).toHaveLength(0);
    expect(heard.clickId()).toBeNull();
  });

  it('never shows on a paid arrival, even with an old yes and an old click ID stored', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    await hear(90);
    expect(card(container)).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('never shows on a paid arrival without any answer on record', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?p=1&gclid=${CLICK}`, 'de');
    await hear(90);
    expect(card(container)).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('does not show on the next full page load of the visit, however long the story plays', async () => {
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(30);
    const { container } = await mountAt('/marcus-aurelius/');
    await hear(120);
    expect(card(container)).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('a reload of the stripped address does not ask', async () => {
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const { container } = await mountAt(`${window.location.pathname}${window.location.search}`);
    await hear(90);
    expect(card(container)).toBeNull();
  });
});

describe('ArrivalChoice across a page change in place', () => {
  it('keeps the count and the click ID in module memory, and the yes stores the held click ID', async () => {
    const first = await mountAt(`/de/figures/marcus-aurelius/?gclid=${CLICK}`, 'de');
    await hear(40);
    // The player's router: the click ID in gclidCapture is dropped, the island mounts again.
    const capture = await import('@client/utils/public/gclidCapture');
    capture.clearGclid();
    first.unmount();
    window.history.pushState({}, '', '/de/stoizismus/');
    const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<ArrivalChoice lang="de" />); });
    await settle();
    expect(card(view.container)).toBeNull();
    await hear(20);
    expect(shownCard(view.container)).not.toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    await pass(1000);
    const [yes] = Array.from(view.container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(conversions().map((c) => c.body.event)).toEqual(['start_exploring', 'listened']);
  });

  it('does not come back after a close when the island mounts again', async () => {
    const first = await arriveAndListen();
    await act(async () => { fireEvent.click(first.container.querySelector('button.agc-consent__x')!); });
    first.unmount();
    const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<ArrivalChoice lang="en" />); });
    await settle();
    await hear(120);
    expect(card(view.container)).toBeNull();
  });
});

describe('ArrivalChoice on a poem page', () => {
  it('asks once the last line has been in view for the poem\'s reading time, not before', async () => {
    const { container } = await mountAt(`/figures/emily-dickinson/poems/hope/?gclid=${CLICK}`, 'en', 'poem');
    placeLastLine(900); // below the fold of jsdom's 768
    await pass(20_000);
    expect(card(container)).toBeNull();
    placeLastLine(500);
    await pass(10);
    expect(shownCard(container)).not.toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });

  it('waits for the reading time when the whole poem stands on the first screen', async () => {
    const { container } = await mountAt(`/figures/emily-dickinson/poems/hope/?gclid=${CLICK}`, 'en', 'poem');
    placeLastLine(300);
    await pass(5000);
    expect(card(container)).toBeNull();
    await pass(3100);
    expect(shownCard(container)).not.toBeNull();
  });

  it('does not count a closed fold as read', async () => {
    const { container } = await mountAt(`/figures/rumi/poems/?gclid=${CLICK}`, 'en', 'poem');
    placeLastLine(null);
    await pass(60_000);
    expect(card(container)).toBeNull();
  });

  it('yes sends Start Exploring alone; Listened follows only after 30 seconds of audio', async () => {
    const { container } = await mountAt(`/figures/emily-dickinson/poems/hope/?gclid=${CLICK}`, 'en', 'poem');
    placeLastLine(300);
    await pass(9000);
    await pass(1000);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    expect(conversions().map((c) => c.body.event)).toEqual(['start_exploring']);
    for (let i = 0; i < 31; i++) heard.addHeardSeconds(1, 'dickinson');
    expect(conversions().map((c) => c.body.event)).toEqual(['start_exploring', 'listened']);
    expect(conversions().some((c) => /poem/.test(String(c.body.event)))).toBe(false);
  });
});

describe('ArrivalChoice counts from an in-house browser', () => {
  const funnel = () => sent.filter((s) => s.url.endsWith('/v1/funnel'));

  it('marks its counts on a ?probe=1 landing, before anything has stored the flag', async () => {
    const { container } = await arriveAndListen(`/marcus-aurelius/?probe=1&gclid=${CLICK}`);
    const [, no] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(no); });
    await new Promise((r) => setTimeout(r, 0));
    const declined = funnel().filter((c) => c.body.step === 'ad_consent_declined');
    expect(declined).toHaveLength(1);
    expect(declined[0].body.probe).toBe(1);
    expect(storageKeys(localStorage)).toContain('agc_ad_consent');
  });

  it('marks its counts when the flag is already stored', async () => {
    localStorage.setItem('agc_probe', '1');
    const { container } = await arriveAndListen();
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    const accepted = funnel().filter((c) => c.body.step === 'ad_consent_accepted');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].body.probe).toBe(1);
  });

  it('shows the card to a marked browser after its minute and counts its yes, but sends Google nothing', async () => {
    for (const mark of ['address', 'stored'] as const) {
      sent = [];
      sessionStorage.clear();
      localStorage.clear();
      if (mark === 'stored') localStorage.setItem('agc_probe', '1');
      const { container, unmount } = await arriveAndListen(`/marcus-aurelius/?${mark === 'address' ? 'probe=1&' : ''}gclid=${CLICK}`);
      expect(shownCard(container), mark).not.toBeNull();
      const [yes] = Array.from(container.querySelectorAll('button'));
      await act(async () => { fireEvent.click(yes); });
      await new Promise((r) => setTimeout(r, 0));
      // the yes is kept as for anyone, so the card can be tried on the live site
      expect(JSON.parse(localStorage.getItem('agc_ad_consent')!).granted, mark).toBe(true);
      expect(sessionStorage.getItem('agc_gclid'), mark).toBe(CLICK);
      const accepted = funnel().filter((c) => c.body.step === 'ad_consent_accepted');
      expect(accepted, mark).toHaveLength(1);
      expect(accepted[0].body.probe, mark).toBe(1);
      expect(conversions(), mark).toHaveLength(0);
      expect(storageKeys(sessionStorage).filter((k) => k.startsWith('agc_conv_fired_')), mark).toEqual([]);
      unmount();
    }
  });

  it('sends Google nothing once the flag is set by hand on an open page, after its first count', async () => {
    const { container } = await arriveAndListen();
    expect(shownCard(container)).not.toBeNull();
    const { probeField } = await import('@client/utils/probeSession');
    expect(probeField()).toBeUndefined();
    localStorage.setItem('agc_probe', '1');
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    for (let i = 0; i < 40; i++) heard.addHeardSeconds(1, 'aurelius');
    await new Promise((r) => setTimeout(r, 0));
    expect(conversions()).toHaveLength(0);
    expect(sessionStorage.getItem('agc_listened_seconds')).toBeNull();
    expect(storageKeys(sessionStorage).filter((k) => k.startsWith('agc_conv_fired_'))).toEqual([]);
  });

  it('sends no probe field from an unmarked browser', async () => {
    const { container } = await arriveAndListen();
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    await new Promise((r) => setTimeout(r, 0));
    const counts = funnel();
    expect(counts.length).toBeGreaterThan(0);
    for (const c of counts) expect('probe' in c.body).toBe(false);
  });
});

describe('heard seconds', () => {
  async function loadHeard(url: string) {
    window.history.replaceState({}, '', url);
    vi.resetModules();
    const capture = await import('@client/utils/public/gclidCapture');
    const seconds = await import('../../../../marketing/src/utils/heardSeconds');
    return { capture, heard: seconds };
  }

  it('counts and writes nothing without a yes, and reads nothing either', async () => {
    const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1);
    expect(getItem.mock.calls.map((c) => c[0])).not.toContain('agc_listened_seconds');
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });

  it('while the card waits: counts in memory, holds the crossing, stores and reads nothing', async () => {
    const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    h.armPreDecisionListening();
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1, 'aurelius');
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
    // the yes sends the held crossing
    capture.grantAdConsent();
    h.flushPreDecisionListening();
    expect(conversions().map((c) => c.body.event)).toEqual(['listened']);
  });

  it('a no drops the held crossing and the seconds', async () => {
    const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    h.armPreDecisionListening();
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1, 'aurelius');
    h.revokeAdConsent();
    capture.grantAdConsent(); // even a later yes on this page has nothing to send
    h.flushPreDecisionListening();
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1, 'aurelius');
    expect(conversions()).toHaveLength(0);
  });

  it('counts after a yes and sends listened once at 30 seconds', async () => {
    const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    capture.grantAdConsent();
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1, 'aurelius');
    expect(conversions()).toHaveLength(1);
    expect(conversions()[0].body.event).toBe('listened');
    expect(Number(sessionStorage.getItem('agc_listened_seconds'))).toBeGreaterThanOrEqual(30);
  });

  it('counts no seconds and sends no listened for a marked browser with a yes', async () => {
    for (const mark of ['address', 'stored'] as const) {
      sent = [];
      sessionStorage.clear();
      localStorage.clear();
      if (mark === 'stored') localStorage.setItem('agc_probe', '1');
      const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?${mark === 'address' ? 'probe=1&' : ''}gclid=${CLICK}`);
      capture.captureGclid({ holdUntilAnswer: true });
      capture.grantAdConsent();
      for (let i = 0; i < 40; i++) h.addHeardSeconds(1, 'aurelius');
      expect(conversions(), mark).toHaveLength(0);
      expect(sessionStorage.getItem('agc_listened_seconds'), mark).toBeNull();
      expect(sessionStorage.getItem('agc_conv_fired_listened'), mark).toBeNull();
    }
  });

  it('counts nothing on a paid arrival with an old yes', async () => {
    localStorage.setItem('agc_ad_consent', YES);
    sessionStorage.setItem('agc_gclid', 'OLDCLICKID00001');
    const { capture, heard: h } = await loadHeard(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    capture.captureGclid({ holdUntilAnswer: true });
    for (let i = 0; i < 40; i++) h.addHeardSeconds(1);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
  });
});

describe('ArrivalChoice after a year', () => {
  it('asks again when the stored answer is older than 365 days', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.3.0', timestamp: Date.now() - 366 * 86_400_000 }));
    const { container } = await arriveAndListen();
    expect(shownCard(container)).not.toBeNull();
  });
  it('does not ask within the year', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version: '1.3.0', timestamp: Date.now() - 100 * 86_400_000 }));
    const { container } = await arriveAndListen();
    expect(card(container)).toBeNull();
  });
});

describe('ArrivalChoice copy and version', () => {
  it('names what Google learns, the year, the footer switch, and links Google’s page', async () => {
    const { container } = await arriveAndListen();
    const fine = container.querySelector('.agc-consent__fine')!.textContent!;
    expect(fine.startsWith('A yes sends Google the ad’s click ID. That way Google sees the ad brought you to us, and whether you listened for 30\u00a0seconds. ')).toBe(true);
    expect(fine).toContain('for a year');
    expect(fine).toContain('at the foot of every page');
    const google = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'How Google uses this')!;
    expect(google.getAttribute('href')).toBe('https://business.safety.google/privacy');
    expect(google.getAttribute('rel')).toContain('noopener');
  });

  it('speaks German, with the same three links', async () => {
    const { container } = await arriveAndListen(`/de/figures/marcus-aurelius/?gclid=${CLICK}`, 'de');
    expect(container.querySelector('.agc-consent__fine')!.textContent!.startsWith(
      'Ein Ja schickt Google die Klick-ID der Anzeige. So sieht Google, dass die Anzeige dich zu uns gebracht hat und ob du 30\u00a0Sekunden zugehört hast. '
    )).toBe(true);
    const labels = Array.from(container.querySelectorAll('.agc-consent__link')).map((a) => a.textContent);
    expect(labels).toEqual(['Code ansehen', 'Datenschutzerklärung', 'Wie Google das nutzt']);
  });

  it('names the Google account, the USA and no personalised ads right after what Google learns', async () => {
    const en = (await arriveAndListen()).container;
    expect(en.querySelector('.agc-consent__fine')!.textContent).toContain(
      'for 30\u00a0seconds. Google can link it to your Google account and may process it in the USA. We don’t allow it for personalised ads. Nothing else about you.'
    );
    const de = (await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, 'de')).container;
    expect(de.querySelector('.agc-consent__fine')!.textContent).toContain(
      'zugehört hast. Google kann sie deinem Google-Konto zuordnen und auch in den USA verarbeiten. Für personalisierte Werbung geben wir sie nicht frei. Sonst nichts über dich.'
    );
  });

  it('names none of the app\'s steps in either language (1.3.0)', async () => {
    const steps = /Council|\bGesprächs?\b|third message|dritten Nachricht|Öffnen der App|in the app|in der App|conversation/i;
    for (const lang of ['en', 'de'] as const) {
      const { container, unmount } = await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, lang);
      expect(card(container)!.textContent, lang).not.toMatch(steps);
      unmount();
    }
  });

  it('carries the age line on its own, between the words and the answers', async () => {
    for (const [lang, line] of [['en', 'If you’re under 16, please say no.'], ['de', 'Bist du unter 16, sag bitte Nein.']] as const) {
      const { container, unmount } = await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, lang);
      const age = container.querySelector('.agc-consent__age')!;
      expect(age.textContent).toBe(line);
      expect(age.previousElementSibling!.classList.contains('agc-consent__words')).toBe(true);
      expect(age.nextElementSibling!.classList.contains('agc-consent__actions')).toBe(true);
      unmount();
    }
  });

  it('announces itself politely and never takes the focus', async () => {
    const before = document.activeElement;
    const { container } = await arriveAndListen();
    expect(card(container)!.getAttribute('aria-live')).toBe('polite');
    expect(card(container)!.getAttribute('role')).toBeNull();
    expect(document.activeElement).toBe(before);
  });
});

describe('ArrivalChoice close control', () => {
  const closeOf = (container: HTMLElement) => container.querySelector('button.agc-consent__x') as HTMLButtonElement;

  it('is a named button, last in the tab order, after both answers', async () => {
    const en = (await arriveAndListen()).container;
    const buttons = Array.from(en.querySelectorAll('button'));
    expect(buttons.map((b) => b.className)).toEqual(['agc-consent__btn', 'agc-consent__btn', 'agc-consent__x']);
    expect(closeOf(en).getAttribute('aria-label')).toBe('Close. This counts as no.');
    expect(en.querySelector('.agc-consent')!.lastElementChild).toBe(closeOf(en));
    const de = (await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, 'de')).container;
    expect(closeOf(de).getAttribute('aria-label')).toBe('Schließen. Das zählt als Nein.');
  });

  it('drops the click ID, stores nothing, sends one keyless count and nothing to Google', async () => {
    const { container } = await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, 'de');
    // The shown count belongs to the card's arrival, not to the close.
    await new Promise((r) => setTimeout(r, 0));
    sent = [];
    const capture = await import('@client/utils/public/gclidCapture');
    expect(capture.getGclid()).toBe(CLICK);
    await act(async () => { fireEvent.click(closeOf(container)); });
    await new Promise((r) => setTimeout(r, 0));
    expect(card(container)).toBeNull();
    expect(capture.getGclid()).toBeNull();
    expect(heard.clickId()).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
    expect(conversions()).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://llm.agoracosmica.org/v1/funnel');
    const { step, path, language, bucket, mode, ...rest } = sent[0].body;
    expect(step).toBe('ad_consent_dismissed');
    expect(path).toBe('/marcus-aurelius/');
    expect(language).toBe('de');
    expect([0, 1, 2, 3]).toContain(bucket);
    expect(mode).toBe('later');
    expect(rest).toEqual({});
    expect(JSON.stringify(sent[0].body)).not.toContain(CLICK);
  });

  it('is not remembered: the next ad arrival asks again after its minute', async () => {
    const first = (await arriveAndListen()).container;
    await act(async () => { fireEvent.click(closeOf(first)); });
    const next = (await arriveAndListen(`/seneca/?gclid=${CLICK}`)).container;
    expect(shownCard(next)).not.toBeNull();
  });

  it('a yes or a no after the close cannot happen: the card stays gone on this page', async () => {
    const { container } = await arriveAndListen();
    await act(async () => { fireEvent.click(closeOf(container)); });
    await hear(120);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  // 1.1.0 is the card before the Google account and USA sentence.
  it('asks again when the stored yes was given under the earlier text', async () => {
    for (const version of ['1.2.0', '1.1.0', '1.0.0']) {
      localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version, timestamp: Date.now() }));
      const { container, unmount } = await arriveAndListen();
      expect(shownCard(container)).not.toBeNull();
      expect(storageKeys(sessionStorage)).toEqual([]);
      unmount();
    }
  });

  it('does not ask again after a no given under the earlier text', async () => {
    for (const version of ['1.2.0', '1.1.0', '1.0.0']) {
      localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: false, version, timestamp: Date.now() }));
      const { container, unmount } = await arriveAndListen();
      expect(card(container)).toBeNull();
      expect(storageKeys(sessionStorage)).toEqual([]);
      unmount();
    }
  });

  it('still never shows on a paid arrival, whatever version is stored', async () => {
    localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: true, version: '1.0.0', timestamp: Date.now() }));
    const { container } = await arriveAndListen(`/marcus-aurelius/?p=1&gclid=${CLICK}`);
    expect(card(container)).toBeNull();
    expect(storageKeys(sessionStorage)).toEqual([]);
  });
});

describe('ArrivalChoice after the legal read', () => {
  it('carries no trust line, and names Google in the question', async () => {
    const en = (await arriveAndListen()).container;
    expect(en.querySelector('.agc-consent__trust')).toBeNull();
    expect(en.querySelector('.agc-consent')!.textContent).not.toMatch(/tracking cookies|profiling/i);
    expect(en.querySelector('.agc-consent__q')!.textContent).toBe('May we count your visit for Google?');
    const labels = Array.from(en.querySelectorAll('.agc-consent__imprint a')).map((a) => a.textContent);
    expect(labels).toEqual(['See the code', 'Privacy policy', 'How Google uses this']);
    const de = (await arriveAndListen(`/marcus-aurelius/?gclid=${CLICK}`, 'de')).container;
    expect(de.querySelector('.agc-consent')!.textContent).not.toMatch(/Tracking-Cookies|Profiling/);
    expect(de.querySelector('.agc-consent__q')!.textContent).toBe('Dürfen wir deinen Besuch für Google zählen?');
  });

  for (const [answer, pick] of [
    ['yes', (c: HTMLElement) => c.querySelectorAll('button')[0]],
    ['no', (c: HTMLElement) => c.querySelectorAll('button')[1]],
    ['the X', (c: HTMLElement) => c.querySelector('button.agc-consent__x')!],
  ] as const) {
    it(`after ${answer} the address is still without the click ID, and a reload does not ask`, async () => {
      const { container } = await arriveAndListen(`/marcus-aurelius/?utm_source=x&gclid=${CLICK}&lang=de#chapter-2`);
      await act(async () => { fireEvent.click(pick(container) as HTMLElement); });
      expect(window.location.pathname).toBe('/marcus-aurelius/');
      expect(window.location.search).toBe('?utm_source=x&gclid=&lang=de');
      expect(window.location.hash).toBe('#chapter-2');
      expect(window.location.href).not.toContain(CLICK);
      const stored = { s: storageKeys(sessionStorage), l: storageKeys(localStorage) };
      // The reload: a fresh page at the address the answer left.
      const reloaded = (await arriveAndListen(`${window.location.pathname}${window.location.search}${window.location.hash}`)).container;
      expect(reloaded.querySelector('.agc-consent')).toBeNull();
      expect({ s: storageKeys(sessionStorage), l: storageKeys(localStorage) }).toEqual(stored);
    });
  }

  it('leaves an address without a click ID untouched', async () => {
    window.history.replaceState({}, '', '/de/?lang=de#top');
    const { dropClickIdFromAddress } = await import('../../../../marketing/src/islands/ArrivalChoice');
    dropClickIdFromAddress();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/de/?lang=de#top');
    window.history.replaceState({}, '', '/de/?gclid=&lang=de');
    const replace = vi.spyOn(window.history, 'replaceState');
    dropClickIdFromAddress();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('off the production hosts', () => {
  const closeOf = (container: HTMLElement) => container.querySelector('button.agc-consent__x') as HTMLButtonElement;
  for (const host of ['http://localhost:4321/', 'https://a1b2c3.agora-cosmica.pages.dev/']) {
    it(`a yes, its seconds and a close on ${host} send nothing`, async () => {
      serveFrom(host);
      const { container } = await arriveAndListen();
      expect(shownCard(container)).not.toBeNull();
      const [yes] = Array.from(container.querySelectorAll('button'));
      await act(async () => { fireEvent.click(yes); });
      for (let i = 0; i < 40; i++) heard.addHeardSeconds(1, 'aurelius');
      const next = (await arriveAndListen(`/seneca/?gclid=${CLICK}`)).container;
      if (next.querySelector('.agc-consent')) {
        await act(async () => { fireEvent.click(closeOf(next)); });
      }
      await new Promise((r) => setTimeout(r, 0));
      expect(sent).toEqual([]);
      expect(vi.mocked(navigator.sendBeacon)).not.toHaveBeenCalled();
    });
  }
});

describe('the draw', () => {
  async function load() {
    vi.resetModules();
    vi.doMock(CONTROLLER, () => ({ subscribe: player.subscribe, getState: player.getState }));
    return import('../../../../marketing/src/islands/ArrivalChoice');
  }

  it('puts half the undecided grant arrivals in the later arm, and at 0 none', async () => {
    const { drawArm, LATER_SHARE } = await load();
    forceArm(undefined);
    expect(LATER_SHARE).toBe(0.5);
    expect(drawArm(0.5, () => 0.4999)).toBe('later');
    expect(drawArm(0.5, () => 0.5)).toBe('arrival');
    for (const r of [0, 0.25, 0.5, 0.9999]) expect(drawArm(0, () => r)).toBe('arrival');
  });

  it('draws near half over 200 page loads from the browser\'s own random source', async () => {
    const { drawArm } = await load();
    forceArm(undefined);
    const later = Array.from({ length: 200 }, () => drawArm()).filter((a) => a === 'later').length;
    // Fair: 100 expected, a standard deviation of about 7; outside 70 to 130 happens about once in 30,000 runs.
    expect(later).toBeGreaterThanOrEqual(70);
    expect(later).toBeLessThanOrEqual(130);
  });

  it('takes a forced arm from a test harness, never from the address', async () => {
    const { drawArm } = await load();
    forceArm('later');
    expect(drawArm(0, () => 0.9)).toBe('later');
    forceArm('arrival');
    expect(drawArm(1, () => 0)).toBe('arrival');
    forceArm(undefined);
    (window as ArmWindow).__agcCardArm = 'sideways';
    expect(drawArm(0, () => 0.1)).toBe('arrival');
    forceArm(undefined);
    window.history.replaceState({}, '', `/marcus-aurelius/?__agcCardArm=later&arm=later&gclid=${CLICK}`);
    expect(drawArm(0, () => 0.1)).toBe('arrival');
  });

  it('draws for an undecided grant arrival only, and counts each draw once', async () => {
    forceArm(undefined);
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(a: T): T => {
      (a as unknown as Uint32Array)[0] = 0; // the later arm
      return a;
    });
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await settle();
    expect(funnelRows().filter((r) => r.step === 'ad_consent_arm')).toEqual([
      { step: 'ad_consent_arm', path: '/marcus-aurelius/', language: 'en', mode: 'later' },
    ]);
    expect(heard.cardArm()).toBe('later');
    for (const url of ['/marcus-aurelius/', `/marcus-aurelius/?p=1&gclid=${CLICK}`]) {
      sent = [];
      await mountAt(url);
      await settle();
      expect(funnelRows().filter((r) => r.step === 'ad_consent_arm'), url).toEqual([]);
      expect(heard.cardArm(), url).toBeNull();
    }
    sent = [];
    localStorage.setItem('agc_ad_consent', YES);
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await settle();
    expect(funnelRows().filter((r) => r.step === 'ad_consent_arm')).toEqual([]);
    expect(heard.cardArm()).toBeNull();
  });
});

describe('ArrivalChoice: the arrival arm', () => {
  beforeEach(() => forceArm('arrival'));

  it('asks at once on a story page, a poem page and any other page, and stores nothing', async () => {
    for (const [url, kind] of [
      [`/marcus-aurelius/?utm_source=x&gclid=${CLICK}#chapter-2`, 'story'],
      [`/figures/emily-dickinson/poems/hope/?gclid=${CLICK}`, 'poem'],
      [`/themes/stoicism/?gclid=${CLICK}`, 'plain'],
    ] as const) {
      sessionStorage.clear();
      localStorage.clear();
      const { container, unmount } = await mountAt(url, 'de', kind);
      expect(shownCard(container), kind).not.toBeNull();
      expect(window.location.href, kind).not.toContain(CLICK);
      expect(window.location.search, kind).toMatch(/(^\?|&)gclid=(&|$)/);
      expect(storageKeys(sessionStorage), kind).toEqual([]);
      expect(storageKeys(localStorage), kind).toEqual([]);
      expect(heard.clickId(), kind).toBe(CLICK);
      expect(heard.cardArm(), kind).toBe('arrival');
      unmount();
    }
    const draws = funnelRows().filter((r) => r.step === 'ad_consent_arm');
    expect(draws.map((r) => [r.path, r.mode, r.language])).toEqual([
      ['/marcus-aurelius/', 'arrival', 'de'],
      ['/figures/emily-dickinson/poems/hope/', 'arrival', 'de'],
      ['/themes/stoicism/', 'arrival', 'de'],
    ]);
  });

  it('ignores a tap in its first 700 ms here too', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    expect(shownCard(container)).not.toBeNull();
    expect(storageKeys(localStorage)).toEqual([]);
    await pass(750);
    await act(async () => { fireEvent.click(yes); });
    expect(card(container)).toBeNull();
  });

  it('a yes before any listening sends Start Exploring now and Listened once 30 s of story have run, dated then', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T18:00:00Z'));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`, 'de');
    await pass(1000);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    expect(conversions().map((c) => c.body.event)).toEqual(['start_exploring']);
    expect(conversions()[0].body.arm).toBe('arrival');
    expect(conversions()[0].body.timestamp).toBe(Date.parse('2026-10-28T18:00:00Z'));
    vi.setSystemTime(new Date('2026-10-28T18:02:00Z'));
    await hear(29);
    expect(conversions()).toHaveLength(1);
    await hear(1);
    const listened = conversions().filter((c) => c.body.event === 'listened');
    expect(listened).toHaveLength(1);
    expect(listened[0].body).toMatchObject({ gclid: CLICK, figureId: 'aurelius', arm: 'arrival' });
    expect(listened[0].body.timestamp).toBe(Date.parse('2026-10-28T18:02:00Z'));
    await hear(60);
    expect(conversions()).toHaveLength(2);
    const counts = funnelRows().filter((c) => CARD_STEP.test(String(c.step)));
    expect(counts.map((c) => [c.step, c.mode])).toEqual([['ad_consent_shown', 'arrival'], ['ad_consent_accepted', 'arrival']]);
  });

  it('a yes after some listening sends the crossing held before it, dated when it happened', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T18:00:00Z'));
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    await hear(30);
    vi.setSystemTime(new Date('2026-10-28T18:01:00Z'));
    await pass(1000);
    expect(conversions()).toHaveLength(0);
    const [yes] = Array.from(container.querySelectorAll('button'));
    await act(async () => { fireEvent.click(yes); });
    const events = conversions().map((c) => c.body);
    expect(events.map((e) => e.event)).toEqual(['start_exploring', 'listened']);
    expect(events[1].timestamp).toBe(Date.parse('2026-10-28T18:00:00Z'));
    for (const e of events) expect(e.arm).toBe('arrival');
  });

  it('no and the X send nothing to Google, and the card does not come back', async () => {
    for (const pick of ['no', 'x'] as const) {
      sent = [];
      sessionStorage.clear();
      localStorage.clear();
      const { container, unmount } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
      await pass(1000);
      const target = pick === 'no' ? container.querySelectorAll('button')[1] : container.querySelector('button.agc-consent__x')!;
      await act(async () => { fireEvent.click(target as HTMLElement); });
      expect(card(container), pick).toBeNull();
      await hear(90);
      expect(card(container), pick).toBeNull();
      expect(conversions(), pick).toHaveLength(0);
      expect(storageKeys(sessionStorage), pick).toEqual([]);
      expect(storageKeys(localStorage), pick).toEqual(pick === 'no' ? ['agc_ad_consent'] : []);
      unmount();
    }
  });

  it('steps back while the reading view is open', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    expect(shownCard(container)).not.toBeNull();
    await act(async () => { player.set({ readerOpen: true }); });
    expect(shownCard(container)).toBeNull();
    await act(async () => { player.set({ readerOpen: false }); });
    expect(shownCard(container)).not.toBeNull();
  });

  it('stays across a page change in place, and the yes stores the held click ID', async () => {
    const first = await mountAt(`/de/figures/marcus-aurelius/?gclid=${CLICK}`, 'de');
    expect(shownCard(first.container)).not.toBeNull();
    await hear(10);
    const capture = await import('@client/utils/public/gclidCapture');
    capture.clearGclid();
    first.unmount();
    window.history.pushState({}, '', '/de/stoizismus/');
    const { default: ArrivalChoice } = await import('../../../../marketing/src/islands/ArrivalChoice');
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<ArrivalChoice lang="de" />); });
    await settle();
    expect(shownCard(view.container)).not.toBeNull();
    await pass(1000);
    await act(async () => { fireEvent.click(view.container.querySelectorAll('button')[0]); });
    expect(sessionStorage.getItem('agc_gclid')).toBe(CLICK);
    await hear(20);
    expect(conversions().map((c) => c.body.event)).toEqual(['start_exploring', 'listened']);
    expect(funnelRows().filter((r) => r.step === 'ad_consent_arm')).toHaveLength(1);
  });

  it('a reload of the stripped address does not ask, and draws nothing', async () => {
    await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
    sent = [];
    const { container } = await mountAt(`${window.location.pathname}${window.location.search}`);
    expect(card(container)).toBeNull();
    expect(funnelRows().filter((r) => r.step === 'ad_consent_arm')).toEqual([]);
  });

  it('a paid arrival and a decided visitor get no card and no draw', async () => {
    for (const setup of ['paid', 'yes', 'no'] as const) {
      sent = [];
      sessionStorage.clear();
      localStorage.clear();
      if (setup !== 'paid') localStorage.setItem('agc_ad_consent', JSON.stringify({ granted: setup === 'yes', version: '1.3.0', timestamp: Date.now() }));
      const { container, unmount } = await mountAt(`/marcus-aurelius/?${setup === 'paid' ? 'p=1&' : ''}gclid=${CLICK}`);
      expect(card(container), setup).toBeNull();
      expect(heard.cardArm(), setup).toBeNull();
      expect(funnelRows().filter((r) => r.step === 'ad_consent_arm'), setup).toEqual([]);
      unmount();
    }
  });

  it('a probe visit sees the card at once, counts with the marker, and sends Google nothing', async () => {
    const { container } = await mountAt(`/marcus-aurelius/?probe=1&gclid=${CLICK}`);
    await pass(1000);
    await act(async () => { fireEvent.click(container.querySelectorAll('button')[0]); });
    await hear(40);
    await new Promise((r) => setTimeout(r, 0));
    expect(conversions()).toHaveLength(0);
    const rows = funnelRows();
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const r of rows) expect(r.probe).toBe(1);
  });
});

describe('the story counts', () => {
  const stories = () => funnelRows().filter((r) => r.step === 'story_started' || r.step === 'story_heard');

  it('count every visitor on a player page: a story started, and heard once 30 s of it ran', async () => {
    await mountAt('/de/figures/marcus-aurelius/', 'de');
    await hear(29);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories()).toEqual([{ step: 'story_started', figureId: 'aurelius', language: 'en' }]);
    await hear(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories().map((r) => r.step)).toEqual(['story_started', 'story_heard']);
    await hear(120);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories()).toHaveLength(2);
    expect(storageKeys(sessionStorage)).toEqual([]);
    expect(storageKeys(localStorage)).toEqual([]);
  });

  it('carry the arm for a grant arrival, in either arm', async () => {
    for (const arm of ['later', 'arrival'] as const) {
      sent = [];
      forceArm(arm);
      await mountAt(`/marcus-aurelius/?gclid=${CLICK}`);
      await hear(31);
      await new Promise((r) => setTimeout(r, 0));
      expect(stories().map((r) => [r.step, r.mode]), arm).toEqual([['story_started', arm], ['story_heard', arm]]);
      for (const r of stories()) expect(JSON.stringify(r)).not.toContain(CLICK);
    }
  });

  it('count each story once per page load, the introduction too', async () => {
    await mountAt('/figures/marcus-aurelius/');
    await act(async () => { player.set({ queue: { figureId: 'aurelius', lang: 'en' }, current: 0, status: 'playing', time: 0 }); });
    await hear(31);
    await act(async () => { player.set({ current: 1, time: 0 }); });
    await hear(10);
    await act(async () => { player.set({ current: 0, time: 0 }); });
    await hear(40);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories().map((r) => r.step)).toEqual(['story_started', 'story_heard', 'story_started']);
  });

  it('count only audio that ran: a pause, a stall and a seek add nothing', async () => {
    await mountAt('/figures/marcus-aurelius/');
    await hear(20);
    await act(async () => { player.set({ status: 'paused' }); });
    await act(async () => { player.set({ time: player.getState().time + 3 }); });
    await act(async () => { player.set({ status: 'playing' }); });
    await act(async () => { player.set({ time: player.getState().time + 30 }); });
    await new Promise((r) => setTimeout(r, 0));
    expect(stories().map((r) => r.step)).toEqual(['story_started']);
    await hear(10);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories().map((r) => r.step)).toEqual(['story_started', 'story_heard']);
  });

  it('send nothing on a page without the player', async () => {
    await mountAt(`/themes/stoicism/?gclid=${CLICK}`, 'en', 'plain');
    await hear(60);
    await new Promise((r) => setTimeout(r, 0));
    expect(stories()).toEqual([]);
  });
});
