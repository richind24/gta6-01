// Solara Bay — hud.js
// One clear job: paint the HUD. Cash, health, armour, wanted stars, the
// clock, the district, the mission panel, radio + speed, toasts, and the
// live minimap canvas. All DOM lives in index.html; this module paints it.
import { districtAt } from './city.js';
import { STATIONS } from './config.js';

export class Hud {
  constructor(doc) {
    this.el = {
      cash: doc.getElementById('hud-cash'),
      stars: doc.getElementById('hud-stars'),
      health: doc.getElementById('hud-health-fill'),
      healthText: doc.getElementById('hud-health-text'),
      armor: doc.getElementById('hud-armor-fill'),
      ammo: doc.getElementById('hud-ammo'),
      missionTitle: doc.getElementById('hud-mission-title'),
      missionText: doc.getElementById('hud-mission-text'),
      missionTimer: doc.getElementById('hud-mission-timer'),
      radio: doc.getElementById('hud-radio'),
      speed: doc.getElementById('hud-speed'),
      district: doc.getElementById('hud-district'),
      clock: doc.getElementById('hud-clock'),
      toast: doc.getElementById('hud-toast'),
      minimap: doc.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastUntil = 0;
    this.toastQueue = [];
  }

  toast(msg) {
    this.toastQueue.push(msg);
  }

  showToast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    this.toastUntil = performance.now() + 2600;
  }

  starsHtml(n) {
    let out = '';
    for (let i = 0; i < 5; i++) out += i < n ? '★' : '☆';
    return out;
  }

  update(G, dt) {
    const now = performance.now();
    if (this.toastQueue.length && now > this.toastUntil) this.showToast(this.toastQueue.shift());
    if (now > this.toastUntil && this.el.toast.style.opacity !== '0') this.el.toast.style.opacity = '0';

    this.el.cash.textContent = '$' + G.cash.toLocaleString('en-US');
    this.el.stars.textContent = this.starsHtml(G.police.wanted);
    this.el.stars.style.color = G.police.wanted > 0 ? '#ffd23f' : '#ffffff';
    this.el.health.style.width = Math.max(0, G.health) + '%';
    this.el.healthText.textContent = 'HP ' + Math.max(0, Math.round(G.health));
    this.el.armor.style.width = Math.max(0, Math.min(100, G.armor)) + '%';
    this.el.ammo.textContent = G.hasPistol ? ('🔫 ' + G.ammo + ' rds') : '🔫 no weapon';
    const m = G.missions.current();
    this.el.missionTitle.textContent = m ? (m.title + '  •  ' + m.giver) : 'SOLARA BAY';
    this.el.missionText.textContent = G.missions.objectiveText();
    this.el.missionTimer.textContent = G.missions.timer > 0 ? ('⏱ ' + Math.ceil(G.missions.timer) + 's') : '';
    const st = STATIONS[G.station];
    this.el.radio.textContent = '♪ ' + st.name;
    this.el.radio.style.color = st.hue;
    const speed = G.player.inCar && G.player.car ? Math.abs(G.player.car.speed) * 3.6 : 0;
    this.el.speed.textContent = G.player.inCar ? Math.round(speed) + ' km/h' : 'ON FOOT';
    const p = G.player;
    this.el.district.textContent = districtAt(p.x, p.z);
    const mins = Math.floor(G.clockMinutes) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.el.clock.textContent = hh + ':' + mm + '  •  Day ' + G.day;
    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const ctx = this.mapCtx;
    const S = 180, half = 210;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0e2a3a';
    ctx.fillRect(0, 0, S, S);
    // Water + sand on the east edge.
    ctx.fillStyle = '#1e90d6';
    ctx.fillRect(S - 14, 0, 14, S);
    ctx.fillStyle = '#f2d492';
    ctx.fillRect(S - 20, 0, 6, S);
    // Roads.
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = 4;
    for (const s of [-180, -120, -60, 0, 60, 120, 180]) {
      const [x1] = toMap(s, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(0, s);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // Buildings as pale blocks.
    ctx.fillStyle = '#c8d2dc';
    for (const c of G.colliders) {
      const [x, z] = toMap(c.minX, c.minZ);
      const [x2, z2] = toMap(c.maxX, c.maxZ);
      ctx.fillRect(x, z, Math.max(1.5, x2 - x), Math.max(1.5, z2 - z));
    }
    // Shops (green) and safehouse (gold).
    ctx.fillStyle = '#2ecc71';
    for (const key of Object.keys(G.shopPositions)) {
      const [sx, sz] = G.shopPositions[key];
      const [x, z] = toMap(sx, sz);
      ctx.beginPath(); ctx.arc(x, z, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    const [hx, hz] = toMap(G.safehousePos[0], G.safehousePos[1]);
    ctx.beginPath(); ctx.arc(hx, hz, 4, 0, Math.PI * 2); ctx.fill();
    // Objective beacon (yellow) and chase target (red).
    if (G.missions.beacon.visible) {
      const [x, z] = toMap(G.missions.beacon.position.x, G.missions.beacon.position.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, z, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, z, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // Police (red dots), traffic (white), player (green arrow).
    ctx.fillStyle = '#ff3b30';
    for (const cop of G.police.cops) {
      const [x, z] = toMap(cop.x, cop.z);
      ctx.beginPath(); ctx.arc(x, z, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const car of G.traffic.slice(0, 14)) {
      const [x, z] = toMap(car.x, car.z);
      ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    const [px, pz] = toMap(G.player.x, G.player.z);
    ctx.fillStyle = '#2ecc71';
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-G.player.heading + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // North + border.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', 6, 13);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }
}
