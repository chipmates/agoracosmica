// React island: ad-measurement consent prompt for Google ad-grant arrivals.
// Shown only when a gclid is present, the visitor is NOT on the paid ?p=1 split,
// and no explicit choice was made yet this session. Non-blocking: the figure or
// theme content stays fully readable behind it (no wall, no scroll lock, no
// focus trap), which is what keeps the consent lawful (EDPB cookie-wall rule).
//
//   Accept  -> grantAdConsent() + fire start_exploring (the early grant signal,
//              the same conversion the old marketing CTA fired, now gated on a
//              real opt-in instead of the bare gclid).
//   Decline -> revokeAdConsent() (records the choice, clears the gclid, sends
//              nothing). Remembered, so the visitor is not asked again.
//
// There is no dismiss control: the two answers are the only exits, and an
// unanswered card simply stays for the visit. While the ask is pending the
// stored click ID keeps its purpose under § 25 TDDDG (an open consent
// surface is waiting on it); it leaves storage with the answer either way.
//
// Copy is legally reviewed: the withdrawal notice, the privacy link and the
// click-ID scope sentence are all load bearing and none of them may be
// dropped for space. Lift into publicI18n if it ever needs more languages.

import { useEffect, useRef, useState } from 'react';
import {
  captureGclid,
  getGclid,
  isPaidVisitor,
  adConsentDecided,
  grantAdConsent,
  revokeAdConsent,
} from '@client/utils/public/gclidCapture';
import {
  armPreDecisionListening,
  dropPreDecisionListening,
  flushPreDecisionListening,
} from '../utils/listenedConversion';
import './AdConsentPrompt.css';

// Deferred ask. False is the shipping behavior: the card comes up on mount,
// exactly as reviewed. True holds it back until the visitor does something
// (audio, half the page, twenty seconds, an entry CTA under the pointer) and
// lets audio seconds accrue unsent until they answer. Nothing but this line
// changes between the two, and flipping it is the owner's call after a legal
// look at the new timing (scope and copy are unchanged either way).
export const ASK_ON_INTERACTION: boolean = false;

interface Props {
  lang: 'en' | 'de';
}

