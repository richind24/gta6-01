// SOLARA BAY — screenshot mode. ?shot=cover|mission|city|harbor stages a
// bright-noon scene with the HUD on, then flags window.__shotReady so the
// screenshot driver knows the frame is settled.
(function () {
  'use strict';
  var SB = window.SB;

  SB.shots = {
    mode: null,
    frames: 0,
    ready: false,

    setup: function (ctx) {
      var mode = SB.input.shot;
      if (!mode) return;
      this.mode = mode;
      SB.weather.locked = true;
      SB.weather.setTime(12, ctx.scene);
      var p = ctx.player;
      if (mode === 'cover') {
        // Mission 7, Hot Pursuit: Dax in a red sports car on the beach road,
        // three stars, heli up, cops closing in — the cover moment.
        SB.missions.index = 6;
        SB.missions.startNext(ctx);
        var car = SB.vehicles.createCar('sports', 0xd23b2e);
        SB.vehicles.add(ctx.scene, car, 180, 20, 0.15);
        p.inCar = car; car.driver = 'player';
        p.x = car.x; p.z = car.z;
        p.money = 1250; p.health = 82;
        p.weapon = 'rifle'; p.ammoRifle = 24;
        ctx.cameraYaw = 0.15;
        // Camera pulled back and up, tilted slightly up so the frame holds
        // both the sports car below and the police heli (42 m up) above it.
        ctx.shotCam = {
          pos: { x: 168, y: 12, z: -8 },
          look: { x: 183, y: 13, z: 30 }
        };
        SB.radio.setStation(0, ctx);
        SB.police.setWanted(3, ctx);
      } else if (mode === 'mission') {
        // Mission 6, Rooftop Rifle: Dax on foot at the warehouse, rifle ready.
        SB.missions.index = 5;
        SB.missions.startNext(ctx);
        p.x = -180; p.z = 92; p.angle = 0;
        p.weapon = 'rifle'; p.ammoRifle = 30;
        p.money = 640; p.health = 100;
        ctx.cameraYaw = 0;
        ctx.shotCam = {
          pos: { x: -180, y: 6.5, z: 76 },
          look: { x: -182, y: 2, z: 118 }
        };
        SB.police.setWanted(1, ctx);
      } else if (mode === 'city') {
        // Aerial postcard: beach, ocean, skyline at noon.
        p.x = 0; p.z = -10; p.angle = Math.PI;
        p.money = 250;
        ctx.shotCam = {
          pos: { x: 40, y: 150, z: 190 },
          look: { x: 60, y: 0, z: -40 }
        };
      } else if (mode === 'harbor') {
        // The marina on the east shore: Dax on the sand by the pier roots,
        // boats moored in the ocean ahead of him. Camera high and pulled
        // back west so no beach palm stands between it and Dax.
        p.x = 216; p.z = 60; p.angle = Math.PI / 2;
        p.money = 880;
        ctx.cameraYaw = Math.PI / 2;
        ctx.shotCam = {
          pos: { x: 185, y: 12, z: 42 },
          look: { x: 238, y: 0, z: 64 }
        };
        SB.police.setWanted(1, ctx);
      }
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = -p.angle;
    },

    update: function (dt, ctx) {
      if (!this.mode || this.ready) return;
      this.frames++;
      // Cover: pin the heli's orbit bearing so it stays in the camera's
      // upper frame (ahead-right of the car) instead of drifting behind the
      // camera. Staging only — the orbit, rotor and searchlight run normally.
      if (this.mode === 'cover' && SB.heli.active) SB.heli.angle = 0.38;
      // Cover: pin the player's car too. It sits on the beach road where
      // traffic flows, and a traffic car ramming it from behind shoves it
      // ~30 m up the road during the staging frames, dragging the heli
      // (which orbits the player) out of frame with it.
      if (this.mode === 'cover' && ctx.player.inCar) {
        var pc = ctx.player.inCar;
        pc.x = 180; pc.z = 20; pc.angle = 0.15; pc.speed = 0;
        pc.group.position.set(180, 0, 20);
        pc.group.rotation.y = -0.15;
      }
      // Mission + harbor: guards (mission 6) and the wanted-1 foot cop
      // (harbor) shoot Dax during the staging frames; keep him at full
      // health so the shot reads as a live scene, not a near-death.
      if (this.mode === 'mission' || this.mode === 'harbor') ctx.player.health = 100;
      if (this.frames >= 100) {
        this.ready = true;
        window.__shotReady = true;
        window.__shotInfo = { mode: this.mode, frames: this.frames, wanted: SB.police.wanted };
        document.title = 'SHOT_READY';
      }
    }
  };
})();
