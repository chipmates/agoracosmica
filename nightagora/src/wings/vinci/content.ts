import doorsSource from './data/doors.json?raw';
import neverSaidSource from './line/data/never-said.json?raw';

export type VinciLanguage = 'en' | 'de';
export type VinciCertainty = 'documented' | 'reconstructed' | 'conjectural' | 'unknown';
export type VinciStationId =
  | 'arrival' | 'courtyard' | 'hall' | 'oratory' | 'study' | 'chamber' | 'garden'
  | 'line-early' | 'picture-room' | 'picture-room-west'
  | 'supper-wall' | 'reading-table' | 'flight' | 'works' | 'body' | 'grave';

export interface VinciText {
  en: string;
  de: string;
}

export interface VinciStatement extends VinciText {
  id: string;
  certainty: VinciCertainty;
  target: 'document' | 'measurement' | 'carrier' | 'absence';
  source: string;
  humanSource?: VinciText;
  record?: VinciText;
  germanProvenance: 'supplied' | 'museum translation';
  /** the built object a carrier statement stands on, where it is not the house */
  carrier?: string;
}

export interface VinciDoor extends VinciText {
  station: VinciStationId;
}

export interface VinciStationContent {
  id: VinciStationId;
  number: number;
  group: 'house' | 'line' | 'collection';
  name: VinciText;
  promise: VinciText;
  record?: VinciText;
  promiseSource: string;
  germanProvenance: 'supplied' | 'museum translation';
  outdoor: boolean;
  /** The station already holds its built scene or collection content. */
  built: boolean;
  carrierClass: 'GENERATED';
  carrierCertainty: 'reconstructed';
  labels: readonly VinciStatement[];
  door: VinciDoor;
}

interface DoorSource {
  doors: Array<{ station: string; question_en: string; question_de: string }>;
  door_contract: {
    figure_id: string;
    figure_name: string;
    fallback_tag: string;
    fallback_behavior: string;
    proposed_tag_pattern: string;
    proposed_tag_status: string;
    return_behavior: string;
  };
}

const doorData = JSON.parse(doorsSource) as DoorSource;
export const vinciDoorContract = Object.freeze(doorData.door_contract);
export const vinciConstructionStatus: VinciText = { en: 'in construction', de: 'im Bau' };
export const vinciHourSpoken: VinciText = {
  en: '15:19 by the sun, 10 October 1517',
  de: '15:19 nach der Sonne, 10. Oktober 1517',
};
/** A named sub-view stands at one station but shows another object; its own
 * line keeps the card and the frame naming the same thing. */
export const vinciViewNames: Readonly<Record<string, VinciText>> = {
  gable: { en: 'The north gable, from the meadow', de: 'Der Nordgiebel, von der Wiese aus' },
  collection: { en: 'The collection ground, below the garden', de: 'Der Sammlungsgrund, unterhalb des Gartens' },
};

export const vinciCertaintyWords: Record<VinciCertainty, VinciText> = {
  documented: { en: 'documented', de: 'dokumentiert' },
  reconstructed: { en: 'reconstructed', de: 'rekonstruiert' },
  conjectural: { en: 'conjectural', de: 'vermutet' },
  unknown: { en: 'not known', de: 'nicht bekannt' },
};

export const vinciTranslationNote: VinciText = {
  en: 'Museum translation. The source supplies no German station text.',
  de: 'Übersetzung des Museums. Die Quelle enthält keinen deutschen Stationstext.',
};

interface VisitorWords extends VinciText {
  sourceEn: string;
  sourceDe: string;
}

const visitorWords: Record<string, VisitorWords> = {
  reconstruction: {
    en: 'The house and ground are reconstructed from photographs and the cadastre.',
    de: 'Haus und Gelände sind nach Fotografien und dem Kataster rekonstruiert.',
    sourceEn: 'The cadastre and photographs of Clos Lucé.',
    sourceDe: 'Der Kataster und Fotografien von Clos Lucé.',
  },
  'interior-arrangement': {
    en: 'The surviving walls and photographs guide this reconstruction, while the room arrangement is our own.',
    de: 'Die erhaltenen Mauern und Fotografien leiten diese Rekonstruktion, die Raumaufteilung stammt von uns.',
    sourceEn: 'The surviving house and photographs of its rooms.',
    sourceDe: 'Das erhaltene Haus und Fotografien seiner Räume.',
  },
  'house-fabric': {
    en: 'The late medieval house has been restored, and its rooms are reconstructed here.',
    de: 'Das spätmittelalterliche Haus wurde restauriert, seine Räume sind hier rekonstruiert.',
    sourceEn: 'The surviving house and the historic photographs.',
    sourceDe: 'Das erhaltene Haus und die historischen Fotografien.',
  },
  'park-arrangement': {
    en: 'The slope follows the survey, while the garden arrangement is reconstructed.',
    de: 'Der Hang folgt der Vermessung, die Gartenanlage ist rekonstruiert.',
    sourceEn: 'The site survey and modern photographs of the garden.',
    sourceDe: 'Die Geländevermessung und heutige Fotografien des Gartens.',
  },
  'planting-assumptions': {
    en: 'The trees, shrubs, ivy and fallen leaves are types of the period. The grass and the moss are imagined.',
    de: 'Bäume, Sträucher, Efeu und Laub sind Typen der Zeit. Gras und Moos sind frei gestaltet.',
    sourceEn: 'No source records what grew here in Leonardo’s time. The species and their state in late October follow a study of the plants near the Loire.',
    sourceDe: 'Keine Quelle belegt, was zu Leonardos Zeit hier wuchs. Die Arten und ihr Zustand im späten Oktober folgen einer Studie der Pflanzen an der Loire.',
  },
  'weather-assumptions': {
    en: 'The clouds and haze are imagined, since no source records the weather at this hour.',
    de: 'Wolken und Dunst sind frei gestaltet, denn keine Quelle hält das Wetter dieser Stunde fest.',
    sourceEn: 'The museum chose the weather around the calculated sunlight.',
    sourceDe: 'Das Museum hat das Wetter zum berechneten Sonnenlicht gewählt.',
  },
  'collection-threshold': {
    en: 'You are leaving 1517 for a museum built in our own century.',
    de: 'Du verlässt das Jahr 1517 und betrittst ein Museum unseres Jahrhunderts.',
    sourceEn: 'The museum’s own building and collection plan.',
    sourceDe: 'Der eigene Bau- und Sammlungsplan des Museums.',
  },
  'no-bodies': {
    en: 'The machines are shown without anyone working them.',
    de: 'Die Maschinen werden ohne Menschen gezeigt, die sie bedienen.',
    sourceEn: 'This museum shows no human figures in its reconstructed scenes.',
    sourceDe: 'Dieses Museum zeigt in seinen rekonstruierten Szenen keine menschlichen Figuren.',
  },
  'computed-hour': {
    en: 'We chose this hour on the day of the recorded visit and calculated the sunlight with Meeus’s method.',
    de: 'Wir haben diese Stunde am Tag des belegten Besuchs gewählt und das Sonnenlicht nach Meeus berechnet.',
    sourceEn: 'Antonio de Beatis’s diary records the visit, and Jean Meeus’s Astronomical Algorithms supplies the calculation method.',
    sourceDe: 'Antonio de Beatis hält den Besuch in seinem Tagebuch fest, Jean Meeus liefert in Astronomical Algorithms die Rechenmethode.',
  },
  'chosen-minute': {
    en: 'The visit is documented, but its hour was not recorded.',
    de: 'Der Besuch ist dokumentiert, seine Uhrzeit wurde nicht festgehalten.',
    sourceEn: 'Antonio de Beatis’s diary gives the day of the visit.',
    sourceDe: 'Das Tagebuch von Antonio de Beatis nennt den Tag des Besuchs.',
  },
  'site-measurement': {
    en: 'The cadastre records where this house stands in Amboise.',
    de: 'Der Kataster verzeichnet den Standort dieses Hauses in Amboise.',
    sourceEn: 'The French cadastre, recorded in OpenStreetMap.',
    sourceDe: 'Der französische Kataster, erfasst in OpenStreetMap.',
  },
  'carved-inscription-record': {
    en: 'Photographs show a bird above the courtyard door with the words DIEV AVANT TOVT.',
    de: 'Fotografien zeigen über der Hoftür einen Vogel mit den Worten DIEV AVANT TOVT.',
    sourceEn: 'Photographs of the carved courtyard doorway.',
    sourceDe: 'Fotografien des reliefgeschmückten Hofportals.',
  },
  'hall-arrangement': {
    en: 'The hall is reconstructed with panelling and a fireplace altered in the eighteenth century.',
    de: 'Der Saal ist mit einer Vertäfelung und einem Kamin rekonstruiert, die im achtzehnten Jahrhundert verändert wurden.',
    sourceEn: 'Photographs of the great hall and the history of its alterations.',
    sourceDe: 'Fotografien des großen Saals und die Geschichte seiner Umbauten.',
  },
  'oratory-date': {
    en: 'Tradition dates Anne of Brittany’s oratory to 1492.',
    de: 'Der Überlieferung nach stammt das Oratorium der Anne de Bretagne von 1492.',
    sourceEn: 'The reported history of the oratory.',
    sourceDe: 'Die überlieferte Geschichte des Oratoriums.',
  },
  'oratory-date-qualification': {
    en: 'The oratory’s exact year of construction remains uncertain.',
    de: 'Das genaue Baujahr des Oratoriums bleibt unsicher.',
    sourceEn: 'The traditional date has not been established by a building survey.',
    sourceDe: 'Das überlieferte Baujahr wurde durch keine Bauuntersuchung bestätigt.',
  },
  'oratory-attribution': {
    en: 'The wall paintings may be by Leonardo’s pupils, but the attribution is unsettled.',
    de: 'Die Wandmalereien könnten von Leonardos Schülern stammen, doch die Zuschreibung ist ungeklärt.',
    sourceEn: 'The published account of the oratory’s wall paintings.',
    sourceDe: 'Die veröffentlichte Beschreibung der Wandmalereien des Oratoriums.',
  },
  'visit-record': {
    en: 'The cardinal’s secretary recorded paintings and many books during his visit here.',
    de: 'Der Sekretär des Kardinals verzeichnete bei seinem Besuch hier Gemälde und viele Bücher.',
    sourceEn: 'Antonio de Beatis’s diary of the visit.',
    sourceDe: 'Antonio de Beatis’ Tagebuch des Besuchs.',
  },
  'death-record': {
    en: 'Leonardo died in this house on 2 May 1519.',
    de: 'Leonardo starb am 2. Mai 1519 in diesem Haus.',
    sourceEn: 'Francesco Melzi’s letter reporting Leonardo’s death.',
    sourceDe: 'Francesco Melzis Brief über Leonardos Tod.',
  },
  'chamber-placement': {
    en: 'The house museum places his room at this end, facing the royal château.',
    de: 'Das Hausmuseum verortet sein Zimmer an diesem Ende, mit Blick auf das königliche Schloss.',
    sourceEn: 'The house museum’s room description and the view toward the royal château.',
    sourceDe: 'Die Raumbeschreibung des Hausmuseums und der Blick zum königlichen Schloss.',
  },
  'picture-absence': {
    en: 'Every position in this hang carries a picture, and each one names the reproduction it comes from.',
    de: 'Jeder Platz dieser Hängung trägt ein Bild, und jedes nennt die Reproduktion, aus der es stammt.',
    sourceEn: 'The room’s retained hang and the museum’s picture register.',
    sourceDe: 'Die beibehaltene Hängung des Raums und das Bilderverzeichnis des Museums.',
  },
  'supper-record': {
    en: 'The Last Supper survives as a fragile wall painting in Milan.',
    de: 'Das Abendmahl ist als empfindliche Wandmalerei in Mailand erhalten.',
    sourceEn: 'The Last Supper museum’s record describes painting on a dry wall, not fresco.',
    sourceDe: 'Das Museum des Abendmahls beschreibt Malerei auf trockenem Putz, kein Fresko.',
  },
  'supper-absence': {
    en: 'The original wall painting remains in Milan. This wall holds its measured outline and an available reproduction.',
    de: 'Das originale Wandgemälde bleibt in Mailand. Diese Wand trägt seinen vermessenen Umriss und eine verfügbare Reproduktion.',
    sourceEn: 'The museum’s picture register and the reproduction’s source record.',
    sourceDe: 'Das Bilderverzeichnis des Museums und der Quellennachweis der Reproduktion.',
  },
  'facsimile-record': {
    en: 'This reproduction of Manuscript B was printed in 1883.',
    de: 'Diese Nachbildung von Manuskript B wurde 1883 gedruckt.',
    sourceEn: 'Charles Ravaisson-Mollien’s printed facsimile of Manuscript B.',
    sourceDe: 'Charles Ravaisson-Molliens gedrucktes Faksimile von Manuskript B.',
  },
  'reading-room': {
    en: 'This small oak room is new, built for the museum like a scholar\u2019s study of his time. Nothing in it was his.',
    de: 'Dieser kleine Raum aus Eiche ist neu, für das Museum gebaut wie das Studierzimmer eines Gelehrten seiner Zeit. Nichts darin gehörte ihm.',
    sourceEn: 'Panelling of his time, as types: linenfold, raised panels, pilasters and a coffered ceiling. No single room is copied.',
    sourceDe: 'Täfelung seiner Zeit, als Typen: Faltwerk, erhabene Füllungen, Pilaster und eine Kassettendecke. Kein einzelner Raum ist kopiert.',
  },
  'surviving-notebooks': {
    en: 'The surviving notebooks are held in collections around the world.',
    de: 'Die erhaltenen Notizbücher befinden sich in Sammlungen auf der ganzen Welt.',
    sourceEn: 'Richter’s manuscript census and the records of their present holders.',
    sourceDe: 'Richters Handschriftenverzeichnis und die Angaben der heutigen Sammlungen.',
  },
  'anatomy-absence': {
    en: 'Twenty-nine of his anatomical sheets from Windsor hang on this wall, each from a public reproduction.',
    de: 'Neunundzwanzig seiner anatomischen Blätter aus Windsor hängen an dieser Wand, jedes aus einer öffentlichen Reproduktion.',
    sourceEn: 'The Royal Collection’s records and image terms.',
    sourceDe: 'Die Bestandsangaben und Bildrechte der Royal Collection.',
  },
  'burial-record': {
    en: 'Accounts place his burial at Saint-Florentin, a church that was later demolished.',
    de: 'Berichte nennen Saint-Florentin als seinen Begräbnisort, eine später abgerissene Kirche.',
    sourceEn: 'The reported burial register and the history of the royal château.',
    sourceDe: 'Das zitierte Begräbnisregister und die Geschichte des königlichen Schlosses.',
  },
};

