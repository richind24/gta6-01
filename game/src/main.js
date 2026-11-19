// Solara Bay — boot, the game loop, the player on foot and behind the wheel,
// combat, shops, the safehouse, and the mission flow. The whole city runs here.
import * as THREE from 'three';
import { WORLD, PLACES, WEAPONS, PRICES } from './config.js';
import { createState, resetProgress } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideBuildings, clampToLand } from './city.js';
import { makeCarMesh, spawnCar, nearestCar, driveCar, updateTraffic, seedTraffic } from './vehicles.js';
import { seedPeds, updatePeds, scarePeds, knockDownPed } from './pedestrians.js';
import { addWanted, updatePolice, damagePoliceCar } from './police.js';
import { STORY_MISSIONS, SIDE_MISSIONS, startMission, updateMission, nextStoryIndex } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { createRender } from './render.js';
import { setupShots } from './shots.js';

const state = createState();
state.errors = [];
window.addEventListener('error', (e) => {
  state.errors.push(String(e.message || e.error || 'unknown error'));
  if (state.errors.length > 20) state.errors.shift();
});

const canvas = document.getElementById('game');
const render = createRender(canvas);
const { scene } = render;
const input = createInput(canvas);
const audio = createAudio(state);
const hud = createHud(state, audio);
const city = buildCity(scene, state);

// Player mesh: a pedestrian figure with a shirt, head and blob shadow.
function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: 0x2f6fd0 }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.85;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xe23b3b }),
  );
  cap.position.y = 1.92;
  g.add(cap);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  g.add(shadow);
  return g;
}

const playerMesh = makePlayerMesh();
scene.add(playerMesh);
seedTraffic(state, scene);
seedPeds(state, scene);

let fps = 0;
let fpsFrames = 0;
let fpsTimer = 0;
let autosaveTimer = 0;
let savedMissionDone = false;
let bustTimer = 0;
let shopOpen = null;
let eCooldown = 0;
let crimeCooldown = 0;

