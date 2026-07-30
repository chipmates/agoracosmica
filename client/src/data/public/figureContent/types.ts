// Per-figure authored content fragments. Each figure owns exactly one file in
// this directory, so parallel authoring never collides. A fragment OVERRIDES
// the legacy entries in figureQA.ts / figurePageContent.ts when present and
// falls back to them when empty.
//
// Writing bar for every string (the accessible-language law):
//   - everyday words, short sentences (avg <= 16 words, hard max ~28)
//   - concrete before abstract, warm second person where it fits
//   - no em/en dashes, no semicolons, no AI filler
//   - German is WRITTEN in German, never translated from the English
//   - every claim traceable to seeds / factchecks / catalog. Never invent or
//     strengthen a fact. Quotes verbatim or omitted.
import type { FigureQAEntry } from '../figureQA';
import type { FigurePageLang } from '../figurePageContent';

export interface FigureFragment {
  /** Voice-passed QA (3 pairs + disclosure per language). Omit until passed. */
  qa?: { en: FigureQAEntry; de: FigureQAEntry };
  /** Authored page content (concept H2s, idea question, works notes). */
  page?: { en: FigurePageLang; de: FigurePageLang };
}
