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

const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';

/**
 * The TextChunker's first chunk waits for 140 characters of whole sentences
 * (minChars 80 + 60 in EN and DE), so holding the start this long costs no time.
 */
export const FIRST_CHUNK_FLOOR = 140;

/**
 * Reasoning tails seen so far opened with one space before a word and ran to
 * 182 characters at most; no reply of the two serving models opened that way.
 * A stream that opens so is held this long.
 */
export const TAIL_HOLD_MAX = 600;

export interface ReasoningFilter {
  /** Text that may go on now; empty while the start of the stream is held. */
  push(chunk: string): string;
  /** End of stream: whatever is still held, minus any unclosed block. */
  flush(): string;
}

export interface ReasoningFilterOptions {
  /** True once the held start of the stream can only be the reply. */
  release?: (held: string) => boolean;
}

/** The chat's release rule: the chunker's floor, or longer after a tail's opening. */
export function releaseChatStart(held: string): boolean {
  return held.length >= (/^ \S/.test(held) ? TAIL_HOLD_MAX : FIRST_CHUNK_FLOOR);
}

/** The chunker's floor only, for a local server where no tail has been seen. */
export function releaseAtFloor(held: string): boolean {
  return held.length >= FIRST_CHUNK_FLOOR;
}

function partialTagAt(s: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return s.length - n;
  }
  return -1;
}

/**
 * Drops model reasoning from a stream. Besides `<think>...</think>` blocks, a
 * model can open with only the tail of its reasoning, closed by `</think>` with
 * no opening tag. The start of the stream is held until a tag settles it or
 * `release` says the held text is the reply. A stray `</think>` later becomes a
 * line break, so what follows it starts a line (a council's first label).
 */
export function createReasoningFilter(options: ReasoningFilterOptions = {}): ReasoningFilter {
  const release = options.release ?? releaseChatStart;
  const blocks = createThinkingTagFilter();
  let held = '';
  let started = false;
  let partial = '';

  const pass = (text: string): string => {
    let out = (partial + blocks.filter(text)).split(CLOSE_TAG).join('\n');
    const cut = partialTagAt(out, CLOSE_TAG);
    partial = cut === -1 ? '' : out.slice(cut);
    if (cut !== -1) out = out.slice(0, cut);
    return out;
  };

  const start = (text: string): string => {
    started = true;
    held = '';
    return pass(text);
  };

  return {
    push(chunk: string): string {
      if (!chunk) return '';
      if (started) return pass(chunk);
      held += chunk;
      const close = held.indexOf(CLOSE_TAG);
      const open = held.indexOf(OPEN_TAG);
      if (close !== -1 && (open === -1 || close < open)) {
        return start(held.slice(close + CLOSE_TAG.length));
      }
      if (open !== -1) return start(held);
      if (partialTagAt(held, CLOSE_TAG) !== -1) return '';
      return release(held) ? start(held) : '';
    },
    flush(): string {
      const rest = started ? '' : start(held);
      const tail = blocks.flush();
      const out = rest + partial + tail;
      partial = '';
      return out;
    },
  };
}

/** The same rules over a whole response. */
export function stripReasoningFromText(text: string): string {
  if (!text) return text;
  const filter = createReasoningFilter();
  return (filter.push(text) + filter.flush()).trim();
}