const game = {
  state, audio, fps: 0,
  setPlaying() { state.mode = 'playing'; state.cinematic = null; hideOverlays(); },
  clearCinematic() { state.cinematic = null; },
  setCinematic(c) { state.cinematic = c; state.cinematicSnap = true; },
  teleport(x, z) {
    state.player.x = x; state.player.z = z;
    playerMesh.position.set(x, 0, z);
  },
  nearestParkedSport() {
    let best = null; let bestD = 1e9;
    for (const c of state.cars) {
      if (c.type !== 'sport' || c.police) continue;
      const d = Math.hypot(c.x - state.player.x, c.z - state.player.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  },
  spawnParkedCar(type, x, z, heading) {
    return spawnCar(state, scene, type, x, z, heading, { parked: true });
  },
  boatCar() {
    return state.cars.find((c) => c.type === 'boat');
  },
  spawnPoliceBurst(n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.6;
      const car = spawnCar(state, scene, 'police',
        state.player.x + Math.cos(a) * 42, state.player.z + Math.sin(a) * 42,
        Math.atan2(state.player.x - (state.player.x + Math.cos(a) * 42), state.player.z - (state.player.z + Math.sin(a) * 42)), {});
      state.police.push(car);
    }
  },
  enterCar(car, free = false) {
    if (!car) return false;
    if (car.type === 'boat' && !state.ownBoat && !free) {
      hud.toast('That skiff belongs to the marina — buy it for $12,000');
      return false;
    }
    if (car.traffic) {
      car.traffic = false;
      car.driver = false;
      if (!free) { addWanted(state, 1, audio); state.stats.carsStolen += 1; hud.toast('Car stolen! The SBPD noticed.'); }
    } else if (car.parked && !free) {
      addWanted(state, 1, audio);
      state.stats.carsStolen += 1;
      hud.toast('Car stolen! The SBPD noticed.');
    }
    car.parked = false;
    state.player.car = car;
    state.player.onFoot = false;
    state.player.speed = 0;
    audio.door();
    return true;
  },
  exitCar() {
    const car = state.player.car;
    if (!car) return;
    car.speed = 0;
    car.parked = true;
    const side = { x: car.x + Math.cos(car.heading) * 3.4, z: car.z - Math.sin(car.heading) * 3.4 };
    const fixed = collideBuildings(state, side.x, side.z, 1);
    state.player.x = fixed.x;
    state.player.z = fixed.z;
    state.player.car = null;
    state.player.onFoot = true;
    playerMesh.position.set(state.player.x, 0, state.player.z);
    audio.door();
  },
};
game.enterCar = game.enterCar.bind(game);
game.exitCar = game.exitCar.bind(game);

function hideOverlays() {
  for (const id of ['menu', 'pause', 'end', 'shop']) {
    const n = document.getElementById(id);
    if (n) n.style.display = 'none';
  }
}

function showMenu() {
  state.mode = 'menu';
  const menu = document.getElementById('menu');
  if (menu) menu.style.display = 'flex';
  const list = document.getElementById('mission-list');
  if (list) {
    list.innerHTML = '';
    for (const m of STORY_MISSIONS) {
      const done = state.missionsDone.includes(m.id);
      const li = document.createElement('li');
      li.textContent = (done ? '✓ ' : '○ ') + m.title + ' — $' + m.reward.toLocaleString('en-US');
      if (done) li.className = 'done';
      list.appendChild(li);
    }
    for (const m of SIDE_MISSIONS) {
      const done = state.sideDone.includes(m.id);
      const li = document.createElement('li');
      li.textContent = (done ? '✓ ' : '○ ') + m.title + ' (side) — $' + m.reward.toLocaleString('en-US');
      if (done) li.className = 'done';
      else {
        li.className = 'clickable';
        li.title = 'Click to start this side job';
        li.addEventListener('click', () => {
          audio.ensure();
          hideOverlays();
          state.mode = 'playing';
          startMission(state, m, audio);
          hud.toast('Side job: ' + m.title + ' — ' + m.brief);
        });
      }
      list.appendChild(li);
    }
  }
  const cont = document.getElementById('btn-continue');
  if (cont) cont.style.display = hasSave() ? 'inline-block' : 'none';
}

function startPlaying(fresh) {
  audio.ensure();
  if (fresh) {
    resetProgress(state);
    state.errors = [];
  }
  state.cinematic = null;
  hideOverlays();
  state.mode = 'playing';
  hud.toast('Welcome to Solara Bay — press M to start your first job');
}

document.getElementById('btn-start').addEventListener('click', () => startPlaying(true));
document.getElementById('btn-continue').addEventListener('click', () => {
  const data = loadGame();
  if (data) applySave(state, data);
  audio.ensure();
  state.cinematic = null;
  hideOverlays();
  state.mode = 'playing';
  hud.toast('Save loaded — welcome back to Solara Bay');
});
document.getElementById('btn-resume').addEventListener('click', () => {
  hideOverlays();
  state.mode = 'playing';
});
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
document.getElementById('btn-quit').addEventListener('click', () => { showMenu(); });
document.getElementById('btn-next').addEventListener('click', () => {
  hideOverlays();
  state.mode = 'playing';
  const next = nextStoryIndex(state);
  if (next >= 0) startMission(state, STORY_MISSIONS[next], audio);
  else hud.toast('Free roam — Solara Bay is yours');
});
document.getElementById('btn-freeroam').addEventListener('click', () => {
  hideOverlays();
  state.mode = 'playing';
});
document.getElementById('btn-close-shop').addEventListener('click', () => {
  document.getElementById('shop').style.display = 'none';
  shopOpen = null;
  state.mode = 'playing';
});

// --- Shops ---------------------------------------------------------------
const SHOP_ITEMS = {
  gunshop: [
    { name: 'Ammo box (+48 pistol)', price: PRICES.ammoBox, buy() { state.ammo.pistol += 48; } },
    { name: 'VSP SMG — $1,500', price: 1500, buy() { if (!state.weaponsOwned.includes('smg')) state.weaponsOwned.push('smg'); state.ammo.smg += 64; state.mag.smg = 32; } },
    { name: 'Street Sweeper — $3,500', price: 3500, buy() { if (!state.weaponsOwned.includes('shotgun')) state.weaponsOwned.push('shotgun'); state.ammo.shotgun += 12; state.mag.shotgun = 6; } },
    { name: 'Body armor — $400', price: PRICES.armor, buy() { state.armor = 100; } },
    { name: 'Medkit — $150', price: PRICES.medkit, buy() { state.health = 100; } },
  ],
  garage: [
    { name: 'Repair car — $250', price: PRICES.garageRepair, buy() { if (state.player.car) state.player.car.hp = 100; } },
    { name: 'Engine upgrade — $4,000', price: PRICES.garageUpgrade, buy() { state.garageLevel += 1; } },
  ],
  marina: [
    { name: 'Marina Skiff — $12,000', price: PRICES.boat, buy() { state.ownBoat = true; } },
  ],
};

function openShop(kind, title) {
  shopOpen = kind;
  state.mode = 'shop';
  const panel = document.getElementById('shop');
  document.getElementById('shop-title').textContent = title;
  const items = document.getElementById('shop-items');
  items.innerHTML = '';
  for (const item of SHOP_ITEMS[kind]) {
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.textContent = item.name + ' — $' + item.price.toLocaleString('en-US');
    btn.addEventListener('click', () => {
      if (kind === 'marina' && state.ownBoat) { hud.toast('You already own the skiff'); return; }
      if (state.money < item.price) { hud.toast('Not enough cash'); audio.fail(); return; }
      state.money -= item.price;
      item.buy();
      audio.cash();
      hud.toast('Bought: ' + item.name);
    });
    items.appendChild(btn);
  }
  panel.style.display = 'block';
}

// --- Combat --------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tracerGeo = new THREE.BufferGeometry();
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe066 });
const tracer = new THREE.Line(tracerGeo, tracerMat);
tracer.visible = false;
tracer.frustumCulled = false;
scene.add(tracer);
let tracerTimer = 0;

