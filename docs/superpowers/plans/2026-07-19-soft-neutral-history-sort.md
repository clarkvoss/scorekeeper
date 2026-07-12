# Soft-Neutral Restyle + Game History + Richer Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three independent, contained changes per `docs/superpowers/specs/2026-07-19-soft-neutral-history-sort-design.md`: soft-neutral card styling, a game-history feature (finished games become read-only and separated from active games), and a 3-way sort cycle on the normal-mode Active Game screen.

**Architecture:** CSS-only visual change (Task 1); a new `finished` field + `finishGame()` mutator in `js/db.js` (Task 2, TDD); `js/app.js` wiring for the new mutator (Task 3); `js/render.js` changes to `renderHome` (Task 4) and `renderActiveGameNormal` (Task 5). No new files, no new routes (existing `#/game/:id/summary` route is reused for history entries).

**Tech Stack:** Plain CSS custom properties, vanilla JS DOM APIs, Node's built-in test runner for `js/db.js` (`npm test` → `node --test tests/*.test.js`).

## Global Constraints

- Player rows on the Active Game screen keep their per-player colored left-border accent — only the Home screen's game-list cards lose their accent border.
- `game.finished` must be read as falsy-safe everywhere (`!game.finished`, never `game.finished === false`) since games saved before this change won't have the field.
- No drag-and-drop / custom manual ordering — sort is limited to original/high-to-low/low-to-high.
- Rounds-mode table and Summary screen structure/behavior are unaffected by this plan (History routes finished games to the *existing* summary screen, it does not change that screen).
- No automated tests for the DOM/UI layer (`js/render.js`) — verify via syntax check + served-content check + manual browser pass, consistent with prior UI tasks. `js/db.js` changes DO get unit tests (TDD, per the established pattern for that file).

---

## Task 1: Soft-neutral CSS

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: updated visual rules for `--bg` (light mode), `.game-list-item` (no accent border, lighter shadow), `.player-row` (lighter shadow, accent border unchanged). No new classes.

- [ ] **Step 1: Lighten the light-mode page background**

In `css/styles.css`, in the `:root` block, change:

```css
  --bg: #ffffff;
```

to:

```css
  --bg: #fafafa;
```

Leave the `@media (prefers-color-scheme: dark)` block's `--bg: #121212;` unchanged.

- [ ] **Step 2: Remove the accent border and lighten the shadow on `.game-list-item`**

Replace the current `.game-list-item` rule:

```css
.game-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  border-radius: 0.875rem;
  border-left: 6px solid var(--accent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
```

with:

```css
.game-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  border-radius: 0.875rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
```

(The `border-left` line is removed; `box-shadow` value changes from `0 2px 6px rgba(0,0,0,0.12)` to `0 1px 3px rgba(0,0,0,0.06)`.)

- [ ] **Step 3: Lighten the shadow on `.player-row` (keep its accent border)**

Replace the current `.player-row` rule:

```css
.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: var(--card-bg);
  border-left: 6px solid var(--accent);
  border-radius: 0.875rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  padding: 0.6rem;
  margin-bottom: 0.5rem;
}
```

with:

```css
.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: var(--card-bg);
  border-left: 6px solid var(--accent);
  border-radius: 0.875rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 0.6rem;
  margin-bottom: 0.5rem;
}
```

(Only `box-shadow` changes; `border-left` stays exactly as-is — this rule sets the default accent color, and `js/render.js` already overrides `row.style.borderLeftColor = player.color` per-row at render time, which continues to work unchanged.)