const COPY = {
  en: {
    trust: 'Nonprofit · Open Source · No tracking cookies, no profiling',
    kicker: 'One question about this ad',
    heading: 'So the next person finds it too.',
    lead: 'Nonprofits get their Google ads for free. Counted clicks help those ads reach more people searching for the same thing.',
    // Non-breaking spaces around the chevron: the settings path must never
    // break across lines.
    fine: 'Nothing about you goes to Google except the ad’s click ID. No name, no browsing history. You can undo it anytime under Settings › Legal. Either way, the whole library stays open. A no is remembered.',
    accept: 'Yes, count it',
    decline: 'No, don’t count it',
    link: 'See the code',
    privacy: 'Privacy policy',
    privacyHref: '/privacy/',
  },
  de: {
    trust: 'Gemeinnützig · Open Source · Keine Tracking-Cookies, kein Profiling',
    kicker: 'Eine Frage zu dieser Anzeige',
    heading: 'Damit der nächste Mensch es auch findet.',
    lead: 'Gemeinnützige bekommen ihre Anzeigen bei Google gratis. Gezählte Klicks helfen, mehr Menschen zu erreichen, die dasselbe suchen.',
    fine: 'Von dir geht nur die Klick-ID der Anzeige zu Google. Kein Name, keine Browserdaten. Jederzeit widerrufbar unter Einstellungen › Rechtliches. So oder so bleibt die Bibliothek offen. Ein Nein merken wir uns.',
    accept: 'Ja, zählen',
    decline: 'Nein, nicht zählen',
    link: 'Code ansehen',
    privacy: 'Datenschutzerklärung',
    privacyHref: '/datenschutz/',
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
const SS_FIRED = 'agc_conv_fired_start_exploring';

// Anonymous consent counters: how many ad arrivals get asked, and what they
// answer. Same keyless posture as the cta_click beacon in agc-public.js: the
// step, the page path, the interface language, and on the two answer steps
// a coarse time-to-answer bucket, and it has to stay that way. A gclid or an
// id here would pair a user dimension with a consent decision, which is
// exactly what this measurement must not do.
type ConsentCounter =
  | 'ad_consent_shown'
  | 'ad_consent_accepted'
  | 'ad_consent_declined';

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

function countConsentStep(step: ConsentCounter, lang: Props['lang'], bucket?: number): void {
  try {
    const firedKey = `agc_funnel_fired_${step}`;
    if (sessionStorage.getItem(firedKey)) return;
    sessionStorage.setItem(firedKey, '1');
  } catch {
    // storage blocked: still send once per page, the worker rate-limits
  }
  try {
    // Path only, no query and no hash, exactly like the cta_click beacon.
    // The worker holds it to the same closed shape it holds that one to
    // (a short slug path or nothing), plus the coarse bucket on the three
    // answer steps.
    const body = JSON.stringify(
      bucket === undefined
        ? { step, path: window.location.pathname, language: lang }
        : { step, path: window.location.pathname, language: lang, bucket }
    );
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

function fireStartExploring(): void {
  const gclid = getGclid();
  if (!gclid) return;
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

// Deferred ask: how long a visitor may sit on the page before the card comes
// up on its own, and how far down the page counts as having read it.
const DWELL_MS = 20000;
const SCROLL_FRACTION = 0.5;

/**
 * Wire the deferred-ask triggers. The first sign of engagement wins and takes
 * every other listener down with it, so the card can never be raised twice and
 * nothing outlives the island. Returns the detach for unmount.
 */
function armDeferredShow(fire: () => void): () => void {
  let armed = true;
  let dwell = 0;

  function detach(): void {
    if (!armed) return;
    armed = false;
    window.clearTimeout(dwell);
    document.removeEventListener('play', trip, true);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerover', onCtaIntent);
    document.removeEventListener('focusin', onCtaIntent);
  }

  function trip(): void {
    if (!armed) return;
    detach();
    fire();
  }

  function onScroll(): void {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return; // page fits the viewport, there is nothing to read down to
    if (window.scrollY / scrollable >= SCROLL_FRACTION) trip();
  }

  // Same convention the cta_click handler in agc-public.js uses: every
  // into-the-app CTA is [data-agc-cta="start-exploring"], navbar to sticky bar.
  function onCtaIntent(event: Event): void {
    const el = event.target instanceof Element ? event.target.closest('[data-agc-cta]') : null;
    if (el?.getAttribute('data-agc-cta') === 'start-exploring') trip();
  }

  dwell = window.setTimeout(trip, DWELL_MS);
  // Audio: play events do not bubble, so the in-page players need the capture
  // phase, and the island players need the accumulator (they use detached
  // Audio elements, whose events never reach the document at all). The
  // accumulator callback is one-shot and any answer clears it.
  document.addEventListener('play', trip, true);
  armPreDecisionListening(trip);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('pointerover', onCtaIntent);
  document.addEventListener('focusin', onCtaIntent);
  return detach;
}

export default function AdConsentPrompt({ lang }: Props) {
  const [show, setShow] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  // Start of the time-to-answer window. Never transmitted, never stored: the
  // three answer beacons carry the coarse bucket derived from it and nothing
  // else.
  const seenAtRef = useRef<number | null>(null);
  const t = COPY[lang] ?? COPY.en;

  useEffect(() => {
    captureGclid(); // reads ?gclid / ?p=1 from the landing URL into storage
    if (!getGclid() || isPaidVisitor() || adConsentDecided()) return;
    if (!ASK_ON_INTERACTION) {
      setShow(true);
      return;
    }
    // Deferred ask: eligible, so arm instead of showing. Nothing renders until
    // a trigger lands, and audio meanwhile counts toward Listened without ever
    // being sent (see listenedConversion's pre-decision buffer).
    return armDeferredShow(() => setShow(true));
  }, []);

  // "Shown" means plausibly seen: half the card in view for a full second.
  // Without an IntersectionObserver there is nothing better than the commit,
  // so those browsers keep counting on render.
  useEffect(() => {
    if (!show) return;
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
  }, [show, lang]);

  if (!show) return null;

  // Coarse time-to-answer for the step about to be counted.
  const answered = (): number | undefined => {
    const seenAt = seenAtRef.current;
    return seenAt === null ? undefined : answerBucket(nowMs() - seenAt);
  };

  const onAccept = (): void => {
    grantAdConsent();
    countConsentStep('ad_consent_accepted', lang, answered());
    fireStartExploring();
    // Consent is recorded first, so a crossing held while they were deciding
    // goes out now, dated when it actually happened.
    if (ASK_ON_INTERACTION) flushPreDecisionListening();
    setShow(false);
  };
  const onDecline = (): void => {
    revokeAdConsent();
    countConsentStep('ad_consent_declined', lang, answered());
    if (ASK_ON_INTERACTION) dropPreDecisionListening();
    setShow(false);
  };
  return (
    <aside
      className="agc-consent"
      // Kicker plus question: the region announces the size of the ask and the
      // ask itself. The kicker is hidden below 360px but stays part of the
      // name, since a directly referenced node counts either way.
      aria-labelledby="agc-consent-kicker agc-consent-q"
      // Deferred ask only: the card can arrive mid-visit, so its arrival is
      // announced without moving focus. Undefined renders no attribute, so the
      // markup that ships today is untouched. Never a dialog: it must not trap
      // focus or stand between the visitor and the page.
      aria-live={ASK_ON_INTERACTION ? 'polite' : undefined}
      ref={cardRef}
    >
      <p className="agc-consent__kicker" id="agc-consent-kicker">
        {t.kicker}
      </p>
      <h2 className="agc-consent__q" id="agc-consent-q">
        {t.heading}
      </h2>
      <p className="agc-consent__why">{t.lead}</p>
      <p className="agc-consent__fine">{t.fine}</p>
      <div className="agc-consent__actions">
        <button type="button" className="agc-consent__btn" onClick={onAccept}>
          {t.accept}
        </button>
        <button type="button" className="agc-consent__btn" onClick={onDecline}>
          {t.decline}
        </button>
      </div>
      <p className="agc-consent__imprint">
        <span className="agc-consent__trust">{t.trust}</span>{' '}
        <span className="agc-consent__links">
          <a
            className="agc-consent__link"
            href={CODE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.link}
          </a>
          <span className="agc-consent__sep" aria-hidden="true">
            {' · '}
          </span>
          <a className="agc-consent__link" href={t.privacyHref}>
            {t.privacy}
          </a>
        </span>
      </p>
    </aside>
  );
}
