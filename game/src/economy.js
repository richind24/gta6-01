// Economy: cash, buyable properties with daily income, and the shops.
// Rebuild (Nov 2026): a third property (Bayview Apartment safehouse), the
// Rifle in the gun shop, and two new shops — Bayview Diner (heals) and
// Solara Auto (car repair + Turbo Kit + Armor Plating upgrades).

import { LANDMARKS } from './world.js';
import { repairPlayerCar } from './player.js';

export const PROPERTIES = [
  { id: 'garage', name: 'Harbor Garage', price: 4000, income: 150, at: LANDMARKS.garage, owned: false },
  { id: 'marina', name: 'Solara Marina', price: 12000, income: 400, at: LANDMARKS.marina, owned: false },
  { id: 'apartment', name: 'Bayview Apartment', price: 8000, income: 250, at: LANDMARKS.apartment, owned: false },
];

export const SHOP_ITEMS = [
  { id: 'pistol', name: 'Pistol + 24 ammo', price: 500, owned: (G) => G.player.weaponsOwned.includes('pistol'), apply(G) { G.player.weaponsOwned.push('pistol'); G.player.ammo.pistol += 24; } },
  { id: 'pistol_ammo', name: 'Pistol ammo x24', price: 120, apply(G) { G.player.ammo.pistol += 24; } },
  { id: 'smg', name: 'SMG + 60 ammo', price: 1500, owned: (G) => G.player.weaponsOwned.includes('smg'), apply(G) { if (!G.player.weaponsOwned.includes('smg')) G.player.weaponsOwned.push('smg'); G.player.ammo.smg += 60; } },
  { id: 'smg_ammo', name: 'SMG ammo x60', price: 300, apply(G) { G.player.ammo.smg += 60; } },
  { id: 'shotgun', name: 'Shotgun + 12 shells', price: 1200, owned: (G) => G.player.weaponsOwned.includes('shotgun'), apply(G) { if (!G.player.weaponsOwned.includes('shotgun')) G.player.weaponsOwned.push('shotgun'); G.player.ammo.shotgun += 12; } },
  { id: 'shotgun_ammo', name: 'Shotgun shells x12', price: 200, apply(G) { G.player.ammo.shotgun += 12; } },
  { id: 'rifle', name: 'Rifle + 20 rounds', price: 2500, owned: (G) => G.player.weaponsOwned.includes('rifle'), apply(G) { if (!G.player.weaponsOwned.includes('rifle')) G.player.weaponsOwned.push('rifle'); G.player.ammo.rifle += 20; } },
  { id: 'rifle_ammo', name: 'Rifle rounds x20', price: 400, apply(G) { G.player.ammo.rifle += 20; } },
  { id: 'armor', name: 'Body armor (+50 HP)', price: 800, apply(G) { G.player.health = Math.min(100, G.player.health + 50); } },
];

// Generic shops (diner + auto) share the same shop panel as the gun shop.
export const SHOPS = [
  {
    id: 'gunshop', name: 'Ironworks Arms — Toko Senjata', at: LANDMARKS.gunshop,
    items: SHOP_ITEMS,
  },
  {
    id: 'diner', name: 'Bayview Diner — Makan & Minum', at: LANDMARKS.diner,
    items: [
      { id: 'burger', name: 'Burger Solara (+25 HP)', price: 25, apply(G) { G.player.health = Math.min(100, G.player.health + 25); } },
      { id: 'coffee', name: 'Kopi Teluk (+10 HP)', price: 10, apply(G) { G.player.health = Math.min(100, G.player.health + 10); } },
      { id: 'feast', name: 'Paket Keluarga (+50 HP)', price: 60, apply(G) { G.player.health = Math.min(100, G.player.health + 50); } },
    ],
  },
  {
    id: 'auto', name: 'Solara Auto — Bengkel & Upgrade', at: LANDMARKS.auto,
    items: [
      { id: 'repair', name: 'Perbaiki mobil (harus di dalam mobil)', price: 100, apply(G) { if (!repairPlayerCar(G)) G.hud.flash('Masuk ke mobil dulu untuk diperbaiki.'); } },
      { id: 'turbo', name: 'Turbo Kit (+25% top speed)', price: 2500, owned: (G) => !!G.player.upgrades.turbo, apply(G) { G.player.upgrades.turbo = true; if (G.playerCar) G.playerCar.maxHealth = G.playerCar.maxHealth || 100; } },
      { id: 'armorplate', name: 'Pelat Baja (damage -33%)', price: 1500, owned: (G) => !!G.player.upgrades.armor, apply(G) { G.player.upgrades.armor = true; } },
    ],
  },
];

export function nearShop(G) {
  for (const s of SHOPS) {
    if (Math.hypot(G.player.x - s.at.x, G.player.z - s.at.z) < 12) return s;
  }
  return null;
}

export function nearGunshop(G) {
  return Math.hypot(G.player.x - LANDMARKS.gunshop.x, G.player.z - LANDMARKS.gunshop.z) < 12;
}

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
