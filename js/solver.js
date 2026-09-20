// Core Sudoku rule-checking and backtracking solver.
// Grids are flat-ish 9x9 arrays of arrays, 0 = empty cell.

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function isValidPlacement(grid, row, col, value) {
  for (let i = 0; i < 9; i++) {
    if (i !== col && grid[row][i] === value) return false;
    if (i !== row && grid[i][col] === value) return false;
  }
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) return false;
    }
  }
  return true;
}

// Finds all cells in the same row/col/box as (row, col) that currently
// hold the same value as `value` — used for the "highlight duplicates" assist.
function findConflictCells(grid, row, col, value) {
  const conflicts = [];
  if (!value) return conflicts;
  for (let i = 0; i < 9; i++) {
    if (i !== col && grid[row][i] === value) conflicts.push([row, i]);
    if (i !== row && grid[i][col] === value) conflicts.push([i, col]);
  }
  const boxRow = row - (row % 3);
  const boxCol = col - (col % 3);
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) {
        if (!conflicts.some(([cr, cc]) => cr === r && cc === c)) {
          conflicts.push([r, c]);
        }
      }
    }
  }
  return conflicts;
}

function findEmptyCell(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function shuffledDigits(rng) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

// Solves in place (backtracking). Digit order is randomized when `rng` is
// given (used for puzzle generation); otherwise ascending (deterministic,
// used for uniqueness checks / hints).
function solveGrid(grid, rng) {
  const empty = findEmptyCell(grid);
  if (!empty) return true;
  const [row, col] = empty;
  const digits = rng ? shuffledDigits(rng) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const digit of digits) {
    if (isValidPlacement(grid, row, col, digit)) {
      grid[row][col] = digit;
      if (solveGrid(grid, rng)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

function getSolvedGrid(grid, rng) {
  const copy = cloneGrid(grid);
  return solveGrid(copy, rng) ? copy : null;
}

// Counts solutions up to `limit` (default 2) and stops early — used to
// confirm a generated puzzle has a unique solution without over-searching.
function countSolutions(grid, limit = 2) {
  let count = 0;
  const working = cloneGrid(grid);

  function backtrack() {
    if (count >= limit) return;
    const empty = findEmptyCell(working);
    if (!empty) {
      count++;
      return;
    }
    const [row, col] = empty;
    for (let digit = 1; digit <= 9; digit++) {
      if (count >= limit) return;
      if (isValidPlacement(working, row, col, digit)) {
        working[row][col] = digit;
        backtrack();
        working[row][col] = 0;
      }
    }
  }

  backtrack();
  return count;
}

function isGridComplete(grid) {
  return findEmptyCell(grid) === null;
}

window.Solver = {
  cloneGrid,
  isValidPlacement,
  findConflictCells,
  solveGrid,
  getSolvedGrid,
  countSolutions,
  isGridComplete,
};
