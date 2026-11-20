// The judge module's pure API: no model, runs in milliseconds. tests/run.mjs measures
// it on real photos.
import assert from 'node:assert/strict';
import { judge, rank, normalize, centroid, classPrompts, DEFAULTS, VERSION } from '../judge/core.js';
import { ELSEWHERE, TEMPLATES } from '../judge/vocab.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };

// A ranking by hand: [id, kind, p], most likely first.
const ranked = (...rows) => rows.map(([id, kind, p]) => ({ id, kind, p, cos: 0 }));

check('a claim in the top 2 with at least 15% is a match', () => {
  const v = judge(ranked(['bee', 'item', 0.5], ['flower', 'item', 0.3], ['moss', 'item', 0.2]), 'flower');
  assert.equal(v.ok, true);
  assert.equal(v.reason, 'match');
  assert.equal(v.hit.id, 'flower');
});

check('third place, or second under 15%, is another item', () => {
  assert.equal(judge(ranked(['bee', 'item', 0.5], ['flower', 'item', 0.3], ['moss', 'item', 0.2]), 'moss').reason, 'other-item');
  assert.equal(judge(ranked(['bee', 'item', 0.88], ['flower', 'item', 0.1], ['moss', 'item', 0.02]), 'flower').reason, 'other-item');
});

check('a claim can be a list of ids that would all count', () => {
  const r = ranked(['statue', 'item', 0.6], ['plaque', 'item', 0.3], ['tree', 'item', 0.1]);
  assert.equal(judge(r, ['monument', 'statue']).ok, true);
  assert.equal(judge(r, ['tree', 'bench']).ok, false);
});

check('an indoor class on top is a hard no', () => {
  const v = judge(ranked(['room', 'elsewhere', 0.5], ['grass', 'item', 0.45]), 'grass');
  assert.equal(v.reason, 'elsewhere');
  assert.equal(v.top.id, 'room');
});

check('options merge with the defaults', () => {
  const r = ranked(['bee', 'item', 0.6], ['flower', 'item', 0.4]);
  assert.equal(judge(r, 'flower', { topK: 1 }).ok, false);
  assert.equal(judge(r, 'flower').ok, true);
  assert.deepEqual(DEFAULTS, { topK: 2, minP: 0.15 });
});

check('rank is a softmax over every class, most likely first', () => {
  const classes = [{ id: 'a', kind: 'item', vec: [1, 0] }, { id: 'b', kind: 'item', vec: [0, 1] }];
  const r = rank([3, 1], classes);
  assert.equal(r[0].id, 'a');
  assert.ok(Math.abs(r[0].p + r[1].p - 1) < 1e-9);
  assert.ok(Math.abs(r[0].cos - 3 / Math.sqrt(10)) < 1e-9);
});

check('centroid of unit vectors is a unit vector', () => {
  const c = centroid([[1, 0], [0, 2]]);
  assert.ok(Math.abs(Math.hypot(...c) - 1) < 1e-9);
  assert.deepEqual(normalize([0, 0]), [0, 0]);
});

check('prompts expand every name through every template', () => {
  assert.deepEqual(classPrompts({ names: ['a bench', 'a seat'] }, ['a photo of {}.', '{} outside']), ['a photo of a bench.', 'a bench outside', 'a photo of a seat.', 'a seat outside']);
});

check('shared classes have the kinds the rule looks for', () => {
  assert.ok(ELSEWHERE.every((c) => c.kind === 'elsewhere'));
  assert.equal(TEMPLATES.length, 4);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

console.log(`\n${n} judge checks passed\n`);
