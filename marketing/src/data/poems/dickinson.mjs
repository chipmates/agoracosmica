// Emily Dickinson's poems: the one copy of her text on the site, read by the
// collection page and by the page each poem has of its own. Transcribed from
// her own manuscripts, so the dashes, capitals and spellings are hers and no
// line may be smoothed here.
// Facsimile leaves come from the media CDN, courtesy of the holding libraries:
// Boston Public Library (no known copyright restrictions), Amherst College
// Archives and Special Collections (non-commercial and educational use, with
// attribution), Houghton Library at Harvard (publication of its public-domain
// material permitted, with credit).
// Plain ESM, not TypeScript: the Node sitemap script imports this module too.

/** @type {Record<string, { firstLine: string; text: string }>} */
export const dickinsonPoems = {
  chariot: {
    firstLine: 'Because I could not stop for Death',
    text: `Because I could not stop for Death –
He kindly stopped for me –
The Carriage held but just Ourselves –
And Immortality.

We slowly drove – He knew no haste
And I had put away
My labor and my leisure too,
For His Civility –

We passed the School, where Children strove
At Recess – in the Ring –
We passed the Fields of Gazing Grain –
We passed the Setting Sun –

Or rather – He passed Us –
The Dews drew quivering and Chill –
For only Gossamer, my Gown –
My Tippet – only Tulle –

We paused before a House that seemed
A Swelling of the Ground –
The Roof was scarcely visible –
The Cornice – in the Ground –

Since then – 'tis Centuries – and yet
Feels shorter than the Day
I first surmised the Horses Heads
Were toward Eternity –`,
  },
  dying: {
    firstLine: 'I heard a Fly buzz – when I died',
    text: `I heard a Fly buzz – when I died –
The Stillness in the Room
Was like the Stillness in the Air –
Between the Heaves of Storm –

The Eyes around – had wrung them dry –
And Breaths were gathering firm
For that last Onset – when the King
Be witnessed – in the Room –

I willed my Keepsakes – Signed away
What portion of me be
Assignable – and then it was
There interposed a Fly –

With Blue – uncertain stumbling Buzz –
Between the light – and me –
And then the Windows failed – and then
I could not see to see –`,
  },
  alabaster: {
    firstLine: 'Safe in their Alabaster Chambers',
    text: `Safe in their Alabaster Chambers –
Untouched by Morning – and untouched by Noon –
Sleep the meek members of the Resurrection –
Rafter of Satin – and Roof of Stone –

Grand go the Years, in the Crescent – above them –
Worlds scoop their Arcs – and Firmaments – row –
Diadems – drop – and Doges – surrender –
Soundless as Dots, On a Disc of Snow –`,
  },
  nobody: {
    firstLine: "I'm Nobody! Who are you?",
    text: `I'm Nobody! Who are you?
Are you – Nobody – too?
Then there's a pair of us!
Dont tell! they'd advertise – you know!

How dreary – to be – Somebody!
How public – like a Frog –
To tell one's name – the livelong June –
To an admiring Bog!`,
  },
  loadedgun: {
    firstLine: 'My Life had stood – a Loaded Gun',
    text: `My Life had stood – a Loaded Gun –
In Corners – till a Day
The Owner passed – identified –
And carried Me away –

And now We roam in Sovereign Woods –
And now We hunt the Doe –
And every time I speak for Him
The Mountains straight reply –

And do I smile, such cordial light
Opon the Valley glow –
It is as a Vesuvian face
Had let it's pleasure through –

And when at Night – Our good Day done –
I guard My Master's Head –
'Tis better than the Eider-Duck's
Deep Pillow – to have shared –

To foe of His – I'm deadly foe –
None stir the second time –
On whom I lay a Yellow Eye –
Or an emphatic Thumb –

Though I than He – may longer live
He longer must – than I –
For I have but the power to kill,
Without – the power to die –`,
  },
  exclusion: {
    firstLine: 'The Soul selects her own Society',
    text: `The Soul selects her own Society –
Then – shuts the Door –
To her divine Majority –
Present no more –

Unmoved – she notes the Chariots – pausing –
At her low Gate –
Unmoved – an Emperor be kneeling
Upon her Mat –

I've known her – from an ample nation –
Choose One –
Then – close the Valves of her attention –
Like Stone –`,
  },
  letter: {
    firstLine: 'This is my letter to the World',
    text: `This is my letter to the World
That never wrote to Me –
The simple News that Nature told –
With tender Majesty

Her Message is committed
To Hands I cannot see –
For love of Her – Sweet – Countrymen –
Judge tenderly – of Me`,
  },
  hope: {
    firstLine: '"Hope" is the thing with feathers',
    text: `"Hope" is the thing with feathers –
That perches in the soul –
And sings the tune without the words –
And never stops – at all –

And sweetest – in the Gale – is heard –
And sore must be the storm –
That could abash the little Bird
That kept so many warm –

I've heard it in the chillest land –
And on the strangest Sea –
Yet, never, in Extremity,
It asked a crumb – of Me.`,
  },
  success: {
    firstLine: 'Success is counted sweetest',
    text: `Success – is counted sweetest
By those who ne'er succeed –
To comprehend a Nectar
Requires sorest need –

Not one of all the Purple Host
Who took the Flag – today
Can tell the Definition
so clear, of Victory –

As He – defeated – dying –
On whose forbidden Ear
The distant strains of triumph
Burst – agonized – and Clear!`,
  },
  slant: {
    firstLine: "There's a certain Slant of light",
    text: `There's a certain Slant of light,
Winter Afternoons –
That oppresses, like the Heft
Of Cathedral Tunes –

Heavenly Hurt, it gives us –
We can find no scar,
But internal difference
Where the Meanings, are –

None may teach it – Any –
'Tis the Seal Despair –
An imperial affliction
Sent us of the Air –

When it comes, the Landscape listens –
Shadows – hold their breath –
When it goes, 'tis like the Distance
On the look of Death –`,
  },
  funeral: {
    firstLine: 'I felt a Funeral, in my Brain',
    text: `I felt a Funeral, in my Brain,
And Mourners to and fro
Kept treading – treading – till it seemed
That Sense was breaking through –

And when they all were seated,
A Service, like a Drum –
Kept beating – beating – till I thought
My Mind was going numb –

And then I heard them lift a Box
And creak across my Soul
With those same Boots of Lead, again,
Then Space – began to toll,

As all the Heavens were a Bell,
And Being, but an Ear,
And I, and Silence, some strange Race
Wrecked, solitary, here –

And then a Plank in Reason, broke,
And I dropped down, and down –
And hit a World, at every plunge,
And Finished knowing – then –`,
  },
  snake: {
    firstLine: 'A narrow Fellow in the Grass',
    text: `A narrow Fellow in the Grass
Occasionally rides –
You may have met him? did you not
His notice instant is –

The Grass divides as with a Comb –
A spotted Shaft is seen,
And then it closes at your feet
And opens further on –

He likes a Boggy Acre –
A Floor too cool for Corn –
But when a Boy and Barefoot
I more than once at Noon

Have passed I thought a Whip Lash
Unbraiding in the Sun
When stooping to secure it
It wrinkled And was gone –

Several of Nature's People
I know and they know me
I feel for them a transport
Of cordiality –

But never met this Fellow
Attended or Alone
Without a tighter Breathing
And Zero at the Bone.`,
  },
  garden: {
    firstLine: 'A Bird, came down the Walk',
    text: `A Bird came down the Walk –
He did not know I saw –
He bit an Angleworm in halves
And ate the fellow, raw,

And then he drank a Dew
From a convenient Grass –
And then hopped sidewise to the Wall
To let a Beetle pass –

He glanced with rapid eyes
That hurried all around –
They looked like frightened Beads, I thought –
He stirred his Velvet Head –

Like One in danger, Cautious,
I offered him a Crumb
And he unrolled his feathers
And rowed him softer home –

Than Oars divide the Ocean,
Too silver for a seam,
Or Butterflies, off Banks of Noon
Leap, plashless as they swim.`,
  },
  tellslant: {
    firstLine: 'Tell all the truth but tell it slant',
    text: `Tell all the truth but tell it slant –
Success in Circuit lies
Too bright for our infirm delight
The truth's superb surprise
As Lightning to the Children eased
With explanation kind
The truth must dazzle gradually
Or every man be blind –`,
  },
  brain: {
    firstLine: 'The Brain – is wider than the Sky',
    text: `The Brain – is wider than the Sky –
For – put them side by side –
The One the Other will contain
With ease – and You – beside –

The Brain is deeper than the Sea –
For – hold them – Blue to Blue –
The One the Other will absorb –
As Sponges – Buckets – do –

The Brain is just the weight of God –
For – Heft them – Pound for Pound –
And they will differ – if they do –
As Syllable from Sound –`,
  },
  frigate: {
    firstLine: 'There is no Frigate like a Book',
    text: `There is no Frigate like a Book
To take us Lands away
Nor any Coursers like a Page
Of prancing Poetry –
This Traverse may the poorest take
Without oppress of Toll –
How frugal is the Chariot
That bears the Human soul –`,
  },
  wildnights: {
    firstLine: 'Wild nights – Wild nights!',
    text: `Wild nights – Wild nights!
Were I with thee
Wild nights should be
Our luxury!

Futile – the winds –
To a Heart in port –
Done with the Compass –
Done with the Chart –!

Rowing in Eden –
Ah! the Sea!
Might I but moor –
Tonight –
In thee!`,
  },
};

