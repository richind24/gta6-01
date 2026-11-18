// Radio: three in-game stations with distinct synthesized grooves, cycled with R.
// The station name + now-playing track show in the HUD — the winners all had a
// visible radio, so it is a first-class system here, not a menu footnote.

export const STATIONS = [
  {
    id: 'bayview', name: 'Bayview FM 101.1', dj: 'DJ Marina',
    tracks: ['Solara Nights — The Palms', 'Golden Hour — Costa', 'Bay Breeze — Lumen'],
    bass: [55, 55, 65.41, 49, 55, 55, 82.41, 73.42], tempo: 240, wave: 'triangle',
  },
  {
    id: 'rock', name: 'Solara Rock 98.5', dj: 'Rex Thunder',
    tracks: ['Highway Heat — Falcon', 'Redline — The Pistons', 'Midnight Chase — V8'],
    bass: [82.41, 82.41, 98, 73.42, 82.41, 82.41, 110, 98], tempo: 165, wave: 'sawtooth',
  },
  {
    id: 'talk', name: 'Kessler Talk 760 AM', dj: 'Vic Kessler',
    tracks: ['Pagi di Solara — talk', 'Suara Kota — talk', 'Malam Kessler — talk'],
    bass: [49, 49, 55, 49, 49, 49, 58.27, 55], tempo: 300, wave: 'sine',
  },
];

export function createRadio(G) {
  const R = {
    index: 0,
    trackIndex: 0,
    station() { return STATIONS[R.index]; },
    track() { return R.station().tracks[R.trackIndex]; },
    label() { return `♪ ${R.station().name} — ${R.track()}`; },
    next() {
      R.index = (R.index + 1) % STATIONS.length;
      R.trackIndex = 0;
      if (G.audio) G.audio.setStation(R.station());
      G.hud.flash(`Radio: ${R.station().name} — ${R.track()}`);
      return R.station();
    },
    nextTrack() {
      R.trackIndex = (R.trackIndex + 1) % R.station().tracks.length;
    },
    setStation(id) {
      const i = STATIONS.findIndex((s) => s.id === id);
      if (i >= 0) {
        R.index = i; R.trackIndex = 0;
        if (G.audio) G.audio.setStation(R.station());
      }
    },
  };
  return R;
}
