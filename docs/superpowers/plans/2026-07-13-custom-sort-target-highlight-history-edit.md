# Custom Sort, Target-Reached Highlight, Round-History Edit/Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted "Custom" sort mode with ↑/↓ reordering, a visual highlight/badge when a player reaches the game's target score, and Edit/Delete controls on individual round-history entries — per `docs/superpowers/specs/2026-07-13-custom-sort-target-highlight-history-edit-design.md`.

**Architecture:** Two new persisted game fields (`sortMode`, `playerOrder`) plus four new `js/db.js` functions, four thin `js/app.js` action wrappers, and `js/render.js` changes to `renderActiveGameNormal` (sort cycle, ↑/↓ buttons, target highlight/badge) and `showRoundHistoryModal` (gains an `actions` parameter, Edit/Delete per entry).

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS. `js/db.js` changes get unit tests (TDD); the DOM/UI wiring in `js/render.js`/`js/app.js` has no automated tests, consistent with every prior UI task in this project.

## Global Constraints

- `sortMode`/`playerOrder` must be read falsy-safely: games saved before this change have neither field (`undefined`), which must be treated the same as `'original'`/`null` respectively — never crash.
- `playerOrder` must be filtered to only ids still present in `game.players` before use, in case a player was ever removed (defensive — no current UI removes a player mid-game, but `removePlayer` exists in `js/db.js`).
- `editHistoryEntry`/`deleteHistoryEntry` operate on a raw index into the flat `game.history` array. That index must always be captured fresh from the *current* `game.history` when the round-history modal is built — never cached or reused across a re-render, since deleting an entry shifts every later index.
- Deleting a round-history entry is destructive — confirm via `confirm()`, matching the existing pattern for deleting a game.
- No `innerHTML` with interpolated user data anywhere in new code — `createElement`/`textContent` only.
- All new colors route through existing CSS custom properties or the small new rules added in this plan — no stray hardcoded hex values beyond what's specified.

---

## Task 1: `sortMode`/`playerOrder` fields and `setSortMode`/`movePlayerOrder` in `js/db.js`

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `createGame` gains `sortMode: 'original'`, `playerOrder: null` in its returned object; `setSortMode(game, mode) -> void`; `movePlayerOrder(game, playerId, direction) -> void` (`direction` is `-1` or `1`, initializes `playerOrder` from `game.players`' ids on first use, swaps adjacent entries, no-op at either end). Relied on by Task 3's actions and Task 5's render logic.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `setSortMode, movePlayerOrder`:

```js
test('createGame defaults sortMode to original and playerOrder to null', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(game.sortMode, 'original');
  assert.equal(game.playerOrder, null);
});

test('setSortMode updates sortMode and bumps updatedAt', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const before = game.updatedAt;
  setSortMode(game, 'desc');
  assert.equal(game.sortMode, 'desc');
  assert.ok(game.updatedAt >= before);
});

test('movePlayerOrder initializes playerOrder from players and swaps adjacent entries', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  const p3 = addPlayer(game, 'Carol');
  movePlayerOrder(game, p2.id, -1);
  assert.deepEqual(game.playerOrder, [p2.id, p1.id, p3.id]);
});

test('movePlayerOrder is a no-op at the boundaries', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  movePlayerOrder(game, p1.id, -1);
  assert.deepEqual(game.playerOrder, [p1.id, p2.id]);
  movePlayerOrder(game, p2.id, 1);
  assert.deepEqual(game.playerOrder, [p1.id, p2.id]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `game.sortMode` is `undefined` (not `'original'`), and `setSortMode`/`movePlayerOrder` are not functions.

- [ ] **Step 3: Update `js/db.js`**

Add `sortMode: 'original'` and `playerOrder: null` to `createGame`'s returned object (insert after `targetScore`):

```js
export function createGame(db, name, mode, targetScore = null) {
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
    finished: false,
    dealerId: null,
    targetScore,
    sortMode: 'original',
    playerOrder: null
  };
  db.games.push(game);
  return game;
}
```

Append these two functions anywhere after `createGame` (e.g. near the end of the file):

```js
export function setSortMode(game, mode) {
  game.sortMode = mode;
  game.updatedAt = Date.now();
}

