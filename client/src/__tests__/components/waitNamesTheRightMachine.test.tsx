// In mixed Local Mode a long wait says "Dein Rechner ..." only when the
// visitor's own service is the one the stage waits on: transcription while a
// recording is heard, the model until the reply's text comes, the voice after
// that; for a council the model until the first speech is written, then the
// voice. Every other long wait is ours and keeps the busy lines. Each card is
// one live region.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

vi.mock('../../hooks/useTranslation', async () => {
  const bundle = (await import('../../assets/translations/ui-de.json')).default;
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(key);
    return typeof value === 'string' ? value : fallback ?? '';
  };
  const api = () => ({ tString: t, tNode: t, t, language: 'de' });
  return { default: api, useTranslation: api };
});
vi.mock('../../hooks/useLiquidGlass', () => ({ useLiquidGlass: () => ({ glassClasses: '' }) }));

import ProcessingLoader, { type ProcessingStage } from '../../components/ProcessingLoader';
import CosmicCouncilLoader, { type LoaderStage } from '../../components/CosmicCouncil/CosmicCouncilLoader';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';
import de from '../../assets/translations/ui-de.json';

type Local = { llm?: boolean; tts?: boolean; stt?: boolean };
// Local Mode's model switch is on only together with its route, as the panel saves them.
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'local-model' };
const setLocal = ({ llm = false, tts = false, stt = false }: Local) =>
  saveServiceConfig({ ...defaultConfig, llm: llm ? LOCAL_LLM : defaultConfig.llm, localMode: { llmEnabled: llm, ttsEnabled: tts, sttEnabled: stt } });

const LOCAL = [de.processing.localWait, de.processing.localTakingLonger, de.councilProcessing.localTakingLonger];
const BUSY = [
  ...Object.values(de.processing.highDemand).flatMap((pool) => Object.values(pool as Record<string, string>)),
  de.processing.takingLonger,
];

/** What a card shows over `seconds`, read every half second. */
function shown(card: () => JSX.Element, seconds: number): string[] {
  const seen = new Set<string>();
  render(card());
  for (let t = 0; t < seconds * 1000; t += 500) {
    act(() => { vi.advanceTimersByTime(500); });
    document.querySelectorAll('.cosmic-processing-quote, .cosmic-processing-note').forEach((el) => {
      if (el.textContent) seen.add(el.textContent.trim());
    });
  }
  return [...seen];
}
const turn = (stage: ProcessingStage | undefined, seconds = 28) =>
  shown(() => <ProcessingLoader figureName="Echo von Mark Aurel" stage={stage} onSwitchToText={() => {}} />, seconds);
const council = (stage: LoaderStage, seconds = 95) =>
  shown(() => <CosmicCouncilLoader councilParticipants={['Echo von Mark Aurel']} stage={stage} onSwitchToText={() => {}} />, seconds);

const blamesOwnMachine = (lines: string[]) => lines.some((line) => LOCAL.includes(line));

describe('a long wait names the machine it is on', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setLocal({});
  });

  const cases: Array<[string, Local, ProcessingStage | undefined, boolean]> = [
    ['only transcription local, still hearing', { stt: true }, 'hearing', true],
    ['only transcription local, heard, our model answering', { stt: true }, 'preparing', false],
    ['only transcription local, our model writing', { stt: true }, 'contemplating', false],
    ['only the voice local, our model answering', { tts: true }, 'preparing', false],
    ['only the voice local, our model writing', { tts: true }, 'contemplating', false],
    ['only the voice local, waiting for the voice', { tts: true }, 'shaping', true],
    ['only the model local, writing', { llm: true }, 'contemplating', true],
    ['only the model local, waiting for our voice', { llm: true }, 'shaping', false],
    ['only the model local, a recording with our transcription', { llm: true }, 'hearing', false],
    ['only the voice local, a first load waiting for text', { tts: true }, undefined, false],
    ['only the model local, a first load waiting for text', { llm: true }, undefined, true],
  ];

  for (const [name, local, stage, own] of cases) {
    it(`${name}: ${own ? 'the own machine' : 'the busy lines'}`, () => {
      setLocal(local);
      const lines = turn(stage);
      expect(blamesOwnMachine(lines)).toBe(own);
      if (!own) expect(lines.some((line) => BUSY.includes(line))).toBe(true);
    });
  }

  const councilCases: Array<[string, Local, LoaderStage, boolean]> = [
    ['council, only the voice local, the model writing', { tts: true }, 'generating', false],
    ['council, only the voice local, the first voice awaited', { tts: true }, 'streaming', true],
    ['council, only the model local, writing', { llm: true }, 'generating', true],
    ['council, only the model local, our voice awaited', { llm: true }, 'streaming', false],
  ];
  for (const [name, local, stage, own] of councilCases) {
    it(`${name}: ${own ? 'the own machine' : 'the busy lines'}`, () => {
      setLocal(local);
      expect(blamesOwnMachine(council(stage))).toBe(own);
    });
  }

  it('each card is one live region, the long-wait note included', () => {
    setLocal({ llm: true });
    turn('contemplating', 28);
    expect(document.querySelector('.cosmic-processing-note')).not.toBeNull();
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    cleanup();

    council('generating', 95);
    expect(document.querySelector('.cosmic-processing-note')).not.toBeNull();
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });
});