function aimPoint() {
  const ndc = new THREE.Vector2(
    (input.mouseX / window.innerWidth) * 2 - 1,
    -(input.mouseY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, render.camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, hit);
  return hit || new THREE.Vector3(state.player.x, 0, state.player.z);
}

function fireWeapon() {
  const w = WEAPONS[state.weapon];
  if (state.player.shootCooldown > 0) return;
  if ((state.mag[state.weapon] ?? 0) <= 0) {
    reloadWeapon();
    return;
  }
  state.player.shootCooldown = w.rate;
  state.mag[state.weapon] -= 1;
  state.stats.shotsFired += 1;
  audio.shoot();
  const target = aimPoint();
  const from = new THREE.Vector3(state.player.x, 1.4, state.player.z);
  tracerGeo.setFromPoints([from, new THREE.Vector3(target.x, 1.2, target.z)]);
  tracer.visible = true;
  tracerTimer = 0.08;
  scarePeds(state, target.x, target.z, 18);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = w.pellets ? 2.2 : 0;
    const tx = target.x + (Math.random() - 0.5) * spread;
    const tz = target.z + (Math.random() - 0.5) * spread;
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - tx, ped.z - tz) < 3.2 && Math.hypot(ped.x - state.player.x, ped.z - state.player.z) < w.range) {
        knockDownPed(state, ped);
        if (crimeCooldown <= 0) { addWanted(state, 1, audio); crimeCooldown = 2; }
        audio.hit();
      }
    }
    // Police and traffic cars.
    for (const car of state.cars) {
      if (car === state.player.car) continue;
      if (Math.hypot(car.x - tx, car.z - tz) < 4.2 && Math.hypot(car.x - state.player.x, car.z - state.player.z) < w.range) {
        car.hp -= w.damage;
        if (car.police) {
          damagePoliceCar(state, car, 0);
          if (crimeCooldown <= 0) { addWanted(state, 1, audio); crimeCooldown = 2; }
        } else if (car.traffic) {
          car.traffic = false;
          car.speed = 0;
          if (crimeCooldown <= 0) { addWanted(state, 1, audio); crimeCooldown = 2; }
        }
        audio.hit();
      }
    }
    // Kessler's car (final mission).
    const m = state.mission;
    if (m && m.chaseCar && Math.hypot(m.chaseCar.x - tx, m.chaseCar.z - tz) < 4.5) {
      m.chaseCar.hp -= w.damage;
      audio.hit();
    }
  }
}

