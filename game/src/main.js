// SOLARA BAY — boot, game loop, save games and the central event bus. The
// loop owns one context object (ctx) that every system reads each frame.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;
  var U = SB.util;

  SB.save = {
    key: 'solara-bay-save-v1',
    saveGame: function (ctx) {
      try {
        var p = ctx.player;
        localStorage.setItem(this.key, JSON.stringify({
          money: p.money, health: p.health, index: SB.missions.index,
          photoDone: SB.missions.photoTour.done,
          upgrades: p.upgrades, x: p.x, z: p.z, hour: SB.weather.hour
        }));
        return true;
      } catch (e) { return false; }
    },
    loadGame: function () {
      try {
        var raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clear: function () { try { localStorage.removeItem(this.key); } catch (e) {} },
    has: function () { return this.loadGame() !== null; }
  };

  SB.main = {
    state: 'title', // title | playing | paused | over
    ctx: null,
    _last: 0,
    _shootCd: 0,
    _prevHealth: 100,
    _titleAngle: 0,

    init: function () {
      window.__errors = [];
      window.addEventListener('error', function (e) { window.__errors.push(String(e.message)); });
      window.addEventListener('unhandledrejection', function (e) { window.__errors.push('rejection: ' + String(e.reason)); });

      var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      document.getElementById('app').appendChild(renderer.domElement);

      var scene = new THREE.Scene();
      scene.background = new THREE.Color(cfg.palette.sky);
      var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
      camera.position.set(0, 90, 190);

      var ctx = {
        scene: scene, camera: camera, renderer: renderer,
        time: 0, dt: 0, input: SB.input, player: SB.player,
        wanted: 0, shooting: false, modalOpen: false,
        cameraYaw: Math.PI, cameraPitch: -0.32, cameraDist: 10,
        shotCam: null,
        onEvent: function (name, data) { SB.main.onEvent(name, data); }
      };
      window.__SB_CTX = ctx;
      this.ctx = ctx;

      SB.world.build(scene);
      SB.weather.init(scene);
      SB.player.create(scene);
      SB.combat.init(scene);
      SB.missions.init(scene);
      this._spawnParked(scene);
      SB.vehicles.spawnTraffic(scene, 14);
      SB.people.spawnCrowd(scene, 42);
      SB.hud.init();
      SB.input.init(renderer.domElement);
      SB.shots.setup(ctx);
      if (SB.input.shot) {
        // screenshot mode: skip the title screen, play at once
        this.state = 'playing';
        SB.hud.showGame();
        if (!SB.missions.active && SB.missions.index < cfg.missions.length) {
          // shots that did not start a mission yet get the first one
          if (SB.input.shot === 'city' || SB.input.shot === 'harbor') SB.missions.startNext(ctx);
        }
      } else {
        SB.hud.showTitle(SB.save.has());
      }
      SB.hud.cb = {
        start: function () { SB.main.startRun(false); },
        continueGame: function () { SB.main.startRun(true); },
        resume: function () { SB.main.setPaused(false); },
        save: function () { SB.save.saveGame(ctx); SB.hud.toast('Game saved.'); },
        restart: function () { SB.save.clear(); window.location.reload(); },
        quitToTitle: function () { SB.main.state = 'title'; SB.hud.showTitle(SB.save.has()); },
        respawn: function () { SB.main.respawn(); },
        closeShop: function () { SB.hud.closeModals(); ctx.modalOpen = false; SB.main.setPaused(false); }
      };
      window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
      this._last = performance.now();
      var self = this;
      renderer.setAnimationLoop(function (t) { self.loop(t); });
    },

    _spawnParked: function (scene) {
      var rnd = U.rng(4242);
      var types = ['sedan', 'taxi', 'pickup', 'sports', 'van'];
      var spots = [
        [180, -40, 0], [180, 90, 0], [-60, -140, Math.PI / 2], [60, 140, -Math.PI / 2],
        [0, -120, Math.PI / 2], [-120, 40, 0], [120, -20, Math.PI], [-180, -90, 0]
      ];
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i];
        var car = SB.vehicles.createCar(types[i % types.length], cfg.palette.car[Math.floor(rnd() * cfg.palette.car.length)]);
        SB.vehicles.add(scene, car, s[0], s[1], s[2]);
      }
    },

    startRun: function (useSave) {
      var ctx = this.ctx;
      SB.audio.init();
      if (useSave) {
        var s = SB.save.loadGame();
        if (s) {
          var p = ctx.player;
          p.money = s.money; p.health = s.health;
          p.upgrades = s.upgrades || p.upgrades;
          p.x = s.x; p.z = s.z;
          SB.missions.index = s.index || 0;
          SB.missions.photoTour.done = s.photoDone || {};
          SB.missions.photoTour.count = Object.keys(SB.missions.photoTour.done).length;
          if (s.hour) SB.weather.setTime(s.hour, ctx.scene);
          p.group.position.set(p.x, 0, p.z);
        }
      } else {
        SB.missions.reset();
        SB.police.reset();
      }
      this.state = 'playing';
      SB.hud.showGame();
      if (!SB.missions.active && SB.missions.index < cfg.missions.length) SB.missions.startNext(ctx);
      SB.hud.toast('Welcome to Solara Bay. Follow the yellow beacon.');
    },

    setPaused: function (on) {
      if (this.state !== 'playing' && this.state !== 'paused') return;
      if (on) { this.state = 'paused'; SB.hud.showPause(true); }
      else {
        if (this.ctx.modalOpen) return;
        this.state = 'playing'; SB.hud.showPause(false);
      }
    },

    respawn: function () {
      var ctx = this.ctx;
      var p = ctx.player;
      SB.police.reset();
      SB.combat.clearGuards(ctx.scene);
      p.reset();
      p.money = Math.max(0, p.money - 100);
      p.x = cfg.places.safehouse.x; p.z = cfg.places.safehouse.z;
      p.group.position.set(p.x, 0, p.z);
      SB.missions.restartCurrent(ctx);
      SB.hud.hideOver();
      SB.hud.showGame();
      this.state = 'playing';
      SB.hud.toast('You wake up at the safehouse. $100 hospital fee. The city is still yours to take.');
    },

    onEvent: function (name, data) {
      var ctx = this.ctx;
      var p = ctx.player;
      data = data || {};
      if (name === 'crime') {
        SB.police.addWanted(data.amount || 1, ctx);
        if (data.kind === 'steal') SB.hud.toast('Car stolen — the law noticed.');
      } else if (name === 'wanted') {
        ctx.wanted = data.wanted;
        if (data.wanted > 0) { SB.audio.wantedUp(); SB.hud.toast('Wanted level ' + data.wanted + ' — lose the heat!'); }
      } else if (name === 'shotFired') {
        SB.audio.shot(data.weapon === 'rifle');
        ctx.shooting = true;
      } else if (name === 'dryFire') {
        SB.audio.dryClick(); SB.hud.toast('Out of ammo — buy more at Ammu-Nation.');
      } else if (name === 'guardDown') {
        SB.audio.pickup();
        SB.missions.onGuardDown(ctx);
      } else if (name === 'guardHit') {
        SB.audio.click();
      } else if (name === 'copDown') {
        SB.hud.toast('Cop down. That will not help your wanted level.');
      } else if (name === 'pedDown') {
        SB.hud.toast('A bystander is down. The city saw that.');
      } else if (name === 'missionStart') {
        SB.hud.subtitle(data.mission.line, 6);
        SB.hud.toast('Mission ' + data.mission.id + ': ' + data.mission.title);
      } else if (name === 'missionDone') {
        SB.audio.missionDone();
        SB.hud.toast('Mission complete! +' + U.fmtMoney(data.mission.reward));
        SB.hud.subtitle('Mission complete — ' + data.mission.title + '  •  +' + U.fmtMoney(data.mission.reward), 5);
      } else if (name === 'missionFail') {
        SB.hud.toast(data.reason + ' — mission restarts.');
      } else if (name === 'storyDone') {
        SB.audio.missionDone();
        SB.hud.subtitle('Solara Bay is yours, Dax. Kessler is finished — free roam the city you took back.', 8);
        SB.hud.toast('STORY COMPLETE — Solara Bay is yours!');
      } else if (name === 'pickedUp') {
        SB.audio.pickup(); SB.hud.toast('Package secured. Deliver it!');
      } else if (name === 'photoTour') {
        SB.audio.pickup();
        SB.hud.toast('Photo Tour: ' + data.spot.name + ' (' + data.count + '/6)  +$150');
      } else if (name === 'photoMission') {
        SB.audio.pickup();
        SB.hud.toast('Photo taken: ' + data.spot.name + ' (' + data.count + '/3)');
      } else if (name === 'photoMiss') {
        SB.hud.toast('No landmark in frame — stand in a yellow photo zone and press Q.');
      } else if (name === 'bought') {
        SB.hud.toast('Bought ' + data.item.name + '.');
      } else if (name === 'rested') {
        SB.audio.heal();
        SB.hud.toast('Rested at the safehouse. Health restored, game saved.');
      } else if (name === 'heli') {
        if (data.active) SB.hud.toast('Air support is overhead — lose the heli!');
      } else if (name === 'radio') {
        SB.hud.toast(data.station ? ('Radio: ' + data.station.name) : 'Radio off.');
      } else if (name === 'track') {
        SB.hud.toast('♪ Now playing: ' + data.name);
      } else if (name === 'talk') {
        SB.hud.subtitle(data.line, 6);
      } else if (name === 'ramHit') {
        SB.audio.crash();
        SB.hud.toast("Kessler's car is taking damage — " + Math.max(0, Math.round(data.health)) + '% left!');
      } else if (name === 'copShot' || name === 'guardShot') {
        SB.audio.shot(false);
        SB.hud.damageFlash();
      } else if (name === 'enteredCar') {
        SB.audio.click();
      } else if (name === 'exitedCar') {
        SB.audio.click();
      } else if (name === 'carDestroyed') {
        SB.audio.crash();
        if (p.inCar === data.car) {
          p.inCar = null; data.car.driver = null;
          p.x = data.car.x + 3; p.z = data.car.z + 3;
          p.group.visible = true;
        }
        SB.vehicles.remove(ctx.scene, data.car);
        SB.hud.toast('Your car was destroyed!');
        SB.police.addWanted(1, ctx);
      } else if (name === 'died') {
        this.state = 'over';
        SB.hud.showOver('WASTED', 'The Bay got the better of Dax this time. Hospital fee $100 — the safehouse is waiting.');
      } else if (name === 'interact') {
        var zone = SB.economy.zoneAt(data.x, data.z);
        if (!zone) { SB.hud.toast('Nothing here. Follow the yellow beacon.'); return; }
        if (zone.kind === 'shop') {
          ctx.modalOpen = true; this.setPaused(true);
          SB.hud.openShop(zone.shop, p.money);
        } else if (zone.kind === 'garage') {
          ctx.modalOpen = true; this.setPaused(true);
          SB.hud.openGarage(p.money);
        } else if (zone.kind === 'safehouse') {
          SB.economy.rest(ctx);
        } else if (zone.kind === 'marina') {
          SB.hud.toast('The marina. Boats, deals, and Kessler men — best visited on a mission.');
        }
      }
    },

    loop: function (t) {
      // endFrame must run even if a system throws mid-frame, or a stale
      // pressed key re-fires next frame (that once re-entered a car the
      // player had just exited). The tick does the work; this wrapper owns
      // the input bookkeeping.
      try { this._tick(t); }
      catch (e) {
        window.__errors.push(String(e && e.message || e));
      } finally {
        this.ctx.input.endFrame();
      }
    },

    _tick: function (t) {
      var ctx = this.ctx;
      var dt = Math.min(0.05, Math.max(0.001, (t - this._last) / 1000));
      this._last = t;
      var input = ctx.input;

      if (this.state === 'title') {
        // slow aerial orbit behind the title screen
        this._titleAngle += dt * 0.04;
        var cx = Math.sin(this._titleAngle) * 190, cz = Math.cos(this._titleAngle) * 190;
        ctx.camera.position.set(cx, 95, cz);
        ctx.camera.lookAt(40, 0, -20);
        SB.weather.update(dt, ctx);
        SB.vehicles.update(dt, ctx);
        SB.people.update(dt, ctx);
        ctx.renderer.render(ctx.scene, ctx.camera);
        input.endFrame();
        return;
      }

      // pause toggle (Esc or P)
      if (input.pressed.has('Escape') || input.pressed.has('KeyP')) {
        if (this.state === 'playing') this.setPaused(true);
        else if (this.state === 'paused' && !ctx.modalOpen) this.setPaused(false);
      }
      if (this.state === 'paused' || this.state === 'over') {
        ctx.renderer.render(ctx.scene, ctx.camera);
        input.endFrame();
        return;
      }

      // ---- playing ----
      ctx.dt = dt;
      ctx.time += dt;
      ctx.shooting = false;
      ctx.wanted = SB.police.wanted;

      // camera orbit from mouse drag
      ctx.cameraYaw -= input.mouseDX * 0.0042;
      ctx.cameraPitch = U.clamp(ctx.cameraPitch + input.mouseDY * 0.0022, -0.62, -0.08);
      ctx.cameraDist = U.clamp(ctx.cameraDist + input.wheel * 0.01, 6.5, 17);

      var p = ctx.player;
      if (input.pressed.has('KeyQ')) SB.missions.tryPhoto(ctx);
      if (input.pressed.has(cfg.keys.radio)) SB.radio.next(ctx);
      if (input.pressed.has('Digit1')) SB.radio.setStation(0, ctx);
      if (input.pressed.has('Digit2')) SB.radio.setStation(1, ctx);
      if (input.pressed.has('Digit3')) SB.radio.setStation(2, ctx);

      SB.weather.update(dt, ctx);
      SB.radio.update(dt, ctx);
      SB.vehicles.update(dt, ctx);
      SB.people.update(dt, ctx);
      if (p.inCar) {
        SB.vehicles.drive(p.inCar, input, dt, SB.world);
        p.update(dt, ctx);
        // camera follows the car's heading — but p.update may have exited
        // the car (E), so re-check before touching the car.
        if (p.inCar) {
          var diff = p.inCar.angle - ctx.cameraYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ctx.cameraYaw += diff * Math.min(1, dt * 1.4);
        }
      } else {
        p.update(dt, ctx);
        this._shootCd -= dt;
        if (input.shootHeld && this._shootCd <= 0) {
          this._shootCd = p.weapon === 'rifle' ? 0.15 : 0.3;
          SB.combat.tryShoot(ctx);
        }
      }
      SB.police.update(dt, ctx);
      SB.heli.update(dt, ctx);
      SB.combat.update(dt, ctx);
      SB.missions.update(dt, ctx);
      SB.audio.update(dt, ctx);
      SB.shots.update(dt, ctx);

      // damage flash on health loss
      if (p.health < this._prevHealth) SB.hud.damageFlash();
      this._prevHealth = p.health;

      // contextual hint
      var hint = '';
      if (!p.inCar && !p.dead) {
        var nearCar = SB.vehicles.nearestCar(p.x, p.z, 4.5);
        var zone = SB.economy.zoneAt(p.x, p.z);
        var spot = null;
        for (var i = 0; i < cfg.photoSpots.length; i++) {
          var s = cfg.photoSpots[i];
          if (!SB.missions.photoTour.done[s.id] && U.dist2(p.x, p.z, s.x, s.z) < s.r * s.r) { spot = s; break; }
        }
        if (zone && zone.kind === 'shop') hint = 'Press E — ' + zone.shop.name;
        else if (zone && zone.kind === 'garage') hint = 'Press E — Sunset Garage (upgrades)';
        else if (zone && zone.kind === 'safehouse') hint = 'Press E — Rest & save';
        else if (spot) hint = 'Press Q — photograph ' + spot.name;
        else if (nearCar) hint = 'Press E — take the ' + nearCar.type;
      }
      SB.hud.setHint(hint);

      // ---- camera ----
      var target = p.inCar ? p.inCar : p;
      if (ctx.shotCam) {
        ctx.camera.position.set(ctx.shotCam.pos.x, ctx.shotCam.pos.y, ctx.shotCam.pos.z);
        ctx.camera.lookAt(ctx.shotCam.look.x, ctx.shotCam.look.y, ctx.shotCam.look.z);
      } else {
        var fx = Math.sin(ctx.cameraYaw), fz = Math.cos(ctx.cameraYaw);
        var dist = p.inCar ? ctx.cameraDist + 2.5 : ctx.cameraDist;
        var height = 3.2 + dist * 0.32;
        var cx2 = target.x - fx * dist, cz2 = target.z - fz * dist;
        var cy2 = height;
        var k = 1 - Math.exp(-dt * 7);
        ctx.camera.position.x += (cx2 - ctx.camera.position.x) * k;
        ctx.camera.position.y += (cy2 - ctx.camera.position.y) * k;
        ctx.camera.position.z += (cz2 - ctx.camera.position.z) * k;
        ctx.camera.lookAt(target.x + fx * 4, 1.6, target.z + fz * 4);
      }

      SB.hud.update(ctx);
      ctx.renderer.render(ctx.scene, ctx.camera);
      input.endFrame();
    }
  };
})();
