import { useState, useEffect, useRef, FC, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { Bird, Books, Sparkle, Mountains, DiamondsFour } from '@phosphor-icons/react';
import { CloseButton } from './Button';
import OptimizedFigureImage from './OptimizedFigureImage';
import { isStoryCompleted, isPrismCompleted, STORAGE_KEYS } from '../utils/storageKeysV2';
import useTranslation from '../hooks/useTranslation';
import type { Figure, Seed } from '../types/global';
import './ModeSelector-Mini.css';

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
  const { t, tString, tNode } = useTranslation();

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

  const [animatingOut, setAnimatingOut] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isClosingRef = useRef<boolean>(false);

  // Responsive icon sizes
  const nodeIconSize = windowWidth < 480 ? 28 : windowWidth < 768 ? 32 : 40;
  const isMobile = windowWidth < 768;

  // Completion state helper — uses existing storageKeysV2 helpers
  const getNodeState = (modeId: string): 'dormant' | 'visited' | 'completed' | 'active' => {
    if (selectedMode === modeId) return 'active';
    if (!selectedFigure || !selectedSeed) return 'dormant';
    const fId = selectedFigure.id;
    const sId = selectedSeed.id;

    switch (modeId) {
      case 'introduction':
        if (isStoryCompleted(fId, sId)) return 'completed';
        break;
      case 'prism':
        if (isPrismCompleted(fId, sId)) return 'completed';
        break;
      case 'seed_conversation':
        if (localStorage.getItem(STORAGE_KEYS.getStarSeedHistory(fId, sId))) return 'completed';
        break;
      case 'challenge':
        if (localStorage.getItem(STORAGE_KEYS.getChallengeHistory(fId, sId))) return 'completed';
        break;
    }

    if (visitedModes.includes(modeId)) return 'visited';
    return 'dormant';
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
        {/* Freetalk card — top billing, separate from chapter system */}
          <div className="mode-selector-header">
            <button
              className="eclipse-freetalk-card"
              onClick={() => handleModeSelect('free_conversation')}
              aria-label={tString('modes.selector.freetalk.title', 'Freetalk')}
            >
              <Bird size={20} weight="duotone" className="eclipse-freetalk-card-icon" />
              <div className="eclipse-freetalk-card-text">
                <span className="eclipse-freetalk-card-title">
                  {tString('modes.selector.freetalkCta')}
                </span>
                <span className="eclipse-freetalk-card-sub">
                  {tString('modes.selector.freetalkCtaSub')}
                </span>
              </div>
              <Bird size={20} weight="duotone" className="eclipse-freetalk-card-icon eclipse-freetalk-card-icon--mirrored" />
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
                  {String(selectedSeed.id).includes('-') ? String(selectedSeed.id).split('-')[1] : selectedSeed.id}. {selectedSeed.title}
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
      </div>
    </div>,
    document.body
  );
};

export default ModeSelectorMini;
