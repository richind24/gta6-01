[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLARA BAY

An original open-world crime game for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
Dax Rivers returns to his home city, Solara Bay, to take it back from the Kessler family —
one mission, one chase, one photograph at a time. All city, characters, vehicles,
story, art and music are original creations. Nothing here is from Rockstar.

## Play it

```sh
# serve the game locally (Node 22+)
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from this repo — the game is plain static
files and runs offline in a desktop browser (Chrome recommended). No build step,
no network requests: Three.js r160 is vendored under `game/vendor/`, all textures
and music are generated in code.

## What is in the game

- **10 story missions** — Homecoming, First Wheels, Bayfront Photos, Kessler's
  Courier (tailing), Harbor Lights, Rooftop Rifle, Hot Pursuit (escape), The
  Marina Deal, Solara Heist, and the finale Bayfront Reckoning (chase Kessler).
- **Photo Tour** — photograph 6 landmarks (lighthouse, pier, marina, plaza,
  tower, stadium) for $150 each.
- **Open city** — a 480 m street grid with traffic AI, 40+ pedestrians, a
  beach, ocean, marina with boats, a lighthouse, a stadium and a plaza.
- **Wanted system 0–5 stars** — steal a car or shoot a bystander and the Bay PD
  responds: chasing cop cars, foot cops, and a **police helicopter from 3 stars**,
  with a searchlight that tracks you.
- **Combat** — pistol and a buyable SB-7 rifle, guards who shoot back, muzzle
  flash and tracers.
- **Economy** — Ammu-Nation and Bay Mart shops (weapons, ammo, armor, healing),
  Sunset Garage upgrades (turbo engine, armored panels, paint), a safehouse
  that heals and saves.
- **Radio** — 3 stations: SOLARA FM (synthwave), BAY REGGAE, and TALK BAY
  (talk radio). All music is synthesized live with WebAudio; press R to change
  station, 1/2/3 to jump to one.
- **Dense HUD** — live minimap, wanted stars, money, health, ammo, speed,
  mission panel, radio display, clock and a day/night cycle (noon-bright by
  default, golden hour at dusk).
- **Saves** — progress saves at the safehouse and from the pause menu
  (localStorage), with a Continue option on the title screen.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move on foot / drive |
| Shift | Sprint |
| Mouse drag | Orbit camera (wheel zooms) |
| Mouse click | Shoot (on foot) |
| E | Enter/exit car, interact with shops, garage, safehouse |
| Q | Photograph a landmark |
| R / 1 2 3 | Cycle radio / jump to a station |
| Esc or P | Pause |
| M | Mute |

## Screenshots

Four staged shots live in `screenshots/` (cover first): a three-star police
chase with the helicopter on the beach road at noon, the warehouse shootout,
an aerial of the bay, and the marina. They are rendered from this game's own
code — run them with `?shot=cover|mission|city|harbor` on the game URL.

## How the entry is built

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes `out/dossier.json` with the vendored
make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — page, HUD and menus
- `game/src/` — the game: `config`, `textures`, `world`, `vehicles`,
  `people`, `player`, `police`, `heli`, `combat`, `missions`, `economy`,
  `radio`, `audio`, `weather`, `hud`, `input`, `shots`, `main`
- `game/vendor/three.min.js` — vendored Three.js r160
- `screenshots/` — the four entry screenshots
- `serve.ts` — tiny static dev server for `game/`
- `shots.json` — the staged screenshot definitions
- `vendor/makefun-game.ts` — the kit's dossier builder (unchanged)
