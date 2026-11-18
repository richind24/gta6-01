// Cobalt Vice — synthesized WebAudio: engine, gunfire, sirens, music. No audio files.
const AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineOsc2: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenLfo: null,
  musicTimer: null,
  musicStep: 0,
  noiseBuf: null,

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Engine: two detuned saws through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 28;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp);
      this.engineOsc2.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  },

  engine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      const f = 50 + speed01 * 130;
      this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, this.ctx.currentTime, 0.1);
    } catch (e) {}
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.15, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  },

  noise(dur, vol, freq) {
    if (!this.ctx || !this.noiseBuf) return;
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start();
      s.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  },

  gunshot() { this.noise(0.14, 0.35, 2600); this.blip(160, 0.08, 'square', 0.12); },
  shotgunBlast() { this.noise(0.3, 0.5, 1200); this.blip(90, 0.15, 'square', 0.18); },
  explosion() { this.noise(0.8, 0.6, 500); this.blip(45, 0.6, 'sine', 0.3); },
  pickup() { this.blip(660, 0.09, 'sine', 0.15); setTimeout(() => this.blip(990, 0.12, 'sine', 0.15), 90); },
  cash() { this.blip(880, 0.1, 'triangle', 0.18); setTimeout(() => this.blip(1320, 0.16, 'triangle', 0.18), 110); },
  denied() { this.blip(180, 0.15, 'square', 0.12); },

  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.type = 'square';
        this.sirenLfo.frequency.value = 0.7;
        const lg = this.ctx.createGain();
        lg.gain.value = 220;
        this.sirenLfo.connect(lg);
        lg.connect(this.sirenOsc.frequency);
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenLfo.start();
      } else if (!on && this.sirenOsc) {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
        this.sirenOsc = null;
        this.sirenLfo = null;
      }
    } catch (e) {}
  },

  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    // Slow synthwave bassline: A minor groove, 8 steps.
    const bass = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || G.paused) return;
      const n = bass[this.musicStep % bass.length];
      this.musicStep++;
      if (n > 0) this.blip(n, 0.24, 'sawtooth', 0.05);
      if (this.musicStep % 4 === 0) this.blip(220, 0.1, 'triangle', 0.03);
    }, 260);
  },
};
