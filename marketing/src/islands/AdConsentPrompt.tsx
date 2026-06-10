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
// Copy is a DRAFT pending the data-protection lawyer's review. Finalize the
// wording here, or lift it into publicI18n later.

import { useEffect, useState } from 'react';
import {
  captureGclid,
  clearGclid,
  getGclid,
  isPaidVisitor,
  adConsentDecided,
  grantAdConsent,
  revokeAdConsent,
} from '@client/utils/public/gclidCapture';
import './AdConsentPrompt.css';

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

// Absolute worker URL on purpose: agoracosmica.org has no /api/* route, so a
// relative path falls through the SPA fallback (/* -> index.html 200), the fetch
// resolves, .catch() never fires, and the conversion silently never arrives. CSP
// allows https://*.agoracosmica.org in connect-src and the worker CORS allows
// this origin. (Same posture as the former agc-public.js fireConversion.)
const CONVERSIONS_URL = 'https://llm.agoracosmica.org/api/conversions';
const CODE_URL =
  'https://github.com/chipmates/agoracosmica/blob/main/client/src/utils/public/gclidCapture.ts';
const SS_DISMISSED = 'agc_ad_prompt_dismissed';
const SS_FIRED = 'agc_conv_fired_start_exploring';

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

export default function AdConsentPrompt({ lang }: Props) {
  const [show, setShow] = useState(false);
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
    setShow(true);
  }, []);

  if (!show) return null;

  const onAccept = (): void => {
    grantAdConsent();
    fireStartExploring();
    setShow(false);
  };
  const onDecline = (): void => {
    revokeAdConsent();
    setShow(false);
  };
  const onDismiss = (): void => {
    try {
      sessionStorage.setItem(SS_DISMISSED, '1');
    } catch {
      /* no-op */
    }
    // No consent surface remains this session, so a stored click ID would be
    // purposeless storage. Drop it.
    clearGclid();
    setShow(false);
  };

  return (
    <aside className="agc-consent" aria-label={t.heading}>
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
