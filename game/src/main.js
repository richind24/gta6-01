// SOLARA BAY — an original open-world crime sandbox.
// Dax Rivers returns to his home city to take it back from the Kessler family,
// one job at a time. All names, places and characters are original fiction.
// Rebuild (Nov 2026): 10 story missions, police helicopter, 3 radio stations,
// diner + auto shops, safehouse property, garage upgrades, rifle — same city,
// much denser systems, bright noon cover.

import { CITY, SAVE_KEY, STORY_TOTAL, clamp, lerp, lerpAngle, money } from './config.js';
import { buildCity, LANDMARKS, insideOwnedProperty } from './world.js';
import { spawnTraffic, updateTraffic, drivePlayerCar, spawnCar } from './vehicles.js';
import { makePersonModel, spawnPedestrians, updatePedestrians } from './people.js';
import { createPlayer, initPlayerModel, updatePlayerOnFoot, nearestCar, enterCar, exitCar, damagePlayer } from './player.js';
import { addWanted, updatePolice, clearPolice } from './police.js';
import { tryShoot, updateEnemies, WEAPONS, WEAPON_ORDER } from './combat.js';
import { createMissions, startStoryMission, startSideMission, updateMissions, buildMarker, updateMarker, tryStartNextStory, STORY } from './missions.js';
import { createWeather, updateWeather } from './weather.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { applyShot } from './shots.js';
import { createHeli } from './heli.js';
import { createRadio } from './radio.js';
import * as economy from './economy.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

const G = {
  time: 0, rng: null, scene: null, camera: null, renderer: null,
  cars: [], deadCars: [], peds: [], cops: [], policeCars: [], enemies: [],
  player: null, playerCar: null, inCar: false,
  wanted: 0, wantedTimer: 0, wantedHeat: 0, recentCrime: 0,
  inSafehouse: false, paused: false, started: false, gameOver: false,
  shootCooldown: 0, shake: 0, missionEnemies: [],
  weather: null, audio: null, hud: null, input: null, missions: null, economy,
  heli: null, radio: null,
};

G.addWanted = (stars, reason) => { addWanted(G, stars, reason); G.recentCrime = 8; };
G.saveGame = saveGame;
G.wasted = wasted;
G.busted = busted;

// ---------- effects ----------
const tracerPool = [];
function makeTracer(G, from, to) {
  if (![from.x, from.y, from.z, to.x, to.y, to.z].every(Number.isFinite)) {
    console.warn('TRACER_NAN skipped');
    return;
  }
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  tracerPool.push({ line, life: 0.09 });
}
G.tracer = (a, b) => makeTracer(G, a, b);
G.muzzleFlash = () => {
  if (!G._flash) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: 0xffe9a8, transparent: true, depthWrite: false }));
    s.scale.set(2.2, 2.2, 1);
    G.scene.add(s);
    G._flash = s;
  }
  const p = G.player;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  G._flash.position.set(p.x + fx * 0.9, 1.35, p.z + fz * 0.9);
  G._flash.material.opacity = 1;
  G._flashLife = 0.06;
};

