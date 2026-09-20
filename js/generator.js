// Puzzle generation: full solution via backtracking, then cell removal
// while preserving a unique solution.

const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"];

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", minGivens: 36, maxGivens: 40 },
  medium: { label: "Medium", minGivens: 30, maxGivens: 32 },
  hard: { label: "Hard", minGivens: 27, maxGivens: 29 },
  expert: { label: "Expert", minGivens: 22, maxGivens: 25 },
};

// Ceiling on the hardest human technique (see js/logic-solver.js tiers) a
// puzzle at this level is allowed to need. A removal that would force a
// higher tier — or that leaves the grid unsolvable by any implemented
// technique at all, i.e. it would require guessing — is rejected regardless
// of difficulty.
const DIFFICULTY_TIER_CEILING = { easy: 1, medium: 2, hard: 3, expert: 4 };

// Floor on the hardest technique a puzzle at this level must need, so
// "Hard"/"Expert" can't come back out feeling like Medium with fewer clues
// just because a particular random removal order happened to stay
// singles-solvable. generatePuzzle retries (bounded) to try to clear this;
// if it can't, it falls back to the hardest candidate it found rather than
// looping indefinitely. Capped at 2 (not the tier-3/4 techniques the
// ceiling allows) because empirically, random uniqueness-preserving
// removal only rarely produces a grid that actually *requires* triples,
// fish, or XY-Wing regardless of how many attempts are thrown at it —
// forcing a higher floor mostly burns retries without ever succeeding.
// When luck does produce a genuinely tier-3/4 puzzle, the ceiling still
// lets it through.
const DIFFICULTY_TIER_FLOOR = { easy: 1, medium: 1, hard: 2, expert: 2 };

// Per-level retry cap for hitting the tier floor, as a sanity bound on top
// of the wall-clock budget below (see generatePuzzle) — cheap attempts
// (easy/medium/hard) could otherwise spin past their time budget doing
// many near-instant retries for no benefit once the floor is unreachable.
const DIFFICULTY_MAX_ATTEMPTS = { easy: 1, medium: 1, hard: 20, expert: 4 };

// Wall-clock budget for the *whole* generatePuzzle call (all attempts and
// all passes within removeCells combined). countSolutions is a plain
// backtracking search with no early-exit budget of its own, and proving a
// near-minimal-clue grid's uniqueness can occasionally be genuinely slow —
// with the tier-ceiling check added, generation retries removals (and
// whole attempts) far more than the original given-count-only version did,
// which multiplies how many times that slow path can be hit. Checked
// between cell trials and between attempts (never mid-call, since a
// synchronous call can't be preempted), so the true worst case is this
// budget plus roughly one more slow countSolutions call — far better than
// the unbounded search this replaced, which measured up to ~68s on a
// pathological grid.
const DIFFICULTY_TOTAL_BUDGET_MS = { easy: 300, medium: 300, hard: 1200, expert: 2500 };

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

// Removes cells while preserving both a unique solution and solvability by
// human technique (never worse than `tierCeiling`, see logic-solver.js) —
// a removal that would break either is rejected and the given put back.
// Makes a few passes over the remaining givens since a stricter tier
// ceiling means not every cell that could be removed for uniqueness alone
// is removable on the first attempt at reaching targetGivens.
// Returns { puzzle, maxTier }, where maxTier is the tier the final puzzle
// actually needed (from the last accepted removal's check — recomputing it
// after the fact would just repeat that exact solve). Stops early (keeping
// whatever valid state it has reached) once `deadline` (a performance.now()
// timestamp) passes.
function removeCells(solution, targetGivens, tierCeiling, rng, deadline) {
  const puzzle = window.Solver.cloneGrid(solution);
  let givens = 81;
  let maxTier = 0;

  for (let pass = 0; pass < 4 && givens > targetGivens; pass++) {
    if (performance.now() >= deadline) break;
    const order = shuffledCellOrder(rng).filter(([row, col]) => puzzle[row][col] !== 0);
    let removedThisPass = false;

    for (const [row, col] of order) {
      if (givens <= targetGivens) break;
      if (performance.now() >= deadline) break;
      const backup = puzzle[row][col];
      puzzle[row][col] = 0;

      if (window.Solver.countSolutions(puzzle, 2) !== 1) {
        puzzle[row][col] = backup;
        continue;
      }

      // Called from scratch on every trial removal (hundreds of times per
      // generated puzzle) — tierLimit skips techniques above the ceiling
      // (irrelevant either way, since getting stuck within the ceiling is
      // already a rejection) and timeBudgetMs bounds a single pathological
      // call so a rare bad grid can't stall the whole generation.
      const result = window.LogicSolver.solveWithTechniques(puzzle, {
        tierLimit: tierCeiling,
        timeBudgetMs: 2,
      });
      if (!result.solved || result.maxTier > tierCeiling) {
        puzzle[row][col] = backup;
        continue;
      }

      givens--;
      maxTier = result.maxTier;
      removedThisPass = true;
    }

    if (!removedThisPass) break;
  }

  return { puzzle, maxTier };
}

// Generates a fresh puzzle for the given difficulty. Returns
// { puzzle, solution, givenCount }.
function generatePuzzle(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const tierCeiling = DIFFICULTY_TIER_CEILING[difficulty] || DIFFICULTY_TIER_CEILING.medium;
  const tierFloor = DIFFICULTY_TIER_FLOOR[difficulty] || DIFFICULTY_TIER_FLOOR.medium;
  const maxAttempts = DIFFICULTY_MAX_ATTEMPTS[difficulty] || DIFFICULTY_MAX_ATTEMPTS.medium;
  const totalBudget = DIFFICULTY_TOTAL_BUDGET_MS[difficulty] || DIFFICULTY_TOTAL_BUDGET_MS.medium;
  const deadline = performance.now() + totalBudget;

  let best = null;
  let bestMaxTier = -1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const targetGivens =
      config.minGivens +
      Math.floor(rng() * (config.maxGivens - config.minGivens + 1));

    const solution = generateSolution(rng);
    const { puzzle, maxTier } = removeCells(solution, targetGivens, tierCeiling, rng, deadline);
    const givenCount = puzzle.reduce(
      (sum, row) => sum + row.filter((v) => v !== 0).length,
      0
    );

    const candidate = { puzzle, solution, givenCount };
    if (maxTier >= tierFloor) return candidate;
    if (!best || maxTier > bestMaxTier) {
      best = candidate;
      bestMaxTier = maxTier;
    }
    if (performance.now() >= deadline) break;
  }

  return best;
}

window.Generator = {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  generatePuzzle,
};
