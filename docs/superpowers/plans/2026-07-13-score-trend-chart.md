# Score Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hand-built inline SVG line chart to the Summary screen showing each player's cumulative score trend over the game, for both normal and rounds mode — per `docs/superpowers/specs/2026-07-13-score-trend-chart-design.md`.

**Architecture:** A new pure `computeScoreTrend(game)` in `js/db.js` (no persistence, mirrors the existing `computeRoundsTotals` pattern) computes each player's cumulative-score series. A new `renderTrendChart(root, game)` in `js/render.js` builds the SVG (polylines + end-dots + legend + conditional direct labels) using `document.createElementNS`, and `renderSummary` calls it once, between the standings list and the Rematch button. No new `js/app.js` actions — this is pure display with no interactivity.

**Tech Stack:** Vanilla JS (ES modules), inline SVG via `document.createElementNS`, vanilla CSS. `js/db.js` changes get unit tests (TDD); the SVG/DOM rendering has no automated tests, consistent with every prior UI task in this project.

## Global Constraints

- No interactivity (no hover/tap tooltips) — this chart is static.
- Colors reuse each player's existing `player.color` (same as their avatar/row accent elsewhere) — do not introduce a separate chart-only palette.
- Direct end-of-line labels use the app's normal text ink color (`--fg`), never the player's series color — color must never be the only way to identify a line. Direct labels only render when 4 or fewer players have a plotted series; a legend (color dot + name) is always present regardless of player count.
- A player with no plottable data (zero history entries in normal mode; rounds mode with `game.rounds.length === 0`) is omitted from the chart entirely, not plotted as a flat/empty line.
- If no player has any plottable data at all, skip rendering the chart section entirely.
- No new `js/app.js` actions or route changes — this task only adds a data function and a render function, wired into the existing `renderSummary`.

---

## Task 1: `computeScoreTrend` in `js/db.js`

**Files:**
- Modify: `js/db.js`
- Modify: `tests/db.test.js`

**Interfaces:**
- Produces: `computeScoreTrend(game) -> { [playerId]: number[] }` — cumulative-score series per player, omitting players with zero data points. Relied on by Task 3's `renderTrendChart`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/db.test.js` and update the import line to add `computeScoreTrend`:

