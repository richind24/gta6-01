// SOLARA BAY — sky and time. The day runs noon-bright by default and drifts
// slowly through golden hour to night; screenshot mode locks noon so the
// cover is always bright daylight.
(function () {
  'use strict';
  var SB = window.SB;
  var U = SB.util;

  SB.weather = {
    hour: 12,          // 0..24, 12 = noon
    locked: false,     // true in screenshot mode
    rate: 0.02,        // game-hours per real second (a full day in ~20 min)
    sun: null, hemi: null, clouds: [],

    init: function (scene) {
      var hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.25);
      scene.add(hemi);
      var sun = new THREE.DirectionalLight(0xfff2cf, 2.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -130; sun.shadow.camera.right = 130;
      sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130;
      sun.shadow.camera.far = 420;
      sun.shadow.bias = -0.0004;
      scene.add(sun);
      scene.add(sun.target);
      this.hemi = hemi; this.sun = sun;
      // a few drifting clouds
      var cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9 });
      for (var i = 0; i < 9; i++) {
        var c = new THREE.Group();
        for (var j = 0; j < 4; j++) {
          var puff = new THREE.Mesh(new THREE.SphereGeometry(5 + Math.random() * 5, 10, 8), cloudMat);
          puff.position.set(j * 7 - 10 + Math.random() * 3, Math.random() * 2, Math.random() * 4 - 2);
          puff.scale.y = 0.45;
          c.add(puff);
        }
        c.position.set(-220 + Math.random() * 420, 62 + Math.random() * 18, -220 + Math.random() * 420);
        scene.add(c);
        this.clouds.push(c);
      }
      this.apply(scene, { x: 0, z: 0 });
      return this;
    },

    setTime: function (h, scene) {
      this.hour = ((h % 24) + 24) % 24;
      this.apply(scene, { x: 0, z: 0 });
    },

    apply: function (scene, focus) {
      var h = this.hour;
      // sun elevation: 1 at noon, 0 at 6:00/18:00, -1 at midnight
      var elev = Math.sin((h - 6) / 12 * Math.PI);
      var az = (h - 6) / 12 * Math.PI;
      var sunDir = {
        x: Math.cos(az) * 0.55,
        y: Math.max(0.08, elev),
        z: 0.35
      };
      var day = U.clamp(elev * 1.4 + 0.25, 0.06, 1);
      var warm = U.clamp(1 - Math.abs(elev) * 1.6, 0, 1); // golden near horizon
      var sky = new THREE.Color(0x8ec9ee).lerp(new THREE.Color(0xff9a52), warm * 0.55);
      sky.lerp(new THREE.Color(0x0a1626), (1 - day) * 0.9);
      scene.background = sky;
      scene.fog = new THREE.Fog(sky.getHex(), 180, 520);
      if (this.sun) {
        this.sun.position.set(focus.x + sunDir.x * 180, sunDir.y * 180 + 20, focus.z + sunDir.z * 180);
        this.sun.target.position.set(focus.x, 0, focus.z);
        this.sun.intensity = 0.25 + day * 2.4;
        this.sun.color.setHex(0xfff2cf).lerp(new THREE.Color(0xff8a3d), warm * 0.6);
      }
      if (this.hemi) this.hemi.intensity = 0.25 + day * 1.0;
    },

    update: function (dt, ctx) {
      if (!this.locked) this.hour = (this.hour + dt * this.rate) % 24;
      this.apply(ctx.scene, ctx.player);
      for (var i = 0; i < this.clouds.length; i++) {
        var c = this.clouds[i];
        c.position.x += dt * 1.2;
        if (c.position.x > 260) c.position.x = -260;
      }
    },

    clockText: function () {
      var h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
  };
})();
