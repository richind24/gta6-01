// Cobalt Vice — city generation, sky, weather, collision helpers.
const WORLD_BUILD = {};

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 2048;
  const x = c.getContext('2d');
  const px = (wx) => ((wx + 1000) / 2000) * 2048;
  const pz = (wz) => ((wz + 1000) / 2000) * 2048;
  // Sidewalk base.
  x.fillStyle = '#7d838c';
  x.fillRect(0, 0, 2048, 2048);
  // Water (east) + beach.
  x.fillStyle = '#1d6f9e';
  x.fillRect(px(700), 0, 2048 - px(700), 2048);
  x.strokeStyle = 'rgba(255,255,255,0.25)';
  x.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const wy = Math.random() * 2048;
    const wx = px(720) + Math.random() * (2048 - px(720));
    x.beginPath();
    x.moveTo(wx, wy);
    x.lineTo(wx + 40 + Math.random() * 80, wy);
    x.stroke();
  }
  x.fillStyle = '#d9c28a';
  x.fillRect(px(660), 0, px(700) - px(660), 2048);
  // Park (south-west block).
  x.fillStyle = '#3f7a3a';
  x.fillRect(px(-600), pz(-600), px(-300) - px(-600), pz(-300) - pz(-600));
  x.fillStyle = '#57a04e';
  for (let i = 0; i < 26; i++) {
    x.beginPath();
    x.arc(px(-580 + Math.random() * 260), pz(-580 + Math.random() * 260), 12 + Math.random() * 22, 0, 7);
    x.fill();
  }
  // Roads.
  for (const r of ROADS) {
    x.fillStyle = '#2b2f36';
    x.fillRect(px(-1000), pz(r - 30), 2048, pz(r + 30) - pz(r - 30));
    x.fillRect(px(r - 30), pz(-1000), px(r + 30) - px(r - 30), 2048);
  }
  // Lane dashes.
  x.strokeStyle = '#e8c33c';
  x.lineWidth = 4;
  x.setLineDash([26, 30]);
  for (const r of ROADS) {
    x.beginPath(); x.moveTo(px(-1000), pz(r)); x.lineTo(px(660), pz(r)); x.stroke();
    x.beginPath(); x.moveTo(px(r), pz(-1000)); x.lineTo(px(r), pz(1000)); x.stroke();
  }
  x.setLineDash([]);
  // Crosswalks at intersections.
  x.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rx of ROADS) for (const rz of ROADS) {
    for (let i = -4; i < 5; i++) {
      x.fillRect(px(rx - 24 + i * 6), pz(rz - 34), 3, 10);
      x.fillRect(px(rx - 24 + i * 6), pz(rz + 24), 3, 10);
    }
  }
  // Central plaza.
  x.fillStyle = '#9aa0a8';
  x.fillRect(px(-60), pz(-60), px(60) - px(-60), pz(60) - pz(-60));
  x.fillStyle = '#5d7ea6';
  x.beginPath();
  x.arc(px(0), pz(0), 26, 0, 7);
  x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#9aa4ae';
  x.fillRect(0, 0, 128, 256);
  for (let r = 0; r < 14; r++) {
    for (let col = 0; col < 6; col++) {
      const lit = Math.random() < 0.35;
      x.fillStyle = lit ? '#ffd97a' : (Math.random() < 0.5 ? '#54687e' : '#3c4c60');
      x.fillRect(8 + col * 19, 10 + r * 17, 13, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWorld() {
  const scene = G.scene;
  const tex = groundTexture();
  G.groundCanvas = tex.image;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Water surface (slightly above ground, semi-transparent).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 2000),
    new THREE.MeshLambertMaterial({ color: 0x2a7fb8, transparent: true, opacity: 0.55 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(850, 0.6, 0);
  scene.add(water);

  // Buildings.
  const facade = facadeTexture();
  const tints = [0xdde4ec, 0xe8dcc0, 0xc4d8e4, 0xe0c4c4, 0xc0d4c0, 0xeeeeee];
  const blockCenters = [-750, -450, -150, 150, 450, 750];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bx === 750) continue; // beach / water edge
      if (bx === -450 && bz === -450) continue; // park
      if (bx === -750 && bz === 750) continue; // helipad lot
      const downtown = Math.abs(bx) <= 300 && Math.abs(bz) <= 300;
      const h = downtown ? rnd(60, 150) : rnd(15, 55);
      const w = rnd(110, 180);
      const d = rnd(110, 180);
      const mat = new THREE.MeshLambertMaterial({ map: facade, color: pick(tints) });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx, h / 2, bz);
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.5, 4, d * 0.5),
        new THREE.MeshLambertMaterial({ color: 0x3a4048 })
      );
      roof.position.set(bx, h + 2, bz);
      scene.add(roof);
      G.world.buildings.push({ x: bx, z: bz, w, d, h, mesh: b });
      // A second smaller tower on downtown blocks.
      if (downtown && Math.random() < 0.6) {
        const h2 = rnd(25, 60);
        const b2 = new THREE.Mesh(
          new THREE.BoxGeometry(70, h2, 70),
          new THREE.MeshLambertMaterial({ map: facade, color: pick(tints) })
        );
        b2.position.set(bx + 110, h2 / 2, bz + 90);
        b2.castShadow = true;
        scene.add(b2);
        G.world.buildings.push({ x: bx + 110, z: bz + 90, w: 70, d: 70, h: h2, mesh: b2 });
      }
    }
  }
  // Landmark tower at the plaza.
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(90, 210, 90),
    new THREE.MeshLambertMaterial({ map: facade, color: 0x8fb8d8 })
  );
  tower.position.set(0, 105, -150);
  tower.castShadow = true;
  scene.add(tower);
  G.world.buildings.push({ x: 0, z: -150, w: 90, d: 90, h: 210, mesh: tower });

  // Trees (park + sidewalks).
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a33 });
  for (let i = 0; i < 90; i++) {
    const inPark = i < 50;
    const tx = inPark ? rnd(-580, -320) : pick(ROADS) + rnd(-90, 90);
    const tz = inPark ? rnd(-580, -320) : pick(ROADS) + rnd(-90, 90);
    if (tx > 640) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 6, 6), trunkMat);
    trunk.position.set(tx, 3, tz);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(rnd(5, 8), rnd(10, 16), 7), leafMat);
    leaves.position.set(tx, 11, tz);
    leaves.castShadow = true;
    scene.add(trunk);
    scene.add(leaves);
  }

  // Street lamps along roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf80, emissiveIntensity: 0.4 });
  for (const r of ROADS) {
    for (let k = -2; k <= 2; k++) {
      for (const [lx, lz] of [[r + k * 300 + 40, r + 34], [r + 34, r + k * 300 + 40]]) {
        if (lx > 640 || lz > 990) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 11, 6), poleMat);
        pole.position.set(lx, 5.5, lz);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), lampMat);
        bulb.position.set(lx, 11.4, lz);
        scene.add(pole);
        scene.add(bulb);
        G.lamps.push(bulb);
      }
    }
  }

  // Pier + moored boats area.
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  for (let i = 0; i < 12; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 26), woodMat);
    plank.position.set(700 + i * 12, 1.2, -60 + (i % 2) * 120);
    scene.add(plank);
  }

  // Helipad lot (south-west corner block).
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 1, 24),
    new THREE.MeshLambertMaterial({ color: 0x3c4148 })
  );
  pad.position.set(-750, 0.5, 750);
  scene.add(pad);
  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(20, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, side: THREE.DoubleSide })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(-750, 1.1, 750);
  scene.add(padRing);

  // Rain particles (hidden until weather turns).
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    rp[i * 3] = rnd(-120, 120);
    rp[i * 3 + 1] = rnd(0, 80);
    rp[i * 3 + 2] = rnd(-120, 120);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  G.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.7, transparent: true, opacity: 0.6 }));
  G.rain.visible = false;
  scene.add(G.rain);
}

