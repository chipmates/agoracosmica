/** Short museum readings of the supplied collection and admitted sources.
 * The complete source statements, dates, measurements and licences belong in
 * the deliberately opened record. These readings never replace that record.
 */
import type { PictureBilingual } from './policy-label'
import type { PolicyPaintingEntry } from './policy'
import type { PictureWork, ResolvedPicturePlate } from './register'

const NOTES: Readonly<Record<string, PictureBilingual>> = {
  'baptism-of-christ': {
    en: 'A painting from Verrocchio’s workshop, with a small contribution by the young Leonardo. The extent of Leonardo’s part is debated.',
    de: 'Ein Gemälde aus Verrocchios Werkstatt mit einem kleinen Beitrag des jungen Leonardo. Der Umfang von Leonardos Anteil ist umstritten.',
  },
  annunciation: {
    en: 'An early painting by Leonardo. The size this wall hangs it at differs a little from the holder’s own.',
    de: 'Ein frühes Gemälde Leonardos. Das Maß dieser Wand weicht etwas vom Maß der Sammlung ab.',
  },
  'annunciation-predella': {
    en: 'This panel is a predella, a step from the foot of an altarpiece.',
    de: 'Diese Tafel ist eine Predella, eine Stufe vom Fuß eines Altarbildes.',
  },
  'madonna-of-the-carnation': {
    en: 'An early Madonna by Leonardo, painted in oil on poplar wood.',
    de: 'Eine frühe Madonna Leonardos, in Öl auf Pappelholz gemalt.',
  },
  'ginevra-de-benci': {
    en: 'These are the two faces of one small panel by Leonardo. The wreath belongs to the back.',
    de: 'Das sind die beiden Seiten einer kleinen Tafel Leonardos. Der Kranz gehört zur Rückseite.',
  },
  'benois-madonna': {
    en: 'Leonardo’s Madonna was moved from its wood panel onto canvas.',
    de: 'Leonardos Madonna wurde von der Holztafel auf Leinwand übertragen.',
  },
  'adoration-of-the-magi': {
    en: 'What hangs here is a black and white copy printed in 1901. The painting itself was cleaned long after that.',
    de: 'Hier hängt eine Schwarz-Weiß-Wiedergabe von 1901. Das Gemälde selbst wurde erst lange danach gereinigt.',
  },
  'saint-jerome': {
    en: 'Leonardo left this walnut panel unfinished. The date of this photograph has not been verified.',
    de: 'Leonardo ließ diese Tafel aus Nussbaumholz unvollendet. Das Aufnahmedatum dieser Fotografie ist nicht belegt.',
  },
  'virgin-of-the-rocks-louvre': {
    en: 'Leonardo’s Paris version was transferred from wood to canvas. The Paris and London versions are separate paintings.',
    de: 'Leonardos Pariser Fassung wurde von Holz auf Leinwand übertragen. Die Pariser und die Londoner Fassung sind eigenständige Gemälde.',
  },
  'virgin-of-the-rocks-london': {
    en: 'How much of this version came from his workshop is still argued.',
    de: 'Wie viel an dieser Fassung aus seiner Werkstatt kam, wird noch gestritten.',
  },
  'portrait-of-a-musician': {
    en: 'Attributed to Leonardo. Whether the body below the head is his is still argued.',
    de: 'Leonardo zugeschrieben. Ob der Körper unter dem Kopf von ihm ist, wird bis heute gestritten.',
  },
  'lady-with-an-ermine': {
    en: 'Published measurements of this panel differ from one another. Poland bought it with a whole private collection in 2016.',
    de: 'Die veröffentlichten Maße dieser Tafel weichen voneinander ab. Polen kaufte sie 2016 mit einer ganzen Privatsammlung.',
  },
  'la-belle-ferronniere': {
    en: 'A portrait by Leonardo. Nobody is sure who the woman is.',
    de: 'Ein Porträt Leonardos. Wer die Frau ist, weiß niemand sicher.',
  },
  'last-supper': {
    en: 'Leonardo painted this work on dry plaster. The photograph shows surviving paint, losses and restoration.',
    de: 'Leonardo malte dieses Werk auf trockenem Putz. Die Fotografie zeigt erhaltene Malerei, Fehlstellen und Restaurierungen.',
  },
  'sala-delle-asse': {
    en: 'Leonardo and his workshop painted the walls and vault. Later restoration is extensive. The photograph shows one monochrome wall section. The dimensions of the entire painted surface are unknown here.',
    de: 'Leonardo und seine Werkstatt bemalten Wände und Gewölbe. Spätere Restaurierungen waren umfangreich. Die Fotografie zeigt eine monochrome Wandpartie. Die Maße der gesamten bemalten Fläche sind hier unbekannt.',
  },
  'virgin-and-child-with-st-anne': {
    en: 'Leonardo’s original painted field is 113 cm wide. The panel was widened later to 130 cm, and this room hangs the original field.',
    de: 'Leonardos ursprüngliches Bildfeld ist 113 cm breit. Die Holztafel wurde später auf 130 cm verbreitert, und dieser Raum zeigt das ursprüngliche Bildfeld.',
  },
  'mona-lisa': {
    en: 'This is a historical printed reproduction, not the painting. Its date is uncertain, and it cannot show the painting’s colour.',
    de: 'Dies ist eine alte Druckwiedergabe, nicht das Gemälde. Ihr Datum ist ungewiss, und die Farben zeigt sie nicht.',
  },
  'saint-john-the-baptist': {
    en: 'A late painting by Leonardo on walnut. The photograph was taken at the Louvre Abu Dhabi.',
    de: 'Ein spätes Gemälde Leonardos auf Nussbaumholz. Die Fotografie entstand im Louvre Abu Dhabi.',
  },
  bacchus: {
    en: 'A painting from Leonardo’s workshop, also linked with Francesco Melzi.',
    de: 'Ein Gemälde aus Leonardos Werkstatt, auch mit Francesco Melzi verbunden.',
  },
  'la-scapigliata': {
    en: 'An unfinished head attributed to Leonardo. It is painted in umber and lead white on poplar.',
    de: 'Ein unvollendeter Kopf, Leonardo zugeschrieben. Er ist mit Umbra und Bleiweiß auf Pappelholz gemalt.',
  },
  'madonna-litta': {
    en: 'The Hermitage names Leonardo. Boltraffio and Marco d’Oggiono have been proposed too.',
    de: 'Die Eremitage nennt Leonardo. Auch Boltraffio und Marco d’Oggiono wurden vorgeschlagen.',
  },
  'salvator-mundi': {
    en: 'Whether Leonardo painted it is still argued, and an extensive restoration shapes much of what you see.',
    de: 'Ob Leonardo es gemalt hat, ist bis heute umstritten, und eine umfangreiche Restaurierung prägt vieles, was zu sehen ist.',
  },
  'yarnwinder-buccleuch': {
    en: 'A yarnwinder is the tool a spinner winds thread on. Two versions of this picture hang here.',
    de: 'Eine Spindel ist das Gerät, auf das ein Spinner Garn wickelt. Zwei Fassungen hängen hier.',
  },
  'yarnwinder-lansdowne': {
    en: 'The paint was moved off its walnut panel onto another support.',
    de: 'Die Malerei wurde vom Nussbaumholz auf einen anderen Träger übertragen.',
  },
  'burlington-house-cartoon': {
    en: 'Leonardo’s large drawing joins eight sheets of paper mounted on canvas.',
    de: 'Leonardos große Zeichnung besteht aus acht zusammengefügten Papierblättern auf Leinwand.',
  },
  'anghiari-copy': {
    en: 'Four strips of paper were added round the sheet to make it bigger.',
    de: 'Vier Papierstreifen wurden rundum angesetzt, um das Blatt zu vergrößern.',
  },
  'tavola-doria': {
    en: 'This copy preserves the central struggle in Leonardo’s lost Battle of Anghiari. Its maker and date remain uncertain.',
    de: 'Diese Kopie bewahrt den zentralen Kampf aus Leonardos verlorener Schlacht von Anghiari. Urheber und Entstehungszeit bleiben ungewiss.',
  },
  'leda-spiridon': {
    en: 'A follower of Leonardo painted this version of Leda. Leonardo’s original is lost.',
    de: 'Ein Nachfolger Leonardos malte diese Fassung der Leda. Leonardos Original ist verloren.',
  },
  'isabella-deste-cartoon': {
    en: 'Leonardo’s portrait drawing belongs to the Louvre collection. The available reproduction shows the full sheet, with limited detail.',
    de: 'Leonardos Porträtzeichnung gehört zur Sammlung des Louvre. Die verfügbare Reproduktion zeigt das ganze Blatt mit begrenztem Detailreichtum.',
  },
  'leda-wilton': {
    en: 'The Leda at Wilton House is attributed to Cesare da Sesto after Leonardo. It is represented here by its historical catalogue entry. No reproduction is available. Leonardo’s original is lost.',
    de: 'Die Leda in Wilton House wird Cesare da Sesto nach Leonardo zugeschrieben. Hier ist sie durch ihren historischen Katalogeintrag vertreten. Eine Reproduktion fehlt. Leonardos Original ist verloren.',
  },
  'vitruvian-man': {
    en: 'Leonardo’s drawing belongs to the Accademia collection in Venice. The photograph does not establish the sheet’s present colour.',
    de: 'Leonardos Zeichnung gehört zur Sammlung der Accademia in Venedig. Die Fotografie belegt nicht die heutige Farbigkeit des Blattes.',
  },
  'turin-self-portrait': {
    en: 'Leonardo’s drawing is traditionally called a self-portrait. The sitter’s identity remains disputed.',
    de: 'Leonardos Zeichnung gilt traditionell als Selbstporträt. Die Identität des Dargestellten bleibt umstritten.',
  },
}

