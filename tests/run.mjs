// Runs the real judge against the real model on labelled photos from Wikimedia Commons,
// and reproduces every number in the README. No mocks.
//
//   npm test                                      the shipped configuration + the comparisons
//   MODEL=Xenova/clip-vit-base-patch16 npm test   the same, on a bigger model
//
// Photos are downloaded on first run into tests/.cache. Credits are in tests/fixtures.json
// (131 labelled photos), tests/screens.json (58 photos of screens) and judge/frames.json
// (12 device photos the outdoor photos get pasted onto).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ITEMS } from '../src/items.js';
import { ELSEWHERE, TEMPLATES } from '../judge/vocab.js';
import { rank, judge, DEFAULTS } from '../judge/core.js';
import { embedImage, buildClasses, onScreen, RawImage } from '../judge/node.mjs';
import { buildBingo, MODEL } from '../scripts/build-classes.mjs';

const here = (p) => new URL(p, import.meta.url);
const json = (p) => JSON.parse(readFileSync(here(p)));
const FIXTURES = json('./fixtures.json');
const SCREENS = json('./screens.json');
const FRAMES = json('../judge/frames.json');
const slug = MODEL.replace(/\W+/g, '_');
mkdirSync(here('./.cache/img/'), { recursive: true });

// ---- photos -> embeddings (cached) -------------------------------------------------
const cacheFile = here(`./.cache/${slug}.json`);
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile)) : {};

