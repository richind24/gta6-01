// Cobalt Vice: Port Meridian — bootstrap, input, player control, camera, main loop.
function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.44, 1.2, 10),
    new THREE.MeshLambertMaterial({ color: 0x2f6fb2 })
  );
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x22262e })
  );
  legs.position.y = 0.28;
  g.add(legs);
  return g;
}

function init() {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer = renderer;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7ec8f7);
  scene.fog = new THREE.Fog(0x7ec8f7, 400, 1700);
  G.scene = scene;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);
  G.camera = camera;

  const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
  sun.position.set(400, 600, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 2000;
  scene.add(sun);
  G.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a3a, 1.15);
  scene.add(hemi);
  G.hemi = hemi;

  buildWorld();
  spawnTraffic(16);
  spawnBoats();
  spawnHeli();
  spawnPeds(26);
  spawnShops();
  spawnSideMarkers();

  G.player.mesh = makePlayerMesh();
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
  scene.add(G.player.mesh);

  // URL params.
  const params = new URLSearchParams(window.location.search);
  G.shot = params.get('shot') || '';
  G.autotest = params.get('autotest') === '1';

  // Input.
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    G.keys[k] = true;
    if (k === 'p') G.paused = !G.paused;
    if (k === 'm') toggleMap();
    if (k === 'e') interact();
    if (k === 'l') { saveGame(); toast('Game saved'); }
    if (k === 'r') layLow();
    if (k === 'escape') { closeShop(); toggleMap(false); }
    if (k === '1') switchWeapon('fists');
    if (k === '2') switchWeapon('pistol');
    if (k === '3') switchWeapon('smg');
    if (k === '4') switchWeapon('shotgun');
    if (k === '5') switchWeapon('rifle');
    if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('mousemove', (e) => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('#shop')) return;
    G.mouse.down = true;
    if (G.started) shoot();
  });
  window.addEventListener('mouseup', () => { G.mouse.down = false; });
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const startBtn = document.getElementById('start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      AudioSys.init();
      document.getElementById('boot').style.display = 'none';
      G.started = true;
      const save = loadGame();
      if (save && startBtn.dataset.continue === '1') applySave(save);
      if (!G.mission && G.missionIndex < STORY.length) startMission(G.missionIndex);
      toast('Welcome to Port Meridian. Your move.');
    });
  }
  const save = loadGame();
  const contBtn = document.getElementById('continue');
  if (contBtn && save) {
    contBtn.style.display = 'inline-block';
    contBtn.addEventListener('click', () => {
      if (startBtn) startBtn.dataset.continue = '1';
      startBtn.click();
    });
  }

  if (G.shot || G.autotest) {
    const boot = document.getElementById('boot');
    if (boot) boot.style.display = 'none';
    AudioSys.init();
    G.started = true;
    if (G.shot) applyShot(G.shot);
    else if (!G.mission && G.missionIndex < STORY.length) startMission(G.missionIndex);
  }

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (G.started && !G.paused && !G.shopOpen) {
      G.elapsed += dt;
      updateWorld(dt);
      updatePlayer(dt);
      updateTraffic(dt);
      updatePeds(dt);
      updateCops(dt);
      updateMissions(dt);
      updateSide(dt);
      updateCombat(dt);
      updateEconomy(dt);
      updateCamera(dt);
      updateAutotest(dt);
    }
    updateHUD();
    renderer.render(scene, camera);
  }
  loop();
}

function applySave(save) {
  G.money = save.money || 500;
  G.missionIndex = save.missionIndex || 0;
  Object.assign(G.weapons, save.weapons || {});
  Object.assign(G.ammo, save.ammo || {});
  Object.assign(G.props, save.props || {});
  Object.assign(G.upgrades, save.upgrades || {});
  if (typeof save.x === 'number') G.player.x = save.x;
  if (typeof save.z === 'number') G.player.z = save.z;
  if (typeof save.time === 'number') G.time = save.time;
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
}

function switchWeapon(key) {
  if (!G.weapons[key]) {
    if (key !== 'fists') toast('You do not own that weapon — visit Ironworks Arms');
    return;
  }
  G.weapon = key;
  AudioSys.blip(440, 0.06, 'square', 0.08);
}

function layLow() {
  if (G.wanted === 0) return;
  for (const c of G.world.cops) {
    if (dist2(c.x, c.z, G.player.x, G.player.z) < 30) {
      toast('Too hot — lose the cops first');
      return;
    }
  }
  G.money = Math.max(0, G.money - 200);
  G.wanted = 0;
  toast('You lay low and patched up — $200');
}

function toggleMap(force) {
  const show = typeof force === 'boolean' ? force : !G.mapOpen;
  G.mapOpen = show;
  const el = document.getElementById('bigmap');
  if (el) el.style.display = show ? 'block' : 'none';
  if (show) drawBigMap();
}

function drawBigMap() {
  const cv = document.getElementById('bigmap-canvas');
  if (!cv || !G.groundCanvas) return;
  const x = cv.getContext('2d');
  x.drawImage(G.groundCanvas, 0, 0, cv.width, cv.height);
  const S = cv.width;
  const toMap = (wx, wz) => [((wx + 1000) / 2000) * S, ((wz + 1000) / 2000) * S];
  const [px, pz] = toMap(G.player.x, G.player.z);
  x.fillStyle = '#ffffff';
  x.strokeStyle = '#111';
  x.beginPath();
  x.arc(px, pz, 8, 0, 7);
  x.fill();
  x.stroke();
}