const IN_THE_RECORD: PictureBilingual = {
  en: 'The history of this work is available in the record.',
  de: 'Die Geschichte dieses Werkes steht im Nachweis.',
}
/** The Mona Lisa's reading describes the historical print, so it is read only
 * where the print is the image the label stands under. */
const PRINTED = /print|druk|imprim/i

/** A source change must not inherit a statement about a different image. */
export function visitorNote(work: PictureWork, entries: readonly ResolvedPicturePlate[] = []): PictureBilingual {
  const first = entries[0]?.plate as PolicyPaintingEntry | undefined
  if (work.id === 'mona-lisa' && first && !PRINTED.test(first.honesty_en ?? '')) return IN_THE_RECORD
  if (work.id === 'salvator-mundi' && first?.plate_id === 'salvator-mundi:print-1844') return {
    en: 'The 1844 engraving is a separate image after Leonardo. It cannot establish the Cook painting’s earlier condition.',
    de: 'Der Stich von 1844 ist ein eigenständiges Bild nach Leonardo. Er kann den früheren Zustand des Cook-Gemäldes nicht belegen.',
  }
  if (work.id === 'salvator-mundi' && first?.plate_id === 'salvator-mundi:cook-historical') return {
    en: 'A historical photograph from the Cook Collection shows the painting before modern restoration. Its attribution to Leonardo remains disputed.',
    de: 'Eine historische Fotografie aus der Sammlung Cook zeigt das Gemälde vor der modernen Restaurierung. Seine Zuschreibung an Leonardo bleibt umstritten.',
  }
  if (work.id === 'isabella-deste-cartoon' && first && !first.tier) return {
    en: 'Leonardo’s portrait drawing belongs to the Louvre collection. This earlier reproduction shows a cropped view of the sheet.',
    de: 'Leonardos Porträtzeichnung gehört zur Sammlung des Louvre. Diese ältere Reproduktion zeigt einen beschnittenen Ausschnitt des Blattes.',
  }
  if (!entries.length && work.id !== 'leda-wilton') return {
    en: 'No reproduction of this work is available here. Its history is preserved in the record.',
    de: 'Hier ist keine Reproduktion dieses Werkes verfügbar. Seine Geschichte ist im Nachweis festgehalten.',
  }
  return NOTES[work.id] ?? IN_THE_RECORD
}

