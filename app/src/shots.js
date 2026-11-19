// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows the cover alone, filling the frame. Query: photo/photo2/photo3/
// photo4/photo5 pick the sample (car, boulevard, street, pier, portrait),
// caption/subtitle/layout/grade/size set the cover, band/badges toggle the extras.
// Per-panel crop: zoom1..5 (1..2.5), ox1..5 and oy1..5 (-0.6..0.6).
// window.__shotReady is set once the cover is painted.
export async function runShot(shot, query, api) {
  const { state, setPhoto, applySize, redraw, loadImage } = api;
  const SAMPLES = ['car', 'boulevard', 'street', 'pier', 'portrait'];
  const pick = (name, fallback) => {
    const v = query.get(name);
    return SAMPLES.includes(v) ? `samples/${v}.jpg` : `samples/${fallback}.jpg`;
  };
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  };
  set('caption', query.get('caption'));
  set('subtitle', query.get('subtitle'));
  set('layout', query.get('layout'));
  set('grade', query.get('grade'));
  set('size', query.get('size'));
  state.caption = document.getElementById('caption').value;
  state.subtitle = document.getElementById('subtitle').value;
  state.layout = document.getElementById('layout').value;
  state.grade = document.getElementById('grade').value;
  const bandEl = document.getElementById('band');
  const badgesEl = document.getElementById('badges');
  if (query.get('band') === '0') { bandEl.checked = false; state.band = false; }
  if (query.get('band') === '1') { bandEl.checked = true; state.band = true; }
  if (query.get('badges') === '0') { badgesEl.checked = false; state.badges = false; }
  if (query.get('badges') === '1') { badgesEl.checked = true; state.badges = true; }

  if (shot === 'cover') document.body.classList.add('shot-cover');
  applySize();

  const photos = await Promise.all([
    loadImage(pick('photo', 'car')),
    loadImage(pick('photo2', 'boulevard')),
    loadImage(pick('photo3', 'street')),
    loadImage(pick('photo4', 'pier')),
    loadImage(pick('photo5', 'portrait')),
  ]);
  photos.forEach((img, i) => setPhoto(i, img));
  // Per-panel crop for the shot: zoom1..5 (1..2.5), ox1..5 and oy1..5 (-0.6..0.6).
  for (let i = 0; i < 5; i++) {
    const z = Number(query.get(`zoom${i + 1}`));
    if (Number.isFinite(z) && z >= 1 && z <= 2.5) state.photos[i].zoom = z;
    const ox = Number(query.get(`ox${i + 1}`));
    if (Number.isFinite(ox)) state.photos[i].ox = Math.max(-0.6, Math.min(0.6, ox));
    const oy = Number(query.get(`oy${i + 1}`));
    if (Number.isFinite(oy)) state.photos[i].oy = Math.max(-0.6, Math.min(0.6, oy));
    const zoomSlider = document.querySelector(`[data-zoom="${i}"]`);
    if (zoomSlider) zoomSlider.value = state.photos[i].zoom;
  }

  // The caption font must be in before the paint, or the lettering falls back.
  if (document.fonts) {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('100px Anton'), document.fonts.load('600 40px Oswald')]),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch { /* fall back to system fonts */ }
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
