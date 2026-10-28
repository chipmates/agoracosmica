// Per-figure words of a player page that the catalogs do not carry: who the
// figure was in one line (placeholders for the writer), and the figure's own
// deeper pages. A figure without a line falls back to the first sentence of
// its lead answer, which is already on the page.

import type { PlayerLang } from './strings';

export interface DeepLink {
  href: string;
  label: string;
  /** The concept heading the link sits under; without one it joins "who he was". */
  under?: string;
}

const HERO_LINES: Record<string, Record<PlayerLang, string>> = {
  aurelius: {
    en: 'Roman emperor and Stoic. He wrote the Meditations as notes to himself.',
    de: 'Römischer Kaiser und Stoiker. Die Selbstbetrachtungen schrieb er als Notizen an sich selbst.',
  },
  angelou: {
    en: 'American poet. She told her own life story in seven autobiographies.',
    de: 'Amerikanische Dichterin. Ihr Leben erzählte sie selbst, in sieben Autobiografien.',
  },
  austen: {
    en: 'English novelist. She finished six novels, Pride and Prejudice among them.',
    de: 'Englische Romanautorin. Sechs Romane vollendete sie, darunter „Stolz und Vorurteil“.',
  },
  beauvoir: {
    en: 'French philosopher. Her book The Second Sex is a founding text of modern feminism.',
    de: 'Französische Philosophin. Ihr Buch „Das andere Geschlecht“ steht am Anfang des modernen Feminismus.',
  },
  bingen: {
    en: 'German abbess and composer. She began to write down her visions at forty-three.',
    de: 'Deutsche Äbtissin und Komponistin. Ihre Visionen begann sie mit dreiundvierzig aufzuschreiben.',
  },
  blake: {
    en: 'English poet and painter. He printed his poems himself, by a method he had invented.',
    de: 'Englischer Dichter und Maler. Seine Gedichte druckte er selbst, mit einer Technik, die er erfunden hatte.',
  },
  campbell: {
    en: "American scholar of myth. In the world's myths he found one pattern, the hero's journey.",
    de: 'Amerikanischer Mythenforscher. In den Mythen der Welt erkannte er ein Muster, die Heldenreise.',
  },
  dickinson: {
    en: 'American poet. She wrote nearly eighteen hundred poems at home in Amherst.',
    de: 'Amerikanische Dichterin. Fast achtzehnhundert Gedichte schrieb sie zu Hause in Amherst.',
  },
  eckhart: {
    en: 'German Dominican and mystic. In his sermons the ground of the soul is the ground of God.',
    de: 'Deutscher Dominikaner und Mystiker. In seinen Predigten ist der Grund der Seele der Grund Gottes.',
  },
  einstein: {
    en: 'German-born physicist. His theory of relativity is a pillar of modern physics.',
    de: 'In Deutschland geborener Physiker. Seine Relativitätstheorie ist eine Säule der modernen Physik.',
  },
  galilei: {
    en: 'Italian astronomer. In 1610 he turned a telescope on Jupiter and found four moons.',
    de: 'Italienischer Astronom. Er richtete 1610 ein Fernrohr auf den Jupiter und fand vier Monde.',
  },
  gandhi: {
    en: 'Indian lawyer. By nonviolent resistance he led his country to independence.',
    de: 'Indischer Anwalt. Mit gewaltfreiem Widerstand führte er sein Land in die Unabhängigkeit.',
  },
  gautama: {
    en: 'Founder of Buddhism. He is said to have taught the way out of suffering for forty-five years.',
    de: 'Begründer des Buddhismus. Fünfundvierzig Jahre soll er den Weg aus dem Leiden gelehrt haben.',
  },
  goethe: {
    en: 'German poet. His Werther of 1774 made him the most famous writer in Europe.',
    de: 'Deutscher Dichter. Der Werther von 1774 machte ihn zum berühmtesten Schriftsteller Europas.',
  },
  jung: {
    en: 'Swiss psychiatrist. He founded analytical psychology and developed the concept of the archetype.',
    de: 'Schweizer Psychiater. Er begründete die Analytische Psychologie und entwickelte den Begriff Archetyp.',
  },
  kahlo: {
    en: 'Mexican artist. She painted her own reality, she said, not dreams.',
    de: 'Mexikanische Künstlerin. Sie malte ihre eigene Wirklichkeit, sagte sie, keine Träume.',
  },
  king: {
    en: 'American Baptist minister. He led the movement that ended legal segregation.',
    de: 'Amerikanischer Baptistenpfarrer. Er führte die Bewegung an, mit der die staatliche Rassentrennung endete.',
  },
  laozi: {
    en: 'Chinese philosopher. The Daodejing bears his name, and whether he ever lived, nobody knows.',
    de: 'Chinesischer Philosoph. Das Daodejing trägt seinen Namen, doch ob er je gelebt hat, weiß niemand.',
  },
  lovelace: {
    en: 'English mathematician. Her Notes of 1843 hold what is often seen as the first computer program.',
    de: 'Englische Mathematikerin. In ihren Notes von 1843 steht, was oft als erstes Computerprogramm gilt.',
  },
  mandela: {
    en: 'South African anti-apartheid leader. After twenty-seven years in prison he became President.',
    de: 'Südafrikanischer Anti-Apartheid-Kämpfer. Nach siebenundzwanzig Jahren Haft wurde er Präsident.',
  },
  mozart: {
    en: 'Austrian composer. He died at thirty-five, and his Requiem was left unfinished.',
    de: 'Österreichischer Komponist. Er starb mit fünfunddreißig, sein Requiem blieb unvollendet.',
  },
  nietzsche: {
    en: 'German philosopher. He traced morality back to its roots and wrote Thus Spoke Zarathustra.',
    de: 'Deutscher Philosoph. Er ging der Moral auf den Grund und schrieb „Also sprach Zarathustra“.',
  },
  plato: {
    en: 'Greek philosopher. For about fifty years he wrote dialogues in which he never speaks himself.',
    de: 'Griechischer Philosoph. Etwa fünfzig Jahre lang schrieb er Dialoge, in denen er selbst nie spricht.',
  },
  rumi: {
    en: 'Persian poet and Sufi. His grief for Shams, who vanished in 1247, became poems.',
    de: 'Persischer Dichter und Sufi. Seine Trauer um Shams, der 1247 verschwand, wurde zu Gedichten.',
  },
  schopenhauer: {
    en: 'German philosopher. Behind all existence he saw a blind will.',
    de: 'Deutscher Philosoph. Hinter allem Dasein sah er einen blinden Willen.',
  },
  shakespeare: {
    en: 'English playwright and poet. His plays survive, but no letter or diary of his.',
    de: 'Englischer Dramatiker und Dichter. Seine Stücke sind erhalten, aber kein Brief und kein Tagebuch.',
  },
  tubman: {
    en: 'American abolitionist. She escaped slavery and then rescued about seventy people.',
    de: 'Amerikanische Abolitionistin. Sie floh aus der Sklaverei und befreite danach etwa siebzig Menschen.',
  },
  vinci: {
    en: 'Italian polymath. He finished fewer than twenty paintings but filled thousands of pages with notes.',
    de: 'Italienischer Universalgelehrter. Er vollendete keine zwanzig Gemälde, füllte aber Tausende Seiten.',
  },
  woolf: {
    en: 'English writer. A woman, she wrote, needs money and a room of her own if she is to write fiction.',
    de: 'Englische Schriftstellerin. Für Literatur, schrieb sie, braucht eine Frau Geld und ein eigenes Zimmer.',
  },
  zenji: {
    en: 'Japanese Zen master. He founded the Sōtō school in his country and wrote the Shōbōgenzō.',
    de: 'Japanischer Zen-Meister. Er gründete die Sōtō-Schule in seinem Land und schrieb das Shōbōgenzō.',
  },
};

