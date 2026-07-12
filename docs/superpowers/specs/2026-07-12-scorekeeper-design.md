# Scorekeeper Web App — Design Spec

Date: 2026-07-12

## Purpose

A browser-based game scorekeeper, inspired by the iOS app "Keep Score" (https://apps.apple.com/us/app/keep-score-game-scorekeeper/id6755915027), hosted as a static site (new repo, e.g. `clarkvoss.github.io/scorekeeper/` or its own GitHub Pages site). v1 is a **generic scorekeeper only** — no built-in game rule libraries (Qwixx, Pinochle, etc.) and no extra tools (dice roller, timer, buzzer, coin flip). Those are explicitly out of scope for this spec.

## Tech approach

- Plain HTML/CSS/JS, no build step, no framework. Deploys directly as static files to GitHub Pages.
- Single-page app: one `index.html`, a JS module renders different "screens" by swapping DOM content based on app state, plus a light `#hash` per screen so the browser back button doesn't leave the app.
- All app state lives in one in-memory JS object, persisted to `localStorage` on every mutation.
- Mobile-first responsive layout; scales up to tablet/desktop.

## Data model

Persisted as one JSON blob in `localStorage`:

```js
{
  games: [
    {
      id: string,
      name: string,
      mode: "normal" | "rounds",
      createdAt: number,
      updatedAt: number,
      players: [{ id: string, name: string, color: string }],

      // normal mode only:
      scores: { [playerId]: number },
      history: [{ playerId: string, delta: number, timestamp: number }],

      // rounds mode only:
      rounds: [
        { [playerId]: number }  // one object per round, keyed by player
      ]
    }
  ],
  savedPlayerLists: [
    { name: string, players: [{ name: string, color: string }] }
  ],
  settings: { theme: "auto" }  // "auto" follows prefers-color-scheme; no theme picker in v1
}
```

## Screens

1. **Home** — list of existing games (in-progress and past), "New Game" button, list of saved player lists for quick reuse.
2. **New Game setup** — name the game, add players (name + color, from a fixed round-robin palette of 8-10 colors, user can override), choose mode (normal / rounds), optionally load a saved player list, optionally save the current player list for future reuse. "Start" is disabled until ≥2 players are added.
3. **Active game — normal mode** — each player shown as a row/card with a running total. Tap +/- to adjust by the player's current step (default 1, tappable to cycle 1/5/10, long-press to enter a custom step). Tap the score number to open a numeric input and set an exact value. "Undo" button reverses the most recent entry in `history`. Toggle to sort players by score.
4. **Active game — rounds mode** — table layout: rows are rounds, columns are players. "Add round" appends a new row; each cell is editable inline. Running totals shown in a footer/header row. Past rounds can be edited or deleted directly (no separate undo stack needed since the table itself is always editable).
5. **Game over / summary** — reachable from either mode via a "Finish game" action. Shows final standings sorted by score, with an option to start a rematch that reuses the same players.

## Interactions & error handling

- **Deleting a game**: confirmed via a plain `confirm()` dialog — no custom modal needed for v1.
- **Empty states**: home screen with no games shows a prompt to create one.
- **localStorage write failures** (e.g. private browsing, storage full): writes are wrapped in try/catch; on failure, show a small non-blocking banner ("scores won't be saved this session") instead of crashing.
- **Undo scope**: only applies to normal mode's score deltas. Rounds mode doesn't need it since every round is directly editable in the table.

## Visual design

- Mobile-first, single-column layouts, large tap targets.
- One theme in v1: light/dark via `prefers-color-scheme`, no in-app theme picker (the source app's 8-theme picker is out of scope).
- Player colors: fixed palette of 8-10 distinct colors assigned round-robin at creation, overridable per player.

## Explicitly out of scope for v1

- Built-in game rule libraries (Qwixx, Pinochle, Solitaire, etc.) and the 100+ card game reference library.
- Dice roller, sand timer, coin flip, buzzer, random player picker, number generator.
- In-app purchases / paywalled content.
- Multiple color themes (only light/dark auto).
- Cross-device sync — localStorage only, no account/backend.
- Export/import of game data.

## Deployment

New standalone repo for this project (not the root `clarkvoss.github.io` repo), served via its own GitHub Pages (or as a subpath of the root site) — exact repo name/placement to be decided at deploy time.
