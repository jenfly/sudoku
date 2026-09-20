# Sudoku PWA — Design & Build Plan

## 1. Overview

A mobile-friendly, installable Sudoku web app (PWA). Fully client-side —
puzzle generation, solving/validation, and all state live in the browser.
No backend, no accounts, no server.

- **Platform:** Progressive Web App (PWA) — installable via "Add to Home
  Screen," works offline after first load.
- **Stack:** Plain HTML/CSS/JS (no framework required — the UI is simple
  enough that vanilla JS keeps the bundle small and fast).
- **Hosting:** Static hosting, e.g. GitHub Pages (free, HTTPS by default,
  required for service worker/PWA installability).
- **Storage:** `localStorage` (or `IndexedDB` if state grows complex) for
  puzzle-in-progress, settings, and last-used level. No server-side
  persistence needed.

## 2. App launch behavior

On open, the app goes **directly to the Game screen** — there is no
separate home/menu screen.

- If a puzzle is in progress (saved state exists): resume it exactly
  where it was left off (board state, notes, timer, mistake count).
- If no puzzle is in progress: generate a **new puzzle at the last-used
  difficulty level** (defaults to Medium on first-ever launch).
- The last-used difficulty level is always persisted, independent of
  whether a puzzle is mid-solve.

## 3. Screens

### 3.1 Game screen (default/primary view)

**Top bar**
- "Sudoku" wordmark, left.
- **New Game** button, right (opens the New Game sheet — see 3.2).
- Settings icon button, right (opens Settings — see 3.3).

**Stats card** (below top bar)
- **Difficulty** — shows current level name (e.g. "Medium"), tappable —
  opens the New Game sheet, same as the New Game button.
- **Mistakes** — `current/3` display. This is a **counter only, never a
  hard limit** — the puzzle never ends or locks because mistakes were
  made. Visibility of this counter is a Settings toggle.
- **Time** — elapsed time (mm:ss) with a pause button. Visibility is a
  Settings toggle.

**9×9 board**
- Standard grid with bold 3×3 box borders.
- **Given numbers**: bold, neutral ink color, not editable.
- **User-entered numbers**: distinct color from givens (e.g. blue) so
  it's clear what you typed vs. what was pre-filled.
- **Selected cell**: highlighted background.
- **Peer highlighting** (same row/column/box as selection): optional,
  subtle background tint — controlled by a Settings toggle.
- **Same-number highlighting** (all cells matching the selected digit):
  optional — controlled by a Settings toggle.
- **Auto-check mistakes**: when on, a number that violates Sudoku rules
  is immediately shown in an error color (e.g. red) — controlled by a
  Settings toggle.
- **Pencil marks / notes**: small 3×3 sub-grid of candidate numbers
  inside a cell, rendered smaller and in a muted color.

**Toolbar** (above number pad)
- **Undo** — steps back through the move history.
- **Notes** — a **toggle button** (not long-press). While active,
  tapping a digit on the number pad adds/removes that digit as a pencil
  mark in the selected cell instead of committing it as the final
  answer. Toggle again to return to normal entry mode.
- **Erase** — clears the selected cell's value or notes.
- **Hint** — reveals or assists with the selected cell; show a remaining
  hint count if hints are limited (open design question — see §7).

**Number pad**
- Digits 1–9, each button optionally showing a small badge with the
  count of that digit remaining to be placed (9 minus how many are
  already correctly placed on the board). A digit with 0 remaining is
  shown disabled/greyed out.

### 3.2 New Game sheet (modal, over the Game screen)

Opened via the "New Game" button or by tapping the Difficulty stat.
Presented as a bottom sheet over a dimmed/blurred Game screen.

- Title: "New puzzle."
- Subtext noting that choosing a new level replaces current progress.
- **Level list**: Easy / Medium / Hard / Expert, each row showing the
  level name, its approximate given-count, and a marker on whichever
  level is currently active/in-progress. Tapping a level **immediately**
  starts a new puzzle at that level (no confirmation dialog — see below).
- **Divider**, then a separate action: **"Restart this puzzle"** —
  resets the current board (clears all entries and notes) but keeps the
  *same* puzzle/level, rather than generating a new one. This fires
  **immediately on tap, with no confirmation prompt.**
- **Cancel** — dismisses the sheet with no changes.

