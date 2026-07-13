# Teal Theme — Phase 2: Add Points Keypad Screen Design Spec

Date: 2026-07-13

## Purpose

Second phase of the teal-theme redesign (see `docs/superpowers/specs/2026-07-13-teal-theme-phase1-design.md` for Phase 1). Adds a full-screen "Add Points" keypad entry flow for normal-mode games, inspired by the reference screenshot, alongside — not replacing — the existing inline +/-/pencil-modal scoring controls.

## Scope

**In scope:**
- A new route `#/game/:id/player/:playerId` (normal mode only) rendering a full-screen "Add Points" keypad for one player.
- Each player row on the existing Active Game (normal mode) screen gets a new "Add Points" button (in addition to the existing −/score/+ controls) that navigates to this screen.
- Keypad screen layout: header (back arrow, player name + static "DEALER" badge on the first player in `game.players`, history icon), "Round N" label, big typed-value display, "Total Score: X" (current total before this entry), calculator-style Undo/Redo of the digit entry, a 12-key keypad (1-9, 0, +/− sign toggle, backspace), and Save/Next Player buttons.
- **Save**: adds the typed value to the player's running total via the existing `adjustScore` (delta semantics — same math as the +/- buttons, just entering a larger number at once), resets the typed value to empty, and stays on the same screen (updated "Round N"/"Total Score" reflect the save).
- **Next Player**: navigates to the next player's Add Points screen, cycling through `game.players` in order and wrapping from the last player back to the first. Does not commit whatever is currently typed (uncommitted digits are simply discarded) — this is how you skip a player who didn't score this round.
- **History icon**: opens a read-only modal (mirrors the existing `showScoreModal`/`showRenameModal` overlay pattern) listing this player's past rounds as "Round N: <sign><delta>", derived from their existing `game.history` entries (same data `playerRoundInfo` from Phase 1 already reads) — no new persistence.
- **DEALER badge**: static, non-functional. Shown only when the player being viewed is `game.players[0]`. No rotation logic — that's Phase 3.

**Explicitly out of scope for this phase:**
- Replacing/removing the existing −/score/+ inline controls or the tap-to-edit-exact-value modal — both stay exactly as they are.
- Dealer rotation (Phase 3) — the badge here is a static placeholder.
- Any change to rounds-mode (`renderActiveGameRounds`), Home, New Game, or Summary screens.
- Any change to sort, game-level undo, finish/rematch, or persistence error handling.

## Data model

No changes to `js/db.js`'s persisted shapes. Nothing new is stored — the keypad screen is a different UI over the same `adjustScore`/`game.history` data Phase 1 already introduced `playerRoundInfo` for. "Round N" here means the same thing it means in the Phase 1 subtext: `N` = number of this player's existing history entries, plus 1 for the round about to be entered.

The **digit-entry undo/redo** (Undo/Redo buttons above the keypad) is purely client-side UI state local to this screen's render call — an array of past typed-value strings plus a position pointer, reset every time the screen is entered or a player navigated to. It is not persisted and has nothing to do with `game.history`.

## Files touched

- Modify: `js/render.js` — new exported `renderAddPoints(root, game, player, actions)` function; new player-row "Add Points" button in `renderActiveGameNormal`; a new `showRoundHistoryModal(game, player)` helper (read-only, mirrors the existing modal pattern).
- Modify: `js/app.js` — new route branch for `#/game/:id/player/:playerId`; a new `actions.goAddPoints(gameId, playerId)` navigation action (no db mutation — reuses the existing `actions.adjustScore`).
- Modify: `css/styles.css` — new `.keypad`, `.keypad-key`, `.keypad-display`, `.dealer-badge`, `.round-history-list` rules, using existing custom properties (`--teal`, `--card-bg`, `--fg`, `--border`, etc.) — no new hardcoded colors.
- No changes to `tests/db.test.js` — this phase adds no new `js/db.js` functions (it composes existing `adjustScore`/`game.history`), so there's nothing new to unit-test there. The keypad's digit undo/redo state and screen rendering are DOM/UI-only, consistent with every prior UI task in this project (no automated tests, verified via `node --check` + served-content checks + manual browser pass).

## Non-goals / risks

- The digit undo/redo stack must be scoped per-render (a plain closure variable inside `renderAddPoints`, like `renderActiveGameNormal`'s existing `sortMode`/`renderRows` pattern) — it must not leak into a module-level variable that would be shared across different players' screens.
- `Next Player`'s wrap-around must handle the single-player-edge-case gracefully (a 2-player game cycling back and forth is the minimum; the plan's earlier player-count validation already guarantees every game has ≥2 players, so a true 1-player wrap-to-self case can't occur, but the modulo arithmetic should still be written defensively).
- The keypad must only ever produce values `adjustScore` already knows how to handle (integers, via `Number(...)`/`Number.isFinite` guards) — no new validation logic needed beyond what's already proven in `showScoreModal`.
- No `innerHTML` with interpolated user data anywhere in the new code (matches this codebase's established XSS-safe `createElement`/`textContent` pattern, already enforced twice via prior fixes).
