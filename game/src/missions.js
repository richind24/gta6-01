// Solara Bay — the story: 10 story missions plus 2 side jobs, with a small
// step engine (go to, deliver, collect, survive, escape, chase) and a marker.
import { PLACES } from './config.js';

export const STORY_MISSIONS = [
  {
    id: 'm1', title: 'Welcome to Solara', giver: 'Marisol',
    brief: 'You just washed up in Solara Bay with $250 and a borrowed jacket. Marisol runs the cafe on the north-west corner — go say hello and hear the plan.',
    reward: 300,
    steps: [{ type: 'goto', place: 'cafe', text: 'Drive or walk to Marisol\'s Cafe' }],
  },
  {
    id: 'm2', title: 'Hot Wheels', giver: 'Marisol',
    brief: 'The garage needs a Viento GT, and the owner parked one by the beach road. Steal it — the cops will notice — and bring it to the Solara Garage.',
    reward: 800,
    steps: [
      { type: 'steal', carType: 'sport', text: 'Steal a Viento GT (E next to any red sports car)' },
      { type: 'deliver', place: 'garage', text: 'Deliver the Viento GT to the Solara Garage' },
    ],
  },
  {
    id: 'm3', title: 'Beach Run', giver: 'Marisol',
    brief: 'A package for the beach kiosk, and the buyer pays double if you are quick. 75 seconds, no excuses.',
    reward: 650,
    steps: [{ type: 'timed', place: 'kiosk', seconds: 75, text: 'Reach the Beach Kiosk before the timer ends' }],
  },
  {
    id: 'm4', title: 'Shakedown', giver: 'Dante',
    brief: 'Dante runs protection on this side of town. Three shops owe this week: the arms dealer, the hotel and the clinic. Collect from all three.',
    reward: 1200,
    steps: [
      { type: 'collect', place: 'gunshop', text: 'Collect from Ironclad Arms' },
      { type: 'collect', place: 'hotel', text: 'Collect from the Palmera Hotel' },
      { type: 'collect', place: 'clinic', text: 'Collect from the Bay Clinic' },
    ],
  },
  {
    id: 'm5', title: 'Heat Wave', giver: 'Marisol',
    brief: 'That shakedown made noise. The SBPD is on you — lose them. Break line of sight and stay quiet until the heat dies, or outrun them to the safehouse.',
    reward: 900,
    steps: [{ type: 'escape', text: 'Lose the police (get Wanted to 0) or reach the Safehouse' }],
  },
  {
    id: 'm6', title: 'Harbor Lights', giver: 'Dante',
    brief: 'A crate came in at the marina and it cannot sit there. Pick it up at the docks and run it to the warehouse — by boat if you own one, by road if you do not.',
    reward: 1400,
    steps: [
      { type: 'goto', place: 'marina', text: 'Pick up the crate at the Solara Marina' },
      { type: 'deliver', place: 'warehouse', text: 'Deliver the crate to the Dock Warehouse' },
    ],
  },
  {
    id: 'm7', title: 'High Roller', giver: 'Palmera Hotel',
    brief: 'A VIP needs a quiet ride to Liberty Plaza in the limo by the hotel. One scratch on the paint and the tip is gone — drive smooth.',
    reward: 1600,
    steps: [
      { type: 'steal', carType: 'limo', text: 'Take the Palmera Limo' },
      { type: 'deliver', place: 'plaza', text: 'Drop the VIP at Liberty Plaza without wrecking the car' },
    ],
  },
  {
    id: 'm8', title: 'Air Support', giver: 'Marisol',
    brief: 'The SBPD chopper is up and it does not blink. Survive 90 seconds under the spotlight, then slip into the safehouse and disappear.',
    reward: 2000,
    steps: [{ type: 'survive', seconds: 90, text: 'Survive the helicopter for 90 seconds, then reach the Safehouse' }],
  },
  {
    id: 'm9', title: 'The Big One', giver: 'Dante',
    brief: 'The Solara Bank, noon, one crew: you. Grab the cash, get out with five stars on your tail and make the safehouse. This is the job the whole town will remember.',
    reward: 5000,
    steps: [
      { type: 'goto', place: 'bank', text: 'Hit the Solara Bank and grab the cash' },
      { type: 'escape', text: 'Escape to the Safehouse with the cash' },
    ],
  },
  {
    id: 'm10', title: 'King of Solara', giver: 'Marisol',
    brief: 'Rival crew boss Kessler is running one last package to the docks. Intercept his car, take the package, and deliver it to the cafe. Do this and Solara Bay is yours.',
    reward: 8000,
    steps: [
      { type: 'chase', text: 'Intercept Kessler\'s car (ram it until it stops)' },
      { type: 'deliver', place: 'cafe', text: 'Deliver the package to Marisol\'s Cafe' },
    ],
  },
];

