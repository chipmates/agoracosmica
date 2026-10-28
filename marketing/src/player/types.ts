import type { PlayerLang } from './strings';

export interface QueueEntry {
  /** 0 is the introduction; 1 to 12 the stories: the number the audio file is named after. */
  n: number;
  title: string;
  minutes: number | null;
  /** The produced audio's length, for the clock before the file loads. */
  seconds?: number | undefined;
  /** The factcheck's year, place and age, as the contents row shows them. */
  year?: string | undefined;
  place?: string | undefined;
  age?: string | undefined;
}

/** A life the page points to after the last story. */
export interface RelatedLife {
  name: string;
  href: string;
}

/** One figure's introduction and stories in one language, as the page hands them to the player. */
export interface StoryQueue {
  figureId: string;
  slug: string;
  lang: PlayerLang;
  name: string;
  artwork: string;
  entries: QueueEntry[];
  /** Content versions of R2's immutable files, the same the app appends. */
  versions?: { factchecks?: string; stories?: string } | undefined;
  related?: RelatedLife[] | undefined;
  /** For the notes that say whose words these are not. */
  she?: boolean | undefined;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** Where the visitor stopped, as kept in this browser: the story and the second. */
export interface ResumePoint {
  figureId: string;
  lang: PlayerLang;
  n: number;
  t: number;
}

export type SheetKind = 'player' | 'facts' | 'display' | 'saved';

/** The sleep timer: off, minutes of playing time, or the end of the story that is playing. */
export type SleepChoice = 'off' | 10 | 20 | 30 | 'end';
export const SLEEP_CHOICES: readonly SleepChoice[] = ['off', 10, 20, 30, 'end'];

/** A sentence the visitor kept, on this device only. */
export interface SavedSentence {
  n: number;
  /** The sentence's index in its story, as the reader numbers them. */
  si: number;
  text: string;
  at: number;
}

export interface EndCard {
  /** The story that ended and the one that follows. */
  n: number;
  next: number;
  /** Seconds before the next one starts. */
  left: number;
}

export interface PlayerState {
  queue: StoryQueue | null;
  /** The item loaded in the player (0 the introduction), or null before the first tap. */
  current: number | null;
  status: PlayerStatus;
  time: number;
  duration: number;
  rate: number;
  /** "After this story": the next one follows (true) or the player stops. */
  autoNext: boolean;
  /** Offered on the figure page it belongs to, never started on its own. */
  resume: ResumePoint | null;
  /** The reading view is open, for any item, playing or not. */
  readerOpen: boolean;
  /** The item the reading view shows. */
  readerN: number | null;
  /** Whose item it shows: after a soft page change the page's figure can differ from the playing one. */
  readerQueue: StoryQueue | null;
  /** The visitor ended playback; the next tap on a story opens the dock again. */
  dismissed: boolean;
  /** Items heard or read to the end in this browser, for the figure in the queue or on the page. */
  done: number[];
  endCard: EndCard | null;
  sheet: SheetKind | null;
  /** The item a facts sheet is about. */
  sheetN: number | null;
  /** The reader was scrolled away from the voice; the dock offers the way back. */
  away: boolean;
  /** Where the voice is from the view while away: above it or below it. */
  awayDir: 'up' | 'down';
  saved: SavedSentence[];
  sleep: SleepChoice;
  /** Seconds of playing left on a minutes timer. */
  sleepLeft: number;
}
