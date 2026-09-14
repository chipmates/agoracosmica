import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sourceClass } from '../../utils/sourceClass';

const LANDING = 'https://agoracosmica.org/de/figures/aurelius';

describe('sourceClass ad parameters', () => {
  it('labels a grant click from the click id alone', () => {
    expect(sourceClass(`${LANDING}?gclid=Cj0KCQiA`, '')).toBe('ad_google');
  });

  it('labels a paid click from the paid marker', () => {
    expect(sourceClass(`${LANDING}?p=1`, '')).toBe('ad_google');
    // Any other value of p is not the marker.
    expect(sourceClass(`${LANDING}?p=2`, '')).toBe('direct');
  });

  it('labels a Reddit ad from either marker', () => {
    expect(sourceClass(`${LANDING}?utm_source=reddit`, '')).toBe('ad_reddit');
    expect(sourceClass(`${LANDING}?utm_source=Reddit`, '')).toBe('ad_reddit');
    expect(sourceClass(`${LANDING}?rdt_cid=abc123`, '')).toBe('ad_reddit');
  });

  it('puts the ad parameter ahead of the referrer', () => {
    // An ad click usually carries the network's own host as its referrer.
    expect(sourceClass(`${LANDING}?gclid=Cj0KCQiA`, 'https://www.google.com/')).toBe('ad_google');
    expect(sourceClass(`${LANDING}?rdt_cid=abc`, 'https://www.reddit.com/r/philosophy/')).toBe('ad_reddit');
    // Google first when a URL somehow carries both.
    expect(sourceClass(`${LANDING}?gclid=Cj0&utm_source=reddit`, '')).toBe('ad_google');
  });

  it('ignores an unparsable landing URL and falls through to the referrer', () => {
    expect(sourceClass('not a url', 'https://www.bing.com/')).toBe('search');
  });
});

describe('sourceClass referrer classes', () => {
  it('labels search engines, country domains included', () => {
    for (const referrer of [
      'https://www.google.com/',
      'https://www.google.de/search?q=marcus',
      'https://www.google.co.uk/',
      'https://images.google.com/',
      'https://www.bing.com/',
      'https://duckduckgo.com/',
      'https://www.ecosia.org/',
      'https://search.yahoo.com/',
      'https://www.startpage.com/',
      'https://www.qwant.com/',
      'https://search.brave.com/',
      'https://yandex.ru/',
      'https://www.baidu.com/',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('search');
    }
  });

  it('labels AI assistants, including the ones on a Google domain', () => {
    for (const referrer of [
      'https://chatgpt.com/',
      'https://openai.com/',
      'https://www.perplexity.ai/',
      'https://claude.ai/',
      'https://www.anthropic.com/',
      'https://copilot.microsoft.com/',
      'https://gemini.google.com/app',
      'https://bard.google.com/',
      'https://you.com/',
      'https://www.phind.com/',
      'https://kagi.com/',
      'https://chat.mistral.ai/',
      'https://x.ai/',
      'https://grok.com/',
      'https://www.meta.ai/',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('assistant');
    }
  });

  it('labels Reddit, and keeps it out of the social bucket', () => {
    expect(sourceClass(LANDING, 'https://www.reddit.com/r/Stoicism/')).toBe('reddit');
    expect(sourceClass(LANDING, 'https://old.reddit.com/r/Stoicism/')).toBe('reddit');
    expect(sourceClass(LANDING, 'https://redd.it/abc123')).toBe('reddit');
  });

  it('labels social and community hosts', () => {
    for (const referrer of [
      'https://x.com/someone',
      'https://twitter.com/someone',
      'https://t.co/abc',
      'https://www.facebook.com/',
      'https://fb.com/',
      'https://www.instagram.com/',
      'https://www.linkedin.com/feed/',
      'https://lnkd.in/abc',
      'https://mastodon.social/@someone',
      'https://bsky.app/profile/someone',
      'https://www.threads.net/',
      'https://www.youtube.com/watch?v=abc',
      'https://youtu.be/abc',
      'https://www.tiktok.com/',
      'https://www.pinterest.com/',
      'https://news.ycombinator.com/item?id=1',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('social');
    }
  });

  it('labels any other site as a referral', () => {
    expect(sourceClass(LANDING, 'https://example.com/post')).toBe('referral');
    expect(sourceClass(LANDING, 'https://blog.philosophie.de/artikel')).toBe('referral');
  });

  it('matches whole host labels only, never a lookalike', () => {
    expect(sourceClass(LANDING, 'https://notgoogle.com/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://reddit.com.attacker.net/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://fake-reddit.com/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://mygoogle.de/')).toBe('referral');
  });

  it('reads no referrer, and an unreadable one, as direct', () => {
    expect(sourceClass(LANDING, '')).toBe('direct');
    expect(sourceClass(LANDING, 'not a url')).toBe('direct');
    expect(sourceClass(LANDING, 'about:client')).toBe('direct');
  });

  it('returns nothing for our own hosts, so an internal navigation is never labelled', () => {
    expect(sourceClass(LANDING, 'https://agoracosmica.org/de/')).toBeUndefined();
    expect(sourceClass(LANDING, 'https://www.agoracosmica.org/')).toBeUndefined();
    expect(sourceClass(LANDING, 'https://app.agoracosmica.org/')).toBeUndefined();
    // A preview or local host is its own: the landing URL's host counts too.
    expect(sourceClass('http://localhost:5173/app', 'http://localhost:5173/')).toBeUndefined();
  });

  it('ignores case and ports in the referrer host', () => {
    expect(sourceClass(LANDING, 'https://WWW.GOOGLE.COM/search')).toBe('search');
    expect(sourceClass(LANDING, 'https://www.google.com:8443/search')).toBe('search');
    expect(sourceClass(LANDING, 'HTTPS://Old.Reddit.Com/r/Stoicism/')).toBe('reddit');
    expect(sourceClass(LANDING, 'https://AGORACOSMICA.ORG/de/')).toBeUndefined();
  });
});

// The marketing pages classify their own landings with a plain-JS twin of this
// module. Most landings on the site are marketing pages, so a drift between the
// two lists would label the same arrival two different ways. This lifts the
// twin out of the shipped script and runs both over the same cases.
const TWIN_REL = 'marketing/public/agc-public.js';
const TWIN_START = '// Source class of a landing pageview';
const TWIN_END = '// Did this pageview open the visit?';

/** Walk up from the test runner's root until the repository root shows up. */
function twinPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(dir, TWIN_REL);
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, '..');
  }
  throw new Error(`${TWIN_REL} not found above ${process.cwd()}`);
}

