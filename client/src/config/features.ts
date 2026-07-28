// Feature switches.
//
// One constant per surface that ships dark. Vite inlines the VITE_* reads at
// build time, so a branch guarded by a constant here is tree-shaken out of the
// build that does not need it.

/**
 * Offline copies of the Echo story audio: per-episode audio and transcript
 * downloads, plus the whole-figure archive in the Audio Library.
 *
 * On in dev, off in production builds. `VITE_STORY_DOWNLOADS=true` turns it on
 * for a production build, `false` forces it off anywhere. Every download
 * affordance and every size probe reads this constant, so the surface goes
 * live in one line.
 */
export const STORY_DOWNLOADS_ENABLED: boolean =
  import.meta.env.VITE_STORY_DOWNLOADS === 'true'
    ? true
    : import.meta.env.VITE_STORY_DOWNLOADS === 'false'
      ? false
      : import.meta.env.DEV;
