// Missions: a 4-part story arc for Dax Rivers plus 4 repeatable side jobs.
// Each mission is a small state machine driven by markers and proximity.

import { LANDMARKS } from './world.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { spawnCar } from './vehicles.js';

export const STORY = [
  {
    id: 'm1', name: 'Homecoming', pay: 300,
    intro: 'Mara Voss menunggu di The Rusty Anchor. Temui dia — dia punya pekerjaan untukmu.',
    steps: [
      { text: 'Pergi ke The Rusty Anchor', at: LANDMARKS.bar, radius: 6, onArrive: 'Mara: "Dax. Kota ini masih milik keluarga Kessler. Kita ambil kembali, satu pekerjaan demi satu." Misi selesai.' },
    ],
  },
  {
    id: 'm2', name: 'The Pickup', pay: 600,
    intro: 'Ambil paket di gudang pelabuhan, lalu antar ke garasi. Jangan sampai paketnya rusak — dan jangan sampai polisi melihatmu.',
    steps: [
      { text: 'Ambil paket di Port Solara', at: LANDMARKS.harbor, radius: 6, onArrive: 'Paket didapat. Sekarang antar ke Harbor Garage.' },
      { text: 'Antar paket ke Harbor Garage', at: LANDMARKS.garage, radius: 6, onArrive: 'Paket terkirim. Mara senang — tapi Kessler mengirim orang untuk membalas.' },
    ],
    onStart(G) {
      G.addWanted(1, 'terlihat di pelabuhan');
      const e1 = spawnEnemy(G, 10, -250, { bounty: 80 });
      const e2 = spawnEnemy(G, -12, -258, { bounty: 80 });
      G.missionEnemies = [e1, e2];
    },
  },
  {
    id: 'm3', name: 'Bayview Heist', pay: 1200,
    intro: 'Toko perhiasan di pusat kota dijaga dua orang Kessler. Lumpuhkan mereka, rampok brankasnya, lalu kabur dari polisi.',
    steps: [
      { text: 'Lumpuhkan penjaga toko (0/2)', at: { x: 0, z: 0 }, radius: 999, onArrive: '' },
      { text: 'Ambil isi brankas', at: { x: 8, z: -8 }, radius: 5, onArrive: 'Brankas kosong! Lari — alarm berbunyi!' },
      { text: 'Kabur dari polisi — hilangkan wanted level', at: { x: -192, z: 192 }, radius: 8, needWanted0: true, onArrive: 'Kamu lolos. Uang hasil rampokan aman.' },
    ],
    onStart(G) {
      const e1 = spawnEnemy(G, 4, 4, { health: 80, bounty: 100 });
      const e2 = spawnEnemy(G, -6, 10, { health: 80, bounty: 100 });
      G.missionEnemies = [e1, e2];
    },
  },
  {
    id: 'm4', name: 'The Harbor Deal', pay: 2500,
    intro: 'Pertemuan terakhir dengan keluarga Kessler di dermaga. Habisi semua orangnya, lalu ambil alih pelabuhan untuk Mara.',
    steps: [
      { text: 'Habisi anak buah Kessler (0/4)', at: LANDMARKS.harbor, radius: 999, onArrive: '' },
      { text: 'Rebut dermaga Port Solara', at: LANDMARKS.harbor, radius: 8, onArrive: 'Pelabuhan milik Mara sekarang. Solara Bay bebas — untuk saat ini.' },
    ],
    onStart(G) {
      const spots = [[-16, -252], [14, -262], [0, -240], [24, -250]];
      G.missionEnemies = spots.map(([x, z]) => spawnEnemy(G, x, z, { health: 90, bounty: 150 }));
      G.addWanted(2, 'penembakan di pelabuhan');
    },
  },
];

export const SIDE = [
  { id: 'taxi', name: 'Taxi Fare', pay: 150, text: 'Antar penumpang ke tujuan sebelum waktu habis.' },
  { id: 'race', name: 'Street Race', pay: 500, text: 'Lewati semua checkpoint balapan secepat mungkin.' },
  { id: 'delivery', name: 'Courier Run', pay: 200, text: 'Antar 3 paket ke alamat berbeda.' },
  { id: 'robbery', name: 'Corner Store Robbery', pay: 400, text: 'Rampok toko sudut, lalu kabur dari polisi.' },
];

