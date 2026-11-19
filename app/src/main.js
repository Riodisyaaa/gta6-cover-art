// Wires the page: photos in, caption typed, cover out. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js). All photos are read on this machine and
// never uploaded; the export is the preview canvas itself, so what you see is what you get.
import { drawCover, panelRects } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const layoutInput = document.getElementById('layout');
const gradeInput = document.getElementById('grade');
const sizeInput = document.getElementById('size');
const bandInput = document.getElementById('band');
const badgesInput = document.getElementById('badges');
const status = document.getElementById('status');

const SAMPLES = ['samples/car.jpg', 'samples/boulevard.jpg', 'samples/street.jpg', 'samples/pier.jpg', 'samples/portrait.jpg'];
const state = {
  photos: [
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
  ],
  layout: 'grid',
  grade: 'sunset',
  caption: 'Neon Pursuit',
  subtitle: 'VICE CITY · EST. 2026',
  band: true,
  badges: true,
};
let selected = 0;
const sampleIndex = [0, 1, 2, 3, 4];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  drawCover(canvas, state);
}

/** Resizes the preview canvas to the chosen export size and redraws. */
function applySize() {
  const [w, h] = sizeInput.value.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  redraw();
}

function selectSlot(i) {
  selected = i;
  document.querySelectorAll('.slot').forEach((el, j) => el.classList.toggle('selected', j === i));
}

function setPhoto(i, img) {
  state.photos[i].img = img;
  state.photos[i].zoom = 1;
  state.photos[i].ox = 0;
  state.photos[i].oy = 0;
  const zoom = document.querySelector(`[data-zoom="${i}"]`);
  if (zoom) zoom.value = 1;
  selectSlot(i);
  redraw();
}

document.querySelectorAll('[data-photo]').forEach((input) => {
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const i = Number(input.dataset.photo);
    setPhoto(i, await loadImage(URL.createObjectURL(file)));
    status.textContent = `Photo ${i + 1} loaded.`;
  });
});

document.querySelectorAll('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const i = Number(btn.dataset.sample);
    const url = SAMPLES[sampleIndex[i] % SAMPLES.length];
    sampleIndex[i] += 1;
    setPhoto(i, await loadImage(url));
    status.textContent = `Photo ${i + 1} is a sample.`;
  });
});

document.querySelectorAll('[data-zoom]').forEach((slider) => {
  slider.addEventListener('input', () => {
    const i = Number(slider.dataset.zoom);
    state.photos[i].zoom = Number(slider.value);
    selectSlot(i);
    redraw();
  });
});

// Click a panel to select it; drag it to move its photo.
let dragging = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
function panelAt(x, y) {
  const rects = panelRects(canvas.width, canvas.height, state.layout, state.band);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i < 0) return;
  selectSlot(i);
  dragging = { i, x: p.x, y: p.y, ox: state.photos[i].ox, oy: state.photos[i].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const rects = panelRects(canvas.width, canvas.height, state.layout, state.band);
  const rect = rects[dragging.i];
  const photo = state.photos[dragging.i];
  photo.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + (p.x - dragging.x) / rect.w));
  photo.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + (p.y - dragging.y) / rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

layoutInput.addEventListener('change', () => { state.layout = layoutInput.value; redraw(); });
gradeInput.addEventListener('change', () => { state.grade = gradeInput.value; redraw(); });
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
bandInput.addEventListener('change', () => { state.band = bandInput.checked; redraw(); });
badgesInput.addEventListener('change', () => { state.badges = badgesInput.checked; redraw(); });
sizeInput.addEventListener('change', applySize);

document.getElementById('export').addEventListener('click', () => {
  const [w, h] = sizeInput.value.split('x').map(Number);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved vice-city-cover-${w}x${h}.png`;
  }, 'image/png');
});

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { state, setPhoto, applySize, redraw, loadImage, canvas });
} else {
  // Load the display fonts before the first paint, then draw once they arrive.
  applySize();
  if (document.fonts) {
    Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('600 40px Oswald'),
    ]).then(redraw).catch(() => {});
    document.fonts.ready.then(redraw).catch(() => {});
  }
}