export const SIDE_MISSIONS = [
  {
    id: 's1', title: 'Taxi Fare', giver: 'Bay Taxi Co.',
    brief: 'The taxi by the hotel needs a driver for the afternoon. Three fares, three stops, tips if you are fast.',
    reward: 700,
    steps: [
      { type: 'collect', place: 'hotel', text: 'Fare 1: pick up at the Palmera Hotel' },
      { type: 'collect', place: 'plaza', text: 'Fare 2: pick up at Liberty Plaza' },
      { type: 'collect', place: 'kiosk', text: 'Fare 3: pick up at the Beach Kiosk' },
    ],
  },
  {
    id: 's2', title: 'Street Racer', giver: 'Sunset Strip',
    brief: 'Midnight racers run the strip at noon for the hell of it. Three checkpoints, 60 seconds, winner takes the pot.',
    reward: 1000,
    steps: [
      { type: 'timed', place: 'racetrack', seconds: 60, text: 'Checkpoint 1: Sunset Strip' },
      { type: 'timed', place: 'kiosk', seconds: 60, text: 'Checkpoint 2: Beach Kiosk' },
      { type: 'timed', place: 'plaza', seconds: 60, text: 'Checkpoint 3: Liberty Plaza' },
    ],
  },
];

function stepTarget(step) {
  if (step.place) return PLACES[step.place];
  return null;
}

export function startMission(state, def, audio, isSide = false) {
  const mission = {
    def, isSide,
    stepIndex: 0,
    timer: def.steps[0].seconds || 0,
    target: null,
    chaseCar: null,
    done: false,
  };
  mission.target = stepTarget(def.steps[0]);
  state.mission = mission;
  if (audio) audio.pickup();
  return mission;
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.def.steps[state.mission.stepIndex];
}

export function advanceStep(state, audio) {
  const m = state.mission;
  if (!m) return false;
  m.stepIndex += 1;
  if (m.stepIndex >= m.def.steps.length) {
    completeMission(state, audio);
    return true;
  }
  const step = m.def.steps[m.stepIndex];
  m.timer = step.seconds || 0;
  m.target = stepTarget(step);
  if (audio) audio.pickup();
  return false;
}

export function completeMission(state, audio) {
  const m = state.mission;
  if (!m) return;
  state.money += m.def.reward;
  state.stats.earned += m.def.reward;
  state.stats.missions += 1;
  state.respect += 10;
  if (m.isSide) state.sideDone.push(m.def.id);
  else state.missionsDone.push(m.def.id);
  state.mission = null;
  state.mode = 'missiondone';
  if (audio) audio.cash();
}

export function failMission(state, audio, reason) {
  state.mission = null;
  state.message = reason || 'Mission failed';
  state.messageTimer = 4;
  if (audio) audio.fail();
}

// Called every frame while a mission is active. Returns 'done' | 'failed' | null.
export function updateMission(state, dt, audio) {
  const m = state.mission;
  if (!m) return null;
  const step = m.def.steps[m.stepIndex];
  const p = state.player;
  const dist = (t) => (t ? Math.hypot(p.x - t.x, p.z - t.z) : 9999);

  if (step.type === 'timed') {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, audio, 'Out of time — mission failed');
      return 'failed';
    }
  }
  if (step.type === 'survive') {
    m.timer -= dt;
    if (state.wanted < 3) {
      // No helicopter, no pressure: the clock still runs.
    }
    if (m.timer <= 0) {
      const sh = PLACES.safehouse;
      if (dist(sh) < 9) {
        advanceStep(state, audio);
        return null;
      }
      m.timer = 0;
      m.target = sh;
      step.text = 'Now reach the Safehouse';
      return null;
    }
  }
  if (step.type === 'escape') {
    if (state.wanted === 0) {
      advanceStep(state, audio);
      return null;
    }
    const sh = PLACES.safehouse;
    if (dist(sh) < 9) {
      state.wanted = 0;
      state.crimeTimer = 0;
      advanceStep(state, audio);
      return null;
    }
    m.target = sh;
    return null;
  }
  if (step.type === 'steal') {
    if (!p.onFoot && p.car && p.car.type === step.carType) {
      advanceStep(state, audio);
      return null;
    }
    return null;
  }
  if (step.type === 'chase') {
    if (m.chaseCar && m.chaseCar.hp <= 0) {
      advanceStep(state, audio);
      return null;
    }
    return null;
  }
  // goto / deliver / collect / timed: reach the marker.
  if (m.target && dist(m.target) < 9) {
    if (step.type === 'goto' && m.def.id === 'm9') {
      // The bank job: grabbing the cash draws five stars.
      state.wanted = 5;
      state.crimeTimer = 0;
      if (audio) audio.sirenBlip();
    }
    advanceStep(state, audio);
    return null;
  }
  return null;
}

export function nextStoryIndex(state) {
  for (let i = 0; i < STORY_MISSIONS.length; i++) {
    if (!state.missionsDone.includes(STORY_MISSIONS[i].id)) return i;
  }
  return -1;
}
