// Precompute one text direction per class and ship it as data/classes.json.
//
// The phone never runs CLIP's text tower. The card's vocabulary is fixed, so its
// embeddings are too; computing them once here means the browser downloads only the
// vision half of the model. Re-run after editing src/items.js or judge/vocab.js:
//   npm run build
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ITEMS } from '../src/items.js';
import { buildClasses, vocabularyFile, DEFAULT_MODEL } from '../judge/node.mjs';

export const MODEL = process.env.MODEL || DEFAULT_MODEL;

export const buildBingo = (options = {}) => buildClasses(ITEMS, { model: MODEL, ...options });

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const classes = await buildBingo();
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../data/classes.json', import.meta.url), vocabularyFile(classes, { model: MODEL }));
  console.log(`wrote data/classes.json: ${classes.length} classes from ${MODEL}`);
}
