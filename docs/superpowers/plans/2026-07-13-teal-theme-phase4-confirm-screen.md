# Teal Theme Phase 4: New Game Confirm Screen + Target Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, purely informational `targetScore` to games, split the New Game screen into a two-step wizard (form → teal confirm screen with Edit/Start), and show the target score as a subtitle on the Active Game (normal mode) header when set — per `docs/superpowers/specs/2026-07-13-teal-theme-phase4-confirm-screen-design.md`.

**Architecture:** `js/db.js`'s `createGame` gains a 4th `targetScore` parameter (default `null`). `js/app.js`'s `startGame`/`rematch` actions pass it through. `js/render.js`'s `renderNewGame` is restructured into an internal two-step wizard (`renderFormStep()`/`renderConfirmStep()`, both closing over shared draft state) — no new route, since a route change can't carry unsaved draft state across it in this app's architecture. `renderActiveGameNormal` gains a one-line conditional subtitle. No new CSS — reuses `.app-header`, `.keypad-display`, `.keypad-save`.

**Tech Stack:** Vanilla JS (ES modules). `js/db.js` changes get unit tests (TDD); the DOM/UI wiring in `js/render.js`/`js/app.js` has no automated tests, consistent with every prior UI task in this project.

## Global Constraints

- `targetScore` is purely informational — no logic anywhere reacts to a player reaching or exceeding it.
- The confirm screen must not create the game — only "Start" does (via the existing `actions.startGame`, now carrying `targetScore`).
- "Edit" must return to the form step with every previously-entered value intact (name, mode, target score, and the full draft player list) — since both steps share one function's closure, this must fall out naturally, not require re-fetching or resetting anything.
- Empty target-score input must map to `null`, not `0` or `NaN`.
- No new CSS — reuse `.app-header` (already used by every other screen), `.keypad-display` (for the big number), `.keypad-save` (for the prominent Start button).
- Rematch must preserve the original game's `targetScore`, matching how it already preserves players and mode.

---

## Task 1: `targetScore` parameter on `createGame`

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `createGame(db, name, mode, targetScore = null) -> game` — game shape gains `targetScore`. Relied on by Task 2's `actions.startGame`/`actions.rematch`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` (the `createGame` import already exists in the file's import line — no import line change needed for this task):

```js
test('createGame defaults targetScore to null', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(game.targetScore, null);
});

test('createGame accepts an explicit targetScore', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal', 100);
  assert.equal(game.targetScore, 100);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `game.targetScore` is `undefined` (not `null`) in the first new test.

- [ ] **Step 3: Update `js/db.js`**

Change:

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

to:

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
    targetScore
  };
  db.games.push(game);
  return game;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 2 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add optional targetScore parameter to createGame"
```

---

## Task 2: Pass `targetScore` through `js/app.js`'s `startGame`/`rematch`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `createGame(db, name, mode, targetScore)` from Task 1.
- Produces: `actions.startGame(name, mode, draftPlayers, targetScore)` (new 4th parameter); `actions.rematch` now carries `oldGame.targetScore` onto the new game. Relied on by Task 3's confirm-screen "Start" button.

- [ ] **Step 1: Update `startGame`**

Change:

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

to:

```js
  startGame: (name, mode, draftPlayers, targetScore) => {
    const game = createGame(db, name, mode, targetScore);
    for (const p of draftPlayers) {
      addPlayer(game, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${game.id}`;
  },
