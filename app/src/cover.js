// Draws the multi-panel GTA-style cover: photos in panels, a Vice City colour grade,
// halftone dots, a bottom title band with a skyline, badges, and bold caption.
// Everything is drawn with the canvas 2D API, so the live preview and the
// exported PNG are the same drawing.
// state: { photos: [{img, zoom, ox, oy} x5], layout, grade, caption, subtitle,
//          band: bool, badges: bool }

const GRADES = {
  sunset: {
    top: 'rgba(255, 150, 70, 0.10)',
    bottom: 'rgba(198, 32, 112, 0.42)',
    wash: 'rgba(255, 90, 140, 0.22)',
    glow: 'rgba(255, 170, 60, 0.30)',
    bandA: '#ff2e88',
    bandB: '#ff9a3d',
  },
  neon: {
    top: 'rgba(60, 220, 255, 0.12)',
    bottom: 'rgba(120, 40, 200, 0.45)',
    wash: 'rgba(80, 120, 255, 0.24)',
    glow: 'rgba(0, 240, 255, 0.26)',
    bandA: '#7b2ff7',
    bandB: '#00e5ff',
  },
  dusk: {
    top: 'rgba(255, 200, 90, 0.12)',
    bottom: 'rgba(0, 120, 110, 0.40)',
    wash: 'rgba(255, 190, 80, 0.20)',
    glow: 'rgba(255, 220, 120, 0.28)',
    bandA: '#e8a020',
    bandB: '#0e7c74',
  },
  heat: {
    top: 'rgba(255, 60, 120, 0.12)',
    bottom: 'rgba(200, 20, 40, 0.45)',
    wash: 'rgba(255, 40, 90, 0.24)',
    glow: 'rgba(255, 120, 40, 0.30)',
    bandA: '#ff1e56',
    bandB: '#ff6a00',
  },
};

/** Deterministic pseudo-random (mulberry32) so the skyline is identical every render. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for a layout, adapted to the canvas aspect.
 *  `band` shrinks the panel area to the top 78% (the title band takes the rest).
 *  Slot 0 is always the hero panel. 'grid' returns 5 rects, the others 3. */
export function panelRects(w, h, layout, band = false) {
  const ph = band ? h * 0.74 : h;
  const g = Math.max(4, Math.round(Math.min(w, ph) * 0.008));
  if (w >= ph) {
    // Landscape / square.
    if (layout === 'grid') {
      const heroW = w * 0.55;
      const sideX = heroW + g;
      const sideW = w - sideX;
      const halfW = (sideW - g) / 2;
      const topH = (ph - g) / 2;
      return [
        { x: 0, y: 0, w: heroW, h: ph },
        { x: sideX, y: 0, w: halfW, h: topH },
        { x: sideX + halfW + g, y: 0, w: halfW, h: topH },
        { x: sideX, y: topH + g, w: halfW, h: topH },
        { x: sideX + halfW + g, y: topH + g, w: halfW, h: topH },
      ];
    }
    if (layout === 'triple') {
      const pw = (w - g * 2) / 3;
      return [
        { x: 0, y: 0, w: pw, h: ph },
        { x: pw + g, y: 0, w: pw, h: ph },
        { x: 2 * (pw + g), y: 0, w: pw, h: ph },
      ];
    }
    const heroW = w * 0.62;
    const sideW = w - heroW - g;
    const topH = ph * 0.55;
    const botH = ph - topH - g;
    if (layout === 'hero-right') {
      return [
        { x: sideW + g, y: 0, w: heroW, h: ph },
        { x: 0, y: 0, w: sideW, h: topH },
        { x: 0, y: topH + g, w: sideW, h: botH },
      ];
    }
    return [
      { x: 0, y: 0, w: heroW, h: ph },
      { x: heroW + g, y: 0, w: sideW, h: topH },
      { x: heroW + g, y: topH + g, w: sideW, h: botH },
    ];
  }
  // Portrait.
  if (layout === 'grid') {
    const heroH = ph * 0.52;
    const gridY = heroH + g;
    const gridH = ph - gridY;
    const halfW = (w - g) / 2;
    const halfH = (gridH - g) / 2;
    return [
      { x: 0, y: 0, w, h: heroH },
      { x: 0, y: gridY, w: halfW, h: halfH },
      { x: halfW + g, y: gridY, w: halfW, h: halfH },
      { x: 0, y: gridY + halfH + g, w: halfW, h: halfH },
      { x: halfW + g, y: gridY + halfH + g, w: halfW, h: halfH },
    ];
  }
  if (layout === 'triple') {
    const ph3 = (ph - g * 2) / 3;
    return [
      { x: 0, y: 0, w, h: ph3 },
      { x: 0, y: ph3 + g, w, h: ph3 },
      { x: 0, y: 2 * (ph3 + g), w, h: ph3 },
    ];
  }
  const heroH = ph * 0.60;
  const botY = heroH + g;
  const botH = ph - botY;
  const halfW = (w - g) / 2;
  if (layout === 'hero-right') {
    return [
      { x: 0, y: 0, w, h: heroH },
      { x: halfW + g, y: botY, w: halfW, h: botH },
      { x: 0, y: botY, w: halfW, h: botH },
    ];
  }
  return [
    { x: 0, y: 0, w, h: heroH },
    { x: 0, y: botY, w: halfW, h: botH },
    { x: halfW + g, y: botY, w: halfW, h: botH },
  ];
}

