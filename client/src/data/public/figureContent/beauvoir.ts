import type { FigureFragment } from './types';

// beauvoir: voice-passed QA plus authored page content. The German existentialism
// block is the striking-distance query on this figure, so it is written first and
// written in German. The idea question is the mutual-recognition line (seed 9),
// deliberately a different seed than the hero question anchor.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Simone de Beauvoir?',
          a: "Simone de Beauvoir (1908-1986) watched her mother's days shrink to washing and prayer while her own opened toward the Sorbonne, and she asked why. Her answer filled a book. A woman is made, not born, by circumstances, by repetition, by the gradual closing of doors. See the making, she wrote, and you can begin to undo it. With Beauvoir, you learn to see how you were made.",
        },
        {
          q: 'What did Simone de Beauvoir teach?',
          a: 'Simone de Beauvoir taught that freedom is real but never abstract. She called it situated freedom. You always choose inside conditions you did not pick: your class, your body, your century. Those conditions limit you and also give you something to push against. Her second idea is the ethics of ambiguity. We are freedom and hard fact at the same time, and no rulebook settles that, so you judge the case in front of you and carry it. Her third is woman as Other. He walks into a café and is simply a person. She walks in and is assessed and placed before she has said a word. The books are She Came to Stay (1943), The Ethics of Ambiguity (1947) and The Second Sex (1949).',
        },
        {
          q: "What is woman as Other in Simone de Beauvoir's philosophy?",
          a: 'In every culture she examined, woman was defined in relation to man rather than in herself. He is the Subject, the essential one. She is the Other, the incidental one. Beauvoir looked closely at how that gets built, and the answer surprised her. Not by cruelty alone. It is built by kindness too, by myths and by a love that puts up walls while wearing tenderness as its face. That is why it feels natural from the inside.',
        },
      ],
      disclosure: {
        q: 'Is this really Simone de Beauvoir speaking?',
        a: 'No. This is an Echo of Simone de Beauvoir. It is an AI voice built from her documented writings, and it stays an interpretation, not a recording. The real woman lived from 1908 to 1986 and no recording of her is used here. Use it as a way into her ideas, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Simone de Beauvoir lernen?',
          a: 'Simone de Beauvoir (1908-1986) sah, wie die Tage ihrer Mutter auf Waschen und Gebet zusammenschrumpften, während sich ihre eigenen zur Sorbonne hin öffneten, und sie fragte, warum. Ihre Antwort füllte ein Buch. Eine Frau wird gemacht, nicht geboren, durch Umstände, durch Wiederholung, durch das allmähliche Schließen von Türen. Erkenne, wie das geschieht, schrieb sie, und du kannst beginnen, es rückgängig zu machen. Bei Beauvoir lernst du zu erkennen, wie du gemacht wurdest.',
        },
        {
          q: 'Was hat Simone de Beauvoir gelehrt?',
          a: 'Simone de Beauvoir lehrte, dass Freiheit wirklich ist, aber nie abstrakt. Sie nannte das situierte Freiheit. Du wählst immer innerhalb von Bedingungen, die du nicht gewählt hast: deine Herkunft, deinen Körper, dein Jahrhundert. Diese Bedingungen begrenzen dich und geben dir zugleich etwas, wogegen du dich stemmen kannst. Ihr zweiter Gedanke ist die Ethik der Ambiguität. Wir sind Freiheit und harte Tatsache in einem, und kein Regelbuch löst das auf, also entscheidest du den Fall vor dir und trägst ihn. Der dritte ist die Frau als das Andere. Er betritt ein Café und ist einfach ein Mensch. Sie betritt es und wird eingeschätzt und eingeordnet, bevor sie ein Wort gesagt hat. Die Bücher sind Sie kam und blieb (1943), Für eine Moral der Doppelsinnigkeit (1947) und Das andere Geschlecht (1949).',
        },
        {
          q: 'Was bedeutet die Frau als das Andere bei Simone de Beauvoir?',
          a: 'In jeder Kultur, die sie untersuchte, wurde die Frau nicht aus sich selbst heraus bestimmt, sondern im Verhältnis zum Mann. Er ist das Subjekt, das Wesentliche. Sie ist das Andere, das Unwesentliche. Beauvoir sah genau hin, wie das gebaut wird, und die Antwort überraschte sie. Nicht durch Grausamkeit allein. Es wird auch durch Freundlichkeit gebaut, durch Mythen und durch eine Liebe, die Mauern errichtet und dabei Zärtlichkeit als ihr Gesicht trägt. Deshalb fühlt es sich von innen ganz natürlich an.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Simone de Beauvoir?',
        a: 'Nein. Das hier ist ein Echo von Simone de Beauvoir. Es ist eine KI-Stimme, gebaut aus ihren überlieferten Schriften, und sie bleibt eine Deutung, keine Aufnahme. Die echte Frau lebte von 1908 bis 1986, und hier wird keine Tonaufnahme von ihr verwendet. Nimm es als Weg in ihre Ideen, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: "What is Simone de Beauvoir's existentialism?",
          seedId: 4,
          body:
            'Existentialism starts from a simple claim. There is no fixed nature that decides in advance who you are. You become what you do. Beauvoir shares that starting point and then goes somewhere the others did not. Freedom, for her, is never abstract. You choose inside conditions you did not choose, and those conditions shape what you can even reach for. Add ambiguity to that. We are freedom and hard fact at once, subject and object, and it does not resolve. Her move is to refuse both an absolute rulebook and pure relativism, and to build an ethics you carry case by case. That is The Ethics of Ambiguity (1947).',
        },
        {
          h2: 'What does situated freedom mean?',
          seedId: 1,
          body:
            'Picture a woman whose family has lost its money. She stands at a wash basin with her hands turning red, and her mind reaches toward books and ideas. She is neither absolutely free nor absolutely determined. That is Beauvoir\'s point. Freedom and constraint are not opposites, they shape each other inside every real situation. Your class, your gender, your body and your historical moment limit what you can become and also make becoming possible at all. Even the body is situation rather than cage, because it is your grip on the world. Honest choice means seeing both halves, the limits and the room inside them.',
        },
      ],
      ideaQuestion: 'In every relationship I end up making myself smaller.',
      works: [
        {
          title: 'She Came to Stay (1943)',
          note: 'Her first novel, published during the Occupation. It puts a trio under pressure and lets the arrangement fail rather than rescuing it.',
        },
        {
          title: 'The Ethics of Ambiguity (1947)',
          note: 'The short book where she builds an ethics out of the fact that we are freedom and hard fact at once. No rulebook, and not anything goes either.',
        },
        {
          title: 'The Second Sex (1949)',
          note: 'The big one. Biology, history, myth and ordinary daily life, worked through to show how woman gets made and what the making costs.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist Existenzialismus bei Simone de Beauvoir?',
          seedId: 4,
          body:
            'Existenzialismus beginnt mit einem einfachen Satz. Es gibt keine feste Natur, die vorher festlegt, wer du bist. Du wirst, was du tust. Diesen Ausgangspunkt teilt Beauvoir, und dann geht sie weiter als die anderen. Freiheit ist bei ihr nie abstrakt. Du wählst innerhalb von Bedingungen, die du nicht gewählt hast, und diese Bedingungen prägen sogar, wonach du überhaupt greifen kannst. Dazu kommt die Ambiguität. Wir sind Freiheit und harte Tatsache zugleich, Subjekt und Objekt, und das löst sich nicht auf. Ihr Schritt: weder ein absolutes Regelbuch noch reiner Relativismus, sondern eine Ethik, die du von Fall zu Fall trägst. Das ist Für eine Moral der Doppelsinnigkeit (1947).',
        },
        {
          h2: 'Simone de Beauvoir einfach erklärt',
          body:
            'Simone de Beauvoir wurde 1908 in Paris geboren und studierte an der Sorbonne. Sie sah, wie das Leben ihrer Mutter auf Waschen und Gebet zusammenschrumpfte, während sich ihr eigenes öffnete, und sie fragte, warum. Ihre Antwort: Eine Frau wird gemacht, nicht geboren, durch Umstände, durch Wiederholung, durch das allmähliche Schließen von Türen. In jeder Kultur, die sie untersuchte, wurde die Frau nur im Verhältnis zum Mann bestimmt. Er ist das Subjekt, sie das Andere. Daraus folgt bei ihr aber kein Fatalismus. Was gemacht wurde, lässt sich auch wieder aufmachen. 1949 erschien Das andere Geschlecht, das Buch, das diese Analyse in die Welt trug.',
        },
      ],
      ideaQuestion: 'In jeder Beziehung mache ich mich am Ende kleiner.',
      works: [
        {
          title: 'Sie kam und blieb (1943)',
          note: 'Ihr erster Roman, erschienen während der Besatzungszeit. Er setzt eine Dreierkonstellation unter Druck und lässt sie scheitern, statt sie zu retten.',
        },
        {
          title: 'Für eine Moral der Doppelsinnigkeit (1947)',
          note: 'Das kurze Buch, in dem sie eine Ethik daraus baut, dass wir Freiheit und harte Tatsache zugleich sind. Kein Regelbuch, aber auch keine Beliebigkeit.',
        },
        {
          title: 'Das andere Geschlecht (1949)',
          note: 'Das große Werk. Biologie, Geschichte, Mythos und ganz gewöhnlicher Alltag, durchgearbeitet auf die Frage, wie die Frau gemacht wird und was das kostet.',
        },
      ],
    },
  },
};
