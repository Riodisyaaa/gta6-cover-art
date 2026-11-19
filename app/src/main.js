// Vice City Cover Maker — the editor.
// A live preview canvas, five photo slots (drag to pan, scroll to zoom),
// layout and grade pickers, an editable caption, toggleable badges, and
// one-click PNG export in the three common post sizes.

import { GRADES, LAYOUTS, drawCover, layoutById } from './cover.js';
import { PRESETS, SAMPLES, loadImage, loadSamples, presetById, presetOptions } from './shots.js';

const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

const state = {
  slots: [0, 1, 2, 3, 4].map(() => ({ img: null, ox: 0, oy: 0, zoom: 1 })),
  layoutId: 'neon',
  gradeId: 'leonida',
  caption: 'NEON PURSUIT',
  subtitle: 'VICE CITY',
  band: true,
  starburst: true,
  newBadge: true,
  seed: 11,
};

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const pctx = preview.getContext('2d');

function currentOptions() {
  return {
    photos: state.slots.map((s) => s.img),
    slots: state.slots,
    layoutId: state.layoutId,
    gradeId: state.gradeId,
    caption: state.caption,
    subtitle: state.subtitle,
    band: state.band,
    starburst: state.starburst,
    newBadge: state.newBadge,
    seed: state.seed,
  };
}

function render() {
  if (!preview) return;
  drawCover(preview, currentOptions());
}

function applyPreset(preset) {
  state.layoutId = preset.layoutId;
  state.gradeId = preset.gradeId;
  state.caption = preset.name;
  state.subtitle = preset.subtitle;
  state.seed = preset.seed;
  preset.slotPhotos.forEach((photoIndex, i) => {
    state.slots[i].img = window.__samples[photoIndex] || null;
    state.slots[i].ox = 0;
    state.slots[i].oy = 0;
    state.slots[i].zoom = 1;
  });
  syncControls();
  render();
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layoutId);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.gradeId);
  });
  document.querySelectorAll('[data-preset]').forEach((b) => {
    b.classList.toggle('active', b.dataset.preset === state.caption.toLowerCase().replace(/ /g, '-'));
  });
  const caption = $('#caption');
  if (caption && caption.value !== state.caption) caption.value = state.caption;
  const subtitle = $('#subtitle');
  if (subtitle && subtitle.value !== state.subtitle) subtitle.value = state.subtitle;
  const band = $('#toggle-band');
  if (band) band.checked = state.band;
  const star = $('#toggle-star');
  if (star) star.checked = state.starburst;
  const badge = $('#toggle-new');
  if (badge) badge.checked = state.newBadge;
}

function buildControls() {
  const layoutRow = $('#layout-row');
  LAYOUTS.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.layout = l.id;
    b.textContent = l.name;
    b.addEventListener('click', () => {
      state.layoutId = l.id;
      syncControls();
      render();
    });
    layoutRow.appendChild(b);
  });
  const gradeRow = $('#grade-row');
  GRADES.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.grade = g.id;
    b.textContent = g.name;
    b.addEventListener('click', () => {
      state.gradeId = g.id;
      syncControls();
      render();
    });
    gradeRow.appendChild(b);
  });
  const presetRow = $('#preset-row');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.preset = p.id;
    b.textContent = p.name;
    b.addEventListener('click', () => applyPreset(p));
    presetRow.appendChild(b);
  });
  const sizeRow = $('#export-row');
  EXPORT_SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip export';
    b.textContent = 'PNG ' + s.label;
    b.addEventListener('click', () => exportCover(s));
    sizeRow.appendChild(b);
  });
}

function buildSlots() {
  const wrap = $('#slots');
  state.slots.forEach((slot, i) => {
    const div = document.createElement('div');
    div.className = 'slot';
    div.innerHTML = `
      <div class="slot-thumb" id="thumb-${i}"><span>Slot ${i + 1}</span></div>
      <label class="slot-load">Load photo
        <input type="file" accept="image/*" data-slot="${i}" hidden>
      </label>
      <div class="slot-zoom">
        <button type="button" data-zoom-out="${i}" aria-label="Zoom out">−</button>
        <span id="zoom-${i}">100%</span>
        <button type="button" data-zoom-in="${i}" aria-label="Zoom in">+</button>
      </div>`;
    wrap.appendChild(div);
    const input = div.querySelector('input[type="file"]');
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        slot.img = img;
        slot.ox = 0;
        slot.oy = 0;
        slot.zoom = 1;
        paintThumb(i);
        render();
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    div.querySelector(`[data-zoom-in="${i}"]`).addEventListener('click', () => {
      slot.zoom = Math.min(3, slot.zoom + 0.25);
      paintThumb(i);
      render();
    });
    div.querySelector(`[data-zoom-out="${i}"]`).addEventListener('click', () => {
      slot.zoom = Math.max(1, slot.zoom - 0.25);
      paintThumb(i);
      render();
    });
  });
}

