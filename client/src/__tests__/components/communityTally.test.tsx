// The community tally counts a browser only after its own "Count me in":
// opening the Community modal reads the public totals and creates nothing, and
// an ID stored before the button existed is removed at boot without being read.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('../../services/history/historyExportService', () => ({
  exportHistory: vi.fn(),
  importHistory: vi.fn(),
}));

import CommunityGovernanceModal from '../../components/CommunityGovernance/CommunityGovernanceModal';
import { dropPreActId } from '../../services/communityVote';

const KNOWN_ID = 'abcdef12-3456-4789-8abc-def012345678';

const answer = async (_url: RequestInfo | URL, _init?: RequestInit) =>
  new Response(JSON.stringify({ joinedCount: 12, totalPower: 30 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const fetchMock = vi.fn(answer);

function calls() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method ?? 'GET',
    body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
  }));
}

const joinButton = () => screen.queryByRole('button', { name: /count me in/i });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(answer);
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('the community tally', () => {
  it('opening reads only the public totals and creates no ID', async () => {
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()[0].url).toMatch(/\/v1\/community\/snapshot$/);
    expect(calls()[0].method).toBe('GET');
    expect(calls()[0].body).toBeNull();
    expect(localStorage.getItem('community_tally_id')).toBeNull();
    await waitFor(() => expect(joinButton()).not.toBeNull());
  });

  it('"Count me in" creates the ID and sends it with the power, once pressed', async () => {
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(joinButton()).not.toBeNull());
    fireEvent.click(joinButton()!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const post = calls()[1];
    expect(post.url).toMatch(/\/v1\/community\/power$/);
    expect(post.method).toBe('POST');
    const stored = localStorage.getItem('community_tally_id');
    expect(stored).toBeTruthy();
    expect(post.body?.deviceId).toBe(stored);
    await waitFor(() => expect(joinButton()).toBeNull());
  });

  it('a browser that already counted itself updates on open, as before', async () => {
    localStorage.setItem('community_tally_id', KNOWN_ID);
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()[0].url).toMatch(/\/v1\/community\/power$/);
    expect(calls()[0].body?.deviceId).toBe(KNOWN_ID);
    expect(joinButton()).toBeNull();
  });

  it('an ID from before the button is removed unread at boot and never sent', async () => {
    localStorage.setItem('community_device_uuid', KNOWN_ID);
    const getItem = vi.mocked(localStorage.getItem);
    getItem.mockClear();
    dropPreActId(); // what the app's entry module runs at load
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const looked = getItem.mock.calls.map((c) => c[0]);
    expect(looked).not.toContain('community_device_uuid');
    expect(localStorage.getItem('community_device_uuid')).toBeNull();
    expect(calls()[0].url).toMatch(/\/v1\/community\/snapshot$/);
    expect(calls()[0].method).toBe('GET');
    expect(JSON.stringify(calls())).not.toContain(KNOWN_ID);
    await waitFor(() => expect(joinButton()).not.toBeNull());
  });

  it('shows no card and no button when the totals cannot be read, with a neutral notice', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 503 }));
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[aria-labelledby="community-tally-card-title"]')).toBeNull();
    expect(joinButton()).toBeNull();
    expect(screen.getByText('Voting opens in the near future.')).toBeTruthy();
    expect(screen.queryByText(/count yourself in/i)).toBeNull();
  });

  it('a press the server never answers keeps nothing and does not count', async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? new Response('', { status: 503 })
        : new Response(JSON.stringify({ joinedCount: 12, totalPower: 30 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
    );
    render(<CommunityGovernanceModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(joinButton()).not.toBeNull());
    fireEvent.click(joinButton()!);
    await waitFor(() => expect(screen.getByText(/couldn't add you to the tally/i)).toBeTruthy());
    expect(calls()[1].method).toBe('POST');
    expect(localStorage.getItem('community_tally_id')).toBeNull();
    expect(screen.queryByText(/you're counted/i)).toBeNull();
    expect(joinButton()).not.toBeNull();
  });

  it('the app entry runs the removal at load, next to the click-ID capture', () => {
    const entry = readFileSync(resolve(__dirname, '../../index.tsx'), 'utf8');
    expect(entry).toMatch(/^dropPreActId\(\);$/m);
  });
});
