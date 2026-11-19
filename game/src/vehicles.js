// Solara Bay — vehicles.js
// One clear job: cars. Meshes, arcade driving physics, parked cars to
// steal, and traffic AI that loops the road grid. Police cars reuse the
// same Car class with their own skin and steering (see police.js).
import * as THREE from 'three';
import { STREETS } from './city.js';
import { PLAYER_TUNING } from './config.js';

export const CAR_COLORS = [0xe63946, 0x2a9d8f, 0xf4d35e, 0x4361ee, 0xffffff, 0x222222, 0xff7b00, 0x80ed99, 0xb5179e];

export function createCarMesh(color, kind) {
  const group = new THREE.Group();
  group.name = 'car-' + (kind || 'sedan');
  const bodyColor = color === undefined ? 0xe63946 : color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.1, 2.1),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.75;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.9, 1.9),
    new THREE.MeshLambertMaterial({ color: 0x1b2a41 }),
  );
  cabin.position.set(-0.2, 1.6, 0);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.45, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const wz of [0.7, -0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.5), lightMat);
    lamp.position.set(2.25, 0.8, wz);
    group.add(lamp);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(-0.2, 2.25, 0);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(4.45, 0.35, 2.12),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    stripe.position.y = 1.0;
    group.add(stripe);
  }
  if (kind === 'sport') {
    body.scale.set(1.1, 0.85, 1);
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 2.0),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    spoiler.position.set(-2.2, 1.5, 0);
    group.add(spoiler);
  }
  return group;
}

export class Car {
  constructor(mesh, x, z, heading, kind) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading || 0;
    this.speed = 0;
    this.kind = kind || 'sedan';
    this.health = 100;
    this.stalled = false;
    this.ai = null; // traffic brain, if any
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading;
  }

  forward() { return [Math.cos(this.heading), Math.sin(this.heading)]; }
}

// Arcade driving: W/S throttle, A/D steer, Space handbrake. Collisions
// with buildings just stop the car (slide along the wall is faked by
// cancelling only the blocked axis).
export function driveCar(car, input, dt, colliders, tuned) {
  if (car.stalled) { car.speed *= 0.95; car.syncMesh(); return; }
  const maxSpeed = PLAYER_TUNING.driveMax * (tuned ? 1.25 : 1);
  if (input.forward) car.speed += PLAYER_TUNING.driveAccel * dt;
  if (input.back) car.speed -= PLAYER_TUNING.driveAccel * 0.7 * dt;
  if (input.brake) car.speed -= Math.sign(car.speed) * PLAYER_TUNING.driveBrake * dt;
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * 6 * dt;
  if (Math.abs(car.speed) < 0.4 && !input.forward && !input.back) car.speed = 0;
  car.speed = Math.max(-PLAYER_TUNING.reverseMax, Math.min(maxSpeed, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steer * PLAYER_TUNING.turnRate * dt * dir * Math.min(1, Math.abs(car.speed) / 8);
  const [fx, fz] = car.forward();
  const nx = car.x + fx * car.speed * dt;
  const nz = car.z + fz * car.speed * dt;
  // Axis-separated building collision: keep the axis that is still free.
  let px = nx, pz = nz;
  for (const c of colliders) {
    if (nx > c.minX - 1.4 && nx < c.maxX + 1.4 && nz > c.minZ - 1.4 && nz < c.maxZ + 1.4) {
      const hitX = nx > c.minX - 1.4 && nx < c.maxX + 1.4 && car.z > c.minZ - 1.4 && car.z < c.maxZ + 1.4;
      const hitZ = nz > c.minZ - 1.4 && nz < c.maxZ + 1.4 && car.x > c.minX - 1.4 && car.x < c.maxX + 1.4;
      if (hitX) px = car.x;
      if (hitZ) pz = car.z;
      if (hitX || hitZ) car.speed *= 0.55;
    }
  }
  car.x = Math.max(-208, Math.min(208, px));
  car.z = Math.max(-208, Math.min(208, pz));
  car.syncMesh();
}

export function spawnParkedCars(scene, rng) {
  const cars = [];
  const spots = [
    [62, 6, 0], [-58, -6, Math.PI], [122, 6, 0], [-122, -6, Math.PI],
    [6, 62, Math.PI / 2], [6, -122, -Math.PI / 2], [182, -6, 0], [-182, 6, Math.PI],
    [92, -58, 0], [-32, 122, Math.PI / 2],
  ];
  for (const [x, z, h] of spots) {
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const mesh = createCarMesh(color, 'sedan');
    scene.add(mesh);
    cars.push(new Car(mesh, x, z, h, 'sedan'));
  }
  // The Solara GT for sale sits outside Marina Motors.
  const gt = createCarMesh(0xffd23f, 'sport');
  scene.add(gt);
  const gtCar = new Car(gt, 168, 78, Math.PI / 2, 'sport');
  gtCar.forSale = true;
  cars.push(gtCar);
  return cars;
}

function randomStreetPoint(rng) {
  const s = STREETS[Math.floor(rng() * STREETS.length)];
  const along = -180 + rng() * 360;
  if (rng() < 0.5) return { x: s + (rng() < 0.5 ? 2.5 : -2.5), z: along, heading: along > 0 ? Math.PI / 2 : -Math.PI / 2 };
  return { x: along, z: s + (rng() < 0.5 ? 2.5 : -2.5), heading: along > 0 ? 0 : Math.PI };
}

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomStreetPoint(rng);
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const mesh = createCarMesh(color, 'taxi');
    scene.add(mesh);
    const car = new Car(mesh, p.x, p.z, p.heading, 'taxi');
    car.ai = { speed: 7 + rng() * 5, nextTurnAt: 2 + rng() * 6 };
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, time) {
  for (const car of cars) {
    if (car.stalled) continue;
    const [fx, fz] = car.forward();
    car.x += fx * car.ai.speed * dt;
    car.z += fz * car.ai.speed * dt;
    car.ai.nextTurnAt -= dt;
    // At an intersection, sometimes turn left or right.
    const onX = STREETS.some((s) => Math.abs(car.z - s) < 2.5);
    const onZ = STREETS.some((s) => Math.abs(car.x - s) < 2.5);
    if (car.ai.nextTurnAt <= 0 && onX && onZ) {
      car.ai.nextTurnAt = 3 + Math.random() * 5;
      const turn = Math.random();
      if (turn < 0.3) car.heading += Math.PI / 2;
      else if (turn < 0.6) car.heading -= Math.PI / 2;
    }
    // Loop back inside the city instead of driving into the sea.
    if (car.x > 205 || car.x < -205 || car.z > 205 || car.z < -205) car.heading += Math.PI;
    car.syncMesh();
  }
}
