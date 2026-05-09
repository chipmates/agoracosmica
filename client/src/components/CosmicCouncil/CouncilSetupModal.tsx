// src/components/CosmicCouncil/CouncilSetupModal.tsx
import React, { useState, useEffect, useRef, FC, ReactNode, MouseEvent } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Play, Crown, Sparkle, MoonStars, Lightning as Zap, Users, Wrench, Star, Globe, PuzzlePiece } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import HelperPopup from '../HelperPopup/HelperPopup';
import { useUIStore } from '../../stores/uiStore';
import { useDomainStore } from '../../stores/domainStore';
import { getHistoricalFigures } from '../../api/figures';
import useTranslation from '../../hooks/useTranslation';
import SolarSystemInterface from './SolarSystemInterface';
import MiniFigureCarousel from './MiniFigureCarousel';
import { CloseButton } from '../Button';
import { checkGenderLimit, countGenderBalance } from '../../utils/figureGender';
import ProcessingLoader from '../ProcessingLoader';
import CouncilThemeRow from './CouncilThemeRow';
import CouncilCard from './CouncilCard';
import CouncilDetailSheet from './CouncilDetailSheet';
import { useCouncilProgress } from '../../hooks/useCouncilProgress';
import { screenContent, type CrisisResources } from '../../utils/contentSafety';
import {
  THEMES,
  councilsByTheme,
  heroConfrontational,
  heroReflective,
  typeToInternal,
  getShortDisplayName,
  getLocalizedTitle,
  getLocalizedQuestion,
  CatalogCouncil,
  ESTIMATED_DURATION
} from '../../data/councilCatalog';
import './CouncilSetupModal.css';

// Type definitions
interface Figure {
  id: string;
  name: string;
  [key: string]: any;
}

interface Council {
  id: string;
  titleKey: string;
  subtitleKey: string;
  questionKey: string;
  moderator: Figure | undefined;
  participants: Figure[];
  icon: () => ReactNode;
  type: 'debate' | 'advisory';
  tier: 'featured' | 'curated' | 'custom';
}

interface CouncilConfig {
  moderator: Figure;
  participants: Figure[];
  question: string;
  category: Council | {
    id: string;
    titleKey: string;
    subtitleKey: string;
    type: 'debate' | 'advisory';
    tier: 'custom' | 'curated';
  };
  curated?: boolean;
  councilId?: string;
  level?: 1 | 2;
}

interface CouncilSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCouncil: (config: CouncilConfig) => Promise<void>;
}

