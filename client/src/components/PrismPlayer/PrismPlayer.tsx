/**
 * PrismPlayer - Immersive cinematic multi-perspective dialogue player
 *
 * Trailer-style "one sentence at a time" subtitle display with smooth
 * figure crossfade between speakers. Auto-hiding controls with glass morphism.
 *
 * Audio: single combined MP3 per prism (smooth seeking, no gaps)
 * Subtitles: character-level timestamps → word chunking → sentence chunks
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMediaSession } from './useMediaSession';
import useAudio from '../../hooks/useAudio';
import { useTranslation } from '../../hooks/useTranslation';
import { useDomainStore } from '../../stores/domainStore';
import { loadServiceConfig } from '../../services/audio/config/serviceConfig';
import prismService, {
  type PrismData,
  type PrismSegmentWithOffset,
  type PrismTimestamps,
} from '../../services/prism/PrismService';
import councilPlayerService from '../../services/council/CouncilPlayerService';
import { loadSeedsDirectly } from '../../services/directSeedLoader';
import { councilCatalog, getLocalizedTitle, getEchoShortName } from '../../data/councilCatalog';
import { savePrismContent, markPrismCompleted, saveCouncilContent, markCouncilCompleted } from '../../utils/storageKeysV2';
import { useSubtitleSync } from './useSubtitleSync';
import { useLiquidGlass } from '../../hooks/useLiquidGlass';
import OptimizedFigureImage from '../OptimizedFigureImage';
import CloseButton from '../Button/CloseButton/CloseButton';
import PrismPreviewCard from './PrismPreviewCard';
import type { SeedConnection } from '../../types/global';
import './PrismPlayer.css';

interface PrismPlayerProps {
  figure?: string;
  seed?: number;
  councilId?: string;
  councilLevel?: 1 | 2;
  language?: string;
  onClose?: () => void;
}

const PROGRESS_SAVE_INTERVAL = 5000; // Save every 5s

interface SavedProgress {
  lastTimeSeconds: number;
  lastSegmentIndex: number;
  updatedAt: string;
  totalSegments?: number;
}

export function PrismPlayer({ figure, seed, councilId, councilLevel = 1, language: languageProp, onClose }: PrismPlayerProps) {
  const isCouncilMode = !!councilId;
  const { tString } = useTranslation();
  const { glassClasses } = useLiquidGlass('audio');
  const storeLanguage = useDomainStore(state => state.language.current);
  const language = languageProp || storeLanguage || 'en';

  // --- Data state ---
  const [prismData, setPrismData] = useState<PrismData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestampsBySegment, setTimestampsBySegment] = useState<Map<number, PrismTimestamps>>(new Map());

  // --- UI state ---
  const [showControls, setShowControls] = useState(true);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [showPreviewCard, setShowPreviewCard] = useState(!isCouncilMode);

  // --- Seed data for preview card (title, quote, connections) ---
  const [seedData, setSeedData] = useState<{
    title: string;
    quote?: string;
    connections: SeedConnection[];
  } | null>(null);

  // --- Figure crossfade state: two layers ---
  const [figureLayer, setFigureLayer] = useState<{ front: string; back: string }>({ front: '', back: '' });
  const [showFrontLayer, setShowFrontLayer] = useState(true);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTriggeredRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const currentSegmentRef = useRef(0);

  // --- Audio ---
  const {
    isPlaying,
    isLoading: audioLoading,
    currentTimeSeconds,
    durationSeconds,
    progress,
    playbackRate,
    togglePlay,
    seek,
    changePlaybackRate,
    audioRef,
  } = useAudio(prismData?.audioUrl ?? null, {
    onPlaybackComplete: handlePlaybackComplete,
    initialPlaybackRate: loadServiceConfig().ttsSettings.speed,
    playbackBeacon: isCouncilMode
      ? { type: 'council', mode: 'council' }
      : { type: 'prism', figureId: figure, mode: 'prism' },
  });

  // --- Recompute segment offsets accounting for inter-segment gaps in combined MP3 ---
  // The combined audio has silence gaps between segments (e.g. 1s each).
  // Manifest segment durations don't include these gaps, so naive cumulative
  // offsets drift by ~1s per segment. We distribute the gap evenly.
  const audioTimelineSegments = useMemo(() => {
    if (!prismData?.segments?.length) return [];
    const audioTotal = durationSeconds;
    if (!audioTotal || !isFinite(audioTotal) || audioTotal <= 0) return prismData.segments;

    const sumOfDurations = prismData.segments.reduce((sum, seg) => sum + seg.duration, 0);
    const totalGap = audioTotal - sumOfDurations;
    const numGaps = prismData.segments.length - 1;
    const gapPerBoundary = numGaps > 0 ? Math.max(0, totalGap / numGaps) : 0;

    let offset = 0;
    return prismData.segments.map((seg, i) => {
      if (i > 0) offset += gapPerBoundary;
      const result = {
        ...seg,
        startOffset: offset,
        endOffset: offset + seg.duration,
      };
      offset += seg.duration;
      return result;
    });
  }, [prismData, durationSeconds]);

  // --- Subtitle sync (uses audio-timeline segments) ---
  const subtitleState = useSubtitleSync(
    audioTimelineSegments,
    currentTimeSeconds,
    timestampsBySegment
  );

  // --- Media Session (lock screen controls) ---
  const mediaSessionTitle = useMemo(() => {
    if (!prismData) return '';
    if (isCouncilMode && councilId) {
      const council = councilCatalog.find(c => c.id === councilId);
      return council ? getLocalizedTitle(council, language) : councilId;
    }
    return prismData.manifest.seedTitle || '';
  }, [prismData, isCouncilMode, councilId, language]);

  useMediaSession({
    title: mediaSessionTitle,
    figureId: subtitleState.figureId,
    isPlaying,
    currentTimeSeconds,
    durationSeconds,
    playbackRate,
    onTogglePlay: togglePlay,
    onSkipBack: skipBack,
    onSkipForward: skipForward,
  });

  // --- Compute progress key for save/load/clear ---
  const getProgressKey = useCallback((lang: string): string => {
    if (isCouncilMode) {
      return `councilProgress_${councilId}_L${councilLevel}_${lang}`;
    }
    return `prismProgress_${figure}_${seed}_${lang}`;
  }, [isCouncilMode, councilId, councilLevel, figure, seed]);

  // --- Load prism/council data ---
  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let data: PrismData;

        if (isCouncilMode) {
          data = await councilPlayerService.loadCouncil(councilId!, language, {
            signal: abortController.signal,
            level: councilLevel,
          });
        } else {
          data = await prismService.loadPrism(figure!, seed!, language, {
            signal: abortController.signal,
          });
        }

        if (cancelled) return;
        setPrismData(data);

        // Save transcript for history display + LLM context
        const transcript = data.manifest.segments
          .map(seg => `${seg.speaker}: ${seg.text}`)
          .join('\n\n');

        if (isCouncilMode) {
          saveCouncilContent(councilId!, transcript);
        } else {
          savePrismContent(String(figure), seed!, transcript);
        }

        // Initialize figure layers with host figure
        setFigureLayer({ front: data.manifest.figure, back: '' });
        setShowFrontLayer(true);

        // Check for saved progress
        const progressKey = getProgressKey(data.lang);
        const saved = loadProgress(progressKey);
        if (saved && saved.lastTimeSeconds > 10) {
          setResumeTime(saved.lastTimeSeconds);
          setShowResumeBanner(true);
        }

        // Load seed data for preview card (prism mode only)
        if (!isCouncilMode && figure) {
          try {
            const seedCollection = await loadSeedsDirectly(figure, data.lang);
            if (seedCollection && !cancelled) {
              const matchingSeed = seedCollection.seeds.find(
                s => Number(s.id) === seed
              );
              if (matchingSeed) {
                setSeedData({
                  title: matchingSeed.title,
                  quote: matchingSeed.quote,
                  connections: matchingSeed.connections || [],
                });
              }
            }
          } catch (seedErr) {
            // Seed data is optional, preview card works with fallback
            if (import.meta.env.DEV) {
              console.warn('PrismPlayer: Failed to load seed data for preview:', seedErr);
            }
          }
        }

        // Preload all timestamps in background
        if (isCouncilMode) {
          councilPlayerService.preloadTimestamps(
            councilId!,
            data.lang,
            data.segments,
            councilLevel,
            abortController.signal
          ).then(() => {
            if (cancelled) return;
            const map = new Map<number, PrismTimestamps>();
            data.segments.forEach((seg, index) => {
              councilPlayerService.loadSegmentTimestamps(councilId!, data.lang, index, seg.figureId, councilLevel, abortController.signal)
                .then(ts => {
                  if (ts && !cancelled) {
                    map.set(index, ts);
                    setTimestampsBySegment(new Map(map));
                  }
                });
            });
          });
        } else {
          prismService.preloadTimestamps(
            figure!,
            seed!,
            data.manifest.segments,
            data.lang,
            abortController.signal
          ).then(() => {
            if (cancelled) return;
            const map = new Map<number, PrismTimestamps>();
            data.manifest.segments.forEach((seg, index) => {
              prismService.loadSegmentTimestamps(figure!, seed!, index, seg.figureId, data.lang)
                .then(ts => {
                  if (ts && !cancelled) {
                    map.set(index, ts);
                    setTimestampsBySegment(new Map(map));
                  }
                });
            });
          });
        }

      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          console.error('PrismPlayer: Failed to load:', err);
          setError(tString('prismPlayer.loadError', 'Could not load this prism.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [figure, seed, councilId, councilLevel, isCouncilMode, language, tString, getProgressKey]);

  // --- Crossfade figure on speaker change ---
  useEffect(() => {
    const newFigureId = subtitleState.figureId;
    if (!newFigureId) return;

    // Check if the new figure is different from the currently visible one
    const currentVisible = showFrontLayer ? figureLayer.front : figureLayer.back;
    if (newFigureId === currentVisible) return;

    // Load new figure into the hidden layer, then flip
    if (showFrontLayer) {
      setFigureLayer(prev => ({ ...prev, back: newFigureId }));
      // Small delay to let the image start loading before crossfade
      requestAnimationFrame(() => {
        setShowFrontLayer(false);
      });
    } else {
      setFigureLayer(prev => ({ ...prev, front: newFigureId }));
      requestAnimationFrame(() => {
        setShowFrontLayer(true);
      });
    }
  }, [subtitleState.figureId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Controls auto-hide ---
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Keep refs in sync with latest values for stable interval/unmount callbacks
  currentTimeRef.current = currentTimeSeconds;
  currentSegmentRef.current = subtitleState.currentSegmentIndex;

  // --- Progress persistence ---
  useEffect(() => {
    if (!isPlaying || !prismData) return;

    const key = getProgressKey(prismData.lang);
    const totalSegments = prismData.segments.length;
    progressTimerRef.current = setInterval(() => {
      saveProgress(key, currentTimeRef.current, currentSegmentRef.current, totalSegments);
    }, PROGRESS_SAVE_INTERVAL);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, prismData, getProgressKey]);

  // Save on pause
  useEffect(() => {
    if (!isPlaying && prismData && currentTimeSeconds > 0) {
      saveProgress(getProgressKey(prismData.lang), currentTimeSeconds, subtitleState.currentSegmentIndex, prismData.segments.length);
    }
  }, [isPlaying, prismData, currentTimeSeconds, subtitleState.currentSegmentIndex, getProgressKey]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (prismData && currentTimeRef.current > 0) {
        saveProgress(getProgressKey(prismData.lang), currentTimeRef.current, currentSegmentRef.current, prismData.segments.length);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prismData]);

  // --- Mark completed when last segment's content ends (don't wait for audio ended event) ---
  // Users close the player when the last subtitle finishes, which is before any trailing
  // audio silence. This ensures the completion flag is set before they leave.
  useEffect(() => {
    if (!prismData || !isPlaying || completionTriggeredRef.current) return;
    if (audioTimelineSegments.length === 0) return;

    const lastIndex = audioTimelineSegments.length - 1;
    if (subtitleState.currentSegmentIndex < lastIndex) return;

    const lastSeg = audioTimelineSegments[lastIndex];
    if (currentTimeSeconds >= lastSeg.endOffset) {
      completionTriggeredRef.current = true;
      handlePlaybackComplete();
    }
  }, [currentTimeSeconds, subtitleState.currentSegmentIndex, prismData, audioTimelineSegments, isPlaying]);

  // --- Keyboard shortcuts (disabled during preview card) ---
  useEffect(() => {
    if (showPreviewCard) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'Escape':
          if (onClose) {
            onClose();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, onClose, showPreviewCard]);

  // --- Handlers ---

  function handlePlaybackComplete() {
    if (prismData) {
      clearProgress(getProgressKey(prismData.lang));

      if (isCouncilMode) {
        markCouncilCompleted(councilId!);
      } else {
        markPrismCompleted(String(figure), seed!);
      }
    }
  }

  function handleResume() {
    if (resumeTime !== null && durationSeconds > 0) {
      const pct = (resumeTime / durationSeconds) * 100;
      seek(pct);
      setShowResumeBanner(false);
      // Reset completion guard so replayed content can trigger completion again
      completionTriggeredRef.current = false;
      togglePlay();
    }
  }

  function handleDismissResume() {
    setShowResumeBanner(false);
    setResumeTime(null);
  }

  function handlePreviewListen() {
    setShowPreviewCard(false);
    // If saved progress, seek to position and play
    if (resumeTime !== null && durationSeconds > 0) {
      const pct = (resumeTime / durationSeconds) * 100;
      seek(pct);
      setShowResumeBanner(false);
      completionTriggeredRef.current = false;
    }
    togglePlay();
  }

  function handlePreviewBack() {
    if (onClose) onClose();
  }

  function skipBack() {
    if (durationSeconds <= 0) return;
    const newTime = Math.max(0, currentTimeSeconds - 15);
    seek((newTime / durationSeconds) * 100);
    // Reset completion guard when seeking backward
    if (completionTriggeredRef.current) {
      completionTriggeredRef.current = false;
    }
  }

  function skipForward() {
    if (durationSeconds <= 0) return;
    const newTime = Math.min(durationSeconds, currentTimeSeconds + 15);
    seek((newTime / durationSeconds) * 100);
  }

  function adjustSpeed(increment: number) {
    const newSpeed = Math.round((playbackRate + increment) * 100) / 100;
    const clamped = Math.min(Math.max(newSpeed, 0.5), 2.0);
    changePlaybackRate(clamped);
  }

  function handleContainerInteraction() {
    resetControlsTimer();
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // --- Unique key for sentence chunk animation ---
  const chunkKey = `${subtitleState.currentSegmentIndex}-${subtitleState.currentChunkIndex}`;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="prism-player prism-player--loading">
        <div className="prism-player__loader">
          <div className="prism-player__spinner" />
          <p>{isCouncilMode
            ? tString('cosmicCouncil.loading', 'Assembling cosmic council...')
            : tString('prismPlayer.loading', 'Loading prism...')}</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error || !prismData) {
    return (
      <div className="prism-player prism-player--error">
        <p>{error || tString('prismPlayer.loadError', 'Could not load this prism.')}</p>
        {onClose && (
          <button className="prism-player__close-btn" onClick={onClose}>
            {tString('common.back', 'Back')}
          </button>
        )}
      </div>
    );
  }

  // --- Preview card (prism mode only, before playback) ---
  if (showPreviewCard && !isCouncilMode) {
    const previewConnections = (seedData?.connections || []).slice(0, 3).map(conn => ({
      figure: conn.figure,
      type: conn.type,
      summary: conn.summary || conn.relationship,
    }));

    return (
      <div className="prism-player prism-player--preview">
        <PrismPreviewCard
          seedTitle={seedData?.title || prismData.manifest.seedTitle}
          seedQuote={seedData?.quote}
          hostName={prismData.manifest.host}
          hostFigureId={prismData.segments[0]?.figureId || prismData.manifest.figure}
          connections={previewConnections}
          totalDuration={prismData.totalDuration}
          savedProgress={resumeTime !== null && resumeTime > 10 ? { lastTimeSeconds: resumeTime } : null}
          onListen={handlePreviewListen}
          onBack={handlePreviewBack}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`prism-player ${isPlaying ? 'prism-player--playing' : ''}`}
      onClick={handleContainerInteraction}
      onTouchStart={handleContainerInteraction}
    >
      {/* Full-bleed stage: image fills entire container, everything overlays */}
      <div className="prism-player__stage">
        {/* Dual-layer crossfade figure images */}
        {figureLayer.front && (
          <div className={`prism-player__figure-bg ${showFrontLayer ? 'prism-player__figure-bg--visible' : 'prism-player__figure-bg--hidden'}`}>
            <OptimizedFigureImage
              figure={figureLayer.front}
              type="main"
              priority={true}
              withBlurUp={true}
              className="prism-player__figure-img"
              alt={subtitleState.speakerName || prismData.manifest.host}
            />
          </div>
        )}
        {figureLayer.back && (
          <div className={`prism-player__figure-bg ${!showFrontLayer ? 'prism-player__figure-bg--visible' : 'prism-player__figure-bg--hidden'}`}>
            <OptimizedFigureImage
              figure={figureLayer.back}
              type="main"
              priority={true}
              withBlurUp={true}
              className="prism-player__figure-img"
              alt={subtitleState.speakerName || prismData.manifest.host}
            />
          </div>
        )}

        {/* Speaker label is now rendered in the top bar (council mode) — no
            on-portrait overlay needed. Prism mode keeps no label here. */}

        {/* Sentence chunk - one sentence at a time, instant replace with subtle crossfade */}
        {subtitleState.currentChunk && (
          <p className="prism-player__sentence" key={chunkKey}>
            {subtitleState.currentChunk}
          </p>
        )}

        {/* Resume banner - overlaid, centered (council mode only; prism uses preview card) */}
        {showResumeBanner && isCouncilMode && (
          <div className="prism-player__resume-banner">
            <span className="prism-player__resume-text">
              {tString('prismPlayer.continueListening', 'Continue where you left off?')}
            </span>
            <button className="prism-player__resume-btn" onClick={handleResume}>
              {tString('prismPlayer.resume', 'Resume')}
            </button>
            <button onClick={handleDismissResume} className="prism-player__resume-dismiss">
              &times;
            </button>
          </div>
        )}

        {/* Controls overlay - floats over image */}
        <div className={`prism-player__controls-bar ${glassClasses} ${showControls ? 'prism-player__controls-bar--visible' : ''}`}>
          {/* Progress bar with segment markers */}
          <div className="prism-player__progress-area">
            <span className="prism-player__time">{formatTime(currentTimeSeconds)}</span>
            <div
              className="prism-player__progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-label={tString('audioLibrary.controls.progress', 'Progress')}
            >
              <div
                className="prism-player__progress-fill"
                style={{ width: `${progress}%` }}
              />
              {audioTimelineSegments.map((seg, i) => {
                if (i === 0) return null;
                const pct = durationSeconds > 0 ? (seg.startOffset / durationSeconds) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="prism-player__segment-marker"
                    style={{ left: `${pct}%` }}
                  />
                );
              })}
            </div>
            <span className="prism-player__time">{formatTime(durationSeconds)}</span>
          </div>

          {/* Playback controls row */}
          <div className="prism-player__playback-row">
            <div className="prism-player__speed-control">
              <span className="prism-player__speed-label">{playbackRate.toFixed(2)}×</span>
              <div className="prism-player__speed-arrows">
                <button
                  className="prism-player__speed-arrow"
                  onClick={(e) => { e.stopPropagation(); adjustSpeed(0.05); }}
                  aria-label={tString('prismPlayer.increaseSpeed', 'Increase speed')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M19 15L12 8L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  className="prism-player__speed-arrow"
                  onClick={(e) => { e.stopPropagation(); adjustSpeed(-0.05); }}
                  aria-label={tString('prismPlayer.decreaseSpeed', 'Decrease speed')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <button
              className="prism-player__btn prism-player__btn--skip"
              onClick={skipBack}
              aria-label={tString('prismPlayer.skipBack', 'Back 15s')}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                <text x="12" y="15" textAnchor="middle" fontSize="7" fill="currentColor">15</text>
              </svg>
            </button>

            <button
              className="prism-player__btn prism-player__btn--play"
              onClick={togglePlay}
              aria-label={isPlaying
                ? tString('audioLibrary.controls.pause', 'Pause')
                : tString('audioLibrary.controls.play', 'Play')
              }
            >
              {audioLoading ? (
                <div className="prism-player__spinner prism-player__spinner--small" />
              ) : isPlaying ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              className="prism-player__btn prism-player__btn--skip"
              onClick={skipForward}
              aria-label={tString('prismPlayer.skipForward', 'Forward 15s')}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                <text x="12" y="15" textAnchor="middle" fontSize="7" fill="currentColor">15</text>
              </svg>
            </button>

          </div>
        </div>

        {/* Top bar — current speaker (council mode). Always-visible flow strip
            so the figure image sits below it (not cropped by an overlay). */}
        {isCouncilMode && (
          <div className="prism-player__top-bar">
            <span
              className="prism-player__top-bar-title"
              key={`speaker-bar-${subtitleState.figureId || 'idle'}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {getEchoShortName(subtitleState.figureId, tString) || mediaSessionTitle}
            </span>
            {onClose && (
              <CloseButton
                onClick={() => onClose()}
                ariaLabel={tString('common.close', 'Close')}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// --- Progress helpers (key-based for both prism and council) ---

function saveProgress(key: string, time: number, segIndex: number, totalSegs?: number) {
  try {
    const data: SavedProgress = {
      lastTimeSeconds: time,
      lastSegmentIndex: segIndex,
      updatedAt: new Date().toISOString(),
      ...(totalSegs != null && { totalSegments: totalSegs }),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage quota exceeded or disabled
  }
}

function loadProgress(key: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

function clearProgress(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export default PrismPlayer;
