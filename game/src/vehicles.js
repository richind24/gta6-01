// Solara Bay — vehicles: car meshes, arcade driving, traffic AI, stealing.
// Every car is a small three.js group: body, cabin, wheels, headlights.
import * as THREE from 'three';
import { CAR_TYPES, WORLD } from './config.js';
import { collideBuildings, clampToLand } from './city.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCarMesh(type, colorOverride) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const color = colorOverride ?? def.color;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2436 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 2.2), darkMat);
  cabin.position.set(0, 1.2, -0.2);
  g.add(cabin);
  if (type === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 2.4), new THREE.MeshLambertMaterial({ color: 0x9aa0ab }));
    bed.position.set(0, 0.95, -1.2);
    g.add(bed);
  }
  if (type === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 5.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    hull.position.y = 0.4;
    g.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 5.3), new THREE.MeshLambertMaterial({ color: 0x2fa8d8 }));
    stripe.position.y = 0.7;
    g.add(stripe);
    return g;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x881111 }));
    bar.position.set(0, 1.65, -0.2);
    g.add(bar);
    g.userData.lightbar = bar;
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111, emissive: 0x332200 }));
    sign.position.set(0, 1.65, -0.2);
    g.add(sign);
  }
  // Blob shadow so cars read on the bright ground.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(1, 1.9, 1);
  g.add(shadow);
  return g;
}

export function spawnCar(state, scene, type, x, z, heading, opts = {}) {
  const mesh = makeCarMesh(type, opts.color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const def = CAR_TYPES[type];
  const car = {
    mesh, type, x, z, heading,
    speed: 0,
    maxSpeed: def.maxSpeed * (opts.speedMul || 1),
    accel: def.accel,
    turn: def.turn,
    traffic: !!opts.traffic,
    police: type === 'police',
    boat: type === 'boat',
    parked: !!opts.parked,
    driver: !!opts.traffic,
    hp: 100,
    brakeLight: false,
    targetSpeed: 0,
    lane: opts.lane || 0,
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    color: opts.color ?? def.color,
  };
  state.cars.push(car);
  return car;
}

export function nearestCar(state, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function driveCar(state, car, dt, throttle, steer) {
  const def = CAR_TYPES[car.type];
  const maxReverse = 10;
  if (throttle > 0) car.speed += def.accel * throttle * dt * (1 + state.garageLevel * 0.12);
  else if (throttle < 0) car.speed += def.accel * 0.9 * throttle * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  const max = car.maxSpeed * (1 + state.garageLevel * 0.1);
  car.speed = Math.max(-maxReverse, Math.min(max, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 7);
  car.heading += steer * car.turn * steerAuthority * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideBuildings(state, nx, nz, 2.4);
  if (fixed.hit) car.speed *= 0.45;
  const clamped = clampToLand(state, fixed.x, fixed.z, car.boat);
  car.x = clamped.x;
  car.z = clamped.z;
  car.mesh.position.set(car.x, car.boat ? 0.1 : 0, car.z);
  car.mesh.rotation.y = car.heading;
  if (car.mesh.userData.wheels) {
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 1.4;
  }
}

// Traffic: cars cruise the road grid, turn at intersections, stop for nothing.
export function updateTraffic(state, scene, dt, rand) {
  for (const car of state.cars) {
    if (!car.traffic || car.parked) continue;
    if (car.driver === false) continue;
    // Keep to the road: snap drift back toward the nearest grid line.
    const step = WORLD.roadStep;
    if (car.axis === 'x') {
      car.targetSpeed = 11 + car.lane;
      const targetZ = Math.round(car.z / step) * step + (car.dir > 0 ? 2.5 : -2.5);
      car.z += (targetZ - car.z) * Math.min(1, dt * 1.5);
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.speed = car.targetSpeed;
      car.x += Math.sin(car.heading) * car.speed * dt;
      if (car.x > WORLD.half - 8) { car.x = -WORLD.half + 8; car.z = Math.round((rand() * 9 - 4)) * step; }
      if (car.x < -WORLD.half + 8) { car.x = WORLD.half - 8; car.z = Math.round((rand() * 9 - 4)) * step; }
    } else {
      car.targetSpeed = 11 + car.lane;
      const targetX = Math.round(car.x / step) * step + (car.dir > 0 ? -2.5 : 2.5);
      car.x += (targetX - car.x) * Math.min(1, dt * 1.5);
      car.heading = car.dir > 0 ? 0 : Math.PI;
      car.speed = car.targetSpeed;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (car.z > WORLD.half - 8) { car.z = -WORLD.half + 8; car.x = Math.round((rand() * 9 - 4)) * step; }
      if (car.z < -WORLD.half + 8) { car.z = WORLD.half - 8; car.x = Math.round((rand() * 9 - 4)) * step; }
    }
    const clamped = clampToLand(state, car.x, car.z, false);
    car.x = clamped.x; car.z = clamped.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
  // Gentle separation so traffic does not stack on one spot.
  const list = state.cars;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      if (!a.traffic || !b.traffic) continue;
      const dx = b.x - a.x; const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 25 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (5 - d) / 2;
        a.x -= (dx / d) * push * 0.5; a.z -= (dz / d) * push * 0.5;
        b.x += (dx / d) * push * 0.5; b.z += (dz / d) * push * 0.5;
      }
    }
  }
}

export function seedTraffic(state, scene) {
  const rand = mulberry32(777);
  const types = ['sedan', 'sedan', 'taxi', 'truck', 'sedan', 'sport'];
  for (let i = 0; i < 16; i++) {
    const axis = rand() < 0.5 ? 'x' : 'z';
    const line = Math.round(rand() * 9 - 4) * WORLD.roadStep;
    const along = (rand() * 2 - 1) * 180;
    const type = types[Math.floor(rand() * types.length)];
    spawnCar(state, scene, type,
      axis === 'x' ? along : line,
      axis === 'x' ? line : along,
      0, { traffic: true, axis, dir: rand() < 0.5 ? 1 : -1, lane: rand() * 3 });
  }
  // Parked cars the player can steal, near the start and the garage.
  const parked = [
    ['sport', -120, -140, 0.6], ['sedan', -100, -160, -0.4], ['taxi', 120, 120, 2.2],
    ['sedan', 40, -140, 1.1], ['truck', -160, 100, 0.2], ['sport', 100, -120, -1.4],
    ['limo', 140, 140, 0.9], ['sedan', -40, 140, 2.8],
  ];
  for (const [type, x, z, h] of parked) {
    spawnCar(state, scene, type, x, z, h, { parked: true });
  }
  // The marina skiff, waiting at the docks.
  spawnCar(state, scene, 'boat', 196, 150, Math.PI / 2, { parked: true });
}

export { mulberry32 };