const CouncilSetupModal: FC<CouncilSetupModalProps> = ({
  isOpen,
  onClose,
  onStartCouncil
}) => {
  const { t, tString, tNode, language } = useTranslation();
  const historicalFigures = React.useMemo(() => getHistoricalFigures(language), [language]);

  // Help preferences from Zustand
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const dismissHelp = useUIStore((state) => state.dismissHelp);

  // Council quota gate: when free-tier and council/day used up, intercept the
  // start action and route to the rate-limit modal instead of starting the council.
  const councilQuota = useDomainStore((state) => state.quota.council);
  const isFreeTier = useDomainStore((state) => state.quota.isFreeTier);
  const resetsAt = useDomainStore((state) => state.quota.resetsAt);
  const openRateLimitModal = useDomainStore((state) => state.openRateLimitModal);
  const isCouncilExhausted = isFreeTier && councilQuota.loaded && councilQuota.used >= councilQuota.limit;

  // P-2 (audit Change #15): hide the setup modal while a live council is
  // streaming, so we are not stacking two full-screen blur overlays at once.
  // Modal stays mounted (state preserved) — only display:none, no unmount.
  const isCouncilUIActive = useDomainStore(
    (state) => Boolean(state.council.config) && !state.council.config?.isCompleted
  );

  // Custom builder state
  const [selectedFigures, setSelectedFigures] = useState<Figure[]>([]);
  const [moderator, setModerator] = useState<Figure | null>(null);
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customType, setCustomType] = useState<'debate' | 'advisory'>('debate');
  const [showCouncilHelp, setShowCouncilHelp] = useState<boolean>(false);

  // View state
  const [viewMode, setViewMode] = useState<'catalog' | 'custom'>('catalog');
  const [selectedCouncil, setSelectedCouncil] = useState<CatalogCouncil | null>(null);
  const [crisisInfo, setCrisisInfo] = useState<CrisisResources | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Scroll lock via ref-counted hook
  useBodyScrollLock(isOpen);

  // Progress indicators for hero cards
  const heroConfProgress = useCouncilProgress(heroConfrontational.id, language);
  const heroReflProgress = useCouncilProgress(heroReflective.id, language);

  // Reset state when modal is closed
  useEffect(() => {
    if (isOpen) {
      const shouldShow = shouldShowHelp('councilSetupHelp');
      if (shouldShow) {
        setShowCouncilHelp(true);
      }
      // a11y: move focus into the dialog on open so screen-reader users hear
      // the title and Tab cycles within the modal. rAF defers one frame so
      // the portal node is mounted before .focus() runs.
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    } else {
      setViewMode('catalog');
      setSelectedCouncil(null);
    }
  }, [isOpen, shouldShowHelp]);

  // a11y: lightweight focus trap — keep Tab/Shift+Tab inside the dialog while open.
  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;

      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Handle escape key — back to catalog first, then close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (viewMode === 'custom') {
          setViewMode('catalog');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Figure selection handlers (custom builder)
  const handleFigureSelect = (figure: Figure): void => {
    const isAlreadyParticipant = selectedFigures.find(f => f.id === figure.id);
    const isModerator = moderator?.id === figure.id;

    if (isModerator) {
      setModerator(null);
      return;
    }

    if (isAlreadyParticipant) {
      setSelectedFigures(selectedFigures.filter(f => f.id !== figure.id));
      return;
    }

    if (!moderator) {
      const genderCheck = checkGenderLimit(selectedFigures, figure);
      if (!genderCheck.canAdd) {
        console.warn(genderCheck.reason);
        return;
      }
      setModerator(figure);
      return;
    }

    if (selectedFigures.length < 3) {
      const allFigures = moderator ? [moderator, ...selectedFigures] : selectedFigures;
      const genderCheck = checkGenderLimit(allFigures, figure);
      if (!genderCheck.canAdd) {
        console.warn(genderCheck.reason);
        return;
      }
      setSelectedFigures([...selectedFigures, figure]);
    }
  };

  const handleFigureRemove = (figureId: string): void => {
    if (moderator?.id === figureId) {
      setModerator(null);
    } else {
      setSelectedFigures(selectedFigures.filter(f => f.id !== figureId));
    }
  };

  // Open detail sheet for a catalog council
  const handleSelectCouncil = (council: CatalogCouncil): void => {
    setSelectedCouncil(council);
  };

  // Start a curated council from the catalog.
  // No quota check: curated councils are pre-rendered audio from R2, no LLM call.
  // The /v1/council quota only applies to custom-built councils (handleStartCustomCouncil).
  const handleCuratedSelect = async (council: CatalogCouncil, level?: 1 | 2): Promise<void> => {
    const mod = historicalFigures.find(f => f.id === council.moderator.id);
    const parts = council.participants
      .map(p => historicalFigures.find(f => f.id === p.id))
      .filter(Boolean) as Figure[];

    if (!mod) return;

    setIsLoading(true);
    setSelectedCouncil(null);

    try {
      const councilConfig: CouncilConfig = {
        moderator: mod,
        participants: parts,
        question: council.question,
        category: {
          id: council.id,
          titleKey: council.title,
          subtitleKey: council.title,
          type: typeToInternal(council.type),
          tier: 'curated'
        },
        curated: true,
        councilId: council.id,
        level: level || 1
      };

      await onStartCouncil(councilConfig);
      onClose();
    } catch (error) {
      console.error('Failed to start council:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to custom builder
  const handleBuildYourOwn = (): void => {
    setViewMode('custom');
  };

  // Back to catalog from custom view
  const handleBackToCatalog = (): void => {
    setViewMode('catalog');
  };

  // Helper popup handler
  const handleDontShowCouncilHelp = (): void => {
    dismissHelp('councilSetupHelp');
  };

  // Custom builder start handler
  const handleStartCustomCouncil = async (): Promise<void> => {
    // Quota check FIRST — when the user is exhausted we want them to see the
    // BYOK helper popup regardless of whether the form is filled. The previous
    // order returned silently on incomplete form, which read as "button locked
    // with no feedback" once the daily council quota was hit.
    if (isCouncilExhausted) {
      openRateLimitModal('council', resetsAt, councilQuota.limit);
      return;
    }

    if (!moderator || selectedFigures.length === 0 || !userQuestion.trim()) return;

    // Layer 1: Client-side content safety screen
    const safetyResult = screenContent(userQuestion.trim());
    if (!safetyResult.safe) {
      setCrisisInfo(safetyResult.crisisResources);
      return;
    }

    setIsLoading(true);

    try {
      const councilConfig: CouncilConfig = {
        moderator,
        participants: selectedFigures,
        question: userQuestion.trim(),
        category: {
          id: 'custom',
          titleKey: tString(customType === 'debate' ? 'cosmicCouncil.setup.customConfrontational' : 'cosmicCouncil.setup.customReflective', customType === 'debate' ? 'Custom Confrontational' : 'Custom Reflective'),
          subtitleKey: tString(customType === 'debate' ? 'cosmicCouncil.setup.customConfrontationalSubtitle' : 'cosmicCouncil.setup.customReflectiveSubtitle', customType === 'debate' ? 'Your philosophical council' : 'Your reflective council'),
          type: customType,
          tier: 'custom'
        }
      };

      await onStartCouncil(councilConfig);
      onClose();
    } catch (error) {
      // Handle safety-flagged errors from generator (Layer 1 backup)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.startsWith('SAFETY_FLAGGED:')) {
        try {
          const resources = JSON.parse(errorMessage.replace('SAFETY_FLAGGED:', ''));
          setCrisisInfo(resources);
        } catch {
          console.error('Failed to parse safety resources');
        }
      } else {
        console.error('Failed to start council:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const canStartCustomCouncil = moderator && selectedFigures.length > 0 && userQuestion.trim().length > 0;

  if (!isOpen) return null;


  return createPortal(
    <>
      {isLoading && <ProcessingLoader figureName={moderator?.name || 'Council'} />}

      <div
        className="council-setup-overlay"
        onClick={(e: MouseEvent<HTMLDivElement>) => {
          if (e.target === e.currentTarget) onClose();
        }}
        // Hidden but kept mounted while LiveCouncilPlayer is up — avoids
        // stacking two full-screen overlays during live council streaming.
        style={isCouncilUIActive ? { display: 'none' } : undefined}
      >
        <div
          ref={modalRef}
          className="council-setup-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="council-setup-title"
          tabIndex={-1}
          onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="council-setup-header">
            <div className="council-setup-title-section">
              <h2 className="council-setup-title" id="council-setup-title">
                <span className="council-setup-title-icon">
                  <MoonStars size={24} strokeWidth={2} />
                </span>
                {tString('cosmicCouncil.title', 'Cosmic Council')}
              </h2>
              <p className="council-setup-subtitle">
                {tString('cosmicCouncil.subtitle', 'Assemble wisdom from across time')}
              </p>
            </div>
            <CloseButton
              onClick={viewMode === 'custom' ? handleBackToCatalog : onClose}
              aria-label={viewMode === 'custom'
                ? tString('cosmicCouncil.cardFeed.backToCatalog', 'Back')
                : tString('common.close', 'Close')
              }
              className="desktop-close-button"
            />
          </div>

          {viewMode === 'catalog' ? (
            /* ====== CATALOG VIEW: Hero Section + Theme Rows ====== */
            <>
              {/* Hero Section — 2 curated heroes (same CouncilCard component) + custom builder */}
              <div className="council-hero-section">
                <CouncilCard council={heroConfrontational} onSelect={handleSelectCouncil} isHero />
                <CouncilCard council={heroReflective} onSelect={handleSelectCouncil} isHero />

                {/* Custom Builder Card */}
                <div
                  className="council-hero-custom"
                  role="button"
                  tabIndex={0}
                  aria-label={tString('cosmicCouncil.cardFeed.buildYourOwn', 'Build Your Own Council')}
                  onClick={handleBuildYourOwn}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBuildYourOwn();
                    }
                  }}
                >
                  <div className="council-hero-custom__icon">
                    <PuzzlePiece size={28} weight="duotone" />
                  </div>
                  <h3 className="council-hero-custom__title">
                    {tString('cosmicCouncil.cardFeed.buildYourOwn', 'Build Your Own Council')}
                  </h3>
                  <p className="council-hero-custom__subtitle">
                    {tString('cosmicCouncil.cardFeed.buildYourOwnSubtitle', 'Choose figures, set the question')}
                  </p>
                </div>
              </div>

              {/* Theme Rows */}
              {THEMES.map(theme => (
                <CouncilThemeRow
                  key={theme.id}
                  theme={theme}
                  councils={councilsByTheme[theme.id]}
                  onSelect={handleSelectCouncil}
                />
              ))}
            </>
          ) : (
            /* ====== CUSTOM BUILDER VIEW ====== */
            <>
              {/* Mini Figure Carousel */}
              <div className="council-setup-carousel-section">
                <MiniFigureCarousel
                  figures={historicalFigures}
                  onFigureSelect={handleFigureSelect}
                  selectedFigures={selectedFigures}
                  moderator={moderator ?? undefined}
                  isCustomCouncil={true}
                  hasModerator={!!moderator}
                />
              </div>

              {/* Solar System Interface */}
              <div className="council-setup-solar-section">
                <SolarSystemInterface
                  moderator={moderator ?? undefined}
                  participants={selectedFigures}
                  onFigureAdd={handleFigureSelect}
                  onFigureRemove={handleFigureRemove}
                  onModeratorChange={setModerator}
                  maxParticipants={3}
                  isCustomCouncil={true}
                />
              </div>

              {/* Question Input + Type Toggle */}
              <div className="council-setup-question-section">
                <div className="council-setup-question-header">
                  <label className="council-setup-question-label" htmlFor="council-question-textarea">
                    {tNode('cosmicCouncil.setup.questionLabel')}
                  </label>

                  {/* Compact pill toggle */}
                  <div className="council-type-pill" role="radiogroup" aria-label={tString('cosmicCouncil.setup.councilType', 'Discussion Style')}>
                    <button
                      className={`council-type-pill__option ${customType === 'debate' ? 'council-type-pill__option--active' : ''}`}
                      onClick={() => setCustomType('debate')}
                      role="radio"
                      aria-checked={customType === 'debate'}
                    >
                      <span role="img" aria-hidden="true">🔥</span>
                      {tNode('cosmicCouncil.setup.debate')}
                    </button>
                    <button
                      className={`council-type-pill__option ${customType === 'advisory' ? 'council-type-pill__option--active' : ''}`}
                      onClick={() => setCustomType('advisory')}
                      role="radio"
                      aria-checked={customType === 'advisory'}
                    >
                      <span role="img" aria-hidden="true">🌊</span>
                      {tNode('cosmicCouncil.setup.advisory')}
                    </button>
                  </div>
                </div>

                <textarea
                  id="council-question-textarea"
                  className="council-setup-question-input"
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder={
                    customType === 'debate'
                      ? tString('cosmicCouncil.setup.debatePlaceholder', '')
                      : tString('cosmicCouncil.setup.advisoryPlaceholder', '')
                  }
                  rows={3}
                  maxLength={500}
                  aria-describedby="council-question-counter"
                />
                {/* role="status" has implicit polite live-region semantics —
                    SR-friendly without announcing every keystroke. */}
                <div
                  id="council-question-counter"
                  className="council-setup-question-counter"
                  role="status"
                >
                  {tString('cosmicCouncil.setup.charCounter', '{used} of {max}')
                    .replace('{used}', String(userQuestion.length))
                    .replace('{max}', '500')}
                </div>
              </div>

              {/* Action Bar */}
              <div className="council-setup-actions">
                <button
                  // Quota-exhausted overrides the disabled visual: the button
                  // is fully clickable in that state (opens the BYOK popup),
                  // so it should not look greyed-out.
                  className={`council-setup-action-primary ${!canStartCustomCouncil && !isCouncilExhausted ? 'disabled' : ''}`}
                  onClick={handleStartCustomCouncil}
                  disabled={!isCouncilExhausted && (!canStartCustomCouncil || isLoading)}
                  data-quota-exhausted={isCouncilExhausted || undefined}
                  aria-describedby={isCouncilExhausted ? 'council-setup-quota-help' : undefined}
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner" />
                      {tNode('cosmicCouncil.setup.starting')}
                    </>
                  ) : (
                    <>
                      <Play size={18} weight="fill" />
                      {tNode('cosmicCouncil.setup.startCouncil')}
                    </>
                  )}
                </button>
                {/* a11y: visually-hidden helper announced via aria-describedby
                    when free-tier quota is exhausted. Without this, SR users
                    tap "Open the Council" and get the BYOK popup instead of a
                    council with no warning of why. Inline-styled because the
                    CSS architecture is frozen and there is no shared
                    visually-hidden utility class. */}
                {isCouncilExhausted && (
                  <span
                    id="council-setup-quota-help"
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      padding: 0,
                      margin: '-1px',
                      overflow: 'hidden',
                      clip: 'rect(0, 0, 0, 0)',
                      whiteSpace: 'nowrap',
                      border: 0,
                    }}
                  >
                    {tString(
                      'cosmicCouncil.setup.quotaExhaustedHelp',
                      'Free-tier daily council limit reached. Opening this will show how to use your own AI key for unlimited councils.',
                    )}
                  </span>
                )}
              </div>

              {/* Council Summary */}
              <div className="council-setup-summary">
                <div className="council-setup-summary-item">
                  <Crown size={16} weight="fill" />
                  <span>{tNode('cosmicCouncil.setup.moderator')}: {moderator ? getShortDisplayName(moderator.id) : tString('cosmicCouncil.setup.noModerator', 'None')}</span>
                </div>
                <div className="council-setup-summary-item">
                  <Sparkle size={16} weight="fill" />
                  <span>{tNode('cosmicCouncil.setup.participants')}: {selectedFigures.length}/3</span>
                </div>
                {selectedFigures.length > 0 && (
                  <div className="council-setup-summary-item">
                    <Globe size={16} weight="fill" />
                    <span>
                      {(() => {
                        const balance = countGenderBalance(selectedFigures);
                        return `${tString('cosmicCouncil.setup.balance', 'Balance')}: ${balance.male}M / ${balance.female}F`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Sheet for catalog council selection */}
      <CouncilDetailSheet
        council={selectedCouncil}
        onClose={() => setSelectedCouncil(null)}
        onPlay={handleCuratedSelect}
      />

      {/* Crisis Resources Overlay */}
      {crisisInfo && (
        <div
          className="council-crisis-overlay"
          role="alertdialog"
          aria-label={tString('cosmicCouncil.crisis.dialogLabel', 'Support resources')}
        >
          <div className="council-crisis-card">
            <p className="council-crisis-message">
              {language === 'de' ? crisisInfo.message.de : crisisInfo.message.en}
            </p>
            <ul className="council-crisis-resources">
              {crisisInfo.resources.map((r) => (
                <li key={r.name} className="council-crisis-resource">
                  <strong>{r.name}</strong>
                  <span className="council-crisis-contact">{r.contact}</span>
                  <span className="council-crisis-description">
                    {language === 'de' ? r.description.de : r.description.en}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="council-crisis-close"
              onClick={() => setCrisisInfo(null)}
            >
              {tString('common.gotIt', 'Got it!')}
            </button>
          </div>
        </div>
      )}

      {/* Council Setup Helper Popup */}
      {showCouncilHelp && (
        <HelperPopup
          isOpen={true}
          onDismiss={() => setShowCouncilHelp(false)}
          title={tString('helpers.councilSetup.welcome.title', 'Cosmic Council')}
          content={
            <div className="council-setup-help-content">
              {/* What to expect */}
              <div className="council-setup-help-overview">
                <h4 className="council-setup-help-heading">
                  <Users size={18} className="council-setup-help-heading-icon" />
                  {tNode('helpers.councilSetup.welcome.sections.overview.title')}
                </h4>
                <p className="council-setup-help-text">
                  {tNode('helpers.councilSetup.welcome.sections.overview.text')}
                </p>
              </div>

              {/* Two styles */}
              <div className="council-setup-help-section">
                <h4 className="council-setup-help-heading">
                  <Zap size={18} className="council-setup-help-heading-icon" />
                  {tNode('helpers.councilSetup.welcome.sections.modes.title')}
                </h4>
                <ul className="council-setup-help-list">
                  {Array.isArray(t('helpers.councilSetup.welcome.sections.modes.points')) ?
                    (t('helpers.councilSetup.welcome.sections.modes.points') as string[]).map((point, i) => (
                      <li key={i} className="council-setup-help-list-item">
                        <span>{point}</span>
                      </li>
                    )) : null}
                </ul>
              </div>

              {/* Curated councils */}
              <div className="council-setup-help-section">
                <h4 className="council-setup-help-heading">
                  <Star size={18} className="council-setup-help-heading-icon" />
                  {tNode('helpers.councilSetup.welcome.sections.curated.title')}
                </h4>
                <p className="council-setup-help-text">
                  {tNode('helpers.councilSetup.welcome.sections.curated.text')}
                </p>
              </div>

              {/* Build your own */}
              <div className="council-setup-help-section">
                <h4 className="council-setup-help-heading">
                  <Wrench size={18} className="council-setup-help-heading-icon" />
                  {tNode('helpers.councilSetup.welcome.sections.building.title')}
                </h4>
                <p className="council-setup-help-text">
                  {tNode('helpers.councilSetup.welcome.sections.building.text')}
                </p>
              </div>

              {/* Legal footer */}
              <div className="council-setup-help-modes">
                <p className="council-setup-help-text" style={{ opacity: 0.6, fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>
                  {tNode('helpers.councilSetup.welcome.sections.transparency.brief')}
                </p>
              </div>
            </div>
          }
          buttonText={tString('helpers.common.beginExploring', 'Begin Exploring')}
          showDontAskAgain={true}
          onDontAskAgain={handleDontShowCouncilHelp}
        />
      )}
    </>,
    document.body
  );
};

export default CouncilSetupModal;
