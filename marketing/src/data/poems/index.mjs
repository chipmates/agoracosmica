// Every hosted poem as one record, plus the tables the "Poems to read" page
// and the sitemap script read. The texts stay in the per-poet modules, which
// hold the only copy on the site.
// Plain ESM, not TypeScript: the Node sitemap script imports this module too.

import {
  dickinsonPoems,
  dickinsonFacsimileLeaves,
  dickinsonFacsimileSources,
  dickinsonOrder,
  dickinsonSourceNote,
} from './dickinson.mjs';
import { blakePoems, blakeGroups, blakeOrder, blakeSourceNote } from './blake.mjs';
import {
  shakespearePoems,
  shakespeareSonnets,
  shakespeareOrder,
  shakespeareSourceNote,
} from './shakespeare.mjs';

/** The one switch for the poem pages' crawl status: the robots meta on every
 *  page and their sitemap membership both read it, so the gate is one line. */
export const POEM_PAGES_INDEXABLE = false;

/** A poem counts as short at or under this many verse lines. */
export const SHORT_POEM_MAX_LINES = 12;

/** The index page's own path. */
export const POEM_INDEX_PATH = '/poems';

export const poets = {
  dickinson: {
    id: 'dickinson',
    name: 'Emily Dickinson',
    dates: '1830-1886',
    birthDate: '1830-12-10',
    deathDate: '1886-05-15',
    sameAs: [
      'https://en.wikipedia.org/wiki/Emily_Dickinson',
      'https://www.wikidata.org/wiki/Q4441',
    ],
    figurePath: '/figures/emily-dickinson/',
    collectionPath: '/figures/emily-dickinson/poems/',
    collectionLabel: 'Poems',
    moreLabel: 'More poems by Emily Dickinson',
    eyebrow: 'In her own words',
    door: {
      href: '/app?figure=emily-dickinson&lang=en&ask=f:dickinson:4',
      label: 'Ask her Echo about it',
      shapedBy: 'her poems and letters',
    },
    sourceNote: dickinsonSourceNote,
  },
  blake: {
    id: 'blake',
    name: 'William Blake',
    dates: '1757-1827',
    birthDate: '1757-11-28',
    deathDate: '1827-08-12',
    sameAs: ['https://en.wikipedia.org/wiki/William_Blake', 'https://www.wikidata.org/wiki/Q41513'],
    figurePath: '/figures/william-blake/',
    collectionPath: '/figures/william-blake/poems/',
    collectionLabel: 'Poems',
    moreLabel: 'More poems by William Blake',
    eyebrow: 'In his own words',
    door: {
      href: '/app?figure=william-blake&lang=en&ask=f:blake:4',
      label: 'Ask his Echo about it',
      shapedBy: 'his real work',
    },
    sourceNote: blakeSourceNote,
  },
  shakespeare: {
    id: 'shakespeare',
    name: 'William Shakespeare',
    dates: '1564-1616',
    birthDate: '1564-04',
    deathDate: '1616-04-23',
    sameAs: [
      'https://en.wikipedia.org/wiki/William_Shakespeare',
      'https://www.wikidata.org/wiki/Q692',
    ],
    figurePath: '/figures/william-shakespeare/',
    collectionPath: '/figures/william-shakespeare/sonnets/',
    collectionLabel: 'Sonnets',
    moreLabel: 'More sonnets by William Shakespeare',
    eyebrow: 'In his own words',
    // Slot 4 of the app's ask contract: the poem question, no anchor seed.
    door: {
      href: '/app?figure=william-shakespeare&lang=en&ask=f:shakespeare:4',
      label: 'Ask his Echo about it',
      shapedBy: 'his real work',
    },
    sourceNote: shakespeareSourceNote,
  },
};

const verseLines = (text) => text.split('\n').filter((line) => line.trim()).length;

const firstVerseLine = (text) => (text.split('\n').find((line) => line.trim()) || '').trim();

const dickinsonRecords = dickinsonOrder.map(({ key, slug }) => {
  const poem = dickinsonPoems[key];
  return {
    poet: 'dickinson',
    key,
    slug,
    path: `${poets.dickinson.collectionPath}${slug}/`,
    title: poem.firstLine,
    metaTitle: `${poem.firstLine} by Emily Dickinson`,
    description: `The full text of "${poem.firstLine}" by Emily Dickinson, as she wrote it, with her dashes kept.`,
    firstLine: poem.firstLine,
    text: poem.text,
    intro: '',
    collectionLine: '',
    lineCount: verseLines(poem.text),
    manuscript: dickinsonFacsimileLeaves[key]
      ? { leaves: dickinsonFacsimileLeaves[key], ...dickinsonFacsimileSources[key] }
      : null,
  };
});

const blakeByKey = new Map(
  blakeGroups.flatMap((group) => group.poems.map((poem) => [poem.key, { group, poem }])),
);
const blakeRecords = blakeOrder.map(({ key, slug }) => {
  const { group, poem } = blakeByKey.get(key);
  const text = blakePoems[key].text;
  // Two poems share the title "The Chimney Sweeper", so the half of the book
  // they come from keeps their titles apart in a search result.
  const half = group.id === 'innocence' ? 'Innocence' : 'Experience';
  const sameTitle = blakeOrder.filter(
    (other) => blakeByKey.get(other.key).poem.title === poem.title,
  ).length;
  const metaName = sameTitle > 1 ? `${poem.title} (${half})` : poem.title;
  return {
    poet: 'blake',
    key,
    slug,
    path: `${poets.blake.collectionPath}${slug}/`,
    title: poem.title,
    metaTitle: `${metaName} by William Blake`,
    description: `The full text of "${poem.title}" by William Blake, from ${group.title.replace('From ', '')}, free to read.`,
    firstLine: firstVerseLine(text),
    text,
    intro: poem.intro,
    collectionLine: group.title,
    lineCount: verseLines(text),
    manuscript: null,
  };
});

