// The reading view's model of a story: blocks, sentences and words, each word
// timed from the voice's character alignment where the text and the audio
// say the same words. Where they do not (a chapter whose text and audio
// drifted apart), the paragraph is marked from the paragraph timestamps.

import type { ParagraphStamp, StoryTiming, TextBlock } from './content';

export interface ReaderWord {
  text: string;
  si: number;
  /** When the voice starts this word, if it was found in the audio. */
  start: number | null;
}

export interface ReaderSentence {
  si: number;
  /** The block the sentence sits in. */
  bi: number;
  first: number;
  last: number;
  text: string;
}

export interface ReaderBlock {
  index: number;
  rule: boolean;
  /** The introduction's first line is its own title. */
  heading: boolean;
  sentences: number[];
}

export type ReadAlongMode = 'word' | 'paragraph' | 'none';

export interface ReaderModel {
  blocks: ReaderBlock[];
  sentences: ReaderSentence[];
  words: ReaderWord[];
  mode: ReadAlongMode;
  /** Timed words in order, for the search by time. */
  timed: number[];
  paragraphs: ParagraphStamp[];
  /** Share of the text's words found in the audio, 0 to 1. */
  match: number;
}

/** Below this share of matched words the page marks paragraphs instead. */
const WORD_MATCH_FLOOR = 0.9;
const LOOKAHEAD = 8;

const SENTENCE_RE = /[^.!?…]+(?:[.!?…]+["“”»«‘’)]*)+|[^.!?…]+$/g;

function norm(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

interface AudioWord {
  key: string;
  start: number;
}

function audioWords(timing: StoryTiming): AudioWord[] {
  const a = timing.chars;
  if (!a) return [];
  const out: AudioWord[] = [];
  let cur = '';
  let start = 0;
  const push = () => {
    const key = norm(cur);
    if (key) out.push({ key, start });
    cur = '';
  };
  for (let i = 0; i < a.characters.length; i += 1) {
    const c = a.characters[i] ?? '';
    if (c === '<') {
      // a pause tag the voice service wrote into the text
      push();
      while (i < a.characters.length && a.characters[i] !== '>') i += 1;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      continue;
    }
    if (!cur) start = a.character_start_times_seconds[i] ?? 0;
    cur += c;
  }
  push();
  return out;
}

export function buildModel(blocks: TextBlock[], timing: StoryTiming, isIntro: boolean): ReaderModel {
  const model: ReaderModel = { blocks: [], sentences: [], words: [], mode: 'none', timed: [], paragraphs: timing.paragraphs ?? [], match: 0 };
  blocks.forEach((block, bi) => {
    const rb: ReaderBlock = { index: block.index, rule: block.rule, heading: isIntro && bi === 0, sentences: [] };
    model.blocks.push(rb);
    if (block.rule) return;
    const parts = rb.heading ? [block.text] : block.text.match(SENTENCE_RE) ?? [block.text];
    for (const raw of parts) {
      const text = raw.trim();
      if (!text) continue;
      const si = model.sentences.length;
      const first = model.words.length;
      for (const token of text.split(/\s+/)) model.words.push({ text: token, si, start: null });
      model.sentences.push({ si, bi, first, last: model.words.length - 1, text });
      rb.sentences.push(si);
    }
  });

  const audio = audioWords(timing);
  if (audio.length) {
    const textIdx = model.words.map((w, i) => ({ key: norm(w.text), i })).filter(w => w.key);
    let i = 0;
    let j = 0;
    let exact = 0;
    while (i < textIdx.length && j < audio.length) {
      const tw = textIdx[i]!;
      const aw = audio[j]!;
      if (tw.key === aw.key) {
        model.words[tw.i]!.start = aw.start;
        exact += 1;
        i += 1;
        j += 1;
        continue;
      }
      let skipAudio = -1;
      let skipText = -1;
      for (let k = 1; k < LOOKAHEAD; k += 1) {
        if (skipAudio < 0 && audio[j + k]?.key === tw.key) skipAudio = k;
        if (skipText < 0 && textIdx[i + k]?.key === aw.key) skipText = k;
      }
      if (skipAudio > 0 && (skipText < 0 || skipAudio <= skipText)) j += skipAudio;
      else if (skipText > 0) i += skipText;
      else {
        // the same place, a different word ("Mark Aurel" read as "Marcus Aurelius")
        model.words[tw.i]!.start = aw.start;
        i += 1;
        j += 1;
      }
    }
    model.match = textIdx.length ? exact / textIdx.length : 0;
    if (model.match >= WORD_MATCH_FLOOR) {
      model.mode = 'word';
      let last = -1;
      model.words.forEach((w, wi) => {
        if (w.start !== null && w.start >= last) {
          model.timed.push(wi);
          last = w.start;
        }
      });
    }
  }
  if (model.mode === 'none' && model.paragraphs.length) model.mode = 'paragraph';
  return model;
}

/** The word the voice is on at time t, or -1 before the first. */
export function wordAt(model: ReaderModel, t: number): number {
  const list = model.timed;
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = model.words[list[mid]!]!.start ?? Infinity;
    if (start <= t) {
      found = list[mid]!;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** The text block the voice is in at time t, from the paragraph timestamps. */
export function blockAt(model: ReaderModel, t: number): number | null {
  let found: number | null = null;
  for (const p of model.paragraphs) {
    if (p.start <= t) found = p.index;
    else break;
  }
  return found;
}

/** Where the voice says this sentence, for "listen from here" and a tap while playing. */
export function sentenceStart(model: ReaderModel, si: number): number {
  const s = model.sentences[si];
  if (!s) return 0;
  if (model.mode === 'word') {
    for (let w = s.first; w <= s.last; w += 1) {
      const start = model.words[w]!.start;
      if (start !== null) return start;
    }
  }
  const block = model.blocks[s.bi];
  const stamp = block ? model.paragraphs.find(p => p.index === block.index) : undefined;
  return stamp?.start ?? 0;
}
