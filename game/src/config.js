// Solara Bay — shared constants, helpers and the seeded RNG.
// All names, places and characters in this game are original fiction.

export const CITY = {
  blocks: 4,            // road lines at -4..4 (9 x 9 grid of roads)
  block: 64,            // distance between road centre lines
  roadW: 14,            // road width
  half: 4 * 64 + 32,    // playable half-extent (288)
  waterAt: -288,        // shoreline (south edge, -z side is the bay)
};

export const DAY_LENGTH = 480; // seconds of real time per in-game day
export const SAVE_KEY = 'solara-bay-save-v1';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const rand = (rng, a, b) => a + rng() * (b - a);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Road centre lines (both axes). Roads run along x at z = i*block and along z at x = i*block.
export const roadLines = () => {
  const lines = [];
  for (let i = -CITY.blocks; i <= CITY.blocks; i++) lines.push(i * CITY.block);
  return lines;
};

// Distance from a point to the nearest road centre line (either axis).
export function roadDistance(x, z) {
  const lines = roadLines();
  let best = Infinity;
  for (const l of lines) {
    best = Math.min(best, Math.abs(x - l), Math.abs(z - l));
  }
  return best;
}

export function onRoad(x, z) {
  return roadDistance(x, z) < CITY.roadW / 2 + 0.5;
}

// Nearest intersection to a point.
export function nearestIntersection(x, z) {
  const lines = roadLines();
  let bx = lines[0], bz = lines[0];
  for (const l of lines) { if (Math.abs(x - l) < Math.abs(x - bx)) bx = l; if (Math.abs(z - l) < Math.abs(z - bz)) bz = l; }
  return { x: bx, z: bz };
}
