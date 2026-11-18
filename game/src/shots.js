// Screenshot presets (?shot=...): place the player straight into a lively scene
// so screenshots show several systems at once. Also used by the start screen.
// Rebuild (Nov 2026): EVERY preset is now bright noon (12:00) — the old set
// mixed sunset and night frames and the cover read muted. The cover preset is
// a live heli chase: wanted 4, two patrol cars, the helicopter in frame,
// mission m6 active, radio on.

import { forceNoon } from './weather.js';
import { startStoryMission } from './missions.js';
import { spawnCar } from './vehicles.js';
import { enterCar } from './player.js';
import { placeHeliAhead } from './heli.js';

export function applyShot(G, name) {
  const p = G.player;
  if (name === 'cover') {
    // THE cover: noon heli chase — player driving the red Coupe, wanted 4,
    // patrol cars closing in, helicopter ahead in frame, radio playing.
    forceNoon(G);
    startStoryMission(G, 5); // m6 Heat Wave: wanted 4, heli spawns
    p.x = -64; p.z = 32; p.heading = 0; p.camYaw = 0;
    p.camPitch = 0.15; // level camera: the heli must stay in the top of the frame
    p.camDist = 11;
    const car = spawnCar(G, -64, 32, 0, { type: { name: 'Coupe', w: 1.9, l: 4.3, top: 40, accel: 19, grip: 1.1 }, color: 0xc0392b, driver: false });
    car.speed = 24;
    enterCar(G, car);
    // heli low + close so it reads in frame (high orbit leaves the FOV)
    G.heli.height = 12;
    G.heli.radius = 26;
    // ambient traffic ahead on the same road so the chase reads busy
    for (const [tz, col] of [[90, 0x2471a3], [130, 0xd4ac0d], [170, 0x1e8449]]) {
      const t = spawnCar(G, -64 + (tz % 3 === 0 ? 3.4 : -3.4), tz, 0, { color: col, driver: true });
      t.speed = 10;
    }
    G.radio.setStation('bayview');
    G.hud.setObjective('Kabur dari helikopter polisi!');
    G.hud.flash('Wanted 4 bintang — helikopter mengejarmu!');
    // keep the heli pinned ahead of the player so it stays in the cover frame
    G.heli.pinAhead = true;
    setTimeout(() => placeHeliAhead(G), 300);
  } else if (name === 'mission') {
    // story mission 9 at the marina, noon, rifle out, goons + heli overhead
    forceNoon(G);
    startStoryMission(G, 8); // m9 High Tide: wanted 3, 3 goons at the marina
    p.x = 192; p.z = -220; p.heading = Math.PI; p.camYaw = Math.PI;
    p.camPitch = 0.15; // level camera so the pinned heli stays in frame
    p.camDist = 11;
    p.weapon = 'rifle';
    p.ammo.rifle = 20;
    if (!p.weaponsOwned.includes('rifle')) p.weaponsOwned.push('rifle');
    G.radio.setStation('rock');
    G.heli.height = 12; // same low orbit as the cover so the heli reads in frame
    G.heli.radius = 26;
    G.heli.pinAhead = true;
    setTimeout(() => placeHeliAhead(G), 300);
  } else if (name === 'city') {
    // on foot downtown at noon: shops, traffic, pedestrians, dense HUD
    forceNoon(G);
    p.x = -64; p.z = 8; p.heading = Math.PI * 0.75; p.camYaw = Math.PI * 0.75;
    p.weapon = 'pistol';
    p.money = 3250;
    G.radio.setStation('bayview');
    G.hud.setObjective('Jelajahi Solara Bay — toko, misi, dan radio menunggumu.');
  } else if (name === 'harbor') {
    // wide view of the bay, pier and skyline at bright noon
    forceNoon(G);
    p.x = 0; p.z = -228; p.heading = Math.PI; p.camYaw = Math.PI;
    p.camDist = 12;
    p.camPitch = 0.3;
    // a couple of cars near the harbor so the foreground is not empty road
    const c1 = spawnCar(G, -8, -210, Math.PI, { color: 0xc0392b, driver: false });
    c1.speed = 0;
    const c2 = spawnCar(G, 8, -240, 0, { color: 0x2471a3, driver: false });
    c2.speed = 0;
    G.radio.setStation('talk');
    G.hud.setObjective('Port Solara — pelabuhan milik keluarga Kessler.');
  } else if (name === 'onfoot') {
    forceNoon(G);
    p.x = -64; p.z = 88; p.heading = Math.PI; p.camYaw = Math.PI;
    G.hud.setObjective('Pergi ke The Rusty Anchor untuk memulai cerita.');
  }
  p.model.position.set(p.x, 0, p.z);
  p.model.rotation.y = p.heading;
}
