// Solara Bay — pedestrians: sidewalk walkers who stroll, scatter when shots
// ring out, and occasionally cross at the lights.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { collideBuildings } from './city.js';
import { mulberry32 } from './vehicles.js';

const SHIRT_COLORS = [0xe23b3b, 0x3f7fd0, 0xf2c200, 0x8e44ad, 0x2fae5f, 0xffffff, 0xff8c42, 0x222222];

export function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.15, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.85;
  g.add(head);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return g;
}

export function seedPeds(state, scene) {
  const rand = mulberry32(4242);
  for (let i = 0; i < 42; i++) {
    const color = SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)];
    const mesh = makePedMesh(color);
    const x = (rand() * 2 - 1) * 170;
    const z = (rand() * 2 - 1) * 170;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    state.peds.push({
      mesh, x, z,
      heading: rand() * Math.PI * 2,
      speed: 1.2 + rand() * 1.4,
      state: 'walk',
      panic: 0,
      down: false,
      downTimer: 0,
      targetHeading: rand() * Math.PI * 2,
      retarget: 2 + rand() * 4,
    });
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.speed = 5.5;
    } else {
      ped.speed = 1.6;
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.retarget = 2 + Math.random() * 4;
        ped.targetHeading = Math.random() * Math.PI * 2;
      }
    }
    let dh = ped.targetHeading - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    const fixed = collideBuildings(state, nx, nz, 0.8);
    ped.x = Math.max(-WORLD.half + 4, Math.min(WORLD.half - 4, fixed.x));
    ped.z = Math.max(-WORLD.half + 4, Math.min(WORLD.half - 4, fixed.z));
    if (ped.x > 176) ped.x = 176;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // Little walk bob.
    ped.mesh.position.y = Math.abs(Math.sin(state.time * 6 + ped.x)) * 0.06;
  }
}

export function scarePeds(state, x, z, radius) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < radius) {
      ped.panic = 3 + Math.random() * 2;
      ped.targetHeading = Math.atan2(ped.x - x, ped.z - z);
    }
  }
}

export function knockDownPed(state, ped) {
  ped.down = true;
  ped.downTimer = 6;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
}
