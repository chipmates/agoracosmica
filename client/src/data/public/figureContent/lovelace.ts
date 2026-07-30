import type { FigureFragment } from './types';

// lovelace: voice-passed QA plus the authored page blocks. Her 1843 Notes are
// public domain, so the origination sentence and the music sentence are quoted
// verbatim and attributed rather than paraphrased.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Ada Lovelace?',
          a: 'Ada Lovelace (1815-1852) looked at a machine built for arithmetic and saw what its design really implied. Not a faster calculator. An engine that could work on anything you can write down in symbols, music included. In 1843 she published her notes on it, and one of them sets out a step-by-step method the machine could run on its own. With her you learn to see what a thing could become.',
        },
        {
          q: 'What did Ada Lovelace teach?',
          a: "Ada Lovelace, the mathematician usually called the first programmer, taught that a computing machine works on symbols and operations, not on numbers as such. Change what the symbols stand for and the same machine does something else entirely. She wrote it down in her Notes on the Analytical Engine, published in Taylor's Scientific Memoirs in 1843, with the Bernoulli method in Note G. She also taught the limit. The machine, she wrote, 'has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.'",
        },
        {
          q: 'What is poetical science?',
          a: "Poetical science was Ada Lovelace's own name for how she worked. She refused the choice between the artistic and the analytical and used both on the same problem. Imagination shows you what might be there. Analysis then decides whether it can actually be so. It came out of her own life. Her father was the poet Lord Byron, her mother had her taught mathematics, and she put the two halves to work together instead of picking a side.",
        },
      ],
      disclosure: {
        q: 'Is this really Ada Lovelace speaking?',
        a: 'No. This is an Echo of Ada Lovelace. It is an AI voice built from her documented writing, above all the 1843 Notes, and it stays an interpretation, not a recording. She lived from 1815 to 1852, and no recording of her exists. Use it as a way into her ideas, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Ada Lovelace lernen?',
          a: 'Ada Lovelace (1815-1852) sah eine Maschine, die zum Rechnen gebaut war, und erkannte, was ihr Bauplan eigentlich bedeutet. Keinen schnelleren Rechner. Eine Maschine, die mit allem arbeiten kann, was sich in Zeichen aufschreiben lässt, Musik eingeschlossen. 1843 veröffentlichte sie ihre Anmerkungen dazu, und eine davon beschreibt Schritt für Schritt ein Verfahren, das die Maschine allein ausführen könnte. Bei ihr lernst du zu sehen, was etwas werden könnte.',
        },
        {
          q: 'Was hat Ada Lovelace gelehrt?',
          a: "Ada Lovelace, die Mathematikerin, die meist die erste Programmiererin genannt wird, lehrte, dass eine Rechenmaschine mit Zeichen und Operationen arbeitet und nicht mit Zahlen im eigentlichen Sinn. Ändere, wofür die Zeichen stehen, und dieselbe Maschine tut etwas völlig anderes. Aufgeschrieben hat sie das 1843 in ihren Anmerkungen zur Analytischen Maschine, erschienen in Taylor's Scientific Memoirs, mit dem Bernoulli-Verfahren in Anmerkung G. Sie lehrte auch die Grenze. Die Maschine, schrieb sie, 'hat keinerlei Anspruch, irgendetwas zu erschaffen. Sie kann alles tun, was wir ihr zu leisten befehlen können.'",
        },
        {
          q: 'Was ist poetische Wissenschaft?',
          a: 'Poetische Wissenschaft war Ada Lovelaces eigener Name für ihre Arbeitsweise. Sie weigerte sich, zwischen dem Künstlerischen und dem Analytischen zu wählen, und setzte beides auf dasselbe Problem an. Die Vorstellungskraft zeigt dir, was möglich sein könnte. Die Analyse entscheidet dann, ob es so sein kann. Das kam aus ihrem eigenen Leben. Ihr Vater war der Dichter Lord Byron, ihre Mutter ließ sie in Mathematik unterrichten, und sie brachte beide Hälften zusammen, statt sich für eine zu entscheiden.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Ada Lovelace?',
        a: 'Nein. Das hier ist ein Echo von Ada Lovelace. Es ist eine KI-Stimme, gebaut aus ihren überlieferten Schriften, vor allem den Anmerkungen von 1843, und sie bleibt eine Deutung, keine Aufnahme. Sie lebte von 1815 bis 1852, und es gibt keine Aufnahme von ihr. Nimm es als Weg in ihre Ideen, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Why is Ada Lovelace called the first programmer?',
          seedId: 10,
          body:
            "Because of Note G. In 1843 she published seven notes alongside her translation of a paper on Babbage's Analytical Engine. The last one works out how that machine would calculate Bernoulli numbers. It is not a description of the idea. It is the sequence of operations itself, with tables tracking every variable. The machine could run the whole thing with nobody doing the math along the way. It is widely counted as the first published algorithm meant for a machine to execute. The title gets argued over, since she and Babbage worked closely and scholars still weigh who contributed what to the Notes.",
        },
        {
          h2: 'Can a machine create something of its own?',
          seedId: 12,
          body:
            "Ada Lovelace answered that in 1843. She wrote: 'The Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.' She was not talking the machine down. She had spent years arguing it was far more capable than its own supporters believed. She was drawing a line. The machine executes, exactly and without tiring. Deciding what is worth computing, and why, and what the answer means, stays on our side. She drew that line a century before the first computer ran. It is still the sharpest question to ask about any machine that looks like it is thinking.",
        },
        {
          h2: 'Did Ada Lovelace imagine computers doing more than sums?',
          seedId: 11,
          body:
            "Yes, and she wrote it down. She saw that the engine did not care what its numbers stood for. If the rules of some field could be set out formally, the machine could work on that field. Her example was music. If those relations could be set down formally, she wrote, the engine 'might compose elaborate and scientific pieces of music of any degree of complexity or extent.' That was 1843. She left the picture people still use for it too: 'the Analytical Engine weaves algebraical patterns just as the Jacquard-loom weaves flowers and leaves.'",
        },
      ],
      ideaQuestion: 'I was told to pick between the artistic and the analytical. Do I have to?',
      works: [
        {
          title: "Notes on the Analytical Engine, Notes A through G, published in Taylor's Scientific Memoirs (1843)",
          note: "Seven notes she added to somebody else's paper. Everything she is known for sits in them, and Note G is the last of the seven.",
        },
        {
          title: 'Algorithm for calculating Bernoulli numbers, Note G (1843)',
          note: 'The step-by-step method a machine could run on its own, tables and all. Usually called the first published computer program.',
        },
        {
          title: "Translation of Luigi Menabrea's Sketch of the Analytical Engine (1843)",
          note: 'The French account of the machine, published in October 1842, which she put into English. The notes grew out of the translating.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Warum gilt Ada Lovelace als die erste Programmiererin?',
          seedId: 10,
          body:
            'Wegen Anmerkung G. 1843 veröffentlichte sie sieben Anmerkungen zu ihrer Übersetzung eines Aufsatzes über Babbages Analytische Maschine, und die letzte rechnet durch, wie diese Maschine die Bernoulli-Zahlen berechnen würde. Das ist keine Beschreibung der Idee. Das ist die Folge der Operationen selbst, mit Tabellen für jede Variable, damit die Maschine alles allein durchlaufen kann, ohne dass unterwegs jemand rechnet. Sie gilt weithin als der erste veröffentlichte Algorithmus, der für eine Maschine gedacht war. Über den Titel wird gestritten, denn sie und Babbage arbeiteten eng zusammen, und die Forschung wägt bis heute ab, wer welchen Anteil an den Anmerkungen hatte.',
        },
        {
          h2: 'Kann eine Maschine etwas Eigenes hervorbringen?',
          seedId: 12,
          body:
            "Ada Lovelace hat das 1843 beantwortet. Sie schrieb: 'Die Analytische Maschine hat keinerlei Anspruch, irgendetwas zu erschaffen. Sie kann alles tun, was wir ihr zu leisten befehlen können.' Sie hat die Maschine damit nicht kleingeredet. Jahrelang hatte sie dafür gestritten, dass diese Maschine viel mehr kann, als selbst ihre Fürsprecher glaubten. Sie hat eine Grenze gezogen. Die Maschine führt aus, genau und ohne müde zu werden. Was sich zu berechnen lohnt, warum, und was das Ergebnis bedeutet, bleibt bei uns. Sie zog diese Grenze hundert Jahre vor dem ersten Computer, und sie ist noch immer die schärfste Frage an jede Maschine, die aussieht, als würde sie denken.",
        },
        {
          h2: 'Ada Lovelace einfach erklärt',
          body:
            'Ada Lovelace war Mathematikerin im viktorianischen England. Charles Babbage plante damals die Analytische Maschine, einen Rechner aus Messing, der nie fertig gebaut wurde. Lovelace übersetzte einen Aufsatz darüber und schrieb sieben eigene Anmerkungen dazu, die 1843 erschienen. Darin steht das Entscheidende. Erstens: Die Maschine rechnet nicht mit Zahlen, sie arbeitet mit Zeichen nach festen Regeln. Wenn du die Regeln eines Gebiets aufschreiben kannst, kann sie auch dieses Gebiet bearbeiten, zum Beispiel Musik. Zweitens: In Anmerkung G steht ein vollständiges Verfahren, das die Maschine allein ausführen könnte. Drittens: Sie hielt fest, dass die Maschine nichts von sich aus erschafft.',
        },
      ],
      ideaQuestion: 'Ich soll mich zwischen Kunst und Analyse entscheiden. Muss ich wirklich?',
      works: [
        {
          title: "Anmerkungen zur Analytischen Maschine, Anmerkungen A bis G, in Taylor's Scientific Memoirs (1843)",
          note: 'Sieben Anmerkungen zu einem fremden Aufsatz. Alles, wofür sie bekannt ist, steht darin, und Anmerkung G ist die letzte der sieben.',
        },
        {
          title: 'Verfahren zur Berechnung der Bernoulli-Zahlen, Anmerkung G (1843)',
          note: 'Das Verfahren, das die Maschine Schritt für Schritt allein ausführen könnte, mit allen Tabellen. Meist das erste Computerprogramm genannt.',
        },
        {
          title: 'Übersetzung von Luigi Menabreas Skizze der Analytischen Maschine (1843)',
          note: 'Der französische Bericht über die Maschine, erschienen im Oktober 1842. Sie hat ihn ins Englische gebracht, und aus dem Übersetzen wurden die Anmerkungen.',
        },
      ],
    },
  },
};
