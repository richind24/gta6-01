// Cobalt Vice — 8 story missions + 4 side missions, beacons, objectives.
function makeBeacon(x, z, color) {
  const geo = new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: color || 0xffd23c, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 30, z);
  G.scene.add(m);
  G.world.beacons.push(m);
  return m;
}

function clearBeacons() {
  for (const b of G.world.beacons) G.scene.remove(b);
  G.world.beacons = [];
}

function banner(text) {
  G.banner = text;
  G.bannerT = 3.2;
  const el = document.getElementById('banner');
  if (el) {
    el.textContent = text;
    el.style.opacity = '1';
  }
}

function toast(msg) {
  G.toast = msg;
  G.toastT = 3.5;
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg;
    el.style.opacity = '1';
  }
}

const STORY = [
  { title: 'BLUE HARBOR RUN', obj: 'Drive to the harbor pickup', marker: [640, 0], type: 'goto', reward: 800 },
  { title: 'THE GLASS KEY', obj: 'Meet Inez at the helipad', marker: [-750, 750], type: 'goto', reward: 1200 },
  { title: 'NEON DEBT', obj: 'Hold the corner store for 5 seconds', marker: [150, 300], type: 'hold', holdT: 5, reward: 1500 },
  { title: 'TIDE TURNER', obj: 'Take the boat to the marina drop', marker: [850, -300], type: 'goto', needBoat: true, reward: 2000 },
  { title: 'SKYLINE HUSTLE', obj: 'Hit all 5 race gates in order', type: 'race', gates: [[-600, -600], [600, -600], [600, 600], [-600, 600], [0, 0]], reward: 2500 },
  { title: 'THE MERIDIAN JOB', obj: 'Steal the target sedan, bring it to the garage', marker: [450, 150], type: 'steal', reward: 3000 },
  { title: 'HEAT WAVE', obj: 'Survive wanted level 4 for 60 seconds', type: 'survive', want: 4, dur: 60, reward: 3500 },
  { title: 'KING OF PORT MERIDIAN', obj: 'Destroy 3 rival cars, then reach the safehouse', type: 'kill', count: 3, then: [0, -800], reward: 10000 },
];

function startMission(i) {
  const def = STORY[i];
  if (!def) return;
  clearBeacons();
  const m = { ...def, index: i, t: 0, hold: 0, gate: 0, kills: 0, done: false, phase: 0 };
  G.mission = m;
  banner('MISSION ' + (i + 1) + ' — ' + def.title);
  toast(def.obj);
  if (def.type === 'race') {
    makeBeacon(def.gates[0][0], def.gates[0][1], 0x35d05a);
  } else if (def.marker) {
    makeBeacon(def.marker[0], def.marker[1], 0xffd23c);
  }
  if (def.type === 'survive') {
    G.wanted = Math.max(G.wanted, def.want);
  }
  if (def.type === 'kill') {
    for (let k = 0; k < def.count; k++) {
      const mesh = makeCarMesh(0x8a1a1a, false);
      const a = rnd(0, Math.PI * 2);
      const x = clamp(G.player.x + Math.cos(a) * rnd(60, 120), -900, 650);
      const z = clamp(G.player.z + Math.sin(a) * rnd(60, 120), -900, 900);
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      G.world.rivals.push({ mesh, x, z, a: 0, v: 0, health: 120 });
    }
  }
  if (def.type === 'steal') {
    const mesh = makeCarMesh(0xf2bd51, false);
    mesh.position.set(-300, 0, -300);
    G.scene.add(mesh);
    const car = { mesh, x: -300, z: -300, a: 0.8, v: 0, road: -300, axis: 'x', dir: 1, speed: 0, player: false, target: true, parked: true };
    G.world.traffic.push(car);
    m.targetCar = car;
    toast('The gold sedan is parked at (-300, -300). Steal it.');
  }
}

function completeMission() {
  const m = G.mission;
  if (!m) return;
  G.money += m.reward;
  AudioSys.cash();
  banner('MISSION COMPLETE — $' + m.reward.toLocaleString());
  toast('+$' + m.reward.toLocaleString() + '  •  Mission ' + (m.index + 1) + ' of ' + STORY.length + ' done');
  G.missionIndex = m.index + 1;
  G.mission = null;
  clearBeacons();
  saveGame();
  if (G.missionIndex >= STORY.length) {
    G.money += 5000;
    banner('STORY COMPLETE — PORT MERIDIAN IS YOURS  •  +$5,000');
    toast('You finished all 8 story missions. Free roam, side jobs and properties remain.');
  } else {
    setTimeout(() => startMission(G.missionIndex), 2500);
  }
}

