// Era strata for the /figures browse index — the five bands the thirty are
// sorted into, newest birth year first. Kept in a plain .ts module (not the
// .astro frontmatter) because Astro's export-hoisting chokes on multi-line
// `export const` inside a component, and because both index routes plus the
// descent component need the SAME data for the visible render and the JSON-LD.
//
// Band membership is fixed by BIRTH YEAR (4/4/8/8/6 read from the floor up).
// Three bands reuse the bilingual shell copy from the Orrery Well prototype
// verbatim; band II merges two shells into one caption, band III is the one
// new name and caption covering the Renaissance and the Enlightenment.
//
// House style: no em/en dashes, no semicolons in displayed copy, everyday
// words, short sentences. Life-year strings are display-shortened from the
// catalog's verified `period` field and never sharpen a date the record
// leaves open ("about", "century" stay).
import type { Lang } from '../i18n';

export interface StratumCopy {
  /** Band name, doubles as the H2 the era queries land on. */
  name: string;
  /** Chip label in the era bar. German runs long, six chips have to fit. */
  short: string;
  /** Year span, shown next to the numeral and in the sticky depth gauge. */
  span: string;
  /** One-line pull quote under the band name. */
  caption: string;
  /** 3 to 4 short sentences. The only era-level prose on the site. */
  era: string;
}

export interface Stratum {
  /** Anchor target for the jump nav. */
  id: string;
  num: string;
  /** Figure ids, ordered by descending birth year. */
  figures: string[];
  /** The band's app door: this figure's own entry question, ask slot 1. */
  door: string;
  en: StratumCopy;
  de: StratumCopy;
}

