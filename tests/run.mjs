// Runs the real judge against the real model on 131 labelled photos from Wikimedia
// Commons, and reproduces every number in the README. No mocks.
//
//   npm test                                      the shipped configuration + the comparisons
//   MODEL=Xenova/clip-vit-base-patch16 npm test   the same, on a bigger model
//
// Photos are downloaded on first run into tests/.cache (credits in tests/fixtures.json).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ITEMS } from '../src/items.js';
import { ELSEWHERE, TEMPLATES } from '../judge/vocab.js';
import { rank, judge, DEFAULTS } from '../judge/core.js';
import { embedImage, buildClasses } from '../judge/node.mjs';
import { buildBingo, MODEL } from '../scripts/build-classes.mjs';

const here = (p) => new URL(p, import.meta.url);
const FIXTURES = JSON.parse(readFileSync(here('./fixtures.json')));
const slug = MODEL.replace(/\W+/g, '_');
mkdirSync(here('./.cache/img/'), { recursive: true });

// ---- photos -> embeddings (cached) -------------------------------------------------
const cacheFile = here(`./.cache/${slug}.json`);
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile)) : {};
for (const f of FIXTURES) {
  if (cache[f.title]) continue;
  const local = here(`./.cache/img/${f.title.replace(/\W+/g, '_')}.jpg`);
  if (!existsSync(local)) {
    const res = await fetch(f.url, { headers: { 'User-Agent': 'proof-of-grass-tests/1.0 (github.com/VanshajPoonia/proof-of-grass)' } });
    if (!res.ok) throw new Error(`${res.status} fetching ${f.title}`);
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  cache[f.title] = await embedImage(fileURLToPath(local), MODEL);
  process.stdout.write('.');
}
writeFileSync(cacheFile, JSON.stringify(cache));

const positives = FIXTURES.filter((f) => !f.label.startsWith('none'));
const negatives = FIXTURES.filter((f) => f.label.startsWith('none'));

// ---- strategies ---------------------------------------------------------------------
const classesFor = ({ templates, withElsewhere }) => buildClasses(ITEMS, { model: MODEL, templates, extra: withElsewhere ? ELSEWHERE : [] });

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
row('+ "elsewhere" classes, top-1', score((vec, id) => judge(rank(vec, withElse1), id, { topK: 1, minP: 0 }).ok));

// 4. Prompt ensembling.
const shipped = await buildBingo();
row('+ prompt ensemble, top-1', score((vec, id) => judge(rank(vec, shipped), id, { topK: 1, minP: 0 }).ok));

// 5. What ships: top-2 with a probability floor, so a photo can honestly fill two squares.
const final = score((vec, id) => judge(rank(vec, shipped), id, DEFAULTS).ok);
row(`+ top-${DEFAULTS.topK}, p >= ${DEFAULTS.minP}  (shipped)`, final);

console.log('\nmissed:', final.misses.length ? '\n  ' + final.misses.join('\n  ') : 'none');
console.log('indoor leaks:', final.leaks.length ? '\n  ' + final.leaks.join('\n  ') : 'none');
console.log('extra squares:', final.extras.length ? '\n  ' + final.extras.join('\n  ') : 'none');

// ---- the shipped data file must be what we just measured ----------------------------
let stale = 'missing';
if (existsSync(here('../data/classes.json'))) {
  const disk = JSON.parse(readFileSync(here('../data/classes.json')));
  const same = disk.model === MODEL && disk.classes.length === shipped.length &&
    disk.classes.every((c, i) => c.id === shipped[i].id && c.vec.reduce((s, x, j) => s + x * shipped[i].vec[j], 0) > 0.9999);
  stale = same ? '' : 'out of date';
}
if (MODEL === 'Xenova/clip-vit-base-patch32') {
  console.log(`\ndata/classes.json: ${stale || 'matches'}`);
}

const pass = final.indoor === 0 && final.right / positives.length >= 0.9 &&
  (MODEL !== 'Xenova/clip-vit-base-patch32' || !stale);
console.log(pass ? '\nPASS' : '\nFAIL');
process.exit(pass ? 0 : 1);
