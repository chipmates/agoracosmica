import type { FigureFragment } from './types';

// einstein: voice-passed QA plus the authored page blocks. The concept blocks
// carry the human material (the compass, the question he never closed, the
// letter) because there is no organic query signal to harvest for him yet.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Albert Einstein?',
          a: "Albert Einstein (1879-1955) was a theoretical physicist who kept asking the plainest question there is: why. At five, sick in bed, he was handed a compass and wanted to know what pulled the needle. At sixteen he pictured himself racing a beam of light. Those questions grew into relativity, and they changed what space, time, and gravity mean.",
        },
        {
          q: 'What did Albert Einstein teach?',
          a: "Albert Einstein taught that space and time are one fabric, not two separate backdrops. Two people can disagree about whether two things happened at the same moment, and both can be right. It depends on how each of them is moving. He also showed that mass and energy are the same thing in different clothes, in a three-page paper received on September 27, 1905. Ten years later he finished the field equations, on November 25, 1915, and gravity stopped being a force. It became the shape of space and time, bent by whatever sits in it.",
        },
        {
          q: 'What is a thought experiment?',
          a: "A thought experiment is an experiment you run in your head, with the rules of physics still switched on. Einstein worked this way his whole life. At sixteen he imagined flying next to a beam of light, matching its speed exactly. What would he see? A wave standing still. Maxwell's equations, the accepted physics of light at the time, said that cannot happen. The picture broke, and the crack in it pointed him toward relativity.",
        },
      ],
      disclosure: {
        q: 'Is this really Albert Einstein speaking?',
        a: "No. This is an Echo of Albert Einstein. It is an AI voice built from his documented life and writing, and it stays an interpretation, not a recording. The real man lived from 1879 to 1955, and no recording of him speaks here. Use it as a way into his ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Albert Einstein lernen?',
          a: 'Albert Einstein (1879-1955) war theoretischer Physiker, und er fragte sein Leben lang weiter nach dem Warum. Mit fünf lag er krank im Bett und bekam einen Kompass in die Hand. Er wollte wissen, was die Nadel zieht. Mit sechzehn stellte er sich vor, wie er neben einem Lichtstrahl herläuft. Aus diesen Fragen wurde die Relativitätstheorie, und sie hat verändert, was Raum, Zeit und Schwerkraft bedeuten.',
        },
        {
          q: 'Was hat Albert Einstein gelehrt?',
          a: 'Albert Einstein lehrte, dass Raum und Zeit ein einziges Gewebe sind und keine zwei getrennten Kulissen. Zwei Menschen können sich uneinig sein, ob zwei Dinge gleichzeitig passiert sind, und beide haben recht. Es hängt davon ab, wie sie sich bewegen. Er zeigte außerdem, dass Masse und Energie dasselbe sind, nur in anderer Gestalt. Das stand 1905 auf drei Seiten, eingegangen am 27. September. Zehn Jahre später waren die Feldgleichungen fertig, am 25. November 1915. Damit war die Schwerkraft keine Kraft mehr, sondern die Form von Raum und Zeit, gekrümmt von dem, was darin liegt.',
        },
        {
          q: 'Was ist ein Gedankenexperiment?',
          a: 'Ein Gedankenexperiment ist ein Versuch, der nur im Kopf stattfindet, aber die Gesetze der Physik gelten weiter. Einstein hat sein Leben lang so gearbeitet. Mit sechzehn stellte er sich vor, wie er neben einem Lichtstrahl herfliegt, genau so schnell wie dieser. Was würde er sehen? Eine Welle, die stillsteht. Die Maxwellschen Gleichungen, die anerkannte Physik des Lichts, sagten: Das kann es nicht geben. An diesem Riss im Bild begann der Weg zur Relativitätstheorie.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Albert Einstein?',
        a: 'Nein. Das hier ist ein Echo von Albert Einstein. Es ist eine KI-Stimme, gebaut aus seinem belegten Leben und seinen Schriften, und sie bleibt eine Deutung, keine Aufnahme. Der echte Mensch lebte von 1879 bis 1955, und hier spricht keine Tonaufnahme von ihm. Nimm es als Weg in seine Ideen, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "Where did Einstein's curiosity come from?",
          seedId: 1,
          body:
            'Einstein was five and sick in bed when his father handed him a compass. The needle kept swinging back to north, pulled by something he could not see or touch. He never got over it. He remembered that compass as a turning point for the rest of his life. What he took from it was not an answer. It was a habit, and the habit was this: keep asking about the ordinary thing nobody else is asking about. Everything he became famous for started that way, with a plain question a child could ask.',
        },
        {
          h2: 'What did Einstein spend his last thirty years on?',
          seedId: 11,
          body:
            'On one question, and he never answered it. Einstein believed the forces of nature are pieces of a single thing, and he wanted one theory that held them all. He had already joined space to time, and mass to energy, so the idea was not wild. He worked on it at Princeton until he died in 1955, and he grew more isolated as he went. Most of physics had moved on without him. He kept going anyway. That is the part worth borrowing. He was willing to spend thirty years on a question he might never close, because he thought it was the right question.',
        },
        {
          h2: 'Did Einstein help build the atomic bomb?',
          seedId: 10,
          body:
            'He did not work on it. He did sign a letter. On August 2, 1939 he put his name to a letter to President Roosevelt. The physicist Leo Szilard had drafted it, urging the United States to act on atomic research. Einstein was a pacifist. He signed because he was afraid Nazi Germany would get there first. His own equation, E=mc², is part of why such a weapon was possible at all. Afterwards he went back to arguing for disarmament. On April 11, 1955, a week before he died, he agreed to sign a public appeal against nuclear war.',
        },
      ],
      ideaQuestion: 'Everyone wants an answer from me right now. How do I keep the question open?',
      works: [
        {
          title: 'On a Heuristic Viewpoint Concerning the Production and Transformation of Light (1905)',
          note: 'The photoelectric paper. Light behaves like packets of energy here, not only like a wave, which is where light quanta come from.',
        },
        {
          title: 'On the Electrodynamics of Moving Bodies (1905)',
          note: 'Special relativity. Two people moving differently can disagree about what happened at the same time, and neither of them is wrong.',
        },
        {
          title: 'Does the Inertia of a Body Depend Upon Its Energy Content? (1905)',
          note: 'Three pages, received on September 27, 1905. Mass and energy turn out to be the same thing, which is all E=mc² says.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Albert Einstein einfach erklärt',
          body:
            'Einstein war theoretischer Physiker. Drei Gedanken tragen sein Werk. Erstens: Raum und Zeit sind nicht zwei getrennte Dinge, sondern ein einziges Gewebe. Zweitens: Masse und Energie sind dasselbe, nur anders verpackt. Genau das sagt E=mc². Drittens: Schwerkraft zieht nicht, sie krümmt. Ein schwerer Körper biegt Raum und Zeit um sich herum, und alles andere folgt dieser Biegung. Angefangen hat das nicht am Schreibtisch, sondern mit Bildern im Kopf. Ein Kompass, als er fünf war. Ein Lichtstrahl, als er sechzehn war. Die Formeln kamen danach.',
        },
        {
          h2: 'Woher kam Einsteins Neugier?',
          seedId: 1,
          body:
            'Er war fünf und lag krank im Bett, als sein Vater ihm einen Kompass in die Hand legte. Die Nadel drehte sich immer wieder nach Norden, gezogen von etwas, das er weder sehen noch anfassen konnte. Das hat ihn nie mehr losgelassen. Sein Leben lang hat er diesen Kompass als einen Wendepunkt beschrieben. Mitgenommen hat er daraus keine Antwort, sondern eine Gewohnheit: bei einer ganz gewöhnlichen Sache nachfragen, bei der sonst niemand nachfragt. Alles, wofür er berühmt ist, hat so angefangen.',
        },
        {
          h2: 'Woran hat Einstein dreißig Jahre lang gearbeitet?',
          seedId: 11,
          body:
            'An einer einzigen Frage, und er hat sie nie beantwortet. Einstein war überzeugt, dass die Kräfte der Natur Teile einer einzigen Sache sind, und er suchte eine Theorie, die alle zusammenhält. Raum und Zeit hatte er schon zusammengebracht, Masse und Energie auch. Die Idee war also nicht abwegig. In Princeton arbeitete er bis zu seinem Tod 1955 daran, und er wurde dabei immer einsamer. Die Physik war längst woanders. Er machte trotzdem weiter. Genau das ist das Bemerkenswerte an ihm. Er hielt dreißig Jahre lang eine Frage offen, die er vielleicht nie schließen würde.',
        },
        {
          h2: 'Hat Einstein die Atombombe gebaut?',
          seedId: 10,
          body:
            'Gebaut hat er sie nicht. Unterschrieben hat er. Am 2. August 1939 setzte er seinen Namen unter einen Brief an Präsident Roosevelt, den der Physiker Leo Szilard aufgesetzt hatte. Der Brief drängte die USA, bei der Atomforschung zu handeln. Einstein war Pazifist. Er unterschrieb, weil er Angst hatte, Nazi-Deutschland könnte zuerst da sein. Seine eigene Gleichung, E=mc², gehört zu den Gründen, warum eine solche Waffe überhaupt möglich war. Danach setzte er sich wieder für Abrüstung ein. Am 11. April 1955, eine Woche vor seinem Tod, sagte er zu, einen öffentlichen Aufruf gegen den Atomkrieg zu unterzeichnen.',
        },
      ],
      ideaQuestion: 'Alle wollen sofort eine Antwort von mir. Wie halte ich die Frage offen?',
      works: [
        {
          title: 'Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt (1905)',
          note: 'Die Arbeit zum photoelektrischen Effekt. Licht verhält sich hier wie ein Strom kleiner Energiepakete, nicht nur wie eine Welle.',
        },
        {
          title: 'Zur Elektrodynamik bewegter Körper (1905)',
          note: 'Die spezielle Relativitätstheorie. Zwei Menschen, die sich unterschiedlich bewegen, können sich über die Gleichzeitigkeit uneinig sein, und keiner irrt sich.',
        },
        {
          title: 'Ist die Trägheit eines Körpers von seinem Energieinhalt abhängig? (1905)',
          note: 'Drei Seiten, eingegangen am 27. September 1905. Masse und Energie sind dasselbe, und mehr sagt E=mc² nicht.',
        },
      ],
    },
  },
};
