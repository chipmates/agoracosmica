// React island: the ad-measurement switch in every public page's footer, so a
// yes given on a landing page can be taken back on any page, as easily as it
// was given. NAMING CONSTRAINT (as in ArrivalChoice.tsx): no ad-tech words in
// the file name or the class names, or content blockers hide or block it.
//
// A native disclosure: the summary is rendered at build time, so the footer
// never shifts, and it opens by keyboard and without hydration. Opening reads
// the stored answer to show the state; nothing else is read or stored, and
// only "Turn off" writes (the same withdrawal as in the app).

import { useCallback, useEffect, useRef, useState } from 'react';
// Through heardSeconds on purpose, see the note there on chunk names.
import { adConsentGranted, revokeAdConsent } from '../utils/heardSeconds';
import './FooterChoice.css';

interface Props {
  lang: 'en' | 'de';
}

type Shown = 'unknown' | 'on' | 'off';

const COPY = {
  en: {
    label: 'Ad measurement',
    on: 'Ad measurement is on for this browser.',
    off: 'Ad measurement is off.',
    turnOff: 'Turn off',
    privacy: 'Privacy policy',
    privacyHref: '/privacy/',
  },
  de: {
    label: 'Werbe-Messung',
    on: 'Werbe-Messung ist für diesen Browser an.',
    off: 'Werbe-Messung ist aus.',
    turnOff: 'Ausschalten',
    privacy: 'Datenschutzerklärung',
    privacyHref: '/datenschutz/',
  },
} as const;

export default function FooterChoice({ lang }: Props) {
  const t = COPY[lang] ?? COPY.en;
  const [shown, setShown] = useState<Shown>('unknown');
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  const readState = useCallback((): void => {
    setShown(adConsentGranted() ? 'on' : 'off');
  }, []);

  // Opened before hydration finished: show the state now.
  useEffect(() => {
    if (detailsRef.current?.open) readState();
  }, [readState]);

  const onToggle = (): void => {
    if (detailsRef.current?.open) readState();
  };

  const onTurnOff = (): void => {
    revokeAdConsent();
    setShown('off');
    // The button leaves with the answer, so keyboard focus lands on the new state.
    window.requestAnimationFrame(() => statusRef.current?.focus());
  };

  return (
    <details className="pub-footer__choice" ref={detailsRef} onToggle={onToggle}>
      <summary className="pub-footer__choice-toggle">{t.label}</summary>
      <div className="pub-footer__choice-panel">
        {shown === 'unknown' ? (
          // Without script there is no state to read; the policy explains it.
          <a className="pub-footer__choice-link" href={t.privacyHref}>
            {t.privacy}
          </a>
        ) : (
          <>
            <p className="pub-footer__choice-state" ref={statusRef} tabIndex={-1} role="status">
              {shown === 'on' ? t.on : t.off}
            </p>
            {shown === 'on' && (
              <button type="button" className="pub-footer__choice-button" onClick={onTurnOff}>
                {t.turnOff}
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
}