const museumStatement = (original: VinciStatement): VinciStatement => {
  const words = visitorWords[original.id];
  if (!words) throw new Error(`Missing visitor wording for ${original.id}`);
  return {
    ...original,
    en: words.en, de: words.de,
    germanProvenance: 'museum translation',
    humanSource: { en: words.sourceEn, de: words.sourceDe },
    record: { en: original.en, de: original.de },
  };
};

export const vinciReconstruction: VinciStatement = museumStatement({
  id: 'reconstruction',
  en: 'everything you can walk on is reconstructed from photographs and the cadastre.',
  de: 'Alles, worauf du gehen kannst, ist anhand von Fotografien und dem Kataster rekonstruiert.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S1', germanProvenance: 'museum translation',
});

export const vinciThreshold: VinciStatement = museumStatement({
  id: 'interior-arrangement',
  en: 'House reconstructed from its surviving shell and photographs. Interior arrangement proposed for this exhibition.',
  de: 'Das Haus wurde anhand seiner erhaltenen Bausubstanz und von Fotografien rekonstruiert. Die Raumaufteilung ist ein Vorschlag für diese Ausstellung.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT.md §1', germanProvenance: 'museum translation',
});

export const vinciHouseLabel: VinciStatement = museumStatement({
  id: 'house-fabric',
  en: 'Late medieval house. The surviving building has been restored. This interior arrangement is a reconstruction.',
  de: 'Spätmittelalterliches Haus. Der erhaltene Bau wurde restauriert. Diese Raumaufteilung ist eine Rekonstruktion.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md §Period labels', germanProvenance: 'supplied',
});

export const vinciParkLabel: VinciStatement = museumStatement({
  id: 'park-arrangement',
  en: 'The landscape is real; this arrangement is proposed. The museum’s machine park and formal displays are modern.',
  de: 'Die Landschaft ist real; diese Anordnung ist ein Vorschlag. Maschinenpark und formale Schaugärten des Museums sind modern.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md §Period labels', germanProvenance: 'supplied',
});

export const vinciPlantingAssumptions: VinciStatement = museumStatement({
  id: 'planting-assumptions',
  en: 'Tree and shrub species, positions and sizes, the ivy, the moss and the fallen leaves are conjectural. No source records what grew at Cloux in 1517. The species and their state in late October follow a study of the region’s flora, as types of the period. The trees are walnut, field elm, oak, field maple, wild cherry, hornbeam, alder, pollard white willow, black poplar and pear. Modern garden photographs inform their branching only, not the planting of 1517. Proposed tree heights are 7.2 to 27 m, with the grave’s poplar at 15 m and a tall elm among the Amasse’s trees at 27 m. Six middle-distance trees stand at EN (−53,12), (−49,44), (−21,65), (30,66), (39,54) and (53,24) m. They are 10.8 to 17.2 m high, with crown radii of 4.49 to 7.55 m. Trunk feet flare into their roots and sink 0.04 m into the sampled ground. At Hero detail, hawthorn and blackthorn stand single over the meadows and in three short rows on field lines, 2.5 to 4.7 m high. Fallen leaves are drawn 0.065 to 0.26 m long at Hero detail, and larger and fewer at Standard and Calm, up to 0.49 m. They lie under the crowns, in drifts against walls, steps and banks, in the road’s wheel ruts and on the grave court’s floor. The grass is imagined as a late October meadow, sown densest where the walk’s stops look. Its blades are 0.02 to 0.54 m high, most under 0.4 m, some green and some dry as straw. Dry seed stalks of 0.22 to 0.52 m stand among them, and short grass and weeds grow along the house’s feet. Ivy on the garden face of the terrace wall, at Hero detail, is a type of the period. The moss at the damp wall feet and in the paving joints is imagined. No grass species and no historical meadow is claimed. Every plant and every leaf keeps a fixed place in the world.',
  de: 'Baum- und Straucharten, Standorte und Größen, der Efeu, das Moos und das Laub sind Vermutungen. Keine Quelle belegt, was 1517 in Cloux wuchs. Die Arten und ihr Zustand im späten Oktober folgen als Typen der Zeit einer Studie der Flora der Gegend. Die Bäume sind Walnuss, Feldulme, Eiche, Feldahorn, Vogelkirsche, Hainbuche, Erle, Silberweide als Kopfweide, Schwarzpappel und Birnbaum. Heutige Gartenfotografien dienen nur als Vorbild für ihre Verzweigung, nicht als Beleg für die Bepflanzung von 1517. Die vorgeschlagenen Baumhöhen betragen 7,2 bis 27 m, die Pappel am Grab misst 15 m, eine hohe Ulme unter den Bäumen an der Amasse 27 m. Sechs Bäume in mittlerer Entfernung stehen bei EN (−53,12), (−49,44), (−21,65), (30,66), (39,54) und (53,24) m. Sie sind 10,8 bis 17,2 m hoch, mit Kronenradien von 4,49 bis 7,55 m. Die Stammfüße laufen in ihre Wurzeln aus und sitzen 0,04 m tief im abgetasteten Boden. In der Detailstufe Detailreich stehen Weißdorn und Schlehe einzeln auf den Wiesen und in drei kurzen Reihen an Feldrainen, 2,5 bis 4,7 m hoch. Das Laub ist in der Detailstufe Detailreich 0,065 bis 0,26 m lang gezeichnet, in den Stufen Standard und Ruhig größer und spärlicher, bis 0,49 m. Es liegt unter den Kronen, in Verwehungen an Mauern, Stufen und Böschungen, in den Fahrspuren der Straße und auf dem Boden des Grabhofs. Das Gras ist als Wiese im späten Oktober frei gestaltet, am dichtesten dort gesät, wohin die Halte des Rundgangs blicken. Die Halme sind 0,02 bis 0,54 m hoch, die meisten unter 0,4 m, manche grün, manche trocken wie Stroh. Dazwischen stehen trockene Samenhalme von 0,22 bis 0,52 m, und am Fuß des Hauses wachsen niedriges Gras und Kraut. Efeu an der Gartenseite der Terrassenmauer ist in der Detailstufe Detailreich ein Typ der Zeit. Das Moos an den feuchten Mauerfüßen und in den Pflasterfugen ist frei gestaltet. Keine Grasart und keine historische Wiese wird behauptet. Jede Pflanze und jedes Blatt hat einen festen Ort in der Welt.',
  certainty: 'conjectural', target: 'carrier',
  source: 'Flora card FLORA.md §1 and §6 (species and their state about 20 October, types for Cloux, none documented there); brief/BUILDING-DOSSIER.md § Terrain and ground work, § Honesty labels and period variants; Q119, Q128, Q178; A-SITE. Dimensional ranges: the vegetation, leaf-litter and ground-dressing recipes as built at the Hero, Standard and Calm detail levels, not measurements from the photographs.',
  germanProvenance: 'museum translation',
});