/** @type {Record<string, string[]>} */
export const dickinsonFacsimileLeaves = {
  // BPL (no known copyright) / Amherst (non-commercial, with credit)
  dying: ['fly-buzz'],
  alabaster: ['safe-alabaster-1', 'safe-alabaster-2'],
  success: ['success-1', 'success-2'],
  garden: ['bird-walk-1', 'bird-walk-2', 'bird-walk-3'],
  tellslant: ['tell-truth'],
  brain: ['brain-sky'],
  frigate: ['frigate-book'],
  // Houghton/Harvard (publication permitted, credit Houghton)
  chariot: ['chariot-1', 'chariot-2'],
  nobody: ['nobody'],
  loadedgun: ['loaded-gun-1', 'loaded-gun-2'],
  exclusion: ['soul-society'],
  letter: ['letter-world'],
  hope: ['hope'],
  slant: ['slant-light'],
  funeral: ['funeral-brain-1', 'funeral-brain-2'],
  snake: ['narrow-fellow-1', 'narrow-fellow-2', 'narrow-fellow-3', 'narrow-fellow-4'],
  wildnights: ['wildnights'],
};

/** @type {Record<string, { repo: string; cite: string }>} */
export const dickinsonFacsimileSources = {
  chariot: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 165a' },
  dying: { repo: 'Amherst College, Archives & Special Collections', cite: 'fascicle 84' },
  alabaster: { repo: 'Boston Public Library', cite: 'Ms. Am. 1093, 2' },
  nobody: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 35a' },
  loadedgun: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 131a' },
  exclusion: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 65c' },
  letter: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 70b' },
  hope: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 46b' },
  success: { repo: 'Boston Public Library', cite: 'Ms. Am. 1093, 10' },
  slant: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 74d' },
  funeral: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 53c' },
  snake: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.5 (letter to Susan Dickinson)' },
  garden: { repo: 'Amherst College, Archives & Special Collections', cite: 'Amherst Manuscript #96' },
  tellslant: { repo: 'Amherst College, Archives & Special Collections', cite: 'Amherst Manuscript #372' },
  brain: { repo: 'Amherst College, Archives & Special Collections', cite: 'fascicle 84' },
  frigate: { repo: 'Amherst College, Archives & Special Collections', cite: 'Amherst Manuscript #462' },
  wildnights: { repo: 'Houghton Library, Harvard', cite: 'MS Am 1118.3, 38b' },
};

