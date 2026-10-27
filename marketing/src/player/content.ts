// What the player fetches only when the visitor opens it: a story's text, its
// timing for the read-along, and the figure's facts. None of it is in the
// page's HTML. Each fetch is made once per page life.

import type { StoryQueue } from './types';

const MEDIA = 'https://media.agoracosmica.org';

function versioned(url: string, version: string | undefined): string {
  return version ? `${url}?v=${version}` : url;
}

function storyBase(queue: StoryQueue, n: number): string {
  return `${MEDIA}/stories/${queue.figureId}/${queue.lang}/${queue.figureId}_${n}_${queue.lang}`;
}

/** One block of a story's text: a paragraph, or a break the source marks with "---". */
export interface TextBlock {
  index: number;
  text: string;
  rule: boolean;
}

/** Character timings as the voice service writes them. */
export interface CharAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface ParagraphStamp {
  index: number;
  start: number;
  end: number;
}

export interface StoryTiming {
  chars?: CharAlignment | undefined;
  paragraphs?: ParagraphStamp[] | undefined;
}

const textCache = new Map<string, Promise<TextBlock[]>>();
const timingCache = new Map<string, Promise<StoryTiming>>();
let factsCache: { key: string; promise: Promise<FactSheet> } | null = null;

export function loadText(queue: StoryQueue, n: number): Promise<TextBlock[]> {
  const url = versioned(`${storyBase(queue, n)}.txt`, queue.versions?.stories);
  let hit = textCache.get(url);
  if (!hit) {
    hit = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`text ${res.status}`);
        return res.text();
      })
      .then(raw =>
        raw
          .replace(/\r\n?/g, '\n')
          .split(/\n\s*\n/)
          .map(p => p.trim())
          .filter(Boolean)
          .map((p, index) => ({ index, text: p.replace(/\s+/g, ' '), rule: /^-{3,}$/.test(p) })),
      );
    hit.catch(() => textCache.delete(url));
    textCache.set(url, hit);
  }
  return hit;
}

function isChars(v: unknown): v is CharAlignment {
  const a = v as CharAlignment;
  return !!a && Array.isArray(a.characters) && Array.isArray(a.character_start_times_seconds)
    && a.characters.length === a.character_start_times_seconds.length;
}

async function json(url: string): Promise<unknown> {
  const res = await fetch(url);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('json')) throw new Error(`timing ${res.status}`);
  return res.json();
}

/**
 * The voice's timing: the character alignment beside the story where it
 * exists, else the older timestamps file (characters or paragraphs).
 */
export function loadTiming(queue: StoryQueue, n: number): Promise<StoryTiming> {
  const base = storyBase(queue, n);
  let hit = timingCache.get(base);
  if (!hit) {
    hit = (async () => {
      const timing: StoryTiming = {};
      const alignment = async () => {
        try {
          const a = await json(versioned(`${base}.alignment.json`, queue.versions?.stories));
          if (isChars(a)) timing.chars = a;
        } catch {
          // no alignment for this file
        }
      };
      // The stories have a word alignment; the introduction carries its
      // characters in the timestamps file and has none, so it asks for that first.
      if (n !== 0) await alignment();
      try {
        const t = (await json(versioned(`${base}.timestamps.json`, queue.versions?.stories))) as {
          paragraphs?: ParagraphStamp[];
        };
        if (!timing.chars && isChars(t)) timing.chars = t;
        if (Array.isArray(t.paragraphs)) timing.paragraphs = t.paragraphs;
      } catch {
        // no timestamps: the text still reads
      }
      if (n === 0 && !timing.chars) await alignment();
      return timing;
    })();
    timingCache.set(base, hit);
  }
  return hit;
}

/** One story's facts, or the introduction's, as the factcheck file has them. */
export interface FactEntry {
  title?: string | undefined;
  year?: string | undefined;
  age?: string | undefined;
  setting?: string | undefined;
  documented: string[];
  recreated: string[];
  note?: string | undefined;
  notes: string[];
}

export interface FactSheet {
  stories: Map<number, FactEntry>;
}

interface RawStory {
  number?: unknown;
  title?: unknown;
  year?: unknown;
  age?: unknown;
  setting?: unknown;
  documented?: unknown;
  recreated?: unknown;
  note?: unknown;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

export function loadFacts(queue: StoryQueue): Promise<FactSheet> {
  const url = versioned(`${MEDIA}/factchecks/${queue.lang}/${queue.figureId}.json`, queue.versions?.factchecks);
  if (factsCache?.key === url) return factsCache.promise;
  const promise = fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`facts ${res.status}`);
      return res.json() as Promise<{ foreword?: RawStory & { notes?: unknown }; stories?: RawStory[] }>;
    })
    .then(raw => {
      const stories = new Map<number, FactEntry>();
      if (raw.foreword) {
        stories.set(0, {
          title: str(raw.foreword.title),
          documented: list(raw.foreword.documented),
          recreated: [],
          notes: list(raw.foreword.notes),
        });
      }
      for (const s of raw.stories ?? []) {
        if (typeof s.number !== 'number') continue;
        stories.set(s.number, {
          title: str(s.title),
          year: str(s.year),
          age: str(s.age),
          setting: str(s.setting),
          documented: list(s.documented),
          recreated: list(s.recreated),
          note: str(s.note),
          notes: [],
        });
      }
      return { stories };
    });
  promise.catch(() => {
    if (factsCache?.promise === promise) factsCache = null;
  });
  factsCache = { key: url, promise };
  return promise;
}

// The same laundering as the build's cleanFactText (lib/figureWorld.ts), kept
// here without that module's build-time imports: the house style has no dash
// between words and no semicolon in displayed text.
export function cleanFact(s: string | undefined): string {
  return (s ?? '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/(\S)[—–](\S)/g, '$1-$2')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}
