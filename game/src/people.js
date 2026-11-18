// People: the player character model, pedestrians with sidewalk AI, and fleeing drivers.
// Rebuild (Nov 2026): more variety — joggers run the beach strip, beachgoers
// stroll the sand, and shirt/skin variety grew so noon streets read crowded.

import { CITY, roadLines, clamp, lerp, rand, pick, nearestIntersection } from './config.js';
import { collideCircle } from './world.js';

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa67c52];
const SHIRTS = [0xd64545, 0x3d7ab8, 0x4caf50, 0xe6a817, 0x8e44ad, 0xecf0f1, 0x2c3e50, 0xd35400, 0xff6b9d, 0x00b8a9, 0xffd21f];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x1a1a1a, 0x5d6d7e, 0xc0392b];

// Simple articulated low-poly person: torso, head, arms, legs (limbs swing when walking).
export function makePersonModel(G, skin, shirt, pants, isPlayer) {
  const grp = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12; torso.castShadow = true; grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skinMat);
  head.position.y = 1.72; head.castShadow = true; grp.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), new THREE.MeshLambertMaterial({ color: isPlayer ? 0x1a1a1a : pick(G.rng, [0x1a1a1a, 0x6e4b1f, 0x8a8a8a, 0x3b2f2f]) }));
  hair.position.y = 1.94; grp.add(hair);
  const mkLimb = (w, h, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.y = -h / 2; m.castShadow = true;
    pivot.add(m); grp.add(pivot);
    return pivot;
  };
  grp.userData.armL = mkLimb(0.16, 0.62, skinMat, -0.4, 1.42);
  grp.userData.armR = mkLimb(0.16, 0.62, skinMat, 0.4, 1.42);
  grp.userData.legL = mkLimb(0.2, 0.72, pantsMat, -0.16, 0.76);
  grp.userData.legR = mkLimb(0.2, 0.72, pantsMat, 0.16, 0.76);
  // gun in right hand (hidden unless armed)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0, -0.62, 0.12);
  grp.userData.armR.add(gun);
  gun.visible = false;
  grp.userData.gun = gun;
  G.scene.add(grp);
  return grp;
}

export function animateWalk(model, phase, speedFactor) {
  const s = Math.sin(phase) * 0.7 * speedFactor;
  model.userData.legL.rotation.x = s;
  model.userData.legR.rotation.x = -s;
  model.userData.armL.rotation.x = -s * 0.8;
  model.userData.armR.rotation.x = s * 0.8;
}

export function animateIdle(model, t) {
  model.userData.legL.rotation.x *= 0.9;
  model.userData.legR.rotation.x *= 0.9;
  model.userData.armL.rotation.x = Math.sin(t * 1.5) * 0.05;
  model.userData.armR.rotation.x = -Math.sin(t * 1.5) * 0.05;
}

export function spawnPedestrians(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const lines = roadLines();
    const along = pick(rng, lines);
    const cross = rand(rng, -CITY.half + 20, CITY.half - 20);
    const horizontal = rng() < 0.5;
    const x = horizontal ? cross : along + (rng() < 0.5 ? 8.6 : -8.6);
    const z = horizontal ? along + (rng() < 0.5 ? 8.6 : -8.6) : cross;
    const model = makePersonModel(G, pick(rng, SKINS), pick(rng, SHIRTS), pick(rng, PANTS), false);
    const ped = {
      model, x, z, heading: rng() * Math.PI * 2, speed: rand(rng, 1.0, 1.8),
      target: null, wait: rand(rng, 0, 4), panic: 0, phase: rng() * 6,
      jogger: false,
    };
    model.position.set(x, 0, z);
    model.rotation.y = ped.heading;
    model.userData.ownerRef = { kind: 'ped', ref: ped };
    G.peds.push(ped);
  }
  // joggers on the beach strip + beachgoers strolling the sand
  for (let i = 0; i < 8; i++) {
    const x = rand(rng, -240, 240);
    const z = CITY.waterAt + rand(rng, 8, 34);
    const model = makePersonModel(G, pick(rng, SKINS), pick(rng, SHIRTS), pick(rng, PANTS), false);
    const jogger = rng() < 0.5;
    const ped = {
      model, x, z, heading: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      speed: jogger ? rand(rng, 3.2, 4.2) : rand(rng, 0.8, 1.4),
      target: null, wait: 0, panic: 0, phase: rng() * 6,
      jogger, beach: true,
    };
    model.position.set(x, 0, z);
    model.rotation.y = ped.heading;
    model.userData.ownerRef = { kind: 'ped', ref: ped };
    G.peds.push(ped);
  }
}

function pedPickTarget(G, ped) {
  const inter = nearestIntersection(ped.x, ped.z);
  const lines = roadLines();
  const opts = [];
  if (inter.x > -CITY.blocks * CITY.block) opts.push({ x: inter.x - CITY.block, z: inter.z + (ped.z > inter.z ? 8.6 : -8.6) });
  if (inter.x < CITY.blocks * CITY.block) opts.push({ x: inter.x + CITY.block, z: inter.z + (ped.z > inter.z ? 8.6 : -8.6) });
  if (inter.z > -CITY.blocks * CITY.block) opts.push({ x: inter.x + (ped.x > inter.x ? 8.6 : -8.6), z: inter.z - CITY.block });
  if (inter.z < CITY.blocks * CITY.block) opts.push({ x: inter.x + (ped.x > inter.x ? 8.6 : -8.6), z: inter.z + CITY.block });
  ped.target = pick(G.rng, opts);
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds) {
    // panic: run away from the player when shots are fired or cars crash nearby
    if (ped.panic > 0) {
      ped.panic -= dt;
      const dx = ped.x - G.player.x, dz = ped.z - G.player.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      ped.x += Math.sin(ped.heading) * 4.2 * dt;
      ped.z += Math.cos(ped.heading) * 4.2 * dt;
    } else if (ped.beach) {
      // beach folk stroll along the sand, turning at the ends
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      if (ped.x > 250 || ped.x < -250) ped.heading = -ped.heading;
      ped.phase += dt * ped.speed * 5;
      animateWalk(ped.model, ped.phase, ped.jogger ? 1.6 : 1);
    } else {
      if (ped.wait > 0) { ped.wait -= dt; animateIdle(ped.model, G.time); }
      else {
        if (!ped.target) pedPickTarget(G, ped);
        const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2) { ped.target = null; ped.wait = G.rng() < 0.3 ? rand(G.rng, 2, 8) : 0; }
        else {
          ped.heading = Math.atan2(dx, dz);
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
          ped.phase += dt * ped.speed * 5;
          animateWalk(ped.model, ped.phase, 1);
        }
      }
    }
    const p = collideCircle(G, ped.x, ped.z, 0.5);
    ped.x = p.x; ped.z = p.z;
    ped.model.position.set(ped.x, 0, ped.z);
    ped.model.rotation.y = ped.heading;
  }
}

export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.panic = 4 + G.rng() * 3;
  }
}
