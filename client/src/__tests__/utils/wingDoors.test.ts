import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  captureEntryIntentFromUrl,
  readFigureIntent,
  readAskIntent,
  hasEntryTextFirst,
  isValidAskTag,
  resolveAskPrefill,
  stashAskPrefill,
  consumeAskPrefill,
  peekStagedQuestion,
  hasStagedQuestion,
} from '../../utils/public/entryIntent';
import { askTagFigure, getHeroEntry, getHeroEntryQuestion, resolveAnchorSeedId } from '../../data/public/heroEntry';
import { getWingDoorQuestion, hasWingDoor, listWingDoors } from '../../data/public/wingDoors';

// The museum's own door catalogue. It lives in this repository while the
// museum does; once the museum has its own repository the drift check runs
// there against this table instead.
const DOORS_JSON = join(__dirname, '..', '..', '..', '..', 'nightagora/src/wings/vinci/data/doors.json');
const museumPresent = existsSync(DOORS_JSON);

interface DoorRecord {
  station: string;
  question_en: string;
  question_de: string;
}

describe('the museum door table', () => {
  it.skipIf(!museumPresent)('matches the wing\'s door catalogue, every station and the farewell', () => {
    const source = JSON.parse(readFileSync(DOORS_JSON, 'utf8')) as {
      doors: DoorRecord[];
      farewell: DoorRecord;
    };
    const expected = new Map(
      [...source.doors, source.farewell].map((door) => [
        door.station,
        { en: door.question_en, de: door.question_de },
      ])
    );
    const actual = new Map(listWingDoors('vinci'));
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [station, question] of expected) {
      expect({ station, ...actual.get(station) }).toEqual({ station, ...question });
    }
  });

  it('knows the farewell as a door of its own', () => {
    expect(hasWingDoor('vinci', 'farewell')).toBe(true);
    expect(getWingDoorQuestion('vinci', 'farewell', 'de')).toBeTruthy();
  });

  it('answers nothing for inherited keys or unknown figures', () => {
    expect(hasWingDoor('vinci', 'constructor')).toBe(false);
    expect(hasWingDoor('jung', 'hall')).toBe(false);
    expect(getWingDoorQuestion('vinci', 'toString', 'en')).toBeNull();
  });
});

describe('w: ask tags', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('accepts every station door of the wing, and the farewell', () => {
    for (const station of listWingDoors('vinci').keys()) {
      expect(isValidAskTag(`w:vinci:${station}`)).toBe(true);
    }
  });

  it('accepts an unknown station of a known figure, which falls back', () => {
    expect(isValidAskTag('w:vinci:a-room-built-later')).toBe(true);
  });

  it.each([
    'w:nobody:hall',
    'w:constructor:hall',
    'w:Vinci:hall',
    'w:vinci:Hall',
    'w:vinci:',
    'w:vinci',
    'w:vinci:hall:1',
    'w:vinci:line_early',
    'w:vinci:hall ',
    `w:vinci:${'a'.repeat(41)}`,
    'w:vinci:Why did you leave Italy for a house in France?',
  ])('rejects %s', (tag) => {
    expect(isValidAskTag(tag)).toBe(false);
    stashAskPrefill(tag);
    expect(consumeAskPrefill()).toBeNull();
  });

  it('resolves a station to the question read beside its door, in both languages', () => {
    expect(resolveAskPrefill('w:vinci:supper-wall', null, 'en')).toEqual({
      kind: 'text',
      text: 'Why did you choose such a fragile way to paint the Last Supper?',
    });
    expect(resolveAskPrefill('w:vinci:supper-wall', 'vinci', 'de')).toEqual({
      kind: 'text',
      text: 'Warum hast du das Abendmahl mit einer so empfindlichen Technik gemalt?',
    });
    expect(resolveAskPrefill('w:vinci:farewell', 'vinci', 'en')).toEqual({
      kind: 'text',
      text: getWingDoorQuestion('vinci', 'farewell', 'en'),
    });
  });

  it('falls back to the hero question for an unknown station or language', () => {
    const vinci = getHeroEntry('vinci')!;
    expect(resolveAskPrefill('w:vinci:a-room-built-later', null, 'de')).toEqual({
      kind: 'text',
      text: vinci.questionDe,
    });
    expect(resolveAskPrefill('w:vinci:hall', null, 'fr')).toEqual({
      kind: 'text',
      text: getHeroEntryQuestion('vinci', 'fr'),
    });
  });

  it('names the figure a tag belongs to', () => {
    expect(askTagFigure('w:vinci:hall')).toBe('vinci');
    expect(askTagFigure('f:jung:2')).toBe('jung');
    expect(askTagFigure('hero')).toBeNull();
    expect(askTagFigure('life')).toBeNull();
  });

  it('anchors a station only where its question is one teaching\'s subject', () => {
    expect(resolveAnchorSeedId('vinci', 'w:vinci:body')).toBe('11');
    expect(resolveAnchorSeedId('vinci', 'w:vinci:works')).toBe('10');
    expect(resolveAnchorSeedId('vinci', 'w:vinci:garden')).toBe('2');
    expect(resolveAnchorSeedId('vinci', 'w:vinci:picture-room')).toBe('8');
    expect(resolveAnchorSeedId('vinci', 'w:vinci:hall')).toBeNull();
    expect(resolveAnchorSeedId('vinci', 'w:vinci:reading-table')).toBeNull();
    expect(resolveAnchorSeedId('vinci', 'w:vinci:farewell')).toBeNull();
  });

  it('keeps the hero anchor where an unknown station falls back to the hero question', () => {
    expect(resolveAnchorSeedId('vinci', 'w:vinci:a-room-built-later'))
      .toBe(String(getHeroEntry('vinci')!.seedId));
  });

  it('grounds nothing for another figure', () => {
    expect(resolveAnchorSeedId('jung', 'w:vinci:body')).toBeNull();
  });

  it('captures the museum door from the address, encoded as the museum sends it', () => {
    window.history.replaceState(
      {},
      '',
      '/?figure=leonardo-da-vinci&ask=w%3Avinci%3Areading-table&lang=de'
    );
    captureEntryIntentFromUrl();
    expect(readFigureIntent()).toBe('vinci');
    expect(readAskIntent()).toBe('w:vinci:reading-table');
    expect(hasEntryTextFirst()).toBe(true);
    expect(window.location.search).toBe('');
  });

  it('keeps the staged question for the ceremony and the composer', () => {
    stashAskPrefill('w:vinci:flight');
    expect(hasStagedQuestion()).toBe(true);
    expect(peekStagedQuestion('vinci', 'de')).toEqual({
      text: 'Wie hast du entschieden, ob du am Fliegen weiterarbeiten solltest?',
      source: 'ask',
    });
    expect(consumeAskPrefill()).toBe('w:vinci:flight');
    expect(consumeAskPrefill()).toBeNull();
  });
});
