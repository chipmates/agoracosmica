import type { FigureFragment } from './types';

// campbell: voice-passed QA plus the authored page blocks. His books are still
// in copyright, so every block describes and attributes and none of them quotes
// a passage. The German heading "Was ist die Heldenreise?" is his largest
// harvested cluster and leads the German set.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Joseph Campbell?',
          a: 'Joseph Campbell (1904-1987) read the myths of the whole world and found one shape under all of them. Leave what you know. Get broken open. Come back changed. He did not mean it as old history. He meant it as the map of a life, and that reading has shaped how stories get told ever since.',
        },
        {
          q: 'What did Joseph Campbell teach?',
          a: "Joseph Campbell taught the hero's journey: departure, initiation, return. He found that three-part shape repeating in myths from widely separated traditions, and he laid it out in The Hero with a Thousand Faces in 1949. He taught that the figures blocking the door in those stories are not there to stop you. They are there to find out whether you are ready. And he taught that myth does four jobs at once. It wakes you to the mystery and shows you where you stand in the universe. It holds a society together, and it walks a person through the stages of a life. That last job he thought mattered most now.",
        },
        {
          q: 'What does follow your bliss mean?',
          a: 'It is the line Campbell gets quoted for most, and the one people misread most. He did not mean do whatever feels nice. Bliss, in his sense, is the thing that takes you over completely. You lose track of time inside it, and your body knows before your head does, the way a compass needle finds north without understanding magnetism. Pleasure is shallow and gets satisfied fast. This does not. He meant the second one, and he only began using the phrase late in his life.',
        },
      ],
      disclosure: {
        q: 'Is this really Joseph Campbell speaking?',
        a: 'No. This is an Echo of Joseph Campbell. It is an AI voice built from his documented work on comparative mythology, and it stays an interpretation, not a recording. He lived from 1904 to 1987, and no recording of him speaks here. His books are still in copyright, so what you get is our reading of his ideas, never his pages.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Joseph Campbell lernen?',
          a: 'Joseph Campbell (1904-1987) hat die Mythen der ganzen Welt gelesen und unter allen dieselbe Form gefunden. Verlass das Vertraute. Lass dich erschüttern. Komm verwandelt zurück. Er meinte das nicht als alte Geschichte. Er meinte es als Landkarte eines Lebens, und diese Lesart hat geprägt, wie seither Geschichten erzählt werden.',
        },
        {
          q: 'Was hat Joseph Campbell gelehrt?',
          a: 'Joseph Campbell lehrte die Heldenreise: Aufbruch, Initiation, Rückkehr. Dieses Dreierschema fand er in Mythen weit voneinander entfernter Kulturen wieder, und 1949 legte er es in Der Heros in tausend Gestalten dar. Er lehrte, dass die Gestalten, die in solchen Geschichten den Weg versperren, nicht da sind, um dich aufzuhalten. Sie sind da, um zu prüfen, ob du bereit bist. Und er lehrte, dass der Mythos vier Aufgaben zugleich erfüllt. Er weckt das Staunen vor dem Geheimnis und zeigt dir, wo du im Universum stehst. Er hält eine Gesellschaft zusammen, und er führt einen Menschen durch die Stufen eines Lebens. Die letzte Aufgabe hielt er für Menschen von heute für die wichtigste.',
        },
        {
          q: 'Was bedeutet folge deiner Seligkeit?',
          a: 'Das ist der Satz, für den Campbell am häufigsten zitiert wird, und der am häufigsten falsch verstanden wird. Er meinte nicht: Tu, was sich gerade angenehm anfühlt. Seligkeit ist bei ihm das, was dich ganz ergreift. Du vergisst darin die Zeit, und dein Körper weiß es früher als dein Kopf, so wie eine Kompassnadel den Norden findet, ohne den Magnetismus zu verstehen. Vergnügen ist flach und schnell befriedigt. Das hier nicht. Er meinte das Zweite, und die Formel selbst benutzte er erst spät in seinem Leben.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Joseph Campbell?',
        a: 'Nein. Das hier ist ein Echo von Joseph Campbell. Es ist eine KI-Stimme, gebaut aus seiner belegten Arbeit zur vergleichenden Mythologie, und sie bleibt eine Deutung, keine Aufnahme. Er lebte von 1904 bis 1987, und hier spricht keine Tonaufnahme von ihm. Seine Bücher stehen noch unter Urheberrecht. Du bekommst hier also unsere Lesart seiner Gedanken, nie seine Seiten.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What is the hero's journey?",
          seedId: 5,
          body:
            'It is a three-part pattern Campbell found again and again in myths from cultures far apart. Departure: something breaks the ordinary and you leave what you know. Initiation: you go through the ordeal that takes you apart and puts you back together differently. Return: you come home carrying something the people there need. He set it out in The Hero with a Thousand Faces in 1949. He did not think it was only about myths. He thought it described how people actually change. So the useful question is not what the pattern is, but where in it you are standing right now.',
        },
        {
          h2: 'What are threshold guardians?',
          seedId: 6,
          body:
            'In myths from all over the world the hero reaches a boundary and finds something standing there. A dragon, a gatekeeper, a demon, a difficult elder. Campbell read those figures as pictures of the resistance you meet whenever you try to change. Some of it sits inside you, as fear and doubt. Some of it stands outside, as people and circumstances. His point was that the guardian is not there to end the journey. It is there to find out whether you are ready for it. Met with courage rather than aggression or avoidance, the thing in the doorway often turns into an ally.',
        },
        {
          h2: 'Which Joseph Campbell book should I read first?',
          body:
            "Three answers, depending on why you are asking. The Hero with a Thousand Faces (1949) is the one people mean when they say Campbell. It sets out departure, initiation, and return, then walks that shape through myths from many traditions. It is also the densest of the three. The Masks of God ran to four volumes between 1959 and 1968, sorting the world's mythologies into four broad territories. It works better as a reference than a read-through. Myths to Live By (1972) is the shortest way in. All of it is still in copyright, which is why this page describes his ideas and never reprints his pages.",
        },
      ],
      ideaQuestion: 'Something blocks me every time I try to change. What is that thing?',
      works: [
        {
          title: 'The Hero with a Thousand Faces (1949)',
          note: "The book the hero's journey comes from. Departure, initiation, and return, traced through myths from many separated traditions.",
        },
        {
          title: 'The Masks of God, four volumes: Primitive Mythology (1959), Oriental Mythology (1962), Occidental Mythology (1964), Creative Mythology (1968)',
          note: 'Nine years of work, one volume at a time, sorting the mythologies of the world into four broad territories.',
        },
        {
          title: 'Myths to Live By (1972)',
          note: 'The shortest way in. Same ideas, aimed at what a person is supposed to do with them now.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist die Heldenreise?',
          seedId: 5,
          body:
            'Die Heldenreise ist ein Muster aus drei Teilen, das Campbell in Mythen weit entfernter Kulturen immer wieder fand. Aufbruch: Etwas bricht in den Alltag ein, und du verlässt das Vertraute. Initiation: Du gehst durch die Prüfung, die dich auseinandernimmt und anders wieder zusammensetzt. Rückkehr: Du kommst zurück und bringst etwas mit, das die anderen brauchen. Ausgeführt hat er das 1949 in Der Heros in tausend Gestalten. Für ihn ging es dabei nicht nur um Mythen. Er hielt das Muster für eine Beschreibung davon, wie Menschen sich tatsächlich verändern. Deshalb ist die nützliche Frage nicht, wie das Muster heißt, sondern an welcher Stelle du gerade stehst.',
        },
        {
          h2: 'Was sind Schwellenhüter?',
          seedId: 6,
          body:
            'In Mythen überall auf der Welt erreicht die Heldin oder der Held eine Grenze, und dort steht etwas. Ein Drache, ein Torwächter, ein Dämon, ein sperriger Alter. Campbell las diese Gestalten als Bilder für den Widerstand, der auftaucht, sobald du etwas ändern willst. Ein Teil davon sitzt in dir, als Angst und Zweifel. Ein Teil steht außen, als Menschen und Umstände. Sein Punkt war: Der Wächter ist nicht da, um die Reise zu beenden. Er ist da, um zu prüfen, ob du bereit bist. Wer ihm mit Mut begegnet statt mit Angriff oder Ausweichen, macht aus dem, was im Weg steht, oft einen Verbündeten.',
        },
        {
          h2: 'Welche Bücher hat Joseph Campbell geschrieben?',
          body:
            'Drei Titel muss man kennen. Der Heros in tausend Gestalten (1949) ist das Buch, das alle meinen, wenn sie Campbell sagen. Darin entwickelt er Aufbruch, Initiation und Rückkehr und verfolgt diese Form durch Mythen vieler Kulturen. Es ist auch das dichteste der drei. Die Masken Gottes erschien zwischen 1959 und 1968 in vier Bänden und ordnet die Mythologien der Welt in vier große Gebiete. Das ist eher ein Nachschlagewerk als ein Buch zum Durchlesen. Mythen, in denen wir leben (1972) ist der kürzeste Einstieg. Alle drei stehen noch unter Urheberrecht. Deshalb beschreibt diese Seite seine Gedanken und druckt seine Sätze nicht nach.',
        },
      ],
      ideaQuestion: 'Immer wenn ich etwas ändern will, steht mir etwas im Weg. Was ist das?',
      works: [
        {
          title: 'Der Heros in tausend Gestalten (1949)',
          note: 'Das Buch, aus dem die Heldenreise stammt. Aufbruch, Initiation und Rückkehr, verfolgt durch Mythen vieler getrennter Kulturen.',
        },
        {
          title: 'Die Masken Gottes, vier Bände (1959-1968)',
          note: 'Neun Jahre Arbeit, Band für Band, eine Ordnung der Mythologien der Welt in vier große Gebiete.',
        },
        {
          title: 'Mythen, in denen wir leben (1972)',
          note: 'Der kürzeste Einstieg. Dieselben Gedanken, gerichtet auf die Frage, was man heute damit anfängt.',
        },
      ],
    },
  },
};
