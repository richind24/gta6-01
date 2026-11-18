// SOLARA BAY — wanted level and the Bay PD. Stars rise with crime, cop cars
// chase and ram, foot cops chase and hit, and the heat only fades when Dax
// stays clean and out of sight.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.police = {
    wanted: 0,
    quietT: 0,
    copCars: [],
    footCops: [],
    _shootT: 0,

    reset: function () {
      this.wanted = 0; this.quietT = 0;
      this.copCars = []; this.footCops = [];
    },

    addWanted: function (n, ctx) {
      var before = this.wanted;
      this.wanted = U.clamp(this.wanted + n, 0, cfg.police.maxWanted);
      this.quietT = 0;
      if (this.wanted !== before && ctx) ctx.onEvent('wanted', { wanted: this.wanted });
    },

    setWanted: function (n, ctx) {
      this.wanted = U.clamp(n, 0, cfg.police.maxWanted);
      this.quietT = 0;
      if (ctx) ctx.onEvent('wanted', { wanted: this.wanted });
    },

    _spawnCopCar: function (scene, ctx) {
      var p = ctx.player;
      var roads = cfg.world.roads;
      var road = roads[Math.floor(Math.random() * roads.length)];
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var along = U.clamp(axis === 'x' ? p.x : p.z, -200, 200) + (Math.random() < 0.5 ? -80 : 80);
      along = U.clamp(along, -220, 220);
      var x = axis === 'x' ? along : road + 2.4;
      var z = axis === 'x' ? road + 2.4 : along;
      var car = SB.vehicles.createCar('sedan', 0x1e3a5c);
      car.driver = 'cop';
      // light bar
      var barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
      barR.position.set(-0.3, 2.05, -0.5);
      var barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2e6fff }));
      barB.position.set(-0.3, 2.05, 0.5);
      car.group.add(barR); car.group.add(barB);
      car.lightR = barR; car.lightB = barB;
      SB.vehicles.add(scene, car, x, z, 0);
      this.copCars.push(car);
      return car;
    },

    _spawnFootCop: function (scene, ctx) {
      var p = ctx.player;
      var a = Math.random() * Math.PI * 2;
      var x = p.x + Math.sin(a) * 26, z = p.z + Math.cos(a) * 26;
      SB.world.clampToWorld({ x: x, z: z }, 8);
      var cop = SB.people.create(x, z, { cop: true });
      cop.speed = 6.2;
      ctx.scene.add(cop.group);
      this.footCops.push(cop);
      return cop;
    },

    _despawn: function (scene, list, item) {
      var i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
      if (item.group) SB.people.remove(scene, item);
      else SB.vehicles.remove(scene, item);
    },

    update: function (dt, ctx) {
      var scene = ctx.scene;
      var p = ctx.player;
      this.quietT += dt;
      // heat decays after a quiet stretch with no cop nearby
      var nearestCop = 1e9;
      this.copCars.forEach(function (c) { nearestCop = Math.min(nearestCop, U.dist2(c.x, c.z, p.x, p.z)); });
      this.footCops.forEach(function (c) { nearestCop = Math.min(nearestCop, U.dist2(c.x, c.z, p.x, p.z)); });
      if (this.wanted > 0 && this.quietT > cfg.police.decaySeconds && nearestCop > 3600) {
        this.wanted--;
        this.quietT = 0;
        ctx.onEvent('wanted', { wanted: this.wanted });
      }

      // ---- cop cars ----
      var wantCars = Math.min(5, this.wanted * cfg.police.copCarsPerStar);
      while (this.copCars.length < wantCars) this._spawnCopCar(scene, ctx);
      while (this.copCars.length > wantCars) this._despawn(scene, this.copCars, this.copCars[0]);
      for (var i = this.copCars.length - 1; i >= 0; i--) {
        var car = this.copCars[i];
        // flashing light bar
        var phase = Math.floor(ctx.time * 6) % 2 === 0;
        car.lightR.material.color.setHex(phase ? 0xff2e2e : 0x550000);
        car.lightB.material.color.setHex(phase ? 0x0a2470 : 0x2e6fff);
        // steer toward the player, faster than traffic
        var dx = p.x - car.x, dz = p.z - car.z;
        var want = Math.atan2(dx, dz);
        var diff = want - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.angle += U.clamp(diff, -2.6 * dt, 2.6 * dt);
        var top = 38;
        car.speed = U.lerp(car.speed, top, Math.min(1, dt * 1.2));
        car.x += Math.sin(car.angle) * car.speed * dt;
        car.z += Math.cos(car.angle) * car.speed * dt;
        SB.world.clampToWorld(car, 6);
        if (SB.world.resolveCircle(car, 2.3)) car.speed *= 0.6;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = -car.angle;
        car.wheels.forEach(function (w) { w.rotation.z -= car.speed * dt / 0.38; });
        // ramming the player
        var d2 = U.dist2(car.x, car.z, p.x, p.z);
        if (d2 < 12) {
          if (p.inCar) {
            p.inCar.health -= 12 * dt;
            p.inCar.speed *= (1 - 0.6 * dt);
            if (p.inCar.health <= 0) ctx.onEvent('carDestroyed', { car: p.inCar });
          } else {
            p.takeDamage(14 * dt, ctx);
            // shove the player aside
            var d = Math.sqrt(d2) || 1;
            p.x += ((p.x - car.x) / d) * 6 * dt;
            p.z += ((p.z - car.z) / d) * 6 * dt;
          }
          car.speed *= 0.5;
        }
        if (d2 > 90000) this._despawn(scene, this.copCars, car);
      }

      // ---- foot cops ----
      var wantCops = this.wanted >= 2 ? Math.min(5, (this.wanted - 1) * cfg.police.footCopsPerStar) : 0;
      while (this.footCops.length < wantCops) this._spawnFootCop(scene, ctx);
      while (this.footCops.length > wantCops) this._despawn(scene, this.footCops, this.footCops[0]);
      this._shootT -= dt;
      for (var j = this.footCops.length - 1; j >= 0; j--) {
        var cop = this.footCops[j];
        var cdx = p.x - cop.x, cdz = p.z - cop.z;
        var cd = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
        cop.angle = Math.atan2(cdx, cdz);
        var cspeed = cd > 2.2 ? cop.speed : 0;
        cop.x += Math.sin(cop.angle) * cspeed * dt;
        cop.z += Math.cos(cop.angle) * cspeed * dt;
        SB.world.resolveCircle(cop, 0.6);
        cop.walkPhase += dt * cspeed * 2.4;
        var sw = Math.sin(cop.walkPhase) * 0.55;
        cop.fig.legL.rotation.x = sw; cop.fig.legR.rotation.x = -sw;
        cop.group.position.set(cop.x, 0, cop.z);
        cop.group.rotation.y = -cop.angle;
        if (cd < 2.2) {
          p.takeDamage(9 * dt, ctx);
        } else if (this.wanted >= 4 && cd < 26 && this._shootT <= 0) {
          this._shootT = 1.4;
          p.takeDamage(5, ctx);
          ctx.onEvent('copShot', { x: cop.x, z: cop.z });
        }
        if (cd > 320) this._despawn(scene, this.footCops, cop);
      }
    }
  };
})();
