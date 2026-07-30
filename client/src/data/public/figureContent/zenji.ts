import type { FigureFragment } from './types';

// zenji: voice-passed QA + authored page content, both languages.
// The first concept block answers the bare query 'zenji'. No translated
// passages are quoted anywhere here, the modern translations are in copyright.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Dōgen Zenji?',
          a: "Dōgen Zenji (1200-1253) was a Japanese Zen master and the founder of the Sōtō school in Japan. One question followed him from his mother's funeral to China and back. If we are already whole, why practice at all? His answer took the question apart. Sitting is not the road to awakening. Sitting done wholeheartedly is the awakening, happening now. With him you learn to stop chasing the next moment.",
        },
        {
          q: 'What did Dōgen Zenji teach?',
          a: "Dōgen Zenji taught shikantaza, just sitting. You sit upright, you stay awake to the whole body and mind, and you neither chase thoughts nor push them away. That is the practice, and it is not preparation for anything. His central claim is that practice and awakening are one thing, not two stages, so there is no future prize to earn. He also taught that ordinary work counts. Cooking and cleaning done with full presence are the same awakening as sitting. He set it down in the Shōbōgenzō, in fascicles written between 1231 and 1253.",
        },
        {
          q: 'What is shikantaza?',
          a: "Shikantaza means just sitting. Picture sitting down because there is genuinely nothing else to do. Your back straightens without you deciding it. Your hands settle. The sitting is not asking for anything beyond itself. That complete giving of yourself to this posture and this breath is shikantaza. Attention stays awake, and thoughts are neither followed nor blocked. They come, they go, they let go of themselves. Dōgen has a word for the mode of mind this needs, hishiryō, non-thinking. It is not thinking and not going blank. It is a third thing.",
        },
      ],
      disclosure: {
        q: 'Is this really Dōgen Zenji speaking?',
        a: "No. This is an Echo of Dōgen Zenji. It is an AI voice built from his own writings, and it stays an interpretation, not a recording. He lived from 1200 to 1253 and no recording of him exists. Use it as a way into his practice, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Dōgen Zenji lernen?',
          a: "Dōgen Zenji (1200-1253) war ein japanischer Zen-Meister und der Begründer der Sōtō-Schule in Japan. Eine Frage begleitete ihn von der Beerdigung seiner Mutter bis nach China und zurück. Wenn wir schon ganz sind, warum dann üben? Seine Antwort löste die Frage auf. Das Sitzen führt nicht zum Erwachen. Das Sitzen mit ganzem Herzen ist das Erwachen, und zwar jetzt. Bei ihm lernst du, dem nächsten Augenblick nicht mehr nachzujagen.",
        },
        {
          q: 'Was hat Dōgen Zenji gelehrt?',
          a: "Dōgen Zenji lehrte Shikantaza, das Nur-Sitzen. Du sitzt aufrecht, bleibst wach für den ganzen Körper und Geist und läufst den Gedanken weder nach noch schiebst du sie weg. Das ist die Übung, und sie bereitet nichts vor. Sein Kernsatz lautet: Übung und Erwachen sind eins, keine zwei Stufen, also gibt es auch keinen Preis in der Zukunft zu verdienen. Dazu kommt, dass die gewöhnliche Arbeit zählt. Kochen und Putzen mit voller Präsenz sind dasselbe Erwachen wie das Sitzen. Aufgeschrieben hat er das im Shōbōgenzō, in Faszikeln aus den Jahren 1231 bis 1253.",
        },
        {
          q: 'Was ist Shikantaza?',
          a: "Shikantaza heißt Nur-Sitzen. Stell dir vor, du setzt dich hin, weil es wirklich nichts anderes zu tun gibt. Dein Rücken richtet sich auf, ohne dass du es entscheidest. Deine Hände kommen zur Ruhe. Das Sitzen verlangt nichts, was darüber hinausgeht. Dieses vollständige Hingeben an diese Haltung und diesen Atem ist Shikantaza. Die Aufmerksamkeit bleibt wach, und die Gedanken werden weder verfolgt noch blockiert. Sie kommen, sie gehen, sie lösen sich selbst. Für die Verfassung, die das braucht, hat Dōgen ein Wort: Hishiryō, das Nicht-Denken. Es ist nicht Denken und nicht Leere im Kopf. Es ist ein Drittes.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Dōgen Zenji?',
        a: "Nein. Das hier ist ein Echo von Dōgen Zenji. Es ist eine KI-Stimme, gebaut aus seinen eigenen Schriften, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von 1200 bis 1253, und Aufnahmen von ihm gibt es nicht. Nimm es als Weg in seine Übung, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Who was Dōgen Zenji?',
          body:
            "Dōgen Zenji, often just Dōgen, lived from 1200 to 1253 and founded the Sōtō school of Zen in Japan. He entered the monastery on Mount Hiei as a boy and left it unsatisfied. In 1223, at twenty-four, he sailed to China and trained at Jingde Monastery on Mount Tiantong. Back in Japan he founded Kosho-ji near Kyoto in 1236 and started the Shōbōgenzō, which he kept writing until the year he died. He is not a comfortable read. He is exact about one small thing, how you sit, and then shows you that everything else is already in it.",
        },
        {
          h2: 'What is zazen?',
          seedId: 1,
          body:
            "Zazen is sitting meditation, and in Dōgen's hands it is stranger than it sounds. Most methods are for getting somewhere. This one is not. You take the posture, you stay awake to the whole body and mind, and you let thoughts arrive and leave without following them or fighting them. The posture is not a warm-up for the mental part. In his teaching the posture is the thing itself, buddha-nature showing up as a person sitting still. Which is how he can say the sitting is already the awakening you were planning to earn. Nothing is missing from it, so nothing has to be added.",
        },
        {
          h2: 'What is the Shōbōgenzō?',
          body:
            "The Shōbōgenzō is his main work, a collection of fascicles written between 1231 and 1253. Treasury of the True Dharma Eye is the usual English title. It is not a manual and not a system. Each fascicle takes one thing and turns it until it opens. Time. Buddha-nature. Mountains. The work of a monastery cook. The best known are Genjōkōan, Uji, Busshō and Gyōji. One caution about editions. The 95-fascicle version most people meet was first put together in the 1690s and is not necessarily his own arrangement. Earlier collections of 75 and 12 fascicles were probably arranged by him or by close students.",
        },
      ],
      ideaQuestion: 'I keep waiting for my real life to start. When does it?',
      works: [
        {
          title: 'Fukanzazengi (Universal Recommendation for Zazen)',
          note: 'His instructions for sitting, first written around 1227 and revised for the rest of his life. Very short. If you read only one thing by him, read this one.',
        },
        {
          title: 'Bendōwa (On the Endeavor of the Way)',
          note: 'From 1231, built as questions and answers. This is where he argues that practice and awakening are not two stages.',
        },
        {
          title: 'Shōbōgenzō (Treasury of the True Dharma Eye)',
          note: 'Fascicles written from 1231 to 1253, on time, buddha-nature and the work of an ordinary day. The 95-fascicle arrangement came later, in the 1690s.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Wer war Dōgen Zenji?',
          body:
            "Dōgen Zenji, oft nur Dōgen, lebte von 1200 bis 1253 und begründete die Sōtō-Schule des Zen in Japan. Als Junge trat er in das Kloster auf dem Berg Hiei ein und verließ es unzufrieden. 1223, mit vierundzwanzig, fuhr er nach China und übte im Jingde-Kloster auf dem Berg Tiantong. Zurück in Japan gründete er 1236 Kosho-ji bei Kyoto und begann das Shōbōgenzō, an dem er bis zu seinem Todesjahr weiterschrieb. Bequem zu lesen ist er nicht. Er ist genau in einer einzigen kleinen Sache, nämlich wie man sitzt, und zeigt dann, dass alles andere schon darin steckt.",
        },
        {
          h2: 'Was ist Zazen?',
          seedId: 1,
          body:
            "Zazen ist Sitzmeditation, und bei Dōgen ist sie eigenartiger, als es klingt. Die meisten Methoden wollen irgendwohin. Diese nicht. Du nimmst die Haltung ein, bleibst wach für Körper und Geist als Ganzes und lässt Gedanken kommen und gehen, ohne ihnen nachzulaufen und ohne gegen sie zu kämpfen. Die Haltung ist kein Aufwärmen für den geistigen Teil. In seiner Lehre ist die Haltung die Sache selbst, Buddha-Natur, die als ein still sitzender Mensch erscheint. So kann er sagen, dass das Sitzen schon das Erwachen ist, das du dir verdienen wolltest. Es fehlt nichts daran, also muss auch nichts dazukommen.",
        },
        {
          h2: 'Dōgen einfach erklärt',
          body:
            "Dōgen dreht die übliche Reihenfolge um. Sonst heißt es: erst üben, dann erwachen. Bei ihm ist beides eins. Wer sich ganz auf das Sitzen einlässt, übt nicht auf etwas hin, sondern drückt genau das aus, was er ohnehin schon ist. Daraus folgt der Rest. Erstens: Es gibt nichts zu erreichen, also auch keinen Grund, den nächsten Augenblick zu jagen. Zweitens: Der Körper macht mit. Die genaue Haltung ist nicht Vorbereitung, sie ist die Übung. Drittens: Der Alltag zählt. Kochen und Putzen mit voller Aufmerksamkeit sind dasselbe wie Sitzen. Und viertens: Zeit ist nicht etwas, das an dir vorbeizieht. Jeder Augenblick ist vollständig.",
        },
      ],
      ideaQuestion: 'Ich warte ständig darauf, dass mein richtiges Leben anfängt. Wann fängt es an?',
      works: [
        {
          title: 'Fukanzazengi (Allgemeine Empfehlung für Zazen)',
          note: 'Seine Anleitung zum Sitzen, zuerst um 1227 geschrieben und ein Leben lang überarbeitet. Sehr kurz. Wenn du nur einen Text von ihm liest, dann diesen.',
        },
        {
          title: 'Bendōwa',
          note: 'Von 1231, aufgebaut als Fragen und Antworten. Hier begründet er, dass Übung und Erwachen keine zwei Stufen sind.',
        },
        {
          title: 'Shōbōgenzō (Schatzkammer des wahren Dharma-Auges)',
          note: 'Faszikel aus den Jahren 1231 bis 1253, über Zeit, Buddha-Natur und die Arbeit eines gewöhnlichen Tages. Die Anordnung in 95 Faszikeln entstand erst in den 1690er Jahren.',
        },
      ],
    },
  },
};