function interact() {
  if (!G.started || G.paused) return;
  // Side mission marker.
  for (const mk of G.world.markers) {
    if (dist2(mk.x, mk.z, G.player.x, G.player.z) < 9) {
      startSide(mk);
      return;
    }
  }
  // Shops / properties.
  const shop = nearestShop(10);
  if (shop) {
    if (shop.kind === 'weapons') { openShop(); return; }
    tryBuyProperty(shop);
    return;
  }
  // Vehicles.
  if (G.vehicle) { exitVehicle(); return; }
  const v = nearestVehicle(7);
  if (v) enterVehicle(v);
}

function updatePlayer(dt) {
  const k = G.keys;
  if (G.vehicle) {
    updatePlayerVehicle(dt);
    return;
  }
  const fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
  const turn = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
  const sprint = k['shift'] ? 1.7 : 1;
  G.player.a += turn * dt * 2.4;
  const sp = 6.5 * sprint;
  let nx = G.player.x + Math.cos(G.player.a) * fwd * sp * dt;
  let nz = G.player.z + Math.sin(G.player.a) * fwd * sp * dt;
  if (isWater(nx, nz)) {
    nx = G.player.x;
    nz = G.player.z;
    toast('Too deep to swim here — find a boat');
  }
  const fixed = collideBuildings(nx, nz, 1.2);
  G.player.x = clamp(fixed[0], -990, 690);
  G.player.z = clamp(fixed[1], -990, 990);
  G.player.v = Math.abs(fwd) * sp;
  G.speedKmh = G.player.v * 3.4;
  G.player.mesh.position.set(G.player.x, Math.abs(Math.sin(G.elapsed * 10)) * 0.08, G.player.z);
  G.player.mesh.rotation.y = -G.player.a;
  AudioSys.engine(0, false);
}

function updateCamera(dt) {
  const dist = G.mode === 'walk' ? 9.5 : 13;
  const height = G.mode === 'walk' ? 4.5 : 6;
  // Camera follows behind the player's heading.
  const targetA = G.player.a + Math.PI;
  G.camA += angDiff(G.camA, targetA) * Math.min(1, dt * 3);
  const cx = G.player.x + Math.cos(G.camA) * dist;
  const cz = G.player.z + Math.sin(G.camA) * dist;
  const cam = G.camera;
  // Snap on the first frames (or after a teleport): lerping from the origin
  // would leave the player a speck for the first seconds of a staged scene.
  if (cam.position.distanceTo(new THREE.Vector3(cx, height, cz)) > 60) {
    cam.position.set(cx, height, cz);
  }
  cam.position.x = lerp(cam.position.x, cx, Math.min(1, dt * 5));
  cam.position.y = lerp(cam.position.y, height, Math.min(1, dt * 5));
  cam.position.z = lerp(cam.position.z, cz, Math.min(1, dt * 5));
  cam.lookAt(G.player.x + Math.cos(G.player.a) * 4, 2, G.player.z + Math.sin(G.player.a) * 4);
}

// Self-test hook: ?autotest=1 drives the game and reports into #test-status.
// Frame-based (not wall-clock): under headless virtual time, rAF frames are the
// reliable unit — accumulated dt can stall while the budget is consumed by timers.
function updateAutotest(dt) {
  if (!G.autotest || G.test.done) return;
  const t = G.test;
  t.frames = (t.frames || 0) + 1;
  const setKeys = (w) => { G.keys['w'] = w; };
  if (t.phase === 0 && t.frames > 5) {
    t.phase = 1;
    setKeys(true);
    t.result.walkStart = [Math.round(G.player.x), Math.round(G.player.z)];
  } else if (t.phase === 1 && t.frames > 20) {
    t.phase = 2;
    setKeys(false);
    t.result.walkMoved = Math.round(dist2(G.player.x, G.player.z, t.result.walkStart[0], t.result.walkStart[1]));
    // Park a car next to the player and enter it.
    const mesh = makeCarMesh(0x34b9cd, false);
    mesh.position.set(G.player.x + 4, 0, G.player.z);
    G.scene.add(mesh);
    const car = { mesh, x: G.player.x + 4, z: G.player.z, a: 0, v: 0, road: 0, axis: 'x', dir: 1, speed: 0, player: false, parked: true };
    G.world.traffic.push(car);
    enterVehicle(car);
    t.result.enteredCar = G.mode;
  } else if (t.phase === 2 && t.frames > 35) {
    t.phase = 3;
    setKeys(true);
    t.result.drove = Math.round(G.speedKmh);
    if (!G.mission) startMission(0);
    t.result.mission = G.mission ? G.mission.title : null;
  } else if (t.phase === 3 && t.frames > 50) {
    t.phase = 4;
    setKeys(false);
    G.weapons.pistol = true;
    G.ammo.pistol = 24;
    G.weapon = 'pistol';
    G.mouse.x = window.innerWidth / 2 + 80;
    G.mouse.y = window.innerHeight / 2;
    shoot();
    t.result.shotFired = true;
    t.result.ammoAfterShot = G.ammo.pistol;
    t.result.frames = t.frames;
    t.result.errors = G.errors.slice();
    t.result.money = G.money;
    t.result.missionIndex = G.missionIndex;
    t.done = true;
    const el = document.getElementById('test-status');
    if (el) el.textContent = JSON.stringify(t.result);
    document.title = 'AUTOTEST-DONE';
  }
}

window.addEventListener('DOMContentLoaded', init);
