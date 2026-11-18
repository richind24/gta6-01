// Cobalt Vice — HUD (DOM) + minimap.
function fmtTime() {
  const h = Math.floor(G.time) % 24;
  const m = Math.floor((G.time % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function updateHUD() {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('hud-money', '$' + Math.floor(G.money).toLocaleString());
  const starsEl = document.getElementById('hud-stars');
  if (starsEl) {
    starsEl.textContent = '★'.repeat(G.wanted) + '☆'.repeat(Math.max(0, 5 - G.wanted));
    starsEl.style.color = G.wanted > 0 ? '#ffd23c' : '#5a6a7a';
  }
  const hp = document.getElementById('hud-hp');
  if (hp) {
    hp.style.width = clamp(G.health, 0, 100) + '%';
    hp.style.background = G.health > 50 ? '#35d05a' : G.health > 25 ? '#f2a93b' : '#e03a2e';
  }
  set('hud-clock', fmtTime() + '  •  ' + ['CLEAR', 'RAIN', 'FOG'][G.weather]);
  set('hud-speed', Math.round(G.speedKmh) + ' km/h');
  const w = WEAPONS[G.weapon];
  set('hud-weapon', w.name + (G.weapon === 'fists' ? '' : '  •  ' + G.ammo[G.weapon] + ' rounds'));
  if (G.mission) {
    set('hud-mission', 'MISSION ' + (G.mission.index + 1) + ' — ' + G.mission.title);
    set('hud-objective', G.mission.obj);
  } else if (G.side) {
    set('hud-mission', 'SIDE JOB — ' + G.side.label);
    set('hud-objective', G.side.desc);
  } else if (G.missionIndex >= STORY.length) {
    set('hud-mission', 'PORT MERIDIAN — FREE ROAM');
    set('hud-objective', 'Story complete. Side jobs (purple) and properties still pay.');
  } else {
    set('hud-mission', 'PORT MERIDIAN');
    set('hud-objective', 'Next story mission starts shortly…');
  }
  if (G.bannerT > 0) {
    G.bannerT -= 1 / 60;
    if (G.bannerT <= 0) {
      const el = document.getElementById('banner');
      if (el) el.style.opacity = '0';
    }
  }
  if (G.toastT > 0) {
    G.toastT -= 1 / 60;
    if (G.toastT <= 0) {
      const el = document.getElementById('toast');
      if (el) el.style.opacity = '0';
    }
  }
  drawMinimap();
}

function drawMinimap() {
  const cv = document.getElementById('minimap');
  if (!cv || !G.groundCanvas) return;
  const x = cv.getContext('2d');
  const S = cv.width;
  x.clearRect(0, 0, S, S);
  x.drawImage(G.groundCanvas, 0, 0, S, S);
  const toMap = (wx, wz) => [((wx + 1000) / 2000) * S, ((wz + 1000) / 2000) * S];
  const dot = (wx, wz, color, r) => {
    const [mx, mz] = toMap(wx, wz);
    x.fillStyle = color;
    x.beginPath();
    x.arc(mx, mz, r, 0, 7);
    x.fill();
  };
  // Mission beacon.
  if (G.mission) {
    const m = G.mission;
    const tgt = m.type === 'race' ? m.gates[m.gate] : m.marker;
    if (tgt) {
      const [mx, mz] = toMap(tgt[0], tgt[1]);
      x.strokeStyle = '#ffd23c';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(mx, mz, 7, 0, 7);
      x.stroke();
      dot(tgt[0], tgt[1], '#ffd23c', 3);
    }
  }
  if (G.side) {
    const s = G.side;
    const tgt = s.kind === 'race' ? s.gates[s.step] : s.kind === 'courier' ? s.drops[s.step] : [s.x, s.z];
    if (tgt) dot(tgt[0], tgt[1], '#c05adf', 4);
  }
  for (const mk of G.world.markers) dot(mk.x, mk.z, '#c05adf', 3);
  for (const c of G.world.cops) dot(c.x, c.z, '#ff3b30', 3);
  for (const c of G.world.traffic) dot(c.x, c.z, 'rgba(255,255,255,0.65)', 1.6);
  // Player arrow.
  const [px, pz] = toMap(G.player.x, G.player.z);
  x.save();
  x.translate(px, pz);
  x.rotate(-G.player.a + Math.PI / 2);
  x.fillStyle = '#ffffff';
  x.strokeStyle = '#111111';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(0, -7);
  x.lineTo(5, 6);
  x.lineTo(0, 3);
  x.lineTo(-5, 6);
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
}
