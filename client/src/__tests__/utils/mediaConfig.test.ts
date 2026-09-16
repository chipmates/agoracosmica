import { describe, it, expect } from 'vitest';
import { withContentVersion, getContentUrl, getMediaUrl } from '../../utils/mediaConfig';

describe('withContentVersion', () => {
  const versions = { factchecks: 'abc123', stories: 'def456' };

  it('appends the version of the file family', () => {
    expect(withContentVersion('https://m/factchecks/en/aurelius.json', 'factchecks/en/aurelius.json', versions))
      .toBe('https://m/factchecks/en/aurelius.json?v=abc123');
    expect(withContentVersion('https://m/stories/laozi/en/laozi_2_en.mp3', 'stories/laozi/en/laozi_2_en.mp3', versions))
      .toBe('https://m/stories/laozi/en/laozi_2_en.mp3?v=def456');
  });

  it('leaves families without a version alone', () => {
    expect(withContentVersion('https://m/prisms/x.mp3', 'prisms/x.mp3', versions)).toBe('https://m/prisms/x.mp3');
    expect(withContentVersion('https://m/factchecks/en/a.json', 'factchecks/en/a.json', {})).toBe('https://m/factchecks/en/a.json');
  });

  it('joins with & when the URL already has a query', () => {
    expect(withContentVersion('https://m/stories/a.txt?x=1', 'stories/a.txt', versions)).toBe('https://m/stories/a.txt?x=1&v=def456');
  });
});

describe('content URLs under the test environment (dev mode, no build constant)', () => {
  it('getContentUrl returns the bare proxied path', () => {
    expect(getContentUrl('factchecks/en/aurelius.json')).toBe('/factchecks/en/aurelius.json');
  });

  it('getMediaUrl returns the local asset path', () => {
    expect(getMediaUrl('stories/laozi/en/laozi_2_en.txt')).toBe('/src/assets/stories/laozi/en/laozi_2_en.txt');
  });

  it('both reject path traversal', () => {
    expect(() => getContentUrl('../secret.json')).toThrow('Invalid media path');
    expect(() => getMediaUrl('../secret.json')).toThrow('Invalid media path');
  });
});
