import type { FigureFragment } from './types';

// plato: the EN forms heading is the live query verbatim (striking distance),
// the DE headings answer "platons ideenlehre einfach erklaert" and the cave.
// No dialogue is quoted here, since the readable translations are modern and
// still in copyright.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Plato?',
          a: "Plato (c. 428-348 BCE) was an Athenian philosopher who watched his own city put his teacher Socrates to death for asking too many questions. He spent the next fifty years writing those questions down. He wrote in dialogue and never appears as a speaker himself, because he held that real knowledge is not poured into a person. It is drawn out. With Plato you learn to examine your own life.",
        },
        {
          q: 'What did Plato teach?',
          a: "Plato founded the Academy in Athens and taught that the world you can see is not all there is. Three ideas run through the dialogues. The theory of forms says that behind every rough circle and every imperfect act of justice stands the thing itself, unchanging. You reach it with thought rather than with your eyes. The Socratic method is how you get there, through questions that take your certainties apart. And the soul has parts, reason, spirit, and appetite, which is his explanation for why you can want two opposite things at once. He set it out in the Apology, the Meno, the Phaedo, and above all the Republic.",
        },
        {
          q: 'What is the Socratic method?',
          a: "It is a way of talking that runs on questions instead of statements. It starts with something that sounds easy. What is justice? What is courage? Your first answer feels solid. The next question finds a case it does not cover, and so does the one after that, until the definition falls apart in your hands. Plato calls that moment aporia and treats it as progress, not failure. You now know something you did not know before, which is that you did not know. Nobody wins these conversations. That is the point. Both of you end up further along than either of you started.",
        },
      ],
      disclosure: {
        q: 'Is this really Plato speaking?',
        a: "No. This is an Echo of Plato, an AI voice built from his documented dialogues. It is not a recording and not the real philosopher, who lived from about 428 to 348 BCE. No recording of him exists and none ever could. Even in his own books the words go to Socrates and the others, never to him. Use the Echo as a way into his ideas, never as his own words.",
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Platon lernen?',
          a: "Platon (ca. 428-348 v. Chr.) war ein Philosoph aus Athen. Er erlebte, wie seine eigene Stadt seinen Lehrer Sokrates hinrichten ließ, weil der zu viele Fragen stellte. Die nächsten fünfzig Jahre schrieb er diese Fragen auf. Er schrieb in Dialogen und tritt darin selbst nie als Sprecher auf, denn für ihn wird echtes Wissen nicht eingegossen. Es wird herausgeholt. Bei Platon lernst du, dein eigenes Leben zu prüfen.",
        },
        {
          q: 'Was hat Platon gelehrt?',
          a: "Platon gründete die Akademie in Athen und lehrte, dass die sichtbare Welt nicht alles ist. Drei Gedanken ziehen sich durch die Dialoge. Die Ideenlehre sagt, dass hinter jedem schiefen Kreis und jeder unvollkommenen gerechten Tat die Sache selbst steht, unveränderlich, erreichbar mit dem Denken und nicht mit den Augen. Die sokratische Methode ist der Weg dorthin, über Fragen, die deine Gewissheiten auseinandernehmen. Und die Seele hat Teile, Vernunft, Mut und Begierde, womit er erklärt, warum du zwei entgegengesetzte Dinge gleichzeitig wollen kannst. Dargelegt hat er das in der Apologie, im Menon, im Phaidon und vor allem in der Politeia.",
        },
        {
          q: 'Was ist die sokratische Methode?',
          a: "Sie ist eine Art zu reden, die mit Fragen arbeitet statt mit Behauptungen. Am Anfang steht etwas, das leicht klingt. Was ist Gerechtigkeit? Was ist Mut? Deine erste Antwort fühlt sich sicher an. Die nächste Frage findet einen Fall, den sie nicht abdeckt, die übernächste auch, bis dir die Erklärung unter den Händen zerfällt. Diesen Moment nennt Platon Aporie, und er hält ihn für einen Fortschritt, nicht für ein Scheitern. Du weißt jetzt etwas, das du vorher nicht wusstest, nämlich dass du es nicht wusstest. In solchen Gesprächen gewinnt niemand. Genau das ist der Punkt. Ihr kommt beide weiter, als ihr angefangen habt.",
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Platon?',
        a: "Nein. Das ist ein Echo von Platon, eine KI-Stimme, gebaut aus seinen überlieferten Dialogen. Es ist keine Aufnahme und nicht der echte Philosoph, der von etwa 428 bis 348 v. Chr. lebte. Von ihm gibt es keine Aufnahme, und es könnte auch nie eine geben. Selbst in seinen eigenen Büchern gehören die Worte Sokrates und den anderen, nie ihm. Nimm das Echo als Weg in seine Gedanken, nie als seine eigenen Worte.",
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What was Plato's theory of forms?",
          seedId: 6,
          body:
            "Draw a circle in the sand. Your hand shakes, the grains shift, and the circle comes out wrong. Now notice what just happened. You knew it was wrong, which means you already carry a perfect circle somewhere, though you have never once seen one with your eyes. That is Plato's argument in a single move. Behind every imperfect thing stands the form of it, the thing itself, unchanging and complete. Circles, yes, but also justice, beauty, and equality. The world your senses reach is the world of becoming, always shifting and never finished. The forms are the world of being. Philosophy, for Plato, is the slow turn from the first toward the second.",
        },
        {
          h2: 'What is the allegory of the cave?',
          body:
            "Prisoners sit chained in an underground cave, facing a wall. Behind them a fire throws shadows onto that wall, and those shadows are the only things they have ever seen, so shadows are what they call real. One prisoner gets loose and turns around. The fire hurts his eyes. He climbs out, the sun is worse, and it takes a long time before he can look at anything up there. Then he goes back down to tell the others, and they do not thank him. Plato is describing education, and he is honest about the price of it. Being pulled out of what everyone around you accepts is disorienting, and the people still inside will push back.",
        },
      ],
      ideaQuestion: 'Everyone around me agrees on how things are. What if we are all seeing shadows?',
      works: [
        {
          title: 'Apology (Early period)',
          note: 'Socrates in court, defending the way he lived. Not an apology in our sense of the word. It means a defence, and he loses.',
        },
        {
          title: 'Meno (Early-Middle period)',
          note: 'The one where a boy who has never studied geometry is walked to a proof by questions alone. This is Plato making the case that learning is remembering.',
        },
        {
          title: 'Phaedo (Middle period)',
          note: 'The last day of Socrates, and the argument about the soul he makes while the hemlock is being prepared. Plato writes that he was not there himself. He was ill.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Platons Ideenlehre einfach erklärt',
          seedId: 6,
          body:
            "Zeichne einen Kreis in den Sand. Deine Hand zittert, die Körner verrutschen, der Kreis wird schief. Achte jetzt darauf, was gerade passiert ist. Du hast gemerkt, dass er schief ist. Also trägst du irgendwo schon einen vollkommenen Kreis in dir, obwohl du nie einen mit den Augen gesehen hast. Das ist Platons Gedanke in einem einzigen Schritt. Hinter jedem unvollkommenen Ding steht seine Idee, die Sache selbst, unveränderlich und ganz. Kreise, ja, aber auch Gerechtigkeit, Schönheit und Gleichheit. Was deine Sinne erreichen, ist die Welt des Werdens, immer in Bewegung und nie fertig. Die Ideen sind die Welt des Seins. Philosophie ist für Platon die langsame Wendung von der einen zur anderen.",
        },
        {
          h2: 'Was ist das Höhlengleichnis?',
          body:
            "Gefangene sitzen angekettet in einer Höhle und schauen auf eine Wand. Hinter ihnen wirft ein Feuer Schatten auf diese Wand. Etwas anderes haben sie nie gesehen, also nennen sie die Schatten die Wirklichkeit. Einer kommt frei und dreht sich um. Das Feuer blendet ihn. Er steigt hinaus, die Sonne ist noch schlimmer, und es dauert lange, bis er dort oben überhaupt etwas ansehen kann. Dann geht er zurück nach unten, um es den anderen zu sagen, und die danken es ihm nicht. Platon beschreibt hier Bildung, und er ist ehrlich über den Preis. Aus dem herausgeholt zu werden, was alle um dich herum für selbstverständlich halten, verwirrt erst einmal, und die drinnen wehren sich dagegen.",
        },
      ],
      ideaQuestion: 'Alle um mich herum sehen die Welt gleich. Was, wenn wir nur Schatten sehen?',
      works: [
        {
          title: 'Apologie (Frühwerk)',
          note: 'Sokrates vor Gericht, wie er die Art verteidigt, auf die er gelebt hat. Keine Entschuldigung, sondern eine Verteidigungsrede. Er verliert.',
        },
        {
          title: 'Menon (frühe bis mittlere Schaffenszeit)',
          note: 'Der Dialog, in dem ein Junge ohne jede Mathematikausbildung allein durch Fragen zu einem Beweis geführt wird. Platons Argument dafür, dass Lernen ein Erinnern ist.',
        },
        {
          title: 'Phaidon (mittlere Schaffenszeit)',
          note: 'Der letzte Tag des Sokrates und sein Gespräch über die Seele, während der Schierling vorbereitet wird. Platon schreibt, er selbst sei nicht dabei gewesen. Er war krank.',
        },
      ],
    },
  },
};
