/**
 * SSE stream filter that scans LLM output for §4 JMStV absolute violations.
 *
 * Wraps the Nebius SSE response body in a TransformStream. Each complete SSE
 * line is parsed to extract text deltas, which are fed to the
 * StreamSafetyScanner. If a critical pattern is detected, the stream is
 * aborted and a fallback message is sent to the client.
 */

import { StreamSafetyScanner } from '../utils/streamSafety';

const FALLBACK_SSE = 'data: {"choices":[{"delta":{"content":"[This response could not be displayed. Please try a different question.]"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';

const NEWLINE = 0x0a;

/**
 * Create a filtered ReadableStream that scans SSE chunks for safety violations.
 * If a violation is detected mid-stream, the remaining stream is replaced
 * with a fallback message.
 *
 * A network read can end inside a line. The bytes after the last newline are
 * held back until the line completes (or the stream ends) and are scanned
 * with it, so no byte reaches the client before the line it belongs to has
 * been scanned. A match that waits for the text after it holds every read
 * since it began: they are forwarded when it clears, dropped when it cuts,
 * and dropped with the stream when the provider fails before it settles (no
 * flush runs then). Everything forwarded is the provider's own bytes, unchanged.
 */
export function createSafetyFilteredStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const scanner = new StreamSafetyScanner();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let tail: Uint8Array = new Uint8Array(0);
  let held: Uint8Array[] = [];

  const fallback = (controller: TransformStreamDefaultController<Uint8Array>): void => {
    // Critical violation detected: send the fallback
    console.warn('[StreamSafety] Output blocked: critical pattern detected in LLM response');
    held = [];
    controller.enqueue(encoder.encode(FALLBACK_SSE));
  };

  const release = (controller: TransformStreamDefaultController<Uint8Array>): void => {
    for (const read of held) controller.enqueue(read);
    held = [];
  };

  // Scan complete lines; false means the stream was replaced by the fallback.
  // A match may wait for the text after it, so the [DONE] frame settles the
  // scan before it is forwarded.
  const pass = (
    bytes: Uint8Array,
    controller: TransformStreamDefaultController<Uint8Array>,
  ): boolean => {
    // Cut only at a newline byte, which never occurs inside a UTF-8 sequence.
    const { content, done } = extractContentFromSSE(decoder.decode(bytes));
    if ((content && !scanner.check(content)) || (done && !scanner.finish())) {
      fallback(controller);
      controller.terminate();
      return false;
    }
    if (scanner.pending()) {
      held.push(bytes);
      return true;
    }
    release(controller);
    controller.enqueue(bytes);
    return true;
  };

  // CodeQL's standard JS model flags the transformer arg as "superfluous"
  // against an older TransformStream signature. @cloudflare/workers-types and
  // the Web Streams spec define three optional args (transformer,
  // writableStrategy, readableStrategy); one transformer is correct. Dismissed
  // as false positive in the Code Quality dashboard.
  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (scanner.isBlocked()) return; // Already blocked, drop remaining chunks

      const bytes = concat(tail, chunk);
      const end = bytes.lastIndexOf(NEWLINE) + 1;
      tail = bytes.slice(end);
      if (end > 0) pass(bytes.subarray(0, end), controller);
    },
    flush(controller) {
      if (scanner.isBlocked()) return;
      if (tail.length > 0) {
        const last = tail;
        tail = new Uint8Array(0);
        if (!pass(last, controller)) return;
      }
      // A stream that ends without [DONE] settles here.
      if (!scanner.finish()) {
        fallback(controller);
        return;
      }
      release(controller);
    },
  }));
}

function concat(head: Uint8Array, chunk: Uint8Array): Uint8Array {
  if (head.length === 0) return chunk;
  const joined = new Uint8Array(head.length + chunk.length);
  joined.set(head, 0);
  joined.set(chunk, head.length);
  return joined;
}

/**
 * Extract text content from SSE data lines, and whether the stream's [DONE] is among them.
 * SSE format: data: {"choices":[{"delta":{"content":"text"}}]}\n
 * A line may end in CRLF, and the space after the field name is optional.
 */
function extractContentFromSSE(sseText: string): { content: string; done: boolean } {
  let content = '';
  let done = false;
  for (const raw of sseText.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') { done = true; continue; }
    try {
      const json = JSON.parse(payload);
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        content += delta;
      }
    } catch {
      // Not a JSON frame (a comment or a provider quirk), nothing to scan
    }
  }
  return { content, done };
}
