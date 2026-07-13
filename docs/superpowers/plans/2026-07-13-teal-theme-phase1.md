# Teal Theme Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a teal header across every screen, add a header "⋮" menu (Delete/Rename Game), and restyle Active Game (normal mode) player rows with emoji avatars and a "Round N, Last: X" subtext, per `docs/superpowers/specs/2026-07-13-teal-theme-phase1-design.md`. Visual/structural only — no interaction changes to existing scoring, sort, undo, or rounds-mode/summary behavior.

**Architecture:** A new `js/emojis.js` module (mirrors `js/colors.js`) supplies avatar emoji, consumed by `js/db.js`'s `addPlayer`. A new `renderHeader()` helper and `showRenameModal()` helper are added to `js/render.js` and consumed by all five existing render functions (`renderHome`, `renderNewGame`, `renderActiveGameNormal`, `renderActiveGameRounds`, `renderSummary`), replacing each screen's current ad-hoc `<h1>`/back-button markup. `js/app.js` gains one new `actions.renameGame` wired to a new `js/db.js` `renameGame` mutator.

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS, `node --test` for `js/db.js`/`js/emojis.js` unit tests (TDD), manual browser verification for the DOM/UI layer (no automated tests for `js/render.js`, consistent with every prior UI task in this project).

## Global Constraints

- No interaction changes: existing scoring (+/-, exact-value modal), sort cycle, game-level undo, rounds-mode table editing, and summary/rematch behavior are all unchanged — this plan only touches presentation (header, avatars, subtext) and adds the new Rename feature.
- Players saved before this change have no `emoji` field — render code must fall back gracefully (e.g. a default emoji), never show `undefined`.
- The header "⋮" menu holds exactly two fixed items (Rename Game, Delete Game) — do not build a general-purpose dropdown component beyond what these two items need.
- To avoid a `document`-level click-listener leak across repeated re-renders (every score action calls `route()`, which fully rebuilds the screen), the header menu's open/close state must not accumulate global event listeners — attach an outside-click listener only while the menu is open, and remove it when the menu closes or an item is selected. This plan does not implement close-on-outside-click as a "nice to have"; tapping the "⋮" button again toggles it closed, and each render call must leave at most zero stray listeners behind.
- No automated tests for `js/render.js`/CSS — verify via `node --check`, `npm test` (regression-only), and served-content `curl` checks, consistent with prior UI tasks in this project. `js/emojis.js` and `js/db.js` changes DO get unit tests (TDD, matching the established pattern for those files).
- All new colors route through CSS custom properties (new `--teal`/`--teal-dark` added to `:root`, alongside the existing `--bg`/`--fg`/`--card-bg`/`--accent`/`--danger`/`--border`) — no new hardcoded hex values outside the `:root` block.

---

## Task 1: Player emoji palette (`js/emojis.js`)

**Files:**
- Create: `js/emojis.js`
- Test: `tests/emojis.test.js`

**Interfaces:**
- Produces: `PLAYER_EMOJIS` (array of 10 emoji strings), `nextEmoji(existingCount: number) -> string` — used by Task 2's `addPlayer`. Mirrors `js/colors.js`'s `PLAYER_COLORS`/`nextColor` exactly.

- [ ] **Step 1: Write the failing test**

Create `tests/emojis.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_EMOJIS, nextEmoji } from '../js/emojis.js';

test('PLAYER_EMOJIS has at least 8 distinct emoji', () => {
  assert.ok(PLAYER_EMOJIS.length >= 8);
  assert.equal(new Set(PLAYER_EMOJIS).size, PLAYER_EMOJIS.length);
});

test('nextEmoji cycles through the palette round-robin', () => {
  assert.equal(nextEmoji(0), PLAYER_EMOJIS[0]);
  assert.equal(nextEmoji(1), PLAYER_EMOJIS[1]);
  assert.equal(nextEmoji(PLAYER_EMOJIS.length), PLAYER_EMOJIS[0]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/emojis.js'`

