import { describe, expect, it } from 'vitest';
import { splitMessageParagraphs } from '@/utils/messageParagraphs';

const GERMAN_REPLY =
  'Du wirst ihnen begegnen, jeden Morgen. Dem Neugierigen, dem Undankbaren, dem, der dich kränkt. Das schrieb ich mir selbst ins Heft, bevor ich den Tag begann, nicht als Klage, sondern als Vorbereitung.\n\n' +
  'Was dich trifft, ist nicht die Tat des anderen. Es ist dein Urteil darüber. Meist bleibt dein Charakter unberührt, nur dein Stolz ist gestoßen.\n\n' +
  'Und dann denk daran, dass auch er aus Unwissen handelt. Was möchtest du ihm sagen, wenn du ihn das nächste Mal siehst?';

describe('splitMessageParagraphs', () => {
  it('keeps the full stop before a blank-line paragraph break (German reply)', () => {
    const paragraphs = splitMessageParagraphs(GERMAN_REPLY);
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0].endsWith('sondern als Vorbereitung.')).toBe(true);
    expect(paragraphs[1].endsWith('nur dein Stolz ist gestoßen.')).toBe(true);
    expect(paragraphs[2].endsWith('das nächste Mal siehst?')).toBe(true);
    expect(paragraphs.join('\n\n')).toBe(GERMAN_REPLY);
  });

  it('keeps question and exclamation marks at paragraph ends', () => {
    expect(splitMessageParagraphs('Warum?\n\nWeil es so ist!\n\nGut.')).toEqual([
      'Warum?',
      'Weil es so ist!',
      'Gut.',
    ]);
  });

  it('keeps every dot of an ellipsis', () => {
    expect(splitMessageParagraphs('Vielleicht...\n\nOder nicht…\n\nWer weiß.')).toEqual([
      'Vielleicht...',
      'Oder nicht…',
      'Wer weiß.',
    ]);
  });

  it('still breaks a paragraph at a single newline after a sentence end, keeping the mark', () => {
    expect(splitMessageParagraphs('First sentence.\nSecond one?\nThird one!\nDone.')).toEqual([
      'First sentence.',
      'Second one?',
      'Third one!',
      'Done.',
    ]);
  });

  it('treats a single newline after sentence end and trailing spaces as a break', () => {
    expect(splitMessageParagraphs('Erster Satz. \nZweiter Satz.')).toEqual(['Erster Satz.', 'Zweiter Satz.']);
  });

  it('joins a single newline after a comma into one line', () => {
    expect(splitMessageParagraphs('Ruhig bleiben,\nund klar antworten.')).toEqual([
      'Ruhig bleiben, und klar antworten.',
    ]);
    expect(splitMessageParagraphs('Ruhig bleiben,\n \nund klar.')).toEqual(['Ruhig bleiben,', 'und klar.']);
  });

  it('keeps other single newlines inside the paragraph', () => {
    expect(splitMessageParagraphs('Drei Wege:\n1. Atmen\n2. Warten\n3. Antworten')).toEqual([
      'Drei Wege:\n1. Atmen\n2. Warten\n3. Antworten',
    ]);
  });

  it('splits a list whose items end in full stops without losing them', () => {
    expect(splitMessageParagraphs('Drei Schritte:\n1. Atme.\n2. Warte.\n3. Antworte.')).toEqual([
      'Drei Schritte:\n1. Atme.',
      '2. Warte.',
      '3. Antworte.',
    ]);
  });

  it('keeps bullet items separated by blank lines intact', () => {
    expect(splitMessageParagraphs('- Erstens die Pause.\n\n- Zweitens das Urteil.')).toEqual([
      '- Erstens die Pause.',
      '- Zweitens das Urteil.',
    ]);
  });

  it('keeps quotes and the punctuation around them', () => {
    expect(splitMessageParagraphs('Er schrieb: „Erkenne dich selbst.“\n\nDas ist alles.')).toEqual([
      'Er schrieb: „Erkenne dich selbst.“',
      'Das ist alles.',
    ]);
    expect(splitMessageParagraphs('Sie nannte es „die Pause“.\n\nMehr nicht.')).toEqual([
      'Sie nannte es „die Pause“.',
      'Mehr nicht.',
    ]);
    expect(splitMessageParagraphs('He said, "Know yourself."\nThat is all.')).toEqual([
      'He said, "Know yourself."',
      'That is all.',
    ]);
    expect(splitMessageParagraphs('Er rief: »Genug!«\nDann ging er.')).toEqual(['Er rief: »Genug!«', 'Dann ging er.']);
  });

  it('collapses runs of blank lines, including lines holding only spaces', () => {
    expect(splitMessageParagraphs('Eins.\n\n\nZwei.\n \nDrei.\n\t\n\nVier')).toEqual(['Eins.', 'Zwei.', 'Drei.', 'Vier']);
  });

  it('reads Windows line endings like plain newlines', () => {
    expect(splitMessageParagraphs('Eins.\r\n\r\nZwei,\r\ndrei.')).toEqual(['Eins.', 'Zwei, drei.']);
  });

  it('keeps the mark while a reply streams in mid-break', () => {
    expect(splitMessageParagraphs('Als Vorbereitung.\n')).toEqual(['Als Vorbereitung.']);
    expect(splitMessageParagraphs('Als Vorbereitung.\n\n')).toEqual(['Als Vorbereitung.']);
    expect(splitMessageParagraphs('Als Vorbereitung.\n\nWas')).toEqual(['Als Vorbereitung.', 'Was']);
  });

  it('leaves a reply without newlines untouched apart from trimming', () => {
    expect(splitMessageParagraphs('  Ein Satz. Noch einer!  ')).toEqual(['Ein Satz. Noch einer!']);
  });

  it('returns nothing for empty or blank content', () => {
    expect(splitMessageParagraphs('')).toEqual([]);
    expect(splitMessageParagraphs(' \n\n \n')).toEqual([]);
  });
});
