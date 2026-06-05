import React, { useState, useCallback, useEffect, useRef, FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { focusManagement } from '../utils/accessibility/focusSystem';
import { ShieldCheck } from '@phosphor-icons/react';
import OptimizedImage from './OptimizedImage';
import CosmicLogo from './CosmicLogo';
import styles from './WelcomeDisclosureModal.module.css';
import { preferencesIndexedDbAdapter } from '../storage/preferencesIndexedDbAdapter';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { sendEntryBeacon } from '../utils/entryBeacon';
import { sendSignupBeacon } from '../utils/signupBeacon';
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
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const consentGiven = ageConfirmed && termsAccepted;
  // Ad-measurement consent is asked once, as a non-blocking prompt on the
  // marketing landing page (AdConsentPrompt), not here. The welcome step stays
  // focused on the required age + terms acknowledgment.

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const handleComplete = useCallback((): void => {
    if (!consentGiven) return;
    // Store consent in localStorage (technisch erforderlich, § 25 Abs. 2 Nr. 2 TDDDG)
    localStorage.setItem('agb_consent', JSON.stringify({
      version: CURRENT_AGB_VERSION,
      timestamp: Date.now(),
    }));
    localStorage.setItem('age_confirmed', JSON.stringify({
      confirmed: true,
      minAge: 16,
      timestamp: Date.now(),
    }));
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
    const hasAnyHistory = LocalStorageAdapter.keys().some((k) => k.startsWith('history_'));
    const hasSelectedFigure = LocalStorageAdapter.getString('selectedFigure');
    const isFirstLogin = !hasAnyHistory && !hasSelectedFigure;
    sendEntryBeacon();
    if (isFirstLogin) sendSignupBeacon();
    // profile_created self-gates on a captured gclid + the consent granted on
    // the landing prompt, so it no-ops for everyone who did not opt in there.
    sendConversion('profile_created');

    setIsAnimating(true);
  }, [consentGiven, language, tString]);

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
        {/* Branded header — matches login/website */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <h2 className={styles.modalTitle}>{tNode('welcome.title')}</h2>
            <div className={styles.logoContainer}>
              <CosmicLogo className={styles.welcomeLogo} />
            </div>
          </div>
          <p className={styles.modalSubtitle}>{tNode('welcome.explainer.tagline')}</p>
          <div className={styles.trustSignals}>
            <ShieldCheck size={12} weight="duotone" className={styles.trustIcon} />
            <span>{tNode('welcome.trustSignals')}</span>
          </div>
        </div>

        {/* Content */}
        <div className={styles.modalContent} tabIndex={-1}>
          <div className={styles.welcomeContent}>
            {/* Campbell Scene — fades in after value prop */}
            <div
              className={`${styles.cosmicScene} ${!hasAnimated ? styles.campbellReveal : ''}`}
              onAnimationEnd={handleRevealEnd}
            >
              <div className={styles.nebulaBackground} />

              <div className={styles.figureContainer}>
                <div className={styles.silhouetteWrapper}>
                  <div className={styles.silhouette}>
                    {/* Portrait renders at ~125px (<=90px on small phones); the
                        sizes cap makes mobile fetch 320-480w (~11-37KB) instead
                        of the generic-100vw 640w (~53-68KB) on the entry screen. */}
                    <OptimizedImage
                      src="campbell"
                      type="ui"
                      purpose="thumbnail"
                      priority={true}
                      loading="eager"
                      withBlurUp={true}
                      alt="Joseph Campbell"
                      className={styles.guideImage}
                      sizes="(max-width: 640px) 150px, 145px"
                    />
                  </div>
                </div>

                {/* Campbell Quote */}
                <blockquote className={styles.campbellQuote}>
                  <div className={styles.quoteContent}>
                    <span className={styles.quoteMark} aria-hidden="true">&ldquo;</span>
                    <span className={styles.quoteText}>
                      {tNode('welcome.quote')}
                    </span>
                    <span className={`${styles.quoteMark} ${styles.closing}`} aria-hidden="true">&rdquo;</span>
                  </div>
                  <footer className={styles.quoteAttribution}>
                    <cite>{tNode('welcome.quoteAttribution')}</cite>
                  </footer>
                </blockquote>
              </div>
            </div>

          </div>

          {/* Legal consent — required before starting (scroll down to see) */}
          <div className={styles.consentSection}>
            <h3 className={styles.consentHeading}>{tNode('legal.consent.heading')}</h3>
            <div className={styles.aiNotice} role="alert">
              <p>{tNode('legal.consent.aiNotice')}</p>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className={styles.checkbox}
              />
              <span>{tNode('legal.consent.ageCheckbox')}</span>
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className={styles.checkbox}
              />
              <span>
                {tNode('legal.consent.termsCheckbox')}{' '}
                <a href="/nutzungsbedingungen" target="_blank" rel="noopener" className={styles.consentLink}>
                  {tNode('legal.consent.termsLink')}
                </a>
                {tNode('legal.consent.termsCheckboxSuffix')}
              </span>
            </label>

            <p className={styles.consentLinks}>
              <a href={language === 'de' ? '/datenschutz' : '/privacy'} target="_blank" rel="noopener" className={styles.consentLink}>
                {tNode('legal.consent.privacyNote')}
              </a>
              {' | '}
              <a href="/impressum#jugendschutz" target="_blank" rel="noopener" className={styles.consentLink}>
                {tNode('legal.consent.jsbNote')}
              </a>
            </p>
          </div>

          {/* Begin button — disabled until both checkboxes checked */}
          <div className={styles.modalActions}>
            <button
              onClick={handleComplete}
              className={`${styles.beginButton} ${isAnimating ? styles.animating : ''}`}
              disabled={!consentGiven || isAnimating}
            >
              {tNode('legal.consent.startButton')}
            </button>
          </div>
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
