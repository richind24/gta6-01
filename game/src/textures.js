// Procedural canvas textures: building facades, the ground map and the sky.
// Everything is generated at runtime — no image files, no network.

import { CITY, roadLines, mulberry32, rand, pick } from './config.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

const PALETTES = [
  ['#8a7f72', '#6f7d8c', '#a08b6d', '#7d7468'],
  ['#5d6b7a', '#94806a', '#7a6a72', '#66755f'],
  ['#b0a08a', '#8c8578', '#74655c', '#9a8f7a'],
];

// One facade texture: rows of windows, some lit (emissive map shares the same canvas).
export function buildingTexture(rng, litRatio) {
  const [c, g] = makeCanvas(128, 256);
  const base = pick(rng, pick(rng, PALETTES));
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 256);
  const cols = 5 + Math.floor(rng() * 3);
  const rows = 8 + Math.floor(rng() * 8);
  const cw = 128 / cols, ch = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#20262e';
      g.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.25, cw * 0.56, ch * 0.5);
      if (!lit && rng() < 0.4) { g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.25, cw * 0.56, ch * 0.18); }
    }
  }
  // ground-floor shopfront band
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 256 - ch * 0.9, 128, ch * 0.9);
  g.fillStyle = rng() < 0.5 ? '#3fa7a0' : '#c98a3a';
  g.fillRect(8, 256 - ch * 0.75, 112, ch * 0.45);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Ground texture for the whole city: blocks, roads with dashes, sidewalks, park, beach.
export function groundTexture() {
  const S = 2048, [c, g] = makeCanvas(S, S);
  const half = CITY.half + 40;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  // base: dry grass / dirt
  g.fillStyle = '#7d8a55'; g.fillRect(0, 0, S, S);
  // city blocks (concrete)
  g.fillStyle = '#9a9a92';
  const lines = roadLines();
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      g.fillRect(toPx(lines[i] + CITY.roadW / 2), toPx(lines[j] + CITY.roadW / 2),
        toPx(lines[i + 1] - CITY.roadW / 2) - toPx(lines[i] + CITY.roadW / 2),
        toPx(lines[j + 1] - CITY.roadW / 2) - toPx(lines[j] + CITY.roadW / 2));
    }
  }
  // central park block
  g.fillStyle = '#4d7a3d';
  g.fillRect(toPx(-CITY.block + CITY.roadW / 2), toPx(-CITY.block + CITY.roadW / 2), toPx(CITY.block - CITY.roadW / 2) - toPx(-CITY.block + CITY.roadW / 2), toPx(CITY.block - CITY.roadW / 2) - toPx(-CITY.block + CITY.roadW / 2));
  // beach strip along the south edge
  g.fillStyle = '#d9c48f';
  g.fillRect(0, toPx(CITY.waterAt + 8), S, toPx(CITY.half + 40) - toPx(CITY.waterAt + 8));
  // roads
  g.fillStyle = '#33363b';
  for (const l of lines) {
    g.fillRect(0, toPx(l - CITY.roadW / 2), S, toPx(l + CITY.roadW / 2) - toPx(l - CITY.roadW / 2));
    g.fillRect(toPx(l - CITY.roadW / 2), 0, toPx(l + CITY.roadW / 2) - toPx(l - CITY.roadW / 2), S);
  }
  // lane dashes
  g.fillStyle = '#e8d44d';
  const dash = 14, gap = 18;
  for (const l of lines) {
    for (let p = 0; p < S; p += dash + gap) {
      g.fillRect(p, toPx(l) - 2, dash, 4);
      g.fillRect(toPx(l) - 2, p, 4, dash);
    }
  }
  // crosswalks at intersections
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const lx of lines) for (const lz of lines) {
    for (let k = -2; k <= 2; k++) {
      g.fillRect(toPx(lx + k * 3) - 2, toPx(lz - CITY.roadW / 2), 4, CITY.roadW * 0.32 * (S / (half * 2)));
      g.fillRect(toPx(lx - CITY.roadW / 2), toPx(lz + k * 3) - 2, CITY.roadW * 0.32 * (S / (half * 2)), 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Soft radial glow sprite (street lights, markers, muzzle flash).
export function glowTexture() {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function makeRng(seed) { return mulberry32(seed); }
export { rand };
