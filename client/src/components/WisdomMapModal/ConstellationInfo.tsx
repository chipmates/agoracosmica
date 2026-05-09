// ConstellationInfo.tsx - Displays information about a constellation
import { FC } from 'react';
import './css/ConstellationInfo.css';
import useTranslation from '../../hooks/useTranslation';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';

interface ConstellationInfoProps {
  name: string;
  description: string;
}

const ConstellationInfo: FC<ConstellationInfoProps> = ({ name, description }) => {
  const { tString } = useTranslation();

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
  }
  
  return (
    <div className="constellation-info">
      <h3>{translatedName || name}</h3>
      <p>{translatedDescription || description}</p>
    </div>
  );
};

export default ConstellationInfo;