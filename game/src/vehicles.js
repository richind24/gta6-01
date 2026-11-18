// Cobalt Vice — vehicles: meshes, traffic AI, player driving, stealing, boats, heli.
function makeCarMesh(color, police) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14181d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2.0), paint);
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 1.8), dark);
  cabin.position.set(-0.2, 1.45, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.7 });
  for (const wz of [0.7, -0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    h.position.set(2.22, 0.75, wz);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000, emissiveIntensity: 0.6 });
  for (const wz of [0.7, -0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), tailMat);
    t.position.set(-2.22, 0.75, wz);
    g.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1.2 })
    );
    bar.position.set(-0.2, 1.9, 0);
    g.add(bar);
  }
  return g;
}

function makeBikeMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.5), paint);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0e10 });
  for (const wx of [0.85, -0.85]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.36, 0);
    g.add(w);
  }
  const rider = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c4a6a })
  );
  rider.position.set(-0.1, 1.3, 0);
  g.add(rider);
  return g;
}

function makeBoatMesh(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.1, 2.6), new THREE.MeshLambertMaterial({ color }));
  hull.position.y = 0.7;
  hull.castShadow = true;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.2, 4), new THREE.MeshLambertMaterial({ color }));
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(4.8, 0.7, 0);
  g.add(bow);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.0, 2.0),
    new THREE.MeshLambertMaterial({ color: 0xe8eef2 })
  );
  cab.position.set(-0.5, 1.7, 0);
  g.add(cab);
  return g;
}

function makeHeliMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.0), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.2;
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.6, 0.6), new THREE.MeshLambertMaterial({ color }));
  tail.position.set(-4.0, 1.4, 0);
  g.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.0, 1.8),
    new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x224455, emissiveIntensity: 0.4 })
  );
  glass.position.set(2.0, 1.3, 0);
  g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x22262c }));
  rotor.position.y = 2.3;
  rotor.name = 'rotor';
  g.add(rotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  for (const wz of [0.9, -0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.12), skidMat);
    skid.position.set(0, 0.15, wz);
    g.add(skid);
  }
  return g;
}

function spawnTraffic(n) {
  const colors = [0xe44e61, 0x34b9cd, 0xf2bd51, 0xe7edf1, 0x7a4ae0, 0x3fae5a];
  for (let i = 0; i < n; i++) {
    const road = pick(ROADS);
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const off = (Math.random() < 0.5 ? -8 : 8);
    const mesh = makeCarMesh(pick(colors), false);
    const x = axis === 'x' ? rnd(-950, 950) : road + off;
    const z = axis === 'x' ? road + off : rnd(-950, 950);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.world.traffic.push({ mesh, x, z, a: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), v: 0, road, axis, dir, speed: rnd(11, 19), player: false });
  }
  // Parked bikes.
  for (let i = 0; i < 4; i++) {
    const mesh = makeBikeMesh(pick(colors));
    const x = pick(ROADS) + rnd(-60, 60);
    const z = pick(ROADS) + 34;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.world.traffic.push({ mesh, x, z, a: rnd(0, 6.28), v: 0, kind: 'bike', speed: 0, player: false, parked: true });
  }
}

function spawnBoats() {
  const colors = [0xe8eef2, 0xf2bd51, 0x34b9cd];
  const spots = [[760, -60], [780, 120], [740, 300]];
  for (const [x, z] of spots) {
    const mesh = makeBoatMesh(pick(colors));
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.world.boats.push({ mesh, x, z, a: Math.PI / 2, v: 0, player: false, moored: true });
  }
}

function spawnHeli() {
  const mesh = makeHeliMesh(0xd83a2e);
  mesh.position.set(-750, 0, 750);
  G.scene.add(mesh);
  G.world.helis.push({ mesh, x: -750, z: 750, a: 0, h: 0, player: false });
}

function updateTraffic(dt) {
  for (const c of G.world.traffic) {
    if (c.player || c.parked) continue;
    const step = c.speed * dt;
    if (c.axis === 'x') {
      c.x += c.dir * step;
      if (c.x > 990) c.x = -990;
      if (c.x < -990) c.x = 990;
    } else {
      c.z += c.dir * step;
      if (c.z > 990) c.z = -990;
      if (c.z < -990) c.z = 990;
    }
    // Slow down when the player is right ahead.
    const dp = dist2(c.x, c.z, G.player.x, G.player.z);
    const slow = dp < 25 ? 0.35 : 1;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = -c.a;
    c._slow = slow;
  }
}

