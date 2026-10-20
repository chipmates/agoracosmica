import { createThinkingTagFilter } from '../../utils/thinkingTagStripper';

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';
// A speaker label at a line start, in the shape the council parser reads.
const LINE_LABEL = /(?:^|\n)[^\S\n]*[^:\n]{1,60}?\s*::/g;

export interface CouncilReasoningFilter {
  /** Text the parser may read now; empty while the start of the stream is held. */
  push(chunk: string): string;
  /** End of stream: whatever is still held, minus any unclosed block. */
  flush(): string;
}

/**
 * Drops model reasoning ahead of a council script.
 *
 * Besides `<think>...</think>` blocks, a model can open the stream with only the
 * tail of its reasoning, closed by `</think>` with no opening tag, and put the
 * first speaker's line right after it. The start of the stream is held until a
 * tag settles it or a second speaker label shows the script has begun. The
 * parser emits a segment only when the next speaker's line is complete, so the
 * hold never delays the first segment.
 */
export function createCouncilReasoningFilter(): CouncilReasoningFilter {
  const blocks = createThinkingTagFilter();
  let held = '';
  let started = false;

  const release = (text: string): string => {
    started = true;
    held = '';
    return blocks.filter(text);
  };

  return {
    push(chunk: string): string {
      if (started) return blocks.filter(chunk);
      held += chunk;
      const close = held.indexOf(CLOSE_TAG);
      const open = held.indexOf(OPEN_TAG);
      if (close !== -1 && (open === -1 || close < open)) {
        return release(held.slice(close + CLOSE_TAG.length));
      }
      if (open !== -1) return release(held);
      if ((held.match(LINE_LABEL) ?? []).length >= 2) return release(held);
      return '';
    },
    flush(): string {
      const rest = started ? '' : release(held);
      return rest + blocks.flush();
    },
  };
}

/** The same rules over a whole response, for the fallback parser. */
export function stripCouncilReasoning(text: string): string {
  const filter = createCouncilReasoningFilter();
  return (filter.push(text) + filter.flush()).trim();
}
