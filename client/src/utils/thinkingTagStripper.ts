// client/src/utils/thinkingTagStripper.ts
//
// Strip `<think>...</think>` blocks from LLM output. Used in chat, council, and
// summary streams.
//
// Thinking-capable models (Qwen3, DeepSeek-R1 distills, QwQ) emit `<think>`
// scratchpad blocks before their answer. They have no semantic value to the
// user and break council parsing (the parser reads `SPEAKER :: ...` lines, and
// scratchpad content looks like a free-form speaker turn).

const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/g;

/** Remove all complete `<think>...</think>` blocks from a string. */
export function stripThinkingTagsFromText(s: string): string {
  if (!s) return s;
  return s.replace(THINK_BLOCK_RE, '').trim();
}

export interface ThinkingTagStreamFilter {
  /**
   * Process a streaming delta. Returns the portion of the delta that should be
   * passed downstream (post-strip). May return an empty string if the delta
   * was entirely inside a `<think>` block.
   */
  filter(chunk: string): string;
  /** True while the filter is currently inside (or possibly inside) a `<think>` block. */
  isStripping(): boolean;
  /**
   * Flush any buffered content at end-of-stream. If a `<think>` block was opened
   * but never closed (model truncation), the buffer is discarded.
   */
  flush(): string;
}

/**
 * Build a streaming filter for `<think>` blocks. Use one per stream.
 *
 * Behavior:
 *   - Before any `<think>` is seen, content passes through unchanged.
 *   - On detecting `<think>`, content from that point is buffered and held back.
 *   - On detecting `</think>`, the buffer is dropped and downstream resumes.
 *   - Nested `<think>` blocks are not supported (no real model emits them).
 *   - Partial tag fragments at chunk boundaries (e.g. delta ends with `<thin`)
 *     are buffered until the next chunk so we don't mis-strip user content
 *     that legitimately contains the substring `<think` mid-sentence (rare,
 *     but cheap to guard against).
 */
export function createThinkingTagFilter(): ThinkingTagStreamFilter {
  let buffer = '';        // unflushed text (always pre-strip)
  let inThinkBlock = false;

  const filter = (chunk: string): string => {
    if (!chunk) return '';

    if (inThinkBlock) {
      buffer += chunk;
      const closeIdx = buffer.indexOf('</think>');
      if (closeIdx === -1) return ''; // still inside the block
      const after = buffer.slice(closeIdx + '</think>'.length);
      buffer = '';
      inThinkBlock = false;
      // Recurse in case there's another `<think>` later in the same delta.
      return filter(after);
    }

    buffer += chunk;
    const openIdx = buffer.indexOf('<think>');

    if (openIdx === -1) {
      // No open tag in buffer. We can flush everything except a possible
      // partial opening fragment at the tail (e.g. `...text<thin`).
      const partialIdx = findTrailingPartialTag(buffer);
      if (partialIdx === -1) {
        const out = buffer;
        buffer = '';
        return out;
      }
      const out = buffer.slice(0, partialIdx);
      buffer = buffer.slice(partialIdx);
      return out;
    }

    // Open tag found. Emit everything before it, switch to in-block mode,
    // and recurse with what came after the `<think>` opener.
    const beforeOpen = buffer.slice(0, openIdx);
    const afterOpen = buffer.slice(openIdx + '<think>'.length);
    buffer = '';
    inThinkBlock = true;
    const after = filter(afterOpen);
    return beforeOpen + after;
  };

  return {
    filter,
    isStripping: () => inThinkBlock,
    flush: () => {
      if (inThinkBlock) {
        // Unclosed `<think>` — drop the buffer.
        buffer = '';
        return '';
      }
      const out = buffer;
      buffer = '';
      return out;
    },
  };
}

/**
 * Return the index in `s` where a possible-partial `<think>` opener begins,
 * or -1 if none. Conservative — we only hold back text that could be the
 * start of a `<think>` opener.
 */
function findTrailingPartialTag(s: string): number {
  // Possible partials of `<think>` that, if cut off, could be the start.
  const prefixes = ['<', '<t', '<th', '<thi', '<thin', '<think'];
  for (const p of prefixes) {
    if (s.endsWith(p)) return s.length - p.length;
  }
  return -1;
}
