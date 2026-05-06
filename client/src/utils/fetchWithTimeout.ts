// Timeout-aware fetch wrapper
// Adds AbortController-based timeout to any fetch call

/**
 * Fetch with automatic timeout via AbortController.
 * Composes with an existing signal — if the caller already has an AbortController
 * (e.g. for component unmount), both signals are respected.
 *
 * @param url - Request URL
 * @param options - Standard RequestInit + timeoutMs
 * @returns Response (throws on timeout or network error)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15_000, signal: externalSignal, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // If caller provided a signal, abort our controller when theirs fires
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      // Distinguish caller abort from our timeout
      if (externalSignal?.aborted) {
        throw error; // Caller cancelled — rethrow as-is
      }
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
