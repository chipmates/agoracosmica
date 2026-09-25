/* A DATE'S LETTERING, without the floor it is cut into. The floor and the
   page read one setting from here: the floor cuts the year, and the page draws
   the words beside it over the picture in the visitor's language. It carries
   the font and the dates, and nothing of the scene. */
import { font, textAdvance } from '../words/font'
import { textOutline, type TextOutline } from '../words/outline'
import { LINE_STUDS as STUDS, LINE_STUD_SPACING as STUD_SPACING, type Stud } from './studs'

export type Certainty = Stud['certainty']

/** THE GALLERY'S THREE EXCERPTS and how each is lettered: the first is read
 * standing over it, each word beside its socket and each year at the
 * visitor's feet; the two down the room are read from its south end, where a
 * stacked date runs into the next, so each of their dates is laid as one row. */
export const LINE_FLOOR_SECTIONS = [
  { station: 'line-early', selected: 0, row: 0, lettering: 'stacked' },
  { station: 'line-late', selected: 28, row: 4, lettering: 'row' },
  { station: 'line-amboise', selected: 38, row: 8, lettering: 'row' },
] as const
/** The whole excerpt is carried onto its own course as one piece: this far
 * along the line's own Z, from where the bench cut it. */
export const lineSectionShift = (row: number): number => (2 - row) * STUD_SPACING
export const CERTAINTY = {
  documented: { colour: '#71a98b', en: 'documented', de: 'belegt' },
  inferred: { colour: '#d7aa58', en: 'inferred', de: 'erschlossen' },
  tradition: { colour: '#d17c70', en: 'tradition', de: 'Überlieferung' },
} as const

/** How a date's lettering lies beside its socket. `stacked`: the word north
 * of the socket, the year and any event south of it. `row`: one row centred
 * on the socket, the year then its word and any event beside it, cut long
 * along the walk as a road's markings are, so a date read from far down the
 * floor keeps its shape at a grazing eye and open stone before the next. */
export type LineLettering = 'stacked' | 'row'
/** A row's measures in metres. `depth` is the year's length along the walk
 * and `pairDepth` a word and event's together; `wordRise` and `pairRise` are
 * a word's cap along the walk; the sizes are caps across it, and a word
 * narrows so its row ends within `reach` of the socket, the phone's frame. */
export const ROW_LETTERING = { depth: 1.08, pairDepth: 1.2, pairGap: .07, year: .36, selected: .40, word: .24, paired: .15, gap: .14, reach: 2.8, wordRise: .8, pairRise: .47, bold: .05 } as const
/** a single line's rise over its baseline, in metres, at its cap height */
function ascent(text:string,size:number):number{let top=0;for(const shape of font.generateShapes(text,size))for(const p of shape.getPoints(2))top=Math.max(top,p.y);return top}

/** A dated row that shares its year and its certainty with the row beside it
 * names its day, read from its own date label, so no two rows read alike. */
function sharedDay(n:number,language:'en'|'de'):string|undefined{
  const stud=STUDS[n]!
  if(stud.date_precision!=='day')return undefined
  const twin=[STUDS[n-1],STUDS[n+1]].some(other=>other&&other.date.slice(0,4)===stud.date.slice(0,4)&&other.certainty===stud.certainty)
  return twin?(language==='en'?stud.date_label_en:stud.date_label_de).replace(/\s*\d{4}$/,''):undefined
}

/** One text of a date's lettering, laid on the floor in the line's own
 * metres: its top-left corner at `at`, running east and south, stretched
 * along the walk by `stretch`, and cut again `bold` metres south in a row. */
export interface LinePiece {
  text: string
  size: number
  maxWidth?: number
  outline: TextOutline
  at: [number, number, number]
  stretch: number
  bold: number
}
/** A DATE'S LETTERING, set once for the floor and for the page. The floor cuts
 * the year; the certainty word and the cue (an event, or the day where two
 * rows share year and certainty) are words in a language, so the page draws
 * them over the picture where this sets them, and one film serves every
 * language. */
export function lineLettering(n:number, selected:number, language:'en'|'de', phone=false, lettering:LineLettering='stacked'):{studId:string;certainty:Certainty;year:LinePiece;word:LinePiece;cue?:LinePiece} {
  const stud=STUDS[n]!, z=-(n-selected)*STUD_SPACING
  const fact=CERTAINTY[stud.certainty as keyof typeof CERTAINTY]
  const cue=stud.id==='life-30'?(language==='en'?'Anghiari contract':'Anghiari-Vertrag'):stud.id==='life-31'?(language==='en'?"Father’s death":'Tod des Vaters'):sharedDay(n,language)
  const row=lettering==='row',R=ROW_LETTERING,yearText=stud.date.slice(0,4),wordText=language==='en'?stud.certainty:fact.de
  // a row's year keeps its size; its word and event narrow to the row's reach
  const yearSize=row?(n===selected?R.selected:R.year):n===selected?.38:phone?.27:.23
  const beside=.31+textAdvance(yearText,yearSize)+R.gap
  const fit=(text:string,size:number)=>Math.min(size,size*(R.reach-beside)/textAdvance(text,size))
  const piece=(text:string,size:number,maxWidth?:number):LinePiece=>({text,size,...(maxWidth===undefined?{}:{maxWidth}),
    outline:textOutline(text,{size,...(maxWidth===undefined?{}:{maxWidth})}),at:[0,0,0],stretch:1,bold:0})
  const year=piece(yearText,yearSize,row?3:1.4)
  const word=row?piece(wordText,fit(wordText,cue?R.paired:R.word)):piece(wordText,phone?.115:.087,1.5)
  const event=!cue?undefined:row?piece(cue,fit(cue,R.paired)):piece(cue,phone?.115:.095,1.48)
  // A text's anchor is its top-left corner, and it runs south from there.
  if(row){
    // the year fills the row's depth; a lone word stands on its baseline,
    // a word and its event share the row as two lines
    const top=z-R.depth/2,stretch=R.depth/year.outline.height,baseline=top+ascent(yearText,year.outline.size)*stretch,x=.31+year.outline.width+R.gap
    year.stretch=stretch;year.at=[.31,.0005,top];year.bold=R.bold
    if(event){
      const rise=Math.min(R.pairRise,R.pairRise*(R.pairDepth-R.pairGap)/(word.outline.height*R.pairRise/word.outline.size+event.outline.height*R.pairRise/event.outline.size))
      word.stretch=rise/word.outline.size;event.stretch=rise/event.outline.size
      word.at=[x,.0010,z-R.pairDepth/2]
      event.at=[x,.0010,z+R.pairDepth/2-event.outline.height*event.stretch]
      event.bold=R.bold*.5
    }else{
      word.stretch=R.wordRise/word.outline.size
      word.at=[x,.0010,baseline-ascent(wordText,word.outline.size)*word.stretch]
    }
    word.bold=R.bold*.5
  }else{
    year.at=[.31,.0005,z+(cue?.08:.23)]
    word.at=[.33,.0010,z-.22]
    if(event)event.at=[.33,.0010,z+.60]
  }
  return {studId:stud.id,certainty:stud.certainty,year,word,...(event?{cue:event}:{})}
}

