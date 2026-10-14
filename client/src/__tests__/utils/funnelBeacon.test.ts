import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  firstReplyFailReason,
  chatDepthBucket,
  CHAT_DEPTH_BUCKETS,
} from '../../utils/funnelBeacon';

// A failure the visitor never sees a reason for is the worst kind, so the
// classifier has to be total: every input lands in exactly one of four buckets.
describe('firstReplyFailReason', () => {
  it('sorts an aborted request to abort, whatever else it looks like', () => {
    const err = new Error('Turnstile challenge timed out');
    err.name = 'AbortError';
    expect(firstReplyFailReason(err)).toBe('abort');
  });

  it('sorts every bot-check failure to turnstile', () => {
    expect(firstReplyFailReason(new Error('Turnstile challenge timed out. Please try again.'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Turnstile challenge failed'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Turnstile token expired'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Failed to load Turnstile script'))).toBe('turnstile');
    // The server-side twin: a token the edge rejects surfaces as a session
    // error, and it is still the bot check that ate the message.
    expect(firstReplyFailReason(new Error('Turnstile verification failed'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Missing turnstileToken'))).toBe('turnstile');
  });

  it('sorts a 429 to quota', () => {
    expect(firstReplyFailReason(Object.assign(new Error('Daily limit'), { status: 429 }))).toBe('quota');
  });

  it('sorts everything else to upstream', () => {
    expect(firstReplyFailReason(Object.assign(new Error('bad gateway'), { status: 502 }))).toBe('upstream');
    expect(firstReplyFailReason(new Error('Failed to fetch'))).toBe('upstream');
    expect(firstReplyFailReason(undefined)).toBe('upstream');
    expect(firstReplyFailReason(null)).toBe('upstream');
    expect(firstReplyFailReason('something')).toBe('upstream');
  });
});

describe('chatDepthBucket', () => {
  it('maps turn counts to the four documented buckets', () => {
    expect(chatDepthBucket(1)).toBe(0);
    expect(chatDepthBucket(2)).toBe(1);
    expect(chatDepthBucket(3)).toBe(1);
    expect(chatDepthBucket(4)).toBe(2);
    expect(chatDepthBucket(9)).toBe(2);
    expect(chatDepthBucket(10)).toBe(3);
    expect(chatDepthBucket(500)).toBe(3);
  });

  it('never exceeds the worker bucket ceiling', () => {
    expect(CHAT_DEPTH_BUCKETS.length).toBe(3);
    expect(chatDepthBucket(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(5);
  });
});

// A probe row is one that must never reach a funnel number. Marking a browser
// used to take a navigation, a console write and a second navigation, so a
// screenshot harness once left 23 entries in a live week. ?probe=1 makes it
// one step, which means the module has to read the URL at load, before any
// beacon of that same page load can fire.
describe('the ?probe=1 marker', () => {
  const HOME = window.location.href;

  // The read happens in the module body, so every case needs a fresh module
  // registry and a URL that is already in place at import time.
  async function loadAt(search: string) {
    window.history.replaceState({}, '', `/${search}`);
    vi.resetModules();
    return import('../../utils/funnelBeacon');
  }

  // jsdom ships no sendBeacon; defining one keeps the test on the transport
  // production actually uses and hands back the posted body.
  function captureBeacon() {
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeacon,
      configurable: true,
      writable: true,
    });
    return sendBeacon;
  }

  afterEach(() => {
    window.history.replaceState({}, '', HOME);
    Reflect.deleteProperty(navigator, 'sendBeacon');
    vi.resetModules();
  });

  it('marks the browser when the landing URL carries probe=1', async () => {
    await loadAt('?probe=1');
    expect(localStorage.getItem('agc_probe')).toBe('1');
  });

  it('survives other parameters on the same URL', async () => {
    await loadAt('?utm_source=newsletter&probe=1&figure=marcus-aurelius');
    expect(localStorage.getItem('agc_probe')).toBe('1');
  });

  it('writes nothing without the parameter', async () => {
    await loadAt('');
    expect(localStorage.getItem('agc_probe')).toBeNull();
    await loadAt('?utm_source=newsletter');
    expect(localStorage.getItem('agc_probe')).toBeNull();
  });

  it('writes nothing for any other value', async () => {
    await loadAt('?probe=0');
    expect(localStorage.getItem('agc_probe')).toBeNull();
    await loadAt('?probe=true');
    expect(localStorage.getItem('agc_probe')).toBeNull();
  });

  it('puts probe: 1 in the beacon body from that same page load', async () => {
    const sendBeacon = captureBeacon();
    const { sendFunnelBeacon } = await loadAt('?probe=1');

    sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const body = JSON.parse(await sendBeacon.mock.calls[0][1].text());
    expect(body.step).toBe('figure_selected');
    expect(body.probe).toBe(1);
  });

  it('leaves the field off an unmarked browser', async () => {
    const sendBeacon = captureBeacon();
    const { sendFunnelBeacon } = await loadAt('');

    sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const body = JSON.parse(await sendBeacon.mock.calls[0][1].text());
    expect(body.probe).toBeUndefined();
  });

  it('keeps the mark for a later page load that has no parameter', async () => {
    await loadAt('?probe=1');
    const sendBeacon = captureBeacon();
    const { sendFunnelBeacon } = await loadAt('');

    sendFunnelBeacon('mode_selected', { mode: 'story' });

    const body = JSON.parse(await sendBeacon.mock.calls[0][1].text());
    expect(body.probe).toBe(1);
  });
});

// Counting stores nothing on the device: the one-shot flag is page memory, so a
// fresh module (a reload) counts again and no storage key is ever written.
describe('one-shot steps', () => {
  function captureBeacon() {
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
    return sendBeacon;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
    vi.resetModules();
  });

  it('fire once per page load and write nothing to storage', async () => {
    sessionStorage.clear();
    const sendBeacon = captureBeacon();
    vi.resetModules();
    const m = await import('../../utils/funnelBeacon');
    m.sendFunnelBeaconOnce('welcome_shown');
    m.sendFunnelBeaconOnce('welcome_shown');
    m.sendFunnelBeaconOnce('first_turn');
    expect(sendBeacon).toHaveBeenCalledTimes(3); // welcome_shown, first_turn, engaged
    expect(m.hasFiredFunnelStep('welcome_shown')).toBe(true);
    expect(m.hasFiredFirstTurn()).toBe(true);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('count again after a reload', async () => {
    const sendBeacon = captureBeacon();
    vi.resetModules();
    (await import('../../utils/funnelBeacon')).sendFunnelBeaconOnce('welcome_shown');
    vi.resetModules();
    const reloaded = await import('../../utils/funnelBeacon');
    expect(reloaded.hasFiredFunnelStep('welcome_shown')).toBe(false);
    reloaded.sendFunnelBeaconOnce('welcome_shown');
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});

// The real-use steps carry the landing's source class exactly as the first
// chat does, and council_heard is its own one-shot that never touches engaged.
describe('engaged and council_heard', () => {
  function captureBeacon() {
    const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
    return sendBeacon;
  }
  async function bodies(sendBeacon: ReturnType<typeof captureBeacon>) {
    return Promise.all(sendBeacon.mock.calls.map(async (c) => JSON.parse(await c[1].text())));
  }
  async function loadWithSource(hash: string) {
    window.history.replaceState({}, '', `/app${hash}`);
    vi.resetModules();
    (await import('../../utils/arrivalSource')).captureArrivalSourceFromUrl();
    return import('../../utils/funnelBeacon');
  }

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    Reflect.deleteProperty(navigator, 'sendBeacon');
    vi.resetModules();
  });

  it('engaged carries the source class on the first arm and on both', async () => {
    const sendBeacon = captureBeacon();
    const m = await loadWithSource('#src=ad_google');
    m.sendFunnelBeaconOnce('first_turn');
    m.noteEngagedListenMilestone();
    const sent = await bodies(sendBeacon);
    const engaged = sent.filter((b) => b.step === 'engaged');
    expect(engaged.map((b) => b.mode)).toEqual(['typed', 'both']);
    for (const b of engaged) expect(b.source).toBe('ad_google');
    expect(sent.find((b) => b.step === 'first_turn')!.source).toBe('ad_google');
  });

  it('engaged goes without a class when the visit brought none', async () => {
    const sendBeacon = captureBeacon();
    const m = await loadWithSource('');
    m.noteEngagedListenSeconds(m.ENGAGED_LISTEN_SECONDS);
    const [row] = await bodies(sendBeacon);
    expect(row.step).toBe('engaged');
    expect(row.mode).toBe('listened');
    expect(row.source).toBeUndefined();
  });

  it('other steps still carry no class', async () => {
    const sendBeacon = captureBeacon();
    const m = await loadWithSource('#src=search');
    m.sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });
    m.sendFunnelBeacon('council_open');
    for (const b of await bodies(sendBeacon)) expect(b.source).toBeUndefined();
  });

  it('council_heard fires once, at two minutes or the first quarter, with the class', async () => {
    const sendBeacon = captureBeacon();
    const m = await loadWithSource('#src=search');
    m.noteCouncilHeardSeconds(m.ENGAGED_LISTEN_SECONDS - 1);
    expect(sendBeacon).not.toHaveBeenCalled();
    m.noteCouncilHeardSeconds(m.ENGAGED_LISTEN_SECONDS);
    m.noteCouncilHeardMilestone();
    m.noteCouncilHeardSeconds(600);
    const sent = await bodies(sendBeacon);
    expect(sent).toHaveLength(1);
    expect(sent[0].step).toBe('council_heard');
    expect(sent[0].source).toBe('search');
    expect(sent[0].mode).toBeUndefined();
    expect(sent[0].figureId).toBeUndefined();
  });

  it('council_heard never qualifies engaged', async () => {
    const sendBeacon = captureBeacon();
    const m = await loadWithSource('');
    m.noteCouncilHeardMilestone();
    const sent = await bodies(sendBeacon);
    expect(sent.map((b) => b.step)).toEqual(['council_heard']);
    expect(sessionStorage.length).toBe(0);
  });
});
