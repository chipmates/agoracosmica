// The app's counts and conversions go to the production worker, so a build
// posts them only from a page served on the production site. A local build, a
// preview or a copy elsewhere sends nothing, and the live site sends as before.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onProductionHost, mayPostTo, PRODUCTION_HOSTS } from '../../utils/productionHost';

const WORKER = 'https://llm.agoracosmica.org';
const CLICK = 'TESTCLICKID0001';
const YES = JSON.stringify({ granted: true, version: '1.2.0', timestamp: Date.now() });

const ELSEWHERE = [
  'http://localhost:3000/',
  'http://127.0.0.1:5490/',
  'https://beacons-1021.agora-cosmica.pages.dev/',
  'https://llm.agoracosmica.org/',
  'https://agoracosmica.org.example.com/',
];
const LIVE = ['https://agoracosmica.org/', 'https://www.agoracosmica.org/'];

function serveFrom(url: string): void {
  (globalThis as unknown as { jsdom: { reconfigure(o: { url: string }): void } }).jsdom.reconfigure({ url });
}

let posts: { url: string; body: Record<string, unknown> }[] = [];

function capture(url: string, body: string): void {
  posts.push({ url, body: JSON.parse(body) });
}

beforeEach(() => {
  posts = [];
  sessionStorage.clear();
  localStorage.clear();
  // A production build: the worker address is production's, DEV is off.
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_FREE_TIER_API_URL', WORKER);
  vi.stubGlobal('fetch', (url: string, init: { body: string }) => {
    capture(String(url), init.body);
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string, blob: Blob) => {
      void blob.text().then((text) => capture(String(url), text));
      return true;
    }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'sendBeacon');
  window.history.replaceState({}, '', '/');
  serveFrom('http://localhost:3000/');
});

/**
 * Open `path` on `origin` as a fresh page load, then fire every sender the app
 * has: the page, entry and signup counts, a one-shot and a volume funnel step,
 * a playback event by fetch and by sendBeacon, and a conversion with a yes and
 * a click ID on record. Returns the funnel module to read its page state.
 */
async function fireEverySender(origin: string, path = `/app?gclid=${CLICK}`) {
  serveFrom(origin);
  window.history.replaceState({}, '', path);
  localStorage.setItem('agc_ad_consent', YES);
  vi.resetModules();
  const gclid = await import('../../utils/public/gclidCapture');
  const funnel = await import('../../utils/funnelBeacon');
  const { sendPageBeacon } = await import('../../utils/pageBeacon');
  const { sendEntryBeacon } = await import('../../utils/entryBeacon');
  const { sendSignupBeacon } = await import('../../utils/signupBeacon');
  const { sendPlaybackBeacon } = await import('../../utils/playbackBeacon');

  sendPageBeacon();
  sendEntryBeacon();
  sendSignupBeacon();
  funnel.sendFunnelBeaconOnce('first_turn', { figureId: 'aurelius', mode: 'story' });
  funnel.sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });
  sendPlaybackBeacon({ type: 'story', event: 'started', figureId: 'aurelius', mode: 'story', language: 'en' });
  sendPlaybackBeacon({ type: 'story', event: 'ended', figureId: 'aurelius', mode: 'story', language: 'en', bucket: 1 }, 'beacon');
  gclid.captureGclid();
  await gclid.sendConversion('profile_created');
  await new Promise((r) => setTimeout(r, 0));
  return funnel;
}

function endpoints(): string[] {
  return posts.map((p) => new URL(p.url).pathname).sort();
}

describe('onProductionHost', () => {
  it('names the two hosts of the live site, the same two the public pages use', () => {
    expect([...PRODUCTION_HOSTS]).toEqual(['agoracosmica.org', 'www.agoracosmica.org']);
  });

  it('is true on the live site and false everywhere else', () => {
    for (const url of LIVE) {
      serveFrom(url);
      expect(onProductionHost(), url).toBe(true);
    }
    for (const url of ELSEWHERE) {
      serveFrom(url);
      expect(onProductionHost(), url).toBe(false);
    }
  });
});