function isWater(x, z) {
  return x > WORLD.waterX;
}

// Push a point out of building AABBs. Returns corrected [x, z].
function collideBuildings(x, z, r) {
  for (const b of G.world.buildings) {
    const hw = b.w / 2 + r;
    const hd = b.d / 2 + r;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) {
      const dx = hw - Math.abs(x - b.x);
      const dz = hd - Math.abs(z - b.z);
      if (dx < dz) x = b.x + (x > b.x ? hw : -hw);
      else z = b.z + (z > b.z ? hd : -hd);
    }
  }
  return [x, z];
}

function updateWorld(dt) {
  G.time = (G.time + dt * 0.02) % 24;
  // Weather cycle.
  G.weatherT += dt;
  if (G.weatherT > 50) {
    G.weatherT = 0;
    G.weather = (G.weather + 1) % 3;
  }
  const t = G.time;
  // Sun angle: noon = overhead, 6h/18h = horizon.
  const sunA = ((t - 6) / 12) * Math.PI;
  const sunH = Math.sin(sunA);
  const dayF = clamp(sunH * 1.4, 0, 1);
  const duskF = clamp(1 - Math.abs(sunH) * 3, 0, 1) * (t > 6 && t < 20 ? 1 : 0);
  const sunColor = new THREE.Color().setHSL(0.09, 0.7, lerp(0.35, 0.65, dayF));
  if (G.sun) {
    G.sun.position.set(Math.cos(sunA) * 600, Math.max(40, sunH * 600), 300);
    G.sun.intensity = 0.25 + dayF * 2.2;
    G.sun.color.copy(sunColor);
  }
  if (G.hemi) G.hemi.intensity = 0.35 + dayF * 0.65;
  // Sky + fog.
  const sky = new THREE.Color();
  if (dayF > 0.6) sky.setHex(0x7ec8f7);
  else if (dayF > 0.15) sky.setHex(0xe89a6a);
  else sky.setHex(0x0a1626);
  if (duskF > 0.4 && dayF < 0.7) sky.lerp(new THREE.Color(0xe8785a), duskF * 0.5);
  if (G.scene) {
    G.scene.background = sky;
    if (G.scene.fog) {
      G.scene.fog.color.copy(sky);
      G.scene.fog.far = G.weather === 2 ? 500 : 1700;
      G.scene.fog.near = G.weather === 2 ? 60 : 400;
    }
  }
  // Lamps glow at night.
  for (const l of G.lamps) l.material.emissiveIntensity = dayF > 0.4 ? 0.15 : 1.6;
  // Rain.
  if (G.rain) {
    G.rain.visible = G.weather === 1;
    if (G.rain.visible) {
      const pos = G.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 90;
        if (y < 0) y = 80;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      G.rain.position.set(G.player.x, 0, G.player.z);
    }
  }
}
