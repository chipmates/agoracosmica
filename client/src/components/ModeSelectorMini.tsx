import { useState, useEffect, useMemo, useRef, FC, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { Bird, Books, Sparkle, Mountains, DiamondsFour } from '@phosphor-icons/react';
import { CloseButton } from './Button';
import OptimizedFigureImage from './OptimizedFigureImage';
import { isStoryCompleted, isPrismCompleted, STORAGE_KEYS } from '../utils/storageKeysV2';
import { isFirstContactForFigure, resolveNodeState } from '../utils/flowDecisions';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { peekStagedQuestion } from '../utils/public/entryIntent';
import useTranslation from '../hooks/useTranslation';
import type { Figure, Seed } from '../types/global';
import './ModeSelector-Mini.css';

// Real chapter-1 length per figure, from the generated story catalogs. Sixty
// files, so the glob stays lazy and only the open figure's language file is
// fetched; the static meta line stands in until it arrives.
interface StoryCatalog {
  chapters: Array<{ segment: number; minutes: number }>;
}
const storyCatalogs = import.meta.glob<{ default: StoryCatalog }>(
  '../data/public/stories/*/*.json'
);

// Eclipse mode definitions — clockwise: Story (12), Wisdom (3), Prism (6), Quest (9)
// Orbital coordinates: x/y normalized (-1 to 1), like council SolarSystemInterface
const ECLIPSE_MODES = [
  { id: 'introduction', titleKey: 'modes.selector.story.title', descKey: 'modes.selector.story.description', icon: Books, theme: 'gold', orbitX: 0, orbitY: -1, labelKey: 'modes.selector.listen', chapter: 1 },
  { id: 'seed_conversation', titleKey: 'modes.selector.wisdom.title', descKey: 'modes.selector.wisdom.description', icon: Sparkle, theme: 'purple', orbitX: 1, orbitY: 0, labelKey: 'modes.selector.talk', chapter: 2 },
  { id: 'prism', titleKey: 'modes.selector.prism.title', descKey: 'modes.selector.prism.description', icon: DiamondsFour, theme: 'blue', orbitX: 0, orbitY: 1, labelKey: 'modes.selector.listen', chapter: 3 },
  { id: 'challenge', titleKey: 'modes.selector.quest.title', descKey: 'modes.selector.quest.description', icon: Mountains, theme: 'coral', orbitX: -1, orbitY: 0, labelKey: 'modes.selector.talk', chapter: 4 },
] as const;

interface ModeSelectorMiniProps {
  isOpen: boolean;
  onClose: () => void;
  onModeSelect: (mode: string) => void;
  selectedMode?: string | null;
  selectedFigure?: Figure | null;
  selectedSeed?: Seed | null;
}

const ModeSelectorMini: FC<ModeSelectorMiniProps> = ({
  isOpen,
  onClose,
  onModeSelect,
  selectedMode = null,
  selectedFigure,
  selectedSeed
}) => {
  const { tString, language } = useTranslation();

  // Track window width for responsive icon sizes
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track visited modes for progress indication
  const getVisitedModesKey = () => {
    if (!selectedFigure || !selectedSeed) return null;
    return `visitedModes_${selectedFigure.id}_${selectedSeed.id}`;
  };

  const loadVisitedModes = (): string[] => {
    const key = getVisitedModesKey();
    if (!key) return [];
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading visited modes:', error);
      return [];
    }
  };

  const saveVisitedMode = (mode: string) => {
    const key = getVisitedModesKey();
    if (!key) return;
    try {
      const visited = new Set(loadVisitedModes());
      visited.add(mode);
      localStorage.setItem(key, JSON.stringify([...visited]));
    } catch (error) {
      console.error('Error saving visited mode:', error);
    }
  };

  const [visitedModes] = useState<string[]>(loadVisitedModes());

  // First contact is per FIGURE, not per seed: the doors are a one-time
  // welcome ceremony. A returning visitor who picks a fresh seed from the
  // wisdom map or the seeds modal has already met the figure and goes
  // straight to the eclipse. Engagement leaves per-seed keys behind
  // (visited modes, story/prism completions, starseed and challenge
  // history, free talk), so one prefix scan over local keys answers
  // "has this visitor ever engaged with this figure" across all seeds
  // and all entry paths.
  const isFirstContact = selectedFigure
    ? isFirstContactForFigure(
        selectedFigure.id,
        LocalStorageAdapter.keys(),
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getFreeTalkHistory(selectedFigure.id))
      )
    : false;
  const [showAllWays, setShowAllWays] = useState<boolean>(false);

  // The question a public-page door carried in. Shown, never consumed: the
  // composer still picks it up once Free Talk opens.
  const stagedQuestion = useMemo(
    () => (isOpen ? peekStagedQuestion(selectedFigure?.id ?? null, language, tString) : null),
    [isOpen, selectedFigure?.id, language, tString]
  );

  // Chapter 1's real running time, for the honest meta line on the story door.
  const [chapterMinutes, setChapterMinutes] = useState<number | null>(null);
  useEffect(() => {
    setChapterMinutes(null);
    if (!isOpen || !isFirstContact || !selectedFigure) return;
    const loader = storyCatalogs[`../data/public/stories/${language}/${selectedFigure.id}.json`];
    if (!loader) return;
    let alive = true;
    loader()
      .then((mod) => {
        const minutes = mod.default?.chapters?.find((c) => c.segment === 1)?.minutes;
        if (alive && typeof minutes === 'number' && minutes > 0) setChapterMinutes(minutes);
      })
      .catch(() => {
        // catalog chunk unavailable — the static meta line stands
      });
    return () => { alive = false; };
  }, [isOpen, isFirstContact, selectedFigure, language]);

  const [animatingOut, setAnimatingOut] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isClosingRef = useRef<boolean>(false);

  // Responsive icon sizes
  const nodeIconSize = windowWidth < 480 ? 28 : windowWidth < 768 ? 32 : 40;
  const isMobile = windowWidth < 768;

  // Completion state helper. Guarded reads (LocalStorageAdapter swallows
  // storage-blocked throws): this runs during render, so a raw localStorage
  // throw would crash the mode selector to the error boundary. Missing = not done.
  const getNodeState = (modeId: string): 'dormant' | 'visited' | 'completed' | 'active' => {
    const hasSelection = !!(selectedFigure && selectedSeed);
    const fId = selectedFigure?.id ?? '';
    const sId = selectedSeed?.id ?? '';
    return resolveNodeState(modeId, {
      selectedMode,
      hasSelection,
      storyCompleted: hasSelection && isStoryCompleted(fId, sId),
      prismCompleted: hasSelection && isPrismCompleted(fId, sId),
      wisdomEngaged: hasSelection && !!LocalStorageAdapter.getString(STORAGE_KEYS.getStarSeedHistory(fId, sId)),
      challengeEngaged: hasSelection && !!LocalStorageAdapter.getString(STORAGE_KEYS.getChallengeHistory(fId, sId)),
      visitedModes,
    });
  };

  // Determine sun click target: current mode, or Story as default
  const getSunTargetMode = (): string => {
    if (selectedMode && selectedMode !== 'free_conversation') return selectedMode;
    return 'introduction';
  };

  // Reset when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setAnimatingOut(false);
      setShowAllWays(false);
      isClosingRef.current = false;
    }
  }, [isOpen, selectedMode]);

  // Handle escape key + focus trap (Tab cycling)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Tab cycling focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    modalRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle smooth close animation
  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setAnimatingOut(true);

    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 400);
  };

  const handleModeSelect = (mode: string) => {
    if (import.meta.env.DEV) console.log('[ModeSelectorMini] handleModeSelect called with:', mode);
    if (isClosingRef.current) return;

    saveVisitedMode(mode);

    setTimeout(() => {
      if (onModeSelect) {
        onModeSelect(mode);
      }
    }, 300);
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`mode-selector-overlay ${animatingOut ? 'fade-out' : 'fade-in'}`}
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-selector-title"
    >
      {/* Close button */}
      <CloseButton
        onClick={handleClose}
        aria-label={`Close ${tString('modes.selector.title', 'Mode Selector').toLowerCase()}`}
        size="large"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 1000,
          background: 'transparent'
        }}
      />

      <div className="mode-selector-content-wrapper">
        {isFirstContact && !showAllWays ? (
          /* The threshold: first contact with this figure. Two honest doors
             with their real costs (a 15 minute listen, or a chat right now),
             the full eclipse one tap away. Any engagement ends first contact,
             so returners always get the map directly. */
          <div className="doors">
            {selectedFigure && (
              <div className="doors-portrait" aria-hidden="true">
                <OptimizedFigureImage
                  figure={selectedFigure}
                  type="thumbnail"
                  className="doors-portrait-img"
                  alt=""
                  width={112}
                  height={112}
                />
                <div className="doors-portrait-glow" />
              </div>
            )}
            <h2 id="mode-selector-title" className="doors-title">
              {tString('modes.doors.title', 'How do you want to start with {name}?')
                .replace('{name}', selectedFigure?.name || 'this Echo')}
            </h2>
            {/* No seed subtitle here: the doors are first contact, and the
                auto-defaulted wisdom name ("1. Der unbearbeitete Block") reads
                as context-free noise before any chapter exists. The eclipse
                keeps its seed line — returners have the context. */}
            <div className="doors-row">
              <button className="doors-door doors-door--story" onClick={() => handleModeSelect('introduction')}>
                <Books size={30} weight="duotone" className="doors-door-icon" />
                <span className="doors-door-eyebrow">{tString('modes.doors.arcEyebrow', 'The learning arc · Chapter 1 of 4')}</span>
                <span className="doors-door-standard">{tString('modes.doors.standardMarker', 'Most people start here')}</span>
                <span className="doors-door-name">{tString('modes.doors.storyTitle', 'Begin the story')}</span>
                <span className="doors-door-body">{tString('modes.doors.storyBody', 'It starts with a narrated scene from a life. The story lays the ground for everything after. You talk it through, hear it debated, then make it yours.')}</span>
                {/* The arc, legible at a glance: four chapter glyphs, the
                    first one lit. Decorative, the eyebrow and body carry the
                    same information as text. */}
                <span className="doors-arc" aria-hidden="true">
                  {ECLIPSE_MODES.map((m, i) => {
                    const StepIcon = m.icon;
                    return (
                      <span key={m.id} className={`doors-arc-step${i === 0 ? ' doors-arc-step--now' : ''}`}>
                        <StepIcon size={14} weight="duotone" />
                        <span className="doors-arc-step-label">{tString(m.titleKey)}</span>
                      </span>
                    );
                  })}
                </span>
                <span className="doors-door-meta">
                  {chapterMinutes
                    ? tString('modes.doors.storyMetaTimed', 'Four chapters. The first takes around {minutes} minutes.')
                        .replace('{minutes}', String(chapterMinutes))
                    : tString('modes.doors.storyMeta', 'Four chapters. The first takes around 15 minutes.')}
                </span>
              </button>
              <button className="doors-door doors-door--talk" onClick={() => handleModeSelect('free_conversation')}>
                <Bird size={30} weight="duotone" className="doors-door-icon" />
                <span className="doors-door-eyebrow">{tString('modes.selector.freetalk.title', 'Free Talk')}</span>
                <span className="doors-door-name">
                  {stagedQuestion
                    ? tString('modes.doors.talkTitleStaged', 'Ask your question')
                    : tString('modes.doors.talkTitle', 'Just ask something')}
                </span>
                {stagedQuestion && (
                  <span className="doors-staged">
                    <span className="doors-staged-label">{tString('modes.doors.stagedLabel', 'Your question is waiting:')}</span>
                    <span className="doors-staged-text">{stagedQuestion.text}</span>
                  </span>
                )}
                <span className="doors-door-body">{tString('modes.doors.talkBody', 'Your question sets the direction. Good when time is short, or when something is already on your mind.')}</span>
                <span className="doors-door-meta">{tString('modes.doors.talkMeta', 'Right now. 30 free messages a day.')}</span>
              </button>
            </div>
            <button className="doors-allways" onClick={() => setShowAllWays(true)}>
              {tString('modes.doors.allWays', 'See all the ways')} →
            </button>
          </div>
        ) : (
        <>
        {/* Freetalk card — top billing, separate from chapter system */}
          <div className="mode-selector-header">
            <button
              className={`eclipse-freetalk-card${stagedQuestion ? ' eclipse-freetalk-card--staged' : ''}`}
              onClick={() => handleModeSelect('free_conversation')}
              aria-label={tString('modes.selector.freetalk.title', 'Freetalk')}
            >
              <Bird size={20} weight="duotone" className="eclipse-freetalk-card-icon" />
              <div className="eclipse-freetalk-card-text">
                <span className="eclipse-freetalk-card-line">
                  <span className="eclipse-freetalk-card-title">
                    {tString('modes.selector.freetalkCta')}
                  </span>
                  <span className="eclipse-freetalk-card-sub">
                    {tString('modes.selector.freetalkCtaSub')}
                  </span>
                </span>
                {stagedQuestion && (
                  <span className="eclipse-freetalk-card-staged">
                    <span className="eclipse-freetalk-card-staged-label">
                      {tString('modes.doors.stagedLabel', 'Your question is waiting:')}
                    </span>
                    <span className="eclipse-freetalk-card-staged-text">{stagedQuestion.text}</span>
                  </span>
                )}
              </div>
            </button>

            {/* Divider — gradient line + chapter heading below */}
            <div className="eclipse-chapter-divider">
              <div className="eclipse-chapter-divider-line" aria-hidden="true" />
              <h2 id="mode-selector-title" className="eclipse-chapter-divider-text">
                {tString('modes.selector.chapterDivider')}
              </h2>
            </div>
          </div>

          {/* Eclipse Layout with flanking explainers */}
          <div className="eclipse-layout">
            {/* Desktop explainers — left side (Ch1 Story, Ch2 Wisdom) */}
            <div className="eclipse-explainer eclipse-explainer--left" aria-hidden={isMobile ? 'true' : undefined}>
              <div className="eclipse-explainer-item eclipse-explainer-item--gold">
                <strong>{tString('modes.selector.chapterLabel')} 1 · {tString('modes.selector.story.title')}</strong>
                <span>{tString('modes.selector.story.description')}</span>
              </div>
              <div className="eclipse-explainer-item eclipse-explainer-item--purple">
                <strong>{tString('modes.selector.chapterLabel')} 2 · {tString('modes.selector.wisdom.title')}</strong>
                <span>{tString('modes.selector.wisdom.description')}</span>
              </div>
            </div>

            {/* Eclipse container */}
            <div className="eclipse-container" role="radiogroup" aria-label={`Available ${tString('modes.selector.title', 'Mode Selector').toLowerCase()}`}>
              {/* Orbital ring */}
              <div className="eclipse-ring" aria-hidden="true" />
              <div className="eclipse-ring-glow" aria-hidden="true" />

              {/* Center sun = figure portrait → resumes current mode */}
              <button
                className="eclipse-sun"
                onClick={() => handleModeSelect(getSunTargetMode())}
                aria-label={`${selectedFigure?.name || 'Continue'} — ${tString(
                  ECLIPSE_MODES.find(m => m.id === getSunTargetMode())?.titleKey || 'modes.selector.story.title'
                )}`}
              >
                {selectedFigure ? (
                  <OptimizedFigureImage
                    figure={selectedFigure}
                    type="thumbnail"
                    className="eclipse-sun-portrait"
                    alt={selectedFigure.name}
                    width={140}
                    height={140}
                  />
                ) : (
                  <Bird size={40} weight="duotone" className="eclipse-sun-icon" />
                )}
              </button>
              {/* Seed name under sun — numbered to match wisdom map */}
              {selectedSeed?.title && (
                <span className="eclipse-sun-seed">
                  {String(selectedSeed.id).includes('-') ? String(selectedSeed.id).split('-')[1] : selectedSeed.id} · {selectedSeed.title}
                </span>
              )}

              {/* 4 mode nodes — positioned like council orbit-slots */}
              {ECLIPSE_MODES.map(mode => {
                const state = getNodeState(mode.id);
                const IconComponent = mode.icon;
                return (
                  <button
                    key={mode.id}
                    className={`eclipse-node eclipse-node--${mode.theme} eclipse-node--${state}`}
                    style={{
                      '--orbit-x': mode.orbitX,
                      '--orbit-y': mode.orbitY,
                    } as CSSProperties}
                    onClick={() => handleModeSelect(mode.id)}
                    role="radio"
                    tabIndex={0}
                    aria-checked={state === 'active' ? 'true' : 'false'}
                    aria-label={`${tString(mode.titleKey)} — ${tString(mode.descKey)}${state === 'active' ? ', currently active' : ''}${state === 'completed' ? ', completed' : ''}`}
                  >
                    <div className="eclipse-node-icon">
                      <IconComponent size={nodeIconSize} weight="duotone" />
                      <span className="eclipse-node-num" aria-hidden="true">{mode.chapter}</span>
                    </div>
                    <span className="eclipse-node-title">{tString(mode.titleKey)}</span>
                    <span className="eclipse-node-label">{tString(mode.labelKey)}</span>
                  </button>
                );
              })}

            </div>

            {/* Desktop explainers — right side (Ch3 Prism, Ch4 Quest) */}
            <div className="eclipse-explainer eclipse-explainer--right" aria-hidden={isMobile ? 'true' : undefined}>
              <div className="eclipse-explainer-item eclipse-explainer-item--blue">
                <strong>{tString('modes.selector.chapterLabel')} 3 · {tString('modes.selector.prism.title')}</strong>
                <span>{tString('modes.selector.prism.description')}</span>
              </div>
              <div className="eclipse-explainer-item eclipse-explainer-item--coral">
                <strong>{tString('modes.selector.chapterLabel')} 4 · {tString('modes.selector.quest.title')}</strong>
                <span>{tString('modes.selector.quest.description')}</span>
              </div>
            </div>
          </div>

          {/* Mobile mode list — all 4 modes explained */}
          <div className="eclipse-mode-list">
            {ECLIPSE_MODES.map(mode => (
              <button
                key={mode.id}
                className={`eclipse-mode-list-item eclipse-mode-list-item--${mode.theme}`}
                onClick={() => handleModeSelect(mode.id)}
              >
                <strong>{tString('modes.selector.chapterLabel')} {mode.chapter} · {tString(mode.titleKey)}</strong>
                <span>{tString(mode.descKey)}</span>
              </button>
            ))}
          </div>
        </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ModeSelectorMini;