describe('a build off the production site', () => {
  it('sends nothing at all from a local build, a preview or a copy', async () => {
    for (const origin of ELSEWHERE) {
      posts = [];
      await fireEverySender(origin);
      expect(posts, origin).toEqual([]);
    }
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it('sends no paid arrival either', async () => {
    await fireEverySender('http://127.0.0.1:5490/', '/app?p=1');
    expect(posts).toEqual([]);
  });

  it('sends nothing to a worker of its own either', async () => {
    for (const base of ['', 'http://localhost:8788']) {
      vi.stubEnv('VITE_FREE_TIER_API_URL', base);
      posts = [];
      await fireEverySender('http://localhost:3000/');
      expect(posts, base || 'relative').toEqual([]);
    }
  });

  it('runs the same page state as the live site, minus the posts', async () => {
    const funnel = await fireEverySender('http://localhost:3000/');
    expect(posts).toEqual([]);
    // first_reply waits on first_turn, so the one-shot is still marked
    expect(funnel.hasFiredFirstTurn()).toBe(true);
    expect(funnel.hasFiredFunnelStep('first_turn')).toBe(true);
  });

  it('writes no conversion flag for a send that never left', async () => {
    await fireEverySender('http://localhost:3000/');
    expect(sessionStorage.getItem('agc_conv_fired_profile_created')).toBeNull();
  });
});

describe('a build on the production site', () => {
  it('sends every count as before, from either host', async () => {
    for (const origin of LIVE) {
      posts = [];
      await fireEverySender(origin, '/app?p=1');
      // ?p=1 adds the paid arrival and keeps no click ID, so no conversion
      expect(endpoints(), origin).toEqual([
        '/v1/entry',
        '/v1/funnel',
        '/v1/funnel',
        '/v1/funnel',
        '/v1/funnel',
        '/v1/page',
        '/v1/playback',
        '/v1/playback',
        '/v1/signup',
      ]);
      const steps = posts.filter((p) => p.url.endsWith('/v1/funnel')).map((p) => p.body.step).sort();
      expect(steps, origin).toEqual(['engaged', 'figure_selected', 'first_turn', 'paid_arrival']);
      expect(posts.every((p) => p.url.startsWith(`${WORKER}/`)), origin).toBe(true);
    }
  });

  it('sends the conversion of a visitor with a yes and a click ID', async () => {
    await fireEverySender(LIVE[0]);
    const conversions = posts.filter((p) => p.url === `${WORKER}/api/conversions`);
    expect(conversions).toHaveLength(1);
    expect(conversions[0].body).toMatchObject({ gclid: CLICK, event: 'profile_created' });
  });

  it('adds no field to any body', async () => {
    await fireEverySender(LIVE[0], '/app?p=1');
    const allowed = new Set([
      'path', 'language', 'landing', 'source', 'probe', 'step', 'figureId', 'mode', 'outcome',
      'bucket', 'type', 'event', 'chapter',
    ]);
    for (const post of posts) {
      for (const key of Object.keys(post.body)) expect(allowed.has(key), `${post.url} ${key}`).toBe(true);
    }
  });
});

describe('the dev server', () => {
  beforeEach(() => vi.stubEnv('DEV', true));

  it('posts to a worker of its own, which the end-to-end suites read', async () => {
    vi.stubEnv('VITE_FREE_TIER_API_URL', '');
    await fireEverySender('https://localhost:5173/');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => !p.url.includes('agoracosmica.org')), 'relative addresses only').toBe(true);
    expect(posts.some((p) => p.url === '/api/conversions')).toBe(true);
  });

  it('never posts to the production worker', async () => {
    await fireEverySender('https://localhost:5173/');
    expect(posts).toEqual([]);
  });

  it('decides by the address alone', () => {
    serveFrom('https://localhost:5173/');
    expect(mayPostTo('')).toBe(true);
    expect(mayPostTo('http://localhost:8788')).toBe(true);
    expect(mayPostTo(WORKER)).toBe(false);
    expect(mayPostTo('https://agoracosmica.org')).toBe(false);
  });
});
