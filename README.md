# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solara Bay — an original 3D open-world crime game: steal cars, outrun the police, and run missions across a living coastal city.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## What it is

Solara Bay is a fully original open-world crime game built for the "Make GTA 6" bounty — no content from Rockstar, every street, character and story beat invented for this entry.

- **A living city**: a 9×9 road grid with ~150 procedurally lit buildings, a park and pond, a beach, bay and pier, streetlights, traffic lights and named landmarks, with a full day-night cycle and weather.
- **On foot and behind the wheel**: stealable cars (6 types plus taxi) with arcade physics, traffic AI, and 42 pedestrian AI that panic at gunfire.
- **Wanted 0–5 and police**: patrol cars chase and ram, foot police arrest; Busted costs a $200 fine and your weapons, Wasted a $100 hospital fee. Lay low and the heat decays.
- **Combat**: fists, pistol, SMG and shotgun with tracers, muzzle flash and enemies that shoot back.
- **Missions and money**: 4 sequential story missions (Homecoming → The Pickup → Bayview Heist → The Harbor Deal) plus Taxi, Street Race, Courier and Robbery side missions; buyable properties (Garage, Marina) pay daily income, and a weapon shop stocks 7 items.
- **Full HUD**: live minimap, money, wanted stars, HP, speed, clock and day, objectives and contextual prompts, start/pause/shop/busted/wasted menus, and save/load.
- **Sound, synthesized**: engine, gunshots, explosions, sirens and a bassline music loop, all generated in WebAudio — no audio files.

## How it was built

`main.ts` (Node 22) builds the entry dossier; `game/` holds the playable static game (Three.js, vendored under `game/vendor/`); `serve.ts` serves it locally with no build step.
