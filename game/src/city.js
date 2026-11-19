// Solara Bay — the city itself: ground, roads, buildings, beach, harbour,
// palms, props and collision. All geometry is procedural (no model files),
// the layout is seeded so every load shows the same Solara Bay.

import * as THREE from 'three';
import { WORLD, PALETTE, mulberry32, LANDMARKS } from './config.js';

const PITCH = WORLD.pitch; // 80
const HALF = WORLD.half; // 320
const ROAD_CENTERS = [-328, -248, -168, -88, -8, 72, 152, 232, 328];

function hexColor(h) { return '#' + h.toString(16).padStart(6, '0'); }

function groundTexture() {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (x) => ((x + 700) / 1400) * S;
  const wPx = (w) => (w / 1400) * S;
  // Base: sun-baked grass.
  g.fillStyle = '#79bd4e'; g.fillRect(0, 0, S, S);
  // Beach sand on the east strip.
  g.fillStyle = '#f2d8a0';
  g.fillRect(toPx(256), 0, S - toPx(256), S);
  // Harbour concrete on the south strip.
  g.fillStyle = '#9aa0a8';
  g.fillRect(0, toPx(256), S, S - toPx(256));
  // City asphalt: full square, then sidewalks drawn over it per block.
  g.fillStyle = '#3a3f46';
  g.fillRect(toPx(-336), toPx(-336), wPx(672), wPx(672));
  // Sidewalk slabs per block.
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const x0 = -HALF + i * PITCH, z0 = -HALF + j * PITCH;
      g.fillStyle = '#b9b3a4';
      g.fillRect(toPx(x0), toPx(z0), wPx(WORLD.block), wPx(WORLD.block));
      // Block inner lawn / plaza tint.
      g.fillStyle = (i + j) % 3 === 0 ? '#8fce62' : '#a8a28f';
      g.fillRect(toPx(x0 + 6), toPx(z0 + 6), wPx(WORLD.block - 12), wPx(WORLD.block - 12));
    }
  }
  // Centre dashes on every road.
  g.fillStyle = '#f5d90a';
  for (const c of ROAD_CENTERS) {
    for (let d = -320; d < 320; d += 24) {
      g.fillRect(toPx(c) - 2, toPx(d), 4, wPx(10));
      g.fillRect(toPx(d), toPx(c) - 2, wPx(10), 4);
    }
  }
  // Crosswalk stripes at intersections.
  g.fillStyle = '#e8e8e8';
  for (const cx of ROAD_CENTERS) {
    for (const cz of ROAD_CENTERS) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(toPx(cx + k * 3.4) - 1, toPx(cz - 9), 2, wPx(5));
        g.fillRect(toPx(cx + k * 3.4) - 1, toPx(cz + 4), 2, wPx(5));
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function facadeTexture(base, floors, cols, rng) {
  const W = 128, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // Slight vertical shade so towers read from above.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? '#ffe9a8' : '#1d2f45';
      g.fillRect(10 + c * ((W - 20) / cols), 12 + f * ((H - 24) / floors), (W - 20) / cols - 6, (H - 24) / floors - 8);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBeacon(color = 0xffd23f) {
  const grp = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.1, 32),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  grp.add(ring);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 5;
  grp.add(gem);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  grp.add(beam);
  grp.userData.spin = gem;
  return grp;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.rng = mulberry32(20261119);
    this.beacons = [];
    this.water = null;
    this.build();
  }

  build() {
    const rng = this.rng;
    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshLambertMaterial({ map: groundTexture() }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.scene.add(ground);
    // Sea, east and south of the city.
    const seaMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
    const seaE = new THREE.Mesh(new THREE.PlaneGeometry(700, 1400), seaMat);
    seaE.rotation.x = -Math.PI / 2;
    seaE.position.set(320 + 350, WORLD.waterLevel, 0);
    this.scene.add(seaE);
    const seaS = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), seaMat);
    seaS.rotation.x = -Math.PI / 2;
    seaS.position.set(0, WORLD.waterLevel, 320 + 350);
    this.scene.add(seaS);
    this.water = [seaE, seaS];

    // Buildings, one or two towers per block.
    const downtown = (x, z) => Math.abs(x) < 120 && Math.abs(z) < 120;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const bx = -HALF + i * PITCH, bz = -HALF + j * PITCH;
        const cx = bx + WORLD.block / 2, cz = bz + WORLD.block / 2;
        if (cx > 224) continue; // beach: no buildings
        if (cz > 224 && cx > 96) continue; // harbour yards
        const nearLandmark = Object.values(LANDMARKS).some(
          (L) => Math.abs(L.x - cx) < 46 && Math.abs(L.z - cz) < 46,
        );
        if (nearLandmark) {
          this._house(cx, cz, rng);
          continue;
        }
        const towers = downtown(cx, cz) ? 2 : 1;
        for (let t = 0; t < towers; t++) {
          const w = 16 + rng() * 16, d = 16 + rng() * 16;
          const h = downtown(cx, cz) ? 22 + rng() * 34 : 8 + rng() * 14;
          const ox = t === 0 ? -12 : 12, oz = t === 0 ? -10 : 12;
          const color = PALETTE.building[Math.floor(rng() * PALETTE.building.length)];
          const tex = facadeTexture(hexColor(color), Math.max(3, Math.round(h / 5)), 5, rng);
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshLambertMaterial({ map: tex }),
          );
          m.position.set(cx + ox, h / 2, cz + oz);
          this.scene.add(m);
          this.colliders.push({ x: cx + ox, z: cz + oz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
          // Rooftop box.
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(4, 2, 4),
            new THREE.MeshLambertMaterial({ color: 0x666666 }),
          );
          roof.position.set(cx + ox + w / 4, h + 1, cz + oz);
          this.scene.add(roof);
        }
      }
    }

    // Landmark houses / shops: small bright buildings with a sign colour.
    this._landmarkBuilding(LANDMARKS.safehouse, 0xffd23f, 14, 10, 7);
    this._landmarkBuilding(LANDMARKS.garage, 0x2ec4b6, 20, 12, 6);
    this._landmarkBuilding(LANDMARKS.gunshop, 0xd90429, 12, 10, 6);
    this._landmarkBuilding(LANDMARKS.burger, 0xff6d00, 12, 10, 6);
    this._landmarkBuilding(LANDMARKS.hospital, 0xffffff, 22, 14, 12);
    this._landmarkBuilding(LANDMARKS.policeHQ, 0x1d3557, 18, 14, 10);
    this._landmarkBuilding(LANDMARKS.marina, 0x118ab2, 16, 12, 6);

    // Palms along the beach and the main avenues.
    for (let z = -300; z <= 300; z += 28) this._palm(276 + rng() * 8, z + rng() * 8);
    for (let x = -300; x <= 220; x += 52) {
      if (rng() < 0.7) this._palm(x, -172 + rng() * 4);
      if (rng() < 0.7) this._palm(x, 236 + rng() * 4);
    }

    // Harbour: containers, cranes, docks and boats.
    for (let k = 0; k < 14; k++) {
      const cx = 120 + rng() * 170, cz = 252 + rng() * 46;
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(8, 3.4, 3.4),
        new THREE.MeshLambertMaterial({ color: [0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d][k % 4] }),
      );
      c.position.set(cx, 1.7, cz);
      c.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
      this.scene.add(c);
      this.colliders.push({ x: cx, z: cz, hx: 4.4, hz: 4.4 });
    }
    for (let k = 0; k < 3; k++) this._crane(150 + k * 70, 306);
    for (let k = 0; k < 4; k++) this._boat(330 + rng() * 60, -220 + k * 130 + rng() * 30);
    for (let k = 0; k < 5; k++) this._boat(360 + rng() * 80, 330 + k * 60);

    // Street lights on the main avenues.
    for (const c of [-248, -88, 72, 232]) {
      for (let d = -280; d <= 280; d += 80) {
        this._lamp(c + 6, d);
        this._lamp(d, c + 6);
      }
    }
  }

  _house(cx, cz, rng) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(16, 7, 12),
      new THREE.MeshLambertMaterial({ color: PALETTE.building[Math.floor(rng() * PALETTE.building.length)] }),
    );
    m.position.set(cx, 3.5, cz);
    this.scene.add(m);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(11, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0x8a3324 }),
    );
    roof.position.set(cx, 9, cz);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this.colliders.push({ x: cx, z: cz, hx: 8.4, hz: 6.4 });
  }

  _landmarkBuilding(L, color, w, d, h) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    m.position.set(L.x, h / 2, L.z);
    this.scene.add(m);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, 1.6, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    sign.position.set(L.x, h + 0.8, L.z - d / 2 - 0.4);
    this.scene.add(sign);
    this.colliders.push({ x: L.x, z: L.z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
  }

  _palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 7, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.trunk }),
    );
    trunk.position.y = 3.5;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 4.6, 4),
        new THREE.MeshLambertMaterial({ color: PALETTE.palm }),
      );
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.8, 7.4, Math.sin(a) * 1.8);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
  }

  _lamp(x, z) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x2b2b2b }),
    );
    pole.position.set(x, 3.5, z);
    this.scene.add(pole);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff6bf }),
    );
    bulb.position.set(x, 7.1, z);
    this.scene.add(bulb);
  }

  _crane(x, z) {
    const g = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf4a261 });
    for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), legMat);
      leg.position.set(lx, 11, lz);
      g.add(leg);
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 1.6), legMat);
    arm.position.set(4, 18, 0);
    g.add(arm);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    hook.position.set(12, 12, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.colliders.push({ x, z, hx: 4, hz: 4 });
  }

  _boat(x, z) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.4, 16),
      new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
    );
    hull.position.y = 1.2;
    g.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x118ab2 }),
    );
    cabin.position.set(0, 3.2, -1);
    g.add(cabin);
    g.position.set(x, WORLD.waterLevel, z);
    g.rotation.y = (Math.random() - 0.5) * 0.8;
    this.scene.add(g);
  }

  // Circle-vs-AABB collision. Returns the corrected position.
  resolveCircle(x, z, r) {
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const px = c.hx + r - Math.abs(dx);
      const pz = c.hz + r - Math.abs(dz);
      if (px > 0 && pz > 0) {
        if (px < pz) x = c.x + Math.sign(dx || 1) * (c.hx + r);
        else z = c.z + Math.sign(dz || 1) * (c.hz + r);
      }
    }
    return { x, z };
  }

  hitsBuilding(x, z, r) {
    return this.colliders.some((c) => Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r);
  }

  roadCenters() { return ROAD_CENTERS; }

  randomRoadPoint(rng) {
    const vertical = rng() < 0.5;
    const c = ROAD_CENTERS[Math.floor(rng() * ROAD_CENTERS.length)];
    const d = -300 + rng() * 600;
    return vertical ? { x: c, z: d } : { x: d, z: c };
  }

  update(dt, t) {
    for (const w of this.water) w.position.y = WORLD.waterLevel + Math.sin(t * 0.7) * 0.12;
    for (const b of this.beacons) {
      b.userData.spin.rotation.y += dt * 2.4;
      b.userData.spin.position.y = 5 + Math.sin(t * 2.2) * 0.7;
    }
  }
}
