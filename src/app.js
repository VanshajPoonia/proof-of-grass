import { ITEMS, CENTER, ELSEWHERE } from './items.js';
import { cardFor, completedLines, dayKey, shareText, streak } from './card.js';
import { rank, judge } from './judge.js';
import * as clip from './clip.js';

const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const today = dayKey();
const KEY = `pog:${today}`;

const store = {
  get(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: the card still works, it just forgets */ }
  },
};

let state = store.get(KEY, { swap: null, filled: {} });
let swapping = false;
const card = () => cardFor(today, ITEMS.map((i) => i.id), CENTER, state.swap);
const filledSet = () => new Set(Object.keys(state.filled).map(Number));

// ---------- the card ---------------------------------------------------------------

function render() {
  const ids = card();
  const filled = filledSet();
  const won = new Set(completedLines(filled).flat());
  $('#card').innerHTML = ids.map((id, i) => {
    const it = byId[id];
    const f = state.filled[i];
    const cls = ['sq', f && 'done', won.has(i) && 'line', i === 4 && 'center', swapping && i !== 4 && !f && 'wiggle'].filter(Boolean).join(' ');
    const bg = f ? ` style="background-image:url(${f.thumb})"` : '';
    return `<button class="${cls}" data-i="${i}"${bg} aria-label="${it.label}${f ? ', verified' : ''}">
      <span class="emoji" aria-hidden="true">${it.emoji}</span><span class="name">${it.label}</span>
      ${f ? '<span class="stamp" aria-hidden="true">verified</span>' : ''}
    </button>`;
  }).join('');

  const lines = completedLines(filled).length;
  $('#tally').textContent = filled.size === 9 ? 'Blackout. Go home, you have touched everything.'
    : lines ? `${lines} bingo${lines > 1 ? 's' : ''}, ${filled.size} of 9 found`
    : filled.size ? `${filled.size} of 9 found` : 'Nothing found yet. It is all out there.';
  $('#share').disabled = filled.size === 0;
  $('#swap').disabled = state.swap !== null || filled.size === 9;
  $('#swap').textContent = swapping ? 'Tap a square to swap it' : state.swap !== null ? 'Swap used today' : 'Swap one square';

  const history = store.get('pog:history', {});
  const s = streak(history, today);
  $('#streak').textContent = s ? `🌱 ${s}-day grass streak` : '';
}

$('#card').addEventListener('click', (e) => {
  const sq = e.target.closest('.sq');
  if (!sq) return;
  const i = Number(sq.dataset.i);
  if (swapping) {
    if (i === 4 || state.filled[i]) return;
    state.swap = i;
    swapping = false;
    store.set(KEY, state);
    render();
    return;
  }
  openSheet(i);
});

$('#swap').addEventListener('click', () => { swapping = !swapping; render(); });

$('#share').addEventListener('click', async () => {
  const text = shareText(today, filledSet(), location.origin + location.pathname);
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('Copied. Go make someone jealous.'); }
  } catch { /* share sheet dismissed */ }
});

// ---------- the judge ----------------------------------------------------------------

const MODEL_MB = 89;

function showModelBanner() {
  $('#model').hidden = clip.ready();
}

async function ensureModel(where) {
  if (clip.ready()) return;
  const bar = where.querySelector('progress');
  const label = where.querySelector('.load-label');
  bar.hidden = false;
  label.textContent = `Downloading the judge, once. ${MODEL_MB} MB.`;
  await clip.load((frac) => { bar.value = frac; });
  store.set('pog:model', 1);
  label.textContent = 'Judge ready. Works offline from now on.';
  bar.hidden = true;
  showModelBanner();
}

$('#model button').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try { await ensureModel($('#model')); } catch (err) {
    $('#model .load-label').textContent = `Could not load the model: ${err.message}`;
    e.target.disabled = false;
  }
});

const ELSEWHERE_COPY = {
  screen: 'That is a screen. The grass is on the other side of it.',
  keyboard: 'That is a keyboard. Spiritually adjacent, physically not.',
  room: 'That looks like indoors.',
  wall: 'That looks like indoors.',
  food: 'That is lunch. Eat it outside, then try again.',
  face: 'Lovely face. Not on the card, though.',
  car: 'That is the inside of a car. So close, and yet.',
  houseplant: 'A houseplant is grass in witness protection. Try outside.',
  paper: 'That used to be a tree. It does not count any more.',
};
const nameOf = (r) => byId[r.id]?.label ?? ELSEWHERE.find((e) => e.id === r.id).names[0];

let current = null; // index of the square the sheet is about