export const STRATA: Stratum[] = [
  {
    id: 'modern',
    num: 'I',
    figures: ['king', 'angelou', 'mandela', 'beauvoir', 'kahlo', 'campbell'],
    door: 'kahlo',
    en: {
      name: 'The Modern Voices',
      short: 'Modern Voices',
      span: '1900 to today',
      caption: 'Close enough to touch. Their questions are still open.',
      era: 'Six people born in the twentieth century. They came through war, prison, illness and protest, and they wrote about it while it was still happening. That is why their answers still sound like they were meant for this week.',
    },
    de: {
      name: 'Die modernen Stimmen',
      short: 'Moderne Stimmen',
      span: '1900 bis heute',
      caption: 'Nah genug, um sie zu berühren. Ihre Fragen sind noch offen.',
      era: 'Sechs Menschen, geboren im zwanzigsten Jahrhundert. Sie kamen durch Krieg, Gefängnis, Krankheit und Protest, und sie schrieben darüber, während es noch geschah. Deshalb klingen ihre Antworten, als wären sie für diese Woche gemeint.',
    },
  },
  {
    id: 'steam',
    num: 'II',
    figures: ['woolf', 'einstein', 'jung', 'gandhi', 'nietzsche', 'dickinson', 'tubman', 'lovelace'],
    door: 'jung',
    en: {
      name: 'The Age of Steam and Ink',
      short: 'Steam and Ink',
      span: '1800 to 1900',
      caption: 'Machines got faster and so did life. These eight wrote by hand and asked what a person is underneath.',
      era: 'Trains, factories and the first computer program. In one century a poet in her bedroom, a woman leading people out of slavery and a doctor mapping dreams were all working on the same problem. What is a person made of when the old certainties stop holding?',
    },
    de: {
      name: 'Das Zeitalter von Dampf und Tinte',
      short: 'Dampf und Tinte',
      span: '1800 bis 1900',
      caption: 'Die Maschinen wurden schneller, und das Leben auch. Diese acht schrieben mit der Hand und fragten, was ein Mensch darunter ist.',
      era: 'Züge, Fabriken und das erste Computerprogramm. In einem Jahrhundert arbeiteten eine Dichterin in ihrem Zimmer, eine Frau, die Menschen aus der Sklaverei führte, und ein Arzt, der Träume kartierte, am selben Problem. Woraus besteht ein Mensch, wenn die alten Gewissheiten nicht mehr tragen?',
    },
  },
  {
    id: 'enlightenment',
    num: 'III',
    figures: ['schopenhauer', 'austen', 'blake', 'mozart', 'goethe', 'galilei', 'shakespeare', 'vinci'],
    door: 'vinci',
    en: {
      name: 'Enlightenment and Renaissance',
      short: 'Enlightenment',
      span: '1450 to 1800',
      caption: 'People started looking again and drew what they really saw. Then reason and feeling argued it out in the same rooms.',
      era: 'Three and a half centuries and the biggest shift in how Europe looked at the world. A painter took a body apart to learn how an arm moves. An astronomer pointed a new glass at the moon. All eight trained the same thing, attention.',
    },
    de: {
      name: 'Aufklärung und Renaissance',
      short: 'Aufklärung',
      span: '1450 bis 1800',
      caption: 'Menschen begannen wieder hinzusehen und zeichneten, was sie wirklich sahen. Dann fochten Vernunft und Gefühl es in denselben Räumen aus.',
      era: 'Dreieinhalb Jahrhunderte, und der größte Umbruch darin, wie Europa auf die Welt sah. Ein Maler zerlegte einen Körper, um zu lernen, wie ein Arm sich bewegt. Ein Astronom richtete ein neues Glas auf den Mond. Alle acht übten dasselbe, das Hinsehen.',
    },
  },
  {
    id: 'mystics',
    num: 'IV',
    figures: ['eckhart', 'rumi', 'zenji', 'bingen'],
    door: 'rumi',
    en: {
      name: 'The Mystics',
      short: 'Mystics',
      span: '1000 to 1450',
      caption: 'Silence, light, and a longing that outlives its language.',
      era: 'Four people from four traditions who never met. Two are German mystics, Hildegard von Bingen and Meister Eckhart. The other two are a Persian poet and a Japanese Zen master. They describe the same thing in different words, a stillness under the noise.',
    },
    de: {
      name: 'Die Mystiker',
      short: 'Mystiker',
      span: '1000 bis 1450',
      caption: 'Stille, Licht und eine Sehnsucht, die ihre Sprache überdauert.',
      era: 'Vier Menschen aus vier Traditionen, die sich nie begegnet sind. Zwei davon sind deutsche Mystiker, Hildegard von Bingen und Meister Eckhart. Die anderen beiden sind ein persischer Dichter und ein japanischer Zen-Meister. Sie beschreiben dasselbe mit anderen Worten, eine Stille unter dem Lärm.',
    },
  },
  {
    id: 'antiquity',
    num: 'V',
    figures: ['aurelius', 'plato', 'gautama', 'laozi'],
    door: 'aurelius',
    en: {
      name: 'Antiquity',
      short: 'Antiquity',
      span: 'before 1000',
      caption: 'The oldest questions, asked first, and never finished.',
      era: 'The floor of the well. Four voices from China, India, Greece and Rome, spread over seven hundred years and half the planet. They had no idea the others existed. All four asked how to live with a mind that will not sit still.',
    },
    de: {
      name: 'Die Antike',
      short: 'Antike',
      span: 'vor 1000',
      caption: 'Die ältesten Fragen, zuerst gestellt und nie beendet.',
      era: 'Der Grund des Brunnens. Vier Stimmen aus China, Indien, Griechenland und Rom, über siebenhundert Jahre und den halben Planeten verteilt. Sie wussten nichts voneinander. Alle vier fragten, wie man mit einem Kopf lebt, der nicht stillhalten will.',
    },
  },
];

