# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-friendly, installable Sudoku PWA. Fully client-side (vanilla HTML/CSS/JS, no framework, no build step, no npm dependencies) — puzzle generation, solving, and all state live in the browser via `localStorage`. See `sudoku-app-design.md` for the full product spec (screens, settings behavior, difficulty tuning, visual design system) this app was built from — check it before changing feature behavior.

## Running / testing

There is no build step and no test framework configured. To run the app, serve the directory statically and open it in a browser:

```bash
python3 -m http.server 8000
```

Note: common ports (e.g. 8123) may already be bound by an unrelated process in shared dev environments — check with `lsof -i :<port>` before assuming a server on that port is this app.

To verify UI changes without a human in the loop, drive it headlessly with Playwright against the system-installed Chrome (avoids downloading a browser):

```bash
npm install playwright   # run in a scratch dir, not the repo — no package.json here
```

```js
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", args: ["--no-sandbox"] });
```

Then `page.goto()` the local server, interact, and `page.screenshot()` / check `page.on("console")` for errors. There's no CI/lint/test command to run otherwise.

## Architecture

Plain `<script>` tags in `index.html` load modules in dependency order. Each module attaches itself to `window` as a namespace object — `Storage`, `Solver`, `Generator`, `Board`, `SettingsUI` — except `js/app.js`, which is an IIFE that owns all mutable state and wires everything together; it is the only file with DOM event listeners and the only place state is mutated.

- **`js/solver.js`** — pure grid algorithms, no DOM: `isValidPlacement`, backtracking `solveGrid` (randomized-digit-order variant used for generation, ascending-order for deterministic solves), `countSolutions` (early-exits at a limit, used to confirm puzzle uniqueness), `findConflictCells` (rule-based duplicate detection for the "highlight duplicates" setting).
- **`js/generator.js`** — generation is two-phase: fill the 3 diagonal boxes randomly (they don't constrain each other) then backtrack-fill the rest for a full solution; then randomly remove cells one at a time, re-checking `countSolutions === 1` after each removal and putting the cell back if uniqueness breaks. `DIFFICULTY_CONFIG` holds the given-count range per level.
- **`js/storage.js`** — `localStorage` read/write helpers. One JSON blob per key: `sudoku.settings`, `sudoku.lastLevel`, `sudoku.currentPuzzle`.
- **`js/board.js`** and **`js/settings.js`** — pure rendering: given `state`/`settings`, they build/update DOM. They hold no state of their own and have no side effects beyond the DOM.
- **`js/app.js`** — owns `state` (the active puzzle: `givens`/`solution`/`values`/`notes`/`mistakes`/`hintsUsed`/`hintCells`/`elapsedSeconds`/`history`/`completed`/`selected`/`notesMode`/`paused`) and `settings`. Calls into `Board`/`SettingsUI` to re-render after every mutation, and into `Storage` to persist (throttled to every 3s during the timer tick, forced on discrete actions and on `beforeunload`/`visibilitychange`).

### Things that aren't obvious from one file

- **Undo** is a `history` array of move entries tagged `kind: "digit" | "note" | "hint"`, each carrying enough to reverse itself (`prevValue`/`prevNotes`, `mistakeDelta`, `peerNoteRemovals`). If you add a new kind of board mutation, it needs its own entry shape and a branch in `undo()` — there's no generic diffing.
- **Mistakes** are computed against the true `solution` grid, not local rule conflicts, and always increment regardless of the "auto-check mistakes" setting — that setting only controls whether a wrong entry is *visually* flagged red. "Highlight duplicates" is a separate, rule-based check (`findConflictCells`) independent of the solution. Don't conflate the two when touching mistake-tracking logic.
- **Auto-remove pencil marks** removes a committed digit from peer cells' notes and records those removals in the same history entry (`peerNoteRemovals`) so undo can restore them — a commit/hint and its peer-note side effects undo atomically as one step.
- **Board locking** (`isBoardLocked()`) is a computed function of `state.completed`, the mistake-limit condition, and `state.paused` — not a stored flag. The mistake-limit modal must be explicitly triggered (`checkMistakeLimit()`) after any action that changes `mistakes` or the `limitMistakes` setting; it is not automatic just because `isBoardLocked()` becomes true.
- **PWA shell**: `service-worker.js` precaches an explicit `APP_SHELL` file list and cache-busts via `CACHE_NAME`. Adding a new top-level asset (JS/CSS file) requires adding it to `APP_SHELL`; changing any cached file's contents in a way that must propagate to existing installs requires bumping `CACHE_NAME`. The `fetch` handler is cache-first with no revalidation (`caches.match()` returns the cached response with no network check), so this is not optional — forgetting to bump `CACHE_NAME` means any browser that already has the service worker installed keeps serving the old file indefinitely, surviving normal reloads and even hard confirmation that the new code is deployed. This already happened once: a CSS overflow fix shipped without a version bump and stayed invisible to already-installed clients. Whenever you touch any file listed in `APP_SHELL` (`index.html`, `css/styles.css`, or any `js/*.js`), bump `CACHE_NAME` in the same change.
- Fonts are the native system stack (no Google Fonts / no network font dependency) — keep it that way for offline reliability unless asked to change it.
