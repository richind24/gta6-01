// SOLARA BAY — cars. Arcade handling for the player, looping traffic AI for
// the city, and one shared car factory so every vehicle looks the same.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.5, metalness: 0.35 }, opts || {}));
  }

  SB.vehicles = {
    list: [],
    traffic: [],

    createCar: function (type, colorHex) {
      var spec = cfg.car.types[type] || cfg.car.types.sedan;
      var g = new THREE.Group();
      var bodyMat = mat(colorHex);
      var body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.95, 2.0), bodyMat);
      body.position.y = 0.75; body.castShadow = true;
      var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.15, metalness: 0.6 }));
      cabin.position.set(-0.25, 1.55, 0); cabin.castShadow = true;
      g.add(body); g.add(cabin);
      if (type === 'pickup') {
        var bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), mat(0x22262b));
        bed.position.set(1.5, 1.3, 0); g.add(bed);
      }
      if (type === 'taxi') {
        var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5),
          new THREE.MeshBasicMaterial({ color: 0xf5d90a }));
        sign.position.set(-0.25, 2.15, 0); g.add(sign);
      }
      // headlights / taillights
      var hl = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
      var tl = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
      [[2.22, 0.62], [2.22, -0.62]].forEach(function (p) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.4), hl);
        m.position.set(p[0], 0.85, p[1]); g.add(m);
      });
      [[-2.22, 0.62], [-2.22, -0.62]].forEach(function (p) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.4), tl);
        m.position.set(p[0], 0.85, p[1]); g.add(m);
      });
      var wheels = [];
      [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]].forEach(function (p) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), mat(0x16181c, { roughness: 0.95 }));
        w.rotation.x = Math.PI / 2;
        w.position.set(p[0], 0.38, p[1]);
        g.add(w); wheels.push(w);
      });
      var car = {
        group: g, type: type, spec: spec, color: colorHex,
        x: 0, z: 0, angle: 0, speed: 0, health: 100,
        wheels: wheels, driver: null, upgrade: { engine: false, armor: false },
        steer: 0, axis: 'x', dir: 1, road: 0, cruise: 10, stuck: 0
      };
      return car;
    },

    add: function (scene, car, x, z, angle) {
      car.x = x; car.z = z; car.angle = angle || 0;
      car.group.position.set(x, 0, z);
      car.group.rotation.y = -car.angle;
      scene.add(car.group);
      this.list.push(car);
      return car;
    },

    remove: function (scene, car) {
      scene.remove(car.group);
      var i = this.list.indexOf(car);
      if (i >= 0) this.list.splice(i, 1);
      var j = this.traffic.indexOf(car);
      if (j >= 0) this.traffic.splice(j, 1);
    },

    spawnTraffic: function (scene, count) {
      var rnd = U.rng(20240);
      var types = Object.keys(cfg.car.types);
      var cols = cfg.palette.car;
      for (var i = 0; i < count; i++) {
        var axis = rnd() < 0.5 ? 'x' : 'z';
        var road = cfg.world.roads[Math.floor(rnd() * cfg.world.roads.length)];
        var dir = rnd() < 0.5 ? 1 : -1;
        var along = -200 + rnd() * 400;
        var type = types[Math.floor(rnd() * types.length)];
        var car = this.createCar(type, cols[Math.floor(rnd() * cols.length)]);
        car.driver = 'traffic';
        car.axis = axis; car.dir = dir; car.road = road;
        car.cruise = 8 + rnd() * 6;
        var x = axis === 'x' ? along : road + (dir > 0 ? 2.4 : -2.4);
        var z = axis === 'x' ? road + (dir > 0 ? 2.4 : -2.4) : along;
        var angle = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        this.add(scene, car, x, z, angle);
        this.traffic.push(car);
      }
    },

    // Arcade drive model for the player's car.
    drive: function (car, input, dt, world) {
      var top = car.spec.top * (car.upgrade.engine ? 1.25 : 1);
      var onRoad = this._onRoad(car.x, car.z);
      if (!onRoad) top *= 0.55; // grass and sand slow you down
      var fwd = input.keys.has(cfg.keys.forward) ? 1 : 0;
      var back = input.keys.has(cfg.keys.back) ? 1 : 0;
      if (fwd) car.speed += car.spec.accel * dt;
      else if (back) car.speed -= (car.speed > 0.5 ? 22 : 10) * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      car.speed = U.clamp(car.speed, -12, top);
      var steerIn = (input.keys.has(cfg.keys.left) ? 1 : 0) - (input.keys.has(cfg.keys.right) ? 1 : 0);
      car.steer = U.lerp(car.steer, steerIn, Math.min(1, dt * 8));
      var turnRate = car.steer * (car.speed / top) * 2.1;
      car.angle += (car.speed >= 0 ? turnRate : -turnRate) * dt;
      var fx = Math.sin(car.angle), fz = Math.cos(car.angle);
      car.x += fx * car.speed * dt;
      car.z += fz * car.speed * dt;
      world.clampToWorld(car, 6);
      if (world.resolveCircle(car, 2.3)) {
        car.speed *= 0.55;
        car.health -= Math.abs(car.speed) * 0.02;
      }
      // car-vs-car bumps
      for (var i = 0; i < this.list.length; i++) {
        var o = this.list[i];
        if (o === car) continue;
        var d2 = U.dist2(car.x, car.z, o.x, o.z);
        if (d2 < 20) {
          var d = Math.sqrt(d2) || 0.1;
          var push = (4.5 - d) / 2;
          var nx = (car.x - o.x) / d, nz = (car.z - o.z) / d;
          car.x += nx * push; car.z += nz * push;
          if (o.driver === 'traffic') { o.x -= nx * push; o.z -= nz * push; }
          car.speed *= 0.85;
          car.health -= 0.15;
        }
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = -car.angle;
      car.wheels.forEach(function (w) { w.rotation.z -= car.speed * dt / 0.38; });
      return car.speed;
    },

    _onRoad: function (x, z) {
      for (var i = 0; i < cfg.world.roads.length; i++) {
        var r = cfg.world.roads[i];
        if (Math.abs(x - r) < 6 || Math.abs(z - r) < 6) return true;
      }
      return x > cfg.world.beachX;
    },

    nearestCar: function (x, z, maxD) {
      var best = null, bestD = maxD * maxD;
      for (var i = 0; i < this.list.length; i++) {
        var c = this.list[i];
        if (c.driver === 'player') continue;
        var d = U.dist2(x, z, c.x, c.z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    },

    update: function (dt, ctx) {
      // Traffic: cruise along its road, turn at intersections sometimes,
      // brake when a car is right ahead.
      for (var i = 0; i < this.traffic.length; i++) {
        var c = this.traffic[i];
        var ahead = null, aheadD = 1e9;
        for (var j = 0; j < this.list.length; j++) {
          var o = this.list[j];
          if (o === c) continue;
          var dx = o.x - c.x, dz = o.z - c.z;
          var fx = Math.sin(c.angle), fz = Math.cos(c.angle);
          var along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
          if (along > 0 && along < aheadD && side < 2.5) { aheadD = along; ahead = o; }
        }
        var target = c.cruise;
        if (ahead && aheadD < 9) target = 0;
        if (ctx.playerCar && U.dist2(c.x, c.z, ctx.playerCar.x, ctx.playerCar.z) < 100 && aheadD < 12) target = Math.min(target, 3);
        c.speed = U.lerp(c.speed, target, Math.min(1, dt * 2));
        var alongPos = c.axis === 'x' ? c.x : c.z;
        var atCross = false;
        for (var k = 0; k < cfg.world.roads.length; k++) {
          if (Math.abs(alongPos - cfg.world.roads[k]) < c.speed * dt + 0.6) { atCross = true; break; }
        }
        if (atCross && Math.random() < 0.012) {
          // turn onto the crossing road
          var cross = cfg.world.roads[Math.floor(Math.random() * cfg.world.roads.length)];
          if (c.axis === 'x') { c.axis = 'z'; c.road = cross; c.z = cross + (c.dir > 0 ? 2.4 : -2.4); }
          else { c.axis = 'x'; c.road = cross; c.x = cross + (c.dir > 0 ? 2.4 : -2.4); }
          c.angle = c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
        }
        var fx2 = Math.sin(c.angle), fz2 = Math.cos(c.angle);
        c.x += fx2 * c.speed * dt;
        c.z += fz2 * c.speed * dt;
        if (c.x > 232 || c.x < -232 || c.z > 232 || c.z < -232) {
          // loop back to the far side on the same road
          if (c.axis === 'x') c.x = c.dir > 0 ? -230 : 230;
          else c.z = c.dir > 0 ? -230 : 230;
        }
        c.group.position.set(c.x, 0, c.z);
        c.group.rotation.y = -c.angle;
        c.wheels.forEach(function (w) { w.rotation.z -= c.speed * dt / 0.38; });
      }
    }
  };
})();