```

- [ ] **Step 2: Update `rematch`**

Change:

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

to:

```js
  rematch: (gameId) => {
    const oldGame = findGame(gameId);
    const newGame = createGame(db, oldGame.name, oldGame.mode, oldGame.targetScore);
    for (const p of oldGame.players) {
      addPlayer(newGame, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${newGame.id}`;
  },
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "targetScore"` — expect at least `3` (the `startGame` param, the `createGame` call inside `startGame`, and the `oldGame.targetScore` reference in `rematch`), then stop the server.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Pass targetScore through startGame and rematch actions"
```

---

## Task 3: Two-step New Game wizard (form + confirm)

**Files:**
- Modify: `js/render.js` (replace the entire `renderNewGame` function)

**Interfaces:**
- Consumes: `actions.startGame(name, mode, draftPlayers, targetScore)` from Task 2; `.app-header` (via `renderHeader`), `.keypad-display`, `.keypad-save` CSS (all pre-existing).
- Produces: no new exported interfaces — same `renderNewGame(root, db, actions)` signature. Internal-only `renderFormStep()`/`renderConfirmStep()` helpers are not exported.

- [ ] **Step 1: Replace the entire `renderNewGame` function**

Replace the current function:

```js
export function renderNewGame(root, db, actions) {
  root.innerHTML = '';
  let draftPlayers = [];
  let mode = 'normal';

  renderHeader(root, { title: 'New Game', showBack: true, onBack: () => actions.goHome() });

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

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Load saved player list...';
    loadSelect.appendChild(placeholderOption);

    db.savedPlayerLists.forEach((list, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = list.name;
      loadSelect.appendChild(opt);
    });

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

  const saveListNameInput = document.createElement('input');
  saveListNameInput.placeholder = 'List name (optional)';
  root.appendChild(saveListNameInput);

  const saveListBtn = document.createElement('button');
  saveListBtn.textContent = 'Save Player List';
  saveListBtn.addEventListener('click', () => {
    if (draftPlayers.length === 0) return;
    const name = saveListNameInput.value.trim() || 'Player List';
    actions.savePlayerList(name, draftPlayers);
    saveListNameInput.value = '';
  });
  root.appendChild(saveListBtn);

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

with:

```js
export function renderNewGame(root, db, actions) {
  let draftPlayers = [];
  let mode = 'normal';
  let targetScore = null;
  let gameName = 'Game Night';
  let step = 'form';

  function renderStep() {
    if (step === 'form') {
      renderFormStep();
    } else {
      renderConfirmStep();
    }
  }

  function renderFormStep() {
    root.innerHTML = '';
    renderHeader(root, { title: 'New Game', showBack: true, onBack: () => actions.goHome() });

    const nameInput = document.createElement('input');
    nameInput.placeholder = 'Game name';
    nameInput.value = gameName;
    root.appendChild(nameInput);

    const modeSelect = document.createElement('select');
    modeSelect.innerHTML = `
      <option value="normal">Normal (running total)</option>
      <option value="rounds">Rounds (per-round table)</option>
    `;
    modeSelect.value = mode;
    modeSelect.addEventListener('change', () => { mode = modeSelect.value; });
    root.appendChild(modeSelect);

    const targetScoreInput = document.createElement('input');
    targetScoreInput.type = 'number';
    targetScoreInput.placeholder = 'Target score (optional)';
    targetScoreInput.value = targetScore === null ? '' : String(targetScore);
    root.appendChild(targetScoreInput);

    if (db.savedPlayerLists.length > 0) {
      const loadSelect = document.createElement('select');

      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = 'Load saved player list...';
      loadSelect.appendChild(placeholderOption);

      db.savedPlayerLists.forEach((list, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = list.name;
        loadSelect.appendChild(opt);
      });

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

    const saveListNameInput = document.createElement('input');
    saveListNameInput.placeholder = 'List name (optional)';
    root.appendChild(saveListNameInput);

    const saveListBtn = document.createElement('button');
    saveListBtn.textContent = 'Save Player List';
    saveListBtn.addEventListener('click', () => {
      if (draftPlayers.length === 0) return;
      const name = saveListNameInput.value.trim() || 'Player List';
      actions.savePlayerList(name, draftPlayers);
      saveListNameInput.value = '';
    });
    root.appendChild(saveListBtn);

    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.disabled = true;
    root.appendChild(continueBtn);

    const origRenderPlayerList = renderPlayerList;
    renderPlayerList = function () {
      origRenderPlayerList();
      continueBtn.disabled = draftPlayers.length < 2;
    };
    renderPlayerList();

    continueBtn.addEventListener('click', () => {
      if (draftPlayers.length < 2) return;
      gameName = nameInput.value.trim() || 'Game Night';
      targetScore = targetScoreInput.value === '' ? null : Number(targetScoreInput.value);
      step = 'confirm';
      renderStep();
    });

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Cancel';
    backBtn.addEventListener('click', () => actions.goHome());
    root.appendChild(backBtn);
  }

  function renderConfirmStep() {
    root.innerHTML = '';
    renderHeader(root, {
      title: gameName,
      showBack: true,
      onBack: () => { step = 'form'; renderStep(); }
    });

    const modeLabel = document.createElement('p');
    modeLabel.textContent = mode === 'normal' ? 'Normal (running total)' : 'Rounds (per-round table)';
    root.appendChild(modeLabel);

    const playerCountLabel = document.createElement('p');
    playerCountLabel.textContent = `${draftPlayers.length} players`;
    root.appendChild(playerCountLabel);

    const targetDisplay = document.createElement('div');
    targetDisplay.className = 'keypad-display';
    targetDisplay.textContent = targetScore === null ? 'No target set' : String(targetScore);
    root.appendChild(targetDisplay);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => { step = 'form'; renderStep(); });
    root.appendChild(editBtn);

    const startBtn = document.createElement('button');
    startBtn.className = 'keypad-save';
    startBtn.textContent = 'Start';
    startBtn.addEventListener('click', () => {
      actions.startGame(gameName, mode, draftPlayers, targetScore);
    });
    root.appendChild(startBtn);
  }

  renderStep();
}
```

Note: the `renderHeader(root, { title: gameName, showBack: true, onBack: ... })` call in `renderConfirmStep` does not pass `showMenu`, matching the New Game form's own header (no "⋮" menu — the game doesn't exist yet, nothing to delete/rename/change-dealer).

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "renderConfirmStep"` — expect at least `2` (the function definition and its call inside `renderStep`), then stop the server.

Note in the report that full interactive verification (filling the form, tapping Continue, confirming the confirm screen shows correct data, tapping Edit to confirm the form retains everything, tapping Start to confirm the game is created with the right target score) requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Split New Game into a two-step form/confirm wizard with an optional target score"
```

---

## Task 4: Target score subtitle on Active Game (normal mode)

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature.

- [ ] **Step 1: Add the conditional subtitle after the header**

In `renderActiveGameNormal`, find the closing of the `renderHeader(...)` call:

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

and insert immediately after it:

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

  if (game.targetScore !== null && game.targetScore !== undefined) {
    const targetSubtitle = document.createElement('p');
    targetSubtitle.className = 'keypad-total';
    targetSubtitle.textContent = `Target: ${game.targetScore}`;
    root.appendChild(targetSubtitle);
  }
```

Note: the `!== null && !== undefined` check (rather than a simple truthy check) deliberately allows a target score of `0` to still display — a falsy-but-valid value, unlike the "unset" sentinel which is specifically `null`/`undefined`. Games created before this phase have no `targetScore` field at all (`undefined`), which this check correctly treats the same as "not set."

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "targetSubtitle"` — expect at least `1`, then stop the server.

Note in the report that full interactive verification (starting a game with a target score set and confirming the subtitle appears, and a game with no target score confirming it doesn't) requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Show target score subtitle on Active Game header when set"
```

---

## Final verification

- [ ] Run `npm test` — all tests passing (2 new `targetScore` tests added in Task 1).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Tap "New Game", fill in a name, add 2+ players, set a target score (e.g. 100), tap "Continue" — confirm the teal confirm screen shows the name, mode, player count, and "100".
  - Tap "Edit" — confirm the form still has the name, mode, players, and target score exactly as entered.
  - Tap "Continue" again, then "Start" — confirm the game is created and the Active Game screen shows "Target: 100" under the header.
  - Create a second game leaving target score blank — confirm the confirm screen shows "No target set" and the Active Game screen shows no target subtitle at all.
  - Use "Rematch (same players)" from a finished game that had a target score set — confirm the new game keeps the same target score.
