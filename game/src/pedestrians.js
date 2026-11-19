// Solara Bay — pedestrians.js
// One clear job: the crowd. Forty-two walkers on the sidewalks who stroll,
// chat in place, scatter when shots ring out, and hop aside when a car
// bears down on them. Arcade only — nobody is ever hurt, they just complain.
import * as THREE from 'three';
import { resolveCircle } from './city.js';
import { mulberry32 } from './config.js';

const SHIRTS = [0xffd23f, 0x35c8ff, 0xff8fa3, 0x80ed99, 0xffffff, 0xff7b00, 0xc9b6ff, 0x2a9d8f];

function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.3, 0.5),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.95;
  group.add(head);
  return group;
}

export class Pedestrians {
  constructor(scene) {
    this.list = [];
    const rng = mulberry32(777);
    for (let i = 0; i < 42; i++) {
      const mesh = makePedMesh(SHIRTS[i % SHIRTS.length]);
      scene.add(mesh);
      // Start on a sidewalk beside a random street.
      const street = [-180, -120, -60, 0, 60, 120, 180][Math.floor(rng() * 7)];
      const along = -190 + rng() * 380;
      const ped = {
        mesh,
        x: rng() < 0.5 ? street + 8 : along,
        z: rng() < 0.5 ? along : street + 8,
        heading: rng() * Math.PI * 2,
        speed: 1.2 + rng() * 1.4,
        fleeUntil: 0,
        pauseUntil: rng() * 4,
      };
      ped.mesh.position.set(ped.x, 0, ped.z);
      this.list.push(ped);
    }
  }

  scatter(x, z) {
    for (const ped of this.list) {
      if (Math.hypot(ped.x - x, ped.z - z) < 30) {
        ped.fleeUntil = performance.now() / 1000 + 3;
        ped.heading = Math.atan2(ped.z - z, ped.x - x);
      }
    }
  }

  update(dt, G) {
    const now = G.time;
    for (const ped of this.list) {
      if (now < ped.pauseUntil) continue;
      let speed = ped.speed;
      if (now < ped.fleeUntil) speed = 6;
      // Step aside for the player's car.
      if (G.player.inCar && G.player.car) {
        const d = Math.hypot(ped.x - G.player.car.x, ped.z - G.player.car.z);
        if (d < 6) { ped.heading = Math.atan2(ped.z - G.player.car.z, ped.x - G.player.car.x); speed = 6; }
      }
      const nx = ped.x + Math.cos(ped.heading) * speed * dt;
      const nz = ped.z + Math.sin(ped.heading) * speed * dt;
      const [rx, rz] = resolveCircle(nx, nz, 0.6, G.colliders);
      ped.x = Math.max(-205, Math.min(205, rx));
      ped.z = Math.max(-205, Math.min(205, rz));
      // Wander: new heading now and then, mostly along the streets.
      if (Math.random() < dt * 0.25) {
        ped.heading = Math.floor(Math.random() * 4) * (Math.PI / 2);
        if (Math.random() < 0.3) ped.pauseUntil = now + 1 + Math.random() * 3;
      }
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(now * 6 + ped.x)) * 0.08, ped.z);
      ped.mesh.rotation.y = -ped.heading;
    }
  }
}
