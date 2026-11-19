// Solara Bay — the player: Juno Reyes, on foot and behind the wheel.
// Walking, running, carjacking (E), shooting (click / F), health, armour
// and cash. The camera lives in main.js; this module only moves Juno.

import * as THREE from 'three';
import { TUNE, clamp } from './config.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xff9f1c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.36), jeans);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.42), jacket);
  torso.position.y = 1.3;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), skin);
  head.position.y = 2.0;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x14213d }),
  );
  cap.position.y = 2.24;
  g.add(cap);
  const armGeo = new THREE.BoxGeometry(0.18, 0.8, 0.18);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.5, 1.32, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.5, 1.32, 0);
  g.add(armL); g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  // A simple pistol in the right hand, visible while aiming.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.14, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  gun.position.set(0.5, 0.95, 0.3);
  gun.name = 'gun';
  g.add(gun);
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = makePlayerMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.armor = 0;
    this.money = 500;
    this.ammo = 48;
    this.weapon = 0; // 0 fists, 1 pistol, 2 smg
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.shootCooldown = 0;
    this.invulnerableUntil = 0;
    this.onShoot = null;
    this.onDamage = null;
  }

  get speedKmh() {
    return Math.abs(this.inCar && this.car ? this.car.speed : this.speed) * 3.6;
  }

  // input: {forward, back, left, right, run}
  updateOnFoot(dt, input, city) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    let mx = 0, mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const top = input.run ? TUNE.runSpeed : TUNE.walkSpeed;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      // Camera-relative: up is -z on screen (top-down camera looks north).
      const tx = mx, tz = mz;
      const wantHeading = Math.atan2(tx, tz);
      let diff = wantHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * clamp(dt * 12, 0, 1);
      this.speed = top;
      this.walkPhase += dt * (input.run ? 13 : 9);
      const nx = this.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const fixed = city.resolveCircle(nx, nz, TUNE.playerRadius);
      this.x = clamp(fixed.x, -338, 338);
      this.z = clamp(fixed.z, -338, 338);
    } else {
      this.speed = 0;
    }
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.08 : 0;
    this.mesh.position.set(this.x, bob, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    car.isPlayerCar = true;
    car.isParked = false;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.isPlayerCar = false;
    const side = { x: car.x + Math.cos(car.heading) * 2.4, z: car.z - Math.sin(car.heading) * 2.4 };
    this.x = side.x; this.z = side.z;
    this.heading = car.heading;
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  // Hitscan shot in the facing direction. Returns what was hit.
  shoot(peds, police, traffic) {
    if (this.shootCooldown > 0 || this.weapon === 0) return null;
    if (this.ammo <= 0) return { kind: 'empty' };
    this.shootCooldown = this.weapon === 2 ? 0.12 : 0.32;
    this.ammo--;
    if (this.onShoot) this.onShoot();
    const range = TUNE.bulletRange;
    // Pedestrians first.
    const hits = peds.shotHits(this.x, this.z, this.heading, range);
    if (hits.length > 0) {
      const target = hits[0].ped;
      peds.knockDown(target);
      return { kind: 'ped', dist: hits[0].dist };
    }
    // Police cars in the cone.
    let best = null, bestD = range;
    for (const car of police.cars) {
      if (car.dead) continue;
      const dx = car.x - this.x, dz = car.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.3 && d < bestD) { bestD = d; best = car; }
    }
    if (best) {
      best.speed *= 0.3;
      return { kind: 'police', dist: bestD };
    }
    return { kind: 'miss' };
  }

  damage(amount, now) {
    if (now < this.invulnerableUntil) return false;
    this.invulnerableUntil = now + 0.6;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    if (this.onDamage) this.onDamage(amount);
    return this.health <= 0;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  addMoney(n) { this.money = Math.max(0, this.money + n); }

  resetTo(x, z) {
    if (this.inCar) {
      this.car.isPlayerCar = false;
      this.car = null;
      this.inCar = false;
      this.mesh.visible = true;
    }
    this.x = x; this.z = z;
    this.heading = 0;
    this.health = 100;
    this.mesh.position.set(x, 0, z);
    this.invulnerableUntil = performance.now() / 1000 + 2;
  }
}