// ---------- save / load ----------
function saveGame() {
  try {
    const data = {
      money: G.player.money, health: G.player.health, storyIndex: G.missions.storyIndex,
      properties: economy.PROPERTIES.map((p) => p.owned),
      weaponsOwned: G.player.weaponsOwned, ammo: G.player.ammo,
      upgrades: G.player.upgrades, radio: G.radio ? G.radio.station().id : 'bayview',
      x: G.player.x, z: G.player.z, timeOfDay: G.weather.timeOfDay, day: G.weather.day,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.player.money = d.money; G.player.health = d.health;
    G.missions.storyIndex = d.storyIndex || 0;
    economy.PROPERTIES.forEach((p, i) => { p.owned = !!d.properties[i]; });
    G.player.weaponsOwned = d.weaponsOwned || ['fists', 'pistol'];
    G.player.ammo = d.ammo || { pistol: 24, smg: 0, shotgun: 0, rifle: 0 };
    G.player.upgrades = d.upgrades || { turbo: false, armor: false };
    if (d.radio && G.radio) G.radio.setStation(d.radio);
    G.player.x = d.x ?? -64; G.player.z = d.z ?? 88;
    G.weather.timeOfDay = d.timeOfDay ?? 10; G.weather.day = d.day ?? 1;
    return true;
  } catch (e) { return false; }
}

function wasted() {
  if (G.gameOver) return;
  G.gameOver = true;
  clearPolice(G);
  G.hud.showMenu('WASTED', 'Dax tumbang di jalanan Solara Bay.<br>Uangmu berkurang $100 untuk biaya rumah sakit.', [
    { label: 'Bangun di Bayview General', fn: () => {
      G.player.health = 100;
      G.player.money = Math.max(0, G.player.money - 100);
      G.player.x = LANDMARKS.hospital.x; G.player.z = LANDMARKS.hospital.z + 24;
      G.player.model.position.set(G.player.x, 0, G.player.z);
      G.player.dead = false; G.gameOver = false;
      if (G.inCar) exitCar(G);
      G.hud.hideMenu();
    } },
  ]);
}

function busted() {
  if (G.gameOver) return;
  G.gameOver = true;
  clearPolice(G);
  G.hud.showMenu('BUSTED', 'Polisi Solara menangkapmu.<br>Denda $200 — dan mereka menyita senjatamu (kecuali tinju).', [
    { label: 'Keluar dari kantor polisi', fn: () => {
      G.player.money = Math.max(0, G.player.money - 200);
      G.player.weaponsOwned = ['fists'];
      G.player.weapon = 'fists';
      G.player.x = LANDMARKS.police.x; G.player.z = LANDMARKS.police.z + 24;
      G.player.model.position.set(G.player.x, 0, G.player.z);
      G.player.dead = false; G.gameOver = false;
      if (G.inCar) exitCar(G);
      G.hud.hideMenu();
    } },
  ]);
}

// ---------- init ----------
function init() {
  G.rng = (() => { let s = 20261118; return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const canvas = document.getElementById('game');
  G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x4aa8e8);
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
  G.camera.position.set(-40, 26, 150);
  G.camera.lookAt(0, 10, 0);

  G.weather = createWeather(G);
  G.audio = createAudio();
  G.player = createPlayer(G);
  G.missions = createMissions(G);
  G.hud = createHud(G);
  G.input = createInput(G);
  G.heli = createHeli(G);
  G.radio = createRadio(G);

  buildCity(G);
  initPlayerModel(G, makePersonModel);
  spawnTraffic(G);
  spawnPedestrians(G, 56);
  buildMarker(G);
  updateMarker(G);

  G.hud.setObjective('Pergi ke The Rusty Anchor untuk memulai cerita.');
  window.addEventListener('resize', () => {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
  });

  // start flow
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  if (SHOT) {
    startGame(false);
    applyShot(G, SHOT);
    updateMarker(G);
  } else {
    G.hud.showMenu('SOLARA BAY', 'Kota ini milik keluarga Kessler. Dax Rivers pulang untuk mengambilnya kembali.<br><br><b>Kontrol:</b> WASD bergerak / mengemudi &nbsp;•&nbsp; Mouse: putar kamera, klik: tembak &nbsp;•&nbsp; <b>E</b>: masuk/keluar mobil, mulai misi, buka toko &nbsp;•&nbsp; <b>1-5</b>: ganti senjata &nbsp;•&nbsp; <b>R</b>: ganti stasiun radio &nbsp;•&nbsp; <b>Shift</b>: lari &nbsp;•&nbsp; <b>Esc</b>: jeda', [
      { label: hasSave ? 'Lanjutkan' : 'Mulai Cerita Baru', fn: () => { if (hasSave) loadGame(); startGame(true); } },
      ...(hasSave ? [{ label: 'Cerita Baru (hapus save)', fn: () => { localStorage.removeItem(SAVE_KEY); startGame(true); } }] : []),
    ]);
  }
  requestAnimationFrame(loop);
}

function startGame(withIntro) {
  G.started = true;
  G.paused = false;
  G.hud.hideMenu();
  G.audio.ensure();
  if (withIntro) G.hud.showMissionCard('SOLARA BAY', 'Dax Rivers pulang. Temui Mara Voss di The Rusty Anchor. Tekan R untuk ganti radio.');
}

// ---------- camera ----------
function updateCamera(dt) {
  const p = G.player;
  // mouse orbit
  p.camYaw -= G.input.mouseDX * 0.0032;
  p.camPitch = clamp(p.camPitch + G.input.mouseDY * 0.0022, 0.05, 0.9);
  G.input.mouseDX = 0; G.input.mouseDY = 0;
  // auto-align behind movement / car heading
  const focusHeading = G.inCar ? G.playerCar.heading : (p.speed > 0.5 ? p.heading : p.camYaw);
  const alignRate = G.inCar ? 2.2 : (p.speed > 0.5 ? 1.1 : 0);
  if (alignRate > 0) p.camYaw = lerpAngle(p.camYaw, focusHeading, clamp(dt * alignRate, 0, 1));
  const focus = G.inCar ? { x: G.playerCar.x, z: G.playerCar.z } : { x: p.x, z: p.z };
  // pull the camera in when a building would block the view
  const dirX = -Math.sin(p.camYaw) * Math.cos(p.camPitch);
  const dirZ = -Math.cos(p.camYaw) * Math.cos(p.camPitch);
  const dirY = Math.sin(p.camPitch);
  let dist = 1.5;
  for (let d = 1.5; d <= p.camDist; d += 0.5) {
    const cx = focus.x + dirX * d, cy = 2.2 + dirY * d, cz = focus.z + dirZ * d;
    let blocked = false;
    for (const c of G.colliders) {
      if (cx > c.minX - 0.4 && cx < c.maxX + 0.4 && cz > c.minZ - 0.4 && cz < c.maxZ + 0.4 && cy < (c.h || 20)) { blocked = true; break; }
    }
    if (blocked) break;
    dist = d;
  }
  const cx = focus.x + dirX * dist;
  const cz = focus.z + dirZ * dist;
  const cy = 2.2 + dirY * dist;
  let shakeX = 0, shakeY = 0;
  if (G.shake > 0) { G.shake -= dt; shakeX = (Math.random() - 0.5) * G.shake; shakeY = (Math.random() - 0.5) * G.shake; }
  G.camera.position.set(cx + shakeX, cy + shakeY, cz);
  G.camera.lookAt(focus.x, 1.6, focus.z);
}

// ---------- interactions ----------
function handleKeys() {
  const inp = G.input, p = G.player;
  if (inp.pressed.KeyE) {
    inp.pressed.KeyE = false;
    if (!G.started || G.paused || G.gameOver) return;
    if (G.inCar) { exitCar(G); return; }
    if (tryStartNextStory(G)) return;
    if (economy.tryBuyProperty(G)) return;
    const shop = economy.nearShop(G);
    if (shop) { G.hud.showShop(shop); return; }
    const car = nearestCar(G, 4.5);
    if (car) { enterCar(G, car); return; }
  }
  if (inp.pressed.Escape) {
    inp.pressed.Escape = false;
    if (!G.started || G.gameOver) return;
    if (G.hud.shop.style.display === 'block') { G.hud.shop.style.display = 'none'; G.paused = false; return; }
    G.paused = !G.paused;
    if (G.paused) {
      G.hud.showMenu('JEDA', `Uang: ${money(p.money)} &nbsp;•&nbsp; Misi cerita: ${Math.min(G.missions.storyIndex, STORY_TOTAL)}/${STORY_TOTAL} selesai<br>Properti: ${economy.PROPERTIES.filter((x) => x.owned).map((x) => x.name).join(', ') || 'belum ada'}<br>Radio: ${G.radio.label()}`, [
        { label: 'Lanjutkan', fn: () => { G.paused = false; G.hud.hideMenu(); } },
        { label: 'Simpan Game', fn: () => { saveGame(); G.hud.flash('Game tersimpan.'); G.paused = false; G.hud.hideMenu(); } },
        { label: 'Misi Sampingan: Taxi ($150)', fn: () => { G.paused = false; G.hud.hideMenu(); startSideMission(G, 'taxi'); } },
        { label: 'Misi Sampingan: Balapan ($500)', fn: () => { G.paused = false; G.hud.hideMenu(); startSideMission(G, 'race'); } },
        { label: 'Misi Sampingan: Kurir ($200)', fn: () => { G.paused = false; G.hud.hideMenu(); startSideMission(G, 'delivery'); } },
        { label: 'Misi Sampingan: Rampok Toko ($400)', fn: () => { G.paused = false; G.hud.hideMenu(); startSideMission(G, 'robbery'); } },
        { label: 'Misi Sampingan: Tur Foto ($250)', fn: () => { G.paused = false; G.hud.hideMenu(); startSideMission(G, 'photo'); } },
      ]);
    } else G.hud.hideMenu();
  }
  if (inp.pressed.KeyM) {
    inp.pressed.KeyM = false;
    G.audio.musicOn = !G.audio.musicOn;
    G.hud.flash(G.audio.musicOn ? 'Musik: nyala' : 'Musik: mati');
  }
  if (inp.pressed.KeyR) {
    inp.pressed.KeyR = false;
    if (G.started && !G.paused && !G.gameOver) G.radio.next();
  }
  for (let idx = 0; idx < WEAPON_ORDER.length; idx++) {
    const code = 'Digit' + (idx + 1);
    if (inp.pressed[code]) {
      inp.pressed[code] = false;
      const w = WEAPON_ORDER[idx];
      if (p.weaponsOwned.includes(w)) {
        p.weapon = w;
        p.model.userData.gun.visible = w !== 'fists';
        G.hud.flash(WEAPONS[w].name);
        G.audio.click();
      } else G.hud.flash(`${WEAPONS[w].name} belum dimiliki — beli di Ironworks Arms.`);
    }
  }
  // clear stale edge presses
  for (const k of Object.keys(inp.pressed)) inp.pressed[k] = false;
}

function updatePrompt() {
  if (!G.started || G.paused || G.gameOver) { G.hud.setPrompt(''); return; }
  if (G.inCar) { G.hud.setPrompt('E — keluar dari mobil'); return; }
  if (tryStartNextStoryPeek()) { G.hud.setPrompt('E — mulai misi: ' + STORY[G.missions.storyIndex].name); return; }
  const shop = economy.nearShop(G);
  if (shop) { G.hud.setPrompt(`E — buka ${shop.name}`); return; }
  for (const pr of economy.PROPERTIES) {
    if (Math.hypot(G.player.x - pr.at.x, G.player.z - pr.at.z) < 12) {
      G.hud.setPrompt(pr.owned ? `E — ${pr.name} (milikmu)` : `E — beli ${pr.name} (${money(pr.price)})`);
      return;
    }
  }
  const car = nearestCar(G, 4.5);
  if (car) { G.hud.setPrompt(car.driver ? `E — curi ${car.type.name}` : `E — naik ${car.type.name}`); return; }
  G.hud.setPrompt('');
}

function tryStartNextStoryPeek() {
  return !G.missions.active && G.missions.storyIndex < STORY.length &&
    Math.hypot(G.player.x - LANDMARKS.bar.x, G.player.z - LANDMARKS.bar.z) < 10;
}

// ---------- main loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  G.time += dt;
  handleKeys();
  if (!G.started || G.paused || G.gameOver) {
    // still render the scene behind menus
    updateCamera(dt);
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.shootCooldown > 0) G.shootCooldown -= dt;
  if (G._flashLife > 0) {
    G._flashLife -= dt;
    if (G._flashLife <= 0 && G._flash) G._flash.material.opacity = 0;
  }
  for (let i = tracerPool.length - 1; i >= 0; i--) {
    tracerPool[i].life -= dt;
    if (tracerPool[i].life <= 0) {
      G.scene.remove(tracerPool[i].line);
      tracerPool.splice(i, 1);
    } else tracerPool[i].line.material.opacity = tracerPool[i].life / 0.09;
  }

  updateWeather(G, dt);
  if (G.inCar && G.playerCar) drivePlayerCar(G, dt);
  else updatePlayerOnFoot(G, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateEnemies(G, dt);
  updateMissions(G, dt);
  // shooting (hold for auto weapons, edge for semi-auto)
  const w = WEAPONS[G.player.weapon];
  const shootPressed = G.input.shooting && !G._prevShooting;
  G._prevShooting = G.input.shooting;
  if ((w.auto && G.input.shooting) || shootPressed) tryShoot(G);
  // marker diamond spin
  if (G.missions.marker && G.missions.marker.visible) {
    G.missions.marker.userData.diamond.rotation.y += dt * 2;
    G.missions.marker.userData.diamond.position.y = 12 + Math.sin(G.time * 2) * 0.8;
  }
  // siren audio follows wanted level
  G.audio.setSiren(G.wanted > 0, G.policeCars.length ? Math.hypot(G.policeCars[0].x - G.player.x, G.policeCars[0].z - G.player.z) : 200);
  // safehouse: inside owned property radius hides the player from police
  G.inSafehouse = insideOwnedProperty(G, G.player.x, G.player.z, 14);
  updateCamera(dt);
  updatePrompt();
  G.hud.update(dt);
  G.renderer.render(G.scene, G.camera);
}

// expose a tiny debug handle for play-testing
window.__solara = G;

init();
