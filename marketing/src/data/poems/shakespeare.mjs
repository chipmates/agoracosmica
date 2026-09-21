// Shakespeare's sonnets: the one copy of the text on the site, read by the
// collection page and by the page each sonnet has of its own. Verbatim from
// the public-domain edition named in the source note, contractions included.
// Plain ESM, not TypeScript: the Node sitemap script imports this module too.

/** @type {Record<string, { text: string }>} */
export const shakespearePoems = {
  "s18": {
    "text": "Shall I compare thee to a summer’s day?\nThou art more lovely and more temperate:\nRough winds do shake the darling buds of May,\nAnd summer’s lease hath all too short a date:\nSometime too hot the eye of heaven shines,\nAnd often is his gold complexion dimm’d,\nAnd every fair from fair sometime declines,\nBy chance, or nature’s changing course untrimm’d:\nBut thy eternal summer shall not fade,\nNor lose possession of that fair thou ow’st,\nNor shall death brag thou wander’st in his shade,\nWhen in eternal lines to time thou grow’st,\n    So long as men can breathe, or eyes can see,\n    So long lives this, and this gives life to thee."
  },
  "s29": {
    "text": "When in disgrace with fortune and men’s eyes\nI all alone beweep my outcast state,\nAnd trouble deaf heaven with my bootless cries,\nAnd look upon myself, and curse my fate,\nWishing me like to one more rich in hope,\nFeatur’d like him, like him with friends possess’d,\nDesiring this man’s art, and that man’s scope,\nWith what I most enjoy contented least;\nYet in these thoughts my self almost despising,\nHaply I think on thee, and then my state,\nLike to the lark at break of day arising\nFrom sullen earth, sings hymns at heaven’s gate;\n    For thy sweet love remember’d such wealth brings\n    That then I scorn to change my state with kings."
  },
  "s30": {
    "text": "When to the sessions of sweet silent thought\nI summon up remembrance of things past,\nI sigh the lack of many a thing I sought,\nAnd with old woes new wail my dear time’s waste:\nThen can I drown an eye, unused to flow,\nFor precious friends hid in death’s dateless night,\nAnd weep afresh love’s long since cancell’d woe,\nAnd moan the expense of many a vanish’d sight:\nThen can I grieve at grievances foregone,\nAnd heavily from woe to woe tell o’er\nThe sad account of fore-bemoaned moan,\nWhich I new pay as if not paid before.\n    But if the while I think on thee, dear friend,\n    All losses are restor’d and sorrows end."
  },
  "s60": {
    "text": "Like as the waves make towards the pebbled shore,\nSo do our minutes hasten to their end;\nEach changing place with that which goes before,\nIn sequent toil all forwards do contend.\nNativity, once in the main of light,\nCrawls to maturity, wherewith being crown’d,\nCrooked eclipses ’gainst his glory fight,\nAnd Time that gave doth now his gift confound.\nTime doth transfix the flourish set on youth\nAnd delves the parallels in beauty’s brow,\nFeeds on the rarities of nature’s truth,\nAnd nothing stands but for his scythe to mow:\n    And yet to times in hope, my verse shall stand.\n    Praising thy worth, despite his cruel hand."
  },
  "s65": {
    "text": "Since brass, nor stone, nor earth, nor boundless sea,\nBut sad mortality o’ersways their power,\nHow with this rage shall beauty hold a plea,\nWhose action is no stronger than a flower?\nO! how shall summer’s honey breath hold out,\nAgainst the wrackful siege of battering days,\nWhen rocks impregnable are not so stout,\nNor gates of steel so strong but Time decays?\nO fearful meditation! where, alack,\nShall Time’s best jewel from Time’s chest lie hid?\nOr what strong hand can hold his swift foot back?\nOr who his spoil of beauty can forbid?\n    O! none, unless this miracle have might,\n    That in black ink my love may still shine bright."
  },
  "s73": {
    "text": "That time of year thou mayst in me behold\nWhen yellow leaves, or none, or few, do hang\nUpon those boughs which shake against the cold,\nBare ruin’d choirs, where late the sweet birds sang.\nIn me thou see’st the twilight of such day\nAs after sunset fadeth in the west;\nWhich by and by black night doth take away,\nDeath’s second self, that seals up all in rest.\nIn me thou see’st the glowing of such fire,\nThat on the ashes of his youth doth lie,\nAs the death-bed, whereon it must expire,\nConsum’d with that which it was nourish’d by.\n    This thou perceiv’st, which makes thy love more strong,\n    To love that well, which thou must leave ere long."
  },
  "s116": {
    "text": "Let me not to the marriage of true minds\nAdmit impediments. Love is not love\nWhich alters when it alteration finds,\nOr bends with the remover to remove:\nO, no! it is an ever-fixed mark,\nThat looks on tempests and is never shaken;\nIt is the star to every wandering bark,\nWhose worth’s unknown, although his height be taken.\nLove’s not Time’s fool, though rosy lips and cheeks\nWithin his bending sickle’s compass come;\nLove alters not with his brief hours and weeks,\nBut bears it out even to the edge of doom.\n    If this be error and upon me prov’d,\n    I never writ, nor no man ever lov’d."
  },
  "s130": {
    "text": "My mistress’ eyes are nothing like the sun;\nCoral is far more red, than her lips red:\nIf snow be white, why then her breasts are dun;\nIf hairs be wires, black wires grow on her head.\nI have seen roses damask’d, red and white,\nBut no such roses see I in her cheeks;\nAnd in some perfumes is there more delight\nThan in the breath that from my mistress reeks.\nI love to hear her speak, yet well I know\nThat music hath a far more pleasing sound:\nI grant I never saw a goddess go;\nMy mistress, when she walks, treads on the ground:\n    And yet by heaven, I think my love as rare,\n    As any she belied with false compare."
  }
};

