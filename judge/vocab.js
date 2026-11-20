// Classes every vocabulary gets, whatever it is judging. A photo has to be able to land
// somewhere other than your own items, or the softmax spends all its probability on
// them anyway (README.md, "the trap").

// CLIP prompt ensembling, as in the original paper. "Taken on a phone" matters because
// that is where the photos come from.
export const TEMPLATES = [
  'a photo of {}.',
  'a close-up photo of {}.',
  'a photo of {} taken on a phone.',
  'a blurry photo of {}.',
];

// Not outdoors. A photo that ranks one of these first is turned away.
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
].map((c) => ({ ...c, kind: 'elsewhere' }));