const HOLDERS: Readonly<Record<string, PictureBilingual>> = {
  'Gallerie degli Uffizi, Florence': { en: 'From the Uffizi collection, Florence.', de: 'Aus der Sammlung der Uffizien in Florenz.' },
  'Musée du Louvre, Paris': { en: 'From the Louvre collection, Paris.', de: 'Aus der Sammlung des Louvre in Paris.' },
  'Musée du Louvre, Département des Arts graphiques, Paris': { en: 'From the Louvre’s collection of drawings, Paris.', de: 'Aus der grafischen Sammlung des Louvre in Paris.' },
  'Bayerische Staatsgemäldesammlungen, Alte Pinakothek, Munich': { en: 'From the Bavarian State Painting Collections, Alte Pinakothek, Munich.', de: 'Aus den Bayerischen Staatsgemäldesammlungen, Alte Pinakothek, München.' },
  'National Gallery of Art, Washington': { en: 'From the collection of the National Gallery of Art, Washington.', de: 'Aus der Sammlung der National Gallery of Art in Washington.' },
  'State Hermitage Museum, Saint Petersburg': { en: 'From the Hermitage collection, Saint Petersburg.', de: 'Aus der Sammlung der Eremitage in Sankt Petersburg.' },
  'Pinacoteca Vaticana, Vatican City': { en: 'From the Vatican picture gallery’s collection.', de: 'Aus der Sammlung der Vatikanischen Pinakothek.' },
  'National Gallery, London': { en: 'From the National Gallery collection, London.', de: 'Aus der Sammlung der National Gallery in London.' },
  'Veneranda Biblioteca Ambrosiana, Milan': { en: 'From the Ambrosiana collection, Milan.', de: 'Aus der Sammlung der Ambrosiana in Mailand.' },
  'Muzeum Narodowe w Krakowie, Muzeum Książąt Czartoryskich': { en: 'Czartoryski collection, National Museum in Kraków.', de: 'Sammlung Czartoryski, Nationalmuseum in Krakau.' },
  'Museo del Cenacolo Vinciano, Santa Maria delle Grazie, Milan': { en: 'Cenacolo Vinciano museum, Santa Maria delle Grazie, Milan.', de: 'Museum Cenacolo Vinciano, Santa Maria delle Grazie, Mailand.' },
  'Castello Sforzesco, Milan': { en: 'Sala delle Asse, Castello Sforzesco, Milan.', de: 'Sala delle Asse, Castello Sforzesco, Mailand.' },
  'Galleria Nazionale di Parma, Complesso della Pilotta': { en: 'From the National Gallery of Parma’s collection, Pilotta.', de: 'Aus der Sammlung der Nationalgalerie von Parma in der Pilotta.' },
  'Private collection, present location unconfirmed': { en: 'Private collection. Its present location is unconfirmed.', de: 'Privatsammlung. Der heutige Aufenthaltsort ist unbestätigt.' },
  'Buccleuch collection, on loan to National Galleries of Scotland': { en: 'From the Buccleuch collection, on loan to the National Galleries of Scotland.', de: 'Aus der Sammlung Buccleuch, als Leihgabe an die National Galleries of Scotland.' },
  'Kenneth C. Griffin Collection, on loan to The Metropolitan Museum of Art': { en: 'From the Kenneth C. Griffin Collection, on loan to the Met.', de: 'Aus der Kenneth C. Griffin Collection, als Leihgabe an das Metropolitan Museum.' },
  'Earl of Pembroke collection, Wilton House': { en: 'The copy belongs to the Earl of Pembroke’s collection at Wilton House.', de: 'Die Kopie gehört zur Sammlung des Earl of Pembroke in Wilton House.' },
}

