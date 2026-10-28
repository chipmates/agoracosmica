// React island: ad-measurement consent prompt for Google ad-grant arrivals.
// NAMING CONSTRAINT: the file name becomes a public chunk URL and must stay
// free of ad-tech-looking words (ad, consent+ad, conversion, track): content
// blockers match those in URLs and would keep the card from ever loading.
// Non-blocking: the page stays fully readable and usable behind it (no wall,
// no scroll lock, no focus trap), which is what keeps the consent lawful
// (EDPB cookie-wall rule).
//
// When it asks is a split test, drawn at random once per page load for an
// undecided grant arrival (LATER_SHARE below): the arrival arm asks at once,
// on any page; the later arm asks on a page with the story player once a
// minute of story audio has been heard, on a page with poems once a poem's
// last line has been in view for its reading time (utils/cardMoment.ts), and
// on no other page. The words are the same in both. The arm lives in page
// memory only, never stored, never sent to Google. Until the answer the
// click ID lives in page memory only: it leaves the address bar when this
// module loads, nothing about the ad is stored, and a full page load forgets
// it (a reload no longer asks).
//
//   Accept  -> grantAdConsent() stores the yes and the click ID, then
//              start_exploring and a Listened crossing held since it happened.
//   Decline -> the no is recorded, the click ID and the seconds dropped,
//              nothing sent. Remembered, so the visitor is not asked again.
//   Close   -> a no for this visit: the click ID and the seconds dropped,
//              nothing stored, nothing sent. The next ad arrival asks again.
//
// Copy is legally reviewed: the withdrawal notice, the privacy and Google
// links, the click-ID scope sentence, the account and USA sentence and the
// age line are all load bearing and none of them may be dropped for space.
// The site's trust line stays off this card on purpose: beside a yes it reads
// as a promise about Google's side, which we cannot make.
// On a short screen the words scroll inside the card instead; the answers
// and the close control never scroll. A change to what the yes covers bumps
// AD_CONSENT_VERSION (gclidCapture.ts, agc-public.js), so an earlier yes is
// asked again (an earlier no stays a no). Lift into publicI18n if it ever
// needs more languages.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  captureGclid,
  clearGclid,
  getGclid,
  isPaidVisitor,
  adConsentDecided,
  grantAdConsent,
} from '@client/utils/public/gclidCapture';
import { isProbeSessionNow, probeField } from '@client/utils/probeSession';
import {
  armPreDecisionListening,
  clickId,
  dropPreDecisionListening,
  flushPreDecisionListening,
  holdArm,
  holdClick,
  keepClickAfterYes,
  onProductionHost,
  revokeAdConsent,
} from '../utils/heardSeconds';
import type { CardArm } from '../utils/heardSeconds';
import {
  boxesOverlap,
  findPoemEnds,
  watchPoemEnd,
  watchStorySeconds,
} from '../utils/cardMoment';
import type { StorySource } from '../utils/cardMoment';
import './ArrivalChoice.css';

interface Props {
  lang: 'en' | 'de';
}

