// Vehicles: low-poly car models, traffic AI on the road grid, arcade driving physics.

import { CITY, roadLines, clamp, lerp, rand, pick, nearestIntersection, onRoad } from './config.js';
import { collideCircle } from './world.js';
import { damagePlayer } from './player.js';

const CAR_COLORS = [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98, 0xe67e22, 0x95a5a6, 0x2c3e50, 0xf5f5f5, 0x922b21, 0x148f77, 0xb03a2e];
const CAR_TYPES = [
  { name: 'Civic', w: 1.9, l: 4.2, top: 34, accel: 16, grip: 1.0 },
  { name: 'Sedan', w: 2.0, l: 4.6, top: 30, accel: 13, grip: 1.0 },
  { name: 'Coupe', w: 1.9, l: 4.3, top: 40, accel: 19, grip: 1.1 },
  { name: 'Pickup', w: 2.1, l: 5.0, top: 28, accel: 12, grip: 0.9 },
  { name: 'Van', w: 2.1, l: 5.2, top: 26, accel: 10, grip: 0.85 },
  { name: 'Taxi', w: 1.9, l: 4.4, top: 32, accel: 14, grip: 1.0, taxi: true },
];
const POLICE_COLOR = 0x1a1a2e;

export function makeCarModel(G, color, type, isPolice) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf0f0f0 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const body = new THREE.Mesh(new THREE.BoxGeometry(type.w, 0.65, type.l), bodyMat);
  body.position.y = 0.62; body.castShadow = true; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(type.w * 0.82, 0.6, type.l * 0.45), darkMat);
  cabin.position.set(0, 1.2, -type.l * 0.05); cabin.castShadow = true; grp.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(type.w * 0.94, 0.28, 0.5), bodyMat);
  nose.position.set(0, 0.55, type.l / 2 - 0.1); grp.add(nose);
  // headlights / taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), hl);
    h.position.set(sx * type.w * 0.32, 0.62, type.l / 2 + 0.02); grp.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tl);
    t.position.set(sx * type.w * 0.32, 0.62, -type.l / 2 - 0.02); grp.add(t);
  }
  if (type.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffd21f }));
    sign.position.set(0, 1.62, 0); grp.add(sign);
  }
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(type.w + 0.02, 0.18, type.l * 0.9), new THREE.MeshLambertMaterial({ color: 0x0a2a8f }));
    stripe.position.y = 0.72; grp.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.set(0, 1.58, 0); grp.add(bar);
    grp.userData.lightBar = bar;
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0c });
  grp.userData.wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (type.w / 2 - 0.05), 0.36, wz * (type.l / 2 - 0.75));
    grp.add(w); grp.userData.wheels.push(w);
  }
  G.scene.add(grp);
  return grp;
}

export function spawnCar(G, x, z, heading, opts = {}) {
  const rng = G.rng;
  const type = opts.type || pick(rng, CAR_TYPES);
  const color = opts.color ?? pick(rng, CAR_COLORS);
  const model = makeCarModel(G, color, type, !!opts.police);
  const car = {
    model, type, color, police: !!opts.police, npc: opts.npc !== false,
    x, z, heading, speed: 0, steer: 0, health: 100,
    target: null, wait: 0, driver: opts.driver !== false,
    siren: 0, stuck: 0,
  };
  model.position.set(x, 0, z);
  model.rotation.y = heading;
  model.userData.ownerRef = { kind: 'car', ref: car };
  G.cars.push(car);
  return car;
}

// --- traffic AI: cars drive the grid, turn at intersections, brake for cars ahead ---
function pickNextTarget(G, car) {
  const lines = roadLines();
  const inter = nearestIntersection(car.x, car.z);
  const dirs = [];
  if (inter.x > -CITY.blocks * CITY.block) dirs.push({ x: inter.x - CITY.block, z: inter.z });
  if (inter.x < CITY.blocks * CITY.block) dirs.push({ x: inter.x + CITY.block, z: inter.z });
  if (inter.z > -CITY.blocks * CITY.block) dirs.push({ x: inter.x, z: inter.z - CITY.block });
  if (inter.z < CITY.blocks * CITY.block) dirs.push({ x: inter.x, z: inter.z + CITY.block });
  car.target = pick(G.rng, dirs);
}