// The same links the figure template gives, plus the Meditations for German
// readers, marked as English, so both languages offer the same pages.
const DEEP_LINKS: Record<string, Record<PlayerLang, DeepLink[]>> = {
  aurelius: {
    en: [
      { href: '/figures/marcus-aurelius/meditations/', label: "Read the Meditations, in George Long's translation →" },
      { href: '/stoicism/', label: 'Stoicism, what it is and how people practice it →' },
      { href: '/figures/marcus-aurelius/meditations/', label: "Read the Meditations, in George Long's translation →", under: 'What is in the Meditations?' },
    ],
    de: [
      { href: '/figures/marcus-aurelius/meditations/', label: 'Die Selbstbetrachtungen auf Englisch lesen, übersetzt von George Long →' },
      { href: '/de/stoizismus/', label: 'Stoizismus, was er ist und wie man ihn übt →' },
    ],
  },
  blake: {
    en: [
      { href: '/figures/william-blake/poems/', label: "Read William Blake's poems →" },
      { href: '/figures/william-blake/poems/the-lamb/', label: 'Read The Lamb →', under: 'Which William Blake poems should I read first?' },
      { href: '/figures/william-blake/poems/the-tyger/', label: 'Read The Tyger →', under: 'Which William Blake poems should I read first?' },
      { href: '/figures/william-blake/poems/london/', label: 'Read London →', under: 'Which William Blake poems should I read first?' },
      { href: '/figures/william-blake/poems/a-poison-tree/', label: 'Read A Poison Tree →', under: 'Which William Blake poems should I read first?' },
      { href: '/figures/william-blake/poems/london/', label: 'Read London, the whole poem →', under: "What are Blake's mind-forged manacles?" },
    ],
    de: [],
  },
  campbell: {
    en: [{ href: '/the-heros-journey/', label: "The hero's journey, from call to return →" }],
    de: [{ href: '/de/heldenreise/', label: 'Die Heldenreise, vom Ruf bis zur Rückkehr →' }],
  },
  shakespeare: {
    en: [
      { href: '/figures/william-shakespeare/sonnets/', label: "Read Shakespeare's sonnets →" },
      { href: '/figures/william-shakespeare/quotes/', label: 'Famous Shakespeare quotes and what they mean →' },
    ],
    de: [],
  },
  rumi: {
    en: [{ href: '/figures/rumi/poems/', label: "Read Rumi's poems →" }],
    de: [],
  },
  plato: {
    en: [],
    de: [
      { href: '/de/figures/plato/hoehlengleichnis/', label: 'Das Höhlengleichnis, einfach erklärt →', under: 'Was ist das Höhlengleichnis?' },
      { href: '/de/figures/plato/ideenlehre/', label: 'Die Ideenlehre, und was Platon damit meinte →', under: 'Die Ideenlehre am Beispiel eines Kreises' },
    ],
  },
};

