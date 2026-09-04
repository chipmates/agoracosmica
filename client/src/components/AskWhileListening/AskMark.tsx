// src/components/AskWhileListening/AskMark.tsx
// The margin note. It hangs on the paragraph the question was asked from and
// opens read-only, so reaching for it never stops the chapter.
import { FC, useState } from 'react';
import { Star } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';
import type { AskExchange } from '../../hooks/useAskWhileListening';

interface AskMarkProps {
  exchanges: AskExchange[];
  figureName: string;
}

const AskMark: FC<AskMarkProps> = ({ exchanges, figureName }) => {
  const { tString } = useTranslation();
  const [open, setOpen] = useState(false);

  if (exchanges.length === 0) return null;

  const label = tString('askListen.markLabel', 'You asked here');
  const action = open
    ? tString('askListen.markHide', 'Hide')
    : tString('askListen.markShow', 'Show the answer');
  const header = tString('askListen.answerHeader', 'Echo of {name}').replace('{name}', figureName);

  return (
    <aside className="ask-mark">
      <button type="button" className="ask-mark__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Star size={14} weight="fill" aria-hidden="true" />
        <span className="ask-mark__label">{label}</span>
        <span className="ask-mark__separator" aria-hidden="true">
          ·
        </span>
        <span className="ask-mark__action">{action}</span>
      </button>

      {open && (
        <div className="ask-mark__body">
          {exchanges.map((exchange, index) => (
            <div className="ask-mark__pair" key={`${index}-${exchange.question.slice(0, 24)}`}>
              <p className="ask-mark__question">
                <span className="ask-mark__you">{tString('askListen.you', 'You:')}</span> {exchange.question}
              </p>
              {exchange.answer && (
                <>
                  <p className="ask-mark__header">{header}</p>
                  <p className="ask-mark__answer">{exchange.answer}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default AskMark;