function paintThumb(i) {
  const thumb = document.getElementById(`thumb-${i}`);
  const slot = state.slots[i];
  const label = document.getElementById(`zoom-${i}`);
  if (label) label.textContent = Math.round(slot.zoom * 100) + '%';
  if (!thumb) return;
  thumb.innerHTML = '';
  if (slot.img) {
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 90;
    const ctx = c.getContext('2d');
    const s = Math.max(120 / slot.img.naturalWidth, 90 / slot.img.naturalHeight);
    ctx.drawImage(slot.img, (120 - slot.img.naturalWidth * s) / 2, (90 - slot.img.naturalHeight * s) / 2, slot.img.naturalWidth * s, slot.img.naturalHeight * s);
    thumb.appendChild(c);
  } else {
    const span = document.createElement('span');
    span.textContent = `Slot ${i + 1}`;
    thumb.appendChild(span);
  }
}

// Drag a panel in the preview to pan its photo; scroll to zoom it.
function wirePreviewDrag() {
  let drag = null;
  function panelAt(mx, my) {
    const rect = preview.getBoundingClientRect();
    const px = ((mx - rect.left) / rect.width) * preview.width;
    const py = ((my - rect.top) / rect.height) * preview.height;
    const bandH = state.band ? Math.round(preview.height * 0.26) : 0;
    const rects = layoutById(state.layoutId).panels(preview.width, preview.height - bandH);
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  }
  preview.addEventListener('pointerdown', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    drag = { i, x: e.clientX, y: e.clientY, ox: state.slots[i].ox, oy: state.slots[i].oy };
    preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = preview.getBoundingClientRect();
    const slot = state.slots[drag.i];
    slot.ox = Math.max(-0.5, Math.min(0.5, drag.ox + ((e.clientX - drag.x) / rect.width) * 1.6));
    slot.oy = Math.max(-0.5, Math.min(0.5, drag.oy + ((e.clientY - drag.y) / rect.height) * 1.6));
    render();
  });
  preview.addEventListener('pointerup', () => {
    drag = null;
  });
  preview.addEventListener('wheel', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    const slot = state.slots[i];
    slot.zoom = Math.max(1, Math.min(3, slot.zoom + (e.deltaY < 0 ? 0.15 : -0.15)));
    paintThumb(i);
    render();
  }, { passive: false });
}

function exportCover(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, currentOptions());
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${size.id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function wireInputs() {
  $('#caption').addEventListener('input', (e) => {
    state.caption = e.target.value || 'VICE CITY';
    render();
  });
  $('#subtitle').addEventListener('input', (e) => {
    state.subtitle = e.target.value || 'VICE CITY';
    render();
  });
  $('#toggle-band').addEventListener('change', (e) => {
    state.band = e.target.checked;
    render();
  });
  $('#toggle-star').addEventListener('change', (e) => {
    state.starburst = e.target.checked;
    render();
  });
  $('#toggle-new').addEventListener('change', (e) => {
    state.newBadge = e.target.checked;
    render();
  });
}

// Full-bleed cover view, for sharing a finished cover and for screenshots:
// ?cover=<preset-id>&size=1080x1080 renders that preset at that size.
async function coverMode() {
  const q = new URLSearchParams(location.search);
  const preset = presetById(q.get('cover') || q.get('preset') || 'neon-pursuit');
  const sizeParam = q.get('size') || '';
  const [sw, sh] = sizeParam.split('x').map(Number);
  const w = Number.isFinite(sw) && sw > 0 ? sw : preset.size[0];
  const h = Number.isFinite(sh) && sh > 0 ? sh : preset.size[1];
  const images = await loadSamples();
  const canvas = document.getElementById('cover-view');
  canvas.hidden = false;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.objectFit = 'contain';
  // hide the editor chrome so the cover fills the shot
  document.querySelector('.topbar').style.display = 'none';
  document.querySelector('.editor').style.display = 'none';
  document.querySelector('.foot').style.display = 'none';
  document.body.style.background = '#000';
  drawCover(canvas, presetOptions(preset, images));
  document.title = preset.name + ' — Vice City Cover Maker';
}

async function boot() {
  const q = new URLSearchParams(location.search);
  if (q.has('cover')) {
    await coverMode();
    return;
  }
  buildControls();
  buildSlots();
  wireInputs();
  wirePreviewDrag();
  window.__samples = await loadSamples();
  SAMPLES.forEach((_, i) => {
    state.slots[i].img = window.__samples[i];
    paintThumb(i);
  });
  const preset = q.get('preset');
  if (preset) applyPreset(presetById(preset));
  else {
    syncControls();
    render();
  }
  document.fonts.ready.then(render);
}

boot();