async function download(f) {
  const local = here(`./.cache/img/${f.title.replace(/\W+/g, '_')}.jpg`);
  if (!existsSync(local)) {
    const res = await fetch(f.url, { headers: { 'User-Agent': 'proof-of-grass-tests/1.0 (github.com/VanshajPoonia/proof-of-grass)' } });
    if (!res.ok) throw new Error(`${res.status} fetching ${f.title}`);
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  return fileURLToPath(local);
}
async function embedOnce(key, image) {
  if (cache[key]) return;
  cache[key] = await embedImage(await image(), MODEL);
  process.stdout.write('.');
}

for (const f of [...FIXTURES, ...SCREENS]) await embedOnce(f.title, () => download(f));
const positives = FIXTURES.filter((f) => !f.label.startsWith('none'));
const negatives = FIXTURES.filter((f) => f.label.startsWith('none'));

// Every outdoor photo, pasted onto the screen of every device photo.
const onScreens = [];
for (const fr of FRAMES) {
  const frame = await RawImage.read(await download(fr));
  for (const f of positives) {
    const key = `screen|${fr.title}|${f.title}`;
    await embedOnce(key, async () => onScreen(frame, await RawImage.read(await download(f)), fr.rect));
    onScreens.push({ key, label: f.label, device: fr.device, frame: fr.title });
  }
}
writeFileSync(cacheFile, JSON.stringify(cache));

// ---- strategies ---------------------------------------------------------------------
const classesFor = ({ templates, withElsewhere }) => buildClasses(ITEMS, { model: MODEL, templates, extra: withElsewhere ? ELSEWHERE : [] });
const NO_SCREEN_CHECK = { screenK: 0 };

function score(decide) {
  let right = 0, wrongSquare = 0, indoor = 0;
  const misses = [], leaks = [], extras = [];
  for (const f of FIXTURES) {
    const accepted = ITEMS.filter((it) => decide(cache[f.title], it.id)).map((it) => it.id);
    if (f.label.startsWith('none')) {
      if (accepted.length) { indoor++; leaks.push(`${f.label} -> ${accepted.join(',')}  (${f.title})`); }
      continue;
    }
    if (accepted.includes(f.label)) right++; else misses.push(`${f.label}  (${f.title})`);
    const other = accepted.filter((a) => a !== f.label);
    wrongSquare += other.length;
    if (other.length) extras.push(`${f.label} also ticks ${other.join(',')}`);
  }
  return { right, wrongSquare, indoor, misses, leaks, extras };
}

const row = (name, s) => console.log(
  `${name.padEnd(46)} ${String(s.right).padStart(3)}/${positives.length} right   ` +
  `${String(s.indoor).padStart(2)}/${negatives.length} indoor photos tick a square   ` +
  `${String(s.wrongSquare).padStart(3)} extra squares`);

console.log(`\nmodel: ${MODEL}  |  ${positives.length} outdoor photos, ${negatives.length} indoor/screen photos\n`);

// 1. The obvious first attempt: is the photo "close enough" to the square's text?
const itemsOnly1 = await classesFor({ templates: ['a photo of {}.'], withElsewhere: false });
const cosOf = (vec, id) => rank(vec, itemsOnly1).find((r) => r.id === id).cos;
let best = null;
for (let t = 0.20; t <= 0.34; t += 0.005) {
  const s = score((vec, id) => cosOf(vec, id) >= t);
  if (!best || s.right - s.indoor * 3 - s.wrongSquare > best.s.right - best.s.indoor * 3 - best.s.wrongSquare) best = { t, s };
}
row(`cosine >= ${best.t.toFixed(3)} (best threshold found)`, best.s);

// 2. Softmax over the card's own items: the photo must be *more* X than anything else.
row('softmax over outdoor items, top-1', score((vec, id) => judge(rank(vec, itemsOnly1), id, { topK: 1, minP: 0 }).ok));

// 3. Give non-outdoor photos somewhere to go.
const withElse1 = await classesFor({ templates: ['a photo of {}.'], withElsewhere: true });
row('+ "elsewhere" classes, top-1', score((vec, id) => judge(rank(vec, withElse1), id, { topK: 1, minP: 0, ...NO_SCREEN_CHECK }).ok));

// 4. Prompt ensembling.
const ensemble = await classesFor({ templates: TEMPLATES, withElsewhere: true });
row('+ prompt ensemble, top-1', score((vec, id) => judge(rank(vec, ensemble), id, { topK: 1, minP: 0, ...NO_SCREEN_CHECK }).ok));

// 5. Top-2 with a probability floor, so a photo can honestly fill two squares.
const before = (vec, id) => judge(rank(vec, ensemble), id, NO_SCREEN_CHECK).ok;
row(`+ top-${DEFAULTS.topK}, p >= ${DEFAULTS.minP}`, score(before));

// 6. What ships: a "photo on a screen" class, and the screen check.
const shipped = await buildBingo();
const now = (vec, id) => judge(rank(vec, shipped), id).ok;
const final = score(now);
row(`+ screen check  (shipped)`, final);

console.log('\nmissed:', final.misses.length ? '\n  ' + final.misses.join('\n  ') : 'none');
console.log('indoor leaks:', final.leaks.length ? '\n  ' + final.leaks.join('\n  ') : 'none');
console.log('extra squares:', final.extras.length ? '\n  ' + final.extras.join('\n  ') : 'none');

// ---- photos of screens ------------------------------------------------------------------
const ticks = (decide, vec) => ITEMS.some((it) => decide(vec, it.id));
const screenRow = (name, decide) => {
  const real = SCREENS.filter((f) => ticks(decide, cache[f.title])).length;
  const own = onScreens.filter((c) => decide(cache[c.key], c.label)).length;
  console.log(`${name.padEnd(28)} ${String(real).padStart(2)}/${SCREENS.length} real screen photos tick a square   ` +
    `${String(own).padStart(4)}/${onScreens.length} outdoor photos on a screen fill their own square`);
  return { real, own };
};
console.log(`\nphotos of screens: ${SCREENS.length} from Commons, and ${positives.length} outdoor photos pasted onto ${FRAMES.length} device photos\n`);
const was = screenRow('before the screen check', before);
const is = screenRow('with the screen check', now);
console.log('\nby device photo (outdoor photos on it that still fill their square, before -> after):');
for (const fr of FRAMES) {
  const mine = onScreens.filter((c) => c.frame === fr.title);
  const n = (d) => mine.filter((c) => d(cache[c.key], c.label)).length;
  console.log(`  ${fr.device.padEnd(12)} ${String(n(before)).padStart(3)} -> ${String(n(now)).padStart(3)} of ${mine.length}   ${fr.title}`);
}
// The screen class and its 5% were picked looking at the 1st, 3rd, 5th... device photos only.
const half = (odd) => onScreens.filter((c) => FRAMES.findIndex((f) => f.title === c.frame) % 2 === odd && now(cache[c.key], c.label)).length;
console.log(`\npicked on half the device photos: ${half(0)}/${onScreens.length / 2} got through. held out: ${half(1)}/${onScreens.length / 2}`);

// ---- the shipped data file must be what we just measured ----------------------------
let stale = 'missing';
if (existsSync(here('../data/classes.json'))) {
  const disk = json('../data/classes.json');
  const same = disk.model === MODEL && disk.classes.length === shipped.length &&
    disk.classes.every((c, i) => c.id === shipped[i].id && c.vec.reduce((s, x, j) => s + x * shipped[i].vec[j], 0) > 0.9999);
  stale = same ? '' : 'out of date';
}
if (MODEL === 'Xenova/clip-vit-base-patch32') {
  console.log(`\ndata/classes.json: ${stale || 'matches'}`);
}

const pass = final.indoor === 0 && final.right / positives.length >= 0.9 && is.real === 0 &&
  is.own < was.own / 4 && (MODEL !== 'Xenova/clip-vit-base-patch32' || !stale);
console.log(pass ? '\nPASS' : '\nFAIL');
process.exit(pass ? 0 : 1);
