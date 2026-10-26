import type { PlayerLang } from './strings';

export interface QueueEntry {
  /** Story number, 1 to 12: the number the audio file is named after. */
  n: number;
  title: string;
  minutes: number | null;
}

/** One figure's stories in one language, as the page hands them to the player. */
export interface StoryQueue {
  figureId: string;
  slug: string;
  lang: PlayerLang;
  name: string;
  artwork: string;
  entries: QueueEntry[];
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** Where the visitor stopped, as kept in this browser: the story and the second. */
export interface ResumePoint {
  figureId: string;
  lang: PlayerLang;
  n: number;
  t: number;
}

export interface PlayerState {
  queue: StoryQueue | null;
  /** The story number loaded in the player, or null before the first tap. */
  current: number | null;
  status: PlayerStatus;
  time: number;
  duration: number;
  rate: number;
  autoNext: boolean;
  /** Offered on the figure page it belongs to, never started on its own. */
  resume: ResumePoint | null;
  readerOpen: boolean;
  /** The visitor closed the dock; the next tap on a story opens it again. */
  dismissed: boolean;
}