export function movePlayerOrder(game, playerId, direction) {
  if (!game.playerOrder) {
    game.playerOrder = game.players.map(p => p.id);
  }
  const order = game.playerOrder.filter(id => game.players.some(p => p.id === id));
  const idx = order.indexOf(playerId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= order.length) return;
  [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
  game.playerOrder = order;
  game.updatedAt = Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 4 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add persisted sortMode/playerOrder fields and setSortMode/movePlayerOrder to db.js"
```

---

## Task 2: `editHistoryEntry`/`deleteHistoryEntry` in `js/db.js`

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `editHistoryEntry(game, historyIndex, newDelta) -> void`; `deleteHistoryEntry(game, historyIndex) -> void`. Both recalculate `game.scores` from the change, no-op on an out-of-range index. Relied on by Task 3's actions and Task 6's round-history modal.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `editHistoryEntry, deleteHistoryEntry`:

```js
test('editHistoryEntry recalculates the score from the delta difference', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 10);
  adjustScore(game, p1.id, 5);
  editHistoryEntry(game, 0, 20);
  assert.equal(game.scores[p1.id], 25);
  assert.equal(game.history[0].delta, 20);
});

test('deleteHistoryEntry removes the entry and subtracts its delta', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 10);
  adjustScore(game, p1.id, 5);
  deleteHistoryEntry(game, 0);
  assert.equal(game.scores[p1.id], 5);
  assert.equal(game.history.length, 1);
});

test('editHistoryEntry and deleteHistoryEntry are no-ops for an out-of-range index', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 10);
  editHistoryEntry(game, 5, 99);
  deleteHistoryEntry(game, 5);
  assert.equal(game.scores[p1.id], 10);
  assert.equal(game.history.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `editHistoryEntry is not a function`.

- [ ] **Step 3: Append to `js/db.js`**

```js
export function editHistoryEntry(game, historyIndex, newDelta) {
  const entry = game.history[historyIndex];
  if (!entry) return;
  const diff = newDelta - entry.delta;
  game.scores[entry.playerId] = (game.scores[entry.playerId] || 0) + diff;
  entry.delta = newDelta;
  game.updatedAt = Date.now();
}

export function deleteHistoryEntry(game, historyIndex) {
  const entry = game.history[historyIndex];
  if (!entry) return;
  game.scores[entry.playerId] = (game.scores[entry.playerId] || 0) - entry.delta;
  game.history.splice(historyIndex, 1);
  game.updatedAt = Date.now();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 3 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add editHistoryEntry and deleteHistoryEntry to db.js"
```

---

## Task 3: Wire the four new actions in `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `setSortMode`, `movePlayerOrder` (Task 1), `editHistoryEntry`, `deleteHistoryEntry` (Task 2), all from `js/db.js`.
- Produces: `actions.setSortMode(gameId, mode)`, `actions.movePlayerOrder(gameId, playerId, direction)`, `actions.editHistoryEntry(gameId, historyIndex, newDelta)`, `actions.deleteHistoryEntry(gameId, historyIndex)` — all mutate, persist, route, matching every other action's pattern. Relied on by Task 5 and Task 6.

- [ ] **Step 1: Update the `db.js` import**

Change:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame, setDealer, advanceDealer } from './db.js';
```

to:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame, setDealer, advanceDealer, setSortMode, movePlayerOrder, editHistoryEntry, deleteHistoryEntry } from './db.js';
```

- [ ] **Step 2: Add the four actions**

Add to the `actions` object (e.g. right after `advanceDealer`):

```js
  setSortMode: (gameId, mode) => {
    setSortMode(findGame(gameId), mode);
    persist();
    route();
  },
  movePlayerOrder: (gameId, playerId, direction) => {
    movePlayerOrder(findGame(gameId), playerId, direction);
    persist();
    route();
  },
  editHistoryEntry: (gameId, historyIndex, newDelta) => {
    editHistoryEntry(findGame(gameId), historyIndex, newDelta);
    persist();
    route();
  },
  deleteHistoryEntry: (gameId, historyIndex) => {
    deleteHistoryEntry(findGame(gameId), historyIndex);
    persist();
    route();
  },
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "movePlayerOrder(findGame"` — expect `1`, then stop the server.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Wire setSortMode, movePlayerOrder, editHistoryEntry, deleteHistoryEntry actions"
```

---

## Task 4: Target-reached and order-button CSS

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `.player-row-target-reached`, `.target-badge`. The ↑/↓ order buttons reuse the existing `.score-btn` class — no new CSS needed for them. Consumed by Task 5.

- [ ] **Step 1: Append the new rules**

Append to the end of `css/styles.css`:

```css
.player-row-target-reached {
  background: linear-gradient(90deg, rgba(233, 196, 106, 0.18), var(--card-bg) 50%);
}
.target-badge {
  margin-left: 0.4rem;
}
```

- [ ] **Step 2: Verify**

Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced'; print('OK,', s.count('{'), 'rules')"`
Run: `grep -c '^\.player-row-target-reached {' css/styles.css` — expect `1`

Then serve and confirm delivery: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "target-badge"` — expect `1`, then stop the server.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add target-reached highlight and target-badge CSS"
```

---

## Task 5: Custom sort cycle, ↑/↓ buttons, and target highlight in `renderActiveGameNormal`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `actions.setSortMode`, `actions.movePlayerOrder` (Task 3); `.player-row-target-reached`, `.target-badge` CSS (Task 4).
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature.

