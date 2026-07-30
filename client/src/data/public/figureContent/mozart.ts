import type { FigureFragment } from './types';

// mozart: voice-passed QA plus the authored page blocks. "Mozarts erste
// Komposition" is his one harvested German query and the honest answer is the
// interesting one, so the block leads with the earliest SURVIVING symphony.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Wolfgang Amadeus Mozart?',
          a: 'Wolfgang Amadeus Mozart (1756-1791) wrote more than six hundred pieces and was dead at thirty-five. He was about three when he pressed his cheek to the keyboard to feel his sister play through the wood. Then came years of his father drilling him. What comes out sounds effortless, and none of it was. He is the case for strict form being the thing that sets feeling free.',
        },
        {
          q: 'What did Wolfgang Amadeus Mozart teach?',
          a: 'Mozart taught that sound carries meaning on its own, with no words to explain it. A major third laughs and a minor third weeps, and he treated that as something you find in the world, not something you decide. He taught that form is architecture, not a cage. The exposition sets up a home key, the development wanders off into strange ones, and the return home is changed by the trip. And he taught that the craft should disappear. If you can hear how hard it was, it is not finished yet.',
        },
        {
          q: 'What is concealed artistry?',
          a: "Concealed artistry is Mozart's idea that the work should not show. Think of a fountain. The water seems to rise by itself and fall as if gravity had agreed to be graceful. Under the square there are pumps and pipes built to vanish. Music can do the same. The complicated thing sounds inevitable instead of clever. Someone who knows what to listen for finds a second layer, and everyone else just loves the tune without knowing why.",
        },
      ],
      disclosure: {
        q: 'Is this really Wolfgang Amadeus Mozart speaking?',
        a: 'No. This is an Echo of Mozart. It is an AI voice built from his documented life and his ideas about music, and it stays an interpretation, not a recording. He lived from 1756 to 1791, and no recording of him exists. Use it as a way into how he thought, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Wolfgang Amadeus Mozart lernen?',
          a: 'Wolfgang Amadeus Mozart (1756-1791) schrieb über sechshundert Werke und war mit fünfunddreißig tot. Mit etwa drei Jahren presste er die Wange an das Tasteninstrument, um das Spiel seiner Schwester durch das Holz zu spüren. Dann kamen die Jahre, in denen sein Vater ihn drillte. Was dabei herauskommt, klingt mühelos, und nichts davon war es. Bei ihm siehst du, dass strenge Form das Gefühl erst frei macht.',
        },
        {
          q: 'Was hat Wolfgang Amadeus Mozart gelehrt?',
          a: 'Mozart lehrte, dass Klang von sich aus Bedeutung trägt, ganz ohne Worte. Eine große Terz lacht, eine kleine Terz weint, und für ihn war das etwas, das man in der Welt findet, nicht etwas, das man festlegt. Er lehrte, dass Form Architektur ist und kein Gefängnis. Die Exposition richtet ein Zuhause ein, die Durchführung zieht durch fremde Tonarten, und die Rückkehr ist von der Reise verändert. Und er lehrte, dass das Handwerk verschwinden soll. Wenn man hört, wie schwer es war, ist es noch nicht fertig.',
        },
        {
          q: 'Was ist verborgene Kunstfertigkeit?',
          a: 'Die verborgene Kunstfertigkeit ist Mozarts Gedanke, dass die Arbeit nicht zu sehen sein soll. Denk an einen Springbrunnen. Das Wasser steigt scheinbar von selbst und fällt, als hätte die Schwerkraft zugestimmt, schön zu sein, und unter dem Platz liegen Pumpen und Rohre, die verschwinden sollen. Musik kann dasselbe. Das Komplizierte klingt zwingend statt clever. Wer weiß, worauf er hören muss, findet eine zweite Schicht, und alle anderen lieben einfach die Melodie, ohne zu wissen warum.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Wolfgang Amadeus Mozart?',
        a: 'Nein. Das hier ist ein Echo von Mozart. Es ist eine KI-Stimme, gebaut aus seinem belegten Leben und seinen Gedanken über Musik, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von 1756 bis 1791, und es gibt keine Aufnahme von ihm. Nimm es als Weg zu seinem Denken, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What was Mozart's first composition?",
          seedId: 3,
          body:
            'The honest answer has an edge on it. The earliest of his symphonies that survives is K. 16, written in London in 1764, when he was eight. His father had fallen ill that summer while the family was staying in Chelsea. His sister remembered a first symphony composed in that house, and the piece she remembered may not be the one that came down to us. By then he had been at a keyboard since about the age of three and had already spent a year touring Europe. So the child composer is real. The tidy story of one first piece is not.',
        },
        {
          h2: 'What did Mozart mean by freedom inside the rules?',
          seedId: 4,
          body:
            'He put it as a picture. A river without banks is a swamp. It goes everywhere and arrives nowhere. The banks are what make it a river. Musical form works the same way. In sonata form the exposition sets up a home key, the development wanders off into strange ones, and the return home is changed by the trip. That shape is not a cage, it is architecture, and it is why the feeling in his music has somewhere to go. He did not stumble into it. His father drilled him in counterpoint and harmony from childhood, and the freedom you hear is what all that drilling bought.',
        },
        {
          h2: 'Did Mozart compose without effort?',
          seedId: 8,
          body:
            'No, and the myth quietly robs him of credit. From childhood his father put him through systematic training in counterpoint, harmony, and compositional technique, hour after hour. He went on to teach the same way himself. Thomas Attwood came from England and studied with him in Vienna between 1785 and 1787. What Mozart aimed at was the opposite of showing your work. He wanted the difficulty to vanish, so that the piece sounds like the only thing that could have happened. Effortless is the effect. It was never the method.',
        },
      ],
      ideaQuestion: 'The rules in my work feel like a cage. Can they be anything else?',
      works: [
        {
          title: 'Symphony No. 1 in E-flat major, K. 16 (1764)',
          note: 'Written in London when he was eight, the summer his father was too ill to work. The earliest of his symphonies that survives.',
        },
        {
          title: 'Piano Sonata No. 8 in A minor, K. 310 (1778)',
          note: 'Composed in Paris in the summer of 1778, the same summer his mother died there on July 3.',
        },
        {
          title: 'Six String Quartets dedicated to Haydn, K. 387-465 (1782-1785)',
          note: 'Six quartets spread over three years and dedicated to Joseph Haydn. Four instruments, and no orchestra to hide behind.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was war Mozarts erste Komposition?',
          seedId: 3,
          body:
            'Die ehrliche Antwort hat eine Kante. Die früheste seiner Sinfonien, die erhalten ist, ist KV 16, geschrieben 1764 in London, da war er acht. Sein Vater war in jenem Sommer krank geworden, während die Familie in Chelsea wohnte. Seine Schwester erinnerte sich an eine erste Sinfonie, die in diesem Haus entstand. Ob das dasselbe Stück ist, das auf uns gekommen ist, weiß niemand. Am Instrument saß er da schon seit etwa seinem dritten Lebensjahr, und ein Jahr Reise durch Europa lag hinter ihm. Das Wunderkind ist also echt. Die saubere Geschichte von dem einen ersten Stück ist es nicht.',
        },
        {
          h2: 'Was heißt Freiheit in der Struktur?',
          seedId: 4,
          body:
            'Er hat es als Bild gesagt. Ein Fluss ohne Ufer ist ein Sumpf. Er geht überallhin und kommt nirgends an. Die Ufer machen ihn erst zum Fluss. Mit musikalischer Form ist es genauso. In der Sonatenform richtet die Exposition ein Zuhause ein, die Durchführung zieht durch fremde Tonarten, und die Rückkehr ist von der Reise verändert. Diese Form ist kein Käfig, sondern Architektur, und deshalb hat das Gefühl in seiner Musik überhaupt einen Weg. Zugefallen ist ihm das nicht. Sein Vater drillte ihn von klein auf in Kontrapunkt und Harmonielehre, und die Freiheit, die du hörst, ist das, was dieser Drill gekauft hat.',
        },
        {
          h2: 'Wolfgang Amadeus Mozart einfach erklärt',
          body:
            'Mozart war Komponist der Wiener Klassik. In etwa fünfunddreißig Lebensjahren schrieb er über sechshundert Werke, Sinfonien, Opern, Kammermusik, Kirchenmusik. Drei Dinge machen ihn aus. Erstens: Für ihn spricht der Klang selbst, ohne dass Worte etwas erklären müssen. Zweitens: Die strengen Formen seiner Zeit waren für ihn kein Zwang, sondern der Rahmen, in dem Gefühl überhaupt eine Richtung bekommt. Drittens: Das Handwerk soll man nicht hören. Was leicht klingt, ist das Ergebnis von jahrelangem Üben unter einem sehr strengen Vater. Wer bei ihm etwas lernen will, lernt das Verhältnis von Disziplin und Freude.',
        },
      ],
      ideaQuestion: 'Die Regeln meiner Arbeit fühlen sich wie ein Käfig an. Geht das auch anders?',
      works: [
        {
          title: 'Sinfonie Nr. 1 Es-Dur, KV 16 (1764)',
          note: 'Geschrieben in London, mit acht Jahren, in dem Sommer, in dem sein Vater zu krank zum Arbeiten war. Seine früheste erhaltene Sinfonie.',
        },
        {
          title: 'Klaviersonate Nr. 8 a-Moll, KV 310 (1778)',
          note: 'Entstanden im Sommer 1778 in Paris, in demselben Sommer, in dem dort am 3. Juli seine Mutter starb.',
        },
        {
          title: 'Sechs Joseph Haydn gewidmete Streichquartette, KV 387-465 (1782-1785)',
          note: 'Sechs Quartette über drei Jahre verteilt, Joseph Haydn gewidmet. Vier Instrumente, und kein Orchester, hinter dem man sich verstecken kann.',
        },
      ],
    },
  },
};
