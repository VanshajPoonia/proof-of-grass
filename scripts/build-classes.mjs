// Precompute one text direction per class and ship it as data/classes.json.
//
// The phone never runs CLIP's text tower. The card's vocabulary is fixed, so its
// embeddings are too; computing them once here means the browser downloads only the
// vision half of the model. Re-run after editing src/items.js:  npm run build
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ITEMS, ELSEWHERE, TEMPLATES } from '../src/items.js';
import { classPrompts, centroid } from '../src/judge.js';
import { embedTexts, MODEL } from '../tests/clip-node.mjs';

export async function buildClasses(templates = TEMPLATES) {
  const all = [
    ...ITEMS.map((c) => ({ ...c, kind: 'item' })),
    ...ELSEWHERE.map((c) => ({ ...c, kind: 'elsewhere' })),
  ];
  const classes = [];
  for (const c of all) {
    const vecs = await embedTexts(classPrompts(c, templates));
    classes.push({ id: c.id, kind: c.kind, vec: centroid(vecs) });
  }
  return classes;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const classes = await buildClasses();
  mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
  const round = (v) => v.map((x) => Math.round(x * 1e5) / 1e5);
  writeFileSync(
    new URL('../data/classes.json', import.meta.url),
    JSON.stringify({ model: MODEL, templates: TEMPLATES, classes: classes.map((c) => ({ ...c, vec: round(c.vec) })) }),
  );
  console.log(`wrote data/classes.json: ${classes.length} classes from ${MODEL}`);
}
