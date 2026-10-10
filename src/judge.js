// Pure scoring logic, shared by the app and by tests/run.mjs. No model in here: it takes
// embeddings in and returns a verdict, so the test suite exercises exactly this file.

/** Every phrasing of every class, expanded through every template. */
export function classPrompts(cls, templates) {
  return cls.names.flatMap((n) => templates.map((t) => t.replace('{}', n)));
}

export function normalize(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return Array.from(v, (x) => x / n);
}

/** Mean of unit vectors, re-normalised: one direction per class. */
export function centroid(vectors) {
  const out = new Array(vectors[0].length).fill(0);
  for (const v of vectors) {
    const u = normalize(v);
    for (let i = 0; i < u.length; i++) out[i] += u[i];
  }
  return normalize(out);
}

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/**
 * CLIP's own zero-shot head: cosine similarity times the learned logit scale (100),
 * then softmax across every class we know about. The softmax is the point. A raw
 * cosine of 0.27 means nothing on its own; it only means something next to the
 * other 0.26s and 0.21s.
 */
export function rank(imageVec, classes, scale = 100) {
  const img = normalize(imageVec);
  const logits = classes.map((c) => scale * dot(img, c.vec));
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return classes
    .map((c, i) => ({ id: c.id, kind: c.kind, p: exps[i] / sum, cos: logits[i] / scale }))
    .sort((a, b) => b.p - a.p);
}

export const DEFAULTS = { topK: 2, minP: 0.15 };

/**
 * Does this photo fill this square?
 *
 * Accept when the claimed item is in the top `topK` and holds at least `minP` of the
 * probability. Top-2 rather than top-1 because real photos contain more than one
 * thing: a squirrel holding an acorn should be able to fill either square. The
 * `minP` floor stops the runner-up from sneaking in at 3%.
 *
 * Anything that is not an outdoor item outranking the claim is a hard no, regardless.
 */
export function judge(ranked, claimId, { topK, minP } = DEFAULTS) {
  const at = ranked.findIndex((r) => r.id === claimId);
  const hit = ranked[at];
  const top = ranked[0];
  if (top.kind === 'elsewhere') {
    return { ok: false, reason: 'elsewhere', top, hit };
  }
  if (at >= 0 && at < topK && hit.p >= minP) {
    return { ok: true, reason: 'match', top, hit };
  }
  return { ok: false, reason: 'other-item', top, hit };
}
