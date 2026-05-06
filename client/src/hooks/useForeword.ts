// useForeword.ts - Hook to load foreword content for figures
import { useState, useEffect } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { getMediaUrl, getMediaHeaders } from '../utils/mediaConfig';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

// All figures have a foreword (intro audio/text with seedId 0)

export interface ForewordData {
  text: string;
  audioUrl: string;
  figureId: string;
  language: string;
}

interface UseForewordResult {
  foreword: ForewordData | null;
  loading: boolean;
  error: string | null;
  hasForeword: boolean;
}

/**
 * Build the path for foreword files
 * Pattern: stories/{figure}/{lang}/{figure}_0_{lang}.{ext}
 */
const buildForewordPath = (figureId: string, language: string, extension: string): string => {
  return `stories/${figureId}/${language}/${figureId}_0_${language}.${extension}`;
};

/**
 * Check if a figure has a foreword
 */
export const figureHasForeword = (figureId: string): boolean => {
  return Boolean(figureId);
};

/**
 * Hook to load foreword content for a figure
 */
export const useForeword = (figureId: string): UseForewordResult => {
  const language = useDomainStore((state) => state.language.current);
  const [foreword, setForeword] = useState<ForewordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedFigureId = figureId?.toLowerCase() || '';
  const hasForeword = figureHasForeword(normalizedFigureId);

  useEffect(() => {
    if (!hasForeword || !normalizedFigureId) {
      setForeword(null);
      setLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();

    const loadForeword = async () => {
      setLoading(true);
      setError(null);

      try {
        // Determine language code (only EN/DE supported)
        let langCode = language.toLowerCase();
        if (!['en', 'de'].includes(langCode)) {
          langCode = 'en'; // Fallback to English
        }

        // Build paths
        const textPath = buildForewordPath(normalizedFigureId, langCode, 'txt');
        const audioPath = buildForewordPath(normalizedFigureId, langCode, 'webm');

        // Get URLs
        const textUrl = getMediaUrl(textPath);
        const audioUrl = getMediaUrl(audioPath);

        // Load text content
        const headers = getMediaHeaders();
        const textResponse = await fetchWithTimeout(textUrl, { headers, signal: abortController.signal, timeoutMs: 10_000 });

        if (!textResponse.ok) {
          // Try English fallback
          if (langCode !== 'en') {
            const fallbackTextPath = buildForewordPath(normalizedFigureId, 'en', 'txt');
            const fallbackAudioPath = buildForewordPath(normalizedFigureId, 'en', 'webm');
            const fallbackTextUrl = getMediaUrl(fallbackTextPath);
            const fallbackAudioUrl = getMediaUrl(fallbackAudioPath);

            const fallbackResponse = await fetchWithTimeout(fallbackTextUrl, { headers, signal: abortController.signal, timeoutMs: 10_000 });
            if (fallbackResponse.ok) {
              const text = await fallbackResponse.text();
              if (!abortController.signal.aborted) {
                setForeword({
                  text,
                  audioUrl: fallbackAudioUrl,
                  figureId: normalizedFigureId,
                  language: 'en'
                });
              }
              setLoading(false);
              return;
            }
          }
          throw new Error('Foreword not found');
        }

        const text = await textResponse.text();
        if (!abortController.signal.aborted) {
          setForeword({
            text,
            audioUrl,
            figureId: normalizedFigureId,
            language: langCode
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error loading foreword:', err);
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load foreword');
          setForeword(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadForeword();

    return () => { abortController.abort(); };
  }, [normalizedFigureId, language, hasForeword]);

  return { foreword, loading, error, hasForeword };
};
