# Scorekeeper Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first, static-hosted browser scorekeeper (generic score tracking only — no built-in game rule libraries, no dice/timer/tools) per `docs/superpowers/specs/2026-07-12-scorekeeper-design.md`.

**Architecture:** Plain HTML/CSS/JS, no build step, no framework. A single `index.html` loads an ES-module `js/app.js` that owns one in-memory `db` object, persisted to `localStorage` on every mutation. `js/db.js` holds pure state-mutation functions (unit tested with Node's built-in test runner). `js/render.js` renders screens by swapping the contents of `#app` based on a `#/...` URL hash. `js/storage.js` wraps `localStorage` reads/writes with error handling. `js/colors.js` holds the player color palette.

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS, `node --test` for unit tests of pure logic (dev-only dependency, not shipped), Python's built-in `http.server` for local manual verification (no npm install required to run the app).

## Global Constraints

- No build step, no frontend framework — plain HTML/CSS/JS only (per spec "Tech approach").
- Persistence is `localStorage` only — no backend, no accounts, no sync (per spec "Persistence").
- Mobile-first responsive layout (per spec "Visual design").
- Out of scope: built-in game rule libraries, dice/timer/buzzer/coin-flip tools, in-app purchases, multiple color themes (only light/dark via `prefers-color-scheme`), export/import (per spec "Explicitly out of scope for v1").
- `localStorage` write failures must show a non-blocking banner, not crash (per spec "Interactions & error handling").
- Data model field names must exactly match the spec's `db` shape (`games`, `savedPlayerLists`, `settings`, and per-game `id/name/mode/createdAt/updatedAt/players/scores/history/rounds`).

---

## Task 1: Project scaffold

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/app.js` (placeholder)
- Create: `package.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: the `#app` root DOM element that all later render code targets; the `#banner` element for storage-error messages; `package.json` `test` script (`node --test tests/`) that later tasks rely on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "scorekeeper",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
node_modules/
```

- [ ] **Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scorekeeper</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div id="banner" class="banner hidden"></div>
  <main id="app"></main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `css/styles.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --card-bg: #f4f4f5;
  --accent: #457b9d;
  --danger: #e63946;
  --border: #d9d9de;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --fg: #f0f0f0;
    --card-bg: #1e1e1e;
    --accent: #6fa8c9;
    --danger: #ff6b6b;
    --border: #333338;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

#app {
  max-width: 480px;
  margin: 0 auto;
  padding: 1rem;
  min-height: 100vh;
}

button {
  font-size: 1rem;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  background: var(--accent);
  color: white;
}

.banner {
  background: var(--danger);
  color: white;
  text-align: center;
  padding: 0.5rem;
}
.banner.hidden { display: none; }
```

- [ ] **Step 5: Create placeholder `js/app.js`**

```js
document.getElementById('app').textContent = 'Scorekeeper loading...';
```

- [ ] **Step 6: Verify the scaffold loads**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Then open `http://localhost:8000` in a browser.
Expected: page shows "Scorekeeper loading..." with no console errors. Stop the server (Ctrl-C) after checking.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore index.html css/styles.css js/app.js
git commit -m "Scaffold scorekeeper project structure"
```

---

## Task 2: Player color palette (`js/colors.js`)

**Files:**
- Create: `js/colors.js`
- Test: `tests/colors.test.js`

**Interfaces:**
- Produces: `PLAYER_COLORS` (array of 10 hex strings), `nextColor(existingCount: number) -> string` — used by Task 3's `addPlayer`.

- [ ] **Step 1: Write the failing test**

Create `tests/colors.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_COLORS, nextColor } from '../js/colors.js';

test('PLAYER_COLORS has at least 8 distinct colors', () => {
  assert.ok(PLAYER_COLORS.length >= 8);
  assert.equal(new Set(PLAYER_COLORS).size, PLAYER_COLORS.length);
});

