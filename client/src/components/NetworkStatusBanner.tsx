// Network status + circuit breaker banner
// Shows when: offline, reconnected, TTS/STT circuit breaker opens, a Local Mode
// audio service does not answer
import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTranslation } from '../hooks/useTranslation';

type RateLimitHint = 'switch_to_english' | 'disable_tts' | 'rate_limited';

type BannerState =
  | { type: 'hidden' }
  | { type: 'offline' }
  | { type: 'reconnected' }
  | { type: 'circuit-breaker'; service: 'tts' | 'stt' }
  | { type: 'rate-limit'; hint: RateLimitHint }
  | { type: 'byok-fallback' }
  | { type: 'local-mode'; service: 'tts' | 'stt'; heardNothing?: boolean };

const BANNER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 'env(safe-area-inset-top, 0px)',
  left: 0,
  right: 0,
  zIndex: 10000,
  padding: '10px 16px',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'opacity 0.3s ease',
};

// Every line is opaque on a design-system colour with the night ink: warning
// 5.0:1, error 5.4:1, success 6.8:1. The page showing through would pull them
// under 4.5:1.
const WARNING_COLORS: React.CSSProperties = {
  background: 'var(--color-warning)',
  color: 'var(--bg-void)',
};
const ERROR_COLORS: React.CSSProperties = {
  background: 'var(--color-error)',
  color: 'var(--bg-void)',
};
const SUCCESS_COLORS: React.CSSProperties = {
  background: 'var(--color-success)',
  color: 'var(--bg-void)',
};

const NetworkStatusBanner: FC = () => {
  const { isOnline } = useNetworkStatus();
  const { tString } = useTranslation();
  const [banner, setBanner] = useState<BannerState>({ type: 'hidden' });
  const [wasOffline, setWasOffline] = useState(false);

  // Offline / reconnected logic
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setBanner({ type: 'offline' });
    } else if (wasOffline) {
      setBanner({ type: 'reconnected' });
      const timer = setTimeout(() => setBanner({ type: 'hidden' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Circuit breaker listener
  const handleCircuitBreaker = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    const service = detail?.service as 'tts' | 'stt';
    setBanner({ type: 'circuit-breaker', service });
    const timer = setTimeout(() => setBanner(prev =>
      prev.type === 'circuit-breaker' ? { type: 'hidden' } : prev
    ), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.addEventListener('circuit-breaker', handleCircuitBreaker);
    return () => window.removeEventListener('circuit-breaker', handleCircuitBreaker);
  }, [handleCircuitBreaker]);

  // Audio rate limit listener (GPU-aware degradation hints)
  const handleRateLimit = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    const hint = (detail?.hint as RateLimitHint) || 'rate_limited';
    setBanner({ type: 'rate-limit', hint });
    const timer = setTimeout(() => setBanner(prev =>
      prev.type === 'rate-limit' ? { type: 'hidden' } : prev
    ), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.addEventListener('audio-rate-limit', handleRateLimit);
    return () => window.removeEventListener('audio-rate-limit', handleRateLimit);
  }, [handleRateLimit]);

  // BYOK key rejected mid-session — the conversation transparently continued on
  // the free tier. Let the power user know so they can fix their key.
  const handleByokFallback = useCallback(() => {
    setBanner({ type: 'byok-fallback' });
    const timer = setTimeout(() => setBanner(prev =>
      prev.type === 'byok-fallback' ? { type: 'hidden' } : prev
    ), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.addEventListener('byok-fell-back', handleByokFallback);
    return () => window.removeEventListener('byok-fell-back', handleByokFallback);
  }, [handleByokFallback]);

  // Local Mode audio fails closed instead of using our servers. Voice reports
  // once per chunk of every reply, so its line shows at most once a minute (the
  // banner covers the menu); transcription reports once per recording.
  const localModeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const localVoiceShownAt = useRef(-Infinity);
  useEffect(() => {
    const handleLocalModeUnavailable = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const service = detail?.service === 'stt' ? 'stt' : 'tts';
      if (service === 'tts') {
        if (Date.now() - localVoiceShownAt.current < 60_000) return;
        localVoiceShownAt.current = Date.now();
      }
      setBanner({ type: 'local-mode', service, heardNothing: service === 'stt' && detail?.reason === 'empty' });
      clearTimeout(localModeTimer.current);
      localModeTimer.current = setTimeout(() => setBanner(prev =>
        prev.type === 'local-mode' ? { type: 'hidden' } : prev
      ), 10000);
    };
    window.addEventListener('local-mode-unavailable', handleLocalModeUnavailable);
    return () => {
      window.removeEventListener('local-mode-unavailable', handleLocalModeUnavailable);
      clearTimeout(localModeTimer.current);
    };
  }, []);

  if (banner.type === 'hidden') return null;

  let message: string;
  let colors: React.CSSProperties;

  switch (banner.type) {
    case 'offline':
      message = tString('errors.network.offline', 'You are offline. Some features may not work.');
      colors = ERROR_COLORS;
      break;
    case 'reconnected':
      message = tString('errors.network.reconnected', 'Connection restored');
      colors = SUCCESS_COLORS;
      break;
    case 'circuit-breaker':
      message = banner.service === 'tts'
        ? tString('errors.network.ttsUnavailable', 'Audio is temporarily unavailable. Showing text only.')
        : tString('errors.network.sttUnavailable', 'Speech recognition is temporarily unavailable. Please type instead.');
      colors = WARNING_COLORS;
      break;
    case 'rate-limit':
      if (banner.hint === 'switch_to_english') {
        message = tString('errors.network.gpuCapacityGerman', 'GPU capacity is high. Switch to English for continued audio.');
        colors = WARNING_COLORS;
      } else if (banner.hint === 'disable_tts') {
        message = tString('errors.network.gpuCapacityAll', 'Audio servers are busy. Turn off TTS in settings to continue chatting.');
        colors = ERROR_COLORS;
      } else {
        message = tString('errors.network.audioRateLimited', 'Audio rate limited. Please wait a moment.');
        colors = WARNING_COLORS;
      }
      break;
    case 'byok-fallback':
      message = tString('errors.network.byokFellBack', 'Your OpenRouter key was rejected, so this reply used the free tier. Check your key in Settings.');
      colors = WARNING_COLORS;
      break;
    case 'local-mode':
      if (banner.service === 'tts') {
        message = tString('errors.network.localTtsUnavailable', 'Local voice output is not reachable, so you get text without audio. Check Local Mode in Settings.');
      } else if (banner.heardNothing) {
        message = tString('errors.network.localSttEmpty', 'Local voice input heard no words. Speak again, or type your message.');
      } else {
        message = tString('errors.network.localSttUnavailable', 'Local voice input is not reachable. Check Local Mode in Settings, or type your message.');
      }
      colors = WARNING_COLORS;
      break;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ ...BANNER_STYLE, ...colors }}
    >
      {message}
    </div>
  );
};

export default NetworkStatusBanner;