- [ ] **Step 4: Verify**

Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced braces'; print('OK, braces balanced:', s.count('{'))"`
Run: `grep -c "border-left: 6px solid var(--accent);" css/styles.css` — expect `1` (only `.player-row` should still have it; `.game-list-item` should not)
Run: `grep -c '^\.game-list-item {' css/styles.css` — expect `1`
Run: `grep -c '^\.player-row {' css/styles.css` — expect `1`

Then serve and confirm delivery: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "0 1px 3px rgba"` — expect `2`, then stop the server.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css
git commit -m "Soften card shadows and remove Home screen accent border for a more neutral look"
```

---

## Task 2: `finished` field and `finishGame()` in js/db.js

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Consumes: existing `createGame(db, name, mode)` from Task 3 of the original plan (already in the file).
- Produces: `createGame` now includes `finished: false` in the returned game object; new `finishGame(game) -> void` sets `game.finished = true` and bumps `game.updatedAt`. Relied on by Task 3 (`js/app.js`) and Task 4 (`js/render.js`'s `renderHome`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `finishGame` (the import line currently ends with `..., savePlayerList } from '../js/db.js';` — add `finishGame` to that list):

```js
test('createGame defaults finished to false', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(game.finished, false);
});

test('finishGame marks a game as finished and bumps updatedAt', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const before = game.updatedAt;
  finishGame(game);
  assert.equal(game.finished, true);
  assert.ok(game.updatedAt >= before);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `game.finished` is `undefined` (not `false`) in the first new test, and `finishGame is not a function` in the second.

- [ ] **Step 3: Update `js/db.js`**

In `createGame`, add `finished: false` to the returned object (insert after `rounds: []`):

```js
export function createGame(db, name, mode) {
  const game = {
    id: makeId(),
    name,
    mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [],
    scores: {},
    history: [],
    rounds: [],
    finished: false
  };
  db.games.push(game);
  return game;
}
```

Append a new function anywhere after `createGame` (e.g. right after `removePlayer`, or at the end of the file near `deleteGame`):

```js
export function finishGame(game) {
  game.finished = true;
  game.updatedAt = Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 24 tests passing (22 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add finished flag to games and a finishGame mutator"
```

---

## Task 3: Wire `finishGame` into js/app.js

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `finishGame(game)` from `js/db.js` (Task 2).
- Produces: `actions.finishGame(gameId)` now mutates the game's `finished` state before navigating (previously it only navigated). No signature change.

- [ ] **Step 1: Update the `db.js` import**

Change the import line:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList } from './db.js';
```

to:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame } from './db.js';
```

- [ ] **Step 2: Replace the `finishGame` action**

Replace:

```js
  finishGame: (gameId) => { location.hash = `#/game/${gameId}/summary`; },
```

with:

```js
  finishGame: (gameId) => {
    finishGame(findGame(gameId));
    persist();
    location.hash = `#/game/${gameId}/summary`;
  },
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all 24 tests (from Task 2) still passing (this file isn't covered by unit tests, so this just confirms no regression in the covered modules).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "finishGame(findGame"` — expect `1`, then stop the server.

Note in the report that full interactive verification (finishing a game and confirming it's marked finished, persists across reload, and routes correctly from Home) requires a real browser and will be done separately by the controller — it also depends on Task 4's Home screen split to be visible.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Mark games finished when Finish Game is tapped"
```

---

## Task 4: Split Home into Games and History sections

**Files:**
- Modify: `js/render.js` (replace `renderHome`)

**Interfaces:**
- Consumes: `game.finished` field from `js/db.js` (Task 2).
- Produces: same `renderHome(root, db, actions) -> void` signature; no new interfaces. Unfinished games link to `#/game/:id` (unchanged), finished games link to `#/game/:id/summary` (existing route, already handled by `js/app.js`'s `route()`).

- [ ] **Step 1: Replace the entire `renderHome` function**

Replace the current `renderHome` function in `js/render.js`:

```js
export function renderHome(root, db, actions) {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = 'Scorekeeper';
  root.appendChild(heading);

  const newGameBtn = document.createElement('button');
  newGameBtn.textContent = 'New Game';
  newGameBtn.addEventListener('click', () => actions.goNewGame());
  root.appendChild(newGameBtn);

  const gamesHeading = document.createElement('h2');
  gamesHeading.textContent = 'Games';
  root.appendChild(gamesHeading);

  if (db.games.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No games yet. Tap "New Game" to start one.';
    root.appendChild(empty);
  }

  const list = document.createElement('ul');
  list.className = 'game-list';
  for (const game of [...db.games].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const item = document.createElement('li');
    item.className = 'game-list-item';

    const link = document.createElement('a');
    link.href = `#/game/${game.id}`;
    link.textContent = `${game.name} (${game.players.length} players)`;
    item.appendChild(link);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'danger';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Delete "${game.name}"? This cannot be undone.`)) {
        actions.deleteGame(game.id);
      }
    });
    item.appendChild(deleteBtn);

    list.appendChild(item);
  }
  root.appendChild(list);
}
```

with:

```js
export function renderHome(root, db, actions) {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = 'Scorekeeper';
  root.appendChild(heading);

  const newGameBtn = document.createElement('button');
  newGameBtn.textContent = 'New Game';
  newGameBtn.addEventListener('click', () => actions.goNewGame());
  root.appendChild(newGameBtn);

  function renderGameList(games, emptyMessage, hrefFor) {
    if (games.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = emptyMessage;
      root.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'game-list';
    for (const game of games) {
      const item = document.createElement('li');
      item.className = 'game-list-item';

      const link = document.createElement('a');
      link.href = hrefFor(game);
      link.textContent = `${game.name} (${game.players.length} players)`;
      item.appendChild(link);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'danger';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete "${game.name}"? This cannot be undone.`)) {
          actions.deleteGame(game.id);
        }
      });
      item.appendChild(deleteBtn);

      list.appendChild(item);
    }
    root.appendChild(list);
  }

  const sortedGames = [...db.games].sort((a, b) => b.updatedAt - a.updatedAt);
  const activeGames = sortedGames.filter(g => !g.finished);
  const finishedGames = sortedGames.filter(g => g.finished);

  const gamesHeading = document.createElement('h2');
  gamesHeading.textContent = 'Games';
  root.appendChild(gamesHeading);
  renderGameList(
    activeGames,
    'No games yet. Tap "New Game" to start one.',
    (game) => `#/game/${game.id}`
  );

  const historyHeading = document.createElement('h2');
  historyHeading.textContent = 'History';
  root.appendChild(historyHeading);
  renderGameList(
    finishedGames,
    'No finished games yet.',
    (game) => `#/game/${game.id}/summary`
  );
}
```

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all 24 tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "historyHeading"` — expect `1`, then stop the server.

