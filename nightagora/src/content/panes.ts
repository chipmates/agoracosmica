/* The wheel's pane, per figure: one or two sentences in the museum's own
   voice on who this was and what they made, EN and DE. The facts follow the
   figure records the library keeps (dates, places, works); nothing here is
   generated at runtime. The wing's place and year come from the registry
   when a wing stands; until then the pane says the wing is in preparation.
   Displayed text follows the house writing rules: no em or en dashes, no
   semicolons, short sentences. */

import type { Lang } from '../wings/content'

export interface PaneWords {
  /** who this was and what they made, one or two sentences */
  line: Record<Lang, string>
  /** the place and the year of the wing, shown only when the wing stands */
  wing?: Record<Lang, string>
}

export const PANE_SHARED: Record<'preparing' | 'open' | 'nameOnly' | 'close', Record<Lang, string>> = {
  preparing: { en: 'Wing in preparation', de: 'Flügel in Vorbereitung' },
  close: { en: 'Back to the sky', de: 'Zurück zum Himmel' },
  open: { en: 'Wing open', de: 'Flügel geöffnet' },
  /** the pane without a likeness: the name stands alone and this line says why */
  nameOnly: {
    en: 'No public-domain likeness at museum size exists yet. The name stands for the person.',
    de: 'Es gibt noch kein gemeinfreies Bildnis in Museumsgröße. Der Name steht für den Menschen.',
  },
}

/** the label over the other names of the same constellation, keyed by its key */
export const PANE_AMONG: Record<string, Record<Lang, string>> = {
  philosophers: { en: 'Also among the Philosophers', de: 'Auch unter den Philosophen' },
  teachers: { en: 'Also among the Spiritual Teachers', de: 'Auch unter den spirituellen Lehrern' },
  activists: { en: 'Also among the Activists and Leaders', de: 'Auch unter den Aktivisten und Vorkämpfern' },
  artists: { en: 'Also among the Artists', de: 'Auch unter den Künstlern' },
  writers: { en: 'Also among the Writers', de: 'Auch unter den Schriftstellern' },
  scientists: { en: 'Also among the Scientists and Thinkers', de: 'Auch unter den Wissenschaftlern und Denkern' },
}

