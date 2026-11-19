// Solara Bay — save.js
// One clear job: persist and restore a campaign to localStorage, and
// nothing else. The save key is namespaced so other games never collide.
const SAVE_KEY = 'solara-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: state.cash,
      health: state.health,
      armor: state.armor,
      ammo: state.ammo,
      hasPistol: state.hasPistol,
      tuned: state.tuned,
      ownsSport: state.ownsSport,
      missionIndex: state.missionIndex,
      completedMissions: state.completedMissions,
      sideDone: state.sideDone,
      playerPos: state.playerPos,
      station: state.station,
      respect: state.respect,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage unavailable */ }
}

export function saveLabel() {
  const data = loadGame();
  if (!data) return 'No save yet';
  const when = new Date(data.savedAt);
  return 'Saved ' + when.toLocaleString() + ' — Mission ' + (data.missionIndex + 1) + ' of 10, $' + data.cash;
}
