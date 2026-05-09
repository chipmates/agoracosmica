import { FC, useEffect } from 'react';

interface OriginalStyles {
  opacity: string;
  transition: string;
  visibility: string;
}

interface FigureControllerProps {
  active?: boolean;
  figureIndices?: number[];
}

/**
 * Controls figure visibility based on beam hits
 * Makes figures fade out when their corresponding beam hits them
 */
const FigureController: FC<FigureControllerProps> = ({ 
  active = false, 
  figureIndices = [] 
}) => {
  useEffect(() => {
    if (!active || figureIndices.length === 0) return;
    
    // Try multiple selectors to find the figures
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
    
    // Final check for figures
    if (!figures || figures.length === 0) {
      return;
    }
    
    // Store original styles to restore later if needed
    const originalStyles = new Map<HTMLElement, OriginalStyles>();
    
    // Track timers for cleanup
    const timerIds: ReturnType<typeof setTimeout>[] = [];

    // For each beam index, fade out the corresponding figure
    figureIndices.forEach((index, i) => {
      // Safely get figure by index (with wrapping for safety)
      const figureIndex = index < figures.length ? index : index % figures.length;
      const figure = figures[figureIndex];
      
      if (figure) {
        // Store original opacity and transition
        originalStyles.set(figure, {
          opacity: figure.style.opacity || '1',
          transition: figure.style.transition || '',
          visibility: figure.style.visibility || 'visible'
        });
        
        // Delay the fade based on the beam index - More pronounced sequential effect
        timerIds.push(setTimeout(() => {
          try {
            // Make all figures fade with same duration for consistency
            // But use a more noticeable sequential timing
            const transitionTime = 0.6; // Consistent 0.6s transition
            
            // First just set the transition property
            figure.style.setProperty('transition', `opacity ${transitionTime}s ease-out, visibility ${transitionTime}s ease-out`, 'important');
            
            // Wait a tiny bit to ensure transition is applied
            setTimeout(() => {
              // Then trigger the actual fade
              figure.style.setProperty('opacity', '0', 'important');
              figure.style.setProperty('pointer-events', 'none', 'important');
              
              // After transition completes, set visibility hidden
              setTimeout(() => {
                figure.style.setProperty('visibility', 'hidden', 'important');
              }, transitionTime * 1000);
            }, 50);
            
          } catch (err) {
            // Silent error handling
          }
        }, 800 + i * 750)); // More distinct timing - 750ms between each figure, starting at 800ms
      }
    });
    
    // Cleanup: clear pending timers on unmount
    return () => {
      timerIds.forEach(id => clearTimeout(id));
    };
  }, [active, figureIndices]);
  
  // This component doesn't render anything visible
  return null;
};

export default FigureController;