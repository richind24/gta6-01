[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solara Bay — an open-world crime game

Juno Reyes is back in Solara Bay: sun, surf, and a city that owes her
everything. Run **10 story missions** for Mama Bay and Don Caspian, dodge
the Solara PD and their helicopter, steal cars, buy the marina, and become
the King of Solara Bay.

An entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on
[make.fun](https://make.fun). Built from scratch in a recorded session with
three.js — no Rockstar names, art, music or maps, everything here is
original.

## What's in the game

- **A living city**: 8×8 blocks of downtown towers, El Barrio, Palm Heights,
  Solara Beach and the Harbour docks — traffic AI, 42 pedestrians, palms,
  boats, cranes and containers.
- **10 story missions** + repeatable side work: taxi fares, vigilante chases,
  courier runs and 10 hidden packages.
- **Wanted 0–5 stars**: patrol cars chase, roadblocks at 4 stars, a police
  helicopter with a spotlight from 3 stars. Busted or wasted costs cash.
- **Driving & combat**: steal any parked car (E), arcade handling, on-foot
  shooting (click / F), pistol and SMG, body armour.
- **Economy**: earn mission payouts, buy guns at Solara Arms, eat at Tide
  Burger, tune cars at Neon Garage, buy Marina Bay for passive income.
- **Radio**: three original synthesized stations — Solara FM, Bay Beats,
  Neon Nights (R to change, 1/2/3 to pick, M to mute). No audio files.
- **HUD**: minimap with live blips, wanted stars, cash, health/armour,
  mission panel with distance, radio display and speed.
- **Saves**: safehouse save (Casa Juno) plus autosave every 30 seconds.
  Continue from the start screen.

## How to play

```sh
# Serve the game folder with any static server, then open it in desktop Chrome:
node serve.ts
# → http://localhost:8080
# or:
python3 -m http.server 8080 --directory game
```

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk & drive (Shift to run) |
| E | Steal / exit car, interact & shop |
| Click / F | Shoot |
| N | Start next story mission |
| J / K / L | Taxi fare / vigilante / courier |
| R, 1 / 2 / 3, M | Radio next / pick station / mute |
| P | Pause |

Screenshot shortcuts (for the cover shots): open the game with
`?shot=cover`, `?shot=mission`, `?shot=city` or `?shot=harbor` to stage a
bright noon scene with the HUD and the action already running.

## Tech

- `game/index.html` — page + HUD
- `game/src/main.js` — bootstrap, loop, menus, shops, camera, day cycle
- `game/src/city.js` — procedural city, beach, harbour, collision
- `game/src/vehicles.js` — cars, driving physics, traffic AI
- `game/src/pedestrians.js` — sidewalk walkers
- `game/src/police.js` — wanted system, chases, helicopter, roadblocks
- `game/src/player.js` — Juno on foot and behind the wheel
- `game/src/missions.js` — 10 story missions + side jobs
- `game/src/hud.js` — HUD + live minimap
- `game/src/audio.js` — synthesized radio & sound effects (WebAudio)
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — deterministic screenshot setups
- `game/vendor/three.module.min.js` — three.js 0.160.0 (vendored, MIT)

## License

MIT — see [LICENSE](LICENSE).
