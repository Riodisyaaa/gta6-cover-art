// Preset covers shipped with Vice City Cover Maker. Every preset uses the
// same hero photo — a dark-green classic 1970s American sedan speeding down a
// palm-lined Vice City street at sunset, chased by a blue-and-white police
// helicopter — and pairs it with the other sample photos.

export const SAMPLES = [
  'samples/car.jpg',
  'samples/street.jpg',
  'samples/portrait.jpg',
  'samples/pier.jpg',
  'samples/boulevard.jpg',
];

export const PRESETS = [
  {
    id: 'neon-pursuit',
    name: 'NEON PURSUIT',
    subtitle: 'VICE CITY',
    layoutId: 'neon',
    gradeId: 'leonida',
    size: [1920, 1080],
    // hero car, then street, portrait, pier, boulevard
    slotPhotos: [0, 1, 2, 3, 4],
    seed: 11,
  },
  {
    id: 'sunset-heist',
    name: 'SUNSET HEIST',
    subtitle: 'VICE CITY',
    layoutId: 'neon',
    gradeId: 'neon',
    size: [1080, 1080],
    slotPhotos: [0, 4, 2, 1, 3],
    seed: 23,
  },
  {
    id: 'boulevard-queen',
    name: 'BOULEVARD QUEEN',
    subtitle: 'OCEAN DRIVE',
    layoutId: 'strip',
    gradeId: 'teal',
    size: [1080, 1350],
    slotPhotos: [0, 1, 2, 3, 4],
    // pan the hero car down inside its wide top band so the police
    // helicopter at the top of the photo stays in frame
    slotOffsets: [{ ox: 0, oy: 0.5 }],
    seed: 37,
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

// Load an image file from app/ (same origin, offline-safe).
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('cannot load ' + src));
    img.src = src;
  });
}

// Load all sample photos, in SAMPLES order.
export async function loadSamples() {
  return Promise.all(SAMPLES.map((s) => loadImage(s)));
}

// Build the drawCover options for a preset, given loaded sample images.
export function presetOptions(preset, images) {
  const slots = preset.slotPhotos.map((photoIndex, i) => {
    const off = (preset.slotOffsets && preset.slotOffsets[i]) || {};
    return {
      img: images[photoIndex] || null,
      ox: off.ox || 0,
      oy: off.oy || 0,
      zoom: 1,
    };
  });
  return {
    photos: images,
    slots,
    layoutId: preset.layoutId,
    gradeId: preset.gradeId,
    caption: preset.name,
    subtitle: preset.subtitle,
    band: true,
    starburst: true,
    newBadge: true,
    seed: preset.seed,
  };
}