/** Draws one photo cover-fit into a panel rect, with zoom and pan offsets (-0.5..0.5).
 *  The offsets are clamped so the photo always covers the panel (no bare background). */
function drawPhotoInPanel(ctx, rect, photo) {
  const { img, zoom, ox, oy } = photo;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, '#3a1c5c');
    grad.addColorStop(1, '#1c0b33');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `600 ${Math.max(14, rect.h * 0.045)}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('YOUR PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // The photo is larger than the panel by (dw - rect.w) / (dh - rect.h); the pan may use
  // at most half that slack on each side, or the panel's edge shows bare background.
  const maxOx = Math.max(0, (dw - rect.w) / (2 * rect.w));
  const maxOy = Math.max(0, (dh - rect.h) / (2 * rect.h));
  const cx = Math.max(-maxOx, Math.min(maxOx, ox));
  const cy = Math.max(-maxOy, Math.min(maxOy, oy));
  const dx = rect.x + (rect.w - dw) / 2 + cx * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + cy * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Sunset/neon colour grade over one panel, plus halftone dots in its top third. */
function gradePanel(ctx, rect, grade) {
  const g = GRADES[grade] || GRADES.sunset;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const tint = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  tint.addColorStop(0, g.top);
  tint.addColorStop(1, g.bottom);
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = g.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  const glow = ctx.createRadialGradient(
    rect.x + rect.w * 0.2, rect.y + rect.h * 0.85, 0,
    rect.x + rect.w * 0.2, rect.y + rect.h * 0.85, rect.w * 0.9,
  );
  glow.addColorStop(0, g.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // Halftone dots across the top third, fading down.
  const step = Math.max(10, rect.w * 0.022);
  const rows = Math.floor((rect.h / 3) / step);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  for (let r = 0; r < rows; r++) {
    const y = rect.y + step * (r + 0.5);
    const fade = 1 - r / Math.max(1, rows);
    for (let c = 0; c * step < rect.w; c++) {
      const x = rect.x + step * (c + 0.5) + (r % 2 ? step / 2 : 0);
      const rad = Math.max(0.6, step * 0.10 * fade);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Fits the caption to a width and returns its font size (never larger than maxSize). */
function captionSize(ctx, text, maxW, maxSize) {
  let size = maxSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxW && size > 14) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/** A palm-tree silhouette: a curved trunk and a crown of fronds. */
function drawPalm(ctx, x, baseY, s) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(s, s);
  ctx.strokeStyle = '#160826';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -28, 14, -52);
  ctx.stroke();
  ctx.fillStyle = '#160826';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (i / 6) * 0.84);
    const tx = 14 + Math.cos(a) * 30;
    const ty = -52 + Math.sin(a) * 14 - 8;
    ctx.beginPath();
    ctx.moveTo(14, -52);
    ctx.quadraticCurveTo(14 + Math.cos(a) * 18, -52 + Math.sin(a) * 6 - 6, tx, ty);
    ctx.quadraticCurveTo(14 + Math.cos(a) * 14, -52 + Math.sin(a) * 6 + 2, 14, -52);
    ctx.fill();
  }
  ctx.restore();
}

/** City skyline silhouette along the bottom of the band: black buildings with a few
 *  lit windows, plus palm trees at the ends. Deterministic (fixed seed). */
function drawSkyline(ctx, x, y, w, h) {
  const rand = rng(20261119);
  ctx.save();
  ctx.fillStyle = '#160826';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + rand() * 0.09);
    const bh = h * (0.35 + rand() * 0.65);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // A rooftop antenna on some buildings.
    if (rand() < 0.3) ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.16, 2, h * 0.16);
    bx += bw + w * 0.008;
  }
  // Lit windows: a sparse scatter of small gold rectangles on the buildings.
  ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
  const rand2 = rng(77);
  for (let i = 0; i < Math.floor(w / 22); i++) {
    const wx = x + rand2() * w;
    const wy = y + h * 0.25 + rand2() * h * 0.6;
    ctx.fillRect(wx, wy, Math.max(2, w * 0.004), Math.max(2, h * 0.05));
  }
  // Palms at both ends of the skyline.
  const s = h * 0.011;
  drawPalm(ctx, x + w * 0.03, y + h, s);
  drawPalm(ctx, x + w * 0.97, y + h, s);
  ctx.restore();
}

/** Yellow starburst badge with a short label, centred at (cx, cy). */
function drawStarburst(ctx, cx, cy, r, text) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.beginPath();
  const points = 12;
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = r * 0.12;
  ctx.shadowOffsetY = r * 0.04;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#160826';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.stroke();
  ctx.fillStyle = '#160826';
  ctx.font = `700 ${Math.max(10, r * 0.24)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Small pink circular "NEW" badge. */
function drawNewBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = r * 0.15;
  ctx.shadowOffsetY = r * 0.05;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.max(10, r * 0.5)}px Oswald, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW', 0, 0);
  ctx.restore();
}

