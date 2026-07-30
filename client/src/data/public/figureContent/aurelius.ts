import type { FigureFragment } from './types';

// aurelius: voice-passed QA + authored page content, both languages.
// Concept headings are harvested queries. The German set carries the
// 'einfach erklärt' slot, which has no English equivalent.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Marcus Aurelius?',
          a: "Marcus Aurelius (121-180 AD) was a Roman emperor. He ruled from 161 to 180, through plague and war. In his last ten years he wrote private notes to himself, partly on campaign at the Danube frontier. They do one thing over and over. They separate what actually happened from the story the mind adds to it. He never meant them to be read. They survived as the Meditations.",
        },
        {
          q: 'What did Marcus Aurelius teach?',
          a: "Marcus Aurelius taught Stoic philosophy, and three ideas carry most of it. The first is the examination of impressions. You put a pause between what happens and how you answer it, then you check the judgment you attached. The second is living according to nature. That works on three levels: your own reason, the people you owe something to, and the wider order of things. The third is preferred indifferents. Health, family and success are worth wanting. They still do not decide whether you act well. He wrote all of it down for himself, not for us, in the Meditations.",
        },
        {
          q: 'What is the examination of impressions?',
          a: "It is the Stoic pause. Something happens, and before you answer it you look at the impression it left. Then you ask one question. Is the judgment I just attached actually true? Marcus Aurelius called this the discipline of assent. Take being criticized. The burn you feel usually does not come from the words. It comes from the story your mind wrapped around them in the same second. The event is one thing. The verdict you added is another, and that one is yours.",
        },
      ],
      disclosure: {
        q: 'Is this really Marcus Aurelius speaking?',
        a: "No. This is an Echo of Marcus Aurelius. It is an AI voice built from what he actually wrote, and it stays an interpretation, not a recording. The real man lived from 121 to 180 AD and no recording of him exists. Use it as a way into his Stoic ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Mark Aurel lernen?',
          a: "Mark Aurel (Marcus Aurelius, 121-180 n. Chr.) war römischer Kaiser. Er regierte von 161 bis 180, durch Pest und Krieg. In seinen letzten zehn Jahren schrieb er Notizen an sich selbst, zum Teil im Feld an der Donaugrenze. Diese Notizen tun immer wieder dasselbe. Sie trennen das, was geschehen ist, von der Geschichte, die der Kopf dazu erfindet. Für Leser waren sie nie gedacht. Erhalten sind sie als die Selbstbetrachtungen.",
        },
        {
          q: 'Was hat Mark Aurel gelehrt?',
          a: "Mark Aurel lehrte stoische Philosophie. Drei Gedanken tragen fast alles. Der erste ist die Prüfung der Eindrücke. Du legst eine Pause zwischen das, was passiert, und deine Antwort darauf, und prüfst dann das Urteil, das du angehängt hast. Der zweite ist das Leben im Einklang mit der Natur. Das wirkt auf drei Ebenen: deine eigene Vernunft, die Menschen, denen du etwas schuldest, und die größere Ordnung der Dinge. Der dritte sind die vorgezogenen Gleichgültigkeiten. Gesundheit, Familie und Erfolg darf man wollen. Über dein Handeln entscheiden sie trotzdem nicht. Aufgeschrieben hat er das alles für sich selbst, in den Selbstbetrachtungen.",
        },
        {
          q: 'Was ist die Prüfung der Eindrücke?',
          a: "Sie ist die stoische Pause. Etwas passiert, und bevor du reagierst, schaust du dir den Eindruck an, den es hinterlassen hat. Dann stellst du eine Frage. Stimmt das Urteil, das ich gerade angehängt habe, überhaupt? Mark Aurel nannte das die Disziplin der Zustimmung. Nimm eine Kritik. Der Stich kommt meist nicht aus den Worten. Er kommt aus der Geschichte, die dein Kopf in derselben Sekunde darum gelegt hat. Das Ereignis ist das eine. Das Urteil hast du hinzugefügt, und das gehört dir.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Mark Aurel?',
        a: "Nein. Das hier ist ein Echo von Mark Aurel. Es ist eine KI-Stimme, gebaut aus dem, was er wirklich geschrieben hat, und sie bleibt eine Deutung, keine Aufnahme. Der echte Mensch lebte von 121 bis 180 n. Chr., und Aufnahmen von ihm gibt es nicht. Nimm es als Weg in seine stoischen Gedanken, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What is Stoicism?',
          seedId: 1,
          body:
            "Stoicism is an ancient philosophy that treats thinking as training, not as talk. It covers three areas: how the world works, how to live well, and how to tell true from false. Marcus Aurelius practiced it as three daily disciplines, desire, action and assent. Only your character counts as good. Wisdom, justice, courage and self-control are the whole list. Everything else, health, money, reputation, is worth having and worth working for, but it does not decide whether you act well. That is why a Stoic can lose almost everything and still hold the one thing that mattered.",
        },
        {
          h2: 'How do you practice Stoicism every day?',
          seedId: 7,
          body:
            "Marcus Aurelius starts before the day does. In the morning he tells himself who he is likely to meet. People who push in, people who take and never thank, people who lie. Not to sour the day. To take the surprise out of it, so his answer is a choice instead of a reflex. He adds that people behave badly because they cannot tell good from bad, not because they picked you. Then there is the view from above. You lift the picture up, from the room to the city to the world, until the thing eating you is back at its real size.",
        },
        {
          h2: 'What does Stoicism say about anger?',
          seedId: 6,
          body:
            "Stoicism does not ask you to feel less. It splits feelings in two. Some grow out of a false judgment, and those are the ones that wreck a day. Others line up with what is actually true, and those are fine to keep. Anger almost always sits in the first group. Something happened, you decided in half a second what it meant, and the heat came from the decision, not the event. Marcus Aurelius works on the decision. Look at the judgment, ask whether it holds, and the feeling loses its grip. Not suppressed. Taken apart.",
        },
      ],
      ideaQuestion: 'My problem feels enormous. How do I get it back to its real size?',
      works: [
        {
          title: "Meditations (Ta eis heauton, 'To Himself')",
          note: 'A private journal, written around 170 to 180 AD and never meant for publication. You can open it anywhere. Every entry is a man talking himself back into shape.',
        },
        {
          title: 'Meditations Book 1',
          note: 'A list of what he owed people, teacher by teacher, relative by relative. Nothing else like it survives from the ancient world. Read it to see who made him.',
        },
        {
          title: 'Meditations Books 2-3',
          note: 'Written under military pressure, probably on campaign. Death stands close in these pages, and next to it the daily work of examining an impression before you accept it.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist Stoizismus? Mark Aurel in 60 Sekunden',
          seedId: 1,
          body:
            "Stoizismus ist eine antike Philosophie, die Denken als Training versteht, nicht als Gerede. Sie deckt drei Bereiche ab: wie die Welt funktioniert, wie man gut lebt, und wie man Wahres von Falschem unterscheidet. Mark Aurel übte das als drei tägliche Disziplinen, Verlangen, Handeln und Zustimmung. Gut ist am Ende nur dein Charakter. Weisheit, Gerechtigkeit, Mut und Mäßigung, mehr steht nicht auf der Liste. Alles andere, Gesundheit, Geld, Ansehen, darf man wollen und dafür arbeiten. Es entscheidet aber nicht darüber, ob du richtig handelst. Deshalb kann ein Stoiker fast alles verlieren und hat das Einzige noch, worauf es ankam.",
        },
        {
          h2: 'Mark Aurel einfach erklärt',
          body:
            "Mark Aurel war römischer Kaiser und Stoiker, und das ist ein seltsames Paar. Der mächtigste Mann des Reiches schrieb sich nachts Zettel, auf denen er sich selbst zur Ordnung ruft. Vier Sätze reichen, um ihn zu verstehen. Erstens: Nicht die Dinge stören dich, sondern dein Urteil über sie. Zweitens: Zwischen Ereignis und Reaktion liegt eine Pause, und die gehört dir. Drittens: Du bist Teil von etwas Größerem und schuldest anderen Menschen etwas. Viertens: Du wirst sterben, und daran klärt sich, was heute wirklich zählt. Veröffentlicht hat er davon nichts. Geübt hat er es, jeden Morgen neu.",
        },
        {
          h2: 'Was steht in den Selbstbetrachtungen?',
          body:
            "Die Selbstbetrachtungen sind kein Buch für Leser. Es sind private Notizen, entstanden ungefähr zwischen 170 und 180 n. Chr., zum Teil im Feld an der Donaugrenze. Buch 1 ist eine Liste von Dankesschulden. Was er von seinen Lehrern und seiner Familie gelernt hat, Person für Person. Aus der Antike ist nichts Vergleichbares erhalten. In den Büchern 2 und 3 wird der Ton härter. Der Tod steht nah, der Druck des Krieges ist zu spüren, und er übt genau das, was er sonst lehrt: den Eindruck prüfen, bevor man ihm zustimmt. Anfangen kannst du an jeder Stelle.",
        },
      ],
      ideaQuestion: 'Mein Problem fühlt sich riesig an. Wie bekomme ich es auf seine Größe zurück?',
      works: [
        {
          title: 'Selbstbetrachtungen (Ta eis heauton)',
          note: 'Ein privates Tagebuch, entstanden etwa 170 bis 180 n. Chr. und nie zur Veröffentlichung gedacht. Du kannst irgendwo aufschlagen. Jeder Eintrag ist ein Mensch, der sich selbst wieder in die Spur bringt.',
        },
        {
          title: 'Selbstbetrachtungen, Buch 1',
          note: 'Eine Liste dessen, was er anderen verdankt, Lehrer für Lehrer, Verwandter für Verwandter. Aus der Antike gibt es dazu nichts Vergleichbares. Lies es, wenn du sehen willst, wer ihn gemacht hat.',
        },
        {
          title: 'Selbstbetrachtungen, Bücher 2 und 3',
          note: 'Geschrieben unter militärischem Druck, vermutlich im Feld. Der Tod steht in diesen Seiten nah, und daneben die tägliche Arbeit: den Eindruck prüfen, bevor man ihm zustimmt.',
        },
      ],
    },
  },
};
