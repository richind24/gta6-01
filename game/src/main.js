// Solara Bay — bootstrap and game loop. Builds the world, wires input,
// menus, shops, the day cycle and the camera, and runs the frame loop.
// Everything the player sees flows through here; the systems themselves
// live in their own modules.

import * as THREE from 'three';
import { WORLD, TUNE, RADIO, LANDMARKS, mulberry32, clamp, lerp } from './config.js';
import { City } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { RadioAudio } from './audio.js';
import { saveGame, loadGame, clearSave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const AUTOPLAY = params.get('autoplay') === '1';

window.__solara = {
  ready: false, error: null, state: 'boot',
  getState: () => ({
    mode: state.mode, x: Math.round(player.x), z: Math.round(player.z),
    money: player.money, wanted: police.wanted, health: player.health,
    inCar: player.inCar, missionIndex: missions.index, missionsDone: missions.done,
    active: !!missions.active, objective: missions.objectiveText(),
    radio: audio.stationName(), cars: traffic.cars.length, peds: peds.peds.length,
    policeCars: police.cars.length, heli: police.heli.visible,
    fps: state.fps, speedKmh: Math.round(player.speedKmh),
  }),
  // Test hooks (play-test only): teleport, start a mission, force wanted.
  debug: {
    teleport: (x, z) => player.resetTo(x, z),
    startMission: () => startStory(),
    setWanted: (n) => police.setWanted(n),
    give: (n) => player.addMoney(n),
  },
};
window.addEventListener('error', (ev) => {
  window.__solara.error = String(ev.message || ev.error || 'unknown error');
});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x79c7f2);
scene.fog = new THREE.Fog(0x9fd4f2, 220, 620);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1600);
camera.position.set(0, 70, 60);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2c8, 2.2);
sun.position.set(180, 260, 120);
scene.add(sun);

const rng = mulberry32(20261119);
const city = new City(scene);
const traffic = new Traffic(scene, city, rng);
traffic.spawnInitial();
const peds = new Pedestrians(scene, city, rng);
peds.spawnInitial();
const player = new Player(scene, -88, 72);
const police = new Police(scene, city, traffic, rng);
const audio = new RadioAudio();
const hud = new HUD(document);
const world = {
  player, city, traffic, peds, police, audio, rng,
  toast: (msg) => hud.toast(msg),
  setTimeOfDay: (h) => { state.time = h * 3600; },
  hideMenu: () => { document.getElementById('menu').style.display = 'none'; state.mode = 'playing'; },
  setCameraPreset: (p) => { state.cameraPreset = p; },
  shotReady: false,
};
const missions = new Missions(scene, world);
world.missions = missions;
police.onBusted = (reason) => endRun(reason);
player.onShoot = () => {
  audio.shot();
  peds.scare(player.x, player.z, 50);
};
player.onDamage = () => { /* HUD flashes via health bar */ };

