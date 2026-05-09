// PostDialogueBloomInvite.tsx - Gentle invite card shown on HomePage after a bloom
// "A star bloomed in your sky" / "Ein Stern erblühte in deinem Himmel"
// Tap opens WisdomMapModal. Swipe down or navigate away dismisses.

import React, { useState, useRef, useEffect, FC } from 'react';
import './css/PostDialogueBloomInvite.css';

interface PostDialogueBloomInviteProps {
  count: number;         // 1 = singular, >1 = plural
  onTap: () => void;     // Opens WisdomMapModal
  onDismiss: () => void;
}

// Copy approved 2026-04-12. i18n wiring in Phase 6.
const COPY = {
  en: {
    singular: 'A star has bloomed',
    plural: 'Stars have bloomed',
  },
  de: {
    singular: 'Ein Stern ist erblüht',
    plural: 'Sterne sind erblüht',
  },
};

const PostDialogueBloomInvite: FC<PostDialogueBloomInviteProps> = ({ count, onTap, onDismiss }) => {
  const [visible, setVisible] = useState(true);
  const touchStartY = useRef(0);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 30000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // Detect language from localStorage (simple check, i18n hook in Phase 6)
  const lang = (localStorage.getItem('selectedLanguage') || 'en') as 'en' | 'de';
  const copy = COPY[lang] || COPY.en;
  const text = count === 1 ? copy.singular : copy.plural;

  const handleTap = () => {
    setVisible(false);
    setTimeout(onTap, 200); // Let exit animation play
  };

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Swipe down to dismiss (40px threshold)
    if (deltaY > 40) {
      handleDismiss();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="bloom-invite visible"
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      aria-label={text}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(); }}
    >
      <div className="bloom-invite-glow" />
      <span className="bloom-invite-text">{text}</span>
    </div>
  );
};

export default PostDialogueBloomInvite;
