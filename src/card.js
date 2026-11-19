// The daily card. Pure functions only, tested in tests/card.mjs.
//
// Everyone gets the same card on the same day, Wordle-style, so "did you get the
// snail?" is a thing two people can say to each other.

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// mulberry32, seeded from a string hash. Tiny, deterministic, good enough for shuffling.
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The day's draw order: the first 8 make the card, the rest are spares for the swap. */
export function drawOrder(day, poolIds, center) {
  const rand = rng(`proof-of-grass:${day}`);
  const ids = poolIds.filter((id) => id !== center);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/** 9 ids, centre square fixed. `swap` replaces one square with the first spare. */
export function cardFor(day, poolIds, center, swap = null) {
  const order = drawOrder(day, poolIds, center);
  const card = [...order.slice(0, 4), center, ...order.slice(4, 8)];
  if (swap !== null && swap !== 4) card[swap] = order[8];
  return card;
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function completedLines(filled) {
  return LINES.filter((l) => l.every((i) => filled.has(i)));
}

/** Grass-touching streak: consecutive days, ending today or yesterday, with the centre filled. */
export function streak(history, today) {
  let n = 0;
  const d = new Date(`${today}T12:00:00`);
  if (!history[today]) d.setDate(d.getDate() - 1);
  while (history[dayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function shareText(day, filled, url) {
  const rows = [0, 3, 6].map((r) => [r, r + 1, r + 2].map((i) => (filled.has(i) ? '🟩' : '⬜')).join(''));
  const lines = completedLines(filled).length;
  const tail = filled.size === 9 ? 'BLACKOUT' : lines ? `${lines} bingo${lines > 1 ? 's' : ''}` : `${filled.size}/9`;
  return `TouchGrass Bingo ${day}\n${rows.join('\n')}\n${tail}\n${url}`;
}
