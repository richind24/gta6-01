// SOLARA BAY — police helicopter. Air support arrives at three stars: it
// orbits Dax, pins him with a searchlight, and only leaves when the heat
// drops back below three stars.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.heli = {
    group: null,
    rotor: null,
    active: false,
    leaving: false,
    angle: 0,
    y: 0,

    _build: function () {
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5c, roughness: 0.5, metalness: 0.3 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.7, 2.2), bodyMat);
      body.castShadow = true;
      var nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x9fd4ef, roughness: 0.15, metalness: 0.5 }));
      nose.position.set(2.4, -0.1, 0); nose.scale.set(1.2, 0.9, 0.9);
      var tail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 0.7), bodyMat);
      tail.position.set(-4.2, 0.35, 0);
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.4), bodyMat);
      fin.position.set(-6.2, 0.9, 0);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.0, 8), bodyMat);
      mast.position.set(0.2, 1.3, 0);
      var rotor = new THREE.Group();
      rotor.position.set(0.2, 1.85, 0);
      var b1 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x22262b }));
      var b2 = b1.clone(); b2.rotation.y = Math.PI / 2;
      rotor.add(b1); rotor.add(b2);
      var skidL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.18), bodyMat);
      skidL.position.set(0, -1.25, -0.9);
      var skidR = skidL.clone(); skidR.position.z = 0.9;
      // searchlight cone, aimed down at the player
      var cone = new THREE.Mesh(new THREE.ConeGeometry(7, 40, 20, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
      cone.position.set(0, -21, 0);
      cone.name = 'spot';
      g.add(body); g.add(nose); g.add(tail); g.add(fin); g.add(mast);
      g.add(rotor); g.add(skidL); g.add(skidR); g.add(cone);
      this.group = g;
      this.rotor = rotor;
      return g;
    },

    update: function (dt, ctx) {
      var wanted = ctx.wanted;
      var p = ctx.player;
      if (!this.active && wanted >= cfg.heli.minWanted) {
        if (!this.group) this._build();
        ctx.scene.add(this.group);
        this.active = true; this.leaving = false;
        this.angle = Math.atan2(p.x, p.z);
        this.y = cfg.heli.height;
        ctx.onEvent('heli', { active: true });
      }
      if (!this.active) return;
      if (wanted < cfg.heli.minWanted) this.leaving = true;
      this.rotor.rotation.y += dt * 22;
      if (this.leaving) {
        this.y += dt * 14;
        this.group.position.y = this.y;
        if (this.y > 130) {
          ctx.scene.remove(this.group);
          this.active = false; this.leaving = false;
          ctx.onEvent('heli', { active: false });
        }
        return;
      }
      this.angle += dt * 0.45;
      var r = cfg.heli.orbitRadius;
      var hx = p.x + Math.sin(this.angle) * r;
      var hz = p.z + Math.cos(this.angle) * r;
      this.group.position.set(hx, this.y + Math.sin(ctx.time * 1.4) * 1.2, hz);
      // nose points at the player, cone stays vertical
      this.group.rotation.y = -Math.atan2(p.x - hx, p.z - hz) + Math.PI / 2;
      var spot = this.group.getObjectByName('spot');
      if (spot) spot.rotation.z = 0;
    },

    position: function () {
      if (!this.active || !this.group) return null;
      return { x: this.group.position.x, z: this.group.position.z };
    }
  };
})();
