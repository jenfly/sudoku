// Board rendering: builds the 9x9 grid + number pad DOM once, then updates
// classes/text in place whenever state changes. No state is owned here —
// app.js passes in the current state/settings on every render() call.

function buildBoard(container) {
  container.innerHTML = "";
  const cells = [];
  for (let r = 0; r < 9; r++) {
    cells.push([]);
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("tabindex", "-1");

      if (c % 3 === 2 && c !== 8) cell.classList.add("box-edge-right");
      if (r % 3 === 2 && r !== 8) cell.classList.add("box-edge-bottom");

      const valueEl = document.createElement("span");
      valueEl.className = "cell-value";
      cell.appendChild(valueEl);

      const notesEl = document.createElement("div");
      notesEl.className = "cell-notes";
      for (let n = 1; n <= 9; n++) {
        const noteEl = document.createElement("span");
        noteEl.className = "cell-note";
        noteEl.dataset.digit = n;
        noteEl.textContent = n;
        notesEl.appendChild(noteEl);
      }
      cell.appendChild(notesEl);

      cells[r].push(cell);
      container.appendChild(cell);
    }
  }
  return cells;
}

function updateBoard(cells, state, settings) {
  const { puzzle, solution, hints, selected } = state;
  const selectedValue =
    selected && puzzle.values[selected.row][selected.col] !== 0
      ? puzzle.values[selected.row][selected.col]
      : null;

  let conflictSet = null;
  if (settings.highlightDuplicates) {
    conflictSet = new Set();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = puzzle.values[r][c];
        if (!val) continue;
        const conflicts = window.Solver.findConflictCells(
          puzzle.values,
          r,
          c,
          val
        );
        if (conflicts.length) conflictSet.add(`${r},${c}`);
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = cells[r][c];
      const value = puzzle.values[r][c];
      const isGiven = puzzle.givens[r][c] !== 0;
      const isHinted = hints.cells[r][c];
      const isSelected = !!selected && selected.row === r && selected.col === c;
      const isWrong =
        !isGiven &&
        !isHinted &&
        value !== 0 &&
        value !== solution[r][c] &&
        settings.autoCheckMistakes;
      const isConflict = conflictSet ? conflictSet.has(`${r},${c}`) : false;

      cell.classList.toggle("is-given", isGiven);
      cell.classList.toggle("is-hinted", isHinted);
      cell.classList.toggle("is-user", !isGiven && !isHinted && value !== 0);
      cell.classList.toggle("is-selected", isSelected);
      cell.classList.toggle("is-error", isWrong || isConflict);
      cell.classList.toggle(
        "is-peer",
        !isSelected && settings.highlightPeers && isPeer(selected, r, c)
      );
      cell.classList.toggle(
        "is-same-value",
        !isSelected &&
          settings.highlightSameNumber &&
          selectedValue !== null &&
          value === selectedValue
      );

      const valueEl = cell.firstChild;
      const notesEl = cell.lastChild;

      if (value !== 0) {
        valueEl.textContent = value;
        valueEl.hidden = false;
        notesEl.hidden = true;
      } else {
        valueEl.hidden = true;
        const cellNotes = puzzle.notes[r][c];
        let hasAny = false;
        for (let n = 1; n <= 9; n++) {
          const has = cellNotes.includes(n);
          if (has) hasAny = true;
          notesEl.children[n - 1].classList.toggle("is-active", has);
        }
        notesEl.hidden = !hasAny;
      }
    }
  }
}

function isPeer(selected, r, c) {
  if (!selected) return false;
  if (selected.row === r && selected.col === c) return false;
  if (selected.row === r) return true;
  if (selected.col === c) return true;
  const sBoxRow = Math.floor(selected.row / 3);
  const sBoxCol = Math.floor(selected.col / 3);
  return Math.floor(r / 3) === sBoxRow && Math.floor(c / 3) === sBoxCol;
}

function buildNumberPad(container, onDigit) {
  container.innerHTML = "";
  const buttons = [];
  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "num-btn";
    btn.dataset.digit = d;

    const digitEl = document.createElement("span");
    digitEl.className = "num-digit";
    digitEl.textContent = d;
    btn.appendChild(digitEl);

    const badgeEl = document.createElement("span");
    badgeEl.className = "num-badge";
    btn.appendChild(badgeEl);

    btn.addEventListener("click", () => onDigit(d));
    buttons.push(btn);
    container.appendChild(btn);
  }
  return buttons;
}

function updateNumberPad(buttons, puzzle, solution) {
  for (let d = 1; d <= 9; d++) {
    let placed = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle.values[r][c] === d && solution[r][c] === d) placed++;
      }
    }
    const remaining = 9 - placed;
    const btn = buttons[d - 1];
    btn.querySelector(".num-badge").textContent = remaining > 0 ? remaining : "";
    btn.disabled = remaining <= 0;
    btn.classList.toggle("is-depleted", remaining <= 0);
  }
}

window.Board = {
  buildBoard,
  updateBoard,
  buildNumberPad,
  updateNumberPad,
};
