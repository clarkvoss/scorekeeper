# Teal Theme — Phase 1: Visual Redesign & Player List Design Spec

Date: 2026-07-13

## Purpose

First of a multi-phase redesign inspired by a reference screenshot of "Score Keeper for Game Night" (dark teal header, white card list, avatar player rows, per-round score tracking). This phase is **visual only**: a teal header treatment applied across all screens, a restyled player list with emoji avatars and round-history subtext, and a new Delete/Rename menu in the header. No interaction changes — existing controls (score +/-/pencil modal, sort cycle, undo, rounds table, summary) behave exactly as they do today.

Later phases (not in this spec): a full-screen "Add Points" keypad entry with calculator-style undo/redo (Phase 2), dealer rotation (Phase 3), New Game/Start screen restyle (Phase 4), utility tools — timer/dice/random picker (Phase 5), score statistics/trend charts (Phase 6).

## Scope

**In scope:**
- Teal header (gradient `#2d7d74` → `#1f5c54`, white text) on every screen.
  - Home: title "Scorekeeper" + "New Game" button. No back arrow, no menu (no single game context to act on).
  - Active Game (normal + rounds), Summary, New Game setup: back arrow (navigates to Home) + game name as title.
  - Active Game (normal + rounds) and Summary additionally get a "⋮" menu button with **Delete Game** and **Rename Game** options. New Game setup has no menu (game doesn't exist yet to delete/rename).
- **Rename Game**: new small feature. Selecting "Rename Game" from the menu opens a text-input modal (same visual pattern as the existing score-entry modal), pre-filled with the current name; Save persists the new name, Cancel/Escape/backdrop-click closes without changes.
- **Delete Game**: same `confirm()` + delete behavior as today, just triggered from the header menu instead of an inline per-row button on Home. (Home's list items keep their existing inline Delete button too — the header menu's Delete only applies to the currently-open game on Active Game/Summary screens.)
- Player rows (Active Game — normal mode) gain:
  - An **emoji avatar**: a small circle with a background tint (reusing the player's existing color at low opacity) and an emoji character, auto-assigned round-robin from a fixed 10-emoji set — mirrors exactly how `nextColor()` already auto-assigns colors. No emoji picker UI in this phase.
  - A **"Round N, Last: X"** subtext line under the player's name, computed from `game.history` (no data model change): `N` = number of history entries for that player so far, `X` = the delta of their most recent history entry (omit the line entirely if they have no history yet).
- Cards keep the existing soft-neutral style (light gray page background, individual white `--card-bg` cards, subtle shadow) — only the header treatment and player-row internals change.

**Explicitly out of scope for this phase** (deferred to later phases per the phase plan):
- The full-screen "Add Points" keypad entry screen and calculator-style undo/redo.
- Dealer badge/rotation.
- New Game/Start screen's teal "Edit/Start" button restyle (New Game gets the teal *header* in this phase, per above, but its body/buttons are unchanged).
- Timer, dice roller, random player picker.
- Score statistics/trend charts.
- Photo-upload avatars (emoji only, per this phase).
- Rounds-mode table's internal styling beyond the shared header (the table itself, its cells, and Summary screen's standings list are unchanged).

## Data model

No changes to `js/db.js`'s data shapes. Emoji assignment is derived the same way colors are: `nextEmoji(existingCount)` in a new `js/emojis.js` module (mirrors `js/colors.js`), called from `addPlayer` in `js/db.js` alongside `nextColor()`. Player object gains an `emoji` field: `{ id, name, color, emoji }`.

`Round N, Last: X` is computed at render time from `game.history` — no persistence needed beyond what already exists.

## Files touched

- Create: `js/emojis.js` — `PLAYER_EMOJIS` (10 emoji), `nextEmoji(existingCount)`, mirrors `js/colors.js` exactly.
- Modify: `js/db.js` — `addPlayer` assigns `emoji: nextEmoji(game.players.length)` alongside color.
- Modify: `js/render.js` — new shared `renderHeader(root, { title, showBack, showMenu, actions, onDelete, onRename, gameId })` helper used by `renderHome`, `renderNewGame`, `renderActiveGameNormal`, `renderActiveGameRounds`, `renderSummary` (replacing each screen's current ad-hoc `<h1>`/back-button markup); new `showRenameModal(currentName, onSave)` helper (mirrors `showScoreModal`); player-row rendering in `renderActiveGameNormal` gains the avatar + Round/Last subtext.
- Modify: `js/app.js` — new `actions.renameGame(gameId, newName)` action (mirrors `actions.deleteGame`'s pattern: mutate, persist, route).
- Modify: `css/styles.css` — new `.app-header`, `.header-back`, `.header-menu`, `.header-menu-dropdown` rules (teal gradient, white text); new `.player-avatar`, `.player-meta` rules for the avatar + subtext; reuses existing `.modal*` classes for the rename modal (no new modal CSS needed).
- Modify: `tests/db.test.js` — new test(s) for `addPlayer` assigning an emoji; new `tests/emojis.test.js` mirroring `tests/colors.test.js`.

## Non-goals / risks

- No automated tests for the DOM/UI layer (header helper, avatar rendering) — consistent with every prior UI task in this project; verified via syntax check + served-content check + manual browser pass. `js/emojis.js` and `js/db.js`'s `addPlayer` change DO get unit tests (matches the established TDD pattern for `js/db.js`/`js/colors.js`).
- Backward compatibility: players saved before this change have no `emoji` field. Render code must fall back gracefully (e.g. a default emoji or blank circle) rather than showing `undefined` — treat a missing `emoji` the same way a missing `finished` was handled previously (falsy-safe fallback, not a crash).
- The header menu is a small new interactive widget (open/close on click, close on outside-click) — scope it tightly to avoid becoming a general-purpose dropdown component; it only ever holds two fixed items (Delete, Rename).
- `renderHeader` must not regress any existing route/action wiring — every screen's back-button and (where applicable) delete confirmation must keep working exactly as before, just visually restyled and consolidated into one helper.