```js
test('computeScoreTrend returns cumulative per-event series for normal mode', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  adjustScore(game, p1.id, 10);
  adjustScore(game, p1.id, 5);
  adjustScore(game, p2.id, 3);
  const trend = computeScoreTrend(game);
  assert.deepEqual(trend[p1.id], [10, 15]);
  assert.deepEqual(trend[p2.id], [3]);
});

test('computeScoreTrend omits players with no history entries in normal mode', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  addPlayer(game, 'Bob');
  adjustScore(game, p1.id, 10);
  const trend = computeScoreTrend(game);
  assert.ok(p1.id in trend);
  assert.equal(Object.keys(trend).length, 1);
});

test('computeScoreTrend returns cumulative per-round series for rounds mode', () => {
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
  const trend = computeScoreTrend(game);
  assert.deepEqual(trend[p1.id], [10, 13]);
  assert.deepEqual(trend[p2.id], [7, 15]);
});

test('computeScoreTrend returns an empty object when rounds mode has no rounds yet', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  addPlayer(game, 'Alice');
  const trend = computeScoreTrend(game);
  assert.deepEqual(trend, {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `computeScoreTrend is not a function`.

- [ ] **Step 3: Append to `js/db.js`**

```js
export function computeScoreTrend(game) {
  const series = {};
  if (game.mode === 'normal') {
    for (const player of game.players) {
      const entries = game.history.filter(h => h.playerId === player.id);
      if (entries.length === 0) continue;
      let running = 0;
      series[player.id] = entries.map(e => {
        running += e.delta;
        return running;
      });
    }
  } else if (game.rounds.length > 0) {
    for (const player of game.players) {
      let running = 0;
      const points = [];
      for (const round of game.rounds) {
        running += round[player.id] || 0;
        points.push(running);
      }
      series[player.id] = points;
    }
  }
  return series;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all existing tests plus 4 new ones passing.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "Add computeScoreTrend for the score trend chart"
```

---

## Task 2: Trend chart CSS

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: `.trend-chart`, `.trend-axis`, `.trend-line`, `.trend-label`, `.trend-legend`, `.trend-legend-item`, `.trend-legend-dot`. Consumed by Task 3.

- [ ] **Step 1: Append the new rules**

Append to the end of `css/styles.css`:

```css
.trend-chart {
  width: 100%;
  height: auto;
  margin: 0.5rem 0;
}
.trend-axis {
  stroke: var(--border);
  stroke-width: 1;
}
.trend-line {
  fill: none;
  stroke-width: 2;
}
.trend-label {
  font-size: 8px;
  fill: var(--fg);
}
.trend-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.5rem 0;
}
.trend-legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--fg);
}
.trend-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
```

- [ ] **Step 2: Verify**

Run: `python3 -c "s=open('css/styles.css').read(); assert s.count('{')==s.count('}'), 'unbalanced'; print('OK,', s.count('{'), 'rules')"`
Run: `grep -c '^\.trend-chart {' css/styles.css` — expect `1`

Then serve and confirm delivery: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/css/styles.css | grep -c "trend-legend"` — expect at least `2`, then stop the server.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add score trend chart CSS"
```

---

## Task 3: `renderTrendChart` and wiring into `renderSummary`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `computeScoreTrend` (Task 1, added to the top-of-file `db.js` import); `.trend-*` CSS (Task 2).
- Produces: `renderTrendChart(root, game) -> void` (module-internal, not exported). `renderSummary`'s signature is unchanged; it gains one call to this function.

- [ ] **Step 1: Add `computeScoreTrend` to the top-of-file import**

Change:

```js
import { computeRoundsTotals, getDealerId } from './db.js';
```

to:

```js
import { computeRoundsTotals, getDealerId, computeScoreTrend } from './db.js';
```

- [ ] **Step 2: Add `renderTrendChart`**

Add this function anywhere at module scope before `renderSummary` (e.g. directly above it):

```js
function renderTrendChart(root, game) {
  const trend = computeScoreTrend(game);
  const playerIds = Object.keys(trend);
  if (playerIds.length === 0) return;

  const maxLen = Math.max(...playerIds.map(id => trend[id].length));
  const allValues = playerIds.flatMap(id => trend[id]);
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  const width = 300;
  const height = 160;
  const padding = 24;

  function scaleX(i, len) {
    if (len <= 1) return padding;
    return padding + (i / (maxLen - 1 || 1)) * (width - padding * 2);
  }
  function scaleY(value) {
    return height - padding - ((value - minValue) / valueRange) * (height - padding * 2);
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'trend-chart');

  const baseline = document.createElementNS(svgNS, 'line');
  baseline.setAttribute('x1', String(padding));
  baseline.setAttribute('y1', String(height - padding));
  baseline.setAttribute('x2', String(width - padding));
  baseline.setAttribute('y2', String(height - padding));
  baseline.setAttribute('class', 'trend-axis');
  svg.appendChild(baseline);

  const showDirectLabels = playerIds.length <= 4;

  for (const player of game.players) {
    const points = trend[player.id];
    if (!points) continue;

    const pointsAttr = points.map((v, i) => `${scaleX(i, points.length)},${scaleY(v)}`).join(' ');
    const polyline = document.createElementNS(svgNS, 'polyline');
    polyline.setAttribute('points', pointsAttr);
    polyline.setAttribute('class', 'trend-line');
    polyline.setAttribute('stroke', player.color);
    svg.appendChild(polyline);

    const lastIndex = points.length - 1;
    const lastX = scaleX(lastIndex, points.length);
    const lastY = scaleY(points[lastIndex]);

    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', String(lastX));
    dot.setAttribute('cy', String(lastY));
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', player.color);
    svg.appendChild(dot);

    if (showDirectLabels) {
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(Math.min(lastX + 6, width - 4)));
      label.setAttribute('y', String(lastY));
      label.setAttribute('class', 'trend-label');
      label.textContent = player.name;
      svg.appendChild(label);
    }
  }

  root.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'trend-legend';
  for (const player of game.players) {
    if (!trend[player.id]) continue;
    const item = document.createElement('span');
    item.className = 'trend-legend-item';
    const dot = document.createElement('span');
    dot.className = 'trend-legend-dot';
    dot.style.background = player.color;
    item.appendChild(dot);
    const name = document.createElement('span');
    name.textContent = player.name;
    item.appendChild(name);
    legend.appendChild(item);
  }
  root.appendChild(legend);
}
```

Note: all text content (`player.name`) is set via `.textContent`, never `innerHTML` — matching this codebase's established XSS-safe pattern. `player.color` is only ever used as an SVG `stroke`/`fill` attribute value or a CSS `background` value, never interpolated into markup.

- [ ] **Step 3: Wire it into `renderSummary`**

Change:

```js
  const list = document.createElement('ol');
  for (const player of ranked) {
    const li = document.createElement('li');
    li.textContent = `${player.name}: ${scoresByPlayer[player.id]}`;
    list.appendChild(li);
  }
  root.appendChild(list);

  const rematchBtn = document.createElement('button');
```

to:

```js
  const list = document.createElement('ol');
  for (const player of ranked) {
    const li = document.createElement('li');
    li.textContent = `${player.name}: ${scoresByPlayer[player.id]}`;
    list.appendChild(li);
  }
  root.appendChild(list);

  renderTrendChart(root, game);

  const rematchBtn = document.createElement('button');
```

- [ ] **Step 4: Verify**

Run: `node --check js/render.js` — expect no syntax errors.
Run: `npm test` — expect all existing tests still passing (this is new DOM/SVG code, not covered by unit tests).
Run: `python3 -m http.server 8000 &`, then `curl -s http://localhost:8000/js/render.js | grep -c "renderTrendChart"` — expect at least `2` (the function definition and its call site), then stop the server.

Note in the report that full visual verification (finishing a normal-mode game and a rounds-mode game, confirming the chart renders with correct-looking lines/colors/legend/labels, and confirming a game with no scoring activity omits the chart) requires a real browser and will be done separately by the controller.

- [ ] **Step 5: Commit**

```bash
git add js/render.js
git commit -m "Add score trend chart to the Summary screen"
```

---

## Final verification

- [ ] Run `npm test` — all tests passing (4 new `js/db.js` tests added in Task 1).
- [ ] Serve via `python3 -m http.server 8000` and open in a real browser:
  - Finish a normal-mode game with 2-3 players who scored different amounts at different times — confirm the Summary screen shows a line chart below the standings, with lines colored per player, a legend, and (since ≤4 players) each line directly labeled with the player's name.
  - Finish a rounds-mode game with a few rounds entered — confirm the chart renders correctly there too, with all players' lines sharing the same round-based x-axis.
  - Confirm a game with 5+ players still shows the chart with a legend but without cluttered direct labels on every line.
  - Confirm the chart is legible and doesn't overflow the page width on a narrow mobile viewport.
