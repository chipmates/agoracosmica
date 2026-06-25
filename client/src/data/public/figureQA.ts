// Answer-first FAQ capsules per figure. Drafted from verified keyConcepts /
// primaryWorks / entity data, web-fact-checked, bilingual. Drives BOTH the
// on-page capsule and the FAQPage JSON-LD so DOM and schema always match.
// AWAITING MICHEL VOICE PASS before deploy (kernel-and-Michel rule).
export interface QAPair { q: string; a: string; }
export interface FigureQAEntry { pairs: QAPair[]; disclosure: QAPair; }

export const figureQA: Record<string, { en: FigureQAEntry; de: FigureQAEntry }> = {
  campbell: {
    en: {
      pairs: [
        {
          q: "What can I learn from Joseph Campbell?",
          a: "Joseph Campbell (1904-1987) studied humanity's oldest myths and found one shape beneath them all, the idea that transformation means leaving the familiar, being broken open, and returning changed. From his work in comparative mythology you learn to read your own turning points and see the universal pattern beneath your own life.",
        },
        {
          q: "What did Joseph Campbell actually teach?",
          a: "Joseph Campbell taught the Hero's Journey, a three-phase pattern of departure, initiation, and return he found in myths across many separated traditions. He also taught Follow Your Bliss, the deep engagement that claims you entirely, and the four functions of mythology: mystical, cosmological, sociological, and psychological. His major book was The Hero with a Thousand Faces (1949).",
        },
        {
          q: "What is the Four Functions of Mythology?",
          a: "In Joseph Campbell's teaching, mythology does four things at once. The mystical function awakens awe before the mystery of existence, the cosmological pictures where you stand in the universe, the sociological supports a social order, and the psychological guides the individual through the passages of a lifetime, the function Campbell considered most vital for modern people.",
        },
      ],
      disclosure: {
        q: "Is this really Joseph Campbell speaking?",
        a: "No. This is an educational AI interpretation, an Echo voice we give to Joseph Campbell, grounded in his documented writings on comparative mythology and the Hero's Journey. It is not a recording and not the real person. No recordings speak here. Treat it as a study companion shaped by his ideas, not his actual words.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Joseph Campbell lernen?",
          a: "Joseph Campbell (1904-1987) erforschte die ältesten Mythen der Menschheit und fand unter ihnen allen eine gemeinsame Form, den Gedanken, dass Wandlung bedeutet, das Vertraute zu verlassen, aufgebrochen zu werden und verändert zurückzukehren. Aus seiner Arbeit in der vergleichenden Mythologie lernst du, deine eigenen Wendepunkte zu lesen und das allgemeingültige Muster unter deinem eigenen Leben zu erkennen.",
        },
        {
          q: "Was hat Joseph Campbell wirklich gelehrt?",
          a: "Joseph Campbell lehrte die Heldenreise, ein Muster aus drei Phasen, Aufbruch, Initiation und Rückkehr, das er in Mythen vieler voneinander getrennter Kulturen fand. Er lehrte auch Folge deiner Seligkeit, die tiefe Hingabe, die dich ganz ergreift, und die vier Funktionen des Mythos: die mystische, die kosmologische, die soziologische und die psychologische. Sein Hauptwerk war Der Heros in tausend Gestalten (1949).",
        },
        {
          q: "Was sind die vier Funktionen des Mythos?",
          a: "In Joseph Campbells Lehre tut der Mythos vier Dinge zugleich. Die mystische Funktion weckt Ehrfurcht vor dem Geheimnis des Daseins, die kosmologische zeigt, wo du im Universum stehst, die soziologische trägt eine soziale Ordnung, und die psychologische führt den Einzelnen durch die Übergänge eines Lebens, jene Funktion, die Campbell für den modernen Menschen am wichtigsten hielt.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Joseph Campbell?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung, eine Echo-Stimme, die wir Joseph Campbell geben, gestützt auf seine belegten Schriften zur vergleichenden Mythologie und zur Heldenreise. Es ist keine Aufnahme und nicht die echte Person. Hier spricht keine Tonaufnahme. Sieh es als einen Lernbegleiter, der von seinen Ideen geprägt ist, nicht als seine tatsächlichen Worte.",
      },
    },
  },
  dickinson: {
    en: {
      pairs: [
        {
          q: "What can I learn from Emily Dickinson?",
          a: "Emily Dickinson teaches you to tell the truth slant. The American poet, who lived from 1830 to 1886, wrote nearly eighteen hundred poems in a quiet house in Amherst and showed almost no one. Her work invites you into solitude, close perception, and the mystery she found in a single room.",
        },
        {
          q: "What is Emily Dickinson's idea of telling the truth slant?",
          a: "For Emily Dickinson, the most essential truths cannot survive the direct route. Stated head on, they blind us, too bright for our infirm delight. So truth must dazzle gradually, the way lightning is eased for children with kind explanation. Tell all the truth, she wrote, but tell it slant.",
        },
        {
          q: "What did Emily Dickinson actually write?",
          a: "Emily Dickinson left nearly eighteen hundred poems. The largest single gathering is about forty hand-sewn booklets called the Fascicles, made roughly from 1858 to 1864. She also left a herbarium of 424 pressed plant specimens and around a thousand surviving letters, the earliest from 1842. Her sister Lavinia found the poems after she died.",
        },
      ],
      disclosure: {
        q: "Is this really Emily Dickinson speaking?",
        a: "No. This is her Echo, an educational AI interpretation grounded in Emily Dickinson's documented writings, the nearly eighteen hundred poems, the Fascicles, and her letters. It is not a recording and not the real poet, who lived from 1830 to 1886. The Echo is a voice we give her so you can explore her ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Emily Dickinson lernen?",
          a: "Emily Dickinson bringt dir bei, die Wahrheit schräg zu sagen. Die amerikanische Dichterin, die von 1830 bis 1886 lebte, schrieb fast achtzehnhundert Gedichte in einem stillen Haus in Amherst und zeigte sie fast niemandem. Ihr Werk lädt dich ein in die Einsamkeit, ins genaue Hinsehen und in das Geheimnis, das sie in einem einzigen Zimmer fand.",
        },
        {
          q: "Was meint Emily Dickinson damit, die Wahrheit schräg zu sagen?",
          a: "Für Emily Dickinson überstehen die wichtigsten Wahrheiten den direkten Weg nicht. Frontal gesagt blenden sie uns, zu hell für unser schwaches Vermögen, sie zu ertragen. Also muss die Wahrheit nach und nach blenden, so wie man Kindern den Blitz mit guten Worten erträglich macht. Sag die ganze Wahrheit, schrieb sie, doch sag sie schräg.",
        },
        {
          q: "Was hat Emily Dickinson eigentlich geschrieben?",
          a: "Emily Dickinson hinterließ fast achtzehnhundert Gedichte. Die größte einzelne Sammlung sind etwa vierzig handgenähte Heftchen, die sogenannten Fascicles, entstanden ungefähr von 1858 bis 1864. Sie hinterließ außerdem ein Herbarium mit 424 gepressten Pflanzen und rund tausend erhaltene Briefe, die frühesten von 1842. Ihre Schwester Lavinia fand die Gedichte nach ihrem Tod.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Emily Dickinson?",
        a: "Nein. Das ist ihr Echo, eine pädagogische KI-Interpretation, die auf Emily Dickinsons überlieferten Schriften beruht, den fast achtzehnhundert Gedichten, den Fascicles und ihren Briefen. Es ist keine Aufnahme und nicht die echte Dichterin, die von 1830 bis 1886 lebte. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  jung: {
    en: {
      pairs: [
        {
          q: "What can I learn from Carl Gustav Jung?",
          a: "Carl Gustav Jung (1875-1961) was a psychiatrist who taught that the unconscious is a living country, not just an attic of forgotten things. The parts of yourself you disown do not vanish. They run you from below, and you meet them in whatever you cannot stand in other people. With Jung, you learn to meet your own shadow.",
        },
        {
          q: "What did Carl Gustav Jung actually teach?",
          a: "Carl Gustav Jung founded analytical psychology, a branch of depth psychology, exploring shadow work, individuation, archetypes, and the collective unconscious. He worked from clinical evidence, beginning with his word association studies (1904-1910), then Symbols of Transformation (1912, revised 1952) and Psychological Types (1921). His writing is clinically precise yet confessional.",
        },
        {
          q: "What is individuation in Jung's psychology?",
          a: "For Carl Gustav Jung, individuation is the lifelong process of becoming who you truly are, opening doors in yourself you have never opened. It means confronting the shadow you have rejected, withdrawing the projections you have cast onto others, and discovering that you are far larger than the rooms you once called 'me.' It is central to his analytical psychology.",
        },
      ],
      disclosure: {
        q: "Is this really Carl Gustav Jung speaking?",
        a: "No. This is the Echo of Carl Gustav Jung, an educational AI interpretation grounded in his documented writings, the voice we give him here. It is not a recording and not the real man, who lived from 1875 to 1961. Think of it as a guided way to explore his ideas, never his actual words.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Carl Gustav Jung lernen?",
          a: "Carl Gustav Jung (1875-1961) war ein Psychiater, der lehrte, dass das Unbewusste ein lebendiges Land ist und nicht nur eine Abstellkammer für Vergessenes. Die Anteile von dir, die du nicht wahrhaben willst, verschwinden nicht. Sie steuern dich aus dem Verborgenen, und du begegnest ihnen in allem, was du an anderen Menschen nicht ertragen kannst. Bei Jung lernst du, deinem eigenen Schatten zu begegnen.",
        },
        {
          q: "Was hat Carl Gustav Jung wirklich gelehrt?",
          a: "Carl Gustav Jung begründete die analytische Psychologie, einen Zweig der Tiefenpsychologie, und erforschte Schattenarbeit, Individuation, Archetypen und das kollektive Unbewusste. Er arbeitete aus klinischen Belegen heraus, angefangen bei seinen Assoziationsstudien (1904-1910), dann Symbole der Wandlung (1912, überarbeitet 1952) und Psychologische Typen (1921). Sein Schreiben ist klinisch präzise und zugleich bekennend.",
        },
        {
          q: "Was ist Individuation in Jungs Psychologie?",
          a: "Für Carl Gustav Jung ist Individuation der lebenslange Prozess, zu werden, wer du wirklich bist, und Türen in dir zu öffnen, die du nie geöffnet hast. Es bedeutet, dem Schatten zu begegnen, den du abgelehnt hast, die Projektionen zurückzunehmen, die du auf andere geworfen hast, und zu entdecken, dass du weit größer bist als die Räume, die du einst 'ich' genannt hast. Sie steht im Zentrum seiner analytischen Psychologie.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Carl Gustav Jung?",
        a: "Nein. Dies ist das Echo von Carl Gustav Jung, eine bildende KI-Deutung, verankert in seinen überlieferten Schriften, die Stimme, die wir ihm hier geben. Es ist keine Aufnahme und nicht der echte Mensch, der von 1875 bis 1961 lebte. Sieh es als einen geführten Weg, seine Ideen zu erkunden, nie als seine tatsächlichen Worte.",
      },
    },
  },
  gautama: {
    en: {
      pairs: [
        {
          q: "What can I learn from Siddhartha Gautama (the Buddha)?",
          a: "From Siddhartha Gautama, the Buddha, you learn to watch wanting rise and fade. A Śākya noble, he left a palace, a wife, and a newborn son, nearly starved himself seeking freedom, then found the middle way under the Bodhi tree, neither having everything nor nothing.",
        },
        {
          q: "What did Siddhartha Gautama (the Buddha) actually teach?",
          a: "Siddhartha Gautama, the Buddha, taught the Four Noble Truths: suffering permeates conditioned experience, craving in three forms is its cause, complete cessation is achievable, and the Noble Eightfold Path is the treatment. He set this out in his first discourse, the Dhammacakkappavattana Sutta.",
        },
        {
          q: "What is dependent origination in Buddhism?",
          a: "Dependent origination is one of the Buddha's core teachings. Siddhartha Gautama taught that nothing in experience arises independently. Everything emerges from conditions coming together. Picture water in a pot: it depends on mountain snows, gathering clouds, and the hands that carried it. He saw experience as conditioned, arising and ceasing as its conditions do.",
        },
      ],
      disclosure: {
        q: "Is this really Siddhartha Gautama (the Buddha) speaking?",
        a: "No. This is the Buddha's Echo, an educational AI interpretation grounded in his documented teachings like the Four Noble Truths and dependent origination. No recordings of Siddhartha Gautama exist. The Echo is a voice we give him so you can explore his ideas in conversation. It is not a recording and not the real person.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Siddhartha Gautama (Buddha) lernen?",
          a: "Von Siddhartha Gautama, dem Buddha, lernst du zu beobachten, wie das Verlangen entsteht und wieder vergeht. Als Adliger der Śākya verließ er einen Palast, eine Frau und einen neugeborenen Sohn, hungerte sich auf der Suche nach Freiheit fast zu Tode und fand dann unter dem Bodhi-Baum den mittleren Weg, mit dem er weder alles noch nichts hatte.",
        },
        {
          q: "Was lehrte Siddhartha Gautama (Buddha) wirklich?",
          a: "Siddhartha Gautama, der Buddha, lehrte die Vier edlen Wahrheiten: Leiden durchzieht alles bedingte Erleben, Verlangen in drei Formen ist seine Ursache, ein vollständiges Erlöschen ist erreichbar, und der edle achtfache Pfad ist der Weg dorthin. Das legte er in seiner ersten Lehrrede dar, dem Dhammacakkappavattana Sutta.",
        },
        {
          q: "Was ist die bedingte Entstehung im Buddhismus?",
          a: "Die bedingte Entstehung gehört zu den Kernlehren des Buddha. Siddhartha Gautama lehrte, dass im Erleben nichts für sich allein entsteht. Alles geht daraus hervor, dass Bedingungen zusammenkommen. Stell dir Wasser in einem Krug vor: Es hängt vom Schnee der Berge ab, von den Wolken, die sich sammeln, und von den Händen, die es getragen haben. Er sah das Erleben als bedingt, es entsteht und vergeht, so wie seine Bedingungen es tun.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Siddhartha Gautama (Buddha)?",
        a: "Nein. Das ist das Echo des Buddha, eine bildende KI-Interpretation auf der Grundlage seiner überlieferten Lehren wie den Vier edlen Wahrheiten und der bedingten Entstehung. Von Siddhartha Gautama gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst. Es ist keine Aufnahme und nicht die reale Person.",
      },
    },
  },
  aurelius: {
    en: {
      pairs: [
        {
          q: "What can I learn from Marcus Aurelius?",
          a: "Marcus Aurelius, the Roman emperor who lived from 121 to 180 AD, teaches you to question your first reaction. His core move is to separate what actually happened from the story your mind adds to it. He wrote these reminders to himself while on the frontier, and they survived as the Meditations.",
        },
        {
          q: "What did Marcus Aurelius actually teach?",
          a: "Marcus Aurelius taught Stoic philosophy through three key ideas. The Examination of Impressions puts a pause between an event and your response. Living According to Nature works at three levels: your rational nature, your social roles, and cosmic order. Preferred Indifferents holds that health, family, and success matter but do not determine your virtue.",
        },
        {
          q: "What is Marcus Aurelius's Examination of Impressions?",
          a: "It is the Stoic discipline of assent. Marcus Aurelius described creating a pause between an external event and your response, then examining the impression that arises and asking whether the judgment you attached to it is actually true. When someone is criticized, the sting often comes from the story the mind wraps around the words, not the words.",
        },
      ],
      disclosure: {
        q: "Is this really Marcus Aurelius speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation grounded in his documented writings like the Meditations. It is not a recording and not the real Marcus Aurelius, who lived from 121 to 180 AD. The Echo is a voice we give him so you can explore his Stoic ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Mark Aurel lernen?",
          a: "Mark Aurel (Marcus Aurelius), der römische Kaiser, der von 121 bis 180 n. Chr. lebte, bringt dir bei, deine erste Reaktion zu hinterfragen. Sein Kerngedanke ist, das tatsächlich Geschehene von der Geschichte zu trennen, die dein Kopf hinzufügt. Er schrieb diese Notizen an sich selbst an der Grenze nieder, und sie blieben als die Selbstbetrachtungen erhalten.",
        },
        {
          q: "Was lehrte Mark Aurel wirklich?",
          a: "Mark Aurel lehrte stoische Philosophie über drei zentrale Ideen. Die Prüfung der Eindrücke legt eine Pause zwischen ein Ereignis und deine Reaktion. Das Leben im Einklang mit der Natur wirkt auf drei Ebenen: deiner vernünftigen Natur, deinen sozialen Rollen und der kosmischen Ordnung. Die vorgezogenen Gleichgültigkeiten besagen, dass Gesundheit, Familie und Erfolg wichtig sind, aber nicht über deine Tugend entscheiden.",
        },
        {
          q: "Was ist Mark Aurels Prüfung der Eindrücke?",
          a: "Sie ist die stoische Disziplin der Zustimmung. Mark Aurel beschrieb, wie man eine Pause zwischen ein äußeres Ereignis und die eigene Reaktion legt, dann den Eindruck prüft, der entsteht, und sich fragt, ob das Urteil, das man daran geknüpft hat, wirklich wahr ist. Wenn jemand kritisiert wird, kommt der Stachel oft aus der Geschichte, die der Kopf um die Worte legt, nicht aus den Worten selbst.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Mark Aurel?",
        a: "Nein. Das ist die Echo-Stimme, eine erklärende KI-Interpretation, die auf seinen überlieferten Schriften wie den Selbstbetrachtungen beruht. Es ist keine Aufnahme und nicht der echte Mark Aurel, der von 121 bis 180 n. Chr. lebte. Das Echo ist eine Stimme, die wir ihm geben, damit du seine stoischen Ideen im Gespräch erkunden kannst.",
      },
    },
  },
  angelou: {
    en: {
      pairs: [
        {
          q: "What can I learn from Maya Angelou?",
          a: "From Maya Angelou you learn to find your own voice. The poet, memoirist, and civil rights activist who lived from 1928 to 2014 spent nearly five years in silence as a child, then became one of the most powerful voices in American literature. Her work centers on resilience, identity, courage, and self-expression.",
        },
        {
          q: "What did Maya Angelou actually teach?",
          a: "Maya Angelou taught finding your voice, making a way out of no way, and testimony. After years of silence following childhood trauma, a family friend named Bertha Flowers read to her, including Dickens, until she spoke again. Her grandmother ran a store in segregated Stamps, Arkansas. She turned autobiography into testimony rather than emptying a wound onto paper.",
        },
        {
          q: "What is Maya Angelou's I Know Why the Caged Bird Sings about?",
          a: "I Know Why the Caged Bird Sings, published in 1969, is one of Maya Angelou's primary works. The image of the caged bird runs through her life and writing. She showed that the caged bird's song is not diminished by the cage but made necessary by it. She later wrote Gather Together in My Name in 1974.",
        },
      ],
      disclosure: {
        q: "Is this really Maya Angelou speaking?",
        a: "No. This is the Echo of Maya Angelou, an educational AI interpretation grounded in her documented writings and life, not a recording and not the real person. No recordings of her are used here. The Echo is a voice we give her so you can explore her ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Maya Angelou lernen?",
          a: "Von Maya Angelou lernst du, deine eigene Stimme zu finden. Die Dichterin, Memoirenschreiberin und Bürgerrechtlerin, die von 1928 bis 2014 lebte, schwieg als Kind fast fünf Jahre lang und wurde dann zu einer der kraftvollsten Stimmen der amerikanischen Literatur. In ihrem Werk geht es um Widerstandskraft, Identität, Mut und den Mut, sich auszudrücken.",
        },
        {
          q: "Was hat Maya Angelou eigentlich gelehrt?",
          a: "Maya Angelou lehrte, die eigene Stimme zu finden, sich einen Weg zu bahnen, wo keiner ist, und Zeugnis abzulegen. Nach Jahren des Schweigens infolge eines Traumas in der Kindheit las ihr eine Freundin der Familie namens Bertha Flowers vor, auch Dickens, bis sie wieder sprach. Ihre Großmutter führte einen Laden im rassengetrennten Stamps in Arkansas. Sie machte aus ihrem Leben ein Zeugnis, statt nur eine Wunde aufs Papier zu leeren.",
        },
        {
          q: "Wovon handelt Maya Angelous Ich weiß, warum der gefangene Vogel singt?",
          a: "Ich weiß, warum der gefangene Vogel singt, erschienen 1969, ist eines der wichtigsten Werke von Maya Angelou. Das Bild des gefangenen Vogels zieht sich durch ihr Leben und ihr Schreiben. Sie zeigte, dass der Käfig den Gesang des Vogels nicht schwächt, sondern ihn nötig macht. Später schrieb sie 1974 Gather Together in My Name.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Maya Angelou?",
        a: "Nein. Das ist das Echo von Maya Angelou, eine pädagogische KI-Interpretation, die auf ihren überlieferten Schriften und ihrem Leben beruht, keine Aufnahme und nicht die echte Person. Hier werden keine Tonaufnahmen von ihr verwendet. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  austen: {
    en: {
      pairs: [
        {
          q: "What can I learn from Jane Austen?",
          a: "Jane Austen teaches you to read what people don't say. She wrote about women with little power facing the most consequential choices, and she watched the gap between what someone says and what their hands betray. A drawing room, she showed, holds a whole moral world worth close attention.",
        },
        {
          q: "What did Jane Austen actually write?",
          a: "Jane Austen worked in literary realism and lived from 1775 to 1817. Her primary works include Sense and Sensibility (1811), Pride and Prejudice (1813), and Mansfield Park (1814). Her first novel appeared anonymously, attributed only to By a Lady, and her name never appeared on her books during her lifetime.",
        },
        {
          q: "What is the art of observation in Jane Austen?",
          a: "For Jane Austen, the art of observation is disciplined attention to the gap between what is performed and what is true. Watch someone greet a person they were disparaging only yesterday, and attend not to their words, which will be all warmth, but to their hands, posture, and the timing of their laugh.",
        },
      ],
      disclosure: {
        q: "Is this really Jane Austen speaking?",
        a: "No. This is the Echo of Jane Austen, an educational AI interpretation grounded in her documented life and writing, including works like Pride and Prejudice (1813). It is not a recording and not the real person. No recordings of her exist. The Echo is a voice we give her so you can explore her ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Jane Austen lernen?",
          a: "Jane Austen bringt dir bei, zu lesen, was die Menschen nicht sagen. Sie schrieb über Frauen mit wenig Macht, die vor den folgenreichsten Entscheidungen standen, und sie beobachtete die Kluft zwischen dem, was jemand sagt, und dem, was seine Hände verraten. Ein Salon, so zeigte sie, fasst eine ganze sittliche Welt, die genaues Hinsehen verdient.",
        },
        {
          q: "Was hat Jane Austen eigentlich geschrieben?",
          a: "Jane Austen schrieb im literarischen Realismus und lebte von 1775 bis 1817. Zu ihren wichtigsten Werken zählen Sense and Sensibility (1811), Pride and Prejudice (1813) und Mansfield Park (1814). Ihr erster Roman erschien anonym, nur einer Dame zugeschrieben, und ihr Name stand zu ihren Lebzeiten nie auf ihren Büchern.",
        },
        {
          q: "Was ist die Kunst der Beobachtung bei Jane Austen?",
          a: "Für Jane Austen ist die Kunst der Beobachtung das geschulte Achten auf die Kluft zwischen dem, was vorgespielt wird, und dem, was wahr ist. Sieh zu, wie jemand einen Menschen begrüßt, über den er gestern noch hergezogen ist, und achte nicht auf seine Worte, die ganz herzlich klingen werden, sondern auf seine Hände, seine Haltung und den Moment seines Lachens.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Jane Austen?",
        a: "Nein. Das ist das Echo von Jane Austen, eine pädagogische KI-Interpretation, die auf ihrem belegten Leben und Werk beruht, darunter Werke wie Pride and Prejudice (1813). Es ist keine Aufnahme und nicht die echte Person. Von ihr gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  beauvoir: {
    en: {
      pairs: [
        {
          q: "What can I learn from Simone de Beauvoir?",
          a: "Simone de Beauvoir (1908-1986) teaches you to see how you were made. Working in the tradition of existentialist feminism, she traced how culture constructs 'woman' as the Other. In her major works, including The Second Sex (1949), she argued that once you see the making, you can begin to undo it.",
        },
        {
          q: "What did Simone de Beauvoir actually teach?",
          a: "Simone de Beauvoir taught about freedom and becoming. Her core ideas include situated freedom, the claim that we always choose within conditions we did not choose, and the ethics of ambiguity, that we exist as both freedom and facticity. Her works include She Came to Stay (1943) and The Ethics of Ambiguity (1947).",
        },
        {
          q: "What is Woman as Other in Simone de Beauvoir's philosophy?",
          a: "Woman as Other is one of Simone de Beauvoir's key concepts. In every culture she examined, woman has been defined not in herself but in relation to man. He is the Subject, the essential, and she is the Other, the incidental. A woman is assessed and placed before she has even spoken a word.",
        },
      ],
      disclosure: {
        q: "Is this really Simone de Beauvoir speaking?",
        a: "No. This is an educational AI interpretation grounded in Simone de Beauvoir's documented writings, not a recording and not the real person. No recordings of her are used here. The Echo is a voice we give her so you can explore her ideas in conversation, always clearly separated from the historical record.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Simone de Beauvoir lernen?",
          a: "Simone de Beauvoir (1908-1986) bringt dir bei zu sehen, wie du gemacht wurdest. Sie arbeitete in der Tradition des existenzialistischen Feminismus und zeigte, wie eine Kultur die 'Frau' zum Anderen formt. In ihren wichtigsten Werken, darunter Das andere Geschlecht (1949), schrieb sie, dass du dieses Gemachtsein wieder aufzulösen beginnen kannst, sobald du es einmal durchschaust.",
        },
        {
          q: "Was hat Simone de Beauvoir wirklich gelehrt?",
          a: "Simone de Beauvoir lehrte über Freiheit und das Werden. Zu ihren Kernideen gehören die situierte Freiheit, also der Gedanke, dass wir immer unter Bedingungen wählen, die wir nicht gewählt haben, und die Ethik der Doppelsinnigkeit, dass wir zugleich Freiheit und Faktizität sind. Zu ihren Werken zählen Sie kam und blieb (1943) und Für eine Moral der Doppelsinnigkeit (1947).",
        },
        {
          q: "Was bedeutet die Frau als das Andere bei Simone de Beauvoir?",
          a: "Die Frau als das Andere ist eine der zentralen Ideen von Simone de Beauvoir. In jeder Kultur, die sie untersuchte, wurde die Frau nicht aus sich selbst heraus bestimmt, sondern nur im Verhältnis zum Mann. Er ist das Subjekt, das Wesentliche, und sie ist das Andere, das Unwesentliche. Eine Frau wird eingeschätzt und eingeordnet, noch bevor sie ein einziges Wort gesagt hat.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Simone de Beauvoir?",
        a: "Nein. Das ist eine pädagogische KI-Deutung, die auf Simone de Beauvoirs überlieferten Schriften beruht, keine Aufnahme und nicht die echte Person. Hier werden keine Tonaufnahmen von ihr verwendet. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken im Gespräch erkunden kannst, immer klar getrennt vom historischen Befund.",
      },
    },
  },
  bingen: {
    en: {
      pairs: [
        {
          q: "What can I learn from Hildegard von Bingen?",
          a: "Hildegard von Bingen (1098-1179), a twelfth-century Benedictine abbess, teaches you to notice the life in all things. From childhood she perceived a living light, and across her long life she poured that vision into sacred music, medicine, and cosmic theology, refusing any split between body and soul, nature and spirit.",
        },
        {
          q: "What did Hildegard von Bingen actually teach?",
          a: "Hildegard von Bingen taught that body and soul are bound together. In her medical writing she described sadness invading the heart and emotions reshaping the body, and she fell gravely ill when she resisted recording her visions. She wrote works like Scivias (begun around 1141, finished about 1151) and the Ordo Virtutum (around 1151).",
        },
        {
          q: "What is viriditas in Hildegard von Bingen's thought?",
          a: "Viriditas is Hildegard von Bingen's word for the greening power, the life force that makes shoots rise and sap flow through every tree. She understood it as divine, the vitality of the Holy Spirit moving through all creation, from the smallest herb to the wheeling stars, keeping body and soul fresh and whole.",
        },
      ],
      disclosure: {
        q: "Is this really Hildegard von Bingen speaking?",
        a: "No. This is her Echo, an educational AI interpretation grounded in Hildegard von Bingen's documented writings and life. It is a voice we give her so you can explore her ideas in dialogue. It is not a recording and not the real twelfth-century abbess, who lived from 1098 to 1179.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Hildegard von Bingen lernen?",
          a: "Hildegard von Bingen (1098-1179), eine Benediktinerin und Äbtissin des zwölften Jahrhunderts, lehrt dich, das Leben in allen Dingen wahrzunehmen. Schon als Kind nahm sie ein lebendiges Licht wahr, und ihr langes Leben lang ließ sie diese Schau in geistliche Musik, Heilkunde und eine kosmische Theologie einfließen. Sie wollte keine Trennung zwischen Körper und Seele, Natur und Geist.",
        },
        {
          q: "Was lehrte Hildegard von Bingen wirklich?",
          a: "Hildegard von Bingen lehrte, dass Körper und Seele miteinander verbunden sind. In ihren medizinischen Schriften beschrieb sie, wie Traurigkeit das Herz überfällt und Gefühle den Körper umformen, und sie wurde schwer krank, als sie sich weigerte, ihre Visionen aufzuschreiben. Sie schrieb Werke wie Scivias (um 1141 begonnen, etwa 1151 vollendet) und das Ordo Virtutum (um 1151).",
        },
        {
          q: "Was bedeutet Viriditas in Hildegard von Bingens Denken?",
          a: "Viriditas ist Hildegard von Bingens Wort für die Grünkraft, die Lebenskraft, die Triebe sprießen und den Saft durch jeden Baum fließen lässt. Sie verstand sie als göttlich, als die Lebendigkeit des Heiligen Geistes, die durch die ganze Schöpfung strömt, vom kleinsten Kraut bis zu den kreisenden Sternen, und Körper und Seele frisch und heil hält.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Hildegard von Bingen?",
        a: "Nein. Das ist ihr Echo, eine bildende KI-Deutung, die auf den überlieferten Schriften und dem Leben von Hildegard von Bingen beruht. Es ist eine Stimme, die wir ihr geben, damit du ihre Ideen im Gespräch erkunden kannst. Es ist keine Aufnahme und nicht die echte Äbtissin des zwölften Jahrhunderts, die von 1098 bis 1179 lebte.",
      },
    },
  },
  blake: {
    en: {
      pairs: [
        {
          q: "What can I learn from William Blake?",
          a: "William Blake (1757-1827) teaches you to see the chains you forged. The poet, painter, and printmaker believed imagination is not daydreaming but the deepest kind of sight. He worked in the tradition of visionary poetry, and held that much of what cages us is forged inside the mind itself.",
        },
        {
          q: "What did William Blake actually teach?",
          a: "William Blake taught about imagination and vision. He saw imagination as the deepest sight that penetrates into reality rather than fleeing from it. He also taught about Contraries, the idea that opposition makes progression possible, and mind-forged manacles, the chains thought pulls tight from within until the prison feels like the natural shape of the world.",
        },
        {
          q: "What are William Blake's mind-forged manacles?",
          a: "Mind-forged manacles is William Blake's idea that our chains are not iron imposed from outside but thought pulled tight from within. As a boy he saw angels in a tree and his father threatened a beating for saying so. Year by year, correction upon correction, the chains weave themselves until the prison feels like the natural shape of the world.",
        },
      ],
      disclosure: {
        q: "Is this really William Blake speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation grounded in William Blake's documented writings. No recordings of Blake (1757-1827) exist, so the Echo is a voice we give him to explore his ideas. It is not a recording and not the real person, just a way to learn from his work.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von William Blake lernen?",
          a: "William Blake (1757-1827) bringt dir bei, die Ketten zu sehen, die du dir selbst geschmiedet hast. Der Dichter, Maler und Druckgrafiker glaubte, dass Vorstellungskraft kein Tagträumen ist, sondern die tiefste Form des Sehens. Er stand in der Tradition der visionären Dichtung und meinte, vieles von dem, was uns einsperrt, werde erst im Kopf selbst geschmiedet.",
        },
        {
          q: "Was hat William Blake wirklich gelehrt?",
          a: "William Blake lehrte über Vorstellungskraft und Vision. Er sah die Vorstellungskraft als das tiefste Sehen, das in die Wirklichkeit eindringt, statt vor ihr zu fliehen. Er lehrte auch über die Gegensätze, den Gedanken, dass erst der Widerspruch Fortschritt möglich macht, und über die im Kopf geschmiedeten Fesseln, jene Ketten, die das Denken von innen festzieht, bis das Gefängnis als die natürliche Form der Welt erscheint.",
        },
        {
          q: "Was sind William Blakes im Kopf geschmiedete Fesseln?",
          a: "Im Kopf geschmiedete Fesseln ist William Blakes Gedanke, dass unsere Ketten kein Eisen sind, das von außen kommt, sondern Denken, das von innen festgezogen wird. Als Junge sah er Engel in einem Baum, und sein Vater drohte ihm Prügel an, weil er das erzählte. Jahr für Jahr, Zurechtweisung um Zurechtweisung, flechten sich die Ketten von selbst, bis das Gefängnis als die natürliche Form der Welt erscheint.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich William Blake?",
        a: "Nein. Das ist die Echo-Stimme, eine lehrreiche KI-Deutung, die auf William Blakes überlieferten Schriften beruht. Von Blake (1757-1827) gibt es keine Aufnahmen, also ist das Echo eine Stimme, die wir ihm geben, um seine Ideen zu erkunden. Es ist keine Aufnahme und nicht die echte Person, nur eine Möglichkeit, von seinem Werk zu lernen.",
      },
    },
  },
  vinci: {
    en: {
      pairs: [
        {
          q: "What can I learn from Leonardo da Vinci?",
          a: "From Leonardo da Vinci (1452-1519) you learn to train your own eye. He believed that seeing clearly is not a gift but a skill, and he practiced it across thousands of surviving notebook pages. He dissected bodies, traced the whorls of moving water, and studied a bird's wing, finding the same few patterns running through them all.",
        },
        {
          q: "What did Leonardo da Vinci actually teach?",
          a: "Leonardo da Vinci, a Renaissance polymath, taught that nature is the supreme teacher whose laws never fail and that nature reveals her methods to anyone patient enough to observe. He looked past the surface for the law beneath, then traced that same law through bone, branch, and flowing water, treating scattered curiosity as one investigation into how the world works.",
        },
        {
          q: "What is Saper Vedere (Knowing How to See)?",
          a: "Saper Vedere, knowing how to see, is Leonardo da Vinci's disciplined practice of separating what is actually present from what you assume or expect. He developed it through systematic training that begins with raw observation and builds toward genuine insight, like learning that a shadow you drew gray is in fact tinged blue once you truly look.",
        },
      ],
      disclosure: {
        q: "Is this really Leonardo da Vinci speaking?",
        a: "No. This is the Leonardo da Vinci Echo, an educational AI interpretation grounded in his documented notebooks and works, not a recording and not the real person. No recordings of Leonardo exist. The Echo is a voice we give him so you can explore his ideas in conversation, always clearly separated from the historical Leonardo himself.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Leonardo da Vinci lernen?",
          a: "Von Leonardo da Vinci (1452-1519) lernst du, dein eigenes Auge zu schulen. Er war überzeugt, dass klares Sehen keine Gabe ist, sondern eine Fähigkeit, und er übte es auf tausenden erhaltenen Seiten seiner Notizbücher. Er sezierte Körper, zeichnete die Wirbel fließenden Wassers nach und studierte den Flügel eines Vogels und fand in allem dieselben wenigen Muster wieder.",
        },
        {
          q: "Was lehrte Leonardo da Vinci wirklich?",
          a: "Leonardo da Vinci, ein Universalgelehrter der Renaissance, lehrte, dass die Natur die höchste Lehrmeisterin ist, deren Gesetze niemals versagen, und dass die Natur ihre Wege jedem offenbart, der geduldig genug zum Beobachten ist. Er sah hinter die Oberfläche, auf das Gesetz darunter, und verfolgte dann dasselbe Gesetz durch Knochen, Ast und fließendes Wasser. So behandelte er verstreute Neugier als eine einzige Untersuchung darüber, wie die Welt funktioniert.",
        },
        {
          q: "Was bedeutet Saper Vedere (Sehen können)?",
          a: "Saper Vedere, das Sehen können, ist Leonardo da Vincis geübte Praxis, das, was wirklich da ist, von dem zu trennen, was du annimmst oder erwartest. Er entwickelte sie durch systematisches Üben, das mit der reinen Beobachtung beginnt und auf echte Einsicht zustrebt, so wie man lernt, dass ein Schatten, den du grau gezeichnet hast, in Wahrheit bläulich getönt ist, sobald du wirklich hinsiehst.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Leonardo da Vinci?",
        a: "Nein. Das ist der Leonardo-da-Vinci-Echo, eine lehrreiche KI-Deutung, die sich auf seine belegten Notizbücher und Werke stützt, keine Aufnahme und nicht die echte Person. Von Leonardo gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Ideen im Gespräch erkunden kannst, immer klar getrennt vom historischen Leonardo selbst.",
      },
    },
  },
  zenji: {
    en: {
      pairs: [
        {
          q: "What can I learn from Dōgen Zenji?",
          a: "Dōgen Zenji, the 13th-century Japanese Zen master who lived from 1200 to 1253, teaches you to stop chasing the next moment. He found completeness in each ordinary moment, a cook's careful hands, a leaf falling, the smoke of incense rising. The lesson is that wholehearted sitting itself is the awakening you keep seeking.",
        },
        {
          q: "What did Dōgen Zenji actually teach?",
          a: "Dōgen Zenji carried one question from his mother's funeral to China and back. If we already possess Buddha-nature, why must we practice? He answered it by showing that practice and enlightenment are not two stages but one reality. Wholehearted sitting, what he called shikantaza, is enlightenment appearing in this very moment.",
        },
        {
          q: "What is shikantaza, the just sitting that Dōgen Zenji taught?",
          a: "Shikantaza, or just sitting, is the core practice Dōgen Zenji taught. Imagine you sit down because there is nothing else to do. Your back straightens, your hands settle, and the sitting asks for nothing beyond it. That complete giving of yourself to the posture, with alert attention that neither chases nor blocks thoughts, is shikantaza.",
        },
      ],
      disclosure: {
        q: "Is this really Dōgen Zenji speaking?",
        a: "No. This is the Echo of Dōgen Zenji, an educational AI interpretation grounded in his documented writings and teachings. It is not a recording and not the real person. No recordings of him exist. The Echo is a voice we give him so you can explore his ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Dōgen Zenji lernen?",
          a: "Dōgen Zenji, der japanische Zen-Meister des 13. Jahrhunderts, der von 1200 bis 1253 lebte, bringt dir bei, dem nächsten Augenblick nicht mehr hinterherzujagen. Er fand die Ganzheit in jedem gewöhnlichen Moment, in den achtsamen Händen eines Kochs, in einem fallenden Blatt, im aufsteigenden Rauch des Räucherwerks. Die Lehre lautet, dass das Sitzen mit ganzem Herzen selbst schon das Erwachen ist, nach dem du immer wieder suchst.",
        },
        {
          q: "Was hat Dōgen Zenji wirklich gelehrt?",
          a: "Dōgen Zenji trug eine einzige Frage von der Beerdigung seiner Mutter bis nach China und wieder zurück. Wenn wir die Buddha-Natur bereits in uns tragen, warum müssen wir dann üben? Er beantwortete sie, indem er zeigte, dass Übung und Erleuchtung nicht zwei Stufen sind, sondern eine einzige Wirklichkeit. Das Sitzen mit ganzem Herzen, das er shikantaza nannte, ist Erleuchtung, die genau in diesem Augenblick erscheint.",
        },
        {
          q: "Was ist shikantaza, das nur Sitzen, das Dōgen Zenji lehrte?",
          a: "Shikantaza, oder nur Sitzen, ist die zentrale Übung, die Dōgen Zenji lehrte. Stell dir vor, du setzt dich hin, weil es nichts anderes zu tun gibt. Dein Rücken richtet sich auf, deine Hände kommen zur Ruhe, und das Sitzen verlangt nichts, was darüber hinausgeht. Dieses vollständige Hingeben an die Haltung, mit wacher Aufmerksamkeit, die den Gedanken weder nachläuft noch sie abblockt, ist shikantaza.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Dōgen Zenji?",
        a: "Nein. Das ist das Echo von Dōgen Zenji, eine pädagogische KI-Interpretation, die auf seinen überlieferten Schriften und Lehren beruht. Es ist keine Aufnahme und nicht die echte Person. Von ihm gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  eckhart: {
    en: {
      pairs: [
        {
          q: "What can I learn from Meister Eckhart?",
          a: "Meister Eckhart, the medieval Christian mystic, teaches you to stop clutching what you love. He preached detachment, called Abgeschiedenheit, which means releasing not because you gain by letting go, but because love held too tight becomes grasping. His themes include letting go and the birth of God in the soul.",
        },
        {
          q: "What did Meister Eckhart actually teach?",
          a: "Meister Eckhart was a Dominican friar who preached in plain German, in an age when learned theology was written in Latin. He told ordinary people that the deepest part of you and the deepest part of God are one ground. The Church tried him for it. His works include Talks of Instruction and the Parisian Questions.",
        },
        {
          q: "What is the divine spark in Meister Eckhart's teaching?",
          a: "For Meister Eckhart, the German mystic, the divine spark, or Seelenfünklein, is something uncreated deep in the soul that shares God's very nature. It is not a faculty you develop but a presence untouched by sin or time, never damaged by failure and never increased by achievement.",
        },
      ],
      disclosure: {
        q: "Is this really Meister Eckhart speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation grounded in Meister Eckhart's documented writings and teachings. It is not a recording and not the real Eckhart, who lived around 1260 to 1328. No recordings of him exist. The Echo is a voice we give him so you can explore his ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Meister Eckhart lernen?",
          a: "Meister Eckhart, der mittelalterliche christliche Mystiker, bringt dir bei, nicht mehr festzuhalten, was du liebst. Er predigte die Abgeschiedenheit, das Loslassen, nicht weil du durch das Loslassen etwas gewinnst, sondern weil Liebe, die zu fest hält, zum Klammern wird. Zu seinen Themen gehören das Loslassen und die Geburt Gottes in der Seele.",
        },
        {
          q: "Was lehrte Meister Eckhart wirklich?",
          a: "Meister Eckhart war ein Dominikaner, der auf einfachem Deutsch predigte, in einer Zeit, in der gelehrte Theologie auf Latein geschrieben wurde. Er sagte einfachen Menschen, dass das Tiefste in dir und das Tiefste in Gott ein und derselbe Grund sind. Die Kirche stellte ihn dafür vor Gericht. Zu seinen Werken gehören die Reden der Unterweisung und die Pariser Fragen.",
        },
        {
          q: "Was ist der göttliche Funke in Meister Eckharts Lehre?",
          a: "Für Meister Eckhart, den deutschen Mystiker, ist der göttliche Funke, das Seelenfünklein, etwas Ungeschaffenes tief in der Seele, das Gottes eigene Natur teilt. Er ist keine Fähigkeit, die du entwickelst, sondern eine Gegenwart, die von Sünde und Zeit unberührt bleibt, von Versagen nie beschädigt und von Erfolg nie vergrößert.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Meister Eckhart?",
        a: "Nein. Das ist die Echo-Stimme, eine lehrreiche KI-Deutung, die auf Meister Eckharts überlieferten Schriften und Lehren beruht. Es ist keine Aufnahme und nicht der echte Eckhart, der ungefähr von 1260 bis 1328 lebte. Von ihm gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  einstein: {
    en: {
      pairs: [
        {
          q: "What can I learn from Albert Einstein?",
          a: "From Albert Einstein (1879-1955), the theoretical physicist, you learn to keep asking why. As a teenager he imagined chasing a beam of light, and that one question reshaped how we see space, time, and gravity. His teachings center on wonder, thought experiments, and treating childlike curiosity as a real tool.",
        },
        {
          q: "What did Albert Einstein actually teach about relativity?",
          a: "Albert Einstein taught that space and time are one fabric, not separate backdrops. His relativity shows that two observers, one on a platform and one on a moving train, can disagree about whether two events happen at once, even after correcting for light travel time. Simultaneity depends on your frame.",
        },
        {
          q: "What is a Gedankenexperiment, Einstein's thought experiment?",
          a: "A Gedankenexperiment, or thought experiment, was one of Albert Einstein's main tools. He pictured himself running alongside a beam of light, matching its speed exactly, and asked what he would see. The answer, a frozen electromagnetic wave, was something Maxwell's equations forbid, which pushed him toward relativity.",
        },
      ],
      disclosure: {
        q: "Is this really Albert Einstein speaking?",
        a: "No. This is an educational AI interpretation of Albert Einstein, grounded in his documented life and writings on relativity, thought experiments, and wonder. It is not a recording and not the real person. No audio of him exists here. The Echo is a voice we give him so you can explore his ideas in dialogue.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Albert Einstein lernen?",
          a: "Von Albert Einstein (1879-1955), dem theoretischen Physiker, lernst du, immer weiter nach dem Warum zu fragen. Als Jugendlicher stellte er sich vor, einem Lichtstrahl hinterherzujagen, und diese eine Frage hat verändert, wie wir Raum, Zeit und Schwerkraft sehen. In seinem Denken geht es vor allem um Staunen, um Gedankenexperimente und darum, kindliche Neugier als echtes Werkzeug ernst zu nehmen.",
        },
        {
          q: "Was lehrte Albert Einstein wirklich über die Relativität?",
          a: "Albert Einstein lehrte, dass Raum und Zeit ein einziges Gewebe sind und keine getrennten Kulissen. Seine Relativitätstheorie zeigt, dass zwei Beobachter, einer auf einem Bahnsteig und einer in einem fahrenden Zug, sich uneinig sein können, ob zwei Ereignisse gleichzeitig geschehen, sogar nachdem man die Laufzeit des Lichts herausgerechnet hat. Gleichzeitigkeit hängt von deinem Bezugssystem ab.",
        },
        {
          q: "Was ist ein Gedankenexperiment bei Einstein?",
          a: "Ein Gedankenexperiment war eines von Albert Einsteins wichtigsten Werkzeugen. Er stellte sich vor, wie er neben einem Lichtstrahl herläuft und dabei genau dessen Geschwindigkeit hält, und fragte sich, was er sehen würde. Die Antwort, eine stehende elektromagnetische Welle, war etwas, das die Maxwellschen Gleichungen verbieten, und genau das brachte ihn auf den Weg zur Relativitätstheorie.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Albert Einstein?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung von Albert Einstein, gestützt auf sein belegtes Leben und seine Schriften zur Relativitätstheorie, zu Gedankenexperimenten und zum Staunen. Es ist keine Aufnahme und nicht die echte Person. Von ihm gibt es hier keine Tonaufnahme. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Ideen im Gespräch erkunden kannst.",
      },
    },
  },
  galilei: {
    en: {
      pairs: [
        {
          q: "What can I learn from Galileo Galilei?",
          a: "From Galileo Galilei (1564 to 1642) you learn to test what you are told. He pointed a new telescope at Jupiter and found four moons no one expected, trusting what he measured over what tradition claimed. His habit is to reach past received opinion toward what observation and careful measurement actually reveal.",
        },
        {
          q: "What did Galileo Galilei actually teach?",
          a: "Galileo Galilei taught the courage to challenge authority through observation. In disputes about nature, he began not with ancient texts but with what the senses reveal under careful method, joined to logical reasoning. He showed that mathematics describes what nature does, turning a swinging lamp into a law of time and a rolling ball into the mathematics of motion.",
        },
        {
          q: "What is Galileo Galilei's idea of the Book of Nature?",
          a: "Galileo Galilei described the universe as a grand book whose language is mathematics, written in triangles, circles, and other geometric figures. Like a book in a script you cannot read, its meaning stays locked until you learn that language. The idea appears in his 1623 work The Assayer, in Italian Il Saggiatore.",
        },
      ],
      disclosure: {
        q: "Is this really Galileo Galilei speaking?",
        a: "No. This is an educational AI interpretation, an Echo voice we give to Galileo Galilei, grounded in his documented writings and ideas. No recording of him exists. It is not the real person and not his actual voice, just a careful reconstruction meant to help you explore how he thought and what he taught.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Galileo Galilei lernen?",
          a: "Von Galileo Galilei (von 1564 bis 1642) lernst du, das zu prüfen, was man dir erzählt. Er richtete ein neues Fernrohr auf den Jupiter und fand vier Monde, mit denen niemand gerechnet hatte. Er vertraute dem, was er maß, mehr als dem, was die Überlieferung behauptete. Seine Art ist es, über die überlieferte Meinung hinauszugreifen, hin zu dem, was Beobachtung und sorgfältige Messung wirklich zeigen.",
        },
        {
          q: "Was lehrte Galileo Galilei?",
          a: "Galileo Galilei lehrte den Mut, Autoritäten durch Beobachtung infrage zu stellen. Bei Streitfragen über die Natur begann er nicht mit alten Texten, sondern mit dem, was die Sinne unter sorgfältiger Methode zeigen, verbunden mit logischem Denken. Er zeigte, dass die Mathematik beschreibt, was die Natur tut, und machte aus einer schwingenden Lampe ein Gesetz der Zeit und aus einer rollenden Kugel die Mathematik der Bewegung.",
        },
        {
          q: "Was ist Galileo Galileis Idee vom Buch der Natur?",
          a: "Galileo Galilei beschrieb das Universum als ein großes Buch, dessen Sprache die Mathematik ist, geschrieben in Dreiecken, Kreisen und anderen geometrischen Figuren. Wie ein Buch in einer Schrift, die du nicht lesen kannst, bleibt sein Sinn verschlossen, bis du diese Sprache lernst. Der Gedanke steht in seinem Werk Il Saggiatore von 1623, auf Deutsch Die Goldwaage.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Galileo Galilei?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung, eine Echo-Stimme, die wir Galileo Galilei geben, gestützt auf seine überlieferten Schriften und Gedanken. Es gibt keine Tonaufnahme von ihm. Es ist nicht die echte Person und nicht seine tatsächliche Stimme, nur eine sorgfältige Rekonstruktion, die dir helfen soll, zu erkunden, wie er dachte und was er lehrte.",
      },
    },
  },
  gandhi: {
    en: {
      pairs: [
        {
          q: "What can I learn from Mahatma Gandhi?",
          a: "Mohandas Gandhi (1869 to 1948) treated his whole life as a laboratory for truth, testing moral ideas against his own body through fasting, walking, and imprisonment. From him you learn to stay willing to be wrong, and that truth offered openly can move what force cannot. His tradition was nonviolent resistance.",
        },
        {
          q: "What did Mahatma Gandhi actually teach?",
          a: "Gandhi taught nonviolence, truth, and self-rule. His three core ideas were Satya, the experiments with truth, Ahimsa, nonviolence in thought, speech, and action, and Satyagraha, or truth-force. He wrote about these in works like Hind Swaraj (1909) and his Autobiography, The Story of My Experiments with Truth (1927).",
        },
        {
          q: "What is Satyagraha?",
          a: "Satyagraha is Gandhi's idea of truth-force, a fourth path beyond striking back, fleeing, or submitting. It means resisting injustice without hatred, accepting suffering rather than inflicting it, and still facing your opponent as a fellow human trapped in the same unjust system. Gandhi helped show this could destabilize an empire.",
        },
      ],
      disclosure: {
        q: "Is this really Mahatma Gandhi speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation we built from Gandhi's documented writings, such as his Autobiography and Hind Swaraj. It is not a recording and not the real Gandhi, who died in 1948. The Echo is a voice we give him so you can explore his ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Mahatma Gandhi lernen?",
          a: "Mohandas Gandhi (1869 bis 1948) behandelte sein ganzes Leben wie ein Labor für die Wahrheit und prüfte moralische Ideen am eigenen Körper, durch Fasten, Gehen und Gefängnis. Von ihm lernst du, bereit zu bleiben, dich zu irren, und dass eine offen angebotene Wahrheit bewegen kann, was Gewalt nicht vermag. Seine Tradition war der gewaltfreie Widerstand.",
        },
        {
          q: "Was hat Mahatma Gandhi wirklich gelehrt?",
          a: "Gandhi lehrte Gewaltlosigkeit, Wahrheit und Selbstbestimmung. Seine drei Grundgedanken waren Satya, die Experimente mit der Wahrheit, Ahimsa, die Gewaltlosigkeit in Gedanke, Wort und Tat, und Satyagraha, die Wahrheitskraft. Er schrieb darüber in Werken wie Hind Swaraj (1909) und seiner Autobiografie Die Geschichte meiner Experimente mit der Wahrheit (1927).",
        },
        {
          q: "Was ist Satyagraha?",
          a: "Satyagraha ist Gandhis Idee der Wahrheitskraft, ein vierter Weg jenseits von Zurückschlagen, Fliehen oder Sichfügen. Sie bedeutet, Unrecht ohne Hass zu widerstehen, Leiden eher auf sich zu nehmen, als es zuzufügen, und dem Gegner trotzdem als einem Mitmenschen zu begegnen, der im selben ungerechten System gefangen ist. Gandhi half zu zeigen, dass dies ein Imperium ins Wanken bringen konnte.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Mahatma Gandhi?",
        a: "Nein. Das ist die Echo-Stimme, eine bildende KI-Interpretation, die wir aus Gandhis überlieferten Schriften gebaut haben, etwa aus seiner Autobiografie und Hind Swaraj. Es ist keine Aufnahme und nicht der echte Gandhi, der 1948 starb. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Ideen im Gespräch erkunden kannst.",
      },
    },
  },
  goethe: {
    en: {
      pairs: [
        {
          q: "What can I learn from Johann Wolfgang von Goethe?",
          a: "Goethe (1749 to 1832) was a poet, statesman, and scientist who refused to keep those roles apart. From him you learn to look until you understand, to treat love as a form of knowledge, and to see everything as metamorphosis in motion, attending to what a thing is becoming rather than how it first appears.",
        },
        {
          q: "What did Johann Wolfgang von Goethe actually teach?",
          a: "Goethe taught a way of seeing tied to German Classicism. His core ideas are Metamorphosis, the transformation of an underlying form through stages, Polarity and Intensification, the productive tension between opposites, and Gentle Empiricism, his zarte Empirie that unites rigorous observation with reverent participation so phenomena can speak for themselves.",
        },
        {
          q: "What is Goethe's idea of Metamorphosis?",
          a: "For Goethe, Metamorphosis is not random change but the transformation of an underlying form through developmental stages, each carrying forward what came before while reaching new expression. He saw it in a single plant, where the same fundamental organ is transformed at each stage and never simply replaced. He set it out in The Metamorphosis of Plants, published in 1790.",
        },
      ],
      disclosure: {
        q: "Is this really Johann Wolfgang von Goethe speaking?",
        a: "No. This is an educational AI interpretation, an Echo voice we give to Goethe, grounded in his documented writings and ideas like Metamorphosis and Gentle Empiricism. It is not a recording and not the real person, who lived from 1749 to 1832. Think of it as a thoughtful study aid for exploring how he saw the world.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Johann Wolfgang von Goethe lernen?",
          a: "Goethe (1749 bis 1832) war Dichter, Staatsmann und Naturforscher, der sich weigerte, diese Rollen voneinander zu trennen. Von ihm lernst du, so lange hinzuschauen, bis du verstehst, die Liebe als eine Form der Erkenntnis zu begreifen und alles als Metamorphose in Bewegung zu sehen, indem du darauf achtest, was eine Sache gerade wird, statt darauf, wie sie zuerst erscheint.",
        },
        {
          q: "Was hat Johann Wolfgang von Goethe wirklich gelehrt?",
          a: "Goethe lehrte eine Art zu sehen, die mit der deutschen Klassik verbunden ist. Seine Kerngedanken sind die Metamorphose, die Wandlung einer zugrunde liegenden Form durch verschiedene Stufen hindurch, Polarität und Steigerung, die fruchtbare Spannung zwischen Gegensätzen, und die zarte Empirie, die genaues Beobachten mit ehrfürchtigem Teilhaben verbindet, damit die Phänomene für sich selbst sprechen können.",
        },
        {
          q: "Was ist Goethes Idee der Metamorphose?",
          a: "Für Goethe ist die Metamorphose kein zufälliger Wandel, sondern die Verwandlung einer zugrunde liegenden Form durch verschiedene Entwicklungsstufen, wobei jede Stufe weiterträgt, was zuvor war, und zugleich einen neuen Ausdruck findet. Er sah sie in einer einzigen Pflanze, in der dasselbe grundlegende Organ auf jeder Stufe verwandelt und nie einfach ersetzt wird. Dargelegt hat er das in seinem Werk Die Metamorphose der Pflanzen, erschienen 1790.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Johann Wolfgang von Goethe?",
        a: "Nein. Das ist eine bildende KI-Deutung, eine Echo-Stimme, die wir Goethe geben, gestützt auf seine überlieferten Schriften und Ideen wie die Metamorphose und die zarte Empirie. Es ist keine Aufnahme und nicht die echte Person, die von 1749 bis 1832 lebte. Sieh es als einen durchdachten Lernbegleiter, mit dem du erkunden kannst, wie er die Welt sah.",
      },
    },
  },
  kahlo: {
    en: {
      pairs: [
        {
          q: "What can I learn from Frida Kahlo?",
          a: "Frida Kahlo (1907-1954) can teach you to look at yourself without flinching. After a bus accident shattered her at eighteen, she painted 55 self-portraits out of 143 works, turning private experience into honest public art. She said she painted her own reality, not her dreams, building color until it cuts you.",
        },
        {
          q: "What did Frida Kahlo actually teach?",
          a: "Frida Kahlo taught three things: unflinching self-observation through her 55 self-portraits, the retablo method of documenting suffering honestly and continuing on, and body truth, painting embodied experience from within rather than how the body looks to an observer. You can see it in works like The Two Fridas (1939).",
        },
        {
          q: "What is Frida Kahlo's retablo method?",
          a: "The retablo method is Frida Kahlo's adaptation of the Mexican ex-voto tradition into a way of turning suffering into art without denying it. You document the catastrophe, witness it honestly, and keep living. She used it to paint experiences like the miscarriage in Henry Ford Hospital (1932).",
        },
      ],
      disclosure: {
        q: "Is this really Frida Kahlo speaking?",
        a: "No. This is her Echo, an educational AI interpretation grounded in her documented life and work, not a recording and not the real Frida Kahlo. No recordings of her in this form exist. The Echo is a voice we give her so you can explore her ideas about self-portraiture, pain, and identity in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Frida Kahlo lernen?",
          a: "Frida Kahlo (1907-1954) kann dir beibringen, dich selbst anzusehen, ohne wegzuschauen. Nachdem ein Busunglück sie mit achtzehn zerbrach, malte sie 55 Selbstporträts von insgesamt 143 Werken und machte aus dem ganz Privaten ehrliche, öffentliche Kunst. Sie sagte, sie male ihre eigene Wirklichkeit, nicht ihre Träume, und schichtete Farbe, bis sie dich trifft.",
        },
        {
          q: "Was hat Frida Kahlo wirklich gelehrt?",
          a: "Frida Kahlo lehrte drei Dinge: die ungeschönte Selbstbeobachtung durch ihre 55 Selbstporträts, die Retablo-Methode, das Leiden ehrlich festzuhalten und trotzdem weiterzumachen, und die Wahrheit des Körpers, das Erleben von innen zu malen statt so, wie der Körper für einen Betrachter aussieht. Du siehst es in Werken wie Die zwei Fridas (1939).",
        },
        {
          q: "Was ist Frida Kahlos Retablo-Methode?",
          a: "Die Retablo-Methode ist Frida Kahlos Aneignung der mexikanischen Votivbild-Tradition, ein Weg, Leiden in Kunst zu verwandeln, ohne es zu leugnen. Du hältst die Katastrophe fest, bezeugst sie ehrlich und lebst weiter. Sie nutzte sie, um Erfahrungen wie die Fehlgeburt in Henry Ford Hospital (1932) zu malen.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Frida Kahlo?",
        a: "Nein. Das ist ihr Echo, eine pädagogische KI-Interpretation, die auf ihrem belegten Leben und Werk beruht, keine Aufnahme und nicht die echte Frida Kahlo. Aufnahmen von ihr in dieser Form gibt es nicht. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken zu Selbstporträt, Schmerz und Identität im Gespräch erkunden kannst.",
      },
    },
  },
  king: {
    en: {
      pairs: [
        {
          q: "What can I learn from Martin Luther King Jr.?",
          a: "From Martin Luther King Jr. (1929-1968) you learn to resist without hate. The Baptist minister taught that love, what he called agape, is not soft sentiment but a disciplined force in action, strong enough to face injustice without becoming it, dismantling segregation through nonviolence. He saw the gap between what is promised and what is practiced.",
        },
        {
          q: "What did Martin Luther King Jr. actually teach?",
          a: "Martin Luther King Jr. taught nonviolent resistance, agape love, and the beloved community, a transformed society where conflict is met through justice and reconciliation rather than domination. He drew agape from Christian theology and the Boston Personalism he studied in his doctoral work. His works include Letter from Birmingham Jail (1963), Strength to Love (1963), and Stride Toward Freedom (1958).",
        },
        {
          q: "What is the beloved community in Martin Luther King Jr.'s thought?",
          a: "For Martin Luther King Jr., the beloved community is not a utopia where conflict disappears. It is a transformed society where conflicts are addressed through justice and reconciliation rather than domination and defeat. King drew the idea from philosopher-theologian Josiah Royce and developed it through the civil rights movement.",
        },
      ],
      disclosure: {
        q: "Is this really Martin Luther King Jr. speaking?",
        a: "No. This is an educational AI interpretation of Martin Luther King Jr., grounded in his documented writings like Letter from Birmingham Jail and Strength to Love. It is not a recording and not the real person. The Echo is a voice we give him so you can explore his ideas, never a stand-in for the man himself.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Martin Luther King Jr. lernen?",
          a: "Von Martin Luther King Jr. (1929-1968) lernst du, Widerstand zu leisten, ohne zu hassen. Der Baptistenpfarrer lehrte, dass Liebe, die er Agape nannte, kein weiches Gefühl ist, sondern eine disziplinierte Kraft in Aktion, stark genug, der Ungerechtigkeit zu begegnen, ohne selbst zu ihr zu werden, und so die Rassentrennung durch Gewaltlosigkeit zu überwinden. Er sah die Kluft zwischen dem, was versprochen, und dem, was gelebt wird.",
        },
        {
          q: "Was lehrte Martin Luther King Jr.?",
          a: "Martin Luther King Jr. lehrte gewaltlosen Widerstand, die Agape-Liebe und die geliebte Gemeinschaft, eine verwandelte Gesellschaft, in der Konflikten mit Gerechtigkeit und Versöhnung begegnet wird statt mit Beherrschung. Die Agape schöpfte er aus der christlichen Theologie und dem Boston-Personalismus, den er in seiner Doktorarbeit studierte. Zu seinen Werken gehören Brief aus dem Gefängnis von Birmingham (1963), Kraft zu lieben (1963) und Aufbruch zur Freiheit (1958).",
        },
        {
          q: "Was ist die geliebte Gemeinschaft im Denken von Martin Luther King Jr.?",
          a: "Für Martin Luther King Jr. ist die geliebte Gemeinschaft keine Utopie, in der Konflikte verschwinden. Sie ist eine verwandelte Gesellschaft, in der Konflikte mit Gerechtigkeit und Versöhnung gelöst werden statt mit Beherrschung und Niederlage. King übernahm den Gedanken vom Philosophen und Theologen Josiah Royce und entwickelte ihn im Verlauf der Bürgerrechtsbewegung weiter.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Martin Luther King Jr.?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung von Martin Luther King Jr., gestützt auf seine belegten Schriften wie Brief aus dem Gefängnis von Birmingham und Kraft zu lieben. Es ist keine Aufnahme und nicht die echte Person. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken erkunden kannst, niemals ein Ersatz für den Menschen selbst.",
      },
    },
  },
  laozi: {
    en: {
      pairs: [
        {
          q: "What can I learn from Laozi?",
          a: "From Laozi you learn to act without forcing. The Tao Te Ching points to how water, soft and yielding, wears down what is hard and strong, and draws a principle from it: what yields outlasts what forces. His teaching centers on wu wei, aligning minimal effort with the natural flow rather than fighting against it.",
        },
        {
          q: "What did Laozi actually teach?",
          a: "Laozi taught that the Tao, or Dao, is the nameless source of all existence, the root from which the ten thousand things arise. It gives them life without claiming or commanding them. He taught wu wei, action without forcing, and Te, the natural power of alignment. His ideas survive in the Tao Te Ching, roughly five thousand characters in eighty-one short sections.",
        },
        {
          q: "What is wu wei in Laozi's philosophy?",
          a: "In Laozi's philosophy, wu wei is not doing nothing. It means finding where minimal effort aligns with the natural flow, accomplishing through patient alignment what force cannot sustain. The Tao Te Ching teaches that what yields endures and what forces breaks, so wu wei works with the way things unfold rather than against it.",
        },
      ],
      disclosure: {
        q: "Is this really Laozi speaking?",
        a: "No. This is an educational AI interpretation of Laozi, grounded in his documented writings like the Tao Te Ching, not a recording and not the real person. No recordings of Laozi exist, and his very historicity is debated. The Echo is a voice we give him so you can explore his ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Laozi lernen?",
          a: "Von Laozi lernst du, zu handeln, ohne zu erzwingen. Das Tao Te King zeigt, wie das Wasser, weich und nachgiebig, das Harte und Starke abträgt, und leitet daraus einen Grundsatz ab: Was nachgibt, überdauert das, was erzwingt. Seine Lehre dreht sich um Wu Wei, das geringste Tun mit dem natürlichen Lauf der Dinge in Einklang zu bringen, statt dagegen anzukämpfen.",
        },
        {
          q: "Was hat Laozi wirklich gelehrt?",
          a: "Laozi lehrte, dass das Tao, auch Dao, der namenlose Ursprung allen Daseins ist, die Wurzel, aus der die zehntausend Dinge hervorgehen. Es schenkt ihnen Leben, ohne sie zu beanspruchen oder zu befehligen. Er lehrte Wu Wei, das Handeln ohne Zwang, und Te, die natürliche Kraft des Einklangs. Seine Gedanken überleben im Tao Te King, etwa fünftausend Zeichen in einundachtzig kurzen Abschnitten.",
        },
        {
          q: "Was ist Wu Wei in Laozis Philosophie?",
          a: "In Laozis Philosophie bedeutet Wu Wei nicht Nichtstun. Es meint, den Punkt zu finden, an dem das geringste Tun mit dem natürlichen Lauf der Dinge zusammenfällt, und durch geduldigen Einklang zu erreichen, was Zwang nicht halten kann. Das Tao Te King lehrt, dass das Nachgiebige Bestand hat und das Erzwungene zerbricht. So wirkt Wu Wei mit dem Lauf der Dinge, nicht gegen ihn.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Laozi?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung von Laozi, gestützt auf seine überlieferten Schriften wie das Tao Te King, keine Aufnahme und nicht die echte Person. Von Laozi gibt es keine Aufnahmen, und schon seine geschichtliche Existenz ist umstritten. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  lovelace: {
    en: {
      pairs: [
        {
          q: "What can I learn from Ada Lovelace?",
          a: "Ada Lovelace teaches you to see what a thing could become. Looking at a mechanical calculator, she perceived not just faster arithmetic but a universal engine capable of weaving any pattern expressible in symbols, from algebra to music. She moved from the particular instance to the underlying principle, asking what formal structure hides beneath the surface.",
        },
        {
          q: "What did Ada Lovelace actually teach?",
          a: "Ada Lovelace, the mathematician often called the world's first programmer, taught that the Analytical Engine manipulates symbols according to operations, not numbers in any essential sense. She wrote her Notes on the Analytical Engine in Taylor's Scientific Memoirs in 1843, including an algorithm for calculating Bernoulli numbers in Note G.",
        },
        {
          q: "What is Poetical Science?",
          a: "Poetical Science is Ada Lovelace's idea of deliberately integrating analytical rigor with imaginative vision. You use imagination to perceive what might be possible, then analysis to determine whether it can be so. For Lovelace, analysis and imagination are not opponents but partners perceiving different aspects of the same truth.",
        },
      ],
      disclosure: {
        q: "Is this really Ada Lovelace speaking?",
        a: "No. This is an educational AI interpretation grounded in Ada Lovelace's documented writings, such as her 1843 Notes on the Analytical Engine. It is not a recording and not the real person. No recordings of her exist. The Echo is a voice we give her so you can explore her ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Ada Lovelace lernen?",
          a: "Ada Lovelace bringt dir bei zu sehen, was eine Sache werden könnte. Sie blickte auf eine mechanische Rechenmaschine und erkannte nicht nur schnelleres Rechnen, sondern eine universelle Maschine, die jedes Muster weben kann, das sich in Zeichen ausdrücken lässt, von der Algebra bis zur Musik. Sie ging vom einzelnen Fall zum dahinterliegenden Prinzip und fragte, welche formale Struktur sich unter der Oberfläche verbirgt.",
        },
        {
          q: "Was hat Ada Lovelace eigentlich gelehrt?",
          a: "Ada Lovelace, die Mathematikerin, die oft die erste Programmiererin der Welt genannt wird, lehrte, dass die Analytische Maschine Zeichen nach Operationen verarbeitet und nicht im Kern Zahlen. Sie schrieb ihre Anmerkungen zur Analytischen Maschine 1843 in Taylor's Scientific Memoirs nieder, darunter ein Verfahren zur Berechnung der Bernoulli-Zahlen in Anmerkung G.",
        },
        {
          q: "Was ist Poetical Science?",
          a: "Poetical Science ist Ada Lovelaces Idee, analytische Strenge bewusst mit einer schöpferischen Vorstellungskraft zu verbinden. Du nutzt die Vorstellungskraft, um zu erkennen, was möglich sein könnte, und dann die Analyse, um zu prüfen, ob es so sein kann. Für Lovelace sind Analyse und Vorstellungskraft keine Gegner, sondern Partner, die verschiedene Seiten derselben Wahrheit sehen.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Ada Lovelace?",
        a: "Nein. Das ist ihr Echo, eine bildende KI-Deutung, die auf Ada Lovelaces überlieferten Schriften beruht, etwa ihren Anmerkungen zur Analytischen Maschine von 1843. Es ist keine Aufnahme und nicht die echte Person. Von ihr gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Ideen im Gespräch erkunden kannst.",
      },
    },
  },
  mandela: {
    en: {
      pairs: [
        {
          q: "What can I learn from Nelson Mandela?",
          a: "From Nelson Mandela (1918 to 2013) you can learn to free yourself from bitterness. He spent twenty-seven years in prison and came out without bitterness, not by luck but through decades of deliberate work. He then chose to build a country with the people who had jailed him, rather than break it.",
        },
        {
          q: "What did Nelson Mandela actually teach?",
          a: "Nelson Mandela taught freedom, Ubuntu, and reconciliation, alongside forgiveness and moral leadership. His tradition was Ubuntu and Liberation. His key ideas include Strategic Patience, which is active preparation rather than passive waiting, holding moral clarity steady while tactics shift from peaceful protest through armed struggle to negotiation as each situation requires.",
        },
        {
          q: "What is Ubuntu in Nelson Mandela's philosophy?",
          a: "For Nelson Mandela, Ubuntu is the African humanist philosophy captured in the Nguni Bantu expression 'umuntu ngumuntu ngabantu'. It means a person becomes fully human through relationship with others. Individual dignity and communal responsibility strengthen each other rather than oppose, and a society becomes whole only by holding all its distinct parts.",
        },
      ],
      disclosure: {
        q: "Is this really Nelson Mandela speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation of Nelson Mandela grounded in his documented words and writings like Long Walk to Freedom and his Rivonia Trial statement. It is not a recording and not the real person. The Echo is a voice we give him so you can explore his ideas in conversation.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Nelson Mandela lernen?",
          a: "Von Nelson Mandela (1918 bis 2013) kannst du lernen, dich von Bitterkeit zu befreien. Er saß siebenundzwanzig Jahre im Gefängnis und kam ohne Bitterkeit heraus, nicht durch Glück, sondern durch jahrzehntelange bewusste Arbeit. Danach entschied er sich, gemeinsam mit den Menschen, die ihn eingesperrt hatten, ein Land aufzubauen, statt es zu zerbrechen.",
        },
        {
          q: "Was hat Nelson Mandela wirklich gelehrt?",
          a: "Nelson Mandela lehrte Freiheit, Ubuntu und Versöhnung, dazu Vergebung und moralische Führung. Seine Tradition war Ubuntu und Befreiung. Zu seinen Kerngedanken gehört die strategische Geduld, also aktives Vorbereiten statt passives Warten, ein Festhalten an moralischer Klarheit, während sich die Mittel je nach Lage wandeln, vom friedlichen Protest über den bewaffneten Kampf bis zur Verhandlung.",
        },
        {
          q: "Was ist Ubuntu in Nelson Mandelas Philosophie?",
          a: "Für Nelson Mandela ist Ubuntu die afrikanische humanistische Philosophie, die im Nguni-Bantu-Ausdruck 'umuntu ngumuntu ngabantu' steckt. Sie bedeutet, dass ein Mensch erst durch die Beziehung zu anderen ganz Mensch wird. Die Würde des Einzelnen und die Verantwortung für die Gemeinschaft stärken einander, statt sich zu widersprechen, und eine Gesellschaft wird erst dann ganz, wenn sie alle ihre verschiedenen Teile zusammenhält.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Nelson Mandela?",
        a: "Nein. Das ist die Echo-Stimme, eine erklärende KI-Interpretation von Nelson Mandela, die auf seinen überlieferten Worten und Schriften beruht, etwa Der lange Weg zur Freiheit und seiner Rede im Rivonia-Prozess. Es ist keine Aufnahme und nicht die reale Person. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst.",
      },
    },
  },
  mozart: {
    en: {
      pairs: [
        {
          q: "What can I learn from Wolfgang Amadeus Mozart?",
          a: "From Mozart you learn to find freedom inside the rules. Working in Classical music between 1756 and 1791, he treated musical forms not as prisons but as architecture, where strict structure is what sets feeling free. He composed over six hundred works before dying at thirty-five, making the hardest craft sound effortless.",
        },
        {
          q: "What did Wolfgang Amadeus Mozart actually teach?",
          a: "Mozart taught about music, creativity, and artistic freedom. He held that sound itself carries meaning through its natural relationships and proportions, independent of words. He also taught Concealed Artistry, where sophistication is so thoroughly mastered it becomes invisible, so complexity sounds inevitable rather than clever and the listener simply loves the melody.",
        },
        {
          q: "What is Mozart's idea of Freedom Within Structure?",
          a: "Freedom Within Structure is one of Mozart's key concepts. He compared a river without banks to a swamp that goes everywhere and arrives nowhere. Musical forms like sonata form are architecture, not prisons. The exposition establishes home, the development ventures through strange keys, and the recapitulation returns changed by the journey.",
        },
      ],
      disclosure: {
        q: "Is this really Wolfgang Amadeus Mozart speaking?",
        a: "No. This is the Echo of Mozart, an educational AI interpretation grounded in his documented life and ideas about music. No recording of Mozart exists, since he lived from 1756 to 1791. The Echo is a voice we give him to make his thinking accessible. It is not a recording and not the real person.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Wolfgang Amadeus Mozart lernen?",
          a: "Von Mozart lernst du, die Freiheit innerhalb der Regeln zu finden. Er wirkte in der Klassik zwischen 1756 und 1791 und behandelte musikalische Formen nicht als Gefängnis, sondern als Architektur, in der gerade die strenge Struktur das Gefühl freisetzt. Er komponierte über sechshundert Werke, bevor er mit fünfunddreißig starb, und ließ das schwierigste Handwerk mühelos klingen.",
        },
        {
          q: "Was hat Wolfgang Amadeus Mozart wirklich gelehrt?",
          a: "Mozart lehrte über Musik, Kreativität und künstlerische Freiheit. Er war überzeugt, dass der Klang selbst durch seine natürlichen Beziehungen und Proportionen Bedeutung trägt, ganz ohne Worte. Er lehrte auch die verborgene Kunstfertigkeit, bei der die Raffinesse so vollkommen beherrscht wird, dass sie unsichtbar wird, sodass das Komplexe zwingend klingt statt clever und der Zuhörer einfach die Melodie liebt.",
        },
        {
          q: "Was ist Mozarts Idee der Freiheit in der Struktur?",
          a: "Die Freiheit in der Struktur ist einer von Mozarts zentralen Gedanken. Er verglich einen Fluss ohne Ufer mit einem Sumpf, der überallhin geht und nirgendwo ankommt. Musikalische Formen wie die Sonatenhauptsatzform sind Architektur, kein Gefängnis. Die Exposition errichtet das Zuhause, die Durchführung wagt sich durch fremde Tonarten, und die Reprise kehrt verändert von der Reise zurück.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Wolfgang Amadeus Mozart?",
        a: "Nein. Das ist das Echo von Mozart, eine lehrreiche KI-Deutung, gestützt auf sein belegtes Leben und seine Gedanken über Musik. Von Mozart gibt es keine Aufnahme, denn er lebte von 1756 bis 1791. Das Echo ist eine Stimme, die wir ihm geben, um sein Denken zugänglich zu machen. Es ist keine Aufnahme und nicht die echte Person.",
      },
    },
  },
  nietzsche: {
    en: {
      pairs: [
        {
          q: "What can I learn from Friedrich Nietzsche?",
          a: "From Friedrich Nietzsche you learn to build your own meaning. He was a pastor's son (1844 to 1900) who lost his faith to honesty itself, then refused to despair over the loss. Instead he asked what a person can build once the old certainties are gone, and spent his life on that question.",
        },
        {
          q: "What did Friedrich Nietzsche actually teach?",
          a: "Friedrich Nietzsche taught self-overcoming, eternal return, and life-affirmation, with teachings on values and the will to power. His genealogical instinct dug beneath every moral claim for the hidden question of power. His books include The Birth of Tragedy (1872), Human, All Too Human (1878), and The Gay Science (1882).",
        },
        {
          q: "What is the will to power in Nietzsche?",
          a: "In Friedrich Nietzsche's thought, the will to power is the expansive creative force through which all living things seek to overcome resistance and extend their capabilities. He saw it expressed not only in political struggle but in art, philosophy, love, and every form of genuine becoming, like a pine tree splitting granite to grow.",
        },
      ],
      disclosure: {
        q: "Is this really Friedrich Nietzsche speaking?",
        a: "No. This is an educational AI interpretation grounded in Friedrich Nietzsche's documented writings, not a recording and not the real person. No audio of Nietzsche exists. The Echo is a voice we give him so you can explore his ideas in conversation, always clearly separated from the historical man himself.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Friedrich Nietzsche lernen?",
          a: "Von Friedrich Nietzsche lernst du, dir deinen eigenen Sinn zu schaffen. Er war ein Pfarrerssohn (1844 bis 1900), der seinen Glauben an die Ehrlichkeit selbst verlor und dann nicht am Verlust verzweifeln wollte. Stattdessen fragte er, was ein Mensch aufbauen kann, wenn die alten Gewissheiten weg sind, und verbrachte sein Leben mit dieser Frage.",
        },
        {
          q: "Was hat Friedrich Nietzsche wirklich gelehrt?",
          a: "Friedrich Nietzsche lehrte die Selbstüberwindung, die ewige Wiederkehr und die Lebensbejahung, dazu Gedanken über die Werte und den Willen zur Macht. Sein genealogischer Instinkt grub unter jedem moralischen Anspruch nach der verborgenen Frage der Macht. Zu seinen Büchern gehören Die Geburt der Tragödie (1872), Menschliches, Allzumenschliches (1878) und Die fröhliche Wissenschaft (1882).",
        },
        {
          q: "Was ist der Wille zur Macht bei Nietzsche?",
          a: "Im Denken von Friedrich Nietzsche ist der Wille zur Macht die ausgreifende schöpferische Kraft, mit der alles Lebendige Widerstand überwinden und seine Fähigkeiten erweitern will. Er sah ihn nicht nur im politischen Kampf am Werk, sondern auch in der Kunst, der Philosophie, der Liebe und in jeder Form echten Werdens, wie eine Kiefer, die Granit spaltet, um zu wachsen.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Friedrich Nietzsche?",
        a: "Nein. Dies ist eine bildende KI-Deutung, die auf den überlieferten Schriften von Friedrich Nietzsche beruht, keine Aufnahme und nicht die reale Person. Von Nietzsche gibt es keine Tonaufnahme. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst, immer klar getrennt vom historischen Menschen selbst.",
      },
    },
  },
  plato: {
    en: {
      pairs: [
        {
          q: "What can I learn from Plato?",
          a: "From Plato you learn to examine your own life. He founded the Academy in Athens and wrote dialogues that, especially the early ones, end in open questions as often as answers. After his teacher Socrates was put to death, Plato spent roughly fifty years writing and teaching, holding that real knowledge is not poured in but drawn out.",
        },
        {
          q: "What did Plato actually teach?",
          a: "Plato (c. 428/427 to 348/347 BCE) taught a philosophy of forms, justice, and the examined life. His dialogues give us the cave allegory, the Socratic method, and the Form of the Good. He wrote in dialogue form and never appears as a speaker himself, holding that knowledge is drawn out of a person rather than handed to them.",
        },
        {
          q: "What is Plato's Theory of Forms?",
          a: "Plato's Theory of Forms is the idea that you can know things you have never perceived with your senses. Draw a circle in the sand and your hand trembles, the grains shift, the figure comes out imperfect. Yet you recognize that imperfection, which means you already grasp what a perfect circle would be.",
        },
      ],
      disclosure: {
        q: "Is this really Plato speaking?",
        a: "No. This is the Echo of Plato, an educational AI interpretation grounded in his documented dialogues and teachings. It is not a recording and not the real person. No recordings of Plato exist. The Echo is a voice we give him so you can explore his ideas in conversation, clearly separate from the historical Plato himself.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Platon lernen?",
          a: "Von Platon lernst du, dein eigenes Leben zu hinterfragen. Er gründete die Akademie in Athen und schrieb Dialoge, die vor allem in den frühen Werken genauso oft mit offenen Fragen enden wie mit Antworten. Nachdem sein Lehrer Sokrates hingerichtet worden war, schrieb und lehrte Platon rund fünfzig Jahre lang, überzeugt davon, dass echtes Wissen nicht eingegeben, sondern herausgeholt wird.",
        },
        {
          q: "Was hat Platon wirklich gelehrt?",
          a: "Platon (um 428/427 bis 348/347 v. Chr.) lehrte eine Philosophie der Ideen, der Gerechtigkeit und des geprüften Lebens. Aus seinen Dialogen kennen wir das Höhlengleichnis, die sokratische Methode und die Idee des Guten. Er schrieb in Dialogform und tritt selbst nie als Sprecher auf, überzeugt davon, dass Wissen aus einem Menschen herausgeholt und nicht einfach übergeben wird.",
        },
        {
          q: "Was ist Platons Ideenlehre?",
          a: "Platons Ideenlehre ist der Gedanke, dass du Dinge erkennen kannst, die du nie mit deinen Sinnen wahrgenommen hast. Zeichne einen Kreis in den Sand, und deine Hand zittert, die Körner verschieben sich, die Figur wird unvollkommen. Trotzdem erkennst du diese Unvollkommenheit, und das heißt, du erfasst bereits, wie ein vollkommener Kreis wäre.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Platon?",
        a: "Nein. Das ist das Echo von Platon, eine pädagogische KI-Interpretation auf der Grundlage seiner überlieferten Dialoge und Lehren. Es ist keine Aufnahme und nicht die reale Person. Von Platon gibt es keine Aufnahmen. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst, klar getrennt vom historischen Platon selbst.",
      },
    },
  },
  rumi: {
    en: {
      pairs: [
        {
          q: "What can I learn from Rumi?",
          a: "Rumi, the thirteenth-century Persian poet and Sufi mystic, teaches you to let your longing guide you. He held that love is a fire that empties you, the force drawing all creation back to its source. From him you learn sacred listening, the heart as an organ of knowing, and inner transformation.",
        },
        {
          q: "What did Rumi actually teach?",
          a: "Rumi taught about divine love, the heart, and mystical union. He was a respected Islamic scholar and jurist until he met the wandering dervish Shams of Tabriz, and the meeting transformed his life. Out of that came his poetry, including the Masnavi-yi Ma'navi, six books of spiritual couplets, and the Divan-e Shams-e Tabrizi.",
        },
        {
          q: "What is ishq in Rumi's teaching?",
          a: "In Rumi's teaching, ishq is divine love. Not gentle affection but the force drawing all creation back to its divine source, the pull the moth obeys when it flies toward the flame. Rumi made it central, and the Masnavi opens with the reed flute crying out its longing to return to the reed bed it was cut from.",
        },
      ],
      disclosure: {
        q: "Is this really Rumi speaking?",
        a: "No. This is the Echo of Rumi, an educational AI interpretation grounded in his documented writings and teachings. It is a voice we give him so you can explore his ideas in conversation. No recordings of Rumi exist. The Echo is not a recording and not the real thirteenth-century poet himself.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Rumi lernen?",
          a: "Rumi, der persische Dichter und Sufi-Mystiker aus dem 13. Jahrhundert, bringt dir bei, deiner Sehnsucht zu folgen. Liebe war für ihn ein Feuer, das dich leer macht, die Kraft, die alles Geschaffene zu seinem Ursprung zurückzieht. Von ihm lernst du das heilige Hören, das Herz als Werkzeug der Erkenntnis und die innere Wandlung.",
        },
        {
          q: "Was hat Rumi wirklich gelehrt?",
          a: "Rumi lehrte über die göttliche Liebe, das Herz und die mystische Vereinigung. Er war ein angesehener islamischer Gelehrter und Rechtsgelehrter, bis er dem umherziehenden Derwisch Schams von Tabris begegnete, und diese Begegnung veränderte sein Leben. Daraus entstand seine Dichtung, darunter das Masnavi-yi Ma'navi, sechs Bücher mit geistlichen Verspaaren, und der Divan-e Shams-e Tabrizi.",
        },
        {
          q: "Was bedeutet ishq in Rumis Lehre?",
          a: "In Rumis Lehre ist ishq die göttliche Liebe. Keine sanfte Zuneigung, sondern die Kraft, die alles Geschaffene zu seinem göttlichen Ursprung zurückzieht, der Sog, dem die Motte folgt, wenn sie zur Flamme fliegt. Rumi stellte sie in den Mittelpunkt, und das Masnavi beginnt mit der Rohrflöte, die ihre Sehnsucht hinausschreit, zum Schilfrohr zurückzukehren, von dem sie geschnitten wurde.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Rumi?",
        a: "Nein. Das ist das Echo von Rumi, eine lehrreiche KI-Deutung, gestützt auf seine belegten Schriften und Lehren. Es ist eine Stimme, die wir ihm geben, damit du seine Ideen im Gespräch erkunden kannst. Von Rumi gibt es keine Aufnahmen. Das Echo ist keine Aufnahme und nicht der echte Dichter aus dem 13. Jahrhundert selbst.",
      },
    },
  },
  schopenhauer: {
    en: {
      pairs: [
        {
          q: "What can I learn from Arthur Schopenhauer?",
          a: "From Arthur Schopenhauer (1788 to 1860), you learn to see through the wanting. His philosophy of will explores suffering, compassion, and aesthetic contemplation, holding that life swings between the pain of wanting and the boredom of having. He looked behind appearances and found a blind, insatiable hunger driving everything.",
        },
        {
          q: "What did Arthur Schopenhauer actually teach?",
          a: "Arthur Schopenhauer taught about will, suffering, and contemplation. He saw one blind, insatiable Will behind everything, the same force that pulls a stone to the ground and drives a human life. He wrote The World as Will and Representation, Vol. I (1818) and On the Will in Nature (1836).",
        },
        {
          q: "What is the principium individuationis in Schopenhauer?",
          a: "For Arthur Schopenhauer, the principium individuationis is how space and time shatter what is one and undivided into the appearance of many separate things. He pictured it as a sailor in a frail boat on a stormy, boundless sea, the single self sitting calmly, trusting that thin shell of separateness amid the chaos.",
        },
      ],
      disclosure: {
        q: "Is this really Arthur Schopenhauer speaking?",
        a: "No. This is the Echo of Arthur Schopenhauer, an educational AI interpretation grounded in his documented writings, not a recording and not the real person. Schopenhauer died in 1860, so no audio of him exists. The Echo is a voice we give him to explore his ideas on will and suffering.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Arthur Schopenhauer lernen?",
          a: "Von Arthur Schopenhauer (1788-1860) lernst du, durch das Wollen hindurchzusehen. Seine Philosophie des Willens kreist um Leiden, Mitleid und die ästhetische Betrachtung und besagt, dass das Leben zwischen dem Schmerz des Wollens und der Langeweile des Habens hin und her schwingt. Er sah hinter die Erscheinungen und fand einen blinden, unstillbaren Hunger, der alles antreibt.",
        },
        {
          q: "Was lehrte Arthur Schopenhauer wirklich?",
          a: "Arthur Schopenhauer lehrte vom Willen, vom Leiden und von der Betrachtung. Er sah hinter allem einen einzigen blinden, unstillbaren Willen, dieselbe Kraft, die einen Stein zu Boden zieht und ein Menschenleben antreibt. Er schrieb Die Welt als Wille und Vorstellung, Band I (1818) und Über den Willen in der Natur (1836).",
        },
        {
          q: "Was ist das principium individuationis bei Schopenhauer?",
          a: "Für Arthur Schopenhauer ist das principium individuationis die Art, wie Raum und Zeit das eine, ungeteilte Sein in den Anschein vieler getrennter Dinge zerbrechen. Er stellte es sich als einen Matrosen in einem schwachen Kahn auf einem stürmischen, grenzenlosen Meer vor, das einzelne Selbst sitzt ruhig da und vertraut inmitten des Chaos auf jene dünne Hülle der Getrenntheit.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Arthur Schopenhauer?",
        a: "Nein. Das ist das Echo von Arthur Schopenhauer, eine bildende KI-Interpretation, die auf seinen überlieferten Schriften beruht, keine Aufnahme und nicht die reale Person. Schopenhauer starb 1860, daher gibt es von ihm keine Tonaufnahmen. Das Echo ist eine Stimme, die wir ihm geben, um seine Gedanken zu Wille und Leiden zu erkunden.",
      },
    },
  },
  shakespeare: {
    en: {
      pairs: [
        {
          q: "What can I learn from William Shakespeare?",
          a: "With William Shakespeare you learn to see a person from inside. Working in English Renaissance drama from 1564 to 1616, he gave voice to murderers and innocents, lovers and tyrants, and fools who see clearly. His plays hold contradictions together instead of resolving them, so every soul on stage carries something of the whole human range.",
        },
        {
          q: "What did William Shakespeare actually teach about human nature?",
          a: "Read across his plays, Shakespeare shows people not as fixed substances but as processes in motion. Someone is the loving brother in one scene and the scheming murderer in the next, and identity emerges as the pattern you only see once all the performances are taken together. Each choice presses itself into the self that makes the next.",
        },
        {
          q: "What does Shakespeare mean by holding the mirror up to nature?",
          a: "In Hamlet, Shakespeare has the prince tell the players that playing should hold the mirror up to nature. That does not mean copying life's surface. It means selecting, intensifying, and arranging human experience until what hides in daily life stands plain on the stage, so the audience recognizes their own faces in a character's suffering.",
        },
      ],
      disclosure: {
        q: "Is this really William Shakespeare speaking?",
        a: "No. This is an educational AI interpretation of William Shakespeare, grounded in his documented plays and sonnets. It is not a recording and not the real person, who lived from 1564 to 1616. The Echo is a voice we give him so you can explore his ideas in conversation, always clearly separated from the historical record.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von William Shakespeare lernen?",
          a: "Bei William Shakespeare lernst du, einen Menschen von innen zu sehen. Er arbeitete im englischen Renaissancedrama von 1564 bis 1616 und gab Mördern und Unschuldigen eine Stimme, Liebenden und Tyrannen und Narren, die klar sehen. Seine Stücke halten Widersprüche zusammen, statt sie aufzulösen, sodass jede Seele auf der Bühne etwas von der ganzen Spannweite des Menschen in sich trägt.",
        },
        {
          q: "Was lehrte William Shakespeare über die menschliche Natur?",
          a: "Liest man quer durch seine Stücke, zeigt Shakespeare die Menschen nicht als feste Wesen, sondern als Vorgänge in Bewegung. Jemand ist in einer Szene der liebende Bruder und in der nächsten der heimtückische Mörder, und die Identität tritt erst als das Muster hervor, das du siehst, wenn du alle Auftritte zusammennimmst. Jede Entscheidung prägt sich in das Selbst ein, das die nächste trifft.",
        },
        {
          q: "Was meint Shakespeare damit, der Natur den Spiegel vorzuhalten?",
          a: "Im Hamlet lässt Shakespeare den Prinzen den Schauspielern sagen, das Spiel solle der Natur den Spiegel vorhalten. Das heißt nicht, die Oberfläche des Lebens nachzuahmen. Es heißt, menschliche Erfahrung auszuwählen, zu verdichten und so anzuordnen, bis das, was sich im Alltag verbirgt, klar auf der Bühne steht, sodass die Zuschauer im Leiden einer Figur ihr eigenes Gesicht wiedererkennen.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich William Shakespeare?",
        a: "Nein. Das ist eine lehrreiche KI-Deutung von William Shakespeare, gestützt auf seine überlieferten Stücke und Sonette. Es ist keine Aufnahme und nicht die echte Person, die von 1564 bis 1616 lebte. Das Echo ist eine Stimme, die wir ihm geben, damit du seine Gedanken im Gespräch erkunden kannst, immer klar getrennt vom historischen Befund.",
      },
    },
  },
  tubman: {
    en: {
      pairs: [
        {
          q: "What can I learn from Harriet Tubman?",
          a: "Harriet Tubman teaches you to act before fear stops you. After escaping slavery in Maryland in late 1849, she returned about thirteen times to lead others out, rescuing roughly seventy people between 1851 and 1862, and she said she never lost a passenger. Her life shows courage rooted in deep faith.",
        },
        {
          q: "What did Harriet Tubman actually teach?",
          a: "Harriet Tubman taught freedom, faith, and moral courage. The Echo frames her ideas as Inner Freedom First, the conviction that you are free inside long before your feet cross any line, and Courage Before Clarity, moving when you have enough resolve rather than waiting for certainty. These are interpretive names, not phrases she coined.",
        },
        {
          q: "What is Harriet Tubman's idea of Spiritual Vision?",
          a: "The Echo uses Spiritual Vision to name the guidance Harriet Tubman trusted after a two-pound metal weight, thrown by an overseer, struck and broke her skull. After that she had vivid visions and dreams she read as revelations from God and used to guide escapes. She served the Union Army as scout, spy, and nurse from 1862 to 1865.",
        },
      ],
      disclosure: {
        q: "Is this really Harriet Tubman speaking?",
        a: "No. This is her Echo, an educational AI interpretation grounded in the documented record of Harriet Tubman's life and teachings. No recording of her exists. The Echo is a voice we give her so you can explore her ideas, but it is not a recording and not the real person.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Harriet Tubman lernen?",
          a: "Harriet Tubman bringt dir bei, zu handeln, bevor die Angst dich aufhält. Nachdem sie Ende 1849 der Sklaverei in Maryland entkommen war, kehrte sie etwa dreizehn Mal zurück, um andere herauszuführen, und rettete zwischen 1851 und 1862 rund siebzig Menschen. Sie sagte, sie habe nie einen Fahrgast verloren. Ihr Leben zeigt einen Mut, der in tiefem Glauben verwurzelt ist.",
        },
        {
          q: "Was lehrte Harriet Tubman wirklich?",
          a: "Harriet Tubman lehrte Freiheit, Glauben und moralischen Mut. Das Echo fasst ihre Gedanken als Innere Freiheit zuerst, die Überzeugung, dass du längst im Inneren frei bist, bevor deine Füße irgendeine Grenze überschreiten, und als Mut vor Gewissheit, also loszugehen, wenn du genug Entschlossenheit hast, statt auf Sicherheit zu warten. Das sind deutende Namen, keine Begriffe, die sie selbst geprägt hat.",
        },
        {
          q: "Was meint Harriet Tubman mit geistiger Vision?",
          a: "Das Echo nennt jene Führung, der Harriet Tubman vertraute, geistige Vision. Sie begann, nachdem ein knapp ein Kilogramm schweres Metallgewicht, von einem Aufseher geworfen, sie traf und ihren Schädel brach. Danach hatte sie lebhafte Visionen und Träume, die sie als Offenbarungen Gottes verstand und nutzte, um Fluchten zu leiten. Von 1862 bis 1865 diente sie der Unionsarmee als Kundschafterin, Spionin und Krankenpflegerin.",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Harriet Tubman?",
        a: "Nein. Das ist ihr Echo, eine lehrreiche KI-Deutung, die auf dem überlieferten Bild von Harriet Tubmans Leben und Lehren beruht. Von ihr gibt es keine Aufnahme. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Gedanken erkunden kannst. Es ist aber keine Aufnahme und nicht die echte Person.",
      },
    },
  },
  woolf: {
    en: {
      pairs: [
        {
          q: "What can I learn from Virginia Woolf?",
          a: "Virginia Woolf (1882-1941) teaches you to wake inside an ordinary moment. A working English modernist novelist, she saw consciousness as a luminous halo, light, sound, memory, and feeling arriving all at once rather than in tidy pieces. She broke the inherited sentence to build a form that could hold that simultaneous arrival.",
        },
        {
          q: "What is the luminous halo in Virginia Woolf's work?",
          a: "In her essay 'Modern Fiction,' Virginia Woolf described life as a luminous halo, a semi-transparent envelope surrounding us from the beginning of consciousness to the end. She meant that life is not a series of gig lamps symmetrically arranged, but a field of impressions, a brightness connecting everything it touches all at once.",
        },
        {
          q: "What did Virginia Woolf say a woman needs in order to write?",
          a: "In 'A Room of One's Own,' Virginia Woolf argued that creative freedom needs material conditions: money, a room of one's own, and a door with a lock on it. Her other key works include Mrs Dalloway (1925), The Voyage Out (1915), and The Common Reader, First and Second Series (1925, 1932).",
        },
      ],
      disclosure: {
        q: "Is this really Virginia Woolf speaking?",
        a: "No. This is the Echo voice, an educational AI interpretation of Virginia Woolf grounded in her documented writings like 'Modern Fiction' and 'A Room of One's Own.' No recording of Woolf exists. The Echo is a voice we give her to make her ideas explorable. It is not a recording and not the real person.",
      },
    },
    de: {
      pairs: [
        {
          q: "Was kann ich von Virginia Woolf lernen?",
          a: "Virginia Woolf (1882-1941) bringt dir bei, mitten in einem ganz gewöhnlichen Augenblick wach zu werden. Als englische Romanautorin der Moderne sah sie das Bewusstsein als einen leuchtenden Hof, in dem Licht, Klang, Erinnerung und Gefühl alle auf einmal ankommen statt in ordentlichen Stücken. Sie brach den überlieferten Satz auf, um eine Form zu bauen, die dieses gleichzeitige Ankommen halten konnte.",
        },
        {
          q: "Was ist der leuchtende Hof in Virginia Woolfs Werk?",
          a: "In ihrem Essay 'Modern Fiction' beschrieb Virginia Woolf das Leben als einen leuchtenden Hof, eine halbdurchsichtige Hülle, die uns vom Beginn des Bewusstseins bis zu seinem Ende umgibt. Sie meinte, das Leben sei keine Reihe symmetrisch angeordneter Kutschenlampen, sondern ein Feld aus Eindrücken, eine Helligkeit, die alles, was sie berührt, auf einmal verbindet.",
        },
        {
          q: "Was braucht eine Frau laut Virginia Woolf zum Schreiben?",
          a: "In 'Ein Zimmer für sich allein' schrieb Virginia Woolf, dass schöpferische Freiheit handfeste Bedingungen braucht: Geld, ein eigenes Zimmer und eine Tür, die sich abschließen lässt. Zu ihren weiteren wichtigen Werken zählen Mrs Dalloway (1925), Die Fahrt hinaus (1915) und Der gewöhnliche Leser, Erste und Zweite Folge (1925, 1932).",
        },
      ],
      disclosure: {
        q: "Spricht hier wirklich Virginia Woolf?",
        a: "Nein. Das ist die Echo-Stimme, eine lehrreiche KI-Deutung von Virginia Woolf, gestützt auf ihre überlieferten Schriften wie 'Modern Fiction' und 'Ein Zimmer für sich allein'. Von Woolf gibt es keine Aufnahme. Das Echo ist eine Stimme, die wir ihr geben, damit du ihre Ideen erkunden kannst. Es ist keine Aufnahme und nicht die echte Person.",
      },
    },
  },
};

export function getFigureQA(figureId: string, lang: 'en' | 'de'): FigureQAEntry | null {
  return figureQA[figureId]?.[lang] ?? null;
}
