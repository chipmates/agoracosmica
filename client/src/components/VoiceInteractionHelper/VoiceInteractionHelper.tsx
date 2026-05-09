// src/components/VoiceInteractionHelper/VoiceInteractionHelper.tsx
import { FC, useState, useEffect, ChangeEvent } from 'react';
import { Microphone, Keyboard } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import { useUIStore } from '../../stores/uiStore';
import '../HelperPopup/HelperPopup.css';
import './VoiceInteractionHelper.css';

interface VoiceInteractionHelperProps {
  isVisible?: boolean;
  onDismiss?: () => void;
  isMobile?: boolean;
  messageCount?: number;
}

/**
 * Contextual voice interaction helper that appears after the first message
 * Teaches users how to interact with the figure using voice or text
 * Uses unified helper design consistent with other helpers
 */
const VoiceInteractionHelper: FC<VoiceInteractionHelperProps> = ({ 
  isVisible = false, 
  onDismiss,
  isMobile = false,
  messageCount = 0 
}) => {
  const { t, tString, tNode } = useTranslation();
  const [shouldShow, setShouldShow] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Help preferences from Zustand
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const dismissHelp = useUIStore((state) => state.dismissHelp);

  useEffect(() => {
    // Only show if:
    // 1. Component is visible (parent says it's ok)
    // 2. User hasn't dismissed it before
    // 3. We have at least one message from the figure
    const shouldDisplay =
      isVisible &&
      messageCount > 0 &&
      shouldShowHelp('voiceInteractionHelp');
    
    if (shouldDisplay) {
      // Small delay to ensure smooth appearance after first message
      const timer = setTimeout(() => {
        setShouldShow(true);
      }, 2000); // 2 second delay after first message
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, messageCount]);
  
  // Auto-dismiss after first successful voice input
  useEffect(() => {
    const handleVoiceSuccess = (): void => {
      // Auto-dismiss without saving preference
      setIsAnimatingOut(true);
      setTimeout(() => {
        setShouldShow(false);
        setIsAnimatingOut(false);
        if (onDismiss) onDismiss();
      }, 300);
    };
    
    // Listen for successful voice input event
    window.addEventListener('voiceInputSuccess', handleVoiceSuccess);
    
    return () => {
      window.removeEventListener('voiceInputSuccess', handleVoiceSuccess);
    };
  }, [onDismiss]);
  
  const handleDismiss = (): void => {
    setIsAnimatingOut(true);

    // If checkbox is checked, save preference
    if (dontShowAgain) {
      dismissHelp('voiceInteractionHelp');
    }
    
    // Animate out then call parent's onDismiss
    setTimeout(() => {
      setShouldShow(false);
      setIsAnimatingOut(false);
      if (onDismiss) onDismiss();
    }, 300);
  };
  
  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDontShowAgain(e.target.checked);
  };
  
  if (!shouldShow) return null;
  
  return (
    <div className={`helper-popup-container voice-interaction-helper ${isAnimatingOut ? 'animating-out' : ''}`}>
      <div className="helper-popup">
        {/* Header with title */}
        <div className="helper-header">
          <h3 className="helper-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Microphone size={20} style={{ color: 'var(--gold-subtle)' }} />
            {tNode('helpers.voiceInteraction.title')}
          </h3>
        </div>
        
        {/* Content */}
        <div className="helper-content">
          {isMobile ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))',
                borderRadius: '8px',
                padding: '0.5rem',
                marginBottom: '0.5rem',
                border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)'
              }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.4 }}>
                  <strong>{tNode('helpers.voiceInteraction.mobile.tap')}</strong> {tNode('helpers.voiceInteraction.mobile.start')}
                  <br />
                  <strong>{tNode('helpers.voiceInteraction.mobile.tap')}</strong> {tNode('helpers.voiceInteraction.mobile.stop')}
                </p>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: '0.85rem', 
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <Keyboard size={14} style={{ opacity: 0.7 }} />
                {tNode('helpers.voiceInteraction.alternative')}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)'
              }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--white) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--white) 25%, transparent)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    marginRight: '0.5rem'
                  }}>SPACE</span>
                  {tNode('helpers.voiceInteraction.desktop.pressOnce')}
                  <br />
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--white) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--white) 25%, transparent)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    marginRight: '0.5rem'
                  }}>SPACE</span>
                  {tNode('helpers.voiceInteraction.desktop.pressAgain')}
                </p>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: '0.85rem', 
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <Keyboard size={14} style={{ opacity: 0.7 }} />
                {tNode('helpers.voiceInteraction.alternative')}
              </p>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="helper-actions">
          <label className="helper-checkbox">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
              aria-label={tString('helpers.common.dontShowAgain', 'Don\'t show this again')}
            />
            <span>{tNode('helpers.common.dontShowAgain')}</span>
          </label>
          
          <button
            className="helper-dismiss-btn"
            onClick={handleDismiss}
          >
            {tNode('helpers.common.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInteractionHelper;