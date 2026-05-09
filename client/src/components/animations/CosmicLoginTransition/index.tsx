import { FC, ReactNode, ReactElement, useState, useEffect, useRef, MouseEvent } from 'react';
import './styles.css';
import FigureController from './FigureController';

interface FigurePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  element?: HTMLElement;
}

interface CosmicLoginTransitionProps {
  isActive: boolean;
  onAnimationComplete?: () => void;
  children?: ReactNode;
}

// Extend Window interface for custom properties
declare global {
  interface Window {
    loginFlashInProgress?: boolean;
  }
}

/**
 * Cosmic Login Transition
 * 
 * Manages the full animation sequence for login:
 * 1. Form disappears (quick fade out)
 * 2. Success indicator appears (gold circular pulse)
 * 3. Portal reopens with enhanced energy
 * 4. Beams target historical figures
 * 
 * IMPORTANT: This component handles the animation sequence after successful login.
 * Each animation phase has specific timing and visual effects.
 */
const CosmicLoginTransition: FC<CosmicLoginTransitionProps> = ({ 
  isActive,
  onAnimationComplete,
  children
}) => {
  const [formVisible, setFormVisible] = useState(true);
  const [successVisible, setSuccessVisible] = useState(false);
  const [portalVisible, setPortalVisible] = useState(false);
  const [beamsActive, setBeamsActive] = useState(false);
  const [figurePositions, setFigurePositions] = useState<FigurePosition[]>([]);
  const [completedBeams, setCompletedBeams] = useState(0);
  
  const transitionRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  
  // Initialize figure positions and portal center
  useEffect(() => {
    if (!isActive) return;
    
    // Wait a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      // Get all historical figures - need to look for them in various places
      let figures = document.querySelectorAll<HTMLElement>('.historical-figure');
      
      if (!figures || figures.length === 0) {
        // Try the figures container
        const container = document.querySelector('.historical-figures-container');
        if (container) {
          figures = container.querySelectorAll<HTMLElement>('div[class^="figure-"]');
        }
      }
      
      if (figures && figures.length > 0) {
        const positions = Array.from(figures).map(figure => {
          const rect = figure.getBoundingClientRect();
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          };
        });
        
        setFigurePositions(positions);
      } else {
        // If no figures found, use fixed positions for demo purposes
        // Create evenly spaced positions across the bottom of the screen
        const demoPositions: FigurePosition[] = [];
        const screenWidth = window.innerWidth;
        const bottomY = window.innerHeight * 0.8; // 80% down the screen
        
        // Create 8 positions
        for (let i = 0; i < 8; i++) {
          demoPositions.push({
            x: (screenWidth / 10) * (i + 1),
            y: bottomY,
            width: 80,
            height: 150
          });
        }
        
        setFigurePositions(demoPositions);
      }
    }, 500); // Small delay to ensure rendering
    
  }, [isActive, portalVisible]);
  
  // Manage animation phases
  useEffect(() => {
    if (!isActive) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // PHASE 0: Initial state

    // PHASE 1: Hide form
    setFormVisible(false);

    // Completely remove form after exit animation - faster now
    timers.push(setTimeout(() => {
      const formContainer = document.querySelector('.form-container.form-exit');
      if (formContainer && formContainer.parentNode) {
        formContainer.parentNode.removeChild(formContainer);
      }
    }, 300));

    // PHASE 2: Show success indicator (run sooner)
    timers.push(setTimeout(() => {
      setSuccessVisible(true);
    }, 400));

    // PHASE 3: Re-use existing portal (simplified approach)
    timers.push(setTimeout(() => {
      setSuccessVisible(false);

      const existingPortal = document.querySelector('.portal');
      if (existingPortal) {
        existingPortal.classList.add('portal-energy-boost');
      }

    }, 1200));

    // PHASE 4: Start beam effects (adjusted timing)
    timers.push(setTimeout(() => {
      setBeamsActive(true);
    }, 1800));

    // PHASE 5: Safety timeout to ensure completion
    timers.push(setTimeout(() => {
      if (completedBeams < 8) {
        setCompletedBeams(8);
      }
    }, 15000));

    return () => { timers.forEach(clearTimeout); };
  }, [isActive, completedBeams]);
  
  
  // Handle beam completion
  const handleBeamComplete = (index: number): void => {
    setCompletedBeams(prev => prev + 1);
  };
  
  // More direct approach with guaranteed timing
  useEffect(() => {
    if (!beamsActive) return;
    
    // Calculate how many figures we have
    const figurePositions = getFigurePositions();
    const figureCount = Math.max(figurePositions.length, 3); // Ensure at least 3 figures
    
    // Calculate total animation time for all figures to fade out
    // Using same timing as in FigureController:
    // - 800ms initial delay
    // - 750ms between figures
    // - 600ms for fade duration of last figure
    const totalFigureAnimationTime = 800 + (figureCount - 1) * 750 + 600;
    
    // Set a direct timer for the final animation step
    // This bypasses the beam completion logic for greater reliability
    const finalAnimationTimer = setTimeout(() => {
      // Prevent duplicate executions
      if (window.loginFlashInProgress) {
        return;
      }
      window.loginFlashInProgress = true;
      
      // Create and insert a marker element to detect if the component is unmounted
      const markerElement = document.createElement('div');
      markerElement.id = 'login-sequence-marker';
      markerElement.style.display = 'none';
      document.body.appendChild(markerElement);
      
      // First, trigger the cosmic portal unrevealing animation
      const portal = document.querySelector('.portal');
      if (portal) {
        portal.classList.add('portal-unrevealing');
      }
      
      // Force hide any remaining figures after a short delay
      setTimeout(() => {
        const allFigures = document.querySelectorAll<HTMLElement>('.historical-figure, .figure-image, .figure-container');
        if (allFigures && allFigures.length > 0) {
          allFigures.forEach(fig => {
            fig.style.setProperty('transition', 'opacity 0.2s', 'important');
            fig.style.setProperty('opacity', '0', 'important');
            fig.style.setProperty('visibility', 'hidden', 'important');
          });
        }
      }, 600);
      
      // Wait for portal animation, then redirect
      setTimeout(() => {
        // Check if marker exists - if not, animation was likely skipped
        if (!document.getElementById('login-sequence-marker')) {
          return;
        }

        // Flash effect REMOVED - user feedback indicated it was disturbing
        // Also addresses accessibility concerns (photosensitivity)

        // Direct redirect without flash
        setTimeout(() => {
          try {
            // Clean up marker element
            if (markerElement && document.body.contains(markerElement)) {
              document.body.removeChild(markerElement);
            }

            // Redirect to homepage
            if (onAnimationComplete) {
              onAnimationComplete();
            } else {
              window.location.reload();
            }
          } catch (error) {
            if (onAnimationComplete) onAnimationComplete();
            else window.location.reload();
          }
        }, 200); // Reduced from 500ms since no flash animation
      }, 1800); // Wait after portal animation for cleaner effect
      
    }, totalFigureAnimationTime + 100); // Direct timing based on figure count
    
    // Safety timeout - ABSOLUTE maximum time for animation sequence
    // This ensures we never get stuck in animation limbo
    const safetyTimeout = setTimeout(() => {
      if (onAnimationComplete) onAnimationComplete();
      else window.location.reload();
    }, totalFigureAnimationTime + 5000); // Max 5 seconds after figures should be done
    
    return () => {
      clearTimeout(finalAnimationTimer);
      clearTimeout(safetyTimeout);
      // Reset flag so animation can play again if user returns to login
      window.loginFlashInProgress = false;
    };
  }, [beamsActive, onAnimationComplete]);
  
  // Get figure positions based on DOM elements
  const getFigurePositions = (): FigurePosition[] => {
    // Look for figures in different ways (try multiple selectors that might be used)
    let figures = document.querySelectorAll<HTMLElement>('.historical-figure');
    
    if (!figures || figures.length === 0) {
      figures = document.querySelectorAll<HTMLElement>('.figure-image');
    }
    
    if (!figures || figures.length === 0) {
      figures = document.querySelectorAll<HTMLElement>('.figure-container');
    }
    
    if (!figures || figures.length === 0) {
      const carousel = document.querySelector('.figure-carousel');
      if (carousel) {
        figures = carousel.querySelectorAll<HTMLElement>('img');
      }
    }
    
    if (figures && figures.length > 0) {
      return Array.from(figures).map(figure => {
        const rect = figure.getBoundingClientRect();
        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          element: figure // Store element reference for later animation
        };
      });
    }
    
    // Fallback to generated positions
    const positions: FigurePosition[] = [];
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Create positions around the screen perimeter (more visually interesting)
    // Bottom row
    for (let i = 0; i < 3; i++) {
      positions.push({
        x: screenWidth * (i + 1) / 4,
        y: screenHeight * 0.8,
        width: 80,
        height: 150
      });
    }
    
    // Left side
    positions.push({
      x: screenWidth * 0.1,
      y: screenHeight * 0.4,
      width: 80,
      height: 150
    });
    
    // Right side
    positions.push({
      x: screenWidth * 0.9,
      y: screenHeight * 0.4,
      width: 80,
      height: 150
    });
    
    return positions;
  };
  
  // Simplified version without beams - just control figures directly
  // Schedule beam completion tracking in an effect, not in render
  const beamTimersScheduled = useRef(false);
  useEffect(() => {
    if (!beamsActive || beamTimersScheduled.current) return;
    beamTimersScheduled.current = true;

    const figurePositions = getFigurePositions();
    const minFigureCount = Math.max(figurePositions.length, 3);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const outerTimer = setTimeout(() => {
      for (let i = 0; i < minFigureCount; i++) {
        timers.push(setTimeout(() => handleBeamComplete(i), i * 750));
      }
    }, 1000);
    timers.push(outerTimer);

    return () => timers.forEach(t => clearTimeout(t));
  }, [beamsActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderFigureEffects = (): ReactElement => {
    const figurePositions = getFigurePositions();
    const figureIndices = figurePositions.map((_, i) => i);

    return (
      <>
        {/* Control figure visibility - this is what matters most */}
        <FigureController 
          active={beamsActive}
          figureIndices={figureIndices}
        />
      </>
    );
  };

  // Handle click to skip animation
  const handleSkipAnimation = (e: MouseEvent<HTMLDivElement>): void => {
    if (onAnimationComplete) {
      // Clean up any overlay elements before redirecting
      const cleanupOverlays = (): void => {
        // Remove any overlays with ID
        const skipOverlay = document.getElementById('skip-animation-overlay');
        if (skipOverlay && document.body.contains(skipOverlay)) {
          document.body.removeChild(skipOverlay);
        }
        
        // Remove other potential overlay elements
        document.querySelectorAll<HTMLElement>('[style*="z-index: 2000"], [style*="z-index: 9999"]').forEach(el => {
          if (el.parentNode === document.body && 
              el.style.position === 'fixed' && 
              el.style.width === '100%') {
            document.body.removeChild(el);
          }
        });
      };
      
      // Clean up before calling onAnimationComplete
      cleanupOverlays();
      
      // Call completion callback
      onAnimationComplete();
    }
  };

  return (
    <div 
      className="cosmic-login-transition" 
      ref={transitionRef}
      onClick={handleSkipAnimation}
    >
      {/* The login form - completely remove after animation */}
      {formVisible ? (
        <div className="form-container">
          {children}
        </div>
      ) : (
        <div className="form-container form-exit" />
      )}
      
      {/* Success indicator */}
      {successVisible && (
        <div className="success-animation">
          <div className="success-pulse"></div>
        </div>
      )}
      
      {/* Figure effects (simplified without visible beams) */}
      {beamsActive && renderFigureEffects()}
    </div>
  );
};

export default CosmicLoginTransition;