export const PANES: Record<string, PaneWords> = {
  angelou: {
    line: {
      en: 'American poet and memoirist. Her autobiographies, above all I Know Why the Caged Bird Sings, changed what an American life story could say.',
      de: 'Amerikanische Dichterin und Memoirenschreiberin. Ihre Autobiografien, allen voran Ich weiß, warum der gefangene Vogel singt, haben verändert, was eine amerikanische Lebensgeschichte sagen kann.',
    },
  },
  aurelius: {
    line: {
      en: 'Roman emperor from 161 to 180 and a Stoic. The notes he wrote to himself, the Meditations, were never meant for readers and have been read for eighteen centuries.',
      de: 'Römischer Kaiser von 161 bis 180 und Stoiker. Die Notizen, die er für sich selbst schrieb, die Selbstbetrachtungen, waren nie für Leser gedacht und werden seit achtzehn Jahrhunderten gelesen.',
    },
  },
  austen: {
    line: {
      en: 'English novelist. Pride and Prejudice and Sense and Sensibility look at morality, marriage and the money women could not own, with a wit that has not aged.',
      de: 'Englische Romanautorin. Stolz und Vorurteil und Verstand und Gefühl sehen auf Moral, Ehe und das Geld, das Frauen nicht besitzen durften, mit einem Witz, der nicht gealtert ist.',
    },
  },
  beauvoir: {
    line: {
      en: 'French philosopher and writer. The Second Sex, published in 1949, became a founding text of modern feminism.',
      de: 'Französische Philosophin und Schriftstellerin. Das andere Geschlecht, erschienen 1949, wurde zu einem Grundlagentext des modernen Feminismus.',
    },
  },
  bingen: {
    line: {
      en: 'Benedictine abbess on the Rhine. She wrote down her visions, composed music for the liturgy, and left works on plants, stones and medicine that carry her name.',
      de: 'Benediktineräbtissin am Rhein. Sie schrieb ihre Visionen nieder, komponierte Musik für die Liturgie und hinterließ Schriften über Pflanzen, Steine und Heilkunde, die ihren Namen tragen.',
    },
  },
  blake: {
    line: {
      en: 'English poet, painter and printmaker. He engraved and coloured his own books in London and built a mythology of his own inside them.',
      de: 'Englischer Dichter, Maler und Drucker. Er stach und kolorierte seine Bücher in London selbst und baute darin eine eigene Mythologie.',
    },
  },
  campbell: {
    line: {
      en: 'American scholar of literature and myth. His account of the hero’s journey, the one story he found under many, shaped how stories are told across cultures.',
      de: 'Amerikanischer Literatur- und Mythenforscher. Seine Darstellung der Heldenreise, der einen Geschichte, die er unter vielen fand, hat das Erzählen über Kulturgrenzen hinweg geprägt.',
    },
  },
  dickinson: {
    line: {
      en: 'American poet of Amherst. Nearly 1,800 poems, most of them unpublished in her lifetime, with short lines, slant rhymes and dashes of her own.',
      de: 'Amerikanische Dichterin aus Amherst. Fast 1.800 Gedichte, die meisten zu Lebzeiten unveröffentlicht, mit kurzen Zeilen, unreinen Reimen und Gedankenstrichen ganz eigener Art.',
    },
  },
  eckhart: {
    line: {
      en: 'Dominican theologian and mystic. His German sermons on letting go, the spark in the soul and union with God shaped Christian mysticism for centuries.',
      de: 'Dominikanertheologe und Mystiker. Seine deutschen Predigten über die Abgeschiedenheit, den Funken in der Seele und die Einheit mit Gott haben die christliche Mystik über Jahrhunderte geprägt.',
    },
  },
  einstein: {
    line: {
      en: 'Physicist, born in Ulm. The theory of relativity he worked out is one of the pillars of modern physics, and his thinking still shapes how science understands itself.',
      de: 'Physiker, geboren in Ulm. Die Relativitätstheorie, die er ausarbeitete, ist eine der Säulen der modernen Physik, und sein Denken prägt bis heute, wie die Wissenschaft sich selbst versteht.',
    },
  },
  galilei: {
    line: {
      en: 'Astronomer, physicist and engineer. He pointed a telescope at the sky, measured falling bodies, and paid for the sun at the centre with a trial before the Church.',
      de: 'Astronom, Physiker und Ingenieur. Er richtete ein Fernrohr auf den Himmel, maß fallende Körper und bezahlte die Sonne im Zentrum mit einem Prozess vor der Kirche.',
    },
  },
  gandhi: {
    line: {
      en: 'Lawyer and leader of India’s independence. He made nonviolent resistance a political method, and movements for civil rights around the world took it up.',
      de: 'Anwalt und Wegbereiter der indischen Unabhängigkeit. Er machte den gewaltfreien Widerstand zu einer politischen Methode, und Bürgerrechtsbewegungen in aller Welt nahmen sie auf.',
    },
  },
  gautama: {
    line: {
      en: 'The Buddha. Enlightened under the Bodhi tree, he taught the way out of suffering for forty-five years across northern India.',
      de: 'Der Buddha. Unter dem Bodhi-Baum erleuchtet, lehrte er fünfundvierzig Jahre lang in Nordindien den Weg aus dem Leiden.',
    },
  },
  goethe: {
    line: {
      en: 'Poet, statesman and scientist of Weimar. Faust, The Sorrows of Young Werther and the Theory of Colours come from one life that would not choose between art and nature.',
      de: 'Dichter, Staatsmann und Naturforscher in Weimar. Faust, Die Leiden des jungen Werthers und die Farbenlehre stammen aus einem Leben, das sich nicht zwischen Kunst und Natur entscheiden wollte.',
    },
  },
  jung: {
    line: {
      en: 'Swiss psychiatrist. He founded analytical psychology and gave the night side of the mind its names: the archetypes, the collective unconscious, individuation.',
      de: 'Schweizer Psychiater. Er begründete die Analytische Psychologie und gab der Nachtseite des Geistes ihre Namen: die Archetypen, das kollektive Unbewusste, die Individuation.',
    },
  },
  kahlo: {
    line: {
      en: 'Mexican painter. Her self-portraits, drawn from Mexican folk art and her own body, speak of identity, pain and death without looking away.',
      de: 'Mexikanische Malerin. Ihre Selbstporträts, gespeist aus mexikanischer Volkskunst und ihrem eigenen Körper, sprechen von Identität, Schmerz und Tod, ohne wegzusehen.',
    },
  },
  king: {
    line: {
      en: 'Baptist minister and leader of the American civil rights movement. Nonviolent resistance, as he led it, ended legal segregation in the United States.',
      de: 'Baptistenpfarrer an der Spitze der amerikanischen Bürgerrechtsbewegung. Der gewaltfreie Widerstand, wie er ihn führte, beendete die gesetzliche Rassentrennung in den Vereinigten Staaten.',
    },
  },
  laozi: {
    line: {
      en: 'The name tradition gives to the author of the Daodejing, eighty-one short chapters on the way and its power. Whether one man wrote them is still debated.',
      de: 'Der Name, den die Überlieferung dem Verfasser des Daodejing gibt, einundachtzig kurzen Kapiteln über den Weg und seine Kraft. Ob ein einzelner Mensch sie schrieb, ist bis heute umstritten.',
    },
  },
  lovelace: {
    line: {
      en: 'English mathematician. In her notes on Charles Babbage’s Analytical Engine she published what is often called the first computer program.',
      de: 'Englische Mathematikerin. In ihren Anmerkungen zu Charles Babbages Analytischer Maschine veröffentlichte sie, was oft das erste Computerprogramm genannt wird.',
    },
  },
  mandela: {
    line: {
      en: 'South African leader against apartheid. Twenty-seven years in prison, then President from 1994 to 1999, and a name for resistance and reconciliation both.',
      de: 'Südafrikanischer Freiheitskämpfer gegen die Apartheid. Siebenundzwanzig Jahre im Gefängnis, dann Präsident von 1994 bis 1999, und ein Name für Widerstand und Versöhnung zugleich.',
    },
  },
  mozart: {
    line: {
      en: 'Composer of the Classical period, born in Salzburg. Symphonies, operas, chamber and sacred music in thirty-five years, and most of it still played.',
      de: 'Komponist der Klassik, geboren in Salzburg. Sinfonien, Opern, Kammermusik und geistliche Werke in fünfunddreißig Jahren, und das meiste davon wird noch gespielt.',
    },
  },
  nietzsche: {
    line: {
      en: 'German philosopher. His books on morality, tragedy and what a human being might become changed the course of Western thought.',
      de: 'Deutscher Philosoph. Seine Bücher über Moral, Tragödie und das, was ein Mensch werden könnte, haben den Lauf des westlichen Denkens verändert.',
    },
  },
  plato: {
    line: {
      en: 'Athenian philosopher and founder of the Academy. His dialogues on justice, beauty and the good are the ground most Western philosophy stands on.',
      de: 'Athenischer Philosoph und Gründer der Akademie. Seine Dialoge über Gerechtigkeit, Schönheit und das Gute sind der Boden, auf dem der größte Teil der westlichen Philosophie steht.',
    },
  },
  rumi: {
    line: {
      en: 'Persian poet and Sufi mystic of Konya. His verses on love, unity and the soul’s way to the divine are read across every tradition that has met them.',
      de: 'Persischer Dichter und Sufi-Mystiker in Konya. Seine Verse über Liebe, Einheit und den Weg der Seele zum Göttlichen werden in jeder Tradition gelesen, die ihnen begegnet ist.',
    },
  },
  schopenhauer: {
    line: {
      en: 'German philosopher. The world as will, art as a pause from it, and a clear look at suffering: his work reached philosophy, psychology and the arts.',
      de: 'Deutscher Philosoph. Die Welt als Wille, die Kunst als Atempause davon und ein klarer Blick auf das Leiden: sein Werk hat Philosophie, Psychologie und die Künste erreicht.',
    },
  },
  shakespeare: {
    line: {
      en: 'Playwright and poet of Stratford and London. Hamlet, Macbeth and the Sonnets, and a language that the English still speak in.',
      de: 'Dramatiker und Dichter aus Stratford und London. Hamlet, Macbeth und die Sonette, und eine Sprache, in der die Engländer bis heute sprechen.',
    },
  },
  tubman: {
    line: {
      en: 'American abolitionist. She led about seventy enslaved people to freedom on the Underground Railroad and served the Union as a scout and spy in the Civil War.',
      de: 'Amerikanische Abolitionistin. Sie führte etwa siebzig versklavte Menschen über die Underground Railroad in die Freiheit und diente der Union im Bürgerkrieg als Kundschafterin und Spionin.',
    },
  },
  vinci: {
    line: {
      en: 'Painter, engineer and anatomist of the Renaissance. Paintings, machines, notebooks and dissections from one pair of hands, and a way of looking that joined them.',
      de: 'Maler, Ingenieur und Anatom der Renaissance. Gemälde, Maschinen, Notizbücher und Sektionen aus einem Paar Hände, und eine Art zu sehen, die sie verband.',
    },
    wing: { en: 'Clos Lucé, Amboise · 1517', de: 'Clos Lucé, Amboise · 1517' },
  },
  woolf: {
    line: {
      en: 'English novelist and essayist. Her novels follow consciousness and time from the inside, and A Room of One’s Own asks what a writer needs to write.',
      de: 'Englische Romanautorin und Essayistin. Ihre Romane folgen Bewusstsein und Zeit von innen, und Ein Zimmer für sich allein fragt, was eine Schriftstellerin zum Schreiben braucht.',
    },
  },
  zenji: {
    line: {
      en: 'Japanese Zen master and founder of the Sōtō school. The Shōbōgenzō, his life’s writing, holds practice and enlightenment to be one thing.',
      de: 'Japanischer Zen-Meister und Gründer der Sōtō-Schule. Das Shōbōgenzō, das Werk seines Lebens, hält Übung und Erleuchtung für ein und dasselbe.',
    },
  },
}

export function paneWords(slug: string): PaneWords | undefined {
  return PANES[slug]
}
