[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/richind24/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/richind24/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Cobalt Vice: Port Meridian

An original open-world crime sandbox in a living 3D city. Steal cars, boats and a helicopter, outrun the Meridian police (on the ground and in the air), run 8 story missions and 4 side jobs, buy businesses that pay you while you sleep, and arm yourself at Ironworks Arms. All art, names, story and sound are original — no Rockstar assets.

## Play

Run `node serve.ts` and open http://localhost:8080. Or open `game/index.html` through any static server.

- **WASD** drive / walk · **E** enter vehicle or interact · **Mouse** aim, **Click** fire
- **Space** handbrake · **1–5** switch weapons · **R** lay low (costs $200) · **L** save · **M** map · **P** pause
- **?shot=cover|mission|city|harbor** jumps straight into a staged scene (used for the screenshots)
- **?autotest=1** runs a scripted self-test (walk, steal a car, drive, start mission 1, fire) and writes the result into `#test-status`

## Systems

- **City**: procedural downtown with a plaza tower, park, beach, harbor and pier, day–night cycle, rain and fog, dynamic sky and street lamps.
- **Vehicles**: stealable traffic cars, parked bikes, moored boats, a rooftop helipad helicopter, police cars and a police helicopter at wanted level 3+.
- **Wanted**: crimes raise stars; cops chase, ram and try to bust you; lay low or wait it out to cool down.
- **Combat**: fists, pistol, SMG, shotgun and rifle with hitscan tracers, muzzle flash and synthesized gunfire.
- **Missions**: 8 sequential story missions (harbor run, helipad meet, store hold-up, boat delivery, race gates, car theft, surviving the heat, taking down 3 rivals) + 4 repeatable side jobs (street race, courier, store robbery, tail the mark).
- **Economy**: mission payouts, property income (Neon Bar $500/min, Harbor Garage $900/min), weapon shop, engine and armor upgrades, localStorage save/load.
- **Audio**: fully synthesized WebAudio — engine hum, gunshots, sirens, cash chimes and a synthwave bassline. No audio files.

## Tech

- three.js r160 (vendored under `game/vendor/`, UMD build) + plain ES-free scripts, no build step, no runtime network requests.
- `main.ts` copies `game/` + `screenshots/` to the output and writes `dossier.json` via the vendored make.fun library.
