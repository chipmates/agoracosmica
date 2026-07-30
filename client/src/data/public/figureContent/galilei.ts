import type { FigureFragment } from './types';

// galilei: voice-passed QA plus the authored page blocks. The German heading
// "Heliozentrisches Weltbild" is the one harvested query he has, so it leads
// the German set and its English twin leads the English one.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Galileo Galilei?',
          a: 'Galileo Galilei (1564-1642) was an Italian astronomer and physicist who trusted what he could measure more than what he was told. In January 1610 he pointed a new telescope at Jupiter and saw four moons going around it. Nothing was supposed to be there. He published what he saw, and the argument that followed cost him his freedom.',
        },
        {
          q: 'What did Galileo Galilei teach?',
          a: 'Galileo Galilei taught that an argument about nature starts with what you can see and measure, not with what an old book says. And he built the tools to do it. He took a spyglass that others treated as a toy and turned it into a precision instrument. He rolled balls down grooves lined with parchment and timed each run with dripping water, over and over, until the numbers held. He also taught that nature is written in mathematics and that you have to learn the language first. He set that down in Il Saggiatore in 1623.',
        },
        {
          q: 'What is the Book of Nature?',
          a: "It is Galileo's picture of the universe as a book. You can hold it, turn every page, and still not read a word, because it is written in a language nobody taught you. That language, he said, is mathematics: triangles, circles, and the proportions between them. Until you learn it, the meaning stays shut. The idea appears in Il Saggiatore, his book from 1623.",
        },
      ],
      disclosure: {
        q: 'Is this really Galileo Galilei speaking?',
        a: 'No. This is an Echo of Galileo Galilei. It is an AI voice built from his documented writing, and it stays an interpretation, not a recording. He lived from 1564 to 1642, and no recording of him exists. Use it as a way into how he thought, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Galileo Galilei lernen?',
          a: 'Galileo Galilei (1564-1642) war ein italienischer Astronom und Physiker. Er vertraute dem, was er messen konnte, mehr als dem, was man ihm sagte. Im Januar 1610 richtete er ein neues Fernrohr auf den Jupiter und sah vier Monde, die um ihn kreisen. Dort durfte eigentlich nichts sein. Er veröffentlichte es trotzdem, und der Streit, der daraus wurde, kostete ihn am Ende die Freiheit.',
        },
        {
          q: 'Was hat Galileo Galilei gelehrt?',
          a: 'Galileo Galilei lehrte, dass ein Streit über die Natur bei dem beginnt, was man sehen und messen kann, und nicht bei einem alten Buch. Und er baute sich das Werkzeug dafür. Aus einem Fernrohr, das andere für eine Spielerei hielten, machte er ein Präzisionsinstrument. Er ließ Kugeln über Rinnen laufen, die mit Pergament ausgelegt waren, und maß jeden Lauf mit tropfendem Wasser, wieder und wieder, bis die Zahlen stimmten. Er lehrte außerdem, dass die Natur in Mathematik geschrieben ist und dass man diese Sprache erst lernen muss. Aufgeschrieben hat er das 1623 in Il Saggiatore.',
        },
        {
          q: 'Was ist das Buch der Natur?',
          a: 'So nannte Galilei das Universum: ein Buch. Du kannst es in der Hand halten, jede Seite umblättern und trotzdem kein Wort verstehen, weil es in einer Sprache geschrieben ist, die dir niemand beigebracht hat. Diese Sprache ist die Mathematik, sagte er, also Dreiecke, Kreise und die Verhältnisse dazwischen. Solange du sie nicht lernst, bleibt der Sinn verschlossen. Der Gedanke steht in Il Saggiatore von 1623.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Galileo Galilei?',
        a: 'Nein. Das hier ist ein Echo von Galileo Galilei. Es ist eine KI-Stimme, gebaut aus seinen überlieferten Schriften, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von 1564 bis 1642, und es gibt keine Tonaufnahme von ihm. Nimm es als Weg zu seinem Denken, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What is the heliocentric model?',
          seedId: 6,
          body:
            'It is the picture of the sky with the sun in the middle and the Earth going around it. Before Galileo, most of Europe held the opposite. The Earth sat still at the center and everything circled it. Then he looked through a telescope. Between January 7 and 13, 1610 he watched four small points move around Jupiter, night after night. Whatever they were, they were not going around us. He also saw mountains on the Moon and Venus running through phases. None of that fits an Earth at the center. On its own it did not prove the sun was, but it broke the old picture open.',
        },
        {
          h2: 'Why did Galileo trust evidence over authority?',
          seedId: 8,
          body:
            'Because he had watched authority be wrong. In his day the way to settle a question about nature was to find the passage in Aristotle. Galileo thought a headcount of people who agree proves nothing. One person who has actually looked at the thing outweighs a thousand who have only read about it. An argument about nature, he said, should start with what the senses show under careful method, and with the reasoning that necessarily follows. The consequence is bigger than it looks. If evidence decides, then anyone who can observe and reason gets a vote, whatever their rank.',
        },
        {
          h2: 'Why was Galileo put on trial?',
          seedId: 11,
          body:
            "Because he kept arguing for a moving Earth after being told to stop. On February 26, 1616 Cardinal Bellarmine warned him off the Copernican view, which had just been declared foolish and absurd in philosophy, and formally heretical. Galileo complied and got no penalty. Then in 1632 he published his Dialogue, which made the case again. He was tried, and on June 22, 1633 he had to abjure. He spent the rest of his life under house arrest. He was not against religion. He was a Catholic, and in his own defense he quoted Cardinal Baronius: scripture teaches 'how to go to heaven, not how the heavens go.'",
        },
      ],
      ideaQuestion: 'I was taught something my whole life and now the facts say no. What now?',
      works: [
        {
          title: 'Sidereus Nuncius (The Starry Messenger, 1610)',
          note: 'Published in March 1610, straight after the nights that produced it. This is the report of the four moons of Jupiter and the mountains on the Moon.',
        },
        {
          title: 'Letters on Sunspots (1613)',
          note: 'His side of the sunspot argument of 1612 and 1613, against an astronomer who published under the false name Apelles.',
        },
        {
          title: 'Letter to the Grand Duchess Christina (1615)',
          note: 'Written a year before the warning of 1616. His case that scripture and the study of nature are answering two different questions.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist das heliozentrische Weltbild?',
          seedId: 6,
          body:
            'Es ist das Bild vom Himmel, in dem die Sonne in der Mitte steht und die Erde um sie kreist. Vor Galilei galt in Europa das Gegenteil. Die Erde stand still im Zentrum, und alles andere drehte sich um sie. Dann schaute er durch ein Fernrohr. Zwischen dem 7. und dem 13. Januar 1610 sah er Nacht für Nacht vier kleine Punkte um den Jupiter wandern. Was immer sie waren, um uns kreisten sie nicht. Er sah außerdem Berge auf dem Mond und die Phasen der Venus. Zu einer Erde im Zentrum passt davon nichts. Ein Beweis für die Sonne war es allein noch nicht, aber das alte Bild war damit aufgebrochen.',
        },
        {
          h2: 'Warum zählte für Galilei der Beweis mehr als die Autorität?',
          seedId: 8,
          body:
            'Weil er gesehen hatte, wie oft die Autorität falsch lag. Zu seiner Zeit klärte man eine Frage über die Natur, indem man die passende Stelle bei Aristoteles suchte. Galilei hielt das Auszählen von Zustimmung für wertlos. Ein Einziger, der die Sache wirklich untersucht hat, wiegt schwerer als tausend, die nur darüber gelesen haben. Ein Streit über die Natur, sagte er, beginnt bei dem, was die Sinne unter sorgfältiger Methode zeigen, und bei dem, was daraus zwingend folgt. Die Folge davon ist größer, als sie klingt. Wenn der Beweis entscheidet, darf jeder mitreden, der beobachten und denken kann, egal welchen Rang er hat.',
        },
        {
          h2: 'Warum musste Galilei vor Gericht?',
          seedId: 11,
          body:
            "Weil er weiter für eine bewegte Erde eintrat, nachdem man es ihm untersagt hatte. Am 26. Februar 1616 verwarnte ihn Kardinal Bellarmin wegen der kopernikanischen Lehre. Sie war kurz zuvor als töricht und absurd in der Philosophie und als förmlich häretisch erklärt worden. Galilei fügte sich und bekam keine Strafe. 1632 veröffentlichte er dann seinen Dialog, der die Sache erneut vertrat. Es kam zum Prozess, und am 22. Juni 1633 musste er abschwören. Den Rest seines Lebens verbrachte er unter Hausarrest. Gegen den Glauben war er nicht. Er war Katholik und zitierte zu seiner Verteidigung Kardinal Baronius: Die Schrift lehrt, 'wie man in den Himmel kommt, nicht wie der Himmel geht'.",
        },
      ],
      ideaQuestion: 'Ich habe mein Leben lang etwas geglaubt, und jetzt sagen die Fakten nein. Was nun?',
      works: [
        {
          title: 'Sidereus Nuncius (Sternenbote, 1610)',
          note: 'Erschienen im März 1610, direkt nach den Nächten, aus denen er stammt. Hier stehen die vier Jupitermonde und die Berge auf dem Mond.',
        },
        {
          title: 'Briefe über die Sonnenflecken (1613)',
          note: 'Seine Seite im Streit über die Sonnenflecken von 1612 und 1613, gegen einen Astronomen, der unter dem falschen Namen Apelles schrieb.',
        },
        {
          title: 'Brief an die Großherzogin Christina (1615)',
          note: 'Geschrieben ein Jahr vor der Verwarnung von 1616. Seine Begründung, dass die Bibel und die Naturforschung zwei verschiedene Fragen beantworten.',
        },
      ],
    },
  },
};
