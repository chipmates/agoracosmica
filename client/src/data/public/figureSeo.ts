// Hand-crafted SEO data per figure
// Meta descriptions target tier 2 search keywords
// Headings use figure-specific keyword-rich phrasing
// seoTitle is the FULL <title> string (with or without brand suffix based on length budget ≤60 chars)
// Remove this file when stripping marketing pages from a fork

export interface FigureSeoData {
  en: { description: string; teachingsHeading: string; seoTitle: string };
  de: { description: string; teachingsHeading: string; seoTitle: string };
}

export const figureSeo: Record<string, FigureSeoData> = {
  aurelius: {
    en: {
      description: "Roman emperor and Stoic. His Meditations teach emotional clarity, memento mori, the view from above, and virtue. A narrated life story and guided talks.",
      teachingsHeading: "Stoic Teachings from Marcus Aurelius",
      seoTitle: "Marcus Aurelius - Stoicism & Meditations | Agora Cosmica",
    },
    de: {
      description: "Entdecke stoische Philosophie mit Mark Aurel (Marcus Aurelius). 12 Kapitel Lebensgeschichte, Lehren zu emotionaler Klarheit, Memento Mori und Tugendethik.",
      teachingsHeading: "Stoische Lehren von Mark Aurel",
      seoTitle: "Mark Aurel - Stoizismus & Selbstbetrachtungen",
    },
  },
  angelou: {
    en: {
      description: "Poet and memoirist Maya Angelou on resilience, identity, and finding your voice. A narrated life story with teachings on courage and self-expression.",
      teachingsHeading: "Maya Angelou on Courage, Voice, and Identity",
      seoTitle: "Maya Angelou - Voice, Resilience, Identity | Agora Cosmica",
    },
    de: {
      description: "Entdecke Maya Angelous Weisheit über Resilienz, Identität und das Finden der eigenen Stimme. 12 Kapitel Lebensgeschichte und Lehren über Mut und Gemeinschaft.",
      teachingsHeading: "Maya Angelou über Mut, Stimme und Identität",
      seoTitle: "Maya Angelou - Stimme, Resilienz, Identität | Agora Cosmica",
    },
  },
  austen: {
    en: {
      description: "Novelist Jane Austen on character, sharp social observation, and moral clarity. A narrated life story with teachings on judgment, love, and integrity.",
      teachingsHeading: "Jane Austen on Character, Love, and Society",
      seoTitle: "Jane Austen - Character, Society & Love | Agora Cosmica",
    },
    de: {
      description: "Jane Austens Romane über Charakter, scharfe Gesellschaftsbeobachtung und moralische Klarheit. Erzählte Lebensgeschichte, Lehren zu Urteilskraft und Liebe.",
      teachingsHeading: "Jane Austen über Charakter, Liebe und Gesellschaft",
      seoTitle: "Jane Austen - Charakter, Gesellschaft & Liebe",
    },
  },
  beauvoir: {
    en: {
      description: "Explore Simone de Beauvoir's existentialist feminism. 12-chapter life story, teachings on freedom, the ethics of ambiguity, and becoming yourself.",
      teachingsHeading: "Simone de Beauvoir on Freedom and Becoming",
      seoTitle: "Simone de Beauvoir - Existential Feminism | Agora Cosmica",
    },
    de: {
      description: "Entdecke Simone de Beauvoirs existentialistischen Feminismus. 12 Kapitel Lebensgeschichte, Lehren zu Freiheit, Ethik der Ambiguität und Selbstwerdung.",
      teachingsHeading: "Simone de Beauvoir über Freiheit und Selbstwerdung",
      seoTitle: "Simone de Beauvoir - Existenzialistischer Feminismus",
    },
  },
  bingen: {
    en: {
      description: "Medieval mystic Hildegard von Bingen on nature, music, and divine wholeness. A narrated life story with teachings on healing and spiritual sight.",
      teachingsHeading: "Hildegard von Bingen on Vision, Nature, and the Divine",
      seoTitle: "Hildegard von Bingen - Visions & Music | Agora Cosmica",
    },
    de: {
      description: "Entdecke Hildegard von Bingens mystische Vision von Natur, Musik und göttlicher Ganzheit. 12 Kapitel Lebensgeschichte, Lehren zu Heilung und spirituellem Sehen.",
      teachingsHeading: "Hildegard von Bingen über Vision, Natur und das Göttliche",
      seoTitle: "Hildegard von Bingen - Visionen & Musik | Agora Cosmica",
    },
  },
  blake: {
    en: {
      description: "Explore William Blake's visionary art and radical poetry. 12-chapter life story, teachings on imagination, innocence, experience, and breaking mental chains.",
      teachingsHeading: "William Blake on Imagination and Vision",
      seoTitle: "William Blake - Visionary Poetry | Agora Cosmica",
    },
    de: {
      description: "Entdecke William Blakes visionäre Kunst und radikale Poesie. 12 Kapitel Lebensgeschichte, Lehren zu Imagination, Unschuld, Erfahrung und innerer Befreiung.",
      teachingsHeading: "William Blake über Imagination und Vision",
      seoTitle: "William Blake - Visionäre Dichtung | Agora Cosmica",
    },
  },
  campbell: {
    en: {
      description: "Discover Joseph Campbell's hero's journey and the power of myth. 12-chapter life story, teachings on following your bliss, archetypes, and personal mythology.",
      teachingsHeading: "Joseph Campbell on Myth and the Hero's Journey",
      seoTitle: "Joseph Campbell - The Hero's Journey | Agora Cosmica",
    },
    de: {
      description: "Entdecke Joseph Campbells Heldenreise und die Kraft des Mythos. 12 Kapitel Lebensgeschichte, Lehren über Archetypen, persönliche Mythologie und deinen Weg.",
      teachingsHeading: "Joseph Campbell über Mythos und die Heldenreise",
      seoTitle: "Joseph Campbell - Die Heldenreise | Agora Cosmica",
    },
  },
  dickinson: {
    en: {
      description: "Explore Emily Dickinson's radical inner world. 12-chapter narrated life story, teachings on solitude, perception, death, and the power of a single word.",
      teachingsHeading: "Emily Dickinson on Solitude, Perception, and Mystery",
      seoTitle: "Emily Dickinson - Poetry & Solitude | Agora Cosmica",
    },
    de: {
      description: "Entdecke Emily Dickinsons radikale innere Welt. 12 Kapitel Lebensgeschichte, Lehren über Einsamkeit, Wahrnehmung, Tod und die Kraft eines einzelnen Wortes.",
      teachingsHeading: "Emily Dickinson über Einsamkeit, Wahrnehmung und Mysterium",
      seoTitle: "Emily Dickinson - Dichtung & Einsamkeit | Agora Cosmica",
    },
  },
  zenji: {
    en: {
      description: "Zen master Dogen on sitting, presence, and everyday practice. A narrated life story with teachings on shikantaza, being-time, and beginner's mind.",
      teachingsHeading: "Dōgen Zenji on Zen Practice and Being-Time",
      seoTitle: "Dōgen Zenji - Zen Buddhism & Shikantaza | Agora Cosmica",
    },
    de: {
      description: "Entdecke Dōgen Zenjis Zen-Philosophie des Sitzens, der Präsenz und alltäglichen Praxis. 12 Kapitel Lebensgeschichte, Lehren zu Shikantaza und Anfängergeist.",
      teachingsHeading: "Dōgen Zenji über Zen-Praxis und Sein-Zeit",
      seoTitle: "Dōgen Zenji - Zen-Buddhismus & Shikantaza | Agora Cosmica",
    },
  },
  eckhart: {
    en: {
      description: "Explore Meister Eckhart's radical Christian mysticism. 12-chapter life story, teachings on detachment, the birth of God in the soul, and letting go.",
      teachingsHeading: "Meister Eckhart on Detachment and the Divine Ground",
      seoTitle: "Meister Eckhart - German Mysticism | Agora Cosmica",
    },
    de: {
      description: "Entdecke Meister Eckharts radikale christliche Mystik. 12 Kapitel Lebensgeschichte, Lehren über Gelassenheit, die Gottesgeburt in der Seele und das Loslassen.",
      teachingsHeading: "Meister Eckhart über Gelassenheit und den göttlichen Grund",
      seoTitle: "Meister Eckhart - Deutsche Mystik | Agora Cosmica",
    },
  },
  einstein: {
    en: {
      description: "Physicist Albert Einstein on wonder, thought experiments, and cosmic feeling. A narrated life story with teachings on creativity and relativity.",
      teachingsHeading: "Einstein on Creativity, Wonder, and the Cosmos",
      seoTitle: "Albert Einstein - Relativity & Imagination | Agora Cosmica",
    },
    de: {
      description: "Entdecke Einsteins Philosophie des Staunens, der Gedankenexperimente und des kosmischen Gefühls. 12 Kapitel Lebensgeschichte, Lehren zu Kreativität.",
      teachingsHeading: "Einstein über Kreativität, Staunen und den Kosmos",
      seoTitle: "Albert Einstein - Relativität & Imagination | Agora Cosmica",
    },
  },
  galilei: {
    en: {
      description: "Discover Galileo's courage to challenge authority through observation. 12-chapter life story, teachings on evidence, truth, and the language of nature.",
      teachingsHeading: "Galileo on Truth, Observation, and Courage",
      seoTitle: "Galileo Galilei - Heliocentrism & Telescope | Agora Cosmica",
    },
    de: {
      description: "Entdecke Galileos Mut, Autorität durch Beobachtung herauszufordern. 12 Kapitel Lebensgeschichte, Lehren über Evidenz, Wahrheit und die Sprache der Natur.",
      teachingsHeading: "Galileo über Wahrheit, Beobachtung und Mut",
      seoTitle: "Galileo Galilei - Heliozentrismus & Teleskop",
    },
  },
  gandhi: {
    en: {
      description: "Explore Gandhi's philosophy of nonviolence, truth, and self-rule. 12-chapter narrated life story, teachings on satyagraha, ahimsa, and moral courage.",
      teachingsHeading: "Gandhi on Nonviolence, Truth, and Self-Rule",
      seoTitle: "Mahatma Gandhi - Nonviolence & Satyagraha | Agora Cosmica",
    },
    de: {
      description: "Entdecke Gandhis Philosophie der Gewaltlosigkeit, Wahrheit und Selbstbestimmung. 12 Kapitel Lebensgeschichte, Lehren zu Satyagraha, Ahimsa und moralischem Mut.",
      teachingsHeading: "Gandhi über Gewaltlosigkeit, Wahrheit und Selbstbestimmung",
      seoTitle: "Mahatma Gandhi - Gewaltlosigkeit & Satyagraha",
    },
  },
  goethe: {
    en: {
      description: "Explore Goethe's philosophy of nature, creativity, and human development. 12-chapter life story, teachings on Bildung, Faust, and the unity of art and science.",
      teachingsHeading: "Goethe on Nature, Creativity, and Human Growth",
      seoTitle: "Johann Wolfgang von Goethe - Faust & Classicism",
    },
    de: {
      description: "Goethes Philosophie der Natur, Kreativität und Entwicklung. Erzählte Lebensgeschichte, Lehren zu Bildung, Faust und der Einheit von Kunst und Wissenschaft.",
      teachingsHeading: "Goethe über Natur, Kreativität und Bildung",
      seoTitle: "Johann Wolfgang von Goethe - Faust & Klassik",
    },
  },
  gautama: {
    en: {
      description: "Siddhartha Gautama, the Buddha, on mindfulness, the Four Noble Truths, and dependent origination. A narrated life story and guided wisdom talks.",
      teachingsHeading: "Buddhist Teachings from Siddhartha Gautama",
      seoTitle: "Siddhartha Gautama - Buddhism & Four Noble Truths",
    },
    de: {
      description: "Lerne die buddhistische Philosophie des Buddha Siddhartha Gautama. Achtsamkeit, Vier Edle Wahrheiten, abhängiges Entstehen. 12 Kapitel Lebensgeschichte.",
      teachingsHeading: "Die Lehren des Buddha (Siddhartha Gautama)",
      seoTitle: "Buddha - Buddhismus & Vier Edle Wahrheiten | Agora Cosmica",
    },
  },
  jung: {
    en: {
      description: "Carl Gustav Jung on depth psychology: shadow work, individuation, archetypes, and the collective unconscious. A narrated life story and guided talks.",
      teachingsHeading: "Jung on the Shadow, Individuation, and the Unconscious",
      seoTitle: "Carl Gustav Jung - Shadow & Archetypes | Agora Cosmica",
    },
    de: {
      description: "C.G. Jungs Tiefenpsychologie: Schattenarbeit, Individuation, Archetypen und kollektives Unbewusstes. Erzählte Lebensgeschichte mit geführten Gesprächen.",
      teachingsHeading: "Jung über Schatten, Individuation und das Unbewusste",
      seoTitle: "Carl Gustav Jung - Schatten & Archetypen | Agora Cosmica",
    },
  },
  kahlo: {
    en: {
      description: "Painter Frida Kahlo on pain, identity, and creative transformation. A narrated life story with teachings on embodied truth and cultural roots.",
      teachingsHeading: "Frida Kahlo on Art, Pain, and Identity",
      seoTitle: "Frida Kahlo - Self-Portraits & Identity | Agora Cosmica",
    },
    de: {
      description: "Frida Kahlos Malerei über Schmerz, Identität und kreative Verwandlung. Eine erzählte Lebensgeschichte, Lehren zu verkörperter Wahrheit und Wurzeln.",
      teachingsHeading: "Frida Kahlo über Kunst, Schmerz und Identität",
      seoTitle: "Frida Kahlo - Selbstporträts & Identität | Agora Cosmica",
    },
  },
  king: {
    en: {
      description: "Martin Luther King Jr. on nonviolent resistance and beloved community. A narrated life story with teachings on justice, hope, and moral courage.",
      teachingsHeading: "Martin Luther King Jr. on Justice and Beloved Community",
      seoTitle: "Martin Luther King Jr. - Civil Rights & Nonviolence",
    },
    de: {
      description: "Martin Luther King Jr. über gewaltlosen Widerstand und geliebte Gemeinschaft. Eine erzählte Lebensgeschichte, Lehren zu Gerechtigkeit, Hoffnung und Mut.",
      teachingsHeading: "Martin Luther King Jr. über Gerechtigkeit und Gemeinschaft",
      seoTitle: "Martin Luther King Jr. - Bürgerrechte & Gewaltlosigkeit",
    },
  },
  laozi: {
    en: {
      description: "Laozi on Taoist philosophy: wu wei, simplicity, and flowing with nature. A narrated life story with teachings from the Tao Te Ching on balance.",
      teachingsHeading: "Laozi on the Tao, Wu Wei, and Natural Harmony",
      seoTitle: "Laozi - Taoism, Wu Wei & Tao Te Ching | Agora Cosmica",
    },
    de: {
      description: "Entdecke die taoistische Philosophie von Laozi (Laotse): Wu Wei, Einfachheit, Fließen mit der Natur. 12 Kapitel Lebensgeschichte, Lehren aus dem Tao Te King.",
      teachingsHeading: "Laozi (Laotse) über das Tao, Wu Wei und natürliche Harmonie",
      seoTitle: "Laozi - Taoismus, Wu Wei & Tao Te King | Agora Cosmica",
    },
  },
  lovelace: {
    en: {
      description: "Ada Lovelace on computing, imagination, and the poetry of science. A narrated life story with teachings on analytical and creative reasoning.",
      teachingsHeading: "Ada Lovelace on Computing, Imagination, and Science",
      seoTitle: "Ada Lovelace - World's First Programmer | Agora Cosmica",
    },
    de: {
      description: "Ada Lovelace über Computing, Imagination und die Poesie der Wissenschaft. Eine erzählte Lebensgeschichte, Lehren zu analytischem und kreativem Denken.",
      teachingsHeading: "Ada Lovelace über Computing, Imagination und Wissenschaft",
      seoTitle: "Ada Lovelace - Erste Programmiererin | Agora Cosmica",
    },
  },
  mandela: {
    en: {
      description: "Nelson Mandela on reconciliation, ubuntu, and the long walk to freedom. A narrated life story with teachings on forgiveness and moral leadership.",
      teachingsHeading: "Nelson Mandela on Freedom, Ubuntu, and Reconciliation",
      seoTitle: "Nelson Mandela - Ubuntu & Reconciliation | Agora Cosmica",
    },
    de: {
      description: "Nelson Mandela über Versöhnung, Ubuntu und den langen Weg zur Freiheit. Eine erzählte Lebensgeschichte, Lehren zu Vergebung und moralischer Führung.",
      teachingsHeading: "Nelson Mandela über Freiheit, Ubuntu und Versöhnung",
      seoTitle: "Nelson Mandela - Ubuntu & Versöhnung | Agora Cosmica",
    },
  },
  mozart: {
    en: {
      description: "Composer Mozart on music as emotional truth and playful mastery. A narrated life story with teachings on composition and artistic freedom.",
      teachingsHeading: "Mozart on Music, Creativity, and Artistic Freedom",
      seoTitle: "Wolfgang Amadeus Mozart - Music & Composition",
    },
    de: {
      description: "Mozart über Musik als emotionale Wahrheit und spielerische Meisterschaft. Erzählte Lebensgeschichte, Lehren zu Komposition und künstlerischer Freiheit.",
      teachingsHeading: "Mozart über Musik, Kreativität und künstlerische Freiheit",
      seoTitle: "Wolfgang Amadeus Mozart - Musik & Komposition",
    },
  },
  nietzsche: {
    en: {
      description: "Friedrich Nietzsche on self-overcoming, eternal return, and life-affirmation. A narrated life story with teachings on values and the will to power.",
      teachingsHeading: "Nietzsche on Self-Overcoming and Life-Affirmation",
      seoTitle: "Friedrich Nietzsche - Zarathustra & Self-Overcoming",
    },
    de: {
      description: "Nietzsche über Selbstüberwindung, ewige Wiederkehr und Lebensbejahung. Eine erzählte Lebensgeschichte, Lehren zum Willen zur Macht und zu eigenen Werten.",
      teachingsHeading: "Nietzsche über Selbstüberwindung und Lebensbejahung",
      seoTitle: "Friedrich Nietzsche - Zarathustra & Selbstüberwindung",
    },
  },
  plato: {
    en: {
      description: "Explore Plato's philosophy of forms, justice, and the examined life. 12-chapter life story, teachings on the cave allegory, Socratic method, and the good.",
      teachingsHeading: "Plato on Truth, Justice, and the Examined Life",
      seoTitle: "Plato - The Cave, Forms & Justice | Agora Cosmica",
    },
    de: {
      description: "Platons Philosophie der Ideen, Gerechtigkeit und des geprüften Lebens. Eine erzählte Lebensgeschichte, Lehren zum Höhlengleichnis und zur Sokratik.",
      teachingsHeading: "Platon über Wahrheit, Gerechtigkeit und das geprüfte Leben",
      seoTitle: "Platon - Höhlengleichnis & Ideenlehre | Agora Cosmica",
    },
  },
  rumi: {
    en: {
      description: "Sufi poet Rumi on divine love, the heart, and mystical union. A narrated life story with teachings on sacred listening and inner transformation.",
      teachingsHeading: "Rumi on Love, the Heart, and the Divine",
      seoTitle: "Rumi - Sufi Poetry & Divine Love | Agora Cosmica",
    },
    de: {
      description: "Rumis Sufi-Poesie und Philosophie der göttlichen Liebe. Eine erzählte Lebensgeschichte, Lehren über das Herz, mystische Vereinigung und innere Verwandlung.",
      teachingsHeading: "Rumi über Liebe, das Herz und das Göttliche",
      seoTitle: "Rumi - Sufi-Dichtung & Göttliche Liebe | Agora Cosmica",
    },
  },
  schopenhauer: {
    en: {
      description: "Arthur Schopenhauer on will, suffering, and aesthetic contemplation. A narrated life story with teachings on compassion, music, and desire.",
      teachingsHeading: "Schopenhauer on Will, Suffering, and Contemplation",
      seoTitle: "Arthur Schopenhauer - Will & Pessimism | Agora Cosmica",
    },
    de: {
      description: "Schopenhauer über den Willen, das Leiden und die ästhetische Kontemplation. Eine erzählte Lebensgeschichte, Lehren zu Mitgefühl, Musik und Begehren.",
      teachingsHeading: "Schopenhauer über Wille, Leiden und Kontemplation",
      seoTitle: "Arthur Schopenhauer - Wille & Pessimismus | Agora Cosmica",
    },
  },
  shakespeare: {
    en: {
      description: "Explore Shakespeare's philosophy of human nature through drama. 12-chapter life story, teachings on ambition, love, jealousy, mercy, and the theater of self.",
      teachingsHeading: "Shakespeare on Human Nature and the Drama of Life",
      seoTitle: "William Shakespeare - Plays, Sonnets, Human Nature",
    },
    de: {
      description: "Shakespeares Sicht auf die menschliche Natur im Drama. Erzählte Lebensgeschichte, Lehren zu Ambition, Liebe, Eifersucht, Gnade und dem Theater des Selbst.",
      teachingsHeading: "Shakespeare über die menschliche Natur und das Drama des Lebens",
      seoTitle: "William Shakespeare - Dramen, Sonette, Menschennatur",
    },
  },
  tubman: {
    en: {
      description: "Harriet Tubman on inner freedom, faith under fire, and leading others to liberation. A narrated life story with teachings on courage and moral action.",
      teachingsHeading: "Harriet Tubman on Freedom, Faith, and Moral Courage",
      seoTitle: "Harriet Tubman - Underground Railroad & Freedom",
    },
    de: {
      description: "Harriet Tubman über innere Freiheit, Glauben unter Druck und die Befreiung anderer. Eine erzählte Lebensgeschichte, Lehren zu Mut und moralischem Handeln.",
      teachingsHeading: "Harriet Tubman über Freiheit, Glaube und moralischen Mut",
      seoTitle: "Harriet Tubman - Underground Railroad & Freiheit",
    },
  },
  vinci: {
    en: {
      description: "Leonardo da Vinci on curiosity, observation, and the unity of art and science. A narrated life story with teachings on seeing and creative mastery.",
      teachingsHeading: "Leonardo da Vinci on Curiosity, Art, and Science",
      seoTitle: "Leonardo da Vinci - Renaissance Curiosity | Agora Cosmica",
    },
    de: {
      description: "Leonardo da Vinci über Neugier, Beobachtung und die Einheit von Kunst und Wissenschaft. Eine erzählte Lebensgeschichte, Lehren zu Sehen und Meisterschaft.",
      teachingsHeading: "Leonardo da Vinci über Neugier, Kunst und Wissenschaft",
      seoTitle: "Leonardo da Vinci - Renaissance & Neugier | Agora Cosmica",
    },
  },
  woolf: {
    en: {
      description: "Virginia Woolf on consciousness, time, and a room of one's own. A narrated life story with teachings on perception, feminism, and the halo of being.",
      teachingsHeading: "Virginia Woolf on Consciousness, Time, and Self",
      seoTitle: "Virginia Woolf - Modernism & Consciousness | Agora Cosmica",
    },
    de: {
      description: "Virginia Woolf über Bewusstsein, Zeit und ein eigenes Zimmer. Eine erzählte Lebensgeschichte, Lehren zu Wahrnehmung, Feminismus und dem Leuchten des Seins.",
      teachingsHeading: "Virginia Woolf über Bewusstsein, Zeit und Selbst",
      seoTitle: "Virginia Woolf - Moderne & Bewusstsein | Agora Cosmica",
    },
  },
};

