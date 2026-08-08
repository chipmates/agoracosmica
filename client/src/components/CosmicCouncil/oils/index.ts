/**
 * Oil registry for the council wall and the theme pages.
 *
 * Where the July ink plates are grayscale-alpha masks the card paints with a
 * theme token, an oil is the picture itself: opaque colour, no alpha, never
 * recoloured at render. So it renders as an image rather than a mask layer,
 * and the theme accent stays on the chrome around it.
 *
 * Three tiers per plate, cut by the wave-2a bake:
 *   square  720x720   the council card on a phone
 *   wide   1024x576   the council card from tablet up, and the marketing band
 *   full   1440 long  the whole painting, lightbox only
 *
 * The paintings are served from the public media domain, never bundled. Each
 * record carries its tiers' object keys and this module joins them to the
 * media root, so no build ever imports a painting: a flag-off build carries no
 * image bytes, and the browser fetches one only when a surface paints it.
 */

import { OIL_RECORDS, type OilRecord } from './records';

export type { OilRecord };

export interface CouncilOil extends OilRecord {
  square: string;
  wide: string;
  full: string;
}

/**
 * Where the paintings are served from. The same public media domain the figure
 * images use, in dev as in production: the objects are public and the URLs are
 * absolute, so the app and the statically rendered marketing pages resolve them
 * identically and neither needs a local copy or a proxy.
 *
 * An operator running their own media host overrides it the way the rest of the
 * app does, at runtime through /config.js or at build time through the env.
 *
 * Read inside the lazy build, never at module load. Reading a property off
 * `window` is a side effect as far as the bundler can prove, and one top-level
 * side effect pins this whole module into the flag-off build. Measured: as a
 * module-level constant it cost the council chunk 63 bytes it had not carried.
 */
const mediaRoot = (): string =>
  (typeof window !== 'undefined' && window.__AGORA_CONFIG__?.mediaBaseUrl) ||
  import.meta.env.VITE_MEDIA_BASE_URL ||
  'https://media.agoracosmica.org';

/**
 * The registry is built on first ask, never at module load. A top-level loop
 * would be a side effect too, and a side effect keeps the module in the bundle
 * even when the switch is off: the build that ships engravings would still
 * carry every painting's URL. Built lazily, an unasked registry costs nothing.
 */
let registry: Record<string, CouncilOil> | null = null;
let byCouncil: Record<string, CouncilOil> | null = null;

const build = () => {
  const root = mediaRoot();
  const all: Record<string, CouncilOil> = {};
  const councils: Record<string, CouncilOil> = {};
  for (const [id, record] of Object.entries(OIL_RECORDS)) {
    const url = (key: string) => `${root}/${key}`;
    const oil: CouncilOil = {
      ...record,
      square: url(record.files.sq720),
      wide: url(record.files.wide1024),
      full: url(record.files.full1440),
    };
    all[id] = oil;
    if (record.councilId) councils[record.councilId] = oil;
  }
  registry = all;
  byCouncil = councils;
  return { all, councils };
};

/** Every oil, keyed `<theme-id>/<council-id>` or `<theme-id>/lead`. */
export const councilOils = (): Record<string, CouncilOil> => registry ?? build().all;

/** The oil for a council card, by council id. */
export const getCouncilOil = (councilId: string): CouncilOil | undefined =>
  (byCouncil ?? build().councils)[councilId];

/** The oil a theme page opens with, which belongs to no single council. */
export const getThemeLeadOil = (themeId: string): CouncilOil | undefined =>
  councilOils()[`${themeId}/lead`];
