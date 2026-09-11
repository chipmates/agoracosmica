import doorsSource from './data/doors.json?raw';

export type VinciLanguage = 'en' | 'de';
export type VinciCertainty = 'documented' | 'reconstructed' | 'conjectural' | 'unknown';
export type VinciStationId =
  | 'arrival' | 'courtyard' | 'hall' | 'oratory' | 'study' | 'chamber' | 'garden'
  | 'line-early' | 'line-late' | 'line-amboise' | 'picture-room' | 'supper-wall'
  | 'reading-table' | 'scattered' | 'flight' | 'works' | 'body' | 'myths' | 'grave';

export interface VinciText {
  en: string;
  de: string;
}

export interface VinciStatement extends VinciText {
  id: string;
  certainty: VinciCertainty;
  target: 'document' | 'measurement' | 'carrier' | 'absence';
  source: string;
  germanProvenance: 'supplied' | 'museum translation';
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
  promiseSource: string;
  germanProvenance: 'supplied' | 'museum translation';
  outdoor: boolean;
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

export const vinciReconstruction: VinciStatement = {
  id: 'reconstruction',
  en: 'everything you can walk on is reconstructed from photographs and the cadastre.',
  de: 'Alles, worauf Sie gehen können, ist anhand von Fotografien und dem Kataster rekonstruiert.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S1', germanProvenance: 'museum translation',
};

export const vinciThreshold: VinciStatement = {
  id: 'interior-arrangement',
  en: 'House reconstructed from its surviving shell and photographs. Interior arrangement proposed for this exhibition.',
  de: 'Das Haus wurde anhand seiner erhaltenen Bausubstanz und von Fotografien rekonstruiert. Die Raumaufteilung ist ein Vorschlag für diese Ausstellung.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT.md §1', germanProvenance: 'museum translation',
};

export const vinciHouseLabel: VinciStatement = {
  id: 'house-fabric',
  en: 'Late medieval house. The surviving building has been restored. This interior arrangement is a reconstruction.',
  de: 'Spätmittelalterliches Haus. Der erhaltene Bau wurde restauriert. Diese Raumaufteilung ist eine Rekonstruktion.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md §Period labels', germanProvenance: 'supplied',
};

export const vinciParkLabel: VinciStatement = {
  id: 'park-arrangement',
  en: 'The landscape is real; this arrangement is proposed. The museum’s machine park and formal displays are modern.',
  de: 'Die Landschaft ist real; diese Anordnung ist ein Vorschlag. Maschinenpark und formale Schaugärten des Museums sind modern.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md §Period labels', germanProvenance: 'supplied',
};

export const vinciPlantingAssumptions: VinciStatement = {
  id: 'planting-assumptions',
  en: 'Tree species, positions and dimensions, grass and fallen leaves are conjectural. Modern garden photographs inform their character, not planting in 1517. Proposed tree heights: 9.3–22 m; fallen-leaf lengths: 0.126–0.27 m; grass heights: 0.03–0.34 m. These are procedural ranges for the exhibition, not surveyed or historical measurements.',
  de: 'Baumarten, Standorte und Maße sowie Gras und Laub sind Vermutungen. Heutige Gartenfotografien dienen als Vorbild für ihren Charakter, nicht als Beleg für die Bepflanzung von 1517. Vorgeschlagene Baumhöhen: 9,3–22 m; Längen der gefallenen Blätter: 0,126–0,27 m; Grashöhen: 0,03–0,34 m. Dies sind prozedurale Größenbereiche für die Ausstellung, keine vermessenen oder historischen Maße.',
  certainty: 'conjectural', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md § Terrain and ground work, § Honesty labels and period variants; Q119, Q128, Q178; A-SITE. Dimensional ranges: the declared procedural vegetation and ground-dressing recipes, not measurements from the photographs.',
  germanProvenance: 'museum translation',
};

export const vinciWeatherAssumptions: VinciStatement = {
  id: 'weather-assumptions',
  en: 'Sky turbidity is an assumed scenario: T = 4 within the dossier’s T = 2–4 range. Clouds, haze, colour and exposure are exhibition choices; no weather record for this minute is claimed.',
  de: 'Die atmosphärische Trübung ist ein angenommenes Szenario: T = 4 im Bereich T = 2–4 des Dossiers. Wolken, Dunst, Farbe und Belichtung sind Entscheidungen für die Ausstellung. Sie sind kein Beleg für das Wetter dieser Minute.',
  certainty: 'conjectural', target: 'carrier',
  source: 'brief/SITE-HOUR.md § Sky and exposure; brief/building/SOURCES.md A-LIGHT.',
  germanProvenance: 'museum translation',
};

export const vinciCollectionThreshold: VinciStatement = {
  id: 'collection-threshold',
  en: 'You are leaving 1517. What follows is a museum of what survives, built in our own century.',
  de: 'Sie verlassen das Jahr 1517. Es folgt ein Museum dessen, was erhalten ist, erbaut in unserem Jahrhundert.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S10', germanProvenance: 'museum translation',
};

export const vinciNoBodies: VinciStatement = {
  id: 'no-bodies',
  en: 'No one is shown working these machines. This museum shows no bodies.',
  de: 'Niemand wird bei der Arbeit an diesen Maschinen gezeigt. Dieses Museum zeigt keine Körper.',
  certainty: 'reconstructed', target: 'carrier',
  source: 'brief/CONCEPT-OPUS.md §3 S15', germanProvenance: 'museum translation',
};

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

export const vinciHourLabel: VinciStatement = {
  id: 'computed-hour',
  en: 'Clos Luce, Amboise, 47.4103 N, 0.9921 E. 10 October 1517, Julian calendar. Sunrise approximately 06:21 UT at azimuth 104.2 degrees. Apparent noon approximately 11:41 UT, the sun 32.4 degrees high. Sunset approximately 17:01 UT at azimuth 255.6 degrees. The day is 10 hours 40 minutes long. This frame stands at 15:19 by a sundial, approximately 15:00 UT. The moon is a waning crescent, approximately 24.8 per cent lit, and sets at approximately 15:20 UT. Method: Meeus, Astronomical Algorithms, second edition, with delta-T of 180.5 seconds. Approximately ±2 minutes for solar events and ±5 minutes for the lunar event convention. Local refraction, weather and an obstructed horizon can move apparent first and last visibility further.',
  de: 'Clos Luce, Amboise, 47.4103 N, 0.9921 E. 10. Oktober 1517, julianischer Kalender. Sonnenaufgang ungefähr 06:21 UT bei einem Azimut von 104.2 Grad. Wahrer Mittag ungefähr 11:41 UT, die Sonne 32.4 Grad hoch. Sonnenuntergang ungefähr 17:01 UT bei einem Azimut von 255.6 Grad. Der Tag dauert 10 Stunden und 40 Minuten. Dieses Bild steht bei 15:19 nach der Sonnenuhr, ungefähr 15:00 UT. Der Mond ist eine abnehmende Sichel, ungefähr 24.8 Prozent beleuchtet, und geht ungefähr um 15:20 UT unter. Methode: Meeus, Astronomical Algorithms, zweite Ausgabe, mit Delta-T von 180.5 Sekunden. Ungefähr ±2 Minuten für Sonnenereignisse und ±5 Minuten für die Konvention des Mondereignisses. Örtliche Lichtbrechung, Wetter und ein verdeckter Horizont können das erste und letzte sichtbare Licht weiter verschieben.',
  certainty: 'reconstructed', target: 'measurement',
  source: 'brief/CONCEPT-OPUS.md §3.4, corrected by brief/SITE-HOUR.md and brief/building/light-rig.json',
  germanProvenance: 'museum translation',
};

export const vinciHourIntegrity: VinciStatement = {
  id: 'chosen-minute',
  en: 'The day is documented. The hour inside it is ours. No source gives the hour of the visit, and no source gives the hour of his death.',
  de: 'Der Tag ist dokumentiert. Die Stunde darin ist von uns gewählt. Keine Quelle nennt die Uhrzeit des Besuchs, und keine Quelle nennt die Uhrzeit seines Todes.',
  certainty: 'reconstructed', target: 'measurement',
  source: 'brief/CONCEPT-OPUS.md §3.4', germanProvenance: 'museum translation',
};

const statement = (
  id: string, en: string, de: string, certainty: VinciCertainty,
  target: VinciStatement['target'], source: string,
  germanProvenance: VinciStatement['germanProvenance'] = 'museum translation',
): VinciStatement => ({ id, en, de, certainty, target, source, germanProvenance });

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
  'This museum may not show this picture. A scan exists, and its terms are not ours.',
  'Dieses Museum darf dieses Bild nicht zeigen. Es gibt einen Scan, und seine Bedingungen sind nicht unsere.',
  'unknown', 'absence', 'brief/CONCEPT-OPUS.md §3 S11', 'supplied');
