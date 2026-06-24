// Data for the broadest LEARN hub (/learn-from-historical-figures, EN + the
// /de/von-historischen-persoenlichkeiten-lernen twin). Moved out of
// WisdomHubContent.astro because Astro's frontmatter export-hoisting chokes on
// multi-line `export const`/`export function` declarations inside a .astro
// component. Keeping these in a plain .ts module lets both the route and the
// content component import the SAME theme ids and FAQ array, so the visible
// render and the faqSchema() JSON-LD can never drift.
//
// House style: no em/en dashes, no semicolons in user-facing copy, and every
// answer stays inside the locked trust signals ("30 free messages a day",
// "no tracking cookies, no profiling", never bare "Free" or "Private").
import type { Lang } from '../i18n';

// The 8 themes, in catalog order. ids match the /themes/{id}/ routes.
export const HUB_THEME_IDS = [
  'who-am-i',
  'love-connection',
  'meaning-purpose',
  'mind-creativity',
  'moral-life',
  'freedom-justice',
  'faith-death-mystery',
  'loss-grief',
] as const;

export interface WisdomFaqEntry {
  q: string;
  a: string;
}

// The 4 FAQ entries, defined once and rendered both visibly and into
// faqSchema() in the route, so DOM and JSON-LD can never drift. The answers are
// fact-clean and stay inside the locked trust signals.
export function getWisdomFaq(lang: Lang): WisdomFaqEntry[] {
  if (lang === 'de') {
    return [
      {
        q: 'Wie lernt man am besten Weisheit von Persönlichkeiten der Geschichte?',
        a: 'Lies oder hör erst, was sie wirklich gedacht haben, und denk dann selbst weiter. Bei Agora Cosmica beginnt jeder Mensch mit einer erzählten Lebensgeschichte und zwölf Kernlehren, beide in seinem echten Werk verankert. Danach kannst du eine Lehre durchdenken, indem du mit dem KI-Echo dieses Menschen sprichst. Das Echo ist eine Deutung, klar als solche gekennzeichnet, nie eine Aufnahme und nie die echte Person.',
      },
      {
        q: 'Ist alte Weisheit heute noch relevant?',
        a: 'Ja. Die Fragen ändern sich kaum: Wie soll ich leben, wie gehe ich mit Verlust um, was macht das Leben lebenswert. Marc Aurel schrieb auf einem Feldzug Notizen an sich selbst über genau diese Dinge, Laozi über das Handeln ohne Zwang. Die Umstände sind neu, die Lage des Menschen ist alt. Deshalb sind diese Lebensweisheiten weiter brauchbar.',
      },
      {
        q: 'Welche Persönlichkeiten und Themen sind dabei?',
        a: 'Dreißig Menschen aus rund 2.500 Jahren, aus Ost und West: Philosophen, Wissenschaftlerinnen, Künstler, Aktivistinnen und Mystiker, von Laozi und Platon bis Ada Lovelace, Frida Kahlo und Maya Angelou. Sie sind in acht Themen geordnet, von Wer bin ich über das moralische Leben bis Verlust und Trauer.',
      },
      {
        q: 'Ist die Nutzung kostenlos?',
        a: '30 kostenlose Nachrichten pro Tag, ohne Anmeldung. Willst du mehr, bring deinen eigenen OpenRouter-Schlüssel mit. Die ganze Plattform ist quelloffen unter der AGPL-3.0, gemeinnützig, und es gibt keine Tracking-Cookies und keine Profile darüber, wer du bist.',
      },
    ];
  }
  return [
    {
      q: 'What is the best way to learn wisdom from history?',
      a: 'Start with what a person actually thought, then think it through yourself. In Agora Cosmica every figure opens with a narrated life story and twelve core teachings, both grounded in their real work. From there you can work an idea through by talking with that figure\'s AI Echo. The Echo is an interpretation, clearly labeled as such, never a recording and never the real person.',
    },
    {
      q: 'Is ancient wisdom still relevant today?',
      a: 'Yes. The questions barely change: how should I live, how do I carry loss, what makes a life worth living. Marcus Aurelius wrote private notes to himself about exactly these things on a frontier campaign, and Laozi wrote about acting without forcing. The circumstances are new, the human situation is old. That is why this timeless wisdom still works.',
    },
    {
      q: 'Which figures and themes are included?',
      a: 'Thirty figures across roughly 2,500 years, East and West: philosophers, scientists, artists, activists, and mystics, from Laozi and Plato to Ada Lovelace, Frida Kahlo, and Maya Angelou. They are grouped into eight themes, from Who Am I through The Moral Life to Loss and Grief.',
    },
    {
      q: 'Is it free to use?',
      a: 'You get 30 free messages a day with no signup. Want more, bring your own OpenRouter key. The whole platform is open source under AGPL-3.0 and nonprofit, with no tracking cookies and no profiles of who you are.',
    },
  ];
}
