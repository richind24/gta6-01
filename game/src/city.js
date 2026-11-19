// Solara Bay — city.js
// One clear job: build the whole city procedurally — ground, road grid,
// buildings, beach, marina, palms and shop fronts — and answer collision
// questions for everything that moves. Seeded, so every load is the same bay.
import * as THREE from 'three';
import { WORLD, SHOPS, SAFEHOUSE, mulberry32 } from './config.js';

export const STREETS = [-180, -120, -60, 0, 60, 120, 180];

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function signTexture(text, bg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSign(text, bg, w, x, y, z, ry) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: signTexture(text, bg) }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry || 0;
  return mesh;
}

// Circle (player / car) vs building boxes. Returns a corrected [x, z].
export function resolveCircle(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        x += radius;
      }
    }
  }
  return [x, z];
}

export function districtAt(x, z) {
  if (x > 150) return z > 60 ? 'Marina Bay' : 'Ocean Drive';
  if (x < -120 && z < -120) return 'Casa Alba';
  if (z < -120) return 'North Hills';
  if (Math.abs(x) < 90 && Math.abs(z) < 90) return 'Downtown';
  return 'Solara Bay';
}

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground: pale concrete base, sand strip on the east beach, water beyond.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 120, WORLD.half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: 0xb7c48d }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(30, WORLD.half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: 0xf2d492 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(205, 0.05, 0);
  group.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, WORLD.half * 2 + 200),
    new THREE.MeshLambertMaterial({ color: 0x1e90d6 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(316, 0.02, 0);
  group.add(water);

  // Road grid: dark asphalt strips + pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e });
  for (const s of STREETS) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.streetHalf * 2, WORLD.half * 2), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(s, 0.08, 0); group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.streetHalf * 2), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.08, s); group.add(h);
    for (let d = -195; d <= 195; d += 15) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(s, 0.1, d); group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.1, s); group.add(dash2);
    }
  }

  // Block dressing: pale sidewalk pads under the buildings plus bushes,
  // so no block reads as one flat empty lawn from the chase camera.
  const padMat = new THREE.MeshLambertMaterial({ color: 0xcfc8b4 });
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (const bx of [-150, -90, -30, 30, 90, 150]) {
    for (const bz of [-150, -90, -30, 30, 90, 150]) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(bx, 0.06, bz);
      group.add(pad);
      for (let b = 0; b < 4; b++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rng() * 1.2, 8, 6), bushMat);
        bush.position.set(bx + (rng() - 0.5) * 42, 1.2, bz + (rng() - 0.5) * 42);
        group.add(bush);
      }
    }
  }

  // Buildings: one or two per block, bright pastel walls, flat roofs.
  const palette = [0xffd9a0, 0xff9d76, 0x7ec8e3, 0xff8fa3, 0xa8e6a1, 0xc9b6ff, 0xffe066, 0xffffff, 0xffb703, 0x90e0d0];
  const blockCentres = [-150, -90, -30, 30, 90, 150];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      // Leave the plaza, the docks road and the safehouse garden open.
      if (bx === 30 && bz === -30) continue;
      if (bx === 150 && bz === 30) continue;
      const count = rng() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = 16 + rng() * 18;
        const d = 16 + rng() * 18;
        const h = 8 + rng() * rng() * 34;
        const ox = count === 1 ? 0 : (i === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (i === 0 ? -11 : 11);
        const x = bx + ox, z = bz + oz;
        const color = palette[Math.floor(rng() * palette.length)];
        const tower = box(w, h, d, color, x, h / 2, z);
        group.add(tower);
        const roof = box(w * 0.7, 1.2, d * 0.7, 0x8ba0b5, x, h + 0.6, z);
        group.add(roof);
        // Lit windows: small bright planes on the south face.
        const winMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
        const rows = Math.max(1, Math.floor(h / 7));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < 3; c++) {
            if (rng() < 0.45) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), winMat);
            win.position.set(x - w / 2 + 4 + c * (w - 8) / 2, 4 + r * 7, z + d / 2 + 0.06);
            group.add(win);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Beach palms along the sand strip.
  for (let z = -195; z <= 195; z += 14) {
    if (rng() < 0.3) continue;
    const x = 196 + rng() * 10;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.65, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2b }),
    );
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 3.8, 7),
      new THREE.MeshLambertMaterial({ color: 0x2fae5f }),
    );
    crown.position.set(x, 8.2, z);
    group.add(crown);
  }

  // Marina: wooden docks + moored boats on the south-east water edge.
  for (let i = 0; i < 4; i++) {
    const z = 60 + i * 40;
    const dock = box(26, 1, 5, 0x8a6b3d, 222, 0.5, z);
    group.add(dock);
    const hull = box(10, 2.4, 4, [0xffffff, 0xff6b35, 0x35c8ff, 0xffd23f][i], 238, 1.2, z + 4);
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 5),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    mast.position.set(238, 6, z + 4);
    group.add(mast);
  }

  // Shop fronts + safehouse: low coloured blocks with big signs.
  const fronts = [
    { shop: SHOPS.arms, sign: 'TIDE ARMS', bg: '#2b3a55' },
    { shop: SHOPS.burger, sign: 'BURGER BAY', bg: '#d94f30' },
    { shop: SHOPS.garage, sign: 'MARINA MOTORS', bg: '#1f7a5c' },
  ];
  for (const f of fronts) {
    const [x, z] = f.shop.pos;
    const hall = box(20, 7, 14, f.shop.color, x, 3.5, z);
    group.add(hall);
    group.add(makeSign(f.sign, f.bg, 18, x, 8.6, z + 7.2, 0));
    colliders.push({ minX: x - 10, maxX: x + 10, minZ: z - 7, maxZ: z + 7 });
  }
  const [hx, hz] = SAFEHOUSE.pos;
  const house = box(16, 6, 12, SAFEHOUSE.color, hx, 3, hz);
  group.add(house);
  group.add(makeSign('CASA ALBA — SAFEHOUSE', '#b8860b', 18, hx, 7.6, hz + 6.2, 0));
  colliders.push({ minX: hx - 8, maxX: hx + 8, minZ: hz - 6, maxZ: hz + 6 });

  // Hospital (respawn) + plaza fountain marker at the centre.
  const hosp = box(22, 10, 16, 0xffffff, -30, 5, -90);
  group.add(hosp);
  group.add(makeSign('SOLARA GENERAL', '#c0392b', 20, -30, 11.6, -90 + 8.2, 0));
  colliders.push({ minX: -41, maxX: -19, minZ: -98, maxZ: -82 });
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.6, 16),
    new THREE.MeshLambertMaterial({ color: 0x35c8ff }),
  );
  fountain.position.set(60, 0.8, -60);
  group.add(fountain);
  colliders.push({ minX: 52, maxX: 68, minZ: -68, maxZ: -52 });

  // Streetlights at every other intersection.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of STREETS) {
    for (const sz of STREETS) {
      if ((sx + sz) % 120 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 5), poleMat);
      pole.position.set(sx + 8, 4, sz + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lampMat);
      lamp.position.set(sx + 8, 8.2, sz + 8);
      group.add(lamp);
    }
  }

  scene.add(group);
  return { colliders, group };
}
