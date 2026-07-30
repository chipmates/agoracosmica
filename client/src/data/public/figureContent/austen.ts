import type { FigureFragment } from './types';

// austen: voice-passed QA + authored page content. Her novels are public
// domain, so lines are quoted verbatim. The DE concept carries the live
// German query for the Pride and Prejudice opening, in the wording the seed
// already uses. Biography from factchecks/{en,de} only, dates included.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Jane Austen?',
          a: "Jane Austen (1775-1817) was an English novelist who finished six novels and never saw her name on a title page. The first one appeared as 'By a Lady'. She wrote about women with little money and less power, facing the one decision that would set the rest of their lives. Her real subject is the gap between what a person says and what their hands are doing. With her, you learn to read what people do not say.",
        },
        {
          q: 'What did Jane Austen teach?',
          a: 'Jane Austen taught a way of watching people. Three things carry it. Observation first. Watch someone greet a person they were running down yesterday, and do not listen to the words, which will be all warmth. Watch the hands, the posture, the timing of the laugh. Then judgment. Charm can hide a bad character as easily as awkwardness can hide a good one, so you learn to tell real worth from a convincing copy of it. And money, always. She counts it out on the page, ten thousand a year, twenty pounds a year, because what a person can afford is what a person can choose.',
        },
        {
          q: "How does Jane Austen get inside a character's head?",
          a: "Austen worked out a move that novels had barely used before. The narrator slips into a character and reports their thoughts without announcing the switch, so you get the character in the narrator's voice. Scholars call it free indirect discourse. What it does is simple and slightly cruel. You feel what she feels while you can also see what she is missing. You are inside her and outside her at the same time. That is why an Austen heroine can be wrong for three hundred pages and still keep you on her side.",
        },
      ],
      disclosure: {
        q: 'Is this really Jane Austen speaking?',
        a: 'No. This is an Echo of Jane Austen. It is an AI voice built from her novels and her documented life, and it stays an interpretation, not a recording. The real writer lived from 1775 to 1817, and no recording of her exists. Use it as a way into her books, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Jane Austen lernen?',
          a: 'Jane Austen (1775-1817) war eine englische Schriftstellerin. Sie schrieb sechs Romane fertig und sah ihren Namen nie auf einer Titelseite. Der erste erschien als Werk einer Dame. Sie schrieb über Frauen mit wenig Geld und noch weniger Macht, vor der einen Entscheidung, die den Rest ihres Lebens festlegen würde. Ihr eigentliches Thema ist die Lücke zwischen dem, was jemand sagt, und dem, was seine Hände tun. Bei ihr lernst du zu lesen, was Menschen nicht sagen.',
        },
        {
          q: 'Was hat Jane Austen gelehrt?',
          a: 'Jane Austen hat eine Art gelehrt, Menschen zu beobachten. Drei Dinge tragen sie. Erstens das Hinsehen. Sieh zu, wie jemand einen Menschen begrüßt, über den er gestern noch hergezogen ist. Hör nicht auf die Worte, die klingen herzlich. Sieh auf die Hände, die Haltung, den Moment des Lachens. Zweitens das Urteil. Charme kann einen schlechten Charakter verdecken, so wie Unbeholfenheit einen guten verdecken kann. Also lernst du, echten Wert von einer guten Kopie zu unterscheiden. Und drittens das Geld. Sie rechnet es auf der Seite vor, zehntausend im Jahr, zwanzig Pfund im Jahr, denn was jemand sich leisten kann, ist das, was er wählen kann.',
        },
        {
          q: 'Wie kommt Jane Austen in den Kopf ihrer Figuren?',
          a: 'Austen fand einen Kniff, den der Roman vorher kaum kannte. Die Erzählerin rutscht in eine Figur hinein und gibt deren Gedanken wieder, ohne den Wechsel anzukündigen. Man liest die Figur in der Stimme der Erzählerin. In der Literaturwissenschaft heißt das erlebte Rede. Der Effekt ist einfach und ein bisschen gemein. Du fühlst, was sie fühlt, und siehst zugleich, was sie übersieht. Du bist in ihr drin und stehst daneben. Deshalb kann eine Austen-Heldin dreihundert Seiten lang danebenliegen und dich trotzdem auf ihrer Seite halten.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Jane Austen?',
        a: 'Nein. Das hier ist ein Echo von Jane Austen. Es ist eine KI-Stimme, gebaut aus ihren Romanen und ihrem belegten Leben, und sie bleibt eine Deutung, keine Aufnahme. Die echte Schriftstellerin lebte von 1775 bis 1817, und von ihr gibt es keine Aufnahme. Nimm es als Weg in ihre Bücher, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What does the first line of Pride and Prejudice mean?',
          seedId: 3,
          body:
            'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. That is the opening of Pride and Prejudice, published in 1813, and the joke is in the first four words. Universally acknowledged by whom? Not by the single man. By the mothers in the neighbourhood who have daughters and nothing to leave them. Austen states their wish as if it were a law of nature and lets you hear the difference. One sentence, and you already know what the book is about. Marriage here is not romance first. It is the only career on offer, and everyone in the room knows it.',
        },
        {
          h2: 'Did Jane Austen ever accept a proposal?',
          seedId: 8,
          body:
            'Once, for one night. On 2 December 1802, Harris Bigg-Wither proposed to her. He was the heir to Manydown Park, six years younger than she was, and the brother of two of her closest friends. Saying yes would have made her mother and her sister safe for life. She accepted that evening. The next morning she withdrew. Three years later her father died, and because his income came with his post as a clergyman, it stopped the day he did. From then on the three women lived on what her brothers gave them. She never married. Every novel she wrote after that turns on a woman working out what a proposal is really worth.',
        },
      ],
      ideaQuestion: 'How do I know if I like this person or just like being chosen?',
      works: [
        {
          title: 'Sense and Sensibility (1811)',
          note: "The first one published, and the title page said only 'By a Lady'. Two sisters, one who shows everything and one who shows nothing, and neither way works on its own.",
        },
        {
          title: 'Pride and Prejudice (1813)',
          note: 'Begun in 1796 as First Impressions, when she was twenty. The book about how long it takes to notice you were wrong about someone.',
        },
        {
          title: 'Mansfield Park (1814)',
          note: 'The uncomfortable one. A poor relation raised inside a rich house, and a family fortune that quietly comes from a plantation in Antigua.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Es ist eine allgemein anerkannte Wahrheit: Was meint Austen damit?',
          seedId: 3,
          body:
            'Es ist eine allgemein anerkannte Wahrheit, dass ein unverheirateter Mann im Besitz eines schönen Vermögens eine Frau braucht. So beginnt Pride and Prejudice, auf Deutsch Stolz und Vorurteil, erschienen 1813. Der Witz steckt schon im ersten Halbsatz. Allgemein anerkannt von wem? Vom Mann jedenfalls nicht. Von den Müttern der Nachbarschaft, die Töchter haben und nichts, was sie ihnen hinterlassen könnten. Austen formuliert deren Wunsch, als wäre er ein Naturgesetz, und lässt dich den Unterschied hören. Ein Satz, und du weißt, worum es im Buch geht. Die Ehe ist hier nicht zuerst Romantik. Sie ist der einzige Beruf, der offensteht, und im Zimmer weiß das jeder.',
        },
        {
          h2: 'Jane Austen einfach erklärt',
          body:
            'Jane Austen (1775-1817) war eine englische Schriftstellerin. Sie lebte in Hampshire, schrieb sechs Romane fertig und veröffentlichte sie anonym. Ihr Stoff ist immer derselbe: eine junge Frau ohne eigenes Geld muss entscheiden, wen sie heiratet, und diese Entscheidung legt alles Weitere fest. Drei Dinge machen ihre Bücher aus. Erstens die Beobachtung. Sie schaut nicht auf das, was gesagt wird, sondern auf Hände, Haltung und Timing. Zweitens die Ironie. Sie schreibt einen Satz so, dass er zugleich stimmt und lächerlich ist. Drittens das Geld. Sie nennt konkrete Summen, weil in dieser Welt das Einkommen darüber entscheidet, wer wählen darf. 1802 nahm sie selbst einen Heiratsantrag an und zog die Zusage am nächsten Morgen zurück. Sie blieb unverheiratet und starb 1817 mit 41 Jahren.',
        },
      ],
      ideaQuestion: 'Woher weiß ich, ob ich diesen Menschen mag oder nur, dass mich jemand will?',
      works: [
        {
          title: 'Sense and Sensibility (1811)',
          note: 'Auf Deutsch Verstand und Gefühl. Der erste veröffentlichte Roman, auf der Titelseite stand nur, er sei von einer Dame. Zwei Schwestern, eine zeigt alles, die andere nichts, und allein trägt keine der beiden Arten.',
        },
        {
          title: 'Pride and Prejudice (1813)',
          note: 'Auf Deutsch Stolz und Vorurteil. Begonnen 1796 als First Impressions, da war sie zwanzig. Das Buch darüber, wie lange man braucht, um zu merken, dass man sich in jemandem getäuscht hat.',
        },
        {
          title: 'Mansfield Park (1814)',
          note: 'Der unbequeme Roman. Ein armes Mädchen wächst im reichen Haus der Verwandten auf, und das Familienvermögen stammt still und leise von einer Plantage auf Antigua.',
        },
      ],
    },
  },
};
