import React, { useState, useCallback, useEffect, useRef, FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { focusManagement } from '../utils/accessibility/focusSystem';
import OptimizedImage from './OptimizedImage';
import CosmicLogo from './CosmicLogo';
import styles from './WelcomeDisclosureModal.module.css';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { HISTORY_PREFIXES } from '../utils/userState';
import { sendEntryBeacon } from '../utils/entryBeacon';
import { sendSignupBeacon } from '../utils/signupBeacon';
import { sendFunnelBeaconOnce } from '../utils/funnelBeacon';
import { sendConversion } from '../utils/public/gclidCapture';

interface WelcomeDisclosureModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const CURRENT_AGB_VERSION = '1.0.0';

const WelcomeDisclosureModal: FC<WelcomeDisclosureModalProps> = ({ isOpen, onComplete, onSkip }) => {
  const { tString, tNode, language } = useTranslation();
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [hasAnimated, setHasAnimated] = useState<boolean>(false);
  // Single-action clickwrap (Option C): tapping the button IS the affirmative
  // act (a 16+ self-declaration plus AGB inclusion under Sec 305 Abs 2 BGB). No
  // checkbox is legally required for this non-consent acknowledgment, and the
  // conspicuous statement sits directly above the button. Ad-measurement consent
  // stays a separate non-blocking prompt on the landing page, not here.

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const handleComplete = useCallback((): void => {
    if (isAnimating) return;
    // Store consent in localStorage (technisch erforderlich, § 25 Abs. 2 Nr. 2 TDDDG).
    // A full or blocked storage must not trap the user on the welcome screen.
    try {
      localStorage.setItem('agb_consent', JSON.stringify({
        version: CURRENT_AGB_VERSION,
        timestamp: Date.now(),
      }));
      localStorage.setItem('age_confirmed', JSON.stringify({
        confirmed: true,
        minAge: 16,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.error('Failed to persist consent record:', err);
    }
    // No profile UI at entry — default to the Seeker. The user can rename or
    // change the avatar later in settings.
    preferencesIndexedDbAdapter.setUserProfile({
      name: tString('entry.defaultName', 'Seeker'),
      avatar: null,
      locale: language,
    }).catch((err) => console.error('Failed to save profile:', err));

    // Entry funnel beacons — this is the true "entered the app" moment (profile
    // created + consent given). isFirstLogin gates the organic-signup beacon;
    // the profile_created conversion self-gates on a captured gclid (unchanged).
    // Check the canonical history prefixes, not only the legacy history_ format,
    // so returning users are not miscounted as first signups.
    const historyPrefixes = [...HISTORY_PREFIXES, 'history_'];
    const hasAnyHistory = LocalStorageAdapter.keys().some((k) =>
      historyPrefixes.some((prefix) => k.startsWith(prefix))
    );
    const hasSelectedFigure = LocalStorageAdapter.getString('selectedFigure');
    const isFirstLogin = !hasAnyHistory && !hasSelectedFigure;
    sendEntryBeacon();
    if (isFirstLogin) sendSignupBeacon();
    // profile_created self-gates on a captured gclid + the consent granted on
    // the landing prompt, so it no-ops for everyone who did not opt in there.
    sendConversion('profile_created');

    setIsAnimating(true);
  }, [isAnimating, language, tString]);

  const handleSkip = useCallback((): void => {
    onSkip();
  }, [onSkip]);

  // Dissolve exit → call onComplete when modal's own animation ends
  const handleBurstEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    if (isAnimating && e.target === modalRef.current && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [isAnimating, onComplete]);

  // Campbell reveal → mark entrance animations complete
  const handleRevealEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    if (!hasAnimated && e.target === e.currentTarget) {
      setHasAnimated(true);
    }
  }, [hasAnimated]);

  // Scroll lock via ref-counted hook
  useBodyScrollLock(isOpen);

  // Keyboard: Escape to close + focus trap
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !isAnimating) {
        handleSkip();
      }
      if (e.key === 'Tab' && overlayRef.current) {
        focusManagement.trapFocus(overlayRef.current, e);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isAnimating, handleSkip]);

  // Focus management on open
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [isOpen]);

  // Funnel: the consent screen opened (the top of the consent funnel;
  // welcome_shown minus entry = consent-abandon rate). One-shot per tab.
  useEffect(() => {
    if (isOpen) sendFunnelBeaconOnce('welcome_shown');
  }, [isOpen]);

  // Battery optimization — pause animations when tab is backgrounded
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (overlayRef.current) {
        overlayRef.current.setAttribute('data-visibility', document.hidden ? 'hidden' : 'visible');
      }
    };

    if (overlayRef.current) {
      overlayRef.current.setAttribute('data-visibility', document.hidden ? 'hidden' : 'visible');
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isOpen]);

  // Safety timeout — prevent trapped modal if exit animation fails to fire
  useEffect(() => {
    if (!isAnimating) return;
    const timer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isAnimating, onComplete]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={`${styles.welcomeOverlay} ${isAnimating ? styles.animatingOverlay : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={tString('welcome.title', 'Agora Cosmica')}
      tabIndex={-1}
    >
      <div
        ref={modalRef}
        className={`${styles.welcomeModal} ${isAnimating ? styles.transitioning : ''}`}
        onAnimationEnd={handleBurstEnd}
      >
        {/* Frontispiece title block: publisher's device above the title,
            italic serif tagline, trust signals as the typographic imprint */}
        <div className={styles.modalHeader}>
          <div className={styles.logoContainer}>
            <CosmicLogo className={styles.welcomeLogo} />
          </div>
          <h2 className={styles.modalTitle}>{tNode('welcome.title')}</h2>
          <p className={styles.modalSubtitle}>{tNode('welcome.explainer.tagline')}</p>
          <div className={styles.trustSignals}>
            <span>{tNode('welcome.trustSignals')}</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.modalContent} tabIndex={-1}>
          <div className={styles.welcomeContent}>
            {/* Campbell as engraved medallion over an epigraph — fades in
                after the title block */}
            <div
              className={`${styles.cosmicScene} ${!hasAnimated ? styles.campbellReveal : ''}`}
              onAnimationEnd={handleRevealEnd}
            >
              <div className={styles.medallion}>
                {/* Portrait renders at ~120px; the sizes cap keeps mobile on
                    the 320-480w variants instead of the generic-100vw 640w. */}
                <OptimizedImage
                  src="campbell"
                  type="ui"
                  purpose="thumbnail"
                  priority={true}
                  loading="eager"
                  withBlurUp={true}
                  alt="Joseph Campbell"
                  className={styles.guideImage}
                  sizes="(max-width: 640px) 120px, 130px"
                />
              </div>

              <blockquote className={styles.campbellQuote}>
                <p className={styles.quoteText}>
                  <span className={styles.quoteMark} aria-hidden="true">&ldquo;</span>
                  {tNode('welcome.quote')}
                  <span className={styles.quoteMark} aria-hidden="true">&rdquo;</span>
                </p>
                <footer className={styles.quoteAttribution}>
                  <cite>{tNode('welcome.quoteAttribution')}</cite>
                </footer>
              </blockquote>
            </div>
          </div>

          {/* AI transparency notice (short, names chat/stories/audio) */}
          <div className={styles.aiNotice} role="note">
            <p className={styles.aiNoticeKicker}>{tNode('legal.consent.aiNoticeKicker')}</p>
            <p>{tNode('legal.consent.aiNotice')}</p>
          </div>
        </div>

        {/* Single-action clickwrap footer (Option C). The statement renders
            directly ABOVE the always-enabled button and stays co-visible with
            it in this sticky footer, so the tap is an informed affirmative act
            (16+ self-declaration + AGB inclusion, Sec 305 Abs 2 BGB). */}
        <div className={styles.modalFooter}>
          <p className={styles.clickwrapStatement} id="agc-clickwrap-notice">
            {tNode('legal.consent.clickwrapPre')}{' '}
            <a href={language === 'de' ? '/nutzungsbedingungen' : '/terms'} target="_blank" rel="noopener" className={styles.consentLink}>
              {tNode('legal.consent.termsLink')}
            </a>{' '}
            {tNode('legal.consent.clickwrapMid')}
          </p>
          <button
            onClick={handleComplete}
            className={`${styles.beginButton} ${isAnimating ? styles.animating : ''}`}
            disabled={isAnimating}
            aria-describedby="agc-clickwrap-notice"
          >
            {tNode('legal.consent.startButton')}
          </button>
          <p className={styles.footerLinks}>
            <a href={language === 'de' ? '/datenschutz' : '/privacy'} target="_blank" rel="noopener" className={styles.consentLink}>
              {tNode('legal.consent.privacyNote')}
            </a>
            {' · '}
            <a href="/impressum#jugendschutz" target="_blank" rel="noopener" className={styles.consentLink}>
              {tNode('legal.consent.jsbNote')}
            </a>
          </p>
        </div>
      </div>

      {/* Golden dissolve overlay */}
      {isAnimating && (
        <div className={styles.dissolveOverlay} />
      )}
    </div>
  );
};

export default WelcomeDisclosureModal;