const COPY = {
  en: {
    kicker: 'One question about this ad',
    heading: 'May we count your visit for Google?',
    lead: 'We’re a small nonprofit, and Google gives us these ads for free. Counted visits help them reach more people searching for the same thing.',
    fine: 'A yes sends Google the ad’s click ID. That way Google sees the ad brought you to us, and whether you listened for 30 seconds. Google can link it to your Google account and may process it in the USA. We don’t allow it for personalised ads. Nothing else about you. Your browser remembers your answer for a year. You can turn this off anytime under “Ad measurement” at the foot of every page. Either way, the whole library stays open.',
    age: 'If you’re under 16, please say no.',
    accept: 'Yes, count it',
    decline: 'No, don’t count it',
    close: 'Close. This counts as no.',
    link: 'See the code',
    privacy: 'Privacy policy',
    privacyHref: '/privacy/',
    google: 'How Google uses this',
  },
  de: {
    kicker: 'Eine Frage zu dieser Anzeige',
    heading: 'Dürfen wir deinen Besuch für Google zählen?',
    lead: 'Wir sind klein und gemeinnützig, und Google schenkt uns diese Anzeigen. Gezählte Besuche helfen ihnen, mehr Menschen zu erreichen, die dasselbe suchen.',
    fine: 'Ein Ja schickt Google die Klick-ID der Anzeige. So sieht Google, dass die Anzeige dich zu uns gebracht hat und ob du 30 Sekunden zugehört hast. Google kann sie deinem Google-Konto zuordnen und auch in den USA verarbeiten. Für personalisierte Werbung geben wir sie nicht frei. Sonst nichts über dich. Dein Browser merkt sich deine Antwort ein Jahr lang. Ausschalten kannst du das jederzeit unten auf jeder Seite unter „Werbe-Messung“. So oder so bleibt die Bibliothek offen.',
    age: 'Bist du unter 16, sag bitte Nein.',
    accept: 'Ja, zählen',
    decline: 'Nein, nicht zählen',
    close: 'Schließen. Das zählt als Nein.',
    link: 'Code ansehen',
    privacy: 'Datenschutzerklärung',
    privacyHref: '/datenschutz/',
    google: 'Wie Google das nutzt',
  },
} as const;

// Absolute worker URLs on purpose: agoracosmica.org has no /api/* or /v1/*
// route, so a relative path falls through the SPA fallback (/* -> index.html
// 200), the fetch resolves, .catch() never fires, and the beacon silently never
// arrives. CSP allows https://*.agoracosmica.org in connect-src and the worker
// CORS allows this origin. (Same posture as the former agc-public.js
// fireConversion.)
const CONVERSIONS_URL = 'https://llm.agoracosmica.org/api/conversions';
const FUNNEL_URL = 'https://llm.agoracosmica.org/v1/funnel';
const CODE_URL =
  'https://github.com/chipmates/agoracosmica/blob/main/client/src/utils/public/gclidCapture.ts';
const GOOGLE_PARTNER_URL = 'https://business.safety.google/privacy';
const SS_FIRED = 'agc_conv_fired_start_exploring';

// The later arm's share of undecided grant arrivals. At 0 every one of them
// gets the card at once, as before the split.
export const LATER_SHARE = 0.5;

// A browser test may fix the arm from an init script that runs before the
// page's own (window.__agcCardArm = 'arrival' or 'later'). Nothing in the
// address and nothing in storage can reach it.
const FORCED_ARM_KEY = '__agcCardArm';

function fairRandom(): number {
  try {
    const word = new Uint32Array(1);
    crypto.getRandomValues(word);
    return (word[0] as number) / 2 ** 32;
  } catch {
    return Math.random();
  }
}

/** The arm for this page load: the later arm with probability `share`, else the arrival arm. */
export function drawArm(share: number = LATER_SHARE, random: () => number = fairRandom): CardArm {
  try {
    const forced = (window as unknown as Record<string, unknown>)[FORCED_ARM_KEY];
    if (forced === 'arrival' || forced === 'later') return forced;
  } catch {
    // no window: draw
  }
  return random() < share ? 'later' : 'arrival';
}

// Anonymous consent counters: how many ad arrivals get asked, and what they
// answer. Same keyless posture as the cta_click beacon in agc-public.js: the
// step, the page path, the interface language, on the three answer steps a
// coarse time-to-answer bucket, and from a browser marked as in-house the
// probe constant every other count carries. It has to stay that way. A gclid
// or an id here would pair a user dimension with a consent decision, which is
// exactly what this measurement must not do.
type ConsentCounter =
  | 'ad_consent_shown'
  | 'ad_consent_accepted'
  | 'ad_consent_declined'
  | 'ad_consent_dismissed';

// How long the card has to be at least half in view before it counts as
// shown. Without it "shown" would mean "rendered", and an accept rate against
// cards nobody looked at is not a rate.
const SEEN_MS = 1000;
const SEEN_RATIO = 0.5;

