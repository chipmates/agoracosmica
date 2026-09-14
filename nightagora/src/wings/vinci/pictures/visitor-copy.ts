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
    en: 'An early painting by Leonardo. The Uffizi’s published measurements differ from the dimensions used here.',
    de: 'Ein frühes Gemälde Leonardos. Die veröffentlichten Maße der Uffizien weichen von den hier verwendeten Maßen ab.',
  },
  'annunciation-predella': {
    en: 'This small altar panel is only 16 cm high. Its attribution to Leonardo or Lorenzo di Credi remains disputed.',
    de: 'Diese kleine Altartafel ist nur 16 cm hoch. Ihre Zuschreibung an Leonardo oder Lorenzo di Credi bleibt umstritten.',
  },
  'madonna-of-the-carnation': {
    en: 'An early Madonna by Leonardo, painted in oil on poplar wood.',
    de: 'Eine frühe Madonna Leonardos, in Öl auf Pappelholz gemalt.',
  },
  'ginevra-de-benci': {
    en: 'These are the two faces of Leonardo’s small panel. The wreath belongs to the reverse of Ginevra’s portrait. The bottom of the panel was cut away at some point, and her arms and hands are believed lost with it.',
    de: 'Dies sind die beiden Seiten von Leonardos kleiner Tafel. Der Kranz gehört zur Rückseite von Ginevras Porträt. Der untere Rand der Tafel wurde irgendwann abgeschnitten, ihre Arme und Hände gelten seither als verloren.',
  },
  'benois-madonna': {
    en: 'Leonardo’s Madonna was transferred from wood to canvas. The available photograph shows the Hermitage painting.',
    de: 'Leonardos Madonna wurde von Holz auf Leinwand übertragen. Die verfügbare Fotografie zeigt das Gemälde der Eremitage.',
  },
  'adoration-of-the-magi': {
    en: 'Leonardo left this painting unfinished. The photograph shows its appearance after the Uffizi’s restoration.',
    de: 'Leonardo ließ dieses Gemälde unvollendet. Die Fotografie zeigt seinen Zustand nach der Restaurierung in den Uffizien.',
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
    en: 'Leonardo’s London version is a separate painting from the one in Paris. The extent of workshop participation remains debated.',
    de: 'Leonardos Londoner Fassung ist ein eigenständiges Gemälde neben der Pariser Fassung. Der Umfang der Werkstattbeteiligung bleibt umstritten.',
  },
  'portrait-of-a-musician': {
    en: 'Attributed to Leonardo. The torso’s authorship is debated. Removing later paint revealed the hand and its sheet of music.',
    de: 'Leonardo zugeschrieben. Die Urheberschaft des Oberkörpers ist umstritten. Unter späteren Übermalungen kamen die Hand und das Notenblatt zum Vorschein.',
  },
  'lady-with-an-ermine': {
    en: 'Leonardo’s portrait retains a later black repaint behind the sitter. Published measurements of the panel differ.',
    de: 'Leonardos Porträt zeigt hinter der Dargestellten eine spätere schwarze Übermalung. Die veröffentlichten Maße der Tafel weichen voneinander ab.',
  },
  'la-belle-ferronniere': {
    en: 'A portrait by Leonardo. The Louvre regards its familiar title as mistaken. The sitter’s identity remains uncertain.',
    de: 'Ein Porträt Leonardos. Der Louvre bezeichnet den geläufigen Titel als Irrtum. Die Identität der Dargestellten bleibt ungewiss.',
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
    en: 'Leonardo’s original painted field is 113 cm wide. The support was widened later to 130 cm, which is the width of the frame on the wall.',
    de: 'Leonardos ursprüngliches Bildfeld ist 113 cm breit. Die Holztafel wurde später auf 130 cm verbreitert, und so breit ist der Rahmen an der Wand.',
  },
  'mona-lisa': {
    en: 'This is a historical printed reproduction, not the painting. Its publication date is uncertain, and it cannot establish the painting’s colour. The panel itself belongs to the Louvre collection.',
    de: 'Dies ist eine historische Druckreproduktion, nicht das Gemälde. Ihr Erscheinungsdatum ist ungewiss, und sie kann die Farbigkeit des Gemäldes nicht belegen. Die Tafel selbst gehört zur Sammlung des Louvre.',
  },
  'saint-john-the-baptist': {
    en: 'A late painting by Leonardo on walnut. The photograph was taken at the Louvre Abu Dhabi.',
    de: 'Ein spätes Gemälde Leonardos auf Nussbaumholz. Die Fotografie entstand im Louvre Abu Dhabi.',
  },
  bacchus: {
    en: 'A painting from Leonardo’s workshop, also associated with Francesco Melzi. The figure was later changed from Saint John into Bacchus.',
    de: 'Ein Gemälde aus Leonardos Werkstatt, auch mit Francesco Melzi verbunden. Die Figur wurde später von Johannes dem Täufer zu Bacchus verändert.',
  },
  'la-scapigliata': {
    en: 'An unfinished head attributed to Leonardo. It is painted in umber and lead white on poplar.',
    de: 'Ein unvollendeter Kopf, Leonardo zugeschrieben. Er ist mit Umbra und Bleiweiß auf Pappelholz gemalt.',
  },
  'madonna-litta': {
    en: 'The Hermitage names Leonardo. Boltraffio and Marco d’Oggiono have also been proposed. The attribution remains disputed.',
    de: 'Die Eremitage nennt Leonardo. Auch Boltraffio und Marco d’Oggiono wurden vorgeschlagen. Die Zuschreibung bleibt umstritten.',
  },
  'salvator-mundi': {
    en: 'The attribution to Leonardo remains disputed. Extensive restoration shapes the surviving painting. Its present location is unconfirmed.',
    de: 'Die Zuschreibung an Leonardo bleibt umstritten. Umfangreiche Restaurierungen prägen das erhaltene Gemälde. Sein heutiger Aufenthaltsort ist unbestätigt.',
  },
  'yarnwinder-buccleuch': {
    en: 'Leonardo and his workshop made this version of the Madonna with a yarnwinder. The painting was stolen and later recovered.',
    de: 'Leonardo und seine Werkstatt schufen diese Fassung der Madonna mit der Spindel. Das Gemälde wurde gestohlen und später wiedergefunden.',
  },
  'yarnwinder-lansdowne': {
    en: 'The Met attributes this version to Leonardo and his workshop. The paint was transferred from walnut to another support.',
    de: 'Das Metropolitan Museum schreibt diese Fassung Leonardo und seiner Werkstatt zu. Die Malerei wurde von Nussbaumholz auf einen anderen Bildträger übertragen.',
  },
  'burlington-house-cartoon': {
    en: 'Leonardo’s large drawing joins eight sheets of paper mounted on canvas.',
    de: 'Leonardos große Zeichnung besteht aus acht zusammengefügten Papierblättern auf Leinwand.',
  },
  'anghiari-copy': {
    en: 'A later Italian copy preserves Leonardo’s lost battle scene. It was reworked, perhaps by Rubens, and enlarged with added paper strips.',
    de: 'Eine spätere italienische Kopie bewahrt Leonardos verlorene Schlachtenszene. Sie wurde überarbeitet, möglicherweise von Rubens, und durch angesetzte Papierstreifen vergrößert.',
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

/** A source change must not inherit a statement about a different image. */
export function visitorNote(work: PictureWork, entries: readonly ResolvedPicturePlate[] = []): PictureBilingual {
  const first = entries[0]?.plate as PolicyPaintingEntry | undefined
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
  return NOTES[work.id] ?? {
    en: 'The history of this work is available in the record.',
    de: 'Die Geschichte dieses Werkes steht im Nachweis.',
  }
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
    en: 'Reproduction from Wikimedia Commons. The image credit and reuse terms are in the record.',
    de: 'Reproduktion aus Wikimedia Commons. Bildnachweis und Nutzungsbedingungen stehen im Verzeichnis.',
  }
  return {
    en: 'The image source, credit and reuse terms are in the record.',
    de: 'Bildquelle, Urheber und Nutzungsbedingungen stehen im Nachweis.',
  }
}
