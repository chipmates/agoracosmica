import { describe, expect, it, vi } from 'vitest';

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  it('handles a signal already aborted before fetch', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.signal?.aborted) {
        return Promise.reject(new Error('fetch started with a live signal'));
      }

      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort();

    await expect(fetchWithTimeout('/test', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