// Time-to-answer buckets, in seconds, measured from the moment the card came
// into view (render where there is no IntersectionObserver). Four coarse
// buckets: 0 = under 1s, 1 = 1 to 3s, 2 = 3 to 10s, 3 = over 10s. A reflex tap
// and a read-then-decide look the same in the totals otherwise. Raw
// milliseconds never leave the browser, and the bucket rides the same keyless
// row as the step itself, so it adds no user dimension.
const ANSWER_BUCKETS_S: readonly number[] = [1, 3, 10];

// The card arrives while the visitor is busy with the page: a tap this soon
// after it appears was aimed at what stood there before (the rise takes 340 ms,
// a reaction to it about as long again), so it is ignored, not taken as an answer.
export const TAP_GUARD_MS = 700;

// How often a card that is due re-checks whether it can appear without
// covering what the visitor uses (the reading view, the line just read).
const CLEAR_CHECK_MS = 400;

// The player's mount, the same on every page that carries the dock.
const PLAYER_SELECTOR = '[data-astro-transition-persist="story-dock"], script[data-story-queue]';
// The play control is the dock's: the card stands above the dock and stacks
// under it (ArrivalChoice.css), on the dock's height as measured here, since
// the router's page change drops the height the dock publishes on <html>. The
// page's own copies of the playing story's button may sit under the card: a
// page carries several, and waiting for all of them to scroll away would leave
// most listeners unasked.
const DOCK_SELECTOR = '.story-dock';
// The map's label for the story that comes next, beside its star or as a line
// under the map: a card that comes later waits until it would not cover it.
const NEXT_LABEL_SELECTOR = '.sp-mapnext:not([hidden]), .sp-star__next';

function answerBucket(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  const crossed = ANSWER_BUCKETS_S.findIndex((edge) => seconds < edge);
  return crossed === -1 ? ANSWER_BUCKETS_S.length : crossed;
}

function nowMs(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch {
    // fall through to the wall clock
  }
  return Date.now();
}

// Once per page load, in page memory: counting writes nothing to storage.
const countedSteps = new Set<ConsentCounter>();

function countConsentStep(step: ConsentCounter, lang: Props['lang'], bucket?: number): void {
  if (!onProductionHost()) return;
  if (countedSteps.has(step)) return;
  countedSteps.add(step);
  try {
    // Path only, no query and no hash, exactly like the cta_click beacon.
    // The worker holds it to the same closed shape it holds that one to
    // (a short slug path or nothing), plus the coarse bucket on the three
    // answer steps. JSON drops an undefined bucket or probe, so a shown step
    // has no bucket and an unmarked browser sends no probe field at all.
    const body = JSON.stringify({
      step,
      path: window.location.pathname,
      language: lang,
      bucket,
      probe: probeField(),
    });
    // sendBeacon survives the navigation an accept can trigger. text/plain
    // keeps it a simple CORS request, so no preflight gets lost in transit.
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(FUNNEL_URL, new Blob([body], { type: 'text/plain' }))
    ) {
      return;
    }
    fetch(FUNNEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* never surface */
    });
  } catch {
    /* same posture */
  }
}

/**
 * The click ID leaves the address bar, so a reload or a shared link carries
 * none. The key stays, empty: the landing's source class reads an ad arrival
 * from it (agc-public.js), and a reload must still count as one. Every other
 * part of the address is kept as it was.
 */
export function dropClickIdFromAddress(): void {
  try {
    const { pathname, search, hash } = window.location;
    let carried = false;
    let found = false;
    const kept: string[] = [];
    for (const part of search.replace(/^\?/, '').split('&')) {
      if (!part) continue;
      const cut = part.indexOf('=');
      if ((cut < 0 ? part : part.slice(0, cut)) !== 'gclid') {
        kept.push(part);
        continue;
      }
      if (cut >= 0 && part.length > cut + 1) carried = true;
      if (!found) {
        found = true;
        kept.push('gclid=');
      }
    }
    if (!carried) return;
    window.history.replaceState(window.history.state, '', `${pathname}?${kept.join('&')}${hash}`);
  } catch {
    // history unavailable: the address keeps it, and this page never reads it again
  }
}

