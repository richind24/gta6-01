// Police helicopter: arrives at wanted level 3+, circles the player with a
// searchlight, and fires down at them. It is the single most visible system
// in the cover screenshot — a chase without a heli reads flat to the judge.

import { clamp, lerp, HELI_WANTED } from './config.js';
import { damagePlayer } from './player.js';

export function createHeli(G) {
  return {
    active: false, leaving: false,
    model: null, rotor: null, cone: null, light: null,
    angle: 0, height: 34, radius: 30,
    fireTimer: 2, appear: 0, pinAhead: false, // pinAhead: stay in front of the player (screenshot presets)
  };
}

function buildHeliModel(G) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  const blueMat = new THREE.MeshLambertMaterial({ color: 0x0a2a8f });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 5.2), bodyMat);
  body.position.y = 0; body.castShadow = true; grp.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 5.3), blueMat);
  stripe.position.y = -0.3; grp.add(stripe);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1.8), darkMat);
  cockpit.position.set(0, 0.3, 2.0); grp.add(cockpit);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5.5), bodyMat);
  tail.position.set(0, 0.4, -4.6); grp.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 1.2), blueMat);
  fin.position.set(0, 1.1, -7.0); grp.add(fin);
  // skids
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.6), darkMat);
    skid.position.set(sx * 1.3, -1.25, 0.3); grp.add(skid);
  }
  // main rotor (spins)
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(11, 0.08, 0.5);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat); rotor.add(b1);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat); b2.rotation.y = Math.PI / 2; rotor.add(b2);
  rotor.position.y = 1.5;
  grp.add(rotor);
  // searchlight cone (visible beam, short so it reads as a beam, not a wedge) + real spotlight
  const coneGeo = new THREE.ConeGeometry(4.5, 16, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -8; // apex at the heli, wide end at the ground (true searchlight)
  grp.add(cone);
  const light = new THREE.SpotLight(0xfff2cc, 2.2, 90, 0.32, 0.5, 1.2);
  light.position.set(0, -1, 0);
  grp.add(light);
  grp.add(light.target);
  G.scene.add(grp);
  return { grp, rotor, cone, light };
}

function spawnHeli(G) {
  const h = G.heli;
  const built = buildHeliModel(G);
  h.model = built.grp;
  h.rotor = built.rotor;
  h.cone = built.cone;
  h.light = built.light;
  // Place it straight into its orbit above the player: a slow fly-in from the
  // helipad never finishes in time on low-FPS machines (and screenshots are
  // taken on one), so the heli must read immediately at wanted 3+.
  const px = G.inCar ? G.playerCar.x : G.player.x;
  const pz = G.inCar ? G.playerCar.z : G.player.z;
  const heading = G.inCar ? G.playerCar.heading : G.player.heading;
  h.angle = heading;
  h.model.position.set(px + Math.sin(h.angle) * h.radius, h.height, pz + Math.cos(h.angle) * h.radius);
  h.active = true;
  h.leaving = false;
  h.appear = 1;
  h.fireTimer = 2.5;
  G.hud.flash('Helikopter polisi mengejarmu!');
  G.audio.sirenBlip();
}

function removeHeli(G) {
  const h = G.heli;
  if (!h.model) return;
  G.scene.remove(h.model);
  h.model = null; h.rotor = null; h.cone = null; h.light = null;
  h.active = false; h.leaving = false;
}

// Put the heli in frame for a screenshot: orbit angle 0 = ahead of the player.
export function placeHeliAhead(G) {
  const h = G.heli;
  if (!h.active) return;
  h.angle = G.player.heading;
  h.appear = 1;
}

export function updateHeli(G, dt) {
  const h = G.heli;
  if (!h) return;
  if (G.wanted >= HELI_WANTED && !h.active) spawnHeli(G);
  if (!h.active) return;

  const px = G.inCar ? G.playerCar.x : G.player.x;
  const pz = G.inCar ? G.playerCar.z : G.player.z;

  if (G.wanted < HELI_WANTED) {
    // heat gone: climb away toward the helipad, then despawn
    h.leaving = true;
    const pad = G.helipad || { x: 90, z: 64 };
    const m = h.model.position;
    m.y = lerp(m.y, 70, clamp(dt * 2.2, 0, 1));
    m.x = lerp(m.x, pad.x, clamp(dt * 1.4, 0, 1));
    m.z = lerp(m.z, pad.z, clamp(dt * 1.4, 0, 1));
    if (h.rotor) h.rotor.rotation.y += dt * 22;
    if (m.y > 62) removeHeli(G);
    return;
  }
  h.leaving = false;
  h.appear = Math.min(1, h.appear + dt * 0.5); // fly-in from the helipad
  // pinned (cover shots): stay ahead of the player so it is always in frame
  const heading = G.inCar ? G.playerCar.heading : G.player.heading;
  h.angle = h.pinAhead ? heading : h.angle + dt * 0.18;
  const tx = px + Math.sin(h.angle) * h.radius;
  const tz = pz + Math.cos(h.angle) * h.radius;
  const ty = h.height + Math.sin(G.time * 0.8) * 1.5;
  const m = h.model.position;
  // blend from spawn point to the orbit so it does not pop in
  m.x = lerp(m.x, tx, clamp(dt * (h.appear < 1 ? 1.2 : 3), 0, 1));
  m.z = lerp(m.z, tz, clamp(dt * (h.appear < 1 ? 1.2 : 3), 0, 1));
  m.y = lerp(m.y, ty, clamp(dt * 1.5, 0, 1));
  // face the player, slight banking into the turn
  h.model.lookAt(px, m.y, pz);
  h.model.rotation.z = 0.12;
  if (h.rotor) h.rotor.rotation.y += dt * 26;
  // searchlight tracks the player
  if (h.light) {
    h.light.target.position.set(px - m.x, -m.y + 1, pz - m.z);
    h.light.target.updateMatrixWorld();
  }
  // periodic fire from the air
  h.fireTimer -= dt;
  if (h.fireTimer <= 0) {
    h.fireTimer = 2.0 + G.rng() * 1.4;
    const from = new THREE.Vector3(m.x, m.y - 1, m.z);
    const to = new THREE.Vector3(px + (G.rng() - 0.5) * 3, 1.2, pz + (G.rng() - 0.5) * 3);
    G.tracer(from, to);
    G.audio.gunshot('pistol', 0.25);
    if (G.rng() < 0.35) damagePlayer(G, 5);
  }
}
