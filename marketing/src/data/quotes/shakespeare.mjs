// The Shakespeare quotes page: forty famous lines, where each stands, what it
// means in its scene, and five lines he never wrote. Every quoted line is
// copied from the edition in `quoteSource`, character for character, trimmed to
// the span shown; only the underscores that edition uses for italics are
// dropped, and prose passages run as one paragraph. Act, scene and speaker are
// that edition's own.
// Plain ESM, not TypeScript: the Node sitemap script can import the flag.

/** The page's own path. */
export const SHAKESPEARE_QUOTES_PATH = '/figures/william-shakespeare/quotes';

/** Crawl status of the quotes page: the robots meta reads it, and the sitemap
 *  lists the page only once it is true. */
export const SHAKESPEARE_QUOTES_INDEXABLE = true;

/** The edition every line is copied from. The hash is of that source file. */
export const quoteSource = {
  gutenbergEbook: 100,
  title: 'The Complete Works of William Shakespeare',
  sha256: '3cf4b3d44ee14cff4e14e78e2ad3318eff76f3f7f2afc3cee6bb925879110a37',
};

/**
 * @typedef {{
 *   id: string,
 *   lines: string[],
 *   prose?: boolean,
 *   work: string,
 *   act?: number,
 *   scene?: number,
 *   part?: string,
 *   verb?: string,
 *   by?: string,
 *   meaning: string,
 *   more?: { href: string, label: string },
 * }} Quote
 */

