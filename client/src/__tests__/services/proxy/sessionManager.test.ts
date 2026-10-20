// The session count rides on a page-memory flag: the first token request of a
// page load says first, every later one (refresh, retry) says not first, and
// nothing about the count is written to storage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
const turnstile = vi.hoisted(() => ({
  token: async (): Promise<string> => 'turnstile-token',
  awaited: 0,
}));

vi.mock('../../../services/proxy/turnstile', () => ({
  getTurnstileToken: vi.fn(() => turnstile.token()),
  markTurnstileAwaited: vi.fn(() => { turnstile.awaited += 1; }),
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
    fetchMock.mockImplementation(async () => okResponse(30_000));
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
      .mockImplementation(async () => okResponse(30_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await expect(getSessionToken()).rejects.toThrow();
    await getSessionToken();
    expect(sentBodies().map(b => b.first)).toEqual([true, true]);
  });

  it('writes nothing for the count, only the quota ID', async () => {
    fetchMock.mockImplementation(async () => okResponse(30_000));
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
    fetchMock.mockImplementation(async () => okResponse(30_000));
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
    fetchMock.mockImplementation(async () => okResponse(30_000));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    expect(sentBodies()[0].clientId).toBeUndefined();
    expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-28' });
  });

  it('removes an ID from an earlier day when the app loads, with no session asked', async () => {
    localStorage.setItem('agora_client_id', JSON.stringify({ id: OTHER_ID, day: '2026-09-27' }));
    await import('../../../services/proxy/sessionManager');
    expect(stored()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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
      token: 'jwt', expiresAt: new Date(Date.now() + 30_000).toISOString(), clientId: OTHER_ID,
    }), { status: 200 }));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    expect(sentBodies()[0].clientId).toBe(OTHER_ID);
    expect(JSON.parse(stored()!)).toEqual({ id: OTHER_ID, day: '2026-09-28' });
    vi.setSystemTime(new Date('2026-09-29T00:01:00Z'));
    fetchMock.mockImplementation(async () => okResponse(30_000));
    await getSessionToken();
    expect(sentBodies()[1].clientId).toBeUndefined();
    expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-29' });
  });

  it('ignores an unreadable value and a malformed ID', async () => {
    for (const value of ['not json', JSON.stringify({ id: 'x', day: '2026-09-28' })]) {
      vi.resetModules();
      fetchMock.mockReset();
      localStorage.setItem('agora_client_id', value);
      fetchMock.mockImplementation(async () => okResponse(30_000));
      const { getSessionToken } = await import('../../../services/proxy/sessionManager');
      await getSessionToken();
      expect(sentBodies()[0].clientId).toBeUndefined();
      expect(JSON.parse(stored()!)).toEqual({ id: CLIENT_ID, day: '2026-09-28' });
    }
  });
});

/** A JWT-shaped token whose payload says it lives `lifetimeS` seconds. */
function jwtWithLife(lifetimeS: number): string {
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const iat = Math.floor(Date.now() / 1000);
  return `${enc({ alg: 'HS256' })}.${enc({ sub: 'x', iat, exp: iat + lifetimeS })}.sig`;
}

