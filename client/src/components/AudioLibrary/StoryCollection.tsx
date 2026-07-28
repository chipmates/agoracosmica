// src/components/AudioLibrary/StoryCollection.tsx
// Spotify-inspired modern design - 2025 best practices
import { FC, useState, useEffect, useMemo } from 'react';
import { Play, Check, Clock, SpeakerSimpleHigh, BookOpen, DownloadSimple } from '@phosphor-icons/react';
import { AUDIO_SUPPORTED_LANGUAGES } from '../../constants/languages';
import { getSeedById } from '../../services/seedCacheInitializer';
import { useTranslation } from '../../hooks/useTranslation';
import { useSeedTranslation } from '../../hooks/useSeedTranslation';
import { useFileSize } from '../../hooks/useFileSize';
import { useDomainStore } from '../../stores/domainStore';
import { getMediaUrl } from '../../utils/mediaConfig';
import { STORY_DOWNLOADS_ENABLED } from '../../config/features';
import { DownloadControl } from '../DownloadControl';
import {
  buildEpisodeFilename,
  formatFileSize,
  getEpisodeAudioUrl,
  getStoryArchiveUrl,
  probeStoryArchive
} from '../../services/mediaDownload';
import type { ArchiveProbe } from '../../services/mediaDownload';

import { Story } from '../../types/global';
import { FactCheckModal } from '../FactCheck';
import { useStoryProgress } from '../../hooks/useStoryProgress';
import './StoryCollection.css';

interface Figure {
  id?: string;
  name: string;
  [key: string]: any;
}

interface PlayedStory {
  playedAt: number;
  completed: boolean;
}

interface StoryCollectionProps {
  figure?: Figure | null;
  currentStory?: Story | null;
  onPlayStory: (story: Story) => void;
}

// All figures have a Foreword (intro audio file *_0_*.webm)
const figureHasForeword = (_figureId: string): boolean => true;