/** @type {{ id: string, title: string, navLabel: string, blurb: string, quotes: Quote[] }[]} */
export const quoteGroups = [
  {
    id: 'love',
    title: 'Quotes about love',
    navLabel: 'Love',
    blurb: 'Three of the best known come from one night on one balcony in Verona. Several of the others are warnings.',
    quotes: [
      {
        id: 'summers-day',
        lines: ['Shall I compare thee to a summer’s day?', 'Thou art more lovely and more temperate:'],
        work: 'Sonnet 18',
        meaning:
          'He raises the comparison only to turn it down, because a summer is too short, too hot and too changeable to match the person he loves. The real boast comes in the last line, “So long lives this, and this gives life to thee”. The poem itself is what keeps that beauty alive.',
        more: { href: '/figures/william-shakespeare/sonnets/18/', label: 'Read all of Sonnet 18' },
      },
      {
        id: 'star-crossed-lovers',
        lines: ['From forth the fatal loins of these two foes', 'A pair of star-cross’d lovers take their life;'],
        work: 'Romeo and Juliet',
        part: 'Prologue',
        by: 'the Chorus',
        meaning:
          'Before the first scene begins, the Chorus gives the ending away. Two children of feuding families will fall in love, and the stars are against them, which is what star-crossed means. “Take their life” says both that they are born into this feud and that they will die by their own hands.',
      },
      {
        id: 'wherefore-art-thou-romeo',
        lines: ['O Romeo, Romeo, wherefore art thou Romeo?', 'Deny thy father and refuse thy name.'],
        work: 'Romeo and Juliet',
        act: 2,
        scene: 2,
        by: 'Juliet',
        meaning:
          'Wherefore means why, not where. Juliet is alone on her balcony, with no idea Romeo is listening below, and she is asking why the boy she loves has to be a Montague, the one family hers is at war with.',
      },
      {
        id: 'whats-in-a-name',
        lines: ['What’s in a name? That which we call a rose', 'By any other name would smell as sweet;'],
        work: 'Romeo and Juliet',
        act: 2,
        scene: 2,
        by: 'Juliet',
        meaning:
          'Juliet keeps arguing with his surname. A rose would smell the same whatever we called it, so why should “Montague” matter? The rest of the play answers her, and the answer is sad, because the names and the feud behind them are what kill them both.',
      },
      {
        id: 'parting-is-such-sweet-sorrow',
        lines: ['Good night, good night. Parting is such sweet sorrow', 'That I shall say good night till it be morrow.'],
        work: 'Romeo and Juliet',
        act: 2,
        scene: 2,
        by: 'Juliet',
        meaning:
          'At the end of the balcony scene Juliet keeps saying goodnight and cannot make it stick. Leaving hurts, and yet the hurt is sweet, because every goodnight buys one more moment together, so she would happily keep saying it until morning.',
      },
      {
        id: 'violent-delights',
        lines: [
          'These violent delights have violent ends,',
          'And in their triumph die; like fire and powder,',
          'Which as they kiss consume.',
        ],
        work: 'Romeo and Juliet',
        act: 2,
        scene: 6,
        by: 'Friar Lawrence',
        meaning:
          'The friar says this to Romeo minutes before he marries him to Juliet. It is a warning, not a love line. Joy this fierce burns out the way gunpowder does the moment fire touches it, so, he says, “love moderately”.',
      },
      {
        id: 'music-be-the-food-of-love',
        lines: [
          'If music be the food of love, play on,',
          'Give me excess of it; that, surfeiting,',
          'The appetite may sicken and so die.',
        ],
        work: 'Twelfth Night',
        act: 1,
        scene: 1,
        by: 'Orsino, the Duke',
        meaning:
          'The play’s first lines. Orsino asks for so much music that his appetite for love will be overfed and die, and a few lines later he is already bored with the tune. He is a man in love with being in love, and the line is a gentle joke at his expense, not a toast to music.',
      },
      {
        id: 'green-eyed-monster',
        lines: ['O, beware, my lord, of jealousy;', 'It is the green-ey’d monster which doth mock', 'The meat it feeds on.'],
        work: 'Othello',
        act: 3,
        scene: 3,
        by: 'Iago',
        meaning:
          'Iago warns Othello against jealousy at the very moment he is planting it in him. The warning is part of the trap, and the monster he describes goes on to destroy Othello and Desdemona both.',
      },
    ],
  },
  {
    id: 'life-and-death',
    title: 'Quotes about life, time and death',
    navLabel: 'Life and death',
    blurb: 'Hamlet and Macbeth own most of this group, and both of them are looking straight at death.',
    quotes: [
      {
        id: 'to-be-or-not-to-be',
        lines: [
          'To be, or not to be, that is the question:',
          'Whether ’tis nobler in the mind to suffer',
          'The slings and arrows of outrageous fortune,',
          'Or to take arms against a sea of troubles,',
          'And by opposing end them?',
        ],
        work: 'Hamlet',
        act: 3,
        scene: 1,
        by: 'Hamlet',
        meaning:
          'It gets quoted for any big decision, but Hamlet is weighing whether to go on living at all, and ending his troubles here means ending his life. What holds him back, he decides, is fear of what comes after death, “the undiscover’d country” from which “no traveller returns”.',
      },
      {
        id: 'tomorrow-and-tomorrow',
        lines: [
          'Tomorrow, and tomorrow, and tomorrow,',
          'Creeps in this petty pace from day to day,',
          'To the last syllable of recorded time;',
          'And all our yesterdays have lighted fools',
          'The way to dusty death. Out, out, brief candle!',
          'Life’s but a walking shadow; a poor player,',
          'That struts and frets his hour upon the stage,',
          'And then is heard no more: it is a tale',
          'Told by an idiot, full of sound and fury,',
          'Signifying nothing.',
        ],
        work: 'Macbeth',
        act: 5,
        scene: 5,
        by: 'Macbeth',
        meaning:
          'Macbeth has just been told that his wife is dead, and the army that will end him is at the gates. Every day now crawls by like the last, and life looks like a bad actor’s hour on stage, all noise and no meaning. It is the verdict of a man who killed for a crown and found nothing in it.',
      },
      {
        id: 'all-the-worlds-a-stage',
        lines: [
          'All the world’s a stage,',
          'And all the men and women merely players;',
          'They have their exits and their entrances,',
          'And one man in his time plays many parts,',
          'His acts being seven ages.',
        ],
        work: 'As You Like It',
        act: 2,
        scene: 7,
        by: 'Jaques',
        meaning:
          'Jaques, the play’s resident pessimist, walks through the seven ages of a man, from the baby “mewling and puking” to an old age “sans everything”. The play answers him at once. The next moment Orlando carries in old Adam, a servant whose loyalty the speech has no room for.',
      },
      {
        id: 'such-stuff-as-dreams',
        lines: ['We are such stuff', 'As dreams are made on, and our little life', 'Is rounded with a sleep.'],
        work: 'The Tempest',
        act: 4,
        scene: 1,
        by: 'Prospero',
        meaning:
          'Prospero has just broken off a show his spirits were putting on, and he tells Ferdinand that the whole world, towers, temples, “the great globe itself”, will melt away like that show. A life is a short dream with sleep on either side of it. He says “made on”, not “made of”.',
      },
      {
        id: 'alas-poor-yorick',
        lines: ['Alas, poor Yorick. I knew him, Horatio, a fellow of infinite jest, of most excellent fancy.'],
        prose: true,
        work: 'Hamlet',
        act: 5,
        scene: 1,
        by: 'Hamlet',
        meaning:
          'In the graveyard Hamlet is handed the skull of the court jester who carried him on his back when he was a boy. Death stops being an idea and becomes a face he knew, and he says “I knew him, Horatio”, not “I knew him well”.',
      },
      {
        id: 'good-night-sweet-prince',
        lines: ['Now cracks a noble heart. Good night, sweet prince,', 'And flights of angels sing thee to thy rest.'],
        work: 'Hamlet',
        act: 5,
        scene: 2,
        by: 'Horatio',
        meaning:
          'Horatio says it the moment Hamlet dies, just after Hamlet’s own last words, “The rest is silence.” After a play full of spying and killing, the last word on Hamlet goes to his one true friend.',
      },
    ],
  },
  {
    id: 'power-and-ambition',
    title: 'Quotes about power and ambition',
    navLabel: 'Power and ambition',
    blurb: 'Crowns, plots and battles. Three of these belong to the murder of Julius Caesar.',
    quotes: [
      {
        id: 'beware-the-ides-of-march',
        lines: ['Beware the Ides of March.'],
        work: 'Julius Caesar',
        act: 1,
        scene: 2,
        by: 'a soothsayer',
        meaning:
          'A soothsayer calls it out of the crowd, twice, and Caesar looks him in the face and waves him off: “He is a dreamer; let us leave him.” The Ides is the fifteenth of March, the day Caesar is killed.',
      },
      {
        id: 'the-fault-dear-brutus',
        lines: [
          'Men at some time are masters of their fates:',
          'The fault, dear Brutus, is not in our stars,',
          'But in ourselves, that we are underlings.',
        ],
        work: 'Julius Caesar',
        act: 1,
        scene: 2,
        by: 'Cassius',
        meaning:
          'Cassius is talking Brutus into the plot against Caesar. Fate did not make them smaller men than Caesar, he says. They allowed it. The line gets quoted as a call to take responsibility for your life, but in the scene it is a recruiting speech for a murder.',
      },
      {
        id: 'et-tu-brute',
        lines: ['Et tu, Brute?'],
        work: 'Julius Caesar',
        act: 3,
        scene: 1,
        by: 'Caesar',
        meaning:
          '“You too, Brutus?” Caesar sees his friend among the men stabbing him, says “Then fall, Caesar!” and dies. The Latin is not in the Roman sources. The historian Suetonius wrote that Caesar died without a word, though some said he spoke in Greek, “You too, child?”',
      },
      {
        id: 'winter-of-our-discontent',
        lines: ['Now is the winter of our discontent', 'Made glorious summer by this son of York;'],
        work: 'Richard III',
        act: 1,
        scene: 1,
        by: 'Richard',
        meaning:
          'It is usually quoted as if the winter were still going on, but Richard is saying it is over. With his brother, the son of York, now king, the long war has turned into glorious summer. Richard hates the peace, and before the speech ends he is “determined to prove a villain”.',
      },
      {
        id: 'my-kingdom-for-a-horse',
        lines: ['A horse! A horse! My kingdom for a horse!'],
        work: 'Richard III',
        act: 5,
        scene: 4,
        by: 'King Richard',
        meaning:
          'Richard has lost his horse in his last battle, and when a follower offers to help him get away, he refuses. He wants a horse to keep fighting and find Richmond, the man who kills him in the next scene.',
      },
      {
        id: 'once-more-unto-the-breach',
        lines: ['Once more unto the breach, dear friends, once more,', 'Or close the wall up with our English dead.'],
        work: 'Henry V',
        act: 3,
        scene: 1,
        by: 'King Henry',
        meaning:
          'King Henry sends his soldiers back at the gap in the town walls of Harfleur: take it, or fill it with their own bodies. In peace, he says, a man should be modest and still, but war asks him to “imitate the action of the tiger”.',
      },
      {
        id: 'something-is-rotten',
        lines: ['Something is rotten in the state of Denmark.'],
        work: 'Hamlet',
        act: 1,
        scene: 4,
        by: 'Marcellus',
        meaning:
          'Marcellus, an officer of the watch, says it after Hamlet follows his father’s ghost into the dark. A ghost on the walls means something is wrong at the top, and he is right. The old king was murdered by his brother, who now wears the crown.',
      },
    ],
  },
  {
    id: 'evil-and-guilt',
    title: 'Quotes about evil and guilt',
    navLabel: 'Evil and guilt',
    blurb: 'Witches, a sleepwalker and a storm at sea. Most of these come from Macbeth.',
    quotes: [
      {
        id: 'fair-is-foul',
        lines: ['Fair is foul, and foul is fair:', 'Hover through the fog and filthy air.'],
        work: 'Macbeth',
        act: 1,
        scene: 1,
        by: 'the three witches',
        meaning:
          'The witches chant it together as the play begins, before we have even met Macbeth. It sets the rule for everything after, where good looks bad and bad looks good, and Macbeth’s first words echo it without his knowing: “So foul and fair a day I have not seen.”',
      },
      {
        id: 'double-double-toil-and-trouble',
        lines: ['Double, double, toil and trouble;', 'Fire, burn; and cauldron, bubble.'],
        work: 'Macbeth',
        act: 4,
        scene: 1,
        by: 'the three witches',
        meaning:
          'The witches’ refrain as they drop things like “eye of newt” into the cauldron. The brew raises the visions that tell Macbeth he is safe, and that false comfort is what ruins him.',
      },
      {
        id: 'something-wicked-this-way-comes',
        lines: ['By the pricking of my thumbs,', 'Something wicked this way comes.'],
        work: 'Macbeth',
        act: 4,
        scene: 1,
        by: 'the second witch',
        meaning:
          'A witch feels someone coming in her thumbs, and the wicked thing at the door is Macbeth himself. Ray Bradbury later took the line as the title of his 1962 novel.',
      },
      {
        id: 'out-damned-spot',
        lines: ['Out, damned spot! out, I say!'],
        work: 'Macbeth',
        act: 5,
        scene: 1,
        by: 'Lady Macbeth',
        meaning:
          'Lady Macbeth walks in her sleep, rubbing at blood on her hands that only she can see, while a doctor and a gentlewoman watch. After the murder she told her husband “A little water clears us of this deed”, and now no washing will do.',
      },
      {
        id: 'hell-is-empty',
        lines: ['“Hell is empty,', 'And all the devils are here.”'],
        work: 'The Tempest',
        act: 1,
        scene: 2,
        by: 'Ariel, quoting Ferdinand',
        meaning:
          'The spirit Ariel tells Prospero what Prince Ferdinand cried as he jumped from the ship in the storm. The storm and the flames were Ariel’s own work, done on Prospero’s orders, and not a hair on anyone’s head was harmed.',
      },
    ],
  },
  {
    id: 'wisdom-and-folly',
    title: 'Quotes about wisdom and folly',
    navLabel: 'Wisdom and folly',
    blurb: 'Good advice, often from the wrong mouth. Polonius gives the most of it and follows the least.',
    quotes: [
      {
        id: 'to-thine-own-self-be-true',
        lines: [
          'This above all: to thine own self be true;',
          'And it must follow, as the night the day,',
          'Thou canst not then be false to any man.',
        ],
        work: 'Hamlet',
        act: 1,
        scene: 3,
        by: 'Polonius',
        meaning:
          'It is the last tip in a list Polonius gives his son before he sails for France, right after a word on clothes and “Neither a borrower nor a lender be”. Polonius is a meddler who spends the play spying on people, so many readers hear worldly prudence in it, not the call to be your authentic self it has become.',
      },
      {
        id: 'brevity-is-the-soul-of-wit',
        lines: [
          'Therefore, since brevity is the soul of wit,',
          'And tediousness the limbs and outward flourishes,',
          'I will be brief.',
        ],
        work: 'Hamlet',
        act: 2,
        scene: 2,
        by: 'Polonius',
        meaning:
          'Polonius announces he will be brief and then rambles on until the Queen cuts in: “More matter, with less art.” Wit meant good sense then, not jokes, so the line says wisdom is short, and the man saying it proves the point by being long.',
      },
      {
        id: 'the-lady-protests-too-much',
        lines: ['The lady protests too much, methinks.'],
        work: 'Hamlet',
        act: 3,
        scene: 2,
        by: 'Queen Gertrude',
        meaning:
          'Gertrude is watching a play in which a queen swears she will never marry again, and Gertrude herself remarried within a month of her husband’s death. To protest meant to vow, so she is saying the stage queen promises too much to be believed. Many editions print “doth protest”, the wording of another early printing.',
      },
      {
        id: 'all-that-glisters',
        lines: ['All that glisters is not gold,', 'Often have you heard that told.'],
        work: 'The Merchant of Venice',
        act: 2,
        scene: 7,
        verb: 'Read out by',
        by: 'the Prince of Morocco, from a scroll',
        meaning:
          'The Prince of Morocco picks the gold casket to win Portia and finds a skull inside, with this scroll in its empty eye. Glisters means glitters, and the scroll itself admits the saying was already old: “Often have you heard that told.”',
      },
      {
        id: 'quality-of-mercy',
        lines: [
          'The quality of mercy is not strain’d,',
          'It droppeth as the gentle rain from heaven',
          'Upon the place beneath. It is twice blest,',
          'It blesseth him that gives and him that takes.',
        ],
        work: 'The Merchant of Venice',
        act: 4,
        scene: 1,
        by: 'Portia',
        meaning:
          'Portia, disguised as a young lawyer, asks Shylock to show mercy instead of cutting the pound of flesh he is owed. Mercy cannot be forced, which is what “strain’d” means. It falls freely like rain and blesses the one who gives it as much as the one who receives it.',
      },
      {
        id: 'better-part-of-valour',
        lines: ['The better part of valour is discretion, in the which better part I have saved my life.'],
        prose: true,
        work: 'Henry IV, Part 1',
        act: 5,
        scene: 4,
        by: 'Falstaff',
        meaning:
          'Falstaff has just played dead to get out of a fight, and he gets up once the danger has passed. He is dressing up cowardice as good sense, and the proverb people quote, “discretion is the better part of valour”, keeps his excuse and drops the joke.',
      },
      {
        id: 'the-worlds-mine-oyster',
        lines: ['Why then, the world’s mine oyster,', 'Which I with sword will open.'],
        work: 'The Merry Wives of Windsor',
        act: 2,
        scene: 2,
        by: 'Pistol',
        meaning:
          'Falstaff has just told Pistol “I will not lend thee a penny”, and Pistol answers that he will get his money another way, by prying the world open with his sword. Today it means the world is full of chances, which is sunnier than a threat of robbery.',
      },
      {
        id: 'greek-to-me',
        lines: [
          'But those that understood him smil’d at one another and shook their heads; but for mine own part, it was Greek to me.',
        ],
        prose: true,
        work: 'Julius Caesar',
        act: 1,
        scene: 2,
        by: 'Casca',
        meaning:
          'Casca is telling Cassius what happened when Caesar was offered the crown, and Cicero said something that Casca could not follow. In the play it is literal, since Cicero really was speaking Greek. Today it is the phrase for anything that makes no sense to you.',
      },
      {
        id: 'alls-well-that-ends-well',
        lines: ['All’s well that ends well; still the fine’s the crown.', 'Whate’er the course, the end is the renown.'],
        work: 'All’s Well That Ends Well',
        act: 4,
        scene: 4,
        by: 'Helena',
        meaning:
          'Helena says it once her trick has worked: she took another woman’s place in her runaway husband’s bed, and now she sets off to claim him. “The fine’s the crown” means the ending crowns everything, so the line asks you to judge the scheme by how it turns out, which is the question the play leaves you with.',
      },
    ],
  },
  {
    id: 'the-mind-and-the-self',
    title: 'Quotes about the mind and the self',
    navLabel: 'The mind and the self',
    blurb: 'What we are, what we think we are, and what other people tell us we are.',
    quotes: [
      {
        id: 'nothing-either-good-or-bad',
        lines: [
          'Why, then ’tis none to you; for there is nothing either good or bad but thinking makes it so. To me it is a prison.',
        ],
        prose: true,
        work: 'Hamlet',
        act: 2,
        scene: 2,
        by: 'Hamlet',
        meaning:
          'Hamlet tells his old school friends Rosencrantz and Guildenstern that Denmark is a prison, and when they disagree he grants that it may be no prison to them, since thinking is what makes a thing good or bad. It is quoted as a calm, almost Stoic idea, but he says it in misery, and a moment later he complains of “bad dreams”.',
      },
      {
        id: 'more-things-in-heaven-and-earth',
        lines: ['There are more things in heaven and earth, Horatio,', 'Than are dreamt of in your philosophy.'],
        work: 'Hamlet',
        act: 1,
        scene: 5,
        by: 'Hamlet',
        meaning:
          'Hamlet has just spoken with his father’s ghost, and his friend Horatio, a university man, can hardly believe what is going on. Philosophy here means book learning in general, so Hamlet is saying the world holds more than any learning can explain.',
      },
      {
        id: 'what-a-piece-of-work-is-man',
        lines: [
          'What a piece of work is man, how noble in reason, how infinite in faculties, in form and moving, how express and admirable; in action how like an angel, in apprehension, how like a god: the beauty of the world, the paragon of animals. And yet, to me, what is this quintessence of dust?',
        ],
        prose: true,
        work: 'Hamlet',
        act: 2,
        scene: 2,
        by: 'Hamlet',
        meaning:
          'Hamlet praises humankind in the grandest words he has, then drops them all. To him, now, man is only “this quintessence of dust”. He is telling his friends that he has lost all his joy, and the praise is there to show how far he has fallen.',
      },
      {
        id: 'some-are-born-great',
        lines: [
          'In my stars I am above thee, but be not afraid of greatness. Some are born great, some achieve greatness, and some have greatness thrust upon ’em.',
        ],
        prose: true,
        work: 'Twelfth Night',
        act: 2,
        scene: 5,
        verb: 'Read out by',
        by: 'Malvolio, from a forged letter',
        meaning:
          'The words come from a fake love letter, forged by Olivia’s maid Maria so that Malvolio, the household’s pompous steward, will think his lady wants to marry him. He believes every word, and at the end of the play he is mocked with this very line.',
      },
      {
        id: 'though-she-be-but-little',
        lines: [
          'O, when she’s angry, she is keen and shrewd.',
          'She was a vixen when she went to school,',
          'And though she be but little, she is fierce.',
        ],
        work: 'A Midsummer Night’s Dream',
        act: 3,
        scene: 2,
        by: 'Helena',
        meaning:
          'Helena says it about her old friend Hermia in the middle of a four-way quarrel in the woods, and it is meant as an insult: Hermia is short, and a vixen with it. On a mug or a tattoo it reads as praise, but in the scene Hermia is furious. “Little again! Nothing but low and little?”',
      },
    ],
  },
];