// --- input ---------------------------------------------------------------
const keys = {};
const input = { forward: false, back: false, left: false, right: false, run: false };
window.addEventListener('keydown', (ev) => {
  keys[ev.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  if (ev.code === 'KeyM') { audio.setMuted(!audio.muted); hud.toast(audio.muted ? 'Radio muted' : 'Radio on'); }
  if (ev.code === 'KeyR') { const st = audio.nextStation(); hud.toast('Radio: ' + st.name); }
  if (ev.code === 'Digit1') audio.setStation(0);
  if (ev.code === 'Digit2') audio.setStation(1);
  if (ev.code === 'Digit3') audio.setStation(2);
  if (ev.code === 'KeyN') startStory();
  if (ev.code === 'KeyJ') missions.startSide('taxi');
  if (ev.code === 'KeyK') missions.startSide('vigilante');
  if (ev.code === 'KeyL') missions.startSide('courier');
  if (ev.code === 'KeyF') doShoot();
  if (ev.code === 'KeyE') doInteract();
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
canvas.addEventListener('mousedown', (ev) => {
  if (state.mode !== 'playing') return;
  if (ev.button === 0) doShoot();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput() {
  input.forward = keys.KeyW || keys.ArrowUp;
  input.back = keys.KeyS || keys.ArrowDown;
  input.left = keys.KeyA || keys.ArrowLeft;
  input.right = keys.KeyD || keys.ArrowRight;
  input.run = keys.ShiftLeft || keys.ShiftRight;
}

// --- game state ------------------------------------------------------------
const state = {
  mode: 'menu', // menu | playing | paused | panel | over
  time: 12 * 3600, // seconds since midnight; noon by default
  cameraPreset: 'follow',
  cameraPos: new THREE.Vector3(-88, 70, 130),
  marinaOwned: false,
  garageCars: [],
  totalEarned: 0,
  marinaTimer: 0,
  saveTimer: 0,
  overReason: '',
};

function startStory() {
  if (state.mode !== 'playing') return;
  if (missions.active) { hud.toast('Mission already running: ' + missions.objectiveText()); return; }
  if (missions.startNext()) {
    const m = missions.current;
    hud.toast(`${m.title} — ${m.brief}`);
    audio.chime();
  } else {
    hud.toast('Story complete — you are the King of Solara Bay!');
  }
}

function doShoot() {
  if (state.mode !== 'playing' || player.inCar) return;
  const res = player.shoot(peds, police, traffic);
  if (!res) return;
  if (res.kind === 'empty') { hud.toast('Out of ammo — buy more at Solara Arms'); return; }
  if (res.kind === 'ped') {
    police.addHeat(2);
    missions.onShotKill();
    addTracer(player.x, player.z, player.heading);
  } else if (res.kind === 'police') {
    police.addHeat(1);
    addTracer(player.x, player.z, player.heading);
  } else {
    addTracer(player.x, player.z, player.heading);
  }
}

const tracers = [];
function addTracer(x, z, heading) {
  const len = 26;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x + Math.sin(heading) * 1.2, 1.4, z + Math.cos(heading) * 1.2),
    new THREE.Vector3(x + Math.sin(heading) * len, 1.4, z + Math.cos(heading) * len),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

function nearestLandmark(maxD = 10) {
  let best = null, bestD = maxD;
  for (const [id, L] of Object.entries(LANDMARKS)) {
    const d = Math.hypot(player.x - L.x, player.z - L.z);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

function doInteract() {
  if (state.mode === 'panel') { closePanel(); return; }
  if (state.mode !== 'playing') return;
  if (player.inCar) { player.exitCar(); return; }
  const lm = nearestLandmark(11);
  if (lm === 'safehouse') { openSafehouse(); return; }
  if (lm === 'gunshop') { openShop('arms'); return; }
  if (lm === 'burger') { openShop('food'); return; }
  if (lm === 'garage') { openShop('garage'); return; }
  if (lm === 'marina') { openShop('marina'); return; }
  const car = traffic.nearestStealable(player.x, player.z, 5.5);
  if (car) {
    player.enterCar(car);
    if (!car.stolen) {
      car.stolen = true;
      police.addHeat(1);
      hud.toast(`Stole a ${car.kind.name} — the PD noticed (+1★)`);
    }
    audio.engine(0.2);
  }
}

// --- panels (shops / safehouse / garage / marina) -------------------------
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');

function openPanel(title, rows) {
  panelTitle.textContent = title;
  panelBody.innerHTML = '';
  for (const r of rows) {
    const b = document.createElement('button');
    b.className = 'shop-btn';
    b.textContent = `${r.label} — $${r.price}`;
    b.disabled = player.money < r.price;
    b.onclick = () => { if (r.buy()) { player.addMoney(-r.price); state.totalEarned += 0; refreshPanel(title, rows); } };
    panelBody.appendChild(b);
  }
  const close = document.createElement('button');
  close.className = 'shop-btn ghost';
  close.textContent = 'Close (E)';
  close.onclick = closePanel;
  panelBody.appendChild(close);
  panel.style.display = 'block';
  state.mode = 'panel';
}

function refreshPanel(title, rows) { openPanel(title, rows); }

function closePanel() {
  panel.style.display = 'none';
  if (state.mode === 'panel') state.mode = 'playing';
}

function openSafehouse() {
  player.heal(100);
  player.armor = 50;
  const ok = saveGame({
    money: player.money, missionIndex: missions.index, missionsDone: missions.done,
    packagesFound: missions.packagesFound, x: player.x, z: player.z,
    health: player.health, armor: player.armor, ammo: player.ammo, weapon: player.weapon,
    garage: state.garageCars, marinaOwned: state.marinaOwned, totalEarned: state.totalEarned,
  });
  hud.toast(ok ? 'Saved at Casa Juno — healed up, armour topped off' : 'Save failed (private mode?)');
  audio.chime();
  state.mode = 'playing';
}

function openShop(kind) {
  if (kind === 'arms') {
    openPanel('Solara Arms — guns & gear', [
      { label: 'Pistol (weapon + 48 ammo)', price: 400, buy: () => { player.weapon = 1; player.ammo += 48; hud.toast('Pistol bought'); return true; } },
      { label: 'SMG (weapon + 120 ammo)', price: 1500, buy: () => { player.weapon = 2; player.ammo += 120; hud.toast('SMG bought'); return true; } },
      { label: 'Ammo box (+60)', price: 100, buy: () => { player.ammo += 60; hud.toast('Ammo +60'); return true; } },
      { label: 'Body armour (100)', price: 300, buy: () => { player.armor = 100; hud.toast('Armour fitted'); return true; } },
    ]);
  } else if (kind === 'food') {
    openPanel('Tide Burger — eat up', [
      { label: 'Tide Burger meal (heal 50)', price: 25, buy: () => { player.heal(50); hud.toast('Tasty. +50 health'); return true; } },
      { label: 'Double stack (full heal)', price: 60, buy: () => { player.heal(100); hud.toast('Full health'); return true; } },
    ]);
  } else if (kind === 'garage') {
    openPanel('Neon Garage — rides & repairs', [
      { label: 'Repair current ride', price: 200, buy: () => { hud.toast('Ride repaired'); return true; } },
      { label: 'Buy Sunset GT (stored here)', price: 12000, buy: () => { state.garageCars.push('Sunset GT'); hud.toast('Sunset GT is yours — find it at the garage'); return true; } },
      { label: 'Performance tune (+speed)', price: 4000, buy: () => { TUNE.carMaxSpeed += 4; hud.toast('Tuned! Top speed up'); return true; } },
    ]);
  } else if (kind === 'marina') {
    openPanel('Marina Bay — property', [
      { label: 'Buy the marina ($100 / min income)', price: 12000, buy: () => {
        if (state.marinaOwned) { hud.toast('You already own the marina'); return false; }
        state.marinaOwned = true; hud.toast('Marina Bay is yours — it pays $100 a minute'); return true;
      } },
    ]);
  }
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    document.getElementById('pause').style.display = 'flex';
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    document.getElementById('pause').style.display = 'none';
  }
}

function endRun(reason) {
  if (state.mode === 'over') return;
  state.mode = 'over';
  state.overReason = reason;
  const fine = Math.min(player.money, reason === 'busted' ? 150 : Math.floor(player.money * 0.1));
  player.addMoney(-fine);
  police.setWanted(0, true);
  document.getElementById('end-title').textContent = reason === 'busted' ? 'BUSTED!' : 'WASTED!';
  document.getElementById('end-text').textContent =
    (reason === 'busted' ? 'The Solara PD caught you. ' : 'Juno went down. ') +
    `You lost $${fine}. The city is still yours to take back.`;
  document.getElementById('end').style.display = 'flex';
}

// --- menus -----------------------------------------------------------------
const menuEl = document.getElementById('menu');
document.getElementById('btn-start').onclick = () => {
  audio.ensure();
  menuEl.style.display = 'none';
  state.mode = 'playing';
  hud.toast('Welcome to Solara Bay — press N to start mission 1');
};
document.getElementById('btn-continue').onclick = () => {
  const s = loadGame();
  if (!s) return;
  audio.ensure();
  player.money = s.money;
  player.health = s.health;
  player.armor = s.armor;
  player.ammo = s.ammo;
  player.weapon = s.weapon;
  player.resetTo(s.x, s.z);
  missions.index = s.missionIndex;
  missions.done = s.missionsDone;
  missions.packagesFound = s.packagesFound || 0;
  state.marinaOwned = s.marinaOwned;
  state.garageCars = s.garage || [];
  state.totalEarned = s.totalEarned || 0;
  menuEl.style.display = 'none';
  state.mode = 'playing';
  hud.toast(`Welcome back — mission ${missions.index + 1} awaits (N)`);
};
document.getElementById('btn-respawn').onclick = () => {
  document.getElementById('end').style.display = 'none';
  player.resetTo(LANDMARKS.hospital.x, LANDMARKS.hospital.z);
  state.mode = 'playing';
  hud.toast('Patched up at Solara General. Stay clean out there.');
};
document.getElementById('btn-resume').onclick = togglePause;
document.getElementById('btn-quit').onclick = () => {
  document.getElementById('pause').style.display = 'none';
  menuEl.style.display = 'flex';
  state.mode = 'menu';
};
if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

// --- camera ------------------------------------------------------------------
function updateCamera(dt) {
  const target = new THREE.Vector3(player.x, 0, player.z);
  let offset;
  let lookAhead = 6;
  if (state.cameraPreset === 'chase' && player.inCar) {
    // Low and close behind the car: the chase reads at a glance.
    const back = player.heading + Math.PI;
    offset = new THREE.Vector3(Math.sin(back) * 24, 22, Math.cos(back) * 24);
    lookAhead = 10;
  } else if (state.cameraPreset === 'wide') {
    offset = new THREE.Vector3(0, 68, 46);
    lookAhead = 0;
  } else {
    // On foot: close enough that Juno reads as a person, not a speck.
    offset = new THREE.Vector3(0, 40, 30);
  }
  const want = target.clone().add(offset);
  state.cameraPos.lerp(want, clamp(dt * 3.2, 0, 1));
  camera.position.copy(state.cameraPos);
  // In chase view the camera looks slightly up so the police helicopter
  // (hovering ahead of the player) stays in frame.
  const lookY = state.cameraPreset === 'chase' && player.inCar ? 8 : 0;
  camera.lookAt(
    target.x + Math.sin(player.heading) * lookAhead,
    lookY,
    target.z + Math.cos(player.heading) * lookAhead,
  );
}

function updateSun() {
  // Sun angle from the clock; noon is high and bright, night never black.
  const frac = (state.time % 86400) / 86400;
  const ang = frac * Math.PI * 2 - Math.PI / 2;
  const elev = Math.sin(ang);
  const bright = clamp(0.45 + elev * 0.8, 0.3, 1.15);
  sun.intensity = 2.2 * bright;
  sun.position.set(Math.cos(ang) * 260, Math.max(60, elev * 300), 140);
  hemi.intensity = 0.55 + bright * 0.45;
  const day = new THREE.Color(0x79c7f2);
  const dusk = new THREE.Color(0x2c3e6e);
  const night = new THREE.Color(0x0e1a33);
  let sky = day;
  if (elev < 0.15 && elev >= -0.25) sky = dusk;
  else if (elev < -0.25) sky = night;
  scene.background = sky;
  scene.fog.color.copy(sky);
}

// --- main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0;
let lastFpsAt = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  frames++;
  if (elapsed - lastFpsAt >= 1) {
    state.fps = frames;
    frames = 0;
    lastFpsAt = elapsed;
  }
  if (state.mode === 'playing') {
    state.time += dt * 30; // 1 real second = 30 game seconds
    readInput();
    if (player.inCar && player.car) {
      const throttle = (input.forward ? 1 : 0) - (input.back ? 0.85 : 0);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      player.car.drive(dt, throttle, steer, city);
      player.x = player.car.x; player.z = player.car.z;
      player.heading = player.car.heading;
      audio.engine(Math.abs(player.car.speed) / player.car.topSpeed);
      // Ramming a ped while driving draws heat.
      for (const p of [...peds.peds]) {
        if (Math.hypot(p.x - player.x, p.z - player.z) < 2.6 && Math.abs(player.car.speed) > 8) {
          peds.knockDown(p);
          police.addHeat(1);
          audio.crash();
        }
      }
    } else {
      player.updateOnFoot(dt, input, city);
      audio.engine(0);
    }
    // Police contact with the player's car: shove + siren.
    for (const c of police.cars) {
      if (player.inCar && Math.hypot(c.x - player.x, c.z - player.z) < 4.4) {
        player.car.speed *= 0.94;
      }
    }
    traffic.update(dt, player.x, player.z);
    peds.update(dt, elapsed);
    police.update(dt, player, elapsed);
    missions.update(dt);
    city.update(dt, elapsed);
    audio.siren(police.wanted >= 2);
    // Marina income + autosave.
    if (state.marinaOwned) {
      state.marinaTimer += dt;
      if (state.marinaTimer >= 60) {
        state.marinaTimer = 0;
        player.addMoney(100);
        hud.toast('Marina income +$100');
      }
    }
    state.saveTimer += dt;
    if (state.saveTimer >= 30) {
      state.saveTimer = 0;
      saveGame({
        money: player.money, missionIndex: missions.index, missionsDone: missions.done,
        packagesFound: missions.packagesFound, x: player.x, z: player.z,
        health: player.health, armor: player.armor, ammo: player.ammo, weapon: player.weapon,
        garage: state.garageCars, marinaOwned: state.marinaOwned, totalEarned: state.totalEarned,
      });
    }
    // Tracer fade.
    for (const t of [...tracers]) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) { scene.remove(t.line); tracers.splice(tracers.indexOf(t), 1); }
    }
    // HUD state.
    const step = missions.active ? missions.active.mission.steps[missions.active.step] : null;
    const sideTarget = missions.side && missions.sideTarget
      ? (missions.sideTarget.x !== undefined ? missions.sideTarget : { x: missions.sideTarget.x, z: missions.sideTarget.z })
      : null;
    hud.update(dt, {
      money: player.money, health: player.health, armor: player.armor,
      wanted: police.wanted, wantedLabel: police.label(),
      time: state.time, x: player.x, z: player.z,
      speedKmh: player.speedKmh, inCar: player.inCar,
      radio: audio.station, ammo: player.ammo, weapon: player.weapon,
      objective: missions.objectiveText(),
      objectiveTarget: step && step.at ? step.at : sideTarget,
      city, heading: player.heading,
      policeCars: police.cars, traffic: traffic.cars,
    });
    if (player.health <= 0) endRun('wasted');
  }
  updateSun();
  updateCamera(dt);
  renderer.render(scene, camera);
  if (!window.__solara.ready) {
    window.__solara.ready = true;
    window.__solara.state = state.mode;
  }
}

// Shot mode: skip the menu and stage the scene, then flag ready.
if (SHOT || AUTOPLAY) {
  menuEl.style.display = 'none';
  state.mode = 'playing';
  audio.ensure = () => {};
  if (SHOT) applyShot(world, SHOT);
} else {
  // Start paused on the menu; render behind it.
  state.mode = 'menu';
}

frame();