function updateMissions(dt) {
  const m = G.mission;
  if (!m) return;
  m.t += dt;
  const px = G.player.x;
  const pz = G.player.z;
  if (m.type === 'goto') {
    const [mx, mz] = m.marker;
    if (dist2(px, pz, mx, mz) < 12) {
      if (m.needBoat && G.mode !== 'boat') {
        toast('You need the boat for this one');
        return;
      }
      completeMission();
    }
  } else if (m.type === 'hold') {
    const [mx, mz] = m.marker;
    if (dist2(px, pz, mx, mz) < 10) {
      m.hold += dt;
      if (m.hold >= m.holdT) completeMission();
      else if (Math.floor(m.hold * 2) !== Math.floor((m.hold - dt) * 2)) toast('Holding the store… ' + Math.ceil(m.holdT - m.hold) + 's');
    } else {
      m.hold = 0;
    }
  } else if (m.type === 'race') {
    const g = m.gates[m.gate];
    if (dist2(px, pz, g[0], g[1]) < 14) {
      AudioSys.pickup();
      m.gate++;
      if (m.gate >= m.gates.length) {
        completeMission();
      } else {
        clearBeacons();
        makeBeacon(m.gates[m.gate][0], m.gates[m.gate][1], 0x35d05a);
        toast('Gate ' + (m.gate + 1) + ' of ' + m.gates.length);
      }
    }
  } else if (m.type === 'steal') {
    if (m.targetCar && m.targetCar.player) {
      const [mx, mz] = m.marker;
      clearBeacons();
      makeBeacon(mx, mz, 0x35d05a);
      m.phase = 1;
      m.type = 'goto';
      m.obj = 'Bring the sedan to the Harbor Garage';
      toast('Got it — now lose the heat and deliver it');
      addWanted(2);
    }
  } else if (m.type === 'survive') {
    if (G.wanted >= 3) {
      m.t2 = (m.t2 || 0) + dt;
      if (Math.floor(m.t2) % 10 === 0 && Math.floor((m.t2 - dt)) % 10 !== 0) toast('Stay alive… ' + Math.ceil(m.dur - m.t2) + 's');
      if (m.t2 >= m.dur) completeMission();
    }
  } else if (m.type === 'kill') {
    if (m.phase === 0) {
      // Rival cars ram the player.
      for (const r of G.world.rivals) {
        const want = Math.atan2(G.player.z - r.z, G.player.x - r.x);
        r.a += clamp(angDiff(r.a, want), -2.2 * dt, 2.2 * dt);
        r.v = lerp(r.v, 42, dt * 0.4);
        r.x += Math.cos(r.a) * r.v * dt;
        r.z += Math.sin(r.a) * r.v * dt;
        const fixed = collideBuildings(r.x, r.z, 2.4);
        r.x = clamp(fixed[0], -990, 690);
        r.z = clamp(fixed[1], -990, 990);
        r.mesh.position.set(r.x, 0, r.z);
        r.mesh.rotation.y = -r.a;
        if (dist2(r.x, r.z, px, pz) < 5) damagePlayer(dt * 10);
      }
      if (G.world.rivals.length === 0) {
        m.phase = 1;
        m.type = 'goto';
        m.marker = m.then;
        clearBeacons();
        makeBeacon(m.then[0], m.then[1], 0x35d05a);
        m.obj = 'All rivals down — reach the safehouse';
        toast('All rivals destroyed. Get to the safehouse.');
      }
    }
  }
}

// ---- Side missions ----
const SIDE_DEFS = [
  { kind: 'race', label: 'STREET RACE', x: -600, z: 600, reward: 1000, desc: '4 gates, 90 seconds' },
  { kind: 'courier', label: 'COURIER', x: 300, z: -600, reward: 900, desc: 'Deliver 3 packages' },
  { kind: 'robbery', label: 'STORE ROBBERY', x: -300, z: 150, reward: 1800, desc: 'Hold the till 8s, then escape' },
  { kind: 'tail', label: 'TAIL THE MARK', x: 600, z: 600, reward: 1200, desc: 'Follow the mark 30s, stay 15–40m' },
];

