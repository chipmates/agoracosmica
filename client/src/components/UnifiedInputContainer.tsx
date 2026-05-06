// src/components/UnifiedInputContainer.tsx
import React, { useState, useRef, useEffect, useCallback, FC, KeyboardEvent, ChangeEvent, MouseEvent } from 'react';
import { Microphone, MicrophoneSlash, Keyboard, PaperPlaneTilt, Sparkle } from '@phosphor-icons/react';
import { processAudio, processTextMessage } from '../services/audioService';
import ProcessingLoader from './ProcessingLoader';
import { ttsScheduler } from '../controllers/conversationStreamDriver';
import { getOrRollConversationSessionId, sendSessionEndBeacon } from '../services/audio/tts/ttsSessions';
import { preferTextInput, saveInputPreference, registerInputToggleShortcut } from '../utils/inputMethodDetection';
import { loadServiceConfig } from '../services/audio/config/serviceConfig';
import { useTranslation } from '../hooks/useTranslation';
import { useAutoplayGate } from '../hooks/useAutoplayGate';
import { MicrophonePermissionError, type MicrophoneErrorType } from './MicrophonePermissionError';
import { useDomainStore } from '../stores';
import { detectPII } from '../utils/piiDetection';
import './UnifiedInputContainer.css';

// Capacitor keyboard handling for native builds.
// CapacitorKeyboard stays null on web; the listeners below are no-ops.
// The native init lives in the mobile-capacitor branch.
let CapacitorKeyboard: any = null;

interface UnifiedInputContainerProps {
  selectedFigure: string;
  onSubmitMessage?: (message: string) => Promise<void> | void;
}