/** Short display lifespans, shortened from the catalog's verified `period`. */
export const LIFE_YEARS: Record<string, { en: string; de: string }> = {
  angelou: { en: '1928 to 2014', de: '1928 bis 2014' },
  aurelius: { en: '121 to 180', de: '121 bis 180' },
  austen: { en: '1775 to 1817', de: '1775 bis 1817' },
  beauvoir: { en: '1908 to 1986', de: '1908 bis 1986' },
  bingen: { en: '1098 to 1179', de: '1098 bis 1179' },
  blake: { en: '1757 to 1827', de: '1757 bis 1827' },
  campbell: { en: '1904 to 1987', de: '1904 bis 1987' },
  dickinson: { en: '1830 to 1886', de: '1830 bis 1886' },
  eckhart: { en: 'about 1260 to 1328', de: 'etwa 1260 bis 1328' },
  einstein: { en: '1879 to 1955', de: '1879 bis 1955' },
  galilei: { en: '1564 to 1642', de: '1564 bis 1642' },
  gandhi: { en: '1869 to 1948', de: '1869 bis 1948' },
  gautama: { en: '5th century BCE', de: '5. Jahrhundert v. Chr.' },
  goethe: { en: '1749 to 1832', de: '1749 bis 1832' },
  jung: { en: '1875 to 1961', de: '1875 bis 1961' },
  kahlo: { en: '1907 to 1954', de: '1907 bis 1954' },
  king: { en: '1929 to 1968', de: '1929 bis 1968' },
  laozi: { en: 'China, 25 centuries ago', de: 'China, vor 25 Jahrhunderten' },
  lovelace: { en: '1815 to 1852', de: '1815 bis 1852' },
  mandela: { en: '1918 to 2013', de: '1918 bis 2013' },
  mozart: { en: '1756 to 1791', de: '1756 bis 1791' },
  nietzsche: { en: '1844 to 1900', de: '1844 bis 1900' },
  plato: { en: 'about 428 to 347 BCE', de: 'etwa 428 bis 347 v. Chr.' },
  rumi: { en: '1207 to 1273', de: '1207 bis 1273' },
  schopenhauer: { en: '1788 to 1860', de: '1788 bis 1860' },
  shakespeare: { en: '1564 to 1616', de: '1564 bis 1616' },
  tubman: { en: 'about 1822 to 1913', de: 'etwa 1822 bis 1913' },
  vinci: { en: '1452 to 1519', de: '1452 bis 1519' },
  woolf: { en: '1882 to 1941', de: '1882 bis 1941' },
  zenji: { en: '1200 to 1253', de: '1200 bis 1253' },
};

export interface TraditionCluster {
  id: string;
  figures: string[];
  en: { name: string; line: string };
  de: { name: string; line: string };
}

