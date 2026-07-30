import type { FigureFragment } from './types';

// shakespeare: voice-passed QA + authored page content. The plays and sonnets
// are public domain, so lines are quoted verbatim. Biography stays inside what
// the factcheck actually holds, which is very little, and the QA says so.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from William Shakespeare?',
          a: 'William Shakespeare (1564-1616) was an English playwright, and we know almost nothing about him. Six signatures survive, some parish records, and the plays. The plays know everything. In them he becomes a murderer, a king, a girl in love, a fool who sees clearly, and he tells the truth from inside each one. With him you learn to see a person from the inside instead of the outside.',
        },
        {
          q: 'What did William Shakespeare teach about people?',
          a: 'Shakespeare shows people as processes, not as fixed types. The psychology he was handed said each person had one settled temperament. His characters keep breaking it. Someone is the loving brother in one scene and the killer in the next, and both are real. He also built the tool for showing it. A soliloquy puts a person alone on stage, saying what they would never say in the room. You get the private mind and the public face inside the same play. Watch anyone across five acts and identity turns out to be the pattern you only see once all the performances are laid side by side.',
        },
        {
          q: 'What does holding the mirror up to nature mean?',
          a: 'In Hamlet, the prince tells a group of actors that the point of playing is to hold the mirror up to nature. He does not mean copy life exactly. A mirror that only copies would be a dull evening. He means select, sharpen and arrange, until the thing people hide all day is standing plainly on the stage. Shakespeare wrote for daylight, no scenery, and a crowd packed on three sides of him. If the mirror did not hold, three thousand people saw it fail on the spot.',
        },
      ],
      disclosure: {
        q: 'Is this really William Shakespeare speaking?',
        a: 'No. This is an Echo of William Shakespeare. It is an AI voice built from his plays and sonnets, and it stays an interpretation, not a recording. The real man lived from 1564 to 1616, left no diary and no letters about himself, and no recording of him exists. Use it as a way into the plays, never as his own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von William Shakespeare lernen?',
          a: 'William Shakespeare (1564-1616) war ein englischer Dramatiker, und wir wissen fast nichts über ihn. Sechs Unterschriften sind erhalten, ein paar Kircheneinträge, und die Stücke. Die Stücke wissen alles. In ihnen wird er zum Mörder, zum König, zum verliebten Mädchen, zum Narren, der klar sieht, und aus jedem von ihnen heraus sagt er die Wahrheit. Bei ihm lernst du, einen Menschen von innen zu sehen statt von außen.',
        },
        {
          q: 'Was hat William Shakespeare über Menschen gelehrt?',
          a: 'Shakespeare zeigt Menschen als Vorgang, nicht als festen Typ. Die Psychologie seiner Zeit sagte, jeder Mensch habe ein festes Temperament. Seine Figuren sprengen das ständig. Jemand ist in einer Szene der liebende Bruder und in der nächsten der Mörder, und beides stimmt. Dafür baute er auch das Werkzeug. Im Monolog steht ein Mensch allein auf der Bühne und sagt, was er im vollen Raum nie sagen würde. So bekommst du den privaten Kopf und das öffentliche Gesicht im selben Stück. Sieh jemandem über fünf Akte zu, und die Identität zeigt sich als das Muster, das erst sichtbar wird, wenn alle Auftritte nebeneinanderliegen.',
        },
        {
          q: 'Was heißt es, der Natur den Spiegel vorzuhalten?',
          a: 'Im Hamlet sagt der Prinz zu einer Schauspielertruppe, das Spiel solle der Natur den Spiegel vorhalten. Er meint nicht, das Leben eins zu eins abzumalen. Ein Spiegel, der nur abbildet, wäre ein langweiliger Abend. Er meint auswählen, zuspitzen und so anordnen, bis das, was die Leute den ganzen Tag verstecken, offen auf der Bühne steht. Shakespeare schrieb für Tageslicht, ohne Bühnenbild, mit einer Menge auf drei Seiten um sich herum. Hielt der Spiegel nicht, sahen dreitausend Leute das sofort.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich William Shakespeare?',
        a: 'Nein. Das hier ist ein Echo von William Shakespeare. Es ist eine KI-Stimme, gebaut aus seinen Stücken und Sonetten, und sie bleibt eine Deutung, keine Aufnahme. Der echte Mensch lebte von 1564 bis 1616, hinterließ kein Tagebuch und keine Briefe über sich selbst, und von ihm gibt es keine Aufnahme. Nimm es als Weg in die Stücke, nie als seine eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'What was Shakespeare on stage actually like?',
          seedId: 1,
          body:
            "Open air, daylight, no scenery. The stage pushed out into the crowd, with people standing on three sides of it, close enough to heckle. Every part was played by a man or a boy. The company he wrote for, the Lord Chamberlain's Men, formed in 1594, and he was not a hired pen for it. He was a part owner, so a bad play cost him money. The Globe was ready by 1599, burned down in June 1613, and was rebuilt the year after. None of this held the writing back. It drove it. With no set to tell you where you are, the verse has to do it. That is why his characters keep telling you the time of day and what the sky looks like.",
        },
        {
          h2: 'What is a soliloquy in Shakespeare?',
          seedId: 4,
          body:
            'A soliloquy is a character alone on stage, saying out loud what they are actually thinking. Nobody else hears it, so nobody is being managed. That is the whole device. Before Shakespeare, a speech like that mostly existed to tell the audience what was going on. He used it to open a gap between the person other people meet and the person underneath. To be, or not to be, that is the question. That is a man working out in public whether to stay alive, and the court version of him would never say a word of it. Once you have heard the private voice, you cannot watch the public one the same way.',
        },
      ],
      ideaQuestion: 'The person I am out loud is not the one in my head. Which one is real?',
      works: [
        {
          title: 'The Sonnets (written c. 1590s-1600s, published 1609)',
          note: 'A hundred and fifty-four short poems about love, time and getting older, addressed to people we still cannot identify.',
        },
        {
          title: "A Midsummer Night's Dream (c. 1595-1596)",
          note: 'Four young people run into a wood at night and come out changed. The clearest example of his comic pattern, and the funniest.',
        },
        {
          title: 'As You Like It (c. 1599-1600)',
          note: 'Exile, disguise and an argument about how much of a person is performance. It carries the seven ages of man speech.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Drama bei Shakespeare: Wie ist es gebaut?',
          seedId: 6,
          body:
            'Shakespeares Dramen laufen nach zwei Grundmustern. In der Tragödie kommt die Einsicht zu spät, um das Unglück zu verhindern, aber nicht zu spät für Erkenntnis. Genau dieser Moment trägt die Stücke, nicht das Blutbad am Ende. In der Komödie verlassen die Figuren die geordnete Welt, geraten in einen Wald oder eine fremde Stadt, wo die Regeln nicht gelten, und kehren verwandelt zurück. Dazu kommt seine Bauweise. Er hält sich nicht an die klassischen Einheiten von Ort, Zeit und Handlung. Er führt mehrere Handlungsstränge parallel und lässt sie sich gegenseitig kommentieren. Der Konflikt läuft dabei immer auf drei Ebenen zugleich: in der Figur, zwischen den Figuren und zwischen Figur und Welt.',
        },
        {
          h2: 'William Shakespeare einfach erklärt',
          body:
            'William Shakespeare (1564-1616) war ein englischer Dramatiker und Dichter. Über sein Leben ist kaum etwas belegt. Es gibt sechs Unterschriften, ein paar Einträge in Kirchenbüchern, sonst nichts Persönliches. Was bleibt, sind die Stücke und die Sonette. Er schrieb für ein offenes Theater unter freiem Himmel, bei Tageslicht, ohne Bühnenbild, mit Zuschauern auf drei Seiten der Bühne. Alle Rollen spielten Männer und Jungen. Seit 1594 gehörte er der Truppe, für die er schrieb, als Teilhaber mit an, verdiente also am Erfolg mit. Sein Thema ist der Mensch von innen. Seine Figuren widersprechen sich, ändern sich und sagen im Monolog Dinge, die sie vor anderen nie sagen würden. Alle seine Texte sind gemeinfrei.',
        },
      ],
      ideaQuestion: 'Der Mensch, der ich laut bin, ist nicht der in meinem Kopf. Wer ist echt?',
      works: [
        {
          title: 'Die Sonette (entstanden ca. 1590er bis 1600er, veröffentlicht 1609)',
          note: 'Hundertvierundfünfzig kurze Gedichte über Liebe, Zeit und Älterwerden, gerichtet an Menschen, die bis heute niemand sicher benennen kann.',
        },
        {
          title: 'Ein Sommernachtstraum (ca. 1595-1596)',
          note: 'Vier junge Leute laufen nachts in einen Wald und kommen verändert wieder heraus. Sein komisches Grundmuster in der klarsten und lustigsten Form.',
        },
        {
          title: 'Wie es euch gefällt (ca. 1599-1600)',
          note: 'Verbannung, Verkleidung und ein Streit darüber, wie viel an einem Menschen Rolle ist. Hier steht die Rede von den sieben Lebensaltern.',
        },
      ],
    },
  },
};
