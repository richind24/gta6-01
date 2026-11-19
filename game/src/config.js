// Solara Bay — tuning, world layout, economy and radio.
// A sun-soaked coastal city of our own: no Rockstar names, maps or art.
export const WORLD = {
  size: 420,
  half: 210,
  roadStep: 40,
  roadHalf: 5.5,
  beachX: 158,
  waterX: 182,
  groundY: 0,
};

export const PALETTE = {
  sky: 0x8fd4ff,
  sun: 0xfff2c8,
  grass: 0x7ec850,
  sand: 0xf2d492,
  water: 0x2fa8d8,
  road: 0x3a3f4a,
  sidewalk: 0xcfc8b8,
  plaza: 0xb8c4cc,
  park: 0x58b368,
};

export const CAR_TYPES = {
  sedan:   { name: 'Solara Sedan',   maxSpeed: 26, accel: 13, turn: 1.9, color: 0x3f7fd0, price: 0 },
  sport:   { name: 'Viento GT',     maxSpeed: 36, accel: 18, turn: 2.3, color: 0xe23b3b, price: 4000 },
  taxi:    { name: 'Bay Taxi',      maxSpeed: 24, accel: 12, turn: 2.0, color: 0xf2c200, price: 0 },
  truck:   { name: 'Hauler Truck',  maxSpeed: 20, accel: 10, turn: 1.5, color: 0x7a7f8a, price: 0 },
  police:  { name: 'SBPD Cruiser',  maxSpeed: 33, accel: 17, turn: 2.2, color: 0x1c2f6e, price: 0 },
  boat:    { name: 'Marina Skiff',  maxSpeed: 30, accel: 15, turn: 2.1, color: 0xffffff, price: 12000 },
  limo:    { name: 'Palmera Limo',  maxSpeed: 28, accel: 13, turn: 1.8, color: 0x222222, price: 0 },
};

export const WEAPONS = {
  pistol: { name: 'P9 Pistol', damage: 34, rate: 0.28, mag: 12, range: 55, price: 0, auto: false },
  smg:    { name: 'VSP SMG',   damage: 20, rate: 0.09, mag: 32, range: 48, price: 1500, auto: true },
  shotgun:{ name: 'Street Sweeper', damage: 26, rate: 0.7, mag: 6, range: 30, price: 3500, auto: false, pellets: 5 },
};

export const RADIO_STATIONS = [
  { id: 'solara', name: 'SOLARA FM 101.1', genre: 'Sunshine Pop', bpm: 112, scale: [0, 2, 4, 7, 9], root: 60, wave: 'triangle' },
  { id: 'vice',   name: 'VICE WAVE 88.4',  genre: 'Night Drive Synth', bpm: 96, scale: [0, 3, 5, 7, 10], root: 55, wave: 'sawtooth' },
  { id: 'bay',    name: 'BAY BEATS 95.7',  genre: 'Island Groove', bpm: 128, scale: [0, 2, 5, 7, 10], root: 57, wave: 'square' },
];

export const TRACKS = [
  'Palms at Noon', 'Neon Tide', 'Boardwalk Lights', 'Golden Hour Run', 'Salt Air', 'Midnight Ferry',
];

// Landmarks the missions and shops point at. All coordinates are world x/z.
export const PLACES = {
  cafe:      { x: -150, z: -150, label: "Marisol's Cafe",  kind: 'meet' },
  garage:    { x: -150, z:  150, label: 'Solara Garage',   kind: 'garage' },
  gunshop:   { x:  150, z: -150, label: 'Ironclad Arms',   kind: 'shop' },
  marina:    { x:  196, z:  130, label: 'Solara Marina',   kind: 'marina' },
  safehouse: { x:  -30, z:  170, label: 'Safehouse',       kind: 'safehouse' },
  hotel:     { x:  150, z:  150, label: 'Palmera Hotel',   kind: 'hotel' },
  bank:      { x:    0, z:    0, label: 'Solara Bank',     kind: 'bank' },
  warehouse: { x:  170, z:  -30, label: 'Dock Warehouse',  kind: 'warehouse' },
  kiosk:     { x:  170, z:   30, label: 'Beach Kiosk',     kind: 'kiosk' },
  plaza:     { x:    0, z: -170, label: 'Liberty Plaza',   kind: 'plaza' },
  clinic:    { x: -170, z:   30, label: 'Bay Clinic',      kind: 'clinic' },
  racetrack: { x: -170, z: -110, label: 'Sunset Strip',    kind: 'race' },
};

export const PRICES = {
  garageUpgrade: 4000,
  garageRepair: 250,
  boat: 12000,
  ammoBox: 120,
  medkit: 150,
  armor: 400,
};

export const START_MONEY = 250;
export const MAX_WANTED = 5;