export const vinciWeatherAssumptions: VinciStatement = museumStatement({
  id: 'weather-assumptions',
  en: 'Sky turbidity is an assumed scenario: T = 4 within the dossier’s T = 2–4 range. Clouds, haze, colour and exposure are exhibition choices; no weather record for this minute is claimed.',
  de: 'Die atmosphärische Trübung ist ein angenommenes Szenario: T = 4 im Bereich T = 2–4 des Dossiers. Wolken, Dunst, Farbe und Belichtung sind Entscheidungen für die Ausstellung. Sie sind kein Beleg für das Wetter dieser Minute.',
  certainty: 'conjectural', target: 'carrier',
  source: 'brief/SITE-HOUR.md § Sky and exposure; brief/building/SOURCES.md A-LIGHT.',
  germanProvenance: 'museum translation',
});

export const vinciCollectionThreshold: VinciStatement = museumStatement({
  id: 'collection-threshold',
  en: 'You are leaving 1517. What follows is a museum of what survives, built in our own century.',
  de: 'Du verlässt das Jahr 1517. Es folgt ein Museum dessen, was erhalten ist, erbaut in unserem Jahrhundert.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S10', germanProvenance: 'museum translation',
});

export const vinciNoBodies: VinciStatement = museumStatement({
  id: 'no-bodies',
  en: 'No one is shown working these machines. This museum shows no bodies.',
  de: 'Niemand wird bei der Arbeit an diesen Maschinen gezeigt. Dieses Museum zeigt keine Körper.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S15', germanProvenance: 'museum translation',
});

export const vinciHourValues = Object.freeze({
  julianDate: '1517-10-10', prolepticGregorianDate: '1517-10-20',
  localApparentTime: '15:19:00', universalTime: '15:00:08',
  deltaTSeconds: 180.5, sunAzimuthDegrees: 231.9005, sunElevationDegrees: 17.3882,
  renderSunElevationDegrees: 17.441, shadowAzimuthDegrees: 51.9005,
  shadowLengthPerHeight: 3.1933, noonElevationDegrees: 32.359,
  minuteEndAzimuthDegrees: 232.117, minuteEndElevationDegrees: 17.255,
});

// Rounded UT clock arithmetic is intentionally identical in both language views.
const hourArithmetic = '15:00:08 UT + 00:18:52 = 15:19:00 LAT · ΔT = 180.5 s · A = 231.9005° · h = 17.3882°';
export const vinciHourArithmetic: VinciText = { en: hourArithmetic, de: hourArithmetic };

export const vinciHourLabel: VinciStatement = museumStatement({
  id: 'computed-hour',
  en: 'Clos Luce, Amboise, 47.4103 N, 0.9921 E. 10 October 1517, Julian calendar. Sunrise approximately 06:21 UT at azimuth 104.2 degrees. Apparent noon approximately 11:41 UT, the sun 32.4 degrees high. Sunset approximately 17:01 UT at azimuth 255.6 degrees. The day is 10 hours 40 minutes long. This frame stands at 15:19 by a sundial, approximately 15:00 UT. The moon is a waning crescent, approximately 24.8 per cent lit, and sets at approximately 15:20 UT. Method: Meeus, Astronomical Algorithms, second edition, with delta-T of 180.5 seconds. Approximately ±2 minutes for solar events and ±5 minutes for the lunar event convention. Local refraction, weather and an obstructed horizon can move apparent first and last visibility further.',
  de: 'Clos Luce, Amboise, 47.4103 N, 0.9921 E. 10. Oktober 1517, julianischer Kalender. Sonnenaufgang ungefähr 06:21 UT bei einem Azimut von 104.2 Grad. Wahrer Mittag ungefähr 11:41 UT, die Sonne 32.4 Grad hoch. Sonnenuntergang ungefähr 17:01 UT bei einem Azimut von 255.6 Grad. Der Tag dauert 10 Stunden und 40 Minuten. Dieses Bild steht bei 15:19 nach der Sonnenuhr, ungefähr 15:00 UT. Der Mond ist eine abnehmende Sichel, ungefähr 24.8 Prozent beleuchtet, und geht ungefähr um 15:20 UT unter. Methode: Meeus, Astronomical Algorithms, zweite Ausgabe, mit Delta-T von 180.5 Sekunden. Ungefähr ±2 Minuten für Sonnenereignisse und ±5 Minuten für die Konvention des Mondereignisses. Örtliche Lichtbrechung, Wetter und ein verdeckter Horizont können das erste und letzte sichtbare Licht weiter verschieben.',
  certainty: 'reconstructed', target: 'measurement',
  source: 'brief/CONCEPT-OPUS.md §3.4, corrected by brief/SITE-HOUR.md and brief/building/light-rig.json',
  germanProvenance: 'museum translation',
});

export const vinciHourIntegrity: VinciStatement = museumStatement({
  id: 'chosen-minute',
  en: 'The day is documented. The hour inside it is ours. No source gives the hour of the visit, and no source gives the hour of his death.',
  de: 'Der Tag ist dokumentiert. Die Stunde darin ist von uns gewählt. Keine Quelle nennt die Uhrzeit des Besuchs, und keine Quelle nennt die Uhrzeit seines Todes.',
  certainty: 'reconstructed', target: 'measurement',
  source: 'brief/CONCEPT-OPUS.md §3.4', germanProvenance: 'museum translation',
});

const statement = (
  id: string, en: string, de: string, certainty: VinciCertainty,
  target: VinciStatement['target'], source: string,
  germanProvenance: VinciStatement['germanProvenance'] = 'museum translation',
): VinciStatement => museumStatement({ id, en, de, certainty, target, source, germanProvenance });

const arrival = statement('site-measurement',
  'Chateau du Clos Luce, Amboise. The house stands where the cadastre draws it, 47.4103 N, 0.9921 E, 68.6 m above sea level.',
  'Schloss Clos Lucé, Amboise. Das Haus steht dort, wo der Kataster es zeichnet, 47,4103 N, 0,9921 O, 68,6 m über dem Meeresspiegel.',
  'documented', 'measurement', 'brief/CONCEPT-OPUS.md §3 S1', 'supplied');
const courtyard = statement('carved-inscription-record',
  'Over the courtyard door, a bird with spread wings and the words DIEV AVANT TOVT.',
  'Über der Hoftür ein Vogel mit ausgebreiteten Flügeln und die Worte DIEV AVANT TOVT.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S2; Q015');
const hall = statement('hall-arrangement',
  'The hall a guest was received in. Its panelling and its chimneypiece were altered in the eighteenth century.',
  'Der Saal, in dem ein Gast empfangen wurde. Seine Vertäfelung und seine Kamineinfassung wurden im achtzehnten Jahrhundert verändert.',
  'reconstructed', 'carrier', 'brief/CONCEPT-OPUS.md §3 S3');
const oratory = statement('oratory-date',
  'Built in 1492 for Anne of Brittany.',
  '1492 für Anne de Bretagne erbaut.',
  'conjectural', 'document', 'brief/CONCEPT-OPUS.md §3 S4; certainty qualified by brief/BUILDING-DOSSIER.md § Roof and chapel, oratory paragraph');
const oratoryDateQualification = statement('oratory-date-qualification',
  'The precise year is a reported tradition, not a measured construction date.',
  'Die genaue Jahreszahl ist eine überlieferte Angabe, kein durch Vermessung belegtes Baudatum.',
  'conjectural', 'document', 'brief/BUILDING-DOSSIER.md § Roof and chapel, oratory paragraph beginning “The oratory is a small single-height stone projection”');
const oratoryAttribution = statement('oratory-attribution',
  "The wall paintings are attributed to Leonardo da Vinci's pupils, and the attribution is not settled.",
  'Die Wandmalereien werden Schülern Leonardo da Vincis zugeschrieben, doch die Zuschreibung ist nicht geklärt.',
  'conjectural', 'document', 'brief/CONCEPT-OPUS.md §3 S4');
