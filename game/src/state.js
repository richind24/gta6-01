// Cobalt Vice: Port Meridian — shared game state (written from scratch, session round3b).
// Classic scripts share the global lexical scope, so later files use G directly.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const ROADS = [-900, -600, -300, 0, 300, 600, 900];
const WORLD = { min: -1000, max: 1000, waterX: 700 };

const G = {
  started: false,
  paused: false,
  mapOpen: false,
  shopOpen: false,
  time: 12.7,          // hours of day, 0-24
  weather: 0,          // 0 clear, 1 rain, 2 fog
  weatherT: 0,
  money: 500,
  wanted: 0,
  health: 100,
  maxHealth: 100,
  missionIndex: 0,
  mission: null,       // active story mission object
  side: null,          // active side mission object
  sideCooldown: 0,
  mode: 'walk',        // walk | car | bike | boat | heli
  vehicle: null,       // vehicle object the player is driving
  weapons: { fists: true, pistol: false, smg: false, shotgun: false, rifle: false },
  weapon: 'fists',
  ammo: { pistol: 0, smg: 0, shotgun: 0, rifle: 0 },
  props: { bar: false, garage: false },
  upgrades: { engine: 0, armor: 0 },
  speedKmh: 0,
  shot: '',
  autotest: false,
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  hemi: null,
  groundCanvas: null,
  rain: null,
  lamps: [],
  world: {
    buildings: [],   // {x,z,w,d,h,mesh}
    traffic: [],     // {mesh,x,z,a,v,road,axis,dir,speed,color,player:false}
    peds: [],        // {mesh,x,z,a,speed,panic,health}
    cops: [],        // {mesh,x,z,a,v,health,lightT}
    copHeli: null,   // {mesh,x,z,a,h}
    boats: [],       // {mesh,x,z,a,v,player:false,moored}
    helis: [],       // {mesh,x,z,a,player:false}
    rivals: [],      // {mesh,x,z,a,v,health}
    markers: [],     // side-mission markers {mesh,x,z,kind,label}
    shops: [],       // {x,z,kind:'weapons'|'bar'|'garage',mesh}
    beacons: [],     // active mission beacons (meshes)
  },
  player: { x: 80, z: 80, a: -0.5, v: 0, mesh: null, group: null },
  toast: '',
  toastT: 0,
  banner: '',
  bannerT: 0,
  incomeT: 0,
  elapsed: 0,
  camA: -0.5,
  errors: [],
  test: { phase: 0, t: 0, done: false, result: {} },
};

window.addEventListener('error', (e) => {
  G.errors.push(String(e.message || e.error || 'unknown error'));
});
