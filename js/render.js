import { computeRoundsTotals } from './db.js';

function showScoreModal(playerName, currentValue, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const label = document.createElement('label');
  label.className = 'modal-label';
  label.textContent = 'Set score for ' + playerName;
  modal.appendChild(label);

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.value = String(currentValue);
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
    const value = Number(input.value);
    if (!Number.isFinite(value)) { close(); return; }
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

export function renderHome(root, db, actions) {
  root.innerHTML = '';

  renderHeader(root, { title: 'Scorekeeper' });

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

function playerRoundInfo(game, playerId) {
  const entries = game.history.filter(h => h.playerId === playerId);
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { round: entries.length, last: last.delta };
}

export function renderActiveGameNormal(root, game, actions) {
  root.innerHTML = '';

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

  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.disabled = game.history.length === 0;
  undoBtn.addEventListener('click', () => actions.undo(game.id));
  root.appendChild(undoBtn);

  const rowsContainer = document.createElement('div');
  root.appendChild(rowsContainer);

  function renderRows() {
    rowsContainer.innerHTML = '';
    let players = game.players;
    if (sortMode === 'desc') {
      players = [...game.players].sort((a, b) => game.scores[b.id] - game.scores[a.id]);
    } else if (sortMode === 'asc') {
      players = [...game.players].sort((a, b) => game.scores[a.id] - game.scores[b.id]);
    }

    for (const player of players) {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.style.borderLeftColor = player.color;

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
        showScoreModal(player.name, game.scores[player.id], (value) => {
          actions.setScore(game.id, player.id, value);
        });
      });
      row.appendChild(scoreBtn);

      const plusBtn = document.createElement('button');
      plusBtn.className = 'score-btn score-btn-plus';
      plusBtn.textContent = '+';
      plusBtn.setAttribute('aria-label', 'Increase score');
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

export function renderActiveGameRounds(root, game, actions) {
  root.innerHTML = '';

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

  const table = document.createElement('table');
  table.className = 'rounds-table';

  const headRow = document.createElement('tr');
  const roundTh = document.createElement('th');
  roundTh.textContent = 'Round';
  headRow.appendChild(roundTh);
  for (const p of game.players) {
    const th = document.createElement('th');
    th.textContent = p.name;
    headRow.appendChild(th);
  }
  headRow.appendChild(document.createElement('th'));
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

export function renderSummary(root, game, actions) {
  root.innerHTML = '';

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