function openSheet(i) {
  current = i;
  const it = byId[card()[i]];
  const f = state.filled[i];
  $('#sheet .emoji').textContent = it.emoji;
  $('#sheet h2').textContent = it.label;
  $('#sheet .hint').textContent = it.hint;
  $('#verdict').hidden = !f;
  $('#verdict').className = 'verdict';
  $('#preview').hidden = !f;
  if (f) {
    $('#preview').src = f.thumb;
    showVerdict({ ok: true }, f.top3);
  }
  $('#capture').hidden = !!f;
  $('#credit').hidden = true;
  $('#sheet').showModal();
}

$('#sheet').addEventListener('click', (e) => {
  if (e.target === $('#sheet') || e.target.closest('[data-close]')) $('#sheet').close();
});

$('#photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) await check(file);
});

// Sample photos for anyone judging this from a desk: one labelled test photo per item
// (Wikimedia Commons, credited under the preview) and one laptop that should fail.
let credits = null;
async function sample(key) {
  credits ??= await (await fetch('assets/samples/credits.json')).json();
  const c = credits[key];
  const blob = await (await fetch(`assets/samples/${key}.jpg`)).blob();
  await check(blob, `Sample: <a href="${c.page}" target="_blank" rel="noopener">${c.title.replace(/^File:/, '')}</a>, ${c.credit}, ${c.license}`);
}
$('#sample-real').addEventListener('click', () => sample(card()[current]));
document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => sample(b.dataset.sample)));

async function check(blob, credit = '') {
  const i = current;
  $('#credit').innerHTML = credit;
  $('#credit').hidden = !credit;
  const id = card()[i];
  const thumb = await thumbnail(blob);
  $('#preview').src = thumb;
  $('#preview').hidden = false;
  $('#capture').hidden = true;
  $('#verdict').hidden = false;
  $('#verdict').className = 'verdict pending';
  $('#verdict h3').textContent = clip.ready() ? 'Looking closely…' : 'Fetching the judge first…';
  $('#verdict p').textContent = '';
  $('#bars').innerHTML = '';
  $('#verdict .load-label').textContent = '';
  $('#retry').hidden = true;
  try {
    await ensureModel($('#verdict'));
    $('#verdict .load-label').textContent = '';
    $('#verdict h3').textContent = 'Looking closely…';
    const ranked = rank(await clip.embed(blob), clip.getClasses());
    const v = judge(ranked, id);
    const top3 = ranked.slice(0, 3).map((r) => ({ name: nameOf(r), p: r.p, id: r.id }));
    if (v.ok) {
      state.filled[i] = { thumb, top3 };
      store.set(KEY, state);
      if (i === 4) store.set('pog:history', { ...store.get('pog:history', {}), [today]: 1 });
      const before = completedLines(new Set([...filledSet()].filter((x) => x !== i))).length;
      render();
      if (completedLines(filledSet()).length > before) toast('BINGO');
    }
    showVerdict(v, top3, id);
  } catch (err) {
    $('#verdict').className = 'verdict no';
    $('#verdict h3').textContent = 'Something broke';
    $('#verdict p').textContent = err.message;
  }
}

function showVerdict(v, top3, claimed) {
  const el = $('#verdict');
  el.className = `verdict ${v.ok ? 'yes' : 'no'}`;
  if (v.ok) {
    el.querySelector('h3').textContent = 'Verified. You touched it.';
    el.querySelector('p').textContent = 'Square filled. The photo stays on this phone.';
  } else if (v.reason === 'elsewhere') {
    el.querySelector('h3').textContent = 'Not quite.';
    el.querySelector('p').textContent = ELSEWHERE_COPY[v.top.id];
  } else {
    el.querySelector('h3').textContent = 'Not quite.';
    el.querySelector('p').textContent = `That reads as ${nameOf(v.top).toLowerCase()} to me. If the ${byId[claimed].label.toLowerCase().replace(/^an? /, '')} is in there, get closer so it fills the frame.`;
  }
  $('#bars').innerHTML = top3.map((t) => `
    <div class="bar"><span>${t.name}</span><span class="track"><span style="width:${Math.max(2, t.p * 100).toFixed(0)}%"></span></span><span>${(t.p * 100).toFixed(0)}%</span></div>`).join('');
  $('#retry').hidden = v.ok;
}

$('#retry').addEventListener('click', () => {
  $('#verdict').hidden = true;
  $('#credit').hidden = true;
  $('#preview').hidden = true;
  $('#capture').hidden = false;
});

async function thumbnail(blob, size = 240) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.72);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- boot ---------------------------------------------------------------------

$('#date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
render();
showModelBanner();
if (store.get('pog:model', 0)) ensureModel($('#model')).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
