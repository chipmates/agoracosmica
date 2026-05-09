// src/components/CosmicCouncil/CosmicCouncilHeader.tsx
import { FC, useState, useEffect } from 'react';
import { Crown } from '@phosphor-icons/react';
import OptimizedFigureImage from '../OptimizedFigureImage';
import useTranslation from '../../hooks/useTranslation';
import CloseButton from '../Button/CloseButton';
import { getShortDisplayName, getEchoShortName } from '../../data/councilCatalog';
import './CosmicCouncilHeader.css';

type CouncilType = 'debate' | 'advisory';
type PhaseId = 'foundations' | 'confrontation' | 'resolution' | 'understanding' | 'guidance' | 'integration' | 'inquiry';

interface Phase {
  id: PhaseId;
  label: string;
  step: number;
}

interface Figure {
  id: string;
  name?: string;
}

type Participant = string | Figure;
type Moderator = string | Figure;
type Speaker = string | Figure | null;

interface ParticipantAvatarProps {
  figure: Participant;
  isSpeaking: boolean;
  isActive: boolean;
}

interface CosmicCouncilHeaderProps {
  moderator?: Moderator;
  participants?: Participant[];
  currentSpeaker?: Speaker;
  currentPhase?: PhaseId;
  councilTitle?: string;
  councilType?: CouncilType;
  isActive?: boolean;
  isCompleted?: boolean;
  onEndCouncil?: () => void;
}

// Normalize speaker ID to handle both curated and custom councils
// This ensures consistent comparison between currentSpeaker and participant IDs
const normalizeSpeakerId = (speakerId: Speaker): string | null => {
  if (!speakerId) return null;
  
  // Handle string IDs - convert to lowercase
  if (typeof speakerId === 'string') {
    return speakerId.toLowerCase().trim();
  }
  
  // Handle object with id property
  if (typeof speakerId === 'object' && speakerId?.id) {
    return speakerId.id.toLowerCase().trim();
  }
  
  return null;
};

// Council phases for different modes
const DEBATE_PHASES: Phase[] = [
  { id: 'foundations', label: 'Foundations', step: 1 },
  { id: 'confrontation', label: 'Confrontation', step: 2 },
  { id: 'resolution', label: 'Resolution', step: 3 }
];

const ADVISORY_PHASES: Phase[] = [
  { id: 'understanding', label: 'Understanding', step: 1 },
  { id: 'guidance', label: 'Guidance', step: 2 },
  { id: 'integration', label: 'Integration', step: 3 }
];

// Fallback phases (maintains compatibility with existing system)
const LEGACY_PHASES: Phase[] = [
  { id: 'foundations', label: 'Foundations', step: 1 },
  { id: 'inquiry', label: 'Inquiry', step: 2 },
  { id: 'integration', label: 'Integration', step: 3 }
];

const ParticipantAvatar: FC<ParticipantAvatarProps> = ({ figure, isSpeaking, isActive }) => {
  const { tString } = useTranslation();
  const figureId = typeof figure === 'string' ? figure : figure?.id;
  const figureName = typeof figure === 'string' ? figure : figure?.name;

  return (
    <div
      className={`participant-avatar ${isSpeaking ? 'speaking' : ''} ${isActive ? 'active' : ''}`}
      title={figureName || figureId || 'Participant'}
    >
      <div className="avatar-container">
        <OptimizedFigureImage
          figure={figure}
          type="thumbnail"
          className="avatar-image"
          alt={figureName || figureId || 'Participant'}
          width={32}
          height={32}
        />
        {/* Speaking indicator removed - using white circle system in CSS */}
      </div>
      <span className="avatar-name">
        {getEchoShortName(figureId, tString) || getShortDisplayName(figureId)}
      </span>
    </div>
  );
};


