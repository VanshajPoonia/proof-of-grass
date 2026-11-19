// Card logic: no model, runs in milliseconds.
import assert from 'node:assert/strict';
import { ITEMS, CENTER } from '../src/items.js';
import { cardFor, completedLines, streak, shareText, dayKey } from '../src/card.js';

const ids = ITEMS.map((i) => i.id);
let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };

check('same day, same card', () => assert.deepEqual(cardFor('2026-10-10', ids, CENTER), cardFor('2026-10-10', ids, CENTER)));
check('different day, different card', () => assert.notDeepEqual(cardFor('2026-10-10', ids, CENTER), cardFor('2026-10-11', ids, CENTER)));
check('grass is always the centre', () => {
  for (let d = 1; d <= 31; d++) assert.equal(cardFor(`2026-10-${String(d).padStart(2, '0')}`, ids, CENTER)[4], 'grass');
});
check('nine distinct squares', () => assert.equal(new Set(cardFor('2026-10-10', ids, CENTER)).size, 9));
check('swap changes exactly one square, never the centre', () => {
  const a = cardFor('2026-10-10', ids, CENTER);
  const b = cardFor('2026-10-10', ids, CENTER, 2);
  assert.equal(a.filter((x, i) => x !== b[i]).length, 1);
  assert.notEqual(a[2], b[2]);
  assert.ok(!a.includes(b[2]));
  assert.deepEqual(cardFor('2026-10-10', ids, CENTER, 4), a);
});
check('rows, columns, diagonals', () => {
  assert.equal(completedLines(new Set([0, 1, 2])).length, 1);
  assert.equal(completedLines(new Set([0, 4, 8, 2, 6])).length, 2);
  assert.equal(completedLines(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8])).length, 8);
  assert.equal(completedLines(new Set([0, 1, 3])).length, 0);
});
check('streak counts back from today, or from yesterday if today is not done yet', () => {
  const h = { '2026-10-08': 1, '2026-10-09': 1, '2026-10-10': 1 };
  assert.equal(streak(h, '2026-10-10'), 3);
  assert.equal(streak({ '2026-10-08': 1, '2026-10-09': 1 }, '2026-10-10'), 2);
  assert.equal(streak({ '2026-10-07': 1 }, '2026-10-10'), 0);
});
check('streak survives a month boundary', () => assert.equal(streak({ '2026-09-30': 1, '2026-10-01': 1 }, '2026-10-01'), 2));
check('share text is a grid', () => {
  const t = shareText('2026-10-10', new Set([0, 4, 8]), 'https://x');
  assert.equal(t, 'TouchGrass Bingo 2026-10-10\n🟩⬜⬜\n⬜🟩⬜\n⬜⬜🟩\n1 bingo\nhttps://x');
});
check('dayKey is local, zero-padded', () => assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05'));

console.log(`\n${n} card checks passed\n`);
