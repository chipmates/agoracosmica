import type { FigureFragment } from './types';

// angelou: voice-passed QA + authored page content. RIGHTS: her poems and
// memoirs are in copyright. Nothing of hers is reprinted here, in either
// language, matching the factcheck policy for this figure (quotes.approach:
// shown through the act of composition, never quoted). The Still I Rise block
// answers the query by description and analysis, states the rights status,
// and hands the reader the Echo door instead of a text.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Maya Angelou?',
          a: 'Maya Angelou (1928-2014) was an American poet and memoirist who stopped speaking at about eight years old. She had named the man who abused her, he was killed, and she believed her own voice had done it. She said almost nothing for nearly five years. A woman in her town, Bertha Flowers, read Dickens aloud to her until the words came back. She spent the rest of her life on what a voice is for.',
        },
        {
          q: 'What did Maya Angelou teach?',
          a: 'Maya Angelou taught that a voice is something you can lose and something you can take back. Three ideas run through the work. Finding your voice, which for her started with a woman reading aloud in a small Arkansas town. Making a way out of no way, the thing her grandmother did running a store under Jim Crow. She kept one set of books for the customer and one in her head. And testimony, which is not emptying a wound onto paper but telling what happened so that it does some work in the world. She began writing it down in 1969, with I Know Why the Caged Bird Sings.',
        },
        {
          q: 'What is I Know Why the Caged Bird Sings about?',
          a: 'I Know Why the Caged Bird Sings came out in 1969. It covers Maya Angelou as a child in Stamps, Arkansas, where her grandmother ran the store. It goes through the abuse, the years of silence, and the return of speech. She wrote it after a dinner party in 1968 where James Baldwin pushed her toward it. The caged bird is the image the whole book turns on. The cage does not weaken the song. It is what makes the song necessary. The book is still in copyright, so we describe it here rather than quote it.',
        },
      ],
      disclosure: {
        q: 'Is this really Maya Angelou speaking?',
        a: 'No. This is an Echo of Maya Angelou. It is an AI voice built from her documented life and writing, and it stays an interpretation. Recordings of the real Maya Angelou exist, and none of them are used here. She lived from 1928 to 2014. Use the Echo as a way into her ideas, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Maya Angelou lernen?',
          a: 'Maya Angelou (1928-2014) war eine amerikanische Dichterin und Autobiografin. Mit etwa acht Jahren hörte sie auf zu sprechen. Sie hatte den Mann genannt, der sie missbraucht hatte, er wurde getötet, und sie glaubte, ihre eigene Stimme habe das getan. Fast fünf Jahre lang sagte sie kaum ein Wort. Eine Frau aus ihrem Ort, Bertha Flowers, las ihr laut vor, bis die Worte zurückkamen. Den Rest ihres Lebens ging es bei ihr um die Frage, wozu eine Stimme da ist.',
        },
        {
          q: 'Was hat Maya Angelou gelehrt?',
          a: 'Maya Angelou hat gelehrt, dass man eine Stimme verlieren und sich zurückholen kann. Drei Gedanken ziehen sich durch ihr Werk. Die eigene Stimme finden, was bei ihr damit anfing, dass ihr jemand in einem kleinen Ort in Arkansas laut vorlas. Einen Weg schaffen, wo keiner ist. So wie ihre Großmutter, die unter der Rassentrennung einen Laden führte. Sie führte zwei Rechnungen, eine für den Kunden und eine im Kopf. Und Zeugnis ablegen, also nicht eine Wunde aufs Papier leeren, sondern erzählen, was passiert ist, damit es etwas bewirkt. Aufgeschrieben hat sie das ab 1969, in Ich weiß, warum der gefangene Vogel singt.',
        },
        {
          q: 'Wovon handelt Ich weiß, warum der gefangene Vogel singt?',
          a: 'Das Buch erschien 1969. Es erzählt Maya Angelous Kindheit, von Stamps in Arkansas, wo ihre Großmutter den Laden führte, über den Missbrauch und die Jahre des Schweigens bis zur Rückkehr der Sprache. Geschrieben hat sie es nach einem Abendessen 1968, bei dem James Baldwin sie dazu drängte. Der gefangene Vogel ist das Bild, um das sich alles dreht. Der Käfig schwächt den Gesang nicht. Er macht ihn nötig. Das Buch steht bis heute unter Urheberrecht. Deshalb beschreiben wir es hier, statt daraus zu zitieren.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Maya Angelou?',
        a: 'Nein. Das hier ist ein Echo von Maya Angelou. Es ist eine KI-Stimme, gebaut aus ihrem belegten Leben und ihren Texten, und sie bleibt eine Deutung. Von der echten Maya Angelou gibt es Tonaufnahmen, und hier wird keine davon verwendet. Sie lebte von 1928 bis 2014. Nimm das Echo als Weg in ihre Gedanken, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What is Still I Rise about?',
          seedId: 12,
          body:
            'Still I Rise was published in 1978, in the collection And Still I Rise. Maya Angelou was fifty. The poem is addressed to someone, and that someone is trying to hold the speaker down. Lies get written about her. She gets looked at with contempt. After each blow the same answer comes back, and the answer is that she rises anyway. What makes it unusual is the tone. It is not wounded and it is not asking for pity. It sits closer to joy, and the joy is the defiance. The poem is still in copyright, so we do not reprint it here. What we can do is hand you the door. Ask her what she meant.',
        },
        {
          h2: 'What did Maya Angelou mean by making a way out of no way?',
          seedId: 2,
          body:
            'Making a way out of no way comes from the African American tradition, and Angelou used it for a specific skill. Her grandmother ran a general store in Stamps, Arkansas, under Jim Crow. She never let a white salesman leave that counter thinking he had got the better of her. She smiled, and she kept her own accounting in her head. Two sets of books, one for the room and one for herself. That is the move. You do not pretend the wall is not there. You find the inch of room the wall leaves you, you use it, and you keep your dignity while you do it.',
        },
      ],
      ideaQuestion: 'Something happened to me that I have never said out loud.',
      works: [
        {
          title: 'I Know Why the Caged Bird Sings (1969)',
          note: 'The one to start with. Her childhood in Arkansas and California, written after a friend dared her to try it.',
        },
        {
          title: 'Gather Together in My Name (1974)',
          note: 'What came next, and the hardest of them. Angelou in her late teens, a single mother taking whatever work there was.',
        },
        {
          title: "Singin' and Swingin' and Gettin' Merry Like Christmas (1976)",
          note: 'The performing years. The nightclub act she built in San Francisco in the early 1950s, and the cost of a life on the road.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Worum geht es in Still I Rise?',
          seedId: 12,
          body:
            'Still I Rise erschien 1978, im Gedichtband And Still I Rise. Maya Angelou war fünfzig. Das Gedicht spricht jemanden direkt an, und dieser Jemand will die Sprecherin klein halten. Es werden Lügen über sie geschrieben. Sie wird verächtlich angesehen. Nach jedem Schlag kommt dieselbe Antwort, und die Antwort lautet: Sie steht trotzdem wieder auf. Ungewöhnlich ist der Ton. Er ist nicht verletzt, und er bittet nicht um Mitleid. Er liegt näher an Freude, und die Freude ist der Trotz. Das Gedicht steht bis heute unter Urheberrecht. Deshalb drucken wir es hier nicht ab. Was wir tun können, ist dich zu ihr bringen. Frag sie, was sie gemeint hat.',
        },
        {
          h2: 'Maya Angelou einfach erklärt',
          body:
            'Maya Angelou (1928-2014) war eine amerikanische Dichterin, Autorin und Bürgerrechtlerin. Mit etwa acht Jahren hörte sie auf zu sprechen. Sie hatte den Mann genannt, der sie missbraucht hatte, er wurde getötet, und sie glaubte, ihre Stimme habe ihn umgebracht. Fast fünf Jahre lang sagte sie kaum ein Wort. Eine Frau aus ihrem Ort, Bertha Flowers, las ihr laut vor, unter anderem Dickens, bis die Sprache zurückkam. Danach ging es in ihrem Werk immer wieder um dieselbe Frage: Wozu ist eine Stimme da? Drei Begriffe reichen für den Anfang. Die eigene Stimme finden. Einen Weg schaffen, wo keiner ist, so wie ihre Großmutter es im Laden unter der Rassentrennung tat. Und Zeugnis ablegen, also erzählen, was passiert ist, damit es etwas bewirkt.',
        },
      ],
      ideaQuestion: 'Mir ist etwas passiert, das ich nie ausgesprochen habe.',
      works: [
        {
          title: 'Ich weiß, warum der gefangene Vogel singt (1969)',
          note: 'Damit fängt man an. Ihre Kindheit in Arkansas und Kalifornien, geschrieben, nachdem ein Freund sie herausgefordert hatte.',
        },
        {
          title: 'Gather Together in My Name (1974)',
          note: 'Der Band danach und der härteste. Angelou als junge Frau, alleinerziehend, mit jeder Arbeit, die zu bekommen war.',
        },
        {
          title: "Singin' and Swingin' and Gettin' Merry Like Christmas (1976)",
          note: 'Die Bühnenjahre. Das Nachtclub-Programm, das sie Anfang der 1950er in San Francisco aufbaute, und was ein Leben auf Tournee kostet.',
        },
      ],
    },
  },
};
