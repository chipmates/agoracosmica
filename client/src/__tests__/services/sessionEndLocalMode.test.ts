// "Read text instead" tells the hosted voice servers that a session ended, so
// they can free its slot. With Local Mode voice on there is no hosted session,
// and no request may reach the hosted audio host at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';
import { sendSessionEndBeacon } from '../../services/audio/tts/ttsSessions';

const local = (ttsEnabled: boolean) =>
  saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: true, ttsEnabled, sttEnabled: true } });

describe('the session-end beacon', () => {
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    beacon.mockClear();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true });
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('sends nothing with Local Mode voice on', () => {
    local(true);
    sendSessionEndBeacon('c62ef610-0000-4000-8000-000000000000');
    expect(beacon).not.toHaveBeenCalled();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('sends nothing with Local Mode voice on and no beacon support', () => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
    local(true);
    sendSessionEndBeacon('c62ef610-0000-4000-8000-000000000000');
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it('still tells the hosted servers when the voice is hosted', () => {
    local(false);
    sendSessionEndBeacon('c62ef610-0000-4000-8000-000000000000');
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(String((beacon.mock.calls[0] as unknown[])[0])).toMatch(/\/v1\/audio\/session\/end$/);
  });
});
