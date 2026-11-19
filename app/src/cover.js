// Vice City Cover Maker — the drawing engine.
// Draws a GTA-style multi-panel cover onto any canvas: photo panels, a colour
// grade, a bottom title band with a code-drawn skyline, and toggleable badges.
// Everything here is drawn with canvas paths and gradients; no image is ever
// fetched from the network, so the app works fully offline.

export const GRADES = [
  {
    id: 'leonida',
    name: 'Leonida Heat',
    filter: 'saturate(1.28) contrast(1.06) sepia(0.16)',
    overlay: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255, 122, 26, 0.20)');
      g.addColorStop(0.55, 'rgba(255, 64, 110, 0.10)');
      g.addColorStop(1, 'rgba(120, 40, 160, 0.16)');
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'neon',
    name: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.16)',
    overlay: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255, 0, 160, 0.22)');
      g.addColorStop(0.5, 'rgba(90, 0, 255, 0.10)');
      g.addColorStop(1, 'rgba(0, 220, 255, 0.18)');
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'teal',
    name: 'Teal & Orange',
    filter: 'saturate(1.18) contrast(1.12)',
    overlay: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(0, 150, 160, 0.20)');
      g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      g.addColorStop(1, 'rgba(255, 140, 40, 0.20)');
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'gold',
    name: 'Gold Noir',
    filter: 'grayscale(0.55) contrast(1.28) brightness(1.06)',
    overlay: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255, 200, 80, 0.16)');
      g.addColorStop(1, 'rgba(20, 12, 0, 0.22)');
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
];

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

// A small deterministic random generator so the skyline is the same on every
// render of the same cover.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Panel layouts. Each returns the panel rectangles (fractions of the cover)
// for a cover of width W and height H. Panels are numbered in reading order.
export const LAYOUTS = [
  {
    id: 'neon',
    name: 'Neon Grid',
    panels(W, H) {
      // One large hero on the left, and a 2-by-2 grid of four panels on
      // the right: five panels in all, none overlapping.
      const g = Math.round(Math.min(W, H) * 0.012);
      const heroW = Math.round(W * 0.56);
      const sideX = heroW + g;
      const sideW = W - sideX;
      const cellW = Math.round((sideW - g) / 2);
      const halfH = Math.round((H - g) / 2);
      const cellH = H - halfH - g;
      return [
        { x: 0, y: 0, w: heroW, h: H },
        { x: sideX, y: 0, w: cellW, h: halfH },
        { x: sideX + cellW + g, y: 0, w: sideW - cellW - g, h: halfH },
        { x: sideX, y: halfH + g, w: cellW, h: cellH },
        { x: sideX + cellW + g, y: halfH + g, w: sideW - cellW - g, h: cellH },
      ];
    },
  },
  {
    id: 'hero',
    name: 'Hero',
    panels(W, H) {
      return [{ x: 0, y: 0, w: W, h: H }];
    },
  },
  {
    id: 'split',
    name: 'Split',
    panels(W, H) {
      const g = Math.round(Math.min(W, H) * 0.012);
      const w = Math.round((W - g) / 2);
      return [
        { x: 0, y: 0, w, h: H },
        { x: w + g, y: 0, w: W - w - g, h: H },
      ];
    },
  },
  {
    id: 'strip',
    name: 'Strip',
    panels(W, H) {
      const g = Math.round(Math.min(W, H) * 0.012);
      const h1 = Math.round(H * 0.38);
      const h2 = Math.round(H * 0.34);
      return [
        { x: 0, y: 0, w: W, h: h1 },
        { x: 0, y: h1 + g, w: W, h: h2 },
        { x: 0, y: h1 + h2 + 2 * g, w: W, h: H - h1 - h2 - 2 * g },
      ];
    },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

// Draw one photo into a panel rect, cover-fitting it, then applying the
// slot's pan (ox, oy in -0.5..0.5) and zoom (>= 1). The grade's filter is
// applied while the photo is drawn.
export function drawPhotoPanel(ctx, img, rect, slot, grade) {
  if (!img || !img.naturalWidth) return;
  const { x, y, w, h } = rect;
  const zoom = Math.max(1, slot?.zoom || 1);
  const ox = slot?.ox || 0;
  const oy = slot?.oy || 0;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2 + ox * w * 0.4;
  const dy = y + (h - dh) / 2 + oy * h * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = grade?.filter || 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // a soft dark edge so panels read as separate plates
  const edge = ctx.createLinearGradient(x, y, x, y + h);
  edge.addColorStop(0, 'rgba(0,0,0,0.18)');
  edge.addColorStop(0.12, 'rgba(0,0,0,0)');
  edge.addColorStop(0.88, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// A Vice City skyline: buildings of varying heights with lit windows,
// drawn over a sunset glow. Deterministic for a given seed.
export function drawSkyline(ctx, x, y, w, h, seed) {
  const rnd = mulberry32(seed);
  // horizon glow
  const glow = ctx.createRadialGradient(x + w * 0.5, y + h, 0, x + w * 0.5, y + h, w * 0.7);
  glow.addColorStop(0, 'rgba(255, 140, 60, 0.55)');
  glow.addColorStop(0.5, 'rgba(255, 80, 140, 0.25)');
  glow.addColorStop(1, 'rgba(255, 80, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  // buildings, back row then front row
  for (let row = 0; row < 2; row++) {
    const baseY = y + h;
    const rowH = h * (row === 0 ? 0.55 : 0.85);
    let bx = x;
    ctx.fillStyle = row === 0 ? 'rgba(24, 10, 38, 0.85)' : 'rgba(10, 4, 20, 0.95)';
    while (bx < x + w) {
      const bw = w * (0.04 + rnd() * 0.07);
      const bh = rowH * (0.35 + rnd() * 0.65);
      const by = baseY - bh;
      ctx.fillRect(bx, by, bw, bh);
      // a few lit windows
      const cols = Math.max(1, Math.floor(bw / (w * 0.012)));
      const rows = Math.max(1, Math.floor(bh / (h * 0.09)));
      ctx.fillStyle = 'rgba(255, 214, 120, 0.9)';
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() < 0.28) {
            ctx.fillRect(
              bx + (w * 0.006) + c * (bw / cols),
              by + (h * 0.03) + r * (bh / rows),
              Math.max(1, w * 0.004),
              Math.max(1, h * 0.03),
            );
          }
        }
      }
      ctx.fillStyle = row === 0 ? 'rgba(24, 10, 38, 0.85)' : 'rgba(10, 4, 20, 0.95)';
      bx += bw + w * 0.004;
    }
  }
}

// A 12-point starburst badge with centred text.
export function drawStarburst(ctx, cx, cy, rOuter, text, sub) {
  const points = 12;
  const rInner = rOuter * 0.72;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd21f';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = rOuter * 0.18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, rOuter * 0.03);
  ctx.strokeStyle = '#7a4d00';
  ctx.stroke();
  ctx.fillStyle = '#241300';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(rOuter * 0.34)}px Oswald, sans-serif`;
  ctx.fillText(text, cx, cy - rOuter * 0.12);
  ctx.font = `600 ${Math.round(rOuter * 0.22)}px Oswald, sans-serif`;
  ctx.fillText(sub, cx, cy + rOuter * 0.24);
  ctx.restore();
}

// A round "NEW" badge.
export function drawNewBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = r * 0.2;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(r * 0.62)}px Anton, sans-serif`;
  ctx.fillText('NEW', cx, cy + r * 0.04);
  ctx.restore();
}

// Fit a caption to a width by shrinking the font until it fits.
export function fitFont(ctx, text, maxWidth, startPx, family, weight) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px = Math.round(px * 0.92);
  }
  return px;
}