/** The second cross cut under the descent: nine clusters, figures repeat. */
export const TRADITION_CLUSTERS: TraditionCluster[] = [
  {
    id: 'mysticism',
    figures: ['bingen', 'eckhart', 'rumi', 'zenji'],
    en: {
      name: 'Mysticism',
      line: 'The German mystics Hildegard von Bingen and Meister Eckhart, next to a Sufi poet and a Zen master. All four went looking for the same silence.',
    },
    de: {
      name: 'Mystik',
      line: 'Die deutschen Mystiker Hildegard von Bingen und Meister Eckhart, daneben ein Sufi-Dichter und ein Zen-Meister. Alle vier suchten dieselbe Stille.',
    },
  },
  {
    id: 'antiquity-stoicism',
    figures: ['aurelius', 'plato', 'gautama', 'laozi'],
    en: {
      name: 'Antiquity and Stoicism',
      line: 'The oldest four. A Roman emperor writing notes to himself, a Greek asking impossible questions, and two teachers from Asia who said less and meant more.',
    },
    de: {
      name: 'Antike und Stoizismus',
      line: 'Die ältesten vier. Ein römischer Kaiser, der Notizen an sich selbst schreibt, ein Grieche mit unmöglichen Fragen und zwei Lehrer aus Asien, die weniger sagten und mehr meinten.',
    },
  },
  {
    id: 'poetry',
    figures: ['angelou', 'dickinson', 'blake', 'rumi'],
    en: {
      name: 'Poetry',
      line: 'Four poets, among them the visionary poet William Blake and a recluse from Amherst who published almost nothing while she lived.',
    },
    de: {
      name: 'Poesie',
      line: 'Vier Dichter, darunter der visionäre Dichter William Blake und eine Zurückgezogene aus Amherst, die zu Lebzeiten fast nichts veröffentlichte.',
    },
  },
  {
    id: 'philosophy',
    figures: ['beauvoir', 'nietzsche', 'schopenhauer', 'plato'],
    en: {
      name: 'Philosophy',
      line: 'The people who took the questions apart. Meaning, will, freedom and the examined life, argued without a safety net.',
    },
    de: {
      name: 'Philosophie',
      line: 'Die Menschen, die die Fragen auseinandergenommen haben. Sinn, Wille, Freiheit und das geprüfte Leben, ohne Netz durchdacht.',
    },
  },
  {
    id: 'science',
    figures: ['einstein', 'lovelace', 'galilei', 'vinci'],
    en: {
      name: 'Science and Nature',
      line: 'Four ways of looking closely. A telescope, a notebook of drawings, the first computer program and a thought experiment about light.',
    },
    de: {
      name: 'Wissenschaft und Natur',
      line: 'Vier Arten, genau hinzusehen. Ein Fernrohr, ein Skizzenbuch, das erste Computerprogramm und ein Gedankenexperiment über Licht.',
    },
  },
  {
    id: 'liberation',
    figures: ['king', 'mandela', 'tubman', 'gandhi'],
    en: {
      name: 'Liberation and Justice',
      line: 'Four people who refused, and who worked out how to refuse without becoming the thing they fought.',
    },
    de: {
      name: 'Befreiung und Gerechtigkeit',
      line: 'Vier Menschen, die sich verweigert haben und herausfanden, wie man das tut, ohne zu werden, wogegen man kämpft.',
    },
  },
  {
    id: 'psychology-myth',
    figures: ['jung', 'campbell'],
    en: {
      name: 'Psychology and Myth',
      line: 'The inner map. One traced the parts of yourself you disown, the other found the same story in every culture on earth.',
    },
    de: {
      name: 'Psychologie und Mythos',
      line: 'Die innere Karte. Der eine verfolgte die Teile von dir, die du nicht haben willst, der andere fand dieselbe Geschichte in jeder Kultur der Erde.',
    },
  },
  {
    id: 'music-art',
    figures: ['kahlo', 'mozart', 'vinci'],
    en: {
      name: 'Music and Art',
      line: 'Form and feeling. A composer inside strict rules, a painter who made her own injuries the subject, and a man who drew everything he saw.',
    },
    de: {
      name: 'Musik und Kunst',
      line: 'Form und Gefühl. Ein Komponist in strengen Regeln, eine Malerin, die ihre eigenen Verletzungen zum Thema machte, und ein Mann, der alles zeichnete, was er sah.',
    },
  },
  {
    id: 'literature',
    figures: ['shakespeare', 'austen', 'woolf', 'goethe'],
    en: {
      name: 'Literature',
      line: 'Four writers who watch people for a living. What they notice is the part nobody says out loud.',
    },
    de: {
      name: 'Literatur',
      line: 'Vier Schriftsteller, die Menschen beobachten. Was sie bemerken, ist genau das, was niemand ausspricht.',
    },
  },
];

/** Labels for the descent, jump nav, tradition block, closers. */
export interface StrataUi {
  navLabel: string;
  navAria: string;
  azLabel: string;
  azHeading: string;
  azLead: string;
  descentHeading: string;
  depthLabel: string;
  surface: string;
  bandLabel: string;
  voicesLabel: string;
  doorLead: string;
  doorCta: string;
  traditionsHeading: string;
  traditionsLead: string;
  themesHeading: string;
  themesLead: string;
  faqHeading: string;
  moreHeading: string;
  moreEchoes: string;
  moreMethod: string;
  moreThemes: string;
}