// Helper to format duration to MM:SS
const formatDuration = (seconds?: number): string => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Load all durations for a figure from a single JSON file (one request per figure)
const fetchFigureDurations = async (figureId: string): Promise<Record<string, number>> => {
  const path = `stories/${figureId}/durations.json`;
  try {
    const response = await fetch(getMediaUrl(path));
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
};

// Helper to get played stories from localStorage
const getPlayedStories = (): Record<string, PlayedStory> => {
  try {
    const played = localStorage.getItem('audioLibrary_playedStories');
    return played ? JSON.parse(played) : {};
  } catch {
    return {};
  }
};

// Helper to mark story as played
const markStoryAsPlayed = (storyId: string): void => {
  const played = getPlayedStories();
  played[storyId] = {
    playedAt: Date.now(),
    completed: false
  };
  localStorage.setItem('audioLibrary_playedStories', JSON.stringify(played));
};

interface EpisodeDownloadProps {
  figureId: string;
  seedId: string;
  title: string;
  echoName: string;
  language: string;
}

/**
 * Per-episode download for a list row. Always the mp3: the webm the player
 * streams is smaller but useless outside a browser.
 */
const EpisodeDownload: FC<EpisodeDownloadProps> = ({ figureId, seedId, title, echoName, language }) => {
  const { tString } = useTranslation();
  const url = getEpisodeAudioUrl(figureId, seedId, language);
  const bytes = useFileSize(url);

  return (
    <DownloadControl
      variant="stacked"
      iconSize={16}
      url={url}
      filename={buildEpisodeFilename({ echoName, seedId, title, language, ext: 'mp3' })}
      label={bytes ? formatFileSize(bytes, language) : ''}
      ariaLabel={tString('download.audioAria', 'Download the audio for {title}').replace('{title}', title)}
    />
  );
};

const StoryCollection: FC<StoryCollectionProps> = ({ figure, currentStory, onPlayStory }) => {
  const { tString, tNode } = useTranslation();
  const language = useDomainStore((state) => state.language.current);
  const { getTranslatedSeedTitle } = useSeedTranslation();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setPlayedStories] = useState<Record<string, PlayedStory>>({});
  const [hoveredStory, setHoveredStory] = useState<string | null>(null);
  const [showFactCheck, setShowFactCheck] = useState(false);

  // Normalize figure ID for consistency
  const normalizeFigureId = (id?: string): string => {
    if (!id) return '';
    const specialCases: Record<string, string> = {
      'vinci': 'vinci', 'leonardo': 'vinci', 'leonardo da vinci': 'vinci',
      'zenji': 'zenji', 'dogen': 'zenji', 'dogen zenji': 'zenji',
      'gautama': 'gautama', 'siddhartha': 'gautama', 'buddha': 'gautama',
      'galilei': 'galilei', 'galileo': 'galilei',
      'king': 'king', 'martin luther king': 'king', 'martin luther king jr': 'king',
      'bingen': 'bingen', 'hildegard': 'bingen',
      'aurelius': 'aurelius', 'marcus': 'aurelius'
    };
    const lower = id.toLowerCase();
    return specialCases[lower] || lower;
  };

  // Stable figure ID for hooks + effects
  const figureId = useMemo(() => normalizeFigureId(figure?.id || figure?.name || ''), [figure]);

  // Per-track progress from localStorage (real-time updates via storyProgressUpdated event)
  const progressMap = useStoryProgress(figureId, stories, language);

  // Whole-figure archive. The route lives on the audio worker and may not be
  // deployed, so it is probed first and the affordance stays hidden on failure.
  const [archive, setArchive] = useState<ArchiveProbe | null>(null);
  useEffect(() => {
    if (!STORY_DOWNLOADS_ENABLED || !figureId) {
      setArchive(null);
      return;
    }
    let cancelled = false;
    setArchive(null);
    probeStoryArchive(figureId, language).then(result => {
      if (!cancelled) setArchive(result);
    });
    return () => { cancelled = true; };
  }, [figureId, language]);
  
  // Get figure display name (with proper Echo translation)
  const getFigureDisplayName = (fullName?: string): string => {
    if (!fullName) return '';
    
    // Extract base name without Echo prefix
    const baseName = fullName
      .replace(/^Echo of /i, '')
      .replace(/^Echo von /i, '')
      .replace(/^Echo de /i, '')
      .trim();
    
    // Return with translated Echo prefix
    return tString('figures.echoOfName', `Echo of ${baseName}`).replace('{name}', baseName);
  };
  
  // Load played stories on mount
  useEffect(() => {
    setPlayedStories(getPlayedStories());
  }, []);
  
  // Load stories for the selected figure
  useEffect(() => {
    if (!figure) return;
    let cancelled = false;

    setLoading(true);

    // Create story items for all 12 seeds (durations loaded async)
    const storyItems: Story[] = [];
    const figureId = normalizeFigureId(figure.id || figure.name);
    const hasForeword = figureHasForeword(figureId);

    // Add Foreword item first if figure has one
    if (hasForeword) {
      storyItems.push({
        id: `${figureId}-0`,
        figureId: figureId,
        seedId: '0',
        title: tString('audioLibrary.foreword', 'Foreword'),
        type: 'foreword',
        language: language,
        hasAudio: AUDIO_SUPPORTED_LANGUAGES.includes(language)
      });
    }

    for (let seedId = 1; seedId <= 12; seedId++) {
      // Try to get seed data for title
      const seedData = getSeedById(figureId, seedId, language);

      // Get translated title
      let title = '';
      if (seedData) {
        title = getTranslatedSeedTitle(figureId, seedId) ||
               seedData.title ||
               `Seed ${seedId}`;
      } else {
        title = getTranslatedSeedTitle(figureId, seedId) ||
               `Seed ${seedId}`;
      }

      storyItems.push({
        id: `${figureId}-${seedId}`,
        figureId: figureId,
        seedId: String(seedId),
        title: title,
        type: 'seed',
        language: language,
        hasAudio: AUDIO_SUPPORTED_LANGUAGES.includes(language)
      });
    }

    setStories(storyItems);
    setLoading(false);

    // Load all durations in one request
    fetchFigureDurations(figureId).then(durations => {
      if (cancelled) return;
      setStories(prev => prev.map(story => {
        const key = `${language}_${story.seedId}`;
        return { ...story, duration: durations[key] ?? story.duration };
      }));
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure, language]);
  
  // Calculate total duration
  const totalDuration = useMemo(() => {
    return stories.reduce((sum, story) => sum + (story.duration || 0), 0);
  }, [stories]);
  
  // Handle story play
  const handlePlay = (story: Story): void => {
    const playableStory = {
      ...story,
      language: language
    };
    
    // Mark as played
    markStoryAsPlayed(story.id);
    setPlayedStories(getPlayedStories());
    
    // Call parent handler
    onPlayStory(playableStory);
  };
  
  if (loading) {
    return (
      <div className="story-collection loading">
        <div className="story-collection__skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-item"></div>
          <div className="skeleton-item"></div>
          <div className="skeleton-item"></div>
        </div>
      </div>
    );
  }
  
  if (stories.length === 0) {
    return (
      <div className="story-collection empty">
        <p className="empty-message">{tString('audioLibrary.noStories', `No stories available for ${getFigureDisplayName(figure?.name)}`).replace('{{figureName}}', getFigureDisplayName(figure?.name))}</p>
      </div>
    );
  }

  const isCurrentlyPlaying = (storyId: string): boolean => currentStory?.id === storyId;

  const echoName = getFigureDisplayName(figure?.name);
  const showDownloads = STORY_DOWNLOADS_ENABLED;
  const showArchive = showDownloads && !!archive?.available && !!figureId;
  const archiveLabel = archive?.bytes
    ? tString('download.allWithSize', 'Download all {count} stories ({size})')
        .replace('{count}', String(stories.length))
        .replace('{size}', formatFileSize(archive.bytes, language))
    : tString('download.all', 'Download all {count} stories')
        .replace('{count}', String(stories.length));

  return (
    <div className={`story-collection${showDownloads ? ' story-collection--downloads' : ''}`}>
      {/* Header Section - Figure name shown once */}
      <div className="story-collection__header">
        <div className="story-collection__figure-info">
          <div className="story-collection__text">
            <h2 className="story-collection__figure-name">
              {getFigureDisplayName(figure?.name)}
            </h2>
            <div className="story-collection__metadata">
              <span className="story-collection__count">
                {stories.length} {tNode('audioLibrary.stories')}
              </span>
              <span className="story-collection__separator">•</span>
              <span className="story-collection__duration">
                <Clock size={14} />
                {formatDuration(totalDuration)}
              </span>
              <span className="story-collection__separator">•</span>
              <button
                className="story-collection__facts-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFactCheck(true);
                }}
                aria-label={tString('factCheck.facts')}
              >
                <BookOpen size={14} />
                {tNode('factCheck.facts')}
              </button>
            </div>

            {showArchive && (
              <div className="story-collection__actions">
                <a
                  className="story-collection__download-all"
                  href={getStoryArchiveUrl(figureId, language)}
                  download
                  rel="noopener"
                  aria-label={tString('download.allAria', 'Download every story by {name} as one file').replace('{name}', echoName)}
                >
                  <DownloadSimple size={16} weight="duotone" />
                  <span>{archiveLabel}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Stories List - Spotify-style */}
      <div className="story-collection__list">
        {stories.map((story, index) => {
          const isPlaying = isCurrentlyPlaying(story.id);
          const isHovered = hoveredStory === story.id;
          const canPlay = story.hasAudio;
          const isForeword = story.type === 'foreword';
          const storyProgress = progressMap[story.id];
          const hasProgress = storyProgress && storyProgress.status !== 'not-started';
          const isStoryDone = storyProgress?.status === 'completed';
          const progressPct = storyProgress?.status === 'in-progress' ? storyProgress.percentage : 100;

          return (
            <div
              key={story.id}
              className={`story-item ${isPlaying ? 'story-item--playing' : ''}
                         ${isStoryDone ? 'story-item--played' : ''}
                         ${!canPlay ? 'story-item--disabled' : ''}
                         ${isForeword ? 'story-item--foreword' : ''}`}
              onMouseEnter={() => setHoveredStory(story.id)}
              onMouseLeave={() => setHoveredStory(null)}
              onClick={() => canPlay && handlePlay(story)}
              role="button"
              tabIndex={canPlay ? 0 : -1}
              onKeyDown={(e) => {
                if (canPlay && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handlePlay(story);
                }
              }}
              aria-label={`${isPlaying ? 'Now playing: ' : 'Play '}${story.title}`}
              style={{ cursor: canPlay ? 'pointer' : 'default' }}
            >
              {/* Track Number / Play Button / Foreword Icon */}
              <div className="story-item__number">
                {isPlaying ? (
                  <div className="story-item__equalizer">
                    <SpeakerSimpleHigh size={16} className="equalizer-icon" />
                  </div>
                ) : isHovered && canPlay ? (
                  <div className="story-item__play-btn">
                    <Play size={16} />
                  </div>
                ) : isStoryDone ? (
                  <Check size={16} className="story-item__check" />
                ) : hasProgress ? (
                  <Clock size={16} className="story-item__in-progress" />
                ) : isForeword ? (
                  <BookOpen size={16} className="story-item__foreword-icon" />
                ) : (
                  <span className="story-item__index">{index + (figureHasForeword(story.figureId) ? 0 : 1)}</span>
                )}
              </div>
              
              {/* Track Info */}
              <div className="story-item__info">
                <div className="story-item__title">{story.title}</div>
                {isPlaying && (
                  <div className="story-item__subtitle">
                    {tNode('audioLibrary.nowPlayingLabel')}
                  </div>
                )}
              </div>
              
              {/* Duration */}
              <div className="story-item__duration">
                {formatDuration(story.duration)}
              </div>

              {/* Download — its own cell so a tap never starts playback */}
              {showDownloads && (
                <div
                  className="story-item__download"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {canPlay && (
                    <EpisodeDownload
                      figureId={story.figureId}
                      seedId={story.seedId}
                      title={story.title}
                      echoName={echoName}
                      language={language}
                    />
                  )}
                </div>
              )}

              {/* Progress bar */}
              {hasProgress && (
                <div
                  className={`story-progress-track${isStoryDone ? ' story-progress-track--completed' : ''}`}
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`story-progress-fill${isStoryDone ? ' story-progress-fill--completed' : ''}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FactCheck Modal */}
      {showFactCheck && (
        <FactCheckModal
          figureId={normalizeFigureId(figure?.id || figure?.name)}
          figureName={figure?.name}
          onClose={() => setShowFactCheck(false)}
        />
      )}
    </div>
  );
};

export default StoryCollection;
