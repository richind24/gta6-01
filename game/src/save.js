// Solara Bay — saving to localStorage: progress, money, gear and position.
// Saves happen at the safehouse, after every mission, and once a minute.
const KEY = 'solara-bay-save-v5';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      armor: state.armor,
      respect: state.respect,
      radioIndex: state.radioIndex,
      weapon: state.weapon,
      weaponsOwned: state.weaponsOwned,
      ammo: state.ammo,
      mag: state.mag,
      garageLevel: state.garageLevel,
      ownBoat: state.ownBoat,
      missionsDone: state.missionsDone,
      sideDone: state.sideDone,
      player: { x: state.player.x, z: state.player.z },
      stats: state.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function applySave(state, data) {
  state.money = data.money;
  state.health = data.health ?? 100;
  state.armor = data.armor ?? 0;
  state.respect = data.respect ?? 0;
  state.radioIndex = data.radioIndex ?? 0;
  state.weapon = data.weapon ?? 'pistol';
  state.weaponsOwned = data.weaponsOwned ?? ['pistol'];
  state.ammo = data.ammo ?? state.ammo;
  state.mag = data.mag ?? state.mag;
  state.garageLevel = data.garageLevel ?? 0;
  state.ownBoat = !!data.ownBoat;
  state.missionsDone = data.missionsDone ?? [];
  state.sideDone = data.sideDone ?? [];
  if (data.player) {
    state.player.x = data.player.x;
    state.player.z = data.player.z;
  }
  if (data.stats) state.stats = { ...state.stats, ...data.stats };
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* no storage */ }
}