const supper = statement('supper-record',
  'The Last Supper, 460 by 880 cm, on the north wall of the refectory of Santa Maria delle Grazie in Milan. Dry wall-painting over gesso, pitch and mastic, not fresco.',
  'Das Abendmahl, 460 mal 880 cm, an der Nordwand des Refektoriums von Santa Maria delle Grazie in Mailand. Trockene Wandmalerei auf Gesso, Pech und Mastix, kein Fresko.',
  'documented', 'measurement', 'brief/CONCEPT-OPUS.md §3 S12');
const supperAbsence = statement('supper-absence',
  'This museum may not show it to you.', 'Dieses Museum darf es Ihnen nicht zeigen.',
  'unknown', 'absence', 'brief/CONCEPT-OPUS.md §3 S12');
const readingTable = statement('facsimile-record',
  'Manuscript B, folio 83 verso, in an 1883 photolithographic facsimile.',
  'Manuskript B, Blatt 83 verso, in einem photolithografischen Faksimile von 1883.',
  'documented', 'document', 'brief/CONCEPT-GPT6.md Station 10; brief/collection/msb-pages.json');
const scattered = statement('surviving-notebooks',
  'These are the notebooks that survive, and where they are tonight.',
  'Dies sind die erhaltenen Notizbücher und die Orte, an denen sie heute Abend liegen.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S14');
