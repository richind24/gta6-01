// SOLARA BAY — money, shops and the garage. Buying is plain arithmetic on
// the player's wallet; the shop and garage modals live in the HUD.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.economy = {
    // Where the player is standing right now, if anywhere buyable.
    zoneAt: function (x, z) {
      var i, s, d;
      for (i = 0; i < cfg.places.shops.length; i++) {
        s = cfg.places.shops[i];
        d = U.dist2(x, z, s.x, s.z);
        if (d < s.r * s.r) return { kind: 'shop', shop: s };
      }
      var g = cfg.places.garage;
      if (U.dist2(x, z, g.x, g.z) < g.r * g.r) return { kind: 'garage' };
      var h = cfg.places.safehouse;
      if (U.dist2(x, z, h.x, h.z) < h.r * h.r) return { kind: 'safehouse' };
      var m = cfg.places.marina;
      if (U.dist2(x, z, m.x, m.z) < m.r * m.r) return { kind: 'marina' };
      return null;
    },

    itemsFor: function (shop) {
      if (!shop) return cfg.economy.shopItems;
      if (shop.kind === 'weapons') {
        return cfg.economy.shopItems.filter(function (it) {
          return ['rifle', 'ammo-rifle', 'ammo-pistol', 'armor'].indexOf(it.id) >= 0;
        });
      }
      return cfg.economy.shopItems.filter(function (it) {
        return ['snack', 'medkit', 'armor'].indexOf(it.id) >= 0;
      });
    },

    buy: function (id, ctx) {
      var p = ctx.player;
      var item = null;
      for (var i = 0; i < cfg.economy.shopItems.length; i++) {
        if (cfg.economy.shopItems[i].id === id) item = cfg.economy.shopItems[i];
      }
      if (!item) return { ok: false, msg: 'No such item.' };
      if (p.money < item.price) return { ok: false, msg: 'Not enough cash.' };
      p.money -= item.price;
      if (id === 'rifle') { p.weapon = 'rifle'; p.ammoRifle += 30; }
      else if (id === 'ammo-rifle') p.ammoRifle += 30;
      else if (id === 'ammo-pistol') p.ammoPistol += 24;
      else if (id === 'armor') p.armor = true;
      else if (id === 'snack') p.heal(25);
      else if (id === 'medkit') p.heal(1000);
      ctx.onEvent('bought', { item: item });
      return { ok: true, msg: 'Bought ' + item.name + '.' };
    },

    buyUpgrade: function (id, ctx) {
      var p = ctx.player;
      var up = null;
      for (var i = 0; i < cfg.economy.garageUpgrades.length; i++) {
        if (cfg.economy.garageUpgrades[i].id === id) up = cfg.economy.garageUpgrades[i];
      }
      if (!up) return { ok: false, msg: 'No such upgrade.' };
      if (p.money < up.price) return { ok: false, msg: 'Not enough cash.' };
      if (id === 'engine' && p.upgrades.engine) return { ok: false, msg: 'Turbo already fitted.' };
      if (id === 'armor-car' && p.upgrades.armorCar) return { ok: false, msg: 'Armor already fitted.' };
      p.money -= up.price;
      if (id === 'engine') {
        p.upgrades.engine = true;
        if (p.inCar) p.inCar.upgrade.engine = true;
      } else if (id === 'armor-car') {
        p.upgrades.armorCar = true;
        if (p.inCar) p.inCar.upgrade.armor = true;
      } else if (id === 'paint') {
        if (p.inCar) p.inCar.group.children[0].material.color.setHex(0xe07b39);
      }
      ctx.onEvent('bought', { item: up });
      return { ok: true, msg: 'Fitted: ' + up.name + '.' };
    },

    // Safehouse: heal up and save the game.
    rest: function (ctx) {
      var p = ctx.player;
      p.heal(1000);
      SB.save.saveGame(ctx);
      ctx.onEvent('rested', {});
    }
  };
})();
