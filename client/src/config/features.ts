// Feature switches.
//
// One constant per surface that ships dark. Vite inlines the VITE_* reads at
// build time, so a branch guarded by a constant here is tree-shaken out of the
// build that does not need it.

/**
 * Offline copies of the Echo story audio: per-episode audio and transcript
 * downloads, plus the whole-figure archive in the Audio Library.
 *
 * Off everywhere, dev included. `VITE_STORY_DOWNLOADS=true` is the only way to
 * see the surface. Every download affordance and every size probe reads this
 * constant, so the surface goes live in one line.
 */
export const STORY_DOWNLOADS_ENABLED: boolean =
  import.meta.env.VITE_STORY_DOWNLOADS === 'true';

/**
 * Carried-question arrivals land at the mode ceremony instead of going straight
 * to Free Talk. The question stays staged either way, so the composer still
 * gets it once Free Talk opens.
 *
 * On in dev, off in production builds. `VITE_CEREMONY_CARRIED_ENTRY=true` turns
 * it on for a production build, `false` forces it off anywhere.
 */
export const CEREMONY_CARRIED_ENTRY: boolean =
  import.meta.env.VITE_CEREMONY_CARRIED_ENTRY === 'true'
    ? true
    : import.meta.env.VITE_CEREMONY_CARRIED_ENTRY === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * The figure answers a carried question instead of greeting: the auto greeting
 * waits, the send tells the model the question was chosen before the
 * conversation opened. A visitor who just sits there still gets the greeting.
 *
 * On in dev, off in production builds. `VITE_ANSWER_FIRST_REPLY=true` turns it
 * on for a production build, `false` forces it off anywhere.
 */
export const ANSWER_FIRST_REPLY: boolean =
  import.meta.env.VITE_ANSWER_FIRST_REPLY === 'true'
    ? true
    : import.meta.env.VITE_ANSWER_FIRST_REPLY === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * How long a carried question waits before the greeting plays anyway. The
 * visitor who reads the box and sends never hears it; the one who sits there
 * is not left with silence.
 */
export const SITTER_GREETING_FALLBACK_MS = 10000;

/**
 * Where the first reply came from: a chip on the reply that names the story
 * chapter grounding it, plus a standing door into that chapter. Renders only
 * when the carried question really has an anchor.
 *
 * On in dev, off in production builds. `VITE_ANSWER_PROVENANCE=true` turns it
 * on for a production build, `false` forces it off anywhere.
 */
export const ANSWER_PROVENANCE: boolean =
  import.meta.env.VITE_ANSWER_PROVENANCE === 'true'
    ? true
    : import.meta.env.VITE_ANSWER_PROVENANCE === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * The visible navigation affordances: the carousel's close button, the chat
 * header's mode chip as the door back to the mode selector, and the quicklink
 * bar for a figure that already has stored conversations.
 *
 * On in dev, off in production builds. `VITE_NAV_BATCH=true` turns it on for a
 * production build, `false` forces it off anywhere.
 */
export const NAV_BATCH: boolean =
  import.meta.env.VITE_NAV_BATCH === 'true'
    ? true
    : import.meta.env.VITE_NAV_BATCH === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * `?mode=library` opens the audio library once the visitor is past the welcome
 * step, through the same rail button that opens it from the sidebar. Off means
 * the mode name is simply not allowlisted, so the link lands in the app the way
 * any other arrival does.
 *
 * On in dev, off in production builds. `VITE_AUDIO_LIBRARY_ENTRY=true` turns it
 * on for a production build, `false` forces it off anywhere.
 */
export const AUDIO_LIBRARY_ENTRY: boolean =
  import.meta.env.VITE_AUDIO_LIBRARY_ENTRY === 'true'
    ? true
    : import.meta.env.VITE_AUDIO_LIBRARY_ENTRY === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * Council cards and theme bands wear the baked oil paintings instead of the
 * July ink engravings, wherever a council has a baked pick. Councils without
 * one keep their engraving either way, so the wall is never half empty.
 *
 * On in dev, off in production builds. `VITE_COUNCIL_OILS=true` turns it on
 * for a production build, `false` forces it off anywhere.
 */
export const COUNCIL_OILS: boolean =
  import.meta.env.VITE_COUNCIL_OILS === 'true'
    ? true
    : import.meta.env.VITE_COUNCIL_OILS === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * The stage a carried question waits on carries a dim presence of the figure
 * instead of standing empty. Decorative only: it takes no click, no layout, and
 * it leaves the moment the conversation speaks.
 *
 * On in dev, off in production builds. `VITE_QUIET_PLATE_PRESENCE=true` turns
 * it on for a production build, `false` forces it off anywhere.
 */
export const QUIET_PLATE_PRESENCE: boolean =
  import.meta.env.VITE_QUIET_PLATE_PRESENCE === 'true'
    ? true
    : import.meta.env.VITE_QUIET_PLATE_PRESENCE === 'false'
      ? false
      : import.meta.env.DEV;

/**
 * English gets a voice engine choice: Qwen as the default, Kokoro still
 * selectable with its cast unchanged. The pre-rendered greetings follow the
 * same setting from a versioned R2 keyspace, so greeting and live reply never
 * come from different engines.
 *
 * Off everywhere, dev included. `VITE_EN_VOICE_ENGINE_CHOICE=true` is the only
 * way to see the surface; off means Kokoro, today's paths, no new UI.
 */
export const EN_VOICE_ENGINE_CHOICE: boolean =
  import.meta.env.VITE_EN_VOICE_ENGINE_CHOICE === 'true';

/**
 * Ask while listening: a paused chapter offers one quiet line under the plate,
 * the question is answered in the Echo voice from what has been heard so far,
 * and the chapter picks up a breath before the paused second. The exchange can
 * be carried into Free Talk.
 *
 * On in dev, off in production builds. `VITE_ASK_WHILE_LISTENING=true` turns it
 * on for a production build, `false` forces it off anywhere.
 */
export const ASK_WHILE_LISTENING: boolean =
  import.meta.env.VITE_ASK_WHILE_LISTENING === 'true'
    ? true
    : import.meta.env.VITE_ASK_WHILE_LISTENING === 'false'
      ? false
      : import.meta.env.DEV;
