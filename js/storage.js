// localStorage read/write helpers. One JSON blob per key.

const STORAGE_KEYS = {
  settings: "sudoku.settings",
  lastLevel: "sudoku.lastLevel",
  currentPuzzle: "sudoku.currentPuzzle",
};

const DEFAULT_SETTINGS = {
  autoCheckMistakes: true,
  highlightDuplicates: true,
  highlightSameNumber: true,
  highlightPeers: true,
  autoRemovePencilMarks: true,
  showTimer: true,
  showMistakes: true,
  darkMode: false,
  limitMistakes: false,
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed to read localStorage key "${key}"`, err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write localStorage key "${key}"`, err);
  }
}

function loadSettings() {
  const stored = readJSON(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

function saveSettings(settings) {
  writeJSON(STORAGE_KEYS.settings, settings);
}

function loadLastLevel() {
  return readJSON(STORAGE_KEYS.lastLevel, "medium");
}

function saveLastLevel(level) {
  writeJSON(STORAGE_KEYS.lastLevel, level);
}

function loadCurrentPuzzle() {
  return readJSON(STORAGE_KEYS.currentPuzzle, null);
}

function saveCurrentPuzzle(puzzleState) {
  writeJSON(STORAGE_KEYS.currentPuzzle, puzzleState);
}

function clearCurrentPuzzle() {
  localStorage.removeItem(STORAGE_KEYS.currentPuzzle);
}

window.Storage = {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  loadLastLevel,
  saveLastLevel,
  loadCurrentPuzzle,
  saveCurrentPuzzle,
  clearCurrentPuzzle,
};