- [ ] **Step 1: Replace the sort button block**

Replace:

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

with:

```js
  const sortLabels = { original: 'Sort: Original', desc: 'Sort: High→Low', asc: 'Sort: Low→High', custom: 'Sort: Custom' };
  const sortCycle = { original: 'desc', desc: 'asc', asc: 'custom', custom: 'original' };
  const sortMode = game.sortMode || 'original';
  const sortBtn = document.createElement('button');
  sortBtn.textContent = sortLabels[sortMode];
  sortBtn.addEventListener('click', () => {
    actions.setSortMode(game.id, sortCycle[sortMode]);
  });
  root.appendChild(sortBtn);
```

Note: `sortMode` is now derived once from `game.sortMode` (falsy-safe fallback to `'original'` for games saved before this change) rather than being local mutable state — tapping the button calls the action, which persists and re-routes, causing the whole screen (including this closure) to rebuild fresh with the updated `game.sortMode`. There is no longer a need to manually update `sortBtn.textContent` or call `renderRows()` from the click handler.

- [ ] **Step 2: Update the sorting logic inside `renderRows`**

Replace:

```js
    let players = game.players;
    if (sortMode === 'desc') {
      players = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
    } else if (sortMode === 'asc') {
      players = [...game.players].sort((a, b) => game.scores[a.id] - game.scores[b.id]);
    }
```

with:

```js
    let players = game.players;
    if (sortMode === 'desc') {
      players = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
    } else if (sortMode === 'asc') {
      players = [...game.players].sort((a, b) => game.scores[a.id] - game.scores[b.id]);
    } else if (sortMode === 'custom') {
      const orderIds = (game.playerOrder || game.players.map(p => p.id)).filter(id => game.players.some(p => p.id === id));
      players = orderIds.map(id => game.players.find(p => p.id === id));
    }
```

- [ ] **Step 3: Add the target-reached highlight to each row**

Replace:

```js
    for (const player of players) {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.style.borderLeftColor = player.color;
```

with:

```js
    for (const player of players) {
      const row = document.createElement('div');
      row.className = 'player-row';
      const targetReached = game.targetScore !== null && game.targetScore !== undefined && game.scores[player.id] >= game.targetScore;
      if (targetReached) {
        row.classList.add('player-row-target-reached');
      }
      row.style.borderLeftColor = targetReached ? '#e9c46a' : player.color;
```

- [ ] **Step 4: Add the target badge next to the name**

Replace:

```js
      if (getDealerId(game) === player.id) {
        const dealerBadge = document.createElement('span');
        dealerBadge.className = 'dealer-badge';
        dealerBadge.textContent = 'DEALER';
        nameWrap.appendChild(dealerBadge);
      }

      row.appendChild(nameWrap);
```

with:

```js
      if (getDealerId(game) === player.id) {
        const dealerBadge = document.createElement('span');
        dealerBadge.className = 'dealer-badge';
        dealerBadge.textContent = 'DEALER';
        nameWrap.appendChild(dealerBadge);
      }

      if (targetReached) {
        const targetBadge = document.createElement('span');
        targetBadge.className = 'target-badge';
        targetBadge.textContent = '🏆';
        targetBadge.setAttribute('aria-label', 'Target score reached');
        nameWrap.appendChild(targetBadge);
      }

      row.appendChild(nameWrap);
```

- [ ] **Step 5: Add ↑/↓ buttons in Custom mode**

Replace:

```js
      const addPointsBtn = document.createElement('button');
      addPointsBtn.className = 'add-points-btn';
      addPointsBtn.textContent = 'Add Points';
      addPointsBtn.addEventListener('click', () => actions.goAddPoints(game.id, player.id));
      row.appendChild(addPointsBtn);

      rowsContainer.appendChild(row);
```

with:

```js
      const addPointsBtn = document.createElement('button');
      addPointsBtn.className = 'add-points-btn';
      addPointsBtn.textContent = 'Add Points';
      addPointsBtn.addEventListener('click', () => actions.goAddPoints(game.id, player.id));
      row.appendChild(addPointsBtn);

      if (sortMode === 'custom') {
        const upBtn = document.createElement('button');
        upBtn.className = 'score-btn';
        upBtn.textContent = '↑';
        upBtn.setAttribute('aria-label', 'Move player up');
        upBtn.addEventListener('click', () => actions.movePlayerOrder(game.id, player.id, -1));
        row.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.className = 'score-btn';
        downBtn.textContent = '↓';
        downBtn.setAttribute('aria-label', 'Move player down');
        downBtn.addEventListener('click', () => actions.movePlayerOrder(game.id, player.id, 1));
        row.appendChild(downBtn);
      }

      rowsContainer.appendChild(row);
```

