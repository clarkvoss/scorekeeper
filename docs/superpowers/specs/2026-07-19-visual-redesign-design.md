# Rounded-Card Visual Redesign — Design Spec

Date: 2026-07-19

## Purpose

Restyle the scorekeeper app's Home, New Game, and normal-mode Active Game screens toward a "rounded cards, per-player accent color" look — softer, warmer, closer to modern scorekeeper apps (inspired by the visual style of https://apps.apple.com/us/app/score-keeper-for-game-night/id1245390236). Pure visual/CSS change; no new features, no data model changes. Also add a small visible affordance (a pencil icon) next to each score so the existing tap-to-type-exact-value feature is discoverable.

## Scope

**In scope:**
- Home screen: game list styled as rounded cards with soft shadow.
- New Game setup: inputs/buttons restyled to match (rounded, pill-shaped where appropriate).
- Active Game — normal mode: player rows become rounded cards with a colored left accent border, pill-shaped circular +/- buttons, and a pencil-icon hint next to the score number.

**Out of scope (explicitly, per user decision):**
- Rounds-mode table screen — unchanged.
- Summary/standings screen — unchanged.
- Any new functionality, data model changes, or interaction changes beyond the pencil-icon hint. The existing tap-to-type-exact-value dialog (`prompt()` on the score) is unchanged in behavior — only its discoverability improves.

## Visual details

- **Cards:** `border-radius: 14px`, `box-shadow: 0 2px 6px rgba(0,0,0,.08)` (dark-mode equivalent shadow, subtler), background via existing `--card-bg` custom property.
- **Accent:** left border on player rows/game-list items, `border-left: 6px solid <player color>` (already implemented for player rows; extend the same treatment to game-list items using a neutral `--accent` since games don't have a color).
- **Buttons:** +/- become circular (`border-radius: 50%`, fixed width/height ~32-36px, meeting the existing 44px minimum tap-target constraint via padding/hit-area, not visual size alone if needed). "+" uses `--accent` background with white text; "-" uses a neutral/muted background.
- **Score + pencil hint:** small pencil/edit glyph (e.g. Unicode "✎" or a simple inline SVG) rendered next to the score number, subdued color, indicating the number is tappable. No behavior change — same `prompt()` flow.
- **Theming:** all colors continue to route through the existing CSS custom properties (`--bg`, `--fg`, `--card-bg`, `--accent`, `--danger`, `--border`) so light/dark mode via `prefers-color-scheme` keeps working without new theme logic.

## Files touched

- `css/styles.css` — updated rules for `.game-list-item`, `.player-row`, `.score-display`, button styles; no new classes needed beyond what `js/render.js` already emits, except a new small class for the pencil hint (e.g. `.score-edit-hint`).
- `js/render.js` — `renderActiveGameNormal`: add a small pencil-hint element next to the score button. No changes to `renderHome`, `renderNewGame`, `renderActiveGameRounds`, or `renderSummary` markup structure (only their existing classes get restyled via CSS).

## Non-goals / risks

- No accessibility regression: tap targets stay at or above the existing 44px minimum even as buttons visually shrink to circles (achieved via padding, not shrinking the clickable area below 44px).
- No test changes needed — this is DOM/CSS-only, same as the original Task 8-13 styling work, which had no automated tests either.
