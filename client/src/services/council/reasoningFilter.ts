import { createReasoningFilter, type ReasoningFilter } from '../../utils/thinkingTagStripper';

// A speaker label at a line start, in the shape the council parser reads.
const LINE_LABEL = /(?:^|\n)[^\S\n]*[^:\n]{1,60}?\s*::/g;

export type CouncilReasoningFilter = ReasoningFilter;

/**
 * Drops model reasoning ahead of a council script: the shared filter, released
 * by a second speaker label. The parser emits a segment only when the next
 * speaker's line is complete, so the hold never delays the first segment.
 */
export function createCouncilReasoningFilter(): CouncilReasoningFilter {
  return createReasoningFilter({
    release: (held) => (held.match(LINE_LABEL) ?? []).length >= 2,
  });
}

/** The same rules over a whole response, for the fallback parser. */
export function stripCouncilReasoning(text: string): string {
  const filter = createCouncilReasoningFilter();
  return (filter.push(text) + filter.flush()).trim();
}
