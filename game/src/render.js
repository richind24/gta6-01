// Solara Bay — rendering: the noon sun, the high top-down camera that follows
// the player, and the resize handling. Noon stays bright: the cover is shot
// in full daylight by design.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(PALETTE.sky);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0x9fd8ff, 220, 420);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 600);
  camera.position.set(0, 54, 30);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2c8, 2.2);
  sun.position.set(60, 110, 30);
  scene.add(sun);
  scene.add(sun.target);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  const camPos = new THREE.Vector3(0, 80, 42);
  const camLook = new THREE.Vector3(0, 0, 0);

  function updateCamera(state, dt) {
    const p = state.player;
    if (state.cinematic) {
      const c = state.cinematic;
      if (state.cinematicSnap) {
        camPos.set(c.pos[0], c.pos[1], c.pos[2]);
        camLook.set(c.look[0], c.look[1], c.look[2]);
        state.cinematicSnap = false;
      } else {
        camPos.lerp(new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), Math.min(1, dt * 2));
        camLook.lerp(new THREE.Vector3(c.look[0], c.look[1], c.look[2]), Math.min(1, dt * 2));
      }
    } else {
      const tx = p.x;
      const tz = p.z + 8;
      camPos.lerp(new THREE.Vector3(tx, 80, tz + 42), Math.min(1, dt * 4));
      camLook.lerp(new THREE.Vector3(tx, 0, tz), Math.min(1, dt * 4));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    sun.position.set(camLook.x + 60, 110, camLook.z + 30);
    sun.target.position.set(camLook.x, 0, camLook.z);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, updateCamera, render };
}
