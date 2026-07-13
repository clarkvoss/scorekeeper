# Teal Theme Phase 2: Add Points Keypad Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen "Add Points" keypad entry flow for normal-mode games (calculator-style digit undo/redo, Save/Next Player, static DEALER badge, round-history modal), reachable via a new "Add Points" button on each player row — alongside, not replacing, the existing −/score/+ controls — per `docs/superpowers/specs/2026-07-13-teal-theme-phase2-add-points-design.md`.

**Architecture:** A new route `#/game/:id/player/:playerId` renders a new `renderAddPoints(root, game, player, actions)` function in `js/render.js`. It reuses the existing `adjustScore` action (delta semantics, same as the +/- buttons) — no new `js/db.js` functions are needed. A new `showRoundHistoryModal(game, player)` helper (read-only) mirrors the existing modal pattern. Digit undo/redo is local closure state inside `renderAddPoints`, reset naturally on every re-render (which already happens after every `adjustScore` call via the existing `persist()`+`route()` cycle).

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS. No automated tests for this phase — it's entirely DOM/UI (no new `js/db.js` functions), verified via `node --check` + served-content `curl` checks + manual browser pass, consistent with every prior UI task in this project.

## Global Constraints

- Do not remove or modify the existing −/score/+ inline controls or the tap-to-edit-exact-value modal on the Active Game (normal mode) screen — the new "Add Points" button is an addition, not a replacement.
- "Save" always uses delta/add semantics via the existing `adjustScore` action — never `setScore`.
- "Next Player" must never commit whatever is currently typed on the keypad — it only navigates.
- The DEALER badge is static (shown only when `player.id === game.players[0].id`) — no rotation logic, no interactivity.
- The digit undo/redo stack is local to a single `renderAddPoints` call — it must not be stored at module scope (which would leak state across different players' screens).
- No `innerHTML` with interpolated user data anywhere in new code — `createElement`/`textContent` only, matching this codebase's established XSS-safe pattern.
- All new colors route through existing CSS custom properties — no new hardcoded hex values.

---

## Task 1: Keypad, dealer badge, and round-history CSS

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `.dealer-badge`, `.keypad-round`, `.keypad-display`, `.keypad-total`, `.keypad-history-actions`, `.keypad`, `.keypad-key`, `.keypad-key.keypad-backspace`, `.keypad-footer`, `.keypad-footer .keypad-save`, `.round-history-list`, `.add-points-btn`. Consumed by Tasks 2, 3, and 5.

- [ ] **Step 1: Append the new rules**

Append to the end of `css/styles.css`:

```css
.dealer-badge {
  display: inline-block;
  background: var(--teal);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  margin-left: 0.4rem;
  vertical-align: middle;
}

.keypad-round {
  text-align: center;
  color: var(--fg);
  opacity: 0.6;
  margin: 0.5rem 0 0 0;
}
.keypad-display {
  text-align: center;
  font-size: 3rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0.25rem 0;
  min-height: 3.5rem;
}
.keypad-total {
  text-align: center;
  color: var(--fg);
  opacity: 0.6;
  margin-bottom: 0.75rem;
}
.keypad-history-actions {
  display: flex;
  justify-content: space-between;
  padding: 0 0.5rem;
  margin-bottom: 0.4rem;
}
.keypad-history-actions button {
  background: transparent;
  color: var(--teal);
  font-weight: 600;
}
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
}
.keypad-key {
  background: var(--card-bg);
  color: var(--fg);
  border: 1px solid var(--border);
  font-size: 1.3rem;
  font-weight: 600;
  min-height: 56px;
  border-radius: 0.875rem;
}
.keypad-key.keypad-backspace {
  background: var(--danger);
  color: white;
  border: none;
}
.keypad-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.keypad-footer button {
  flex: 1;
}
.keypad-footer .keypad-save {
  background: var(--teal);
}
.round-history-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
  max-height: 240px;
  overflow-y: auto;
}
.round-history-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
  color: var(--fg);
}
.add-points-btn {
  background: var(--card-bg);
  color: var(--teal);
  border: 1px solid var(--teal);
  font-size: 0.75rem;
  padding: 0.3rem 0.5rem;
  min-height: 44px;
}
```

- [ ] **Step 2: Verify**

Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced'; print('OK,', s.count('{'), 'rules')"`
Run: `grep -c '^\.keypad {' css/styles.css` — expect `1`

Then serve and confirm delivery: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "keypad-key"` — expect at least `2`, then stop the server.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add keypad, dealer badge, and round-history CSS"
```

---

## Task 2: Round-history modal (`showRoundHistoryModal`)

**Files:**
- Modify: `js/render.js` (append a new function; do not wire it into any screen yet — that's Task 3)

**Interfaces:**
- Consumes: `.modal-overlay`/`.modal`/`.modal-label`/`.modal-actions`/`.round-history-list` CSS (Task 1 for the list, pre-existing modal classes from Phase 1).
- Produces: `showRoundHistoryModal(game, player) -> void`. Relied on by Task 3.

- [ ] **Step 1: Append `showRoundHistoryModal` to `js/render.js`**

Add after the existing `showRenameModal` function:

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

Note: this modal is deliberately read-only — no Save button, only Close. It reuses the exact same entry data `playerRoundInfo` already reads from `game.history`, just listing every entry instead of only the most recent one.

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this function isn't called by anything yet, and isn't covered by unit tests).

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Add read-only round-history modal (not yet wired into any screen)"
```

---

## Task 3: `renderAddPoints` screen

**Files:**
- Modify: `js/render.js` (append a new exported function)

**Interfaces:**
- Consumes: `playerRoundInfo(game, playerId)` (existing, from Phase 1), `showRoundHistoryModal` (Task 2), `.app-header`/`.header-back`/`.header-title`/`.header-menu`/`.dealer-badge`/`.keypad-*` CSS (Task 1 + pre-existing Phase 1 header classes).
- Produces: `renderAddPoints(root, game, player, actions) -> void`. Relied on by Task 4's route wiring. Calls `actions.goActiveGame(game.id)`, `actions.goAddPoints(game.id, nextPlayer.id)`, and the existing `actions.adjustScore(game.id, player.id, value)` — the first two are new actions Task 4 adds.

- [ ] **Step 1: Append `renderAddPoints` to `js/render.js`**

Add after `renderActiveGameNormal` (or anywhere at module scope after `playerRoundInfo` is defined, since it's used here):

```js
export function renderAddPoints(root, game, player, actions) {
  root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'app-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'header-back';
  backBtn.textContent = '‹';
  backBtn.setAttribute('aria-label', 'Back to game');
  backBtn.addEventListener('click', () => actions.goActiveGame(game.id));
  header.appendChild(backBtn);

  const titleEl = document.createElement('h1');
  titleEl.className = 'header-title';
  titleEl.textContent = player.name;
  if (game.players[0] && game.players[0].id === player.id) {
    const badge = document.createElement('span');
    badge.className = 'dealer-badge';
    badge.textContent = 'DEALER';
    titleEl.appendChild(badge);
  }
  header.appendChild(titleEl);

  const historyBtn = document.createElement('button');
  historyBtn.className = 'header-menu';
  historyBtn.textContent = '↻';
  historyBtn.setAttribute('aria-label', 'View round history');
  historyBtn.addEventListener('click', () => showRoundHistoryModal(game, player));
  header.appendChild(historyBtn);

  root.appendChild(header);

  const info = playerRoundInfo(game, player.id);
  const nextRound = info ? info.round + 1 : 1;

  const roundLabel = document.createElement('p');
  roundLabel.className = 'keypad-round';
  roundLabel.textContent = `Round ${nextRound}`;
  root.appendChild(roundLabel);

  const display = document.createElement('div');
  display.className = 'keypad-display';
  root.appendChild(display);

  const totalLabel = document.createElement('p');
  totalLabel.className = 'keypad-total';
  root.appendChild(totalLabel);

  let typed = '';
  let negative = false;
  let undoStack = [JSON.stringify({ typed: '', negative: false })];
  let undoIndex = 0;

  function currentValueText() {
    return (negative ? '-' : '') + (typed || '0');
  }

  function renderDisplay() {
    display.textContent = currentValueText();
    totalLabel.textContent = `Total Score: ${game.scores[player.id]}`;
  }
  renderDisplay();

  function pushState() {
    undoStack = undoStack.slice(0, undoIndex + 1);
    undoStack.push(JSON.stringify({ typed, negative }));
    undoIndex = undoStack.length - 1;
  }

  function restoreState(json) {
    const state = JSON.parse(json);
    typed = state.typed;
    negative = state.negative;
    renderDisplay();
  }

  const historyActions = document.createElement('div');
  historyActions.className = 'keypad-history-actions';

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.addEventListener('click', () => {
    if (undoIndex > 0) {
      undoIndex -= 1;
      restoreState(undoStack[undoIndex]);
    }
  });
  historyActions.appendChild(undoBtn);

  const redoBtn = document.createElement('button');
  redoBtn.textContent = 'Redo';
  redoBtn.addEventListener('click', () => {
    if (undoIndex < undoStack.length - 1) {
      undoIndex += 1;
      restoreState(undoStack[undoIndex]);
    }
  });
  historyActions.appendChild(redoBtn);

  root.appendChild(historyActions);

  const keypad = document.createElement('div');
  keypad.className = 'keypad';

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '±', '0', '⌫'];
  for (const key of keys) {
    const btn = document.createElement('button');
    btn.className = 'keypad-key' + (key === '⌫' ? ' keypad-backspace' : '');
    btn.textContent = key;
    btn.addEventListener('click', () => {
      if (key === '±') {
        negative = !negative;
      } else if (key === '⌫') {
        typed = typed.slice(0, -1);
      } else {
        typed += key;
      }
      pushState();
      renderDisplay();
    });
    keypad.appendChild(btn);
  }
  root.appendChild(keypad);

  const footer = document.createElement('div');
  footer.className = 'keypad-footer';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'keypad-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const value = Number(currentValueText());
    if (Number.isFinite(value)) {
      actions.adjustScore(game.id, player.id, value);
    }
  });
  footer.appendChild(saveBtn);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next Player';
  nextBtn.addEventListener('click', () => {
    const idx = game.players.findIndex(p => p.id === player.id);
    const nextPlayer = game.players[(idx + 1) % game.players.length];
    actions.goAddPoints(game.id, nextPlayer.id);
  });
  footer.appendChild(nextBtn);

  root.appendChild(footer);
}
```

Note: `actions.adjustScore` already triggers `persist()` + `route()` in `js/app.js` (Task 4 wires the route branch that calls this function). Since the hash doesn't change on Save, `route()` re-renders this same screen fresh from the updated `game`/`player` data — which naturally resets `typed`/`negative`/`undoStack` (they're local closure variables recreated on each call) and recomputes `nextRound` via `playerRoundInfo` to reflect the just-saved round. No manual reset code is needed after calling `actions.adjustScore`.

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this function isn't called by anything yet).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "renderAddPoints"` — expect at least `1`, then stop the server.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Add Add Points keypad screen (not yet reachable from any route)"
```

---

## Task 4: Route and actions wiring (`js/app.js`)

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `renderAddPoints` from `js/render.js` (Task 3).
- Produces: `actions.goActiveGame(gameId) -> void`, `actions.goAddPoints(gameId, playerId) -> void`; a new `#/game/:id/player/:playerId` route branch. Relied on by Task 5's "Add Points" button and by `renderAddPoints` itself (Task 3's back-button/Next-Player calls).

