# Teal Theme Phase 3: Dealer Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 2's static "DEALER" badge (always `game.players[0]`) with a real, trackable dealer: auto-rotates when "Next Player" wraps around on the Add Points screen, and can be manually reassigned via a new "Change Dealer" item in the Active Game header menu, per `docs/superpowers/specs/2026-07-13-teal-theme-phase3-dealer-design.md`.

**Architecture:** A new `game.dealerId` field (default `null`, falling back to the first player everywhere it's read) plus three `js/db.js` functions (`getDealerId`, `setDealer`, `advanceDealer`). `js/app.js` gains two thin wrapper actions. `js/render.js`'s shared `renderHeader` gains an optional third menu item; `renderActiveGameNormal` and `renderAddPoints` both switch from the old static/first-player check to `getDealerId(game)`.

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS (no new CSS needed — reuses existing `.dealer-badge` and `.round-history-list` classes). `js/db.js` changes get unit tests (TDD); the DOM/UI wiring in `js/render.js`/`js/app.js` has no automated tests, consistent with every prior UI task in this project.

## Global Constraints

- `game.dealerId` must be read via the `getDealerId(game)` fallback everywhere the current dealer needs to be known — never read `game.dealerId` directly, since games created before this phase have no such field at all (`undefined`, not `null`).
- Scope is normal mode only — rounds mode, Summary, Home, and New Game are untouched.
- `advanceDealer` must compute the next dealer from wherever the dealer *actually* currently is (via `getDealerId`), not assume it's adjacent to whichever player just navigated — a manual "Change Dealer" reassignment could have moved it anywhere.
- No `innerHTML` with interpolated user data in any new code — `createElement`/`textContent` only.

---

## Task 1: `dealerId` field and `getDealerId`/`setDealer`/`advanceDealer` in `js/db.js`

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `createGame` now includes `dealerId: null` in its returned object; `getDealerId(game) -> string` (pure, returns `game.dealerId` or falls back to `game.players[0].id`); `setDealer(game, playerId) -> void`; `advanceDealer(game) -> void` (wraps around `game.players`). Relied on by Task 2 (`js/app.js`) and Tasks 3-5 (`js/render.js`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `getDealerId, setDealer, advanceDealer`:

```js
test('createGame defaults dealerId to null', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(game.dealerId, null);
});

test('getDealerId falls back to the first player when dealerId is unset', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  addPlayer(game, 'Bob');
  assert.equal(getDealerId(game), p1.id);
});

test('setDealer sets dealerId and bumps updatedAt', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  const before = game.updatedAt;
  setDealer(game, p2.id);
  assert.equal(getDealerId(game), p2.id);
  assert.ok(game.updatedAt >= before);
});

test('advanceDealer moves to the next player and wraps around', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  const p3 = addPlayer(game, 'Carol');
  assert.equal(getDealerId(game), p1.id);
  advanceDealer(game);
  assert.equal(getDealerId(game), p2.id);
  advanceDealer(game);
  assert.equal(getDealerId(game), p3.id);
  advanceDealer(game);
  assert.equal(getDealerId(game), p1.id);
});

test('advanceDealer advances from wherever the dealer actually is after a manual reassignment', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  const p3 = addPlayer(game, 'Carol');
  setDealer(game, p3.id);
  advanceDealer(game);
  assert.equal(getDealerId(game), p1.id);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `game.dealerId` is `undefined` (not `null`) in the first new test, and `getDealerId`/`setDealer`/`advanceDealer` are not functions.

- [ ] **Step 3: Update `js/db.js`**

Add `dealerId: null` to `createGame`'s returned object (insert after `finished: false`):

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
    finished: false,
    dealerId: null
  };
  db.games.push(game);
  return game;
}
```

Append these three functions anywhere after `createGame` (e.g. near the end of the file, after `renameGame`):

```js
export function getDealerId(game) {
  return game.dealerId || (game.players[0] && game.players[0].id);
}

export function setDealer(game, playerId) {
  game.dealerId = playerId;
  game.updatedAt = Date.now();
}

export function advanceDealer(game) {
  const currentId = getDealerId(game);
  const idx = game.players.findIndex(p => p.id === currentId);
  if (idx === -1 || game.players.length === 0) return;
  const nextPlayer = game.players[(idx + 1) % game.players.length];
  setDealer(game, nextPlayer.id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 5 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add dealerId field and getDealerId/setDealer/advanceDealer to db.js"
```

---

## Task 2: Wire `actions.setDealer` and `actions.advanceDealer` in `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `setDealer(game, playerId)`, `advanceDealer(game)` from `js/db.js` (Task 1).
- Produces: `actions.setDealer(gameId, playerId) -> void`, `actions.advanceDealer(gameId) -> void` (both: mutate, persist, route — same pattern as `actions.renameGame`). Relied on by Tasks 4-5.

- [ ] **Step 1: Update the `db.js` import**

Change:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame } from './db.js';
```

to:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame, setDealer, advanceDealer } from './db.js';
```

- [ ] **Step 2: Add the two new actions**

Add to the `actions` object (e.g. right after `renameGame`):

```js
  setDealer: (gameId, playerId) => {
    setDealer(findGame(gameId), playerId);
    persist();
    route();
  },
  advanceDealer: (gameId) => {
    advanceDealer(findGame(gameId));
    persist();
    route();
  },
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "setDealer(findGame"` — expect `1`, then stop the server.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Wire setDealer and advanceDealer app actions"
```

---

## Task 3: `renderHeader`'s "Change Dealer" menu item and `showChangeDealerModal`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Produces: `renderHeader` gains an optional `onChangeDealer` callback param — when provided, a "Change Dealer" item appears in the "⋮" dropdown between "Rename Game" and "Delete Game"; existing call sites that don't pass it (Home, New Game, rounds mode, Summary) are completely unaffected. New `showChangeDealerModal(game, onSelect) -> void` helper. Relied on by Task 4.

- [ ] **Step 1: Update `renderHeader`'s signature and dropdown**

In the `renderHeader` function, change the destructured parameters:

```js
function renderHeader(root, { title, showBack = false, showMenu = false, onBack, onDelete, onRename }) {
```

to:

```js
function renderHeader(root, { title, showBack = false, showMenu = false, onBack, onDelete, onRename, onChangeDealer }) {
```

Then, inside the `if (showMenu)` block, insert a new conditional item between the existing `renameItem` and `deleteItem` blocks:

```js
    const renameItem = document.createElement('button');
    renameItem.textContent = 'Rename Game';
    renameItem.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      onRename();
    });
    dropdown.appendChild(renameItem);

    if (onChangeDealer) {
      const dealerItem = document.createElement('button');
      dealerItem.textContent = 'Change Dealer';
      dealerItem.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        onChangeDealer();
      });
      dropdown.appendChild(dealerItem);
    }

    const deleteItem = document.createElement('button');
    deleteItem.className = 'danger';
    deleteItem.textContent = 'Delete Game';
    deleteItem.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      onDelete();
    });
    dropdown.appendChild(deleteItem);
