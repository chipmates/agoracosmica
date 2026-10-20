import { describe, it, expect } from 'vitest';
import { CustomCouncilParser, type Segment } from '../../services/council/parser';

function parse(chunks: string[]): { emitted: Segment[]; segments: Segment[] } {
  const emitted: Segment[] = [];
  const parser = new CustomCouncilParser({
    participants: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
    mode: 'debate',
    onSegment: (s: Segment) => emitted.push(s),
  });
  for (const c of chunks) parser.processChunk(c);
  return { emitted, segments: parser.complete().segments };
}

describe('council parser: end of stream', () => {
  it('parses a last line that has no trailing newline', () => {
    const { emitted, segments } = parse(['ADA LOVELACE :: Eins.\n\n', 'ALBERT EINSTEIN :: Zwei.\n\nADA LOVELACE :: Drei.']);
    expect(segments.map((s) => s.content)).toEqual(['Eins.', 'Zwei.', 'Drei.']);
    expect(emitted.map((s) => s.speaker)).toEqual(['ADA LOVELACE', 'ALBERT EINSTEIN', 'ADA LOVELACE']);
  });

  it('adds the last line to the current speaker when it has no label', () => {
    const { segments } = parse(['ADA LOVELACE :: Eins.\n', 'Noch ein Satz.']);
    expect(segments).toHaveLength(1);
    expect(segments[0].content).toBe('Eins. Noch ein Satz.');
  });

  it('changes nothing when the stream ends with a newline', () => {
    const { segments } = parse(['ADA LOVELACE :: Eins.\n\nALBERT EINSTEIN :: Zwei.\n']);
    expect(segments.map((s) => s.content)).toEqual(['Eins.', 'Zwei.']);
  });
});