function nearestVehicle(maxD) {
  let best = null;
  let bd = maxD;
  const consider = (v, x, z) => {
    const d = dist2(x, z, G.player.x, G.player.z);
    if (d < bd) { bd = d; best = v; }
  };
  for (const c of G.world.traffic) if (!c.player) consider(c, c.x, c.z);
  for (const b of G.world.boats) if (!b.player) consider(b, b.x, b.z);
  for (const h of G.world.helis) if (!h.player) consider(h, h.x, h.z);
  return best;
}

function enterVehicle(v) {
  if (!v) return false;
  if (v.mesh && v.kind === 'bike') G.mode = 'bike';
  else if (G.world.boats.includes(v)) G.mode = 'boat';
  else if (G.world.helis.includes(v)) G.mode = 'heli';
  else G.mode = 'car';
  v.player = true;
  v.moored = false;
  G.vehicle = v;
  G.player.mesh.visible = false;
  if (G.mode === 'car' || G.mode === 'bike') {
    if (!v._stolen && G.world.traffic.includes(v)) {
      v._stolen = true;
      addWanted(1);
      toast('Vehicle stolen — the law is coming');
    }
  }
  AudioSys.blip(300, 0.12, 'square', 0.12);
  return true;
}

function exitVehicle() {
  const v = G.vehicle;
  if (!v) return;
  v.player = false;
  v.v = 0;
  G.vehicle = null;
  G.mode = 'walk';
  G.player.v = 0;
  G.player.x += Math.cos(G.player.a + Math.PI / 2) * 3;
  G.player.z += Math.sin(G.player.a + Math.PI / 2) * 3;
  const fixed = collideBuildings(G.player.x, G.player.z, 1.5);
  G.player.x = fixed[0];
  G.player.z = fixed[1];
  G.player.mesh.visible = true;
}

function updatePlayerVehicle(dt) {
  const v = G.vehicle;
  if (!v) return;
  const k = G.keys;
  const top = (G.mode === 'car' ? 62 : G.mode === 'bike' ? 55 : G.mode === 'boat' ? 34 : 40) * (1 + G.upgrades.engine * 0.18);
  const accel = G.mode === 'heli' ? 26 : 34;
  const fwd = (k['w'] ? 1 : 0) - (k['s'] ? 1 : 0);
  const turn = (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0);
  if (G.mode === 'heli') {
    v.a += turn * dt * 1.6;
    v.v += fwd * dt * accel;
    v.v *= Math.pow(0.25, dt);
    v.v = clamp(v.v, -14, top);
    v.x += Math.cos(v.a) * v.v * dt;
    v.z += Math.sin(v.a) * v.v * dt;
    if (k[' ']) v.h = clamp(v.h + dt * 14, 0, 120);
    if (k['c']) v.h = clamp(v.h - dt * 16, 0, 120);
    if (v.h <= 0.5 && Math.abs(v.v) < 2) v.h = 0;
    v.mesh.position.set(v.x, v.h + 0.4, v.z);
    v.mesh.rotation.y = -v.a;
    const rotor = v.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y += dt * 22;
    G.player.x = v.x;
    G.player.z = v.z;
    G.player.a = v.a;
    G.speedKmh = Math.abs(v.v) * 3.4;
    return;
  }
  v.v += fwd * dt * accel;
  const drag = k[' '] ? 0.02 : 0.35;
  v.v *= Math.pow(drag, dt);
  v.v = clamp(v.v, -18, top);
  v.a += turn * dt * (1.1 + Math.abs(v.v) * 0.014) * (v.v >= 0 ? 1 : -1);
  let nx = v.x + Math.cos(v.a) * v.v * dt;
  let nz = v.z + Math.sin(v.a) * v.v * dt;
  if (G.mode === 'boat') {
    nx = clamp(nx, 690, 990);
    nz = clamp(nz, -990, 990);
    v.mesh.position.y = Math.sin(G.elapsed * 1.4) * 0.25;
  } else {
    if (isWater(nx, nz)) {
      v.v *= 0.4;
      nx = v.x;
      nz = v.z;
      toast('Too deep — turn back');
    }
    const fixed = collideBuildings(nx, nz, 2.4);
    if (fixed[0] !== nx || fixed[1] !== nz) v.v *= 0.5;
    nx = fixed[0];
    nz = fixed[1];
    nx = clamp(nx, -990, 690);
    nz = clamp(nz, -990, 990);
  }
  v.x = nx;
  v.z = nz;
  v.mesh.position.set(v.x, G.mode === 'boat' ? v.mesh.position.y : 0, v.z);
  v.mesh.rotation.y = -v.a;
  v.mesh.rotation.z = -turn * 0.04 * Math.min(1, Math.abs(v.v) / 20);
  G.player.x = v.x;
  G.player.z = v.z;
  G.player.a = v.a;
  G.speedKmh = Math.abs(v.v) * 3.4;
  AudioSys.engine(Math.abs(v.v) / top, true);
}
