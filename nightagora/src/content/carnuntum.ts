/* CARNUNTUM ON THE DANUBE — the words that belong to his ground.

   The traces are George Long's 1862 English (public domain), cited
   book.section. Nothing is quoted from memory without a section, and
   nothing is paraphrased: the words are his, the world is our reading of
   them. */

export interface Trace {
  id: string
  site: string
  tick: string
  cite: string
  text: string
  where: string
}

export const TRACES: Trace[] = [
  {
    id: 'river',
    site: 'The Danube',
    tick: '48° 12′ N',
    cite: 'Meditations 4.43',
    text:
      'Time is like a river made up of the events which happen, and a violent stream; for as soon as a thing has been seen, it is carried away, and another comes in its place, and this will be carried away too.',
    where: 'Cut into the bridge post, where the current is loudest.',
  },
  {
    id: 'post',
    site: 'The tent post',
    tick: '02° 40′',
    cite: 'Meditations 5.20',
    text:
      'The mind converts and changes every hindrance to its activity into an aid; and so that which is a hindrance is made a furtherance to an act; and that which is an obstacle on the road helps us on this road.',
    where: 'Carved with a knife into the post at the second row, low, where a man sits.',
  },
  {
    id: 'desk',
    site: 'The praetorium',
    tick: '00° 00′',
    cite: 'Meditations 4.3',
    text:
      'Nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquillity.',
    where: 'Open on the desk, in his own hand, the ink not yet dry.',
  },
]

/** the atlas annotation layer: letterspaced small caps with degree ticks,
    inked in only while their site is the thing being looked at */
export interface AtlasLabel {
  site: string
  tick: string
  at: [number, number, number]
  from: number
  to: number
}

export const LABELS: AtlasLabel[] = [
  { site: 'The Danube', tick: '48° 12′ N · 17° 04′ E', at: [-5.6, 0.6, 20.0], from: 0.02, to: 0.3 },
  { site: 'The ford', tick: 'Crossing · II', at: [1.78, 2.1, 13.4], from: 0.16, to: 0.36 },
  { site: 'Porta praetoria', tick: 'Hgt 3.2 m · torches II', at: [0.0, 4.3, 4.2], from: 0.3, to: 0.52 },
  { site: 'Via principalis', tick: 'Bearing 000°', at: [-2.9, 0.9, -9.0], from: 0.46, to: 0.6 },
  { site: 'Contubernia', tick: 'VIII per tent', at: [8.15, 2.0, -6.5], from: 0.46, to: 0.66 },
  { site: 'The praetorium', tick: 'The inner citadel', at: [-3.9, 3.2, -19.0], from: 0.6, to: 0.76 },
  { site: 'Stoic Taurus', tick: 'Risen · alt 22°', at: [13.5, 21.5, 4.0], from: 0.9, to: 1.0 },
]

export interface Station {
  t: number
  name: string
  /** the trace that belongs to this stretch of the walk */
  trace?: number
}

export const STATIONS: Station[] = [
  { t: 0.0, name: 'The far shore' },
  { t: 0.28, name: 'The ford', trace: 0 },
  { t: 0.42, name: 'The gate' },
  { t: 0.57, name: 'Via principalis', trace: 1 },
  { t: 0.7, name: 'The praetorium' },
  { t: 0.79, name: 'His desk', trace: 2 },
  { t: 1.0, name: 'The vista' },
]

/** each mark belongs to its own stretch: the star for the site you are
    standing at, never three at once */
export const TRACE_WINDOWS: Array<[number, number]> = [
  [0.0, 0.34],
  [0.44, 0.68],
  [0.73, 0.86],
]
