// SOLARA BAY — shooting. Pistol and rifle fire from the camera's aim, with
// a muzzle flash, a tracer, and real consequences: hitting a bystander is a
// crime, and the mission guards shoot back.
(function () {
  'use strict';
  var SB = window.SB;
  var U = SB.util;

  SB.combat = {
    guards: [],
    _flashT: 0,
    _flash: null,
    _tracer: null,
    _tracerT: 0,

    init: function (scene) {
      var flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
      flash.visible = false;
      scene.add(flash);
      this._flash = flash;
      var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      var tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
      tracer.visible = false;
      scene.add(tracer);
      this._tracer = tracer;
    },

    spawnGuards: function (scene, x, z, n, spread) {
      spread = spread || 10;
      var made = [];
      for (var i = 0; i < n; i++) {
        var gx = x + (Math.random() - 0.5) * spread * 2;
        var gz = z + (Math.random() - 0.5) * spread * 2;
        var g = SB.people.create(gx, gz, { guard: true });
        g.speed = 3.4;
        g.shootT = 1 + Math.random();
        scene.add(g.group);
        this.guards.push(g);
        made.push(g);
      }
      return made;
    },

    clearGuards: function (scene) {
      for (var i = 0; i < this.guards.length; i++) SB.people.remove(scene, this.guards[i]);
      this.guards = [];
    },

    _aimDir: function (ctx) {
      // aim follows the camera: yaw around Y, slight downward pitch
      var yaw = ctx.cameraYaw, pitch = ctx.cameraPitch || -0.06;
      return {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch)
      };
    },

    tryShoot: function (ctx) {
      var p = ctx.player;
      if (p.dead || p.inCar) return false;
      if (p.ammo <= 0) {
        ctx.onEvent('dryFire', {});
        return false;
      }
      p.ammo--;
      var range = p.weapon === 'rifle' ? 95 : 48;
      var dmg = p.weapon === 'rifle' ? 34 : 20;
      var origin = { x: p.x, y: 1.5, z: p.z };
      var dir = this._aimDir(ctx);
      // muzzle flash at the gun
      if (this._flash) {
        this._flash.position.set(p.x + dir.x * 1.1, 1.45, p.z + dir.z * 1.1);
        this._flash.lookAt(ctx.camera.position);
        this._flash.visible = true;
        this._flashT = 0.06;
      }
      var hitPoint = { x: origin.x + dir.x * range, y: Math.max(0.2, origin.y + dir.y * range), z: origin.z + dir.z * range };
      var best = null, bestD = range;
      var consider = function (tx, ty, tz, radius, ref) {
        var dx = tx - origin.x, dy = ty - origin.y, dz = tz - origin.z;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > range || d < 0.5) return;
        var dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
        var cone = radius / Math.max(d, 1) + 0.03;
        if (dot > 1 - cone && d < bestD) { bestD = d; best = ref; hitPoint = { x: tx, y: ty, z: tz }; }
      };
      var i, g;
      for (i = 0; i < this.guards.length; i++) {
        g = this.guards[i];
        consider(g.x, 1.2, g.z, 0.9, { kind: 'guard', ref: g });
      }
      for (i = 0; i < SB.police.footCops.length; i++) {
        var c = SB.police.footCops[i];
        consider(c.x, 1.2, c.z, 0.9, { kind: 'cop', ref: c });
      }
      for (i = 0; i < SB.people.list.length; i++) {
        var ped = SB.people.list[i];
        if (ped.cop || ped.guard) continue;
        consider(ped.x, 1.2, ped.z, 0.8, { kind: 'ped', ref: ped });
      }
      for (i = 0; i < SB.vehicles.list.length; i++) {
        var car = SB.vehicles.list[i];
        if (car === p.inCar) continue;
        consider(car.x, 1.0, car.z, 2.4, { kind: 'car', ref: car });
      }
      if (this._tracer) {
        var pos = this._tracer.geometry.attributes.position;
        pos.setXYZ(0, origin.x + dir.x, 1.45, origin.z + dir.z);
        pos.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
        pos.needsUpdate = true;
        this._tracer.visible = true;
        this._tracerT = 0.08;
      }
      ctx.onEvent('shotFired', { weapon: p.weapon });
      if (!best) return true;
      if (best.kind === 'guard') {
        best.ref.health -= dmg;
        ctx.onEvent('guardHit', { guard: best.ref });
        if (best.ref.health <= 0) {
          SB.people.remove(ctx.scene, best.ref);
          this.guards.splice(this.guards.indexOf(best.ref), 1);
          p.addMoney(50);
          ctx.onEvent('guardDown', { guard: best.ref });
        }
      } else if (best.kind === 'cop') {
        best.ref.health -= dmg;
        if (best.ref.health <= 0) {
          SB.people.remove(ctx.scene, best.ref);
          SB.police.footCops.splice(SB.police.footCops.indexOf(best.ref), 1);
          ctx.onEvent('copDown', {});
          SB.police.addWanted(1, ctx);
        } else {
          SB.police.addWanted(1, ctx);
        }
      } else if (best.kind === 'ped') {
        SB.people.remove(ctx.scene, best.ref);
        ctx.onEvent('pedDown', {});
        SB.police.addWanted(1, ctx);
      } else if (best.kind === 'car') {
        best.ref.health -= dmg;
        if (best.ref.health <= 0) ctx.onEvent('carDestroyed', { car: best.ref });
      }
      return true;
    },

    update: function (dt, ctx) {
      if (this._flashT > 0) {
        this._flashT -= dt;
        if (this._flashT <= 0 && this._flash) this._flash.visible = false;
      }
      if (this._tracerT > 0) {
        this._tracerT -= dt;
        if (this._tracerT <= 0 && this._tracer) this._tracer.visible = false;
      }
      // guards hunt the player
      var p = ctx.player;
      for (var i = this.guards.length - 1; i >= 0; i--) {
        var g = this.guards[i];
        var dx = p.x - g.x, dz = p.z - g.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        g.shootT -= dt;
        if (d < 30 && !p.dead) {
          g.angle = Math.atan2(dx, dz);
          if (d > 12) {
            g.x += Math.sin(g.angle) * g.speed * dt;
            g.z += Math.cos(g.angle) * g.speed * dt;
          }
          if (g.shootT <= 0) {
            g.shootT = 1.6 + Math.random() * 0.8;
            p.takeDamage(6, ctx);
            ctx.onEvent('guardShot', { x: g.x, z: g.z });
          }
        } else if (d > 2) {
          // drift back toward their post
          g.x += Math.sin(g.angle) * 0.6 * dt;
          g.z += Math.cos(g.angle) * 0.6 * dt;
        }
        SB.world.resolveCircle(g, 0.6);
        g.walkPhase += dt * 3;
        var sw = Math.sin(g.walkPhase) * 0.4;
        g.fig.legL.rotation.x = sw; g.fig.legR.rotation.x = -sw;
        g.group.position.set(g.x, 0, g.z);
        g.group.rotation.y = -g.angle;
      }
    }
  };
})();
