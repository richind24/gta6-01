// Cobalt Vice — pedestrians, police pursuit, wanted level, busted.
function makePedMesh(shirt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: shirt })
  );
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 })
  );
  head.position.y = 1.75;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2c3240 })
  );
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

function spawnPeds(n) {
  const shirts = [0xd84a5a, 0x3fae5a, 0x4a7ad8, 0xe0a53c, 0x8a5ad8, 0xe8e8e8, 0x222222];
  for (let i = 0; i < n; i++) {
    const mesh = makePedMesh(pick(shirts));
    const x = pick(ROADS) + rnd(-80, 80);
    const z = pick(ROADS) + 36;
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.world.peds.push({ mesh, x, z, a: rnd(0, 6.28), speed: rnd(1.2, 2.4), panic: 0, health: 50 });
  }
}

function updatePeds(dt) {
  for (const p of G.world.peds) {
    if (p.health <= 0) continue;
    let sp = p.speed;
    if (p.panic > 0) {
      p.panic -= dt;
      sp = 6;
      // Run away from the player.
      p.a = Math.atan2(p.z - G.player.z, p.x - G.player.x);
    } else if (Math.random() < dt * 0.08) {
      p.a += rnd(-1.2, 1.2);
    }
    let nx = p.x + Math.cos(p.a) * sp * dt;
    let nz = p.z + Math.sin(p.a) * sp * dt;
    if (isWater(nx, nz) || Math.abs(nx) > 990 || Math.abs(nz) > 990) {
      p.a += Math.PI;
      nx = p.x;
      nz = p.z;
    }
    const fixed = collideBuildings(nx, nz, 1);
    p.x = fixed[0];
    p.z = fixed[1];
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = -p.a;
    // Walk bob.
    p.mesh.position.y = Math.abs(Math.sin(G.elapsed * 8 + p.x)) * 0.06;
  }
}

function addWanted(n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
}

function ensureCops(dt) {
  const want = Math.min(G.wanted, 5);
  // Spawn up to `want` cop cars.
  while (G.world.cops.length < want) {
    const mesh = makeCarMesh(0x11151a, true);
    const a = rnd(0, Math.PI * 2);
    const x = clamp(G.player.x + Math.cos(a) * rnd(140, 240), -950, 650);
    const z = clamp(G.player.z + Math.sin(a) * rnd(140, 240), -950, 950);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.world.cops.push({ mesh, x, z, a: 0, v: 0, health: 100, lightT: rnd(0, 1) });
  }
  // Despawn extras when wanted falls.
  while (G.world.cops.length > want) {
    const c = G.world.cops.pop();
    G.scene.remove(c.mesh);
  }
  // Police helicopter at wanted 3+.
  if (G.wanted >= 3 && !G.world.copHeli) {
    const mesh = makeHeliMesh(0x1c2f4a);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(14, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.position.y = -20;
    mesh.add(cone);
    G.scene.add(mesh);
    G.world.copHeli = { mesh, x: G.player.x + 60, z: G.player.z + 60, a: 0, h: 70 };
    AudioSys.siren(true);
  } else if (G.wanted < 3 && G.world.copHeli) {
    G.scene.remove(G.world.copHeli.mesh);
    G.world.copHeli = null;
    if (G.wanted === 0) AudioSys.siren(false);
  }
  if (G.wanted > 0 && G.world.copHeli) AudioSys.siren(true);
  if (G.wanted === 0) AudioSys.siren(false);
}

let bustedT = 0;
function updateCops(dt) {
  ensureCops(dt);
  let near = false;
  for (const c of G.world.cops) {
    const dx = G.player.x - c.x;
    const dz = G.player.z - c.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dz, dx);
    c.a += clamp(angDiff(c.a, want), -1.9 * dt, 1.9 * dt);
    const target = d > 60 ? 58 : 46;
    c.v = lerp(c.v, target, dt * 0.5);
    let nx = c.x + Math.cos(c.a) * c.v * dt;
    let nz = c.z + Math.sin(c.a) * c.v * dt;
    const fixed = collideBuildings(nx, nz, 2.4);
    if (fixed[0] !== nx || fixed[1] !== nz) c.v *= 0.6;
    c.x = clamp(fixed[0], -990, 690);
    c.z = clamp(fixed[1], -990, 990);
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = -c.a;
    // Flashing light bar.
    c.lightT += dt * 6;
    const bar = c.mesh.children.find((m) => m.geometry && m.geometry.type === 'BoxGeometry' && m.position.y > 1.8);
    if (bar) bar.material.emissive.setHex(Math.sin(c.lightT) > 0 ? 0x2244ff : 0xff2222);
    if (d < 12) near = true;
    if (d < 7 && G.speedKmh < 12) {
      bustedT += dt;
      if (bustedT > 2.5) {
        bustedT = 0;
        doBusted();
      }
    }
    // Ram damage.
    if (d < 4.5 && G.speedKmh > 5) {
      damagePlayer(dt * 6);
    }
  }
  if (!near) bustedT = Math.max(0, bustedT - dt);
  // Cop heli orbits the player.
  const h = G.world.copHeli;
  if (h) {
    h.a += dt * 0.35;
    h.x = G.player.x + Math.cos(h.a) * 55;
    h.z = G.player.z + Math.sin(h.a) * 55;
    h.mesh.position.set(h.x, h.h, h.z);
    h.mesh.rotation.y = -Math.atan2(G.player.z - h.z, G.player.x - h.x);
    const rotor = h.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y += dt * 20;
  }
  // Wanted decays when the player stays clean and out of sight.
  if (G.wanted > 0) {
    G._cleanT = (G._cleanT || 0) + dt;
    if (G._cleanT > 25 && !near) {
      G._cleanT = 0;
      G.wanted = Math.max(0, G.wanted - 1);
    }
  } else {
    G._cleanT = 0;
  }
}

function damagePlayer(amount) {
  const mult = G.upgrades.armor > 0 ? 0.6 : 1;
  G.health = clamp(G.health - amount * mult, 0, G.maxHealth);
  if (G.health <= 0) {
    G.health = G.maxHealth;
    G.money = Math.max(0, G.money - 500);
    G.wanted = 0;
    G.player.x = 0;
    G.player.z = -800;
    if (G.vehicle) exitVehicle();
    toast('BUSTED — hospital fee $500');
    AudioSys.denied();
  }
}

function doBusted() {
  G.health = G.maxHealth;
  G.money = Math.max(0, G.money - 500);
  G.wanted = 0;
  if (G.vehicle) exitVehicle();
  G.player.x = 0;
  G.player.z = -800;
  G.player.a = 0;
  toast('BUSTED — you paid $500 and walked free');
  AudioSys.denied();
}
