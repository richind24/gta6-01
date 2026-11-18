// SOLARA BAY — keyboard and mouse. Held keys live in `keys`, edge presses
// in `pressed` (cleared once per frame by the main loop). Dragging with the
// mouse orbits the camera; the wheel zooms.
(function () {
  'use strict';
  var SB = window.SB;

  SB.input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDX: 0, mouseDY: 0, wheel: 0,
    shootHeld: false, dragging: false,
    query: new URLSearchParams(window.location.search),
    shot: null,

    init: function (canvas) {
      this.shot = this.query.get('shot');
      var self = this;
      window.addEventListener('keydown', function (e) {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
        if (!e.repeat) self.pressed.add(e.code);
        self.keys.add(e.code);
        if (e.code === 'KeyM') SB.audio.setMuted(!SB.audio.muted);
      });
      window.addEventListener('keyup', function (e) { self.keys.delete(e.code); });
      window.addEventListener('blur', function () { self.keys.clear(); self.shootHeld = false; });
      canvas.addEventListener('mousedown', function (e) {
        if (e.button === 0) { self.shootHeld = true; self.dragging = true; }
      });
      window.addEventListener('mouseup', function (e) {
        if (e.button === 0) { self.shootHeld = false; self.dragging = false; }
      });
      window.addEventListener('mousemove', function (e) {
        if (!self.dragging) return;
        self.mouseDX += e.movementX || 0;
        self.mouseDY += e.movementY || 0;
      });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        self.wheel += e.deltaY;
      }, { passive: false });
      // first gesture unlocks audio
      var unlock = function () { SB.audio.init(); };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    },

    endFrame: function () {
      this.pressed.clear();
      this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    }
  };
})();
