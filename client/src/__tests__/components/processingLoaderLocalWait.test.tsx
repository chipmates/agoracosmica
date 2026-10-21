// A long wait in the processing card: the busy lines ("Full house today")
// speak of our servers. When the wait runs in Local Mode on the visitor's own
// machine, the card says that plainly instead, in German and English.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de' }));

vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(bundles[h.lang], key);
    return typeof value === 'string' ? value : fallback ?? '';
  };
  const api = () => ({ tString: t, tNode: t, t, language: h.lang });
  return { default: api, useTranslation: api };
});
vi.mock('../../hooks/useLiquidGlass', () => ({ useLiquidGlass: () => ({ glassClasses: '' }) }));

import ProcessingLoader, { type ProcessingStage } from '../../components/ProcessingLoader';
import CosmicCouncilLoader from '../../components/CosmicCouncil/CosmicCouncilLoader';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';

const setLocal = (llmEnabled: boolean, ttsEnabled: boolean, sttEnabled: boolean) =>
  saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled, ttsEnabled, sttEnabled } });

const busyLines = (bundle: typeof de) => [
  ...Object.values(bundle.processing.highDemand).flatMap((pool) => Object.values(pool as Record<string, string>)),
  bundle.processing.takingLonger,
];

/** The card's text after `seconds` of waiting, read every half second so no rotating line is missed. */
function linesShown(stage: ProcessingStage | undefined, seconds: number, council = false): string[] {
  const seen = new Set<string>();
  render(council
    ? <CosmicCouncilLoader councilParticipants={['Echo von Mark Aurel', 'Echo von Platon']} onSwitchToText={() => {}} />
    : <ProcessingLoader figureName="Echo von Mark Aurel" stage={stage} onSwitchToText={() => {}} />);
  for (let t = 0; t < seconds * 1000; t += 500) {
    act(() => { vi.advanceTimersByTime(500); });
    document.querySelectorAll('.cosmic-processing-quote, .cosmic-processing-note').forEach((el) => {
      if (el.textContent) seen.add(el.textContent.trim());
    });
  }
  return [...seen];
}

describe('the processing card in a long wait', () => {
  beforeEach(() => {
    h.lang = 'de';
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setLocal(false, false, false);
  });

  it('German, own model: its own line, never a busy line', () => {
    setLocal(true, true, true);
    const shown = linesShown('preparing', 30);

    expect(shown).toContain('Dein Rechner arbeitet noch. Einen Moment.');
    expect(shown).toContain(de.processing.localTakingLonger);
    for (const busy of busyLines(de)) expect(shown).not.toContain(busy);
    expect(shown.join(' ')).not.toMatch(/Volles Haus|Viele Stimmen|Heute dauert/);
  });

  it('English, own model: its own line, never a busy line', () => {
    h.lang = 'en';
    setLocal(true, false, false);
    const shown = linesShown('preparing', 30);

    expect(shown).toContain('Your computer is still working. One moment.');
    expect(shown).toContain(en.processing.localTakingLonger);
    for (const busy of busyLines(en as unknown as typeof de)) expect(shown).not.toContain(busy);
  });

  it('a local voice in the shaping stage, and the first load, count as a local wait', () => {
    setLocal(false, true, false);
    expect(linesShown('shaping', 10)).toContain(de.processing.localWait);
    cleanup();
    expect(linesShown(undefined, 26)).toContain(de.processing.localTakingLonger);
  });

  it('hosted, or a local service the stage does not wait on: the busy lines as before', () => {
    setLocal(false, false, false);
    const hosted = linesShown('preparing', 30);
    expect(hosted.some((line) => busyLines(de).includes(line))).toBe(true);
    expect(hosted).not.toContain(de.processing.localWait);
    cleanup();

    // Local voice input only; a typed message waits on the hosted model.
    setLocal(false, false, true);
    expect(linesShown('preparing', 10)).not.toContain(de.processing.localWait);
  });

  it('the short normal lines stay as they are in Local Mode', () => {
    setLocal(true, true, true);
    const early = linesShown('preparing', 5);
    expect(early).not.toContain(de.processing.localWait);
    expect(early.every((line) => Object.values(de.processing.normal.preparing).includes(line))).toBe(true);
  });

  it('the council card: a council on the own model gets the same plain line', () => {
    setLocal(true, false, false);
    const shown = linesShown(undefined, 95, true);

    expect(shown).toContain(de.processing.localWait);
    expect(shown).toContain(de.councilProcessing.localTakingLonger);
    const councilBusy = [
      ...Object.values(de.councilProcessing.highDemand).flatMap((pool) => Object.values(pool as Record<string, string>)),
      de.councilProcessing.takingLonger,
    ];
    for (const busy of councilBusy) expect(shown).not.toContain(busy);
  });

  it('the council card, hosted: the busy lines as before', () => {
    setLocal(false, false, true);
    const shown = linesShown(undefined, 95, true);
    expect(shown).toContain(de.councilProcessing.takingLonger);
    expect(shown).not.toContain(de.processing.localWait);
  });

  it('the new lines keep the house rules', () => {
    for (const bundle of [de, en]) {
      for (const line of [bundle.processing.localWait, bundle.processing.localTakingLonger, bundle.councilProcessing.localTakingLonger]) {
        expect(line).toBeTruthy();
        expect(line).not.toMatch(/[–—;]/);
        expect(line).not.toMatch(/\bfree\b|kostenlos|privat/i);
      }
    }
  });
});
