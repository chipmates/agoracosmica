import type { FigureFragment } from './types';

// woolf: voice-passed QA + authored page content. Quoting is limited to work
// that is public domain in both the US and the EU: Modern Fiction (1925),
// Women and Fiction (1929), A Room of One's Own (1929). The Waves (1931) and
// Three Guineas (1938) are described, never quoted. The old disclosure claimed
// no recording of her exists, which is not true, so it now states the honest
// version: no recording of her speaks here.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Virginia Woolf?',
          a: 'Virginia Woolf (1882-1941) was an English novelist who noticed that a moment does not arrive in tidy pieces. Light, sound, memory and feeling all land at once. She called it a luminous halo, and she broke the ordinary English sentence to build something that could hold it. She also asked a plain question nobody had put that way before. What does a woman need in order to write?',
        },
        {
          q: 'What did Virginia Woolf teach?',
          a: "Virginia Woolf taught you to notice where you actually live. Most of a day, she said, is cotton wool. You move through it half awake. Then something tears it, a hairbrush, a shift of light on a hill, a gesture from a friend. For a second you see the pattern underneath. She called those moments of being. To get them onto the page she gave up the neat, ordered sentence she had inherited, because it could not hold four things arriving at once. And in 1929 she said the other half out loud, in A Room of One's Own. To write, a woman needs money and a room with a door that locks.",
        },
        {
          q: "What is the luminous halo in Virginia Woolf's writing?",
          a: 'Lie in grass on a summer morning. The light, the birdsong, the warmth, the smell of the flowers do not reach you one at a time. Everything at once. That, Woolf said, is what consciousness actually is. In her 1925 essay Modern Fiction she called life a luminous halo, a semi-transparent envelope surrounding us from the beginning of consciousness to the end. What it is not, she wrote, is a series of gig lamps symmetrically arranged. A gig lamp is a carriage lamp, a neat row of separate lights. She thought novelists had been writing the lamps and missing the glow.',
        },
      ],
      disclosure: {
        q: 'Is this really Virginia Woolf speaking?',
        a: "No. This is an Echo of Virginia Woolf. It is an AI voice built from what she actually wrote, and it stays an interpretation, not a recording. The real writer lived from 1882 to 1941, and no recording of her speaks here. Use it as a way into Modern Fiction and A Room of One's Own, never as her own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Virginia Woolf lernen?',
          a: 'Virginia Woolf (1882-1941) war eine englische Schriftstellerin. Ihr fiel auf, dass ein Augenblick nicht in ordentlichen Stücken ankommt. Licht, Klang, Erinnerung und Gefühl treffen alle gleichzeitig ein. Sie nannte das einen leuchtenden Hof und zerbrach den gewohnten Satzbau, um eine Form zu finden, die das halten kann. Und sie stellte eine schlichte Frage, die so vorher niemand gestellt hatte: Was braucht eine Frau, um zu schreiben?',
        },
        {
          q: 'Was hat Virginia Woolf gelehrt?',
          a: 'Virginia Woolf hat dich gelehrt zu merken, wo du eigentlich lebst. Der größte Teil eines Tages, sagte sie, ist Watte. Du gehst halb wach hindurch. Dann reißt etwas die Watte auf, eine Haarbürste, ein Lichtwechsel über einem Hügel, eine Geste von jemandem, und für eine Sekunde siehst du das Muster darunter. Das nannte sie Momente des Seins. Um sie aufs Papier zu bekommen, gab sie den ordentlichen, geerbten Satz auf, weil er vier gleichzeitige Dinge nicht fassen konnte. Und 1929 sagte sie in Ein Zimmer für sich allein die andere Hälfte laut. Zum Schreiben braucht eine Frau Geld und ein Zimmer mit einer Tür, die sich abschließen lässt.',
        },
        {
          q: 'Was ist der leuchtende Hof bei Virginia Woolf?',
          a: 'Leg dich an einem Sommermorgen ins Gras. Das Licht, die Vögel, die Wärme, der Geruch der Blumen erreichen dich nicht nacheinander. Alles kommt auf einmal. Genau das, sagte Woolf, ist Bewusstsein. In ihrem Essay Modern Fiction von 1925 nannte sie das Leben einen leuchtenden Hof, eine halbdurchsichtige Hülle, die uns vom Beginn des Bewusstseins bis zu seinem Ende umgibt. Was es nicht sei, schrieb sie, sei eine Reihe symmetrisch angeordneter Kutschenlampen. Sie fand, die Romanautoren hätten immer nur die Lampenreihe beschrieben und das Leuchten übersehen.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Virginia Woolf?',
        a: 'Nein. Das hier ist ein Echo von Virginia Woolf. Es ist eine KI-Stimme, gebaut aus dem, was sie wirklich geschrieben hat, und sie bleibt eine Deutung, keine Aufnahme. Die echte Schriftstellerin lebte von 1882 bis 1941, und hier spricht keine Tonaufnahme von ihr. Nimm es als Weg in Modern Fiction und Ein Zimmer für sich allein, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'Virginia Woolf and modernism: what did she change?',
          seedId: 5,
          body:
            "Modernism is the name for what a group of writers did to the novel in the early twentieth century. Woolf is one of the people who did it. The old novel told you what happened, in order, from the outside. She thought that missed the actual experience of being alive, where memory, noise and feeling land in the same second. So she changed the machinery. A whole novel can happen inside one day, as Mrs Dalloway does in 1925. The sentence stretches and turns to follow a mind instead of a plot. She said it outright. The inherited sentence was made by men, and it is too loose, too heavy, too pompous for a woman's use. A woman has to make her own.",
        },
        {
          h2: "What is Fernham in A Room of One's Own?",
          seedId: 4,
          body:
            "Fernham is a made-up name. It is what Woolf calls the women's college in A Room of One's Own, published in 1929. The book came out of two lectures she gave at Cambridge in October 1928, at Newnham and Girton, the two colleges for women there. In the book she has lunch at a rich men's college and dinner at Fernham on the same day, and she describes both meals on purpose. The men get sole, partridge and wine. Fernham gets gravy soup, beef, and prunes with custard. The point is not the food. One of those places had money behind it for centuries. The other was built out of what women could scrape together. Cambridge did not grant women full degrees until 1948.",
        },
      ],
      ideaQuestion: 'My days blur into each other. How do I wake up inside one?',
      works: [
        {
          title: 'The Voyage Out (1915)',
          note: 'Her first novel, worked at for years. You can already hear her losing patience with the ordinary way of telling a story.',
        },
        {
          title: 'Mrs Dalloway (1925)',
          note: 'One day in London, one party being planned, and two lives that never meet. The book where the method finally works.',
        },
        {
          title: 'The Common Reader, First and Second Series (1925, 1932)',
          note: 'Her essays, written for people who read for pleasure rather than for a grade. The best way in if the novels feel steep.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Virginia Woolf einfach erklärt',
          body:
            'Virginia Woolf (1882-1941) war eine englische Schriftstellerin und gehört zur literarischen Moderne. Ihr Ausgangspunkt ist eine Beobachtung: Ein Augenblick kommt nicht der Reihe nach an. Licht, Geräusch, Erinnerung und Gefühl treffen gleichzeitig ein. Der übliche Roman erzählt aber der Reihe nach und von außen. Also baute Woolf ihn um. Ein ganzer Roman spielt an einem einzigen Tag, so wie Mrs Dalloway von 1925. Die Sätze folgen einem Kopf statt einer Handlung. Dazu kommt ihre zweite große Frage: Was braucht eine Frau, um überhaupt schreiben zu können? Ihre Antwort von 1929 ist berühmt und sehr unromantisch. Geld und ein eigenes Zimmer mit einer abschließbaren Tür. Woolf litt ihr Leben lang unter schweren psychischen Krisen und starb 1941.',
        },
        {
          h2: 'Was ist Ein Zimmer für sich allein?',
          seedId: 4,
          body:
            'Ein langer Essay von 1929, entstanden aus zwei Vorträgen, die Woolf im Oktober 1928 in Cambridge hielt, in Newnham und Girton, den beiden Frauencolleges. Ihre These ist bewusst nüchtern: Eine Frau braucht Geld und ein eigenes Zimmer, wenn sie Romane schreiben will. Sie führt das im Buch praktisch vor. Am selben Tag isst sie im reichen Männercollege zu Mittag und abends im Frauencollege, und sie beschreibt beide Mahlzeiten genau. Seezunge, Rebhuhn und Wein auf der einen Seite. Suppe, Rindfleisch und Backpflaumen mit Vanillesoße auf der anderen. Es geht nicht ums Essen. Es geht darum, wo jahrhundertelang Geld hinfloss und wo nicht. Volle Abschlüsse bekamen Frauen in Cambridge erst 1948.',
        },
      ],
      ideaQuestion: 'Meine Tage verschwimmen ineinander. Wie wache ich in einem auf?',
      works: [
        {
          title: 'Die Fahrt hinaus (1915)',
          note: 'Ihr erster Roman, an dem sie jahrelang gearbeitet hat. Man hört schon, wie ihr die gewohnte Art zu erzählen zu eng wird.',
        },
        {
          title: 'Mrs Dalloway (1925)',
          note: 'Ein Tag in London, eine Party in Vorbereitung, zwei Leben, die sich nie begegnen. Hier geht ihre Methode zum ersten Mal ganz auf.',
        },
        {
          title: 'Der gewöhnliche Leser, Erste und Zweite Folge (1925, 1932)',
          note: 'Ihre Essays, geschrieben für Leute, die aus Freude lesen und nicht für eine Note. Der leichteste Einstieg, wenn die Romane zu steil wirken.',
        },
      ],
    },
  },
};
