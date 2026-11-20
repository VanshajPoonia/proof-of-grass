// The judge in Node: builds vocabularies with CLIP's text tower, and embeds test photos
// with the vision tower at the same q8 precision the browser runs. Needs the
// @huggingface/transformers package; the browser half (browser.js) does not.
import {
  AutoTokenizer, CLIPTextModelWithProjection,
  AutoProcessor, CLIPVisionModelWithProjection, RawImage,
} from '@huggingface/transformers';
import { classPrompts, centroid } from './core.js';
import { TEMPLATES, ELSEWHERE } from './vocab.js';

export const DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32';
export { RawImage };

const texts = new Map();
const visions = new Map();

export async function embedTexts(list, model = DEFAULT_MODEL, batch = 32) {
  if (!texts.has(model)) {
    texts.set(model, {
      tok: await AutoTokenizer.from_pretrained(model),
      net: await CLIPTextModelWithProjection.from_pretrained(model, { dtype: 'fp32' }),
    });
  }
  const { tok, net } = texts.get(model);
  const out = [];
  for (let i = 0; i < list.length; i += batch) {
    const inputs = tok(list.slice(i, i + batch), { padding: true, truncation: true });
    const { text_embeds } = await net(inputs);
    out.push(...text_embeds.tolist());
  }
  return out;
}

/** A file path, a URL, or a RawImage already in memory. */
export async function embedImage(image, model = DEFAULT_MODEL, dtype = 'q8') {
  if (!visions.has(model)) {
    visions.set(model, {
      proc: await AutoProcessor.from_pretrained(model),
      net: await CLIPVisionModelWithProjection.from_pretrained(model, { dtype }),
    });
  }
  const { proc, net } = visions.get(model);
  const raw = image instanceof RawImage ? image : await RawImage.read(image);
  const { image_embeds } = await net(await proc(raw));
  return image_embeds.tolist()[0];
}

/**
 * One direction per class. `items` are your own classes ({ id, names }); the shared
 * indoor classes are added after them unless you pass `extra`.
 */
export async function buildClasses(items, { model = DEFAULT_MODEL, templates = TEMPLATES, extra = ELSEWHERE } = {}) {
  const all = [...items.map((c) => ({ kind: 'item', ...c })), ...extra];
  const classes = [];
  for (const c of all) classes.push({ id: c.id, kind: c.kind, vec: centroid(await embedTexts(classPrompts(c, templates), model)) });
  return classes;
}

/** The JSON file browser.js loads. Rounded to 5 places, which keeps it small and changes no verdict. */
export function vocabularyFile(classes, { model = DEFAULT_MODEL, templates = TEMPLATES } = {}) {
  const round = (v) => v.map((x) => Math.round(x * 1e5) / 1e5);
  return JSON.stringify({ model, templates, classes: classes.map((c) => ({ ...c, vec: round(c.vec) })) });
}
