// src/components/CosmicCouncil/SolarSystemInterface.tsx
import { FC, useState, useCallback, DragEvent, CSSProperties } from 'react';
// Removed Framer Motion for instant UI response
import { Crown, X, Plus } from '@phosphor-icons/react';
import OptimizedFigureImage from '../OptimizedFigureImage';
import useTranslation from '../../hooks/useTranslation';
import { checkGenderLimit } from '../../utils/figureGender';
import { getShortDisplayName } from '../../data/councilCatalog';
import './SolarSystemInterface.css';

interface Figure {
  id: string;
  name: string;
  // Add other figure properties as needed
}

interface OrbitalPosition {
  id: string;
  angle: number;
  x: number;
  y: number;
  label: string;
}

interface OrbitSlotProps {
  position: OrbitalPosition;
  figure: Figure | null;
  onRemove: (figureId: string) => void;
  onDrop: (figure: Figure, positionId: string) => void;
  isHighlighted: boolean;
  isEmpty: boolean;
  readOnly?: boolean;
}

/**
 * Defensive parse of dataTransfer payload (audit Change #10). Drop targets
 * call JSON.parse on attacker-influenceable data — validate shape before
 * forwarding it to onDrop / onModeratorChange. Silently ignore malformed
 * payloads (drag from an unrelated source, malformed via DevTools, etc.).
 */
function parseFigureFromTransfer(e: DragEvent<HTMLDivElement>): Figure | null {
  const raw = e.dataTransfer.getData('application/json');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Figure).id === 'string' &&
    typeof (parsed as Figure).name === 'string'
  ) {
    return parsed as Figure;
  }
  return null;
}

interface ModeratorSunProps {
  moderator?: Figure;
  onModeratorChange?: (figure: Figure) => void;
  onModeratorRemove?: () => void;
  readOnly?: boolean;
}

interface SolarSystemInterfaceProps {
  moderator?: Figure;
  participants?: Figure[];
  onFigureAdd?: (figure: Figure) => void;
  onFigureRemove: (figureId: string) => void;
  onModeratorChange?: (figure: Figure) => void;
  maxParticipants?: number;
  readOnly?: boolean;
  isCustomCouncil?: boolean;
}

const ORBITAL_POSITIONS: OrbitalPosition[] = [
  { id: 'orbit-1', angle: 0, x: 0, y: -1, label: 'Top' },
  { id: 'orbit-2', angle: 120, x: 0.866, y: 0.5, label: 'Bottom Right' },
  { id: 'orbit-3', angle: 240, x: -0.866, y: 0.5, label: 'Bottom Left' }
];

// Generate dynamic positions based on participant count
const getDynamicOrbitalPositions = (count: number): OrbitalPosition[] => {
  const positions: OrbitalPosition[] = [];
  const angleStep = 360 / count;
  
  for (let i = 0; i < count; i++) {
    const angle = i * angleStep - 90; // Start from top
    const radians = angle * Math.PI / 180;
    positions.push({
      id: `orbit-${i + 1}`,
      angle: angle + 90, // Adjust for CSS rotation
      x: Math.cos(radians),
      y: Math.sin(radians),
      label: `Position ${i + 1}`
    });
  }
  
  return positions;
};

const OrbitSlot: FC<OrbitSlotProps> = ({
  position,
  figure,
  onRemove,
  onDrop,
  isHighlighted,
  isEmpty,
  readOnly = false
}) => {
  const { tNode } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!readOnly) {
      e.preventDefault();
    }
  }, [readOnly]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!readOnly) {
      e.preventDefault();
      const figure = parseFigureFromTransfer(e);
      if (figure && onDrop) {
        onDrop(figure, position.id);
      }
    }
  }, [onDrop, position.id, readOnly]);

  // Don't render empty slots in readOnly mode
  if (readOnly && isEmpty) {
    return null;
  }

  return (
    <div
      className={`orbit-slot ${isEmpty ? 'empty' : 'occupied'} ${isHighlighted ? 'highlighted' : ''} ${readOnly ? 'read-only' : ''}`}
      style={{
        '--orbit-x': position.x,
        '--orbit-y': position.y,
        '--orbit-angle': `${position.angle}deg`
      } as CSSProperties}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {figure ? (
        <div
          key={figure.id}
          className="orbit-figure"
        >
            <div className="orbit-figure-container">
              <OptimizedFigureImage
                figure={figure}
                type="thumbnail"
                className="orbit-figure-image"
                alt={figure.name}
                width={64}
                height={64}
              />
              <div className="orbit-figure-glow" />
            </div>
            
            {!readOnly && (
              <button
                className="orbit-figure-remove"
                onClick={() => onRemove(figure.id)}
                aria-label={`Remove ${figure.name} from council`}
              >
                <X size={14} weight="bold" />
              </button>
            )}
            
            <div className="orbit-figure-name">
              {getShortDisplayName(figure.id)}
            </div>
          </div>
        ) : (
          <div
            key="empty"
            className="orbit-empty"
          >
            <div className="orbit-empty-icon">
              <Plus size={20} weight="bold" />
            </div>
            <div className="orbit-empty-text">
              {tNode('cosmicCouncil.setup.emptySlot')}
            </div>
          </div>
        )}
      
    </div>
  );
};