export function createMissions(G) {
  return {
    storyIndex: 0,            // next story mission
    active: null,             // { kind:'story'|'side', def, step: 0, data }
    marker: null,             // THREE marker group
    raceCheckpoints: [],
    raceIndex: 0,
    deliveryPoints: [],
    deliveryIndex: 0,
    taxiPassenger: null,
    timer: 0,
  };
}

export function startStoryMission(G, idx) {
  const def = STORY[idx];
  if (!def) return false;
  clearEnemies(G);
  G.missions.active = { kind: 'story', def, step: 0, data: {} };
  G.missions.storyIndex = idx;
  if (def.onStart) def.onStart(G);
  G.hud.showMissionCard(def.name, def.intro);
  G.hud.setObjective(def.steps[0].text);
  G.audio.missionStart();
  updateMarker(G);
  return true;
}

export function startSideMission(G, id) {
  const def = SIDE.find((s) => s.id === id);
  if (!def) return false;
  clearEnemies(G);
  const m = { kind: 'side', def, step: 0, data: {}, timer: 0 };
  G.missions.active = m;
  G.hud.showMissionCard(def.name, def.text);
  if (id === 'taxi') {
    // passenger waits at a random intersection near the player
    const px = G.player.x + 20, pz = G.player.z + 10;
    const dest = { x: -px, z: -pz };
    m.data.pickup = { x: px, z: pz };
    m.data.dest = dest;
    m.timer = 120;
    G.hud.setObjective('Jemput penumpang, lalu antar ke tujuan (2:00).');
  } else if (id === 'race') {
    const pts = [[-192, -192], [192, -192], [192, 192], [-192, 192], [0, 0]];
    m.data.points = pts;
    m.data.index = 0;
    m.timer = 150;
    G.hud.setObjective('Balapan! Lewati checkpoint 1/5 (2:30).');
  } else if (id === 'delivery') {
    const pts = [{ x: 128, z: 128 }, { x: -128, z: 192 }, { x: 192, z: 64 }];
    m.data.points = pts;
    m.data.index = 0;
    m.timer = 180;
    G.hud.setObjective('Antar paket 1/3 (3:00).');
  } else if (id === 'robbery') {
    m.data.store = { x: 64, z: -128 };
    m.timer = 90;
    G.hud.setObjective('Rampok toko di (64,-128), lalu kabur dari polisi.');
    G.addWanted(2, 'perampokan toko');
  }
  G.audio.missionStart();
  updateMarker(G);
  return true;
}

function failMission(G, reason) {
  G.hud.showMissionCard('MISI GAGAL', reason);
  G.hud.setObjective('Pergi ke The Rusty Anchor untuk misi berikutnya.');
  G.missions.active = null;
  clearEnemies(G);
  updateMarker(G);
}

function completeMission(G) {
  const m = G.missions.active;
  const pay = m.def.pay;
  G.player.money += pay;
  G.hud.showMissionCard('MISI SELESAI', `${m.def.name} — kamu dibayar $${pay}.`);
  G.hud.setObjective(m.kind === 'story' && m.def.id !== 'm4'
    ? 'Kembali ke The Rusty Anchor untuk misi berikutnya.'
    : 'Kota ini milikmu. Cari pekerjaan sampingan di peta.');
  if (m.kind === 'story') G.missions.storyIndex = Math.min(G.missions.storyIndex + 1, STORY.length);
  G.missions.active = null;
  clearEnemies(G);
  G.audio.missionDone();
  G.saveGame();
  updateMarker(G);
}

