/**
 * The thirty Wanderers. Order matches the seeded sky positions.
 * Slugs mirror the content pipeline (factchecks/instructions/voices on R2).
 * Epithets are atlas one-liners: essence, not resume.
 */
export interface Wanderer {
  slug: string
  name: string
  years: string
  epithet: string
}

export const WANDERERS: Wanderer[] = [
  { slug: 'angelou', name: 'Maya Angelou', years: '1928-2014', epithet: 'she knew why the caged bird sings' },
  { slug: 'aurelius', name: 'Marcus Aurelius', years: '121-180', epithet: 'the emperor who talked to himself' },
  { slug: 'austen', name: 'Jane Austen', years: '1775-1817', epithet: 'she saw whole worlds in a drawing room' },
  { slug: 'beauvoir', name: 'Simone de Beauvoir', years: '1908-1986', epithet: 'freedom was her first principle' },
  { slug: 'bingen', name: 'Hildegard von Bingen', years: '1098-1179', epithet: 'she heard the universe humming' },
  { slug: 'blake', name: 'William Blake', years: '1757-1827', epithet: 'the engraver who saw angels in London' },
  { slug: 'campbell', name: 'Joseph Campbell', years: '1904-1987', epithet: 'he found the one story under all stories' },
  { slug: 'dickinson', name: 'Emily Dickinson', years: '1830-1886', epithet: 'she folded infinity into small poems' },
  { slug: 'eckhart', name: 'Meister Eckhart', years: 'c. 1260-1328', epithet: 'the mystic who preached letting go' },
  { slug: 'einstein', name: 'Albert Einstein', years: '1879-1955', epithet: 'the clerk who bent space and time' },
  { slug: 'galilei', name: 'Galileo Galilei', years: '1564-1642', epithet: 'he pointed a telescope at heaven' },
  { slug: 'gandhi', name: 'Mahatma Gandhi', years: '1869-1948', epithet: 'he made gentleness a force' },
  { slug: 'gautama', name: 'Gautama Buddha', years: 'c. 563-483 BC', epithet: 'the prince who sat down under a tree' },
  { slug: 'goethe', name: 'Johann Wolfgang von Goethe', years: '1749-1832', epithet: 'the man who wanted more light' },
  { slug: 'jung', name: 'Carl Gustav Jung', years: '1875-1961', epithet: 'he mapped the night side of the mind' },
  { slug: 'kahlo', name: 'Frida Kahlo', years: '1907-1954', epithet: 'she painted her own reality' },
  { slug: 'king', name: 'Martin Luther King Jr.', years: '1929-1968', epithet: 'the dreamer who would not wait' },
  { slug: 'laozi', name: 'Laozi', years: '6th century BC', epithet: 'he wrote 81 verses and vanished west' },
  { slug: 'lovelace', name: 'Ada Lovelace', years: '1815-1852', epithet: 'she saw poetry in the engine' },
  { slug: 'mandela', name: 'Nelson Mandela', years: '1918-2013', epithet: 'the prisoner who freed his jailers' },
  { slug: 'mozart', name: 'Wolfgang Amadeus Mozart', years: '1756-1791', epithet: 'music arrived through him like weather' },
  { slug: 'nietzsche', name: 'Friedrich Nietzsche', years: '1844-1900', epithet: 'he philosophized with a hammer' },
  { slug: 'plato', name: 'Plato', years: 'c. 428-348 BC', epithet: 'the man who left the cave' },
  { slug: 'rumi', name: 'Rumi', years: '1207-1273', epithet: 'the scholar who became a dance' },
  { slug: 'schopenhauer', name: 'Arthur Schopenhauer', years: '1788-1860', epithet: 'the pessimist who loved music and dogs' },
  { slug: 'shakespeare', name: 'William Shakespeare', years: '1564-1616', epithet: 'all the world became his stage' },
  { slug: 'tubman', name: 'Harriet Tubman', years: 'c. 1822-1913', epithet: 'she found the way north, then went back' },
  { slug: 'vinci', name: 'Leonardo da Vinci', years: '1452-1519', epithet: 'he wanted to know how everything works' },
  { slug: 'woolf', name: 'Virginia Woolf', years: '1882-1941', epithet: 'she gave the mind a room of its own' },
  { slug: 'zenji', name: 'Dogen Zenji', years: '1200-1253', epithet: 'practice is enlightenment, he said, and sat' },
]