- [ ] **Step 1: Update the `render.js` import**

Change:

```js
import { renderHome, renderNewGame, renderActiveGameNormal, renderActiveGameRounds, renderSummary } from './render.js';
```

to:

```js
import { renderHome, renderNewGame, renderActiveGameNormal, renderActiveGameRounds, renderSummary, renderAddPoints } from './render.js';
```

- [ ] **Step 2: Add the two new actions**

Add to the `actions` object (e.g. right after `goNewGame`):

```js
  goActiveGame: (gameId) => { location.hash = `#/game/${gameId}`; },
  goAddPoints: (gameId, playerId) => { location.hash = `#/game/${gameId}/player/${playerId}`; },
```

- [ ] **Step 3: Add the route branch**

In `route()`, add a new branch — place it after the existing `summaryMatch` block and before the existing `gameMatch` block:

```js
  const addPointsMatch = hash.match(/^#\/game\/([^/]+)\/player\/([^/]+)$/);
  if (addPointsMatch) {
    const game = findGame(addPointsMatch[1]);
    const player = game && game.players.find(p => p.id === addPointsMatch[2]);
    if (game && player && game.mode === 'normal') {
      renderAddPoints(root, game, player, actions);
      return;
    }
  }
```

- [ ] **Step 4: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "goAddPoints"` — expect at least `2` (the action definition and the route regex context), then stop the server.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "Wire Add Points route and navigation actions"
```

---

## Task 5: "Add Points" button on player rows

**Files:**
- Modify: `js/render.js` (inside `renderActiveGameNormal`'s `renderRows` function)

**Interfaces:**
- Consumes: `actions.goAddPoints(gameId, playerId)` from Task 4; `.add-points-btn` CSS from Task 1.
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature, only an additional button per row.

- [ ] **Step 1: Add the button after the existing plus button**

In `renderActiveGameNormal`'s `renderRows`, find:

```js
      const plusBtn = document.createElement('button');
      plusBtn.className = 'score-btn score-btn-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', 'Increase score');
      plusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, 1));
      row.appendChild(plusBtn);

      rowsContainer.appendChild(row);
