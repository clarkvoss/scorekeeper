# Teal Theme — Phase 4: New Game Confirm Screen + Target Score Design Spec

Date: 2026-07-13

## Purpose

Fourth phase of the teal-theme redesign. Splits the New Game flow into two steps — the existing form, then a new teal-styled confirm screen (inspired by the reference "Game Night" screenshot) — and adds an optional, purely informational target score.

## Scope

**In scope:**
- New optional `targetScore` field on games (`null` by default), settable via a new "Target score (optional)" number input on the New Game form.
- The New Game screen becomes a two-step wizard, both rendered by the same `renderNewGame` function (no new route — a new URL route would need to smuggle unsaved draft state, like `draftPlayers`, across a route change, which the app's architecture doesn't support today):
  1. **Form step** (today's screen, plus the new target-score input): name, mode, saved-player-list loader, add/remove players, save player list. The "Start Game" button is renamed **"Continue"** and, instead of creating the game immediately, advances to the confirm step once ≥2 players exist (same validation as before).
  2. **Confirm step** (new): teal header showing the game name (title only — no back-arrow menu items, since the game doesn't exist yet), the mode as text, the player count, and the target score as a big number (or "No target set" if left blank). Two buttons: **Edit** (returns to the form step, preserving everything already entered) and **Start** (creates the game exactly as today's "Start Game" did, now also carrying the target score).
- Once a game exists, the Active Game (normal mode) screen shows the target score as a small subtitle under the header title — only when set, nothing displayed otherwise.
- Rematch preserves the original game's target score onto the new game (consistent with already preserving players/mode).

**Explicitly out of scope:**
- Any automatic detection/highlighting of a player reaching or exceeding the target score — purely informational display.
- Rounds mode, Summary, Home — untouched. (Rounds-mode games can still have a target score set at creation, per the shared `createGame`, but this phase doesn't add any rounds-mode *display* of it — only the normal-mode Active Game screen gets the subtitle, matching the scope of prior phases' normal-mode-only additions.)
- Any new CSS — this phase reuses existing classes (`.app-header`, `.keypad-display` for the big number, `.keypad-save` for the prominent Start button, standard inputs/buttons).

## Data model

`js/db.js`: `createGame(db, name, mode, targetScore = null)` gains a 4th parameter, stored as `game.targetScore`. `js/app.js`'s `actions.startGame` and `actions.rematch` both need updating: `startGame` passes through the value entered on the confirm screen; `rematch` passes through `oldGame.targetScore` (so a rematch keeps the same target, consistent with it already keeping the same players/mode).

## Files touched

- `js/db.js` — `createGame` gains `targetScore = null` parameter, stored as `game.targetScore`.
- `tests/db.test.js` — new tests for `createGame`'s targetScore default and explicit value.
- `js/app.js` — `actions.startGame(name, mode, draftPlayers, targetScore)` passes `targetScore` to `createGame`; `actions.rematch` passes `oldGame.targetScore`.
- `js/render.js` — `renderNewGame` is restructured into a two-step wizard (internal `step` state, `renderFormStep()`/`renderConfirmStep()` helpers, entry point renders whichever step is current — mirrors the existing `renderRows`/`renderPlayerList` internal-render-function pattern already used elsewhere in this file). `renderActiveGameNormal` gains a one-line conditional subtitle under its header when `game.targetScore` is set.

## Non-goals / risks

- No automated tests for the DOM/UI layer (the two-step wizard, confirm screen, subtitle) — consistent with every prior UI task in this project. `js/db.js`'s `targetScore` default DOES get a unit test (TDD, matching the established pattern for that file).
- The form step's local draft state (`draftPlayers`, `mode`, `targetScore`, `gameName`) must survive an Edit-from-confirm round trip unchanged — since both steps live in the same function's closure (not separate route-driven renders), this falls out naturally as long as the state variables are declared once at the top of `renderNewGame` and only ever read/written by both step-render functions, never reset when switching steps.
- `targetScore` input parsing: empty string must map to `null` (no target), not `0` or `NaN` — mirrors the falsy-safe handling already established for `finished`/`dealerId` in earlier phases (though this field's "unset" value is `null`, not "any falsy value counts", since `0` is technically a valid intentional target score in principle — though moot in practice since the UI always treats "empty input" as the trigger for `null`, not the numeric value `0` itself).
