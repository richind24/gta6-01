[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solara Bay — an open-world crime game

An entry for the [make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
A complete, original, sun-soaked open-world crime game that runs offline in
desktop Chrome from static files — no build step, no network requests.

You are **Rico Vega**, fresh out of the marina lockup. Mara Solis has work,
the whole bay has money, and the Solara PD has a helicopter with your name
on it. Steal a car, run the jobs, lose the heat, and take the Big Tide.

## What is in the game

- **A city to explore** — Solara Bay: a 420 m road grid, downtown towers,
  Ocean Drive beach, Marina Bay docks and boats, palms, streetlights and 42
  pedestrians, all procedural and seeded so the bay is the same every load.
- **On foot and by car** — walk, sprint, steal any parked car (E), arcade
  driving with handbrake, traffic AI looping the grid, and a Solara GT for
  sale at Marina Motors.
- **10 story missions** — First Wheels, Harbor Lights, Beach Run, Tide Arms,
  Payback Cruise, Marina Money, Heat Wave, Skyline Job, Golden Hour and the
  finale The Big Tide — plus 4 repeatable side jobs (Taxi Fare, Vigilante,
  Courier Run, Street Race) from the pause menu.
- **Wanted 0–5 with police that respond** — patrol cars chase and ram,
  a police helicopter with a spotlight joins at 3 stars, roadblocks at 4+,
  stars decay when you stay hidden, respray at Marina Motors sheds them all.
- **Combat** — buy a pistol at Tide Arms, shoot with F or click, goons shoot
  back, armour and health, busted / wasted drops you at Solara General.
- **Radio** — three original synth stations (Tide FM, Palm Radio, Heat FM),
  Q switches station, engine hum and sirens, all synthesized with WebAudio.
- **Shops, safehouse, garage** — Tide Arms, Burger Bay, Marina Motors
  (respray, engine tune, Solara GT), Casa Alba safehouse heals and saves.
- **HUD + minimap** — cash, wanted stars, health / armour, ammo, mission
  panel with timer, radio, speed, district, clock and a live minimap.
- **Save** — localStorage save at the safehouse, on mission complete, and
  from the pause menu; Continue on the start screen.

## How to run

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step. `game/index.html` is the game; every script, the vendored
three.js build and every asset live under `game/`.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Sprint |
| Space | Brake / handbrake |
| E | Enter car, exit car, shop, pickup, safehouse |
| F or click | Shoot (needs a pistol) |
| M | Start the next mission |
| Q | Change radio station |
| 1–3 | Buy in a shop |
| Esc | Pause, side jobs, save |

## Entry plumbing

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
kit's vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of this game in a browser
at noon: the cover is a 3-star police pursuit with the helicopter overhead.

## License

MIT — see `LICENSE`. All city, characters, vehicles, names, story, art and
music are original, created for this entry.
