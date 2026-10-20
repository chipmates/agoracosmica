import { describe, it, expect } from 'vitest';
import { CustomCouncilParser, type Segment } from '../../services/council/parser';

function parse(chunks: string[]): { emitted: Segment[]; segments: Segment[]; changes: number } {
  const emitted: Segment[] = [];
  const parser = new CustomCouncilParser({
    participants: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
    mode: 'debate',
    onSegment: (s: Segment) => emitted.push(s),
  });
  for (const c of chunks) parser.processChunk(c);
  const done = parser.complete();
  return { emitted, segments: done.segments, changes: done.metrics.speakerChanges };
}

describe('council parser: one speaker labels two lines in a row', () => {
  it('keeps both lines as segments in order', () => {
    const { emitted, segments } = parse([
      'ADA LOVELACE :: Eins.\n\nADA LOVELACE :: Zwei.\n\n',
      'ALBERT EINSTEIN :: Drei.\n',
    ]);
    expect(segments.map((s) => s.content)).toEqual(['Eins.', 'Zwei.', 'Drei.']);
    expect(emitted.map((s) => s.speaker)).toEqual(['ADA LOVELACE', 'ADA LOVELACE', 'ALBERT EINSTEIN']);
  });

  it('emits the first line as soon as the second label arrives', () => {
    const emitted: Segment[] = [];
    const parser = new CustomCouncilParser({
      participants: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
      mode: 'debate',
      onSegment: (s: Segment) => emitted.push(s),
    });
    parser.processChunk('ADA LOVELACE :: Eins.\nADA LOVELACE :: Zwei.\n');
    expect(emitted.map((s) => s.content)).toEqual(['Eins.']);
  });

  it('counts only real speaker changes', () => {
    const { changes } = parse(['ADA LOVELACE :: Eins.\nADA LOVELACE :: Zwei.\nALBERT EINSTEIN :: Drei.\n']);
    expect(changes).toBe(1);
  });
});
