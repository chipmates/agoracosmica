// src/components/MessagePopup.tsx
import React, { FC } from 'react';
import './MessagePopup.css';
import { useTranslation } from '../hooks/useTranslation';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { CloseButton } from './Button';

interface MessagePopupProps {
  showPopup: boolean;
  popupMessage: string;
  popupType: 'error' | 'info' | 'success' | 'warning' | string;
  closePopup: () => void;
}

const MessagePopup: FC<MessagePopupProps> = ({ showPopup, popupMessage, popupType, closePopup }) => {
  const { tString } = useTranslation();
  const trapRef = useFocusTrap({ onClose: closePopup, enabled: showPopup });

  if (!showPopup) return null;

  return (
    <div className="popup-overlay" onClick={closePopup}>
      <div
        ref={trapRef}
        className={`popup-content ${popupType}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={popupMessage}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton
          onClick={closePopup}
          size="sm"
          ariaLabel={tString('common.close', 'Close')}
          className="message-popup-close"
        />
        <p>{popupMessage}</p>
      </div>
    </div>
  );
};

export default MessagePopup;