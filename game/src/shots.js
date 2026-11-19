// Solara Bay — screenshot staging: real gameplay states the cover and the
// other shots are taken from, driven through the same public game API the
// player uses. Nothing here is faked: the frames are the game running.
import { PLACES } from './config.js';
import { startMission, STORY_MISSIONS } from './missions.js';

export function setupShots(game) {
  const { state } = game;

  function ensureSportAt(x, z, heading) {
    let car = game.nearestParkedSport();
    if (!car) car = game.spawnParkedCar('sport', x, z, heading);
    car.x = x; car.z = z; car.heading = heading;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    return car;
  }

  const shots = {
    cover() {
      game.clearCinematic();
      game.setPlaying();
      // Beach road, heading north: open sky, water on the right, city left.
      const car = ensureSportAt(160, 40, Math.PI);
      game.enterCar(car, true);
      state.wanted = 3;
      state.crimeTimer = 0;
      game.spawnPoliceBurst(3);
      const m = startMission(state, STORY_MISSIONS[4], game.audio);
      m.target = PLACES.safehouse;
      state.message = 'HEAT WAVE — lose the SBPD or reach the Safehouse';
      state.messageTimer = 6;
    },
    mission() {
      game.clearCinematic();
      game.setPlaying();
      game.exitCar();
      game.teleport(-140, -140);
      state.wanted = 0;
      startMission(state, STORY_MISSIONS[1], game.audio);
      // Closer framing so Rae on foot reads clearly.
      game.setCinematic({ pos: [-165, 42, -92], look: [-140, 0, -140] });
      state.message = 'HOT WHEELS — steal a Viento GT';
      state.messageTimer = 6;
    },
    city() {
      game.clearCinematic();
      game.setPlaying();
      const car = ensureSportAt(-40, -20, 0);
      game.enterCar(car, true);
      state.wanted = 0;
      startMission(state, STORY_MISSIONS[0], game.audio);
      game.setCinematic({ pos: [-30, 150, 150], look: [70, 0, -50] });
      state.message = 'SOLARA BAY — a city to take';
      state.messageTimer = 6;
    },
    harbor() {
      game.clearCinematic();
      game.setPlaying();
      const boat = game.boatCar();
      game.teleport(188, 130);
      game.enterCar(boat, true);
      state.wanted = 0;
      state.ownBoat = true;
      startMission(state, STORY_MISSIONS[5], game.audio);
      // Low camera south of the boat, looking north up the water channel.
      game.setCinematic({ pos: [196, 35, 192], look: [196, 0, 140] });
      state.message = 'HARBOR LIGHTS — run the crate to the warehouse';
      state.messageTimer = 6;
    },
  };

  window.__solara = {
    ready: true,
    shot(name) {
      if (!shots[name]) return { ok: false, error: 'unknown shot ' + name };
      try {
        shots[name]();
        return { ok: true, shot: name };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    status() {
      return {
        ready: true,
        mode: state.mode,
        wanted: state.wanted,
        mission: state.mission ? state.mission.def.title : null,
        step: state.mission ? state.mission.def.steps[state.mission.stepIndex].text : null,
        money: state.money,
        health: Math.round(state.health),
        cars: state.cars.length,
        peds: state.peds.length,
        police: state.police.length,
        heli: !!state.heli,
        player: { x: Math.round(state.player.x), z: Math.round(state.player.z), onFoot: state.player.onFoot },
        fps: game.fps,
        time: Math.round(state.time * 10) / 10,
        errors: state.errors.slice(-5),
      };
    },
  };
  return window.__solara;
}
