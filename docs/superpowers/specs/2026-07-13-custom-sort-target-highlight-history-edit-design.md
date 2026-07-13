# Custom Sort Ordering, Target-Reached Highlight, Round-History Edit/Delete Design Spec

Date: 2026-07-13

## Purpose

Three previously-deferred features, batched together per user request, ahead of the planned Phase 6 (score statistics/charts):
1. A persistent "Custom" sort mode on the Active Game (normal mode) screen, reordered via ↑/↓ buttons.
2. A visual highlight + trophy badge when a player's score reaches or exceeds the game's target score.
3. Edit/Delete controls on individual entries in the round-history modal (previously read-only).

## Scope

**In scope:**

### 1. Custom sort ordering
- The sort cycle becomes 4 states instead of 3: **Original → High→Low → Low→High → Custom → (back to Original)**.
- Two new persisted fields on the game object: `sortMode` (string, default `'original'`) and `playerOrder` (array of player ids, default `null`, meaning "use `game.players`' own order").
- `sortMode` moves from local render-closure state (today's behavior, which resets to "Original" after every scoring action's re-render) to a persisted field — this is a deliberate improvement bundled into this feature, since a "custom order" that keeps reverting after every tap would defeat its own purpose.
- While in Custom mode, each player row gets small ↑/↓ buttons. Tapping one swaps that player with their adjacent neighbor in the effective order (initializing `playerOrder` from `game.players`' ids the first time a swap happens, if not already set).
- Custom mode's effective row order is `playerOrder` (falling back to `game.players`' own order if `playerOrder` is `null` or contains stale/removed player ids — defensive, since players can theoretically be removed via the pre-existing `removePlayer` function even though no current UI exposes that action mid-game).

### 2. Target-reached highlight
- Purely visual — no data model change (reuses the existing `game.targetScore` from the target-score feature).
- On the Active Game (normal mode) player-row list only (not the Add Points screen): when `game.targetScore` is set (not `null`/`undefined`) and `game.scores[player.id] >= game.targetScore`, the row gets a distinct highlight (a gold/amber border-left color override and background tint) and a small 🏆 badge next to the player's name.

### 3. Round-history edit/delete
- The existing read-only round-history modal (opened via the Add Points screen's history icon) gains an Edit and a Delete button on each entry.
- **Edit** reuses the existing numeric-entry modal (`showScoreModal`) to collect a new value for that specific round, then calls a new `js/db.js` function that recalculates the player's total from the difference between old and new delta.
- **Delete** removes that specific entry and subtracts its delta from the player's total.
- Both operations identify the target entry by its actual position (index) in the flat `game.history` array (not "the Nth entry for this player," to avoid ambiguity — the modal computes each displayed entry's real index when building the list).
- After either action, the round-history modal closes (matching the existing app-wide pattern: every modal in this app acts, then closes) and the Add Points screen re-renders with the updated total via the app's existing `persist()`+`route()` cycle.
- `showRoundHistoryModal`'s signature changes from `(game, player)` to `(game, player, actions)` to give it access to the new actions; its one existing call site (in `renderAddPoints`) is updated accordingly.

**Explicitly out of scope:**
- True drag-and-drop or swipe gestures — both were explicitly declined in favor of tap-based ↑/↓ and Edit/Delete buttons, since native HTML5 drag doesn't work reliably on touchscreens (this app's primary use case) without substantial custom touch-event handling.
- Any change to rounds mode, Summary, Home, or New Game screens.
- Automatic actions when a target score is reached beyond the visual highlight (e.g., no auto-prompt to finish the game, no sound/notification).

## Data model

`js/db.js`:
- `createGame` gains two more default fields: `sortMode: 'original'`, `playerOrder: null`.
- `setSortMode(game, mode) -> void` — sets `game.sortMode`, bumps `updatedAt`.
- `movePlayerOrder(game, playerId, direction) -> void` — `direction` is `-1` (up/earlier) or `1` (down/later). If `game.playerOrder` is `null`, initializes it from `game.players.map(p => p.id)` first. Finds `playerId`'s index, swaps it with the adjacent index in that direction (no-op if already at an end), bumps `updatedAt`.
- `editHistoryEntry(game, historyIndex, newDelta) -> void` — looks up `game.history[historyIndex]`, computes `diff = newDelta - entry.delta`, adjusts `game.scores[entry.playerId]` by `diff`, sets `entry.delta = newDelta`, bumps `updatedAt`. No-op if the index is out of range.
- `deleteHistoryEntry(game, historyIndex) -> void` — looks up `game.history[historyIndex]`, subtracts its delta from `game.scores[entry.playerId]`, removes it from `game.history` via `splice`, bumps `updatedAt`. No-op if the index is out of range.

## Files touched

- `js/db.js` — `createGame` gains `sortMode`/`playerOrder` defaults; new `setSortMode`, `movePlayerOrder`, `editHistoryEntry`, `deleteHistoryEntry` functions.
- `tests/db.test.js` — new tests for all four new functions plus `createGame`'s new default fields.
- `js/app.js` — new `actions.setSortMode(gameId, mode)`, `actions.movePlayerOrder(gameId, playerId, direction)`, `actions.editHistoryEntry(gameId, historyIndex, newDelta)`, `actions.deleteHistoryEntry(gameId, historyIndex)` (all: mutate via `js/db.js`, `persist()`, `route()`).
- `js/render.js`:
  - `renderActiveGameNormal`'s sort button/logic switches from local `sortMode` closure state to reading/writing `game.sortMode` via the new action; adds the 4th "Custom" cycle state and ↑/↓ buttons per row in Custom mode; adds the target-reached highlight/badge to each row.
  - `showRoundHistoryModal`'s signature changes to `(game, player, actions)`; each entry gains Edit (reusing `showScoreModal`) and Delete buttons calling the new actions, then closing the modal.
  - `renderAddPoints`'s one call site for `showRoundHistoryModal` is updated to pass `actions`.
- `css/styles.css` — new `.player-row-target-reached` (or similar) highlight rule, a `.target-badge` (mirrors the existing `.dealer-badge` pill pattern), and small `.order-btn`-style ↑/↓ button styling (can likely reuse/extend existing `.score-btn` circular button styling rather than introducing much new CSS).

## Non-goals / risks

- No automated tests for the DOM/UI layer (sort button, ↑/↓ buttons, highlight, modal Edit/Delete buttons) — consistent with every prior UI task in this project. The four new `js/db.js` functions DO get unit tests (TDD, matching the established pattern for that file).
- Backward compatibility: games saved before this change have no `sortMode`/`playerOrder` fields (`undefined`, not the new defaults). Render code must treat a missing `sortMode` the same as `'original'`, and a missing/`null` `playerOrder` as "use `game.players`' own order" — never crash on `undefined`.
- `editHistoryEntry`/`deleteHistoryEntry` operate on a raw array index into `game.history`. Since this array can be mutated by other actions (`undo()` pops from the end, `deleteHistoryEntry` itself splices), the index used must be captured fresh at the moment the round-history modal is built from the *current* `game.history` — never cached across a screen re-render, since indices shift after any deletion.
- `movePlayerOrder`'s defensive fallback (ignoring stale ids in `playerOrder` if a player was ever removed) should be handled by filtering `playerOrder` down to only ids that still exist in `game.players` before using it to determine render order, rather than crashing on a `.find()` that returns `undefined`.
