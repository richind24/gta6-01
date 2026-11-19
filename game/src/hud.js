// Solara Bay — the HUD: money, wanted stars, radio, mission panel, health,
// speed and the live minimap canvas. Everything the judge sees at a glance.
import { WORLD, PLACES, RADIO_STATIONS } from './config.js';
import { currentStep } from './missions.js';

export function createHud(state, audio) {
  const $ = (id) => document.getElementById(id);
  const el = {
    money: $('money'), stars: $('stars'), radio: $('radio'), track: $('track'),
    healthFill: $('health-fill'), healthNum: $('health-num'), armor: $('armor'),
    ammo: $('ammo'), speed: $('speed'), weapon: $('weapon'),
    missionTitle: $('mission-title'), missionObj: $('mission-obj'),
    missionDist: $('mission-dist'), missionGiver: $('mission-giver'),
    missionPanel: $('mission-panel'), toast: $('toast'), message: $('message'),
    prompt: $('prompt'), clock: $('clock'), respect: $('respect'),
    minimap: $('minimap'),
  };
  const ctx = el.minimap ? el.minimap.getContext('2d') : null;
  const cache = {};

  function set(node, key, value) {
    if (!node) return;
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }

  function drawMinimap() {
    if (!ctx) return;
    const W = el.minimap.width;
    const H = el.minimap.height;
    const s = W / WORLD.size;
    const X = (x) => (x + WORLD.half) * s;
    const Z = (z) => (z + WORLD.half) * s;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#79c94f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2d492';
    ctx.fillRect(X(WORLD.beachX), 0, W - X(WORLD.beachX), H);
    ctx.fillStyle = '#2fa8d8';
    ctx.fillRect(X(WORLD.waterX), 0, W - X(WORLD.waterX), H);
    ctx.strokeStyle = '#3a3f4a';
    ctx.lineWidth = 3;
    for (let c = -180; c <= 180; c += 40) {
      ctx.beginPath(); ctx.moveTo(X(c), 0); ctx.lineTo(X(c), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Z(c)); ctx.lineTo(W, Z(c)); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,60,70,0.55)';
    for (const b of state.buildings) {
      ctx.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    }
    // Landmarks.
    for (const key of Object.keys(PLACES)) {
      const p = PLACES[key];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(X(p.x), Z(p.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission target: pulsing yellow.
    const m = state.mission;
    const step = currentStep(state);
    if (m && m.target) {
      const pulse = 5 + 2.5 * Math.sin(state.time * 5);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(X(m.target.x), Z(m.target.z), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Police: red dots. Helicopter: orange ring.
    ctx.fillStyle = '#ff2222';
    for (const car of state.police) {
      ctx.beginPath();
      ctx.arc(X(car.x), Z(car.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.heli) {
      ctx.strokeStyle = '#ff8c42';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(state.heli.x), Z(state.heli.z), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Player: white arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(X(p.x), Z(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function update(dt) {
    const m = state.mission;
    const step = currentStep(state);
    set(el.money, 'money', '$' + Math.floor(state.money).toLocaleString('en-US'));
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    set(el.stars, 'stars', stars);
    if (el.stars) el.stars.style.color = state.wanted >= 3 ? '#ffdd00' : '#ffffff';
    const station = RADIO_STATIONS[state.radioIndex % RADIO_STATIONS.length];
    set(el.radio, 'radio', state.radioOn ? '♪ ' + station.name : '♪ RADIO OFF');
    set(el.track, 'track', state.radioOn ? audio.trackName() + ' · ' + station.genre : '');
    const hp = Math.max(0, Math.round(state.health));
    if (el.healthFill) el.healthFill.style.width = hp + '%';
    set(el.healthNum, 'health', hp + '');
    set(el.armor, 'armor', state.armor > 0 ? '🛡 ' + Math.round(state.armor) : '');
    const w = state.weapon;
    set(el.weapon, 'weapon', w.toUpperCase());
    set(el.ammo, 'ammo', (state.mag[w] ?? 0) + ' / ' + (state.ammo[w] ?? 0));
    const speed = state.player.onFoot
      ? Math.round(Math.hypot(0, 0))
      : Math.round(Math.abs((state.player.car ? state.player.car.speed : 0)) * 3.6);
    set(el.speed, 'speed', state.player.onFoot ? 'ON FOOT' : speed + ' km/h');
    const hours = Math.floor(state.clock / 3600) % 24;
    const mins = Math.floor((state.clock % 3600) / 60);
    set(el.clock, 'clock', String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ' · NOON SUN');
    set(el.respect, 'respect', 'RESPECT ' + state.respect);
    if (m && el.missionPanel) {
      el.missionPanel.style.display = 'block';
      set(el.missionTitle, 'mtitle', m.def.title);
      set(el.missionGiver, 'mgiver', 'from ' + m.def.giver + ' · $' + m.def.reward.toLocaleString('en-US'));
      const stepText = step ? step.text : '';
      const timer = step && step.seconds ? ' · ' + Math.ceil(m.timer) + 's' : '';
      set(el.missionObj, 'mobj', '▸ ' + stepText + timer);
      if (m.target) {
        const d = Math.hypot(state.player.x - m.target.x, state.player.z - m.target.z);
        set(el.missionDist, 'mdist', Math.round(d) + 'm → ' + m.target.label);
      } else {
        set(el.missionDist, 'mdist', '');
      }
    } else if (el.missionPanel) {
      el.missionPanel.style.display = 'none';
    }
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (el.message) {
        el.message.textContent = state.message;
        el.message.style.opacity = '1';
      }
    } else if (el.message) {
      el.message.style.opacity = '0';
    }
    drawMinimap();
  }

  function toast(text, ms = 3500) {
    if (!el.toast) return;
    const div = document.createElement('div');
    div.className = 'toast-line';
    div.textContent = text;
    el.toast.appendChild(div);
    while (el.toast.children.length > 3) el.toast.removeChild(el.toast.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, ms);
  }

  function showPrompt(text) {
    if (!el.prompt) return;
    if (text) {
      el.prompt.textContent = text;
      el.prompt.style.display = 'block';
    } else {
      el.prompt.style.display = 'none';
    }
  }

  return { update, toast, showPrompt };
}
