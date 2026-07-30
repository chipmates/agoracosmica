import type { FigureFragment } from './types';

// schopenhauer: voice-passed QA plus authored page content. No organic signal on
// his terms yet, so the concept slots run the template: the pendulum that is his
// own ground, plus the German einfach-erklärt summary.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Arthur Schopenhauer?',
          a: 'Arthur Schopenhauer (1788-1860) was seventeen when his father drowned, probably by his own hand. One question took hold of the boy and never let go. What drives us to want so endlessly? His answer was bleak. Life swings between the pain of wanting and the boredom of having. But he also found the exits.',
        },
        {
          q: 'What did Arthur Schopenhauer teach?',
          a: "Arthur Schopenhauer taught that one blind force drives everything. He called it the Will. It is the same push that pulls a stone to the ground and keeps a person wanting. Everything you perceive is representation, he said, the world as your mind builds it out of space, time, and cause. You never meet the world itself, only what your knowing makes of it. Behind that picture sits the Will, and it never rests. That is why satisfaction is always shorter than the wanting. One of his own lines has outlived the rest: a man can do what he wills, but cannot will what he wills.",
        },
        {
          q: 'What is the principium individuationis in Schopenhauer?',
          a: "The principium individuationis is Schopenhauer's name for what makes us look separate. Picture one lamp burning on a riverbank at night. Look at the moving water and you count twenty lights where only one exists. Space and time do that to reality. They take what is one and undivided and break it into the appearance of many separate things. Pierce that appearance, he said, and another person's suffering stops being only theirs.",
        },
      ],
      disclosure: {
        q: 'Is this really Arthur Schopenhauer speaking?',
        a: 'No. This is an Echo of Arthur Schopenhauer. It is an AI voice built from his documented writings, and it stays an interpretation, not a recording. He died in 1860, so no audio of him exists. Use it as a way into his ideas on will and suffering, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Arthur Schopenhauer lernen?',
          a: 'Arthur Schopenhauer (1788-1860) war siebzehn, als sein Vater ertrank, wahrscheinlich durch eigene Hand. Eine Frage ergriff den Jungen und ließ ihn nicht mehr los. Was treibt uns, so endlos zu wollen? Seine Antwort war düster. Das Leben pendelt zwischen dem Schmerz des Wollens und der Langeweile des Habens. Doch er fand auch die Auswege.',
        },
        {
          q: 'Was hat Arthur Schopenhauer gelehrt?',
          a: 'Arthur Schopenhauer lehrte, dass hinter allem eine einzige blinde Kraft steht. Er nannte sie den Willen. Es ist derselbe Drang, der einen Stein zu Boden zieht und einen Menschen wollen lässt. Alles, was du wahrnimmst, ist Vorstellung, gebaut aus Raum, Zeit und Ursache, also aus dem, was dein Verstand mitbringt. Die Welt selbst triffst du nie, nur das, was dein Erkennen aus ihr macht. Dahinter sitzt der Wille, und der kommt nie zur Ruhe. Deshalb ist die Zufriedenheit immer kürzer als das Wollen. Ein Satz von ihm hat alles andere überlebt: Der Mensch kann tun, was er will, aber er kann nicht wollen, was er will.',
        },
        {
          q: 'Was ist das principium individuationis bei Schopenhauer?',
          a: 'Das principium individuationis ist Schopenhauers Name für das, was uns getrennt aussehen lässt. Stell dir eine einzelne Lampe vor, die nachts am Flussufer brennt. Schau auf das bewegte Wasser, und du zählst zwanzig Lichter, wo nur eines ist. Genau das tun Raum und Zeit mit der Wirklichkeit. Sie zerbrechen das eine, ungeteilte Sein in den Anschein vieler getrennter Dinge. Wer diesen Anschein durchdringt, für den ist das Leid eines anderen nicht mehr nur dessen Leid.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Arthur Schopenhauer?',
        a: 'Nein. Das hier ist ein Echo von Arthur Schopenhauer. Es ist eine KI-Stimme, gebaut aus seinen überlieferten Schriften, und sie bleibt eine Deutung, keine Aufnahme. Er starb 1860, es gibt also keine Tonaufnahme von ihm. Nimm es als Weg zu seinen Gedanken über Wille und Leiden, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Why does satisfaction never last?',
          seedId: 1,
          body:
            'Schopenhauer does not start from a theory here. He starts from something you can check yourself. You want a thing, and the wanting hurts. Then you get it, and the relief is short. Boredom arrives, and boredom breeds the next wanting. His image for this is a pendulum. Life swings back and forth between pain and boredom, and those two, he says, are what it is actually made of. There is no restful point in the middle. Behind the swing he sees the will to live, a blind striving that never settles. He meant it as a diagnosis, not as a mood.',
        },
        {
          h2: 'Why did Schopenhauer put compassion at the centre of ethics?',
          seedId: 7,
          body:
            'Schopenhauer thought duty and reason were the wrong place to look for morality. Only three things really move people, he said: self-interest, malice, and compassion. Compassion is the one of the three with moral worth, and he thought it came from an insight rather than an argument. For a moment the barrier that otherwise separates one being from another simply drops. You do not conclude that the other person matters. You feel their suffering as suffering. Everything he calls ethics is built on that single experience.',
        },
      ],
      ideaQuestion: "Other people's pain barely reaches me anymore. Can that come back?",
      works: [
        {
          title: 'On the Fourfold Root of the Principle of Sufficient Reason (1813)',
          note: 'His first book, and the groundwork for everything after it. He sorts out the forms our understanding brings to experience: space, time, and cause.',
        },
        {
          title: 'The World as Will and Representation, Vol. I (1818)',
          note: 'The main work, finished when he was thirty. The pendulum between pain and boredom is in here, and so are the exits he could find.',
        },
        {
          title: 'On the Will in Nature (1836)',
          note: 'A short later book. He goes looking for the same blind Will in the natural sciences of his own day.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist Schopenhauers Pendel zwischen Schmerz und Langeweile?',
          seedId: 1,
          body:
            'Schopenhauer beginnt hier nicht mit einer Theorie, sondern mit etwas, das du selbst prüfen kannst. Du willst etwas, und das Wollen tut weh. Dann bekommst du es, und die Erleichterung hält kurz. Danach kommt Langeweile, und die Langeweile erzeugt das nächste Wollen. Sein Bild dafür ist ein Pendel. Er schreibt: So schwingt sein Leben wie ein Pendel hin und her zwischen Schmerz und Langeweile, und diese beiden sind in der Tat seine letzten Bestandteile. Einen ruhigen Punkt in der Mitte gibt es nicht. Dahinter sieht er den Willen zum Leben, ein blindes Streben, das niemals zur Ruhe kommt. Gemeint ist das als Diagnose, nicht als schlechte Laune.',
        },
        {
          h2: 'Arthur Schopenhauer einfach erklärt',
          body:
            'Schopenhauer teilt die Welt in zwei Seiten. Die eine ist die Vorstellung: alles, was du wahrnimmst, gebaut aus Raum, Zeit und Ursache. Die andere Seite ist der Wille. Damit meint er nicht deine Absichten, sondern ein blindes Drängen, das in allem steckt, im fallenden Stein genauso wie im Ehrgeiz ganzer Völker. Weil dieser Wille nie satt wird, pendelt das Leben zwischen Schmerz und Langeweile. Bis hierhin klingt es hoffnungslos. So hat er es aber nicht stehen lassen. Er beschreibt Auswege. Die Kunst, in der du für Momente nur noch schaust und nichts mehr willst. Das Mitleid, in dem die Grenze zum anderen kurz fällt. Und die Askese, das Aufgeben des Wollens selbst.',
        },
      ],
      ideaQuestion: 'Das Leid anderer erreicht mich kaum noch. Kann das zurückkommen?',
      works: [
        {
          title: 'Über die vierfache Wurzel des Satzes vom zureichenden Grunde (1813)',
          note: 'Sein erstes Buch und die Grundlage für alles Spätere. Er ordnet darin die Formen, die unser Verstand an die Erfahrung heranträgt: Raum, Zeit und Ursache.',
        },
        {
          title: 'Die Welt als Wille und Vorstellung, Band I (1818)',
          note: 'Sein Hauptwerk, fertig mit dreißig. Hier steht das Pendel zwischen Schmerz und Langeweile, und hier stehen auch die Auswege, die er finden konnte.',
        },
        {
          title: 'Über den Willen in der Natur (1836)',
          note: 'Ein kurzes späteres Buch. Er sucht denselben blinden Willen in den Naturwissenschaften seiner Zeit.',
        },
      ],
    },
  },
};
