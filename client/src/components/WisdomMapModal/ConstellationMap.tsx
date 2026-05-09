// ConstellationMap.js - Renders the constellation map with stars and lines
import { FC, useState, useEffect, CSSProperties } from 'react';
import Star from './Star';
import './css/ConstellationMap.css';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';
import type { Seed } from '../../types/global';

interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Constellation {
  name?: string;
  pattern?: number[][];
  symbolism?: { [key: number]: string };
}

interface BoundingBox {
  xMin: number;
  yMin: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface SeedPosition {
  coordX: number;
  coordY: number;
  pointIndex?: number;
  isMainStar?: boolean;
  constellationPoint?: any;
}

type RevelationStage = 'void' | 'awakening' | 'emergence' | 'forming' | 'complete';

interface ConstellationMapProps {
  revelationStage: RevelationStage;
  lineSegments?: LineSegment[];
  constellation?: Constellation;
  boundingBox?: BoundingBox;
  seeds?: Seed[];
  seedPositions?: SeedPosition[];
  seedLevels?: Record<string, number>;
  selectedSeedId?: string | number | null;
  onSeedClick: (seed: Seed) => void;
}

const ConstellationMap: FC<ConstellationMapProps> = ({
  revelationStage,
  lineSegments,
  constellation,
  boundingBox,
  seeds,
  seedPositions,
  seedLevels,
  selectedSeedId,
  onSeedClick
}) => {
  // Add state to track mobile status for responsive adjustments
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768);
  
  // Find the next seed with no progress (level 0) — the suggested "start here" seed
  const findNextSeed = (): Seed | null => {
    if (!seeds || seeds.length === 0) return null;

    // Find seeds with no progress at all (level 0)
    const noProgressSeeds = seeds.filter(seed => {
      const level = seedLevels?.[String(seed.id)] ?? 0;
      return level === 0;
    });
    if (noProgressSeeds.length === 0) return null;

    // Return the first by ID (numerical order)
    return noProgressSeeds.reduce((lowest, current) => {
      const lowestId = parseInt(String(lowest.id).split('-').pop() || '') || lowest.id;
      const currentId = parseInt(String(current.id).split('-').pop() || '') || current.id;
      return currentId < lowestId ? current : lowest;
    });
  };
  
  const nextSeed = findNextSeed();
  
  // Track constellation data for proper rendering
  useEffect(() => {
    // Constellation data is now properly loaded
  }, [constellation, seeds, seedPositions, lineSegments]);
  
  // Update mobile status on resize
  useEffect(() => {
    const handleResize = (): void => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // Early return with fallback for missing essential data
  if (!seeds || !seeds.length || !seedPositions || !seedPositions.length) {
    return (
      <div className="constellation-error" style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        fontSize: '1.2rem'
      } as CSSProperties}>
        <div>Loading constellation map...</div>
        <div style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
          {constellation?.name || 'Star map is being prepared'}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Progressive Constellation Revelation - Milestone-based Network */}
      {lineSegments && lineSegments.length > 0 && (
        <svg className={`constellation-container revelation-${revelationStage}`}>
          {/* Show lines based on revelation stage */}
          {revelationStage === 'awakening' && (
            /* First cosmic awakening - Faint dotted hint lines appear */
            <>
              {lineSegments.map((seg, i) => (
                <line
                  key={`awakening-line-${i}`}
                  className="constellation-hint-line awakening-stage"
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  style={{ opacity: 0.3, strokeDasharray: '6,6' }}
                />
              ))}
            </>
          )}
          
          {revelationStage === 'emergence' && (
            /* Pattern emergence - Mix of solid/dotted lines, stronger glow */
            <>
              {lineSegments.map((seg, i) => (
                <line
                  key={`emergence-line-${i}`}
                  className="constellation-line emergence-stage"
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  style={{ 
                    opacity: 0.6,
                    strokeDasharray: i % 2 === 0 ? 'none' : '4,4', // Alternating solid/dotted
                    filter: 'drop-shadow(0 0 2px rgba(212, 175, 55, 0.4))'
                  }}
                />
              ))}
            </>
          )}
          
          {revelationStage === 'forming' && (
            /* Constellation forming - Mostly solid lines, dramatic lighting */
            <>
              {lineSegments.map((seg, i) => (
                <line
                  key={`forming-line-${i}`}
                  className="constellation-line forming-stage"
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  style={{ 
                    opacity: 0.8,
                    filter: 'drop-shadow(0 0 4px rgba(212, 175, 55, 0.6))'
                  }}
                />
              ))}
            </>
          )}
          
          {revelationStage === 'complete' && (
            /* Wisdom complete - Full golden glory with celebration */
            <>
              {lineSegments.map((seg, i) => (
                <line
                  key={`complete-line-${i}`}
                  className="constellation-line complete-stage"
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  style={{ 
                    opacity: 1,
                    filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.9)) drop-shadow(0 0 12px rgba(212, 175, 55, 0.4))'
                  }}
                />
              ))}
            </>
          )}
        </svg>
      )}
      
      {/* Stars representing wisdom seeds */}
      {seeds.map((seed, i) => {
        if (!seedPositions[i]) return null;
        
        // Get symbolic meaning of this star in the constellation
        const pointIndex = seedPositions[i]?.pointIndex;
        let symbolicMeaning: string | null = null;
        
        // Handle case where symbolism might be missing in translated versions
        if (pointIndex !== undefined) {
          if (constellation?.symbolism && constellation.symbolism[pointIndex]) {
            // If we have symbolism data, use it
            symbolicMeaning = constellation.symbolism[pointIndex];
          } else {
            // Fallback for when symbolism is missing - don't show raw translation keys
            // Check if the title looks like a translation key (contains dots)
            const title = seed.title || seed.name || '';
            if (title.includes('.')) {
              // This looks like a translation key, don't use it as symbolic meaning
              symbolicMeaning = null;
            } else {
              symbolicMeaning = title || null;
            }
          }
        }
        
        // Skip the center point only for Blake's constellation
        // Check both English name directly and translation key
        const isBlakeConstellation =
          constellation?.name === "The Divine Vision" ||
          getConstellationTranslationKey(constellation?.name ?? '') === "constellations.names.theDivineVision";
            
        if (isBlakeConstellation && 
            seedPositions[i].coordX >= 49 && seedPositions[i].coordX <= 51 && 
            seedPositions[i].coordY >= 49 && seedPositions[i].coordY <= 51) {
          return null; // Don't render the center point for Blake
        }
        
        return (
          <Star
            key={seed.id}
            seed={seed as any}
            position={seedPositions[i] as any}
            mainStar={seedPositions[i]?.isMainStar ?? undefined}
            constellationPoint={seedPositions[i]?.constellationPoint ?? undefined}
            symbolicMeaning={symbolicMeaning ?? undefined}
            isNextSeed={(nextSeed && seed.id === nextSeed.id) ?? undefined}
            isSelected={selectedSeedId != null && String(seed.id) === String(selectedSeedId)}
            level={seedLevels?.[String(seed.id)] ?? 0}
            onClick={onSeedClick as any}
          />
        );
      })}
    </>
  );
};

export default ConstellationMap;