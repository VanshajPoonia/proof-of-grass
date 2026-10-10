// CLIP ViT-B/32 vision tower, q8, in this tab. The text side was precomputed into
// data/classes.json by scripts/build-classes.mjs, so it is never downloaded here.
//
// Always WASM at q8, even where WebGPU exists. That is the exact configuration
// tests/run.mjs measures, and "what ships is what was tested" beats a few hundred
// milliseconds on a desktop GPU.
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

let processor = null;
let model = null;
let classes = null;

export const ready = () => model !== null;

// One download, however many callers ask for it (boot auto-load and a first photo can race).
let loading = null;
const listeners = new Set();

export function load(onProgress) {
  if (onProgress) listeners.add(onProgress);
  loading ??= download().catch((err) => { loading = null; throw err; });
  return loading;
}

async function download() {
  const onProgress = (f, t) => listeners.forEach((l) => l(f, t));
  const files = new Map();
  const progress_callback = (e) => {
    if (e.status !== 'progress' || !e.total) return;
    files.set(e.file, [e.loaded, e.total]);
    let loaded = 0, total = 0;
    for (const [l, t] of files.values()) { loaded += l; total += t; }
    onProgress(loaded / total, total);
  };
  const [data, proc, vision] = await Promise.all([
    fetch('data/classes.json').then((r) => r.json()),
    AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32', { progress_callback }),
    CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', { dtype: 'q8', device: 'wasm', progress_callback }),
  ]);
  classes = data.classes;
  processor = proc;
  model = vision;
}

export const getClasses = () => classes;

export async function embed(blob) {
  const image = await RawImage.fromBlob(blob);
  const { image_embeds } = await model(await processor(image));
  return image_embeds.data;
}
