// Solara Bay — main.js
// One clear job: bootstrap and the game loop. Builds the world, wires
// input, menus, shops, the camera and the frame loop. The systems live in
// their own modules; everything the player sees flows through here.
import * as THREE from 'three';
import { WORLD, PLAYER_TUNING, STATIONS, SHOPS, SAFEHOUSE, SIDE_JOBS, STORY, mulberry32 } from './config.js';
import { buildCity } from './city.js';
import { spawnParkedCars, spawnTraffic, updateTraffic, driveCar } from './vehicles.js';
import { createPlayerMesh, updatePlayerOnFoot, tryEnterCar, exitCar, shoot } from './player.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionEngine } from './missions.js';
import { Hud } from './hud.js';
import { RadioAudio } from './audio.js';
import { saveGame, loadGame, hasSave, saveLabel } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

// ---- renderer, scene, noon light -------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(WORLD.sky);
scene.fog = new THREE.Fog(WORLD.fog, 260, 520);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 55, 40);

const sun = new THREE.DirectionalLight(WORLD.noonSun, 2.0);
sun.position.set(90, 140, 50);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfdfff, 0x8a7a5a, 1.05));

// ---- shared game state ------------------------------------------------------
const G = {
  time: 0,
  scene, camera, renderer,
  cash: PLAYER_TUNING.startCash,
  health: PLAYER_TUNING.health,
  armor: 0,
  ammo: 0,
  hasPistol: false,
  tuned: false,
  ownsSport: false,
  respect: 0,
  station: 0,
  clockMinutes: 12 * 60,
  day: 1,
  goons: [],
  traffic: [],
  parkedCars: [],
  colliders: [],
  shopPositions: {},
  safehousePos: SAFEHOUSE.pos,
  shotName: shotName || null,
  shotReadyAt: 0,
  cameraPreset: 'follow',
  sideDone: {},
  state: 'menu',
  tracers: [],
};
window.__solara = { G, version: 'round4-noon' };
window.__shotReady = false;

for (const key of Object.keys(SHOPS)) G.shopPositions[key] = SHOPS[key].pos;

// ---- world ------------------------------------------------------------------
const city = buildCity(scene);
G.colliders = city.colliders;
const rng = mulberry32(4242);
G.parkedCars = spawnParkedCars(scene, rng);
G.traffic = spawnTraffic(scene, rng, 14);

G.player = {
  mesh: createPlayerMesh(),
  x: 0, z: 30, heading: Math.PI / 2,
  inCar: false, car: null, moving: false, lastShot: -9,
};
scene.add(G.player.mesh);
G.player.mesh.position.set(0, 0, 30);

G.audio = new RadioAudio();
G.police = new Police(scene);
G.pedestrians = new Pedestrians(scene);
G.missions = new MissionEngine(scene, G);
G.hud = new Hud(document);

// ---- helpers the systems call back into -------------------------------------
G.toast = (msg) => G.hud.toast(msg);
G.addHeat = (n) => G.police.addHeat(n);

G.tracer = (x1, z1, x2, z2) => {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x1, 1.4, z1), new THREE.Vector3(x2, 1.4, z2),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  scene.add(line);
  G.tracers.push({ line, ttl: 0.16 });
};

G.damagePlayer = (amount, source) => {
  if (G.state !== 'playing') return;
  const absorbed = Math.min(G.armor, amount * 0.6);
  G.armor -= absorbed;
  G.health -= (amount - absorbed);
  const flash = document.getElementById('damage-flash');
  flash.style.opacity = '0.45';
  setTimeout(() => { flash.style.opacity = '0'; }, 140);
  if (G.health <= 0) G.onWasted();
};

G.respawnAtHospital = () => {
  if (G.player.inCar) { G.player.car = null; G.player.inCar = false; }
  G.player.mesh.visible = true;
  G.player.x = -30; G.player.z = -76;
  G.player.mesh.position.set(-30, 0, -76);
  G.health = 100;
  G.armor = 0;
  G.police.clearWanted();
};

G.onBusted = () => {
  G.cash = Math.max(0, G.cash - 150);
  G.audio.busted();
  G.toast('BUSTED — fined $150, dropped at Solara General');
  G.respawnAtHospital();
  G.saveNow();
};

G.onWasted = () => {
  G.cash = Math.max(0, G.cash - 150);
  G.audio.busted();
  G.toast('WASTED — $150 hospital bill, dropped at Solara General');
  G.respawnAtHospital();
  G.saveNow();
};