function fireStartExploring(): void {
  if (!onProductionHost()) return;
  const gclid = clickId();
  if (!gclid) return;
  if (isProbeSessionNow()) return; // our own test browsers send Google nothing
  try {
    if (sessionStorage.getItem(SS_FIRED)) return;
    sessionStorage.setItem(SS_FIRED, '1');
  } catch {
    // worker dedups via order_id (gclid:event), so a blocked store is fine
  }
  try {
    fetch(CONVERSIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gclid, event: 'start_exploring', timestamp: Date.now() }),
      keepalive: true,
    }).catch(() => {
      /* never surface */
    });
  } catch {
    /* same posture */
  }
}

// ---- the visit, in module memory ------------------------------------------
// The island mounts again after each page change the player's router makes in
// place; the module, and with it the question's state, stays.

type Phase = 'off' | 'waiting' | 'due' | 'done';

interface KeepClear {
  /** True while something covers the page the card would sit on (the reader). */
  blocked(): boolean;
  /** Boxes the card must not cover when it appears. */
  boxes(): DOMRect[];
  subscribe?(listener: () => void): () => void;
}

let phase: Phase = 'off';
let keepClear: KeepClear | null = null;
let stopMoment: (() => void) | null = null;
let arrived = false;
let pageArmed = false;
const phaseListeners = new Set<() => void>();
// A card that is up re-checks at once when its rule changes (the arrival arm
// is up before the player's rule has loaded).
const ruleListeners = new Set<() => void>();

function setKeepClear(rule: KeepClear | null): void {
  keepClear = rule;
  ruleListeners.forEach((listener) => listener());
}

function setPhase(next: Phase): void {
  phase = next;
  phaseListeners.forEach((listener) => listener());
}

function subscribePhase(listener: () => void): () => void {
  phaseListeners.add(listener);
  return () => {
    phaseListeners.delete(listener);
  };
}

const getPhase = (): Phase => phase;
const serverPhase = (): Phase => 'off';

/**
 * Once per page load, when this module first runs: the click ID goes into
 * page memory and out of the address. A grant arrival with no answer on
 * record draws its arm: the arrival arm is due at once, the later arm waits
 * for its moment.
 */
function arrive(): void {
  if (arrived || typeof window === 'undefined') return;
  arrived = true;
  captureGclid({ holdUntilAnswer: true }); // ?gclid into page memory, ?p=1 drops it
  const id = getGclid();
  holdClick(id);
  dropClickIdFromAddress();
  if (id === null || isPaidVisitor() || adConsentDecided()) return;
  const arm = drawArm();
  holdArm(arm);
  armPreDecisionListening();
  phase = arm === 'arrival' ? 'due' : 'waiting';
}

/** No question can come on this page: the held click ID goes now. */
function standDown(): void {
  clearGclid();
  holdClick(null);
  dropPreDecisionListening();
  setPhase('done');
}

/**
 * Once per page load, on the first mount, when the page's content is in place.
 * On a page with the story player the card steps back while the reading view
 * is open, in both arms.
 */
function armPage(): void {
  if (pageArmed) return;
  pageArmed = true;
  if (document.querySelector(PLAYER_SELECTOR)) {
    import('../player/controller')
      .then((player) => {
        const source: StorySource = player;
        const rule: KeepClear = {
          blocked: () => player.getState().readerOpen,
          boxes: () => Array.from(document.querySelectorAll(NEXT_LABEL_SELECTOR), (el) => el.getBoundingClientRect()),
          subscribe: player.subscribe,
        };
        if (phase === 'due') setKeepClear(rule);
        if (phase !== 'waiting') return;
        stopMoment = watchStorySeconds(source, () => {
          setKeepClear(rule);
          setPhase('due');
        });
      })
      .catch(() => {
        if (phase === 'waiting') standDown();
      });
    return;
  }
  if (phase !== 'waiting') return;
  const ends = findPoemEnds(document);
  if (ends.length) {
    stopMoment = watchPoemEnd(window, ends, (line) => {
      setKeepClear({
        blocked: () => false,
        boxes: () => {
          const box = line();
          return box ? [box] : [];
        },
      });
      setPhase('due');
    });
    return;
  }
  standDown();
}

