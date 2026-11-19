// Solara Bay — the wanted system: SBPD cruisers that chase and ram, and the
// police helicopter that circles above the player at three stars and up.
import * as THREE from 'three';
import { MAX_WANTED, WORLD } from './config.js';
import { spawnCar, driveCar } from './vehicles.js';
import { collideBuildings } from './city.js';

export function addWanted(state, n, audio) {
  if (state.wanted >= MAX_WANTED) return;
  state.wanted = Math.min(MAX_WANTED, state.wanted + n);
  state.crimeTimer = 0;
  state.wantedTimer = 0;
  if (audio && state.wanted >= 2) audio.sirenBlip();
}

export function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f6e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6.4), bodyMat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 5.2), bodyMat);
  tail.position.set(0, 0.2, -5);
  g.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.9, 1.8),
    new THREE.MeshLambertMaterial({ color: 0xbfe8ff }),
  );
  glass.position.set(0, 0.3, 2.4);
  g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.14, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.5, 0.4, -7.2);
  g.add(tailRotor);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.x = Math.PI;
  beam.position.y = -21;
  g.add(beam);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.22 }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -41;
  g.add(spot);
  g.userData.rotor = rotor;
  g.userData.beam = beam;
  g.userData.spot = spot;
  return g;
}

export function updatePolice(state, scene, dt, audio) {
  // Wanted decays after 25 quiet seconds.
  if (state.wanted > 0) {
    state.crimeTimer += dt;
    if (state.crimeTimer > 25) {
      state.wanted -= 1;
      state.crimeTimer = 0;
      state.wantedTimer = 0;
    }
  }

  // Keep the cruiser count matched to the wanted level.
  const want = Math.min(state.wanted + 1, 5);
  const alive = state.police.filter((c) => c.hp > 0);
  state.police = alive;
  if (state.wanted > 0 && alive.length < want) {
    const angle = Math.random() * Math.PI * 2;
    const px = state.player.x + Math.cos(angle) * 55;
    const pz = state.player.z + Math.sin(angle) * 55;
    const car = spawnCar(state, scene, 'police',
      Math.max(-190, Math.min(190, px)), Math.max(-190, Math.min(190, pz)),
      Math.atan2(state.player.x - px, state.player.z - pz), {});
    state.police.push(car);
  }
  // Drop far-away cruisers when the heat is off.
  if (state.wanted === 0) {
    for (const car of [...state.police]) {
      scene.remove(car.mesh);
      state.cars.splice(state.cars.indexOf(car), 1);
    }
    state.police = [];
  }

  // Chase: steer at the player, ram, and push.
  const p = state.player;
  for (const car of state.police) {
    if (car.hp <= 0) continue;
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
    const throttle = dist > 7 ? 1 : 0.6;
    const before = { x: car.x, z: car.z };
    driveCar(state, car, dt, throttle, 0);
    // Ram the player when close.
    if (dist < 4.5) {
      if (p.onFoot && p.invuln <= 0) {
        state.health -= 6 * dt * 10;
        p.invuln = 0.6;
        if (audio) audio.crash();
      } else if (!p.onFoot && p.car) {
        p.car.speed *= 0.92;
        car.speed *= 0.8;
      }
    }
    // Unstick: if a cruiser barely moved, nudge its heading.
    if (Math.hypot(car.x - before.x, car.z - before.z) < 0.02 && dist > 10) {
      car.heading += 0.8 * dt;
    }
    if (car.mesh.userData.lightbar) {
      car.mesh.userData.lightbar.material.color.setHex(
        Math.floor(state.time * 6) % 2 === 0 ? 0xff2222 : 0x2244ff,
      );
    }
  }

  // Helicopter at 3 stars and up.
  if (state.wanted >= 3) {
    if (!state.heli) {
      const mesh = makeHeliMesh();
      scene.add(mesh);
      state.heli = { mesh, angle: 0, x: p.x, z: p.z };
    }
    const heli = state.heli;
    heli.angle += dt * 0.55;
    const tx = p.x + Math.cos(heli.angle) * 26;
    const tz = p.z + Math.sin(heli.angle) * 26;
    heli.x += (tx - heli.x) * Math.min(1, dt * 1.2);
    heli.z += (tz - heli.z) * Math.min(1, dt * 1.2);
    heli.mesh.position.set(heli.x, 42, heli.z);
    heli.mesh.rotation.y = Math.atan2(p.x - heli.x, p.z - heli.z);
    heli.mesh.userData.rotor.rotation.y += dt * 22;
    heli.mesh.userData.beam.position.x = 0;
    heli.mesh.userData.spot.position.set(p.x - heli.x, -41, p.z - heli.z);
    heli.mesh.userData.beam.lookAt(0, 0, 0);
    if (audio && Math.random() < dt * 0.25) audio.sirenBlip();
  } else if (state.heli) {
    scene.remove(state.heli.mesh);
    state.heli = null;
  }
}

export function damagePoliceCar(state, car, dmg) {
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.mesh.rotation.z = 0.5;
    car.traffic = false;
    car.police = false;
    state.police = state.police.filter((c) => c !== car);
  }
}
