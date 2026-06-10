// Verified entity data per figure page slug, consumed by personSchema for
// knowledge-graph reconciliation (sameAs to Wikipedia/Wikidata) and E-E-A-T
// (birth/death dates). Dates only where the historical record is solid:
// BCE, legendary, approximate, or disputed dates are deliberately omitted
// rather than guessed (factcheck discipline; affects Hildegard, Eckhart,
// Gautama, Laozi, Plato, Tubman). Populated 2026-06-10 from Wikidata and
// Wikipedia; every QID, URL, and date independently verified against both
// sources before landing here.

export interface FigureEntity {
  wikidata: string;
  wikipediaEn: string;
  wikipediaDe: string;
  birthDate?: string;
  deathDate?: string;
}

export const figureEntities: Record<string, FigureEntity> = {
  'ada-lovelace': { wikidata: 'https://www.wikidata.org/wiki/Q7259', wikipediaEn: 'https://en.wikipedia.org/wiki/Ada_Lovelace', wikipediaDe: 'https://de.wikipedia.org/wiki/Ada_Lovelace', birthDate: '1815-12-10', deathDate: '1852-11-27' },
  'albert-einstein': { wikidata: 'https://www.wikidata.org/wiki/Q937', wikipediaEn: 'https://en.wikipedia.org/wiki/Albert_Einstein', wikipediaDe: 'https://de.wikipedia.org/wiki/Albert_Einstein', birthDate: '1879-03-14', deathDate: '1955-04-18' },
  'arthur-schopenhauer': { wikidata: 'https://www.wikidata.org/wiki/Q38193', wikipediaEn: 'https://en.wikipedia.org/wiki/Arthur_Schopenhauer', wikipediaDe: 'https://de.wikipedia.org/wiki/Arthur_Schopenhauer', birthDate: '1788-02-22', deathDate: '1860-09-21' },
  'carl-gustav-jung': { wikidata: 'https://www.wikidata.org/wiki/Q41532', wikipediaEn: 'https://en.wikipedia.org/wiki/Carl_Jung', wikipediaDe: 'https://de.wikipedia.org/wiki/Carl_Gustav_Jung', birthDate: '1875-07-26', deathDate: '1961-06-06' },
  'dogen-zenji': { wikidata: 'https://www.wikidata.org/wiki/Q318064', wikipediaEn: 'https://en.wikipedia.org/wiki/D%C5%8Dgen', wikipediaDe: 'https://de.wikipedia.org/wiki/D%C5%8Dgen', birthDate: '1200', deathDate: '1253' },
  'emily-dickinson': { wikidata: 'https://www.wikidata.org/wiki/Q4441', wikipediaEn: 'https://en.wikipedia.org/wiki/Emily_Dickinson', wikipediaDe: 'https://de.wikipedia.org/wiki/Emily_Dickinson', birthDate: '1830-12-10', deathDate: '1886-05-15' },
  'frida-kahlo': { wikidata: 'https://www.wikidata.org/wiki/Q5588', wikipediaEn: 'https://en.wikipedia.org/wiki/Frida_Kahlo', wikipediaDe: 'https://de.wikipedia.org/wiki/Frida_Kahlo', birthDate: '1907-07-06', deathDate: '1954-07-13' },
  'friedrich-nietzsche': { wikidata: 'https://www.wikidata.org/wiki/Q9358', wikipediaEn: 'https://en.wikipedia.org/wiki/Friedrich_Nietzsche', wikipediaDe: 'https://de.wikipedia.org/wiki/Friedrich_Nietzsche', birthDate: '1844-10-15', deathDate: '1900-08-25' },
  'galileo-galilei': { wikidata: 'https://www.wikidata.org/wiki/Q307', wikipediaEn: 'https://en.wikipedia.org/wiki/Galileo_Galilei', wikipediaDe: 'https://de.wikipedia.org/wiki/Galileo_Galilei', birthDate: '1564-02-15', deathDate: '1642-01-08' },
  'harriet-tubman': { wikidata: 'https://www.wikidata.org/wiki/Q102870', wikipediaEn: 'https://en.wikipedia.org/wiki/Harriet_Tubman', wikipediaDe: 'https://de.wikipedia.org/wiki/Harriet_Tubman', deathDate: '1913-03-10' },
  'hildegard-von-bingen': { wikidata: 'https://www.wikidata.org/wiki/Q70991', wikipediaEn: 'https://en.wikipedia.org/wiki/Hildegard_of_Bingen', wikipediaDe: 'https://de.wikipedia.org/wiki/Hildegard_von_Bingen', deathDate: '1179-09-17' },
  'jane-austen': { wikidata: 'https://www.wikidata.org/wiki/Q36322', wikipediaEn: 'https://en.wikipedia.org/wiki/Jane_Austen', wikipediaDe: 'https://de.wikipedia.org/wiki/Jane_Austen', birthDate: '1775-12-16', deathDate: '1817-07-18' },
  'johann-wolfgang-von-goethe': { wikidata: 'https://www.wikidata.org/wiki/Q5879', wikipediaEn: 'https://en.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe', wikipediaDe: 'https://de.wikipedia.org/wiki/Johann_Wolfgang_von_Goethe', birthDate: '1749-08-28', deathDate: '1832-03-22' },
  'joseph-campbell': { wikidata: 'https://www.wikidata.org/wiki/Q295516', wikipediaEn: 'https://en.wikipedia.org/wiki/Joseph_Campbell', wikipediaDe: 'https://de.wikipedia.org/wiki/Joseph_Campbell', birthDate: '1904-03-26', deathDate: '1987-10-30' },
  'laozi': { wikidata: 'https://www.wikidata.org/wiki/Q9333', wikipediaEn: 'https://en.wikipedia.org/wiki/Laozi', wikipediaDe: 'https://de.wikipedia.org/wiki/Laozi' },
  'leonardo-da-vinci': { wikidata: 'https://www.wikidata.org/wiki/Q762', wikipediaEn: 'https://en.wikipedia.org/wiki/Leonardo_da_Vinci', wikipediaDe: 'https://de.wikipedia.org/wiki/Leonardo_da_Vinci', birthDate: '1452-04-15', deathDate: '1519-05-02' },
  'mahatma-gandhi': { wikidata: 'https://www.wikidata.org/wiki/Q1001', wikipediaEn: 'https://en.wikipedia.org/wiki/Mahatma_Gandhi', wikipediaDe: 'https://de.wikipedia.org/wiki/Mohandas_Karamchand_Gandhi', birthDate: '1869-10-02', deathDate: '1948-01-30' },
  'marcus-aurelius': { wikidata: 'https://www.wikidata.org/wiki/Q1430', wikipediaEn: 'https://en.wikipedia.org/wiki/Marcus_Aurelius', wikipediaDe: 'https://de.wikipedia.org/wiki/Mark_Aurel', birthDate: '0121-04-26', deathDate: '0180-03-17' },
  'martin-luther-king-jr': { wikidata: 'https://www.wikidata.org/wiki/Q8027', wikipediaEn: 'https://en.wikipedia.org/wiki/Martin_Luther_King_Jr.', wikipediaDe: 'https://de.wikipedia.org/wiki/Martin_Luther_King', birthDate: '1929-01-15', deathDate: '1968-04-04' },
  'maya-angelou': { wikidata: 'https://www.wikidata.org/wiki/Q19526', wikipediaEn: 'https://en.wikipedia.org/wiki/Maya_Angelou', wikipediaDe: 'https://de.wikipedia.org/wiki/Maya_Angelou', birthDate: '1928-04-04', deathDate: '2014-05-28' },
  'meister-eckhart': { wikidata: 'https://www.wikidata.org/wiki/Q76548', wikipediaEn: 'https://en.wikipedia.org/wiki/Meister_Eckhart', wikipediaDe: 'https://de.wikipedia.org/wiki/Meister_Eckhart' },
  'nelson-mandela': { wikidata: 'https://www.wikidata.org/wiki/Q8023', wikipediaEn: 'https://en.wikipedia.org/wiki/Nelson_Mandela', wikipediaDe: 'https://de.wikipedia.org/wiki/Nelson_Mandela', birthDate: '1918-07-18', deathDate: '2013-12-05' },
  'plato': { wikidata: 'https://www.wikidata.org/wiki/Q859', wikipediaEn: 'https://en.wikipedia.org/wiki/Plato', wikipediaDe: 'https://de.wikipedia.org/wiki/Platon' },
  'rumi': { wikidata: 'https://www.wikidata.org/wiki/Q43347', wikipediaEn: 'https://en.wikipedia.org/wiki/Rumi', wikipediaDe: 'https://de.wikipedia.org/wiki/Rumi_(Dichter)', birthDate: '1207-09-30', deathDate: '1273-12-17' },
  'siddhartha-gautama': { wikidata: 'https://www.wikidata.org/wiki/Q9441', wikipediaEn: 'https://en.wikipedia.org/wiki/The_Buddha', wikipediaDe: 'https://de.wikipedia.org/wiki/Siddhartha_Gautama' },
  'simone-de-beauvoir': { wikidata: 'https://www.wikidata.org/wiki/Q7197', wikipediaEn: 'https://en.wikipedia.org/wiki/Simone_de_Beauvoir', wikipediaDe: 'https://de.wikipedia.org/wiki/Simone_de_Beauvoir', birthDate: '1908-01-09', deathDate: '1986-04-14' },
  'virginia-woolf': { wikidata: 'https://www.wikidata.org/wiki/Q40909', wikipediaEn: 'https://en.wikipedia.org/wiki/Virginia_Woolf', wikipediaDe: 'https://de.wikipedia.org/wiki/Virginia_Woolf', birthDate: '1882-01-25', deathDate: '1941-03-28' },
  'william-blake': { wikidata: 'https://www.wikidata.org/wiki/Q41513', wikipediaEn: 'https://en.wikipedia.org/wiki/William_Blake', wikipediaDe: 'https://de.wikipedia.org/wiki/William_Blake', birthDate: '1757-11-28', deathDate: '1827-08-12' },
  'william-shakespeare': { wikidata: 'https://www.wikidata.org/wiki/Q692', wikipediaEn: 'https://en.wikipedia.org/wiki/William_Shakespeare', wikipediaDe: 'https://de.wikipedia.org/wiki/William_Shakespeare', birthDate: '1564', deathDate: '1616-04-23' },
  'wolfgang-amadeus-mozart': { wikidata: 'https://www.wikidata.org/wiki/Q254', wikipediaEn: 'https://en.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart', wikipediaDe: 'https://de.wikipedia.org/wiki/Wolfgang_Amadeus_Mozart', birthDate: '1756-01-27', deathDate: '1791-12-05' },
};
