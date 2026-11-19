# SOLARA BAY — open-world crime in the sun

[![make.fun competition](https://img.shields.io/badge/make.fun-Make%20GTA%206-ffd94d)](https://make.fun/bounty/gta6-01)
[![make.fun bounty](https://img.shields.io/badge/bounty-gta6--01-2fa8d8)](https://make.fun/bounty/gta6-01)
[![reward](https://img.shields.io/badge/prize-%241%2C666%20top%20100-7dff8a)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the [make.fun **Make GTA 6** bounty](https://make.fun/bounty/gta6-01)
(`gta6-01`). Everything is ours: the city of Solara Bay, the characters, the cars, the story,
the art and the music. Nothing from Rockstar Games or any other commercial game.

## The game

You are **Rae Vega**, fresh off the ferry with $250 and a borrowed jacket. Marisol at the cafe
has a plan, Dante has the jobs, and the SBPD has your photo. Work **10 story missions** — from
*Welcome to Solara* to the noon bank job *The Big One* and the finale *King of Solara* — plus
2 side jobs (Taxi Fare, Street Racer).

- **A city to explore** on foot and by car: downtown towers, Liberty Plaza, parks, the beach
  boardwalk and the marina, all in bright noon sun
- **Traffic and 42 pedestrians** who stroll the sidewalks and scatter when shots ring out
- **Cars to steal** — sedans, the Viento GT, taxis, trucks, the Palmera Limo — plus a marina
  skiff you can buy and drive
- **Wanted 0–5 stars**: SBPD cruisers chase and ram you, and the **police helicopter** circles
  above at 3 stars and up
- **Combat**: pistol, SMG and shotgun, with ammo to buy at Ironclad Arms
- **Radio**: three stations (Solara FM, Vice Wave, Bay Beats), synthesized live with WebAudio —
  press Q to change station
- **Shops, safehouse, garage**: buy weapons and armor, repair and upgrade your cars, save and
  heal at the safehouse; progress autosaves and persists in localStorage
- **HUD**: live minimap, wanted stars, money, mission panel with distance, radio, speed,
  health and ammo

## How to run

No build step, no network — every file the game loads lives under `game/`.

```bash
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome and click **START NEW GAME**.
(Or open `game/index.html` from any static file server.)

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse | Aim, click to shoot |
| E | Steal / enter car, use shops & safehouse |
| Space | Brake |
| Shift | Sprint |
| R | Reload · 1/2/3 switch weapon |
| Q | Change radio station |
| M | Start the next story job |
| P / Esc | Pause |

## Screenshots

`1-cover.jpg` is the cover: a three-star police chase with the helicopter overhead at noon.
`2-mission.jpg` starts the Hot Wheels job, `3-city.jpg` shows downtown and the beach from
above, `4-harbor.jpg` runs the Harbor Lights job from the marina skiff. All four are real
renders of this game running in a browser, taken with `?shot=cover|mission|city|harbor`.

## Tech

- three.js (vendored under `game/vendor/`), plain ES modules, no build step
- All sound synthesized with WebAudio — no audio files
- `main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes
  `dossier.json` with the kit's `vendor/makefun-game.ts`

## License

MIT — see [LICENSE](LICENSE).