/** The figure's own writing on this site, offered under the plate. */
export interface OwnWords {
  href: string;
  label: string;
  /** A short note beside the link, on the same line (the text's language). */
  note?: string;
}

const OWN_WORDS: Record<string, Record<PlayerLang, OwnWords>> = {
  aurelius: {
    en: { href: '/figures/marcus-aurelius/meditations/', label: 'His own words: the Meditations' },
    de: { href: '/figures/marcus-aurelius/meditations/', label: 'Seine eigenen Worte: die Selbstbetrachtungen', note: 'auf Englisch' },
  },
  blake: {
    en: { href: '/figures/william-blake/poems/', label: 'His own words: the poems' },
    de: { href: '/figures/william-blake/poems/', label: 'Seine eigenen Worte: die Gedichte', note: 'auf Englisch' },
  },
  dickinson: {
    en: { href: '/figures/emily-dickinson/poems/', label: 'Her own words: the poems' },
    de: { href: '/figures/emily-dickinson/poems/', label: 'Ihre eigenen Worte: die Gedichte', note: 'auf Englisch' },
  },
  shakespeare: {
    en: { href: '/figures/william-shakespeare/sonnets/', label: 'His own words: the Sonnets' },
    de: { href: '/figures/william-shakespeare/sonnets/', label: 'Seine eigenen Worte: die Sonette', note: 'auf Englisch' },
  },
};

export function ownWords(figureId: string, lang: PlayerLang): OwnWords | null {
  return OWN_WORDS[figureId]?.[lang] ?? null;
}

// The note at a player page's end: what the portrait and the stories are. Per
// figure, because "from his writings" holds only for one who left writings.
const STORY_NOTES: Record<string, Record<PlayerLang, (name: string) => string>> = {
  aurelius: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his writings and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Schriften und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  angelou: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her autobiographies and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Autobiografien und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  austen: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her novels, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Romanen, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  beauvoir: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her memoirs and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Memoiren und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  bingen: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her writings, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Schriften, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  blake: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his poems and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Gedichten und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  campbell: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  dickinson: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her poems, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Gedichten, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  eckhart: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his sermons, his Latin works and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Predigten, seinen lateinischen Werken und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  einstein: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his papers, his letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Arbeiten, seinen Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  galilei: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books, the trial records and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern, den Prozessakten und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  gandhi: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his autobiography and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seiner Autobiografie und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  gautama: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from the Pāli Canon and the later accounts of his life and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach dem Pāli-Kanon und den späteren Berichten über sein Leben. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  goethe: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his writings, his letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Schriften, seinen Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  jung: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his memoir and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Lebenserinnerungen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  kahlo: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her diary, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihrem Tagebuch, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  king: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  laozi: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from the Daodejing and the earliest account of his life and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach dem Daodejing und dem frühesten Bericht über sein Leben. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  lovelace: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her published Notes, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren veröffentlichten Notes, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  mandela: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his autobiography and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seiner Autobiografie und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  mozart: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from the Mozart family's letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach den Briefen der Familie Mozart und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  nietzsche: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books, his letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern, seinen Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  plato: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his dialogues and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Dialogen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  rumi: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his poems and the accounts of his followers and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Gedichten und den Berichten seiner Anhänger. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  schopenhauer: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  shakespeare: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his plays, the parish records and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Stücken, den Kirchenbüchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  tubman: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from the interviews she gave and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach den Interviews mit ihr und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  vinci: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his notebooks and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Notizbüchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  woolf: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her diaries, her letters and the sources and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Tagebüchern, ihren Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
  zenji: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his writings and the later accounts of his life and read by a synthetic voice. Not a recording.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Schriften und den späteren Berichten über sein Leben. Eine synthetische Stimme liest sie vor. Keine Aufnahme.`,
  },
};

export function storyNote(figureId: string, lang: PlayerLang, name: string): string | null {
  return STORY_NOTES[figureId]?.[lang]?.(name) ?? null;
}

function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

export function heroLine(figureId: string, lang: PlayerLang, leadAnswer: string): string {
  return HERO_LINES[figureId]?.[lang] ?? firstSentence(leadAnswer);
}

export function deepLinks(figureId: string, lang: PlayerLang): DeepLink[] {
  return DEEP_LINKS[figureId]?.[lang] ?? [];
}

// The women among the thirty, for the notes that name whose words a retelling is not.
const SHE = new Set(['angelou', 'austen', 'beauvoir', 'bingen', 'dickinson', 'kahlo', 'lovelace', 'tubman', 'woolf']);

export function isShe(figureId: string): boolean {
  return SHE.has(figureId);
}
