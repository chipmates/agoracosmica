/* THE WALK'S END IN WORDS: the choice beside the look up and the plate it
   opens, read by key from `data/ending.json`. Not the card data: the machine
   cycles read that file whole. */

import wordsSource from './data/ending.json?raw'
import type { VinciText } from './content'

interface EndingWordsFile { ending: Record<string, Record<string, VinciText>> }
const WORDS = JSON.parse(wordsSource) as EndingWordsFile

/** A word of the ending by its key, `ending.learn.word`, in both languages. */
export function endingWord(key: string): VinciText {
  const [scope, group, part] = key.split('.')
  const said = scope === 'ending' && group && part ? WORDS.ending[group]?.[part] : undefined
  if (!said?.en || !said.de) throw new Error(`No ending word ${key}`)
  return said
}
