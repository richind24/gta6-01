// SOLARA BAY — the city. A 480 m street grid, a bright beach and ocean on the
// east edge, a marina on the east shore, and one-off landmark buildings. Everything
// is built from boxes, cylinders and canvas textures at load time.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0.05 }, opts || {}));
  }

  SB.world = {
    colliders: [],
    zones: null,
    // Push a circle (player, car, ped) out of every building AABB.
    resolveCircle: function (p, r) {
      var hit = false;
      for (var i = 0; i < this.colliders.length; i++) {
        var c = this.colliders[i];
        var cx = U.clamp(p.x, c.x0, c.x1), cz = U.clamp(p.z, c.z0, c.z1);
        var dx = p.x - cx, dz = p.z - cz;
        var d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-6) {
          var d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
        } else {
          // centre inside the box: shove out along the smallest overlap
          var ox = Math.min(p.x - c.x0 + r, c.x1 - p.x + r);
          var oz = Math.min(p.z - c.z0 + r, c.z1 - p.z + r);
          if (ox < oz) p.x = (p.x - c.x0 < c.x1 - p.x) ? c.x0 - r : c.x1 + r;
          else p.z = (p.z - c.z0 < c.z1 - p.z) ? c.z0 - r : c.z1 + r;
        }
      }
      return hit;
    },
    clampToWorld: function (p, margin) {
      var h = cfg.world.half - (margin || 4);
      p.x = U.clamp(p.x, -h, 250); p.z = U.clamp(p.z, -h, h);
    },

    build: function (scene) {
      var W = this;
      W.colliders = [];
      var group = new THREE.Group();
      group.name = 'city';
      scene.add(group);
      var rnd = U.rng(1337);

      // ---- ground: grass, sand strip, ocean ----
      var grass = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
        new THREE.MeshStandardMaterial({ map: SB.textures.grass(), roughness: 1 }));
      grass.rotation.x = -Math.PI / 2; grass.position.y = -0.06; grass.receiveShadow = true;
      group.add(grass);
      var sand = new THREE.Mesh(new THREE.PlaneGeometry(52, 500),
        new THREE.MeshStandardMaterial({ map: SB.textures.sand(), roughness: 1 }));
      sand.rotation.x = -Math.PI / 2; sand.position.set(224, -0.02, 0); sand.receiveShadow = true;
      group.add(sand);
      var ocean = new THREE.Mesh(new THREE.PlaneGeometry(300, 560),
        new THREE.MeshStandardMaterial({ map: SB.textures.water(), roughness: 0.35, metalness: 0.1 }));
      ocean.rotation.x = -Math.PI / 2; ocean.position.set(395, -0.35, 0);
      group.add(ocean);

      // ---- roads + sidewalks on the grid ----
      var roadTex = SB.textures.road();
      var walkTex = SB.textures.sidewalk();
      cfg.world.roads.forEach(function (r) {
        var walkV = new THREE.Mesh(new THREE.PlaneGeometry(17, 480),
          new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 }));
        walkV.rotation.x = -Math.PI / 2; walkV.position.set(r, 0.005, 0); walkV.receiveShadow = true;
        group.add(walkV);
        var roadV = new THREE.Mesh(new THREE.PlaneGeometry(10, 480),
          new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }));
        roadV.rotation.x = -Math.PI / 2; roadV.position.set(r, 0.02, 0); roadV.receiveShadow = true;
        group.add(roadV);
        var walkH = walkV.clone(); walkH.rotation.z = Math.PI / 2; walkH.position.set(0, 0.005, r);
        group.add(walkH);
        var roadH = roadV.clone(); roadH.rotation.z = Math.PI / 2; roadH.position.set(0, 0.02, r);
        group.add(roadH);
      });

      // ---- generic city blocks ----
      var blocks = [-150, -90, -30, 30, 90, 150];
      var reserved = { '-150,-150': 1, '150,-150': 1, '-90,90': 1, '90,-90': 1, '150,90': 1 };
      var pal = cfg.palette.building, roofs = cfg.palette.roof;
      blocks.forEach(function (bx) {
        blocks.forEach(function (bz) {
          if (reserved[bx + ',' + bz]) return;
          var distC = Math.abs(bx) + Math.abs(bz);
          var tall = rnd() < (distC < 90 ? 0.45 : 0.18);
          var n = tall ? 1 : (rnd() < 0.5 ? 2 : 1);
          for (var k = 0; k < n; k++) {
            var w = 22 + rnd() * 14, d = 22 + rnd() * 14;
            var h = tall ? 26 + rnd() * 26 : 8 + rnd() * 12;
            var ox = n === 2 ? (k === 0 ? -12 : 12) : 0;
            var oz = n === 2 ? (k === 0 ? -10 : 12) : 0;
            var cx = bx + ox, cz = bz + oz;
            var color = pal[Math.floor(rnd() * pal.length)];
            var face = new THREE.MeshStandardMaterial({
              map: SB.textures.building('#' + new THREE.Color(color).getHexString(), Math.max(2, Math.round(h / 4))),
              roughness: 0.9
            });
            var b = box(w, h, d, face, cx, h / 2, cz);
            group.add(b);
            var roof = box(w + 1, 1, d + 1, mat(roofs[Math.floor(rnd() * roofs.length)]), cx, h + 0.5, cz);
            group.add(roof);
            W.colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
          }
        });
      });

      // ---- landmark buildings ----
      function landmark(x, z, w, h, d, color, signText, signBg) {
        var face = new THREE.MeshStandardMaterial({
          map: SB.textures.building('#' + new THREE.Color(color).getHexString(), Math.max(2, Math.round(h / 5))),
          roughness: 0.9
        });
        var b = box(w, h, d, face, x, h / 2, z);
        group.add(b);
        group.add(box(w + 1, 1, d + 1, mat(0x37424e), x, h + 0.5, z));
        if (signText) {
          var sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 18), 4.5),
            new THREE.MeshBasicMaterial({ map: SB.textures.sign(signText, signBg || '#22262b', '#ffffff') }));
          sign.position.set(x, h * 0.72, z + d / 2 + 0.15);
          group.add(sign);
        }
        W.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
        return b;
      }
      // Safehouse: small cream house with a porch.
      landmark(-150, -150, 16, 7, 12, 0xf2e3c6, "DAX'S PLACE", '#7a5a2e');
      // Garage: wide low block with an awning.
      landmark(150, -150, 26, 9, 18, 0x3f6d8e, 'SUNSET GARAGE', '#d96a1e');
      // Ammu-Nation + Bay Mart storefronts.
      landmark(-78, 78, 20, 8, 14, 0x8e3b2f, 'AMMU-NATION', '#3b2f2f');
      landmark(78, -78, 20, 8, 14, 0x2f7a4b, 'BAY MART', '#1e4d33');
      // Warehouse, bank, tower.
      landmark(-205, 135, 30, 12, 22, 0x6b5d4f, 'KESSLER WAREHOUSE', '#4a3f35');
      landmark(135, 75, 22, 16, 18, 0xd8d2c4, 'BAYFRONT BANK', '#274156');
      var tower = landmark(195, 195, 24, 64, 24, 0x4b8fd0, 'SOLARA TOWER', '#123a5c');
      tower.material = new THREE.MeshStandardMaterial({ color: 0x9fd4ef, roughness: 0.25, metalness: 0.6 });

      // Lighthouse on the beach.
      var light = new THREE.Group();
      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 26, 12), mat(0xf2f2f2));
      shaft.position.y = 13; shaft.castShadow = true;
      var band = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 3, 12), mat(0xd23b2e));
      band.position.y = 18;
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      lamp.position.y = 27;
      light.add(shaft); light.add(band); light.add(lamp);
      light.position.set(222, 0, -180);
      group.add(light);
      W.colliders.push({ x0: 218, x1: 226, z0: -184, z1: -176 });

      // Plaza fountain at the city centre.
      var basin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.2, 20), mat(0xcfd6da));
      basin.position.set(0, 0.6, 0); basin.castShadow = true;
      var jet = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 3.4, 10), mat(0x8a97a3));
      jet.position.set(0, 1.7, 0);
      var pool = new THREE.Mesh(new THREE.CircleGeometry(6.4, 20),
        new THREE.MeshStandardMaterial({ color: 0x2fa7d8, roughness: 0.2 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(0, 1.25, 0);
      group.add(basin); group.add(jet); group.add(pool);
      W.colliders.push({ x0: -7, x1: 7, z0: -7, z1: 7 });

      // Marina on the east shore: wooden piers run east from the sand into
      // the ocean, boats moored alongside them in the water (ocean starts at
      // x = 245). Pier roots sit on the sand at x = 225.
      var pierMat = mat(0x8a6b45);
      [46, 60, 74].forEach(function (pz) {
        var pier = box(28, 0.8, 3, pierMat, 239, 0.4, pz);
        group.add(pier);
      });
      for (var bi = 0; bi < 4; bi++) {
        var bz = 40 + bi * 14, bx = 249 + (bi % 2) * 5;
        var hull = box(12, 2, 5, mat([0xe8e8e8, 0xd23b2e, 0x2e6fd2, 0xf2c230][bi]), bx, 0.6, bz);
        var cab = box(4, 2, 3, mat(0xffffff), bx, 2.4, bz);
        group.add(hull); group.add(cab);
        W.colliders.push({ x0: bx - 7, x1: bx + 7, z0: bz - 3, z1: bz + 3 });
      }

      // Stadium bowl (low ring) in the south-west.
      var bowl = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 7, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xd96a5f, roughness: 0.9, side: THREE.DoubleSide }));
      bowl.position.set(-195, 3.5, 195); bowl.castShadow = true;
      group.add(bowl);
      W.colliders.push({ x0: -213, x1: -177, z0: 177, z1: 213 });

      // Beach umbrellas.
      for (var u = 0; u < 8; u++) {
        var ux = 208 + rnd() * 22, uz = -200 + u * 52 + rnd() * 10;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), mat(0xffffff));
        pole.position.set(ux, 1.5, uz);
        var top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8),
          mat([0xd23b2e, 0x2e6fd2, 0xf2c230, 0x37b268][u % 4]));
        top.position.set(ux, 3.4, uz);
        group.add(pole); group.add(top);
      }

      // Palms along the beach and the main avenues.
      function palm(x, z, s) {
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 6 * s, 7), mat(0x8a6b45));
        trunk.position.y = 3 * s; trunk.rotation.z = 0.08;
        g.add(trunk);
        for (var f = 0; f < 6; f++) {
          var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 3.4 * s, 5), mat(0x3f9142));
          var a = (f / 6) * Math.PI * 2;
          leaf.position.set(Math.cos(a) * 1.5 * s, 6.2 * s, Math.sin(a) * 1.5 * s);
          leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
          g.add(leaf);
        }
        g.position.set(x, 0, z);
        return g;
      }
      for (var p = 0; p < 26; p++) group.add(palm(206 + rnd() * 6, -230 + p * 18 + rnd() * 6, 0.9 + rnd() * 0.5));
      for (var q = 0; q < 12; q++) group.add(palm(-170 + q * 30, -188, 0.9 + rnd() * 0.4));

      // Streetlights along the avenues (unlit at noon, bright at night).
      var lampMat = mat(0x2c313a);
      var bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
      cfg.world.roads.forEach(function (r) {
        for (var s2 = -180; s2 <= 180; s2 += 60) {
          var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), lampMat);
          pole.position.set(r + 6.5, 3.5, s2); pole.castShadow = true;
          var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
          bulb.position.set(r + 6.5, 7.1, s2);
          group.add(pole); group.add(bulb);
        }
      });

      W.zones = {
        safehouse: cfg.places.safehouse,
        garage: cfg.places.garage,
        shops: cfg.places.shops,
        marina: cfg.places.marina,
        warehouse: cfg.places.warehouse,
        bank: cfg.places.bank,
        tower: cfg.places.tower,
        plaza: cfg.places.plaza,
        spawn: cfg.places.spawn
      };
      W.group = group;
      return W;
    }
  };
})();
