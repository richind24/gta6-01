// Player: on-foot movement, entering/exiting vehicles, health and camera.

import { clamp, lerp, lerpAngle, dist2d } from './config.js';
import { collideCircle } from './world.js';
import { animateWalk, animateIdle, makePersonModel } from './people.js';

export function createPlayer(G) {
  const model = null; // built in initPlayer after people.js import cycle is avoided
  return {
    x: -64, z: 88, heading: Math.PI, speed: 0, phase: 0,
    health: 100, money: 250, model: null,
    weapon: 'fists', ammo: { pistol: 24, smg: 0, shotgun: 0 },
    weaponsOwned: ['fists', 'pistol'],
    camYaw: Math.PI, camPitch: 0.32, camDist: 7.5,
    invuln: 0, dead: false,
  };
}

export function initPlayerModel(G, makePersonModel) {
  G.player.model = makePersonModel(G, 0xe0ac69, 0x2c3e50, 0x1a1a1a, true);
  G.player.model.position.set(G.player.x, 0, G.player.z);
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player, inp = G.input;
  const run = inp.shift ? 1.8 : 1;
  // movement relative to camera yaw
  let mx = 0, mz = 0;
  if (inp.up) { mx += Math.sin(p.camYaw); mz += Math.cos(p.camYaw); }
  if (inp.down) { mx -= Math.sin(p.camYaw); mz -= Math.cos(p.camYaw); }
  if (inp.left) { mx -= Math.cos(p.camYaw); mz += Math.sin(p.camYaw); }
  if (inp.right) { mx += Math.cos(p.camYaw); mz -= Math.sin(p.camYaw); }
  const moving = Math.hypot(mx, mz) > 0.01;
  const targetSpeed = moving ? 4.6 * run : 0;
  p.speed = lerp(p.speed, targetSpeed, clamp(dt * 8, 0, 1));
  if (moving) {
    const want = Math.atan2(mx, mz);
    p.heading = lerpAngle(p.heading, want, clamp(dt * 10, 0, 1));
    p.phase += dt * p.speed * 2.2;
    animateWalk(p.model, p.phase, clamp(p.speed / 4.6, 0, 1.6));
  } else animateIdle(p.model, G.time);
  const nx = p.x + Math.sin(p.heading) * p.speed * dt;
  const nz = p.z + Math.cos(p.heading) * p.speed * dt;
  const c = collideCircle(G, nx, nz, 0.55);
  p.x = c.x; p.z = c.z;
  // bump into cars: push them slightly, slow player
  for (const car of G.cars) {
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < 2.6 && d > 0.01) {
      const ux = (p.x - car.x) / d, uz = (p.z - car.z) / d;
      p.x = car.x + ux * 2.6; p.z = car.z + uz * 2.6;
    }
  }
  p.model.position.set(p.x, 0, p.z);
  p.model.rotation.y = p.heading;
  if (p.invuln > 0) p.invuln -= dt;
}

export function nearestCar(G, maxDist) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    const d = dist2d(car.x, car.z, G.player.x, G.player.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

// Enter the nearest car (steal it if it has a driver).
export function enterCar(G, car) {
  const p = G.player;
  if (car.driver && car.npc && !car.police) {
    // steal: driver flees, witnesses may call the cops
    car.driver = false;
    G.addWanted(1, 'mencuri mobil');
    G.hud.flash('Mobil dicuri! Polisi diberitahu.');
    G.audio.sirenBlip();
    // driver becomes a panicking pedestrian
    const dModel = makePersonModel(G, 0xc68642, 0xd64545, 0x2c3e50, false);
    dModel.position.set(car.x + 2, 0, car.z + 2);
    const ped = { model: dModel, x: car.x + 2, z: car.z + 2, heading: 0, speed: 2, target: null, wait: 0, panic: 6, phase: 0 };
    dModel.userData.ownerRef = { kind: 'ped', ref: ped };
    G.peds.push(ped);
  }
  G.playerCar = car;
  car.npc = false;
  car.target = null;
  G.inCar = true;
  p.model.visible = false;
  G.hud.setPrompt('');
  G.audio.engine(0, 0);
  return true;
}

export function exitCar(G) {
  const p = G.player, car = G.playerCar;
  if (!car) return;
  const side = { x: car.x + Math.cos(car.heading) * 2.2, z: car.z - Math.sin(car.heading) * 2.2 };
  const c = collideCircle(G, side.x, side.z, 0.55);
  p.x = c.x; p.z = c.z;
  p.heading = car.heading;
  G.inCar = false;
  G.playerCar = null;
  p.model.visible = true;
  p.model.position.set(p.x, 0, p.z);
  car.speed = 0;
  car.npc = true;
  G.audio.engine(0, 0);
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0 || p.dead) return;
  p.health -= amount;
  p.invuln = 0.4;
  G.hud.damageFlash();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.wasted();
  }
}
