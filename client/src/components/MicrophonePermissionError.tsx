// src/components/MicrophonePermissionError.tsx
// User-facing microphone permission error component with recovery instructions

import { FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { isIOS, isAndroid } from '../utils/deviceDetection';
import { X, Warning } from '@phosphor-icons/react';
import './MicrophonePermissionError.css';

export type MicrophoneErrorType = 'denied' | 'not-found' | 'not-readable' | 'security' | 'generic';

interface MicrophonePermissionErrorProps {
  errorType: MicrophoneErrorType;
  onDismiss: () => void;
  onRetry?: () => void;
}

/**
 * Toast/modal component for microphone permission errors
 *
 * Shows platform-specific recovery instructions:
 * - iOS: Settings → Safari → Microphone
 * - Android: Tap 🔒 → Site Settings → Microphone
 * - Desktop: Browser settings instructions
 *
 * Features:
 * - Error classification (denied, not-found, not-readable, etc.)
 * - Platform-specific guidance
 * - Retry button (optional)
 * - Fallback suggestion (use text input instead)
 */
export const MicrophonePermissionError: FC<MicrophonePermissionErrorProps> = ({
  errorType,
  onDismiss,
  onRetry
}) => {
  const { t, tString } = useTranslation();

  const getErrorMessage = (): { title: string; message: string; canRetry: boolean } => {
    switch (errorType) {
      case 'denied':
        if (isIOS()) {
          return {
            title: tString('errors.mic.denied.title', 'Microphone Access Denied'),
            message: tString(
              'errors.mic.denied.ios',
              'To enable microphone access:\n1. Open Settings app\n2. Scroll to Safari\n3. Enable Microphone access'
            ),
            canRetry: true
          };
        } else if (isAndroid()) {
          return {
            title: tString('errors.mic.denied.title', 'Microphone Access Denied'),
            message: tString(
              'errors.mic.denied.android',
              'To enable microphone access:\n1. Tap the 🔒 icon in the address bar\n2. Go to Site Settings\n3. Enable Microphone'
            ),
            canRetry: true
          };
        } else {
          return {
            title: tString('errors.mic.denied.title', 'Microphone Access Denied'),
            message: tString(
              'errors.mic.denied.desktop',
              'Please allow microphone access in your browser settings and try again.'
            ),
            canRetry: true
          };
        }

      case 'not-found':
        return {
          title: tString('errors.mic.notFound.title', 'No Microphone Detected'),
          message: tString(
            'errors.mic.notFound.message',
            'No microphone was found on your device. Please connect a microphone and try again.'
          ),
          canRetry: true
        };

      case 'not-readable':
        return {
          title: tString('errors.mic.notReadable.title', 'Microphone In Use'),
          message: tString(
            'errors.mic.notReadable.message',
            'Your microphone is currently being used by another application. Please close other apps and try again.'
          ),
          canRetry: true
        };

      case 'security':
        return {
          title: tString('errors.mic.security.title', 'Security Error'),
          message: tString(
            'errors.mic.security.message',
            'Microphone access requires a secure connection (HTTPS). Please ensure you are using HTTPS.'
          ),
          canRetry: false
        };

      default:
        return {
          title: tString('errors.mic.generic.title', 'Microphone Error'),
          message: tString(
            'errors.mic.generic.message',
            'Could not access your microphone. Please check your settings and try again.'
          ),
          canRetry: true
        };
    }
  };

  const { title, message, canRetry } = getErrorMessage();

  return (
    <div className="mic-error-overlay" onClick={onDismiss}>
      <div className="mic-error-toast" onClick={(e) => e.stopPropagation()}>
        <div className="mic-error-header">
          <div className="mic-error-icon">
            <Warning size={24} weight="fill" />
          </div>
          <h3 className="mic-error-title">{title}</h3>
          <button
            className="mic-error-close"
            onClick={onDismiss}
            aria-label={tString('errors.mic.dismiss', 'Dismiss')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="mic-error-content">
          <p className="mic-error-message">{message}</p>

          {errorType === 'denied' && (
            <p className="mic-error-fallback">
              {tString('errors.mic.fallback', 'You can also type your question instead.')}
            </p>
          )}
        </div>

        <div className="mic-error-actions">
          {canRetry && onRetry && (
            <button className="mic-error-button primary" onClick={onRetry}>
              {tString('errors.mic.retry', 'Try Again')}
            </button>
          )}
          <button className="mic-error-button secondary" onClick={onDismiss}>
            {tString('errors.mic.dismiss', 'Dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
};