function loadMarketingTwin(): (landingUrl: string, referrer: string) => string | undefined {
  const script = readFileSync(twinPath(), 'utf8');
  const from = script.indexOf(TWIN_START);
  const to = script.indexOf(TWIN_END);
  if (from < 0 || to < 0 || to <= from) {
    throw new Error('the marketing twin moved: update TWIN_START / TWIN_END in this test');
  }
  const block = script.slice(from, to);
  return new Function(`${block}\nreturn sourceClass;`)() as (l: string, r: string) => string | undefined;
}

describe('the marketing twin in agc-public.js', () => {
  const twin = loadMarketingTwin();

  const CASES: [string, string][] = [
    [LANDING, ''],
    [LANDING, 'not a url'],
    [`${LANDING}?gclid=Cj0KCQiA`, 'https://www.google.com/'],
    [`${LANDING}?p=1`, ''],
    [`${LANDING}?p=2`, ''],
    [`${LANDING}?utm_source=Reddit`, 'https://www.reddit.com/'],
    [`${LANDING}?rdt_cid=abc`, ''],
    [LANDING, 'https://www.google.de/search?q=marcus'],
    [LANDING, 'https://www.google.co.uk/'],
    [LANDING, 'https://yandex.ru/'],
    [LANDING, 'https://gemini.google.com/app'],
    [LANDING, 'https://chatgpt.com/'],
    [LANDING, 'https://www.perplexity.ai/'],
    [LANDING, 'https://old.reddit.com/r/Stoicism/'],
    [LANDING, 'https://redd.it/abc'],
    [LANDING, 'https://x.com/someone'],
    [LANDING, 'https://news.ycombinator.com/item?id=1'],
    [LANDING, 'https://youtu.be/abc'],
    [LANDING, 'https://example.com/post'],
    [LANDING, 'https://notgoogle.com/'],
    [LANDING, 'https://reddit.com.attacker.net/'],
    [LANDING, 'https://WWW.GOOGLE.COM/search'],
    [LANDING, 'https://www.google.com:8443/'],
    [LANDING, 'https://www.agoracosmica.org/'],
    ['http://localhost:5173/app', 'http://localhost:5173/'],
  ];

  it('labels every case exactly as this module does', () => {
    for (const [landingUrl, referrer] of CASES) {
      expect(twin(landingUrl, referrer), `${landingUrl} from "${referrer}"`)
        .toBe(sourceClass(landingUrl, referrer));
    }
  });
});

// The field assembly in the page beacon: the source rides on a landing and on
// nothing else, and the rest of the payload is untouched.
describe('the page beacon payload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('sends the source class on a landing, and no field on an internal navigation', async () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) });
      return Promise.resolve();
    });
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.de/search?q=marcus',
      configurable: true,
    });

    const { sendPageBeacon } = await import('../../utils/pageBeacon');
    sendPageBeacon();
    expect(sent[0].body.landing).toBe(1);
    expect(sent[0].body.source).toBe('search');
    expect(sent[0].body.path).toBe(window.location.pathname);

    // The module counts the first beacon as the only possible landing, so the
    // second one is an internal navigation and carries neither field.
    sendPageBeacon();
    expect(sent[1].body).not.toHaveProperty('landing');
    expect(sent[1].body).not.toHaveProperty('source');
    expect(sent[1].body.path).toBe(window.location.pathname);
  });
});
