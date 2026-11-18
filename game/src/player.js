// SOLARA BAY — Dax Rivers on foot. WASD movement relative to the camera,
// sprint, entering and leaving cars, interacting with the city, and damage.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.player = {
    x: 0, z: 0, angle: 0, vx: 0, vz: 0,
    health: 100, money: 250, armor: false,
    weapon: 'pistol', ammoPistol: 48, ammoRifle: 0,
    inCar: null, dead: false, group: null, fig: null,
    upgrades: { engine: false, armorCar: false },

    create: function (scene) {
      var g = new THREE.Group();
      var teal = new THREE.MeshStandardMaterial({ color: 0x1f7a6d, roughness: 0.85 });
      var jeans = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
      var skin = new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.8 });
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
      head.position.y = 1.66;
      var hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46),
        new THREE.MeshStandardMaterial({ color: 0x201510 }));
      hair.position.y = 1.92;
      var torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.76, 0.4), teal);
      torso.position.y = 1.08;
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.28), jeans);
      legL.position.set(0, 0.35, -0.17);
      var legR = legL.clone(); legR.position.z = 0.17;
      var armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), teal);
      armL.position.set(0, 1.08, -0.45);
      var armR = armL.clone(); armR.position.z = 0.45;
      // rifle on the back when owned
      var rifle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x22262b }));
      rifle.position.set(0, 1.25, 0.28); rifle.rotation.x = 0.5;
      rifle.name = 'backRifle'; rifle.visible = false;
      g.add(head); g.add(hair); g.add(torso); g.add(legL); g.add(legR);
      g.add(armL); g.add(armR); g.add(rifle);
      g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
      this.group = g;
      this.fig = { legL: legL, legR: legR, armL: armL, armR: armR, rifle: rifle };
      this.reset();
      scene.add(g);
      return this;
    },

    reset: function () {
      var s = cfg.places.spawn;
      this.x = s.x; this.z = s.z; this.angle = Math.PI;
      this.health = cfg.player.health; this.money = cfg.player.startMoney;
      this.armor = false; this.weapon = 'pistol';
      this.ammoPistol = cfg.player.startAmmoPistol; this.ammoRifle = 0;
      this.inCar = null; this.dead = false;
      this.upgrades = { engine: false, armorCar: false };
      if (this.group) { this.group.position.set(this.x, 0, this.z); this.group.visible = true; }
    },

    get ammo() { return this.weapon === 'rifle' ? this.ammoRifle : this.ammoPistol; },
    set ammo(v) {
      if (this.weapon === 'rifle') this.ammoRifle = Math.max(0, Math.round(v));
      else this.ammoPistol = Math.max(0, Math.round(v));
    },

    takeDamage: function (n, ctx) {
      if (this.dead || (this.inCar && this.inCar.health > 0)) {
        // damage while driving hits the car first
        if (this.inCar) {
          var car = this.inCar;
          car.health -= this.upgrades.armorCar ? n * 0.5 : n;
          if (car.health <= 0) { ctx.onEvent('carDestroyed', { car: car }); }
          return;
        }
      }
      if (this.armor) n *= 0.5;
      this.health -= n;
      if (this.health <= 0) {
        this.health = 0; this.dead = true;
        ctx.onEvent('died', {});
      }
    },

    heal: function (n) { this.health = Math.min(cfg.player.health, this.health + n); },
    addMoney: function (n) { this.money += n; },

    update: function (dt, ctx) {
      var input = ctx.input;
      if (this.dead) return;
      if (this.inCar) {
        var car = this.inCar;
        this.x = car.x; this.z = car.z; this.angle = car.angle;
        this.group.visible = false;
        this.group.position.set(car.x, 0, car.z);
        if (input.pressed.has(cfg.keys.interact)) {
          // step out on the driver's side
          this.inCar = null;
          car.driver = null;
          var sx = car.x + Math.cos(car.angle) * 2.2, sz = car.z - Math.sin(car.angle) * 2.2;
          this.x = sx; this.z = sz;
          this.group.visible = true;
          ctx.onEvent('exitedCar', { car: car });
        }
        return;
      }
      this.group.visible = true;
      var camYaw = ctx.cameraYaw;
      var f = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
      var r = { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
      var mx = 0, mz = 0;
      if (input.keys.has(cfg.keys.forward)) { mx += f.x; mz += f.z; }
      if (input.keys.has(cfg.keys.back)) { mx -= f.x; mz -= f.z; }
      if (input.keys.has(cfg.keys.right)) { mx += r.x; mz += r.z; }
      if (input.keys.has(cfg.keys.left)) { mx -= r.x; mz -= r.z; }
      var moving = (mx !== 0 || mz !== 0);
      var sprint = input.keys.has(cfg.keys.sprint);
      var speed = sprint ? cfg.player.sprintSpeed : cfg.player.walkSpeed;
      if (moving) {
        var len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        var want = Math.atan2(mx, mz);
        var diff = want - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += U.clamp(diff, -10 * dt, 10 * dt);
        this.vx = mx * speed; this.vz = mz * speed;
        this.x += this.vx * dt; this.z += this.vz * dt;
      } else {
        this.vx = 0; this.vz = 0;
      }
      SB.world.clampToWorld(this, 4);
      SB.world.resolveCircle(this, 0.7);
      // walk cycle
      var ph = (ctx.time * (moving ? speed * 1.6 : 0));
      var sw = moving ? Math.sin(ph) * 0.6 : 0;
      this.fig.legL.rotation.x = sw; this.fig.legR.rotation.x = -sw;
      this.fig.armL.rotation.x = -sw * 0.7; this.fig.armR.rotation.x = sw * 0.7;
      this.fig.rifle.visible = this.ammoRifle > 0 || this.weapon === 'rifle';
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = -this.angle;

      // E: a shop, garage or safehouse under your feet wins over a car —
      // otherwise a passing traffic car at the Ammu-Nation door would steal
      // the press and you could never buy anything.
      if (input.pressed.has(cfg.keys.interact)) {
        var zone = SB.economy.zoneAt(this.x, this.z);
        if (zone && (zone.kind === 'shop' || zone.kind === 'garage' || zone.kind === 'safehouse' || zone.kind === 'marina')) {
          ctx.onEvent('interact', { x: this.x, z: this.z });
          return;
        }
        var car2 = SB.vehicles.nearestCar(this.x, this.z, 4.5);
        if (car2) {
          this.inCar = car2;
          car2.driver = 'player';
          car2.upgrade.engine = this.upgrades.engine;
          car2.upgrade.armor = this.upgrades.armorCar;
          ctx.onEvent('enteredCar', { car: car2 });
          if (car2.type !== 'taxi') ctx.onEvent('crime', { kind: 'steal', amount: 1 });
        } else {
          ctx.onEvent('interact', { x: this.x, z: this.z });
        }
      }
    }
  };
})();
