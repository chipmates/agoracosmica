import type { FigureFragment } from './types';

// eckhart: voice-passed QA + authored page content, both languages.
// The German set is the priority surface here, so it carries four concept
// blocks and is written from the German material, not from the English.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Meister Eckhart?',
          a: "Meister Eckhart (c. 1260-1328) was a German Dominican who preached in plain German at a time when God was discussed in Latin. He told ordinary people the most dangerous thing he knew. The deepest part of you and the deepest part of God are one ground. The Church put him on trial for it. With him you learn to stop clutching what you love.",
        },
        {
          q: 'What did Meister Eckhart teach?',
          a: "Meister Eckhart taught detachment, which he called Abgeschiedenheit, and he pushed it further than people expected. Let go of things. Then of the images in your head. Then of your spiritual wishes. Then, finally, of the will that reaches for God. What is left he calls the ground, the place where the bottom of the soul and the bottom of God turn out to be one bottom. He also taught the divine spark, something uncreated deep in you that damage cannot reach. And living without a why, which is action that comes out of what you are instead of out of what you expect to get for it.",
        },
        {
          q: 'What is the divine spark?',
          a: "The divine spark, Seelenfünklein in his German, is something in the soul that was never created. Eckhart says it shares God's own nature. It is not a skill you build up over years. It is a presence, and nothing gets at it. Sin does not damage it, time does not age it, failure does not shrink it and success does not enlarge it. That lands strangely if you grew up being told to earn your worth. His point is exactly that. The thing you have been trying to earn is already there, untouched, waiting for enough quiet to be noticed.",
        },
      ],
      disclosure: {
        q: 'Is this really Meister Eckhart speaking?',
        a: "No. This is an Echo of Meister Eckhart. It is an AI voice built from his sermons and writings, and it stays an interpretation, not a recording. He lived from about 1260 to 1328 and no recording of him exists. Use it as a way into his ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Meister Eckhart lernen?',
          a: "Meister Eckhart (um 1260-1328) war ein deutscher Dominikaner. Er predigte auf schlichtem Deutsch, in einer Zeit, in der über Gott nur auf Latein gesprochen wurde. Einfachen Leuten sagte er das Gefährlichste, was er wusste. Das Tiefste in dir und das Tiefste in Gott sind ein und derselbe Grund. Die Kirche stellte ihn dafür vor Gericht. Bei ihm lernst du, aufzuhören, das festzuhalten, was du liebst.",
        },
        {
          q: 'Was hat Meister Eckhart gelehrt?',
          a: "Meister Eckhart lehrte die Abgeschiedenheit, und er trieb sie weiter, als man erwartet. Lass die Dinge los. Dann die Bilder im Kopf. Dann die frommen Wünsche. Und zuletzt den eigenen Willen, der nach Gott greift. Was übrig bleibt, nennt er den Grund. Das ist die Stelle, an der der Boden der Seele und der Boden Gottes ein und derselbe Boden sind. Dazu kommt das Seelenfünklein, etwas Unerschaffenes in dir, an das kein Schaden herankommt. Und das Leben ohne Warum, ein Handeln, das aus dem kommt, was du bist, und nicht aus dem, was es dir einbringen soll.",
        },
        {
          q: 'Was ist das Seelenfünklein?',
          a: "Das Seelenfünklein ist für Eckhart etwas in der Seele, das nie erschaffen wurde. Es teilt, sagt er, Gottes eigene Natur. Es ist keine Fähigkeit, die du dir über Jahre aufbaust. Es ist eine Gegenwart, und nichts kommt an sie heran. Sünde beschädigt sie nicht, Zeit macht sie nicht älter, Versagen macht sie nicht kleiner und Erfolg macht sie nicht größer. Das klingt fremd, wenn man gelernt hat, seinen Wert erst zu verdienen. Genau darauf zielt Eckhart. Was du dir verdienen wolltest, liegt längst da, unberührt, und wartet nur auf genug Stille.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Meister Eckhart?',
        a: "Nein. Das hier ist ein Echo von Meister Eckhart. Es ist eine KI-Stimme, gebaut aus seinen Predigten und Schriften, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von etwa 1260 bis 1328, und Aufnahmen von ihm gibt es nicht. Nimm es als Weg in seine Gedanken, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Who was Meister Eckhart?',
          body:
            "Meister Eckhart lived from about 1260 to 1328 and was a German Dominican. He spent his early years at the priory in Erfurt, and he taught in Paris as a master of theology from 1302 to 1303. From around 1318 he was preaching in Strasbourg, often to nuns and Beguines, and he did it in German. That was the break with habit, because theology was written in Latin. In 1326 proceedings against him began in Cologne. He appealed to Avignon and died around 1328, before anything was decided. The bull In agro dominico dealt with twenty-eight propositions from his work in 1329, a year after his death.",
        },
        {
          h2: "What is Abgeschiedenheit, Eckhart's detachment?",
          seedId: 1,
          body:
            "Abgeschiedenheit is usually translated as detachment, and Eckhart takes it further than anyone expects. Start with things, the ones you own. Then the images in your head, including the good ones. Then your spiritual wishes, the wanting to be further along than you are. Then, and this is where he loses people, the will itself, the part of you that reaches for God. What is left is not a hole. It is room. His claim is that nothing can be born into a soul that is already full, so the emptying is not the loss, it is the condition. What he expects to happen in that room has a name, the birth of God in the soul. Love that holds too tight has stopped being love and turned into grip.",
        },
        {
          h2: 'What is German mysticism?',
          body:
            "German mysticism means, first of all, Christian mysticism said in German. In the Middle Ages theology was written in Latin, and Latin belonged to the scholars. Eckhart preached to nuns, Beguines and working people in their own language instead. That forced him to find German words for things that had only been said in Latin. Abgeschiedenheit is one of them. So are Grund, Seelenfünklein and Durchbruch. What this kind of mysticism is about is not visions or miracles. It is one place in a person that was never separate from God. Mysticism turns up in every tradition. In this library Eckhart stands beside Rumi in Islam and Dōgen in Zen.",
        },
      ],
      ideaQuestion: 'Everything I do has to be good for something. Can anything just be?',
      works: [
        {
          title: 'Talks of Instruction (Reden der Unterweisung)',
          note: 'The earliest of the three, from around 1294 to 1298. Practical talk rather than theology, and the most approachable thing he left.',
        },
        {
          title: 'Parisian Questions (Quaestiones Parisienses)',
          note: 'Academic disputations from his Paris years, 1302 to 1303. This is Eckhart the professor, arguing in Latin, and it shows the machinery behind the sermons.',
        },
        {
          title: 'Three-Part Work (Opus Tripartitum)',
          note: 'The big plan, begun early in the fourteenth century and never finished. What survives shows the scale he was aiming at.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Wer war Meister Eckhart?',
          body:
            "Meister Eckhart lebte von etwa 1260 bis 1328 und war Dominikaner. Seine frühen Jahre verbrachte er im Erfurter Konvent. In Paris lehrte er als Magister der Theologie, 1302 bis 1303. Ab ungefähr 1318 predigte er in Straßburg, oft vor Nonnen und Beginen, und zwar auf Deutsch. Das war der Bruch mit der Gewohnheit, denn Theologie schrieb man auf Latein. 1326 begann in Köln ein Verfahren gegen ihn. Er legte in Avignon Berufung ein und starb um 1328, bevor etwas entschieden war. Die Bulle In agro dominico behandelte 1329 achtundzwanzig Sätze aus seinem Werk, ein Jahr nach seinem Tod.",
        },
        {
          h2: 'Meister Eckhart einfach erklärt',
          body:
            "Eckhart hat im Grunde einen Gedanken, und er wiederholt ihn in vielen Bildern. Tief in dir gibt es eine Stelle, die nicht gemacht wurde. Er nennt sie den Grund oder das Seelenfünklein. Dort, sagt er, sind Gott und Seele nicht zwei. Der Weg dorthin heißt Abgeschiedenheit. Loslassen, und zwar nicht nur den Besitz, sondern auch die Bilder im Kopf, die frommen Wünsche und am Ende sogar den Willen, der nach Gott greift. Was dann geschieht, nennt er die Geburt Gottes in der Seele. Und wie man danach lebt, nennt er ohne Warum. Nicht, um etwas zu bekommen, sondern so, wie das Leben lebt und nicht nach einem Warum fragt. Genau das machte ihn angreifbar. Er legte die höchste Erfahrung in jeden Menschen hinein.",
        },
        {
          h2: 'Was ist deutsche Mystik?',
          body:
            "Deutsche Mystik heißt zunächst nur: christliche Mystik, gesagt auf Deutsch. Im Mittelalter war die Sprache der Theologie Latein, und Latein konnten die Gelehrten. Eckhart predigte stattdessen vor Nonnen, Beginen und einfachen Leuten in ihrer eigenen Sprache. Dafür brauchte er deutsche Wörter für Dinge, über die man bis dahin lateinisch sprach. Abgeschiedenheit ist so eines. Der Grund, das Seelenfünklein und der Durchbruch auch. Inhaltlich geht es dieser Mystik nicht um Visionen und Wunder, sondern um eine Stelle im Menschen, die von Gott nie getrennt war. Mystik gibt es in jeder Tradition. In dieser Bibliothek steht Eckhart neben Rumi im Islam und Dōgen im Zen.",
        },
        {
          h2: "Was heißt bei Eckhart 'ohne Warum'?",
          seedId: 5,
          body:
            "Ohne Warum ist Eckharts Formel für ein Handeln, das nicht auf Gegenleistung schielt. Die meisten guten Taten haben einen Zweck. Anerkennung, ein ruhiges Gewissen, ein besseres Jenseits. Für Eckhart ist das noch nicht frei. Frei ist eine Handlung erst, wenn sie aus dem kommt, was du bist, und nicht aus dem, was sie dir einbringen soll. Der fromme Zweck zählt für ihn dazu. Wer betet, um etwas zu bekommen, schaut Gott an wie eine Kuh, wegen der Milch. Damit verschiebt sich die ganze Ethik. Es geht nicht mehr darum, sich anzustrengen, sondern darum, der zu werden, aus dem das Richtige dann von selbst kommt.",
        },
      ],
      ideaQuestion: 'Alles, was ich tue, muss zu etwas gut sein. Darf etwas einfach nur sein?',
      works: [
        {
          title: 'Reden der Unterweisung',
          note: 'Der früheste der drei Texte, entstanden etwa 1294 bis 1298. Weniger Theologie als praktische Rede, und das Zugänglichste, was er hinterlassen hat.',
        },
        {
          title: 'Pariser Fragen (Quaestiones Parisienses)',
          note: 'Akademische Streitfragen aus seiner Pariser Zeit, 1302 bis 1303. Hier spricht Eckhart der Professor, auf Latein, und man sieht die Mechanik hinter den Predigten.',
        },
        {
          title: 'Opus Tripartitum',
          note: 'Sein großer Plan, begonnen im frühen 14. Jahrhundert und nie vollendet. Was erhalten ist, zeigt, wie groß er es angelegt hatte.',
        },
      ],
    },
  },
};
