# Soft-Neutral Restyle + Game History + Richer Sort — Design Spec

Date: 2026-07-19

## Purpose

Follow-up to the rounded-card redesign, prompted by comparing against two reference apps: https://apps.apple.com/us/app/score-keeper-for-game-night/id1245390236 (features) and https://play.google.com/store/apps/details?id=com.scorekeepertracker.app (visual "clean" look). Delivers three independent, contained changes:

1. A visual adjustment: soft neutral cards instead of the current accent-bordered/heavier-shadow cards on the Home screen (player rows on the Active Game screen keep their per-player color accent).
2. A game history feature: finished games become read-only and are separated from active games on the Home screen.
3. Richer sort options on the normal-mode Active Game screen: a 3-way cycle (original → high-to-low → low-to-high) replacing the current 2-state toggle.

Explicitly **not** included in this pass (deferred/declined during scoping): score trend charts, turn timer, random player picker, drag-and-drop custom sort ordering.

## 1. Visual: soft neutral cards

- Home screen's `.game-list-item`: remove the `border-left: 6px solid var(--accent)` accent; reduce `box-shadow` to a barely-there value (`0 1px 3px rgba(0, 0, 0, 0.06)`, with a comparably subtle dark-mode equivalent).
- `--bg` custom property lightens slightly in light mode (e.g. `#fafafa` instead of `#ffffff`) for a softer page background; dark mode unchanged.
- Active Game (normal mode) `.player-row`: **keeps** its existing per-player `border-left` color accent (set inline via `player.color`, unchanged), but adopts the same lighter `box-shadow` as the game-list cards for visual consistency.
- New Game screen, rounds-mode table, and summary screen are unaffected by this visual pass (same out-of-scope boundary as the prior redesign).

## 2. Game history

**Data model change:** `createGame` in `js/db.js` gains a `finished: false` field on the game object. Existing games in a user's `localStorage` (created before this change) won't have the field — treat `game.finished` as falsy/undefined the same as `false` everywhere it's read (no migration needed).

**Behavior change:** the `actions.finishGame(gameId)` action in `js/app.js` currently only navigates to the summary hash. It must now also set `game.finished = true`, persist, and then navigate — a new `finishGame(game)` function in `js/db.js` performs the mutation (mirrors the pattern of `deleteGame`/other db.js mutators).

**Home screen (`renderHome`):** split the single game list into two sections:
- **"Games"** — games where `!game.finished`, sorted by `updatedAt` desc (same as today). Clicking navigates to `#/game/:id` (editable score screen), same as today.
- **"History"** — games where `game.finished`, sorted by `updatedAt` desc. Clicking navigates to `#/game/:id/summary` (read-only standings), not the editable screen.
- Both sections keep their own empty-state message when empty, and both keep the existing Delete button/`confirm()` flow (works identically regardless of finished state).

**Read-only enforcement:** no new enforcement code needed — the summary screen (`renderSummary`) already has no score-editing controls, so routing history entries there is sufficient to make them read-only in practice.

**Rematch:** unaffected — `actions.rematch` already creates a brand-new game via `createGame`, which will pick up the new `finished: false` default automatically.

## 3. Richer sort (normal mode only)

Replace the current `sorted` boolean + single "Sort by score" button in `renderActiveGameNormal` with a 3-state cycle:

- States, in cycle order: `'original'` → `'desc'` (high-to-low) → `'asc'` (low-to-high) → back to `'original'`.
- Button label reflects the *current* state, e.g. "Sort: Original", "Sort: High→Low", "Sort: Low→High" — clicking advances to the next state.
- `'original'` uses `game.players` insertion order (unchanged from today's unsorted case); `'desc'`/`'asc'` sort a copy of `game.players` by `game.scores[player.id]`.
- No new persistence: like today's toggle, the sort state is local to the render call and resets to `'original'` whenever the screen fully re-renders after a score mutation (same known, previously-accepted behavior — not something this change needs to fix).
- Scope: normal mode only. Rounds mode has no equivalent "sort," left unchanged.

## Files touched

- `css/styles.css` — `:root` `--bg` value, `.game-list-item` (remove accent border, lighten shadow), `.player-row` (lighten shadow only, keep accent border).
- `js/db.js` — `createGame` adds `finished: false`; new `finishGame(game)` function sets `game.finished = true`.
- `js/render.js` — `renderHome` splits into Games/History sections; `renderActiveGameNormal` replaces the sort toggle with the 3-state cycle.
- `js/app.js` — `actions.finishGame` calls the new `db.js` `finishGame(game)` before navigating; import updated.
- `tests/db.test.js` — new tests for `finishGame` and for `createGame`'s `finished: false` default.

## Non-goals / risks

- No automated tests for the DOM/UI layer (Home split, sort cycle) — consistent with prior styling/UI tasks; verified via syntax checks + served-content checks + manual browser pass, not unit tests.
- No accessibility regression: card style changes are shadow/border-only, no tap-target size changes in this pass.
- Backward compatibility: games saved before this change lack `finished`; all read sites must treat missing/undefined the same as `false` (i.e. check `!game.finished`, never `game.finished === false`).
