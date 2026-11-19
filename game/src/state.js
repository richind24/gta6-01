// Solara Bay — the single shared game state every system reads and writes.
// Everything mutable about a run lives here so save/load and the screenshot
// staging can snapshot it in one place.
import { START_MONEY } from './config.js';

export function createState() {
  return {
    mode: 'menu', // menu | playing | paused | missiondone | busted | wasted | finished
    paused: false,
    time: 0,              // seconds since run start
    clock: 12 * 3600,     // in-game seconds; cover is always bright noon
    money: START_MONEY,
    health: 100,
    armor: 0,
    wanted: 0,
    wantedTimer: 0,
    crimeTimer: 0,
    respect: 0,
    radioIndex: 0,
    radioOn: true,
    weapon: 'pistol',
    weaponsOwned: ['pistol'],
    ammo: { pistol: 48, smg: 0, shotgun: 0 },
    mag: { pistol: 12, smg: 0, shotgun: 0 },
    garageLevel: 0,
    ownBoat: false,
    boatBought: false,
    missionsDone: [],
    sideDone: [],
    missionIndex: 0,
    mission: null,        // active mission runtime
    sideMission: null,
    player: {
      x: -140, z: -140, heading: 0, speed: 0,
      onFoot: true, car: null, moving: false,
      shootCooldown: 0, invuln: 0,
    },
    cars: [],             // traffic + police + parked + player car
    peds: [],
    police: [],
    heli: null,
    markers: [],
    buildings: [],        // {minX,maxX,minZ,maxZ,h}
    toasts: [],
    message: '',
    messageTimer: 0,
    stats: { carsStolen: 0, shotsFired: 0, missions: 0, earned: 0 },
    cinematic: null,      // {pos:[x,y,z], look:[x,y,z]} overrides the follow camera
    autopilot: false,
    seed: 1,
    errors: [],
    lastAmmoToast: 0,
  };
}

export function resetRun(state) {
  const fresh = createState();
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

// New game, keeping the living city: the cars, pedestrians and buildings
// already spawned stay where they are; only the run's progress resets.
export function resetProgress(state) {
  const fresh = createState();
  const keep = ['cars', 'peds', 'police', 'heli', 'buildings', 'markers', 'errors'];
  for (const key of Object.keys(fresh)) {
    if (!keep.includes(key)) state[key] = fresh[key];
  }
  state.police = [];
  state.heli = null;
  state.cinematic = null;
}
