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
//   Dismiss -> hide for this session AND clear the stored click ID (no record,
//              no later ask: with the prompt gone there is no consent surface
//              left this session, so keeping the gclid would be purposeless
//              storage under § 25 TDDDG).
//
// Copy finalized 2026-06-10 after legal review (withdrawal notice, privacy
// link, precise click-ID wording). Lift into publicI18n if it ever needs
// more languages.

import { useEffect, useRef, useState } from 'react';
import {
  captureGclid,
  clearGclid,
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
    heading: 'About this one Google thing',
    body: 'You came from a Google ad we get free as a nonprofit. With your okay, Google counts it, and that lets us keep these ads in the future. Just the ad’s click ID, no name, no browsing data. You can change your mind anytime in Settings under "Legal". Saying no opens the full library too.',
    accept: 'Yes, count the ad',
    decline: 'No, just open the library',
    link: 'See the code',
    privacy: 'Privacy policy',
    privacyHref: '/privacy/',
    dismiss: 'Close',
  },
  de: {
    trust: 'Gemeinnützig · Open Source · Keine Tracking-Cookies, kein Profiling',
    heading: 'Zu dieser einen Google-Sache',
    body: 'Wir bekommen als Nonprofit kostenlose Google Anzeigen. Dein Okay lässt Google sie zählen und erlaubt uns damit diese Anzeigen auch in Zukunft. Nur die Klick-ID der Anzeige, kein Name, keine Browserdaten. Du kannst das jederzeit in den Einstellungen unter „Rechtliches" ändern. Ein Nein öffnet die Bibliothek genauso.',
    accept: 'Ja, Anzeige zählen',
    decline: 'Nein, einfach öffnen',
    link: 'Code ansehen',
    privacy: 'Datenschutzerklärung',
    privacyHref: '/datenschutz/',
    dismiss: 'Schließen',
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
const SS_DISMISSED = 'agc_ad_prompt_dismissed';
const SS_FIRED = 'agc_conv_fired_start_exploring';

// Anonymous consent counters: how many ad arrivals get asked, and what they
// answer. Same keyless posture as the cta_click beacon in agc-public.js: the
// step, the page path, and the interface language, and it has to stay that
// way. A gclid or an id here would pair a user dimension with a consent
// decision, which is exactly what this measurement must not do.
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

function countConsentStep(step: ConsentCounter, lang: Props['lang']): void {
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
    // (a short slug path or nothing).
    const body = JSON.stringify({
      step,
      path: window.location.pathname,
      language: lang,
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
  const t = COPY[lang] ?? COPY.en;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(SS_DISMISSED) === '1';
    } catch {
      // sessionStorage blocked — show once
    }
    if (dismissed) {
      // Prompt was dismissed earlier this session: no consent surface remains,
      // so make sure no click ID lingers in storage (also catches a reload of
      // a landing URL that still carries ?gclid).
      clearGclid();
      return;
    }
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
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      countConsentStep('ad_consent_shown', lang);
      return;
    }
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((entry) => entry.intersectionRatio >= SEEN_RATIO);
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

  const onAccept = (): void => {
    grantAdConsent();
    countConsentStep('ad_consent_accepted', lang);
    fireStartExploring();
    // Consent is recorded first, so a crossing held while they were deciding
    // goes out now, dated when it actually happened.
    if (ASK_ON_INTERACTION) flushPreDecisionListening();
    setShow(false);
  };
  const onDecline = (): void => {
    revokeAdConsent();
    countConsentStep('ad_consent_declined', lang);
    if (ASK_ON_INTERACTION) dropPreDecisionListening();
    setShow(false);
  };
  const onDismiss = (): void => {
    try {
      sessionStorage.setItem(SS_DISMISSED, '1');
    } catch {
      /* no-op */
    }
    countConsentStep('ad_consent_dismissed', lang);
    // No consent surface remains this session, so a stored click ID would be
    // purposeless storage. Drop it, and with it anything held for an answer
    // that is no longer coming.
    clearGclid();
    if (ASK_ON_INTERACTION) dropPreDecisionListening();
    setShow(false);
  };

  return (
    <aside
      className="agc-consent"
      aria-label={t.heading}
      // Deferred ask only: the card can arrive mid-visit, so its arrival is
      // announced without moving focus. Undefined renders no attribute, so the
      // markup that ships today is untouched. Never a dialog: it must not trap
      // focus or stand between the visitor and the page.
      aria-live={ASK_ON_INTERACTION ? 'polite' : undefined}
      ref={cardRef}
    >
      <button
        type="button"
        className="agc-consent__x"
        aria-label={t.dismiss}
        onClick={onDismiss}
      >
        ×
      </button>
      <div className="agc-consent__trust">
        <span className="agc-consent__dot" aria-hidden="true" />
        {t.trust}
      </div>
      <h2 className="agc-consent__h">{t.heading}</h2>
      <p className="agc-consent__b">{t.body}</p>
      <div className="agc-consent__actions">
        <button type="button" className="agc-consent__btn" onClick={onAccept}>
          {t.accept}
        </button>
        <button type="button" className="agc-consent__btn" onClick={onDecline}>
          {t.decline}
        </button>
      </div>
      <a
        className="agc-consent__link"
        href={CODE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.link} ›
      </a>
      <a className="agc-consent__link" href={t.privacyHref}>
        {t.privacy} ›
      </a>
    </aside>
  );
}
