// Cobalt Vice — weapons, hitscan combat, tracers, muzzle flash.
const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, rate: 0.45, range: 3.5, auto: false, price: 0, ammoPrice: 0 },
  pistol: { name: 'Pistol', dmg: 26, rate: 0.34, range: 70, auto: false, price: 500, ammoPrice: 40 },
  smg: { name: 'SMG', dmg: 15, rate: 0.09, range: 55, auto: true, price: 1500, ammoPrice: 90 },
  shotgun: { name: 'Shotgun', dmg: 13, pellets: 6, rate: 0.95, range: 32, auto: false, price: 1200, ammoPrice: 60 },
  rifle: { name: 'Rifle', dmg: 48, rate: 0.55, range: 130, auto: false, price: 2500, ammoPrice: 120 },
};

let lastShotT = 0;
let tracers = [];
let flashT = 0;
let flashMesh = null;

function getAimPoint() {
  // Mouse ray onto the ground plane y=0.
  const ndc = new THREE.Vector2(
    (G.mouse.x / window.innerWidth) * 2 - 1,
    -(G.mouse.y / window.innerHeight) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, G.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, hit)) return hit;
  return new THREE.Vector3(G.player.x + Math.cos(G.player.a) * 20, 0, G.player.z + Math.sin(G.player.a) * 20);
}

function shoot() {
  if (!G.started || G.paused || G.shopOpen) return;
  const w = WEAPONS[G.weapon];
  const now = G.elapsed;
  if (now - lastShotT < w.rate) return;
  lastShotT = now;
  const px = G.player.x;
  const pz = G.player.z;
  if (G.weapon === 'fists') {
    // Melee: hit anything close in front.
    let hitAny = false;
    for (const p of G.world.peds) {
      if (p.health > 0 && dist2(p.x, p.z, px, pz) < 3.5) {
        hurtPed(p, w.dmg);
        hitAny = true;
      }
    }
    for (const c of G.world.cops) {
      if (dist2(c.x, c.z, px, pz) < 4) {
        c.health -= w.dmg;
        hitAny = true;
        if (c.health <= 0) destroyCop(c);
      }
    }
    if (hitAny) AudioSys.noise(0.1, 0.25, 900);
    return;
  }
  if (G.ammo[G.weapon] <= 0) {
    toast('No ammo — visit Ironworks Arms');
    AudioSys.denied();
    return;
  }
  G.ammo[G.weapon]--;
  const aim = getAimPoint();
  const dirA = Math.atan2(aim.z - pz, aim.x - px);
  G.player.a = dirA;
  const pellets = w.pellets || 1;
  let endX = px + Math.cos(dirA) * w.range;
  let endZ = pz + Math.sin(dirA) * w.range;
  let hitSomething = false;
  const tryHit = (tx, tz, radius, apply) => {
    const d = dist2(tx, tz, px, pz);
    if (d > w.range + radius) return false;
    const ang = Math.abs(angDiff(dirA, Math.atan2(tz - pz, tx - px)));
    if (ang < 0.22 + radius / Math.max(d, 1)) {
      endX = tx;
      endZ = tz;
      apply(d);
      return true;
    }
    return false;
  };
  for (let i = 0; i < pellets; i++) {
    for (const p of G.world.peds) {
      if (p.health > 0 && tryHit(p.x, p.z, 1.2, () => hurtPed(p, w.dmg))) { hitSomething = true; break; }
    }
    for (const c of G.world.cops) {
      if (tryHit(c.x, c.z, 2.2, () => { c.health -= w.dmg; if (c.health <= 0) destroyCop(c); })) { hitSomething = true; break; }
    }
    for (const r of G.world.rivals) {
      if (tryHit(r.x, r.z, 2.2, () => { r.health -= w.dmg; if (r.health <= 0) destroyRival(r); })) { hitSomething = true; break; }
    }
  }
  // Tracer + muzzle flash.
  const start = new THREE.Vector3(px, G.mode === 'walk' ? 1.4 : 1.2, pz);
  const end = new THREE.Vector3(endX, 0.9, endZ);
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 }));
  G.scene.add(line);
  tracers.push({ line, t: 0.09 });
  if (!flashMesh) {
    flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdf6a, transparent: true, opacity: 0.9 })
    );
    G.scene.add(flashMesh);
  }
  flashMesh.position.set(px + Math.cos(dirA) * 2, 1.4, pz + Math.sin(dirA) * 2);
  flashMesh.visible = true;
  flashT = 0.06;
  if (G.weapon === 'shotgun') AudioSys.shotgunBlast();
  else AudioSys.gunshot();
  // Gunfire draws attention.
  let witness = false;
  for (const p of G.world.peds) if (p.health > 0 && dist2(p.x, p.z, px, pz) < 90) { witness = true; p.panic = 4; }
  for (const c of G.world.cops) if (dist2(c.x, c.z, px, pz) < 120) witness = true;
  if (witness) {
    addWanted(0.3);
    G._cleanT = 0;
  }
}

function hurtPed(p, dmg) {
  p.health -= dmg;
  p.panic = 5;
  if (p.health <= 0) {
    p.mesh.visible = false;
    addWanted(1);
    G._cleanT = 0;
    toast('Civilian down — wanted level up');
    setTimeout(() => {
      p.health = 50;
      p.x = pick(ROADS) + rnd(-80, 80);
      p.z = pick(ROADS) + 36;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.visible = true;
    }, 20000);
  }
}

function destroyCop(c) {
  AudioSys.explosion();
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(3, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.9 })
  );
  boom.position.set(c.x, 1.5, c.z);
  G.scene.add(boom);
  tracers.push({ line: boom, t: 0.5, boom: true });
  G.scene.remove(c.mesh);
  G.world.cops = G.world.cops.filter((o) => o !== c);
  addWanted(1);
  G.money += 100;
  toast('Cop car destroyed — $100 salvage');
}

function destroyRival(r) {
  AudioSys.explosion();
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5522, transparent: true, opacity: 0.9 })
  );
  boom.position.set(r.x, 1.5, r.z);
  G.scene.add(boom);
  tracers.push({ line: boom, t: 0.5, boom: true });
  G.scene.remove(r.mesh);
  G.world.rivals = G.world.rivals.filter((o) => o !== r);
  G.money += 250;
}

function updateCombat(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.t -= dt;
    if (t.boom) {
      t.line.scale.multiplyScalar(1 + dt * 6);
      t.line.material.opacity = Math.max(0, t.t * 1.8);
    } else {
      t.line.material.opacity = Math.max(0, t.t * 10);
    }
    if (t.t <= 0) {
      G.scene.remove(t.line);
      if (t.line.geometry) t.line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  if (flashMesh) {
    flashT -= dt;
    if (flashT <= 0) flashMesh.visible = false;
  }
  // SMG auto-fire while the mouse is held.
  if (G.mouse.down && G.weapon === 'smg') shoot();
}
