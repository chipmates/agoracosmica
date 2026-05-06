// StoryFactCheckPanel.tsx - Story-level factcheck panel
// Shows factcheck info for a specific story within a figure
import React, { FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Button';
import { useFactCheck, FactCheckStory } from '../../hooks/useFactCheck';
import { useTranslation } from '../../hooks/useTranslation';
import {
  CheckCircle,
  PencilSimple,
  MapPin,
  Calendar,
  User,
  Info,
  ArrowRight,
  BookOpen
} from '@phosphor-icons/react';
import { FactCheckModal } from './FactCheckModal';
import './StoryFactCheckPanel.css';

interface StoryFactCheckPanelProps {
  figureId: string;
  figureName?: string;
  storyNumber: number;
  onClose: () => void;
}

/**
 * StoryFactCheckPanel - Slide-out panel for story-level factcheck
 * Shows: year, age, setting, documented facts, recreated elements, notes
 */
export const StoryFactCheckPanel: FC<StoryFactCheckPanelProps> = ({
  figureId,
  figureName,
  storyNumber,
  onClose
}) => {
  const { tString } = useTranslation();
  const { factCheck, loading, error, getStoryFactCheck } = useFactCheck(figureId);
  const [showFullFactCheck, setShowFullFactCheck] = useState(false);

  const storyFactCheck = getStoryFactCheck(storyNumber);

  // Get display name from factcheck data or prop
  const displayName = factCheck?.figure?.name || figureName || figureId;

  // Helper to render content via portal - escapes stacking context
  const renderPanel = (content: React.ReactNode) => {
    return createPortal(content, document.body);
  };

  if (loading) {
    return renderPanel(
      <div className="story-factcheck-panel-container">
        <div className="story-factcheck-panel">
          <div className="story-factcheck-panel__loading">
            <div className="story-factcheck-panel__spinner" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !storyFactCheck) {
    return renderPanel(
      <div className="story-factcheck-panel-container">
        <div className="story-factcheck-panel">
          <div className="story-factcheck-panel__header">
            <span>{tString('factCheck.storyDetails')}</span>
            <CloseButton onClick={onClose} />
          </div>
          <div className="story-factcheck-panel__error">
            <Info size={24} />
            <p>No factcheck data available for this story.</p>
          </div>
        </div>
      </div>
    );
  }

  const { title, year, age, setting, documented, recreated, note } = storyFactCheck;

  return renderPanel(
    <div className="story-factcheck-panel-container">
      <div className="story-factcheck-panel">
        {/* Header */}
        <div className="story-factcheck-panel__header">
          <div className="story-factcheck-panel__title-group">
            <span className="story-factcheck-panel__story-num">
              {tString('factCheck.storyNumber').replace('{number}', String(storyNumber))}
            </span>
            <h2 className="story-factcheck-panel__title">{title}</h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

      {/* Content */}
      <div className="story-factcheck-panel__content">
        {/* Meta info row */}
        <div className="story-factcheck-panel__meta">
          <div className="story-factcheck-panel__meta-item">
            <Calendar size={16} />
            <span>{year}</span>
          </div>
          <div className="story-factcheck-panel__meta-item">
            <User size={16} />
            <span>{tString('factCheck.age')}: {age}</span>
          </div>
        </div>

        {/* Setting */}
        <div className="story-factcheck-panel__setting">
          <MapPin size={16} />
          <span>{setting}</span>
        </div>

        {/* Documented facts */}
        {documented.length > 0 && (
          <div className="story-factcheck-panel__section story-factcheck-panel__section--documented">
            <h3 className="story-factcheck-panel__section-title">
              <CheckCircle size={18} weight="duotone" />
              {tString('factCheck.documented')}
            </h3>
            <ul className="story-factcheck-panel__list story-factcheck-panel__list--documented">
              {documented.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recreated elements */}
        {recreated.length > 0 && (
          <div className="story-factcheck-panel__section story-factcheck-panel__section--recreated">
            <h3 className="story-factcheck-panel__section-title">
              <PencilSimple size={18} weight="duotone" />
              {tString('factCheck.recreated')}
            </h3>
            <ul className="story-factcheck-panel__list story-factcheck-panel__list--recreated">
              {recreated.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Note (if present) */}
        {note && (
          <div className="story-factcheck-panel__note">
            <Info size={16} weight="duotone" />
            <p>{note}</p>
          </div>
        )}

          {/* Footer with View All button */}
          <button
            className="story-factcheck-panel__view-all"
            onClick={() => setShowFullFactCheck(true)}
          >
            <BookOpen size={18} weight="duotone" />
            <span>{tString('factCheck.figureOverview')}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Full FactCheck Modal */}
        {showFullFactCheck && (
          <FactCheckModal
            figureId={figureId}
            figureName={displayName}
            onClose={() => setShowFullFactCheck(false)}
          />
        )}
      </div>
    </div>
  );
};

export default StoryFactCheckPanel;
