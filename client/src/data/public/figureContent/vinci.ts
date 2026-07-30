import type { FigureFragment } from './types';

// vinci: voice-passed QA plus the authored page blocks. Saper vedere moves out
// of the QA and into its own section so the heading carries the term, and the
// Richter quote is used in the documented wording or not at all.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Leonardo da Vinci?',
          a: "Leonardo da Vinci (1452-1519) was a painter who kept taking the world apart to see how it worked. He cut open bodies, followed water through canal locks, and spread a dead bird's wing to compare its bones with his own arm. About 7,000 pages of his notes survive. He thought clear seeing was not a gift you are born with but a skill you train.",
        },
        {
          q: 'What did Leonardo da Vinci teach?',
          a: 'Leonardo da Vinci taught that nature is the better teacher, and that she gives up her methods to anyone patient enough to watch. He looked past the surface of a thing for the rule underneath, then went looking for that same rule somewhere else. The spiral in curling hair turned up in moving water and in a shell. The branching of a river turned up in a lung and in a tree. He also warned about the opposite mistake, the doing without the understanding. Skill with no idea of why it works will carry you only so far.',
        },
        {
          q: "What is in Leonardo da Vinci's notebooks?",
          a: 'About 7,000 pages survive. Anatomy, moving water, machines, plants, rock layers in the Alps, and thousands of questions that start with why and how. He wrote most of it in mirror script, right to left, with his left hand. None of it was published while he lived. His pupil Francesco Melzi inherited the papers, and the treatise on painting was assembled out of them after he died.',
        },
      ],
      disclosure: {
        q: 'Is this really Leonardo da Vinci speaking?',
        a: 'No. This is an Echo of Leonardo da Vinci. It is an AI voice built from his documented notebooks and works, and it stays an interpretation, not a recording. He lived from 1452 to 1519, and no recording of him exists. Use it as a way into how he thought, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Leonardo da Vinci lernen?',
          a: 'Leonardo da Vinci (1452-1519) war ein Maler, der die Welt immer wieder auseinandernahm, um zu sehen, wie sie funktioniert. Er sezierte Körper, verfolgte Wasser durch Kanalschleusen und spannte den Flügel eines toten Vogels auf, um dessen Knochen mit seinem eigenen Arm zu vergleichen. Rund 7.000 Seiten seiner Notizen sind erhalten. Klar zu sehen war für ihn keine Gabe, mit der man geboren wird, sondern eine Fähigkeit, die man übt.',
        },
        {
          q: 'Was hat Leonardo da Vinci gelehrt?',
          a: 'Leonardo da Vinci lehrte, dass die Natur die bessere Lehrerin ist und dass sie ihre Verfahren jedem zeigt, der geduldig genug hinsieht. Er schaute hinter die Oberfläche einer Sache, suchte die Regel darunter und suchte dieselbe Regel dann woanders wieder. Die Spirale einer Locke fand er im fließenden Wasser und in einer Muschel. Die Verästelung eines Flusses fand er in einer Lunge und in einem Baum. Er warnte auch vor dem umgekehrten Fehler, dem Tun ohne Verstehen. Können ohne eine Ahnung davon, warum es funktioniert, trägt nur ein Stück weit.',
        },
        {
          q: 'Was steht in Leonardo da Vincis Notizbüchern?',
          a: 'Rund 7.000 Seiten sind erhalten. Anatomie, fließendes Wasser, Maschinen, Pflanzen, Gesteinsschichten in den Alpen und tausende Fragen, die mit Warum und Wie beginnen. Das meiste schrieb er in Spiegelschrift, von rechts nach links, mit der linken Hand. Zu seinen Lebzeiten wurde nichts davon veröffentlicht. Sein Schüler Francesco Melzi erbte die Blätter, und der Traktat über die Malerei wurde nach seinem Tod daraus zusammengestellt.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Leonardo da Vinci?',
        a: 'Nein. Das hier ist ein Echo von Leonardo da Vinci. Es ist eine KI-Stimme, gebaut aus seinen überlieferten Notizbüchern und Werken, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von 1452 bis 1519, und es gibt keine Aufnahme von ihm. Nimm es als Weg zu seinem Denken, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What does saper vedere mean?',
          seedId: 2,
          body:
            "Saper vedere is Italian for knowing how to see, and Leonardo meant a skill, not a talent. Picture a white cloth draped over clay. You draw the shadow gray, because you know shadows are gray. Then someone tells you to look again, and the shadow is blue. The gap between what is there and what you assumed is the whole practice. He trained it in Verrocchio's workshop from about 1466, drawing folds of cloth on prepared linen, and he never stopped training it. The method is simple to say and hard to do: separate what you actually see from what you expect to see, and record only the first.",
        },
        {
          h2: "Where did Leonardo's curiosity come from?",
          seedId: 1,
          body:
            'He once described standing at the mouth of a cave, pulled two ways at the same time. Fear of the dark inside. And the wish to know whether something wonderful was in there. He wrote that down himself, in the Codex Arundel. The wish won, and that is the shape of the rest of his life. His notebooks hold more questions than answers, thousands of them, running from how water turns inside a lock to how a heart valve closes. Curiosity was never a mood for him. It was a method, and he pointed it at anatomy, optics, geology, plants, and machines with the same attention.',
        },
        {
          h2: 'Why did Leonardo leave so much unfinished?',
          seedId: 8,
          body:
            "Because everything he touched opened into something else. He dissected bodies in a Rome hospital and drew them in layers, using the exploded views he had borrowed from engineering. He traced water through a Milan lock with colored dye. The same vortices came back in his work on the aortic valve, where he built a glass model and dropped in grass seeds to watch the flow. He called that one investigation, not scattered interests. He also wrote that 'practice without knowledge is like a ship without rudder or compass.' Judged by finished paintings he looks like a man who could not commit. Judged by the notebooks he looks like a man working one problem for forty years.",
        },
      ],
      ideaQuestion: 'I look at things all day and still miss them. How do I learn to really see?',
      works: [
        {
          title: 'Notebooks',
          note: 'About 7,000 manuscript pages survive, written between roughly 1478 and 1519, most of it in mirror script from right to left.',
        },
        {
          title: 'Virgin of the Rocks (c. 1483-1486)',
          note: 'Painted in Milan in the years after he arrived there. Look at the rocks and the plants, not only at the faces.',
        },
        {
          title: 'The Last Supper (1495-1498)',
          note: 'Painted on the refectory wall of Santa Maria delle Grazie in Milan. The twelve apostles are arranged in four groups of three.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was bedeutet saper vedere?',
          seedId: 2,
          body:
            'Saper vedere heißt auf Italienisch sehen können, und Leonardo meinte damit eine Fähigkeit, keine Begabung. Stell dir ein weißes Tuch über einem Klumpen Ton vor. Du zeichnest den Schatten grau, weil du weißt, dass Schatten grau sind. Dann sagt dir jemand, du sollst noch einmal hinsehen, und der Schatten ist blau. Genau dieser Abstand zwischen dem, was da ist, und dem, was du annimmst, ist die ganze Übung. Gelernt hat er sie ab etwa 1466 in Verrocchios Werkstatt, beim Zeichnen von Stofffalten auf grundiertem Leinen, und er hörte nie damit auf. Die Regel ist leicht gesagt und schwer getan: Trenne das Gesehene vom Erwarteten und halte nur das Erste fest.',
        },
        {
          h2: 'Woher kam Leonardos Neugier?',
          seedId: 1,
          body:
            'Er hat einmal beschrieben, wie er vor dem Eingang einer Höhle stand und in zwei Richtungen gezogen wurde. Angst vor dem Dunkel darin. Und der Wunsch zu wissen, ob dort drinnen etwas Wunderbares ist. Das hat er selbst aufgeschrieben, im Codex Arundel. Der Wunsch hat gewonnen, und so sieht sein ganzes Leben aus. In seinen Notizbüchern stehen mehr Fragen als Antworten, tausende davon, von der Frage, wie sich Wasser in einer Schleuse dreht, bis zu der Frage, wie eine Herzklappe schließt. Neugier war bei ihm nie eine Stimmung. Sie war eine Methode, und er richtete sie mit derselben Genauigkeit auf Anatomie, Optik, Geologie, Pflanzen und Maschinen.',
        },
        {
          h2: 'Leonardo da Vinci einfach erklärt',
          body:
            'Leonardo war Maler, Ingenieur und Naturforscher in einer Person, und für ihn war das kein Widerspruch. Er hatte eine Grundüberzeugung: Wer genau hinsieht, findet unter der Oberfläche eine Regel, und dieselbe Regel gilt oft auch woanders. Deshalb sezierte er Körper, um die Hand zu verstehen, und verfolgte Wasserwirbel in Kanälen, um das Herz zu verstehen. Sein Wissen sammelte er nicht, er verband es. Aufgeschrieben hat er alles in Notizbüchern, rund 7.000 Seiten, in Spiegelschrift von rechts nach links. Veröffentlicht hat er davon nichts. Wer heute von ihm lernen will, lernt vor allem eines: hinsehen, bevor man urteilt.',
        },
      ],
      ideaQuestion: 'Ich schaue den ganzen Tag hin und sehe trotzdem nichts. Wie lernt man sehen?',
      works: [
        {
          title: 'Notizbücher',
          note: 'Rund 7.000 Seiten sind erhalten, entstanden zwischen etwa 1478 und 1519, das meiste in Spiegelschrift von rechts nach links.',
        },
        {
          title: 'Felsgrottenmadonna (um 1483-1486)',
          note: 'Gemalt in Mailand, in den Jahren nach seiner Ankunft dort. Schau auf die Felsen und die Pflanzen, nicht nur auf die Gesichter.',
        },
        {
          title: 'Das Abendmahl (1495-1498)',
          note: 'Gemalt auf die Wand des Speisesaals von Santa Maria delle Grazie in Mailand. Die zwölf Apostel stehen in vier Dreiergruppen.',
        },
      ],
    },
  },
};