/** The eight sonnets with their number, first line and introduction. Reading
 *  order follows this list. */
export const shakespeareSonnets = [
  {
    key: 's18',
    num: 18,
    firstLine: "Shall I compare thee to a summer's day?",
    intro:
      'The most famous opening question in English. The comparison fails on purpose: summer fades, and the poem is built to outlast it. The last two lines state the wager plainly, and so far they have won.',
  },
  {
    key: 's29',
    num: 29,
    firstLine: "When in disgrace with fortune and men's eyes",
    intro:
      'Envy, shame, and self-pity, catalogued honestly for eight lines. Then one remembered person reverses everything. The turn at the lark is one of the great mood swings in poetry.',
  },
  {
    key: 's30',
    num: 30,
    firstLine: 'When to the sessions of sweet silent thought',
    intro:
      'Grief kept like an account book: old losses summoned to court and paid again in full. Thinking of one friend closes every account. Where 29 turns on joy, this one turns on restoration.',
  },
  {
    key: 's60',
    num: 60,
    firstLine: 'Like as the waves make towards the pebbled shore',
    intro:
      'Minutes replace each other like waves on shingle, and time mows down whatever it first made lovely. Against all that, the couplet enters one defiant hope.',
  },
  {
    key: 's65',
    num: 65,
    firstLine: 'Since brass, nor stone, nor earth, nor boundless sea',
    intro:
      'If brass, stone, earth, and ocean all lose to time, what chance does beauty have? None, the poem admits, unless a miracle holds, and the miracle it names is black ink.',
  },
  {
    key: 's73',
    num: 73,
    firstLine: 'That time of year thou mayst in me behold',
    intro:
      'Three images for growing old: bare autumn branches, fading twilight, a fire down to its embers. Then a quiet last line about loving well what you must leave.',
  },
  {
    key: 's116',
    num: 116,
    firstLine: 'Let me not to the marriage of true minds',
    intro:
      'The sonnet read at weddings, and stranger than its reputation. It defines love almost entirely by what love is not and never does, then stakes the whole claim on its own correctness.',
  },
  {
    key: 's130',
    num: 130,
    firstLine: "My mistress' eyes are nothing like the sun",
    intro:
      'A demolition of overblown love-poem comparisons, one cliche at a time. The couplet lands it as a real compliment: she needs no false ones.',
  },
];

/** URL segment per sonnet: the Quarto number, as the collection page numbers
 *  them, fixed here rather than derived at build time. */
export const shakespeareOrder = [
  { key: 's18', slug: '18' },
  { key: 's29', slug: '29' },
  { key: 's30', slug: '30' },
  { key: 's60', slug: '60' },
  { key: 's65', slug: '65' },
  { key: 's73', slug: '73' },
  { key: 's116', slug: '116' },
  { key: 's130', slug: '130' },
];

/** The collection page's source note, shown verbatim on every sonnet page. */
export const shakespeareSourceNote =
  'The sonnets are in the public domain. The texts here follow Shakespeare\'s Sonnets, Project Gutenberg ebook 1041, a modern-spelling text of the 1609 Quarto, reproduced verbatim including its punctuation and contractions. The numbering is the Quarto\'s. The introductions are ours.';
