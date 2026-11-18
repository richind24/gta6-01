// Economy: cash, buyable properties with daily income, and the weapon shop.

import { LANDMARKS } from './world.js';

export const PROPERTIES = [
  { id: 'garage', name: 'Harbor Garage', price: 4000, income: 150, at: LANDMARKS.garage, owned: false },
  { id: 'marina', name: 'Solara Marina', price: 12000, income: 400, at: LANDMARKS.marina, owned: false },
];

export const SHOP_ITEMS = [
  { id: 'pistol', name: 'Pistol + 24 ammo', price: 500, apply(G) { G.player.weaponsOwned.push('pistol'); G.player.ammo.pistol += 24; } },
  { id: 'pistol_ammo', name: 'Pistol ammo x24', price: 120, apply(G) { G.player.ammo.pistol += 24; } },
  { id: 'smg', name: 'SMG + 60 ammo', price: 1500, apply(G) { if (!G.player.weaponsOwned.includes('smg')) G.player.weaponsOwned.push('smg'); G.player.ammo.smg += 60; } },
  { id: 'smg_ammo', name: 'SMG ammo x60', price: 300, apply(G) { G.player.ammo.smg += 60; } },
  { id: 'shotgun', name: 'Shotgun + 12 shells', price: 1200, apply(G) { if (!G.player.weaponsOwned.includes('shotgun')) G.player.weaponsOwned.push('shotgun'); G.player.ammo.shotgun += 12; } },
  { id: 'shotgun_ammo', name: 'Shotgun shells x12', price: 200, apply(G) { G.player.ammo.shotgun += 12; } },
  { id: 'armor', name: 'Body armor (+50 HP)', price: 800, apply(G) { G.player.health = Math.min(100, G.player.health + 50); } },
];

export function dailyIncome(G) {
  let total = 0;
  for (const p of PROPERTIES) if (p.owned) total += p.income;
  return total;
}

export function collectDailyIncome(G) {
  const inc = dailyIncome(G);
  if (inc > 0) {
    G.player.money += inc;
    G.hud.flash(`Pemasukan properti: +$${inc} (hari baru di Solara Bay).`);
  }
}

export function tryBuyProperty(G) {
  for (const p of PROPERTIES) {
    const d = Math.hypot(G.player.x - p.at.x, G.player.z - p.at.z);
    if (d < 12 && !p.owned) {
      if (G.player.money >= p.price) {
        G.player.money -= p.price;
        p.owned = true;
        G.hud.flash(`Kamu membeli ${p.name} seharga $${p.price}! Pemasukan $${p.income}/hari.`);
        G.audio.missionDone();
        G.saveGame();
        return true;
      }
      G.hud.flash(`Uang tidak cukup — ${p.name} harganya $${p.price}.`);
      return true;
    }
    if (d < 12 && p.owned) { G.hud.flash(`${p.name} sudah milikmu. Pemasukan $${p.income}/hari.`); return true; }
  }
  return false;
}

export function nearGunshop(G) {
  return Math.hypot(G.player.x - LANDMARKS.gunshop.x, G.player.z - LANDMARKS.gunshop.z) < 12;
}
