// Solara Bay — player.js
// One clear job: Rico Vega on foot and behind the wheel. Walking, sprint,
// carjacking with E, shooting with F or click, and the damage model.
// The camera lives in main.js; this module only moves Rico.
import * as THREE from 'three';
import { PLAYER_TUNING } from './config.js';
import { resolveCircle } from './city.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  group.name = 'rico-vega';
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xff6b35 }),
  );
  jacket.position.y = 1.15;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 2.25;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x2b3a55 }),
  );
  legs.position.y = 0.45;
  group.add(legs);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  gun.position.set(0.6, 1.4, 0.2);
  gun.name = 'pistolMesh';
  gun.visible = false;
  group.add(gun);
  return group;
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of cars) {
    if (car.forSale) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

// On-foot movement: WASD in world axes (camera looks down from the south),
// Shift sprints, and the body faces the last move direction.
export function updatePlayerOnFoot(G, input, dt) {
  const p = G.player;
  const sprint = input.sprint ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let mz = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
  if (mx !== 0 || mz !== 0) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.heading = Math.atan2(mz, mx);
    const nx = p.x + mx * sprint * dt;
    const nz = p.z + mz * sprint * dt;
    const [rx, rz] = resolveCircle(nx, nz, 0.9, G.colliders);
    p.x = Math.max(-208, Math.min(208, rx));
    p.z = Math.max(-208, Math.min(208, rz));
    p.moving = true;
  } else {
    p.moving = false;
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = -p.heading;
  // Simple walk bob so the run reads on screen.
  p.mesh.position.y = p.moving ? Math.abs(Math.sin(G.time * 10)) * 0.15 : 0;
}

export function tryEnterCar(G) {
  const p = G.player;
  if (p.inCar) return false;
  const car = nearestCar(G.parkedCars, p.x, p.z, 4.5);
  if (!car) return false;
  p.inCar = true;
  p.car = car;
  p.mesh.visible = false;
  G.audio.blip(520, 0.08, 'square', 0.2);
  if (G.missions) G.missions.onEnterCar();
  return true;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const [fx, fz] = p.car.forward();
  p.x = p.car.x - fz * 2.5;
  p.z = p.car.z + fx * 2.5;
  p.inCar = false;
  p.car.speed = 0;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}

// Hitscan shooting: nearest hostile within 32 m and inside a 70-degree
// cone in front of Rico. Costs one round, sparks a tracer, hurts the target.
export function shoot(G) {
  const p = G.player;
  if (p.inCar) return false;
  if (!G.hasPistol) { G.toast('No weapon — buy a pistol at Tide Arms'); return false; }
  if (G.ammo <= 0) { G.toast('Out of ammo — buy more at Tide Arms'); return false; }
  if (G.time - (p.lastShot || -9) < 0.28) return false;
  p.lastShot = G.time;
  G.ammo -= 1;
  G.audio.gunshot();
  G.pedestrians.scatter(p.x, p.z);
  // Face the nearest hostile so the shot reads as aimed.
  let target = null, bestD = 32;
  for (const goon of G.goons) {
    if (goon.dead) continue;
    const d = Math.hypot(goon.x - p.x, goon.z - p.z);
    if (d < bestD) { target = goon; bestD = d; }
  }
  if (target) {
    p.heading = Math.atan2(target.z - p.z, target.x - p.x);
    p.mesh.rotation.y = -p.heading;
    target.hp -= 34;
    G.tracer(p.x, p.z, target.x, target.z);
    if (target.hp <= 0) {
      target.dead = true;
      target.mesh.visible = false;
      G.missions.onGoonDown();
      G.addHeat(1);
    }
  } else {
    // Warning shot into the air: still draws heat.
    const tx = p.x + Math.cos(p.heading) * 20;
    const tz = p.z + Math.sin(p.heading) * 20;
    G.tracer(p.x, p.z, tx, tz);
    G.addHeat(1);
  }
  return true;
}