function spawnSideMarkers() {
  for (const d of SIDE_DEFS) {
    const geo = new THREE.OctahedronGeometry(2.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xc05adf });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(d.x, 6, d.z);
    G.scene.add(mesh);
    G.world.markers.push({ ...d, mesh });
  }
}

function startSide(def) {
  if (G.side || G.sideCooldown > 0) return;
  clearBeacons();
  const s = { ...def, t: 0, step: 0, hold: 0 };
  G.side = s;
  banner('SIDE JOB — ' + def.label);
  toast(def.desc + '  •  $' + def.reward.toLocaleString());
  if (def.kind === 'race') {
    s.gates = [[-600, 300], [0, 600], [600, 300], [0, 0]];
    s.limit = 90;
    makeBeacon(s.gates[0][0], s.gates[0][1], 0xc05adf);
  } else if (def.kind === 'courier') {
    s.drops = [[450, -450], [-150, 450], [600, -150]];
    makeBeacon(s.drops[0][0], s.drops[0][1], 0xc05adf);
  } else if (def.kind === 'robbery') {
    makeBeacon(def.x, def.z, 0xc05adf);
  } else if (def.kind === 'tail') {
    const mesh = makeCarMesh(0x2a6a8a, false);
    mesh.position.set(G.player.x + 40, 0, G.player.z + 20);
    G.scene.add(mesh);
    s.mark = { mesh, x: G.player.x + 40, z: G.player.z + 20, a: 0, v: 0, speed: 14 };
    makeBeacon(s.mark.x, s.mark.z, 0xc05adf);
  }
}

function completeSide() {
  const s = G.side;
  if (!s) return;
  G.money += s.reward;
  AudioSys.cash();
  banner('SIDE JOB DONE — $' + s.reward.toLocaleString());
  G.side = null;
  G.sideCooldown = 20;
  clearBeacons();
  saveGame();
}

function failSide(msg) {
  toast(msg || 'Side job failed');
  G.side = null;
  G.sideCooldown = 20;
  clearBeacons();
}

function updateSide(dt) {
  const s = G.side;
  if (!s) {
    if (G.sideCooldown > 0) G.sideCooldown -= dt;
    return;
  }
  s.t += dt;
  const px = G.player.x;
  const pz = G.player.z;
  if (s.kind === 'race') {
    if (s.t > s.limit) { failSide('Too slow — race failed'); return; }
    const g = s.gates[s.step];
    if (dist2(px, pz, g[0], g[1]) < 14) {
      AudioSys.pickup();
      s.step++;
      if (s.step >= s.gates.length) completeSide();
      else {
        clearBeacons();
        makeBeacon(s.gates[s.step][0], s.gates[s.step][1], 0xc05adf);
      }
    }
  } else if (s.kind === 'courier') {
    const d = s.drops[s.step];
    if (dist2(px, pz, d[0], d[1]) < 12) {
      AudioSys.pickup();
      s.step++;
      if (s.step >= s.drops.length) completeSide();
      else {
        clearBeacons();
        makeBeacon(s.drops[s.step][0], s.drops[s.step][1], 0xc05adf);
      }
    }
  } else if (s.kind === 'robbery') {
    if (s.step === 0) {
      if (dist2(px, pz, s.x, s.z) < 10) {
        s.hold += dt;
        if (s.hold >= 8) {
          s.step = 1;
          addWanted(2);
          toast('Till emptied — now lose the cops (wanted to 0)');
        }
      } else s.hold = 0;
    } else if (G.wanted === 0) {
      completeSide();
    }
  } else if (s.kind === 'tail') {
    const mk = s.mark;
    // Mark drives a loop around the block.
    mk.a += dt * 0.25;
    mk.x = 300 + Math.cos(mk.a) * 250;
    mk.z = 300 + Math.sin(mk.a) * 250;
    mk.mesh.position.set(mk.x, 0, mk.z);
    mk.mesh.rotation.y = -Math.atan2(Math.cos(mk.a + 1.57), Math.sin(mk.a + 1.57));
    const d = dist2(px, pz, mk.x, mk.z);
    if (d > 45) { failSide('You lost the mark'); return; }
    if (d < 12) { failSide('Too close — the mark spotted you'); return; }
    if (s.t > 30) completeSide();
  }
}
