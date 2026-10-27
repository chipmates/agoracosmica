// The reader's display settings ("Aa"), kept on this device: the light (Auto
// follows the device, Day, Vellum, Night), text size, typeface, line spacing,
// what the read-along marks (and the stronger wash) and whether it follows the voice. The light
// covers the figure page, the reader and the dock; CSS does the work
// (player.css), this only sets the root's attribute.

const KEY = 'agc_story_display';
const OLD_THEME_KEY = 'agc_story_theme';

export type Light = 'auto' | 'day' | 'vellum' | 'night';
export type Face = 'book' | 'clear';
export type Spacing = 'tight' | 'normal' | 'airy';
export type Highlight = 'word' | 'sentence' | 'off';

export interface DisplaySettings {
  light: Light;
  /** Text size in px; null keeps the default (19 on a phone, 21 on a desktop). */
  size: number | null;
  face: Face;
  spacing: Spacing;
  highlight: Highlight;
  /** The wash behind the spoken sentence, over the quiet mark. */
  strong: boolean;
  follow: boolean;
}

export const SIZE_MIN = 15;
export const SIZE_MAX = 28;

const DEFAULTS: DisplaySettings = { light: 'auto', size: null, face: 'book', spacing: 'normal', highlight: 'word', strong: false, follow: true };

const LIGHTS: readonly Light[] = ['auto', 'day', 'vellum', 'night'];
const FACES: readonly Face[] = ['book', 'clear'];
const SPACINGS: readonly Spacing[] = ['tight', 'normal', 'airy'];
const HIGHLIGHTS: readonly Highlight[] = ['word', 'sentence', 'off'];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function read(): DisplaySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Record<keyof DisplaySettings, unknown>>;
      const size = typeof v.size === 'number' && v.size >= SIZE_MIN && v.size <= SIZE_MAX ? Math.round(v.size) : null;
      return {
        light: pick(v.light, LIGHTS, DEFAULTS.light),
        size,
        face: pick(v.face, FACES, DEFAULTS.face),
        spacing: pick(v.spacing, SPACINGS, DEFAULTS.spacing),
        highlight: pick(v.highlight, HIGHLIGHTS, DEFAULTS.highlight),
        strong: typeof v.strong === 'boolean' ? v.strong : DEFAULTS.strong,
        follow: typeof v.follow === 'boolean' ? v.follow : DEFAULTS.follow,
      };
    }
    // the earlier day and night switch
    const old = localStorage.getItem(OLD_THEME_KEY);
    if (old === 'day' || old === 'night') return { ...DEFAULTS, light: old };
  } catch {
    // storage blocked: the defaults
  }
  return { ...DEFAULTS };
}

let settings: DisplaySettings | null = null;
const listeners = new Set<() => void>();

export function getDisplay(): DisplaySettings {
  if (!settings) settings = typeof window === 'undefined' ? { ...DEFAULTS } : read();
  return settings;
}

export const SERVER_DISPLAY: DisplaySettings = { ...DEFAULTS };

export function subscribeDisplay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDisplay(patch: Partial<DisplaySettings>): void {
  settings = { ...getDisplay(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage blocked: the choice lasts as long as the page
  }
  applyStoredTheme();
  listeners.forEach(listener => listener());
}

/** The light as it shows: Auto resolved by the device's setting. */
export function currentLight(): Exclude<Light, 'auto'> {
  const light = getDisplay().light;
  if (light !== 'auto') return light;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
}

/** The router swaps the root element's attributes, so the choice is set again. */
export function applyStoredTheme(): void {
  const light = getDisplay().light;
  if (light === 'auto') delete document.documentElement.dataset.storyTheme;
  else document.documentElement.dataset.storyTheme = light;
}