G.onStoryComplete = () => {
  document.getElementById('complete-title').textContent = 'THE BIG TIDE — STORY COMPLETE';
  document.getElementById('complete-text').textContent =
    'All 10 missions done. $' + G.cash.toLocaleString('en-US') + ' in the bank, ' + G.respect + ' respect. Solara Bay is yours, Rico.';
  document.getElementById('complete-panel').style.display = 'flex';
};

G.saveNow = () => {
  saveGame({
    cash: G.cash, health: G.health, armor: G.armor, ammo: G.ammo,
    hasPistol: G.hasPistol, tuned: G.tuned, ownsSport: G.ownsSport,
    missionIndex: G.missions.missionIndex,
    completedMissions: STORY.slice(0, G.missions.missionIndex).map((m) => m.title),
    sideDone: G.sideDone,
    playerPos: [G.player.x, G.player.z],
    station: G.station, respect: G.respect,
  });
};

function applySave(data) {
  G.cash = data.cash; G.health = data.health; G.armor = data.armor;
  G.ammo = data.ammo; G.hasPistol = data.hasPistol; G.tuned = data.tuned;
  G.ownsSport = data.ownsSport; G.missions.missionIndex = data.missionIndex;
  G.sideDone = data.sideDone || {};
  G.station = data.station || 0;
  G.respect = data.respect || 0;
  G.audio.setStation(G.station);
  if (data.playerPos) {
    G.player.x = data.playerPos[0]; G.player.z = data.playerPos[1];
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
  }
}

// ---- shops ------------------------------------------------------------------
let openShop = null;
function openShopPanel(key) {
  openShop = SHOPS[key];
  const panel = document.getElementById('shop-panel');
  document.getElementById('shop-title').textContent = openShop.name + ' — press 1-3 to buy, Esc to leave';
  const list = document.getElementById('shop-items');
  list.innerHTML = '';
  openShop.items.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.textContent = (i + 1) + '. ' + item.label + ' — $' + item.price;
    btn.addEventListener('click', () => buyItem(item));
    list.appendChild(btn);
  });
  panel.style.display = 'block';
  G.state = 'shop';
}

function closeShopPanel() {
  document.getElementById('shop-panel').style.display = 'none';
  openShop = null;
  if (G.state === 'shop') G.state = 'playing';
}

function buyItem(item) {
  if (G.cash < item.price) { G.toast('Not enough cash for ' + item.label); return; }
  G.cash -= item.price;
  if (item.id === 'pistol') { G.hasPistol = true; G.ammo += 60; G.player.mesh.getObjectByName('pistolMesh').visible = true; }
  if (item.id === 'ammo') G.ammo += 120;
  if (item.id === 'armor') G.armor = Math.min(100, G.armor + 50);
  if (item.id === 'meal') G.health = Math.min(100, G.health + 40);
  if (item.id === 'shake') G.health = Math.min(100, G.health + 15);
  if (item.id === 'respray') G.police.clearWanted();
  if (item.id === 'tune') G.tuned = true;
  if (item.id === 'sport') {
    G.ownsSport = true;
    const gt = G.parkedCars[G.parkedCars.length - 1];
    gt.forSale = false;
    G.toast('Solara GT is yours — it is parked outside');
  }
  G.audio.cash();
  G.toast('Bought: ' + item.label);
  G.saveNow();
}

function nearShop() {
  for (const key of Object.keys(SHOPS)) {
    const [sx, sz] = SHOPS[key].pos;
    if (Math.hypot(G.player.x - sx, G.player.z - sz) < 14) return key;
  }
  return null;
}

function nearSafehouse() {
  return Math.hypot(G.player.x - SAFEHOUSE.pos[0], G.player.z - SAFEHOUSE.pos[1]) < 12;
}

function interact() {
  if (G.state !== 'playing') return;
  if (G.player.inCar) { exitCar(G); return; }
  if (G.missions.onInteract()) return;
  const shop = nearShop();
  if (shop) { openShopPanel(shop); return; }
  if (nearSafehouse()) {
    G.health = 100;
    G.saveNow();
    G.audio.pickup();
    G.toast('Casa Alba — healed and saved. ' + saveLabel());
    return;
  }
  if (!tryEnterCar(G)) G.toast('No car nearby — walk to a parked car and press E');
}

