// SOLARA BAY — procedural textures. Every texture is painted on a canvas at
// load time, so the game needs no image files and works fully offline.
(function () {
  'use strict';
  var SB = window.SB;

  function canvasTex(w, h, draw, repeatX, repeatY) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX || 1, repeatY || 1);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  SB.textures = {
    // Office / apartment face: coloured wall with a grid of lit windows.
    building: function (base, floors) {
      floors = floors || 6;
      return canvasTex(256, 256, function (g, w, h) {
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(0, h - 14, w, 14);
        var cols = 5, rows = floors;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var x = 14 + c * 46, y = 12 + r * (232 / rows);
            var lit = ((r * 7 + c * 3) % 5) < 3;
            g.fillStyle = lit ? '#bfe6ff' : '#2c3e50';
            g.fillRect(x, y, 30, 20);
            g.fillStyle = 'rgba(255,255,255,0.25)';
            g.fillRect(x, y, 30, 4);
          }
        }
      });
    },
    // Asphalt with a dashed centre line, tiled along the road.
    road: function () {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = '#3c4148'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        for (var i = 0; i < 40; i++) g.fillRect((i * 37) % w, (i * 53) % h, 3, 3);
        g.fillStyle = '#f5d90a';
        g.fillRect(w / 2 - 3, 8, 6, 34); g.fillRect(w / 2 - 3, 72, 6, 34);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
      }, 1, 6);
    },
    sidewalk: function () {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = '#9aa0a3'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
        g.strokeRect(4, 4, w - 8, h - 8);
        g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      }, 4, 4);
    },
    sand: function () {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = '#e8d29a'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(180,150,90,0.35)';
        for (var i = 0; i < 90; i++) g.fillRect((i * 41) % w, (i * 29) % h, 2, 2);
      }, 8, 8);
    },
    water: function () {
      return canvasTex(256, 256, function (g, w, h) {
        g.fillStyle = '#1f7fc4'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
        for (var i = 0; i < 9; i++) {
          g.beginPath();
          var y = 14 + i * 28;
          g.moveTo(0, y);
          for (var x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.09 + i) * 4);
          g.stroke();
        }
      }, 6, 6);
    },
    grass: function () {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = '#69b354'; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(40,110,40,0.4)';
        for (var i = 0; i < 120; i++) g.fillRect((i * 23) % w, (i * 31) % h, 2, 4);
        g.fillStyle = 'rgba(200,255,170,0.25)';
        for (var j = 0; j < 60; j++) g.fillRect((j * 47) % w, (j * 17) % h, 2, 2);
      }, 10, 10);
    },
    // Shop awning stripes in a given colour.
    awning: function (color) {
      return canvasTex(128, 64, function (g, w, h) {
        for (var i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#f5f2e8' : color;
          g.fillRect(i * 16, 0, 16, h);
        }
      }, 2, 1);
    },
    // Big bold sign text on a coloured board.
    sign: function (text, bg, fg) {
      var c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      var g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
      g.fillStyle = fg; g.font = 'bold 56px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 256, 68);
      var t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
  };
})();