function reloadWeapon() {
  const w = WEAPONS[state.weapon];
  const need = w.mag - (state.mag[state.weapon] ?? 0);
  if (need <= 0) return;
  const have = state.ammo[state.weapon] ?? 0;
  const take = Math.min(need, have);
  if (take <= 0) {
    if (!state.lastAmmoToast || state.time - state.lastAmmoToast > 2) {
      state.lastAmmoToast = state.time;
      hud.toast('Out of ammo — buy more at Ironclad Arms');
    }
    return;
  }
  state.ammo[state.weapon] -= take;
  state.mag[state.weapon] = (state.mag[state.weapon] ?? 0) + take;
  audio.reload();
}

// --- The loop ------------------------------------------------------------
const clock = new THREE.Clock();
let lastMode = 'menu';

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  fpsFrames += 1;
  fpsTimer += dt;
  if (fpsTimer >= 1) { fps = fpsFrames; game.fps = fps; fpsFrames = 0; fpsTimer = 0; }

  if (state.mode === 'playing' || state.mode === 'missiondone' || state.mode === 'finished') {
    state.time += dt;
    state.clock = (state.clock + dt * 12) % 86400;
    if (state.player.shootCooldown > 0) state.player.shootCooldown -= dt;
    if (state.player.invuln > 0) state.player.invuln -= dt;
    if (crimeCooldown > 0) crimeCooldown -= dt;
    if (eCooldown > 0) eCooldown -= dt;
    if (tracerTimer > 0) { tracerTimer -= dt; if (tracerTimer <= 0) tracer.visible = false; }

    // Health regen while calm.
    if (state.wanted === 0 && state.health < 100) state.health = Math.min(100, state.health + 0.6 * dt);

    updatePlayer(dt);
    updateTraffic(state, scene, dt, Math.random);
    updatePeds(state, dt);
    updatePolice(state, scene, dt, audio);
    updateChaseCar(dt);
    audio.update(dt);
    city.update(dt, state.time);

    // Missions.
    if (state.mission) {
      const res = updateMission(state, dt, audio);
      if (res === 'failed') {
        state.mode = 'playing';
        hud.toast('Mission failed — press M to retry');
      }
    }
    if (state.mode === 'missiondone' && !savedMissionDone) {
      saveGame(state);
      savedMissionDone = true;
      const end = document.getElementById('end');
      const endTitle = document.getElementById('end-title');
      const endText = document.getElementById('end-text');
      const last = state.missionsDone[state.missionsDone.length - 1] || state.sideDone[state.sideDone.length - 1];
      if (end && endTitle) {
        endTitle.textContent = 'JOB DONE';
        endText.textContent = 'Mission complete — cash banked. Solara Bay remembers.';
        end.style.display = 'flex';
      }
    }
    if (state.mode !== 'missiondone') savedMissionDone = false;

    // Autosave.
    autosaveTimer += dt;
    if (autosaveTimer > 60) { autosaveTimer = 0; saveGame(state); }

    // Wasted / busted.
    if (state.health <= 0) {
      state.health = 100;
      state.money = Math.max(0, state.money - 150);
      state.wanted = 0;
      game.exitCar();
      game.teleport(PLACES.clinic.x, PLACES.clinic.z);
      hud.toast('WASTED — you woke up at the Bay Clinic, $150 lighter');
      audio.fail();
    }
    if (state.player.onFoot && state.wanted > 0) {
      const near = state.police.some((c) => Math.hypot(c.x - state.player.x, c.z - state.player.z) < 3.5);
      bustTimer = near ? bustTimer + dt : 0;
      if (bustTimer > 2.5) {
        bustTimer = 0;
        state.money = Math.max(0, state.money - 150);
        state.wanted = 0;
        game.teleport(PLACES.clinic.x, PLACES.clinic.z);
        hud.toast('BUSTED — the SBPD took $150 and dropped you at the clinic');
        audio.fail();
      }
    }

    handleKeys(dt);
    hud.update(dt);
  } else if (state.mode === 'menu') {
    // Slow orbit behind the menu so the city is alive in the background.
    state.time += dt;
    state.cinematic = { pos: [-60 + Math.sin(state.time * 0.05) * 40, 120, 120], look: [40, 0, -30] };
    updateTraffic(state, scene, dt, Math.random);
    updatePeds(state, dt);
    city.update(dt, state.time);
  }
  render.updateCamera(state, dt);
  render.render();
  lastMode = state.mode;
}