const ModeratorSun: FC<ModeratorSunProps> = ({ moderator, onModeratorChange, onModeratorRemove, readOnly = false }) => {
  const { tNode } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!readOnly) {
      e.preventDefault();
    }
  }, [readOnly]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!readOnly) {
      e.preventDefault();
      const figure = parseFigureFromTransfer(e);
      if (figure && onModeratorChange) {
        onModeratorChange(figure);
      }
    }
  }, [onModeratorChange, readOnly]);

  const handleRemove = useCallback(() => {
    if (!readOnly && onModeratorRemove) {
      onModeratorRemove();
    }
  }, [onModeratorRemove, readOnly]);

  return (
    <div
      className={`moderator-sun ${moderator ? 'has-moderator' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sun Core - Minimal Golden Design */}
      <div className="sun-core">
        {moderator && (
          <>
            <OptimizedFigureImage
              figure={moderator}
              type="thumbnail"
              className="moderator-image"
              alt={moderator.name}
              width={70}
              height={70}
            />

            {/* Remove Button - Consistent with orbit slots */}
            {!readOnly && (
              <button
                className="moderator-remove"
                onClick={handleRemove}
                aria-label={`Remove ${moderator.name} as moderator`}
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </>
        )}

        <div className="moderator-crown">
          <Crown size={20} weight="fill" />
        </div>

        <div className="moderator-title">
          {tNode('cosmicCouncil.setup.moderator')}
        </div>
      </div>
    </div>
  );
};

const SolarSystemInterface: FC<SolarSystemInterfaceProps> = ({
  moderator,
  participants = [],
  onFigureAdd,
  onFigureRemove,
  onModeratorChange,
  maxParticipants = 3,
  readOnly = false,
  isCustomCouncil = false
}) => {
  const { t } = useTranslation();

  // Use dynamic positions for readOnly mode, fixed positions for editing
  const positions = readOnly && participants.length > 0 
    ? getDynamicOrbitalPositions(participants.length)
    : ORBITAL_POSITIONS;

  // Map participants to orbital positions
  const orbitalLayout = positions.map((position, index) => ({
    ...position,
    figure: participants[index] || null
  }));

  const handleFigureRemove = useCallback((figureId: string) => {
    onFigureRemove(figureId);
  }, [onFigureRemove]);

  const handleModeratorRemove = useCallback(() => {
    if (moderator) {
      onFigureRemove(moderator.id);
    }
  }, [moderator, onFigureRemove]);

  const handleDrop = useCallback((figure: Figure, orbitId: string) => {
    // Check if figure is already in participants or is the moderator
    const isAlreadyParticipant = participants.find(p => p.id === figure.id);
    const isModerator = moderator?.id === figure.id;
    
    // Only add if not already participating and not the moderator and under max limit
    if (!isAlreadyParticipant && !isModerator && participants.length < maxParticipants && onFigureAdd) {
      // For custom councils, check gender limits - INCLUDE MODERATOR IN COUNT!
      if (isCustomCouncil) {
        // Build complete figure list including moderator
        const allFigures = moderator ? [moderator, ...participants] : participants;
        const genderCheck = checkGenderLimit(allFigures, figure);
        if (!genderCheck.canAdd) {
          console.warn(genderCheck.reason);
          return;
        }
      }
      onFigureAdd(figure);
    }
  }, [participants, moderator, maxParticipants, onFigureAdd, isCustomCouncil]);

  return (
    <div className={`solar-system-container ${readOnly ? 'read-only' : ''}`}>
      {/* Solar System Orbit - Circular Layout */}
      <div className="solar-system-orbit">
        {/* Visible Orbit Circle - Like Logo */}
        <div className="orbit-circle" />
        
        {/* Solar System Grid - Container for Elements */}
        <div className="solar-system-grid">
          {/* Moderator Sun - Center */}
          <ModeratorSun
            moderator={moderator}
            onModeratorChange={onModeratorChange}
            onModeratorRemove={handleModeratorRemove}
            readOnly={readOnly}
          />

          {/* Orbital Positions */}
          {orbitalLayout.map(position => (
            <OrbitSlot
              key={position.id}
              position={position}
              figure={position.figure}
              onRemove={handleFigureRemove}
              onDrop={handleDrop}
              isEmpty={!position.figure}
              isHighlighted={false}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SolarSystemInterface;