const body = statement('anatomy-absence',
  'About six hundred of his sheets are at Windsor. This museum may show none of them.',
  'Etwa sechshundert seiner Blätter befinden sich in Windsor. Dieses Museum darf keines davon zeigen.',
  'unknown', 'absence', 'brief/CONCEPT-OPUS.md §3 S17');
const grave = statement('burial-record',
  'He was buried on 12 August 1519 in the collegiate church of Saint-Florentin inside the chateau walls. That church was pulled down in 1807.',
  'Er wurde am 12. August 1519 in der Stiftskirche Saint-Florentin innerhalb der Schlossmauern bestattet. Diese Kirche wurde 1807 abgerissen.',
  'documented', 'document', 'brief/CONCEPT-OPUS.md §3 S19; verification qualified in brief/collection/timeline.json');

type StationSeed = Omit<VinciStationContent, 'number' | 'door' | 'carrierClass' | 'carrierCertainty'>;
const seed = (
  id: VinciStationId, name: VinciText, promise: VinciText,
  labels: readonly VinciStatement[], source: string,
  germanProvenance: VinciStationContent['germanProvenance'] = 'museum translation',
): StationSeed => ({
  id, name, promise, labels, promiseSource: source, germanProvenance,
  outdoor: id === 'arrival' || id === 'courtyard' || id === 'garden',
  group: id.startsWith('line-') ? 'line' : ['arrival', 'courtyard', 'hall', 'oratory', 'study', 'chamber', 'garden'].includes(id) ? 'house' : 'collection',
});

