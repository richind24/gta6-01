// Weather & time: day/night cycle, sun + sky + fog, rain, street-light glow.

import { clamp, lerp, DAY_LENGTH } from './config.js';

function skyColor(t) {
  // t: 0..1 across the day (0 = midnight). Returns [sky, fog, sunColor, sunIntensity]
  const stops = [
    [0.00, 0x0b1026, 0x0b1026, 0x223044, 0.05],
    [0.22, 0x2c3e55, 0x2c3e55, 0x8a6a4a, 0.25],
    [0.30, 0x87b5d6, 0x9db8c4, 0xffd9a0, 0.9],
    [0.50, 0x7ec0ee, 0xa8c8d8, 0xfff2cc, 1.15],
    [0.70, 0x87b5d6, 0x9db8c4, 0xffd9a0, 0.9],
    [0.78, 0xe8956a, 0xc98a6a, 0xff7a3c, 0.55],
    [0.84, 0x1c2440, 0x1c2440, 0x3a4a6a, 0.12],
    [1.00, 0x0b1026, 0x0b1026, 0x223044, 0.05],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, s0, f0, u0, i0] = stops[i];
    const [t1, s1, f1, u1, i1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const mix = (a, b) => {
        const ca = new THREE.Color(a), cb = new THREE.Color(b);
        return ca.lerp(cb, k);
      };
      return [mix(s0, s1), mix(f0, f1), mix(u0, u1), lerp(i0, i1, k)];
    }
  }
  return [new THREE.Color(0x0b1026), new THREE.Color(0x0b1026), new THREE.Color(0x223044), 0.05];
}

export function createWeather(G) {
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0008;
  G.scene.add(sun);
  G.scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.55);
  G.scene.add(hemi);
  G.scene.fog = new THREE.Fog(0xa8c8d8, 180, 700);

  // rain: a Points cloud that follows the player
  const rainGeo = new THREE.BufferGeometry();
  const N = 1200;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = Math.random() * 60;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.55, sizeAttenuation: true,
  }));
  rain.visible = false;
  rain.frustumCulled = false;
  G.scene.add(rain);

  return {
    sun, hemi, rain, rainVel: new Float32Array(N),
    timeOfDay: 10, // hours, starts 10:00
    day: 1,
    raining: false, rainTimer: 120 + Math.random() * 120,
    night: 0,
  };
}

export function updateWeather(G, dt) {
  const w = G.weather;
  w.timeOfDay += (dt / DAY_LENGTH) * 24;
  if (w.timeOfDay >= 24) { w.timeOfDay -= 24; w.day++; collectIncomeSafe(G); }
  const t = w.timeOfDay / 24;
  const [sky, fog, sunCol, sunI] = skyColor(t);
  G.scene.background = sky;
  G.scene.fog.color.copy(fog);
  // sun position: arc across the sky
  const ang = (t - 0.25) * Math.PI * 2;
  const sunH = Math.sin(ang);
  w.sun.position.set(Math.cos(ang) * 220, Math.max(sunH, 0.08) * 260, 120);
  w.sun.target.position.set(G.player.x, 0, G.player.z);
  w.sun.position.x += G.player.x; w.sun.position.z += G.player.z;
  w.sun.target.updateMatrixWorld();
  w.sun.color.copy(sunCol);
  w.sun.intensity = sunI;
  w.hemi.intensity = 0.25 + sunI * 0.35;
  const night = clamp(1 - sunI, 0, 1);
  w.night = night;
  // building windows glow at night
  for (const b of G.buildings) b.mat.emissiveIntensity = night * 0.85;
  for (const s of G.streetLights) {
    s.glow.material.opacity = night * 0.8;
    s.bulb.material.color.setHex(night > 0.4 ? 0xffe9a8 : 0x666666);
  }
  // rain scheduling
  w.rainTimer -= dt;
  if (w.rainTimer <= 0) {
    w.raining = !w.raining;
    w.rainTimer = w.raining ? 40 + Math.random() * 60 : 120 + Math.random() * 180;
    G.hud.flash(w.raining ? 'Hujan turun di Solara Bay.' : 'Hujan reda.');
  }
  w.rain.visible = w.raining;
  if (w.raining) {
    const pos = w.rain.geometry.attributes.position;
    const cx = G.player.x, cz = G.player.z;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 55;
      if (y < 0) { y = 50 + Math.random() * 10; pos.setX(i, cx + (Math.random() - 0.5) * 120); pos.setZ(i, cz + (Math.random() - 0.5) * 120); }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    G.scene.fog.near = 90; G.scene.fog.far = 420;
  } else {
    G.scene.fog.near = 180; G.scene.fog.far = 700;
  }
  // water shimmer
  if (G.waterMat) {
    G.waterMat.color.setHex(night > 0.5 ? 0x0d3247 : 0x1d5f7a);
  }
}

function collectIncomeSafe(G) {
  try { if (G.economy) G.economy.collectDailyIncome(G); } catch (e) { /* economy not wired yet */ }
}

export function setTimeOfDay(G, hours) {
  G.weather.timeOfDay = hours;
}
