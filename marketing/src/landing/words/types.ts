// The landing's words, one file per language. Every line is a placeholder until the final set is written;
// a layout reads them only through landingWords(lang), so a later pour touches these two files alone.

export interface LandingWords {
  /** W1, the h1: what the stories are (the platform tagline). */
  tagline: string;
  /** The one sentence under the tagline on the hero: who the stories are about and how they are told. */
  lead: string;
  /** W2: what each story holds (it never opens with the tagline's words, and the lead already says how they are told). */
  intro: string;
  /** The line that invites a choice among the thirty. */
  choose: string;
  /** W3, one line per figure under the name (today's landing's lines, until they are rewritten). */
  lines: Record<string, string>;
  /** The link from the stage to the figure's page with all its stories. */
  allStories: (count: number) => string;
  /** Said once to a screen reader after a swap. */
  nowShowing: (name: string) => string;
  /** The document's title while a figure is on the stage. */
  stageTitle: (name: string) => string;
  /** The row of thirty's accessible name. */
  rowLabel: string;
  /** The two buttons that turn the stage to the next or previous figure, with the name they lead to. */
  turnNext: (name: string) => string;
  turnPrevious: (name: string) => string;
  lab: {
    title: string;
    note: string;
    stage: string;
    thirty: string;
    moment: string;
    momentAgain: string;
    momentSmall: string;
    slots: string;
    slotEmpty: (n: number) => string;
    slotLink: (n: number) => string;
  };
}
