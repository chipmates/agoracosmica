import type { IconProps } from '@phosphor-icons/react';

export interface ModeConfig {
  icon: React.ComponentType<IconProps>;
  label: string;
  color: string;
  description: string;
}

export interface Figure {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Seed {
  id: string | number;
  [key: string]: any;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  isSummary?: boolean;
  timestamp?: string;
}

export interface HistoryData {
  messages: Message[];
  modeData?: { [key: string]: any };
  summary?: any;
  hasSummary?: boolean;
  hasStory?: boolean;
  storyCompleted?: boolean;
  isFreeTalk?: boolean;
}

export type HistoriesMap = Record<string, HistoryData>;

export interface HistoryLoadResult {
  histories: HistoriesMap;
  activeSeedId: string | null;
}

export interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFigure: Figure;
  onSummaryGenerated: () => void;
  onHistoryCleared: () => void;
}