/** Holder names describe the work, independently of who supplied its image. */
export function visitorHolder(work: PictureWork): PictureBilingual {
  return HOLDERS[work.holder] ?? {
    en: 'The holding collection is named in the record.',
    de: 'Die Sammlung ist im Nachweis genannt.',
  }
}

/** A spoken source credit. Exact reuse terms remain in the complete record. */
export function visitorSource(entries: readonly ResolvedPicturePlate[]): PictureBilingual {
  if (!entries.length) return { en: 'No reproduction is available here.', de: 'Hier ist keine Reproduktion verfügbar.' }
  const plates = entries.map(entry => entry.plate as PolicyPaintingEntry)
  if (plates.length === 1 && plates[0]?.work_id === 'mona-lisa'
    && plates[0].holder?.includes('National Library of Poland')) return {
    en: 'Historical print digitised by the National Library of Poland. Public domain image via Wikimedia Commons.',
    de: 'Historischer Druck, digitalisiert von der polnischen Nationalbibliothek. Gemeinfreies Bild aus Wikimedia Commons.',
  }
  if (plates.length === 1 && plates[0]?.work_id === 'madonna-of-the-carnation' && plates[0].tier === 'TIER1') return {
    en: 'Collection photograph from the Bavarian State Painting Collections, shared through Wikimedia Commons with credit to the museum.',
    de: 'Sammlungsfotografie der Bayerischen Staatsgemäldesammlungen, über Wikimedia Commons mit Nennung des Museums bereitgestellt.',
  }
  if (plates.length === 1 && plates[0]?.work_id === 'lady-with-an-ermine' && plates[0].tier === 'TIER1') return {
    en: 'Public domain collection image from the National Museum in Kraków, via Wikimedia Commons.',
    de: 'Gemeinfreies Sammlungsbild des Nationalmuseums in Krakau, aus Wikimedia Commons.',
  }
  const commons = plates.every(plate => plate.source_url?.startsWith('https://commons.wikimedia.org/'))
  const publicDomain = plates.every(plate => /^(?:Public domain|CC0|Creative Commons Zero)/i.test(plate.licence))
  if (commons && publicDomain) return {
    en: entries.length === 1 ? 'Public domain reproduction from Wikimedia Commons.' : 'Public domain reproductions from Wikimedia Commons.',
    de: entries.length === 1 ? 'Gemeinfreie Reproduktion aus Wikimedia Commons.' : 'Gemeinfreie Reproduktionen aus Wikimedia Commons.',
  }
  if (commons) return {
    en: 'Reproduction from Wikimedia Commons, with its credit and reuse terms in the record.',
    de: 'Reproduktion aus Wikimedia Commons, mit Urheber und Nutzungsbedingungen im Nachweis.',
  }
  return {
    en: 'The image source, credit and reuse terms are in the record.',
    de: 'Bildquelle, Urheber und Nutzungsbedingungen stehen im Nachweis.',
  }
}
