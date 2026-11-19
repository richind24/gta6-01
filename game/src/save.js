// Solara Bay — saves: one localStorage slot. Money, story progress, the
// player's position and health, owned upgrades and stats. Safehouse saves
// heal the player; the start screen offers Continue when a save exists.

const KEY = 'solara-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: Math.floor(state.money),
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      packagesFound: state.packagesFound,
      x: state.x,
      z: state.z,
      health: state.health,
      armor: state.armor,
      ammo: state.ammo,
      weapon: state.weapon,
      garage: state.garage || [],
      marinaOwned: !!state.marinaOwned,
      totalEarned: state.totalEarned || 0,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (err) { /* private mode */ }
}

export function hasSave() {
  return loadGame() !== null;
}
