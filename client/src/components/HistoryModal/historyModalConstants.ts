import { Books, Sparkle, Mountains, Bird, DiamondsFour, BookOpen } from '@phosphor-icons/react';
import type { ModeConfig } from './historyModalTypes';

export const MODES: { [key: string]: ModeConfig } = {
  introduction: {
    icon: Books,
    label: 'Story',
    color: 'var(--story-color)',
    description: 'Narrative introduction'
  },
  prism: {
    icon: DiamondsFour,
    label: 'Prism',
    color: 'var(--mode-prism)',
    description: 'Multi-perspective dialogues'
  },
  seed_conversation: {
    icon: Sparkle,
    label: 'StarSeed',
    color: 'var(--seedtalk-color)',
    description: 'StarSeed exploration'
  },
  challenge: {
    icon: Mountains,
    label: 'Quest',
    color: 'var(--quest-color)',
    description: 'Knowledge challenges'
  },
  free_conversation: {
    icon: Bird,
    label: 'Freetalk',
    color: 'var(--freetalk-color)',
    description: 'Open dialogues'
  },
  summary: {
    icon: BookOpen,
    label: 'Summary',
    color: 'var(--summary-color)',
    description: 'Conversation summaries'
  }
};

// Helper function to extract just the last name from a figure's full name
export const getLastName = (fullName: string): string => {
  // First remove the "Echo of" prefix and similar translations
  const nameWithoutPrefix = fullName.replace(/^Echo of |^Echo von |^Echo de /i, '');

  // Special cases for figures with compound last names
  if (nameWithoutPrefix.includes('da Vinci')) return 'da Vinci';
  if (nameWithoutPrefix.includes('de Beauvoir')) return 'Beauvoir';
  if (nameWithoutPrefix.includes('von Bingen')) return 'Hildegard';
  if (nameWithoutPrefix.includes('von Goethe')) return 'Goethe';
  if (nameWithoutPrefix.includes('Luther King')) return 'King';
  if (nameWithoutPrefix.includes('Mark Aurel')) return 'Mark Aurel';

  // For normal cases, just get the last word
  const parts = nameWithoutPrefix.split(' ');
  return parts[parts.length - 1];
};
