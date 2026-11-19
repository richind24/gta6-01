// Solara Bay — the wanted system: stars 0-5, patrol cars that chase,
// roadblocks at high heat, and a police helicopter from 3 stars up.
// Getting busted (or wasted) costs cash and drops the player at the
// hospital or the safehouse.

import * as THREE from 'three';
import { TUNE, clamp, angleLerp } from './config.js';
import { Car } from './vehicles.js';

const WANTED_LABEL = ['Clean', '1 Star — Patrol', '2 Stars — Pursuit', '3 Stars — Air Support', '4 Stars — Roadblocks', '5 Stars — Full Heat'];

export class Police {
  constructor(scene, city, traffic, rng) {
    this.scene = scene;
    this.city = city;
    this.traffic = traffic;
    this.rng = rng;
    this.wanted = 0;
    this.cars = [];
    this.heli = null;
    this.heliRotor = null;
    this.heliLight = null;
    this.bustTimer = 0;
    this.calmTimer = 0;
    this.spawnTimer = 0;
    this.roadblocks = [];
    this.onBusted = null;
    this._buildHeli();
  }

  _buildHeli() {
    const g = new THREE.Group();
    // White body + red stripe (reads against dark roads) and 1.5x scale
    // so the heli is visible in screenshots; the spotlight cone is not
    // scaled, so it still reaches the ground.
    const bodyG = new THREE.Group();
    bodyG.scale.set(1.5, 1.5, 1.5);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.6, 6.4),
      new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
    );
    body.position.y = 0;
    bodyG.add(body);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.5, 6.5),
      new THREE.MeshLambertMaterial({ color: 0xe63946 }),
    );
    stripe.position.y = 0.25;
    bodyG.add(stripe);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.1, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }),
    );
    glass.position.set(0, 0.35, 2.4);
    bodyG.add(glass);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 5),
      new THREE.MeshLambertMaterial({ color: 0xf8f9fa }),
    );
    tail.position.set(0, 0.2, -5);
    bodyG.add(tail);
    const rotor = new THREE.Group();
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(11, 0.12, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      blade.rotation.y = (k * Math.PI) / 2;
      rotor.add(blade);
    }
    rotor.position.y = 1.2;
    bodyG.add(rotor);
    g.add(bodyG);
    const spot = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6bf, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    spot.position.y = -18;
    spot.rotation.x = Math.PI;
    g.add(spot);
    g.visible = false;
    this.scene.add(g);
    this.heli = g;
    this.heliRotor = rotor;
    this.heliLight = spot;
  }

  label() { return WANTED_LABEL[this.wanted]; }

  setWanted(n, silent = false) {
    const before = this.wanted;
    this.wanted = clamp(Math.round(n), 0, 5);
    if (this.wanted > 0) this.calmTimer = TUNE.wantedDecaySeconds;
    if (this.wanted < before && this.wanted === 0) this._clearUnits();
    if (!silent && this.wanted > before) this.spawnTimer = 0;
    return this.wanted;
  }

  addHeat(n) { return this.setWanted(this.wanted + n); }

  _clearUnits() {
    for (const c of this.cars) c.remove();
    this.cars = [];
    for (const b of this.roadblocks) this.scene.remove(b);
    this.roadblocks = [];
    this.heli.visible = false;
  }

  _spawnCarNear(x, z) {
    const centers = this.city.roadCenters();
    const c = centers[Math.floor(this.rng() * centers.length)];
    const px = this.rng() < 0.5 ? c : x + (this.rng() - 0.5) * 120;
    const pz = this.rng() < 0.5 ? z + (this.rng() - 0.5) * 120 : c;
    return this.spawnCarAt(clamp(px, -320, 320), clamp(pz, -320, 320), this.rng() * Math.PI * 2);
  }

  // Spawn a cruiser at an exact spot (screenshot staging, roadblocks).
  spawnCarAt(x, z, heading = 0) {
    const car = new Car(this.scene, x, z, heading, 0x111111, 0, true);
    car.police = true;
    car.isPolice = true;
    this.cars.push(car);
    this.traffic.cars.push(car);
    return car;
  }

  _spawnRoadblock(x, z) {
    const g = new THREE.Group();
    for (let k = -1; k <= 1; k++) {
      const car = new Car(this.scene, 0, 0, 0, 0x111111, 0, true);
      this.scene.remove(car.mesh);
      car.mesh.position.set(k * 4.4, 0, 0);
      g.add(car.mesh);
    }
    g.position.set(x, 0, z);
    g.rotation.y = this.rng() * Math.PI;
    this.scene.add(g);
    this.roadblocks.push(g);
  }

  update(dt, player, time) {
    const px = player.x, pz = player.z;
    const onFoot = !player.inCar;
    // Wanted decays while the player stays out of sight of the law.
    if (this.wanted > 0) {
      this.calmTimer -= dt;
      if (this.calmTimer <= 0) this.setWanted(this.wanted - 1);
    }
    const want = Math.min(this.wanted, 5);
    const wantCars = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : want === 4 ? 4 : 5;
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this._spawnCarNear(px, pz);
      this.spawnTimer = 1.2;
    }
    if (this.roadblocks.length === 0 && want >= 4) {
      const ahead = { x: px + Math.sin(player.heading) * 55, z: pz + Math.cos(player.heading) * 55 };
      this._spawnRoadblock(ahead.x, ahead.z);
    }
    // Chase steering: aim at the player, slide around buildings.
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = Math.hypot(px - car.x, pz - car.z);
      const wantHeading = Math.atan2(px - car.x, pz - car.z);
      car.heading = angleLerp(car.heading, wantHeading, clamp(dt * 2.2, 0, 1));
      const target = d > 6 ? car.topSpeed : car.topSpeed * 0.35;
      car.speed += clamp(target - car.speed, -30 * dt, 22 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.city.resolveCircle(nx, nz, 1.6);
      if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 10) car.speed *= 0.55;
      car.x = fixed.x; car.z = fixed.z;
      car.sync();
      // Flash the light bar.
      const bar = car.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.floor(time * 6) % 2 === 0 ? 0xff2222 : 0x2266ff);
      // Bust: a cruiser sits on an on-foot player.
      if (onFoot && d < 3.4) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.4 && this.onBusted) this.onBusted('busted');
      }
    }
    if (this.cars.every((c) => Math.hypot(px - c.x, pz - c.z) > 4)) this.bustTimer = Math.max(0, this.bustTimer - dt * 2);

    // Helicopter from 3 stars: it leads the chase, hovering ahead of the
    // player so the camera (which looks forward) always catches it.
    const heliOn = want >= 3;
    this.heli.visible = heliOn;
    if (heliOn) {
      this.heliRotor.rotation.y += dt * 22;
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      const hx = px + fx * 16 + Math.sin(time * 0.5) * 5;
      const hz = pz + fz * 16 + Math.cos(time * 0.4) * 5;
      this.heli.position.set(hx, TUNE.heliHeight + Math.sin(time * 0.9) * 1.5, hz);
      this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heliLight.lookAt(px, 0, pz);
    }
    // Cull far cruisers.
    for (const car of [...this.cars]) {
      if (Math.hypot(car.x - px, car.z - pz) > 460) {
        car.remove();
        this.cars = this.cars.filter((c) => c !== car);
        this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      }
    }
  }
}
