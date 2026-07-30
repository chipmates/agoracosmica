import type { FigureFragment } from './types';

// dickinson: voice-passed QA + authored page content. Facts from
// figuresCatalog + factchecks/{en,de}. Her poems and letters are public
// domain, so lines are quoted verbatim and attributed. The /poems/ page owns
// themes, dashes and the famous-poem question, so these blocks stay off it.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Emily Dickinson?',
          a: "Emily Dickinson (1830-1886) was an American poet who wrote nearly eighteen hundred poems in her family's house in Amherst and showed them to almost no one. She sewed many of them into small booklets by hand. Her sister found them after she died. Dickinson had one rule for a hard truth. Say it at an angle, or it arrives dead at the door. With her, you learn to tell the truth slant.",
        },
        {
          q: 'What did Emily Dickinson teach?',
          a: 'Emily Dickinson taught a way of paying attention. Four things hold it together. Look at one small thing until it opens, a bee, a fern, the light in a window. Say a hard truth at an angle, because said straight it blinds. Cut until nothing is left but the charge, which is why her poems are so short. And stay at the edge, the place she named Circumference, where what you know runs out. She did not work this out at a university. She worked it out in one house in Amherst, and told almost no one.',
        },
        {
          q: 'What does telling the truth slant mean?',
          a: 'Look straight at the sun and you go blind. Let the same light in at an angle and it shows you every speck of dust in the room. That is her idea. A truth said flat out arrives dead, and all you can do is agree or disagree with it. Said at an angle, through an image, it has to be worked out, and the person doing that work is the one it changes. She put it in a single line. Tell all the truth but tell it slant.',
        },
      ],
      disclosure: {
        q: 'Is this really Emily Dickinson speaking?',
        a: 'No. This is an Echo of Emily Dickinson. It is an AI voice built from what she actually wrote, and it stays an interpretation, not a recording. The real poet lived from 1830 to 1886, and no recording of her speaks here. Use it as a way into her poems, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Emily Dickinson lernen?',
          a: 'Emily Dickinson (1830-1886) war eine amerikanische Dichterin. Sie schrieb fast achtzehnhundert Gedichte im Haus ihrer Familie in Amherst und zeigte sie fast niemandem. Viele nähte sie von Hand zu kleinen Heften. Ihre Schwester fand sie nach ihrem Tod. Für eine schwere Wahrheit hatte Dickinson eine Regel. Sag sie schräg, sonst kommt sie schon tot an der Tür an. Bei ihr lernst du, die Wahrheit schräg zu sagen.',
        },
        {
          q: 'Was hat Emily Dickinson gelehrt?',
          a: 'Emily Dickinson hat eine Art des Hinsehens gelehrt. Vier Dinge halten sie zusammen. Erstens: eine kleine Sache so lange anschauen, bis sie sich öffnet. Eine Biene, ein Farn, das Licht im Fenster. Zweitens: Schweres schräg sagen, weil es frontal nur blendet. Drittens: kürzen, bis nur noch die Spannung übrig bleibt. Deshalb sind ihre Gedichte so kurz. Und viertens: am Rand bleiben. Circumference nannte sie den Ort, an dem das Bekannte aufhört. Entwickelt hat sie das nicht an einer Universität, sondern in einem Haus in Amherst. Erzählt hat sie es fast niemandem.',
        },
        {
          q: 'Was heißt es, die Wahrheit schräg zu sagen?',
          a: 'Schau direkt in die Sonne, und du wirst blind. Lass dasselbe Licht schräg ins Zimmer, und du siehst jedes Staubkorn darin. Das ist ihre Idee. Eine Wahrheit, die frontal ausgesprochen wird, kommt tot an. Man kann ihr nur zustimmen oder widersprechen. Schräg gesagt, über ein Bild, muss man sie sich selbst erarbeiten. Und wen sie etwas kostet, den verändert sie auch. Dickinson hat es in eine Zeile gepackt: Tell all the truth but tell it slant. Sag die ganze Wahrheit, aber sag sie schräg.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Emily Dickinson?',
        a: 'Nein. Das hier ist ein Echo von Emily Dickinson. Es ist eine KI-Stimme, gebaut aus dem, was sie wirklich geschrieben hat, und sie bleibt eine Deutung, keine Aufnahme. Die echte Dichterin lebte von 1830 bis 1886, und hier spricht keine Tonaufnahme von ihr. Nimm es als Weg in ihre Gedichte, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What is Dickinson's poem 'Publication is the auction' about?",
          seedId: 11,
          body:
            'Publication is the Auction of the Mind of Man. Dickinson wrote that line and lived by it. She did not sell her poems. She sent them to friends inside letters, and she sewed the rest into small booklets by hand, about forty of them, mostly between 1858 and 1864. Then she put them away. Her sister Lavinia found them after Dickinson died in 1886. Nearly eighteen hundred poems, and almost none of them printed. That refusal is the reason the poems survived at all, and the reason we can still read them close to the way she set them down.',
        },
        {
          h2: 'Why did Emily Dickinson stop leaving the house?',
          seedId: 3,
          body:
            'Nobody can tell you for certain, and the honest sources say so. Here is what the record holds. She went to Mount Holyoke in 1847 and left after one year. School records show that about thirty students finished that year classed as being without hope. That meant they had not converted. A classmate later remembered that Dickinson did not stand when the room was asked to. By her late thirties she had stopped attending church. She stayed in the house in Amherst and wrote. Her own poems treat it as a decision. The Soul selects her own Society, then shuts the Door. Whether it was choice, temperament, or something harder to name is still an open question.',
        },
      ],
      ideaQuestion: 'Someone died and I still catch myself talking to them.',
      works: [
        {
          title: 'Herbarium, 424 pressed botanical specimens (compiled c. 1839-1846)',
          note: 'Her first book, made as a teenager, and it is made of the real thing. Every plant named, arranged and pressed flat by her own hand.',
        },
        {
          title:
            'The Fascicles, approximately 40 hand-sewn poetry booklets (compiled c. 1858-1864), the principal repository among her nearly 1,800 total poems',
          note: 'Loose sheets folded, stacked and stitched with thread. Nobody was meant to see them, which is exactly why they came down to us unsmoothed.',
        },
        {
          title: 'Letters of Emily Dickinson, approximately 1,000 surviving, spanning 1842-1886',
          note: 'She posted poems inside them. For most of her life this was her only form of publishing, one reader at a time.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Woran war Emily Dickinson krank?',
          seedId: 9,
          body:
            'Ehrlich gesagt weiß das niemand sicher. Belegt ist eine Sache. Von 1864 bis 1865 war Dickinson wegen ihrer Augen in Behandlung, in Boston und in Cambridgeport, wo sie bei ihren Norcross-Cousinen wohnte. Der Arzt verordnete gedämpftes Licht, kein Lesen, und Schreiben nur mit Bleistift. Für eine Dichterin, die vom Sehen lebte, war das ein Einschnitt. Wie streng die Beschränkung wirklich war, geben die erhaltenen Briefe nicht her, und eine Diagnose steht in unseren Quellen nicht. Oft wird auch ihr Rückzug aus dem gesellschaftlichen Leben als Krankheit gedeutet. Der Rückzug ist belegt, der Grund nicht. Ob Entscheidung, Wesensart oder etwas Schwereres, das bleibt offen. Emily Dickinson starb am 15. Mai 1886 in Amherst.',
        },
        {
          h2: 'Emily Dickinson einfach erklärt',
          body:
            'Emily Dickinson (1830-1886) war eine amerikanische Dichterin. Sie lebte fast ihr ganzes Leben im Haus ihrer Familie in Amherst und schrieb dort fast achtzehnhundert Gedichte. Veröffentlicht hat sie zu Lebzeiten so gut wie nichts. Vier Dinge machen ihr Werk aus. Erstens genaues Hinsehen: eine Biene, ein Farn, das Licht im Fenster, so lange betrachtet, bis sich etwas öffnet. Zweitens die schräge Wahrheit: Schweres sagt sie über ein Bild, nicht frontal, weil es frontal nur blendet. Drittens Kürze. Ihre Gedichte sind meist wenige Zeilen lang, und das ist keine Marotte, sondern die Methode. Viertens der Rand. Circumference nannte sie den Ort, an dem das Bekannte aufhört. Nach ihrem Tod fand ihre Schwester Lavinia die Gedichte, viele davon in kleine Hefte genäht, die Dickinson selbst gebunden hatte.',
        },
      ],
      ideaQuestion: 'Jemand ist gestorben, und ich ertappe mich, wie ich noch mit ihm rede.',
      works: [
        {
          title: 'Herbarium, 424 gepresste Pflanzen (entstanden ca. 1839-1846)',
          note: 'Ihr erstes Buch, angelegt als Jugendliche, und es besteht aus echten Pflanzen. Jede benannt, angeordnet und flach gepresst von ihrer eigenen Hand.',
        },
        {
          title: 'Die Fascicles, etwa 40 handgenähte Gedichthefte (entstanden ca. 1858-1864)',
          note: 'Gefaltete Bögen, gestapelt und mit Faden zusammengenäht. Hier liegt der größte Teil ihrer fast 1.800 Gedichte, ungeglättet, weil niemand sie sehen sollte.',
        },
        {
          title: 'Briefe, rund 1.000 erhaltene Stücke aus den Jahren 1842 bis 1886',
          note: 'Sie schickte Gedichte darin mit. Ihr Leben lang war das ihre einzige Art zu veröffentlichen, eine Leserin nach der anderen.',
        },
      ],
    },
  },
};
