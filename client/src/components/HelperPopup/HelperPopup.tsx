import { FC, ReactNode, useState, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import useResponsive from '../../hooks/useResponsive';
import { useTranslation } from '../../hooks/useTranslation';
import './HelperPopup.css';

interface HelperPopupProps {
  isOpen: boolean;
  onDismiss: () => void;
  title?: ReactNode;
  content: ReactNode;
  buttonText?: string;
  showDontAskAgain?: boolean;
  onDontAskAgain?: () => void;
  className?: string;
}

/**
 * Global Helper Popup Component - Simplified version
 * A reusable, consistent helper popup for all onboarding and educational content
 * 
 * @param props
 * @param props.isOpen - Whether the popup is visible
 * @param props.onDismiss - Callback when popup is dismissed
 * @param props.title - Main title of the helper
 * @param props.content - Main content (can be text or JSX)
 * @param props.buttonText - Custom dismiss button text (default: "Got it!")
 * @param props.showDontAskAgain - Show "don't show again" checkbox (default: true)
 * @param props.onDontAskAgain - Callback when "don't show again" is checked
 * @param props.className - Additional CSS classes
 */
const HelperPopup: FC<HelperPopupProps> = ({
  isOpen,
  onDismiss,
  title,
  content,
  buttonText = 'Got it!',
  showDontAskAgain = true,
  onDontAskAgain,
  className = ''
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { isMobile } = useResponsive();
  const { tString } = useTranslation();
  const dontShowLabel = tString('common.dontShowAgain', "Don't show this again");

  const handleDismiss = (): void => {
    if (dontShowAgain && onDontAskAgain) {
      onDontAskAgain();
    }
    onDismiss();
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDontShowAgain(e.target.checked);
  };

  if (!isOpen) return null;

  // Use React Portal to render outside of any modal stacking context
  // This ensures the helper popup always appears above all other elements
  return createPortal(
    <div className={`helper-popup-container ${isMobile ? 'fullscreen-mobile' : ''}`}>
      <div 
        className={`helper-popup ${isMobile ? 'fullscreen-mobile' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="helper-title"
        aria-describedby="helper-content"
      >
        {/* Header */}
        {title && (
          <div className="helper-header">
            <h3 id="helper-title" className="helper-title">
              {title}
            </h3>
          </div>
        )}

        {/* Content */}
        <div id="helper-content" className="helper-content">
          {content}
        </div>

        {/* Actions */}
        <div className="helper-actions">
          {showDontAskAgain && (
            <label className="helper-checkbox">
              <input 
                type="checkbox"
                checked={dontShowAgain}
                onChange={handleCheckboxChange}
                aria-label={dontShowLabel}
              />
              <span>{dontShowLabel}</span>
            </label>
          )}

          <button 
            onClick={handleDismiss}
            className="helper-dismiss-btn"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body // Render at the document body level, outside of any modal
  );
};

export default HelperPopup;