const study = statement('visit-record',
  "On 10 October 1517 Cardinal Luigi d'Aragona visited this house. His secretary wrote down three paintings, a right hand that no longer worked, and an infinite number of volumes in the vulgar tongue.",
  "Am 10. Oktober 1517 besuchte Kardinal Luigi d'Aragona dieses Haus. Sein Sekretär verzeichnete drei Gemälde, eine rechte Hand, die nicht mehr funktionierte, und eine unendliche Zahl von Bänden in der Volkssprache.",
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S5');
const chamber = statement('death-record',
  'Leonardo da Vinci died in this house on 2 May 1519.',
  'Leonardo da Vinci starb am 2. Mai 1519 in diesem Haus.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S6');
const chamberPlacement = statement('chamber-placement',
  "The museum places his room at this end, facing the king's castle.",
  'Das Museum verortet sein Zimmer an diesem Ende, mit Blick auf das Schloss des Königs.',
  'conjectural', 'document', 'brief/CONCEPT-OPUS.md §3 S6');
const emptyPicture = statement('picture-absence',
  'All twenty-five positions of the hang carry a reproduction, seven admitted at the first tier, twelve at the second and six from the earlier allowlist. No position is withheld, and every work names its own source and terms.',
  'Alle fünfundzwanzig Plätze der Hängung tragen eine Reproduktion, sieben in der ersten Stufe zugelassen, zwölf in der zweiten und sechs aus der früheren Freigabeliste. Kein Platz bleibt ausgespart, und jedes Werk nennt seine eigene Quelle und ihre Bedingungen.',
  'documented', 'document', 'The room hang and the picture register', 'museum translation');
const supper = statement('supper-record',
  'The Last Supper, 460 by 880 cm, on the north wall of the refectory of Santa Maria delle Grazie in Milan. Dry wall-painting over gesso, pitch and mastic, not fresco.',
  'Das Abendmahl, 460 mal 880 cm, an der Nordwand des Refektoriums von Santa Maria delle Grazie in Mailand. Trockene Wandmalerei auf Gesso, Pech und Mastix, kein Fresko.',
  'documented', 'measurement', 'brief/CONCEPT-OPUS.md §3 S12');
const supperAbsence = statement('supper-absence',
  'The original wall stays in Milan; the reproduction shown here has its own source and licence.',
  'Die originale Wand bleibt in Mailand; die hier gezeigte Reproduktion hat ihre eigene Quelle und Lizenz.',
  'reconstructed', 'absence', 'The picture register and the displayed reproduction source record', 'museum translation');
const readingTable = statement('facsimile-record',
  'Manuscript B, folio 83 verso, in an 1883 photolithographic facsimile.',
  'Manuskript B, Blatt 83 verso, in einem photolithografischen Faksimile von 1883.',
  'documented', 'document', 'brief/CONCEPT-GPT6.md Station 10; brief/collection/msb-pages.json');
const readingRoom: VinciStatement = {
  ...statement('reading-room',
    'The reading room is a studiolo, the small panelled room in which a scholar of the Renaissance read and wrote, built new in oak for this museum. It fills a bay of the long gallery, between the gallery wall and the edge of the line of dates. Its door stands on the joint between the courses of 23 April 1519 and 2 May 1519. Its panelling follows types of the period: a linenfold dado, raised panels in two tiers, pilasters, a frieze of small panels and a coffered ceiling. It copies no room, and none of it was Leonardo\u2019s. The chair, the shelf and the lamp are modern.',
    'Das Lesezimmer ist ein Studiolo, der kleine getäfelte Raum, in dem ein Gelehrter der Renaissance las und schrieb, für dieses Museum neu in Eiche gebaut. Es füllt einen Abschnitt der langen Galerie, zwischen der Galeriewand und dem Rand der Datenlinie. Seine Tür steht auf der Fuge zwischen den Platten des 23. April 1519 und des 2. Mai 1519. Die Täfelung folgt Typen der Zeit: ein Sockel mit Faltwerk, erhabene Füllungen in zwei Reihen, Pilaster, ein Fries aus kleinen Füllungen und eine Kassettendecke. Es kopiert keinen Raum, und nichts davon gehörte Leonardo. Stuhl, Regal und Lampe sind modern.',
    'reconstructed', 'carrier', 'collection/reading-room-plan.ts, the studiolo and its place in the gallery bay; collection/layout.ts, VINCI_READING_TABLE on the joint of the line\u2019s field'),
  carrier: 'vinci/collection-reading-room',
};
const scattered = statement('surviving-notebooks',
  'These are the notebooks that survive, and where they are tonight.',
  'Dies sind die erhaltenen Notizbücher und die Orte, an denen sie heute Abend liegen.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S14');
const body = statement('anatomy-absence',
  'About six hundred of his sheets are at Windsor, and twenty-nine of them hang here. Of 538 catalogued sheet groups the rights review admitted a faithful public reproduction for 389 and found none it may show for 149.',
  'Etwa sechshundert seiner Blätter befinden sich in Windsor, neunundzwanzig davon hängen hier. Von 538 verzeichneten Blattgruppen ließ die Rechteprüfung für 389 eine getreue öffentliche Reproduktion zu und fand für 149 keine, die sie zeigen darf.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S17; the rights review of 2026-09-14');
/* THE PAINTING AT THE GRAVE. The words are the museum's own record of that
   story, so they are read from it rather than written again here. It carries
   no visitor wording of its own: the record IS the plain sentence. */
const deathbed = (JSON.parse(neverSaidSource) as { deathbed_label: Record<string, string> }).deathbed_label;
const deathbedPainting: VinciStatement = {
  id: 'deathbed-painting',
  en: deathbed['label_en']!, de: deathbed['label_de']!,
  certainty: 'conjectural', target: 'document',
  source: 'The tracing record of the deathbed painting and of what the accounts of the death say',
  record: {
    en: `${deathbed['record_en']} ${deathbed['last_words_en']}`,
    de: `${deathbed['record_de']} ${deathbed['last_words_de']}`,
  },
  germanProvenance: 'museum translation',
};
const grave = statement('burial-record',
  'He was buried on 12 August 1519 in the collegiate church of Saint-Florentin inside the chateau walls. That church was pulled down in 1807.',
  'Er wurde am 12. August 1519 in der Stiftskirche Saint-Florentin innerhalb der Schlossmauern bestattet. Diese Kirche wurde 1807 abgerissen.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S19; verification qualified in brief/collection/timeline.json');

type StationSeed = Omit<VinciStationContent, 'number' | 'door' | 'carrierClass' | 'carrierCertainty'>;
/** THE CARD. Two to four sentences per station, in the museum's voice: what
 * you are looking at, here, and nothing that belongs in the sources. Where a
 * room is not built one plain sentence says the house is shown from outside.
 * The German is the museum's own and runs about a third longer. */
const stationCards: Record<VinciStationId, VinciText> = {
  arrival: {
    en: 'You are in the street below the royal château, in front of the house where Leonardo da Vinci spent his last three years. The cadastre puts these walls where you see them. Everything you can walk on was rebuilt from photographs and a survey of the ground.',
    de: 'Du stehst in der Straße unterhalb des königlichen Schlosses, vor dem Haus, in dem Leonardo da Vinci seine letzten drei Jahre verbrachte. Der Kataster verzeichnet diese Mauern dort, wo du sie siehst. Alles, worauf du hier gehen kannst, wurde nach Fotografien und einer Vermessung des Geländes neu gebaut.',
  },
  courtyard: {
    en: 'The court between the house and its gate. Over the door a bird with spread wings carries the words DIEV AVANT TOVT, God before everything, and photographs of that carving are what we built it from. The afternoon sun stands in the west and crosses this court.',
    de: 'Der Hof zwischen dem Haus und seinem Tor. Über der Tür trägt ein Vogel mit ausgebreiteten Flügeln die Worte DIEV AVANT TOVT, Gott vor allem, und Fotografien dieses Reliefs sind unsere Vorlage. Die Nachmittagssonne steht im Westen und streicht über diesen Hof.',
  },
  hall: {
    en: 'The hall a guest was received in. Its panelling and its chimneypiece were changed in the eighteenth century, so what survives here is younger than Leonardo. The room is not open, so the house is shown from outside.',
    de: 'Der Saal, in dem ein Gast empfangen wurde. Vertäfelung und Kamin wurden im achtzehnten Jahrhundert verändert, das Erhaltene ist hier also jünger als Leonardo. Der Raum ist nicht geöffnet, deshalb wird das Haus von außen gezeigt.',
  },
  oratory: {
    en: 'A small stone chapel set into the south end of the house. Tradition gives it to Anne of Brittany and the year 1492, and no building survey has confirmed that date. Its wall paintings are attributed to Leonardo’s pupils, and that attribution is not settled. The room is not open, so the house is shown from outside.',
    de: 'Eine kleine steinerne Kapelle am Südende des Hauses. Die Überlieferung schreibt sie Anne de Bretagne und dem Jahr 1492 zu, eine Bauuntersuchung hat dieses Datum nie bestätigt. Die Wandmalereien werden Schülern Leonardos zugeschrieben, und diese Zuschreibung ist ungeklärt. Der Raum ist nicht geöffnet, deshalb wird das Haus von außen gezeigt.',
  },
  study: {
    en: 'On 10 October 1517 a cardinal from Aragon visited this house, and his secretary wrote down what he saw. Three paintings, a right hand that no longer worked, and an endless number of books in the vulgar tongue. The hour you are standing in is that afternoon. The room is not open, so the house is shown from outside.',
    de: 'Am 10. Oktober 1517 besuchte ein Kardinal aus Aragón dieses Haus, und sein Sekretär hielt fest, was er sah. Drei Gemälde, eine rechte Hand, die nicht mehr funktionierte, und unendlich viele Bücher in der Volkssprache. Die Stunde, in der du stehst, ist dieser Nachmittag. Der Raum ist nicht geöffnet, deshalb wird das Haus von außen gezeigt.',
  },
  chamber: {
    en: 'Leonardo da Vinci died in this house on 2 May 1519. The house museum places his room at this end, with the window facing the king’s castle, and that placement is a proposal rather than a record. The room is not open, so the house is shown from outside.',
    de: 'Leonardo da Vinci starb am 2. Mai 1519 in diesem Haus. Das Hausmuseum verortet sein Zimmer an diesem Ende, mit dem Fenster zum Schloss des Königs, und diese Zuordnung ist ein Vorschlag und kein Beleg. Der Raum ist nicht geöffnet, deshalb wird das Haus von außen gezeigt.',
  },
  garden: {
    en: 'The garden front takes the low western sun, and the valley falls away behind it. The slope follows the survey of the ground, the planting is ours, because no source records what grew here in his time. You are leaving 1517. What follows is a museum of what survives, built in our own century.',
    de: 'Die Gartenfront nimmt die tiefe Westsonne, dahinter fällt das Tal ab. Der Hang folgt der Vermessung des Geländes, die Bepflanzung stammt von uns, denn keine Quelle hält fest, was hier zu seiner Zeit wuchs. Du verlässt das Jahr 1517. Es folgt ein Museum dessen, was erhalten ist, erbaut in unserem Jahrhundert.',
  },
  'picture-room': {
    en: 'Twenty-five paintings hang here at the size their holders record, in the order he made them, so this wall gives you the real scale. Every position carries a picture, and each names the reproduction it comes from. The sources name every work, where it is today and what its licence says. The wall is thirty-four metres long from here, and the last painting hangs at the far end.',
    de: 'Fünfundzwanzig Gemälde hängen hier in den Maßen, die ihre Sammlungen verzeichnen, in der Reihenfolge ihrer Entstehung, diese Wand gibt dir also den wirklichen Maßstab. Jeder Platz trägt ein Bild, und jedes nennt die Reproduktion, aus der es stammt. Die Quellen nennen jedes Werk, seinen heutigen Ort und seine Lizenz. Die Wand ist von hier aus vierunddreißig Meter lang, und das letzte Gemälde hängt am anderen Ende.',
  },
  'picture-room-west': {
    en: 'This end is the latest. From here the wall runs back to the first of them, and the door beside you opens on the machines.',
    de: 'Dieses Ende ist das späteste. Von hier läuft die Wand zurück bis zum ersten Bild, und die Tür neben dir führt zu den Maschinen.',
  },
  'line-early': {
    en: 'The dates are cut into the floor, and you walk his life along them. Twelve of the fifty-six are cut here. Every date carries its document in the sources, and its colour says how sure we are. The whole life opens from this line.',
    de: 'Die Daten sind in den Boden geschnitten, und du gehst sein Leben an ihnen ab. Zwölf der sechsundfünfzig sind hier geschnitten. Zu jedem Datum steht der Beleg in den Quellen, und seine Farbe sagt, wie sicher wir sind. Von dieser Linie aus öffnet sich das ganze Leben.',
  },
  'reading-table': {
    en: 'A page of Manuscript B lies open on this table, in a facsimile printed in 1883. He wrote from right to left because he was left handed, and a mirror reads it back. The notebook itself is in Paris.',
    de: 'Auf diesem Tisch liegt eine Seite aus Manuskript B, in einem Faksimile von 1883. Er schrieb von rechts nach links, weil er Linkshänder war, und ein Spiegel liest es zurück. Das Notizbuch selbst liegt in Paris.',
  },
  body: {
    en: 'He opened bodies and drew what he found, and about six hundred of those sheets are at Windsor. Twenty-nine of them hang on this wall, each from a public reproduction the law lets us show. The sources name every sheet, its number in the royal collection and what its licence asks of us.',
    de: 'Er öffnete Körper und zeichnete, was er fand, und etwa sechshundert dieser Blätter liegen in Windsor. Neunundzwanzig davon hängen an dieser Wand, jedes aus einer öffentlichen Reproduktion, die das Recht uns zeigen lässt. Die Quellen nennen jedes Blatt, seine Nummer in der königlichen Sammlung und was seine Lizenz von uns verlangt.',
  },
  works: {
    en: 'This end of the hall holds what worked on land and in water. The lock gates and the lifting screw existed before him, and his sheets record them rather than invent them. Each machine names the page it was rebuilt from and what that page does not say.',
    de: 'Dieses Ende der Halle zeigt, was auf dem Land und im Wasser arbeitete. Schleusentore und Wasserschraube gab es vor ihm, seine Blätter halten sie fest, statt sie zu erfinden. Jede Maschine nennt das Blatt, nach dem sie rekonstruiert ist, und was dieses Blatt nicht sagt.',
  },
  flight: {
    en: 'The aerial screw stands at the middle of this hall, rebuilt from one page of Manuscript B. Fourteen of his machines are rebuilt in this museum, thirteen here and the parachute out in the court, because it stands taller than this roof. Twenty-eight others give too little to build and stay records in the sources. No flight of his own is documented.',
    de: 'In der Mitte dieser Halle steht die Luftschraube, rekonstruiert nach einer Seite aus Manuskript B. Vierzehn seiner Maschinen sind in diesem Museum gebaut, dreizehn hier und der Fallschirm draußen im Hof, weil er höher steht als dieses Dach. Achtundzwanzig weitere geben zu wenig her, sie bleiben Aufzeichnung in den Quellen. Kein eigener Flug von ihm ist belegt.',
  },
  'supper-wall': {
    en: 'The Last Supper measures 460 by 880 cm, and this field in the court is its size. The painting itself is a refectory wall in Milan and cannot travel, because he painted it dry on the plaster instead of into it. Inside the outline hangs a reproduction with its own source and licence.',
    de: 'Das Abendmahl misst 460 mal 880 Zentimeter, und dieses Feld im Hof hat seine Größe. Das Gemälde selbst ist eine Refektoriumswand in Mailand und kann nicht reisen, denn er malte trocken auf den Putz und nicht in ihn hinein. Im Umriss hängt eine Reproduktion mit eigener Quelle und Lizenz.',
  },
  grave: {
    en: 'He was buried on 12 August 1519 in a collegiate church inside the castle walls, and that church was pulled down in 1807. In 1863 a dig on the site found a nearly complete skeleton with stone fragments carrying parts of his name. The slab in the chapel reads LEONARDO DA VINCI, and the chapel’s own plaque speaks of presumed remains.',
    de: 'Am 12. August 1519 wurde er in einer Stiftskirche innerhalb der Schlossmauern bestattet, und diese Kirche wurde 1807 abgerissen. 1863 fand eine Grabung an dieser Stelle ein fast vollständiges Skelett mit Steinfragmenten, die Teile seines Namens trugen. Die Platte in der Kapelle trägt die Worte LEONARDO DA VINCI, und die Tafel der Kapelle spricht von vermuteten Überresten.',
  },
};

const statementRecord = (value: VinciText): VinciText =>
  'record' in value && value.record ? value.record as VinciText : { en: value.en, de: value.de };

const seed = (
  id: VinciStationId, name: VinciText, promise: VinciText,
  labels: readonly VinciStatement[], source: string,
): StationSeed => ({
  id, name, promise: stationCards[id], record: statementRecord(promise),
  labels, promiseSource: source,
  germanProvenance: 'museum translation',
  outdoor: id === 'arrival' || id === 'courtyard' || id === 'garden',
  built: !['hall', 'oratory', 'study', 'chamber'].includes(id),
  group: id.startsWith('line-') ? 'line' : ['arrival', 'courtyard', 'hall', 'oratory', 'study', 'chamber', 'garden'].includes(id) ? 'house' : 'collection',
});

/* THE WALK'S OWN ORDER, which is the order the building is walked in: in from
   the garden at the picture room's east end, down the wall to its west end,
   through that door into the machines, out of the hall into the gallery for
   the line, the body wall and the reading table, back out through the picture
   room's east end into the court, and west along it to the grave. Numeric
   links keep their meaning through `originalWalk` below. */
const seeds: readonly StationSeed[] = [
  seed('arrival', { en: 'The street', de: 'Die Straße' }, arrival,
    [arrival, vinciReconstruction, vinciHourLabel, vinciHourIntegrity], 'brief/CONCEPT-OPUS.md §3 S1'),
  seed('courtyard', { en: 'DIEV AVANT TOVT', de: 'DIEV AVANT TOVT' }, courtyard,
    [courtyard, vinciReconstruction], 'brief/CONCEPT-OPUS.md §3 S2'),
  seed('hall', { en: 'The great hall', de: 'Großer Saal / Speisesaal' }, hall,
    [vinciThreshold, hall], 'brief/CONCEPT-OPUS.md §3 S3; brief/building/closluce.json room hall'),
  seed('oratory', { en: "Anne of Brittany's oratory, 1492", de: 'Oratorium der Anne de Bretagne, 1492' },
    { en: `${statementRecord(oratory).en} ${statementRecord(oratoryAttribution).en}`, de: `${statementRecord(oratory).de} ${statementRecord(oratoryAttribution).de}` },
    [oratoryDateQualification, oratory, oratoryAttribution], 'brief/CONCEPT-OPUS.md §3 S4'),
  seed('study', { en: 'The study, and the visit', de: 'Das Studierzimmer und der Besuch' }, study,
    [study], 'brief/CONCEPT-OPUS.md §3 S5'),
  seed('chamber', { en: 'The north room and its window', de: 'Das Nordzimmer und sein Fenster' },
    { en: `${statementRecord(chamber).en} ${statementRecord(chamberPlacement).en}`, de: `${statementRecord(chamber).de} ${statementRecord(chamberPlacement).de}` },
    [chamber, chamberPlacement], 'brief/CONCEPT-OPUS.md §3 S6'),
  seed('garden', { en: 'The garden front, and the hour that is felt', de: 'Die Gartenfront und die spürbare Stunde' },
    { en: 'The garden front in raking light, and the light itself.', de: 'Die Gartenfront im Streiflicht und das Licht selbst.' },
    [vinciParkLabel, vinciCollectionThreshold, vinciHourLabel, vinciHourIntegrity], 'brief/CONCEPT-OPUS.md §3 S7'),
  seed('picture-room', { en: 'The picture room, at true scale', de: 'Der Bildersaal in wahrem Maßstab' },
    { en: 'Every painting of the hang stands on one wall at the size its holder records.', de: 'Jedes Gemälde der Hängung steht an einer Wand in dem Maß, das seine Sammlung verzeichnet.' },
    [emptyPicture], 'brief/CONCEPT-OPUS.md §3 S11'),
  seed('picture-room-west', { en: 'Where the wall ends', de: 'Wo die Wand endet' },
    { en: 'The latest painting on the wall, and the door to the machines.', de: 'Das späteste Gemälde der Wand und die Tür zu den Maschinen.' },
    [], 'brief/CONCEPT-OPUS.md §3 S11'),
  seed('flight', { en: 'The mechanism hall, one: flight', de: 'Die Maschinenhalle, eins: Flug' },
    { en: 'Fourteen of Leonardo da Vinci\'s machines can be rebuilt from what the sheets actually say. Twenty-eight cannot, and they are here as sheets.',
      de: 'Vierzehn von Leonardo da Vincis Maschinen lassen sich nach dem rekonstruieren, was die Blätter tatsächlich zeigen. Achtundzwanzig nicht, und sie sind hier als Blätter zu sehen.' },
    [vinciNoBodies], 'brief/CONCEPT-OPUS.md §3 S15'),
  seed('works', { en: 'The mechanism hall, two: land, water, measure', de: 'Die Maschinenhalle, zwei: Land, Wasser, Maß' },
    { en: 'The two that were real, and how they differ.', de: 'Die beiden, die es wirklich gab, und ihr Unterschied.' },
    [], 'brief/CONCEPT-OPUS.md §3 S16'),
  seed('line-early', { en: 'The whole life, cut into the floor', de: 'Das ganze Leben, in den Boden geschnitten' },
    { en: 'His grandfather recorded the birth on 15 April 1452.',
      de: 'Sein Großvater verzeichnete die Geburt am 15. April 1452.' },
    [scattered], 'brief/CONCEPT-GPT6.md Station 02; brief/CONCEPT-OPUS.md §3 S8'),
  seed('body', { en: 'The body as a machine', de: 'Der Körper als Maschine' }, body,
    [body], 'brief/CONCEPT-OPUS.md §3 S17'),
  seed('reading-table', { en: 'The reading table', de: 'Der Lesetisch' }, readingTable,
    [readingTable, readingRoom], 'brief/CONCEPT-GPT6.md Station 10; brief/CONCEPT-OPUS.md §3 S13'),
  seed('supper-wall', { en: 'The wall that is not here', de: 'Die Wand, die nicht hier ist' },
    { en: `${statementRecord(supper).en} ${statementRecord(supperAbsence).en}`, de: `${statementRecord(supper).de} ${statementRecord(supperAbsence).de}` },
    [supper, supperAbsence], 'brief/CONCEPT-OPUS.md §3 S12'),
  seed('grave', { en: 'Presumed', de: 'Vermutlich' }, grave,
    [grave, deathbedPainting], 'brief/CONCEPT-OPUS.md §3 S19'),
];

/* THE ENTRANCE PANEL. Every museum has a panel at the door of a wing, and a
   visitor who arrives from a link knows nothing: who this is, where they are,
   which hour they are standing in, what the rooms hold and how to move. It is
   shown once per visit and it says nothing a station would have to repeat.
   Every claim carries its certainty word, and the facts come from the life
   catalogue with their sources in the record. */
export interface VinciWelcomeLine {
  text: VinciText
  certainty?: VinciCertainty
  /** A line only one viewport shows, because the hand is not the same. */
  only?: 'phone' | 'desktop'
}
export interface VinciWelcomeBlock {
  /** the block's own id, so the leaflet can name its leaf */
  id: string
  /** the heading shortened to the one word that stands in the leaflet's row */
  tab: VinciText
  heading: VinciText
  lines: readonly VinciWelcomeLine[]
}

export const vinciWelcomeBlocks: readonly VinciWelcomeBlock[] = [
  {
    id: 'who',
    tab: { en: 'Who and where', de: 'Wer, und wo' },
    heading: { en: 'Who, and where', de: 'Wer, und wo' },
    lines: [
      {
        certainty: 'documented',
        text: {
          en: 'Leonardo da Vinci was born on 15 April 1452 near Vinci, in the hills west of Florence. He worked in Florence, Milan, Venice and Rome, and in his sixties he came to France for the young king Francis I.',
          de: 'Leonardo da Vinci wurde am 15. April 1452 bei Vinci geboren, in den Hügeln westlich von Florenz. Er arbeitete in Florenz, Mailand, Venedig und Rom, und mit über sechzig Jahren kam er für den jungen König Franz I. nach Frankreich.',
        },
      },
      {
        certainty: 'documented',
        text: {
          en: 'The first firm record that places him at this house is dated 22 May 1517. He died here on 2 May 1519 and was buried in Amboise on 12 August of that year.',
          de: 'Der erste sichere Beleg, der ihn in diesem Haus verortet, ist vom 22. Mai 1517. Er starb hier am 2. Mai 1519 und wurde am 12. August desselben Jahres in Amboise bestattet.',
        },
      },
      {
        certainty: 'reconstructed',
        text: {
          en: 'That the king gave him a pension and the use of this manor is reported rather than shown. The royal accounts are not in front of us.',
          de: 'Dass der König ihm eine Pension und dieses Haus überließ, ist überliefert und nicht belegt. Die königlichen Rechnungsbücher liegen uns nicht vor.',
        },
      },
    ],
  },
  {
    id: 'hour',
    tab: { en: 'The hour', de: 'Die Stunde' },
    heading: { en: 'The hour you are in', de: 'Die Stunde, in der du stehst' },
    lines: [
      {
        certainty: 'documented',
        text: {
          en: 'On 10 October 1517 a cardinal came to this house, and his secretary wrote down what he saw: three paintings, a right hand that no longer worked, and an endless number of books.',
          de: 'Am 10. Oktober 1517 kam ein Kardinal in dieses Haus, und sein Sekretär hielt fest, was er sah: drei Gemälde, eine rechte Hand, die nicht mehr funktionierte, und unendlich viele Bücher.',
        },
      },
      {
        certainty: 'reconstructed',
        text: {
          en: 'The house stands as it may have stood that afternoon, at 15:19 by the sun. The day is documented and the hour inside it is ours, so the light is computed from that date and this place.',
          de: 'Das Haus steht, wie es an jenem Nachmittag gestanden haben kann, um 15:19 nach der Sonne. Der Tag ist belegt, die Stunde darin haben wir gewählt, und das Licht ist aus jenem Datum und diesem Ort berechnet.',
        },
      },
      {
        certainty: 'reconstructed',
        text: {
          en: 'The walls follow the building that still stands and the photographs of it. The arrangement of the rooms is our own proposal, and every station says how sure it is.',
          de: 'Die Mauern folgen dem noch stehenden Bau und den Fotografien davon. Die Raumaufteilung ist unser eigener Vorschlag, und jede Station sagt, wie sicher sie ist.',
        },
      },
    ],
  },
  {
    id: 'find',
    tab: { en: 'What you find', de: 'Was du findest' },
    heading: { en: 'What you can find', de: 'Was du findest' },
    lines: [
      { text: { en: 'The house and its garden, seven stations in the hour above.', de: 'Das Haus und sein Garten, sieben Stationen in der Stunde von oben.' } },
      { text: { en: 'The picture room: every painting at the size its holder records.', de: 'Der Bildersaal: jedes Gemälde in dem Maß, das seine Sammlung verzeichnet.' } },
      { text: { en: 'The long gallery: his life cut into the floor, a page of Manuscript B on the reading table, and the wall of the body.', de: 'Die lange Galerie: sein Leben in den Boden geschnitten, eine Seite aus Manuskript B auf dem Lesetisch und die Wand des Körpers.' } },
      { text: { en: 'The mechanism hall: fourteen machines rebuilt from what the sheets give.', de: 'Die Maschinenhalle: vierzehn Maschinen, gebaut nach dem, was die Blätter hergeben.' } },
      { text: { en: 'The court: the Last Supper at its true size, and the parachute, too tall for any room.', de: 'Der Hof: das Abendmahl in wahrer Größe und der Fallschirm, zu hoch für jeden Raum.' } },
      { text: { en: 'The grave court: a slab with his name, and a plaque that speaks of presumed remains.', de: 'Der Grabhof: eine Platte mit seinem Namen und eine Tafel, die von vermuteten Überresten spricht.' } },
    ],
  },
  {
    id: 'move',
    tab: { en: 'How to move', de: 'Wie du dich bewegst' },
    heading: { en: 'How to move', de: 'Wie du dich bewegst' },
    lines: [
      { only: 'desktop', text: { en: 'Walk with the arrow keys, or press a mark on the bar below.', de: 'Geh mit den Pfeiltasten, oder drück eine Marke auf der Leiste unten.' } },
      { only: 'desktop', text: { en: 'Press a dot in the scene to read what it names. SOURCES opens the record of the station you are standing in.', de: 'Drück einen Punkt in der Szene, um zu lesen, was er benennt. QUELLEN öffnet den Nachweis der Station, in der du stehst.' } },
      { only: 'desktop', text: { en: 'The door at the foot of the frame asks him about what you are looking at.', de: 'Die Tür am unteren Rand fragt ihn nach dem, was du gerade ansiehst.' } },
      { only: 'phone', text: { en: 'Swipe up and down to walk, or tap a mark on the bar.', de: 'Wisch nach oben und unten, um zu gehen, oder tipp eine Marke auf der Leiste an.' } },
      { only: 'phone', text: { en: 'Tap a dot to read what it names, and SOURCES for the record.', de: 'Tipp einen Punkt an, um zu lesen, was er benennt, und QUELLEN für den Nachweis.' } },
      { only: 'phone', text: { en: 'The door at the foot asks him about what you are looking at.', de: 'Die Tür am unteren Rand fragt ihn nach dem, was du gerade ansiehst.' } },
    ],
  },
]

export const vinciWelcomeText = {
  label: { en: 'The da Vinci wing, at the door', de: 'Der da-Vinci-Flügel, an der Tür' },
  kicker: { en: 'CLOS LUCE, AMBOISE · 10 OCTOBER 1517', de: 'CLOS LUCE, AMBOISE · 10. OKTOBER 1517' },
  title: { en: 'Leonardo da Vinci', de: 'Leonardo da Vinci' },
  route: { en: 'Walk the house from the street, or go straight to the collection.', de: 'Geh vom Hoftor durch das Haus, oder geh direkt zur Sammlung.' },
  enter: { en: 'Enter', de: 'Eintreten' },
  collection: { en: 'Go to the collection', de: 'Zur Sammlung' },
  /* THE RACK AND ITS HANDLE, said for a screen reader and never displayed:
     the row of five is what a sighted visitor reads instead. */
  leaflet: { en: 'What this wing is, in five parts', de: 'Was dieser Flügel ist, in fünf Teilen' },
  handle: { en: 'Open the five parts', de: 'Die fünf Teile öffnen' },
  sources: { en: 'Sources', de: 'Quellen' },
} satisfies Record<string, VinciText>

/* THE WING'S SOURCES, GROUPED. The records are the asset store's own: every
   picture, leaf, model and material the museum shows carries its holder and
   its licence line there, so this file groups them and never restates them.
   A record falls into the first group whose role family names it, and what
   no family names falls into the group marked `rest`. */
export interface VinciSourceGroup {
  id: string
  name: VinciText
  /** the head of a record's declared role, before its first dash */
  roles: readonly string[]
  rest?: true
}

export const vinciSourceGroups: readonly VinciSourceGroup[] = [
  { id: 'documents', name: { en: 'Documents', de: 'Dokumente' }, roles: ['codex', 'ms', 'folio', 'leaf'] },
  { id: 'pictures', name: { en: 'Pictures and sheets', de: 'Bilder und Blätter' }, roles: ['painting', 'sheet', 'life', 'deep', 'exhibit'] },
  { id: 'place', name: { en: 'The place', de: 'Der Ort' }, roles: ['place', 'site'] },
  { id: 'models', name: { en: 'Models and materials', de: 'Modelle und Materialien' }, roles: [], rest: true },
]

/** The store scopes this wing's sources stand in: its own record, and the
 *  two shared stores every wing is built out of. */
export const vinciSourceScopes = { own: ['vinci', 'wing-vinci'], shared: ['library', 'models'] } as const

/* ABSENCE IS A SENTENCE. A work this museum cannot show holds no frame, no
   outline and no reserved rectangle: it is named here, in the sources, with
   the collection that holds it and the reason. The reasons are the rights
   review's own, and a rejected file never makes a work absent while another
   one qualifies. */
export interface VinciAbsence {
  work: VinciText
  holder: VinciText
  reason: VinciText
}

const lost: VinciText = { en: 'Lost', de: 'Verloren' }

export const vinciAbsences: Partial<Record<VinciStationId, readonly VinciAbsence[]>> = {
  'picture-room': [
    {
      work: { en: 'Tavola Doria', de: 'Tavola Doria' },
      holder: { en: 'Gallerie degli Uffizi, Florence', de: 'Gallerie degli Uffizi, Florenz' },
      reason: {
        en: 'The painting survives. The public reproduction we could verify is too small to show it clearly.',
        de: 'Das Gemälde ist erhalten. Die öffentliche Reproduktion, die wir prüfen konnten, ist zu klein, um es deutlich zu zeigen.',
      },
    },
    {
      work: { en: 'The Battle of Anghiari', de: 'Die Schlacht von Anghiari' },
      holder: lost,
      reason: {
        en: 'The wall painting is gone. It stands here through the copies and the studies made after it, each under the name of whoever made it.',
        de: 'Das Wandgemälde ist verloren. Es steht hier durch die Kopien und Studien nach ihm, jede unter dem Namen ihres eigenen Urhebers.',
      },
    },
    {
      work: { en: 'Leda', de: 'Leda' },
      holder: lost,
      reason: {
        en: 'His Leda is gone. What is here are surviving studies and copies by other hands.',
        de: 'Seine Leda ist verloren. Hier stehen erhaltene Studien und Kopien anderer Hände.',
      },
    },
  ],
  works: [
    {
      work: { en: 'The Sforza horse', de: 'Das Sforza-Pferd' },
      holder: { en: 'Never cast', de: 'Nie gegossen' },
      reason: {
        en: 'The bronze monument was never finished. His surviving designs carry its history.',
        de: 'Das bronzene Denkmal wurde nie vollendet. Seine erhaltenen Entwürfe tragen seine Geschichte.',
      },
    },
  ],
  'reading-table': [
    {
      work: { en: 'Codex Leicester', de: 'Codex Leicester' },
      holder: { en: 'Private collection', de: 'Privatsammlung' },
      reason: {
        en: 'The larger reproductions name no source, and the rest are too small.',
        de: 'Die größeren Reproduktionen nennen keine Quelle, und die übrigen sind zu klein.',
      },
    },
    {
      work: { en: 'Codex Urbinas', de: 'Codex Urbinas' },
      holder: { en: 'Biblioteca Apostolica Vaticana, Vatican City', de: 'Biblioteca Apostolica Vaticana, Vatikanstadt' },
      reason: {
        en: 'The one large leaf states no reproduction source, and the holder runs no open image release.',
        de: 'Das einzige große Blatt nennt keine Reproduktionsquelle, und die Sammlung gibt keine Bilder frei.',
      },
    },
    {
      work: { en: 'Nine Paris manuscripts, C, E, F, G, H, I, K, L and M', de: 'Neun Pariser Manuskripte, C, E, F, G, H, I, K, L und M' },
      holder: { en: 'Bibliothèque de l’Institut de France, Paris', de: 'Bibliothèque de l’Institut de France, Paris' },
      reason: {
        en: 'The old library editions carry no public domain mark, and no other reproduction reaches the size this display needs.',
        de: 'Die alten Bibliotheksausgaben tragen keinen Public-Domain-Vermerk, und keine andere Reproduktion erreicht die Größe, die diese Ausstellung braucht.',
      },
    },
    {
      work: { en: 'Ashburnham A', de: 'Ashburnham A' },
      holder: { en: 'Bibliothèque de l’Institut de France, Paris', de: 'Bibliothèque de l’Institut de France, Paris' },
      reason: {
        en: 'No marked facsimile and no large enough leaf could be verified for the fragment taken out of manuscript A.',
        de: 'Für das aus Manuskript A entnommene Fragment ließ sich kein gekennzeichnetes Faksimile und kein ausreichend großes Blatt bestätigen.',
      },
    },
    {
      work: { en: 'Forster I and Forster II', de: 'Forster I und Forster II' },
      holder: { en: 'Victoria and Albert Museum, London', de: 'Victoria and Albert Museum, London' },
      reason: {
        en: 'The sources we checked hold no permitted flat reproduction of these two notebooks at display size.',
        de: 'Die geprüften Quellen enthalten keine zulässige flache Reproduktion dieser beiden Notizbücher in Ausstellungsgröße.',
      },
    },
    {
      work: { en: 'The Codex Atlanticus, beyond the admitted pages', de: 'Der Codex Atlanticus, über die zugelassenen Seiten hinaus' },
      holder: { en: 'Veneranda Biblioteca Ambrosiana, Milan', de: 'Veneranda Biblioteca Ambrosiana, Mailand' },
      reason: {
        en: 'The bulk of its images are too small, so the codex is here through the pages we could verify.',
        de: 'Der Großteil seiner Bilder ist zu klein, deshalb steht der Codex hier durch die Seiten, die wir bestätigen konnten.',
      },
    },
    {
      work: { en: 'The middle part of the Arundel codex', de: 'Der Mittelteil des Arundel-Kodex' },
      holder: { en: 'British Library, London', de: 'British Library, London' },
      reason: {
        en: 'Its printed facsimile is unverified. Only the opening at folios 174 verso and 175 recto is available.',
        de: 'Sein gedrucktes Faksimile ist nicht bestätigt. Verfügbar ist nur die Öffnung bei Blatt 174 verso und 175 recto.',
      },
    },
    {
      work: { en: 'A loose sheet of studies after Hercules', de: 'Ein loses Blatt mit Studien nach Herkules' },
      holder: { en: 'The Metropolitan Museum of Art, New York', de: 'The Metropolitan Museum of Art, New York' },
      reason: {
        en: 'The museum record offers no open image, and no other reproduction at display size could be identified.',
        de: 'Der Museumseintrag enthält kein freies Bild, und keine andere Reproduktion in Ausstellungsgröße war zu ermitteln.',
      },
    },
  ],
  body: [
    {
      work: { en: '149 of the catalogued Windsor sheet groups', de: '149 der verzeichneten Windsor-Blattgruppen' },
      holder: { en: 'Royal Collection, Windsor', de: 'Royal Collection, Windsor' },
      reason: {
        en: 'For these no reproduction we may show reaches the size this display needs. Of 538 catalogued groups the review admitted 389.',
        de: 'Für sie erreicht keine Reproduktion, die wir zeigen dürfen, die nötige Größe. Von 538 verzeichneten Gruppen ließ die Prüfung 389 zu.',
      },
    },
  ],
}

/** The two grounds, said once, in the sources and not on a card. */
export const vinciGrounds: readonly VinciText[] = [
  {
    en: 'The first ground is the house and its garden at one hour of 1517. Its walls follow the building that still stands and the photographs of it, the arrangement of the rooms is ours, and the light is computed from that day and this place.',
    de: 'Der erste Grund ist das Haus mit seinem Garten in einer Stunde des Jahres 1517. Seine Mauern folgen dem noch stehenden Bau und den Fotografien davon, die Raumaufteilung stammt von uns, und das Licht ist aus jenem Tag und diesem Ort berechnet.',
  },
  {
    en: 'The second ground is a museum of what survives, built in our own century and never pretending to be his: the picture room, the long gallery, the mechanism hall and the two courts.',
    de: 'Der zweite Grund ist ein Museum dessen, was erhalten ist, erbaut in unserem Jahrhundert und nie als das seine ausgegeben: der Bildersaal, die lange Galerie, die Maschinenhalle und die zwei Höfe.',
  },
]

/** How a picture gets onto a wall here, in one paragraph. */
export const vinciRightsPolicy: VinciText = {
  en: 'Two routes put a picture on a wall here. The first is a reproduction the holder itself released. The second is a faithful photograph of a work old enough that nobody owns it, taken from a source that says so, where the holder still charges for its own images. European and German law allow the second, and this museum writes on every such picture what it is. Where neither route exists the wall holds nothing and the sentence stands in these sources instead, with the collection and the reason. No empty frame, and no outline standing in for a picture we do not have.',
  de: 'Zwei Wege bringen hier ein Bild an die Wand. Der erste ist eine Reproduktion, die die Sammlung selbst freigegeben hat. Der zweite ist eine getreue Fotografie eines Werks, das so alt ist, dass es niemandem gehört, aus einer Quelle, die das ausdrücklich sagt, auch wenn die Sammlung für ihre eigenen Bilder weiter Geld verlangt. Europäisches und deutsches Recht erlauben den zweiten Weg, und dieses Museum schreibt an jedes solche Bild, was es ist. Wo keiner der beiden Wege besteht, bleibt die Wand leer und der Satz steht hier in den Quellen, mit der Sammlung und dem Grund. Kein leerer Rahmen, und kein Umriss als Platzhalter für ein Bild, das wir nicht haben.',
}

/** What this wing holds, counted. The sentences above carry what it does not. */
export const vinciWingCounts: VinciText = {
  en: 'This wing stands on two grounds. The picture room holds 25 positions at the size their holders record and every one of them carries a picture, the wall of the body 29 sheets from Windsor, the mechanism hall 14 machines rebuilt from the sheets, and the reading table one open page. The rights review of this museum read 538 catalogued Windsor sheet groups and admitted 389 of them, and of 25 named codex units it admitted 11. What it could not admit is named in the room it belongs to, with its holder and its reason.',
  de: 'Dieser Flügel steht auf zwei Gründen. Der Bildersaal trägt 25 Plätze in den Maßen, die die Sammlungen verzeichnen, und jeder davon trägt ein Bild, die Wand des Körpers 29 Blätter aus Windsor, die Maschinenhalle 14 nach den Blättern gebaute Maschinen und der Lesetisch eine offene Seite. Die Rechteprüfung dieses Museums las 538 verzeichnete Windsor-Blattgruppen und ließ 389 von ihnen zu, und von 25 benannten Codex-Einheiten ließ sie 11 zu. Was sie nicht zulassen konnte, steht in dem Raum, zu dem es gehört, mit Sammlung und Grund.',
}

/** THE WING'S ONE SENTENCE, the same in the welcome, the recap at the exit
 * and the life view. It names the two things a visitor can repeat a week
 * later, a place and a documented day, and both are claims this wing already
 * makes at its own stations. */
export const vinciThroughLine: VinciText = {
  en: 'You are standing in the last house Leonardo da Vinci lived in, on an afternoon a visitor wrote down.',
  de: 'Du stehst im letzten Haus, in dem Leonardo da Vinci lebte, an einem Nachmittag, den ein Besucher aufgeschrieben hat.',
};

/** THE PLAN'S ROOMS. The plan draws the wing from geometry the collection
 * already declares, and each room is named here in the words the wing uses
 * for it elsewhere, so a text seat finds all six in one place. */
export const vinciPlanRooms = {
  house: { en: 'The house', de: 'Das Haus' },
  court: { en: 'The court', de: 'Der Hof' },
  grave: { en: 'The grave court', de: 'Der Grabhof' },
  'picture-room': { en: 'The picture room', de: 'Der Bildersaal' },
  'mechanism-hall': { en: 'The mechanism hall', de: 'Die Maschinenhalle' },
  'long-gallery': { en: 'The long gallery', de: 'Die lange Galerie' },
} satisfies Record<string, VinciText>;

/** THE LIFE VIEW'S OWN SECOND LINE, under the wing's through line. The two
 * years are filled from the record's first and last date of the life. */
export const vinciLifeSecondLine: VinciText = {
  en: 'The whole life, {from} to {to}, and what was left after.',
  de: 'Das ganze Leben, {from} bis {to}, und was danach blieb.',
};

/** THE FLOOR'S COUNT, filled from the floor and the record. It names the room,
 * because the life view opens from every station of the wing. */
export const vinciLifeFloorCount: VinciText = {
  en: '{cut} of the {total} dates are cut into the floor of the long gallery. All {total} are in the record.',
  de: '{cut} der {total} Daten sind in den Boden der langen Galerie geschnitten. Alle {total} stehen im Nachweis.',
};

/** THE MIDDLE ROW OF THE LIFE VIEW, named for what stands on it. This wing's
 * row carries the picture register alone: the machines, the sheets and the
 * codices publish no date the view may read, so the row is the picture room's
 * word until one of them does. */
export const vinciLifeWorksRow: VinciText = { en: 'Pictures', de: 'Bilder' };

/** That row's count, in the same grammar as the museum's other counted
 * sentences. The numbers are the record's own and the view fills them. */
export const vinciLifeWorksCount: VinciText = {
  en: '{total} pictures here. {dated} with a year in the record, {undated} without one.',
  de: '{total} Bilder hier. {dated} mit einer Jahreszahl im Verzeichnis, {undated} ohne Jahreszahl.',
};

/** THE THREE CERTAINTIES AS THEY ARE COUNTED. The word beside one date is
 * the timeline's own; a sentence that counts them needs the same word in a
 * counting clause, and the life view holds no word of any wing's. */
export const vinciLifeCertaintyCounted = {
  documented: { en: '{n} documented', de: '{n} belegt' },
  inferred: { en: '{n} inferred', de: '{n} erschlossen' },
  tradition: { en: '{n} from tradition', de: '{n} aus Überlieferung' },
} satisfies Record<string, VinciText>;

/** What that row says for a period the register puts no picture in. */
export const vinciLifeWorksEmpty: VinciText = {
  en: 'No picture in this record falls in these years.',
  de: 'Kein Bild in diesem Verzeichnis fällt in diese Jahre.',
};

/** THE MARK ON A DATE THE GALLERY FLOOR CARRIES. The visitor who reads it is
 * standing on that floor, so it says where the date is and offers no walk;
 * the dates the floor does not carry say nothing, because the count at the
 * foot of the view already says how many of the fifty-six are cut. */
export const vinciLifeCut: VinciText = {
  en: 'Cut into the floor of the long gallery.',
  de: 'In den Boden der langen Galerie geschnitten.',
};

/** THE SEVEN PERIODS, named by place and by the years the period runs
 * between, each with one cue sentence. The dates that fall in each are the
 * record's own, named here by their first and last id, and the seventh is not
 * a period of a life: the rows after the death belong to the reception of the
 * work and are drawn apart. */
export const vinciLifeBands: readonly {
  id: string; from: string; to: string; name: VinciText; place: VinciText;
  /** the years the period is declared between, which the ribbon draws it to */
  years?: { from: number; to: number };
  line: VinciText; afterlife?: true;
}[] = [
  {
    id: 'vinci-florence', from: 'life-01', to: 'life-11',
    name: { en: 'Vinci and Florence, 1452 to 1481', de: 'Vinci und Florenz, 1452 bis 1481' },
    place: { en: 'Vinci and Florence', de: 'Vinci und Florenz' },
    years: { from: 1452, to: 1481 },
    line: {
      en: 'He is said to be born near Vinci. He probably learns his trade in Florence, in Verrocchio’s workshop.',
      de: 'Er soll bei Vinci geboren sein. Wahrscheinlich lernt er sein Handwerk in Florenz, in Verrocchios Werkstatt.',
    },
  },
  {
    id: 'milan', from: 'life-12', to: 'life-25',
    name: { en: 'Milan, 1482 to 1499', de: 'Mailand, 1482 bis 1499' },
    place: { en: 'Milan', de: 'Mailand' },
    years: { from: 1482, to: 1499 },
    line: {
      en: 'About seventeen years at the Sforza court, with the horse, the Last Supper and the first machines.',
      de: 'Etwa siebzehn Jahre am Hof der Sforza, mit dem Pferd, dem Abendmahl und den ersten Maschinen.',
    },
  },
  {
    id: 'venice-romagna', from: 'life-26', to: 'life-31',
    name: { en: 'Venice, Florence and the Romagna, 1500 to 1506', de: 'Venedig, Florenz und die Romagna, 1500 bis 1506' },
    place: { en: 'Venice and the Romagna', de: 'Venedig und die Romagna' },
    years: { from: 1500, to: 1506 },
    line: {
      en: 'He moves from city to city, works for Cesare Borgia, and works on the portrait of Lisa del Giocondo.',
      de: 'Er zieht von Stadt zu Stadt, arbeitet für Cesare Borgia und am Bildnis der Lisa del Giocondo.',
    },
  },
  {
    id: 'milan-again', from: 'life-32', to: 'life-34',
    name: { en: 'Milan again, 1506 to 1513', de: 'Wieder Mailand, 1506 bis 1513' },
    place: { en: 'Milan again', de: 'Wieder Mailand' },
    years: { from: 1506, to: 1513 },
    line: {
      en: 'Back under French rule, probably with the anatomy sheets and the plans for a second horse.',
      de: 'Zurück unter französischer Herrschaft, wohl mit den anatomischen Blättern und den Plänen für ein zweites Pferd.',
    },
  },
  {
    id: 'rome', from: 'life-35', to: 'life-36',
    name: { en: 'Rome, 1513 to 1516', de: 'Rom, 1513 bis 1516' },
    place: { en: 'Rome', de: 'Rom' },
    years: { from: 1513, to: 1516 },
    line: {
      en: 'He leaves for Rome with his household, and the records grow thin.',
      de: 'Er bricht mit seinem Haushalt nach Rom auf, und die Belege werden dünn.',
    },
  },
  {
    id: 'amboise', from: 'life-37', to: 'life-42',
    name: { en: 'Amboise, 1516 to 1519', de: 'Amboise, 1516 bis 1519' },
    place: { en: 'Amboise', de: 'Amboise' },
    years: { from: 1516, to: 1519 },
    line: {
      en: 'The last house, the visit of 1517, the will, and the grave in the town.',
      de: 'Das letzte Haus, der Besuch von 1517, das Testament und das Grab in der Stadt.',
    },
  },
  {
    id: 'after', from: 'life-43', to: 'life-56', afterlife: true,
    name: { en: 'After 1519, what was left', de: 'Nach 1519, was blieb' },
    place: { en: 'After 1519', de: 'Nach 1519' },
    line: {
      en: 'Five hundred years of heirs, sales and thefts, from Melzi’s house to an exhibition at the Louvre.',
      de: 'Fünfhundert Jahre Erben, Verkäufe und Diebstähle, von Melzis Haus bis zu einer Ausstellung im Louvre.',
    },
  },
];

/** THE MARK ON THE WING'S OWN HOUR, on the one date the museum's afternoon
 * stands on. The wing already says this sentence inside its own station card;
 * the life view says it beside that date. */
export const vinciLifeHourMark: VinciText = {
  en: 'The hour you are standing in. The day is written down, the hour is the museum’s choice.',
  de: 'Die Stunde, in der du stehst. Der Tag ist aufgeschrieben, die Stunde hat das Museum gewählt.',
};

/** THE PEOPLE OF THIS LIFE, authored from the dates the record already holds
 * and never from a network: each tie names the events it rests on, and how
 * sure it is follows from them. One life does not need a graph. */
export const vinciLifePeople: readonly {
  id: string; name: VinciText; role: VinciText; events: readonly string[];
}[] = [
  {
    id: 'verrocchio', name: { en: 'Andrea del Verrocchio', de: 'Andrea del Verrocchio' },
    role: {
      en: 'The Florentine workshop he probably trained in, between about 1466 and 1472.',
      de: 'Die Florentiner Werkstatt, in der er wahrscheinlich zwischen etwa 1466 und 1472 lernte.',
    },
    events: ['life-04'],
  },
  {
    id: 'ludovico', name: { en: 'Ludovico Sforza', de: 'Ludovico Sforza' },
    role: {
      en: 'The duke in Milan he offered his services to, and who granted him a vineyard.',
      de: 'Der Herzog in Mailand, dem er seine Dienste anbot und der ihm einen Weinberg schenkte.',
    },
    events: ['life-13', 'life-19', 'life-23'],
  },
  {
    id: 'salai', name: { en: 'Salaì', de: 'Salaì' },
    role: {
      en: 'Giacomo, who entered his household in 1490 and left for Rome with him.',
      de: 'Giacomo, der 1490 in seinen Haushalt kam und mit ihm nach Rom aufbrach.',
    },
    events: ['life-17', 'life-35'],
  },
  {
    id: 'melzi', name: { en: 'Melzi', de: 'Melzi' },
    role: {
      en: 'He left for Rome with him and reported his death. The manuscripts stayed in his house.',
      de: 'Er brach mit ihm nach Rom auf und meldete seinen Tod. Die Manuskripte blieben in seinem Haus.',
    },
    events: ['life-35', 'life-41', 'life-43'],
  },
  {
    id: 'borgia', name: { en: 'Cesare Borgia', de: 'Cesare Borgia' },
    role: {
      en: 'He named him architect and general engineer in 1502.',
      de: 'Er ernannte ihn 1502 zum Architekten und Generalingenieur.',
    },
    events: ['life-27'],
  },
  {
    id: 'charles', name: { en: 'Charles d’Amboise', de: 'Charles d’Amboise' },
    role: {
      en: 'He asked Florence to let him stay in Milan for two months.',
      de: 'Er bat Florenz, ihn zwei Monate in Mailand bleiben zu lassen.',
    },
    events: ['life-32'],
  },
  {
    id: 'francis', name: { en: 'Francis I', de: 'Franz I.' },
    role: {
      en: 'The king whose service he entered when he came to Cloux.',
      de: 'Der König, in dessen Dienst er trat, als er nach Cloux kam.',
    },
    events: ['life-37'],
  },
];

/** The sources window's own headings, in the museum's voice. */
export const vinciSourcesHeadings = {
  elsewhere: { en: 'Elsewhere or lost', de: 'Anderswo oder verloren' },
  inThisRoom: { en: 'What stands in this room', de: 'Was in diesem Raum steht' },
  grounds: { en: 'The two grounds', de: 'Die zwei Gründe' },
  policy: { en: 'How a picture gets onto a wall', de: 'Wie ein Bild an die Wand kommt' },
  counted: { en: 'Counted', de: 'Gezählt' },
  classUnderReview: { en: 'class under review', de: 'Einstufung in Prüfung' },
  classShown: { en: 'shown from a public reproduction', de: 'aus einer öffentlichen Reproduktion gezeigt' },
  classReference: { en: 'reference only, never displayed', de: 'nur als Vorlage, nie ausgestellt' },
} satisfies Record<string, VinciText>

/** The original zero-based walk, retired stations included. It is a constant
 * of this module: the door catalogue may be handed over in any order and a
 * numeric link still means what it meant. */
const originalWalk = [
  'arrival', 'courtyard', 'hall', 'oratory', 'study', 'chamber', 'garden',
  'line-early', 'line-late', 'line-amboise', 'picture-room', 'supper-wall',
  'reading-table', 'scattered', 'flight', 'works', 'body', 'myths', 'grave',
  // A station opened after the walk was numbered takes the next number, so
  // every number before it means what it always meant.
  'picture-room-west',
] as const;

/** A station that has left the walk keeps its numeric position, and the link
 * lands where its subject now stands. */
const retiredStations: Readonly<Record<string, VinciStationId>> = {
  myths: 'grave',
  // The gallery reads its whole line from one station, so the three excerpts
  // and the station that stood beside them land on it.
  'line-late': 'line-early', 'line-amboise': 'line-early', scattered: 'line-early',
};

/** Numeric links from the original walk always keep their original meaning. */
export const vinciLegacyStationIds: readonly VinciStationId[] = Object.freeze(
  originalWalk.map(id => retiredStations[id] ?? id as VinciStationId),
);

const doorsByStation = new Map(doorData.doors.map(door => [door.station, door]));
if (doorsByStation.size !== doorData.doors.length) throw new Error('Duplicate station door');
if (doorsByStation.size < seeds.length) throw new Error('Station doors do not match the walk');
export const vinciContent: readonly VinciStationContent[] = seeds.map((station, index) => {
  const door = doorsByStation.get(station.id);
  if (!door || door.station !== station.id) throw new Error(`Door does not match station ${station.id}`);
  return {
    ...station, number: index + 1, carrierClass: 'GENERATED', carrierCertainty: 'reconstructed',
    door: { station: station.id, en: door.question_en, de: door.question_de },
  };
});

export const vinciStationIds: readonly VinciStationId[] = vinciContent.map(station => station.id);
export const vinciOutdoorStationIds: readonly VinciStationId[] = ['arrival', 'courtyard', 'garden'];

/** Sources follow the physical rooms, independently of the walking order. */
const sourceRooms: readonly (readonly VinciStationId[])[] = [
  ['line-early', 'reading-table', 'body'],
  ['flight', 'works'],
  ['supper-wall', 'grave'],
];
export function vinciRoomStationIds(id: VinciStationId): readonly VinciStationId[] {
  return sourceRooms.find(room => room.includes(id)) ?? [id];
}
