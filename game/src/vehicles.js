// Solara Bay — cars: meshes, arcade driving physics, traffic AI and
// carjacking. One Car class serves the player, traffic and the police
// (the police module skins its own cars and steers them).

import * as THREE from 'three';
import { TUNE, clamp, angleLerp, dist2 } from './config.js';

export const CAR_COLORS = [
  0xe63946, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0xf8f9fa, 0x212529,
  0x8338ec, 0xff6d00, 0x06d6a0, 0xef476f, 0x118ab2, 0x9b5de5,
];
export const CAR_KINDS = [
  { name: 'Solano', top: 34, accel: 20, price: 0 },
  { name: 'Bay Runner', top: 40, accel: 24, price: 2500 },
  { name: 'Sunset GT', top: 48, accel: 28, price: 12000 },
  { name: 'Palm Taxi', top: 36, accel: 22, price: 0 },
  { name: 'Harbor Van', top: 30, accel: 16, price: 0 },
];

export function makeCarMesh(color, kindIndex = 0, police = false) {
  const g = new THREE.Group();
  const bodyColor = police ? 0x111111 : color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.72, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.62, 2.1),
    new THREE.MeshLambertMaterial({ color: police ? 0xf8f9fa : 0x1d3557 }),
  );
  cabin.position.set(0, 1.24, -0.25);
  g.add(cabin);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.14, 0.3, 4.42),
    new THREE.MeshLambertMaterial({ color: police ? 0xf8f9fa : 0x000000 }),
  );
  stripe.position.y = 0.62;
  g.add(stripe);
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.72, -0.25);
    bar.name = 'lightbar';
    g.add(bar);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.kindIndex = kindIndex;
  return g;
}

export class Car {
  constructor(scene, x, z, heading, color, kindIndex = 0, police = false) {
    this.scene = scene;
    this.mesh = makeCarMesh(color, kindIndex, police);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.kindIndex = kindIndex;
    this.kind = CAR_KINDS[kindIndex] || CAR_KINDS[0];
    this.police = police;
    this.stuck = 0;
    this.dead = false;
  }

  get topSpeed() { return this.police ? TUNE.policeSpeed : this.kind.top; }

  // Arcade driving: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer, city) {
    const accel = throttle >= 0 ? this.kind.accel : TUNE.carBrake;
    this.speed += throttle * accel * dt;
    if (throttle === 0) this.speed *= Math.max(0, 1 - 1.6 * dt);
    const maxF = this.topSpeed;
    this.speed = clamp(this.speed, -TUNE.carReverseMax, maxF);
    const turnRate = TUNE.carTurn * steer * clamp(Math.abs(this.speed) / 8, 0, 1) * Math.sign(this.speed || 1);
    this.heading += turnRate * dt;
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = city.resolveCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      if (Math.abs(this.speed) > 14) this.speed *= 0.4;
      else this.speed *= 0.85;
    }
    this.x = clamp(fixed.x, -340, 340);
    this.z = clamp(fixed.z, -340, 340);
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }

  remove() {
    this.scene.remove(this.mesh);
    this.dead = true;
  }
}

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.parked = [];
  }

  spawnInitial() {
    for (let i = 0; i < 16; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      const vertical = Math.abs(p.x - Math.round(p.x)) < 1 && this.city.roadCenters().includes(Math.round(p.x));
      const heading = vertical ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const kind = Math.floor(this.rng() * CAR_KINDS.length);
      const car = new Car(this.scene, p.x, p.z, heading, color, kind);
      car.isTraffic = true;
      car.target = this._nextWaypoint(car);
      this.cars.push(car);
    }
    // Parked cars the player can steal, near the safehouse and downtown.
    const spots = [
      [-88, 80, 0.4], [-72, 120, 1.2], [-8, -72, 2.2], [72, 96, 0.9],
      [152, -168, 1.8], [-168, 152, 0.2], [232, 40, 2.8], [-248, -8, 1.5],
    ];
    for (const [x, z, h] of spots) {
      const color = CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)];
      const kind = Math.floor(this.rng() * CAR_KINDS.length);
      const car = new Car(this.scene, x, z, h, color, kind);
      car.isParked = true;
      this.parked.push(car);
      this.cars.push(car);
    }
  }

  _nextWaypoint(car) {
    const centers = this.city.roadCenters();
    const c = centers[Math.floor(this.rng() * centers.length)];
    if (this.rng() < 0.5) return { x: c, z: -300 + this.rng() * 600, vertical: true };
    return { x: -300 + this.rng() * 600, z: c, vertical: false };
  }

  nearestStealable(x, z, maxDist = 5) {
    let best = null, bestD = maxDist * maxDist;
    for (const car of this.cars) {
      if (car.dead || car.isPlayerCar) continue;
      const d = dist2(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  update(dt, playerX, playerZ) {
    for (const car of this.cars) {
      if (car.dead || car.isParked || car.isPlayerCar || car.police) continue;
      // Drive toward the waypoint, slowing for cars ahead.
      const t = car.target;
      if (!t || dist2(car.x, car.z, t.x, t.z) < 36) {
        car.target = this._nextWaypoint(car);
        continue;
      }
      const want = Math.atan2(t.x - car.x, t.z - car.z);
      car.heading = angleLerp(car.heading, want, clamp(dt * 1.6, 0, 1));
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other.dead) continue;
        const ahead = (other.x - car.x) * Math.sin(car.heading) + (other.z - car.z) * Math.cos(car.heading);
        if (ahead > 0 && ahead < 9 && Math.abs((other.x - car.x) * Math.cos(car.heading) - (other.z - car.z) * Math.sin(car.heading)) < 2.4) {
          blocked = true; break;
        }
      }
      const pd = Math.hypot(playerX - car.x, playerZ - car.z);
      if (pd < 7 && Math.abs(playerX - car.x) < 4) blocked = true;
      const targetSpeed = blocked ? 0 : TUNE.trafficSpeed;
      car.speed += clamp(targetSpeed - car.speed, -18 * dt, 12 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.city.resolveCircle(nx, nz, 1.6);
      car.x = fixed.x; car.z = fixed.z;
      car.sync();
    }
    // Keep traffic near the player: recycle far cars to a road nearby.
    for (const car of this.cars) {
      if (car.dead || car.isParked || car.isPlayerCar || car.police) continue;
      if (dist2(car.x, car.z, playerX, playerZ) > 420 * 420) {
        const p = this.city.randomRoadPoint(this.rng);
        const d = Math.hypot(p.x - playerX, p.z - playerZ);
        if (d < 380) { car.x = p.x; car.z = p.z; car.target = this._nextWaypoint(car); car.sync(); }
      }
    }
  }
}
