# TouchGrass Bingo 🌱

**Outdoor Photo Bingo.** Formerly called Proof of Grass.

A daily outdoor bingo card that only a real photo can fill.

Every morning there is a new 3×3 card: a fallen leaf, moss, a snail, a park bench, and grass in the middle, always. Tap a square, take a photo, and a vision model running **on your phone** decides whether you actually found it. Fill a line for a bingo. Share your grid. Same card for everyone, every day.

**Live:** https://vanshajpoonia.github.io/proof-of-grass/

- **No upload, ever.** The judge is [CLIP ViT-B/32](https://huggingface.co/Xenova/clip-vit-base-patch32) (open weights, MIT), running in the tab through [transformers.js](https://github.com/huggingface/transformers.js). Open the network tab and take a picture: there is no request.
- **Works with no signal.** One 89 MB download, then the model, the app, and today's card all run in airplane mode.
- **A screen is not grass.** Photos of laptops, keyboards, rooms and lunch are recognised as such and turned away. So is grass shown on a phone or monitor, most of the time. The numbers are below, including where it fails.

## How the judge works

The judge is a small module in [`judge/`](judge/) with its own [README](judge/README.md). WalkQuest uses the same module to check a photo at each stop.

CLIP compares a photo with text. The naive way to use it (is this photo "close enough" to the words *a pinecone*?) does not work, and the test suite shows exactly how badly. What ships:

1. **25 outdoor items + 9 "elsewhere" classes.** The elsewhere classes (screen, keyboard, room, food, face, car interior, houseplant…) are never squares. They exist so a photo of a desk has somewhere to go other than "probably moss".
2. **Softmax over all 34**, using CLIP's own logit scale. A raw cosine of 0.27 means nothing; it only means something next to the other scores.
3. **Accept if the claimed item is in the top 2 with at least 15%**, unless an elsewhere class is on top. Top-2 because real photos hold more than one thing: a bee on a flower should be able to fill either square.
4. **A screen class close behind is a no.** Grass on a phone still ranks as grass, so a "photo on a screen" class only has to reach the top 2 with 5% to turn the photo away.
5. **Text embeddings are precomputed** (`npm run build` → `data/classes.json`), so a phone downloads only CLIP's vision tower.

The logic lives in [`judge/core.js`](judge/core.js), pure functions, shared by the app and the tests.

## Measured, not guessed

`npm test` runs the real model on 131 labelled photos from Wikimedia Commons (102 outdoor across all 25 items, 29 indoor/screen), downloaded on first run with credits in [`tests/fixtures.json`](tests/fixtures.json). It also runs the screen tests further down.

| Approach | Right square filled | Indoor photos that ticked a square |
|---|---|---|
| Cosine similarity ≥ best threshold (0.30) | 56 / 102 | 0 / 29 |
| Softmax over the outdoor items only | 96 / 102 | **29 / 29** |
| + "elsewhere" classes | 96 / 102 | 0 / 29 |
| + prompt ensembling | 96 / 102 | 0 / 29 |
| + top-2, p ≥ 0.15 | 99 / 102 | 0 / 29 |
| + screen check **(shipped)** | **99 / 102** | **0 / 29** |

The second row is the trap: a softmax over only the card's items has to spend all its probability on *something* outdoors, so every laptop, bedroom and plate of food filled a square. Prompt ensembling, which the CLIP paper recommends, changed nothing measurable here; it stays because it costs nothing at runtime.

The three misses are two small feathers on the ground and one puddle in a farm track: things that fill a few percent of the frame. That is why the app says *get closer* when it says no.

### Photos of a screen

The cheat worth worrying about is a photo of grass on another screen. To test it, every one of the 102 outdoor photos is pasted onto the screen in 12 real photos of monitors, TVs, tablets, phones and a photo frame, all from Commons ([`judge/frames.json`](judge/frames.json)).

| | Before the screen check | Shipped |
|---|---|---|
| Outdoor photos shown on a screen that fill their own square | 288 / 1224 | 40 / 1224 |
| Real photos of screens that fill any square ([`tests/screens.json`](tests/screens.json)) | 0 / 58 | 0 / 58 |

The class and the 5% were picked looking at six of the device photos. On the other six, 5 of 612 got through.

It works when any edge of the device shows. A monitor went from 12 to 0, a phone in a shop from 27 to 0. It does badly when the screen fills almost the whole photo: a tablet held close went from 86 to 21. With nothing but the picture in the frame, CLIP sees grass. These are pasted images with no glare or moiré, so real camera photos of screens may be easier to catch. That part is not measured.

Swapping the model is one environment variable. Before the screen check, `MODEL=Xenova/clip-vit-base-patch16 npm test` ran a model with four times the compute and got 98 / 102, 0 / 29. Not better, so the small one ships. The screen check is measured on the small one only.

## Run it

```bash
npm start            # static server on :8000, no build step
npm install          # only needed for the tests and for rebuilding class embeddings
npm test             # 10 card checks, 12 judge checks, then the model evaluation above
npm run build        # after editing src/items.js
```

## Files

```
index.html, assets/styles.css   the page
src/items.js      the 25 squares
src/card.js       daily seeded card, bingo lines, streak, share text (pure, tested)
src/app.js        UI
judge/            the photo judge as a reusable module, see judge/README.md
  core.js         softmax ranking, the accept rule and the screen check (pure, tested)
  vocab.js        the 9 elsewhere classes, the screen class, prompt templates
  browser.js      CLIP vision tower in the browser, q8 WASM
  node.mjs        builds vocabularies and embeds test photos
  frames.json     device photos used for the screen test
sw.js             offline app shell
data/classes.json precomputed text embeddings
tests/            run.mjs (model eval), card.mjs and judge.mjs (logic), fixtures.json and screens.json (photo credits)
```

## Credits

Sample photos in `assets/samples/` and the test set are from Wikimedia Commons; each one's author and licence is in `assets/samples/credits.json` and `tests/fixtures.json`, and shown in the app when a sample is used. The screen photos and device photos used in the screen test are credited in `tests/screens.json` and `judge/frames.json`. CLIP by OpenAI, ONNX conversion by Xenova, runtime by transformers.js and ONNX Runtime Web.

MIT licence.
