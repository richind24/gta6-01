// SOLARA BAY — story missions and the Photo Tour. Ten missions, one at a
// time, each with a beacon on the map and a clear win condition. The Photo
// Tour runs alongside: six landmarks, one photo each.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.missions = {
    index: 0,            // next mission to start (0-based)
    active: null,        // runtime state of the running mission
    betweenT: 0,
    done: 0,
    photoTour: { done: {}, count: 0 },
    _beacon: null,
    _ring: null,

    init: function (scene) {
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 17;
      var ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.6, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
      var g = new THREE.Group();
      g.add(beam); g.add(ring);
      g.visible = false;
      scene.add(g);
      this._beacon = g;
      this._ring = ring;
      return this;
    },

    reset: function () {
      this.index = 0; this.active = null; this.betweenT = 0; this.done = 0;
      this.photoTour = { done: {}, count: 0 };
      if (this._beacon) this._beacon.visible = false;
    },

    startNext: function (ctx) {
      if (this.index >= cfg.missions.length) {
        ctx.onEvent('storyDone', {});
        return;
      }
      var def = cfg.missions[this.index];
      var st = {
        def: def, stage: 0, t: 0, tailT: 0, lostT: 0,
        photos: 0, courier: null, target: null, guardsLeft: 0, pickedUp: false
      };
      this.active = st;
      this._setup(st, ctx);
      this._moveBeacon(st.target);
      ctx.onEvent('missionStart', { mission: def });
    },

    _setup: function (st, ctx) {
      var def = st.def;
      var T = cfg.places;
      // arrival radius = the place's own zone radius (safehouse 12 m, garage
      // 12 m, marina 14 m...), so walking into the marked zone counts — the
      // old fixed 6 m circle was smaller than the zone the player sees.
      st.targetR = (def.target && def.target.r) || 6;
      if (def.type === 'goto' || def.type === 'escape') {
        st.target = { x: def.target.x, z: def.target.z };
        if (def.type === 'escape') SB.police.setWanted(3, ctx);
      } else if (def.type === 'drive') {
        st.target = { x: def.target.x, z: def.target.z };
      } else if (def.type === 'photo') {
        st.target = { x: 222, z: -180 }; // lighthouse first
      } else if (def.type === 'tail') {
        var car = SB.vehicles.createCar('sedan', 0x2e6fd2);
        car.driver = 'courier';
        car.cruise = 13;
        SB.vehicles.add(ctx.scene, car, 0, 60, Math.PI / 2);
        SB.vehicles.traffic.push(car);
        st.courier = car;
        st.target = { x: car.x, z: car.z };
      } else if (def.type === 'deliver') {
        st.target = { x: def.target.x, z: def.target.z };
        st.deliverTo = def.id === 5 ? { x: 60, z: -60, r: 10 } : { x: 150, z: -150, r: 12 };
      } else if (def.type === 'shoot') {
        st.target = { x: def.target.x, z: def.target.z };
        var n = def.id === 9 ? 6 : 4;
        SB.combat.spawnGuards(ctx.scene, def.target.x, def.target.z, n, 12);
        st.guardsLeft = n;
      } else if (def.type === 'chase') {
        var k = SB.vehicles.createCar('sports', 0x14161a);
        k.driver = 'kessler';
        k.health = 100;
        SB.vehicles.add(ctx.scene, k, 180, 150, 0);
        st.kessler = k;
        st.target = { x: k.x, z: k.z };
      }
    },

    _moveBeacon: function (t) {
      if (!this._beacon) return;
      if (!t) { this._beacon.visible = false; return; }
      this._beacon.visible = true;
      this._beacon.position.set(t.x, 0, t.z);
    },

    _complete: function (ctx) {
      var st = this.active;
      if (!st) return;
      var def = st.def;
      ctx.player.addMoney(def.reward);
      this.done++;
      this.index++;
      this.active = null;
      this._moveBeacon(null);
      if (st.courier) SB.vehicles.remove(ctx.scene, st.courier);
      if (st.kessler) SB.vehicles.remove(ctx.scene, st.kessler);
      SB.combat.clearGuards(ctx.scene);
      ctx.onEvent('missionDone', { mission: def });
      this.betweenT = 2.5;
    },

    _fail: function (ctx, why) {
      var st = this.active;
      if (!st) return;
      if (st.courier) SB.vehicles.remove(ctx.scene, st.courier);
      if (st.kessler) SB.vehicles.remove(ctx.scene, st.kessler);
      SB.combat.clearGuards(ctx.scene);
      this.active = null;
      this._moveBeacon(null);
      ctx.onEvent('missionFail', { reason: why });
      this.betweenT = 1.5;
    },

    restartCurrent: function (ctx) {
      if (this.active) {
        if (this.active.courier) SB.vehicles.remove(ctx.scene, this.active.courier);
        if (this.active.kessler) SB.vehicles.remove(ctx.scene, this.active.kessler);
        SB.combat.clearGuards(ctx.scene);
        this.active = null;
        this._moveBeacon(null);
      }
      this.betweenT = 1.0;
    },

    // Photo Tour: Q near a landmark, or a mission photo objective.
    tryPhoto: function (ctx) {
      var p = ctx.player;
      var hit = null;
      for (var i = 0; i < cfg.photoSpots.length; i++) {
        var s = cfg.photoSpots[i];
        if (U.dist2(p.x, p.z, s.x, s.z) < s.r * s.r) { hit = s; break; }
      }
      if (!hit) { ctx.onEvent('photoMiss', {}); return false; }
      if (!this.photoTour.done[hit.id]) {
        this.photoTour.done[hit.id] = true;
        this.photoTour.count++;
        p.addMoney(150);
        ctx.onEvent('photoTour', { spot: hit, count: this.photoTour.count });
      }
      var st = this.active;
      if (st && st.def.type === 'photo' && !st['photo_' + hit.id]) {
        st['photo_' + hit.id] = true;
        st.photos++;
        ctx.onEvent('photoMission', { spot: hit, count: st.photos });
        // next photo target: nearest unphotographed spot
        var next = null, nd = 1e9;
        for (var j = 0; j < cfg.photoSpots.length; j++) {
          var sp = cfg.photoSpots[j];
          if (st['photo_' + sp.id]) continue;
          var d = U.dist2(p.x, p.z, sp.x, sp.z);
          if (d < nd) { nd = d; next = sp; }
        }
        if (next) { st.target = { x: next.x, z: next.z }; this._moveBeacon(st.target); }
      }
      return true;
    },

    update: function (dt, ctx) {
      var p = ctx.player;
      if (this._beacon && this._beacon.visible) {
        var s = 1 + Math.sin(ctx.time * 3) * 0.12;
        this._beacon.scale.set(s, 1, s);
        this._beacon.children[0].material.opacity = 0.18 + Math.sin(ctx.time * 3) * 0.07;
      }
      if (!this.active) {
        if (this.betweenT > 0) {
          this.betweenT -= dt;
          if (this.betweenT <= 0) this.startNext(ctx);
        }
        return;
      }
      var st = this.active;
      var def = st.def;
      st.t += dt;
      var dTarget = st.target ? U.dist2(p.x, p.z, st.target.x, st.target.z) : 1e9;

      if (def.type === 'goto') {
        if (dTarget < st.targetR * st.targetR) this._complete(ctx);
      } else if (def.type === 'drive') {
        if (p.inCar && dTarget < Math.max(64, st.targetR * st.targetR)) this._complete(ctx);
      } else if (def.type === 'photo') {
        if (st.photos >= 3) this._complete(ctx);
      } else if (def.type === 'tail') {
        var c = st.courier;
        if (!c) { this._fail(ctx, 'courier lost'); return; }
        st.target = { x: c.x, z: c.z };
        this._moveBeacon(st.target);
        // courier cruises a rectangle around the avenues
        var cd = Math.sqrt(U.dist2(p.x, p.z, c.x, c.z));
        if (cd < 38) { st.tailT += dt; st.lostT = 0; }
        else {
          st.lostT += dt;
          if (st.lostT > 4) { this._fail(ctx, 'You lost the courier.'); return; }
        }
        // courier route: loop the grid, turning at intersections
        c.angle += 0; // keeps its heading; traffic update moves it
        if (st.tailT >= 20) this._complete(ctx);
      } else if (def.type === 'deliver') {
        if (st.stage === 0) {
          if (dTarget < Math.max(30, st.targetR * st.targetR)) {
            st.stage = 1; st.pickedUp = true;
            st.target = st.deliverTo;
            st.targetR = st.deliverTo.r || 8;
            this._moveBeacon(st.target);
            ctx.onEvent('pickedUp', { mission: def });
          }
        } else if (dTarget < Math.max(64, st.targetR * st.targetR)) {
          this._complete(ctx);
        }
      } else if (def.type === 'shoot') {
        if (st.guardsLeft <= 0) this._complete(ctx);
      } else if (def.type === 'escape') {
        if (dTarget < Math.max(100, st.targetR * st.targetR)) this._complete(ctx);
      } else if (def.type === 'chase') {
        var k = st.kessler;
        if (!k) { this._fail(ctx, 'Kessler got away.'); return; }
        st.target = { x: k.x, z: k.z };
        this._moveBeacon(st.target);
        // Kessler flees from the player along the roads
        var kdx = k.x - p.x, kdz = k.z - p.z;
        var kd = Math.sqrt(kdx * kdx + kdz * kdz) || 1;
        var kwant = Math.atan2(kdx, kdz);
        var kdiff = kwant - k.angle;
        while (kdiff > Math.PI) kdiff -= Math.PI * 2;
        while (kdiff < -Math.PI) kdiff += Math.PI * 2;
        k.angle += U.clamp(kdiff, -2.2 * dt, 2.2 * dt);
        k.speed = U.lerp(k.speed, 40, Math.min(1, dt));
        k.x += Math.sin(k.angle) * k.speed * dt;
        k.z += Math.cos(k.angle) * k.speed * dt;
        SB.world.clampToWorld(k, 6);
        if (SB.world.resolveCircle(k, 2.3)) k.speed *= 0.6;
        k.group.position.set(k.x, 0, k.z);
        k.group.rotation.y = -k.angle;
        k.wheels.forEach(function (w) { w.rotation.z -= k.speed * dt / 0.38; });
        // ramming damages Kessler's car
        st._ramT = (st._ramT || 0) - dt;
        if (p.inCar && U.dist2(p.x, p.z, k.x, k.z) < 22 && st._ramT <= 0) {
          st._ramT = 1.0;
          k.health -= 14;
          p.inCar.speed *= 0.7;
          ctx.onEvent('ramHit', { health: k.health });
        }
        if (k.health <= 0) this._complete(ctx);
      }
    },

    onGuardDown: function (ctx) {
      var st = this.active;
      if (st && st.def.type === 'shoot') {
        st.guardsLeft--;
        ctx.onEvent('guardsLeft', { left: st.guardsLeft });
      }
    }
  };
})();