/** Reading order of the collection page. The slug is the poem page's URL
 *  segment, fixed here so a re-transcription can never move a live page. */
export const dickinsonOrder = [
  { key: 'chariot', slug: 'because-i-could-not-stop-for-death' },
  { key: 'dying', slug: 'i-heard-a-fly-buzz-when-i-died' },
  { key: 'alabaster', slug: 'safe-in-their-alabaster-chambers' },
  { key: 'nobody', slug: 'im-nobody-who-are-you' },
  { key: 'loadedgun', slug: 'my-life-had-stood-a-loaded-gun' },
  { key: 'exclusion', slug: 'the-soul-selects-her-own-society' },
  { key: 'letter', slug: 'this-is-my-letter-to-the-world' },
  { key: 'hope', slug: 'hope-is-the-thing-with-feathers' },
  { key: 'success', slug: 'success-is-counted-sweetest' },
  { key: 'snake', slug: 'a-narrow-fellow-in-the-grass' },
  { key: 'garden', slug: 'a-bird-came-down-the-walk' },
  { key: 'tellslant', slug: 'tell-all-the-truth-but-tell-it-slant' },
  { key: 'brain', slug: 'the-brain-is-wider-than-the-sky' },
  { key: 'frigate', slug: 'there-is-no-frigate-like-a-book' },
  { key: 'slant', slug: 'theres-a-certain-slant-of-light' },
  { key: 'funeral', slug: 'i-felt-a-funeral-in-my-brain' },
  { key: 'wildnights', slug: 'wild-nights-wild-nights' },
];

/** The collection page's source note, shown verbatim on every poem page. */
export const dickinsonSourceNote =
  'The poems here are transcribed from Dickinson\'s own manuscripts, which are in the public domain. Her dashes, capital letters, and spellings are kept as she wrote them, so these read differently from the smoothed versions printed after her death. The manuscript images are reproduced courtesy of the libraries that hold them: the Boston Public Library (no known copyright restrictions), Amherst College Archives and Special Collections (free for non-commercial and educational use, with credit), and the Houghton Library at Harvard University, whose policy permits publishing images of its public-domain holdings. The modern dash-faithful scholarly editions remain under copyright and are not used here.';
