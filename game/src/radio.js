// SOLARA BAY — radio. Three stations: two procedural music stations and one
// talk station. Music is synthesized live by the audio engine, so the game
// ships no audio files at all.
(function () {
  'use strict';
  var SB = window.SB;
  var cfg = SB.cfg;

  var TRACKS = {
    solara: ['Midnight Overdrive — Neon Palms', 'Sunset Circuit — Vector Bay', 'Chrome Hearts — Laser Coast', 'Night Drive — Solara Nights'],
    reggae: ['Island Breeze — The Marlin Crew', 'Salt Air — Coral Sound', 'Bayfront Skank — The Tides', 'Coconut Radio — Mango Season'],
    talk: ['Talk Bay — The Morning Tide with Sal', 'Talk Bay — Bayfront Politics Hour', 'Talk Bay — Calls From the Pier']
  };
  var TALK_LINES = [
    'Sal: "Caller, you cannot park a boat in a no-parking zone. It is a boat."',
    'Sal: "Kessler says the bay is his. The bay has never once agreed."',
    'Sal: "Traffic on the causeway is moving at the speed of a sleepy turtle."',
    'Sal: "If your car was stolen this morning, congratulations, it is now a taxi."',
    'Sal: "The lighthouse keeper called in. He says the light is fine. The light is always fine."'
  ];

  SB.radio = {
    current: 0,
    track: 0,
    trackT: 0,
    talkT: 0,
    talkLine: 0,
    on: true,

    station: function () { return cfg.radio[this.current]; },
    trackName: function () {
      var st = this.station();
      return TRACKS[st.id][this.track % TRACKS[st.id].length];
    },
    label: function () {
      if (!this.on) return 'RADIO OFF';
      var st = this.station();
      if (st.talk) return st.name + ' — ' + TRACKS.talk[this.track % TRACKS.talk.length];
      return st.name + ' ♪ ' + this.trackName();
    },

    setStation: function (i, ctx) {
      this.current = ((i % cfg.radio.length) + cfg.radio.length) % cfg.radio.length;
      this.track = 0;
      this.trackT = 0;
      this.talkT = 0;
      if (ctx) ctx.onEvent('radio', { station: this.station() });
    },
    next: function (ctx) { this.setStation(this.current + 1, ctx); },
    toggle: function (ctx) {
      this.on = !this.on;
      if (ctx) ctx.onEvent('radio', { station: this.on ? this.station() : null });
    },

    update: function (dt, ctx) {
      if (!this.on) return;
      var st = this.station();
      if (st.talk) {
        this.talkT -= dt;
        if (this.talkT <= 0) {
          this.talkT = 9;
          ctx.onEvent('talk', { line: TALK_LINES[this.talkLine % TALK_LINES.length] });
          this.talkLine++;
        }
        return;
      }
      this.trackT -= dt;
      if (this.trackT <= 0) {
        this.trackT = 24;
        this.track = (this.track + 1) % TRACKS[st.id].length;
        if (ctx) ctx.onEvent('track', { name: this.trackName() });
      }
      if (SB.audio) SB.audio.playStation(st, dt);
    }
  };
})();
