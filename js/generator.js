// Puzzle generation: full solution via backtracking, then cell removal
// while preserving a unique solution.

const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"];

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", minGivens: 36, maxGivens: 40 },
  medium: { label: "Medium", minGivens: 30, maxGivens: 32 },
  hard: { label: "Hard", minGivens: 27, maxGivens: 29 },
  expert: { label: "Expert", minGivens: 22, maxGivens: 25 },
};

function makeRng(seed) {
  // Small mulberry32 PRNG so generation is reproducible if ever needed;
  // seeded from Date.now() + a random salt for normal play.
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyGrid() {
  return Array.from({ length: 9 }, () => new Array(9).fill(0));
}

function fillDiagonalBoxes(grid, rng) {
  for (let box = 0; box < 3; box++) {
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    let idx = 0;
    const start = box * 3;
    for (let r = start; r < start + 3; r++) {
      for (let c = start; c < start + 3; c++) {
        grid[r][c] = digits[idx++];
      }
    }
  }
}

function generateSolution(rng) {
  const grid = emptyGrid();
  fillDiagonalBoxes(grid, rng);
  window.Solver.solveGrid(grid, rng);
  return grid;
}

function shuffledCellOrder(rng) {
  const cells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) cells.push([r, c]);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

function removeCells(solution, targetGivens, rng) {
  const puzzle = window.Solver.cloneGrid(solution);
  const order = shuffledCellOrder(rng);
  let givens = 81;

  for (const [row, col] of order) {
    if (givens <= targetGivens) break;
    const backup = puzzle[row][col];
    if (backup === 0) continue;
    puzzle[row][col] = 0;

    if (window.Solver.countSolutions(puzzle, 2) !== 1) {
      puzzle[row][col] = backup;
      continue;
    }
    givens--;
  }

  return puzzle;
}

// Generates a fresh puzzle for the given difficulty. Returns
// { puzzle, solution, givenCount }.
function generatePuzzle(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const targetGivens =
    config.minGivens +
    Math.floor(rng() * (config.maxGivens - config.minGivens + 1));

  const solution = generateSolution(rng);
  const puzzle = removeCells(solution, targetGivens, rng);
  const givenCount = puzzle.reduce(
    (sum, row) => sum + row.filter((v) => v !== 0).length,
    0
  );

  return { puzzle, solution, givenCount };
}

window.Generator = {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  generatePuzzle,
};
