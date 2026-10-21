// The entry count, the signup count and profile_created go out with every
// accepted welcome. Nothing stored in the browser decides whether they are
// sent, so a browser accepting a new terms version counts again.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const beacons = vi.hoisted(() => ({
  sendEntryBeacon: vi.fn(),
  sendSignupBeacon: vi.fn(),
  sendFunnelBeaconOnce: vi.fn(),
  sendConversion: vi.fn(),
}));
vi.mock('../../utils/entryBeacon', () => ({ sendEntryBeacon: beacons.sendEntryBeacon }));
vi.mock('../../utils/signupBeacon', () => ({ sendSignupBeacon: beacons.sendSignupBeacon }));
vi.mock('../../utils/funnelBeacon', () => ({
  sendFunnelBeaconOnce: beacons.sendFunnelBeaconOnce,
  sendFunnelBeacon: vi.fn(),
}));
vi.mock('../../utils/public/gclidCapture', () => ({ sendConversion: beacons.sendConversion }));
vi.mock('../../storage/preferencesIndexedDbAdapter', () => ({
  preferencesIndexedDbAdapter: {
    hasUserProfile: vi.fn(() => Promise.resolve(false)),
    setUserProfile: vi.fn(() => Promise.resolve()),
  },
}));

import WelcomeDisclosureModal from '../../components/WelcomeDisclosureModal';
import { CURRENT_AGB_VERSION } from '../../utils/userState';

const accept = () => {
  const { container } = render(
    <WelcomeDisclosureModal isOpen onComplete={() => {}} onSkip={() => {}} />
  );
  const buttons = container.querySelectorAll('button');
  fireEvent.click(buttons[buttons.length - 1]);
};

describe('WelcomeDisclosureModal counts', () => {
  beforeEach(() => {
    Object.values(beacons).forEach((fn) => fn.mockClear());
    localStorage.clear();
  });

  it('counts a first acceptance even when history is stored, and lists no keys', () => {
    localStorage.setItem('history_aurelius_1', '[]');
    localStorage.setItem('selectedFigure', 'aurelius');
    const key = vi.mocked(localStorage.key);
    key.mockClear();
    accept();
    expect(beacons.sendEntryBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendSignupBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendConversion).toHaveBeenCalledWith('profile_created');
    expect(key).not.toHaveBeenCalled();
    expect(vi.mocked(localStorage.getItem).mock.calls.map((c) => c[0])).not.toContain('selectedFigure');
  });

  it('counts a browser that accepted an earlier version again', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    accept();
    expect(beacons.sendEntryBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendSignupBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendConversion).toHaveBeenCalledWith('profile_created');
    expect(JSON.parse(localStorage.getItem('agb_consent') as string).version).toBe(CURRENT_AGB_VERSION);
  });

  it('counts a welcome shown again over a current record', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: CURRENT_AGB_VERSION, timestamp: 1 }));
    accept();
    expect(beacons.sendEntryBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendSignupBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendConversion).toHaveBeenCalledWith('profile_created');
  });
});