> Note: choosing a *new level* from this sheet does replace in-progress
> work on the current puzzle. Whether *that* specific action should
> prompt for confirmation (since it's more destructive than Restart) is
> an open call — current design has it fire immediately like Restart,
> matching the "no prompts" instruction, but flag this if you want the
> two actions to behave differently.

### 3.3 Settings screen

Grouped into three sections:

**Gameplay assistance**
- Auto-check mistakes (default: on)
- Highlight duplicates (default: on)
- Highlight same numbers (default: on)
- Highlight row & column (default: off)
- Auto-remove pencil marks (clears notes invalidated by a new entry;
  default: on)

**Display**
- Show timer (default: on)
- Show mistake counter (default: on)
- Dark mode (default: off)

**Difficulty**
- Remember last level (default: on — always on in practice, since the
  app always resumes/opens at the last level)
- Limit mistakes (default: off — when off, mistakes are tracked but
  never end the puzzle; if ever turned on, define end-of-puzzle
  behavior at 3 mistakes)

## 4. Visual design system

No existing brand to match — this is a small system defined for this
app:

- **Fonts:**
  - Display / headings / grid digits: `Fraunces` (serif, distinctive)
  - UI / body text: `Space Grotesk` (sans-serif)
  - Load both via Google Fonts (`fonts.googleapis.com/css2`).
- **Palette:**
  | Role | Hex |
  |---|---|
  | Background | `#FAF8F4` |
  | Surface / card | `#FFFFFF` |
  | Ink (primary text) | `#211F1C` |
  | Ink soft (secondary text) | `#6B6560` |
  | Border | `#E4DFD6` |
  | Accent (primary, buttons/selection) | `#B54A2C` |
  | Accent soft (tint) | `#F3DDD2` |
  | User-entered digit | `#2E5F8A` |
  | Error / mistake | `#B23A3A` |
  | Easy | `#3F7A5C` |
  | Medium | `#B8862F` |
  | Hard | `#B54A2C` |
  | Expert | `#6B3F63` |
- **Shape/spacing:** rounded corners (12–20px), generous padding,
  card-based layout, no gradients, no left-border cards, no emoji icons
  (use inline stroke SVGs).
- **Touch targets:** minimum 44×44px for all interactive elements.
- **Reference mockups:** a visual sketch of the Game screen, New Game
  sheet, and Settings screen was built collaboratively in chat — ask for
  the artifact link if you want to look at it again while building.

## 5. Puzzle generation & solving algorithm

Two-phase approach, entirely client-side:

**Phase 1 — Generate a complete valid solution**
- Backtracking fill of the 9×9 grid, trying digits 1–9 in random order
  per cell, backtracking on row/column/box conflicts.
- Optimization: fill the three diagonal boxes first (they don't
  constrain each other) before backtracking the rest.

**Phase 2 — Remove cells to create the puzzle**
- Randomly remove cells one at a time.
- After each removal, run a solver that counts solutions (stop counting
  as soon as it finds a 2nd, for performance) to confirm the puzzle
  still has a **unique solution**.
- If removal breaks uniqueness, put the number back and try a different
  cell.
- Continue until hitting the target given-count for the chosen
  difficulty level, or until no more cells can be removed without
  breaking uniqueness.

**Difficulty → target given-count** (starting point, tune to taste):
| Level | Approx. givens |
|---|---|
| Easy | 36+ |
| Medium | ~30–32 |
| Hard | ~28 |
| Expert | ~22–25 |

**Building blocks needed:**
- Validity checker (no repeated digit in any row/column/box)
- Backtracking solver (used both to generate and to verify uniqueness)
- Solution counter (early-exit at 2 solutions)

## 6. State & persistence

Everything lives in `localStorage` (a single JSON blob per key is fine
at this scale):

- `settings` — all Settings-screen toggles
- `lastLevel` — last-selected difficulty
- `currentPuzzle` — the active puzzle: original givens, current board
  state, pencil marks per cell, mistake count, elapsed time, move
  history (for Undo)
- Optionally, per-level best times / completion counts if you want
  stats later (not in current mockups, but the "X solved" copy in
  earlier sketches implies this data exists somewhere)

## 7. Open questions to resolve before/while building

- **Hint behavior**: unlimited, or capped per puzzle? What does a hint
  actually reveal (fills the cell, or narrows candidates)?
- **Completion state**: what happens when the grid is filled correctly?
  (modal with time/mistakes, streak tracking, prompt to start next
  level, share result, etc.)
- **New-level vs. Restart confirmation asymmetry**: both currently fire
  immediately with no prompt; confirm that's really desired for New
  Level too, since it discards more progress than Restart does.
- **Dark mode palette**: not yet designed — only the toggle exists so
  far.

## 8. Suggested project structure

```
/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── styles.css
├── js/
│   ├── app.js          # UI wiring, screen/sheet state
│   ├── board.js         # rendering the grid, cell interactions
│   ├── generator.js     # puzzle generation (Phase 1 + 2 above)
│   ├── solver.js        # backtracking solver + solution counter
│   ├── storage.js        # localStorage read/write helpers
│   └── settings.js       # settings screen logic
├── icons/                # PWA icons (various sizes)
└── fonts/ (or Google Fonts <link> in index.html)
```

## 9. Deployment

- Push the static build to a `gh-pages` branch or `/docs` folder on
  GitHub → GitHub Pages serves it over HTTPS automatically.
- Once deployed, Android/Chrome will offer "Add to Home Screen"
  automatically once `manifest.json` + a registered service worker are
  valid; iOS/Safari requires manually tapping Share → Add to Home
  Screen.
- Alternatives: Netlify or Vercel for auto-deploy on push and easier
  custom domains.
