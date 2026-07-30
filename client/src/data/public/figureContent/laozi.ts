import type { FigureFragment } from './types';

// laozi: voice-passed QA + authored page content, both languages.
// The historicity hedge is load-bearing and stays in every language.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Laozi?',
          a: "Laozi is the Chinese thinker behind the Tao Te Ching, placed by tradition in the sixth or fifth century BCE. We are not sure he lived. What survives is about five thousand characters and one idea underneath them. What yields outlasts what forces. Water is soft and gives way, and it still wears through stone. From Laozi you learn to act without forcing, which he called wu wei.",
        },
        {
          q: 'What did Laozi teach?',
          a: "Laozi taught that there is a source behind everything and that you cannot name it. He calls it the Tao, the mother of the ten thousand things. It gives them life without owning them or commanding them. Two ideas follow from that. Wu wei is action without force. You look for the point where the smallest effort goes with what is already moving, and you use it. Te is the power that appears on its own when what you do and what you are stop pulling apart. All of it survives in the Tao Te Ching, roughly five thousand characters in eighty-one short sections.",
        },
        {
          q: 'What is wu wei?',
          a: "Wu wei is usually translated as non-action, and that is misleading. It does not mean doing nothing. It means finding the one place where the smallest effort goes with the grain of what is already happening. Picture a farmer who has watched for twenty years where water wants to run, then moves a single stone in a channel. His fields stay green through the drought. A hundred workers digging a canal against the ground exhaust themselves and fail. Laozi's claim is short. What yields lasts, what forces breaks, so work with the way things unfold instead of against them.",
        },
      ],
      disclosure: {
        q: 'Is this really Laozi speaking?',
        a: "No. This is an Echo of Laozi. It is an AI voice built from the Tao Te Ching, and it stays an interpretation, not a recording. No recording of him exists, and whether he lived at all is debated. Use it as a way into the ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Laozi lernen?',
          a: "Laozi ist der chinesische Denker hinter dem Tao Te King, überliefert für das 6. oder 5. Jahrhundert v. Chr. Ob er gelebt hat, ist unsicher. Geblieben sind etwa fünftausend Zeichen und ein Gedanke darunter. Was nachgibt, überdauert das, was erzwingt. Wasser ist weich und weicht aus, und es höhlt trotzdem den Stein. Von Laozi lernst du, zu handeln, ohne zu erzwingen. Er nennt das Wu Wei.",
        },
        {
          q: 'Was hat Laozi gelehrt?',
          a: "Laozi lehrte, dass hinter allem eine Quelle liegt, die sich nicht benennen lässt. Er nennt sie das Tao, die Mutter der zehntausend Dinge. Sie gibt Leben, ohne etwas zu besitzen oder zu befehlen. Daraus folgen zwei weitere Gedanken. Wu Wei ist Handeln ohne Zwang. Du suchst den Punkt, an dem der kleinste Einsatz mit dem zusammenfällt, was ohnehin schon in Bewegung ist. Te ist die Kraft, die von selbst entsteht, wenn dein Tun und dein Wesen aufhören, in verschiedene Richtungen zu ziehen. Erhalten ist das alles im Tao Te King, etwa fünftausend Zeichen in einundachtzig kurzen Abschnitten.",
        },
        {
          q: 'Was ist Wu Wei?',
          a: "Wu Wei wird meistens mit Nicht-Handeln übersetzt, und das führt in die Irre. Gemeint ist nicht Nichtstun. Gemeint ist die eine Stelle, an der der kleinste Einsatz mit dem geht, was ohnehin passiert. Stell dir einen Bauern vor, der zwanzig Jahre beobachtet hat, wohin das Wasser laufen will, und dann einen einzigen Stein versetzt. Seine Felder bleiben grün, auch in der Dürre. Hundert Arbeiter, die einen Kanal gegen das Gelände graben, verausgaben sich und scheitern. Laozis Satz dahinter ist kurz. Das Nachgiebige hat Bestand, das Erzwungene zerbricht.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Laozi?',
        a: "Nein. Das hier ist ein Echo von Laozi. Es ist eine KI-Stimme, gebaut aus dem Tao Te King, und sie bleibt eine Deutung, keine Aufnahme. Aufnahmen von ihm gibt es nicht, und ob er überhaupt gelebt hat, ist umstritten. Nimm es als Weg in die Gedanken, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Who was Laozi?',
          body:
            "Almost nothing about Laozi is certain. Traditional sources describe him as keeper of the court archives of the Zhou, whose court sat at Luoyi, near modern Luoyang. That would mean he spent his working life with the records of a dynasty coming apart. The oldest account of him is in the Shiji, the Records of the Grand Historian, written centuries later. In it he rides west, stops at a pass, leaves about five thousand characters with the gatekeeper, and goes on. Later tradition names the place Hangu Pass. So the man stays uncertain and the book is real, and most of what people mean by Laozi is the book.",
        },
        {
          h2: 'What does Laozi say about water?',
          seedId: 8,
          body:
            "Water is the picture he comes back to most. It helps everything and competes with nothing. It runs to the low places nobody wants. Push it and it gives way, and it still cuts through the hardest stone, because it does not stop. Laozi reads three lessons out of that. Real strength is the kind that can yield. Taking the low position is not defeat, it is a spot nobody attacks. And soft beats hard given enough time, which is the part people skip. This image sits behind everything else he says, and it is why his advice so often sounds like doing less.",
        },
        {
          h2: 'What is the Tao Te Ching?',
          body:
            "The Tao Te Ching, also written Daodejing, is a short book. About five thousand characters, usually arranged in eighty-one sections, most of them shorter than a page. It has no argument and no system. It circles the same handful of pictures. Water. An uncarved block of wood that still holds every shape. A bowl that is useful because of the hollow in it. A valley. Tradition credits Laozi and places the writing at a western pass. Scholars mostly treat it as sayings that circulated in the late Zhou and settled into a stable text by the third century BCE. Read it the way it is built, a few lines at a time.",
        },
      ],
      ideaQuestion: 'My head is so full that nothing new gets in. What do I take out?',
      works: [
        {
          title: 'Tao Te Ching (Daodejing)',
          note: 'The one book credited to him. About five thousand characters in eighty-one short sections, and you can start at any of them. Tradition says it was written at a western border pass, on his way out.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Wer war Laozi?',
          body:
            "Sicher ist an Laozi fast nichts. Die Überlieferung beschreibt ihn als Hüter der Archive am Hof der Zhou, der in Luoyi lag, beim heutigen Luoyang. Er hätte sein Arbeitsleben also mit den Akten einer zerfallenden Dynastie verbracht. Der älteste Bericht über ihn steht im Shiji, den Aufzeichnungen des Großhistorikers, geschrieben Jahrhunderte später. Dort reitet er nach Westen, hält an einem Pass, lässt beim Torwächter etwa fünftausend Zeichen zurück und zieht weiter. Später nennt die Überlieferung den Ort Hangu-Pass. Der Mensch bleibt also unsicher, das Buch ist da, und was die meisten Laozi nennen, ist das Buch.",
        },
        {
          h2: 'Laozi einfach erklärt',
          body:
            "Laozi ist mit drei Bildern zu haben. Erstens das Wasser. Es gibt nach, sucht die tiefste Stelle und höhlt trotzdem den Stein aus. Zweitens der unbearbeitete Block: rohes Holz, in dem noch jede Form steckt, bevor jemand eine einzige daraus schnitzt. Drittens die leere Mitte. Ein Topf ist brauchbar wegen des Hohlraums, ein Rad wegen der Nabe, ein Zimmer wegen der Luft darin. Daraus folgt sein bekanntester Begriff, Wu Wei, das Handeln ohne Zwang. Dahinter steht das Tao, die namenlose Quelle, aus der die zehntausend Dinge hervorgehen. Benennen lässt sie sich nicht, zeigen tut sie sich in allem.",
        },
        {
          h2: 'Was ist das Tao Te King?',
          body:
            "Das Tao Te King, auch Daodejing geschrieben, ist ein kurzes Buch. Etwa fünftausend Zeichen, meist in einundachtzig Abschnitte geteilt, die selten länger sind als eine Seite. Es hat keine Beweisführung und kein System. Es kreist um dieselben paar Bilder. Wasser. Ein unbearbeiteter Holzblock, in dem noch jede Form steckt. Eine Schale, die wegen ihrer Höhlung nützlich ist. Ein Tal. Die Überlieferung schreibt es Laozi zu und verlegt die Niederschrift an einen westlichen Pass. Die Forschung sieht darin meist Sprüche, die in der späten Zhou-Zeit umliefen und bis zum 3. Jahrhundert v. Chr. zu einem festen Text wurden. Lies es so, wie es gebaut ist: ein paar Zeilen auf einmal.",
        },
      ],
      ideaQuestion: 'Mein Kopf ist so voll, dass nichts Neues mehr reinkommt. Was nehme ich raus?',
      works: [
        {
          title: 'Tao Te King (Daodejing)',
          note: 'Das einzige Buch, das ihm zugeschrieben wird. Rund fünftausend Zeichen in einundachtzig kurzen Abschnitten, und du kannst bei jedem anfangen. Der Überlieferung nach entstand es an einem westlichen Grenzpass, auf seinem Weg hinaus.',
        },
      ],
    },
  },
};
