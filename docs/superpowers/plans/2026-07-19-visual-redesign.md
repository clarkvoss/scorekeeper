# Rounded-Card Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Home, New Game, and normal-mode Active Game screens to a rounded-card look with per-player accent colors, circular +/- buttons, and a discoverable pencil-icon hint on the tap-to-edit score, per `docs/superpowers/specs/2026-07-19-visual-redesign-design.md`.

**Architecture:** Pure CSS + minimal DOM-structure changes to `js/render.js`'s `renderActiveGameNormal` (to add the pencil hint span and apply new button classes). No new files, no data model changes, no new routes.

**Tech Stack:** Plain CSS custom properties (existing `--bg`, `--fg`, `--card-bg`, `--accent`, `--danger`, `--border`), vanilla JS DOM APIs (createElement/textContent, matching the codebase's established XSS-safe pattern).

## Global Constraints

- Rounds-mode table screen and Summary screen must remain visually unchanged — do not modify shared `button`/`input` base selectors in a way that would affect them; add new scoped classes instead.
- All interactive elements must keep a minimum 44px tap target (existing constraint, carried from the original styling task).
- All colors must go through existing CSS custom properties — no hardcoded hex values in new CSS.
- No behavior change to the tap-to-edit score flow (`prompt()`-based exact value entry) — only its visual discoverability changes.
- No automated tests exist for `js/render.js`/CSS (DOM/UI layer) — verify via syntax check + served-content check, consistent with the original styling task's approach.

---

## Task 1: Card styling in css/styles.css

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: updated visual rules for `.game-list-item`, `.player-row` (rounded cards with shadow); new classes `.score-btn`, `.score-btn-plus` (circular +/- buttons), `.score-edit-hint` (pencil hint) — consumed by Task 2's `js/render.js` changes.

- [ ] **Step 1: Update `.game-list-item` to a rounded card with shadow**

In `css/styles.css`, replace the existing `.game-list-item` rule:

```css
.game-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-bg);
  border-radius: 0.5rem;
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
  border-left: 6px solid var(--accent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 2: Update `.player-row` to a rounded card with shadow**

Replace the existing `.player-row` rule:

```css
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
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  padding: 0.6rem;
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 3: Add circular +/- button styles and pencil-hint style**

Append to `css/styles.css`, after the existing `.player-row button` rule (do not remove `.player-row button` — it still applies baseline sizing; the new classes layer on top):

```css
.score-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-radius: 50%;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
}
.score-btn-plus {
  background: var(--accent);
  color: white;
  border: none;
}
.score-edit-hint {
  font-size: 0.7rem;
  opacity: 0.55;
  margin-left: 0.3rem;
}
```

- [ ] **Step 4: Manually verify**

Run: `cd ~/scorekeeper && node --check css/styles.css 2>/dev/null; echo "(node --check only validates JS, skip for CSS)"`

Instead, verify CSS syntax by checking brace balance and confirm the file has no leftover duplicate `.game-list-item`/`.player-row` rules:

Run: `grep -c '^\.game-list-item {' css/styles.css` — expect `1`
Run: `grep -c '^\.player-row {' css/styles.css` — expect `1`
Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced braces'; print('OK, braces balanced:', s.count('{'))"`

Then serve and confirm delivery:

Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "score-btn"` — expect at least `3` (`.score-btn`, `.score-btn-plus`, and any comment/selector mentions), then stop the server.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css
git commit -m "Restyle game-list-item and player-row as rounded cards; add circular score-btn and score-edit-hint classes"
```

---

## Task 2: Apply new classes and pencil hint in js/render.js

**Files:**
- Modify: `js/render.js` (inside `renderActiveGameNormal`'s `renderRows` function)

**Interfaces:**
- Consumes: `.score-btn`, `.score-btn-plus`, `.score-edit-hint` classes from Task 1.
- Produces: no new exported interfaces — same `renderActiveGameNormal(root, game, actions)` signature, only internal markup changes.

- [ ] **Step 1: Locate the minus/score/plus button block**

In `js/render.js`, inside `renderActiveGameNormal`'s `renderRows` function, find this block (currently around the `for (const player of players)` loop):

```js
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
```

- [ ] **Step 2: Replace it with the card-styled version**

```js
      const minusBtn = document.createElement('button');
      minusBtn.className = 'score-btn';
      minusBtn.textContent = '−';
      minusBtn.setAttribute('aria-label', 'Decrease score');
      minusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, -1));
      row.appendChild(minusBtn);

      const scoreBtn = document.createElement('button');
      scoreBtn.className = 'score-display';
      const scoreValue = document.createElement('span');
      scoreValue.textContent = String(game.scores[player.id]);
      scoreBtn.appendChild(scoreValue);
      const editHint = document.createElement('span');
      editHint.className = 'score-edit-hint';
      editHint.textContent = '✎';
      editHint.setAttribute('aria-hidden', 'true');
      scoreBtn.appendChild(editHint);
      scoreBtn.addEventListener('click', () => {
        const input = prompt('Set exact score for ' + player.name, String(game.scores[player.id]));
        if (input === null) return;
        const value = Number(input);
        if (!Number.isFinite(value)) return;
        actions.setScore(game.id, player.id, value);
      });
      row.appendChild(scoreBtn);

      const plusBtn = document.createElement('button');
      plusBtn.className = 'score-btn score-btn-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', 'Increase score');
      plusBtn.addEventListener('click', () => actions.adjustScore(game.id, player.id, 1));
      row.appendChild(plusBtn);
```

Note: `−` is a proper minus sign (U+2212), `✎` is the pencil glyph (U+270E). Using escape sequences avoids any encoding ambiguity when the file is edited by different tools.

- [ ] **Step 3: Verify**

Run: `node --check js/render.js` — expect no syntax errors.

Run: `npm test` — expect all 22 existing tests still passing (this file isn't covered by unit tests, so this just confirms no regression in the covered modules: `js/db.js`, `js/colors.js`, `js/storage.js`).

Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "score-btn"` — expect at least `3`, then stop the server.

Note in the report that full interactive/visual verification (confirming the cards render correctly, circles are round, pencil hint is visible and correctly positioned) requires a real browser and will be done separately by the controller.

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "Apply rounded-card score buttons and pencil edit-hint to normal-mode active game screen"
```

---

## Final verification

- [ ] Run `npm test` — all 22 tests still passing.
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser: confirm Home screen game list shows rounded cards with a colored left accent and shadow; confirm a normal-mode active game shows player rows as rounded cards with circular minus/plus buttons (plus button accent-colored) and a small pencil icon next to the score; confirm rounds-mode table and summary screens are visually unchanged from before this plan.
