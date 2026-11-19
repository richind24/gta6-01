// Solara Bay — police.js
// One clear job: the wanted system. Stars 0–5, patrol cars that chase and
// ram, a helicopter from 3 stars, roadblocks at 4+, and getting busted or
// wasted drops Rico at Solara General minus a fine.
import * as THREE from 'three';
import { createCarMesh, Car } from './vehicles.js';
import { WANTED_TUNING } from './config.js';

function makeHeliMesh() {
  const group = new THREE.Group();
  group.name = 'police-helicopter';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 2.6),
    new THREE.MeshLambertMaterial({ color: 0x1b2a41 }),
  );
  group.add(body);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.8, 0.8),
    new THREE.MeshLambertMaterial({ color: 0x1b2a41 }),
  );
  tail.position.set(-5, 0.4, 0);
  group.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.15, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  rotor.position.y = 1.4;
  rotor.name = 'rotor';
  group.add(rotor);
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(4, 18, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  spot.position.y = -10;
  spot.rotation.x = Math.PI;
  group.add(spot);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  lamp.position.set(3, -1, 0);
  group.add(lamp);
  return group;
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.hiddenFor = 0;
    this.decayTimer = 0;
    this.cops = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliAngle = 0;
    this.heliHeight = 58;
    this.heliRadius = 30;
    this.bustedMeter = 0;
    this.flashTimer = 0;
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.hiddenFor = 0;
    this.decayTimer = 0;
  }

  addHeat(n) {
    this.setWanted(this.wanted + n);
  }

  clearWanted() { this.setWanted(0); }

  spawnCop(G, x, z) {
    const mesh = createCarMesh(0x1b2a41, 'police');
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, 0, 'police');
    car.ai = { speed: 20 };
    this.cops.push(car);
    return car;
  }

  despawnCop(cop) {
    this.scene.remove(cop.mesh);
    this.cops = this.cops.filter((c) => c !== cop);
  }

  ensureHeli(G) {
    if (this.wanted >= WANTED_TUNING.heliAtStars && !this.heli) {
      this.heli = makeHeliMesh();
      this.scene.add(this.heli);
      G.toast('Police helicopter overhead!');
    } else if (this.wanted < WANTED_TUNING.heliAtStars && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
  }

  setRoadblocks(G, on) {
    if (on && this.roadblocks.length === 0) {
      const p = G.player;
      for (const [dx, dz] of [[24, 0], [-24, 0]]) {
        const mesh = createCarMesh(0x1b2a41, 'police');
        this.scene.add(mesh);
        const car = new Car(mesh, p.x + dx, p.z + dz, Math.PI / 2, 'police');
        this.roadblocks.push(car);
      }
      G.toast('Roadblocks ahead — find another route!');
    } else if (!on && this.roadblocks.length > 0) {
      for (const car of this.roadblocks) this.scene.remove(car.mesh);
      this.roadblocks = [];
    }
  }

  update(dt, G) {
    // Keep the patrol count matched to the stars.
    const want = this.wanted * WANTED_TUNING.copCarsPerStar;
    while (this.cops.length < want) {
      const p = G.player;
      const a = Math.random() * Math.PI * 2;
      this.spawnCop(G, p.x + Math.cos(a) * 55, p.z + Math.sin(a) * 55);
    }
    while (this.cops.length > want) this.despawnCop(this.cops[this.cops.length - 1]);
    this.ensureHeli(G);
    this.setRoadblocks(G, this.wanted >= 4);

    const p = G.player;
    const px = p.inCar && p.car ? p.car.x : p.x;
    const pz = p.inCar && p.car ? p.car.z : p.z;

    // Chase: steer at the player, ram on contact.
    for (const cop of this.cops) {
      const dx = px - cop.x, dz = pz - cop.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dz, dx);
      let diff = wantHeading - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      const speed = Math.min(24, 15 + this.wanted * 1.6);
      cop.x += Math.cos(cop.heading) * speed * dt;
      cop.z += Math.sin(cop.heading) * speed * dt;
      cop.syncMesh();
      if (dist < 3.6) {
        if (p.inCar && p.car) {
          p.car.health -= 14 * dt * 10 * 0.12;
          p.car.speed *= 0.92;
          if (p.car.health <= 0 && !p.car.stalled) {
            p.car.stalled = true;
            G.toast('Your car is wrecked — get out!');
          }
        } else {
          // On foot, contact builds the busted meter.
          this.bustedMeter += dt;
          if (this.bustedMeter > 1.6) {
            this.bustedMeter = 0;
            G.onBusted();
            return;
          }
        }
      }
    }
    if (this.wanted === 0) this.bustedMeter = 0;

    // Helicopter circles the player with a spotlight.
    if (this.heli) {
      this.heliAngle += dt * 0.55;
      this.heli.position.set(px + Math.cos(this.heliAngle) * this.heliRadius, this.heliHeight, pz + Math.sin(this.heliAngle) * this.heliRadius);
      this.heli.rotation.y = -this.heliAngle;
      const rotor = this.heli.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
    }

    // Wanted decay: stay out of every cop's sight and the stars fall.
    if (this.wanted > 0) {
      const nearest = this.cops.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), 999);
      const seen = nearest < 42 || this.heli;
      if (!seen) {
        this.hiddenFor += dt;
        if (this.hiddenFor > WANTED_TUNING.decayDelay) {
          this.decayTimer += dt;
          if (this.decayTimer > WANTED_TUNING.decayStep) {
            this.decayTimer = 0;
            this.setWanted(this.wanted - 1);
            G.toast('Heat cooling off — ' + this.wanted + ' stars left');
          }
        }
      } else {
        this.hiddenFor = 0;
        this.decayTimer = 0;
      }
    }
    G.audio.setSiren(this.wanted > 0);
  }
}
