import type { FigureFragment } from './types';

// gautama: voice-passed QA + authored page content, both languages.
// The name-spelling line in the first concept block carries the variants
// people actually type. The oral-transmission caveat stays in every language.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Siddhartha Gautama, the Buddha?',
          a: "Siddhartha Gautama, the Buddha, lived in India around the fifth century BCE. He was a Śākya noble who left a palace, a wife and a newborn son to find the end of suffering, and he nearly starved himself trying. Then he remembered a quiet moment from childhood under a tree and stopped punishing his body. The way out was neither having everything nor having nothing. From him you learn to watch wanting rise and fade.",
        },
        {
          q: 'What did Siddhartha Gautama teach?',
          a: "Siddhartha Gautama taught the Four Noble Truths, and they are laid out like a doctor's notes. First the diagnosis. Suffering runs through ordinary experience. Then the cause. Craving, in three forms, for pleasure, for existing, for not existing. Then the good news. It can actually stop. Then the treatment. The Noble Eightfold Path, eight parts of a life that grow together and cover how you behave, how you steady the mind, and what you understand. He set this out in his first talk, the Dhammacakkappavattana Sutta, and by tradition he went on teaching it for forty-five years.",
        },
        {
          q: 'What is dependent origination?',
          a: "Dependent origination is the Buddha's answer to where things come from. Nothing in your experience shows up on its own. Everything arrives because conditions came together. Think of water in a pot. It depends on snow in the mountains, on clouds that gathered somewhere else, on the hands that carried it. Take one condition away and it is not there. He looked at suffering the same way and traced it through twelve links, from not seeing clearly all the way to the pain, and back out again. The useful part is where the chain is thinnest. Between a feeling and the craving that follows it there is a gap, and that gap is where you can act.",
        },
      ],
      disclosure: {
        q: 'Is this really Siddhartha Gautama speaking?',
        a: "No. This is an Echo of Siddhartha Gautama. It is an AI voice built from the recorded teachings, and it stays an interpretation, not a recording. No recording of him exists. Everything we have about him was carried by mouth and written down centuries after his death. Use it as a way into the ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Siddhartha Gautama (Buddha) lernen?',
          a: "Siddhartha Gautama, der Buddha, lebte um das 5. Jahrhundert v. Chr. in Indien. Als Adliger der Śākya verließ er einen Palast, eine Frau und einen neugeborenen Sohn, um das Ende des Leidens zu finden. Dabei hungerte er sich fast zu Tode. Dann erinnerte er sich an einen stillen Moment seiner Kindheit unter einem Baum und hörte auf, sich zu quälen. Der Weg lag weder im Alles-Haben noch im Nichts-Haben. Von ihm lernst du, dem Verlangen beim Kommen und Gehen zuzusehen.",
        },
        {
          q: 'Was hat Siddhartha Gautama gelehrt?',
          a: "Siddhartha Gautama lehrte die Vier Edlen Wahrheiten, und sie sind aufgebaut wie ein ärztlicher Befund. Zuerst die Diagnose. Leiden zieht sich durch das gewöhnliche Erleben. Dann die Ursache. Das Begehren, in drei Formen, nach Vergnügen, nach Dasein, nach Nicht-Dasein. Dann die gute Nachricht. Es kann tatsächlich aufhören. Und dann die Behandlung. Der Edle Achtfache Pfad, acht Teile eines Lebens, die zusammen wachsen und Ethik, geistige Sammlung und Weisheit umfassen. Er legte das in seiner ersten Lehrrede dar, dem Dhammacakkappavattana Sutta, und lehrte es der Überlieferung nach fünfundvierzig Jahre lang.",
        },
        {
          q: 'Was ist die bedingte Entstehung?',
          a: "Die bedingte Entstehung ist die Antwort des Buddha auf die Frage, woher die Dinge kommen. Nichts in deinem Erleben taucht für sich allein auf. Alles kommt zustande, weil Bedingungen zusammenkommen. Denk an Wasser in einem Krug. Es hängt vom Schnee der Berge ab, von Wolken, die sich woanders gesammelt haben, von den Händen, die es getragen haben. Nimm eine Bedingung weg, und es ist nicht da. Das Leiden betrachtete er genauso und verfolgte es über zwölf Glieder, vom nicht klaren Sehen bis zum Schmerz und wieder hinaus. Nützlich ist die Stelle, an der die Kette am dünnsten ist. Zwischen einem Gefühl und dem Verlangen danach liegt eine Lücke, und in dieser Lücke kannst du handeln.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Siddhartha Gautama (Buddha)?',
        a: "Nein. Das hier ist ein Echo von Siddhartha Gautama. Es ist eine KI-Stimme, gebaut aus den überlieferten Lehren, und sie bleibt eine Deutung, keine Aufnahme. Aufnahmen von ihm gibt es nicht. Alles, was wir über ihn haben, wurde mündlich weitergegeben und erst Jahrhunderte nach seinem Tod aufgeschrieben. Nimm es als Weg in die Gedanken, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Who was Siddhartha Gautama?',
          body:
            "Siddhartha Gautama is the man who became the Buddha. You will also see the name written Siddhartha, Siddhārtha, Siddharta, Gotama or Gautama Buddha. Tradition dates him to 563 to 483 BCE, though many scholars now place him later. He grew up in a Śākya noble family around the royal court at Kapilavastu. By tradition he left home at twenty-nine and searched for six years, part of it by starving himself. After his awakening under the Bodhi tree he taught for about forty-five years, and he died at Kusinārā, in a grove of sāla trees, at eighty. One honest caveat belongs here. Everything we know about him came down by mouth and was written centuries after his death.",
        },
        {
          h2: 'What are the Four Noble Truths?',
          seedId: 2,
          body:
            "They are his first teaching and the frame everything else hangs on. One. Suffering runs through ordinary life. Not only the obvious kinds, also the low ache of getting what you wanted and needing the next thing by evening. Two. The cause is craving, in three forms. Wanting pleasure, wanting to keep existing, wanting to stop existing. Three. It can end, and the ending is not a mood, it is complete. Four. There is a path, and it is practical. The shape is medical on purpose. Diagnosis, cause, prognosis, treatment. He is not asking you to believe it. He is asking you to test it.",
        },
        {
          h2: 'What is the Noble Eightfold Path?',
          seedId: 3,
          body:
            "The eight parts are the treatment named in the fourth truth. They fall into three groups. How you behave, how you steady the mind, and what you understand. The old words for those are ethics, concentration and wisdom. The eight are not steps. You do not finish one and move on, they grow together, and weakness in one shows up in the others. It is also called the Middle Way, because it walks between two dead ends the Buddha had already tried himself. A life of having everything, and a life of punishing the body. Neither one ended the wanting.",
        },
      ],
      ideaQuestion: 'I cannot sit still with myself for ten minutes. What is going on in there?',
      works: [
        {
          title: 'Dhammacakkappavattana Sutta (SN 56.11)',
          note: 'Setting the Wheel of Dhamma in Motion, his first talk. The Four Noble Truths in their shortest form. Start here.',
        },
        {
          title: 'Anattalakkhaṇa Sutta (SN 22.59)',
          note: 'The second talk, on non-self. He takes experience apart piece by piece and asks of each piece whether it is really you.',
        },
        {
          title: 'Satipaṭṭhāna Sutta (MN 10)',
          note: 'The Foundations of Mindfulness, the most detailed instructions he left. Body, feelings, mind and the objects of mind, one at a time.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Wer war Siddhartha Gautama?',
          body:
            "Siddhartha Gautama ist der Mensch, der zum Buddha wurde. Der Name wird auch Siddhartha, Siddhārtha, Siddharta, Gotama oder Gautama Buddha geschrieben. Die Überlieferung setzt sein Leben auf 563 bis 483 v. Chr. an, viele Fachleute datieren ihn heute später. Er wuchs als Adliger der Śākya am Königshof von Kapilavastu auf. Der Überlieferung nach verließ er mit neunundzwanzig sein Zuhause und suchte sechs Jahre lang, einen Teil davon mit strengem Fasten. Nach seinem Erwachen unter dem Bodhi-Baum lehrte er etwa fünfundvierzig Jahre. Er starb mit achtzig in Kusinārā, in einem Hain aus Sāla-Bäumen. Ein ehrlicher Hinweis gehört dazu. Alles, was wir wissen, wurde mündlich weitergegeben und erst Jahrhunderte nach seinem Tod aufgeschrieben.",
        },
        {
          h2: 'Die vier edlen Wahrheiten einfach erklärt',
          seedId: 2,
          body:
            "Sie sind seine erste Lehre und der Rahmen für alles Weitere. Erstens. Leiden zieht sich durch das gewöhnliche Leben. Nicht nur das offensichtliche, auch das leise Ziehen, wenn du bekommst, was du wolltest, und am Abend schon das Nächste brauchst. Zweitens. Die Ursache ist das Begehren, in drei Formen. Vergnügen wollen, weiter dasein wollen, nicht mehr dasein wollen. Drittens. Es kann aufhören, und dieses Aufhören ist keine Stimmung, sondern vollständig. Viertens. Es gibt einen Weg, und er ist praktisch. Der Aufbau folgt bewusst der Medizin. Diagnose, Ursache, Prognose, Behandlung. Er verlangt nicht, dass du das glaubst. Er verlangt, dass du es prüfst.",
        },
        {
          h2: 'Was ist der edle achtfache Pfad?',
          seedId: 3,
          body:
            "Die acht Teile sind die Behandlung aus der vierten Wahrheit. Sie fallen in drei Gruppen. Wie du dich verhältst, wie du den Geist beruhigst, und was du verstehst. Die alten Wörter dafür sind Ethik, Sammlung und Weisheit. Die acht sind keine Stufen. Du hakst nicht eine ab und gehst weiter, sie wachsen gemeinsam, und eine Schwäche in einem Teil zeigt sich in den anderen. Der Weg heißt auch der Mittlere Weg, weil er zwischen zwei Sackgassen verläuft, die der Buddha selbst ausprobiert hatte. Ein Leben mit allem, und ein Leben, das den Körper bestraft. Keines von beiden beendete das Verlangen.",
        },
      ],
      ideaQuestion: 'Ich halte es keine zehn Minuten still mit mir aus. Was passiert da?',
      works: [
        {
          title: 'Dhammacakkappavattana Sutta (SN 56.11)',
          note: 'Seine erste Lehrrede, das Ingangsetzen des Rades der Lehre. Die Vier Edlen Wahrheiten in ihrer kürzesten Form. Fang hier an.',
        },
        {
          title: 'Anattalakkhaṇa Sutta (SN 22.59)',
          note: 'Die zweite Lehrrede, über das Nicht-Selbst. Er zerlegt die Erfahrung Stück für Stück und fragt bei jedem Stück, ob es wirklich du bist.',
        },
        {
          title: 'Satipaṭṭhāna Sutta (MN 10)',
          note: 'Die Vier Grundlagen der Achtsamkeit, die ausführlichste Anleitung, die er hinterlassen hat. Körper, Gefühle, Geist und geistige Objekte, eines nach dem anderen.',
        },
      ],
    },
  },
};
