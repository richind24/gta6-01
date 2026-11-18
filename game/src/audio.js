// Audio: everything synthesized with WebAudio — no audio files.
// Engine hum, gunshots, siren, UI clicks, explosion, and a simple bassline loop.

export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null, engineFilter: null,
    musicOn: true, musicTimer: null, sirenOsc: null, sirenGain: null, sirenOn: false,
    ensure() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
      try {
        A.ctx = new (window.AudioContext || window.webkitAudioContext)();
        A.master = A.ctx.createGain();
        A.master.gain.value = 0.5;
        A.master.connect(A.ctx.destination);
        // engine: sawtooth through lowpass, pitch follows speed
        A.engineOsc = A.ctx.createOscillator();
        A.engineOsc.type = 'sawtooth';
        A.engineOsc.frequency.value = 55;
        A.engineFilter = A.ctx.createBiquadFilter();
        A.engineFilter.type = 'lowpass';
        A.engineFilter.frequency.value = 320;
        A.engineGain = A.ctx.createGain();
        A.engineGain.gain.value = 0;
        A.engineOsc.connect(A.engineFilter);
        A.engineFilter.connect(A.engineGain);
        A.engineGain.connect(A.master);
        A.engineOsc.start();
        // siren: two-tone triangle
        A.sirenOsc = A.ctx.createOscillator();
        A.sirenOsc.type = 'triangle';
        A.sirenOsc.frequency.value = 700;
        A.sirenGain = A.ctx.createGain();
        A.sirenGain.gain.value = 0;
        A.sirenOsc.connect(A.sirenGain);
        A.sirenGain.connect(A.master);
        A.sirenOsc.start();
        A.sirenPhase = 0;
        A.startMusic();
        return true;
      } catch (e) { A.ctx = null; return false; }
    },
    engine(ratio, speed) {
      if (!A.ctx || !A.engineOsc) return;
      const target = speed === 0 && ratio === 0 ? 0 : 0.05 + ratio * 0.09;
      A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
      A.engineOsc.frequency.setTargetAtTime(55 + ratio * 160, A.ctx.currentTime, 0.08);
      A.engineFilter.frequency.setTargetAtTime(300 + ratio * 1400, A.ctx.currentTime, 0.1);
    },
    noiseBurst(dur, vol, freq) {
      if (!A.ctx) return;
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 3000;
      const g = A.ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start();
    },
    tone(freq, dur, vol, type = 'sine', when = 0) {
      if (!A.ctx) return;
      const t0 = A.ctx.currentTime + when;
      const o = A.ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(A.master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    gunshot(kind, vol = 1) {
      if (kind === 'shotgun') { A.noiseBurst(0.35, 0.9 * vol, 1200); A.tone(90, 0.25, 0.5 * vol, 'sine'); }
      else if (kind === 'smg') A.noiseBurst(0.12, 0.5 * vol, 4500);
      else A.noiseBurst(0.18, 0.7 * vol, 3500);
    },
    thud() { A.noiseBurst(0.15, 0.5, 500); A.tone(70, 0.15, 0.4, 'sine'); },
    explosion() { A.noiseBurst(0.9, 1.0, 700); A.tone(45, 0.8, 0.8, 'sine'); },
    click() { A.tone(880, 0.06, 0.25, 'square'); },
    missionStart() { A.tone(523, 0.12, 0.4); A.tone(659, 0.12, 0.4, 'sine', 0.12); A.tone(784, 0.25, 0.4, 'sine', 0.24); },
    missionDone() { A.tone(784, 0.12, 0.4); A.tone(988, 0.12, 0.4, 'sine', 0.12); A.tone(1175, 0.3, 0.4, 'sine', 0.24); },
    sirenBlip() { A.tone(950, 0.18, 0.35, 'triangle'); A.tone(700, 0.25, 0.35, 'triangle', 0.18); },
    setSiren(on, dist = 0) {
      if (!A.ctx || !A.sirenGain) return;
      const v = on ? Math.max(0.02, 0.1 - dist * 0.0008) : 0;
      A.sirenGain.gain.setTargetAtTime(v, A.ctx.currentTime, 0.3);
      if (on) {
        A.sirenPhase = (A.sirenPhase || 0) + 1;
        A.sirenOsc.frequency.setTargetAtTime(A.sirenPhase % 2 ? 700 : 950, A.ctx.currentTime, 0.05);
      }
    },
    // Lo-fi bassline + hats, scheduled in a loop.
    startMusic() {
      if (!A.ctx || A.musicTimer) return;
      const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
      let step = 0;
      A.musicTimer = setInterval(() => {
        if (!A.musicOn || !A.ctx) return;
        const bar = Math.floor(step / 8) % 2;
        const note = bassNotes[step % 8];
        A.tone(note, 0.42, 0.16, 'triangle');
        if (step % 2 === 0) A.noiseBurst(0.03, 0.05, 8000);
        if (step % 8 === 4) A.tone(note * 2, 0.2, 0.06, 'sine');
        step++;
      }, 240);
    },
  };
  return A;
}