const CosmicCouncilHeader: FC<CosmicCouncilHeaderProps> = ({
  moderator,
  participants = [],
  currentSpeaker = null,
  currentPhase = 'foundations',
  councilTitle = 'Cosmic Council',
  councilType = 'debate', // NEW: 'debate' or 'advisory'
  isActive = true,
  isCompleted = false, // NEW: Track if debate has completed naturally
  onEndCouncil
}) => {
  const { t, tString, tNode } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);


  // Smooth entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleEndCouncil = (): void => {
    if (onEndCouncil) {
      onEndCouncil();
    }
  };

  // Get the appropriate phase array based on council type
  const getPhaseArray = (): Phase[] => {
    if (councilType === 'advisory') return ADVISORY_PHASES;
    if (councilType === 'debate') return DEBATE_PHASES;
    return LEGACY_PHASES; // Fallback for compatibility
  };

  const currentPhaseArray = getPhaseArray();
  const currentPhaseData = currentPhaseArray.find(p => p.id === currentPhase);
  const currentPhaseLabel = currentPhaseData?.label || 'Opening';
  const currentPhaseStep = currentPhaseData?.step || 1;

  return (
    <div className={`cosmic-council-header ${isVisible ? 'visible' : ''}`}>
      {/* Subtle background effect */}
      <div className="cosmic-background">
        <div className="cosmic-gradient" />
        <div className="stellar-particles" />
      </div>
      
      {/* Desktop Layout - Hidden on Mobile */}
      <div className="header-content">
        {/* Left: Moderator */}
        <div className="header-moderator">
          {moderator && (
            <div className="moderator-display">
              <div className={`moderator-sun-container ${normalizeSpeakerId(currentSpeaker) === normalizeSpeakerId(moderator) ? 'speaking' : ''}`}>
                <OptimizedFigureImage
                  figure={moderator}
                  type="thumbnail"
                  className="moderator-avatar"
                  alt={typeof moderator === 'string' ? 'Moderator' : (moderator?.name || 'Moderator')}
                  width={64}
                  height={64}
                />
                <div className="moderator-crown">
                  <Crown size={14} weight="fill" />
                </div>
              </div>
              <span className={`moderator-label ${normalizeSpeakerId(currentSpeaker) === normalizeSpeakerId(moderator) ? 'speaking' : ''}`}>
              {(() => {
                const modId = typeof moderator === 'string' ? moderator : moderator?.id;
                return getEchoShortName(modId, tString) || getShortDisplayName(modId);
              })()}
            </span>
            </div>
          )}
        </div>

        {/* Left-Center: Participants (Main Focus) */}
        <div className="header-participants">
          <div className="participants-showcase">
            {participants.map((participant, index) => {
              const participantId = typeof participant === 'string' ? participant : participant?.id;
              return (
                <ParticipantAvatar
                  key={participantId || index}
                  figure={participant}
                  isSpeaking={normalizeSpeakerId(currentSpeaker) === normalizeSpeakerId(participantId)}
                  isActive={true}
                />
              );
            })}
          </div>
        </div>

        {/* Phase and Progress sections removed for cleaner experience */}

        {/* Right: Council Controls - Play/Pause Removed for Simplicity */}
        <div className="header-controls">
          <div className="control-buttons">
            {isCompleted && (
              // Show completion indicator when debate finished naturally
              <div className="completed-indicator">
                <span className="completed-badge">
                  {tNode('cosmicCouncil.debateComplete')}
                </span>
              </div>
            )}
            
            {/* End Button - Always available for user-initiated close */}
            <CloseButton
              onClick={handleEndCouncil}
              size="md"
              ariaLabel={isCompleted ? tString('cosmicCouncil.closeReview', 'Close Review') : tString('cosmicCouncil.endCouncil', 'End Council')}
            />
          </div>
        </div>

        {/* Mobile Layout - Only Visible on Mobile */}
        <div className="mobile-avatars-row">
          {/* Mobile Moderator */}
          {moderator && (
            <div className={`mobile-moderator ${normalizeSpeakerId(currentSpeaker) === normalizeSpeakerId(moderator) ? 'speaking' : ''}`}>
              <OptimizedFigureImage
                figure={moderator}
                type="thumbnail"
                className="mobile-moderator-avatar"
                alt={typeof moderator === 'string' ? 'Moderator' : (moderator?.name || 'Moderator')}
                width={52}
                height={52}
              />
              <div className="mobile-moderator-crown">
                <Crown size={12} weight="fill" />
              </div>
            </div>
          )}

          {/* Mobile Participants */}
          <div className="mobile-participants">
            {participants.map((participant, index) => {
              const participantId = typeof participant === 'string' ? participant : participant?.id;
              const isSpeaking = normalizeSpeakerId(currentSpeaker) === normalizeSpeakerId(participantId);
              
              return (
                <div key={participantId || index} className={`mobile-participant ${isSpeaking ? 'speaking' : ''}`}>
                  <OptimizedFigureImage
                    figure={participant}
                    type="thumbnail"
                    className="mobile-participant-avatar"
                    alt={typeof participant === 'string' ? 'Participant' : (participant?.name || 'Participant')}
                    width={52}
                    height={52}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Controls Row - Simplified */}
        <div className="mobile-controls-row">
          {/* Mobile Close Button Only */}
          <div className="mobile-close-button">
            {isCompleted ? (
              <span className="mobile-completed-badge">
                {tString('cosmicCouncil.debateComplete', 'Debate Complete')}
              </span>
            ) : (
              <CloseButton
                onClick={handleEndCouncil}
                size="sm"
                ariaLabel={tString('cosmicCouncil.endCouncil', 'End Council')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CosmicCouncilHeader;