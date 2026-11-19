// Solara Bay — config.js
// One clear job: every tuneable number, story beat, shop item and radio
// station in one place, so the rest of the game reads like a script.
export const WORLD = {
  half: 210,            // playable square, metres
  streetGap: 60,        // distance between street centrelines
  streetHalf: 5,        // half width of a road
  noonSun: 0xfff2d8,    // bright noon light for the cover shot
  sky: 0x7ec8f7,        // saturated noon sky
  fog: 0x9fd8f2,
};

export const PLAYER_TUNING = {
  walkSpeed: 9,
  sprintSpeed: 14,
  driveAccel: 26,
  driveBrake: 40,
  driveMax: 34,
  reverseMax: 12,
  turnRate: 2.4,
  health: 100,
  startCash: 250,
};

export const WANTED_TUNING = {
  decayDelay: 14,       // seconds hidden before stars start falling
  decayStep: 6,         // seconds per star lost while hidden
  copCarsPerStar: 1,    // +1 patrol car per star
  heliAtStars: 3,       // helicopter joins at 3 stars
  bustedFine: 150,
};

// Radio: three original stations, synth-driven (see audio.js).
export const STATIONS = [
  { id: 'tide', name: 'TIDE FM 101.1 — Solara Surf', bpm: 112, root: 220.0, wave: 'triangle', hue: '#35c8ff' },
  { id: 'palm', name: 'PALM RADIO 88.4 — Golden Hour', bpm: 88, root: 174.61, wave: 'sine', hue: '#ffb03a' },
  { id: 'heat', name: 'HEAT 97.9 — Bay Nights', bpm: 132, root: 196.0, wave: 'sawtooth', hue: '#ff4d6d' },
];

// Shops the player can walk into (E to open). Prices in $.
export const SHOPS = {
  arms: {
    key: 'arms', name: 'TIDE ARMS', pos: [30, -90], color: 0x2b3a55,
    items: [
      { id: 'pistol', label: 'Pistol + 60 rounds', price: 300 },
      { id: 'ammo', label: 'Ammo box (+120 rounds)', price: 120 },
      { id: 'armor', label: 'Body armor (+50)', price: 200 },
    ],
  },
  burger: {
    key: 'burger', name: 'BURGER BAY', pos: [-90, 30], color: 0xd94f30,
    items: [
      { id: 'meal', label: 'Bay Burger Meal (+40 HP)', price: 40 },
      { id: 'shake', label: 'Mango Shake (+15 HP)', price: 15 },
    ],
  },
  garage: {
    key: 'garage', name: 'MARINA MOTORS', pos: [150, 90], color: 0x1f7a5c,
    items: [
      { id: 'respray', label: 'Respray — lose all wanted stars', price: 250 },
      { id: 'tune', label: 'Engine tune (+25% top speed)', price: 900 },
      { id: 'sport', label: 'Buy Solara GT (parked outside)', price: 4000 },
    ],
  },
};

export const SAFEHOUSE = { name: 'CASA ALBA', pos: [-150, -150], color: 0xe8b13c };

