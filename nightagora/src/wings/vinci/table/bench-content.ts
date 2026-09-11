import type { Language } from './content'

export type BenchControl = 'prev' | 'open' | 'next' | 'mirror' | 'shelf' | 'close' | 'language'

export interface BenchCopy {
  readonly brand: string
  readonly title: string
  readonly kicker: string
  readonly viewportLabel: string
  readonly controlsLabel: string
  readonly caption: string
  readonly mirrorCaption: string
  readonly mirrorSources: string
  readonly materialCaption: string
  readonly materials: Readonly<Record<'oak' | 'leather' | 'linen', string>>
  readonly unavailablePrefix: string
  readonly controls: Readonly<Record<BenchControl, string>>
}

/** Authored interface copy; source inscriptions and manuscript text stay verbatim. */
export const BENCH_CONTENT = {
  en: {
    brand: 'Agora Cosmica',
    title: 'The reading table',
    kicker: 'LEONARDO DA VINCI · PARIS MANUSCRIPT B',
    viewportLabel: 'The 1883 facsimile under a reading lamp',
    controlsLabel: 'Reading controls',
    caption: '1883 FACSIMILE · ORIGINAL MANUSCRIPT: INSTITUT DE FRANCE',
    mirrorCaption: '1883 FACSIMILE · BESIDE IT: MIRRORED READING COPY',
    mirrorSources: 'Sources on mirror writing',
    materialCaption: 'MATERIAL STUDY · MODERN EXHIBITION FITTING',
    materials: { oak: 'oak', leather: 'leather', linen: 'linen' },
    unavailablePrefix: 'Table unavailable: ',
    controls: {
      prev: '← Previous',
      open: 'Open the book',
      next: 'Next →',
      mirror: 'Mirror hand',
      shelf: 'Famous folios',
      close: 'Close book',
      language: 'DE',
    },
  },
  de: {
    brand: 'Agora Cosmica',
    title: 'Der Lesetisch',
    kicker: 'LEONARDO DA VINCI · PARISER MANUSKRIPT B',
    viewportLabel: 'Das Faksimile von 1883 unter einer Leselampe',
    controlsLabel: 'Steuerung des Lesetischs',
    caption: 'FAKSIMILE VON 1883 · ORIGINALMANUSKRIPT: INSTITUT DE FRANCE',
    mirrorCaption: 'FAKSIMILE VON 1883 · DANEBEN: GESPIEGELTE LESEKOPIE',
    mirrorSources: 'Quellen zur Spiegelschrift',
    materialCaption: 'MATERIALSTUDIE · MODERNE AUSSTATTUNG',
    materials: { oak: 'Eiche', leather: 'Leder', linen: 'Leinen' },
    unavailablePrefix: 'Lesetisch nicht verfügbar: ',
    controls: {
      prev: '← Zurück',
      open: 'Buch öffnen',
      next: 'Weiter →',
      mirror: 'Spiegelschrift',
      shelf: 'Berühmte Blätter',
      close: 'Buch schließen',
      language: 'EN',
    },
  },
} as const satisfies Readonly<Record<Language, BenchCopy>>
