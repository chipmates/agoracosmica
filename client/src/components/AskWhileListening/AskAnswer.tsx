// src/components/AskWhileListening/AskAnswer.tsx
// The detour, written out: what was asked, what the Echo said, and the way
// back into the chapter. One call to action, and it is Keep listening.
import { FC } from 'react';
import { ArrowRight, ArrowsClockwise, SpeakerSlash } from '@phosphor-icons/react';
import Button from '../Button/Button';
import { useTranslation } from '../../hooks/useTranslation';
import type { AskExchange, AskNotice, AskState } from '../../hooks/useAskWhileListening';

interface AskAnswerProps {
  state: AskState;
  figureName: string;
  exchanges: AskExchange[];
  speaking: boolean;
  notice: AskNotice | null;
  onStopVoice: () => void;
  onResume: () => void;
  onAskAnother: () => void;
  onRetry: () => void;
  /** Only rendered when the surface can carry the exchange into Free Talk. */
  onCarry?: () => void;
}

function noticeKey(notice: AskNotice): { key: string; fallback: string } {
  switch (notice) {
    case 'error':
      return {
        key: 'askListen.errorText',
        fallback: 'That did not come through. Your question is still here.',
      };
    case 'voiceUnavailable':
      return { key: 'askListen.voiceUnavailable', fallback: 'No voice right now. The answer is here to read.' };
    case 'offline':
      return { key: 'askListen.offline', fallback: 'No connection. The chapter still plays.' };
    case 'quotaSpent':
      return {
        key: 'askListen.quotaSpent',
        fallback: "Today's free questions are used up. The chapter keeps playing.",
      };
    case 'capacity':
    default:
      return {
        key: 'askListen.capacity',
        fallback: 'The free tier is full for a moment. Keep listening and try again later.',
      };
  }
}

const AskAnswer: FC<AskAnswerProps> = ({
  state,
  figureName,
  exchanges,
  speaking,
  notice,
  onStopVoice,
  onResume,
  onAskAnother,
  onRetry,
  onCarry,
}) => {
  const { tString } = useTranslation();
  const answered = state === 'answered';
  const thinking = state === 'pending';
  const header = tString('askListen.answerHeader', 'Echo of {name}').replace('{name}', figureName);
  const notes = notice ? noticeKey(notice) : null;

  return (
    <div className="ask-answer">
      <div className="ask-answer__pairs">
      {exchanges.map((exchange, index) => (
        <div className="ask-answer__pair" key={`${index}-${exchange.question.slice(0, 24)}`}>
          <p className="ask-answer__question">
            <span className="ask-answer__you">{tString('askListen.you', 'You:')}</span> {exchange.question}
          </p>
          {exchange.answer && (
            <div className="ask-answer__body">
              <p className="ask-answer__header">
                <span className="ask-answer__figure">{header}</span>
                {index === exchanges.length - 1 && speaking && (
                  <span className="ask-answer__pulse" aria-hidden="true" />
                )}
              </p>
              <p className="ask-answer__chip">{tString('aiDisclosure.voiceShort', 'AI voice')}</p>
              <p className="ask-answer__text">{exchange.answer}</p>
            </div>
          )}
        </div>
      ))}

      {thinking && (
        <p className="ask-answer__thinking" role="status">
          {tString('askListen.thinking', '{name} is thinking.').replace('{name}', figureName)}
        </p>
      )}

      {notes && (
        <p className="ask-answer__notice" role="status">
          {tString(notes.key, notes.fallback)}
        </p>
      )}
      </div>

      <div className="ask-answer__actions">
        {speaking && (
          <button type="button" className="ask-answer__stop" onClick={onStopVoice}>
            <SpeakerSlash size={18} weight="bold" aria-hidden="true" />
            <span>{tString('chat.stopVoice', 'Stop voice')}</span>
          </button>
        )}

        {state === 'failed' && (
          <button type="button" className="ask-answer__retry" onClick={onRetry}>
            <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
            <span>{tString('askListen.retry', 'Try again')}</span>
          </button>
        )}

        <Button variant="gold" size="medium" fullWidth onClick={onResume} className="ask-answer__resume">
          {tString('askListen.resume', 'Keep listening')}
        </Button>

        {answered && onCarry && (
          <button type="button" className="ask-answer__carry" onClick={onCarry}>
            <span>{tString('askListen.carry', 'Talk it through')}</span>
            <ArrowRight size={14} weight="bold" aria-hidden="true" />
          </button>
        )}

        {answered && (
          <button type="button" className="ask-answer__another" onClick={onAskAnother}>
            {tString('askListen.askAnother', 'Ask something else')}
          </button>
        )}
      </div>
    </div>
  );
};

export default AskAnswer;
