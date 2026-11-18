// HUD: DOM overlay — money, wanted stars, health, speed, clock, objective,
// minimap canvas, mission cards, menus (start / pause / shop / busted / wasted).
// Rebuild (Nov 2026): a DENSER HUD — radio station + now-playing, story progress
// (x/10), a helicopter warning line, and a generic shop panel that serves the
// gun shop, the diner and Solara Auto from one code path.

import { CITY, roadLines, clockLabel, money, STORY_TOTAL } from './config.js';
import { LANDMARKS } from './world.js';
import { WEAPONS } from './combat.js';
import { PROPERTIES, SHOP_ITEMS, SHOPS } from './economy.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const H = {
    money: el('hud-money'), stars: el('hud-stars'), health: el('hud-health-fill'),
    healthText: el('hud-health-text'), speed: el('hud-speed'), clock: el('hud-clock'),
    objective: el('hud-objective'), prompt: el('hud-prompt'), flashEl: el('hud-flash'),
    card: el('mission-card'), cardTitle: el('mission-card-title'), cardText: el('mission-card-text'),
    minimap: el('minimap'), damage: el('damage-flash'),
    menu: el('menu'), menuTitle: el('menu-title'), menuText: el('menu-text'),
    menuButtons: el('menu-buttons'), shop: el('shop'), shopList: el('shop-list'),
    shopTitle: el('shop-title'), crosshair: el('crosshair'),
    radio: el('hud-radio'), story: el('hud-story'), heliWarn: el('hud-heli'),
    flashTimer: 0, cardTimer: 0,
    minimapCtx: el('minimap').getContext('2d'),

    flash(msg) {
      H.flashEl.textContent = msg;
      H.flashEl.style.opacity = '1';
      H.flashTimer = 3.5;
    },
    showMissionCard(title, text) {
      H.cardTitle.textContent = title;
      H.cardText.textContent = text;
      H.card.style.opacity = '1';
      H.cardTimer = 5;
    },
    setObjective(text) { H.objective.textContent = '▸ ' + text; },
    setPrompt(text) { H.prompt.textContent = text; },
    damageFlash() {
      H.damage.style.opacity = '0.55';
      setTimeout(() => { H.damage.style.opacity = '0'; }, 180);
    },
    showMenu(title, text, buttons) {
      H.menuTitle.textContent = title;
      H.menuText.innerHTML = text;
      H.menuButtons.innerHTML = '';
      for (const b of buttons) {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        btn.onclick = () => { G.audio.ensure(); G.audio.click(); b.fn(); };
        H.menuButtons.appendChild(btn);
      }
      H.menu.style.display = 'flex';
    },
    hideMenu() { H.menu.style.display = 'none'; },
    // Generic shop panel: any SHOPS entry (gun shop, diner, auto) renders here.
    showShop(shopDef) {
      const def = shopDef || SHOPS[0];
      H.shopTitle.textContent = def.name;
      H.shopList.innerHTML = '';
      for (const item of def.items) {
        const row = document.createElement('div');
        row.className = 'shop-row';
        const owned = item.owned ? item.owned(G) : false;
        row.innerHTML = `<span>${item.name}</span><span>${money(item.price)}</span>`;
        const btn = document.createElement('button');
        btn.textContent = owned ? 'Dimiliki' : 'Beli';
        btn.disabled = owned || G.player.money < item.price;
        btn.onclick = () => {
          if (G.player.money < item.price) return;
          G.player.money -= item.price;
          item.apply(G);
          G.audio.missionDone();
          H.flash(`${item.name} dibeli.`);
          H.showShop(def);
          G.saveGame();
        };
        row.appendChild(btn);
        H.shopList.appendChild(row);
      }
      H.shop.style.display = 'block';
      H.shop.querySelector('#shop-close').onclick = () => { H.shop.style.display = 'none'; G.paused = false; };
      G.paused = true;
    },
    update(dt) {
      if (H.flashTimer > 0) { H.flashTimer -= dt; if (H.flashTimer <= 0) H.flashEl.style.opacity = '0'; }
      if (H.cardTimer > 0) { H.cardTimer -= dt; if (H.cardTimer <= 0) H.card.style.opacity = '0'; }
      H.money.textContent = money(G.player.money);
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
      H.stars.textContent = stars;
      H.stars.style.color = G.wanted > 0 ? '#ffcf3c' : 'rgba(255,255,255,0.35)';
      H.health.style.width = Math.max(0, G.player.health) + '%';
      H.healthText.textContent = 'HP ' + Math.ceil(Math.max(0, G.player.health));
      H.clock.textContent = clockLabel(G.weather.day, G.weather.timeOfDay) + (G.weather.raining ? ' ☂' : '');
      // radio + story progress (dense HUD, always visible)
      if (H.radio && G.radio) H.radio.textContent = G.radio.label();
      if (H.story) {
        const done = G.missions ? G.missions.storyIndex : 0;
        const active = G.missions && G.missions.active ? ` • ${G.missions.active.def.name}` : '';
        H.story.textContent = `Cerita ${Math.min(done, STORY_TOTAL)}/${STORY_TOTAL}${active}`;
      }
      // helicopter warning
      if (H.heliWarn) {
        const heliOn = G.heli && G.heli.active;
        H.heliWarn.style.display = heliOn ? 'block' : 'none';
        if (heliOn) H.heliWarn.textContent = '🚁 HELIKOPTER POLISI DI ATASMU';
      }
      if (G.inCar && G.playerCar) {
        H.speed.style.display = 'block';
        H.speed.textContent = Math.round(Math.abs(G.playerCar.speed) * 3.6) + ' km/h';
      } else H.speed.style.display = 'none';
      const w = WEAPONS[G.player.weapon];
      const ammo = G.player.weapon === 'fists' ? '∞' : (G.player.ammo[G.player.weapon] || 0);
      document.getElementById('hud-weapon').textContent = `${w.name}  •  ${ammo}`;
      H.crosshair.style.display = G.player.weapon === 'fists' ? 'none' : 'block';
      H.drawMinimap();
    },
    drawMinimap() {
      const ctx = H.minimapCtx, S = 190, R = 150; // world radius shown
      const px = G.inCar ? G.playerCar.x : G.player.x;
      const pz = G.inCar ? G.playerCar.z : G.player.z;
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(10, 18, 26, 0.85)';
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
      const toMap = (x, z) => [S / 2 + ((x - px) / R) * (S / 2), S / 2 + ((z - pz) / R) * (S / 2)];
      // water
      ctx.fillStyle = '#2a7fa8';
      const [wx0, wy0] = toMap(-CITY.half - 40, CITY.waterAt);
      ctx.fillRect(0, wy0, S, S);
      // roads
      ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 5;
      for (const l of roadLines()) {
        const [x1, y1] = toMap(l, pz - R); const [x2, y2] = toMap(l, pz + R);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const [a1, b1] = toMap(px - R, l); const [a2, b2] = toMap(px + R, l);
        ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
      }
      // park
      ctx.fillStyle = '#5d8a46';
      const [pkx, pky] = toMap(-32, -32);
      ctx.fillRect(pkx, pky, 64 / R * S / 2, 64 / R * S / 2);
      // landmarks
      const blip = (x, z, color, r = 4) => {
        const [bx, by] = toMap(x, z);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      };
      blip(LANDMARKS.bar.x, LANDMARKS.bar.z, '#ff5a3c', 5);
      blip(LANDMARKS.gunshop.x, LANDMARKS.gunshop.z, '#ffc93c');
      blip(LANDMARKS.diner.x, LANDMARKS.diner.z, '#ff8c42');
      blip(LANDMARKS.auto.x, LANDMARKS.auto.z, '#9b59b6');
      blip(LANDMARKS.radio.x, LANDMARKS.radio.z, '#e84393');
      blip(LANDMARKS.mansion.x, LANDMARKS.mansion.z, '#c0392b');
      for (const p of PROPERTIES) if (!p.owned) blip(p.at.x, p.at.z, '#3cc95f');
      // mission marker
      if (G.missions && G.missions.marker && G.missions.marker.visible) {
        const mx = G.missions.marker.position.x, mz = G.missions.marker.position.z;
        const [bx, by] = toMap(mx, mz);
        ctx.fillStyle = '#ffd21f';
        ctx.beginPath(); ctx.moveTo(bx, by - 8); ctx.lineTo(bx + 6, by + 5); ctx.lineTo(bx - 6, by + 5); ctx.closePath(); ctx.fill();
      }
      // police + helicopter
      for (const c of G.policeCars) blip(c.x, c.z, '#3c6cff', 3);
      if (G.heli && G.heli.active && G.heli.model) {
        blip(G.heli.model.position.x, G.heli.model.position.z, '#ff2020', 6);
      }
      // player arrow
      const heading = G.inCar ? G.playerCar.heading : G.player.heading;
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(-heading + Math.PI);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
      // ring
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    },
  };
  return H;
}
