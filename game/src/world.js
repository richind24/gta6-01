// Solara Bay city generation: ground, bay water, buildings, props and landmarks.
// Colliders are axis-aligned boxes the player and cars resolve against.

import { CITY, roadLines, clamp, rand, pick, mulberry32 } from './config.js';
import { buildingTexture, groundTexture, glowTexture } from './textures.js';

export const LANDMARKS = {
  bar: { x: -64, z: 96, name: "The Rusty Anchor" },      // Mara's bar — story hub
  gunshop: { x: 128, z: -64, name: 'Ironworks Arms' },   // weapon shop
  garage: { x: -128, z: -128, name: 'Harbor Garage' },   // buyable property 1
  marina: { x: 192, z: -256, name: 'Solara Marina' },    // buyable property 2
  police: { x: 64, z: 64, name: 'Solara PD HQ' },        // busted respawn
  hospital: { x: -192, z: 64, name: 'Bayview General' }, // wasted respawn
  harbor: { x: 0, z: -272, name: 'Port Solara' },        // story finale area
};

export function buildCity(G) {
  const rng = mulberry32(20261118);
  const scene = G.scene;
  G.colliders = [];
  G.streetLights = [];
  G.buildings = [];
  G.glowTex = glowTexture();

  // ---- ground ----
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTexture() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry((CITY.half + 40) * 2, (CITY.half + 40) * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- bay water (south edge) ----
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1d5f7a, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry((CITY.half + 40) * 2, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, CITY.waterAt - 52);
  scene.add(water);
  G.water = water; G.waterMat = waterMat;

  // pier into the bay
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2e });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), pierMat);
  pier.position.set(0, 0.5, CITY.waterAt - 22);
  pier.castShadow = true; pier.receiveShadow = true;
  scene.add(pier);
  G.colliders.push({ minX: -5, maxX: 5, minZ: CITY.waterAt - 52, maxZ: CITY.waterAt + 8, h: 1 });

  // ---- buildings ----
  const lines = roadLines();
  const facadeTexs = [];
  for (let i = 0; i < 6; i++) facadeTexs.push(buildingTexture(mulberry32(100 + i * 7), 0.35));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a48 });

  function addBuilding(x, z, w, d, h, texIdx) {
    const tex = facadeTexs[texIdx % facadeTexs.length];
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), roofMat);
    roof.position.set(x, h + 0.3, z);
    scene.add(roof);
    // rooftop box (AC unit / water tank)
    if (h > 20 && rng() < 0.6) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshLambertMaterial({ color: 0x777777 }));
      box.position.set(x + rand(rng, -w / 4, w / 4), h + 1.6, z + rand(rng, -d / 4, d / 4));
      scene.add(box);
    }
    G.buildings.push({ mesh, mat, x, z, w, d, h });
    G.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
    return mesh;
  }

  // City blocks: 1-3 buildings per block; downtown (near centre) is taller.
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const bx0 = lines[i] + CITY.roadW / 2 + 3, bx1 = lines[i + 1] - CITY.roadW / 2 - 3;
      const bz0 = lines[j] + CITY.roadW / 2 + 3, bz1 = lines[j + 1] - CITY.roadW / 2 - 3;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      // park block
      if (i === 3 && j === 3) continue;
      // beach row is water, skip last row
      if (j === lines.length - 2) continue;
      const downtown = Math.abs(cx) < 130 && Math.abs(cz) < 130;
      const n = downtown ? (rng() < 0.5 ? 1 : 2) : (rng() < 0.6 ? 2 : 3);
      for (let k = 0; k < n; k++) {
        const w = rand(rng, 14, (bx1 - bx0) / n - 4);
        const d = rand(rng, 14, (bz1 - bz0) - 4);
        const x = bx0 + ((bx1 - bx0) / n) * (k + 0.5) + rand(rng, -2, 2);
        const z = cz + rand(rng, -6, 6);
        const h = downtown ? rand(rng, 30, 95) : rand(rng, 10, 32);
        addBuilding(x, z, w, d, h, Math.floor(rng() * 6));
      }
    }
  }

  // Landmark buildings (taller, distinct) — placed on their blocks.
  function landmark(lm, w, d, h, color) {
    const tex = buildingTexture(mulberry32(lm.x * 3 + 99), 0.5);
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(lm.x, h / 2, lm.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 2.2, 0.6),
      new THREE.MeshBasicMaterial({ color }));
    sign.position.set(lm.x, h + 1.4, lm.z + d / 2 + 0.4);
    scene.add(sign);
    G.buildings.push({ mesh, mat, x: lm.x, z: lm.z, w, d, h, landmark: lm.name });
    G.colliders.push({ minX: lm.x - w / 2, maxX: lm.x + w / 2, minZ: lm.z - d / 2, maxZ: lm.z + d / 2, h });
  }
  landmark(LANDMARKS.bar, 22, 18, 14, 0xff5a3c);
  landmark(LANDMARKS.gunshop, 20, 16, 12, 0xffc93c);
  landmark(LANDMARKS.garage, 26, 20, 10, 0x3cc95f);
  landmark(LANDMARKS.marina, 24, 18, 12, 0x3ca7c9);
  landmark(LANDMARKS.police, 24, 20, 26, 0x3c6cff);
  landmark(LANDMARKS.hospital, 28, 20, 30, 0xffffff);

  // ---- park: trees, pond, benches ----
  const treeTrunk = new THREE.MeshLambertMaterial({ color: 0x5d4126 });
  const treeTop = new THREE.MeshLambertMaterial({ color: 0x3f7a2e });
  for (let t = 0; t < 26; t++) {
    const x = rand(rng, -56, 56), z = rand(rng, -56, 56);
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue; // keep pond clear
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 6), treeTrunk);
    trunk.position.set(x, 2, z); trunk.castShadow = true; scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(rand(rng, 2.5, 4), 8, 6), treeTop);
    top.position.set(x, 5.5, z); top.castShadow = true; scene.add(top);
    G.colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7, h: 4 });
  }
  const pond = new THREE.Mesh(new THREE.CircleGeometry(11, 24), new THREE.MeshLambertMaterial({ color: 0x2a6f8f }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(0, 0.2, 0); scene.add(pond);

  // ---- street lights at intersections ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const lx of lines) for (const lz of lines) {
    if (Math.abs(lx) > CITY.half || Math.abs(lz) > CITY.half) continue;
    if (rng() < 0.25) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
    pole.position.set(lx + CITY.roadW / 2 + 1.2, 3.5, lz + CITY.roadW / 2 + 1.2);
    scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.15), poleMat);
    arm.position.set(lx + CITY.roadW / 2 + 0.2, 7, lz + CITY.roadW / 2 + 1.2);
    scene.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
    bulb.position.set(lx + CITY.roadW / 2 - 0.9, 6.9, lz + CITY.roadW / 2 + 1.2);
    scene.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false }));
    glow.scale.set(2.6, 2.6, 1);
    glow.position.copy(bulb.position);
    scene.add(glow);
    G.streetLights.push({ glow, bulb });
  }

  // ---- traffic lights (visual) at main intersections ----
  for (const lx of [-128, 0, 128]) for (const lz of [-128, 0, 128]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 6), poleMat);
    pole.position.set(lx + 8.5, 2.75, lz + 8.5); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    head.position.set(lx + 8.5, 5.6, lz + 8.5); scene.add(head);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x39d353 }));
    lamp.position.set(lx + 8.5, 6.1, lz + 8.9); scene.add(lamp);
  }

  // ---- scattered street props: crates, hydrants, bus stops ----
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6b3d });
  for (let i = 0; i < 40; i++) {
    const x = rand(rng, -CITY.half, CITY.half), z = rand(rng, -CITY.half, CITY.half);
    if (Math.abs(x) % CITY.block < 10 || Math.abs(z) % CITY.block < 10) continue;
    const s = rand(rng, 1, 2);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(x, s / 2, z); crate.castShadow = true; scene.add(crate);
  }
}

// Circle-vs-building collision. Returns corrected {x, z}.
export function collideCircle(G, x, z, r) {
  for (const c of G.colliders) {
    const nx = clamp(x, c.minX, c.maxX), nz = clamp(z, c.minZ, c.maxZ);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; z = nz + (dz / d) * r;
      } else {
        // inside: push out along the smallest penetration axis
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
      }
    }
  }
  return { x: clamp(x, -CITY.half, CITY.half), z: clamp(z, CITY.waterAt + 2, CITY.half) };
}
