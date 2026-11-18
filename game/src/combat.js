// Combat: fists, pistol, SMG and shotgun. Raycast shooting, enemy goons, tracers.

import { clamp, dist2d } from './config.js';
import { makePersonModel, animateWalk, scarePeds } from './people.js';
import { damagePlayer } from './player.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 2.2, auto: false, spread: 0 },
  pistol: { name: 'Pistol', damage: 26, rate: 0.32, range: 55, auto: false, spread: 0.012 },
  smg: { name: 'SMG', damage: 15, rate: 0.09, range: 48, auto: true, spread: 0.045 },
  shotgun: { name: 'Shotgun', damage: 14, rate: 0.9, range: 22, auto: false, spread: 0.09, pellets: 7 },
};

export function tryShoot(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (G.shootCooldown > 0) return;
  if (p.weapon !== 'fists') {
    if ((p.ammo[p.weapon] || 0) <= 0) { G.hud.flash('Amunisi habis — beli di Ironworks Arms.'); G.audio.click(); return; }
    p.ammo[p.weapon]--;
  }
  G.shootCooldown = w.rate;
  G.audio.gunshot(p.weapon);
  G.muzzleFlash(G);
  if (p.weapon === 'fists') {
    // melee swing in front of the player
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let hit = false;
    for (const e of G.enemies) {
      if (e.health <= 0) continue;
      if (dist2d(e.x, e.z, p.x + fx, p.z + fz) < 1.8) { hurtEnemy(G, e, w.damage); hit = true; }
    }
    for (const ped of G.peds) {
      if (dist2d(ped.x, ped.z, p.x + fx, p.z + fz) < 1.6) { ped.panic = 6; hit = true; }
    }
    if (hit) G.audio.thud();
    return;
  }
  // hitscan: aim from camera through the crosshair
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = G.camera.position.clone();
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const d = dir.clone();
    d.x += (G.rng() - 0.5) * w.spread * 2;
    d.y += (G.rng() - 0.5) * w.spread * 2;
    d.z += (G.rng() - 0.5) * w.spread * 2;
    d.normalize();
    const ray = new THREE.Raycaster(origin, d, 0.1, w.range);
    // targets: enemies, peds, police cars, traffic cars, buildings (block)
    const targets = [];
    for (const e of G.enemies) if (e.health > 0) targets.push(e.model);
    for (const ped of G.peds) targets.push(ped.model);
    for (const cop of G.cops) targets.push(cop.model);
    for (const car of G.cars) targets.push(car.model);
    const hits = ray.intersectObjects(targets, true);
    let end = origin.clone().addScaledVector(d, w.range);
    if (hits.length) {
      const h = hits[0];
      end = h.point.clone();
      let obj = h.object;
      while (obj && !obj.userData.ownerRef) obj = obj.parent;
      const ref = obj ? obj.userData.ownerRef : null;
      if (ref) {
        if (ref.kind === 'enemy') hurtEnemy(G, ref.ref, w.damage);
        else if (ref.kind === 'ped') { ref.ref.panic = 6; G.addWanted(1, 'menyerang warga'); }
        else if (ref.kind === 'cop') { G.addWanted(2, 'menembak polisi'); }
        else if (ref.kind === 'car') {
          ref.ref.health -= w.damage;
          if (ref.ref.health <= 0) explodeCar(G, ref.ref);
        }
      }
    }
    G.tracer(origin, end);
  }
  scarePeds(G, p.x, p.z, 30);
  if (G.rng() < 0.6) G.addWanted(1, 'tembakan terdengar');
}

function hurtEnemy(G, e, dmg) {
  e.health -= dmg;
  e.flash = 0.15;
  if (e.health <= 0) {
    e.health = 0;
    e.model.rotation.x = -Math.PI / 2; // fall down
    e.model.position.y = 0.4;
    G.player.money += e.bounty || 0;
    if (e.bounty) G.hud.flash(`+ $${e.bounty}`);
    G.audio.thud();
  }
}

export function explodeCar(G, car) {
  car.health = 0;
  car.speed = 0;
  car.model.children.forEach((c) => { if (c.material && c.material.color) c.material.color.setHex(0x222222); });
  G.audio.explosion();
  G.shake = 0.6;
  scarePeds(G, car.x, car.z, 40);
  G.addWanted(1, 'ledakan mobil');
  const i = G.cars.indexOf(car);
  if (car === G.playerCar) { G.playerCar = null; G.inCar = false; G.player.model.visible = true; damagePlayer(G, 35); }
  // burnt husk stays; traffic AI skips dead cars
  car.dead = true;
  car.npc = false;
  G.cars.splice(i, 1);
  G.deadCars.push(car);
}

// Armed goons for missions: they hunt the player and shoot back.
export function spawnEnemy(G, x, z, opts = {}) {
  const model = makePersonModel(G, 0x8d5524, 0x922b21, 0x1a1a1a, false);
  const e = {
    kind: 'enemy', x, z, heading: 0, health: opts.health || 60,
    speed: opts.speed || 3.4, shootTimer: 1 + G.rng(), bounty: opts.bounty || 50,
    model, flash: 0, phase: 0,
  };
  model.position.set(x, 0, z);
  model.userData.ownerRef = { kind: 'enemy', ref: e };
  model.userData.gun.visible = true;
  G.enemies.push(e);
  return e;
}

export function updateEnemies(G, dt) {
  const px = G.player.x, pz = G.player.z;
  for (const e of G.enemies) {
    if (e.health <= 0) continue;
    const dx = px - e.x, dz = pz - e.z;
    const dist = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    if (dist > 14) {
      e.x += Math.sin(e.heading) * e.speed * dt;
      e.z += Math.cos(e.heading) * e.speed * dt;
      e.phase += dt * 7;
      animateWalk(e.model, e.phase, 1);
    } else {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.4 + G.rng() * 1.2;
        G.audio.gunshot('pistol', 0.4);
        G.tracer(new THREE.Vector3(e.x, 1.4, e.z), new THREE.Vector3(px, 1.2, pz));
        if (G.rng() < 0.45) damagePlayer(G, 7);
      }
    }
    if (e.flash > 0) { e.flash -= dt; e.model.children[0].material.color.setHex(0xffffff); }
    else e.model.children[0].material.color.setHex(0x922b21);
    e.model.position.set(e.x, 0, e.z);
    e.model.rotation.y = e.heading;
  }
}

export function clearEnemies(G) {
  for (const e of G.enemies) G.scene.remove(e.model);
  G.enemies.length = 0;
}
