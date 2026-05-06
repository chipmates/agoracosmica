// src/components/SummaryLoader.tsx
import React, { FC, useEffect, useMemo, useState } from 'react';
import { BookOpen, Star, Sparkle } from '@phosphor-icons/react';
import { useTranslation } from '../hooks/useTranslation';
import './SummaryLoader.css';

interface Particle {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface SummaryLoaderProps {
  figureName?: string;
}

// Helper function to extract just the last name from a figure's full name
const getLastName = (fullName?: string): string => {
  // First remove the "Echo of" prefix and similar translations
  const nameWithoutPrefix = fullName?.replace(/^Echo of |^Echo von |^Echo de /i, '') || '';
  
  // Special cases for figures with compound last names
  if (nameWithoutPrefix.includes('da Vinci')) return 'da Vinci';
  if (nameWithoutPrefix.includes('de Beauvoir')) return 'Beauvoir';
  if (nameWithoutPrefix.includes('von Bingen')) return 'Hildegard';
  if (nameWithoutPrefix.includes('von Goethe')) return 'Goethe';
  if (nameWithoutPrefix.includes('Luther King')) return 'King';
  
  // For normal cases, just get the last word
  const parts = nameWithoutPrefix.split(' ');
  return parts[parts.length - 1];
};

const SummaryLoader: FC<SummaryLoaderProps> = ({ figureName }) => {
  const { t, tNode, tString } = useTranslation();
  // Memoize quotes to avoid resetting interval on every render
  const QUOTES = useMemo(() => [
    tString('summary.distilling', 'Distilling insights'),
    tString('summary.gathering', 'Gathering wisdom'),
    tString('summary.extracting', 'Extracting essence'),
    tString('summary.crystallizing', 'Crystallizing thoughts'),
    tString('summary.weaving', 'Weaving connections'),
    tString('summary.mapping', 'Mapping understanding')
  ], [tString]);

  const [quote, setQuote] = useState(QUOTES[0]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Cycle through quotes every few seconds
  useEffect(() => {
    let quoteIndex = 0;
    const interval = setInterval(() => {
      quoteIndex = (quoteIndex + 1) % QUOTES.length;
      setQuote(QUOTES[quoteIndex]);
    }, 4000);

    return () => clearInterval(interval);
  }, [QUOTES]);
  
  // Generate cosmic particles on mount
  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.5 + 0.3
    }));
    
    setParticles(newParticles);
  }, []);

  return (
    <div className="cosmic-loader-overlay" role="status" aria-live="polite">
      <div className="cosmic-particles">
        {particles.map(particle => (
          <div 
            key={particle.id}
            className="cosmic-particle"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              opacity: particle.opacity
            }}
          />
        ))}
      </div>
      
      <div className="cosmic-nebula">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`cosmic-orb orb-${i+1}`} />
        ))}
      </div>
      
      <div className="cosmic-loader-content premium-card">
        <div className="cosmic-loader-icon-container">
          <div className="cosmic-loader-icon">
            <BookOpen size={28} className="book-icon" />
            <div className="spinning-circles">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
            </div>
          </div>
          
          <div className="cosmic-sparkles">
            <Sparkle size={16} className="sparkle sparkle-1" />
            <Star size={12} className="sparkle sparkle-2" />
            <Sparkle size={14} className="sparkle sparkle-3" />
          </div>
        </div>
        
        <div className="cosmic-loader-text">
          <h3 className="cosmic-loader-title">{tNode('summary.generatingTitle')}</h3>
          <div className="cosmic-loader-subtitle-container">
            <p className="cosmic-loader-subtitle">
              <span className="figure-name">
                {getLastName(figureName)}
              </span>
              {/* Different sentence structure for German vs English */}
              {t('processing.is') === 'ist' ?
                <span>{quote}...</span> :
                <span>{tNode('processing.is')} {quote}...</span>
              }
            </p>
            <div className="cosmic-progress-bar">
              <div className="cosmic-progress-track">
                <div className="cosmic-progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryLoader;