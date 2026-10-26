// The page's light: night is the site's; day follows the device's light
// setting on a player figure page, or the reading view's own switch, kept in
// this browser. CSS does the work (player.css); this only sets the override.

const THEME_KEY = 'agc_story_theme';

export type StoryTheme = 'day' | 'night';

function stored(): StoryTheme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'day' || v === 'night' ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme(): StoryTheme {
  const choice = document.documentElement.dataset.storyTheme;
  if (choice === 'day' || choice === 'night') return choice;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'day' : 'night';
}

export function setTheme(theme: StoryTheme): void {
  document.documentElement.dataset.storyTheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked: the choice lasts as long as the page
  }
}

/** The router swaps the root element's attributes, so the choice is set again. */
export function applyStoredTheme(): void {
  const theme = stored();
  if (theme) document.documentElement.dataset.storyTheme = theme;
}
