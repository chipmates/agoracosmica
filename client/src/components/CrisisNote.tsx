import type { FC } from 'react';
import { X } from '@phosphor-icons/react';

import { useTranslation } from '../hooks/useTranslation';
import { getHelplines, guessCountry } from '../utils/contentSafety';
import type { CrisisNote as CrisisNoteValue } from '../services/safety/crisisNote';

interface CrisisNoteProps {
  note: CrisisNoteValue;
  language: string;
  onDismiss: () => void;
}

/**
 * Two quiet surfaces, never a word in the figure's mouth. The footer rides
 * under the log once when the subject came up. The banner sits above the
 * composer for the session when the visitor sounded like they cannot go on.
 */
export const CrisisNote: FC<CrisisNoteProps> = ({ note, language, onDismiss }) => {
  const { tString } = useTranslation();
  const lang = language === 'de' ? 'de' : 'en';
  const lines = getHelplines(note.country ?? guessCountry());
  const local = lines.filter(h => h.countries.length > 0).slice(0, 2);
  const first = local[0];
  const second = local[1];
  const everywhere = lines.find(h => h.countries.length === 0);
  const isBanner = note.kind === 'distress';

  const lead = isBanner
    ? tString('chat.crisisBanner', 'You do not have to carry this alone.')
    : tString('chat.crisisFooter', 'This is a heavy subject. If it is close to home right now, there are people who can help.');
  const helpline = first
    ? `${first.name}: ${first.contact} (${first.description[lang]})`
    : '';
  const youthLine = second
    ? `${second.name}: ${second.contact} (${second.description[lang]})`
    : '';
  const elsewhereLink = everywhere && first !== everywhere ? everywhere : null;

  return (
    <div
      className={`crisis-note no-justify crisis-note--${isBanner ? 'banner' : 'footer'}`}
      role={isBanner ? 'status' : 'note'}
      aria-live={isBanner ? 'polite' : undefined}
    >
      <div className="crisis-note__text no-justify">
        <span className="no-justify">{lead}</span>
        {helpline && <span className="crisis-note__line no-justify">{helpline}</span>}
        {youthLine && <span className="crisis-note__line no-justify">{youthLine}</span>}
        {elsewhereLink && (
          <span className="crisis-note__line no-justify">
            {tString('chat.crisisElsewhere', 'Elsewhere:')}{' '}
            <a className="crisis-note__link" href={elsewhereLink.contact} target="_blank" rel="noopener noreferrer">
              {elsewhereLink.name}
            </a>
          </span>
        )}
      </div>
      <button
        type="button"
        className="crisis-note__dismiss"
        onClick={onDismiss}
        aria-label={tString('chat.crisisDismiss', 'Close')}
      >
        <X size={16} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
};

export default CrisisNote;
