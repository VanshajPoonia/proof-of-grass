// Node-side CLIP: the text tower (used to precompute data/classes.json) and the vision
// tower (used by the tests, at the same q8 precision the browser falls back to).
import {
  AutoTokenizer, CLIPTextModelWithProjection,
  AutoProcessor, CLIPVisionModelWithProjection, RawImage,
} from '@huggingface/transformers';

export const MODEL = process.env.MODEL || 'Xenova/clip-vit-base-patch32';

let text = null;
let vision = null;

export async function embedTexts(texts, batch = 32) {
  text ??= {
    tok: await AutoTokenizer.from_pretrained(MODEL),
    model: await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' }),
  };
  const out = [];
  for (let i = 0; i < texts.length; i += batch) {
    const inputs = text.tok(texts.slice(i, i + batch), { padding: true, truncation: true });
    const { text_embeds } = await text.model(inputs);
    out.push(...text_embeds.tolist());
  }
  return out;
}

export async function embedImage(pathOrUrl, dtype = 'q8') {
  vision ??= {
    proc: await AutoProcessor.from_pretrained(MODEL),
    model: await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype }),
  };
  const image = await RawImage.read(pathOrUrl);
  const { image_embeds } = await vision.model(await vision.proc(image));
  return image_embeds.tolist()[0];
}