Note in the report that full interactive verification (creating a game, finishing it, confirming it moves from "Games" to "History" and links to the read-only summary) requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Split Home screen into active Games and finished-game History sections"
```

---

## Task 5: 3-way sort cycle on normal-mode Active Game screen

**Files:**
- Modify: `js/render.js` (inside `renderActiveGameNormal`)

**Interfaces:**
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature, only internal sort-button/logic changes.

- [ ] **Step 1: Replace the sort button block**

In `renderActiveGameNormal`, replace:

```js
  const sortBtn = document.createElement('button');
  let sorted = false;
  sortBtn.textContent = 'Sort by score';
  sortBtn.addEventListener('click', () => {
    sorted = !sorted;
    renderRows();
  });
  root.appendChild(sortBtn);
```

with:

```js
  const sortLabels = { original: 'Sort: Original', desc: 'Sort: High→Low', asc: 'Sort: Low→High' };
  let sortMode = 'original';
  const sortBtn = document.createElement('button');
  sortBtn.textContent = sortLabels[sortMode];
  sortBtn.addEventListener('click', () => {
    sortMode = sortMode === 'original' ? 'desc' : sortMode === 'desc' ? 'asc' : 'original';
    sortBtn.textContent = sortLabels[sortMode];
    renderRows();
  });
  root.appendChild(sortBtn);
```

(`→` is the RIGHTWARDS ARROW glyph "→"; using the escape avoids encoding ambiguity across editing tools, consistent with how `−`/`✎` were handled in the prior redesign task.)

- [ ] **Step 2: Replace the sort logic inside `renderRows`**

Replace:

```js
  function renderRows() {
    rowsContainer.innerHTML = '';
    const players = sorted
      ? [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id])
      : game.players;
```

with:

```js
  function renderRows() {
    rowsContainer.innerHTML = '';
    let players = game.players;
    if (sortMode === 'desc') {
      players = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
    } else if (sortMode === 'asc') {
      players = [...game.players].sort((a, b) => game.scores[a.id] - game.scores[b.id]);
    }
```

(The rest of `renderRows` — the `for (const player of players) { ... }` loop and everything after it — is unchanged.)

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all 24 tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "sortLabels"` — expect at least `2`, then stop the server.

Note in the report that full interactive verification (clicking the sort button through all three states and confirming row order changes correctly) requires a real browser and will be done separately by the controller.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Replace two-state sort toggle with a 3-way original/high-to-low/low-to-high cycle"
```

---

## Final verification

- [ ] Run `npm test` — all 24 tests passing.
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Confirm Home screen shows lighter, accent-free cards under "Games" and a separate "History" section.
  - Create a normal-mode game, score it, tap "Finish Game" — confirm it disappears from "Games" and appears under "History" on Home, and that clicking it from History opens the read-only summary (not the editable score screen).
  - In an in-progress normal-mode game, click the sort button three times and confirm it cycles Original → High→Low → Low→High → Original, with row order changing accordingly.
  - Confirm player rows still show their per-player colored left border.
  - Confirm rounds-mode table and summary screen still look and behave as before this plan.