const seeds: readonly StationSeed[] = [
  seed('arrival', { en: 'The street', de: 'Die Straße' }, arrival,
    [arrival, vinciReconstruction, vinciHourLabel, vinciHourIntegrity], 'brief/CONCEPT-OPUS.md §3 S1', 'supplied'),
  seed('courtyard', { en: 'DIEV AVANT TOVT', de: 'DIEV AVANT TOVT' }, courtyard,
    [courtyard, vinciReconstruction], 'brief/CONCEPT-OPUS.md §3 S2'),
  seed('hall', { en: 'The great hall', de: 'Großer Saal / Speisesaal' }, hall,
    [vinciThreshold, hall], 'brief/CONCEPT-OPUS.md §3 S3; brief/building/closluce.json room hall'),
  seed('oratory', { en: "Anne of Brittany's oratory, 1492", de: 'Oratorium der Anne de Bretagne, 1492' },
    { en: `${oratory.en} ${oratoryAttribution.en}`, de: `${oratory.de} ${oratoryAttribution.de}` },
    [oratoryDateQualification, oratory, oratoryAttribution], 'brief/CONCEPT-OPUS.md §3 S4'),
  seed('study', { en: 'The study, and the visit', de: 'Das Studierzimmer und der Besuch' }, study,
    [study], 'brief/CONCEPT-OPUS.md §3 S5'),
  seed('chamber', { en: 'The north room and its window', de: 'Das Nordzimmer und sein Fenster' },
    { en: `${chamber.en} ${chamberPlacement.en}`, de: `${chamber.de} ${chamberPlacement.de}` },
    [chamber, chamberPlacement], 'brief/CONCEPT-OPUS.md §3 S6'),
  seed('garden', { en: 'The garden front, and the hour that is felt', de: 'Die Gartenfront und die spürbare Stunde' },
    { en: 'The garden front in raking light, and the light itself.', de: 'Die Gartenfront im Streiflicht und das Licht selbst.' },
    [vinciParkLabel, vinciHourLabel, vinciHourIntegrity], 'brief/CONCEPT-OPUS.md §3 S7'),
  seed('line-early', { en: 'Vinci, Florence, Milan', de: 'Vinci, Florenz, Mailand' },
    { en: 'His grandfather recorded the birth on 15 April 1452.', de: 'Sein Großvater verzeichnete die Geburt am 15. April 1452.' },
    [], 'brief/CONCEPT-GPT6.md Station 02; brief/CONCEPT-OPUS.md §3 S8'),
  seed('line-late', { en: 'The wandering years, and Rome', de: 'Die Wanderjahre und Rom' },
    { en: 'In October 1503, Vespucci named Lisa del Giocondo in a margin.', de: 'Im Oktober 1503 nannte Vespucci Lisa del Giocondo in einer Randnotiz.' },
    [], 'brief/CONCEPT-GPT6.md Station 04; brief/CONCEPT-OPUS.md §3 S9'),
  seed('line-amboise', { en: 'Amboise, and the threshold', de: 'Amboise und die Schwelle' },
    { en: 'A visitor recorded three pictures and notebooks here in 1517.', de: 'Ein Besucher verzeichnete hier 1517 drei Gemälde und Notizbücher.' },
    [vinciCollectionThreshold], 'brief/CONCEPT-GPT6.md Station 06; brief/CONCEPT-OPUS.md §3 S10'),
  seed('picture-room', { en: 'The picture room, at true scale', de: 'Der Bildersaal in wahrem Maßstab' }, emptyPicture,
    [emptyPicture], 'brief/CONCEPT-OPUS.md §3 S11', 'supplied'),
  seed('supper-wall', { en: 'The wall that is not here', de: 'Die Wand, die nicht hier ist' },
    { en: `${supper.en} ${supperAbsence.en}`, de: `${supper.de} ${supperAbsence.de}` },
    [supper, supperAbsence], 'brief/CONCEPT-OPUS.md §3 S12'),
  seed('reading-table', { en: 'The reading table', de: 'Der Lesetisch' }, readingTable,
    [readingTable], 'brief/CONCEPT-GPT6.md Station 10; brief/CONCEPT-OPUS.md §3 S13'),
  seed('scattered', { en: 'Where the papers are now', de: 'Wo die Blätter heute sind' }, scattered,
    [scattered], 'brief/CONCEPT-OPUS.md §3 S14'),
  seed('flight', { en: 'The mechanism hall, one: flight', de: 'Die Maschinenhalle, eins: Flug' },
    { en: 'Fourteen of Leonardo da Vinci\'s machines can be rebuilt from what the sheets actually say. Twenty-eight cannot, and they are here as sheets.',
      de: 'Vierzehn von Leonardo da Vincis Maschinen lassen sich nach dem rekonstruieren, was die Blätter tatsächlich zeigen. Achtundzwanzig nicht, und sie sind hier als Blätter zu sehen.' },
    [vinciNoBodies], 'brief/CONCEPT-OPUS.md §3 S15'),
  seed('works', { en: 'The mechanism hall, two: land, water, measure', de: 'Die Maschinenhalle, zwei: Land, Wasser, Maß' },
    { en: 'The two that were real, and how they differ.', de: 'Die beiden, die es wirklich gab, und ihr Unterschied.' },
    [], 'brief/CONCEPT-OPUS.md §3 S16'),
  seed('body', { en: 'The body as a machine', de: 'Der Körper als Maschine' }, body,
    [body], 'brief/CONCEPT-OPUS.md §3 S17'),
  seed('myths', { en: 'The room of corrections', de: 'Der Raum der Richtigstellungen' },
    { en: 'The five corrections, each with its document beside it.', de: 'Die fünf Richtigstellungen, jede mit ihrem Beleg daneben.' },
    [], 'brief/CONCEPT-OPUS.md §3 S18'),
  seed('grave', { en: 'Presumed', de: 'Vermutlich' }, grave,
    [grave], 'brief/CONCEPT-OPUS.md §3 S19'),
];

export const vinciContent: readonly VinciStationContent[] = seeds.map((station, index) => {
  const door = doorData.doors[index];
  if (!door || door.station !== station.id) throw new Error(`Door order does not match station ${station.id}`);
  return {
    ...station, number: index + 1, carrierClass: 'GENERATED', carrierCertainty: 'reconstructed',
    door: { station: station.id, en: door.question_en, de: door.question_de },
  };
});

export const vinciStationIds: readonly VinciStationId[] = vinciContent.map(station => station.id);
export const vinciOutdoorStationIds: readonly VinciStationId[] = ['arrival', 'courtyard', 'garden'];
