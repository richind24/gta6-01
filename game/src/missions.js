// Solara Bay — missions.js
// One clear job: the story. Ten chapters plus repeatable side jobs, all
// driven by one small step engine: goto, pickup, eliminate, chase, race,
// escape and enterCar. The engine owns the objective beacon, the goons,
// the chase target and the timers; main.js only feeds it time and input.
import * as THREE from 'three';
import { STORY, SIDE_JOBS } from './config.js';
import { createCarMesh, Car } from './vehicles.js';

function makeBeacon(color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 26, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.position.y = 13;
  return mesh;
}

function makeGoonMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x222222 }),
  );
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98d64 }),
  );
  head.position.y = 2.25;
  group.add(head);
  return group;
}

export class MissionEngine {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.timer = 0;
    this.beacon = makeBeacon(0xffd23f);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.pickupMarker = makeBeacon(0x35c8ff);
    this.pickupMarker.visible = false;
    scene.add(this.pickupMarker);
    this.chaseTarget = null;
    this.raceIndex = 0;
    this.racePoints = [];
    this.eliminated = 0;
    this.side = null; // active side-job mission object
  }

  current() {
    if (this.side) return this.side;
    if (this.missionIndex >= STORY.length) return null;
    return STORY[this.missionIndex];
  }

  isStoryDone() { return this.missionIndex >= STORY.length; }

  objectiveText() {
    const m = this.current();
    if (!m) return 'Story complete — Solara Bay is yours, Rico.';
    if (!this.active) return m.brief + '  (Press M to start: ' + m.title + ')';
    const step = m.steps[this.stepIndex];
    if (!step) return m.title;
    let text = step.text || m.title;
    if (step.type === 'race') text += ' — checkpoint ' + (this.raceIndex + 1) + '/' + step.checkpoints.length;
    if (step.type === 'eliminate') text += ' — ' + this.eliminated + '/' + step.count + ' down';
    if (this.timer > 0) text += ' — ' + Math.ceil(this.timer) + 's';
    return text;
  }

  startCurrent() {
    const m = this.current();
    if (!m || this.active) return;
    this.active = true;
    this.stepIndex = 0;
    this.timer = 0;
    this.raceIndex = 0;
    this.eliminated = 0;
    this.beginStep();
    this.G.toast('Mission: ' + m.title + ' — ' + m.giver);
    this.G.audio.pickup();
  }

  beginStep() {
    const m = this.current();
    if (!m) return;
    const step = m.steps[this.stepIndex];
    if (!step) { this.finishMission(); return; }
    this.timer = step.timer || 0;
    this.beacon.visible = false;
    this.pickupMarker.visible = false;
    if (step.pos) {
      const isPickup = step.type === 'pickup';
      const marker = isPickup ? this.pickupMarker : this.beacon;
      marker.position.set(step.pos[0], isPickup ? 13 : 13, step.pos[1]);
      marker.visible = true;
    }
    if (step.type === 'race') {
      this.racePoints = step.checkpoints;
      this.raceIndex = 0;
      this.beacon.position.set(step.checkpoints[0][0], 13, step.checkpoints[0][1]);
      this.beacon.visible = true;
    }
    if (step.type === 'eliminate') {
      this.eliminated = 0;
      this.spawnGoons(step.pos, step.count);
    }
    if (step.type === 'chase') this.spawnChaseTarget();
    if (m.wanted) this.G.police.setWanted(m.wanted);
  }

  spawnGoons(pos, count) {
    this.clearGoons();
    for (let i = 0; i < count; i++) {
      const mesh = makeGoonMesh();
      const x = pos[0] + (i - count / 2) * 6 + (Math.random() - 0.5) * 4;
      const z = pos[1] + (Math.random() - 0.5) * 10;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.G.goons.push({ mesh, x, z, hp: 100, dead: false, shootTimer: 1 + Math.random() });
    }
  }

  clearGoons() {
    for (const goon of this.G.goons) this.scene.remove(goon.mesh);
    this.G.goons.length = 0;
  }

  spawnChaseTarget() {
    if (this.chaseTarget) return;
    const mesh = createCarMesh(0x9b2226, 'sedan');
    this.scene.add(mesh);
    const car = new Car(mesh, 120, 60, 0, 'sedan');
    car.ai = { speed: 16 };
    car.health = 100;
    this.chaseTarget = car;
    this.G.traffic.push(car);
  }

  onEnterCar() {
    const m = this.current();
    if (!this.active || !m) return;
    const step = m.steps[this.stepIndex];
    if (step && step.type === 'enterCar') this.advanceStep();
  }

  onGoonDown() {
    const m = this.current();
    if (!this.active || !m) return;
    const step = m.steps[this.stepIndex];
    if (step && step.type === 'eliminate') {
      this.eliminated += 1;
      if (this.eliminated >= step.count) this.advanceStep();
    }
  }

  // E pressed near an objective: pickups, and taxi fares.
  onInteract() {
    const m = this.current();
    if (!this.active || !m) return false;
    const step = m.steps[this.stepIndex];
    if (!step || step.type !== 'pickup' || !step.pos) return false;
    const p = this.G.player;
    const px = p.inCar && p.car ? p.car.x : p.x;
    const pz = p.inCar && p.car ? p.car.z : p.z;
    if (Math.hypot(step.pos[0] - px, step.pos[1] - pz) < (step.radius || 6)) {
      this.G.audio.pickup();
      this.advanceStep();
      return true;
    }
    return false;
  }

  advanceStep() {
    this.stepIndex += 1;
    const m = this.current();
    if (!m || this.stepIndex >= m.steps.length) this.finishMission();
    else this.beginStep();
  }

  finishMission() {
    const m = this.current();
    if (!m) return;
    this.active = false;
    this.beacon.visible = false;
    this.pickupMarker.visible = false;
    this.clearGoons();
    this.G.cash += m.reward;
    this.G.respect += 10;
    this.G.audio.cash();
    this.G.toast('Mission complete: ' + m.title + '  +$' + m.reward);
    if (this.side) {
      this.G.sideDone[this.side.id] = (this.G.sideDone[this.side.id] || 0) + 1;
      this.side = null;
    } else {
      this.missionIndex += 1;
      if (this.missionIndex >= STORY.length) this.G.onStoryComplete();
    }
    this.G.saveNow();
  }

  failMission(reason) {
    this.active = false;
    this.beacon.visible = false;
    this.pickupMarker.visible = false;
    this.clearGoons();
    this.G.toast('Mission failed: ' + reason + ' — press M to retry');
  }

  startSideJob(id) {
    if (this.active) { this.G.toast('Finish the current mission first'); return; }
    const job = SIDE_JOBS.find((j) => j.id === id);
    if (!job) return;
    if (id === 'taxi') {
      this.side = { id, title: 'Taxi Fare', giver: 'Dispatch', reward: 150, steps: [
        { type: 'goto', pos: [-60, 60], text: 'Pick up the fare at Downtown', radius: 8 },
        { type: 'goto', pos: [150, -30], text: 'Drop the fare at Ocean Drive', radius: 8 },
      ] };
    } else if (id === 'vigilante') {
      this.side = { id, title: 'Vigilante', giver: 'Solara PD tip line', reward: 350, steps: [
        { type: 'eliminate', count: 3, pos: [0, 60], text: 'Take down the runners', radius: 24 },
      ] };
    } else if (id === 'courier') {
      this.side = { id, title: 'Courier Run', giver: 'Bay Express', reward: 250, steps: [
        { type: 'pickup', pos: [-120, -60], text: 'Collect parcel 1 (E)', radius: 6, timer: 60 },
        { type: 'goto', pos: [120, 120], text: 'Deliver parcel 1', radius: 8 },
      ] };
    } else {
      this.side = { id, title: 'Street Race', giver: 'Midnight Club', reward: 400, steps: [
        { type: 'race', checkpoints: [[-60, -60], [60, 60], [150, 0]], timer: 45, text: 'Street race' },
      ] };
    }
    this.startCurrent();
  }

  playerPos() {
    const p = this.G.player;
    return p.inCar && p.car ? [p.car.x, p.car.z] : [p.x, p.z];
  }

  update(dt) {
    // Goons shoot back when close.
    for (const goon of this.G.goons) {
      if (goon.dead) continue;
      const p = this.G.player;
      const d = Math.hypot(goon.x - p.x, goon.z - p.z);
      goon.shootTimer -= dt;
      if (d < 22 && goon.shootTimer <= 0) {
        goon.shootTimer = 1.6;
        goon.mesh.lookAt(p.x, 0, p.z);
        this.G.damagePlayer(6, 'goon');
        this.G.tracer(goon.x, goon.z, p.x, p.z);
      }
    }
    if (!this.active) return;
    const m = this.current();
    if (!m) return;
    const step = m.steps[this.stepIndex];
    if (!step) return;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this.failMission('out of time'); return; }
    }
    const [px, pz] = this.playerPos();
    if (step.type === 'goto' && step.pos) {
      if (Math.hypot(step.pos[0] - px, step.pos[1] - pz) < (step.radius || 8)) this.advanceStep();
    } else if (step.type === 'escape') {
      if (this.G.police.wanted === 0 && step.pos && Math.hypot(step.pos[0] - px, step.pos[1] - pz) < (step.radius || 10)) {
        this.advanceStep();
      }
    } else if (step.type === 'race') {
      const cp = this.racePoints[this.raceIndex];
      if (cp && Math.hypot(cp[0] - px, cp[1] - pz) < 10) {
        this.G.audio.pickup();
        this.raceIndex += 1;
        if (this.raceIndex >= this.racePoints.length) this.advanceStep();
        else {
          const next = this.racePoints[this.raceIndex];
          this.beacon.position.set(next[0], 13, next[1]);
        }
      }
    } else if (step.type === 'chase') {
      const target = this.chaseTarget;
      if (target) {
        // The courier flees along the marina road.
        target.heading = Math.sin(this.G.time * 0.4) * 0.5;
        target.x += Math.cos(target.heading) * 15 * dt;
        target.z += Math.sin(target.heading) * 15 * dt;
        if (target.x > 200) target.heading = Math.PI;
        if (target.x < -200) target.heading = 0;
        target.syncMesh();
        // Ramming: player car contact damages the target.
        const p = this.G.player;
        if (p.inCar && p.car) {
          const d = Math.hypot(target.x - p.car.x, target.z - p.car.z);
          if (d < 5 && Math.abs(p.car.speed) > 6) {
            target.health -= 30 * dt * 4;
            p.car.speed *= 0.85;
            if (target.health <= 0 && !target.stalled) {
              target.stalled = true;
              this.G.toast('Courier stopped!');
              this.advanceStep();
            }
          }
        }
      }
    }
  }
}
