// The bingo pool. Every id here has labelled photos in tests/fixtures.json, so no square
// exists that the test suite has never seen.
//
// `names` are what CLIP is asked about. Several phrasings per item, because CLIP was
// trained on alt-text, and "a pine cone" and "pinecones on the ground" land in
// different places. They get averaged into one direction per item (src/judge.js).
export const ITEMS = [
  { id: 'grass', emoji: '🌱', label: 'Grass', hint: 'The whole point. Actual blades, please.', names: ['grass', 'blades of grass', 'a lawn', 'a grassy field'] },
  { id: 'fallen-leaf', emoji: '🍂', label: 'A fallen leaf', hint: 'October is doing most of the work here.', names: ['a fallen leaf', 'autumn leaves on the ground', 'dry leaves'] },
  { id: 'moss', emoji: '🟩', label: 'Moss', hint: 'North side of things, damp corners, old walls.', names: ['moss', 'green moss on a rock', 'moss on a tree'] },
  { id: 'bark', emoji: '🌳', label: 'Tree bark', hint: 'Get close. Closer than feels normal.', names: ['tree bark', 'the bark of a tree trunk', 'a close-up of bark'] },
  { id: 'pinecone', emoji: '🌲', label: 'A pinecone', hint: 'Look under anything evergreen.', names: ['a pine cone', 'pinecones', 'a conifer cone on a branch'] },
  { id: 'acorn', emoji: '🌰', label: 'An acorn', hint: 'Oak trees, and the squirrels who got there first.', names: ['an acorn', 'acorns on the ground'] },
  { id: 'mushroom', emoji: '🍄', label: 'A mushroom', hint: 'Photograph it. Do not eat it.', names: ['a mushroom', 'a toadstool', 'a fungus growing'] },
  { id: 'flower', emoji: '🌼', label: 'A wildflower', hint: 'Weeds count. Weeds are flowers with bad PR.', names: ['a flower', 'a wildflower', 'a blooming flower'] },
  { id: 'berries', emoji: '🫐', label: 'Berries', hint: 'On the bush, not in a punnet.', names: ['berries', 'berries on a bush', 'wild berries'] },
  { id: 'feather', emoji: '🪶', label: 'A feather', hint: 'Usually found right where you were not looking.', names: ['a feather', 'a bird feather on the ground'] },
  { id: 'bird', emoji: '🐦', label: 'A bird', hint: 'Pigeons absolutely count.', names: ['a bird', 'a small bird perched on a branch', 'a bird in the wild'] },
  { id: 'squirrel', emoji: '🐿️', label: 'A squirrel', hint: 'They are faster than your camera app. Good luck.', names: ['a squirrel', 'a squirrel in a tree'] },
  { id: 'dog', emoji: '🐕', label: 'A dog', hint: 'Ask the owner first. Then ask the dog.', names: ['a dog', 'a dog outside', 'a puppy'] },
  { id: 'insect', emoji: '🐞', label: 'An insect', hint: 'Beetles, bees, ladybirds. Spiders are not insects, but see below.', names: ['an insect', 'a beetle', 'a bee', 'a bug on a leaf'] },
  { id: 'spider-web', emoji: '🕸️', label: 'A spider web', hint: 'Easiest early in the morning, when the dew is on it.', names: ['a spider web', 'a cobweb with dew drops'] },
  { id: 'clouds', emoji: '☁️', label: 'Clouds', hint: 'Look up. That is the whole quest.', names: ['clouds in the sky', 'a cloudy sky', 'clouds'] },
  { id: 'puddle', emoji: '💧', label: 'A puddle', hint: 'Bonus points if something is reflected in it.', names: ['a puddle', 'a puddle on the ground', 'a rain puddle on a path'] },
  { id: 'water', emoji: '🦆', label: 'A pond or stream', hint: 'Any water that was not poured.', names: ['a pond', 'a stream', 'a lake shore', 'a river'] },
  { id: 'rock', emoji: '🪨', label: 'A big rock', hint: 'Bigger than a shoe. Sitting on it is optional.', names: ['a rock', 'a boulder', 'large rocks'] },
  { id: 'bench', emoji: '🪑', label: 'A park bench', hint: 'Sit on it for one full minute before you leave.', names: ['a park bench', 'a bench outdoors'] },
  { id: 'path', emoji: '🥾', label: 'A trail', hint: 'Dirt, gravel, or leaves. Not a pavement.', names: ['a footpath through a forest', 'a dirt trail', 'a hiking path'] },
  { id: 'sunset', emoji: '🌅', label: 'A sunset', hint: 'Time it. Golden hour is the only deadline today.', names: ['a sunset', 'the sun setting over the horizon', 'a sunrise'] },
  { id: 'stump', emoji: '🪵', label: 'A tree stump', hint: 'Count the rings if you have the patience.', names: ['a tree stump', 'a cut tree stump showing rings'] },
  { id: 'snail', emoji: '🐌', label: 'A snail', hint: 'After rain. Mind your step.', names: ['a snail', 'a garden snail'] },
  { id: 'butterfly', emoji: '🦋', label: 'A butterfly', hint: 'Late in the season, but you might get lucky.', names: ['a butterfly', 'a butterfly on a flower'] },
];

// Things a photo might be instead. They are never squares on the card. They exist so
// that a photo of a desk has somewhere to go other than "probably moss". Without them
// the softmax has to spend its probability on *some* outdoor item, and does.
export const ELSEWHERE = [
  { id: 'screen', names: ['a computer screen', 'a laptop', 'a phone screen', 'a television', 'a photo of a monitor'] },
  { id: 'keyboard', names: ['a keyboard', 'a computer desk'] },
  { id: 'room', names: ['a bedroom', 'a living room', 'a room indoors', 'a kitchen'] },
  { id: 'wall', names: ['a wall indoors', 'a ceiling', 'a carpet', 'a painting on a wall'] },
  { id: 'food', names: ['food on a plate', 'a meal', 'fruit in a bowl'] },
  { id: 'face', names: ['a selfie', "a person's face", 'a portrait'] },
  { id: 'car', names: ['the inside of a car', 'a steering wheel', 'a dashboard'] },
  { id: 'houseplant', names: ['a houseplant in a pot', 'a potted plant indoors'] },
  { id: 'paper', names: ['a document', 'a page of text', 'a book'] },
];

// CLIP prompt ensembling, as in the original paper. Averaging over a few templates
// is a small, reliable win, and "taken on a phone" matters because that is literally
// where the photos come from.
export const TEMPLATES = [
  'a photo of {}.',
  'a close-up photo of {}.',
  'a photo of {} taken on a phone.',
  'a blurry photo of {}.',
];

export const CENTER = 'grass';
