// The signup count goes out with every accepted welcome, without reading the
// browser's history to decide whether the visitor is new.

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
  preferencesIndexedDbAdapter: { setUserProfile: vi.fn(() => Promise.resolve()) },
}));

import WelcomeDisclosureModal from '../../components/WelcomeDisclosureModal';

describe('WelcomeDisclosureModal signup count', () => {
  beforeEach(() => {
    Object.values(beacons).forEach((fn) => fn.mockClear());
    localStorage.clear();
  });

  it('sends the signup count even when history is stored, and lists no keys', () => {
    localStorage.setItem('history_aurelius_1', '[]');
    localStorage.setItem('selectedFigure', 'aurelius');
    const key = vi.mocked(localStorage.key);
    key.mockClear();
    const { container } = render(
      <WelcomeDisclosureModal isOpen onComplete={() => {}} onSkip={() => {}} />
    );
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(beacons.sendEntryBeacon).toHaveBeenCalledTimes(1);
    expect(beacons.sendSignupBeacon).toHaveBeenCalledTimes(1);
    expect(key).not.toHaveBeenCalled();
    expect(vi.mocked(localStorage.getItem).mock.calls.map((c) => c[0])).not.toContain('selectedFigure');
  });
});
