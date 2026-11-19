// Solara Bay — the story: 10 missions for Juno Reyes plus repeatable side
// work (taxi fares, vigilante chases, courier runs, hidden packages).
// Each mission is data (steps) plus a small state machine; the game feeds
// it player actions and it answers with the current objective text.

import { LANDMARKS, clamp } from './config.js';
import { makeBeacon } from './city.js';

const $ = (x, z) => ({ x, z });

export const STORY = [
  {
    id: 'homecoming', title: '1 — Homecoming', giver: 'Mama Bay',
    brief: 'Juno is back in Solara Bay. Steal a ride and get to the safehouse.',
    steps: [
      { type: 'car', label: 'Steal a car — press E next to one' },
      { type: 'goto', at: LANDMARKS.safehouse, label: 'Drive to Casa Juno, the safehouse' },
    ],
    reward: 200,
  },
  {
    id: 'courier', title: '2 — Bay Courier', giver: 'Mama Bay',
    brief: 'A package is waiting at the harbour docks. Tide Burger wants it in 100 seconds.',
    steps: [
      { type: 'goto', at: LANDMARKS.harbour, label: 'Pick up the package at Harbour Docks' },
      { type: 'timed', at: LANDMARKS.burger, seconds: 100, label: 'Deliver to Tide Burger — fast!' },
    ],
    reward: 350,
  },
  {
    id: 'hotwheels', title: '3 — Hot Wheels', giver: 'Neon Garage',
    brief: 'A Sunset GT is parked in Palm Heights. Bring it to the garage, no scratches is a lie — just bring it.',
    steps: [
      { type: 'goto', at: { x: 152, z: -168, label: 'Sunset GT' }, label: 'Find the Sunset GT in Palm Heights' },
      { type: 'car', label: 'Steal the Sunset GT — press E' },
      { type: 'goto', at: LANDMARKS.garage, label: 'Deliver it to Neon Garage' },
    ],
    reward: 500,
  },
  {
    id: 'harborlights', title: '4 — Harbour Lights', giver: 'Don Caspian',
    brief: 'Three crates came in on the night boat. Collect them all, then run them to the marina.',
    steps: [
      { type: 'pickup', at: { x: 150, z: 272, label: 'Crate 1' }, label: 'Collect crate 1 of 3' },
      { type: 'pickup', at: { x: 190, z: 290, label: 'Crate 2' }, label: 'Collect crate 2 of 3' },
      { type: 'pickup', at: { x: 230, z: 262, label: 'Crate 3' }, label: 'Collect crate 3 of 3' },
      { type: 'goto', at: LANDMARKS.marina, label: 'Deliver the crates to Marina Bay' },
    ],
    reward: 600,
  },
  {
    id: 'heatwave', title: '5 — Heat Wave', giver: 'Mama Bay',
    brief: 'The PD needs a reminder. Make some noise, get 2 stars, then lose the heat.',
    steps: [
      { type: 'wanted', stars: 2, label: 'Raise your wanted level to 2 stars (steal, speed, shoot)' },
      { type: 'escape', label: 'Lose the cops — stay out of sight until the stars clear' },
    ],
    reward: 450,
  },
  {
    id: 'radioheist', title: '6 — Radio Heist', giver: 'Neon Nights',
    brief: 'The Neon Nights van is parked at Bay Arena. The station wants its own van back. Take it to the garage.',
    steps: [
      { type: 'goto', at: LANDMARKS.arena, label: 'Find the radio van at Bay Arena' },
      { type: 'car', label: 'Steal the van — press E' },
      { type: 'goto', at: LANDMARKS.garage, label: 'Deliver the van to Neon Garage' },
    ],
    reward: 700,
  },
  {
    id: 'hightide', title: '7 — High Tide Getaway', giver: 'Don Caspian',
    brief: 'The drop is hot. Get to Solara Beach with the heat on — the boat leaves at dawn.',
    steps: [
      { type: 'heat', stars: 3, label: 'The heat is on — 3 stars, like it or not' },
      { type: 'goto', at: LANDMARKS.beach, label: 'Escape to Solara Beach' },
    ],
    reward: 800,
  },
  {
    id: 'toll', title: '8 — Kingpin’s Toll', giver: 'Mama Bay',
    brief: 'Caspian’s lookouts are shaking down the arena. Take out 5 of them, then collect the toll.',
    steps: [
      { type: 'shootout', count: 5, at: LANDMARKS.arena, label: 'Take out 5 lookouts at Bay Arena (click / F to shoot)' },
      { type: 'goto', at: LANDMARKS.arena, label: 'Collect the toll at Bay Arena' },
    ],
    reward: 900,
  },
  {
    id: 'escort', title: '9 — Marina Nights', giver: 'Mama Bay',
    brief: 'Drive Mama Bay from the safehouse to the marina. She hates dents — keep the ride smooth.',
    steps: [
      { type: 'goto', at: LANDMARKS.safehouse, label: 'Pick up Mama Bay at the safehouse' },
      { type: 'car', label: 'Get in a car with Mama Bay' },
      { type: 'goto', at: LANDMARKS.marina, label: 'Drive her to Marina Bay — gently' },
    ],
    reward: 1000,
  },
  {
    id: 'finale', title: '10 — Solara Bay Finale', giver: 'Don Caspian',
    brief: 'One last run: grab the shipment at the harbour, shake a 4-star tail, bring it home.',
    steps: [
      { type: 'goto', at: LANDMARKS.harbour, label: 'Grab the shipment at Harbour Docks' },
      { type: 'heat', stars: 4, label: '4 stars and counting — shake them' },
      { type: 'escape', label: 'Lose the heat' },
      { type: 'goto', at: LANDMARKS.safehouse, label: 'Bring the shipment home to Casa Juno' },
    ],
    reward: 2500,
  },
];

