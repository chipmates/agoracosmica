// ConstellationInfo.tsx - Displays information about a constellation.
// On phones this panel also carries the plate's cartouche and marginalia:
// name, epithet, progress and description, since the plate drops them
// there rather than lay them over the stars.
import { FC } from 'react';
import { X } from '@phosphor-icons/react';
import './css/ConstellationInfo.css';
import useTranslation from '../../hooks/useTranslation';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';

interface ConstellationInfoProps {
  name: string;
  description: string;
  /** Figure name without the Echo prefix. Adds the "after {figure}" line. */
  figureCleanName?: string;
  gatheredCount?: number;
  totalSeeds?: number;
  isComplete?: boolean;
  /** The display pattern took a quarter turn, so directional wording
   *  ("left to right", "side by side") switches to its portrait variant. */
  rotated?: boolean;
  onClose?: () => void;
}

const ConstellationInfo: FC<ConstellationInfoProps> = ({
  name,
  description,
  figureCleanName,
  gatheredCount,
  totalSeeds,
  isComplete = false,
  rotated = false,
  onClose,
}) => {
  const { t, tString } = useTranslation();

  // Get translation key if available, otherwise use the original name
  const nameKey = getConstellationTranslationKey(name);
  const translatedName = nameKey ? tString(nameKey, name) : name;

  // If we have a translation key for the name, try to get the description translation too
  let translatedDescription = description;
  if (nameKey) {
    // Convert names.X to descriptions.X
    const descriptionKey = nameKey.replace('names.', 'descriptions.');
    const translatedDesc = tString(descriptionKey, description);
    if (translatedDesc && translatedDesc !== descriptionKey) {
      translatedDescription = translatedDesc;
    }
    if (rotated) {
      const portraitKey = nameKey.replace('names.', 'descriptionsPortrait.');
      const portraitDesc = tString(portraitKey, '');
      if (portraitDesc && portraitDesc !== portraitKey) {
        translatedDescription = portraitDesc;
      }
    }
  }

  const showProgress = typeof gatheredCount === 'number' && typeof totalSeeds === 'number';

  return (
    <div className="constellation-info" role="group" aria-label={translatedName || name}>
      {onClose && (
        <button
          type="button"
          className="constellation-info-close"
          onClick={onClose}
          aria-label={tString('common.close', 'Close')}
        >
          <X size={18} />
        </button>
      )}
      <h3>{translatedName || name}</h3>
      {figureCleanName && (
        <p className="constellation-info-epithet">
          {String(t('wisdomAtlas.after', { figure: figureCleanName }))}
        </p>
      )}
      {showProgress && (
        <p className="constellation-info-progress">
          {String(t('wisdomAtlas.starsGathered', { gathered: gatheredCount, total: totalSeeds }))}
        </p>
      )}
      <p>{translatedDescription || description}</p>
      {isComplete && (
        <p className="constellation-info-complete">
          {tString('wisdomAtlas.plateComplete', 'The plate is complete')}
        </p>
      )}
    </div>
  );
};

export default ConstellationInfo;
