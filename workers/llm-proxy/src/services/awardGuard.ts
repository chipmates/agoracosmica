// Quest guard: a verdict that is only a tool call is a silent failure.
//
// The award_seed call IS the structural ending of a quest, so a turn that fires
// it with no spoken text leaves the seeker with a pass or a fail and no words.
// This holds the tool-call frames back until the turn ends. If nothing was
// spoken, they are dropped and the turn is generated once more: the client has
// received nothing at that point, so the retry is invisible.

const encoder = new TextEncoder();

/** The one directive the retry adds, so the second attempt speaks first. */
export const AWARD_RETRY_DIRECTIVE =
  'Your last attempt called award_seed without speaking. Deliver the spoken verdict in your own voice first, then call award_seed.';

export function createAwardGuardedStream(
  source: ReadableStream<Uint8Array>,
  regenerate: () => Promise<ReadableStream<Uint8Array> | null>,
  onGuardFired?: () => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const first = await pump(source, controller, true);
        if (!first.silentAward) {
          controller.close();
          return;
        }

        const retry = await regenerate();
        if (!retry) {
          // Nothing better to serve: emit the turn the model produced.
          for (const line of first.held) controller.enqueue(encoder.encode(line));
          controller.close();
          return;
        }

        onGuardFired?.();
        await pump(retry, controller, false);
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

interface PumpResult {
  /** True when the turn was a tool call with no spoken text. */
  silentAward: boolean;
  /** Frames withheld from the client, in arrival order. */
  held: string[];
}

/**
 * Forward the stream line by line. Once a tool call appears, everything after
 * it is withheld until the turn ends, so an empty turn can still be replaced.
 */
async function pump(
  source: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  guarded: boolean,
): Promise<PumpResult> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  const held: string[] = [];
  let buffer = '';
  let spokenChars = 0;
  let sawToolCall = false;

  const handle = (line: string): void => {
    if (guarded && !sawToolCall) {
      const frame = readFrame(line);
      spokenChars += frame.spokenChars;
      sawToolCall = frame.toolCall;
    }
    if (guarded && sawToolCall) held.push(line);
    else controller.enqueue(encoder.encode(line));
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) handle(line + '\n');
  }
  buffer += decoder.decode();
  if (buffer) handle(buffer);

  if (guarded && sawToolCall && spokenChars === 0) {
    return { silentAward: true, held };
  }
  for (const line of held) controller.enqueue(encoder.encode(line));
  return { silentAward: false, held: [] };
}

/** What one SSE line contributes: spoken characters, and whether it awards. */
function readFrame(line: string): { spokenChars: number; toolCall: boolean } {
  if (!line.startsWith('data: ') || line.startsWith('data: [DONE]')) {
    return { spokenChars: 0, toolCall: false };
  }
  try {
    const delta = (JSON.parse(line.slice(6)) as {
      choices?: Array<{ delta?: { content?: unknown; tool_calls?: unknown[] } }>;
    }).choices?.[0]?.delta;
    const content = typeof delta?.content === 'string' ? delta.content.trim().length : 0;
    return { spokenChars: content, toolCall: Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0 };
  } catch {
    return { spokenChars: 0, toolCall: false };
  }
}
