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
  humanSource?: VinciText;
  record?: VinciText;
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
  record?: VinciText;
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
    en: 'The trees, grass and fallen leaves are imagined from modern garden photographs.',
    de: 'Bäume, Gras und Laub sind nach heutigen Gartenfotografien frei gestaltet.',
    sourceEn: 'Modern photographs of the Clos Lucé garden do not record its planting in Leonardo’s time.',
    sourceDe: 'Heutige Fotografien des Gartens von Clos Lucé belegen nicht seine Bepflanzung zu Leonardos Zeit.',
  },
  'weather-assumptions': {
    en: 'The clouds and haze are imagined, since no source records the weather at this hour.',
    de: 'Wolken und Dunst sind frei gestaltet, denn keine Quelle hält das Wetter dieser Stunde fest.',
    sourceEn: 'The museum chose the weather around the calculated sunlight.',
    sourceDe: 'Das Museum hat das Wetter zum berechneten Sonnenlicht gewählt.',
  },
  'collection-threshold': {
    en: 'You are leaving 1517 for a museum built in our own century.',
    de: 'Sie verlassen das Jahr 1517 und betreten ein Museum unseres Jahrhunderts.',
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
    en: 'This picture is withheld because the available scan is not cleared for this museum.',
    de: 'Dieses Bild bleibt ausgespart, weil der verfügbare Scan für dieses Museum nicht freigegeben ist.',
    sourceEn: 'The image supplier’s terms and the museum’s rights review.',
    sourceDe: 'Die Nutzungsbedingungen des Bildanbieters und die Rechteprüfung des Museums.',
  },
  'supper-record': {
    en: 'The Last Supper survives as a fragile wall painting in Milan.',
    de: 'Das Abendmahl ist als empfindliche Wandmalerei in Mailand erhalten.',
    sourceEn: 'The Last Supper museum’s record describes painting on a dry wall, not fresco.',
    sourceDe: 'Das Museum des Abendmahls beschreibt Malerei auf trockenem Putz, kein Fresko.',
  },
  'supper-absence': {
    en: 'The Last Supper’s image is not cleared for display here.',
    de: 'Die Abbildung des Abendmahls ist hier nicht zur Anzeige freigegeben.',
    sourceEn: 'The image supplier’s terms and the museum’s rights review.',
    sourceDe: 'Die Nutzungsbedingungen des Bildanbieters und die Rechteprüfung des Museums.',
  },
  'facsimile-record': {
    en: 'This reproduction of Manuscript B was printed in 1883.',
    de: 'Diese Nachbildung von Manuskript B wurde 1883 gedruckt.',
    sourceEn: 'Charles Ravaisson-Mollien’s printed facsimile of Manuscript B.',
    sourceDe: 'Charles Ravaisson-Molliens gedrucktes Faksimile von Manuskript B.',
  },
  'surviving-notebooks': {
    en: 'The surviving notebooks are held in collections around the world.',
    de: 'Die erhaltenen Notizbücher befinden sich in Sammlungen auf der ganzen Welt.',
    sourceEn: 'Richter’s manuscript census and the records of their present holders.',
    sourceDe: 'Richters Handschriftenverzeichnis und die Angaben der heutigen Sammlungen.',
  },
  'anatomy-absence': {
    en: 'The anatomical drawings at Windsor cannot be shown in this museum.',
    de: 'Die anatomischen Zeichnungen in Windsor dürfen in diesem Museum nicht gezeigt werden.',
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
  de: 'Alles, worauf Sie gehen können, ist anhand von Fotografien und dem Kataster rekonstruiert.',
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
  en: 'Tree species, positions and dimensions, grass and fallen leaves are conjectural. Modern garden photographs inform their character, not planting in 1517. Proposed tree heights: 9.3–22 m; fallen-leaf lengths: 0.126–0.27 m; grass heights: 0.015–0.38 m. These are procedural ranges for the exhibition, not surveyed or historical measurements. Six middle-distance trees are proposed at EN (−53,12), (−49,44), (−21,65), (12,76), (39,54), (53,24) m, with heights 10.8–17.2 m and crown-reach parameters 4.8–7.2 m. These are conjectural scenic choices, not photographic measurements. The four near-tree root collars form one connected skin with the trunk and extend 1.65–3.65 trunk radii. Each outer toe is embedded 0.02 m in its own sampled ground; the next collar ring stays at least 0.20 m above its sampled ground. Shared parallel-transported rings carry the same positions and taper normals across adjacent trunk and knee spans; near trunks use twelve sides. These root shapes, micropositions and dimensions are conjectural construction choices, not measurements of historic trees. The added foreground grass is a conjectural exhibition field: centres EN (−23.7, −30.7) and (−29.3, −37.8) m; elliptical radii EN (6.8, 6.4) and (8.2, 5.6) m, weighted 3:2. Seed 15171013 adds 800 calm or 2800 standard/hero clumps with 3–5 attempted blades per clump; cut checks can omit individual blades. Nominal blade heights are 0.015138–0.3782 m, before the 0.008 m root burial. Base widths are 0.004–0.019 m. Proposed dry seed stalks rise 0.19–0.48 m and are capped at 0.22 m within 1.3 m of a circulation edge; 277 occur in calm and 979 in standard/hero. Every new base samples the shared ground height. Existing cuts exclude both ribbons and seed envelopes. No plant species or historical seed-head form is asserted; the population remains fixed in world space.',
  de: 'Baumarten, Standorte und Maße sowie Gras und Laub sind Vermutungen. Heutige Gartenfotografien dienen als Vorbild für ihren Charakter, nicht als Beleg für die Bepflanzung von 1517. Vorgeschlagene Baumhöhen: 9,3–22 m; Längen der gefallenen Blätter: 0,126–0,27 m; Grashöhen: 0,015–0,38 m. Dies sind prozedurale Größenbereiche für die Ausstellung, keine vermessenen oder historischen Maße. Sechs Bäume in mittlerer Entfernung sind bei EN (−53,12), (−49,44), (−21,65), (12,76), (39,54), (53,24) m vorgeschlagen, mit Höhen von 10,8–17,2 m und Kronenreichweiten-Parametern von 4,8–7,2 m. Dies sind vermutete gestalterische Werte, keine Fotomessungen. Die Wurzelanläufe der vier nahen Bäume bilden eine zusammenhängende Oberfläche mit dem Stamm und reichen über 1,65–3,65 Stammradien. Jede äußere Spitze liegt 0,02 m im jeweils abgetasteten Boden; der nächste Ring des Wurzelanlaufs bleibt mindestens 0,20 m über seinem abgetasteten Boden. Gemeinsam genutzte, parallel fortgeführte Ringe tragen dieselben Positionen und Verjüngungsnormalen über benachbarte Stammabschnitte und Astknicke; nahe Stämme haben zwölf Seiten. Diese Wurzelformen, genauen Positionen und Maße sind vermutete Konstruktionswerte, keine Messungen historischer Bäume. Das zusätzliche Vordergrundgras ist ein vermutetes Ausstellungsfeld: Mittelpunkte EN (−23,7, −30,7) und (−29,3, −37,8) m; elliptische Radien EN (6,8, 6,4) und (8,2, 5,6) m, im Verhältnis 3:2 gewichtet. Startwert 15171013 ergänzt 800 Büschel in Calm oder 2800 in Standard/Hero mit jeweils 3–5 vorgesehenen Halmen; einzelne Halme entfallen bei der Prüfung der Aussparungen. Die nominellen Halmhöhen betragen 0,015138–0,3782 m vor dem Eingraben der Wurzel um 0,008 m. Die Breiten am Ansatz betragen 0,004–0,019 m. Die vorgeschlagenen trockenen Samenhalme sind 0,19–0,48 m hoch; innerhalb von 1,3 m neben einer Gehfläche bleiben sie höchstens 0,22 m hoch. Calm enthält 277, Standard/Hero 979 Samenhalme. Jeder neue Ansatz folgt der gemeinsam verwendeten Bodenhöhe. Die bestehenden Aussparungen halten sowohl Halmbänder als auch Samenstände frei. Weder eine Pflanzenart noch eine historische Form der Samenstände wird behauptet; der Bestand bleibt an festen Weltkoordinaten.',
  certainty: 'conjectural', target: 'carrier',
  source: 'brief/BUILDING-DOSSIER.md § Terrain and ground work, § Honesty labels and period variants; Q119, Q128, Q178; A-SITE. Dimensional ranges: the declared procedural vegetation and ground-dressing recipes, not measurements from the photographs.',
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
  de: 'Sie verlassen das Jahr 1517. Es folgt ein Museum dessen, was erhalten ist, erbaut in unserem Jahrhundert.',
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
const stationPromises: Partial<Record<VinciStationId, VinciText>> = {
  oratory: {
    en: 'Explore the oratory and the uncertainty surrounding its wall paintings.',
    de: 'Entdecken Sie das Oratorium und die offenen Fragen zu seinen Wandmalereien.',
  },
  chamber: {
    en: 'Look from the room the house museum associates with Leonardo toward the royal château.',
    de: 'Blicken Sie aus dem Zimmer, das das Hausmuseum Leonardo zuordnet, zum königlichen Schloss.',
  },
  garden: {
    en: 'The garden front catches the afternoon light above the valley.',
    de: 'Die Gartenfront fängt über dem Tal das Nachmittagslicht ein.',
  },
  'supper-wall': {
    en: 'The Last Supper’s empty outline reveals the scale of the painting we cannot show.',
    de: 'Der leere Umriss des Abendmahls zeigt die Größe des Gemäldes, das hier nicht zu sehen sein darf.',
  },
  flight: {
    en: 'See what Leonardo’s flight studies explain and what they leave unknown.',
    de: 'Entdecken Sie, was Leonardos Flugstudien erklären und was sie offenlassen.',
  },
  works: {
    en: 'Follow the evidence from a machine drawn on paper to one that was built.',
    de: 'Folgen Sie den Belegen von der gezeichneten Maschine bis zur gebauten.',
  },
  myths: {
    en: 'Follow the records behind familiar stories about Leonardo.',
    de: 'Entdecken Sie die Belege hinter vertrauten Geschichten über Leonardo.',
  },
};

const statementRecord = (value: VinciText): VinciText =>
  'record' in value && value.record ? value.record as VinciText : { en: value.en, de: value.de };

const seed = (
  id: VinciStationId, name: VinciText, promise: VinciText,
  labels: readonly VinciStatement[], source: string,
  germanProvenance: VinciStationContent['germanProvenance'] = 'museum translation',
): StationSeed => ({
  id, name, promise: stationPromises[id] ?? promise, record: statementRecord(promise),
  labels, promiseSource: source,
  germanProvenance: stationPromises[id] || labels.some(label => label === promise) ? 'museum translation' : germanProvenance,
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
    { en: `${statementRecord(oratory).en} ${statementRecord(oratoryAttribution).en}`, de: `${statementRecord(oratory).de} ${statementRecord(oratoryAttribution).de}` },
    [oratoryDateQualification, oratory, oratoryAttribution], 'brief/CONCEPT-OPUS.md §3 S4'),
  seed('study', { en: 'The study, and the visit', de: 'Das Studierzimmer und der Besuch' }, study,
    [study], 'brief/CONCEPT-OPUS.md §3 S5'),
  seed('chamber', { en: 'The north room and its window', de: 'Das Nordzimmer und sein Fenster' },
    { en: `${statementRecord(chamber).en} ${statementRecord(chamberPlacement).en}`, de: `${statementRecord(chamber).de} ${statementRecord(chamberPlacement).de}` },
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
    { en: `${statementRecord(supper).en} ${statementRecord(supperAbsence).en}`, de: `${statementRecord(supper).de} ${statementRecord(supperAbsence).de}` },
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
