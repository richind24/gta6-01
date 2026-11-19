// Solara Bay — all sound is synthesized live with WebAudio.
// Three radio stations (sequenced bass + lead loops), engine hum, sirens,
// gunshots and UI chimes. No audio files are loaded, so the game stays
// fully offline and every sound is original.

import { RADIO } from './config.js';

// Note patterns per station: [scale degree, beats]. Frequencies come from
// a pentatonic ladder so every station always sounds in key.
const PATTERNS = [
  { bass: [0, 0, 3, 5, 0, 3, 5, 7], lead: [7, 5, 7, 10, 12, 10, 7, 5], root: 110, wave: 'square' },
  { bass: [0, 0, 0, 5, 0, 0, 3, 3], lead: [5, 7, 10, 7, 5, 3, 0, 3], root: 98, wave: 'sawtooth' },
  { bass: [0, 5, 7, 5, 0, 5, 10, 7], lead: [12, 10, 12, 14, 12, 10, 7, 10], root: 82.4, wave: 'triangle' },
];
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

function noteFreq(root, degree) {
  const semis = SCALE[degree % SCALE.length] + 12 * Math.floor(degree / SCALE.length);
  return root * Math.pow(2, semis / 12);
}

export class RadioAudio {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.muted = false;
    this.musicOn = true;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
    this._master = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenLfo = null;
  }

  // Must be called from a user gesture (the Start button).
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this._master = this.ctx.createGain();
    this._master.gain.value = this.muted ? 0 : 0.9;
    this._master.connect(this.ctx.destination);
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = 0.34;
    this._musicGain.connect(this._master);
    this._sfxGain = this.ctx.createGain();
    this._sfxGain.gain.value = 0.5;
    this._sfxGain.connect(this._master);
    // Engine hum: two detuned saws through a lowpass.
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0;
    this._engineOsc.connect(lp); lp.connect(this._engineGain); this._engineGain.connect(this._master);
    this._engineOsc.start();
    // Police siren: sine wobbling between two tones.
    this._sirenOsc = this.ctx.createOscillator();
    this._sirenOsc.type = 'sine';
    this._sirenOsc.frequency.value = 720;
    this._sirenLfo = this.ctx.createOscillator();
    this._sirenLfo.type = 'square';
    this._sirenLfo.frequency.value = 0.7;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 160;
    this._sirenLfo.connect(lfoGain); lfoGain.connect(this._sirenOsc.frequency);
    this._sirenGain = this.ctx.createGain();
    this._sirenGain.gain.value = 0;
    this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this._master);
    this._sirenOsc.start(); this._sirenLfo.start();
    this._nextTime = this.ctx.currentTime + 0.1;
    this._timer = setInterval(() => this._schedule(), 90);
  }

  _schedule() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const st = RADIO[this.station];
    const pat = PATTERNS[this.station];
    const stepDur = 60 / st.bpm / 2;
    while (this._nextTime < this.ctx.currentTime + 0.35) {
      const s = this._step % 8;
      this._pluck(noteFreq(pat.root, pat.bass[s]), this._nextTime, stepDur * 0.9, 'triangle', 0.5);
      this._pluck(noteFreq(pat.root * 2, pat.lead[s]), this._nextTime, stepDur * 0.8, pat.wave, 0.16);
      if (s === 0 || s === 4) this._hat(this._nextTime, 0.1);
      this._step++;
      this._nextTime += stepDur;
    }
  }

  _pluck(freq, t, dur, wave, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _hat(t, vol) {
    const len = 0.05;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    src.connect(hp); hp.connect(g); g.connect(this._musicGain);
    src.start(t);
  }

  setStation(i) {
    this.station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
    this._step = 0;
    return RADIO[this.station];
  }
  nextStation() { return this.setStation(this.station + 1); }
  stationName() { return RADIO[this.station].name; }

  setMuted(m) {
    this.muted = m;
    if (this._master) this._master.gain.value = m ? 0 : 0.9;
  }

  engine(speed01) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.1);
  }

  siren(on) {
    if (!this.ctx) return;
    this._sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.3);
  }

  shot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.6;
    src.connect(g); g.connect(this._sfxGain);
    src.start(t);
  }

  chime() {
    if (!this.ctx) return;
    [880, 1318].forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.09;
      this._pluck(f, t, 0.35, 'sine', 0.25);
    });
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this._sfxGain);
    o.start(t); o.stop(t + 0.32);
  }
}
