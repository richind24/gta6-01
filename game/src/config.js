// Solara Bay — shared constants, tuning and small helpers.
// Everything the other modules need to agree on lives here so a single
// number (block size, walk speed, wanted thresholds) can be tuned once.

export const WORLD = {
  blocks: 8, // city grid is blocks x blocks
  block: 64, // building block side, in metres
  road: 16, // road width between blocks
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * this.pitch) / 2; },
  waterLevel: 0.4,
};

// Seeded RNG so the city layout is the same on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const PALETTE = {
  sky: 0x79c7f2,
  sun: 0xfff2c8,
  sand: 0xf2d8a0,
  sea: 0x1fa8c9,
  seaDeep: 0x0e7fa8,
  grass: 0x7ec850,
  asphalt: 0x3a3f46,
  asphaltLine: 0xf5d90a,
  sidewalk: 0xb9b3a4,
  building: [0xe8b04b, 0xd96a4f, 0x5b8fd6, 0x7fb069, 0xc96a9b, 0x8a6fc0, 0xe0e0e0, 0xf2f2f2],
  glass: 0x9fd8ff,
  palm: 0x2f9e44,
  trunk: 0x8a6a3b,
};

// Arcade tuning. Speeds are metres per second.
export const TUNE = {
  walkSpeed: 6,
  runSpeed: 10,
  playerRadius: 0.9,
  carAccel: 22,
  carBrake: 40,
  carMaxSpeed: 42,
  carReverseMax: 12,
  carTurn: 1.9,
  trafficSpeed: 11,
  policeSpeed: 46,
  heliHeight: 22,
  heliSpeed: 26,
  pedSpeed: 2.2,
  wantedDecaySeconds: 14,
  bulletRange: 46,
  bulletDamage: 34,
};

export const RADIO = [
  { name: 'SOLARA FM', tag: 'SOLARA FM 101.1 — Sunny Pop', color: '#ff9f1c', bpm: 112 },
  { name: 'BAY BEATS', tag: 'BAY BEATS 98.7 — Bass & Bounce', color: '#2ec4b6', bpm: 96 },
  { name: 'NEON NIGHTS', tag: 'NEON NIGHTS 104.5 — Synthwave', color: '#e71d73', bpm: 88 },
];

export const DISTRICTS = [
  { name: 'Downtown Solara', x0: -320, z0: -320, x1: 40, z1: -40 },
  { name: 'El Barrio', x0: -320, z0: -40, x1: 40, z1: 320 },
  { name: 'Marina Bay', x0: 40, z0: 120, x1: 320, z1: 320 },
  { name: 'Solara Beach', x0: 200, z0: -320, x1: 320, z1: 120 },
  { name: 'Harbour South', x0: 40, z0: 240, x1: 320, z1: 320 },
  { name: 'Palm Heights', x0: 40, z0: -320, x1: 200, z1: 120 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solara Bay';
}

// Where the story lives.
export const LANDMARKS = {
  safehouse: { x: -96, z: 96, label: 'Safehouse — Casa Juno' },
  garage: { x: -32, z: 160, label: 'Neon Garage' },
  marina: { x: 224, z: 224, label: 'Marina Bay' },
  gunshop: { x: -160, z: -32, label: 'Solara Arms' },
  burger: { x: 96, z: -96, label: 'Tide Burger' },
  hospital: { x: -224, z: -160, label: 'Solara General' },
  policeHQ: { x: 32, z: -224, label: 'Solara PD HQ' },
  harbour: { x: 160, z: 288, label: 'Harbour Docks' },
  beach: { x: 272, z: 0, label: 'Solara Beach' },
  arena: { x: -32, z: -96, label: 'Bay Arena' },
};
