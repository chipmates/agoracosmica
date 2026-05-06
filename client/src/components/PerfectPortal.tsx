import React, { useRef, useState, useEffect, forwardRef, ReactNode, ForwardedRef } from 'react';
import { sanitizeContent } from '../utils/sanitizeContent';
import './PerfectPortal.css';

interface ZodiacSymbol {
  id: string;
  x: number;
  y: number;
  angle: number;
  symbolSvg: string;
}

interface PerfectPortalProps {
  isRevealed: boolean;
  isUnrevealing?: boolean;
  onPortalClick?: () => void;
  children?: ReactNode;
  className?: string;
}

/**
 * Zodiac symbol SVG data for portal decoration
 * Pre-sanitized for performance (avoids sanitization on every render)
 */
const RawZodiacSymbols = [
  // Aries ♈ — Ram's horns curving upward from a central stem
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M50,74 L50,48 M50,48 C42,28 25,26 25,44 M50,48 C58,28 75,26 75,44" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Taurus ♉ — Circle with bull's horns arc above
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="50" cy="60" r="14" stroke="currentColor" fill="none" stroke-width="3"/>
    <path d="M28,44 C28,18 72,18 72,44" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Gemini ♊ — Twin pillars with connecting bars
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M34,26 L66,26 M34,74 L66,74 M42,26 L42,74 M58,26 L58,74" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Cancer ♋ — Two interlocking arcs with filled dots
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M65,42 C65,26 35,26 35,42" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M35,58 C35,74 65,74 65,58" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
    <circle cx="65" cy="42" r="5" fill="currentColor" stroke="none"/>
    <circle cx="35" cy="58" r="5" fill="currentColor" stroke="none"/>
  </svg>`,

  // Leo ♌ — Circle with sweeping tail curve
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="36" cy="38" r="12" stroke="currentColor" fill="none" stroke-width="3"/>
    <path d="M48,38 C68,38 68,60 50,60 C38,60 36,74 54,74" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Virgo ♍ — Cursive m-shape with looping tail
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M26,68 L26,36 C26,22 40,22 40,36 L40,68 M40,36 C40,22 54,22 54,36 L54,68 M54,52 C62,70 74,62 66,48" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Libra ♎ — Scales: two horizontals with arch on top
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M26,68 L74,68 M26,54 L74,54 M40,54 C40,34 60,34 60,54" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Scorpio ♏ — Cursive m-shape with arrow stinger
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M24,68 L24,36 C24,22 38,22 38,36 L38,68 M38,36 C38,22 52,22 52,36 L52,68 L66,54" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M62,50 L66,54 L62,58" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Sagittarius ♐ — Arrow with crossbar
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M28,72 L72,28 M56,28 L72,28 L72,44 M40,46 L56,62" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Capricorn ♑ — V-shape transitioning into a looping tail
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M26,28 L26,60 C26,76 46,76 46,54 L46,28" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
    <path d="M46,48 C54,58 66,62 66,70 C66,80 54,80 54,70" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  // Aquarius ♒ — Two parallel zigzag waves
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M22,38 L32,28 L42,38 L52,28 L62,38 L72,28 L78,34" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22,58 L32,48 L42,58 L52,48 L62,58 L72,48 L78,54" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Pisces ♓ — Two crescents connected by horizontal bar
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M34,50 L66,50 M42,26 C22,26 22,74 42,74 M58,26 C78,26 78,74 58,74" stroke="currentColor" fill="none" stroke-width="3" stroke-linecap="round"/>
  </svg>`
];

/**
 * Pre-sanitized zodiac symbols for performance
 * Generated once to avoid repeated sanitization on every render
 */
const ZodiacSymbols = RawZodiacSymbols.map(svg => 
  sanitizeContent(svg, 'SVG_SYMBOL')
);

/**
 * PerfectPortal Component
 * 
 * A cosmic portal component with zodiac symbols, particle effects,
 * and an animated reveal of its content (usually a login form).
 * 
 * @param {Object} props Component properties
 * @param {boolean} props.isRevealed Whether the portal is in its revealed state
 * @param {Function} props.onPortalClick Function to call when portal is clicked
 * @param {React.ReactNode} props.children Content to show inside the portal when revealed
 * @param {string} [props.className] Additional CSS class name
 * @returns {JSX.Element} Animated cosmic portal with content
 */