/** The answer is in: the card never comes back on this visit. */
function finish(): void {
  stopMoment?.();
  stopMoment = null;
  setKeepClear(null);
  setPhase('done');
}

arrive();

export default function ArrivalChoice({ lang }: Props) {
  const current = useSyncExternalStore(subscribePhase, getPhase, serverPhase);
  // Due but held back: rendered invisible until it covers nothing in use.
  const [shown, setShown] = useState(false);
  const shownAtRef = useRef(0);
  const cardRef = useRef<HTMLElement | null>(null);
  const wordsRef = useRef<HTMLDivElement | null>(null);
  // Whether the words overflow their box (keyboard reach) and whether more
  // text waits below the fold of it (the fade cue).
  const [overflow, setOverflow] = useState({ scrolls: false, more: false });
  // Start of the time-to-answer window. Never transmitted, never stored: the
  // three answer beacons carry the coarse bucket derived from it and nothing
  // else.
  const seenAtRef = useRef<number | null>(null);
  const t = COPY[lang] ?? COPY.en;

  useEffect(() => {
    armPage();
  }, []);

  // The moment has come: appear as soon as the card's place is clear of the
  // line just read, and step back while the reading view covers the page.
  useEffect(() => {
    if (current !== 'due') return;
    let showing = false;
    // The arrival arm is up before the player's rule exists: follow it once it does.
    let followed: KeepClear | null = null;
    let unsubscribe: (() => void) | undefined;
    const check = (): void => {
      const card = cardRef.current;
      if (!card) return;
      const dock = document.querySelector(DOCK_SELECTOR);
      if (dock) card.style.setProperty('--agc-dock-h', `${dock.getBoundingClientRect().height}px`);
      else card.style.removeProperty('--agc-dock-h');
      const rule = keepClear;
      if (rule !== followed) {
        unsubscribe?.();
        unsubscribe = rule?.subscribe?.(check);
        followed = rule;
      }
      if (rule?.blocked()) {
        if (showing) {
          showing = false;
          setShown(false);
        }
        return;
      }
      if (showing) return;
      const box = card.getBoundingClientRect();
      if (rule && rule.boxes().some((other) => boxesOverlap(box, other))) return;
      showing = true;
      shownAtRef.current = nowMs();
      setShown(true);
    };
    check();
    const timer = window.setInterval(check, CLEAR_CHECK_MS);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    ruleListeners.add(check);
    return () => {
      ruleListeners.delete(check);
      window.clearInterval(timer);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      unsubscribe?.();
    };
  }, [current]);

  // "Shown" means plausibly seen: half the card in view for a full second.
  // Without an IntersectionObserver there is nothing better than the commit,
  // so those browsers keep counting on render.
  useEffect(() => {
    if (!shown) return;
    // The commit is the fallback start of the answer window. The observer
    // below moves it to the moment the card actually reached the viewport
    // wherever the browser can tell us.
    seenAtRef.current = nowMs();
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      countConsentStep('ad_consent_shown', lang);
      return;
    }
    let timer = 0;
    let stamped = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((entry) => entry.intersectionRatio >= SEEN_RATIO);
        if (seen && !stamped) {
          stamped = true;
          seenAtRef.current = nowMs();
        }
        if (seen && !timer) {
          timer = window.setTimeout(() => {
            countConsentStep('ad_consent_shown', lang);
            observer.disconnect();
          }, SEEN_MS);
        } else if (!seen && timer) {
          // Scrolled away before the second was up: it does not count.
          window.clearTimeout(timer);
          timer = 0;
        }
      },
      { threshold: SEEN_RATIO }
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [shown, lang]);

  // A short screen caps the card's height and the words scroll inside it.
  // Content size moves with the font load and the width, so the children are
  // observed too, not only the box.
  useEffect(() => {
    if (current !== 'due') return;
    const node = wordsRef.current;
    if (!node) return;
    const measure = (): void => {
      const scrolls = node.scrollHeight > node.clientHeight + 1;
      const more = scrolls && node.scrollTop + node.clientHeight < node.scrollHeight - 2;
      setOverflow((prev) =>
        prev.scrolls === scrolls && prev.more === more ? prev : { scrolls, more }
      );
    };
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer) {
      observer.observe(node);
      Array.from(node.children).forEach((child) => observer.observe(child));
    }
    return () => {
      node.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [current]);

  if (current !== 'due') return null;

  // Coarse time-to-answer for the step about to be counted.
  const answered = (): number | undefined => {
    const seenAt = seenAtRef.current;
    return seenAt === null ? undefined : answerBucket(nowMs() - seenAt);
  };
  const tooSoon = (): boolean => !shown || nowMs() - shownAtRef.current < TAP_GUARD_MS;

  const onAccept = (): void => {
    if (tooSoon()) return;
    grantAdConsent();
    keepClickAfterYes();
    countConsentStep('ad_consent_accepted', lang, answered());
    fireStartExploring();
    // Consent is recorded first, so a crossing held while they were deciding
    // goes out now, dated when it actually happened.
    flushPreDecisionListening();
    finish();
  };
  const onDecline = (): void => {
    if (tooSoon()) return;
    revokeAdConsent();
    countConsentStep('ad_consent_declined', lang, answered());
    finish();
  };
  // A no for this visit: nothing is recorded, so the next ad arrival asks
  // again.
  const onDismiss = (): void => {
    if (tooSoon()) return;
    clearGclid();
    holdClick(null);
    dropPreDecisionListening();
    countConsentStep('ad_consent_dismissed', lang, answered());
    finish();
  };
  const onLink = (event: { preventDefault(): void }): void => {
    if (tooSoon()) event.preventDefault();
  };
  return (
    <aside
      className={`agc-consent${shown ? '' : ' agc-consent--held'}`}
      // Kicker plus question: the region announces the size of the ask and the
      // ask itself. The kicker is hidden below 360px but stays part of the
      // name, since a directly referenced node counts either way.
      aria-labelledby="agc-consent-kicker agc-consent-q"
      // The card arrives mid-visit, so its arrival is announced without
      // moving focus. Never a dialog: it must not trap focus or stand between
      // the visitor and the page.
      aria-live="polite"
      aria-hidden={shown ? undefined : true}
      ref={cardRef}
    >
      <p className="agc-consent__kicker" id="agc-consent-kicker">
        {t.kicker}
      </p>
      <h2 className="agc-consent__q" id="agc-consent-q">
        {t.heading}
      </h2>
      <div
        className={`agc-consent__words${overflow.more ? ' agc-consent__words--more' : ''}`}
        ref={wordsRef}
        // A scroller must be reachable by keyboard, but only while it scrolls.
        tabIndex={overflow.scrolls && shown ? 0 : undefined}
      >
        <p className="agc-consent__why">{t.lead}</p>
        <p className="agc-consent__fine">{t.fine}</p>
      </div>
      <p className="agc-consent__age">{t.age}</p>
      <div className="agc-consent__actions">
        <button type="button" className="agc-consent__btn" onClick={onAccept}>
          {t.accept}
        </button>
        <button type="button" className="agc-consent__btn" onClick={onDecline}>
          {t.decline}
        </button>
      </div>
      <p className="agc-consent__imprint">
        <span className="agc-consent__links">
          <a
            className="agc-consent__link"
            href={CODE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLink}
          >
            {t.link}
          </a>
          {/* The dot holds to the link before it, so no line starts with one. */}
          <span className="agc-consent__sep" aria-hidden="true">
            {' · '}
          </span>
          <a className="agc-consent__link" href={t.privacyHref} onClick={onLink}>
            {t.privacy}
          </a>
          <span className="agc-consent__sep" aria-hidden="true">
            {' · '}
          </span>
          <a
            className="agc-consent__link"
            href={GOOGLE_PARTNER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLink}
          >
            {t.google}
          </a>
        </span>
      </p>
      {/* Last in the DOM on purpose: the two answers come before the way out,
          for the tab order and for the screen reader. */}
      <button
        type="button"
        className="agc-consent__x"
        aria-label={t.close}
        title={t.close}
        onClick={onDismiss}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path
            d="M1 1l10 10M11 1L1 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </aside>
  );
}
