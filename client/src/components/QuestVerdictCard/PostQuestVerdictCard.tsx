// PostQuestVerdictCard.tsx — Homepage card shown after a not-earned Quest verdict.
// Mirrors PostDialogueBloomInvite: surfaces on homepage, persists across sessions
// until the user picks an action. Three CTAs: restart Quest, deepen Wisdom, dismiss.
//
// Earned verdicts use PostDialogueBloomInvite — this component is exclusively for
// passed:false outcomes (ALMOST + NOT YET). The figure's verdict text in the chat
// already carries the personalized "what was strong / what's missing" feedback;
// this card is just the structural acknowledgment + path forward.

import React, { FC, useState, useRef } from 'react';
import useTranslation from '../../hooks/useTranslation';
import './PostQuestVerdictCard.css';

interface PostQuestVerdictCardProps {
  onTryAgain: () => void;     // restart Quest + drop into fresh chat
  onDeepenWisdom: () => void;  // navigate to Wisdom mode for the same seed
  onDismiss: () => void;       // close card without action ("Später")
}

const PostQuestVerdictCard: FC<PostQuestVerdictCardProps> = ({
  onTryAgain,
  onDeepenWisdom,
  onDismiss,
}) => {
  const { tString } = useTranslation();
  const [visible, setVisible] = useState(true);
  const touchStartY = useRef(0);

  const handleAction = (action: () => void): void => {
    setVisible(false);
    setTimeout(action, 200); // let exit animation play
  };

  const handleTouchStart = (e: React.TouchEvent): void => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent): void => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 60) handleAction(onDismiss);
  };

  if (!visible) return null;

  return (
    <div
      className="quest-verdict-card visible"
      role="status"
      aria-live="polite"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="quest-verdict-card__glow" aria-hidden="true" />

      <h3 className="quest-verdict-card__title">
        {tString(
          'questVerdict.notEarned.title',
          'Not yet, but the path remains open',
        )}
      </h3>

      <p className="quest-verdict-card__body">
        {tString(
          'questVerdict.notEarned.body',
          "The figure's reflection above shows what's there and what could grow. Spend more time in Wisdom, then return when you're ready.",
        )}
      </p>

      <div className="quest-verdict-card__actions">
        <button
          type="button"
          className="quest-verdict-card__btn quest-verdict-card__btn--primary"
          onClick={() => handleAction(onTryAgain)}
        >
          {tString('questVerdict.notEarned.tryAgain', 'Try again')}
        </button>
        <button
          type="button"
          className="quest-verdict-card__btn quest-verdict-card__btn--secondary"
          onClick={() => handleAction(onDeepenWisdom)}
        >
          {tString('questVerdict.notEarned.deepenWisdom', 'Deepen Wisdom')}
        </button>
        <button
          type="button"
          className="quest-verdict-card__btn quest-verdict-card__btn--tertiary"
          onClick={() => handleAction(onDismiss)}
        >
          {tString('questVerdict.notEarned.later', 'Later')}
        </button>
      </div>
    </div>
  );
};

export default PostQuestVerdictCard;