// ---- input ------------------------------------------------------------------
const keys = {};
const input = { forward: false, back: false, left: false, right: false, brake: false, sprint: false };
function refreshInput() {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.brake = !!keys.Space;
  input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys[e.code] = true;
  refreshInput();
  if (G.state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) { startGame(false); return; }
  if (e.code === 'KeyM' && G.state === 'playing') G.missions.startCurrent();
  if (e.code === 'KeyE' && G.state === 'playing') interact();
  if (e.code === 'KeyF' && G.state === 'playing') shoot(G);
  if (e.code === 'KeyQ' && G.state === 'playing') {
    const st = G.audio.setStation(G.station + 1);
    G.station = STATIONS.indexOf(st);
    G.toast('Radio: ' + st.name);
  }
  if (e.code === 'Escape') {
    if (G.state === 'shop') closeShopPanel();
    else if (G.state === 'playing') pauseGame();
    else if (G.state === 'paused') resumeGame();
  }
  if (G.state === 'shop' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    const item = openShop.items[Number(e.code.slice(-1)) - 1];
    if (item) buyItem(item);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; refreshInput(); });
window.addEventListener('mousedown', (e) => {
  if (G.state === 'playing' && e.target === renderer.domElement) shoot(G);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- menus ------------------------------------------------------------------
function startGame(fromSave) {
  G.audio.startAfterGesture();
  if (fromSave) {
    const data = loadGame();
    if (data) { applySave(data); G.toast('Welcome back, Rico — ' + saveLabel()); }
  }
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  G.state = 'playing';
  G.toast('Solara Bay — press M to start mission 1: First Wheels');
}

function pauseGame() {
  G.state = 'paused';
  const panel = document.getElementById('pause-panel');
  panel.style.display = 'flex';
  document.getElementById('pause-save-label').textContent = saveLabel();
  const jobs = document.getElementById('side-jobs');
  jobs.innerHTML = '';
  for (const job of SIDE_JOBS) {
    const btn = document.createElement('button');
    btn.className = 'job-btn';
    btn.textContent = job.title + ' — ' + job.brief + ' (+$' + job.reward + ')';
    btn.addEventListener('click', () => {
      panel.style.display = 'none';
      G.state = 'playing';
      G.missions.startSideJob(job.id);
    });
    jobs.appendChild(btn);
  }
}

function resumeGame() {
  document.getElementById('pause-panel').style.display = 'none';
  G.state = 'playing';
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save-quit').addEventListener('click', () => {
  G.saveNow();
  document.getElementById('pause-panel').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  G.state = 'menu';
});
document.getElementById('btn-complete-close').addEventListener('click', () => {
  document.getElementById('complete-panel').style.display = 'none';
});
if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';
document.getElementById('save-state-label').textContent = saveLabel();

// ---- camera -----------------------------------------------------------------
const CAM_OFFSETS = {
  follow: [0, 58, 42],
  chase: [0, 52, 38],
  close: [0, 38, 28],
  wide: [0, 74, 54],
};
const camTarget = new THREE.Vector3();

function updateCamera(dt) {
  const p = G.player;
  const tx = p.inCar && p.car ? p.car.x : p.x;
  const tz = p.inCar && p.car ? p.car.z : p.z;
  const off = CAM_OFFSETS[G.cameraPreset] || CAM_OFFSETS.follow;
  camTarget.set(tx + off[0], off[1], tz + off[2]);
  camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  camera.lookAt(tx, 0, tz);
}

// ---- main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let framesRendered = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  if (G.state === 'playing') {
    G.clockMinutes += dt * 0.5;
    if (G.clockMinutes >= 1440) { G.clockMinutes -= 1440; G.day += 1; }
    if (G.player.inCar && G.player.car) {
      driveCar(G.player.car, input, dt, G.colliders, G.tuned);
      G.audio.setEngine(Math.abs(G.player.car.speed) / 34, true);
    } else {
      updatePlayerOnFoot(G, input, dt);
      G.audio.setEngine(0, false);
    }
    updateTraffic(G.traffic, dt, G.time);
    G.pedestrians.update(dt, G);
    G.police.update(dt, G);
    G.missions.update(dt);
    // Tracers fade out.
    for (let i = G.tracers.length - 1; i >= 0; i--) {
      const t = G.tracers[i];
      t.ttl -= dt;
      t.line.material.opacity = Math.max(0, t.ttl / 0.16);
      if (t.ttl <= 0) { scene.remove(t.line); G.tracers.splice(i, 1); }
    }
  }
  updateCamera(dt);
  G.audio.update();
  G.hud.update(G, dt);
  renderer.render(scene, camera);
  framesRendered += 1;
  if (shotName && !window.__shotReady && G.time > G.shotReadyAt && framesRendered > 30) {
    window.__shotReady = true;
  }
}

// ---- shot mode: skip the menu and stage the scene ---------------------------
if (shotName) {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  G.state = 'playing';
  G.audio.startAfterGesture();
  stageShot(G, shotName);
}

animate();
