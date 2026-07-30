import type { FigureFragment } from './types';

// nietzsche: voice-passed QA plus authored page content. The German concepts
// carry the two evidenced queries, self-overcoming and the einfach-erklärt
// summary, so the DE side is written in German rather than translated.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Friedrich Nietzsche?',
          a: "Friedrich Nietzsche (1844-1900) was a pastor's son who lost his faith to honesty itself. He did not despair over it. He asked the harder question instead. If the old certainties are gone, what can a person build in their place? He spent his life on that one question, in pain and mostly alone. With Nietzsche, you learn to make your own meaning.",
        },
        {
          q: 'What did Friedrich Nietzsche teach?',
          a: 'Friedrich Nietzsche taught that you have to overcome yourself. Not once, but again and again. Self-overcoming means treating what you already are as a step, not a finish line. The will to power is his name for the force in every living thing that pushes against resistance and grows. Amor fati is love of your own fate, wanting nothing about your life to have gone differently. His method was genealogy. He dug under every moral rule to ask where it came from and who needed it. You can read him in The Birth of Tragedy (1872), Human, All Too Human (1878), and The Gay Science (1882).',
        },
        {
          q: 'What is the will to power in Nietzsche?',
          a: 'The will to power is not politics. Picture a pine tree on an Alpine slope, its roots splitting granite over decades. It is not conquering the rock. It is growing, becoming more of what it is. That is what Nietzsche means. Every living thing pushes against resistance and reaches further, and he saw the same force at work in art, in thinking, in love, in any real becoming.',
        },
      ],
      disclosure: {
        q: 'Is this really Friedrich Nietzsche speaking?',
        a: 'No. This is an Echo of Friedrich Nietzsche. It is an AI voice built from what he actually wrote, and it stays an interpretation, not a recording. The real man lived from 1844 to 1900 and no audio of him exists. Use it as a way into his ideas, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Friedrich Nietzsche lernen?',
          a: 'Friedrich Nietzsche (1844-1900) war ein Pfarrerssohn, der seinen Glauben durch die Ehrlichkeit selbst verlor. Er hat daran nicht verzweifelt. Er hat die schwerere Frage gestellt. Wenn die alten Gewissheiten weg sind, was kann ein Mensch an ihre Stelle setzen? Mit dieser einen Frage verbrachte er sein Leben, unter Schmerzen und meist allein. Bei Nietzsche lernst du, dir deinen eigenen Sinn zu bauen.',
        },
        {
          q: 'Was hat Friedrich Nietzsche gelehrt?',
          a: 'Friedrich Nietzsche lehrte, dass du dich selbst überwinden musst. Nicht einmal, sondern immer wieder. Selbstüberwindung heißt: Was du schon bist, ist eine Stufe und kein Ziel. Der Wille zur Macht ist sein Name für die Kraft in allem Lebendigen, die Widerstand überwindet und weiter will. Amor fati ist die Liebe zum eigenen Schicksal, der Wunsch, dass nichts anders gelaufen wäre. Seine Methode war die Genealogie. Er grub unter jeder Moral nach, woher sie kommt und wer sie gebraucht hat. Lesen kannst du ihn in Die Geburt der Tragödie (1872), Menschliches, Allzumenschliches (1878) und Die fröhliche Wissenschaft (1882).',
        },
        {
          q: 'Was ist der Wille zur Macht bei Nietzsche?',
          a: 'Der Wille zur Macht meint keine Politik. Stell dir eine Kiefer an einem Alpenhang vor, deren Wurzeln über Jahrzehnte den Granit sprengen. Sie besiegt den Stein nicht. Sie wächst, sie wird mehr von dem, was sie ist. Genau das meint Nietzsche. Alles Lebendige drängt gegen Widerstand und greift weiter aus, und dieselbe Kraft sah er in der Kunst, im Denken, in der Liebe und in jedem echten Werden.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Friedrich Nietzsche?',
        a: 'Nein. Das hier ist ein Echo von Friedrich Nietzsche. Es ist eine KI-Stimme, gebaut aus dem, was er wirklich geschrieben hat, und sie bleibt eine Deutung, keine Aufnahme. Der echte Mensch lebte von 1844 bis 1900, und es gibt keine Tonaufnahme von ihm. Nimm es als Weg in seine Ideen, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What is self-overcoming in Nietzsche?',
          seedId: 10,
          body:
            "Self-overcoming means you are not finished. What you are today is a step, not a destination. In Thus Spoke Zarathustra, Nietzsche lets life itself speak, in the chapter On Self-Overcoming, and life says it is the thing that must always overcome itself. That is meant to be hard. Something has to go so that something else can grow. A comfortable habit. A pride in something that happened long ago. A role that fitted you once. He is not describing a contest with other people. The only opponent is the shape you currently hold.",
        },
        {
          h2: "What did Nietzsche mean by 'God is dead'?",
          seedId: 3,
          body:
            "Nietzsche was not announcing that religion had ended. He was naming a collapse. Every absolute foundation European culture leaned on had given way, and the ground under right and wrong went with it. The strange part is who he blames. Christianity taught people to want the truth above everything, and that same demand for truth eventually turned on Christianity's own claims. The line first appears in The Gay Science (1882), spoken by a madman running through the market with a lantern in broad daylight. Nietzsche thought most people had not yet grasped what had happened.",
        },
      ],
      ideaQuestion: 'If I had to live this exact life again, forever, could I say yes?',
      works: [
        {
          title: 'The Birth of Tragedy (1872)',
          note: 'His first book, on Greek tragedy, published while he was a young professor in Basel. Attendance at his lectures dropped sharply after it came out.',
        },
        {
          title: 'Human, All Too Human (1878)',
          note: 'The book in which the break with Wagner became final. Short numbered pieces instead of long argument, and a cooler, more suspicious tone.',
        },
        {
          title: 'The Gay Science (1882)',
          note: 'Where the madman runs through the market with his lantern crying that God is dead. It is also where amor fati first appears in print.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was heißt Selbstüberwindung bei Nietzsche?',
          seedId: 10,
          body:
            'Selbstüberwindung heißt bei Nietzsche vor allem eines: Du bist nicht fertig. Was du heute bist, ist eine Stufe und kein Ziel. In Also sprach Zarathustra lässt er das Leben selbst sprechen, im Kapitel Von der Selbst-Überwindung. Das Leben sagt dort, es sei das, was sich immer selbst überwinden muss. Das klingt hart, und es ist auch hart gemeint. Etwas muss weggehen, damit etwas anderes wachsen kann. Eine bequeme Gewohnheit. Ein Stolz auf etwas, das lange her ist. Eine Rolle, die dir mal gepasst hat. Gemeint ist kein Wettkampf mit anderen. Der einzige Gegner ist die Form, die du gerade hast.',
        },
        {
          h2: 'Friedrich Nietzsche einfach erklärt',
          body:
            'Nietzsche war ein Pfarrerssohn, der sich mit fast allem angelegt hat, was seine Zeit für sicher hielt. Vier Gedanken reichen für den Anfang. Erstens: Gott ist tot. Damit meint er nicht nur den Rückgang des Glaubens, sondern dass alle festen Fundamente weggebrochen sind. Zweitens: Perspektivismus. Es gibt keinen Blick von nirgendwo, jedes Wissen kommt aus einem Standpunkt. Drittens: Genealogie. Er fragt bei jeder Moral, woher sie kommt und wer sie gebraucht hat. Viertens: Selbstüberwindung. Wenn keine Ordnung mehr von außen kommt, musst du deine Werte selbst schaffen, immer wieder. Nietzsche gibt dir keine Antwort zum Mitnehmen. Er gibt dir die Frage zurück.',
        },
      ],
      ideaQuestion: 'Müsste ich genau dieses Leben noch einmal leben, für immer, könnte ich Ja sagen?',
      works: [
        {
          title: 'Die Geburt der Tragödie (1872)',
          note: 'Sein erstes Buch, über die griechische Tragödie, erschienen, als er junger Professor in Basel war. Danach brachen ihm die Hörerzahlen ein.',
        },
        {
          title: 'Menschliches, Allzumenschliches (1878)',
          note: 'Hier wird der Bruch mit Wagner endgültig. Statt langer Argumentation stehen kurze nummerierte Stücke, und der Ton wird kühler und misstrauischer.',
        },
        {
          title: 'Die fröhliche Wissenschaft (1882)',
          note: 'Das Buch, in dem ein Verrückter mit der Laterne über den Markt läuft und ruft, Gott sei tot. Hier steht auch amor fati zum ersten Mal gedruckt.',
        },
      ],
    },
  },
};
