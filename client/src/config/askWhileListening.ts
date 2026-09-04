// Ask-while-listening: the numbers the surface and the machine share.
// One file so the placement study after ship changes a value, not a component.

/**
 * How long a pause has to hold, with the tab visible and no overlay open,
 * before the ask bar appears. Short enough to feel like an answer to the
 * pause, long enough that pausing for a sip renders nothing.
 */
export const ASK_DWELL_MS = 1000;

/**
 * How far before the frozen anchor the chapter picks up again. A breath, not a
 * rewind: the run-up is clamped to the anchored paragraph's own start so a
 * resume can never fall back into the previous paragraph.
 */
export const ASK_RESUME_RUNUP_S = 1.2;

/**
 * The chapter text that rides with a question, counted backward from the
 * paused paragraph. The free-tier adapter cuts an assistant message at 7,500
 * characters from the front, so the window runs backward and stays under it.
 */
export const ASK_CONTEXT_MAX_CHARS = 7000;

/** Hard stop for a typed question. */
export const ASK_QUESTION_MAX_CHARS = 500;

/** Where the character counter starts showing. */
export const ASK_COUNTER_FROM = 450;

/**
 * A paused player emits no time updates, so any movement past this is a scrub.
 * The bar folds when it happens: the frozen anchor no longer describes where
 * the listener is.
 */
export const ASK_SCRUB_EPSILON_S = 0.5;

/**
 * How long a resume waits for the chapter to actually sound before the machine
 * falls back to the paused state. Covers a blocked play() with nothing stuck.
 */
export const ASK_RESUME_TIMEOUT_MS = 2500;
