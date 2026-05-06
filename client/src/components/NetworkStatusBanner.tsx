// Network status + circuit breaker banner
// Shows when: offline, reconnected, TTS/STT circuit breaker opens
import React, { FC, useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTranslation } from '../hooks/useTranslation';

type RateLimitHint = 'switch_to_english' | 'disable_tts' | 'rate_limited';

type BannerState =
  | { type: 'hidden' }
  | { type: 'offline' }
  | { type: 'reconnected' }
  | { type: 'circuit-breaker'; service: 'tts' | 'stt' }
  | { type: 'rate-limit'; hint: RateLimitHint };

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
  color: 'var(--text-on-dark, #fff)',
  transition: 'opacity 0.3s ease',
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

  if (banner.type === 'hidden') return null;

  let message: string;
  let bgColor: string;

  switch (banner.type) {
    case 'offline':
      message = tString('errors.network.offline', 'You are offline. Some features may not work.');
      bgColor = 'color-mix(in srgb, var(--error-color, #ef4444) 90%, transparent)';
      break;
    case 'reconnected':
      message = tString('errors.network.reconnected', 'Connection restored');
      bgColor = 'color-mix(in srgb, var(--success-color, #22c55e) 90%, transparent)';
      break;
    case 'circuit-breaker':
      message = banner.service === 'tts'
        ? tString('errors.network.ttsUnavailable', 'Audio is temporarily unavailable. Showing text only.')
        : tString('errors.network.sttUnavailable', 'Speech recognition is temporarily unavailable. Please type instead.');
      bgColor = 'color-mix(in srgb, var(--warning-color, #f59e0b) 90%, transparent)';
      break;
    case 'rate-limit':
      if (banner.hint === 'switch_to_english') {
        message = tString('errors.network.gpuCapacityGerman', 'GPU capacity is high. Switch to English for continued audio.');
        bgColor = 'color-mix(in srgb, var(--warning-color, #f59e0b) 90%, transparent)';
      } else if (banner.hint === 'disable_tts') {
        message = tString('errors.network.gpuCapacityAll', 'Audio servers are busy. Turn off TTS in settings to continue chatting.');
        bgColor = 'color-mix(in srgb, var(--error-color, #ef4444) 90%, transparent)';
      } else {
        message = tString('errors.network.audioRateLimited', 'Audio rate limited. Please wait a moment.');
        bgColor = 'color-mix(in srgb, var(--warning-color, #f59e0b) 90%, transparent)';
      }
      break;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{ ...BANNER_STYLE, background: bgColor }}
    >
      {message}
    </div>
  );
};

export default NetworkStatusBanner;
