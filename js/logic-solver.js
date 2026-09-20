// Human-technique logic solver. Used to rate a puzzle's true difficulty
// (the hardest deduction it ever requires) and to guarantee generated
// puzzles never bottom out into needing a guess — unlike the raw
// backtracking solver in solver.js, this only ever places a digit when a
// technique below or at a chosen tier justifies it, and reports whether it
// was able to finish the grid that way.
//
// Tiers (lower = easier, matches DIFFICULTY_LEVELS order in generator.js):
//   1 - naked single, hidden single
//   2 - pointing/box-line locked candidates, naked pair, hidden pair
//   3 - naked triple, hidden triple, X-Wing
//   4 - naked quad, hidden quad, swordfish, XY-Wing
//
// Candidates are represented as 9-bit masks (bit i-1 set => digit i possible).

function popcount(mask) {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

function bitList(mask) {
  const digits = [];
  for (let d = 1; d <= 9; d++) {
    if (mask & (1 << (d - 1))) digits.push(d);
  }
  return digits;
}

function combinations(items, k) {
  const result = [];
  const combo = [];
  function helper(start) {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      helper(i + 1);
      combo.pop();
    }
  }
  helper(0);
  return result;
}

function buildUnits() {
  const units = [];
  for (let r = 0; r < 9; r++) {
    units.push(Array.from({ length: 9 }, (_, c) => [r, c]));
  }
  for (let c = 0; c < 9; c++) {
    units.push(Array.from({ length: 9 }, (_, r) => [r, c]));
  }
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const cells = [];
      for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
        for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) cells.push([r, c]);
      }
      units.push(cells);
    }
  }
  return units;
}

const UNITS = buildUnits();
const BOXES = UNITS.slice(18, 27);
const ROWS = UNITS.slice(0, 9);
const COLS = UNITS.slice(9, 18);
const ALL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function sees(r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return false;
  if (r1 === r2 || c1 === c2) return true;
  return Math.floor(r1 / 3) === Math.floor(r2 / 3) && Math.floor(c1 / 3) === Math.floor(c2 / 3);
}

function computeCandidates(grid) {
  const cand = Array.from({ length: 9 }, () => new Array(9).fill(0));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      let mask = 0x1ff;
      for (let i = 0; i < 9; i++) {
        if (grid[r][i]) mask &= ~(1 << (grid[r][i] - 1));
        if (grid[i][c]) mask &= ~(1 << (grid[i][c] - 1));
      }
      const boxRow = r - (r % 3);
      const boxCol = c - (c % 3);
      for (let br = boxRow; br < boxRow + 3; br++) {
        for (let bc = boxCol; bc < boxCol + 3; bc++) {
          if (grid[br][bc]) mask &= ~(1 << (grid[br][bc] - 1));
        }
      }
      cand[r][c] = mask;
    }
  }
  return cand;
}