test('nextColor cycles through the palette round-robin', () => {
  assert.equal(nextColor(0), PLAYER_COLORS[0]);
  assert.equal(nextColor(1), PLAYER_COLORS[1]);
  assert.equal(nextColor(PLAYER_COLORS.length), PLAYER_COLORS[0]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/colors.js'`

- [ ] **Step 3: Create `js/colors.js`**

```js
export const PLAYER_COLORS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#264653', '#a8dadc', '#6d597a', '#b56576',
  '#457b9d', '#43aa8b'
];

export function nextColor(existingCount) {
  return PLAYER_COLORS[existingCount % PLAYER_COLORS.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/colors.js tests/colors.test.js
git commit -m "Add player color palette module"
```

---

## Task 3: Core game/player state (`js/db.js` part 1)

**Files:**
- Create: `js/db.js`
- Test: `tests/db.test.js`

**Interfaces:**
- Consumes: `nextColor(existingCount)` from `js/colors.js` (Task 2).
- Produces: `createDb() -> {games:[], savedPlayerLists:[], settings:{theme:"auto"}}`, `createGame(db, name, mode) -> game`, `addPlayer(game, name, color?) -> player`, `removePlayer(game, playerId) -> void`. Game shape: `{id, name, mode, createdAt, updatedAt, players:[], scores:{}, history:[], rounds:[]}`. Player shape: `{id, name, color}`. These exact field names are relied on by Tasks 4-13.

- [ ] **Step 1: Write the failing tests**

Create `tests/db.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, createGame, addPlayer, removePlayer } from '../js/db.js';

test('createDb returns an empty db with default settings', () => {
  const db = createDb();
  assert.deepEqual(db.games, []);
  assert.deepEqual(db.savedPlayerLists, []);
  assert.equal(db.settings.theme, 'auto');
});

test('createGame adds a game to db.games with expected shape', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(db.games.length, 1);
  assert.equal(game.name, 'Poker Night');
  assert.equal(game.mode, 'normal');
  assert.deepEqual(game.players, []);
  assert.deepEqual(game.scores, {});
  assert.deepEqual(game.history, []);
  assert.deepEqual(game.rounds, []);
  assert.ok(game.id);
  assert.ok(game.createdAt);
});

test('addPlayer assigns a round-robin color and initializes score in normal mode', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  assert.equal(game.players.length, 2);
  assert.notEqual(p1.color, p2.color);
  assert.equal(game.scores[p1.id], 0);
  assert.equal(game.scores[p2.id], 0);
});

test('addPlayer respects an explicit color override', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice', '#123456');
  assert.equal(p1.color, '#123456');
});

test('addPlayer in rounds mode does not initialize game.scores', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  assert.equal(game.scores[p1.id], undefined);
});

test('removePlayer deletes the player and their score/history entries', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  game.scores[p1.id] = 5;
  game.history.push({ playerId: p1.id, delta: 5, timestamp: Date.now() });
  removePlayer(game, p1.id);
  assert.equal(game.players.length, 0);
  assert.equal(game.scores[p1.id], undefined);
  assert.equal(game.history.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/db.js'`

- [ ] **Step 3: Create `js/db.js`**

```js
import { nextColor } from './colors.js';

export function createDb() {
  return {
    games: [],
    savedPlayerLists: [],
    settings: { theme: 'auto' }
  };
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

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
    rounds: []
  };
  db.games.push(game);
  return game;
}

export function addPlayer(game, name, color) {
  const player = {
    id: makeId(),
    name,
    color: color || nextColor(game.players.length)
  };
  game.players.push(player);
  if (game.mode === 'normal') {
    game.scores[player.id] = 0;
  }
  game.updatedAt = Date.now();
  return player;
}

export function removePlayer(game, playerId) {
  game.players = game.players.filter(p => p.id !== playerId);
  delete game.scores[playerId];
  game.history = game.history.filter(h => h.playerId !== playerId);
  for (const round of game.rounds) {
    delete round[playerId];
  }
  game.updatedAt = Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add core game/player state management"
```

---

## Task 4: Normal-mode scoring (`js/db.js` part 2)

**Files:**
- Modify: `js/db.js` (append functions)
- Modify: `tests/db.test.js` (append tests)

**Interfaces:**
- Consumes: `game.scores`, `game.history` from Task 3.
- Produces: `adjustScore(game, playerId, delta) -> number`, `setScore(game, playerId, value) -> number`, `undo(game) -> {playerId, delta, timestamp} | null`. Relied on by Task 8's active-game-normal render.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` (add to the existing import line's function list too — update it to `import { createDb, createGame, addPlayer, removePlayer, adjustScore, setScore, undo } from '../js/db.js';`):

```js
test('adjustScore applies a delta and records history', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const newScore = adjustScore(game, p1.id, 5);
  assert.equal(newScore, 5);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].delta, 5);
  assert.equal(game.history[0].playerId, p1.id);
});

test('setScore computes and applies the correct delta', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 5);
  setScore(game, p1.id, 20);
  assert.equal(game.scores[p1.id], 20);
  assert.equal(game.history.at(-1).delta, 15);
});

test('undo reverses the most recent history entry', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 5);
  adjustScore(game, p1.id, 3);
  const undone = undo(game);
  assert.equal(undone.delta, 3);
  assert.equal(game.scores[p1.id], 5);
  assert.equal(game.history.length, 1);
});

test('undo returns null when history is empty', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(undo(game), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `adjustScore is not a function` (or similar, since the import line now references undefined exports).

- [ ] **Step 3: Append to `js/db.js`**

```js
export function adjustScore(game, playerId, delta) {
  game.scores[playerId] = (game.scores[playerId] || 0) + delta;
  game.history.push({ playerId, delta, timestamp: Date.now() });
  game.updatedAt = Date.now();
  return game.scores[playerId];
}

export function setScore(game, playerId, value) {
  const current = game.scores[playerId] || 0;
  return adjustScore(game, playerId, value - current);
}

export function undo(game) {
  const entry = game.history.pop();
  if (!entry) return null;
  game.scores[entry.playerId] = (game.scores[entry.playerId] || 0) - entry.delta;
  game.updatedAt = Date.now();
  return entry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 10 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add normal-mode scoring with undo"
```

---

## Task 5: Rounds-mode scoring (`js/db.js` part 3)

**Files:**
- Modify: `js/db.js` (append functions)
- Modify: `tests/db.test.js` (append tests)

**Interfaces:**
- Consumes: `game.rounds`, `game.players` from Task 3.
- Produces: `addRound(game) -> number` (index of new round), `setRoundScore(game, roundIndex, playerId, value) -> void`, `deleteRound(game, roundIndex) -> void`, `computeRoundsTotals(game) -> {[playerId]: number}`. Relied on by Task 9's active-game-rounds render.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `addRound, setRoundScore, deleteRound, computeRoundsTotals`:

```js
test('addRound, setRoundScore, and computeRoundsTotals track per-round scores', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  const r0 = addRound(game);
  setRoundScore(game, r0, p1.id, 10);
  setRoundScore(game, r0, p2.id, 7);
  const r1 = addRound(game);
  setRoundScore(game, r1, p1.id, 3);
  setRoundScore(game, r1, p2.id, 8);
  assert.equal(game.rounds.length, 2);
  const totals = computeRoundsTotals(game);
  assert.equal(totals[p1.id], 13);
  assert.equal(totals[p2.id], 15);
});

test('computeRoundsTotals returns 0 for players with no rounds yet', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  const totals = computeRoundsTotals(game);
  assert.equal(totals[p1.id], 0);
});

test('deleteRound removes a round from the rounds list', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  const r0 = addRound(game);
  setRoundScore(game, r0, p1.id, 10);
  addRound(game);
  deleteRound(game, 0);
  assert.equal(game.rounds.length, 1);
  assert.equal(computeRoundsTotals(game)[p1.id], 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `addRound is not a function`.

- [ ] **Step 3: Append to `js/db.js`**

```js
export function addRound(game) {
  game.rounds.push({});
  game.updatedAt = Date.now();
  return game.rounds.length - 1;
}

export function setRoundScore(game, roundIndex, playerId, value) {
  game.rounds[roundIndex][playerId] = value;
  game.updatedAt = Date.now();
}

export function deleteRound(game, roundIndex) {
  game.rounds.splice(roundIndex, 1);
  game.updatedAt = Date.now();
}

export function computeRoundsTotals(game) {
  const totals = {};
  for (const player of game.players) {
    totals[player.id] = 0;
  }
  for (const round of game.rounds) {
    for (const playerId of Object.keys(round)) {
      totals[playerId] = (totals[playerId] || 0) + (round[playerId] || 0);
    }
  }
  return totals;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add rounds-mode scoring"
```

---

## Task 6: Game list & saved player lists (`js/db.js` part 4)

**Files:**
- Modify: `js/db.js` (append functions)
- Modify: `tests/db.test.js` (append tests)

**Interfaces:**
- Consumes: `db.games`, `db.savedPlayerLists` from Task 3.
- Produces: `deleteGame(db, gameId) -> void`, `savePlayerList(db, name, players) -> {name, players}`. Relied on by Task 8 (home screen: delete game) and Task 9 (new-game setup: save/load player lists).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `deleteGame, savePlayerList`:

```js
test('deleteGame removes a game from db.games', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  createGame(db, 'Other Game', 'normal');
  deleteGame(db, game.id);
  assert.equal(db.games.length, 1);
  assert.equal(db.games[0].name, 'Other Game');
});

test('savePlayerList stores a reusable list of player names/colors', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  addPlayer(game, 'Alice', '#e63946');
  addPlayer(game, 'Bob', '#f4a261');
  savePlayerList(db, 'Regulars', game.players);
  assert.equal(db.savedPlayerLists.length, 1);
  assert.equal(db.savedPlayerLists[0].name, 'Regulars');
  assert.equal(db.savedPlayerLists[0].players.length, 2);
  assert.equal(db.savedPlayerLists[0].players[0].name, 'Alice');
  assert.equal(db.savedPlayerLists[0].players[0].color, '#e63946');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `deleteGame is not a function`.

- [ ] **Step 3: Append to `js/db.js`**

```js
export function deleteGame(db, gameId) {
  db.games = db.games.filter(g => g.id !== gameId);
}

export function savePlayerList(db, name, players) {
  const list = {
    name,
    players: players.map(p => ({ name: p.name, color: p.color }))
  };
  db.savedPlayerLists.push(list);
  return list;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 15 tests passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add game deletion and saved player lists"
```

---

## Task 7: Storage layer (`js/storage.js`)

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `createDb()` from `js/db.js` (Task 3) as a fallback factory.
- Produces: `loadDb(storage, createDb) -> {db, error}`, `saveDb(db, storage) -> {ok, error}`. `storage` is any object with `getItem(key)`/`setItem(key, value)` (in the browser this is `window.localStorage`; tests pass a fake). Relied on by Task 8's `js/app.js` bootstrap.

- [ ] **Step 1: Write the failing tests**

Create `tests/storage.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDb, saveDb } from '../js/storage.js';
import { createDb } from '../js/db.js';

function makeFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    _data: data
  };
}

test('loadDb returns a fresh db when nothing is stored', () => {
  const storage = makeFakeStorage();
  const { db, error } = loadDb(storage, createDb);
  assert.equal(error, null);
  assert.deepEqual(db.games, []);
});

test('loadDb parses a previously saved db', () => {
  const saved = JSON.stringify({ games: [{ id: 'x' }], savedPlayerLists: [], settings: { theme: 'auto' } });
  const storage = makeFakeStorage({ 'scorekeeper-db': saved });
  const { db, error } = loadDb(storage, createDb);
  assert.equal(error, null);
  assert.equal(db.games[0].id, 'x');
});

test('loadDb falls back to a fresh db on corrupt JSON', () => {
  const storage = makeFakeStorage({ 'scorekeeper-db': '{not valid json' });
  const { db, error } = loadDb(storage, createDb);
  assert.notEqual(error, null);
  assert.deepEqual(db.games, []);
});

test('saveDb writes JSON to storage', () => {
  const storage = makeFakeStorage();
  const db = createDb();
  const result = saveDb(db, storage);
  assert.equal(result.ok, true);
  assert.equal(storage._data['scorekeeper-db'], JSON.stringify(db));
});

test('saveDb reports failure when storage.setItem throws', () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); }
  };
  const result = saveDb(createDb(), storage);
  assert.equal(result.ok, false);
  assert.notEqual(result.error, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/storage.js'`

- [ ] **Step 3: Create `js/storage.js`**

```js
const STORAGE_KEY = 'scorekeeper-db';

export function loadDb(storage, createDb) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { db: createDb(), error: null };
    return { db: JSON.parse(raw), error: null };
  } catch (err) {
    return { db: createDb(), error: err };
  }
}

export function saveDb(db, storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(db));
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 20 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "Add localStorage persistence layer with error handling"
```

---

## Task 8: App shell, routing, and Home screen

**Files:**
- Create: `js/render.js`
- Modify: `js/app.js` (replace placeholder content)

**Interfaces:**
- Consumes: `createDb`, `deleteGame` from `js/db.js`; `loadDb`, `saveDb` from `js/storage.js`.
- Produces: `renderHome(root, db, actions) -> void` in `js/render.js` (relied on by Task 12's `route()` extensions); the `route()` / `persist()` pattern in `js/app.js` that Tasks 9-12 extend with more `case` branches and more `actions.*` functions.

This is DOM/UI wiring — no unit tests (no jsdom dependency, per the "no build step" constraint). Verified manually in-browser.

- [ ] **Step 1: Create `js/render.js` with `renderHome`**

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

- [ ] **Step 2: Replace `js/app.js`**

```js
import { createDb, deleteGame } from './db.js';
import { loadDb, saveDb } from './storage.js';
import { renderHome } from './render.js';

const root = document.getElementById('app');
const banner = document.getElementById('banner');

const { db, error: loadError } = loadDb(window.localStorage, createDb);
if (loadError) showBanner('Saved data could not be read; starting fresh.');

function showBanner(message) {
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function persist() {
  const result = saveDb(db, window.localStorage);
  if (!result.ok) showBanner("Scores won't be saved this session.");
}

function findGame(gameId) {
  return db.games.find(g => g.id === gameId);
}

const actions = {
  goHome: () => { location.hash = '#/'; },
  goNewGame: () => { location.hash = '#/new'; },
  deleteGame: (gameId) => {
    deleteGame(db, gameId);
    persist();
    route();
  }
};

function route() {
  const hash = location.hash || '#/';
  if (hash === '#/') {
    renderHome(root, db, actions);
    return;
  }
  // Additional routes are added in later tasks.
  renderHome(root, db, actions);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
route();
```

- [ ] **Step 3: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Open `http://localhost:8000`.
Expected: "Scorekeeper" heading, "New Game" button, "No games yet..." message (no games exist yet). No console errors. Stop the server after checking.

- [ ] **Step 4: Commit**

```bash
git add js/render.js js/app.js
git commit -m "Add app shell, routing skeleton, and Home screen"
```

---

## Task 9: New Game setup screen

**Files:**
- Modify: `js/render.js` (append `renderNewGame`)
- Modify: `js/app.js` (add route, add `actions.startGame`, `actions.savePlayerList`)

**Interfaces:**
- Consumes: `addPlayer`, `createGame`, `savePlayerList` from `js/db.js`; `renderHome` pattern from Task 8.
- Produces: `renderNewGame(root, db, actions) -> void`; `actions.startGame(name, mode, players, listNameToSave) -> void`. Relied on by Task 8's home screen link (`#/new`) and by nothing downstream except routing.

- [ ] **Step 1: Append `renderNewGame` to `js/render.js`**

```js
export function renderNewGame(root, db, actions) {
  root.innerHTML = '';
  let draftPlayers = [];
  let mode = 'normal';

  const heading = document.createElement('h1');
  heading.textContent = 'New Game';
  root.appendChild(heading);

  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Game name';
  nameInput.value = 'Game Night';
  root.appendChild(nameInput);

  const modeSelect = document.createElement('select');
  modeSelect.innerHTML = `
    <option value="normal">Normal (running total)</option>
    <option value="rounds">Rounds (per-round table)</option>
  `;
  modeSelect.addEventListener('change', () => { mode = modeSelect.value; });
  root.appendChild(modeSelect);

  if (db.savedPlayerLists.length > 0) {
    const loadSelect = document.createElement('select');
    loadSelect.innerHTML = '<option value="">Load saved player list...</option>' +
      db.savedPlayerLists.map((list, i) => `<option value="${i}">${list.name}</option>`).join('');
    loadSelect.addEventListener('change', () => {
      if (loadSelect.value === '') return;
      const list = db.savedPlayerLists[Number(loadSelect.value)];
      draftPlayers = list.players.map(p => ({ name: p.name, color: p.color }));
      renderPlayerList();
    });
    root.appendChild(loadSelect);
  }

  const playerListEl = document.createElement('ul');
  root.appendChild(playerListEl);

  function renderPlayerList() {
    playerListEl.innerHTML = '';
    for (const [i, p] of draftPlayers.entries()) {
      const li = document.createElement('li');
      li.textContent = p.name + ' ';
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        draftPlayers.splice(i, 1);
        renderPlayerList();
      });
      li.appendChild(removeBtn);
      playerListEl.appendChild(li);
    }
  }

  const playerNameInput = document.createElement('input');
  playerNameInput.placeholder = 'Player name';
  root.appendChild(playerNameInput);

  const addPlayerBtn = document.createElement('button');
  addPlayerBtn.textContent = 'Add Player';
  addPlayerBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) return;
    draftPlayers.push({ name, color: null });
    playerNameInput.value = '';
    renderPlayerList();
  });
  root.appendChild(addPlayerBtn);

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Game';
  startBtn.disabled = true;
  root.appendChild(startBtn);

  const origRenderPlayerList = renderPlayerList;
  renderPlayerList = function () {
    origRenderPlayerList();
    startBtn.disabled = draftPlayers.length < 2;
  };

  startBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Game Night';
    actions.startGame(name, mode, draftPlayers);
  });

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Cancel';
  backBtn.addEventListener('click', () => actions.goHome());
  root.appendChild(backBtn);
}
```

- [ ] **Step 2: Add route and actions to `js/app.js`**

Update the imports line to `import { createDb, deleteGame, createGame, addPlayer } from './db.js';` and add `import { renderHome, renderNewGame } from './render.js';`.

Add to the `actions` object (before the closing `};`):

```js
  startGame: (name, mode, draftPlayers) => {
    const game = createGame(db, name, mode);
    for (const p of draftPlayers) {
      addPlayer(game, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${game.id}`;
  },
```

Update `route()`:

```js
function route() {
  const hash = location.hash || '#/';
  if (hash === '#/') {
    renderHome(root, db, actions);
    return;
  }
  if (hash === '#/new') {
    renderNewGame(root, db, actions);
    return;
  }
  renderHome(root, db, actions);
}
```

- [ ] **Step 3: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Open `http://localhost:8000`, click "New Game". Add two players ("Alice", "Bob"), confirm "Start Game" is disabled with 0-1 players and enabled with 2+. Click "Start Game".
Expected: URL hash becomes `#/game/<id>` (screen still shows Home content since the active-game route isn't implemented until Task 10/11 — that's expected for now). Reload the page and click "New Game" again — the game you started should now appear on the Home screen list once you navigate back to `#/`.

- [ ] **Step 4: Commit**

```bash
git add js/render.js js/app.js
git commit -m "Add New Game setup screen"
```

---

## Task 10: Active game — normal mode screen

**Files:**
- Modify: `js/render.js` (append `renderActiveGameNormal`)
- Modify: `js/app.js` (add route, add scoring actions)

**Interfaces:**
- Consumes: `adjustScore`, `setScore`, `undo` from `js/db.js`.
- Produces: `renderActiveGameNormal(root, game, actions) -> void`; `actions.adjustScore(gameId, playerId, delta)`, `actions.setScore(gameId, playerId, value)`, `actions.undo(gameId)`, `actions.finishGame(gameId)`. Relied on by Task 12's summary screen link.

- [ ] **Step 1: Append `renderActiveGameNormal` to `js/render.js`**

```js
export function renderActiveGameNormal(root, game, actions) {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = game.name;
  root.appendChild(heading);

  const sortBtn = document.createElement('button');
  let sorted = false;
  sortBtn.textContent = 'Sort by score';
  sortBtn.addEventListener('click', () => {
    sorted = !sorted;
    renderRows();
  });
  root.appendChild(sortBtn);

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.disabled = game.history.length === 0;
  undoBtn.addEventListener('click', () => actions.undo(game.id));
  root.appendChild(undoBtn);

  const rowsContainer = document.createElement('div');
  root.appendChild(rowsContainer);

  function renderRows() {
    rowsContainer.innerHTML = '';
    const players = sorted
      ? [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id])
      : game.players;

    for (const player of players) {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.style.borderLeftColor = player.color;

      const name = document.createElement('span');
      name.textContent = player.name;
      row.appendChild(name);

      const minusBtn = document.createElement('button');
      minusBtn.textContent = '-1';
      minusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, -1));
      row.appendChild(minusBtn);

      const scoreBtn = document.createElement('button');
      scoreBtn.className = 'score-display';
      scoreBtn.textContent = String(game.scores[player.id]);
      scoreBtn.addEventListener('click', () => {
        const input = prompt('Set exact score for ' + player.name, String(game.scores[player.id]));
        if (input === null) return;
        const value = Number(input);
        if (!Number.isFinite(value)) return;
        actions.setScore(game.id, player.id, value);
      });
      row.appendChild(scoreBtn);

      const plusBtn = document.createElement('button');
      plusBtn.textContent = '+1';
      plusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, 1));
      row.appendChild(plusBtn);

      rowsContainer.appendChild(row);
    }
  }
  renderRows();

  const finishBtn = document.createElement('button');
  finishBtn.textContent = 'Finish Game';
  finishBtn.addEventListener('click', () => actions.finishGame(game.id));
  root.appendChild(finishBtn);

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back to Home';
  backBtn.addEventListener('click', () => actions.goHome());
  root.appendChild(backBtn);
}
```

- [ ] **Step 2: Add route and actions to `js/app.js`**

Update the `db.js` import to add `adjustScore, setScore, undo`, and the `render.js` import to add `renderActiveGameNormal`.

Add to the `actions` object:

```js
  adjustScore: (gameId, playerId, delta) => {
    adjustScore(findGame(gameId), playerId, delta);
    persist();
    route();
  },
  setScore: (gameId, playerId, value) => {
    setScore(findGame(gameId), playerId, value);
    persist();
    route();
  },
  undo: (gameId) => {
    undo(findGame(gameId));
    persist();
    route();
  },
  finishGame: (gameId) => { location.hash = `#/game/${gameId}/summary`; },
```

Update `route()` to add a game-detail branch before the final fallback:

```js
  const gameMatch = hash.match(/^#\/game\/([^/]+)$/);
  if (gameMatch) {
    const game = findGame(gameMatch[1]);
    if (game && game.mode === 'normal') {
      renderActiveGameNormal(root, game, actions);
      return;
    }
  }
```

- [ ] **Step 3: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Open `http://localhost:8000`, create a normal-mode game with 2 players, click into it via the Home screen link.
Expected: each player shows a score of 0 with -1/score/+1 controls. Tap +1 a few times, confirm the score updates and persists after a page reload. Tap the score number, type a new value, confirm it updates. Tap Undo, confirm the last change reverses. Toggle "Sort by score" and confirm row order changes.

- [ ] **Step 4: Commit**

```bash
git add js/render.js js/app.js
git commit -m "Add active game screen for normal scoring mode"
```

---

## Task 11: Active game — rounds mode screen

**Files:**
- Modify: `js/render.js` (append `renderActiveGameRounds`)
- Modify: `js/app.js` (extend game-detail route, add rounds actions)

**Interfaces:**
- Consumes: `addRound`, `setRoundScore`, `deleteRound`, `computeRoundsTotals` from `js/db.js`.
- Produces: `renderActiveGameRounds(root, game, actions) -> void`; `actions.addRound(gameId)`, `actions.setRoundScore(gameId, roundIndex, playerId, value)`, `actions.deleteRound(gameId, roundIndex)`.

- [ ] **Step 1: Append `renderActiveGameRounds` to `js/render.js`**

```js
import { computeRoundsTotals } from './db.js';

export function renderActiveGameRounds(root, game, actions) {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = game.name;
  root.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'rounds-table';

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>Round</th>' + game.players.map(p => `<th>${p.name}</th>`).join('') + '<th></th>';
  table.appendChild(headRow);

  game.rounds.forEach((round, roundIndex) => {
    const row = document.createElement('tr');
    const roundLabel = document.createElement('td');
    roundLabel.textContent = String(roundIndex + 1);
    row.appendChild(roundLabel);

    for (const player of game.players) {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.value = round[player.id] ?? '';
      input.addEventListener('change', () => {
        actions.setRoundScore(game.id, roundIndex, player.id, Number(input.value) || 0);
      });
      cell.appendChild(input);
      row.appendChild(cell);
    }

    const deleteCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.addEventListener('click', () => actions.deleteRound(game.id, roundIndex));
    deleteCell.appendChild(deleteBtn);
    row.appendChild(deleteCell);

    table.appendChild(row);
  });

  const totals = computeRoundsTotals(game);
  const totalsRow = document.createElement('tr');
  totalsRow.innerHTML = '<td><strong>Total</strong></td>' +
    game.players.map(p => `<td><strong>${totals[p.id]}</strong></td>`).join('') + '<td></td>';
  table.appendChild(totalsRow);

  root.appendChild(table);

  const addRoundBtn = document.createElement('button');
  addRoundBtn.textContent = 'Add Round';
  addRoundBtn.addEventListener('click', () => actions.addRound(game.id));
  root.appendChild(addRoundBtn);

  const finishBtn = document.createElement('button');
  finishBtn.textContent = 'Finish Game';
  finishBtn.addEventListener('click', () => actions.finishGame(game.id));
  root.appendChild(finishBtn);

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back to Home';
  backBtn.addEventListener('click', () => actions.goHome());
  root.appendChild(backBtn);
}
```

Note: `js/render.js` now imports from `js/db.js`. Remove any duplicate `computeRoundsTotals` import if one already exists at the top of the file from a previous task; there should be exactly one `import { computeRoundsTotals } from './db.js';` line at the top of `js/render.js`.

- [ ] **Step 2: Add route and actions to `js/app.js`**

Update the `db.js` import to add `addRound, setRoundScore, deleteRound`, and the `render.js` import to add `renderActiveGameRounds`.

Add to the `actions` object:

```js
  addRound: (gameId) => {
    addRound(findGame(gameId));
    persist();
    route();
  },
  setRoundScore: (gameId, roundIndex, playerId, value) => {
    setRoundScore(findGame(gameId), roundIndex, playerId, value);
    persist();
    route();
  },
  deleteRound: (gameId, roundIndex) => {
    deleteRound(findGame(gameId), roundIndex);
    persist();
    route();
  },
```

Update the game-detail branch in `route()` to dispatch on mode:

```js
  const gameMatch = hash.match(/^#\/game\/([^/]+)$/);
  if (gameMatch) {
    const game = findGame(gameMatch[1]);
    if (game && game.mode === 'normal') {
      renderActiveGameNormal(root, game, actions);
      return;
    }
    if (game && game.mode === 'rounds') {
      renderActiveGameRounds(root, game, actions);
      return;
    }
  }
```

- [ ] **Step 3: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Create a rounds-mode game with 2 players. Add 2 rounds, enter scores in each cell, confirm totals row updates correctly and values persist after reload. Delete a round, confirm totals recompute.

- [ ] **Step 4: Commit**

```bash
git add js/render.js js/app.js
git commit -m "Add active game screen for rounds scoring mode"
```

---

## Task 12: Game summary screen and rematch

**Files:**
- Modify: `js/render.js` (append `renderSummary`)
- Modify: `js/app.js` (add route, add `actions.rematch`)

**Interfaces:**
- Consumes: `createGame`, `addPlayer`, `computeRoundsTotals` from `js/db.js`.
- Produces: `renderSummary(root, game, actions) -> void`; `actions.rematch(gameId)`.

- [ ] **Step 1: Append `renderSummary` to `js/render.js`**

```js
export function renderSummary(root, game, actions) {
  root.innerHTML = '';

  const heading = document.createElement('h1');
  heading.textContent = game.name + ' — Final Standings';
  root.appendChild(heading);

  const scoresByPlayer = game.mode === 'normal'
    ? game.scores
    : computeRoundsTotals(game);

  const ranked = [...game.players].sort((a, b) => scoresByPlayer[b.id] - scoresByPlayer[a.id]);

  const list = document.createElement('ol');
  for (const player of ranked) {
    const li = document.createElement('li');
    li.textContent = `${player.name}: ${scoresByPlayer[player.id]}`;
    list.appendChild(li);
  }
  root.appendChild(list);

  const rematchBtn = document.createElement('button');
  rematchBtn.textContent = 'Rematch (same players)';
  rematchBtn.addEventListener('click', () => actions.rematch(game.id));
  root.appendChild(rematchBtn);

  const backBtn = document.createElement('button');
  backBtn.textContent = 'Back to Home';
  backBtn.addEventListener('click', () => actions.goHome());
  root.appendChild(backBtn);
}
```

- [ ] **Step 2: Add route and action to `js/app.js`**

Update the `render.js` import to add `renderSummary`.

Add to the `actions` object:

```js
  rematch: (gameId) => {
    const oldGame = findGame(gameId);
    const newGame = createGame(db, oldGame.name, oldGame.mode);
    for (const p of oldGame.players) {
      addPlayer(newGame, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${newGame.id}`;
  },
```

Add a summary route branch in `route()`, before the plain game-detail branch:

```js
  const summaryMatch = hash.match(/^#\/game\/([^/]+)\/summary$/);
  if (summaryMatch) {
    const game = findGame(summaryMatch[1]);
    if (game) {
      renderSummary(root, game, actions);
      return;
    }
  }
```

- [ ] **Step 3: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Open a game (either mode), click "Finish Game". Expected: standings list sorted highest-to-lowest score. Click "Rematch (same players)" — expected: a new game is created with the same players and scores reset to 0, and you land in its active-game screen. Go back to Home and confirm both the finished game and the rematch appear in the game list.

- [ ] **Step 4: Commit**

```bash
git add js/render.js js/app.js
git commit -m "Add game summary screen with rematch"
```

---

## Task 13: Mobile-first styling pass

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: the class names already used in `js/render.js` (`game-list`, `game-list-item`, `player-row`, `score-display`, `rounds-table`, `danger`).
- Produces: no new interfaces — pure visual layer.

- [ ] **Step 1: Append layout/component styles to `css/styles.css`**

```css
h1, h2 { margin: 0.75rem 0; }

input, select {
  font-size: 1rem;
  padding: 0.5rem;
  width: 100%;
  margin: 0.4rem 0;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--card-bg);
  color: var(--fg);
}

.game-list { list-style: none; padding: 0; }
.game-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
.game-list-item a { color: var(--fg); text-decoration: none; font-size: 1.05rem; }

button.danger, .game-list-item button {
  background: var(--danger);
  min-height: 44px;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: var(--card-bg);
  border-left: 6px solid var(--accent);
  border-radius: 0.4rem;
  padding: 0.6rem;
  margin-bottom: 0.5rem;
}
.player-row button {
  min-width: 44px;
  min-height: 44px;
}
.score-display {
  font-size: 1.3rem;
  font-weight: bold;
  background: transparent;
  color: var(--fg);
  min-width: 60px;
}

.rounds-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
}
.rounds-table th, .rounds-table td {
  border: 1px solid var(--border);
  padding: 0.4rem;
  text-align: center;
}
.rounds-table input {
  width: 100%;
  min-width: 3rem;
  text-align: center;
  margin: 0;
}

