import type { FigureFragment } from './types';

// goethe: voice-passed QA plus authored page content. The German concepts carry
// the two evidenced queries, Goethe als Naturwissenschaftler and Faust einfach
// erklärt, and the English side mirrors them with its own query shapes.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Johann Wolfgang von Goethe?',
          a: 'Johann Wolfgang von Goethe (1749-1832) was a poet, a government minister, and a scientist, and he refused to keep the three apart. He studied one leaf until he saw that every part of a plant is the same form, changing. That is his whole method. Look at a thing long enough and closely enough, and it starts to show you what it is doing. With Goethe, you learn to look until you understand.',
        },
        {
          q: 'What did Johann Wolfgang von Goethe teach?',
          a: 'Goethe taught a way of seeing. Metamorphosis is the first idea. A plant does not add new parts, it transforms one basic organ again and again, leaf into sepal into petal, and nothing is ever simply replaced. Polarity and intensification is the second. Growth comes out of the tension between opposites, and colours appear exactly where light and dark meet. Gentle empiricism is the third, his zarte Empirie. Observe strictly, but stay close to the thing instead of standing back from it, and let it speak for itself. He set the plant work down in The Metamorphosis of Plants (1790).',
        },
        {
          q: "What is Goethe's idea of metamorphosis?",
          a: 'Metamorphosis is not random change. Watch a flowering plant from root to bloom. The broad lower leaves narrow as they climb, becoming bracts, then sepals, then petals. It is the same organ, transformed at every stage, never swapped for a different one. Goethe saw a rule in that. Development carries forward what came before while reaching a new expression, and diverse forms are variations on one underlying shape.',
        },
      ],
      disclosure: {
        q: 'Is this really Johann Wolfgang von Goethe speaking?',
        a: 'No. This is an Echo of Goethe. It is an AI voice built from his documented writings on nature, colour, and poetry, and it stays an interpretation, not a recording. The real man lived from 1749 to 1832 and no audio of him exists. Use it as a way into his ideas, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Johann Wolfgang von Goethe lernen?',
          a: 'Johann Wolfgang von Goethe (1749-1832) war Dichter, Staatsmann und Naturforscher, und er weigerte sich, diese drei Rollen zu trennen. Er studierte ein einziges Blatt so lange, bis er sah, dass jeder Teil einer Pflanze dieselbe Form ist, die sich wandelt. Das ist seine ganze Methode. Sieh eine Sache lange genug und genau genug an, und sie beginnt dir zu zeigen, was sie tut. Bei Goethe lernst du, so lange hinzusehen, bis du verstehst.',
        },
        {
          q: 'Was hat Johann Wolfgang von Goethe gelehrt?',
          a: 'Goethe lehrte eine Art zu sehen. Der erste Gedanke ist die Metamorphose. Eine Pflanze hängt keine neuen Teile an, sie verwandelt ein Grundorgan immer wieder, Blatt zu Kelchblatt zu Blütenblatt, und nichts wird dabei einfach ersetzt. Der zweite Gedanke heißt Polarität und Steigerung. Wachstum entsteht aus der Spannung zwischen Gegensätzen, und Farben treten genau dort auf, wo Licht und Dunkel sich begegnen. Der dritte ist die zarte Empirie. Beobachte streng, aber bleib nah an der Sache, statt auf Abstand zu gehen, und lass sie für sich selbst sprechen. Die Pflanzenarbeit steht in Die Metamorphose der Pflanzen (1790).',
        },
        {
          q: 'Was ist Goethes Idee der Metamorphose?',
          a: 'Metamorphose meint keinen zufälligen Wandel. Sieh dir eine blühende Pflanze von der Wurzel bis zur Blüte an. Die breiten unteren Blätter werden nach oben hin schmaler, erst zu Hochblättern, dann zu Kelchblättern, dann zu Blütenblättern. Es ist dasselbe Organ, auf jeder Stufe verwandelt und nie durch ein anderes ersetzt. Darin sah Goethe eine Regel. Entwicklung trägt weiter, was vorher war, und findet zugleich einen neuen Ausdruck. Vielfalt ist bei ihm die Abwandlung einer einzigen Grundform.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Johann Wolfgang von Goethe?',
        a: 'Nein. Das hier ist ein Echo von Goethe. Es ist eine KI-Stimme, gebaut aus seinen überlieferten Schriften zu Natur, Farbe und Dichtung, und sie bleibt eine Deutung, keine Aufnahme. Der echte Mensch lebte von 1749 bis 1832, und es gibt keine Tonaufnahme von ihm. Nimm es als Weg in seine Ideen, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What is Goethe's Theory of Colours about?",
          seedId: 11,
          body:
            'Goethe took colour seriously as experience, not only as physics. Newton had treated colour as a property of light that a prism pulls apart. Goethe ran thousands of careful trials and came out somewhere else. Colours arise where light and darkness interact, at edges and through cloudy media. He was not trying to replace the physics. He wanted a full account of what the eye actually goes through, which for him meant putting the physical, the physiological, and the psychological side by side. One of his own lines says everything about the method: the eye may be said to owe its existence to light.',
        },
        {
          h2: 'What is Faust about?',
          seedId: 1,
          body:
            'Faust is a scholar who has studied everything and still has nothing that holds him. He makes a wager with Mephisto. If Faust ever says to a passing moment stay a while, you are so beautiful, then Mephisto has won him. What follows is a long life of love, guilt, and power, and a great deal of getting it wrong. He is saved at the end anyway, and the reason sits in two lines: whoever strives with all his might, that man we can redeem. That is the core of Goethe. Fulfilment is not at the destination, it is in the striving. Error and struggle are part of the road, not obstacles before the road begins.',
        },
      ],
      ideaQuestion: 'I never arrive anywhere. Is the striving the point, or am I just restless?',
      works: [
        {
          title: 'The Sorrows of Young Werther (1774)',
          note: 'The novel that made him famous across Europe. It also triggered documented imitative suicides and a wave of public blame aimed at Goethe himself.',
        },
        {
          title: 'Italian Journey (travels 1786-88, published 1816-17)',
          note: 'He left for Italy at thirty-seven and stayed nearly two years. In a Palermo garden on 17 April 1787 he went looking for the single form behind all plants.',
        },
        {
          title: 'The Metamorphosis of Plants (1790)',
          note: 'The botanical book. Sepal, petal, stamen and pistil turn out to be one organ transformed, and that organ is the leaf.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Goethe als Naturwissenschaftler: Was hat er erforscht?',
          seedId: 11,
          body:
            'Goethe hielt seine Naturforschung für mindestens so wichtig wie seine Dichtung. Er sammelte Mineralien, ging in die Ilmenauer Bergwerke und arbeitete jahrzehntelang an der Farbenlehre. Newton hatte Farbe als Eigenschaft des Lichts behandelt, sichtbar gemacht durch das Prisma. Goethe machte tausende sorgfältige Versuche und kam zu einem anderen Schluss: Farben entstehen im Zusammenspiel von Licht und Dunkelheit, an Grenzen und durch trübe Medien. Ihm ging es um die Farbe als Erfahrung, nicht nur als Physik. Dazu kommt die Botanik. 1790 erschien Die Metamorphose der Pflanzen, in der er zeigt, dass Kelchblatt, Blütenblatt und Staubgefäß Verwandlungen einer einzigen Grundform sind, nämlich des Blatts.',
        },
        {
          h2: 'Faust einfach erklärt',
          seedId: 1,
          body:
            'Faust ist ein Gelehrter, der alles studiert hat und trotzdem nichts besitzt, das ihn trägt. Er schließt eine Wette mit Mephisto. Sagt Faust je zu einem Augenblick: Verweile doch, du bist so schön, dann hat Mephisto ihn gewonnen. Danach folgt ein langes Leben aus Liebe, Schuld und Macht, und aus reichlich Irrtum. Am Ende wird Faust trotzdem gerettet, und der Grund steht in zwei Zeilen: Wer immer strebend sich bemüht, den können wir erlösen. Das ist Goethes Kerngedanke. Erfüllung liegt nicht im Ankommen, sondern im Streben selbst. Irrtum und Kampf stehen nicht vor dem eigentlichen Weg. Sie gehören dazu.',
        },
      ],
      ideaQuestion: 'Ich komme nie an. Ist das Streben der Sinn, oder bin ich einfach nur unruhig?',
      works: [
        {
          title: 'Die Leiden des jungen Werthers (1774)',
          note: 'Der Roman, der ihn in ganz Europa berühmt machte. Er löste auch dokumentierte Nachahmungssuizide aus und öffentliche Schuldzuweisungen an Goethe selbst.',
        },
        {
          title: 'Italienische Reise (Reisen 1786-88, veröffentlicht 1816-17)',
          note: 'Mit siebenunddreißig brach er nach Italien auf und blieb fast zwei Jahre. Am 17. April 1787 suchte er in einem Garten in Palermo die eine Grundform hinter allen Pflanzen.',
        },
        {
          title: 'Die Metamorphose der Pflanzen (1790)',
          note: 'Das botanische Buch. Kelchblatt, Blütenblatt, Staubgefäß und Stempel erweisen sich als ein einziges verwandeltes Organ, und dieses Organ ist das Blatt.',
        },
      ],
    },
  },
};
