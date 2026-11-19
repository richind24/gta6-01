// Solara Bay — audio.js
// One clear job: all sound is synthesized with WebAudio — no audio files.
// A tiny step sequencer plays the current radio station, plus engine,
// siren, gunshot and pickup blips. Audio starts only after a user gesture.
import { STATIONS } from './config.js';

const SCALES = {
  tide: [0, 3, 5, 7, 10],
  palm: [0, 2, 4, 7, 9],
  heat: [0, 3, 5, 6, 10],
};

export class RadioAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.step = 0;
    this.nextNoteAt = 0;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  startAfterGesture() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.startEngineHum();
  }

  setStation(index) {
    this.station = ((index % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }

  stationName() { return STATIONS[this.station].name; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.06 : 0.015;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 110, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.04;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      lfo.start();
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); if (this.sirenLfo) this.sirenLfo.stop(); } catch (err) { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq || 660;
    gain.gain.setValueAtTime(vol || 0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.12));
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(); osc.stop(this.ctx.currentTime + (dur || 0.12));
  }

  gunshot() { this.blip(180, 0.16, 'sawtooth', 0.35); this.blip(90, 0.2, 'square', 0.25); }
  pickup() { this.blip(880, 0.1, 'sine', 0.25); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.25), 90); }
  cash() { this.blip(1046, 0.1, 'triangle', 0.25); setTimeout(() => this.blip(1568, 0.18, 'triangle', 0.25), 110); }
  busted() { this.blip(220, 0.4, 'sawtooth', 0.3); }

  update() {
    if (!this.ctx || this.muted) return;
    const st = STATIONS[this.station];
    const scale = SCALES[st.id];
    const stepDur = 60 / st.bpm / 2;
    while (this.nextNoteAt < this.ctx.currentTime + 0.15) {
      const beat = this.step % 16;
      const degree = scale[(this.step * 7 + (this.step >> 3)) % scale.length];
      const octave = beat % 8 === 0 ? 2 : 1;
      const freq = st.root * Math.pow(2, degree / 12) * octave;
      if (beat % 2 === 0) this.note(freq, stepDur * 1.8, st.wave, 0.5);
      if (beat % 4 === 2) this.note(st.root / 2, stepDur, 'sine', 0.7);
      if (beat % 8 === 4) this.note(st.root * 4, stepDur * 0.5, 'sine', 0.12);
      this.step += 1;
      this.nextNoteAt += stepDur;
    }
  }

  note(freq, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol * 0.35, this.nextNoteAt);
    gain.gain.exponentialRampToValueAtTime(0.001, this.nextNoteAt + dur);
    osc.connect(gain); gain.connect(this.musicGain);
    osc.start(this.nextNoteAt); osc.stop(this.nextNoteAt + dur + 0.02);
  }
}