// Runs the technique battery to completion (or until stuck). Returns
// { solved, maxTier }: `solved` is false if the grid could not be finished
// without a technique beyond what's implemented (i.e. it would need a
// guess); `maxTier` is the hardest technique tier actually used.
//
// `options.tierLimit` skips techniques above that tier entirely — safe
// whenever the caller only cares whether the puzzle solves within some
// ceiling anyway (getting stuck at tier <= ceiling is rejected the same
// way whether or not a higher tier could have rescued it), and it's a lot
// cheaper since the expensive fish/XY-Wing scans are the ones being
// skipped. `options.timeBudgetMs` bounds a single call's wall-clock cost:
// this runs from scratch hundreds of times per puzzle generated (once per
// trial cell removal), so without a cap a single pathological grid can
// block the main thread for tens of seconds. Exceeding the budget bails
// out and conservatively reports unsolved — never a false "safe to remove".
function solveWithTechniques(grid, options) {
  const tierLimit = (options && options.tierLimit) || 4;
  const timeBudgetMs = (options && options.timeBudgetMs) || Infinity;
  const deadline = performance.now() + timeBudgetMs;
  const g = window.Solver.cloneGrid(grid);
  const cand = computeCandidates(g);
  let maxTier = 0;
  let remaining = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (g[r][c] === 0) remaining++;

  function placeDigit(r, c, digit, tier) {
    g[r][c] = digit;
    cand[r][c] = 0;
    remaining--;
    maxTier = Math.max(maxTier, tier);
    const bit = 1 << (digit - 1);
    for (let i = 0; i < 9; i++) {
      if (i !== c) cand[r][i] &= ~bit;
      if (i !== r) cand[i][c] &= ~bit;
    }
    const boxRow = r - (r % 3);
    const boxCol = c - (c % 3);
    for (let br = boxRow; br < boxRow + 3; br++) {
      for (let bc = boxCol; bc < boxCol + 3; bc++) {
        if (br !== r || bc !== c) cand[br][bc] &= ~bit;
      }
    }
  }

  function eliminate(r, c, removeMask, tier) {
    const before = cand[r][c];
    const after = before & ~removeMask;
    if (after === before) return false;
    cand[r][c] = after;
    maxTier = Math.max(maxTier, tier);
    return true;
  }

  function tryNakedSingles() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0 && popcount(cand[r][c]) === 1) {
          placeDigit(r, c, bitList(cand[r][c])[0], 1);
          return true;
        }
      }
    }
    return false;
  }

  function tryHiddenSingles() {
    for (const unit of UNITS) {
      for (const digit of ALL_DIGITS) {
        const bit = 1 << (digit - 1);
        let found = null;
        let count = 0;
        for (const [r, c] of unit) {
          if (g[r][c] === 0 && cand[r][c] & bit) {
            count++;
            found = [r, c];
            if (count > 1) break;
          }
        }
        if (count === 1) {
          placeDigit(found[0], found[1], digit, 1);
          return true;
        }
      }
    }
    return false;
  }

  function tryLockedCandidates() {
    for (const box of BOXES) {
      for (const digit of ALL_DIGITS) {
        const bit = 1 << (digit - 1);
        const cells = box.filter(([r, c]) => g[r][c] === 0 && cand[r][c] & bit);
        if (cells.length < 2) continue;
        const rowsSet = new Set(cells.map(([r]) => r));
        if (rowsSet.size === 1) {
          const r = [...rowsSet][0];
          let changed = false;
          for (let c = 0; c < 9; c++) {
            if (g[r][c] === 0 && !cells.some(([, cc]) => cc === c) && eliminate(r, c, bit, 2)) changed = true;
          }
          if (changed) return true;
        }
        const colsSet = new Set(cells.map(([, c]) => c));
        if (colsSet.size === 1) {
          const c = [...colsSet][0];
          let changed = false;
          for (let r = 0; r < 9; r++) {
            if (g[r][c] === 0 && !cells.some(([rr]) => rr === r) && eliminate(r, c, bit, 2)) changed = true;
          }
          if (changed) return true;
        }
      }
    }
    for (const line of [...ROWS, ...COLS]) {
      for (const digit of ALL_DIGITS) {
        const bit = 1 << (digit - 1);
        const cells = line.filter(([r, c]) => g[r][c] === 0 && cand[r][c] & bit);
        if (cells.length < 2) continue;
        const boxIds = new Set(cells.map(([r, c]) => Math.floor(r / 3) * 3 + Math.floor(c / 3)));
        if (boxIds.size !== 1) continue;
        const boxCells = BOXES[[...boxIds][0]];
        let changed = false;
        for (const [r, c] of boxCells) {
          if (g[r][c] === 0 && !cells.some(([rr, cc]) => rr === r && cc === c) && eliminate(r, c, bit, 2)) {
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
    return false;
  }

  function tryNakedSubsets(n, tier) {
    for (const unit of UNITS) {
      const candidates = unit.filter(([r, c]) => {
        if (g[r][c] !== 0) return false;
        const pc = popcount(cand[r][c]);
        return pc >= 2 && pc <= n;
      });
      if (candidates.length < n) continue;
      for (const combo of combinations(candidates, n)) {
        let unionMask = 0;
        for (const [r, c] of combo) unionMask |= cand[r][c];
        if (popcount(unionMask) !== n) continue;
        let changed = false;
        for (const [r, c] of unit) {
          if (g[r][c] !== 0) continue;
          if (combo.some(([cr, cc]) => cr === r && cc === c)) continue;
          if (eliminate(r, c, unionMask, tier)) changed = true;
        }
        if (changed) return true;
      }
    }
    return false;
  }

  function tryHiddenSubsets(n, tier) {
    const digitCombos = combinations(ALL_DIGITS, n);
    for (const unit of UNITS) {
      const emptyCells = unit.filter(([r, c]) => g[r][c] === 0);
      if (emptyCells.length <= n) continue;
      for (const digits of digitCombos) {
        const mask = digits.reduce((m, d) => m | (1 << (d - 1)), 0);
        const cells = emptyCells.filter(([r, c]) => cand[r][c] & mask);
        if (cells.length !== n) continue;
        let changed = false;
        for (const [r, c] of cells) {
          if (eliminate(r, c, cand[r][c] & ~mask, tier)) changed = true;
        }
        if (changed) return true;
      }
    }
    return false;
  }

  function tryFish(n, tier) {
    for (const digit of ALL_DIGITS) {
      const bit = 1 << (digit - 1);
      if (findFish(bit, n, tier, "row")) return true;
      if (findFish(bit, n, tier, "col")) return true;
    }
    return false;
  }

  function findFish(bit, n, tier, baseType) {
    const lines = [];
    for (let i = 0; i < 9; i++) {
      const positions = [];
      for (let j = 0; j < 9; j++) {
        const [r, c] = baseType === "row" ? [i, j] : [j, i];
        if (g[r][c] === 0 && cand[r][c] & bit) positions.push(j);
      }
      if (positions.length >= 1 && positions.length <= n) lines.push({ index: i, positions });
    }
    if (lines.length < n) return false;
    for (const combo of combinations(lines, n)) {
      const unionCross = new Set();
      combo.forEach((line) => line.positions.forEach((p) => unionCross.add(p)));
      if (unionCross.size !== n) continue;
      const baseIndices = new Set(combo.map((line) => line.index));
      let changed = false;
      for (const crossIdx of unionCross) {
        for (let i = 0; i < 9; i++) {
          if (baseIndices.has(i)) continue;
          const [r, c] = baseType === "row" ? [i, crossIdx] : [crossIdx, i];
          if (g[r][c] === 0 && eliminate(r, c, bit, tier)) changed = true;
        }
      }
      if (changed) return true;
    }
    return false;
  }

  function tryXYWing() {
    const biCells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0 && popcount(cand[r][c]) === 2) biCells.push([r, c]);
      }
    }
    for (const [pr, pc] of biCells) {
      const [x, y] = bitList(cand[pr][pc]);
      const xBit = 1 << (x - 1);
      const yBit = 1 << (y - 1);
      const pincersX = biCells.filter(
        ([r, c]) => (r !== pr || c !== pc) && sees(pr, pc, r, c) && cand[r][c] & xBit && !(cand[r][c] & yBit)
      );
      const pincersY = biCells.filter(
        ([r, c]) => (r !== pr || c !== pc) && sees(pr, pc, r, c) && cand[r][c] & yBit && !(cand[r][c] & xBit)
      );
      for (const [r1, c1] of pincersX) {
        const zBit1 = cand[r1][c1] & ~xBit;
        for (const [r2, c2] of pincersY) {
          if (r1 === r2 && c1 === c2) continue;
          const zBit2 = cand[r2][c2] & ~yBit;
          if (zBit1 !== zBit2) continue;
          let changed = false;
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (g[r][c] !== 0) continue;
              if ((r === pr && c === pc) || (r === r1 && c === c1) || (r === r2 && c === c2)) continue;
              if (sees(r1, c1, r, c) && sees(r2, c2, r, c) && eliminate(r, c, zBit1, 4)) changed = true;
            }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  // Checked between every individual technique, not just once per outer
  // iteration: when a grid is stuck, nothing short-circuits via `continue`
  // and the loop falls through the whole chain — including the expensive
  // fish/XY-Wing scans — before it can declare failure. A single check at
  // the top of the loop wouldn't stop that; this lets the budget actually
  // skip the pricier techniques once time is up instead of paying for them
  // and then bailing anyway.
  while (remaining > 0) {
    if (tryNakedSingles()) continue;
    if (performance.now() >= deadline) break;
    if (tryHiddenSingles()) continue;
    if (performance.now() >= deadline) break;
    if (tierLimit >= 2 && tryLockedCandidates()) continue;
    if (performance.now() >= deadline) break;
    if (tierLimit >= 2 && tryNakedSubsets(2, 2)) continue;
    if (performance.now() >= deadline) break;
    if (tierLimit >= 2 && tryHiddenSubsets(2, 2)) continue;
    if (tierLimit < 3) break;
    if (performance.now() >= deadline) break;
    if (tryNakedSubsets(3, 3)) continue;
    if (performance.now() >= deadline) break;
    if (tryHiddenSubsets(3, 3)) continue;
    if (performance.now() >= deadline) break;
    if (tryFish(2, 3)) continue;
    if (tierLimit < 4) break;
    if (performance.now() >= deadline) break;
    if (tryNakedSubsets(4, 4)) continue;
    if (performance.now() >= deadline) break;
    if (tryHiddenSubsets(4, 4)) continue;
    if (performance.now() >= deadline) break;
    if (tryFish(3, 4)) continue;
    if (performance.now() >= deadline) break;
    if (tryXYWing()) continue;
    break;
  }

  return { solved: remaining === 0, maxTier };
}

window.LogicSolver = {
  solveWithTechniques,
};
