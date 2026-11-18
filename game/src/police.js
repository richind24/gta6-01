// Wanted system + Solara PD: police cars and foot cops chase, ram and arrest.

import { clamp, lerp, rand, pick } from './config.js';
import { spawnCar } from './vehicles.js';
import { makePersonModel, animateWalk } from './people.js';
import { collideCircle } from './world.js';

const POLICE_TYPES = [
  { name: 'Interceptor', w: 2.0, l: 4.6, top: 42, accel: 22, grip: 1.1 },
];

export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + stars, 0, 5);
  G.wantedHeat = 1;
  G.wantedTimer = 0;
  if (G.wanted > before) {
    G.hud.flash(`Wanted naik ke ${G.wanted} bintang — ${reason}`);
    G.audio.sirenBlip();
  }
  syncPolice(G);
}

function desiredPolice(G) {
  if (G.wanted === 0) return 0;
  return Math.min(1 + G.wanted, 6);
}

function syncPolice(G) {
  const want = desiredPolice(G);
  while (G.policeCars.length < want) spawnPoliceCar(G);
  while (G.policeCars.length > want) {
    const c = G.policeCars.pop();
    G.scene.remove(c.model);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
}

function spawnPoliceCar(G) {
  const px = G.inCar ? G.playerCar.x : G.player.x;
  const pz = G.inCar ? G.playerCar.z : G.player.z;
  const ang = G.rng() * Math.PI * 2;
  const x = clamp(px + Math.sin(ang) * 90, -270, 270);
  const z = clamp(pz + Math.cos(ang) * 90, -270, 270);
  const car = spawnCar(G, x, z, Math.atan2(px - x, pz - z), { type: POLICE_TYPES[0], police: true, npc: false });
  car.speed = 20;
  G.policeCars.push(car);
  return car;
}

function spawnFootCop(G) {
  const px = G.player.x, pz = G.player.z;
  const ang = G.rng() * Math.PI * 2;
  const x = clamp(px + Math.sin(ang) * 40, -270, 270);
  const z = clamp(pz + Math.cos(ang) * 40, -270, 270);
  const model = makePersonModel(G, 0xe0ac69, 0x0a2a8f, 0x0a2a8f, false);
  const cop = { model, x, z, heading: 0, speed: 5.2, phase: 0, arrest: 0 };
  model.position.set(x, 0, z);
  model.userData.ownerRef = { kind: 'cop', ref: cop };
  G.cops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  // heat decays when the player stays out of sight / commits nothing
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    const hiding = G.inSafehouse || (G.wantedTimer > 25 && !G.recentCrime);
    if (G.wantedTimer > 30 || hiding) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.wantedTimer = 0;
      G.hud.flash(G.wanted > 0 ? `Wanted turun ke ${G.wanted} bintang` : 'Kamu lolos dari polisi.');
      syncPolice(G);
    }
    if (G.recentCrime) { G.recentCrime -= dt; if (G.recentCrime < 0) G.recentCrime = 0; }
  }

  const tx = G.inCar ? G.playerCar.x : G.player.x;
  const tz = G.inCar ? G.playerCar.z : G.player.z;
  const pSpeed = G.inCar ? Math.abs(G.playerCar.speed) : G.player.speed;

  for (const car of G.policeCars) {
    const dx = tx - car.x, dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    // pursue with slight weaving; ram when close
    const targetSpeed = dist < 6 ? 26 : (pSpeed > 20 ? 34 : 28);
    car.speed = lerp(car.speed, targetSpeed, clamp(dt * 1.2, 0, 1));
    car.heading += clamp(dh * 1.8, -1, 1) * clamp(car.speed / 10, 0, 1) * dt * 2.0;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const p = collideCircle(G, car.x, car.z, 2.2);
    car.x = p.x; car.z = p.z;
    // ram the player's car
    if (G.inCar && dist < 4.6) {
      const push = (4.6 - dist);
      const ux = (G.playerCar.x - car.x) / (dist || 1), uz = (G.playerCar.z - car.z) / (dist || 1);
      G.playerCar.x += ux * push * 0.5; G.playerCar.z += uz * push * 0.5;
      G.playerCar.speed *= 0.92;
      car.speed *= 0.9;
      if (Math.abs(G.playerCar.speed) > 8) G.audio.thud();
      if (Math.abs(G.playerCar.speed) < 3 && dist < 3.4) {
        // boxed in: cops drag the player out
        G.busted();
      }
    }
    car.model.position.set(car.x, 0, car.z);
    car.model.rotation.y = car.heading;
    for (const w of car.model.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
    // flashing light bar
    car.siren += dt * 6;
    if (car.model.userData.lightBar) {
      car.model.userData.lightBar.material.color.setHex(Math.sin(car.siren) > 0 ? 0xff2020 : 0x2040ff);
    }
  }

  // foot cops only chase when the player is on foot
  if (G.wanted > 0 && !G.inCar && !G.player.dead) {
    if (G.cops.length < Math.min(G.wanted, 3)) spawnFootCop(G);
    for (const cop of G.cops) {
      const dx = G.player.x - cop.x, dz = G.player.z - cop.z;
      const dist = Math.hypot(dx, dz);
      cop.heading = Math.atan2(dx, dz);
      cop.phase += dt * 8;
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      animateWalk(cop.model, cop.phase, 1.2);
      const p = collideCircle(G, cop.x, cop.z, 0.5);
      cop.x = p.x; cop.z = p.z;
      cop.model.position.set(cop.x, 0, cop.z);
      cop.model.rotation.y = cop.heading;
      if (dist < 1.6) {
        cop.arrest += dt;
        if (cop.arrest > 1.2) G.busted();
      } else cop.arrest = 0;
    }
  } else {
    // clear foot cops when wanted drops or player drives off
    for (const cop of G.cops) G.scene.remove(cop.model);
    G.cops.length = 0;
  }
}

export function clearPolice(G) {
  for (const c of G.policeCars) {
    G.scene.remove(c.model);
    const i = G.cars.indexOf(c);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.policeCars.length = 0;
  for (const cop of G.cops) G.scene.remove(cop.model);
  G.cops.length = 0;
  G.wanted = 0;
  G.wantedTimer = 0;
}
