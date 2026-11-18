// SOLARA BAY — configuration. All tuning, story content and place data lives
// here so the rest of the game reads one source of truth. Nothing in this file
// is copied from any other game: city, people and story are original.
(function () {
  'use strict';
  var SB = window.SB || (window.SB = {});

  SB.cfg = {
    title: 'SOLARA BAY',
    tagline: 'An original open-world crime story. Dax Rivers comes home to take his city back.',
    world: {
      half: 240,            // playable ground runs -240..240 on x and z
      roadGap: 60,          // spacing of the street grid
      roads: [-180, -120, -60, 0, 60, 120, 180],
      beachX: 200,          // sand starts here, ocean past 240
      oceanX: 244,
      blockPad: 9           // buildings keep this clear of the road edge
    },
    // Bright noon palette: saturated sky, pale sand, deep blue water.
    palette: {
      sky: 0x8ec9ee, horizon: 0xcfeef7, sun: 0xfff2cf,
      grass: 0x69b354, sand: 0xe8d29a, water: 0x1f7fc4,
      asphalt: 0x3c4148, sidewalk: 0x9aa0a3, line: 0xf5d90a,
      building: [0xe8b04b, 0x4b8fd0, 0xd96a5f, 0x7fb069, 0xb678c2, 0x5f6d7a, 0xe07856, 0x3fa7a0],
      roof: [0x5a4a3a, 0x37424e, 0x7a3b2e, 0x2e4a3a],
      car: [0xd23b2e, 0x2e6fd2, 0xf2c230, 0x37b268, 0x8a5fd0, 0xe8e8e8, 0x22262b, 0xe07b39]
    },
    player: {
      walkSpeed: 7.5, sprintSpeed: 11.5, accel: 40,
      health: 100, startMoney: 250, startAmmoPistol: 48
    },
    car: {
      // arcade handling per body type: top speed, acceleration, grip
      types: {
        sedan:   { top: 34, accel: 16, grip: 7.5, price: 0 },
        taxi:    { top: 32, accel: 15, grip: 7.0, price: 0 },
        pickup:  { top: 30, accel: 14, grip: 6.5, price: 0 },
        sports:  { top: 48, accel: 24, grip: 10.0, price: 0 },
        van:     { top: 27, accel: 12, grip: 6.0, price: 0 },
        truck:   { top: 25, accel: 11, grip: 5.5, price: 0 }
      }
    },
    police: {
      maxWanted: 5,
      decaySeconds: 22,       // quiet seconds before wanted drops a star
      copCarsPerStar: 1,      // +1 chasing car per star
      footCopsPerStar: 1      // +1 foot cop per star from 2 up
    },
    heli: { minWanted: 3, height: 42, orbitRadius: 26 },
    economy: {
      shopItems: [
        { id: 'rifle', name: 'SB-7 Rifle', price: 800, desc: 'High-power rifle, 30 rounds per mag.' },
        { id: 'ammo-rifle', name: 'Rifle ammo x30', price: 60, desc: 'One magazine for the SB-7.' },
        { id: 'ammo-pistol', name: 'Pistol ammo x24', price: 30, desc: 'Sidearm rounds.' },
        { id: 'armor', name: 'Kevlar vest', price: 200, desc: 'Absorbs half of all damage.' },
        { id: 'snack', name: 'Bay Burrito', price: 20, desc: 'Restores 25 health on the spot.' },
        { id: 'medkit', name: 'Medkit', price: 120, desc: 'Restores full health.' }
      ],
      garageUpgrades: [
        { id: 'engine', name: 'Turbo engine', price: 1000, desc: '+25% top speed on your current car.' },
        { id: 'armor-car', name: 'Armored panels', price: 800, desc: 'Your car takes half damage.' },
        { id: 'paint', name: 'Sunset paint job', price: 150, desc: 'A fresh coat, Bay sunset orange.' }
      ]
    },
    places: {
      spawn: { x: -150, z: -128 },
      safehouse: { x: -150, z: -150, r: 12, name: "Dax's Safehouse" },
      garage: { x: 150, z: -150, r: 12, name: 'Sunset Garage' },
      shops: [
        { id: 'ammu', name: 'Ammu-Nation Bayfront', x: -60, z: 60, r: 10, kind: 'weapons' },
        { id: 'mart', name: 'Bay Mart', x: 60, z: -60, r: 10, kind: 'goods' }
      ],
      marina: { x: 226, z: 60, r: 14, name: 'Solara Marina' },
      warehouse: { x: -180, z: 120, r: 12, name: 'Kessler Warehouse' },
      bank: { x: 120, z: 60, r: 12, name: 'Bayfront Bank' },
      tower: { x: 180, z: 180, r: 12, name: 'Solara Tower' },
      plaza: { x: 0, z: 0, r: 14, name: 'Solara Plaza' }
    },
    photoSpots: [
      { id: 'lighthouse', name: 'Old Lighthouse', x: 222, z: -180, r: 10 },
      { id: 'pier', name: 'Bayfront Pier', x: 216, z: 60, r: 10 },
      { id: 'marina', name: 'Solara Marina', x: 226, z: 60, r: 12 },
      { id: 'plaza', name: 'Solara Plaza', x: 0, z: 0, r: 12 },
      { id: 'tower', name: 'Solara Tower', x: 180, z: 180, r: 10 },
      { id: 'stadium', name: 'Bay Bowl', x: -180, z: 180, r: 12 }
    ],
    radio: [
      { id: 'solara', name: 'SOLARA FM', genre: 'Synthwave', bpm: 112, root: 57, minor: true },
      { id: 'reggae', name: 'BAY REGGAE', genre: 'Reggae', bpm: 76, root: 50, minor: false },
      { id: 'talk', name: 'TALK BAY', genre: 'Talk radio', bpm: 0, root: 0, talk: true }
    ],
    // Ten story missions. Types: goto, drive, pickup, deliver, tail, shoot,
    // photo, escape, chase. `target` is the map objective; `extra` tunes it.
    missions: [
      { id: 1, title: 'Homecoming', type: 'goto', target: { x: -150, z: -150, r: 12 },
        brief: 'Dax is back in Solara Bay. Get to the safehouse and meet Mama Lou.',
        reward: 200, line: 'Mama Lou: "Kessler took everything, baby. Take it back, one street at a time."' },
      { id: 2, title: 'First Wheels', type: 'drive', target: { x: 150, z: -150, r: 12 },
        brief: 'You need wheels. Take any car and drive it to Sunset Garage.',
        reward: 300, line: 'Rico: "Nice ride. Steal it right and nobody even notices."' },
      { id: 3, title: 'Bayfront Photos', type: 'photo', target: { x: 222, z: -180 },
        brief: 'Scout the city for the crew. Photograph 3 landmarks — start at the lighthouse.',
        reward: 350, line: 'Mama Lou: "Know every corner of this bay before Kessler does."' },
      { id: 4, title: "Kessler's Courier", type: 'tail', target: { x: 0, z: 60 },
        brief: 'A Kessler courier is running cash through town. Tail the blue sedan for 20 seconds — do not spook it.',
        reward: 500, line: 'Rico: "Stay two cars back. He drives the money, we drive the plan."' },
      { id: 5, title: 'Harbor Lights', type: 'deliver', target: { x: 226, z: 60, r: 14 },
        brief: 'Pick up the package at the marina, then deliver it to Bay Mart.',
        reward: 600, line: 'Mama Lou: "Harbor crew is ours tonight. Move quiet, move fast."' },
      { id: 6, title: 'Rooftop Rifle', type: 'shoot', target: { x: -180, z: 120 },
        brief: 'Kessler guards hold the warehouse. Take a rifle and clear all 4 of them.',
        reward: 800, line: 'Rico: "Four guards, one warehouse. Make every shot count, Dax."' },
      { id: 7, title: 'Hot Pursuit', type: 'escape', target: { x: -150, z: -150, r: 12 },
        brief: 'The whole Bay PD is on you. Lose the heat — get back to the safehouse with the cops still chasing.',
        reward: 900, line: 'Dispatch: "All units, suspect is armed and mobile. Air support is up."' },
      { id: 8, title: 'The Marina Deal', type: 'deliver', target: { x: 226, z: 60, r: 14 },
        brief: 'A bigger pickup at the marina. Grab the case and run it to Sunset Garage — the law will be watching.',
        reward: 1200, line: 'Mama Lou: "This one pays for the whole war, baby. Do not drop it."' },
      { id: 9, title: 'Solara Heist', type: 'shoot', target: { x: 120, z: 60 },
        brief: 'Hit Bayfront Bank. Clear 6 guards, grab the vault cash, and get out.',
        reward: 2000, line: 'Rico: "Six guards between us and Kessler\'s money. Let\'s go get it back."' },
      { id: 10, title: 'Bayfront Reckoning', type: 'chase', target: { x: 180, z: 180 },
        brief: 'Kessler himself is fleeing to Solara Tower. Ram his car until it stops — then it is over.',
        reward: 5000, line: 'Kessler: "You can\'t take this city, Rivers!" — Dax: "Watch me."' }
    ],
    keys: {
      forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
      sprint: 'ShiftLeft', interact: 'KeyE', photo: 'KeyQ', radio: 'KeyR',
      shoot: 'Mouse0', pause: 'Escape', mute: 'KeyM', horn: 'KeyH'
    }
  };

  SB.util = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist2: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    fmtMoney: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); },
    // deterministic pseudo-random from an integer seed (stable screenshots)
    rng: function (seed) {
      var s = seed >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
  };
})();