// The main entry: draw a whole cover.
// opts: { photos, slots, layoutId, gradeId, caption, subtitle, band, starburst, newBadge, seed }
export function drawCover(canvas, opts) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const layout = layoutById(opts.layoutId);
  const grade = gradeById(opts.gradeId);
  const seed = opts.seed ?? 7;

  ctx.save();
  ctx.fillStyle = '#0b0616';
  ctx.fillRect(0, 0, W, H);

  // photo panels
  const rects = layout.panels(W, H);
  const bandH = opts.band === false ? 0 : Math.round(H * 0.26);
  const photoH = H - bandH;
  const photoRects = layout.panels(W, photoH);
  photoRects.forEach((rect, i) => {
    const slot = (opts.slots && opts.slots[i]) || {};
    const img = slot.img || (opts.photos && opts.photos[i]) || null;
    drawPhotoPanel(ctx, img, rect, slot, grade);
  });

  // whole-cover grade wash to unify the panels
  grade.overlay(ctx, W, photoH);

  // thin neon frame lines between panels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = Math.max(1, Math.round(Math.min(W, H) * 0.004));
  photoRects.forEach((r) => ctx.strokeRect(r.x, r.y, r.w, r.h));

  // bottom title band
  if (bandH > 0) {
    const by = H - bandH;
    const bandGrad = ctx.createLinearGradient(0, by, 0, H);
    bandGrad.addColorStop(0, 'rgba(20, 6, 40, 0.0)');
    bandGrad.addColorStop(0.25, 'rgba(20, 6, 40, 0.88)');
    bandGrad.addColorStop(1, 'rgba(8, 2, 18, 0.98)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, by, W, bandH);
    drawSkyline(ctx, 0, by + bandH * 0.08, W, bandH * 0.62, seed);
    // gold subtitle
    const sub = (opts.subtitle || 'VICE CITY').toUpperCase();
    const subPx = Math.round(bandH * 0.14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${subPx}px Oswald, sans-serif`;
    const subW = ctx.measureText(sub).width;
    const subY = by + bandH * 0.42;
    ctx.fillStyle = '#f5c542';
    ctx.fillText(sub, W / 2, subY);
    // gold rules either side of the subtitle
    const ruleY = subY - subPx * 0.32;
    const ruleW = Math.min(W * 0.18, (W - subW) / 2 - W * 0.04);
    ctx.fillRect(W / 2 - subW / 2 - W * 0.04 - ruleW, ruleY, ruleW, Math.max(1, bandH * 0.012));
    ctx.fillRect(W / 2 + subW / 2 + W * 0.04, ruleY, ruleW, Math.max(1, bandH * 0.012));
    // big caption
    const caption = (opts.caption || 'VICE CITY').toUpperCase();
    const capPx = fitFont(ctx, caption, W * 0.92, Math.round(bandH * 0.42), 'Anton, sans-serif', '400');
    ctx.font = `${capPx}px Anton, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 60, 140, 0.55)';
    ctx.shadowBlur = bandH * 0.08;
    ctx.fillText(caption, W / 2, by + bandH * 0.88);
    ctx.shadowBlur = 0;
  }

  // badges
  const badgeR = Math.round(Math.min(W, H) * 0.055);
  if (opts.starburst !== false) {
    drawStarburst(ctx, W - badgeR * 1.25, badgeR * 1.35, badgeR, 'EST.', '2026');
  }
  if (opts.newBadge !== false) {
    drawNewBadge(ctx, W - badgeR * 1.25, badgeR * 1.35 + badgeR * 2.3, badgeR * 0.78);
  }

  ctx.restore();
  return canvas;
}
