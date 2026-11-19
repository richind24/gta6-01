// Solara Bay — pedestrians: simple walkers on the sidewalks who stroll,
// scatter when shots are fired and wave their arms when the player runs
// them over (they just get up and complain — no gore, arcade only).

import * as THREE from 'three';
import { TUNE, clamp } from './config.js';

const SHIRTS = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0xf8f9fa, 0x8338ec, 0xff6d00, 0x06d6a0];

export function makePedMesh(shirt, pants) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.85, 0.35),
    new THREE.MeshLambertMaterial({ color: pants }),
  );
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.85, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  torso.position.y = 1.28;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
  );
  head.position.y = 1.95;
  g.add(head);
  const armGeo = new THREE.BoxGeometry(0.18, 0.8, 0.18);
  const armMat = new THREE.MeshLambertMaterial({ color: shirt });
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.48, 1.3, 0);
  const armR = new THREE.Mesh(armGeo, armMat);
  armR.position.set(0.48, 1.3, 0);
  g.add(armL); g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

class Ped {
  constructor(scene, x, z, heading, shirt) {
    this.mesh = makePedMesh(shirt, 0x2b2d42);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = TUNE.pedSpeed * (0.7 + Math.random() * 0.6);
    this.panic = 0;
    this.walkPhase = Math.random() * 6;
    this.wait = 0;
  }

  update(dt, city, danger) {
    this.walkPhase += dt * 7;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    if (danger) this.panic = 2.5;
    if (this.panic > 0) {
      this.panic -= dt;
      this.speed = 6.5;
    } else {
      this.speed = TUNE.pedSpeed;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    // Stay on sidewalks: turn around at roads and buildings.
    if (city.hitsBuilding(nx, nz, 0.8) || Math.abs(nx) > 330 || Math.abs(nz) > 330) {
      this.heading += Math.PI * (0.6 + Math.random() * 0.8);
      this.wait = 0.4;
      return;
    }
    this.x = nx; this.z = nz;
    // Randomly change direction at intersections.
    if (Math.random() < dt * 0.06) this.heading += (Math.random() - 0.5) * 2.4;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
  }
}

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this.dangerUntil = 0;
  }

  spawnInitial() {
    for (let i = 0; i < 42; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      const x = p.x + (this.rng() - 0.5) * 10;
      const z = p.z + (this.rng() - 0.5) * 10;
      if (this.city.hitsBuilding(x, z, 1)) continue;
      const shirt = SHIRTS[Math.floor(this.rng() * SHIRTS.length)];
      this.peds.push(new Ped(this.scene, x, z, this.rng() * Math.PI * 2, shirt));
    }
  }

  // Spawn one walker at an exact spot (mission rivals, fares, lookouts).
  spawnAt(x, z, shirt = 0xd90429) {
    const ped = new Ped(this.scene, x, z, this.rng() * Math.PI * 2, shirt);
    this.peds.push(ped);
    return ped;
  }

  scare(x, z, radius = 40) {
    this.dangerUntil = performance.now() / 1000 + 2;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.panic = 2.5;
        p.heading = Math.atan2(p.x - x, p.z - z);
      }
    }
  }

  // Returns peds hit by a shot fired from (x,z) along heading.
  shotHits(x, z, heading, range, halfAngle = 0.22) {
    const hits = [];
    for (const p of this.peds) {
      const dx = p.x - x, dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < halfAngle) hits.push({ ped: p, dist: d });
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

  knockDown(ped) {
    this.scene.remove(ped.mesh);
    this.peds = this.peds.filter((p) => p !== ped);
    // A fresh walker joins the street a moment later, far away.
    const p = this.city.randomRoadPoint(this.rng);
    const shirt = SHIRTS[Math.floor(this.rng() * SHIRTS.length)];
    this.peds.push(new Ped(this.scene, p.x, p.z, this.rng() * Math.PI * 2, shirt));
  }

  update(dt, time) {
    const danger = time < this.dangerUntil;
    for (const p of this.peds) p.update(dt, this.city, danger);
  }
}
