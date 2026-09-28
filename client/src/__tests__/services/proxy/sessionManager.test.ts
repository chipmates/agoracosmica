// The session count rides on a page-memory flag: the first token request of a
// page load says first, every later one (refresh, retry) says not first, and
// nothing about the count is written to storage.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();

vi.mock('../../../services/proxy/turnstile', () => ({
  getTurnstileToken: vi.fn(async () => 'turnstile-token'),
}));
vi.mock('../../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchMock(...args),
}));

const CLIENT_ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';

function okResponse(expiresInMs: number): Response {
  return new Response(JSON.stringify({
    token: 'jwt',
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    clientId: CLIENT_ID,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function sentBodies(): Record<string, unknown>[] {
  return fetchMock.mock.calls.map(call => JSON.parse(String((call[1] as RequestInit).body)));
}

describe('session count flag', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('marks only the first token request of the page as first', async () => {
    // Tokens that are already inside the refresh window, so every call asks again.
    fetchMock.mockImplementation(async () => okResponse(60_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    await getSessionToken();
    await getSessionToken();
    const bodies = sentBodies();
    expect(bodies.map(b => b.first)).toEqual([true, false, false]);
    expect(bodies[1].clientId).toBe(CLIENT_ID);
  });

  it('keeps first on a retry after a failed request', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('{"error":"x"}', { status: 403 }))
      .mockImplementation(async () => okResponse(60_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await expect(getSessionToken()).rejects.toThrow();
    await getSessionToken();
    expect(sentBodies().map(b => b.first)).toEqual([true, true]);
  });

  it('writes nothing for the count, only the quota ID', async () => {
    fetchMock.mockImplementation(async () => okResponse(60_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys).toEqual(['agora_client_id']);
    expect(sessionStorage.length).toBe(0);
  });
});
