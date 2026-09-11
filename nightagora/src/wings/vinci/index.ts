/* The wing that is not built yet. It exists so that /w/vinci is a working
   address before a single room stands, and so the promise the lobby makes
   is answered by a plate that says plainly what is true today. One
   station, one honest plate, the frame's own door beside it. */

import { WING_TEXT, say } from '../content'
import type { WingHosts, WingModule } from '../frame'

/** The figure's own entry question, the one the door names in the app. */
const QUESTION = {
  en: 'I am curious about everything and finish nothing. Is that a flaw?',
  de: 'Ich interessiere mich für alles und bringe nichts zu Ende. Ist das ein Fehler?',
}

export function createWing(): WingModule {
  return {
    stations: [{ name: say(WING_TEXT.preparing), question: say(QUESTION) }],
    show(_index: number, hosts: WingHosts) {
      hosts.stage.textContent = ''
      const plate = document.createElement('div')
      plate.className = 'wing-plate'
      const kicker = document.createElement('p')
      kicker.className = 'wing-plate-kicker'
      kicker.textContent = 'Leonardo da Vinci'
      const title = document.createElement('h2')
      title.className = 'wing-plate-title'
      title.textContent = say(WING_TEXT.preparing)
      // the one thing this wing can state as fact today is its own state
      title.dataset['naClaim'] = 'documented'
      title.dataset['naAnchor'] = 'vinci/register'
      title.dataset['naAnchorClass'] = 'procedural'
      const line = document.createElement('p')
      line.className = 'wing-plate-line'
      line.textContent = say(WING_TEXT.preparingLine)
      plate.append(kicker, title, line)
      hosts.stage.appendChild(plate)
    },
    stop() {
      /* the frame empties its own hosts */
    },
  }
}