const UnifiedInputContainer: FC<UnifiedInputContainerProps> = ({ selectedFigure, onSubmitMessage }) => {
  const { t, tString, tNode } = useTranslation();
  const { getContext, unlock, unlocked } = useAutoplayGate();

  // Detect if we're on a mobile device for UI optimizations
  const isMobile = typeof window !== 'undefined' &&
    (window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  // State for voice recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [shouldPulse, setShouldPulse] = useState<boolean>(false);
  const [micError, setMicError] = useState<MicrophoneErrorType | null>(null);
  
  // Text input state
  const [message, setMessage] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [piiWarning, setPiiWarning] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Keyboard height state for mobile responsive behavior
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  
  // Input method state - checks settings and user preference
  const [useTextInput, setUseTextInput] = useState<boolean>(() => {
    const config = loadServiceConfig();
    if (config.sttEnabled === false) {
      return true;
    }
    return preferTextInput();
  });
  
  // Media recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[] | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const pendingRequestId = useDomainStore((state) => state.conversation.pendingRequestId);
  const processingStage = useDomainStore((state) => state.conversation.processingStage);
  const setProcessingStage = useDomainStore((state) => state.setProcessingStage);

  // Free-tier quota state for turn counter
  const quota = useDomainStore((state) => state.quota);
  const openRateLimitModal = useDomainStore((state) => state.openRateLimitModal);
  const quotaRemaining = quota.limit - quota.used;
  const quotaVisible = quota.isFreeTier && quota.loaded;
  const isQuotaExhausted = quotaVisible && quotaRemaining <= 0;
  const quotaUrgency = quotaRemaining <= 0 ? 'exhausted'
    : quotaRemaining <= 3 ? 'critical'
    : quotaRemaining <= 10 ? 'warning'
    : 'normal';

  // When chat quota is exhausted, send/record stay clickable (not disabled) and
  // route the click to the rate-limit modal instead of the normal action. This
  // gives the user a path back to BYOK without auto-popping anything during playback.
  const handleQuotaCtaClick = useCallback(() => {
    openRateLimitModal('chat', quota.resetsAt, quota.limit);
  }, [openRateLimitModal, quota.resetsAt, quota.limit]);

  useEffect(() => {
    setIsProcessing(Boolean(pendingRequestId));
  }, [pendingRequestId]);

  // Register keyboard shortcut for toggling input method
  useEffect(() => {
    const cleanup = registerInputToggleShortcut(() => {
      const config = loadServiceConfig();
      
      // If voice input is disabled in settings, don't allow toggling to voice
      if (config.sttEnabled === false) {
        return;
      }
      
      setUseTextInput(prev => {
        const newValue = !prev;
        saveInputPreference(newValue);
        return newValue;
      });
    });
    
    return cleanup;
  }, []);

  // Cleanup media stream on unmount (prevents mic staying active during mode switch)
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Listen for config changes to update input method if settings change
  useEffect(() => {
    const handleConfigChange = () => {
      const config = loadServiceConfig();
      
      if (config.sttEnabled === false && !useTextInput) {
        // If voice input is disabled in settings, force switch to text input
        setUseTextInput(true);
      } else if (config.sttEnabled === true && useTextInput && preferTextInput() === false) {
        // If voice input is re-enabled and user previously preferred voice input
        // Switch back to voice input
        setUseTextInput(false);
      }
    };
    
    window.addEventListener('configChanged', handleConfigChange);
    return () => {
      window.removeEventListener('configChanged', handleConfigChange);
    };
  }, [useTextInput]);

  // Listen for audio playback start and end
  useEffect(() => {
    const handleAudioStart = () => {
      setIsProcessing(false);
      // First audio playing = pipeline delivered. Clear the loader's stage so
      // the next request starts fresh.
      setProcessingStage(null);
    };

    window.addEventListener('audioStart', handleAudioStart);

    return () => {
      window.removeEventListener('audioStart', handleAudioStart);
    };
  }, []);
  
  // Capacitor keyboard height handling for mobile responsive behavior
  useEffect(() => {
    if (!CapacitorKeyboard || !isMobile) return;
    
    const keyboardWillShow = CapacitorKeyboard.addListener('keyboardWillShow', (info: any) => {
      setKeyboardHeight(info.keyboardHeight);
      
      // Apply CSS custom property for responsive adjustments
      document.documentElement.style.setProperty(
        '--keyboard-height', 
        `${info.keyboardHeight}px`
      );
      document.documentElement.style.setProperty(
        '--available-viewport-height', 
        `calc(100dvh - ${info.keyboardHeight}px)`
      );
    });

    const keyboardWillHide = CapacitorKeyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      
      // Reset CSS custom properties
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--available-viewport-height', '100dvh');
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [isMobile]);
  
  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current && useTextInput) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(
        Math.max(textareaRef.current.scrollHeight, 40), 
        150
      ) + 'px';
    }
  }, [message, useTextInput]);
  
  // Process text message submission
  const handleSubmitText = async (bypassPii = false): Promise<void> => {
    if (!message.trim() || isProcessing) return;

    // PII warning: show once, user can dismiss to send anyway
    if (!bypassPii) {
      const piiCheck = detectPII(message.trim());
      if (piiCheck.detected) {
        setPiiWarning(true);
        return;
      }
    }
    setPiiWarning(false);

    try {
      setIsProcessing(true);
      // Text-input path skips STT, so we start directly in 'preparing' and the
      // stream driver will advance to 'contemplating'/'shaping' as the LLM runs.
      setProcessingStage('preparing');

      if (onSubmitMessage) {
        await onSubmitMessage(message.trim());
      } else {
        await processTextMessage(message.trim(), selectedFigure);
      }

      setMessage('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      setShouldPulse(true);
      setTimeout(() => setShouldPulse(false), 600);

      const pending = useDomainStore.getState().conversation.pendingRequestId;
      if (!pending) {
        setIsProcessing(false);
        setProcessingStage(null);
      }
    } catch (err) {
      console.error('Error processing text message:', err);
      setIsProcessing(false);
      setProcessingStage(null);
    }
  };
  
  // Handle keydown in text area (Enter to submit)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmitText();
    }
  };

  // Start voice recording
  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecording || isProcessing) return;

    // ✅ CRITICAL: Unlock audio FIRST, before getUserMedia prompt
    // This must happen synchronously in the same event turn
    unlock();

    try {
      // Request microphone with echo cancellation for better quality
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // ✅ Reuse AudioContext from hook instead of creating new one
      audioContextRef.current = getContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Negotiate MIME type — prefer webm/opus, fallback to browser default (Safari uses mp4)
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : undefined;
      mediaRecorderRef.current = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current!.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setMicError(null); // Clear any previous errors

      const updateAudioLevel = (): void => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
        setAudioLevel(average);

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
      playAudioFeedback(true);

    } catch (err: any) {
      console.error('Error starting recording:', err);
      setIsRecording(false);

      // ✅ Classify error and show user-facing error UI
      let errorType: MicrophoneErrorType = 'generic';

      if (err.name === 'NotAllowedError') {
        errorType = 'denied';
      } else if (err.name === 'NotFoundError') {
        errorType = 'not-found';
      } else if (err.name === 'NotReadableError') {
        errorType = 'not-readable';
      } else if (err.name === 'SecurityError') {
        errorType = 'security';
      }

      setMicError(errorType);

      if (import.meta.env.DEV) {
        console.warn(`[Microphone Error]:`, errorType, err);
      }
    }
  }, [isRecording, isProcessing, unlock, getContext]);

  // Stop voice recording
  const stopRecording = useCallback(async (): Promise<void> => {
    if (!isRecording || !mediaRecorderRef.current) return;

    try {
      playAudioFeedback(false);
      mediaRecorderRef.current.stop();
      streamRef.current!.getTracks().forEach(track => track.stop());

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // ✅ Don't close AudioContext - it's shared and managed by useAutoplayGate hook
      // Just disconnect the analyser
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      setIsRecording(false);
      setIsProcessing(true);
      // Voice path starts in 'preparing'; processAudio will bump it to 'hearing'
      // once the Whisper request actually fires.
      setProcessingStage('preparing');

      await new Promise<void>(resolve => {
        mediaRecorderRef.current!.onstop = () => resolve();
      });

      // Use actual recorded MIME type (webm on Chrome/Firefox, mp4 on Safari)
      const recordedMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current!, { type: recordedMime });

      const shouldUseController = Boolean(onSubmitMessage);

      const result = await processAudio(audioBlob, shouldUseController ? { skipLLM: true } : {});

      if (shouldUseController) {
        const transcript = result?.transcription?.trim() ?? '';
        if (transcript) {
          await onSubmitMessage?.(transcript);

          const pending = useDomainStore.getState().conversation.pendingRequestId;
          if (!pending) {
            setIsProcessing(false);
            setProcessingStage(null);
          }

          window.dispatchEvent(new CustomEvent('voiceInputSuccess'));
        } else {
          setIsProcessing(false);
          setProcessingStage(null);
        }
      } else {
        window.dispatchEvent(new CustomEvent('voiceInputSuccess'));
        setIsProcessing(false);
        setProcessingStage(null);
      }

    } catch (err) {
      console.error('Error stopping recording:', err);
      setIsProcessing(false);
      setProcessingStage(null);
    }
  }, [isRecording, onSubmitMessage]);

  // Toggle recording state
  const toggleRecording = useCallback((): void => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Handle audio processing
  // Play audio feedback when starting/stopping recording
  const playAudioFeedback = (isStart: boolean): void => {
    try {
      // ✅ Reuse AudioContext from hook instead of creating new one
      const audioContext = getContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(isStart ? 800 : 600, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      // Gracefully handle audio feedback failure
      console.warn('[AudioFeedback] Failed to play feedback sound:', error);
    }
  };

  // Handle space key for recording
  useEffect(() => {
    const handleKeyPress = (e: globalThis.KeyboardEvent): void => {
      // Only handle space for recording when text input is not active
      if (!useTextInput && e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (isQuotaExhausted) { handleQuotaCtaClick(); return; }
        toggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [toggleRecording, useTextInput, isQuotaExhausted, handleQuotaCtaClick]);

  // No longer trigger pulse effect on input method changes

  // Toggle between text and voice input
  const toggleInputMethod = (): void => {
    const config = loadServiceConfig();
    
    // If voice input is disabled in settings, don't allow toggling to voice
    if (config.sttEnabled === false) {
      return;
    }
    
    setUseTextInput(prev => {
      const newValue = !prev;
      saveInputPreference(newValue);
      return newValue;
    });
  };

  return (
    <>
      {isProcessing && (
        <ProcessingLoader
          figureName={selectedFigure}
          stage={processingStage ?? 'preparing'}
          onSwitchToText={() => {
            // User chose to read instead of wait for voice.
            // 1. Cancel the TTS queue (~80% of remaining work for this turn).
            //    The ≤2 in-flight HTTP requests at moment-of-click (BBA-2 cap)
            //    will finish and their audio gets discarded — LT-12 adds proper
            //    AbortController threading to cut those too.
            // 2. Fire session-end beacon (LT-11) so the gateway can evict this
            //    session's Qwen cache entry and free the admission slot for a
            //    new user. Fire-and-forget; server endpoint may not exist yet
            //    (pre-Server-Claude rollout) — that's fine, TTL handles expiry.
            // 3. Hide the loader immediately. Text keeps streaming on its own path.
            ttsScheduler.cancelAll();
            sendSessionEndBeacon(getOrRollConversationSessionId());
            setIsProcessing(false);
            setProcessingStage(null);
          }}
        />
      )}

      {/* Microphone permission error modal */}
      {micError && (
        <MicrophonePermissionError
          errorType={micError}
          onDismiss={() => setMicError(null)}
          onRetry={() => {
            setMicError(null);
            startRecording();
          }}
        />
      )}

      {piiWarning && (
        <div className="pii-warning" role="alert">
          <p>{tString('pii.warning', 'Your message appears to contain personal data (email, phone, or bank details). Please do not enter personal information in the chat.')}</p>
          <div className="pii-warning-actions">
            <button className="pii-send-anyway" onClick={() => { void handleSubmitText(true); }}>
              {tString('pii.sendAnyway', 'Send anyway')}
            </button>
            <button className="pii-edit" onClick={() => setPiiWarning(false)}>
              {tString('pii.edit', 'Edit message')}
            </button>
          </div>
        </div>
      )}

      <div className={`unified-input-container ${!useTextInput ? 'voice-mode' : ''}`}>
        <div className="no-transition-wrapper">
          {useTextInput ? (
            <div className={`text-input-area ${isFocused ? 'focused' : ''}`}>
              <textarea
                ref={textareaRef}
                className="text-input"
                value={message}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isQuotaExhausted
                  ? tString('quota.limitReached', 'Daily limit reached')
                  : tString('input.placeholder', 'Type your message...')}
                rows={1}
                disabled={isProcessing || isQuotaExhausted}
              />

              {quotaVisible && (
                <span
                  className="turn-counter"
                  data-urgency={quotaUrgency}
                  aria-live="polite"
                  aria-label={isQuotaExhausted ? tString('quota.limitReached', 'Daily limit reached') : `${quotaRemaining} ${tString('quota.remaining', 'left')}`}
                >
                  {isQuotaExhausted
                    ? tString('quota.limitReached', 'Daily limit reached')
                    : <>{quotaRemaining} <Sparkle size={14} weight="fill" aria-hidden="true" /></>}
                </span>
              )}

              <div className="input-actions">
                {/* Only show mic button if voice input is enabled in settings */}
                {loadServiceConfig().sttEnabled !== false && (
                  <button
                    className="action-button toggle-input"
                    onClick={toggleInputMethod}
                    type="button"
                    aria-label={tString('input.switchToVoice', 'Switch to voice input')}
                    disabled={isProcessing}
                  >
                    <Microphone size={22} color="var(--mode-quest)" />
                  </button>
                )}
                
                <button
                  className="action-button send-button"
                  onClick={() => {
                    if (isQuotaExhausted) { handleQuotaCtaClick(); return; }
                    void handleSubmitText();
                  }}
                  type="button"
                  disabled={!isQuotaExhausted && (!message.trim() || isProcessing)}
                  data-quota-exhausted={isQuotaExhausted || undefined}
                  aria-label={isQuotaExhausted
                    ? tString('quota.limitReached', 'Daily limit reached')
                    : tString('input.sendMessage', 'Send message')}
                >
                  <PaperPlaneTilt size={22} color="var(--gold-base)" />
                </button>
              </div>
            </div>
          ) : (
            <div className="voice-input-area">
              <button
                className={`record-button ${isRecording ? 'recording' : ''}`}
                onClick={() => {
                  if (isQuotaExhausted && !isRecording) { handleQuotaCtaClick(); return; }
                  toggleRecording();
                }}
                disabled={!isQuotaExhausted && isProcessing}
                data-quota-exhausted={isQuotaExhausted || undefined}
                aria-label={isQuotaExhausted && !isRecording
                  ? tString('quota.limitReached', 'Daily limit reached')
                  : (isRecording ? tString('input.stopRecording', 'Stop recording') : tString('input.startRecording', 'Start recording'))}
                aria-pressed={isRecording}
              >
                <div className="record-button-content">
                  {isRecording ? (
                    <>
                      <span className="record-text">{isMobile ? tNode('input.tapToStop') : tNode('input.clickToStop')}</span>
                      <div className="waveform">
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className="waveform-bar"
                            style={{
                              height: '5px',
                              opacity: 0.7 + (audioLevel / 255) * 0.3 // Adjust opacity based on audio level
                            }}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {quotaVisible && (
                        <span
                          className="turn-counter voice-mode"
                          data-urgency={quotaUrgency}
                          aria-live="polite"
                          aria-label={isQuotaExhausted ? tString('quota.limitReached', 'Daily limit reached') : `${quotaRemaining} ${tString('quota.remaining', 'left')}`}
                        >
                          {isQuotaExhausted
                            ? tString('quota.limitReached', 'Daily limit reached')
                            : <>{quotaRemaining} <Sparkle size={14} weight="fill" aria-hidden="true" /></>}
                        </span>
                      )}
                      <span className="record-text">{isMobile ? tNode('input.tapToRecord') : tNode('input.clickToRecord')}</span>
                      <div className="control-area">
                        <div className="waveform inactive">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="waveform-bar" />
                          ))}
                        </div>

                        {/* Only show toggle button if voice input is enabled in settings */}
                        {loadServiceConfig().sttEnabled !== false && (
                          <div
                            className="action-button toggle-input"
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation(); // Prevent button click from triggering record button
                              toggleInputMethod();
                            }}
                            aria-label={tString('input.switchToText', 'Switch to text input')}
                            title={tString('input.switchToText', 'Switch to text input')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleInputMethod();
                              }
                            }}
                          >
                            <Keyboard size={isMobile ? 26 : 24} color="#151C47" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UnifiedInputContainer;
