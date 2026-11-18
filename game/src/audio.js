// SOLARA BAY — sound. Everything is synthesized with WebAudio: engine hum,
// sirens, gunshots, UI blips and two procedural radio stations. No audio
// files, no network. All calls are safe before the first user gesture.
(function () {
  'use strict';
  var SB = window.SB;

  SB.audio = {
    ctx: null, master: null, musicBus: null, sfxBus: null,
    muted: false, _engine: null, _siren: null, _sirenT: 0,
    _heli: null, _step: 0, _nextNote: 0, _bar: 0,

    init: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.32;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);
        // engine: two detuned saws through a lowpass
        var eng = this.ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 55;
        var eng2 = this.ctx.createOscillator(); eng2.type = 'square'; eng2.frequency.value = 28;
        var lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        var eg = this.ctx.createGain(); eg.gain.value = 0;
        eng.connect(lp); eng2.connect(lp); lp.connect(eg); eg.connect(this.sfxBus);
        eng.start(); eng2.start();
        this._engine = { o1: eng, o2: eng2, g: eg };
        // siren: one triangle that alternates pitch
        var sir = this.ctx.createOscillator(); sir.type = 'triangle'; sir.frequency.value = 750;
        var sg = this.ctx.createGain(); sg.gain.value = 0;
        sir.connect(sg); sg.connect(this.sfxBus);
        sir.start();
        this._siren = { o: sir, g: sg };
        // heli rotor: looped noise through a lowpass
        var len = this.ctx.sampleRate * 1;
        var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        var src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        var hp = this.ctx.createBiquadFilter(); hp.type = 'lowpass'; hp.frequency.value = 240;
        var hg = this.ctx.createGain(); hg.gain.value = 0;
        src.connect(hp); hp.connect(hg); hg.connect(this.sfxBus);
        src.start();
        this._heli = { g: hg };
      } catch (e) { this.ctx = null; }
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.55;
    },

    _note: function (freq, when, dur, type, vol, bus) {
      if (!this.ctx) return;
      var o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol || 0.2, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g); g.connect(bus || this.musicBus);
      o.start(when); o.stop(when + dur + 0.05);
    },

    _noise: function (when, dur, vol, freq) {
      if (!this.ctx) return;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource(); src.buffer = buf;
      var f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(this.sfxBus);
      src.start(when);
    },

    // --- SFX ---
    shot: function (rifle) {
      if (!this.ctx) return;
      this._noise(this.ctx.currentTime, 0.16, rifle ? 0.5 : 0.35, 900);
      this._note(160, this.ctx.currentTime, 0.12, 'square', 0.25, this.sfxBus);
    },
    dryClick: function () { if (this.ctx) this._note(1200, this.ctx.currentTime, 0.05, 'square', 0.12, this.sfxBus); },
    pickup: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this._note(660, t, 0.12, 'sine', 0.25, this.sfxBus);
      this._note(990, t + 0.09, 0.18, 'sine', 0.25, this.sfxBus);
    },
    click: function () { if (this.ctx) this._note(880, this.ctx.currentTime, 0.06, 'sine', 0.15, this.sfxBus); },
    crash: function () { if (this.ctx) this._noise(this.ctx.currentTime, 0.3, 0.5, 300); },
    heal: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this._note(523, t, 0.14, 'sine', 0.22, this.sfxBus);
      this._note(784, t + 0.12, 0.2, 'sine', 0.22, this.sfxBus);
    },
    missionDone: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      var seq = [523, 659, 784, 1047];
      for (var i = 0; i < seq.length; i++) this._note(seq[i], t + i * 0.11, 0.22, 'triangle', 0.25, this.sfxBus);
    },
    wantedUp: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this._note(220, t, 0.18, 'sawtooth', 0.2, this.sfxBus);
      this._note(185, t + 0.16, 0.24, 'sawtooth', 0.2, this.sfxBus);
    },

    // --- continuous layers, called every frame ---
    update: function (dt, ctx) {
      if (!this.ctx) return;
      var car = ctx.player.inCar;
      if (this._engine) {
        var speed = car ? Math.abs(car.speed) : 0;
        var on = !!car && speed > 0.5;
        this._engine.g.gain.value = on ? 0.05 + speed * 0.0012 : 0;
        this._engine.o1.frequency.value = 42 + speed * 3.2;
        this._engine.o2.frequency.value = 21 + speed * 1.6;
      }
      if (this._siren) {
        this._sirenT -= dt;
        if (this._sirenT <= 0) {
          this._sirenT = 0.45;
          var hi = this._siren.o.frequency.value < 850;
          this._siren.o.frequency.value = hi ? 950 : 700;
        }
        this._siren.g.gain.value = ctx.wanted > 0 ? 0.035 : 0;
      }
      if (this._heli) {
        this._heli.g.gain.value = SB.heli.active ? 0.05 : 0;
      }
    },

    // --- procedural radio: a 16-step sequencer per station ---
    playStation: function (st, dt) {
      if (!this.ctx) return;
      var now = this.ctx.currentTime;
      if (this._nextNote < now - 0.05) this._nextNote = now + 0.05;
      var spb = 60 / st.bpm / 4; // 16th note
      var minor = st.minor;
      var root = 220 * Math.pow(2, (st.root - 57) / 12);
      var scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
      var chords = [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]];
      while (this._nextNote < now + 0.18) {
        var step = this._step % 16;
        var bar = Math.floor(this._step / 16) % 4;
        var chord = chords[bar];
        var t = this._nextNote;
        if (st.id === 'solara') {
          // driving bass on 8ths, sparkle arp on 16ths
          if (step % 2 === 0) {
            var bn = scale[chord[0] % 7] + 12 * Math.floor(chord[0] / 7);
            this._note(root * Math.pow(2, bn / 12) / 2, t, spb * 1.8, 'sawtooth', 0.16);
          }
          if (step % 4 === 2) {
            var an = scale[chord[1] % 7] + 12;
            this._note(root * Math.pow(2, an / 12), t, spb * 2, 'square', 0.05);
          }
          if (step % 4 === 0) this._noise(t, 0.04, 0.1, 6000);
        } else {
          // reggae: offbeat skank + warm bass
          if (step === 0) {
            var rb = scale[chord[0] % 7];
            this._note(root * Math.pow(2, rb / 12) / 2, t, spb * 3, 'sine', 0.22);
          }
          if (step === 4 || step === 12) {
            var sk = scale[chord[1] % 7] + 12;
            this._note(root * Math.pow(2, sk / 12), t, spb * 1.2, 'triangle', 0.1);
            this._note(root * Math.pow(2, (sk + 4) / 12), t, spb * 1.2, 'triangle', 0.08);
          }
          if (step % 4 === 2) this._noise(t, 0.03, 0.05, 4000);
        }
        this._step++;
        this._nextNote += spb;
      }
    }
  };
})();