function updateChaseCar(dt) {
  const m = state.mission;
  if (!m || !m.chaseCar || m.chaseCar.hp <= 0) return;
  const car = m.chaseCar;
  const p = state.player;
  const away = Math.atan2(car.x - p.x, car.z - p.z);
  let dh = away - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
  driveCar(state, car, dt, 1, 0);
  // Ramming damage from the player's car.
  if (!p.onFoot && p.car && Math.hypot(p.car.x - car.x, p.car.z - car.z) < 4.6 && Math.abs(p.car.speed) > 6) {
    if (!car.lastRam || state.time - car.lastRam > 0.6) {
      car.lastRam = state.time;
      car.hp -= 18;
      audio.crash();
      hud.toast('Kessler\'s car is taking damage!');
    }
  }
  if (m.target) { m.target.x = car.x; m.target.z = car.z; }
}

function updatePlayer(dt) {
  const p = state.player;
  if (p.onFoot) {
    const axis = input.axis();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? 9.5 : 6.2;
    const len = Math.hypot(axis.x, axis.y) || 1;
    const dx = (axis.x / len) * speed * (axis.x || axis.y ? 1 : 0);
    const dz = (axis.y / len) * speed * (axis.x || axis.y ? 1 : 0);
    const nx = p.x + dx * dt;
    const nz = p.z + dz * dt;
    const fixed = collideBuildings(state, nx, nz, 0.9);
    const clamped = clampToLand(state, fixed.x, fixed.z, false);
    p.x = clamped.x;
    p.z = clamped.z;
    p.moving = !!(axis.x || axis.y);
    if (p.moving) p.heading = Math.atan2(dx, dz);
    playerMesh.position.set(p.x, Math.abs(Math.sin(state.time * 9)) * 0.08, p.z);
    playerMesh.rotation.y = p.heading;
    playerMesh.visible = true;
    if ((input.clicked || input.mouseDown) && state.weapon) {
      input.consumeClick();
      fireWeapon();
    }
    // Enter a nearby car.
    if (input.down('KeyE') && eCooldown <= 0) {
      const car = nearestCar(state, p.x, p.z, 4.5);
      if (car) {
        eCooldown = 0.4;
        game.enterCar(car);
      }
    }
  } else if (p.car) {
    const car = p.car;
    const throttle = input.down('KeyW') || input.down('ArrowUp') ? 1 : input.down('KeyS') || input.down('ArrowDown') ? -1 : 0;
    const steer = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    driveCar(state, car, dt, throttle, steer);
    if (input.down('Space')) car.speed *= Math.max(0, 1 - 3 * dt);
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    playerMesh.visible = false;
    if (input.down('KeyE') && eCooldown <= 0) {
      eCooldown = 0.4;
      game.exitCar();
    }
    if (input.down('KeyF')) audio.horn();
  }
  // Reload / weapon switch / radio / mission keys (both on foot and in car).
  if (input.down('KeyR')) reloadWeapon();
  if (input.down('Digit1') && state.weaponsOwned.includes('pistol')) state.weapon = 'pistol';
  if (input.down('Digit2') && state.weaponsOwned.includes('smg')) state.weapon = 'smg';
  if (input.down('Digit3') && state.weaponsOwned.includes('shotgun')) state.weapon = 'shotgun';
  if (input.down('KeyQ') && eCooldown <= 0) {
    eCooldown = 0.3;
    audio.cycleStation();
    hud.toast('Radio: ' + audio.stationName());
  }
}