export function getStrataUi(lang: Lang): StrataUi {
  if (lang === 'de') {
    return {
      navLabel: 'Epochen',
      navAria: 'Zu einer Epoche springen',
      azLabel: 'A bis Z',
      azHeading: 'Alle dreißig von A bis Z',
      azLead: 'Öffne einen Namen und entdecke das Leben und die Ideen dahinter.',
      descentHeading: 'Der Abstieg durch die Zeit',
      depthLabel: 'Tiefe',
      surface: 'Oberfläche',
      bandLabel: 'Epoche',
      voicesLabel: 'Stimmen aus dieser Epoche',
      doorLead: 'Eine Frage aus dieser Epoche wartet schon.',
      doorCta: 'Diese Frage stellen',
      traditionsHeading: 'Nach Tradition stöbern',
      traditionsLead: 'Derselbe Kreis, anders geschnitten. Neun Gruppen, manche Namen tauchen zweimal auf.',
      themesHeading: 'Oder fang mit einer Frage an',
      themesLead: 'Acht Themen, jedes mit einer Frage und den Stimmen, die darauf antworten.',
      faqHeading: 'Häufige Fragen',
      moreHeading: 'Weiterlesen',
      moreEchoes: 'Warum wir sie Echos nennen',
      moreMethod: 'Wie wir arbeiten und was wir prüfen',
      moreThemes: 'Alle acht Themen ansehen',
    };
  }
  return {
    navLabel: 'Eras',
    navAria: 'Jump to an era',
    azLabel: 'A to Z',
    azHeading: 'All thirty, A to Z',
    azLead: 'Open any name to explore their life and ideas.',
    descentHeading: 'The descent through time',
    depthLabel: 'Depth',
    surface: 'Surface',
    bandLabel: 'Era',
    voicesLabel: 'Voices from this era',
    doorLead: 'One question from this era is already waiting.',
    doorCta: 'Ask this question',
    traditionsHeading: 'Browse by tradition',
    traditionsLead: 'The same circle, cut a different way. Nine groups, and a few names show up twice.',
    themesHeading: 'Or start from a question',
    themesLead: 'Eight themes, each with a question and the voices that answer it.',
    faqHeading: 'Questions people ask',
    moreHeading: 'Read on',
    moreEchoes: 'Why we call them Echoes',
    moreMethod: 'How we work and what we check',
    moreThemes: 'See all eight themes',
  };
}

export interface FaqEntry {
  q: string;
  a: string;
}

/**
 * The index FAQ. Three entries are lifted from the broad LEARN hub (which this
 * page absorbs) and one is written for this page: `who are the 30` is a live
 * search query sitting at position 1 with no answer block behind it.
 */
