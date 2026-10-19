import { useEffect, useRef, FC, ReactNode, KeyboardEvent, MouseEvent } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import './ModalContainer.css'; // Dedicated modal CSS

type AnimationType = 'fade-scale' | 'fade-slide' | 'fade-only' | 'cosmic-reveal';
type ThemeVariant = 'cosmic' | 'nebula' | undefined;
type BackgroundVariant = 'standard' | 'solid' | 'cosmic-nebula' | 'void' | 'onboarding' | 'fullscreen';
type ModalType = 'content' | 'compact' | 'immersive' | 'header-overlay';

interface ModalContainerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  overlayClassName?: string;
  contentClassName?: string;
  animationType?: AnimationType;
  alignTop?: boolean;
  themeVariant?: ThemeVariant;
  transparentBg?: boolean;
  onAnimationComplete?: (() => void) | null;
  backgroundVariant?: BackgroundVariant;
  modalType?: ModalType;
}

// Hand focus back to the opener. An opener inside a region that has since
// collapsed (a closed menu, or one a resize hid) cannot take it, so the control
// that expands that region gets it instead of the page body.
const restoreFocus = (target: Element | null): void => {
  if (!(target instanceof HTMLElement) || !target.isConnected) return;
  target.focus();
  if (document.activeElement === target) return;
  for (let region = target.parentElement; region; region = region.parentElement) {
    if (!region.id) continue;
    const toggle = Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]')).find(
      (el) => el !== target && (el.getAttribute('aria-controls') ?? '').split(/\s+/).includes(region.id)
    );
    if (!toggle) continue;
    toggle.focus();
    if (document.activeElement === toggle) return;
  }
};

/**
 * 2025 State-of-the-Art Modal Container - UltraThink Edition
 * 
 * Enhanced Modal Container with comprehensive features including:
 * - Complete accessibility support (WCAG 2.2 compliant)
 * - Multiple animation types and theme variants
 * - Focus management and keyboard navigation
 * - Performance optimizations
 * - Revolutionary viewport-aware sizing system
 * - Content-aware modal types
 * 
 * MODAL TYPES GUIDE:
 * - 'content' (default): Intelligent viewport-aware sizing for rich content
 * - 'compact': Fixed 500px width for simple forms and dialogs
 * - 'immersive': True fullscreen experience across all devices
 * - 'header-overlay': Overlays main header for maximum content space
 */
const ModalContainer: FC<ModalContainerProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  overlayClassName = '',
  contentClassName = '',
  animationType = 'fade-scale',
  alignTop = false,
  themeVariant = undefined,
  transparentBg = false,
  onAnimationComplete = null,
  backgroundVariant = 'standard',
  modalType = 'content',
  ariaLabel
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Scroll lock via ref-counted hook
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      // Save current active element to restore focus later
      previousActiveElement.current = document.activeElement;

      // Focus the modal element itself
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Set up animation complete callback if provided
      const handleAnimationEnd = () => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      };

      if (modalRef.current) {
        modalRef.current.addEventListener('animationend', handleAnimationEnd, { once: true });
      }

      return () => {
        if (modalRef.current) {
          modalRef.current.removeEventListener('animationend', handleAnimationEnd);
        }
        restoreFocus(previousActiveElement.current);
      };
    }

    return () => {
      restoreFocus(previousActiveElement.current);
    };
  }, [isOpen, onAnimationComplete]);
  
  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Close on escape
    if (e.key === 'Escape' && onClose) {
      onClose();
    }
    
    // Trap focus within modal
    if (e.key === 'Tab' && modalRef.current) {
      // Find all focusable elements
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // Shift + Tab. Focus starts on the dialog itself, which sits before its
      // first control, so the trap must catch that step too.
      if (e.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
          lastElement.focus();
          e.preventDefault();
        }
      } 
      // Tab
      else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };
  
  // Handle overlay click (close modal when clicking outside content)
  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Set animation class based on type
  let animationClass = '';
  switch(animationType) {
    case 'fade-slide':
      animationClass = 'modal-fade-slide';
      break;
    case 'fade-only':
      animationClass = 'modal-fade-only';
      break;
    case 'cosmic-reveal':
      animationClass = 'modal-cosmic-reveal';
      break;
    case 'fade-scale':
    default:
      animationClass = 'modal-fade-scale';
  }
  
  // Set theme class based on variant
  let themeClass = '';
  switch(themeVariant) {
    case 'cosmic':
      themeClass = 'cosmic-theme';
      break;
    case 'nebula':
      themeClass = 'nebula-theme';
      break;
    default:
      themeClass = '';
  }
  
  // Set background class based on variant
  let backgroundClass = '';
  switch(backgroundVariant) {
    case 'solid':
      backgroundClass = 'modal-solid-bg';
      break;
    case 'onboarding':
      backgroundClass = 'modal-onboarding-bg';
      break;
    case 'fullscreen':
      backgroundClass = 'modal-fullscreen-bg';
      break;
    case 'standard':
    default:
      backgroundClass = 'modal-subtle-bg';
  }
  
  // 2025 UltraThink: Set modal type class
  let modalTypeClass = '';
  switch(modalType) {
    case 'compact':
      modalTypeClass = 'compact-modal';
      break;
    case 'immersive':
      modalTypeClass = 'immersive-modal';
      break;
    case 'header-overlay':
      modalTypeClass = 'header-overlay-modal';
      break;
    case 'content':
    default:
      modalTypeClass = 'content-modal';
  }

  // Apply solid background to overlay when using fullscreen variant
  const overlayBackgroundClass = backgroundVariant === 'fullscreen' ? 'modal-fullscreen-bg' : '';
  
  return (
    <div 
      ref={modalRef}
      className={`enhanced-modal-overlay ${animationClass} ${alignTop ? 'align-top' : ''} ${transparentBg ? 'transparent-bg' : ''} ${themeClass} ${overlayBackgroundClass} ${overlayClassName}`}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || 'Dialog'}
    >
      <div 
        className={`enhanced-modal-content ${modalTypeClass} ${backgroundClass} ${contentClassName} ${className}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default ModalContainer;