export function updateMissions(G, dt) {
  const m = G.missions.active;
  if (!m) return;
  const px = G.inCar ? G.playerCar.x : G.player.x;
  const pz = G.inCar ? G.playerCar.z : G.player.z;

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Waktu habis.'); return; }
  }

  if (m.kind === 'story') {
    const step = m.def.steps[m.step];
    // kill-count steps
    if (m.def.id === 'm3' && m.step === 0) {
      const dead = (G.missionEnemies || []).filter((e) => e.health <= 0).length;
      G.hud.setObjective(`Lumpuhkan penjaga toko (${dead}/2)`);
      if (dead >= 2) { m.step = 1; G.hud.setObjective(m.def.steps[1].text); updateMarker(G); }
      return;
    }
    if (m.def.id === 'm4' && m.step === 0) {
      const dead = (G.missionEnemies || []).filter((e) => e.health <= 0).length;
      G.hud.setObjective(`Habisi anak buah Kessler (${dead}/4)`);
      if (dead >= 4) { m.step = 1; G.hud.setObjective(m.def.steps[1].text); updateMarker(G); }
      return;
    }
    if (step.needWanted0) {
      G.hud.setObjective('Kabur dari polisi — hilangkan wanted level');
      if (G.wanted === 0) { m.step++; advanceOrFinish(G, m); }
      return;
    }
    const d = Math.hypot(px - step.at.x, pz - step.at.z);
    if (d < step.radius) {
      if (step.onArrive) G.hud.flash(step.onArrive);
      m.step++;
      advanceOrFinish(G, m);
    }
  } else {
    // side missions
    if (m.def.id === 'taxi') {
      if (m.step === 0) {
        const d = Math.hypot(px - m.data.pickup.x, pz - m.data.pickup.z);
        if (d < 6) { m.step = 1; G.hud.setObjective('Penumpang naik! Antar ke tujuan.'); G.hud.flash('Penumpang: "Cepat, aku terlambat!"'); updateMarker(G); }
      } else {
        const d = Math.hypot(px - m.data.dest.x, pz - m.data.dest.z);
        if (d < 6) completeMission(G);
      }
    } else if (m.def.id === 'race') {
      const pt = m.data.points[m.data.index];
      const d = Math.hypot(px - pt[0], pz - pt[1]);
      if (d < 8) {
        m.data.index++;
        if (m.data.index >= m.data.points.length) completeMission(G);
        else { G.hud.setObjective(`Balapan! Lewati checkpoint ${m.data.index + 1}/5.`); updateMarker(G); }
      }
    } else if (m.def.id === 'delivery') {
      const pt = m.data.points[m.data.index];
      const d = Math.hypot(px - pt.x, pz - pt.z);
      if (d < 6) {
        m.data.index++;
        if (m.data.index >= m.data.points.length) completeMission(G);
        else { G.hud.setObjective(`Antar paket ${m.data.index + 1}/3.`); updateMarker(G); }
      }
    } else if (m.def.id === 'robbery') {
      const d = Math.hypot(px - m.data.store.x, pz - m.data.store.z);
      if (m.step === 0 && d < 6) {
        m.step = 1;
        G.player.money += 200;
        G.hud.flash('+$200 dari kasir! Sekarang kabur!');
        G.hud.setObjective('Kabur! Hilangkan wanted level.');
        updateMarker(G);
      } else if (m.step === 1 && G.wanted === 0) completeMission(G);
    }
  }
}

function advanceOrFinish(G, m) {
  if (m.step >= m.def.steps.length) completeMission(G);
  else { G.hud.setObjective(m.def.steps[m.step].text); updateMarker(G); }
}

// Marker beacon: a glowing pillar + floating diamond at the current objective.
export function buildMarker(G) {
  const grp = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30;
  grp.add(pillar);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd21f }));
  diamond.position.y = 12;
  grp.add(diamond);
  grp.userData.diamond = diamond;
  grp.visible = false;
  G.scene.add(grp);
  G.missions.marker = grp;
}

export function updateMarker(G) {
  const grp = G.missions.marker;
  if (!grp) return;
  const m = G.missions.active;
  let pos = null;
  if (m) {
    if (m.kind === 'story') {
      const step = m.def.steps[m.step];
      if (step && !step.needWanted0) pos = step.at;
    } else if (m.def.id === 'taxi') pos = m.step === 0 ? m.data.pickup : m.data.dest;
    else if (m.def.id === 'race') pos = { x: m.data.points[m.data.index][0], z: m.data.points[m.data.index][1] };
    else if (m.def.id === 'delivery') pos = m.data.points[m.data.index];
    else if (m.def.id === 'robbery') pos = m.step === 0 ? m.data.store : { x: -192, z: 192 };
  } else if (G.missions.storyIndex < STORY.length) {
    // idle: point at the bar to start the next story mission
    pos = LANDMARKS.bar;
  }
  if (pos) { grp.visible = true; grp.position.set(pos.x, 0, pos.z); }
  else grp.visible = false;
}

// Called when the player presses E near the bar with no active mission.
export function tryStartNextStory(G) {
  if (G.missions.active) return false;
  if (G.missions.storyIndex >= STORY.length) {
    G.hud.flash('Cerita selesai! Solara Bay milik Mara sekarang.');
    return false;
  }
  const d = Math.hypot(G.player.x - LANDMARKS.bar.x, G.player.z - LANDMARKS.bar.z);
  if (d < 10) { startStoryMission(G, G.missions.storyIndex); return true; }
  return false;
}
