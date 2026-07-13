# Score Trend Chart Design Spec

Date: 2026-07-13

## Purpose

Phase 6 (the last item from the original 6-phase teal-theme breakdown): a score trend chart on the Summary screen, showing how each player's cumulative score changed over the course of the game, for both normal and rounds mode.

## Scope

**In scope:**
- A new pure `js/db.js` function `computeScoreTrend(game)` that returns each player's cumulative-score series:
  - **Normal mode:** walks that player's own `game.history` entries (already filtered/ordered the same way `playerRoundInfo` does), producing a running total after each of their own scoring events. Players are not assumed to be "in sync" round-for-round with each other (normal mode has no shared round concept) — each player's series length reflects only their own number of scoring events.
  - **Rounds mode:** walks `game.rounds` in order, producing a running total per round using each round's `round[playerId]` value (or `0` if that player has no entry for a given round), for every player across every round — all players share the same series length here, since rounds mode already has a shared round index.
  - A player with zero data points (no history entries in normal mode, or `game.rounds.length === 0` in rounds mode) is omitted from the result entirely — nothing meaningful to plot, and their score (0) is already visible in the standings list above the chart.
- A new `renderTrendChart(root, game)` in `js/render.js`, called from `renderSummary` after the existing standings list, for both modes.
- The chart is a hand-built inline SVG line chart (no charting library, consistent with this project's no-build-step/vanilla-JS constraint):
  - One `<polyline>` per player, using that player's existing `player.color` (the same color already used for their avatar/row accent everywhere else in the app) at 2px stroke width, with a small 4px filled circle marking each line's endpoint.
  - A legend row (small color dot + player name) is always present. Additionally, when 4 or fewer players have a plotted series, each line is **also** directly labeled with the player's name near its endpoint — in the app's normal text color, not the player's series color, so identity is never conveyed by color alone (the existing player-color palette failed an automated colorblind-safety check when validated for this use, so this direct-labeling requirement is a deliberate mitigation, not a nice-to-have).
  - Thin, recessive axis lines (no heavy gridlines, no axis labels beyond a minimal baseline) — the goal is to show the overall shape of the game, not to support precise reading.
  - **No interactivity** — no hover/tap tooltips. This is a deliberate scope decision to keep this hand-built SVG chart simple; exact numbers are already visible in the standings list directly above it.
  - If no player has any plottable data at all (e.g. a game finished with zero scoring activity), the chart section is omitted entirely rather than rendering an empty/blank chart.

**Explicitly out of scope:**
- Any interactivity (hover, tap-for-exact-value).
- A chart anywhere other than the Summary screen (no mid-game stats view).
- Any change to the existing standings list, Rematch button, or Back to Home button on the Summary screen.
- A separate/validated chart-only color palette — the design deliberately reuses the app's existing per-player colors for cross-screen identity consistency, accepting that they are not independently colorblind-safe and mitigating with mandatory direct labels/legend instead.

## Data model

No changes to persisted data — `computeScoreTrend` is a pure, read-only function over the existing `game.history`/`game.rounds`/`game.scores` shapes, mirroring the existing `computeRoundsTotals` pattern in the same file.

## Files touched

- `js/db.js` — new `computeScoreTrend(game)` function.
- `tests/db.test.js` — new tests for `computeScoreTrend` covering both modes and the zero-data-points omission case.
- `js/render.js` — new `renderTrendChart(root, game)` function; `renderSummary` gains one call to it, inserted between the existing standings list and the Rematch button.
- `css/styles.css` — a small number of new rules for the chart's legend row and direct-label text styling (the SVG's own visual elements — lines, dots, axis — are drawn with explicit SVG attributes rather than CSS classes, consistent with how this project has no prior SVG in its codebase to establish a different convention).

## Non-goals / risks

- No automated tests for the DOM/SVG rendering layer — consistent with every prior UI task in this project. `computeScoreTrend` DOES get unit tests (TDD, matching the established pattern for `js/db.js`).
- The normal-mode series' differing lengths per player (since players don't necessarily score the same number of times) means the x-axis scale must be computed from the longest series across all plotted players, not assumed uniform — shorter series simply end earlier on the shared x-axis.
- Colors are reused from the existing player-color system rather than a freshly validated categorical palette; this was a deliberate, explicitly-discussed tradeoff (see Scope above) mitigated by mandatory direct labels/legend, not an oversight.
