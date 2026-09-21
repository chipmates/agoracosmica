// The Meditations passages behind the Marcus Aurelius reading page: the one
// copy of the text on the site. George Long's 1862 translation, public domain,
// cut from the Project Gutenberg source by script and inserted verbatim.
// Paragraphs inside a passage are separated by a blank line, and the en dashes
// are the edition's own. Generated file: regenerate it, never edit it by hand.
// Plain ESM, not TypeScript: the Node sitemap script imports this module too.

/** The reading page's own path. Its crawl status follows POEM_PAGES_INDEXABLE. */
export const MEDITATIONS_PATH = '/figures/marcus-aurelius/meditations';

/** The edition every passage is cut from. The hash is of that source file, so a
 *  changed edition can never pass as the one the page names. */
export const meditationsSource = {
  gutenbergEbook: 15877,
  title: "Thoughts of Marcus Aurelius Antoninus",
  translator: "George Long",
  firstPublished: 1862,
  sha256: "6584df7e90d6035eece30d8028527290bf2508076963ee0376cb41db9cf88d5b",
};

/** @type {{ theme: string, book: string, section: number, ref: string, from: boolean, text: string }[]} */
const PASSAGES = [
  {
    theme: "mornings",
    book: "V",
    section: 1,
    ref: "V. 1",
    from: true,
    text: "In the morning when thou risest unwillingly, let this thought be present, – I am rising to the work of a human being. Why then am I dissatisfied if I am going to do the things for which I exist and for which I was brought into the world? Or have I been made for this, to lie in the bed-clothes and keep myself warm? – But this is more pleasant. – Dost thou exist then to take thy pleasure, and not at all for action or exertion? Dost thou not see the little plants, the little birds, the ants, the spiders, the bees working together to put in order their several parts of the universe? And art thou unwilling to do the work of a human being, and dost thou not make haste to do that which, is according to thy nature?",
  },
  {
    theme: "mornings",
    book: "II",
    section: 1,
    ref: "II. 1",
    from: false,
    text: "Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil. But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, and the nature of him who does wrong, that it is akin to me; not only of the same blood or seed, but that it participates in the same intelligence and the same portion of the divinity, I can neither be injured by any of them, for no one can fix on me what is ugly, nor can I be angry with my kinsman, nor hate him. For we are made for co-operation, like feet, like hands, like eyelids, like the rows of the upper and lower teeth. To act against one another, then, is contrary to nature; and it is acting against one another to be vexed and to turn away.",
  },
  {
    theme: "power",
    book: "VIII",
    section: 47,
    ref: "VIII. 47",
    from: true,
    text: "If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgment about it. And it is in thy power to wipe out this judgment now.",
  },
  {
    theme: "power",
    book: "VII",
    section: 8,
    ref: "VII. 8",
    from: false,
    text: "Let not future things disturb thee, for thou wilt come to them, if it shall be necessary, having with thee the same reason which now thou usest for present things.",
  },
  {
    theme: "power",
    book: "IV",
    section: 49,
    ref: "IV. 49",
    from: true,
    text: "Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.\n\nUnhappy am I because this has happened to me? Not so, but happy am I, though this has happened to me, because I continue free from pain, neither crushed by the present nor fearing the future.",
  },
  {
    theme: "people",
    book: "VI",
    section: 6,
    ref: "VI. 6",
    from: false,
    text: "The best way of avenging thyself is not to become like the wrong-doer.",
  },
  {
    theme: "people",
    book: "IX",
    section: 5,
    ref: "IX. 5",
    from: false,
    text: "He often acts unjustly who does not do a certain thing; not only he who does a certain thing.",
  },
  {
    theme: "people",
    book: "XII",
    section: 4,
    ref: "XII. 4",
    from: false,
    text: "I have often wondered how it is that every man loves himself more than all the rest of men, but yet sets less value on his own opinion of himself than on the opinion of others. If then a god or a wise teacher should present himself to a man and bid him to think of nothing and to design nothing which he would not express as soon as he conceived it, he could not endure it even for a single day. So much more respect have we to what our neighbors shall think of us than to what we shall think of ourselves.",
  },
  {
    theme: "mind",
    book: "IV",
    section: 3,
    ref: "IV. 3",
    from: true,
    text: "Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont to desire such things very much. But this is altogether a mark of the most common sort of men, for it is in thy power whenever thou shalt choose to retire into thyself. For nowhere either with more quiet or more freedom from trouble does a man retire than into his own soul, particularly when he has within him such thoughts that by looking into them he is immediately in perfect tranquillity; and I affirm that tranquillity is nothing else than the good ordering of the mind.",
  },
  {
    theme: "mind",
    book: "V",
    section: 16,
    ref: "V. 16",
    from: true,
    text: "Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts. Dye it then with a continuous series of such thoughts as these: for instance, that where a man can live, there he can also live well. But he must live in a palace; well then, he can also live well in a palace.",
  },
  {
    theme: "mind",
    book: "VII",
    section: 59,
    ref: "VII. 59",
    from: false,
    text: "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.",
  },
  {
    theme: "time",
    book: "II",
    section: 17,
    ref: "II. 17",
    from: false,
    text: "Of human life the time is a point, and the substance is in a flux, and the perception dull, and the composition of the whole body subject to putrefaction, and the soul a whirl, and fortune hard to divine, and fame a thing devoid of judgment. And, to say all in a word, everything which belongs to the body is a stream, and what belongs to the soul is a dream and vapor, and life is a warfare and a stranger's sojourn, and after fame is oblivion. What then is that which is able to conduct a man? One thing, and only one, philosophy. But this consists in keeping the daemon within a man free from violence and unharmed, superior to pains and pleasures, doing nothing without a purpose, nor yet falsely and with hypocrisy, not feeling the need of another man's doing or not doing anything; and besides, accepting all that happens, and all that is allotted, as coming from thence, wherever it is, from whence he himself came; and, finally, waiting for death with a cheerful mind, as being nothing else than a dissolution of the elements of which every living being is compounded. But if there is no harm to the elements themselves in each continually changing into another, why should a man have any apprehension about the change and dissolution of all the elements? For it is according to nature, and nothing is evil which is according to nature.\n\nThis in Carnuntum.",
  },
  {
    theme: "time",
    book: "X",
    section: 16,
    ref: "X. 16",
    from: false,
    text: "No longer talk at all about the kind of man that a good man ought to be, but be such.",
  },
];

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

/** Every passage in page order. `id` is the anchor ads and sitelinks deep-link
 *  to, so it stays stable whatever the page around it does; `label` is the
 *  reference as the page prints it. */
export const meditationsPassages = PASSAGES.map((p) => ({
  ...p,
  id: `book-${ROMAN[p.book]}-${p.section}`,
  label: `${p.from ? 'From ' : ''}Book ${p.book}, ${p.section}`,
}));

/** The passages of one theme, in page order. */
export const passagesByTheme = (theme) => meditationsPassages.filter((p) => p.theme === theme);