```

- [ ] **Step 2: Append `showChangeDealerModal`**

Add after `showRoundHistoryModal`:

```js
function showChangeDealerModal(game, onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = 'Change dealer';
  modal.appendChild(label);

  const list = document.createElement('ul');
  list.className = 'round-history-list';
  for (const player of game.players) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = player.name;
    btn.addEventListener('click', () => {
      onSelect(player.id);
      close();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
  modal.appendChild(list);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);
  actionsRow.appendChild(cancelBtn);

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

Note: this reuses the existing `.round-history-list` CSS class for the player list layout — no new CSS is needed for this task.

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (neither new/changed piece is called by anything yet — `onChangeDealer` isn't passed by any call site until Task 4, and `showChangeDealerModal` isn't called until Task 4).

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Add Change Dealer menu item support to renderHeader and a player-picker modal"
```

---

## Task 4: Wire dealer badge and "Change Dealer" into `renderActiveGameNormal`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `getDealerId` from `js/db.js` (Task 1, needs to be added to the file's top import line); `onChangeDealer`/`showChangeDealerModal` from Task 3; `actions.setDealer` from Task 2.
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature.

- [ ] **Step 1: Add `getDealerId` to the top-of-file import**

Change:

```js
import { computeRoundsTotals } from './db.js';
```

to:

```js
import { computeRoundsTotals, getDealerId } from './db.js';
```

- [ ] **Step 2: Pass `onChangeDealer` to `renderActiveGameNormal`'s `renderHeader` call**

Change:

```js
  renderHeader(root, {
    title: game.name,
    showBack: true,
    showMenu: true,
    onBack: () => actions.goHome(),
    onDelete: () => {
      if (confirm(`Delete "${game.name}"? This cannot be undone.`)) {
        actions.deleteGame(game.id);
      }
    },
    onRename: () => {
      showRenameModal(game.name, (newName) => actions.renameGame(game.id, newName));
    }
  });
```

(the one inside `renderActiveGameNormal` — the identical-looking blocks in `renderActiveGameRounds` and `renderSummary` must NOT get this change, since dealer rotation is normal-mode only) to:

```js
  renderHeader(root, {
    title: game.name,
    showBack: true,
    showMenu: true,
    onBack: () => actions.goHome(),
    onDelete: () => {
      if (confirm(`Delete "${game.name}"? This cannot be undone.`)) {
        actions.deleteGame(game.id);
      }
    },
    onRename: () => {
      showRenameModal(game.name, (newName) => actions.renameGame(game.id, newName));
    },
    onChangeDealer: () => {
      showChangeDealerModal(game, (playerId) => actions.setDealer(game.id, playerId));
    }
  });
```

- [ ] **Step 3: Add the dealer badge to each player row**

Inside `renderRows`, find:

```js
      const info = playerRoundInfo(game, player.id);
      if (info) {
        const meta = document.createElement('span');
        meta.className = 'player-meta';
        meta.textContent = `Round ${info.round}, Last: ${info.last}`;
        nameWrap.appendChild(meta);
      }

      row.appendChild(nameWrap);
```

and insert a dealer-badge check between the `info` block and `row.appendChild(nameWrap);`:

```js
      const info = playerRoundInfo(game, player.id);
      if (info) {
        const meta = document.createElement('span');
        meta.className = 'player-meta';
        meta.textContent = `Round ${info.round}, Last: ${info.last}`;
        nameWrap.appendChild(meta);
      }

      if (getDealerId(game) === player.id) {
        const dealerBadge = document.createElement('span');
        dealerBadge.className = 'dealer-badge';
        dealerBadge.textContent = 'DEALER';
        nameWrap.appendChild(dealerBadge);
      }

      row.appendChild(nameWrap);
```

- [ ] **Step 4: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "onChangeDealer: ()"` — expect `1` (only `renderActiveGameNormal`'s call site should have it), then stop the server.

Note in the report that full interactive verification (opening the "⋮" menu, tapping "Change Dealer", picking a player, confirming the badge moves) requires a real browser and will be done separately by the controller.

- [ ] **Step 5: Commit**

```bash
git add js/render.js
git commit -m "Show dealer badge on player rows and add Change Dealer to the Active Game menu"
```

---

## Task 5: Dynamic dealer badge and auto-rotation in `renderAddPoints`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `getDealerId` from Task 4's import update; `actions.advanceDealer` from Task 2.
- Produces: no new exported interfaces — same `renderAddPoints(root, game, player, actions)` signature.

- [ ] **Step 1: Replace the static dealer-badge condition**

Change:

```js
  if (game.players[0] && game.players[0].id === player.id) {
    const badge = document.createElement('span');
    badge.className = 'dealer-badge';
    badge.textContent = 'DEALER';
    titleEl.appendChild(badge);
  }
```

to:

```js
  if (getDealerId(game) === player.id) {
    const badge = document.createElement('span');
    badge.className = 'dealer-badge';
    badge.textContent = 'DEALER';
    titleEl.appendChild(badge);
  }
```

- [ ] **Step 2: Trigger auto-rotation on wraparound**

Change the Next Player handler:

```js
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Player';
  nextBtn.addEventListener('click', () => {
    const idx = game.players.findIndex(p => p.id === player.id);
    const nextPlayer = game.players[(idx + 1) % game.players.length];
    actions.goAddPoints(game.id, nextPlayer.id);
  });
  footer.appendChild(nextBtn);
```

to:

```js
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Player';
  nextBtn.addEventListener('click', () => {
    const idx = game.players.findIndex(p => p.id === player.id);
    const nextIndex = (idx + 1) % game.players.length;
    if (nextIndex === 0) {
      actions.advanceDealer(game.id);
    }
    const nextPlayer = game.players[nextIndex];
    actions.goAddPoints(game.id, nextPlayer.id);
  });
  footer.appendChild(nextBtn);
```

Note: `actions.advanceDealer` triggers its own `persist()`+`route()` cycle (re-rendering the *current* Add Points screen once with the rotated dealer), and then `actions.goAddPoints` immediately changes the hash, triggering a second render for the next player's screen. Both happen synchronously within the same click handler — there's no visible flicker or async gap, just one redundant DOM rebuild. This is an accepted, deliberate trade-off (per the design spec) rather than a bug — it keeps `advanceDealer` consistent with every other mutating action in this codebase (always persist+route immediately), rather than special-casing it to skip its own re-render.

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "advanceDealer(game.id)"` — expect `1`, then stop the server.

Note in the report that full interactive verification (cycling through all players via Next Player and confirming the dealer badge advances exactly once per full lap, including after a manual "Change Dealer" reassignment) requires a real browser and will be done separately by the controller.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Make Add Points dealer badge dynamic and auto-rotate dealer on round wraparound"
```

---

## Final verification

- [ ] Run `npm test` — all tests passing (colors, emojis, db, storage suites — 5 new dealer tests added in Task 1).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Create a normal-mode game with 3 players. Confirm the first player shows the DEALER badge on both the Active Game player-row list and the Add Points screen.
  - Use "Add Points" → "Next Player" to cycle through all 3 players back to the first. Confirm the dealer badge moves to the second player only after the full lap completes (not on every single "Next Player" tap).
  - Open the Active Game "⋮" menu, tap "Change Dealer", pick the third player. Confirm the badge moves immediately to that player in both the player-row list and (if you navigate there) the Add Points screen.
  - Cycle "Next Player" through a full lap again after the manual reassignment — confirm the dealer advances from the manually-assigned player, not from wherever it "would have been" without the reassignment.
  - Confirm rounds-mode games, Summary, Home, and New Game show no dealer-related UI at all.
