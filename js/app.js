(function () {
  "use strict";

  const els = {
    difficultyStat: document.getElementById("difficulty-stat"),
    difficultyValue: document.getElementById("difficulty-value"),
    mistakesStat: document.getElementById("mistakes-stat"),
    mistakesValue: document.getElementById("mistakes-value"),
    timeStat: document.getElementById("time-stat"),
    timeValue: document.getElementById("time-value"),
    pauseBtn: document.getElementById("pause-btn"),
    pauseIcon: document.getElementById("pause-icon"),
    playIcon: document.getElementById("play-icon"),
    board: document.getElementById("board"),
    pauseOverlay: document.getElementById("pause-overlay"),
    resumeBtn: document.getElementById("resume-btn"),
    generatingOverlay: document.getElementById("generating-overlay"),
    undoBtn: document.getElementById("undo-btn"),
    modeNormalBtn: document.getElementById("mode-normal-btn"),
    modeNotesBtn: document.getElementById("mode-notes-btn"),
    eraseBtn: document.getElementById("erase-btn"),
    numberPad: document.getElementById("number-pad"),
    newGameBtn: document.getElementById("new-game-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    newGameOverlay: document.getElementById("new-game-overlay"),
    levelList: document.getElementById("level-list"),
    restartBtn: document.getElementById("restart-btn"),
    newGameCancel: document.getElementById("new-game-cancel"),
    settingsScreen: document.getElementById("settings-screen"),
    settingsBackBtn: document.getElementById("settings-back-btn"),
    settingsBody: document.getElementById("settings-body"),
    completionOverlay: document.getElementById("completion-overlay"),
    completionLevel: document.getElementById("completion-level"),
    completionTime: document.getElementById("completion-time"),
    completionMistakes: document.getElementById("completion-mistakes"),
    completionNewGame: document.getElementById("completion-new-game"),
    completionClose: document.getElementById("completion-close"),
    limitOverlay: document.getElementById("limit-overlay"),
    limitRestart: document.getElementById("limit-restart"),
    limitNewGame: document.getElementById("limit-new-game"),
  };

  let settings = window.Storage.loadSettings();
  let state = null;
  let cells = null;
  let padButtons = null;
  let timerHandle = null;
  let lastPersistAt = 0;

  function cloneNotes(notes) {
    return notes.map((row) => row.map((cell) => cell.slice()));
  }

  function emptyNotesGrid() {
    return Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => [])
    );
  }

  function getPeerCells(row, col) {
    const peers = [];
    const seen = new Set();
    const add = (r, c) => {
      if (r === row && c === col) return;
      const key = `${r},${c}`;
      if (seen.has(key)) return;
      seen.add(key);
      peers.push([r, c]);
    };
    for (let i = 0; i < 9; i++) {
      add(row, i);
      add(i, col);
    }
    const boxRow = row - (row % 3);
    const boxCol = col - (col % 3);
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) add(r, c);
    }
    return peers;
  }

  function newPuzzleState(difficulty) {
    const { puzzle, solution } = window.Generator.generatePuzzle(difficulty);
    return {
      difficulty,
      givens: puzzle,
      solution,
      values: window.Solver.cloneGrid(puzzle),
      notes: emptyNotesGrid(),
      mistakes: 0,
      elapsedSeconds: 0,
      history: [],
      completed: false,
      selected: null,
      notesMode: false,
      paused: false,
    };
  }

  function restartPuzzleState(prev) {
    return {
      difficulty: prev.difficulty,
      givens: prev.givens,
      solution: prev.solution,
      values: window.Solver.cloneGrid(prev.givens),
      notes: emptyNotesGrid(),
      mistakes: 0,
      elapsedSeconds: 0,
      history: [],
      completed: false,
      selected: null,
      notesMode: false,
      paused: false,
    };
  }

  function loadOrCreateState() {
    const saved = window.Storage.loadCurrentPuzzle();
    const lastLevel = window.Storage.loadLastLevel();
    if (saved && !saved.completed) {
      return {
        difficulty: saved.difficulty,
        givens: saved.givens,
        solution: saved.solution,
        values: saved.values,
        notes: saved.notes,
        mistakes: saved.mistakes,
        elapsedSeconds: saved.elapsedSeconds,
        history: saved.history || [],
        completed: saved.completed,
        selected: null,
        notesMode: false,
        paused: false,
      };
    }
    return newPuzzleState(lastLevel);
  }

  function persist(force) {
    if (!state) return;
    const now = Date.now();
    if (!force && now - lastPersistAt < 3000) return;
    lastPersistAt = now;
    window.Storage.saveCurrentPuzzle({
      difficulty: state.difficulty,
      givens: state.givens,
      solution: state.solution,
      values: state.values,
      notes: state.notes,
      mistakes: state.mistakes,
      elapsedSeconds: state.elapsedSeconds,
      history: state.history,
      completed: state.completed,
    });
    window.Storage.saveLastLevel(state.difficulty);
  }

  function isLimitReached() {
    return (
      settings.limitMistakes && state.mistakes >= 3 && !state.completed
    );
  }

  function isBoardLocked() {
    return state.completed || isLimitReached() || state.paused;
  }

  // ---------- rendering ----------

  function render() {
    els.difficultyValue.textContent =
      window.Generator.DIFFICULTY_CONFIG[state.difficulty].label;

    els.mistakesStat.hidden = !settings.showMistakes;
    els.mistakesValue.textContent = state.mistakes;

    els.timeStat.hidden = !settings.showTimer;
    els.timeValue.textContent = formatTime(state.elapsedSeconds);
    els.pauseIcon.hidden = state.paused;
    els.playIcon.hidden = !state.paused;
    els.pauseBtn.setAttribute("aria-label", state.paused ? "Resume" : "Pause");

    els.pauseOverlay.hidden = !state.paused;

    window.Board.updateBoard(
      cells,
      {
        puzzle: { values: state.values, givens: state.givens, notes: state.notes },
        solution: state.solution,
        selected: state.selected,
      },
      settings
    );
    window.Board.updateNumberPad(padButtons, { values: state.values }, state.solution);

    els.undoBtn.disabled = state.history.length === 0 || isBoardLocked();
    els.modeNormalBtn.classList.toggle("is-active", !state.notesMode);
    els.modeNormalBtn.setAttribute("aria-pressed", String(!state.notesMode));
    els.modeNotesBtn.classList.toggle("is-active", state.notesMode);
    els.modeNotesBtn.setAttribute("aria-pressed", String(state.notesMode));

    els.eraseBtn.disabled = isBoardLocked();

    document.documentElement.classList.toggle("dark", settings.darkMode);

    els.board.classList.toggle("is-locked", isBoardLocked());

    updateTimerRunning();
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ---------- timer ----------

  function updateTimerRunning() {
    const shouldRun =
      !state.paused &&
      !state.completed &&
      !isLimitReached() &&
      els.newGameOverlay.hidden &&
      els.settingsScreen.hidden &&
      els.completionOverlay.hidden &&
      els.limitOverlay.hidden;

    if (shouldRun && !timerHandle) {
      timerHandle = setInterval(() => {
        state.elapsedSeconds++;
        els.timeValue.textContent = formatTime(state.elapsedSeconds);
        persist(false);
      }, 1000);
    } else if (!shouldRun && timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  // ---------- move handling ----------

  function pushHistory(entry) {
    state.history.push(entry);
    if (state.history.length > 200) state.history.shift();
  }

  function applyAutoRemovePeerNotes(row, col, digit) {
    const removals = [];
    if (!settings.autoRemovePencilMarks) return removals;
    for (const [r, c] of getPeerCells(row, col)) {
      const idx = state.notes[r][c].indexOf(digit);
      if (idx !== -1) {
        state.notes[r][c].splice(idx, 1);
        removals.push({ row: r, col: c, digit });
      }
    }
    return removals;
  }

  function restorePeerNotes(removals) {
    for (const { row, col, digit } of removals) {
      if (!state.notes[row][col].includes(digit)) {
        state.notes[row][col].push(digit);
        state.notes[row][col].sort((a, b) => a - b);
      }
    }
  }

  function isLocked(row, col) {
    return state.givens[row][col] !== 0;
  }

  function commitDigit(digit) {
    if (isBoardLocked() || !state.selected) return;
    const { row, col } = state.selected;
    if (isLocked(row, col)) return;

    if (state.notesMode) {
      if (state.values[row][col] !== 0) return;
      const prevNotes = state.notes[row][col].slice();
      const idx = prevNotes.indexOf(digit);
      const newNotes = prevNotes.slice();
      if (idx === -1) {
        newNotes.push(digit);
        newNotes.sort((a, b) => a - b);
      } else {
        newNotes.splice(idx, 1);
      }
      state.notes[row][col] = newNotes;
      pushHistory({ kind: "note", row, col, prevNotes, newNotes });
      persist(false);
      render();
      return;
    }

    if (state.values[row][col] === digit) return;

    const prevValue = state.values[row][col];
    const prevNotes = state.notes[row][col].slice();
    const isMistake = digit !== state.solution[row][col];

    state.values[row][col] = digit;
    state.notes[row][col] = [];
    if (isMistake) state.mistakes += 1;
    const peerNoteRemovals = applyAutoRemovePeerNotes(row, col, digit);

    pushHistory({
      kind: "digit",
      row,
      col,
      prevValue,
      newValue: digit,
      prevNotes,
      peerNoteRemovals,
    });

    checkCompletion();
    checkMistakeLimit();
    persist(true);
    render();
  }

  function eraseSelected() {
    if (isBoardLocked() || !state.selected) return;
    const { row, col } = state.selected;
    if (isLocked(row, col)) return;

    if (state.values[row][col] !== 0) {
      const prevValue = state.values[row][col];
      state.values[row][col] = 0;
      pushHistory({
        kind: "digit",
        row,
        col,
        prevValue,
        newValue: 0,
        prevNotes: [],
        peerNoteRemovals: [],
      });
    } else if (state.notes[row][col].length) {
      const prevNotes = state.notes[row][col].slice();
      state.notes[row][col] = [];
      pushHistory({ kind: "note", row, col, prevNotes, newNotes: [] });
    } else {
      return;
    }
    persist(true);
    render();
  }

  function undo() {
    if (isBoardLocked() || state.history.length === 0) return;
    const entry = state.history.pop();
    if (entry.kind === "note") {
      state.notes[entry.row][entry.col] = entry.prevNotes.slice();
    } else if (entry.kind === "digit") {
      state.values[entry.row][entry.col] = entry.prevValue;
      state.notes[entry.row][entry.col] = entry.prevNotes.slice();
      restorePeerNotes(entry.peerNoteRemovals);
      state.completed = false;
    }
    state.selected = { row: entry.row, col: entry.col };
    persist(true);
    render();
  }

  function checkCompletion() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.values[r][c] !== state.solution[r][c]) return;
      }
    }
    state.completed = true;
    els.completionLevel.textContent =
      window.Generator.DIFFICULTY_CONFIG[state.difficulty].label;
    els.completionTime.textContent = formatTime(state.elapsedSeconds);
    els.completionMistakes.textContent = state.mistakes;
    openOverlay(els.completionOverlay);
  }

  function checkMistakeLimit() {
    if (state.completed) return;
    if (isLimitReached()) openOverlay(els.limitOverlay);
  }

  // ---------- selection ----------

  function selectCell(row, col) {
    if (isBoardLocked()) return;
    state.selected = { row, col };
    render();
  }

  function moveSelection(dr, dc) {
    if (isBoardLocked()) return;
    const base = state.selected || { row: 0, col: 0 };
    const row = (base.row + dr + 9) % 9;
    const col = (base.col + dc + 9) % 9;
    state.selected = { row, col };
    render();
  }

  // ---------- overlays ----------

  function openOverlay(el) {
    el.hidden = false;
    updateTimerRunning();
  }

  function closeOverlay(el) {
    el.hidden = true;
    updateTimerRunning();
  }

  function openNewGameSheet() {
    renderLevelList();
    openOverlay(els.newGameOverlay);
  }

  function renderLevelList() {
    els.levelList.innerHTML = "";
    for (const level of window.Generator.DIFFICULTY_LEVELS) {
      const config = window.Generator.DIFFICULTY_CONFIG[level];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "sheet-row level-row";
      row.dataset.level = level;

      const textWrap = document.createElement("span");
      textWrap.className = "level-row-text";
      const nameEl = document.createElement("span");
      nameEl.className = `level-name level-${level}`;
      nameEl.textContent = config.label;
      const countEl = document.createElement("span");
      countEl.className = "level-count";
      countEl.textContent = `~${config.minGivens}–${config.maxGivens} givens`;
      textWrap.appendChild(nameEl);
      textWrap.appendChild(countEl);
      row.appendChild(textWrap);

      if (level === state.difficulty) {
        const marker = document.createElement("span");
        marker.className = "level-active-marker";
        marker.textContent = "Current";
        row.appendChild(marker);
      }

      row.addEventListener("click", () => {
        closeOverlay(els.newGameOverlay);
        startNewPuzzle(level);
      });
      els.levelList.appendChild(row);
    }
  }

  // Higher difficulties can take a couple of seconds to generate (the
  // logic-solver gating in Generator.generatePuzzle runs many trial solves
  // per puzzle) — show the board's loading overlay and defer the actual
  // (synchronous, main-thread-blocking) generation a tick so the browser
  // gets to paint it first, instead of just freezing with no feedback.
  function startNewPuzzle(level) {
    els.generatingOverlay.hidden = false;
    setTimeout(() => {
      state = newPuzzleState(level);
      persist(true);
      render();
      els.generatingOverlay.hidden = true;
    }, 30);
  }

  function restartCurrentPuzzle() {
    state = restartPuzzleState(state);
    persist(true);
    render();
  }

  // ---------- event wiring ----------

  els.board.addEventListener("click", (e) => {
    const cellEl = e.target.closest(".cell");
    if (!cellEl) return;
    selectCell(Number(cellEl.dataset.row), Number(cellEl.dataset.col));
  });

  els.undoBtn.addEventListener("click", undo);
  els.eraseBtn.addEventListener("click", eraseSelected);
  els.modeNormalBtn.addEventListener("click", () => {
    state.notesMode = false;
    render();
  });
  els.modeNotesBtn.addEventListener("click", () => {
    state.notesMode = true;
    render();
  });

  els.pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    persist(true);
    render();
  });
  els.resumeBtn.addEventListener("click", () => {
    state.paused = false;
    persist(true);
    render();
  });

  els.newGameBtn.addEventListener("click", openNewGameSheet);
  els.difficultyStat.addEventListener("click", openNewGameSheet);
  els.newGameCancel.addEventListener("click", () =>
    closeOverlay(els.newGameOverlay)
  );
  els.newGameOverlay.addEventListener("click", (e) => {
    if (e.target === els.newGameOverlay) closeOverlay(els.newGameOverlay);
  });
  els.restartBtn.addEventListener("click", () => {
    closeOverlay(els.newGameOverlay);
    restartCurrentPuzzle();
  });

  function onSettingChange(key, value) {
    settings[key] = value;
    window.Storage.saveSettings(settings);
    window.SettingsUI.renderSettings(els.settingsBody, settings, onSettingChange);
    render();
  }

  els.settingsBtn.addEventListener("click", () => {
    window.SettingsUI.renderSettings(els.settingsBody, settings, onSettingChange);
    openOverlay(els.settingsScreen);
  });
  els.settingsBackBtn.addEventListener("click", () => {
    closeOverlay(els.settingsScreen);
    checkMistakeLimit();
    render();
  });

  els.completionNewGame.addEventListener("click", () => {
    closeOverlay(els.completionOverlay);
    openNewGameSheet();
  });
  els.completionClose.addEventListener("click", () =>
    closeOverlay(els.completionOverlay)
  );

  els.limitRestart.addEventListener("click", () => {
    closeOverlay(els.limitOverlay);
    restartCurrentPuzzle();
  });
  els.limitNewGame.addEventListener("click", () => {
    closeOverlay(els.limitOverlay);
    openNewGameSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (
      !els.newGameOverlay.hidden ||
      !els.settingsScreen.hidden ||
      !els.completionOverlay.hidden ||
      !els.limitOverlay.hidden
    ) {
      return;
    }
    if (e.key >= "1" && e.key <= "9") {
      commitDigit(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      eraseSelected();
    } else if (e.key === "ArrowUp") {
      moveSelection(-1, 0);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      moveSelection(1, 0);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      moveSelection(0, -1);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      moveSelection(0, 1);
      e.preventDefault();
    }
  });

  window.addEventListener("beforeunload", () => persist(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist(true);
  });

  // ---------- boot ----------

  function checkLimitOnBoot() {
    if (isLimitReached()) openOverlay(els.limitOverlay);
  }

  function boot() {
    cells = window.Board.buildBoard(els.board);
    padButtons = window.Board.buildNumberPad(els.numberPad, (digit) => {
      if (isLimitReached()) return;
      commitDigit(digit);
    });
    els.numberPad.appendChild(els.eraseBtn);

    state = loadOrCreateState();
    persist(true);
    checkLimitOnBoot();
    render();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      });
    }
  }

  boot();
})();
