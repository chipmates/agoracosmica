// The figure list asks for every figure's translation on each render, long
// before the first answer arrives. Each file is fetched once per page load:
// asks while it is on its way share the one request, and the answer (or the
// failure) is kept.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Pending = { url: string; resolve: (r: Response) => void; reject: (e: unknown) => void };

let pending: Pending[] = [];
const fetchMock = vi.fn((url: string) => new Promise<Response>((resolve, reject) => {
  pending.push({ url, resolve, reject });
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

/** A fresh module per test: the cache lives for one page load. */
const freshModule = async () => {
  vi.resetModules();
  return import('../../utils/figureTranslations');
};

describe('figure translations: one fetch per file per load', () => {
  beforeEach(() => {
    pending = [];
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares one request among the asks made while it is on its way', async () => {
    const { getFigureTranslation, loadFigureTranslation } = await freshModule();

    for (let i = 0; i < 12; i += 1) getFigureTranslation('Echo of Marcus Aurelius', 'de');
    const loads = [loadFigureTranslation('Echo of Marcus Aurelius', 'de'), loadFigureTranslation('Echo of Marcus Aurelius', 'de')];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('figure-translations/de/aurelius.json');

    pending[0].resolve(json({ name: 'Echo von Mark Aurel', about: 'Kaiser' }));
    const results = await Promise.all(loads);
    expect(results.map((r) => r.name)).toEqual(['Echo von Mark Aurel', 'Echo von Mark Aurel']);

    // Answered: the sync getter has it, and nothing is fetched again.
    expect(getFigureTranslation('Echo of Marcus Aurelius', 'de').name).toBe('Echo von Mark Aurel');
    await loadFigureTranslation('Echo of Marcus Aurelius', 'de');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches each of thirty figures once, however often the list renders', async () => {
    const { getFigureTranslation } = await freshModule();
    const { historicalFiguresBase } = await import('../../api/figures');
    fetchMock.mockClear();
    pending = [];

    for (let render = 0; render < 6; render += 1) {
      for (const figure of historicalFiguresBase) getFigureTranslation(figure.baseNameEn, 'de');
    }

    expect(fetchMock).toHaveBeenCalledTimes(historicalFiguresBase.length);
    expect(new Set(fetchMock.mock.calls.map((c) => String(c[0]))).size).toBe(historicalFiguresBase.length);
  });

  it('keeps a failure for the load: the English fallback once, no second try at either file', async () => {
    const { getFigureTranslation, loadFigureTranslation } = await freshModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = loadFigureTranslation('Echo of Plato', 'de');
    pending[0].resolve(json({}, 503));
    await settle();
    // The German file failed, so English is asked for once.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('figure-translations/en/plato.json');
    pending[1].resolve(json({ name: 'Echo of Plato', about: 'Philosopher' }));
    expect((await first).name).toBe('Echo of Plato');

    for (let i = 0; i < 10; i += 1) getFigureTranslation('Echo of Plato', 'de');
    const again = loadFigureTranslation('Echo of Plato', 'de');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await again).name).toBe('Echo of Plato');
    warn.mockRestore();
  });
});