// Story: ten chapters. Each step is one objective the mission engine
// understands: goto (walk/drive to a marker), pickup, deliver, eliminate,
// chase (ram a target car), race (timed checkpoints), escape (lose the law).
export const STORY = [
  { id: 1, title: 'First Wheels', giver: 'Mara Solis',
    brief: 'Mara needs wheels. Steal any car on Ocean Drive and bring it to her.',
    reward: 400, steps: [
      { type: 'enterCar', text: 'Steal a car (walk to one, press E)' },
      { type: 'goto', pos: [60, -60], text: 'Drive to Mara at the plaza', radius: 8 },
    ] },
  { id: 2, title: 'Harbor Lights', giver: 'Mara Solis',
    brief: 'A package waits at the east docks. Pick it up and bring it back.',
    reward: 600, steps: [
      { type: 'goto', pos: [185, 60], text: 'Reach the east docks', radius: 8 },
      { type: 'pickup', pos: [185, 60], text: 'Pick up the package (E)', radius: 5 },
      { type: 'goto', pos: [60, -60], text: 'Deliver it to Mara', radius: 8 },
    ] },
  { id: 3, title: 'Beach Run', giver: 'Mara Solis',
    brief: 'Sunset buyers wait at Casa Alba. Get there in 75 seconds.',
    reward: 700, steps: [
      { type: 'goto', pos: [-150, -150], text: 'Reach Casa Alba before the timer ends', radius: 10, timer: 75 },
    ] },
  { id: 4, title: 'Tide Arms', giver: 'Dario Venn',
    brief: 'Dario’s warehouse crew turned on him. Buy a pistol, then clear the warehouse.',
    reward: 900, steps: [
      { type: 'goto', pos: [30, -90], text: 'Visit Tide Arms', radius: 8 },
      { type: 'eliminate', count: 3, pos: [120, -120], text: 'Clear the warehouse crew (F to shoot)', radius: 22 },
    ] },
  { id: 5, title: 'Payback Cruise', giver: 'Dario Venn',
    brief: 'A courier car is running the marina road. Ram it until it stops.',
    reward: 1000, steps: [
      { type: 'chase', text: 'Ram the courier car until it stalls', targetSpeed: 0 },
    ] },
  { id: 6, title: 'Marina Money', giver: 'Mara Solis',
    brief: 'Three drops are hidden around the marina. Collect them all.',
    reward: 1100, steps: [
      { type: 'pickup', pos: [180, 120], text: 'Collect drop 1 of 3 (E)', radius: 6 },
      { type: 'pickup', pos: [150, 150], text: 'Collect drop 2 of 3 (E)', radius: 6 },
      { type: 'pickup', pos: [120, 180], text: 'Collect drop 3 of 3 (E)', radius: 6 },
    ] },
  { id: 7, title: 'Heat Wave', giver: 'Mara Solis',
    brief: 'The job went loud. Lose a 3-star wanted level and reach Casa Alba.',
    reward: 1300, wanted: 3, steps: [
      { type: 'escape', text: 'Lose the wanted stars, then reach Casa Alba', pos: [-150, -150], radius: 10 },
    ] },
  { id: 8, title: 'Skyline Job', giver: 'Dario Venn',
    brief: 'A rival lookout post watches the skyline. Take the crew out, then grab the ledger.',
    reward: 1500, steps: [
      { type: 'eliminate', count: 3, pos: [-60, 120], text: 'Clear the lookout crew (F to shoot)', radius: 22 },
      { type: 'pickup', pos: [-60, 120], text: 'Grab the ledger (E)', radius: 6 },
    ] },
  { id: 9, title: 'Golden Hour', giver: 'Mara Solis',
    brief: 'One lap of the bay, five checkpoints, 100 seconds. Prove the GT is yours.',
    reward: 1800, steps: [
      { type: 'race', checkpoints: [[-120, -120], [120, -120], [150, 30], [60, 150], [-120, 120]], timer: 100, text: 'Race the bay loop' },
    ] },
  { id: 10, title: 'The Big Tide', giver: 'Mara Solis',
    brief: 'The final run: grab the tide crate, clear the dock crew, deliver it to the marina.',
    reward: 5000, steps: [
      { type: 'pickup', pos: [185, -30], text: 'Grab the tide crate (E)', radius: 6 },
      { type: 'eliminate', count: 4, pos: [150, -60], text: 'Clear the dock crew (F to shoot)', radius: 24 },
      { type: 'goto', pos: [150, 90], text: 'Deliver the crate to Marina Motors', radius: 9 },
    ] },
];

// Side work, repeatable from the pause menu's job board.
export const SIDE_JOBS = [
  { id: 'taxi', title: 'Taxi Fare', brief: 'Pick up a fare and drop them off.', reward: 150 },
  { id: 'vigilante', title: 'Vigilante', brief: 'Take down 3 wanted runners on foot.', reward: 350 },
  { id: 'courier', title: 'Courier Run', brief: 'Deliver 2 parcels across town, 60 seconds.', reward: 250 },
  { id: 'race', title: 'Street Race', brief: 'Three checkpoints, 45 seconds.', reward: 400 },
];

export const DISTRICTS = [
  { name: 'Downtown', pos: [0, 0] },
  { name: 'Ocean Drive', pos: [180, 0] },
  { name: 'Marina Bay', pos: [150, 120] },
  { name: 'Casa Alba', pos: [-150, -150] },
  { name: 'North Hills', pos: [-120, -150] },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