export function getFiguresFaq(lang: Lang): FaqEntry[] {
  if (lang === 'de') {
    return [
      {
        q: 'Wer sind die 30 Menschen?',
        a: 'Dreißig Menschen aus rund 2.500 Jahren, aus Ost und West: Philosophen, Wissenschaftlerinnen, Künstler, Aktivistinnen und Mystiker. Von Laozi, Siddhartha Gautama, Platon und Mark Aurel in der Antike über die Mystiker Hildegard von Bingen, Rumi, Dōgen Zenji und Meister Eckhart bis zu Frida Kahlo, Maya Angelou, Nelson Mandela und Martin Luther King Jr. im zwanzigsten Jahrhundert.',
      },
      {
        q: 'Ist alte Weisheit heute noch relevant?',
        a: 'Ja. Die Fragen ändern sich kaum: Wie soll ich leben, wie gehe ich mit Verlust um, was macht das Leben lebenswert. Mark Aurel schrieb auf einem Feldzug Notizen an sich selbst über genau diese Dinge, Laozi über das Handeln ohne Zwang. Die Umstände sind neu, die Lage des Menschen ist alt. Deshalb sind diese Lebensweisheiten weiter brauchbar.',
      },
      {
        q: 'Wie lernt man am besten Weisheit von Persönlichkeiten der Geschichte?',
        a: 'Lies oder hör erst, was sie wirklich gedacht haben, und denk dann selbst weiter. Bei Agora Cosmica beginnt jeder Mensch mit einer erzählten Lebensgeschichte und zwölf Kernlehren, beide in seinem echten Werk verankert. Danach kannst du eine Lehre durchdenken, indem du mit dem KI-Echo dieses Menschen sprichst. Das Echo ist eine Deutung, klar als solche gekennzeichnet, nie eine Aufnahme und nie die echte Person.',
      },
      {
        q: 'Ist die Nutzung kostenlos?',
        a: '30 kostenlose Nachrichten pro Tag, ohne Anmeldung. Willst du mehr, bring deinen eigenen OpenRouter-Schlüssel mit. Die ganze Plattform ist quelloffen unter der AGPL-3.0, gemeinnützig, und es gibt keine Tracking-Cookies und keine Profile darüber, wer du bist.',
      },
    ];
  }
  return [
    {
      q: 'Who are the 30 figures?',
      a: 'Thirty people across roughly 2,500 years, East and West: philosophers, scientists, artists, activists, and mystics. From Laozi, Siddhartha Gautama, Plato, and Marcus Aurelius in antiquity, through the mystics Hildegard von Bingen, Rumi, Dōgen Zenji, and Meister Eckhart, to Frida Kahlo, Maya Angelou, Nelson Mandela, and Martin Luther King Jr. in the twentieth century.',
    },
    {
      q: 'Is ancient wisdom still relevant today?',
      a: 'Yes. The questions barely change: how should I live, how do I carry loss, what makes a life worth living. Marcus Aurelius wrote private notes to himself about exactly these things on a frontier campaign, and Laozi wrote about acting without forcing. The circumstances are new, the human situation is old. That is why this timeless wisdom still works.',
    },
    {
      q: 'What is the best way to learn wisdom from history?',
      a: 'Start with what a person actually thought, then think it through yourself. In Agora Cosmica every figure opens with a narrated life story and twelve core teachings, both grounded in their real work. From there you can work an idea through by talking with that figure\'s AI Echo. The Echo is an interpretation, clearly labeled as such, never a recording and never the real person.',
    },
    {
      q: 'Is it free to use?',
      a: 'You get 30 free messages a day with no signup. Want more, bring your own OpenRouter key. The whole platform is open source under AGPL-3.0 and nonprofit, with no tracking cookies and no profiles of who you are.',
    },
  ];
}

/** The 40 to 80 word answer block, first paragraph after the H1. */
export function getIndexAnswer(lang: Lang): string {
  return lang === 'de'
    ? 'Dreißig Menschen, von Laozi vor fünfundzwanzig Jahrhunderten bis zu Maya Angelou, die viele noch selbst erlebt haben. Philosophen, Wissenschaftlerinnen, Künstler, Aktivistinnen und Mystiker, aus Ost und West. Hier sind sie in fünf Epochen sortiert, von den modernen Stimmen oben bis zur Antike am Grund. Jeder Name öffnet eine Lebensgeschichte, zwölf Kernlehren und ein Gespräch, in das du einsteigen kannst.'
    : 'Thirty people, from Laozi twenty-five centuries ago to Maya Angelou in living memory. Philosophers, scientists, artists, activists and mystics, from East and West. They are sorted here into five eras, from the modern voices at the top down to antiquity at the floor. Every name opens a life story, twelve core teachings, and a conversation you can join.';
}

/**
 * CollectionPage + one positioned ItemList per era band. The page-level
 * ItemList (all thirty, alphabetical) stays untouched in the route, so the
 * existing rich result is not disturbed.
 */
export function strataSchemas(
  lang: Lang,
  canonical: string,
  title: string,
  description: string,
  figureUrl: (id: string) => string,
  figureName: (id: string) => string,
): Record<string, unknown>[] {
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonical}#collection`,
    url: canonical,
    name: title,
    description,
    inLanguage: lang,
    isPartOf: { '@id': 'https://agoracosmica.org/#website' },
    hasPart: STRATA.map((s) => ({ '@id': `${canonical}#${s.id}` })),
  };
  const bands = STRATA.map((s) => {
    const copy = s[lang];
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${canonical}#${s.id}`,
      name: `${copy.name}, ${copy.span}`,
      description: copy.caption,
      numberOfItems: s.figures.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: s.figures.map((id, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: figureName(id),
        url: figureUrl(id),
      })),
    };
  });
  return [collection, ...bands];
}