- [ ] **Step 6: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "movePlayerOrder(game.id"` — expect `2` (up and down buttons), then stop the server.

Note in the report that full interactive verification (cycling sort through all 4 states, reordering via ↑/↓ in Custom mode, confirming the order persists across a reload, and confirming the target-reached highlight/badge appears once a score meets/exceeds the target) requires a real browser and will be done separately by the controller.

- [ ] **Step 7: Commit**

```bash
git add js/render.js
git commit -m "Add Custom sort mode with player reordering and target-reached highlight"
```

---

## Task 6: Edit/Delete in the round-history modal

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `actions.editHistoryEntry`, `actions.deleteHistoryEntry` (Task 3); `showScoreModal` (existing, reused for the Edit flow).
- Produces: `showRoundHistoryModal(game, player, actions)` — signature change (was `(game, player)`). Its one call site, inside `renderAddPoints`, is updated to pass `actions`.

- [ ] **Step 1: Replace the entire `showRoundHistoryModal` function**

Replace:

```js
function showRoundHistoryModal(game, player) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = player.name + "'s round history";
  modal.appendChild(label);

  const entries = game.history.filter(h => h.playerId === player.id);
  const list = document.createElement('ul');
  list.className = 'round-history-list';
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No rounds recorded yet.';
    list.appendChild(li);
  } else {
    entries.forEach((entry, i) => {
      const li = document.createElement('li');
      const sign = entry.delta >= 0 ? '+' : '';
      li.textContent = `Round ${i + 1}: ${sign}${entry.delta}`;
      list.appendChild(li);
    });
  }
  modal.appendChild(list);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', close);
  actionsRow.appendChild(closeBtn);

  modal.appendChild(actionsRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
```

with:

```js
function showRoundHistoryModal(game, player, actions) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = player.name + "'s round history";
  modal.appendChild(label);

  const entries = [];
  game.history.forEach((h, index) => {
    if (h.playerId === player.id) entries.push({ entry: h, index });
  });

  const list = document.createElement('ul');
  list.className = 'round-history-list';
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No rounds recorded yet.';
    list.appendChild(li);
  } else {
    entries.forEach(({ entry, index }, i) => {
      const li = document.createElement('li');
      const sign = entry.delta >= 0 ? '+' : '';
      const roundLabel = document.createElement('span');
      roundLabel.textContent = `Round ${i + 1}: ${sign}${entry.delta}`;
      li.appendChild(roundLabel);

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        close();
        showScoreModal(player.name, entry.delta, (newValue) => {
          actions.editHistoryEntry(game.id, index, newValue);
        });
      });
      li.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete this round (${sign}${entry.delta} for ${player.name})?`)) {
          close();
          actions.deleteHistoryEntry(game.id, index);
        }
      });
      li.appendChild(deleteBtn);

      list.appendChild(li);
    });
  }
  modal.appendChild(list);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', close);
  actionsRow.appendChild(closeBtn);

  modal.appendChild(actionsRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
```

Note: `index` here is each entry's position in the *full* `game.history` array (captured via `game.history.forEach`), not its position within this player's filtered list (`i`) — this is what `editHistoryEntry`/`deleteHistoryEntry` expect. The displayed "Round N" label still uses `i + 1` (the player's own round count), matching the existing display convention from `playerRoundInfo`.

- [ ] **Step 2: Update the one call site in `renderAddPoints`**

Change:

```js
  historyBtn.addEventListener('click', () => showRoundHistoryModal(game, player));
```

to:

```js
  historyBtn.addEventListener('click', () => showRoundHistoryModal(game, player, actions));
```

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "editHistoryEntry(game.id"` — expect `1`, then stop the server.

Note in the report that full interactive verification (opening a player's round history, editing a round's value and confirming the total recalculates, deleting a round with confirmation and confirming the total recalculates) requires a real browser and will be done separately by the controller.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Add Edit/Delete to round-history modal entries"
```

---

## Final verification

- [ ] Run `npm test` — all tests passing (7 new `js/db.js` tests added across Tasks 1-2).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - In a normal-mode game with 3+ players, tap the sort button through all 4 states (Original → High→Low → Low→High → Custom → back to Original). In Custom mode, confirm ↑/↓ buttons appear on each row and reorder players; reload the page and confirm the custom order and sort mode both persisted.
  - Create a game with a target score, score a player up to/past it — confirm their row gets the gold-tinted highlight and 🏆 badge; confirm a player below the target shows neither.
  - Open a player's round history (history icon on the Add Points screen), tap Edit on a round, change its value, confirm the total updates correctly. Tap Delete on a round, confirm the confirmation prompt, confirm the round disappears and the total updates correctly.
  - Confirm rounds mode, Summary, Home, and New Game are all unaffected.
