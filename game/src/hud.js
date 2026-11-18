// SOLARA BAY — HUD and menus. DOM overlay: dense HUD (minimap, stars, money,
// mission panel, radio, speed, health, ammo), toasts, subtitles, and the
// title / pause / game-over / shop / garage screens.
(function () {
  'use strict';
  var SB = window.SB;
  var U = SB.util;

  function el(id) { return document.getElementById(id); }
  function show(id, on) { var n = el(id); if (n) n.style.display = on ? 'flex' : 'none'; }

  SB.hud = {
    cb: {},
    _toastT: 0,
    _subT: 0,
    _flashT: 0,
    _map: null,

    init: function () {
      this._map = el('minimap');
      // NOTE: read SB.hud.cb at click time, not here — main.js assigns the
      // callbacks after init(), so capturing the object now would keep the
      // empty placeholder forever and every menu button would do nothing.
      var bind = function (id, fn) { var n = el(id); if (n) n.addEventListener('click', function () { SB.audio.click(); fn(); }); };
      bind('btn-start', function () { var c = SB.hud.cb; if (c.start) c.start(); });
      bind('btn-continue', function () { var c = SB.hud.cb; if (c.continueGame) c.continueGame(); });
      bind('btn-resume', function () { var c = SB.hud.cb; if (c.resume) c.resume(); });
      bind('btn-save', function () { var c = SB.hud.cb; if (c.save) c.save(); });
      bind('btn-restart', function () { var c = SB.hud.cb; if (c.restart) c.restart(); });
      bind('btn-quit-title', function () { var c = SB.hud.cb; if (c.quitToTitle) c.quitToTitle(); });
      bind('btn-respawn', function () { var c = SB.hud.cb; if (c.respawn) c.respawn(); });
      bind('shop-close', function () { var c = SB.hud.cb; if (c.closeShop) c.closeShop(); });
      bind('garage-close', function () { var c = SB.hud.cb; if (c.closeShop) c.closeShop(); });
    },

    showTitle: function (hasSave) {
      show('screen-title', true); show('screen-pause', false); show('screen-over', false);
      show('hud', false);
      var c = el('btn-continue');
      if (c) c.style.display = hasSave ? 'block' : 'none';
    },
    showGame: function () {
      show('screen-title', false); show('screen-pause', false); show('screen-over', false);
      show('hud', true);
    },
    showPause: function (on) { show('screen-pause', on); },
    showOver: function (title, text) {
      show('screen-over', true);
      var t = el('over-title'); if (t) t.textContent = title;
      var x = el('over-text'); if (x) x.textContent = text;
    },
    hideOver: function () { show('screen-over', false); },

    toast: function (msg) {
      var n = el('hud-toast');
      if (!n) return;
      n.textContent = msg;
      n.style.opacity = '1';
      this._toastT = 3.2;
    },
    subtitle: function (text, dur) {
      var n = el('hud-subtitle');
      if (!n) return;
      n.textContent = text;
      n.style.opacity = '1';
      this._subT = dur || 4.5;
    },
    damageFlash: function () { this._flashT = 0.35; },
    setHint: function (text) {
      var n = el('hud-hint');
      if (!n) return;
      if (text) { n.textContent = text; n.style.opacity = '1'; }
      else n.style.opacity = '0';
    },

    openShop: function (shop, money) {
      var items = SB.economy.itemsFor(shop);
      var title = el('shop-title');
      if (title) title.textContent = shop ? shop.name : 'Shop';
      var list = el('shop-items');
      if (list) {
        list.innerHTML = '';
        items.forEach(function (it) {
          var row = document.createElement('div');
          row.className = 'shop-row';
          row.innerHTML = '<div><b>' + it.name + '</b><span>' + it.desc + '</span></div><button data-id="' + it.id + '">' + U.fmtMoney(it.price) + '</button>';
          row.querySelector('button').addEventListener('click', function () {
            var r = SB.economy.buy(it.id, window.__SB_CTX);
            var f = el('shop-msg');
            if (f) f.textContent = r.msg;
            if (r.ok) { SB.audio.pickup(); var m = el('shop-money'); if (m) m.textContent = U.fmtMoney(window.__SB_CTX.player.money); }
          });
          list.appendChild(row);
        });
      }
      var m = el('shop-money'); if (m) m.textContent = U.fmtMoney(money);
      var f = el('shop-msg'); if (f) f.textContent = '';
      show('modal-shop', true);
    },

    openGarage: function (money) {
      var list = el('garage-items');
      if (list) {
        list.innerHTML = '';
        SB.cfg.economy.garageUpgrades.forEach(function (up) {
          var row = document.createElement('div');
          row.className = 'shop-row';
          row.innerHTML = '<div><b>' + up.name + '</b><span>' + up.desc + '</span></div><button data-id="' + up.id + '">' + U.fmtMoney(up.price) + '</button>';
          row.querySelector('button').addEventListener('click', function () {
            var r = SB.economy.buyUpgrade(up.id, window.__SB_CTX);
            var f = el('garage-msg');
            if (f) f.textContent = r.msg;
            if (r.ok) { SB.audio.pickup(); var m = el('garage-money'); if (m) m.textContent = U.fmtMoney(window.__SB_CTX.player.money); }
          });
          list.appendChild(row);
        });
      }
      var m = el('garage-money'); if (m) m.textContent = U.fmtMoney(money);
      var f = el('garage-msg'); if (f) f.textContent = '';
      show('modal-garage', true);
    },

    closeModals: function () { show('modal-shop', false); show('modal-garage', false); },

    _objectiveText: function (ctx) {
      var st = SB.missions.active;
      if (!st) {
        if (SB.missions.done >= SB.cfg.missions.length) return 'Story complete — free roam Solara Bay!';
        return 'Press ENTER or wait — next mission incoming…';
      }
      var def = st.def;
      if (def.type === 'tail') return 'Tail the blue courier: ' + Math.floor(st.tailT) + 's / 20s — stay close, stay quiet.';
      if (def.type === 'shoot') return 'Guards left: ' + st.guardsLeft;
      if (def.type === 'photo') return 'Photos taken: ' + st.photos + ' / 3';
      if (def.type === 'deliver') return st.stage === 0 ? 'Pick up the package.' : 'Deliver it — do not lose it.';
      if (def.type === 'chase') return 'Kessler car integrity: ' + Math.max(0, Math.round(st.kessler ? st.kessler.health : 0)) + '% — ram it!';
      if (def.type === 'escape') return 'Lose the heat — reach the safehouse!';
      if (def.type === 'drive') return 'Drive to Sunset Garage.';
      return def.brief;
    },

    update: function (ctx) {
      var p = ctx.player;
      if (this._toastT > 0) {
        this._toastT -= ctx.dt;
        if (this._toastT <= 0) { var t = el('hud-toast'); if (t) t.style.opacity = '0'; }
      }
      if (this._subT > 0) {
        this._subT -= ctx.dt;
        if (this._subT <= 0) { var s = el('hud-subtitle'); if (s) s.style.opacity = '0'; }
      }
      if (this._flashT > 0) {
        this._flashT -= ctx.dt;
        var v = el('hud-vignette');
        if (v) v.style.opacity = String(Math.max(0, this._flashT * 1.6));
      }
      var set = function (id, txt) { var n = el(id); if (n) n.textContent = txt; };
      set('hud-money', U.fmtMoney(p.money));
      set('hud-clock', SB.weather.clockText());
      set('hud-radio', SB.radio.label());
      set('hud-ammo', p.weapon === 'rifle' ? 'RIFLE ' + p.ammoRifle : 'PISTOL ' + p.ammoPistol);
      set('hud-health-text', Math.ceil(p.health) + ' HP' + (p.armor ? ' • VEST' : ''));
      var hf = el('health-fill');
      if (hf) { hf.style.width = Math.max(0, p.health) + '%'; hf.style.background = p.health > 50 ? '#37b268' : (p.health > 25 ? '#f2c230' : '#d23b2e'); }
      var speed = p.inCar ? Math.abs(p.inCar.speed) * 3.6 : (Math.abs(p.vx) + Math.abs(p.vz) > 0.1 ? 14 : 0);
      set('hud-speed', Math.round(speed) + ' km/h');
      var stars = '';
      for (var i = 0; i < 5; i++) stars += i < SB.police.wanted ? '★' : '☆';
      set('hud-wanted', stars);
      var ch = el('crosshair');
      if (ch) ch.style.display = (!p.inCar && !p.dead) ? 'block' : 'none';
      // mission panel
      var st = SB.missions.active;
      set('mission-title', st ? ('MISSION ' + st.def.id + ' — ' + st.def.title) : (SB.missions.done >= 10 ? 'STORY COMPLETE' : 'SOLARA BAY'));
      set('mission-brief', st ? st.def.brief : 'Free roam. Visit the safehouse to save, shops to gear up.');
      set('mission-objective', this._objectiveText(ctx));
      set('hud-photos', '📷 Photo Tour ' + SB.missions.photoTour.count + '/6  •  Missions ' + SB.missions.done + '/10');
      this._drawMinimap(ctx);
    },

    _drawMinimap: function (ctx) {
      var cv = this._map;
      if (!cv) return;
      var g = cv.getContext('2d');
      var S = cv.width, half = 240, sc = S / (half * 2);
      var X = function (x) { return (x + half) * sc; };
      var Z = function (z) { return (z + half) * sc; };
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#69b354'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#e8d29a'; g.fillRect(X(200), 0, S - X(200), S);
      g.fillStyle = '#1f7fc4'; g.fillRect(X(244), 0, S - X(244), S);
      g.strokeStyle = '#3c4148'; g.lineWidth = 4;
      SB.cfg.world.roads.forEach(function (r) {
        g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), S); g.stroke();
        g.beginPath(); g.moveTo(0, Z(r)); g.lineTo(S, Z(r)); g.stroke();
      });
      var dot = function (x, z, color, r) {
        g.fillStyle = color;
        g.beginPath(); g.arc(X(x), Z(z), r || 3, 0, Math.PI * 2); g.fill();
      };
      SB.cfg.places.shops.forEach(function (s) { dot(s.x, s.z, '#2fae5f', 3.5); });
      dot(SB.cfg.places.safehouse.x, SB.cfg.places.safehouse.z, '#2e6fd2', 4);
      dot(SB.cfg.places.garage.x, SB.cfg.places.garage.z, '#f2c230', 3.5);
      SB.cfg.photoSpots.forEach(function (s) {
        if (!SB.missions.photoTour.done[s.id]) dot(s.x, s.z, '#ffffff', 2);
      });
      var st = SB.missions.active;
      if (st && st.target) {
        var pulse = 4 + Math.sin(ctx.time * 5) * 1.5;
        dot(st.target.x, st.target.z, '#ffd21f', pulse);
      }
      SB.vehicles.traffic.forEach(function (c) { dot(c.x, c.z, '#c8c8c8', 2); });
      SB.police.copCars.forEach(function (c) { dot(c.x, c.z, '#2e6fff', 3); });
      var hp = SB.heli.position();
      if (hp) dot(hp.x, hp.z, '#ff2e2e', 3.5);
      var p = ctx.player;
      g.save();
      g.translate(X(p.x), Z(p.z));
      g.rotate(-p.angle);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
      g.restore();
    }
  };
})();
