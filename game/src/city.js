// Solara Bay — the city itself: ground, roads, beach, water, buildings,
// palms, parks and the glowing landmark beacons. All geometry is procedural.
import * as THREE from 'three';
import { WORLD, PALETTE, PLACES } from './config.js';

const BUILDING_COLORS = [
  0xfff3dd, 0xffd9a0, 0xf2a65e, 0x7fd4c1, 0x4fa8c9, 0xe87a7a,
  0xf7e6c4, 0x9ecfff, 0xc9b8ff, 0xffc46b, 0x8fd0a0, 0xf5f0e6,
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groundTexture() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const px = (x) => ((x + WORLD.half) / WORLD.size) * S;
  const pw = (w) => (w / WORLD.size) * S;

  g.fillStyle = '#79c94f';
  g.fillRect(0, 0, S, S);
  // Beach and water on the east edge.
  g.fillStyle = '#f2d492';
  g.fillRect(px(WORLD.beachX), 0, S - px(WORLD.beachX), S);
  g.fillStyle = '#2fa8d8';
  g.fillRect(px(WORLD.waterX), 0, S - px(WORLD.waterX), S);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const y = ((i * 97) % S);
    g.beginPath();
    g.moveTo(px(WORLD.waterX) + 8, y);
    g.quadraticCurveTo(px(WORLD.waterX) + 34, y + 12, px(WORLD.waterX) + 66, y + 2);
    g.stroke();
  }
  // Parks.
  g.fillStyle = '#58b368';
  const parks = [[-100, -60], [60, -100], [-60, 100], [100, 60]];
  for (const [x, z] of parks) g.fillRect(px(x - 18), px(z - 18), pw(36), pw(36));
  // Liberty Plaza in the middle.
  g.fillStyle = '#b8c4cc';
  g.beginPath();
  g.arc(px(0), px(0), pw(26), 0, Math.PI * 2);
  g.fill();
  // Roads: dark bands on every grid line, with dashes.
  g.fillStyle = '#3a3f4a';
  for (let c = -180; c <= 180; c += 40) {
    g.fillRect(px(c - WORLD.roadHalf), 0, pw(WORLD.roadHalf * 2), S);
    g.fillRect(0, px(c - WORLD.roadHalf), S, pw(WORLD.roadHalf * 2));
  }
  g.fillStyle = '#cfc8b8';
  for (let c = -180; c <= 180; c += 40) {
    g.fillRect(px(c - WORLD.roadHalf - 2), 0, pw(2), S);
    g.fillRect(px(c + WORLD.roadHalf), 0, pw(2), S);
    g.fillRect(0, px(c - WORLD.roadHalf - 2), S, pw(2));
    g.fillRect(0, px(c + WORLD.roadHalf), S, pw(2));
  }
  g.fillStyle = '#f7d54d';
  for (let c = -180; c <= 180; c += 40) {
    for (let d = -200; d < 200; d += 16) {
      g.fillRect(px(c) - 1, px(d), 2, pw(6));
      g.fillRect(px(d), px(c) - 1, pw(6), 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeLabel(text) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(10,20,40,0.72)';
  g.beginPath();
  g.roundRect(6, 10, 500, 76, 18);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = 'bold 40px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
  sprite.scale.set(16, 3, 1);
  return sprite;
}

export function buildCity(scene, state) {
  const rand = mulberry32(20261119);
  const group = new THREE.Group();
  scene.add(group);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Shimmering water sheet above the east edge.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half - WORLD.waterX, WORLD.size),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((WORLD.waterX + WORLD.half) / 2, 0.15, 0);
  group.add(water);

  // Buildings, one or two per block, taller toward downtown.
  const parkCells = new Set(['-100,-60', '60,-100', '-60,100', '100,60']);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
  for (let bx = -160; bx <= 120; bx += 40) {
    for (let bz = -160; bz <= 160; bz += 40) {
      if (bx === 0 && bz === 0) continue; // plaza
      if (parkCells.has(`${bx},${bz}`)) continue;
      const count = rand() < 0.45 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = 13 + rand() * 11;
        const d = 13 + rand() * 11;
        const dist = Math.hypot(bx, bz);
        const h = Math.min(24, 8 + rand() * 10 + Math.max(0, 20 - dist * 0.09) * (0.4 + rand() * 0.6));
        const ox = count === 2 ? (i === 0 ? -7 : 7) : 0;
        const oz = count === 2 ? (i === 0 ? 5 : -5) : 0;
        const color = BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)];
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(boxGeo, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(bx + ox, h / 2, bz + oz);
        group.add(mesh);
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x2f3542 }));
        roof.scale.set(w * 0.92, 1, d * 0.92);
        roof.position.set(bx + ox, h + 0.3, bz + oz);
        group.add(roof);
        state.buildings.push({
          minX: bx + ox - w / 2, maxX: bx + ox + w / 2,
          minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2, h,
        });
      }
    }
  }

  // Palm trees along the beach, shade trees in the parks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 6, 6);
  const crownGeo = new THREE.SphereGeometry(2.6, 8, 6);
  function tree(x, z, s = 1) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3 * s, z);
    trunk.scale.setScalar(s);
    group.add(trunk);
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.scale.set(1.4 * s, 0.7 * s, 1.4 * s);
    crown.position.set(x, 6.4 * s, z);
    group.add(crown);
  }
  for (let z = -190; z <= 190; z += 24) tree(168, z + (rand() - 0.5) * 8, 0.9 + rand() * 0.5);
  for (const [x, z] of [[-100, -60], [60, -100], [-60, 100], [100, 60]]) {
    for (let i = 0; i < 5; i++) tree(x + (rand() - 0.5) * 30, z + (rand() - 0.5) * 30, 0.8 + rand() * 0.5);
  }

  // Landmark beacons: light pillar, ground ring and a floating name label.
  const beacons = [];
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.4, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.set(p.x, 17, p.z);
    group.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 4.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.12, p.z);
    group.add(ring);
    const label = makeLabel(p.label);
    label.position.set(p.x, 10, p.z);
    group.add(label);
    beacons.push({ pillar, ring, label, baseY: 10 });
  }

  return {
    update(dt, t) {
      const pulse = 0.22 + 0.1 * Math.sin(t * 2.4);
      for (const b of beacons) {
        b.pillar.material.opacity = pulse;
        b.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 2.4));
        b.label.position.y = b.baseY + Math.sin(t * 1.6) * 0.5;
      }
      water.material.opacity = 0.3 + 0.08 * Math.sin(t * 0.9);
    },
  };
}

// Circle-vs-building collision. Returns a corrected {x, z} and whether it hit.
export function collideBuildings(state, x, z, radius) {
  let hit = false;
  for (const b of state.buildings) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        x += radius;
      }
    }
  }
  return { x, z, hit };
}

export function clampToLand(state, x, z, isBoat) {
  const m = WORLD.half - 4;
  x = Math.max(-m, Math.min(m, x));
  z = Math.max(-m, Math.min(m, z));
  if (!isBoat && x > WORLD.waterX - 3) x = WORLD.waterX - 3;
  if (isBoat && x < WORLD.waterX - 6) x = WORLD.waterX - 6;
  return { x, z };
}