/** Draws `state` onto the canvas at the canvas's own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const { photos, layout, grade, caption, subtitle, band, badges } = state;
  const g = GRADES[grade] || GRADES.sunset;
  const bandOn = !!band;
  const bandH = bandOn ? h * 0.26 : 0;
  const bandY = h - bandH;

  ctx.fillStyle = '#160826';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(w, h, layout, bandOn);
  for (let i = 0; i < rects.length; i++) {
    const photo = photos[i] || { img: null, zoom: 1, ox: 0, oy: 0 };
    drawPhotoInPanel(ctx, rects[i], photo);
    gradePanel(ctx, rects[i], grade);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.003);
    ctx.strokeRect(rects[i].x + 1, rects[i].y + 1, rects[i].w - 2, rects[i].h - 2);
  }

  // Vignette over the panel area only.
  const panelH = bandOn ? bandY : h;
  const vig = ctx.createRadialGradient(w / 2, panelH / 2, Math.min(w, panelH) * 0.35, w / 2, panelH / 2, Math.max(w, panelH) * 0.75);
  vig.addColorStop(0, 'rgba(10, 4, 18, 0)');
  vig.addColorStop(1, 'rgba(10, 4, 18, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, panelH);

  const text = (caption || '').trim().toUpperCase();
  const sub = (subtitle || '').trim().toUpperCase();

  if (bandOn) {
    // Full-width title band: gradient, skyline at its foot, lettering above it.
    const grad = ctx.createLinearGradient(0, bandY, 0, h);
    grad.addColorStop(0, g.bandA);
    grad.addColorStop(1, g.bandB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, w, bandH);
    // A soft sun-glow behind the lettering.
    const sun = ctx.createRadialGradient(w / 2, bandY + bandH * 0.45, 0, w / 2, bandY + bandH * 0.45, w * 0.4);
    sun.addColorStop(0, 'rgba(255, 255, 255, 0.20)');
    sun.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, bandY, w, bandH);
    drawSkyline(ctx, 0, bandY + bandH * 0.68, w, bandH * 0.32);

    if (sub) {
      const subSize = Math.max(11, bandH * 0.13);
      ctx.font = `600 ${subSize}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffe9a8';
      try { ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`; } catch { /* older canvas */ }
      ctx.fillText(sub, w / 2, bandY + bandH * 0.20);
      try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
    }
    if (text) {
      const size = captionSize(ctx, text, w * 0.92, bandH * 0.36);
      ctx.save();
      ctx.translate(w / 2, bandY + bandH * 0.70);
      ctx.rotate(-0.02);
      ctx.font = `${size}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#160826';
      ctx.lineWidth = size * 0.16;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = size * 0.10;
      ctx.shadowOffsetY = size * 0.03;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  } else {
    // Bottom scrim so the lettering stays readable over any photo.
    const scrim = ctx.createLinearGradient(0, h * 0.68, 0, h);
    scrim.addColorStop(0, 'rgba(12, 4, 22, 0)');
    scrim.addColorStop(1, 'rgba(12, 4, 22, 0.72)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    if (sub) {
      const subSize = Math.max(12, h * 0.030);
      ctx.font = `600 ${subSize}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffd166';
      try { ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`; } catch { /* older canvas */ }
      ctx.fillText(sub, w / 2, h * 0.795);
      try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
    }
    if (text) {
      const size = captionSize(ctx, text, w * 0.92, h * 0.115);
      const barW = Math.min(w * 0.92, ctx.measureText(text).width * 1.04);
      const barH = Math.max(4, h * 0.011);
      const bar = ctx.createLinearGradient(w / 2 - barW / 2, 0, w / 2 + barW / 2, 0);
      bar.addColorStop(0, '#ff5e8a');
      bar.addColorStop(0.5, '#ff9a3d');
      bar.addColorStop(1, '#ffd166');
      ctx.fillStyle = bar;
      ctx.fillRect(w / 2 - barW / 2, h * 0.815, barW, barH);

      ctx.save();
      ctx.translate(w / 2, h * 0.945);
      ctx.rotate(-0.02);
      ctx.font = `${size}px Anton, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#160826';
      ctx.lineWidth = size * 0.16;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = size * 0.10;
      ctx.shadowOffsetY = size * 0.03;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  // Badges, drawn last so they sit on top of the panels.
  if (badges) {
    const hero = rects[0];
    const last = rects[rects.length - 1];
    const starR = Math.max(18, Math.min(w, h) * 0.045);
    // Starburst at the hero panel's top-right corner (overlapping into the next panel).
    drawStarburst(ctx, hero.x + hero.w - starR * 0.15, hero.y + starR * 1.05, starR, 'EST. 2026');
    // NEW badge at the last panel's bottom-right corner.
    const newR = Math.max(16, Math.min(w, h) * 0.032);
    drawNewBadge(ctx, last.x + last.w - newR * 1.15, last.y + last.h - newR * 1.15, newR);
  }
}