function handleKeys(dt) {
  // Context prompt + interactions (E), mission start (M), pause.
  let prompt = '';
  const p = state.player;
  if (p.onFoot) {
    const car = nearestCar(state, p.x, p.z, 4.5);
    if (car) prompt = 'E — Steal ' + (car.type === 'boat' ? 'the skiff' : 'the ' + car.type);
    else {
      for (const key of Object.keys(PLACES)) {
        const place = PLACES[key];
        if (Math.hypot(p.x - place.x, p.z - place.z) < 10) {
          if (key === 'safehouse') prompt = 'E — Safehouse: save + heal';
          else if (key === 'gunshop') prompt = 'E — Ironclad Arms (weapons)';
          else if (key === 'garage') prompt = 'E — Solara Garage (repair / upgrade)';
          else if (key === 'marina') prompt = 'E — Solara Marina (buy the skiff $12,000)';
          else prompt = place.label;
          break;
        }
      }
    }
    if (prompt && input.down('KeyE') && eCooldown <= 0) {
      eCooldown = 0.4;
      for (const key of Object.keys(PLACES)) {
        const place = PLACES[key];
        if (Math.hypot(p.x - place.x, p.z - place.z) < 10) {
          if (key === 'safehouse') {
            state.health = 100;
            saveGame(state);
            hud.toast('Progress saved at the Safehouse — health restored');
            audio.cash();
          } else if (key === 'gunshop') openShop('gunshop', 'IRONCLAD ARMS');
          else if (key === 'garage') openShop('garage', 'SOLARA GARAGE');
          else if (key === 'marina') openShop('marina', 'SOLARA MARINA');
          break;
        }
      }
    }
  } else {
    prompt = 'E — Leave the car · W/S drive · Space brake';
  }
  hud.showPrompt(prompt);
  if (input.down('KeyM') && !state.mission && eCooldown <= 0) {
    eCooldown = 0.5;
    const next = nextStoryIndex(state);
    if (next >= 0) {
      const def = STORY_MISSIONS[next];
      startMission(state, def, audio);
      if (def.id === 'm10') spawnKessler();
      hud.toast('New job: ' + def.title + ' — ' + def.brief);
    } else {
      hud.toast('All story missions done — free roam, or try a side job from the menu');
    }
  }
  if ((input.down('Escape') || input.down('KeyP')) && eCooldown <= 0) {
    eCooldown = 0.5;
    state.mode = 'paused';
    document.getElementById('pause').style.display = 'flex';
  }
}

function spawnKessler() {
  const car = spawnCar(state, scene, 'sedan', 100, 100, Math.PI, { color: 0x111111 });
  car.hp = 150;
  car.traffic = false;
  state.mission.chaseCar = car;
  state.mission.target = { x: car.x, z: car.z, label: "Kessler's car" };
  hud.toast('Kessler is running — intercept his black sedan!');
}

// Wire the screenshot staging to this live game.
setupShots(game);

// Start on the menu, city already moving behind it.
showMenu();
frame();