/**
 * Lines that go around under his name. `verdict` is the short answer shown
 * beside the line: whose it is, or what is known.
 * @type {{ id: string, line: string, verdict: string, body: string }[]}
 */
export const neverWrote = [
  {
    id: 'heavy-is-the-head',
    line: 'Heavy is the head that wears the crown',
    verdict: 'His idea, not his words',
    body:
      'He wrote “Uneasy lies the head that wears a crown.” It comes in Henry IV, Part 2, Act 3, Scene 1, where the sick king lies awake and envies the ship-boy who can sleep through a storm. The heavier version is a later rewording, and we do not know who made it.',
  },
  {
    id: 'hell-hath-no-fury',
    line: 'Hell hath no fury like a woman scorned',
    verdict: 'William Congreve, 1697',
    body:
      'It comes from The Mourning Bride, a tragedy by William Congreve first staged in 1697, more than eighty years after Shakespeare died. His lines run “Heaven has no rage like love to hatred turned, nor hell a fury like a woman scorned.” The same play opens with another line people hand to Shakespeare, “Music has charms to soothe a savage breast”, breast and not beast.',
  },
  {
    id: 'expectation-is-the-root',
    line: 'Expectation is the root of all heartache',
    verdict: 'Not in his works, first source unknown',
    body:
      'It is nowhere in his plays or poems, and we could not find who first said it. The nearest thing he did write is Helena’s line in All’s Well That Ends Well, Act 2, Scene 1: “Oft expectation fails, and most oft there / Where most it promises”.',
  },
  {
    id: 'meaning-of-life-gift',
    line: 'The meaning of life is to find your gift. The purpose of life is to give it away.',
    verdict: 'David Viscott, 1993',
    body:
      'Wikiquote traces it to Finding Your Strength in Difficult Times, a 1993 book of meditations by David Viscott. It gets pinned on Picasso too, and it is not in anything Shakespeare wrote.',
  },
  {
    id: 'lead-on-macduff',
    line: 'Lead on, Macduff',
    verdict: 'A misquote',
    body:
      'He wrote “lay on, Macduff”, from Macbeth’s last speech, just before the fight in which Macduff kills him (Macbeth, Act 5, Scene 8). Lay on means strike, so the line is a dare to fight to the death, not an invitation to lead the way.',
  },
];

/** Every quote in page order, for the count in the title and the checks. */
export const allQuotes = quoteGroups.flatMap((group) => group.quotes);
