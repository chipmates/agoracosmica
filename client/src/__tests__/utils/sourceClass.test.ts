import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOST_LISTS, HOST_PATTERNS, sourceClass } from '../../utils/sourceClass';

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

  it('labels social hosts', () => {
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
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('social');
    }
  });

  it('labels learning platforms as edu', () => {
    for (const referrer of [
      'https://canvas.instructure.com/courses/1',
      'https://app.schoology.com/',
      'https://blackboard.com/',
      'https://school.brightspace.com/',
      'https://www.d2l.com/',
      'https://mycourse.moodlecloud.com/',
      'https://classroom.google.com/c/abc',
      'https://www.edmodo.com/',
      'https://app.seesaw.me/',
      'https://clever.com/',
      'https://www.itslearning.com/',
      'https://padlet.com/wall',
      'https://mebis.bycs.de/',
      'https://www.lernraum-berlin.de/',
      'https://schul.cloud/',
      'https://gymnasium.iserv.de/',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('edu');
    }
  });

  it('labels schools and universities by the shape of their name', () => {
    for (const referrer of [
      'https://harvard.edu/',
      'https://www.mit.edu/news',
      'https://ox.ac.uk/',
      'https://www.cam.ac.uk/',
      'https://sydney.edu.au/',
      'https://www.uni.edu.pl/',
      'https://lycee.sch.gr/',
      'https://www.somedistrict.k12.ca.us/',
      'https://gymnasium.schule/',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('edu');
    }
  });

  it('reads a word inside a label as no pattern at all', () => {
    expect(sourceClass(LANDING, 'https://education.example.com/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://myschule.de/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://eduscience.com/')).toBe('referral');
    // The pattern is anchored at the end, so a lookalike cannot borrow it.
    expect(sourceClass(LANDING, 'https://ox.ac.uk.attacker.net/')).toBe('referral');
  });

  it('labels mail clients and newsletter senders', () => {
    for (const referrer of [
      'https://mail.google.com/mail/u/0/',
      'https://outlook.live.com/mail/0/',
      'https://outlook.office.com/mail/',
      'https://outlook.office365.com/mail/',
      'https://mail.yahoo.com/',
      'https://mail.proton.me/',
      'https://navigator.gmx.net/',
      'https://navigator.web.de/',
      'https://mail.zoho.com/',
      'https://someone.substack.com/p/post',
      'https://letter.beehiiv.com/',
      'https://mailchi.mp/abc/news',
      'https://buttondown.email/archive',
      'https://buttondown.com/archive',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('mail');
    }
  });

  it('labels chat apps as messenger', () => {
    for (const referrer of [
      'https://discord.com/channels/1/2',
      'https://discordapp.com/',
      'https://web.whatsapp.com/',
      'https://web.telegram.org/',
      'https://t.me/somechannel',
      'https://teams.microsoft.com/',
      'https://teams.live.com/',
      'https://app.slack.com/client/abc',
      'https://slack.com/',
      'https://signal.me/#p/abc',
      'https://app.element.io/',
      'https://matrix.to/#/room',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('messenger');
    }
  });

  it('labels code hosts', () => {
    for (const referrer of [
      'https://github.com/chipmates/agoracosmica',
      'https://gitlab.com/group/project',
      'https://codeberg.org/user/repo',
      'https://bitbucket.org/user/repo',
      'https://sr.ht/~user/repo',
      'https://gitea.com/user/repo',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('code');
    }
  });

  it('labels tech news and link aggregators', () => {
    for (const referrer of [
      'https://news.ycombinator.com/item?id=1',
      'https://lobste.rs/s/abc',
      'https://slashdot.org/story/1',
      'https://tildes.net/~tech',
      'https://www.indiehackers.com/post/abc',
      'https://www.producthunt.com/posts/abc',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('news');
    }
  });

  it('labels wikis', () => {
    for (const referrer of [
      'https://en.wikipedia.org/wiki/Stoicism',
      'https://de.wikipedia.org/wiki/Stoa',
      'https://commons.wikimedia.org/wiki/File',
      'https://en.wikiquote.org/wiki/Marcus',
      'https://en.wikisource.org/wiki/Meditations',
      'https://www.wikidata.org/wiki/Q1',
      'https://en.wikiversity.org/wiki/Course',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('wiki');
    }
  });

  it('labels software and tool directories', () => {
    for (const referrer of [
      'https://alternativeto.net/software/abc/',
      'https://openalternative.co/abc',
      'https://european-alternatives.eu/alternative-to/abc',
      'https://theresanaiforthat.com/ai/abc/',
      'https://www.futuretools.io/tools/abc',
      'https://www.toolify.ai/tool/abc',
      'https://www.futurepedia.io/tool/abc',
      'https://www.saashub.com/abc',
      'https://www.libhunt.com/r/abc',
      'https://www.opensourcealternative.to/alternativesto/abc',
    ]) {
      expect(sourceClass(LANDING, referrer)).toBe('directory');
    }
  });

  it('keeps Hacker News in news, not in social', () => {
    expect(sourceClass(LANDING, 'https://news.ycombinator.com/item?id=1')).toBe('news');
  });

  it('resolves the hosts that sit inside another class host', () => {
    // These are the collisions the precedence exists for: the specific lists
    // run before the search rule, which matches google.com by suffix.
    expect(sourceClass(LANDING, 'https://classroom.google.com/c/abc')).toBe('edu');
    expect(sourceClass(LANDING, 'https://mail.google.com/mail/u/0/')).toBe('mail');
    expect(sourceClass(LANDING, 'https://gemini.google.com/app')).toBe('assistant');
    expect(sourceClass(LANDING, 'https://www.google.com/search?q=stoicism')).toBe('search');
    expect(sourceClass(LANDING, 'https://scholar.google.com/citations')).toBe('search');
    expect(sourceClass(LANDING, 'https://teams.microsoft.com/')).toBe('messenger');
    expect(sourceClass(LANDING, 'https://copilot.microsoft.com/')).toBe('assistant');
    expect(sourceClass(LANDING, 'https://harvard.edu/')).toBe('edu');
    expect(sourceClass(LANDING, 'https://ox.ac.uk/')).toBe('edu');
    expect(sourceClass(LANDING, 'https://sydney.edu.au/')).toBe('edu');
    expect(sourceClass(LANDING, 'https://education.example.com/')).toBe('referral');
    expect(sourceClass(LANDING, 'https://gymnasium.schule/')).toBe('edu');
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

interface MarketingTwin {
  sourceClass: (landingUrl: string, referrer: string) => string | undefined;
  lists: Record<string, string[]>;
  patterns: Record<string, RegExp>;
}

function loadMarketingTwin(): MarketingTwin {
  const script = readFileSync(twinPath(), 'utf8');
  const from = script.indexOf(TWIN_START);
  const to = script.indexOf(TWIN_END);
  if (from < 0 || to < 0 || to <= from) {
    throw new Error('the marketing twin moved: update TWIN_START / TWIN_END in this test');
  }
  const block = script.slice(from, to);
  return new Function(
    `${block}
     return {
       sourceClass: sourceClass,
       lists: HOST_LISTS,
       patterns: { search: MULTI_TLD_SEARCH, edu: EDU_NAME_PATTERN },
     };`
  )() as MarketingTwin;
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
    // The collisions the precedence exists for, plus one host per class.
    [LANDING, 'https://classroom.google.com/c/abc'],
    [LANDING, 'https://mail.google.com/mail/u/0/'],
    [LANDING, 'https://scholar.google.com/citations'],
    [LANDING, 'https://teams.microsoft.com/'],
    [LANDING, 'https://copilot.microsoft.com/'],
    [LANDING, 'https://canvas.instructure.com/courses/1'],
    [LANDING, 'https://harvard.edu/'],
    [LANDING, 'https://ox.ac.uk/'],
    [LANDING, 'https://sydney.edu.au/'],
    [LANDING, 'https://www.somedistrict.k12.ca.us/'],
    [LANDING, 'https://gymnasium.schule/'],
    [LANDING, 'https://education.example.com/'],
    [LANDING, 'https://ox.ac.uk.attacker.net/'],
    [LANDING, 'https://someone.substack.com/p/post'],
    [LANDING, 'https://discord.com/channels/1/2'],
    [LANDING, 'https://t.me/somechannel'],
    [LANDING, 'https://github.com/chipmates/agoracosmica'],
    [LANDING, 'https://lobste.rs/s/abc'],
    [LANDING, 'https://en.wikipedia.org/wiki/Stoicism'],
    [LANDING, 'https://alternativeto.net/software/abc/'],
  ];

  // A case list can only catch a host it happens to name, so the lists
  // themselves are compared entry for entry: a host added to one side only
  // fails here.
  it('carries the same host lists in the same order', () => {
    expect(Object.keys(twin.lists)).toEqual(Object.keys(HOST_LISTS));
    for (const [key, hosts] of Object.entries(HOST_LISTS)) {
      expect(twin.lists[key], `host list "${key}"`).toEqual([...hosts]);
    }
  });

  it('carries the same host patterns', () => {
    expect(Object.keys(twin.patterns)).toEqual(Object.keys(HOST_PATTERNS));
    for (const [key, pattern] of Object.entries(HOST_PATTERNS)) {
      expect(twin.patterns[key].source, `pattern "${key}"`).toBe(pattern.source);
      expect(twin.patterns[key].flags, `flags of pattern "${key}"`).toBe(pattern.flags);
    }
  });

  it('labels every case exactly as this module does', () => {
    for (const [landingUrl, referrer] of CASES) {
      expect(twin.sourceClass(landingUrl, referrer), `${landingUrl} from "${referrer}"`)
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
