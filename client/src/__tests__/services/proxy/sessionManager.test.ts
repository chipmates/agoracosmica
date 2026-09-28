// The session count rides on a page-memory flag: the first token request of a
// page load says first, every later one (refresh, retry) says not first, and
// nothing about the count is written to storage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('quota ID renewed every UTC day', () => {
  const OTHER_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
  const stored = () => localStorage.getItem('agora_client_id');

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('stores the ID with the UTC day and sends it again the same day', async () => {
    fetchMock.mockImplementation(async () => okResponse(60_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-28' });
    vi.setSystemTime(new Date('2026-09-28T23:59:00Z'));
    await getSessionToken();
    expect(sentBodies()[0].clientId).toBeUndefined();
    expect(sentBodies()[1].clientId).toBe(CLIENT_ID);
  });

  it('drops the ID on a new UTC day and keeps the one the server issues', async () => {
    localStorage.setItem('agora_client_id', JSON.stringify({ id: OTHER_ID, day: '2026-09-27' }));
    fetchMock.mockImplementation(async () => okResponse(60_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    expect(sentBodies()[0].clientId).toBeUndefined();
    expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-28' });
  });

  it('removes a stale ID even when the request fails', async () => {
    localStorage.setItem('agora_client_id', JSON.stringify({ id: OTHER_ID, day: '2026-09-20' }));
    fetchMock.mockImplementation(async () => new Response('{"error":"x"}', { status: 403 }));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await expect(getSessionToken()).rejects.toThrow();
    expect(stored()).toBeNull();
  });

  it('keeps a bare ID from an older build for today, then renews it', async () => {
    localStorage.setItem('agora_client_id', OTHER_ID);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      token: 'jwt', expiresAt: new Date(Date.now() + 60_000).toISOString(), clientId: OTHER_ID,
    }), { status: 200 }));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    expect(sentBodies()[0].clientId).toBe(OTHER_ID);
    expect(JSON.parse(stored()!)).toEqual({ id: OTHER_ID, day: '2026-09-28' });
    vi.setSystemTime(new Date('2026-09-29T00:01:00Z'));
    fetchMock.mockImplementation(async () => okResponse(60_000));
    await getSessionToken();
    expect(sentBodies()[1].clientId).toBeUndefined();
    expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-29' });
  });

  it('ignores an unreadable value and a malformed ID', async () => {
    for (const value of ['not json', JSON.stringify({ id: 'x', day: '2026-09-28' })]) {
      vi.resetModules();
      fetchMock.mockReset();
      localStorage.setItem('agora_client_id', value);
      fetchMock.mockImplementation(async () => okResponse(60_000));
      const { getSessionToken } = await import('../../../services/proxy/sessionManager');
      await getSessionToken();
      expect(sentBodies()[0].clientId).toBeUndefined();
      expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-28' });
    }
  });
});
