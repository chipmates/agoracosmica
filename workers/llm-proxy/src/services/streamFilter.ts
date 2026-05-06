/**
 * SSE stream filter that scans LLM output for §4 JMStV absolute violations.
 *
 * Wraps the Nebius SSE response body in a TransformStream. Each SSE chunk
 * is parsed to extract text deltas, which are fed to the StreamSafetyScanner.
 * If a critical pattern is detected, the stream is aborted and a fallback
 * message is sent to the client.
 */

import { StreamSafetyScanner } from '../utils/streamSafety';

const FALLBACK_SSE = 'data: {"choices":[{"delta":{"content":"[This response could not be displayed. Please try a different question.]"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';

/**
 * Create a filtered ReadableStream that scans SSE chunks for safety violations.
 * If a violation is detected mid-stream, the remaining stream is replaced
 * with a fallback message.
 */
export function createSafetyFilteredStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const scanner = new StreamSafetyScanner();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (scanner.isBlocked()) return; // Already blocked, drop remaining chunks

      const text = decoder.decode(chunk, { stream: true });

      // Extract content deltas from SSE data lines for scanning
      const contentText = extractContentFromSSE(text);

      if (contentText && !scanner.check(contentText)) {
        // Critical violation detected — send fallback and terminate
        console.warn('[StreamSafety] Output blocked: critical pattern detected in LLM response');
        controller.enqueue(encoder.encode(FALLBACK_SSE));
        controller.terminate();
        return;
      }

      // Safe — pass through unchanged
      controller.enqueue(chunk);
    },
  }));
}

/**
 * Extract text content from SSE data lines.
 * SSE format: data: {"choices":[{"delta":{"content":"text"}}]}\n
 */
function extractContentFromSSE(sseText: string): string {
  let content = '';
  const lines = sseText.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    try {
      const json = JSON.parse(line.slice(6));
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        content += delta;
      }
    } catch {
      // Not valid JSON, skip (could be partial chunk)
    }
  }
  return content;
}
