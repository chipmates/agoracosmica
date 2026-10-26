// The stories' label, read unchanged from the app's own helper translations
// (audio library, transparency section). Build time only: the island gets the
// two lines as props, so the helper files never ship to the browser.

import helpersEn from '@client/assets/translations/helpers/en.json';
import helpersDe from '@client/assets/translations/helpers/de.json';
import type { PlayerLang } from './strings';

export interface StoryLabel {
  brief: string;
  expanded: string;
}

interface HelperFile {
  audioLibrary: { welcome: { sections: { transparency: StoryLabel } } };
}

function read(file: unknown): StoryLabel {
  const t = (file as HelperFile).audioLibrary.welcome.sections.transparency;
  return { brief: t.brief, expanded: t.expanded };
}

const LABELS: Record<PlayerLang, StoryLabel> = { en: read(helpersEn), de: read(helpersDe) };

export function storyLabel(lang: PlayerLang): StoryLabel {
  return LABELS[lang];
}