const sonnetByKey = new Map(shakespeareSonnets.map((sonnet) => [sonnet.key, sonnet]));
const shakespeareRecords = shakespeareOrder.map(({ key, slug }) => {
  const sonnet = sonnetByKey.get(key);
  const text = shakespearePoems[key].text;
  return {
    poet: 'shakespeare',
    key,
    slug,
    path: `${poets.shakespeare.collectionPath}${slug}/`,
    title: `Sonnet ${sonnet.num}`,
    metaTitle: `Sonnet ${sonnet.num} by William Shakespeare`,
    description: `The full text of Sonnet ${sonnet.num} by William Shakespeare, "${sonnet.firstLine}", free to read.`,
    firstLine: sonnet.firstLine,
    text,
    intro: sonnet.intro,
    // The number already says which book it comes from, so the by-line stays
    // one line on a phone.
    collectionLine: '',
    lineCount: verseLines(text),
    manuscript: null,
  };
});

/** Every hosted poem, in each collection page's reading order. */
export const poems = [...dickinsonRecords, ...blakeRecords, ...shakespeareRecords];

const byRef = new Map(poems.map((poem) => [`${poem.poet}:${poem.key}`, poem]));

/** The poems of one poet, in reading order. Prev and next follow this list. */
export const poemsByPoet = (poetId) => poems.filter((poem) => poem.poet === poetId);

/** The poem named by a `<poet>:<key>` reference. */
export const poemByRef = (ref) => byRef.get(ref) || null;

// The index page's sections. Each one is a list of `<poet>:<key>` references,
// so moving a poem between themes is a single line. `short` is computed from
// the line counts instead, and `famous` is the fixed order the ads name.
const SECTION_REFS = {
  famous: [
    'dickinson:chariot',
    'dickinson:hope',
    'dickinson:nobody',
    'dickinson:dying',
    'dickinson:tellslant',
    'dickinson:wildnights',
    'blake:tyger',
    'blake:lamb',
    'blake:london',
    'blake:poisontree',
    'blake:sickrose',
    'shakespeare:s18',
    'shakespeare:s29',
    'shakespeare:s116',
    'shakespeare:s130',
  ],
  death: [
    'dickinson:chariot',
    'dickinson:dying',
    'dickinson:alabaster',
    'dickinson:funeral',
    'shakespeare:s73',
    'shakespeare:s30',
    'shakespeare:s60',
    'shakespeare:s65',
  ],
  love: [
    'shakespeare:s18',
    'shakespeare:s116',
    'shakespeare:s130',
    'shakespeare:s29',
    'dickinson:wildnights',
    'blake:clodpebble',
    'blake:gardenlove',
    'blake:sickrose',
  ],
  nature: [
    'blake:tyger',
    'blake:lamb',
    'dickinson:snake',
    'dickinson:garden',
    'blake:introduction',
  ],
  hope: [
    'dickinson:hope',
    'dickinson:success',
    'dickinson:nobody',
    'dickinson:exclusion',
    'dickinson:letter',
    'dickinson:loadedgun',
    'dickinson:brain',
    'dickinson:tellslant',
    'dickinson:frigate',
    'dickinson:slant',
    'blake:infantjoy',
    'blake:divine',
    'blake:chimneyi',
  ],
};

/** The index page's sections, in page order. The heading ids are stable:
 *  ad links point at them. */
export const poemSections = [
  {
    id: 'short',
    title: 'Short poems',
    navLabel: 'Short poems',
    blurb: 'Twelve lines or fewer, each one whole, nothing cut.',
    poems: poems.filter((poem) => poem.lineCount <= SHORT_POEM_MAX_LINES),
  },
  {
    id: 'famous',
    title: 'Famous poems',
    navLabel: 'Famous poems',
    blurb: 'The ones people come looking for.',
    poems: SECTION_REFS.famous.map(poemByRef),
  },
  {
    id: 'death',
    title: 'Poems about death',
    navLabel: 'Death',
    blurb: 'What the end looks like from close up, and what might be on the other side.',
    poems: SECTION_REFS.death.map(poemByRef),
  },
  {
    id: 'love',
    title: 'Poems about love',
    navLabel: 'Love',
    blurb: 'Love promised, love argued with, love looked at without flattery.',
    poems: SECTION_REFS.love.map(poemByRef),
  },
  {
    id: 'nature',
    title: 'Poems about nature',
    navLabel: 'Nature',
    blurb: 'A snake in the grass, a bird on the path, a tiger burning in the dark.',
    poems: SECTION_REFS.nature.map(poemByRef),
  },
  {
    id: 'hope',
    title: 'Poems about hope and the inner life',
    navLabel: 'Hope and the inner life',
    blurb: 'Hope that keeps singing in bad weather, and the private life it belongs to.',
    poems: SECTION_REFS.hope.map(poemByRef),
  },
];

/** Every route this data adds, for the sitemap script. */
export const poemRoutes = [POEM_INDEX_PATH, ...poems.map((poem) => poem.path)];