export const SIDE_JOBS = [
  { id: 'taxi', title: 'Taxi Fare', desc: 'Pick up a fare and drive them across town before the meter runs out.' },
  { id: 'vigilante', title: 'Vigilante', desc: 'A runner is fleeing the PD. Ram their car 3 times to stop them.' },
  { id: 'courier', title: 'Courier Run', desc: 'Timed deliveries across Solara Bay. Chain them for bonuses.' },
  { id: 'packages', title: 'Hidden Packages', desc: '10 packages are hidden around the city. Find them all.' },
];

export class Missions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world; // {player, city, traffic, peds, police, audio, toast}
    this.index = 0; // next story mission
    this.done = 0;
    this.active = null; // {mission, step}
    this.beacon = null;
    this.timer = 0;
    this.shootCount = 0;
    this.side = null;
    this.sideTimer = 0;
    this.sideTarget = null;
    this.sideHits = 0;
    this.packagesFound = 0;
    this.packageMarkers = [];
    this.onMissionComplete = null;
    this.onSideComplete = null;
  }

  get current() { return STORY[this.index] || null; }

  startNext() {
    const m = this.current;
    if (!m || this.active) return false;
    this.active = { mission: m, step: 0 };
    this._applyStep();
    return true;
  }

  _clearBeacon() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
  }

  _applyStep() {
    this._clearBeacon();
    const step = this._step();
    if (!step) return;
    if (step.at) {
      this.beacon = makeBeacon(0xffd23f);
      this.beacon.position.set(step.at.x, 0, step.at.z);
      this.scene.add(this.beacon);
      this.world.city.beacons.push(this.beacon);
    }
    if (step.type === 'timed') this.timer = step.seconds;
    if (step.type === 'shootout') {
      this.shootCount = 0;
      const { peds, city } = this.world;
      for (let k = 0; k < step.count; k++) {
        peds.spawnAt(step.at.x + (Math.random() - 0.5) * 26, step.at.z + (Math.random() - 0.5) * 26, 0xd90429);
      }
    }
    if (step.type === 'heat') this.world.police.setWanted(step.stars);
  }

  _step() {
    if (!this.active) return null;
    return this.active.mission.steps[this.active.step] || null;
  }

  objectiveText() {
    if (this.active) {
      const step = this._step();
      const m = this.active.mission;
      let t = `${m.title} — ${step ? step.label : ''}`;
      if (step && step.type === 'timed') t += ` (${Math.ceil(this.timer)}s)`;
      if (step && step.type === 'shootout') t += ` (${this.shootCount}/${step.count})`;
      return t;
    }
    if (this.side) return `Side job: ${this.side.title} — ${this.side.label || ''}`;
    const next = this.current;
    return next ? `Next: ${next.title} — press N to start` : 'Story complete — you are the King of Solara Bay!';
  }

  _advance() {
    const step = this._step();
    if (this.active.mission.id === 'hotwheels' && step && step.type === 'car') {
      // The stolen GT is the player's now.
    }
    this.active.step++;
    if (this.active.step >= this.active.mission.steps.length) {
      const m = this.active.mission;
      this.world.player.addMoney(m.reward);
      this.world.audio.chime();
      this.world.toast(`Mission complete: ${m.title}  +$${m.reward}`);
      this._clearBeacon();
      this.active = null;
      this.done++;
      this.index++;
      if (this.onMissionComplete) this.onMissionComplete(m);
      if (m.id === 'toll') {
        this.world.player.weapon = 2;
        this.world.player.ammo += 120;
        this.world.toast('New weapon: SMG unlocked (+120 ammo)');
      }
    } else {
      this._applyStep();
    }
  }

  _fail(msg) {
    this.world.toast(msg);
    this._clearBeacon();
    this.active = null;
  }

  update(dt) {
    const { player, police } = this.world;
    if (this.active) {
      const step = this._step();
      if (!step) return;
      const near = (at, r = 7) => Math.hypot(player.x - at.x, player.z - at.z) < r;
      switch (step.type) {
        case 'car':
          if (player.inCar) this._advance();
          break;
        case 'goto':
        case 'pickup':
          if (near(step.at)) {
            if (step.type === 'pickup') this.world.audio.chime();
            this._advance();
          }
          break;
        case 'timed':
          this.timer -= dt;
          if (near(step.at)) this._advance();
          else if (this.timer <= 0) this._fail('Too slow — mission failed. Press N to retry.');
          break;
        case 'wanted':
          if (police.wanted >= step.stars) this._advance();
          break;
        case 'heat':
          this._advance();
          break;
        case 'escape':
          if (police.wanted === 0) this._advance();
          break;
        case 'shootout':
          if (this.shootCount >= step.count) this._advance();
          break;
        default: break;
      }
    }
    if (this.side) this._updateSide(dt);
  }

  // Called by the game when the player shoots someone.
  onShotKill() {
    if (this.active) {
      const step = this._step();
      if (step && step.type === 'shootout') {
        this.shootCount++;
        this.world.audio.chime();
      }
    }
  }

  startSide(id) {
    const { player, city, traffic, peds } = this.world;
    if (this.side) return false;
    if (id === 'taxi') {
      const p = city.randomRoadPoint(this.world.rng);
      this.sideTarget = p;
      this.side = { id, title: 'Taxi Fare', label: 'Pick up the fare (drive close, in a car)' };
      this.sideTimer = 75;
      this._sideBeacon(p.x, p.z);
    } else if (id === 'vigilante') {
      const cars = traffic.cars.filter((c) => c.isTraffic && !c.dead);
      const target = cars[Math.floor(Math.random() * cars.length)];
      if (!target) return false;
      target.isRunner = true;
      this.sideTarget = target;
      this.side = { id, title: 'Vigilante', label: 'Ram the runner 3 times!' };
      this.sideHits = 0;
      this._sideBeacon(target.x, target.z);
    } else if (id === 'courier') {
      const p = city.randomRoadPoint(this.world.rng);
      this.sideTarget = p;
      this.side = { id, title: 'Courier Run', label: 'Deliver fast!' };
      this.sideTimer = 60;
      this._sideBeacon(p.x, p.z);
    } else if (id === 'packages') {
      this.world.toast('Hidden packages glow gold — 10 are hidden around Solara Bay.');
      this._spawnPackages();
      return true;
    }
    return true;
  }

  _sideBeacon(x, z) {
    this._clearBeacon();
    this.beacon = makeBeacon(0x2ec4b6);
    this.beacon.position.set(x, 0, z);
    this.scene.add(this.beacon);
    this.world.city.beacons.push(this.beacon);
  }

  _spawnPackages() {
    const spots = [
      [-288, -288], [232, -288], [-288, 232], [272, 120], [-168, -8],
      [72, 232], [-8, 288], [152, 72], [-232, 72], [312, -120],
    ];
    for (const [x, z] of spots) {
      const b = makeBeacon(0xffd23f);
      b.position.set(x, 0, z);
      b.scale.setScalar(0.6);
      this.scene.add(b);
      this.world.city.beacons.push(b);
      this.packageMarkers.push({ x, z, beacon: b });
    }
  }

  _updateSide(dt) {
    const { player } = this.world;
    if (this.side.id === 'taxi') {
      this.sideTimer -= dt;
      if (!this.side.pickedUp) {
        if (player.inCar && Math.hypot(player.x - this.sideTarget.x, player.z - this.sideTarget.z) < 6) {
          this.side.pickedUp = true;
          const dest = this.world.city.randomRoadPoint(this.world.rng);
          this.sideTarget = dest;
          this.side.label = 'Drive the fare to the destination';
          this.sideTimer = 75;
          this._sideBeacon(dest.x, dest.z);
          this.world.toast('Fare picked up — drive!');
        }
      } else if (Math.hypot(player.x - this.sideTarget.x, player.z - this.sideTarget.z) < 7) {
        this._finishSide(120);
      }
      if (this.sideTimer <= 0 && this.side) this._failSide('The fare got tired of waiting.');
    } else if (this.side.id === 'vigilante') {
      const t = this.sideTarget;
      if (!t || t.dead) { this._failSide('The runner got away.'); return; }
      this._sideBeacon(t.x, t.z);
      if (player.inCar && player.car) {
        const d = Math.hypot(player.x - t.x, player.z - t.z);
        if (d < 4 && Math.abs(player.car.speed) > 6) {
          this.sideHits++;
          this.world.audio.crash();
          this.world.toast(`Ram! ${this.sideHits}/3`);
          if (this.sideHits >= 3) this._finishSide(300);
        }
      }
    } else if (this.side.id === 'courier') {
      this.sideTimer -= dt;
      if (Math.hypot(player.x - this.sideTarget.x, player.z - this.sideTarget.z) < 7) {
        this._finishSide(150);
      } else if (this.sideTimer <= 0) this._failSide('Delivery late.');
    }
    // Hidden packages are always live once spawned.
    for (const m of [...this.packageMarkers]) {
      if (Math.hypot(player.x - m.x, player.z - m.z) < 5) {
        this.scene.remove(m.beacon);
        this.packageMarkers = this.packageMarkers.filter((p) => p !== m);
        this.packagesFound++;
        this.world.player.addMoney(100);
        this.world.audio.chime();
        this.world.toast(`Hidden package ${this.packagesFound}/10  +$100`);
      }
    }
  }

  _finishSide(reward) {
    this.world.player.addMoney(reward);
    this.world.audio.chime();
    this.world.toast(`Side job done: ${this.side.title}  +$${reward}`);
    this._clearBeacon();
    const done = this.side;
    this.side = null;
    if (this.onSideComplete) this.onSideComplete(done);
  }

  _failSide(msg) {
    this.world.toast(msg);
    this._clearBeacon();
    this.side = null;
  }

  reset() {
    this._clearBeacon();
    this.active = null;
    this.side = null;
    this.index = 0;
    this.done = 0;
  }
}