function jwtResponse(lifetimeS: number, expiresAt = new Date(Date.now() + lifetimeS * 1000)): Response {
  return new Response(JSON.stringify({
    token: jwtWithLife(lifetimeS), expiresAt: expiresAt.toISOString(), clientId: CLIENT_ID,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('session reuse', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    localStorage.clear();
    turnstile.token = async () => 'turnstile-token';
    turnstile.awaited = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('uses the token until its last minute, not only its first half', async () => {
    fetchMock.mockImplementation(async () => jwtResponse(600));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    vi.setSystemTime(new Date('2026-10-20T12:08:30Z'));
    await getSessionToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-20T12:09:30Z'));
    await getSessionToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads the life from the token, so a wrong device clock cannot cut it short', async () => {
    // The worker's clock is an hour ahead of this device's: its expiresAt
    // would read as fifty minutes too long or, the other way, long expired.
    fetchMock.mockImplementation(async () => jwtResponse(600, new Date(Date.now() - 50 * 60_000)));
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    vi.setSystemTime(new Date('2026-10-20T12:05:00Z'));
    await getSessionToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('prepareSession', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    localStorage.clear();
    turnstile.token = async () => 'turnstile-token';
    turnstile.awaited = 0;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('runs the check a send would need, and the send then reuses it', async () => {
    fetchMock.mockImplementation(async () => jwtResponse(600));
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    prepareSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await getSessionToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds no check while a token covers the next two minutes', async () => {
    fetchMock.mockImplementation(async () => jwtResponse(600));
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    vi.setSystemTime(new Date('2026-10-20T12:07:30Z'));
    prepareSession();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-mints early when the token would lapse before a typed message goes out', async () => {
    fetchMock.mockImplementation(async () => jwtResponse(600));
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    await getSessionToken();
    vi.setSystemTime(new Date('2026-10-20T12:08:30Z'));
    prepareSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('joins a check already running instead of starting a second', async () => {
    let release: (t: string) => void = () => {};
    turnstile.token = () => new Promise<string>((r) => { release = r; });
    fetchMock.mockImplementation(async () => jwtResponse(600));
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    const quota = getSessionToken({ background: true });
    prepareSession();
    prepareSession();
    release('turnstile-token');
    await quota;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed early check and lets the send ask again', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('{"error":"x"}', { status: 403 }))
      .mockImplementation(async () => jwtResponse(600));
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    prepareSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    await getSessionToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('waiting notice', () => {
  let release: (t: string) => void = () => {};
  const events: string[] = [];
  const onStart = () => events.push('start');
  const onEnd = () => events.push('end');

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => jwtResponse(600));
    localStorage.clear();
    events.length = 0;
    turnstile.awaited = 0;
    turnstile.token = () => new Promise<string>((r) => { release = r; });
    window.addEventListener('agc:session-wait-start', onStart);
    window.addEventListener('agc:session-wait-end', onEnd);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    window.removeEventListener('agc:session-wait-start', onStart);
    window.removeEventListener('agc:session-wait-end', onEnd);
    vi.useRealTimers();
  });

  it('shows after two and a half seconds of a send waiting, and goes when it ends', async () => {
    const { getSessionToken, isSessionWaitVisible } = await import('../../../services/proxy/sessionManager');
    const send = getSessionToken();
    vi.advanceTimersByTime(2_400);
    expect(isSessionWaitVisible()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(isSessionWaitVisible()).toBe(true);
    expect(events).toEqual(['start']);
    release('turnstile-token');
    await send;
    await Promise.resolve();
    expect(isSessionWaitVisible()).toBe(false);
    expect(events).toEqual(['start', 'end']);
  });

  it('never shows for a quick check', async () => {
    const { getSessionToken } = await import('../../../services/proxy/sessionManager');
    const send = getSessionToken();
    vi.advanceTimersByTime(1_000);
    release('turnstile-token');
    await send;
    vi.advanceTimersByTime(5_000);
    expect(events).toEqual([]);
  });

  it('stays silent for a check nobody waits on', async () => {
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    const quota = getSessionToken({ background: true });
    prepareSession();
    vi.advanceTimersByTime(10_000);
    expect(events).toEqual([]);
    expect(turnstile.awaited).toBe(0);
    release('turnstile-token');
    await quota;
  });

  it('shows for a send that joins a check started ahead of it, and marks that check as waited on', async () => {
    const { getSessionToken, prepareSession } = await import('../../../services/proxy/sessionManager');
    prepareSession();
    vi.advanceTimersByTime(10_000);
    const send = getSessionToken();
    expect(turnstile.awaited).toBe(1);
    vi.advanceTimersByTime(2_500);
    expect(events).toEqual(['start']);
    release('turnstile-token');
    await send;
    await Promise.resolve();
    expect(events).toEqual(['start', 'end']);
  });
});

