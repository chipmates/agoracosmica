// Helpers for the output scan tests: a verdict over a given cut of a text, a
// seeded source of random cuts, and the differential against the old scanner.

import { StreamSafetyScanner } from '../src/utils/streamSafety';
import { MainStreamSafetyScanner } from './fixtures/outputScanMain';
import { freedBy } from './fixtures/outputScanTexts';

export type Verdict = 'cut' | 'pass';

export interface Scanner {
  check(text: string): boolean;
  finish(): boolean;
}

/** Feed the text in the given read lengths (the rest as one last read), then settle the end. */
export function verdict(scanner: Scanner, text: string, reads: number[] = []): Verdict {
  let at = 0;
  for (const read of reads) {
    if (at >= text.length) break;
    if (!scanner.check(text.slice(at, at + read))) return 'cut';
    at += read;
  }
  if (at < text.length && !scanner.check(text.slice(at))) return 'cut';
  return scanner.finish() ? 'pass' : 'cut';
}

/** Reads of one fixed size. */
export function fixedReads(length: number, size: number): number[] {
  return Array.from({ length: Math.ceil(length / size) }, () => size);
}

/** A small deterministic generator, so a failing case can be replayed. */
export class Random {
  constructor(private state: number) {}

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  int(bound: number): number {
    return Math.floor(this.next() * bound);
  }

  pick<T>(items: T[]): T {
    return items[this.int(items.length)];
  }
}

const READ_CEILINGS = [1, 2, 3, 5, 8, 13, 40, 130];

/** Random read lengths covering the text, from one-character reads to reads longer than the kept tail. */
export function randomReads(rng: Random, length: number): number[] {
  const ceiling = rng.pick(READ_CEILINGS);
  const reads: number[] = [];
  let at = 0;
  while (at < length) {
    const read = 1 + rng.int(ceiling);
    reads.push(read);
    at += read;
  }
  return reads;
}

export interface Difference {
  text: string;
  main: Verdict;
  ours: Verdict;
  /** The exclusion that frees the text, or null when none names it. */
  frees: string | null;
}

/** Every text whose whole-text verdict differs between the old scanner and this one. */
export function differential(texts: string[]): Difference[] {
  const out: Difference[] = [];
  for (const text of texts) {
    const main = verdict(new MainStreamSafetyScanner(), text);
    const ours = verdict(new StreamSafetyScanner(), text);
    if (main !== ours) out.push({ text, main, ours, frees: main === 'cut' ? freedBy(text) : null });
  }
  return out;
}
