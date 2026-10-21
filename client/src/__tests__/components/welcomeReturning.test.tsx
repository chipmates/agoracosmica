// A browser that accepted earlier terms keeps its profile and is reported as
// returning, so the app can take it back where it was.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';

const profile = vi.hoisted(() => ({
  exists: false,
  hasUserProfile: vi.fn(),
  setUserProfile: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../storage/preferencesIndexedDbAdapter', () => ({
  preferencesIndexedDbAdapter: {
    hasUserProfile: profile.hasUserProfile,
    setUserProfile: profile.setUserProfile,
  },
}));
vi.mock('../../utils/entryBeacon', () => ({ sendEntryBeacon: vi.fn() }));
vi.mock('../../utils/signupBeacon', () => ({ sendSignupBeacon: vi.fn() }));
vi.mock('../../utils/funnelBeacon', () => ({ sendFunnelBeaconOnce: vi.fn(), sendFunnelBeacon: vi.fn() }));
vi.mock('../../utils/public/gclidCapture', () => ({ sendConversion: vi.fn() }));

import WelcomeDisclosureModal from '../../components/WelcomeDisclosureModal';

const acceptAndClose = (onComplete = vi.fn()) => {
  const { container } = render(
    <WelcomeDisclosureModal isOpen onComplete={onComplete} onSkip={() => {}} />
  );
  const buttons = container.querySelectorAll('button');
  fireEvent.click(buttons[buttons.length - 1]);
  return onComplete;
};

describe('WelcomeDisclosureModal for a returning browser', () => {
  beforeEach(() => {
    localStorage.clear();
    profile.hasUserProfile.mockReset();
    profile.hasUserProfile.mockImplementation(() => Promise.resolve(profile.exists));
    profile.setUserProfile.mockClear();
    profile.exists = false;
  });

  it('keeps a stored profile as it is', async () => {
    profile.exists = true;
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    acceptAndClose();
    await waitFor(() => expect(profile.hasUserProfile).toHaveBeenCalled());
    await Promise.resolve();
    expect(profile.setUserProfile).not.toHaveBeenCalled();
  });

  it('writes the default profile when none exists', async () => {
    acceptAndClose();
    await waitFor(() => expect(profile.setUserProfile).toHaveBeenCalledTimes(1));
    expect(profile.setUserProfile).toHaveBeenCalledWith(expect.objectContaining({ avatar: null }));
  });

  // The exit animation does not run here; the modal's safety timeout closes it.
  it('reports a browser with an earlier record as returning', () => {
    vi.useFakeTimers();
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const onComplete = acceptAndClose();
    act(() => { vi.advanceTimersByTime(1600); });
    vi.useRealTimers();
    expect(onComplete).toHaveBeenCalledWith({ returning: true });
  });

  it('reports a first acceptance as not returning', () => {
    vi.useFakeTimers();
    const onComplete = acceptAndClose();
    act(() => { vi.advanceTimersByTime(1600); });
    vi.useRealTimers();
    expect(onComplete).toHaveBeenCalledWith({ returning: false });
  });
});