@media (min-width: 600px) {
  #app { padding: 2rem; }
}
```

- [ ] **Step 2: Manually verify**

Run: `cd ~/scorekeeper && python3 -m http.server 8000`
Open `http://localhost:8000` in a browser, use dev tools to simulate a phone viewport (e.g. 375x667). Expected: no horizontal scrolling, buttons are comfortably tappable (~44px), player rows and rounds table are readable at that width. Toggle OS dark mode and confirm colors adapt via `prefers-color-scheme`.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add mobile-first responsive styling"
```

---

## Task 14: README and deploy notes

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: none (documentation only).

- [ ] **Step 1: Create `README.md`**

```markdown
# Scorekeeper

A browser-based game scorekeeper. No build step — plain HTML/CSS/JS, static files only.

## Run locally

    python3 -m http.server 8000

Then open http://localhost:8000

## Run tests

    npm test

## Deploy to GitHub Pages

1. Push this repo to GitHub (e.g. `clarkvoss/scorekeeper`).
2. In the repo's Settings -> Pages, set the source to the `main` branch, root folder.
3. The site will be published at `https://clarkvoss.github.io/scorekeeper/`.

No build step is required — GitHub Pages serves the static files directly.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with local run and deploy instructions"
```

---

## Final verification

- [ ] Run `npm test` — all tests pass (colors, db, storage suites).
- [ ] Run `python3 -m http.server 8000`, walk through the full flow in a browser: create a normal-mode game, score it, undo, finish, view summary, rematch; create a rounds-mode game, add/edit/delete rounds, finish, view summary. Confirm all state survives a page reload.