export function getFigureSeo(id: string, lang: 'en' | 'de'): { description: string; teachingsHeading: string; seoTitle: string } | undefined {
  return figureSeo[id]?.[lang];
}

// Figure → themes mapping. Each figure is curated to 1-3 themes their teachings
// speak to most directly. Powers bidirectional internal linking (figure → theme
// pages). Mirrored in scripts/prerender.mjs for static-HTML noscript bodies.
export const figureThemes: Record<string, string[]> = {
  angelou: ['who-am-i', 'freedom-justice'],
  aurelius: ['meaning-purpose', 'faith-death-mystery', 'moral-life'],
  austen: ['love-connection'],
  beauvoir: ['who-am-i', 'freedom-justice'],
  bingen: ['love-connection', 'faith-death-mystery'],
  blake: ['mind-creativity'],
  campbell: ['meaning-purpose', 'who-am-i'],
  vinci: ['mind-creativity'],
  dickinson: ['who-am-i', 'faith-death-mystery'],
  zenji: ['who-am-i', 'faith-death-mystery', 'moral-life'],
  eckhart: ['loss-grief', 'love-connection', 'faith-death-mystery'],
  einstein: ['mind-creativity'],
  galilei: ['mind-creativity', 'faith-death-mystery'],
  gandhi: ['freedom-justice', 'moral-life'],
  gautama: ['meaning-purpose', 'faith-death-mystery', 'moral-life'],
  goethe: ['mind-creativity', 'meaning-purpose'],
  jung: ['loss-grief', 'who-am-i'],
  kahlo: ['who-am-i'],
  king: ['loss-grief', 'freedom-justice', 'moral-life'],
  laozi: ['faith-death-mystery'],
  lovelace: ['mind-creativity'],
  mandela: ['loss-grief', 'freedom-justice'],
  mozart: ['mind-creativity'],
  nietzsche: ['meaning-purpose', 'who-am-i'],
  plato: ['moral-life'],
  rumi: ['meaning-purpose', 'love-connection'],
  schopenhauer: ['meaning-purpose', 'faith-death-mystery'],
  shakespeare: ['love-connection', 'who-am-i'],
  tubman: ['loss-grief', 'freedom-justice'],
  woolf: ['who-am-i', 'mind-creativity'],
};
