// Solara Bay — shots.js
// One clear job: deterministic screenshot setups. The game reads ?shot=
// from the URL; each name stages a bright noon scene with a dense HUD and
// something happening, so the cover and the other screenshots are real
// renders of the same code the player runs. Nothing here edits the game:
// it only moves the player, the police and the mission state, then flags
// the frame ready for the screenshot tool.
import { STORY } from './config.js';

function putPlayerInCar(G, carIndex, x, z, heading) {
  const car = G.parkedCars[carIndex % G.parkedCars.length];
  car.x = x; car.z = z; car.heading = heading; car.speed = 20;
  car.syncMesh();
  G.player.inCar = true;
  G.player.car = car;
  G.player.x = x; G.player.z = z;
  G.player.mesh.visible = false;
}

function startMissionAt(G, index) {
  G.missions.missionIndex = index;
  G.missions.side = null;
  G.missions.active = false;
  G.missions.startCurrent();
}

export function stageShot(G, name) {
  G.shotName = name;
  // Every shot is noon: the sun never moves for the camera.
  G.clockMinutes = 12 * 60;
  if (name === 'cover') {
    // Noon police pursuit: Rico in a red sedan crossing Downtown, 3 stars,
    // helicopter overhead, patrol cars closing in, mission 2 on the HUD.
    putPlayerInCar(G, 0, -30, 0, 0);
    // The cover car reads best in bright red.
    G.player.car.mesh.children[0].material.color.setHex(0xe63946);
    G.police.setWanted(3);
    G.police.ensureHeli(G);
    // Park the helicopter north of the player at screenshot time
    // (it drifts 0.55 rad/s, the shot lands ~2.2 s after staging).
    G.police.heliAngle = 3.5;
    startMissionAt(G, 1);
    G.cash = 12450;
    G.health = 86;
    G.ammo = 42;
    G.hasPistol = true;
    G.cameraPreset = 'chase';
  } else if (name === 'mission') {
    // Harbor Lights on foot at the east docks, package beacon live.
    G.player.x = 168; G.player.z = 40;
    G.player.mesh.position.set(168, 0, 40);
    G.hasPistol = true; G.ammo = 60;
    startMissionAt(G, 1);
    G.police.setWanted(1);
    G.cash = 8300;
    G.cameraPreset = 'close';
  } else if (name === 'city') {
    // Downtown drive with traffic and a patrol car in the mirror.
    putPlayerInCar(G, 2, -30, 0, 0);
    G.police.setWanted(1);
    startMissionAt(G, 0);
    G.cash = 5200;
    G.cameraPreset = 'chase';
  } else if (name === 'harbor') {
    // Marina Bay at noon: the GT by the docks, mission 6 collecting drops.
    putPlayerInCar(G, G.parkedCars.length - 1, 150, 100, Math.PI / 2);
    G.player.car.speed = 0;
    startMissionAt(G, 5);
    G.police.setWanted(0);
    G.cash = 21400;
    G.health = 100;
    G.cameraPreset = 'wide';
  }
  G.shotReadyAt = G.time + 1.4;
}

export function shotTitle(name) {
  return {
    cover: 'Noon police pursuit — 3 stars, helicopter, mission active',
    mission: 'Harbor Lights on foot at the east docks',
    city: 'Downtown drive with traffic and a patrol car',
    harbor: 'Marina Bay and the harbour at noon',
  }[name] || 'Solara Bay';
}