```

and insert a new button between `row.appendChild(plusBtn);` and `rowsContainer.appendChild(row);`:

```js
      const plusBtn = document.createElement('button');
      plusBtn.className = 'score-btn score-btn-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', 'Increase score');
      plusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, 1));
      row.appendChild(plusBtn);

      const addPointsBtn = document.createElement('button');
      addPointsBtn.className = 'add-points-btn';
      addPointsBtn.textContent = 'Add Points';
      addPointsBtn.addEventListener('click', () => actions.goAddPoints(game.id, player.id));
      row.appendChild(addPointsBtn);

      rowsContainer.appendChild(row);
```

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "add-points-btn"` — expect at least `1`, then stop the server.

Note in the report that full interactive verification (tapping "Add Points" on a player row, using the keypad, Save, Next Player, Undo/Redo, the history icon, back navigation, and confirming the DEALER badge only shows on the first player) requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Add 'Add Points' button to player rows, alongside existing +/- controls"
```

---

## Final verification

- [ ] Run `npm test` — all tests still passing (no new `js/db.js` functions were added in this phase, so the count should match Phase 1's final total).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Confirm a normal-mode game's player rows show the new "Add Points" button alongside the existing −/score/+ controls.
  - Tap "Add Points" for the first player in the list — confirm the DEALER badge appears next to their name; for any other player, confirm it does not.
  - Type a multi-digit number on the keypad, confirm the big display updates; test Undo/Redo stepping back and forward through digit entries; test the +/- key toggling sign; test backspace.
  - Tap Save — confirm the total updates, the input resets, and "Round N" increments.
  - Tap the history icon — confirm a read-only modal lists past rounds for that player, closes on Close/Escape/backdrop-click.
  - Tap Next Player — confirm it advances to the next player (wrapping from the last back to the first) without committing whatever was typed.
  - Tap the back arrow — confirm it returns to the Active Game (normal mode) screen.
  - Confirm the existing −/score/+ controls and tap-to-edit-exact-value modal on the Active Game screen still work exactly as before.