function carAhead(G, car, dist) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  for (const o of G.cars) {
    if (o === car || o === G.playerCar) continue;
    const dx = o.x - car.x, dz = o.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < dist && side < 3) return true;
  }
  // player on foot in front
  if (!G.inCar) {
    const dx = G.player.x - car.x, dz = G.player.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < dist && side < 2.5) return true;
  }
  return false;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car === G.playerCar) continue;
    if (car.police) continue; // police handled by police.js
    if (!car.target) pickNextTarget(G, car);
    const dx = car.target.x - car.x, dz = car.target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) { pickNextTarget(G, car); continue; }
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const turn = clamp(dh * 1.6, -1, 1);
    const blocked = carAhead(G, car, 9);
    const targetSpeed = blocked ? 0 : 11;
    car.speed = lerp(car.speed, targetSpeed, clamp(dt * 1.5, 0, 1));
    car.heading += turn * clamp(car.speed / 8, 0, 1) * dt * 1.9;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // keep on the right side of the road
    const side = 3.2;
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    car.x += rx * 0; // (lane offset applied at spawn; grid driving keeps it near centre)
    const p = collideCircle(G, car.x, car.z, 2.2);
    car.x = p.x; car.z = p.z;
    car.model.position.set(car.x, 0, car.z);
    car.model.rotation.y = car.heading;
    for (const w of car.model.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  }
}

// --- player driving (arcade) ---
export function drivePlayerCar(G, dt) {
  const car = G.playerCar;
  const inp = G.input;
  const fwd = (inp.up ? 1 : 0) - (inp.down ? 0.75 : 0);
  const steerIn = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
  car.speed += fwd * car.type.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  if (!fwd) car.speed = lerp(car.speed, 0, clamp(dt * 0.8, 0, 1));
  car.speed = clamp(car.speed, -12, car.type.top);
  const steerTarget = steerIn * 0.55 * clamp(Math.abs(car.speed) / 10, 0.15, 1) * (car.speed >= 0 ? 1 : -1);
  car.steer = lerp(car.steer, steerTarget, clamp(dt * 6, 0, 1));
  car.heading += car.steer * clamp(Math.abs(car.speed) / 8, 0, 1.4) * dt * 1.6;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const p = collideCircle(G, nx, nz, 2.3);
  if (Math.abs(p.x - nx) > 0.01 || Math.abs(p.z - nz) > 0.01) {
    car.speed *= 0.55; // crash scrub
    G.audio.thud();
    if (Math.abs(car.speed) > 14) damagePlayer(G, 4);
  }
  car.x = p.x; car.z = p.z;
  // bump into other cars
  for (const o of G.cars) {
    if (o === car) continue;
    const d = Math.hypot(o.x - car.x, o.z - car.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const ux = (car.x - o.x) / d, uz = (car.z - o.z) / d;
      car.x += ux * push; car.z += uz * push;
      if (!o.police) { o.x -= ux * push; o.z -= uz * push; o.speed *= 0.5; }
      car.speed *= 0.85;
      if (Math.abs(car.speed) > 10) { G.addWanted(1, 'tabrakan'); G.audio.thud(); }
    }
  }
  car.model.position.set(car.x, 0, car.z);
  car.model.rotation.y = car.heading;
  for (const w of car.model.userData.wheels) {
    w.rotation.x += car.speed * dt * 2.4;
    w.rotation.y = car.steer * 0.5;
  }
  G.audio.engine(Math.abs(car.speed) / car.type.top, car.speed);
}

// Spawn ambient traffic + parked cars.
export function spawnTraffic(G) {
  const rng = G.rng;
  const lines = roadLines();
  for (let i = 0; i < 16; i++) {
    const along = pick(rng, lines);
    const cross = rand(rng, -CITY.half + 20, CITY.half - 20);
    const horizontal = rng() < 0.5;
    const x = horizontal ? cross : along + (rng() < 0.5 ? 3.4 : -3.4);
    const z = horizontal ? along + (rng() < 0.5 ? 3.4 : -3.4) : cross;
    const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = spawnCar(G, x, z, heading);
    car.speed = rand(rng, 6, 11);
    pickNextTarget(G, car);
  }
  // parked cars along curbs
  for (let i = 0; i < 10; i++) {
    const along = pick(rng, lines);
    const cross = rand(rng, -CITY.half + 20, CITY.half - 20);
    const horizontal = rng() < 0.5;
    const x = horizontal ? cross : along + 5.6;
    const z = horizontal ? along + 5.6 : cross;
    const car = spawnCar(G, x, z, horizontal ? Math.PI / 2 : 0, { driver: false });
    car.speed = 0;
  }
  // player starter car near the bar
  const start = spawnCar(G, -64, 78, Math.PI, { type: CAR_TYPES[1], color: 0x2471a3, driver: false });
  start.speed = 0;
}
