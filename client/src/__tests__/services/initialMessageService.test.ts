// A host with an SPA fallback (the Vite dev server, a static host) answers a
// missing greeting file with the app shell and status 200. Rendered as the
// greeting, that page put the English splash into a German chat.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock('../../services/audio/voices/voiceResolver', () => ({
  getEnglishEngine: () => undefined,
}));

import { initialMessageService } from '../../services/audio/initialMessageService';

const appShell = `<!DOCTYPE html>
<html lang="en">
<head><title>Agora Cosmica</title></head>
<body><div id="root"><p class="agc-splash__tag">A Living Library You Can Talk To</p></div></body>
</html>`;

const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

describe('initialMessageService.getInitialMessage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns the greeting text when the file exists', async () => {
    fetchMock.mockResolvedValue(reply('Die Tinte gefriert jeden Morgen in meinem Zelt.'));
    const msg = await initialMessageService.getInitialMessage('aurelius', 'freetalk', null, 'de');
    expect(msg?.text).toBe('Die Tinte gefriert jeden Morgen in meinem Zelt.');
    expect(msg?.audioUrl).toMatch(/initial-messages\/aurelius\/de\/freetalk\/greeting\.webm/);
  });

  it('keeps the audio when only the text is missing (404)', async () => {
    fetchMock.mockResolvedValue(reply('File not found', 404));
    const msg = await initialMessageService.getInitialMessage('aurelius', 'freetalk', null, 'de');
    expect(msg).not.toBeNull();
    expect(msg?.text).toBeNull();
  });

  it('treats the app shell from an SPA fallback as no greeting at all', async () => {
    fetchMock.mockResolvedValue(reply(appShell));
    const msg = await initialMessageService.getInitialMessage('aurelius', 'freetalk', null, 'de');
    expect(msg).toBeNull();
  });

  it('spots the shell with leading whitespace and lower-case doctype', async () => {
    fetchMock.mockResolvedValue(reply(`\n  <!doctype html><html><body></body></html>`));
    const msg = await initialMessageService.getInitialMessage('plato', 'wisdom', 3, 'en');
    expect(msg).toBeNull();
  });

  it('keeps a greeting that merely mentions html', async () => {
    fetchMock.mockResolvedValue(reply('I wrote no <html>, only dialogues.'));
    const msg = await initialMessageService.getInitialMessage('plato', 'wisdom', 3, 'en');
    expect(msg?.text).toBe('I wrote no <html>, only dialogues.');
  });
});
