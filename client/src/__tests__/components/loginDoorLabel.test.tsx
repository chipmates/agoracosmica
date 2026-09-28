// The intro film's two counts carry the door label from the boot-time
// reading: door when the landing link named a figure, question, council or
// chapter, plain otherwise. Nothing else changes on those rows.

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';

const funnel = vi.hoisted(() => ({
  sendFunnelBeaconOnce: vi.fn(),
  sendFunnelBeacon: vi.fn(),
  cinematicDwellBucket: vi.fn(() => 1),
}));
vi.mock('../../utils/funnelBeacon', () => funnel);
vi.mock('../../components/CosmicBackground', () => ({ default: () => null }));
vi.mock('../../components/CinematicCards', () => ({ default: () => null }));
vi.mock('../../components/MessagePopup', () => ({ default: () => null }));
vi.mock('../../components/LandscapeWarning', () => ({ default: () => null }));

async function mountAt(url: string) {
  window.history.replaceState({}, '', url);
  vi.resetModules();
  funnel.sendFunnelBeaconOnce.mockClear();
  const intent = await import('../../utils/public/entryIntent');
  intent.captureEntryIntentFromUrl();
  const { default: LoginPage } = await import('../../pages/LoginPage');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<LoginPage onComplete={() => {}} />);
  });
  return view;
}

beforeAll(() => {
  // jsdom has no media playback; the film's music only needs a settled promise.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} });
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('LoginPage door label', () => {
  it('sends door on a figure door, on start and on skip', async () => {
    await mountAt('/app?figure=marcus-aurelius&lang=en');
    const start = funnel.sendFunnelBeaconOnce.mock.calls.find((c) => c[0] === 'cinematic_start');
    expect(start?.[1]).toEqual({ mode: 'door' });
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    const end = funnel.sendFunnelBeaconOnce.mock.calls.find((c) => c[0] === 'cinematic_end');
    expect(end?.[1]).toMatchObject({ mode: 'door', outcome: 'skipped', bucket: 1 });
  });

  it('sends plain on a plain arrival', async () => {
    await mountAt('/app?lang=de');
    const start = funnel.sendFunnelBeaconOnce.mock.calls.find((c) => c[0] === 'cinematic_start');
    expect(start?.[1]).toEqual({ mode: 'plain' });
  });
});
