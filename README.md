# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solara Bay — an original 3D open-world crime game: steal cars, outrun the police helicopter, and run missions across a living coastal city.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

## Controls

WASD move / drive · Mouse: orbit camera, click: shoot · **E**: enter/exit car, start mission, open shop · **1–5**: weapons · **R**: change radio station · **Shift**: run · **Esc**: pause

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## What it is

Solara Bay is a fully original open-world crime game built for the "Make GTA 6" bounty — no content from Rockstar, every street, character and story beat invented for this entry.

- **A living city**: a 9×9 road grid with ~150 procedurally lit buildings, a park and pond, a beach with umbrellas and joggers, bay and pier, streetlights, traffic lights and 12 named landmarks, with a full day-night cycle and weather.
- **On foot and behind the wheel**: stealable cars (8 types plus taxi) with arcade physics, traffic AI, and 56 pedestrian AI that panic at gunfire — joggers and beachgoers included.
- **Wanted 0–5, police and helicopter**: patrol cars chase and ram, foot police arrest, and at wanted 3+ a police helicopter circles overhead with a searchlight and fires down at you. Busted costs a $200 fine and your weapons, Wasted a $100 hospital fee. Lay low — or hide in a safehouse — and the heat decays.
- **Combat**: fists, pistol, SMG, shotgun and rifle with tracers, muzzle flash and enemies that shoot back.
- **10 story missions**: Homecoming → The Pickup → Bayview Heist → The Harbor Deal → Airwaves → Heat Wave → Safehouse → Garage Kings → High Tide → King of Solara Bay, plus 5 side jobs (Taxi, Street Race, Courier, Robbery, Photo Tour).
- **Radio**: 3 stations — Bayview FM 101.1, Solara Rock 98.5, Kessler Talk 760 AM — each with its own synthesized groove. Press R to switch; the station and now-playing track show in the HUD.
- **Shops, safehouse and garage**: Ironworks Arms (9 weapon items), Bayview Diner (heals), Solara Auto (car repair, Turbo Kit +25% top speed, Armor Plating −33% damage); buyable properties (Harbor Garage, Solara Marina, Bayview Apartment safehouse) pay daily income.
- **Full HUD**: live minimap (police, heli, shops and mission markers), money, wanted stars, HP, speed, clock and day, radio, story progress (x/10), helicopter warning, objectives and contextual prompts, start/pause/shop/busted/wasted menus, and save/load.
- **Sound, synthesized**: engine, gunshots, explosions, sirens and three radio grooves, all generated in WebAudio — no audio files.

## How it was built

`main.ts` (Node 22) builds the entry dossier; `game/` holds the playable static game (Three.js, vendored under `game/vendor/`); `serve.ts` serves it locally with no build step. This is the rebuild of the first Solara Bay entry: 10 story missions instead of 4, a helicopter, radio, shops and a safehouse, a bright noon cover, and a fully witnessed recording.