- [ ] **Step 3: Create `js/emojis.js`**

```js
export const PLAYER_EMOJIS = [
  '😀', '😎', '🤓', '😺', '🐶',
  '🦁', '🐸', '🍕', '⭐', '🎲'
];

export function nextEmoji(existingCount) {
  return PLAYER_EMOJIS[existingCount % PLAYER_EMOJIS.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all existing tests plus 2 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/emojis.js tests/emojis.test.js
git commit -m "Add player emoji palette module"
```

---

## Task 2: `addPlayer` assigns an emoji

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Consumes: `nextEmoji(existingCount)` from `js/emojis.js` (Task 1).
- Produces: `addPlayer(game, name, color?, emoji?) -> player` — player shape becomes `{id, name, color, emoji}`. Relied on by Task 9's avatar rendering.

- [ ] **Step 1: Write the failing test**

Append to `tests/db.test.js`:

```js
test('addPlayer assigns a round-robin emoji', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  assert.ok(p1.emoji);
  assert.notEqual(p1.emoji, p2.emoji);
});

test('addPlayer respects an explicit emoji override', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice', null, '🐙');
  assert.equal(p1.emoji, '🐙');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `p1.emoji` is `undefined`.

- [ ] **Step 3: Update `js/db.js`**

Add the import at the top of the file (alongside the existing `nextColor` import):

```js
import { nextColor } from './colors.js';
import { nextEmoji } from './emojis.js';
```

Update `addPlayer`:

```js
export function addPlayer(game, name, color, emoji) {
  const player = {
    id: makeId(),
    name,
    color: color || nextColor(game.players.length),
    emoji: emoji || nextEmoji(game.players.length)
  };
  game.players.push(player);
  if (game.mode === 'normal') {
    game.scores[player.id] = 0;
  }
  game.updatedAt = Date.now();
  return player;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 2 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Assign a round-robin emoji to each player"
```

---

## Task 3: `renameGame` mutator

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `renameGame(game, newName) -> void` — sets `game.name` and bumps `game.updatedAt`. Relied on by Task 6's `actions.renameGame`.

- [ ] **Step 1: Write the failing test**

Append to `tests/db.test.js` and update the import line to add `renameGame`:

```js
test('renameGame updates the game name and bumps updatedAt', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const before = game.updatedAt;
  renameGame(game, 'Poker Night 2');
  assert.equal(game.name, 'Poker Night 2');
  assert.ok(game.updatedAt >= before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `renameGame is not a function`.

- [ ] **Step 3: Append to `js/db.js`**

```js
export function renameGame(game, newName) {
  game.name = newName;
  game.updatedAt = Date.now();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add renameGame mutator"
```

---

## Task 4: Header, menu, and avatar CSS

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `--teal`/`--teal-dark` custom properties; `.app-header`, `.header-back`, `.header-title`, `.header-spacer`, `.header-menu-wrap`, `.header-menu`, `.header-menu-dropdown` (+ `.hidden` state); `.player-avatar`, `.player-namewrap`, `.player-name`, `.player-meta`. Consumed by Task 5's `renderHeader`/`showRenameModal` and Task 9's avatar rendering.

- [ ] **Step 1: Add teal custom properties to `:root`**

In `css/styles.css`, in the `:root` block, add two new lines (keep everything else in that block unchanged):

```css
:root {
  --bg: #fafafa;
  --fg: #1a1a1a;
  --card-bg: #f4f4f5;
  --accent: #457b9d;
  --danger: #e63946;
  --border: #d9d9de;
  --teal: #2d7d74;
  --teal-dark: #1f5c54;
}
```

- [ ] **Step 2: Append header, menu, and avatar rules**

Append to the end of `css/styles.css`:

```css
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: linear-gradient(180deg, var(--teal), var(--teal-dark));
  border-radius: 0.875rem;
  padding: 0.75rem 1rem;
  margin: -1rem -1rem 1rem -1rem;
}
.header-back {
  background: transparent;
  color: white;
  font-size: 1.4rem;
  padding: 0.2rem 0.6rem;
  min-width: 44px;
  min-height: 44px;
}
.header-title {
  color: white;
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  flex: 1;
  text-align: center;
}
.header-spacer {
  min-width: 44px;
  display: inline-block;
}
.header-menu-wrap {
  position: relative;
}
.header-menu {
  background: transparent;
  color: white;
  font-size: 1.2rem;
  padding: 0.2rem 0.6rem;
  min-width: 44px;
  min-height: 44px;
}
.header-menu-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  background: var(--card-bg);
  border-radius: 0.6rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 160px;
  z-index: 50;
}
.header-menu-dropdown.hidden {
  display: none;
}
.header-menu-dropdown button {
  background: transparent;
  color: var(--fg);
  text-align: left;
  padding: 0.5rem;
}
.header-menu-dropdown button.danger {
  color: var(--danger);
  background: transparent;
}

.player-avatar {
  width: 38px;
  height: 38px;
  min-width: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}
.player-namewrap {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.player-name {
  color: var(--teal);
  font-weight: 600;
}
.player-meta {
  color: var(--fg);
  opacity: 0.55;
  font-size: 0.75rem;
}
```

- [ ] **Step 3: Verify**

Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced'; print('OK,', s.count('{'), 'rules')"`
Run: `grep -c '^\.app-header {' css/styles.css` — expect `1`

Then serve and confirm delivery: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "header-menu-dropdown"` — expect at least `2`, then stop the server.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css
git commit -m "Add teal header, menu, and player avatar CSS"
```

---

## Task 5: `renderHeader` and `showRenameModal` helpers

**Files:**
- Modify: `js/render.js` (append two new functions; do not wire them into any screen yet — that's Tasks 7-11)

**Interfaces:**
- Consumes: `.app-header`/`.header-*` classes from Task 4.
- Produces: `renderHeader(root, { title, showBack, showMenu, onBack, onDelete, onRename }) -> void`; `showRenameModal(currentName, onSave) -> void`. Relied on by Tasks 6-11.

- [ ] **Step 1: Append `renderHeader` to `js/render.js`**

Add after the existing `showScoreModal` function:

```js
function renderHeader(root, { title, showBack = false, showMenu = false, onBack, onDelete, onRename }) {
  const header = document.createElement('div');
  header.className = 'app-header';

  if (showBack) {
    const backBtn = document.createElement('button');
    backBtn.className = 'header-back';
    backBtn.textContent = '‹';
    backBtn.setAttribute('aria-label', 'Back to Home');
    backBtn.addEventListener('click', onBack);
    header.appendChild(backBtn);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'header-spacer';
    header.appendChild(spacer);
  }

  const titleEl = document.createElement('h1');
  titleEl.className = 'header-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (showMenu) {
    const menuWrap = document.createElement('div');
    menuWrap.className = 'header-menu-wrap';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'header-menu';
    menuBtn.textContent = '⋮';
    menuBtn.setAttribute('aria-label', 'Game menu');
    menuWrap.appendChild(menuBtn);

    const dropdown = document.createElement('div');
    dropdown.className = 'header-menu-dropdown hidden';

    const renameItem = document.createElement('button');
    renameItem.textContent = 'Rename Game';
    renameItem.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      onRename();
    });
    dropdown.appendChild(renameItem);

    const deleteItem = document.createElement('button');
    deleteItem.className = 'danger';
    deleteItem.textContent = 'Delete Game';
    deleteItem.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      onDelete();
    });
    dropdown.appendChild(deleteItem);

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    menuWrap.appendChild(dropdown);
    header.appendChild(menuWrap);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'header-spacer';
    header.appendChild(spacer);
  }

  root.appendChild(header);
}
```

Note: per this plan's Global Constraints, there is deliberately no outside-click-to-close listener — tapping the "⋮" button again toggles the dropdown closed. This avoids any `document`-level listener that would need cleanup across repeated re-renders.

- [ ] **Step 2: Append `showRenameModal` to `js/render.js`**

Add directly after `renderHeader`:

```js
function showRenameModal(currentName, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = 'Rename game';
  modal.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  modal.appendChild(input);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', close);
  actionsRow.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', save);
  actionsRow.appendChild(saveBtn);

  modal.appendChild(actionsRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  input.focus();
  input.select();

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  }

  function save() {
    const value = input.value.trim();
    if (!value) { close(); return; }
    onSave(value);
    close();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') save();
  }

  document.addEventListener('keydown', onKeydown);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
```

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (these two new functions aren't called by anything yet, and aren't covered by unit tests).

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Add renderHeader and showRenameModal helpers (not yet wired into any screen)"
```

---

## Task 6: Wire `actions.renameGame` in `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `renameGame(game, newName)` from `js/db.js` (Task 3).
- Produces: `actions.renameGame(gameId, newName) -> void`. Relied on by Tasks 9-11's header wiring.

- [ ] **Step 1: Update the `db.js` import**

Change:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame } from './db.js';
```

to:

```js
import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame } from './db.js';
```

- [ ] **Step 2: Add the action**

Add to the `actions` object (e.g. right after `deleteGame`):

```js
  renameGame: (gameId, newName) => {
    renameGame(findGame(gameId), newName);
    persist();
    route();
  },
```

- [ ] **Step 3: Verify**

Run: `node --check js/app.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/app.js | grep -c "renameGame(findGame"` — expect `1`, then stop the server.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Wire renameGame into app actions"
```

---

## Task 7: `renderHome` uses the teal header

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `renderHeader` from Task 5.
- Produces: no new interfaces — same `renderHome(root, db, actions)` signature.

- [ ] **Step 1: Replace the heading in `renderHome`**

Replace:

```js
  const heading = document.createElement('h1');
  heading.textContent = 'Scorekeeper';
  root.appendChild(heading);
```

with:

```js
  renderHeader(root, { title: 'Scorekeeper' });
```

(Leave the rest of `renderHome` — the "New Game" button, "Games"/"History" sections — exactly as-is.)

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "renderHeader(root, { title: 'Scorekeeper' })"` — expect `1`, then stop the server.

Note in the report that full visual verification requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Apply teal header to Home screen"
```

---

## Task 8: `renderNewGame` uses the teal header

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `renderHeader` from Task 5.
- Produces: no new interfaces — same `renderNewGame(root, db, actions)` signature.

- [ ] **Step 1: Replace the heading in `renderNewGame`**

Replace:

```js
  const heading = document.createElement('h1');
  heading.textContent = 'New Game';
  root.appendChild(heading);
```

with:

```js
  renderHeader(root, { title: 'New Game', showBack: true, onBack: () => actions.goHome() });
```

(Leave everything else in `renderNewGame` — including the existing "Cancel" button at the bottom — exactly as-is; the header back-arrow and the Cancel button both navigate home, which is an accepted minor redundancy.)

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "title: 'New Game'"` — expect `1`, then stop the server.

Note in the report that full visual verification requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Apply teal header to New Game screen"
```

---

## Task 9: `renderActiveGameNormal` — header, avatar, and Round/Last subtext

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `renderHeader`, `showRenameModal` from Task 5; `actions.renameGame` from Task 6; `.player-avatar`/`.player-namewrap`/`.player-name`/`.player-meta` CSS from Task 4.
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature.

- [ ] **Step 1: Replace the heading**

Replace:

```js
  const heading = document.createElement('h1');
  heading.textContent = game.name;
  root.appendChild(heading);
```

with:

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

- [ ] **Step 2: Add a `playerRoundInfo` helper and restructure the player row**

Add this helper function directly above `renderActiveGameNormal` (or anywhere at module scope above its first use):

```js
function playerRoundInfo(game, playerId) {
  const entries = game.history.filter(h => h.playerId === playerId);
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { round: entries.length, last: last.delta };
}
```

Inside `renderRows`, replace:

```js
      const name = document.createElement('span');
      name.textContent = player.name;
      row.appendChild(name);
```

with:

```js
      const avatar = document.createElement('div');
      avatar.className = 'player-avatar';
      avatar.style.background = player.color + '33';
      avatar.textContent = player.emoji || '🙂';
      row.appendChild(avatar);

      const nameWrap = document.createElement('div');
      nameWrap.className = 'player-namewrap';

      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = player.name;
      nameWrap.appendChild(name);

      const info = playerRoundInfo(game, player.id);
      if (info) {
        const meta = document.createElement('span');
        meta.className = 'player-meta';
        meta.textContent = `Round ${info.round}, Last: ${info.last}`;
        nameWrap.appendChild(meta);
      }

      row.appendChild(nameWrap);
```

(`player.color + '33'` appends a hex alpha suffix for a low-opacity tint — e.g. `#e63946` becomes `#e6394633`, roughly 20% opacity. `player.emoji || '🙂'` falls back gracefully for players saved before Task 2's change, which have no `emoji` field.)

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this file isn't covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "playerRoundInfo"` — expect at least `2`, then stop the server.

Note in the report that full interactive verification (opening a normal-mode game, confirming the header/menu/avatars/subtext render and Rename/Delete work) requires a real browser and will be done separately by the controller.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Add teal header with Rename/Delete menu and avatar/round-subtext to Active Game (normal mode)"
```

---

## Task 10: `renderActiveGameRounds` uses the teal header

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `renderHeader`, `showRenameModal` from Task 5; `actions.renameGame` from Task 6.
- Produces: no new exported interfaces — same `renderActiveGameRounds(root, game, actions)` signature.

- [ ] **Step 1: Replace the heading**

Replace:

```js
  const heading = document.createElement('h1');
  heading.textContent = game.name;
  root.appendChild(heading);
```

(the one inside `renderActiveGameRounds`, not the one already replaced in `renderActiveGameNormal` by Task 9) with:

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

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "showBack: true"` — expect `3` (New Game, Active-Normal, Active-Rounds so far), then stop the server.

Note in the report that full interactive verification requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Apply teal header with Rename/Delete menu to Active Game (rounds mode)"
```

---

## Task 11: `renderSummary` uses the teal header

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `renderHeader`, `showRenameModal` from Task 5; `actions.renameGame` from Task 6.
- Produces: no new exported interfaces — same `renderSummary(root, game, actions)` signature.

- [ ] **Step 1: Replace the heading**

Replace:

```js
  const heading = document.createElement('h1');
  heading.textContent = game.name + ' — Final Standings';
  root.appendChild(heading);
```

with:

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

  const subheading = document.createElement('h2');
  subheading.textContent = 'Final Standings';
  root.appendChild(subheading);
```

(The "— Final Standings" suffix moves from the header title into a plain `<h2>` subheading below it, keeping the header itself consistent with every other screen's plain game-name title.)

- [ ] **Step 2: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing.
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "Final Standings"` — expect `1` (now only in the subheading, not the header title), then stop the server.

Note in the report that full interactive verification requires a real browser and will be done separately by the controller.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "Apply teal header with Rename/Delete menu to Summary screen"
```

---

## Final verification

- [ ] Run `npm test` — all tests passing (colors, emojis, db, storage suites).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Confirm every screen (Home, New Game, Active Game normal, Active Game rounds, Summary) shows the teal gradient header.
  - Confirm Home has no back arrow/menu; New Game has a back arrow but no menu; Active Game (both modes) and Summary have both a back arrow and a working "⋮" menu.
  - From the menu, confirm "Rename Game" opens a modal, saves a new name, and the header updates; confirm "Delete Game" still confirms and deletes correctly.
  - In a normal-mode game, confirm each player row shows an emoji avatar (tinted with their color) and, after at least one score entry, a "Round N, Last: X" line under their name.
  - Confirm existing behavior is unchanged: +/- buttons, tap-to-edit-exact-value modal, 3-way sort, game-level undo, rounds-mode table editing, and rematch all still work.
