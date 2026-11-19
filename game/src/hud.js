// Solara Bay — the HUD: cash, health, armour, wanted stars, clock,
// district, mission panel, radio + speed, and a live minimap canvas.
// All DOM lives in index.html; this module only paints it every frame.

import { districtAt, RADIO } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of ['cash', 'health-fill', 'armor-fill', 'stars', 'clock', 'district',
      'mission-title', 'mission-text', 'radio-name', 'radio-tag', 'speed', 'toast',
      'wanted-label', 'ammo', 'objective-dist']) {
      this.el[id] = doc.getElementById(id);
    }
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this._toastTimer = 0;
    this._lastStars = -1;
  }

  toast(msg, seconds = 4) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    this._toastTimer = seconds;
  }

  _starString(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  update(dt, state) {
    // state: {money, health, armor, wanted, time, x, z, speedKmh, inCar,
    //         radio, ammo, weapon, objective, objectiveTarget, city, player,
    //         policeCars, beacon, traffic, peds}
    const e = this.el;
    if (e.cash) e.cash.textContent = '$' + Math.floor(state.money).toLocaleString('en-US');
    if (e['health-fill']) e['health-fill'].style.width = Math.max(0, state.health) + '%';
    if (e['armor-fill']) e['armor-fill'].style.width = Math.max(0, state.armor) + '%';
    if (e.stars) {
      const s = this._starString(state.wanted);
      if (s !== this._lastStars) { e.stars.textContent = s; this._lastStars = s; }
      e.stars.style.color = state.wanted > 0 ? '#ffd23f' : '#ffffff55';
    }
    if (e.clock) {
      const h = Math.floor(state.time / 3600) % 24;
      const m = Math.floor(state.time / 60) % 60;
      e.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    if (e.district) e.district.textContent = districtAt(state.x, state.z);
    if (e['mission-text']) e['mission-text'].textContent = state.objective || '';
    if (e['radio-name']) {
      const st = RADIO[state.radio];
      e['radio-name'].textContent = '♪ ' + st.name;
      e['radio-name'].style.color = st.color;
    }
    if (e['radio-tag']) e['radio-tag'].textContent = RADIO[state.radio].tag;
    if (e.speed) e.speed.textContent = state.inCar ? Math.round(state.speedKmh) + ' km/h' : 'ON FOOT';
    if (e.ammo) e.ammo.textContent = state.weapon === 0 ? 'FISTS' : `AMMO ${state.ammo}`;
    if (e['wanted-label']) e['wanted-label'].textContent = state.wantedLabel || '';
    if (e['objective-dist'] && state.objectiveTarget) {
      const d = Math.hypot(state.x - state.objectiveTarget.x, state.z - state.objectiveTarget.z);
      e['objective-dist'].textContent = Math.round(d) + 'm';
    } else if (e['objective-dist']) {
      e['objective-dist'].textContent = '';
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0 && this.el.toast) this.el.toast.style.opacity = '0';
    }
    this._drawMinimap(state);
  }

  _drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 180;
    const toMap = (x) => ((x + 340) / 680) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0e2a3a';
    ctx.fillRect(0, 0, S, S);
    // Sea east + south.
    ctx.fillStyle = '#1fa8c9';
    ctx.fillRect(toMap(288), 0, S - toMap(288), S);
    ctx.fillRect(0, toMap(288), S, S - toMap(288));
    // Sand.
    ctx.fillStyle = '#f2d8a0';
    ctx.fillRect(toMap(256), 0, toMap(288) - toMap(256), S);
    // Roads.
    ctx.fillStyle = '#3a3f46';
    const centers = state.city.roadCenters();
    for (const c of centers) {
      ctx.fillRect(toMap(c) - 2, 0, 4, S);
      ctx.fillRect(0, toMap(c) - 2, S, 4);
    }
    // Blocks.
    ctx.fillStyle = '#5a6b7a';
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const x = -320 + i * 80, z = -320 + j * 80;
        if (x > 224 || (z > 224 && x > 96)) continue;
        ctx.fillRect(toMap(x) + 1, toMap(z) + 1, 64 / 680 * S - 2, 64 / 680 * S - 2);
      }
    }
    // Mission beacon.
    if (state.objectiveTarget) {
      const bx = toMap(state.objectiveTarget.x), bz = toMap(state.objectiveTarget.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(bx, bz, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.beginPath(); ctx.arc(bx, bz, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips (blue) and traffic (white dots).
    ctx.fillStyle = '#3a86ff';
    for (const c of state.policeCars || []) {
      ctx.fillRect(toMap(c.x) - 2, toMap(c.z) - 2, 4, 4);
    }
    ctx.fillStyle = '#ffffff88';
    for (const c of (state.traffic || []).slice(0, 24)) {
      ctx.fillRect(toMap(c.x) - 1, toMap(c.z) - 1, 2, 2);
    }
    // Player arrow (yellow), rotated by heading.
    const px = toMap(state.x), pz = toMap(state.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(state.heading);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North + frame.
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 6, 14);
  }
}
