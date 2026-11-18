// Screenshot presets (?shot=...): place the player straight into a lively scene
// so screenshots show several systems at once. Also used by the start screen.

import { setTimeOfDay } from './weather.js';
import { startStoryMission, startSideMission } from './missions.js';
import { spawnCar } from './vehicles.js';
import { enterCar } from './player.js';

export function applyShot(G, name) {
  const p = G.player;
  if (name === 'chase') {
    // daytime police chase: player driving, wanted 3, two patrol cars behind
    setTimeOfDay(G, 14);
    G.weather.raining = false;
    p.x = -64; p.z = 32; p.heading = 0; p.camYaw = 0;
    const car = spawnCar(G, -64, 32, 0, { type: { name: 'Coupe', w: 1.9, l: 4.3, top: 40, accel: 19, grip: 1.1 }, color: 0xc0392b, driver: false });
    car.speed = 24;
    enterCar(G, car);
    G.addWanted(3, 'polisi mengejarmu');
    G.hud.setObjective('Kabur dari polisi — hilangkan wanted level');
    G.hud.flash('Wanted 3 bintang — polisi mengejarmu!');
  } else if (name === 'night') {
    // on foot downtown at night, rain, neon windows
    setTimeOfDay(G, 22);
    G.weather.raining = true; G.weather.rainTimer = 300;
    p.x = -64; p.z = 8; p.heading = Math.PI * 0.75; p.camYaw = Math.PI * 0.75;
    p.weapon = 'pistol';
    G.hud.setObjective('Jelajahi Solara Bay di malam hari.');
  } else if (name === 'mission') {
    // story mission 2 in progress at the harbor, sunset, goons present
    setTimeOfDay(G, 18.5);
    startStoryMission(G, 1);
    p.x = 0; p.z = -220; p.heading = Math.PI; p.camYaw = Math.PI;
    p.weapon = 'smg';
    p.ammo.smg = 60;
    if (!p.weaponsOwned.includes('smg')) p.weaponsOwned.push('smg');
  } else if (name === 'harbor') {
    // wide view of the bay, pier and skyline at golden hour
    setTimeOfDay(G, 17.5);
    p.x = 0; p.z = -228; p.heading = Math.PI; p.camYaw = Math.PI;
    p.camDist = 12;
    G.hud.setObjective('Port Solara — pelabuhan milik keluarga Kessler.');
  } else if (name === 'onfoot') {
    setTimeOfDay(G, 10);
    p.x = -64; p.z = 88; p.heading = Math.PI; p.camYaw = Math.PI;
    G.hud.setObjective('Pergi ke The Rusty Anchor untuk memulai cerita.');
  }
  p.model.position.set(p.x, 0, p.z);
  p.model.rotation.y = p.heading;
}
