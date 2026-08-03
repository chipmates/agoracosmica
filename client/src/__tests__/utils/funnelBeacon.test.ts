import { describe, it, expect } from 'vitest';
import {
  firstReplyFailReason,
  chatDepthBucket,
  CHAT_DEPTH_BUCKETS,
} from '../../utils/funnelBeacon';

// A failure the visitor never sees a reason for is the worst kind, so the
// classifier has to be total: every input lands in exactly one of four buckets.
describe('firstReplyFailReason', () => {
  it('sorts an aborted request to abort, whatever else it looks like', () => {
    const err = new Error('Turnstile challenge timed out');
    err.name = 'AbortError';
    expect(firstReplyFailReason(err)).toBe('abort');
  });

  it('sorts every bot-check failure to turnstile', () => {
    expect(firstReplyFailReason(new Error('Turnstile challenge timed out. Please try again.'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Turnstile challenge failed'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Turnstile token expired'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Failed to load Turnstile script'))).toBe('turnstile');
    // The server-side twin: a token the edge rejects surfaces as a session
    // error, and it is still the bot check that ate the message.
    expect(firstReplyFailReason(new Error('Turnstile verification failed'))).toBe('turnstile');
    expect(firstReplyFailReason(new Error('Missing turnstileToken'))).toBe('turnstile');
  });

  it('sorts a 429 to quota', () => {
    expect(firstReplyFailReason(Object.assign(new Error('Daily limit'), { status: 429 }))).toBe('quota');
  });

  it('sorts everything else to upstream', () => {
    expect(firstReplyFailReason(Object.assign(new Error('bad gateway'), { status: 502 }))).toBe('upstream');
    expect(firstReplyFailReason(new Error('Failed to fetch'))).toBe('upstream');
    expect(firstReplyFailReason(undefined)).toBe('upstream');
    expect(firstReplyFailReason(null)).toBe('upstream');
    expect(firstReplyFailReason('something')).toBe('upstream');
  });
});

describe('chatDepthBucket', () => {
  it('maps turn counts to the four documented buckets', () => {
    expect(chatDepthBucket(1)).toBe(0);
    expect(chatDepthBucket(2)).toBe(1);
    expect(chatDepthBucket(3)).toBe(1);
    expect(chatDepthBucket(4)).toBe(2);
    expect(chatDepthBucket(9)).toBe(2);
    expect(chatDepthBucket(10)).toBe(3);
    expect(chatDepthBucket(500)).toBe(3);
  });

  it('never exceeds the worker bucket ceiling', () => {
    expect(CHAT_DEPTH_BUCKETS.length).toBe(3);
    expect(chatDepthBucket(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(5);
  });
});
