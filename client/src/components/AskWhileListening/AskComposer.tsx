// src/components/AskWhileListening/AskComposer.tsx
// Field, microphone, send. The keyboard behaves the way it does in the
// conversation composer, so nothing has to be learned twice.
import { FC, KeyboardEvent, useEffect, useRef } from 'react';
import { Microphone, PaperPlaneTilt, Stop } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';
import { ASK_COUNTER_FROM, ASK_QUESTION_MAX_CHARS } from '../../config/askWhileListening';
import type { VoiceQuestionError } from '../../hooks/useVoiceQuestion';

interface AskComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  showHint: boolean;
  micSupported: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  micError: VoiceQuestionError | null;
  onToggleRecording: () => void;
}

const AskComposer: FC<AskComposerProps> = ({
  draft,
  onDraftChange,
  onSend,
  showHint,
  micSupported,
  isRecording,
  isTranscribing,
  micError,
  onToggleRecording,
}) => {
  const { tString } = useTranslation();
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const remaining = ASK_QUESTION_MAX_CHARS - draft.length;
  const showCounter = draft.length >= ASK_COUNTER_FROM;
  const canSend = draft.trim().length > 0 && !isRecording && !isTranscribing;

  const voiceStatus = isRecording
    ? tString('input.tapToStop', 'Tap to Stop')
    : isTranscribing
      ? tString('askListen.transcribing', 'Writing it down')
      : null;

  return (
    <div className="ask-composer">
      <div className="ask-composer__row">
        <textarea
          ref={fieldRef}
          className="ask-composer__field"
          value={draft}
          rows={2}
          maxLength={ASK_QUESTION_MAX_CHARS}
          placeholder={tString('askListen.placeholder', 'Your question')}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRecording || isTranscribing}
        />
        {micSupported && (
          <button
            type="button"
            className={`ask-composer__mic${isRecording ? ' ask-composer__mic--recording' : ''}`}
            onClick={onToggleRecording}
            disabled={isTranscribing}
            aria-pressed={isRecording}
            aria-label={
              isRecording
                ? tString('input.tapToStop', 'Tap to Stop')
                : tString('askListen.micAria', 'Ask by voice')
            }
          >
            {isRecording ? (
              <Stop size={20} weight="fill" aria-hidden="true" />
            ) : (
              <Microphone size={20} weight="duotone" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {voiceStatus && <p className="ask-composer__status">{voiceStatus}</p>}

      {micError && (
        <p className="ask-composer__note" role="status">
          {micError === 'no-speech'
            ? tString('errors.mic.noSpeech.title', 'We did not catch that')
            : tString(
                'errors.network.sttUnavailable',
                'Voice input is not available right now. You can type your message instead.',
              )}
        </p>
      )}

      {showHint && !voiceStatus && (
        <p className="ask-composer__hint">
          {tString('askListen.hint', 'The answer stays inside what you have heard so far.')}
        </p>
      )}

      <div className="ask-composer__actions">
        {showCounter && (
          <span className="ask-composer__counter" aria-hidden="true">
            {tString('askListen.counter', '{n} left').replace('{n}', String(remaining))}
          </span>
        )}
        <button type="button" className="ask-composer__send" onClick={onSend} disabled={!canSend}>
          <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />
          <span>{tString('askListen.send', 'Ask')}</span>
        </button>
      </div>
    </div>
  );
};

export default AskComposer;
