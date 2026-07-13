# Teal Theme — Phase 3: Dealer Rotation Design Spec

Date: 2026-07-13

## Purpose

Third phase of the teal-theme redesign. Replaces Phase 2's static "DEALER" badge (always `game.players[0]`) with a real, trackable dealer that auto-rotates as play proceeds and can be manually reassigned. Normal mode only, matching Phase 2's Add Points scope.

## Scope

**In scope:**
- A new `game.dealerId` field (default `null`) tracking the current dealer's player id. `null`/missing is treated as "the first player" everywhere it's read, so games saved before this phase (no `dealerId` field at all) behave identically to a fresh game.
- **Auto-rotation:** on the Add Points screen, tapping "Next Player" when it wraps from the last player back to the first also advances the dealer to the next player in order (wrapping the same way).
- **Manual reassignment:** the Active Game (normal mode) header's "⋮" menu gains a third item, "Change Dealer", opening a modal that lists every player — tapping one sets them as dealer immediately and closes the modal.
- **Visibility:** the Add Points screen's DEALER badge now reflects the real dealer (`game.dealerId`, falling back to the first player) instead of always showing on `game.players[0]`. The Active Game (normal mode) player-row list also gets a small dealer badge next to whichever player is currently dealer.

**Explicitly out of scope:**
- Rounds mode, Summary, Home, New Game — no dealer concept anywhere outside normal-mode Active Game / Add Points.
- Any change to how "Next Player" or "Save" already work beyond adding the dealer-advance side effect.

## Data model

`js/db.js`:
- `createGame` gains `dealerId: null` in its returned object (same pattern as `finished: false` from Phase 1).
- `getDealerId(game)` — pure helper, not a mutator: `game.dealerId || (game.players[0] && game.players[0].id)`. Used everywhere the current dealer needs to be read (both render functions and the two mutators below).
- `setDealer(game, playerId)` — sets `game.dealerId = playerId`, bumps `updatedAt`.
- `advanceDealer(game)` — finds the current dealer's index via `getDealerId(game)` and `game.players`, sets `game.dealerId` to the next player's id (wrapping from the last index back to `0`), bumps `updatedAt`. If `game.players` is empty (can't happen in practice — every game requires ≥2 players — but written defensively), it's a no-op.

## Files touched

- `js/db.js` — `createGame` gains `dealerId: null`; new `getDealerId`, `setDealer`, `advanceDealer` functions.
- `tests/db.test.js` — new tests for `getDealerId`'s fallback behavior, `setDealer`, and `advanceDealer`'s wraparound.
- `js/render.js`:
  - `renderHeader` gains an optional `onChangeDealer` callback; when provided, a third "Change Dealer" item appears in the "⋮" dropdown (existing call sites that don't pass it are unaffected — Home, New Game, rounds mode, Summary keep exactly two or zero menu items as before).
  - New `showChangeDealerModal(game, onSelect)` helper (mirrors the existing modal pattern) listing every player by name; tapping one calls `onSelect(playerId)` and closes.
  - `renderActiveGameNormal` passes `onChangeDealer` to its `renderHeader` call, and each player row gains a small dealer-badge indicator next to the name when `player.id === getDealerId(game)`.
  - `renderAddPoints`'s badge condition changes from `game.players[0].id === player.id` to `getDealerId(game) === player.id`; its Next Player handler calls a new `actions.advanceDealer(gameId)` right before navigating, only when the computed next index wraps back to `0`.
- `js/app.js` — new `actions.setDealer(gameId, playerId)` and `actions.advanceDealer(gameId)` (both: mutate via `js/db.js`, `persist()`, `route()`); `renderActiveGameNormal`'s existing `renderHeader` call site gains `onChangeDealer`.

## Non-goals / risks

- No automated tests for the DOM/UI layer (menu item, modal, badge rendering) — consistent with every prior UI task in this project. `js/db.js`'s three new functions DO get unit tests (TDD, matching the established pattern for that file).
- `getDealerId`'s fallback must be used consistently everywhere the dealer needs to be displayed or compared — a spot that reads `game.dealerId` directly without the fallback would break on any game created before this phase.
- `advanceDealer`'s wraparound must use the *current* dealer's position, not assume it's always adjacent to whichever player just navigated via Next Player (a manual reassignment via "Change Dealer" could have moved the dealer to any player, and the next auto-rotation must still advance from wherever the dealer actually is).
