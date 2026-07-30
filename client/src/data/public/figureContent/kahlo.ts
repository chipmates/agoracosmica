import type { FigureFragment } from './types';

// kahlo: voice-passed QA plus authored page content. The German block answers
// the live query about the thorn necklace self-portrait in TEXT ONLY. The
// painting is still in copyright, so it is described and never reproduced, and
// only the symbols her documented vocabulary covers are read.
export const fragment: FigureFragment = {
  qa: {
    en: {
      pairs: [
        {
          q: 'What can I learn from Frida Kahlo?',
          a: 'Frida Kahlo (1907-1954) was eighteen when a trolley accident broke her body. While she healed, her mother fixed a mirror above the bed. She started painting the one subject she could always reach. Herself. She made roughly 55 self-portraits, and she was blunt about why. She painted her own reality, she said, not her dreams. With Kahlo, you learn to look at yourself without flinching.',
        },
        {
          q: 'What did Frida Kahlo teach?',
          a: 'Frida Kahlo taught three things. The first is honest self-observation. Roughly 55 self-portraits, made across decades, are a method and not vanity. The second is the retablo method. Mexican churches are full of small painted panels where an anonymous painter records a catastrophe in bright colours, thanks whoever helped, and goes home to keep living. Kahlo borrowed that structure for her own pain. The third is body truth. She painted menstruation, miscarriage and chronic pain when those subjects were strictly off limits. And she painted them from inside the body, not the way a body looks to someone watching.',
        },
        {
          q: 'Why did Frida Kahlo reject being called a Surrealist?',
          a: "André Breton put the Surrealist label on her work and she never accepted it. Her reason was simple. Surrealism works from dreams and the unconscious. She was painting things that had actually happened to her, the broken spine, the hospital in Detroit, the marriage. As she put it: they thought I was a Surrealist, but I wasn't. I never painted dreams. I painted my own reality. Her symbols are not random either. The hummingbird is an Aztec warrior reborn. The thorns call up Christ's crown and older blood sacrifice at once.",
        },
      ],
      disclosure: {
        q: 'Is this really Frida Kahlo speaking?',
        a: 'No. This is an Echo of Frida Kahlo. It is an AI voice built from her documented life and work, and it stays an interpretation, not a recording. The real painter lived from 1907 to 1954 and no recording of her in this form exists. Use it as a way into her ideas about self-portraiture, pain and identity, never as her own words.',
      },
    },
    de: {
      pairs: [
        {
          q: 'Was kann ich von Frida Kahlo lernen?',
          a: 'Frida Kahlo (1907-1954) war achtzehn, als eine Straßenbahn ihren Körper zerschmetterte. Während sie genas, befestigte ihre Mutter einen Spiegel über dem Bett. Sie begann das eine Motiv zu malen, das sie immer erreichen konnte. Sich selbst. Daraus wurden ungefähr 55 Selbstporträts, und sie sagte klar, warum. Sie male ihre eigene Wirklichkeit, nicht ihre Träume. Bei Kahlo lernst du, dich selbst anzusehen, ohne wegzuschauen.',
        },
        {
          q: 'Was hat Frida Kahlo gelehrt?',
          a: 'Frida Kahlo lehrte drei Dinge. Das erste ist die ehrliche Selbstbeobachtung. Ungefähr 55 Selbstporträts über Jahrzehnte hinweg sind eine Methode und keine Eitelkeit. Das zweite ist die Retablo-Methode. In mexikanischen Kirchen hängen kleine gemalte Tafeln. Ein anonymer Maler hält darauf seine Katastrophe in hellen Farben fest, dankt dem, der geholfen hat, und geht dann nach Hause und lebt weiter. Diese Struktur hat Kahlo für den eigenen Schmerz übernommen. Das dritte ist die Wahrheit des Körpers. Sie malte Menstruation, Fehlgeburt und Schmerz, als das strenge Tabus waren, und sie malte sie von innen, nicht so, wie ein Körper für einen Betrachter aussieht.',
        },
        {
          q: 'Warum wollte Frida Kahlo keine Surrealistin sein?',
          a: 'André Breton hängte ihrer Arbeit das Etikett Surrealismus an, und sie hat es nie angenommen. Ihr Grund ist einfach. Der Surrealismus arbeitet mit Träumen und dem Unbewussten. Sie malte Dinge, die ihr tatsächlich passiert waren, die zerbrochene Wirbelsäule, das Krankenhaus in Detroit, die Ehe. Sie sagte es selbst: Sie dachten, ich sei eine Surrealistin, aber ich war keine. Ich habe nie Träume gemalt. Ich habe meine eigene Realität gemalt. Auch ihre Zeichen sind nicht zufällig. Der Kolibri ist ein wiedergeborener aztekischer Krieger. Die Dornen rufen zugleich die Krone Christi und das alte Blutopfer auf.',
        },
      ],
      disclosure: {
        q: 'Spricht hier wirklich Frida Kahlo?',
        a: 'Nein. Das hier ist ein Echo von Frida Kahlo. Es ist eine KI-Stimme, gebaut aus ihrem belegten Leben und Werk, und sie bleibt eine Deutung, keine Aufnahme. Die echte Malerin lebte von 1907 bis 1954, und Aufnahmen von ihr in dieser Form gibt es nicht. Nimm es als Weg zu ihren Gedanken über Selbstporträt, Schmerz und Identität, nie als ihre eigenen Worte.',
      },
    },
  },
  page: {
    en: {
      concepts: [
        {
          h2: 'How did Frida Kahlo turn pain into power?',
          seedId: 2,
          body:
            'She got the method from a chapel wall. Mexican ex-voto paintings are small panels, usually on tin. An anonymous painter shows the accident exactly as it happened, in colours bright enough that the picture refuses pity. The painter thanks whoever pulled them through, goes home, and keeps living. Kahlo took that shape and used it on her own life. Three steps, and none of them is denial. You document the catastrophe. You witness it honestly. You continue. That is why her hardest paintings do not ask you to feel sorry for her.',
        },
        {
          h2: "What do the symbols in Frida Kahlo's paintings mean?",
          seedId: 8,
          body:
            'Her symbols are a language, not a mood. Where many European surrealists put unrelated things beside each other and let the shock do the work, Kahlo built a vocabulary and used it consistently across paintings. Hummingbirds are Aztec warriors reborn. Roots connect a human body to the living earth. Thorns carry two things at once, the crown of Christ and much older blood sacrifice. The monkey has a name, Fulang Chang, and he stands for love that misbehaves. Read a Kahlo painting the way you read a sentence in a language she assembled from Aztec cosmology, Catholic imagery and her own life.',
        },
      ],
      ideaQuestion: 'My body hurts every day and I am tired of pretending it does not.',
      works: [
        {
          title: 'Henry Ford Hospital (1932)',
          note: 'Painted after she lost a pregnancy in Detroit. The doctors wanted silence and sedation. She asked for paper and a pencil.',
        },
        {
          title: 'My Grandparents, My Parents, and I (1936)',
          note: 'A family tree with her own body at the centre. Her father was a German immigrant, and she paints both halves of her descent as hers.',
        },
        {
          title: 'The Two Fridas (1939)',
          note: 'Two versions of herself side by side, joined and separate at once. Her divorce from Diego Rivera was finalised in November of that year.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Selbstbildnis mit Dornenhalsband: Was bedeutet das Bild?',
          seedId: 8,
          body:
            'Das Selbstbildnis mit Dornenhalsband und Kolibri entstand 1940. Das Bild selbst zeigen wir hier nicht, es steht noch unter Urheberrecht. Über seine Zeichen lässt sich trotzdem viel sagen, denn schon der Titel nennt zwei davon, und Kahlo hat ihre Zeichen nie zufällig gewählt. Dornen rufen bei ihr zugleich die Krone Christi und das ältere Blutopfer auf. Der Kolibri ist in der aztekischen Bildsprache ein wiedergeborener Krieger. Verletzung und Überlebender stehen also im selben Bild. Auch das Jahr hilft beim Verstehen. Die Scheidung von Diego Rivera wurde im November 1939 rechtskräftig, 1940 heirateten die beiden erneut. Als Traumbild hat Kahlo so etwas nie verstanden. Sie malte, wie sie sagte, ihre eigene Wirklichkeit.',
        },
        {
          h2: 'Frida Kahlo einfach erklärt',
          body:
            'Frida Kahlo wurde 1907 in Mexiko geboren. Mit achtzehn zerschmetterte eine Straßenbahn ihren Körper. Ihre Mutter befestigte einen Spiegel über dem Krankenbett, und Kahlo begann zu malen, was sie sah: sich selbst. Daraus wurden ungefähr 55 Selbstporträts. Ihre Methode kommt aus den mexikanischen Kirchen, von den Ex-voto-Tafeln. Ein anonymer Maler hält seine Katastrophe in hellen Farben fest, dankt und lebt weiter. Kein Leugnen und kein Schwelgen. Kahlo malte damit Dinge, über die man damals nicht sprach, Fehlgeburt, Schmerz, einen Körper, der nicht funktioniert. Und sie malte sie von innen. Als Surrealistin wollte sie nie gelten. Sie starb 1954 mit siebenundvierzig Jahren.',
        },
      ],
      ideaQuestion: 'Mein Körper tut jeden Tag weh, und ich bin es leid, so zu tun, als wäre nichts.',
      works: [
        {
          title: 'Henry Ford Hospital (1932)',
          note: 'Entstanden, nachdem sie in Detroit ein Kind verloren hatte. Die Ärzte wollten Ruhe und Beruhigungsmittel. Sie bat um Papier und einen Stift.',
        },
        {
          title: 'Meine Großeltern, meine Eltern und ich (1936)',
          note: 'Ein Stammbaum mit ihrem eigenen Körper in der Mitte. Ihr Vater war deutscher Einwanderer, und sie malt beide Seiten ihrer Herkunft als ihre eigenen.',
        },
        {
          title: 'Die zwei Fridas (1939)',
          note: 'Zwei Fassungen von ihr selbst nebeneinander, verbunden und getrennt zugleich. Im November desselben Jahres wurde ihre Scheidung von Diego Rivera rechtskräftig.',
        },
      ],
    },
  },
};
