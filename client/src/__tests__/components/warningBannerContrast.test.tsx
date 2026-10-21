// The five warning lines of the status banner sit on the design system's own
// warning token, in an ink that reads at 4.5:1 or better on it (WCAG AA for
// 14 px text). Both tokens are read from index.css, so a change there is caught.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { render, screen, act, cleanup } from '@testing-library/react';
import NetworkStatusBanner from '../../components/NetworkStatusBanner';

const css = readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8');
const root = css.slice(css.indexOf(':root {'));

function token(name: string): string {
  const match = root.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`${name} is not defined in index.css`);
  const value = match[1].trim();
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias ? token(alias[1]) : value;
}

function luminance(hex: string): number {
  const channels = hex.replace('#', '').match(/../g)!.map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const warnings: Array<[string, string, Record<string, unknown>]> = [
  ['an audio service paused', 'circuit-breaker', { service: 'tts', state: 'open', cooldownMs: 60_000 }],
  ['German voice busy', 'audio-rate-limit', { hint: 'switch_to_english' }],
  ['voice rate limited', 'audio-rate-limit', { hint: 'rate_limited' }],
  ['Local Mode down', 'local-mode-unavailable', { service: 'stt' }],
];

const var_ = (value: string) => value.match(/^var\((--[\w-]+)\)$/)?.[1];

describe('the warning banner colours', () => {
  afterEach(() => cleanup());

  it.each(warnings)('%s: defined tokens, 4.5:1 or better', (_name, event, detail) => {
    render(<NetworkStatusBanner />);
    act(() => { window.dispatchEvent(new CustomEvent(event, { detail })); });

    const banner = screen.getByRole('alert');
    const ground = var_(banner.style.getPropertyValue('background') || banner.style.getPropertyValue('background-color'));
    const ink = var_(banner.style.getPropertyValue('color'));

    expect(ground).toBe('--color-warning');
    expect(ink).toBeTruthy();
    expect(contrast(token(ground!), token(ink!))).toBeGreaterThanOrEqual(4.5);
  });
});
