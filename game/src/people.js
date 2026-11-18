// SOLARA BAY — pedestrians. Low-poly walkers who stroll the sidewalks, chat
// on corners, and run when the shooting starts. Foot cops reuse the same
// figure with a uniform.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  function figure(colors) {
    var g = new THREE.Group();
    var skin = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.8 });
    var shirt = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.9 });
    var pants = new THREE.MeshStandardMaterial({ color: colors.pants, roughness: 0.9 });
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
    head.position.y = 1.62; head.castShadow = true;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
    torso.position.y = 1.05; torso.castShadow = true;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.26), pants);
    legL.position.set(0, 0.34, -0.16);
    var legR = legL.clone(); legR.position.z = 0.16;
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirt);
    armL.position.set(0, 1.05, -0.42);
    var armR = armL.clone(); armR.position.z = 0.42;
    g.add(head); g.add(torso); g.add(legL); g.add(legR); g.add(armL); g.add(armR);
    return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, head: head };
  }

  var SKINS = [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf0c8a0, 0x6b4423];
  var SHIRTS = [0xd23b2e, 0x2e6fd2, 0xf2c230, 0x37b268, 0xe8e8e8, 0x8a5fd0, 0xe07b39, 0x3fa7a0];
  var PANTS = [0x2c313a, 0x3a4a5c, 0x5a4a3a, 0x22262b];

  SB.people = {
    list: [],

    create: function (x, z, opts) {
      opts = opts || {};
      var rnd = U.rng((x * 31 + z * 17) | 0);
      var colors = opts.cop
        ? { skin: SKINS[1], shirt: 0x1e3a5c, pants: 0x141c26 }
        : { skin: SKINS[Math.floor(rnd() * SKINS.length)], shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)], pants: PANTS[Math.floor(rnd() * PANTS.length)] };
      var f = figure(colors);
      if (opts.cop) {
        var cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46),
          new THREE.MeshStandardMaterial({ color: 0x0f1c2c }));
        cap.position.y = 1.9;
        f.group.add(cap);
      }
      var p = {
        fig: f, group: f.group, x: x, z: z, angle: rnd() * Math.PI * 2,
        speed: opts.cop ? 0 : 1 + rnd() * 1.6, target: null, state: 'walk',
        walkPhase: rnd() * 6, cop: !!opts.cop, guard: !!opts.guard,
        health: opts.guard ? 60 : 30, fleeT: 0
      };
      f.group.position.set(x, 0, z);
      this.list.push(p);
      return p;
    },

    spawnCrowd: function (scene, count) {
      var rnd = U.rng(777);
      var roads = cfg.world.roads;
      for (var i = 0; i < count; i++) {
        var road = roads[Math.floor(rnd() * roads.length)];
        var along = -210 + rnd() * 420;
        var side = rnd() < 0.5 ? 9 : -9;
        var x, z;
        if (rnd() < 0.5) { x = along; z = road + side; }
        else { x = road + side; z = along; }
        if (x > 195) continue;
        var p = this.create(x, z);
        p.target = this._newTarget(p, rnd);
        scene.add(p.group);
      }
    },

    _newTarget: function (p, rnd) {
      rnd = rnd || Math.random;
      var roads = cfg.world.roads;
      var road = roads[Math.floor(rnd() * roads.length)];
      var along = -210 + rnd() * 420;
      var side = rnd() < 0.5 ? 9 : -9;
      if (rnd() < 0.5) return { x: along, z: road + side };
      return { x: road + side, z: along };
    },

    nearest: function (x, z, maxD, filter) {
      var best = null, bestD = maxD * maxD;
      for (var i = 0; i < this.list.length; i++) {
        var p = this.list[i];
        if (filter && !filter(p)) continue;
        var d = U.dist2(x, z, p.x, p.z);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    },

    remove: function (scene, p) {
      scene.remove(p.group);
      var i = this.list.indexOf(p);
      if (i >= 0) this.list.splice(i, 1);
    },

    update: function (dt, ctx) {
      var px = ctx.player.x, pz = ctx.player.z;
      var danger = ctx.wanted >= 2 || ctx.shooting;
      for (var i = 0; i < this.list.length; i++) {
        var p = this.list[i];
        if (p.cop || p.guard) continue; // cops and guards are driven by police/combat
        var dPlayer = U.dist2(p.x, p.z, px, pz);
        if (danger && dPlayer < 900) {
          p.state = 'flee'; p.fleeT = 2.5;
        } else if (p.fleeT > 0) {
          p.fleeT -= dt;
          if (p.fleeT <= 0) p.state = 'walk';
        }
        var speed = p.speed;
        var tx, tz;
        if (p.state === 'flee') {
          speed = 4.4;
          var dx = p.x - px, dz = p.z - pz;
          var d = Math.sqrt(dx * dx + dz * dz) || 1;
          tx = p.x + (dx / d) * 20; tz = p.z + (dz / d) * 20;
        } else {
          if (!p.target || U.dist2(p.x, p.z, p.target.x, p.target.z) < 4) p.target = this._newTarget(p);
          tx = p.target.x; tz = p.target.z;
        }
        var dx2 = tx - p.x, dz2 = tz - p.z;
        var want = Math.atan2(dx2, dz2);
        var diff = want - p.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.angle += U.clamp(diff, -2.4 * dt, 2.4 * dt);
        p.x += Math.sin(p.angle) * speed * dt;
        p.z += Math.cos(p.angle) * speed * dt;
        SB.world.clampToWorld(p, 8);
        SB.world.resolveCircle(p, 0.6);
        p.walkPhase += dt * speed * 2.4;
        var sw = Math.sin(p.walkPhase) * 0.55;
        p.fig.legL.rotation.x = sw; p.fig.legR.rotation.x = -sw;
        p.fig.armL.rotation.x = -sw * 0.7; p.fig.armR.rotation.x = sw * 0.7;
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.y = -p.angle;
      }
    }
  };
})();
