// src/components/AskWhileListening/AskSheet.tsx
// The sheet sits in the flow at the bottom of the transcript and grows upward
// from a fixed bottom edge, so the reading shrinks instead of being covered.
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';
import { useVoiceQuestion } from '../../hooks/useVoiceQuestion';
import {
  TURNSTILE_INTERACTIVE_END_EVENT,
  TURNSTILE_INTERACTIVE_START_EVENT,
  isTurnstileInteractive,
} from '../../services/proxy/turnstile';
import AskComposer from './AskComposer';
import AskAnswer from './AskAnswer';
import type { AskExchange, AskNotice, AskState } from '../../hooks/useAskWhileListening';

interface AskSheetProps {
  state: AskState;
  figureName: string;
  language: string;
  draft: string;
  exchanges: AskExchange[];
  speaking: boolean;
  notice: AskNotice | null;
  showHint: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onRecordingChange: (recording: boolean) => void;
  onStopVoice: () => void;
  onResume: () => void;
  onAskAnother: () => void;
  onRetry: () => void;
  onCarry?: () => void;
}

const COMPOSING_STATES: AskState[] = ['composing', 'recording'];

const AskSheet: FC<AskSheetProps> = ({
  state,
  figureName,
  language,
  draft,
  exchanges,
  speaking,
  notice,
  showHint,
  onDraftChange,
  onSend,
  onClose,
  onRecordingChange,
  onStopVoice,
  onResume,
  onAskAnother,
  onRetry,
  onCarry,
}) => {
  const { tString } = useTranslation();
  const [turnstileInteractive, setTurnstileInteractive] = useState(isTurnstileInteractive);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const handleTranscript = useCallback(
    (text: string) => {
      const existing = draftRef.current.trim();
      onDraftChange(existing ? `${existing} ${text}` : text);
      onRecordingChange(false);
    },
    [onDraftChange, onRecordingChange],
  );

  const handleSettled = useCallback(() => onRecordingChange(false), [onRecordingChange]);

  const voice = useVoiceQuestion({ language, onTranscript: handleTranscript, onSettled: handleSettled });

  const toggleRecording = useCallback(() => {
    if (voice.isRecording) {
      voice.stop();
      return;
    }
    voice.clearError();
    onRecordingChange(true);
    voice.start();
  }, [voice, onRecordingChange]);

  // The recorder can end a take by itself (a browser stop, a failed request),
  // so the room follows the recorder rather than the other way round. Guarded
  // on a take that really started: the stream opens a frame after the tap.
  const takeStartedRef = useRef(false);
  useEffect(() => {
    if (voice.isRecording) {
      takeStartedRef.current = true;
      return;
    }
    if (!takeStartedRef.current || voice.isTranscribing) return;
    takeStartedRef.current = false;
    if (state === 'recording') onRecordingChange(false);
  }, [voice.isRecording, voice.isTranscribing, state, onRecordingChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The interactive bot check is fixed to the bottom of the screen, exactly
  // where Keep listening sits. Seeded from the snapshot: the escalation can
  // fire before this mounts.
  useEffect(() => {
    const onStart = () => setTurnstileInteractive(true);
    const onEnd = () => setTurnstileInteractive(false);
    window.addEventListener(TURNSTILE_INTERACTIVE_START_EVENT, onStart);
    window.addEventListener(TURNSTILE_INTERACTIVE_END_EVENT, onEnd);
    setTurnstileInteractive(isTurnstileInteractive());
    return () => {
      window.removeEventListener(TURNSTILE_INTERACTIVE_START_EVENT, onStart);
      window.removeEventListener(TURNSTILE_INTERACTIVE_END_EVENT, onEnd);
    };
  }, []);

  const composing = COMPOSING_STATES.includes(state);

  return (
    <div
      className={`ask-sheet${turnstileInteractive ? ' ask-sheet--turnstile' : ''}`}
      data-ask-state={state}
      role="group"
      aria-label={tString('askListen.eyebrow', 'Paused here')}
    >
      <div className="ask-sheet__head">
        <span className="ask-sheet__eyebrow">{tString('askListen.eyebrow', 'Paused here')}</span>
        <button
          type="button"
          className="ask-sheet__close"
          onClick={onClose}
          aria-label={tString('askListen.closeAria', 'Close')}
        >
          <X size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      {composing ? (
        <AskComposer
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          showHint={showHint}
          micSupported={voice.supported}
          isRecording={voice.isRecording}
          isTranscribing={voice.isTranscribing}
          micError={voice.error}
          onToggleRecording={toggleRecording}
        />
      ) : (
        <AskAnswer
          state={state}
          figureName={figureName}
          exchanges={exchanges}
          speaking={speaking}
          notice={notice}
          onStopVoice={onStopVoice}
          onResume={onResume}
          onAskAnother={onAskAnother}
          onRetry={onRetry}
          onCarry={onCarry}
        />
      )}

      {turnstileInteractive && (
        <p className="ask-sheet__security" role="status">
          {tString(
            'processing.securityCheck',
            'Quick security check. Tap the box at the bottom of the screen and your message continues.',
          )}
        </p>
      )}
    </div>
  );
};

export default AskSheet;
