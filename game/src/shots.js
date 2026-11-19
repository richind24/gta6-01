// Solara Bay — deterministic screenshot setups. The game reads ?shot=
// from the URL; each name stages a bright noon scene with the HUD dense
// and something happening, so the cover and the other screenshots are
// real renders of the same code the player runs. Nothing here edits the
// game: it only moves the player, the police and the camera presets.

import { LANDMARKS } from './config.js';

export const SHOT_NAMES = ['cover', 'mission', 'city', 'harbor'];

export function applyShot(world, name) {
  const { player, police, traffic, missions, city, peds } = world;
  // Every shot is noon: bright sun, saturated sky, no dusk.
  world.setTimeOfDay(12.0);
  world.hideMenu();
  const putCar = (x, z, heading) => {
    const car = traffic.nearestStealable(x, z, 400);
    if (!car) return null;
    car.x = x; car.z = z; car.heading = heading;
    car.sync();
    return car;
  };
  if (name === 'cover') {
    // Noon pursuit down the beach road: red GT, two cruisers on its tail,
    // helicopter overhead, sea on the left, mission 7 active. The road
    // corridor keeps buildings out of the camera's way.
    const car = putCar(232, 40, 0);
    if (car) {
      player.enterCar(car);
      car.speed = 24;
      car.mesh.children[0].material.color.setHex(0xe63946);
    }
    player.x = 232; player.z = 40;
    police.setWanted(3, true);
    police.spawnTimer = 0;
    // One cruiser ahead in the frame (it chases back toward the player),
    // one behind (it chases into the frame).
    police.spawnCarAt(224, 78, 0);
    police.spawnCarAt(238, 14, 0);
    const ahead = traffic.cars.find((c) => c.isTraffic && !c.dead);
    if (ahead) { ahead.x = 236; ahead.z = 96; ahead.heading = 0; ahead.sync(); }
    if (!missions.active && missions.index <= 6) {
      missions.index = 6;
      missions.startNext();
    }
    world.setCameraPreset('chase');
  } else if (name === 'mission') {
    // On foot at the harbour, crates mission active, beacon glowing.
    player.resetTo(160, 250);
    if (!missions.active) {
      missions.index = 3;
      missions.startNext();
    }
    peds.spawnAt(138, 236, 0xe9c46a);
    peds.spawnAt(178, 262, 0x2a9d8f);
    world.setCameraPreset('follow');
  } else if (name === 'city') {
    // Downtown avenue drive: Juno eastbound on the -8 avenue, traffic
    // ahead, a patrol car behind, towers lining the road.
    const car = putCar(-120, -8, Math.PI / 2);
    if (car) { player.enterCar(car); car.speed = 20; }
    player.x = -120; player.z = -8;
    police.setWanted(1, true);
    police.spawnCarAt(-152, -8, Math.PI / 2);
    const movers = traffic.cars.filter((c) => c.isTraffic && !c.dead);
    if (movers[0]) { movers[0].x = -40; movers[0].z = -8; movers[0].heading = Math.PI / 2; movers[0].sync(); }
    if (movers[1]) { movers[1].x = 24; movers[1].z = -8; movers[1].heading = Math.PI / 2; movers[1].sync(); }
    if (!missions.active) {
      missions.index = 1;
      missions.startNext();
    }
    world.setCameraPreset('chase');
  } else if (name === 'harbor') {
    // On the docks: containers, cranes and the water at the bottom of
    // the frame, crates mission active with its beacon in view.
    player.resetTo(152, 280);
    if (!missions.active) {
      missions.index = 3;
      missions.startNext();
    }
    peds.spawnAt(164, 292, 0x457b9d);
    world.setCameraPreset('follow');
  }
  world.shotReady = true;
}

export function shotList() {
  return SHOT_NAMES.map((n, i) => `${i + 1}-${n}.jpg`);
}
