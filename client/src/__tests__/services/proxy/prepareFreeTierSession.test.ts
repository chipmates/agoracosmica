// The bot check that runs ahead of a send (a figure picked, the message box
// focused, a recording started) is for the free tier only. After a yes to the
// free tier in one conversation the page counts as free tier, but a stored own
// key keeps the check from running anywhere else: the yes covers only what it
// was asked for.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  isFreeTier: false,
  keyStored: false,
  prepared: 0,
}));

vi.mock('../../../stores/domainStore', () => ({
  useDomainStore: { getState: () => ({ quota: { isFreeTier: h.isFreeTier } }) },
}));
vi.mock('../../../services/storage/keyStorageService', () => ({
  keyStorage: { hasKey: vi.fn(async () => h.keyStored) },
}));
vi.mock('../../../services/proxy/sessionManager', () => ({
  prepareSession: vi.fn(() => { h.prepared += 1; }),
}));

import { prepareFreeTierSession } from '../../../services/proxy/prepareFreeTierSession';
import { keyStorage } from '../../../services/storage/keyStorageService';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the bot check ahead of a send', () => {
  beforeEach(() => {
    h.prepared = 0;
    vi.mocked(keyStorage.hasKey).mockClear();
  });

  it('runs for a visitor on the free tier without a key', async () => {
    h.isFreeTier = true;
    h.keyStored = false;
    prepareFreeTierSession();
    await settle();
    expect(h.prepared).toBe(1);
  });

  it('does not run while a key is stored, even after a yes made the page free tier', async () => {
    h.isFreeTier = true;
    h.keyStored = true;
    prepareFreeTierSession();
    await settle();
    expect(h.prepared).toBe(0);
  });

  it('does not run for a visitor with a working key, and reads nothing', async () => {
    h.isFreeTier = false;
    h.keyStored = true;
    prepareFreeTierSession();
    await settle();
    expect(h.prepared).toBe(0);
    expect(keyStorage.hasKey).not.toHaveBeenCalled();
  });

  it('does not run when the key storage cannot be read', async () => {
    h.isFreeTier = true;
    vi.mocked(keyStorage.hasKey).mockRejectedValueOnce(new Error('blocked'));
    prepareFreeTierSession();
    await settle();
    expect(h.prepared).toBe(0);
  });
});
