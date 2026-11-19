// Solara Bay — all sound is synthesized live with WebAudio: no audio files,
// no network. Three radio stations plus the sound effects of the city.
import { RADIO_STATIONS, TRACKS } from './config.js';

export function createAudio(state) {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    step: 0,
    nextNote: 0,
    trackIndex: 0,
    trackTimer: 0,
    sirenOsc: null,
    started: false,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.sfxGain = audio.ctx.createGain();
      audio.sfxGain.gain.value = 0.5;
      audio.sfxGain.connect(audio.master);
      audio.started = true;
      return true;
    } catch {
      return false;
    }
  };

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function blip(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audio.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function musicNote(freq, dur, type, vol, when) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(audio.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  audio.shoot = () => blip(920, 0.09, 'square', 0.22, 0, 180);
  audio.hit = () => blip(240, 0.12, 'sawtooth', 0.2, 0, 90);
  audio.pickup = () => { blip(660, 0.1, 'sine', 0.25); blip(990, 0.16, 'sine', 0.25, 0.09); };
  audio.cash = () => { blip(880, 0.09, 'triangle', 0.25); blip(1174, 0.09, 'triangle', 0.25, 0.08); blip(1568, 0.2, 'triangle', 0.25, 0.16); };
  audio.fail = () => { blip(220, 0.25, 'sawtooth', 0.2, 0, 110); blip(165, 0.4, 'sawtooth', 0.2, 0.18, 82); };
  audio.horn = () => blip(392, 0.18, 'square', 0.14, 0, 370);
  audio.crash = () => blip(120, 0.25, 'sawtooth', 0.3, 0, 40);
  audio.sirenBlip = () => { blip(780, 0.22, 'sine', 0.1, 0, 1040); blip(1040, 0.22, 'sine', 0.1, 0.22, 780); };
  audio.door = () => blip(320, 0.08, 'triangle', 0.18, 0, 180);
  audio.reload = () => { blip(500, 0.06, 'square', 0.12); blip(700, 0.06, 'square', 0.12, 0.12); };

  // Radio: a tiny step sequencer. Bass walks the station scale, a lead
  // sparkles above it, hats tick on the off-beat. A new track every ~40 s.
  audio.update = (dt) => {
    if (!audio.ctx || !state.radioOn || state.mode !== 'playing') return;
    const station = RADIO_STATIONS[state.radioIndex % RADIO_STATIONS.length];
    const stepDur = 60 / station.bpm / 2;
    audio.nextNote -= dt;
    audio.trackTimer += dt;
    if (audio.trackTimer > 42) {
      audio.trackTimer = 0;
      audio.trackIndex = (audio.trackIndex + 1) % TRACKS.length;
    }
    if (audio.nextNote > 0) return;
    audio.nextNote = stepDur;
    const s = audio.step;
    const scale = station.scale;
    const bassDegree = [0, 0, 3, 0, 4, 0, 3, 2][s % 8];
    const bassMidi = station.root - 12 + scale[bassDegree % scale.length];
    if (s % 2 === 0) musicNote(midiToFreq(bassMidi), stepDur * 1.8, 'sine', 0.5, 0);
    if (s % 4 === 2) {
      const leadDegree = scale[(s * 3 + audio.trackIndex) % scale.length];
      musicNote(midiToFreq(station.root + 12 + leadDegree), stepDur * 1.4, station.wave, 0.12, 0);
    }
    if (s % 2 === 1) musicNote(midiToFreq(station.root + 24), 0.03, 'square', 0.03, 0);
    audio.step += 1;
  };

  audio.trackName = () => TRACKS[audio.trackIndex % TRACKS.length];
  audio.stationName = () => RADIO_STATIONS[state.radioIndex % RADIO_STATIONS.length].name;
  audio.cycleStation = () => {
    state.radioIndex = (state.radioIndex + 1) % RADIO_STATIONS.length;
    audio.trackTimer = 0;
    audio.pickup();
  };
  return audio;
}
