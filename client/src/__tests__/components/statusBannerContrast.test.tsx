// Every line of the status banner sits on a colour token that index.css
// defines, opaque, in an ink token that reads at 4.5:1 or better on it (WCAG AA
// for 14 px text). No line may rest on an undefined variable and its fallback.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { render, screen, act, cleanup } from '@testing-library/react';

const net = vi.hoisted(() => ({ isOnline: true }));
vi.mock('../../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: net.isOnline }) }));

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

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** A bare `var(--name)`: the token itself, no fallback, no mix with the page. */
const bareToken = (value: string) => value.match(/^var\((--[\w-]+)\)$/)?.[1];

function expectReadable(): void {
  const banner = screen.getByRole('alert');
  const ground = bareToken(banner.style.getPropertyValue('background') || banner.style.getPropertyValue('background-color'));
  const ink = bareToken(banner.style.getPropertyValue('color'));
  expect(ground, `ground of "${banner.textContent}"`).toBeTruthy();
  expect(ink, `ink of "${banner.textContent}"`).toBeTruthy();
  expect(contrast(token(ground!), token(ink!))).toBeGreaterThanOrEqual(4.5);
}

describe('the status banner colours', () => {
  afterEach(() => {
    cleanup();
    net.isOnline = true;
  });

  it('offline: a defined token, 4.5:1 or better', () => {
    net.isOnline = false;
    render(<NetworkStatusBanner />);
    expectReadable();
  });

  it('connection restored: a defined token, 4.5:1 or better', () => {
    net.isOnline = false;
    const view = render(<NetworkStatusBanner />);
    net.isOnline = true;
    view.rerender(<NetworkStatusBanner />);
    expect(screen.getByRole('alert').textContent).toMatch(/restored|wiederhergestellt/i);
    expectReadable();
  });

  it('all audio busy: a defined token, 4.5:1 or better', () => {
    render(<NetworkStatusBanner />);
    act(() => { window.dispatchEvent(new CustomEvent('audio-rate-limit', { detail: { hint: 'disable_tts' } })); });
    expectReadable();
  });

  it.each([
    ['circuit-breaker', { service: 'stt', state: 'open', cooldownMs: 60_000 }],
    ['audio-rate-limit', { hint: 'switch_to_english' }],
    ['audio-rate-limit', { hint: 'rate_limited' }],
    ['byok-fell-back', {}],
    ['local-mode-unavailable', { service: 'tts' }],
    ['local-mode-unavailable', { service: 'stt', reason: 'empty' }],
  ])('%s %j: still a defined token, 4.5:1 or better', (event, detail) => {
    render(<NetworkStatusBanner />);
    act(() => { window.dispatchEvent(new CustomEvent(event, { detail })); });
    expectReadable();
  });
});