const PerfectPortal = forwardRef<HTMLDivElement, PerfectPortalProps>(({ 
  isRevealed, 
  isUnrevealing = false, 
  onPortalClick, 
  children, 
  className = '' 
}, ref: ForwardedRef<HTMLDivElement>) => {
  // Use provided ref or create a local one
  const internalPortalRef = useRef<HTMLDivElement>(null);
  const portalRef = ref || internalPortalRef;
  
  const zodiacRingRef = useRef<HTMLDivElement>(null);
  const particleContainerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const soundRef = useRef<HTMLAudioElement>(null);
  
  const [ringRotation, setRingRotation] = useState(0);
  const [zodiacSymbols, setZodiacSymbols] = useState<ZodiacSymbol[]>([]);
  
  // Generate zodiac symbols around the ring
  useEffect(() => {
    const symbols: ZodiacSymbol[] = [];
    const symbolCount = 12; // One for each zodiac sign
    
    for (let i = 0; i < symbolCount; i++) {
      // Position on the ring
      const angle = (i * 360) / symbolCount;
      const radian = (angle * Math.PI) / 180;
      const x = 50 + Math.cos(radian) * 48;
      const y = 50 + Math.sin(radian) * 48;
      
      // Get the symbol for this position
      const symbolIndex = i % ZodiacSymbols.length;
      const symbolSvg = ZodiacSymbols[symbolIndex];
      
      symbols.push({
        id: `zodiac-${i}`,
        x,
        y,
        angle,
        symbolSvg
      });
    }
    
    setZodiacSymbols(symbols);
  }, []);
  
  // Create particles flowing toward the center
  useEffect(() => {
    if (!particleContainerRef.current) return;
    
    const container = particleContainerRef.current;
    const particleCount = 50;
    const particles: HTMLDivElement[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random starting positions around the circle
      const angle = Math.random() * Math.PI * 2;
      const distance = 70 + Math.random() * 50; // Between 70-120px from center
      
      const x = Math.cos(angle) * distance + container.clientWidth / 2;
      const y = Math.sin(angle) * distance + container.clientHeight / 2;
      
      // Configure the particle
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      
      // Random size and animation
      const size = 1 + Math.random() * 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Set animation properties
      const speed = 0.5 + Math.random() * 1.5;
      const delay = Math.random() * 5;
      
      particle.style.animation = `particle-move ${speed}s infinite ${delay}s`;
      
      // Add to container and array
      container.appendChild(particle);
      particles.push(particle);
      
      // Create keyframes for this specific particle
      const keyframes = `
        @keyframes particle-move {
          0% {
            transform: translate(0, 0);
            opacity: 0;
          }
          20% {
            opacity: ${0.3 + Math.random() * 0.7};
          }
          100% {
            transform: translate(${(container.clientWidth / 2 - x) * 0.7}px, ${(container.clientHeight / 2 - y) * 0.7}px);
            opacity: 0;
          }
        }
      `;
      
      // Add keyframes to document
      const styleElement = document.createElement('style');
      styleElement.innerHTML = keyframes;
      document.head.appendChild(styleElement);
    }
    
    return () => {
      // Clean up particles and styles
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
      
      // Clean up any added style elements
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.innerHTML.includes('particle-move')) {
          document.head.removeChild(style);
        }
      });
    };
  }, []);
  
  // Track zodiac ring rotation
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setRingRotation(prev => (prev + 0.05) % 360);
    }, 1000 / 60); // 60 fps
    
    return () => clearInterval(rotationInterval);
  }, []);
  
  // Update CSS variable for ring rotation when revealed
  useEffect(() => {
    if (!zodiacRingRef.current) return;
    
    zodiacRingRef.current.style.setProperty('--current-rotation', `${ringRotation}deg`);
  }, [ringRotation, isRevealed]);
  
  // Play sound effect when portal is revealed
  useEffect(() => {
    if (isRevealed && soundRef.current && soundRef.current.src) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => { /* Audio autoplay blocked by browser - expected */ });
    }
  }, [isRevealed]);
  
  // Handle portal click
  const handleClick = () => {
    if (typeof onPortalClick === 'function') {
      onPortalClick();
    }
  };
  
  return (
    <div className={`portal-container ${className}`}>
      <div 
        className={`portal ${isRevealed ? 'portal-revealed' : ''} ${isUnrevealing ? 'portal-unrevealing' : ''}`} 
        ref={portalRef}
        onClick={!isUnrevealing && typeof onPortalClick === 'function' ? handleClick : undefined}
        style={isUnrevealing ? { cursor: 'pointer' } : {}}
      >
        {/* SVG Filters */}
        <svg className="svg-filters">
          <filter id="turbulence">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="turbulence" />
            <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        
        {/* Outer fine circle */}
        <div className="portal-rim"></div>
        
        {/* Zodiac ring with symbols */}
        <div 
          className="zodiac-ring" 
          ref={zodiacRingRef}
          style={{ transform: `rotate(${ringRotation}deg)` }}
        >
          {zodiacSymbols.map(symbol => (
            <div 
              key={symbol.id}
              className="zodiac-symbol"
              style={{
                left: `${symbol.x}%`,
                top: `${symbol.y}%`,
              }}
              dangerouslySetInnerHTML={{ __html: symbol.symbolSvg }}
            />
          ))}
        </div>
        
        {/* Rift distortion */}
        <div className="rift-distortion"></div>
        
        {/* Vortex center - the golden circling animation */}
        <div className="vortex-center" style={{ '--rotation': '0deg' } as React.CSSProperties}></div>
        
        {/* Vortex core */}
        <div className="vortex-core" style={{ '--rotation': '0deg' } as React.CSSProperties}></div>
        
        {/* Particle system for flowing toward center */}
        <div className="particle-container" ref={particleContainerRef}></div>
        
        {/* Flash effect for reveal */}
        <div className="reveal-flash" ref={flashRef}></div>
        
        {/* Login form */}
        <div className="login-form">
          {children}
        </div>
        
        {/* Sound effect (hidden) */}
        <audio ref={soundRef} className="sound-effect">
          {/* <source src={portalOpenSound} type="audio/mpeg" /> */}
        </audio>
      </div>
    </div>
  );
});

PerfectPortal.displayName = 'PerfectPortal';

export default PerfectPortal;