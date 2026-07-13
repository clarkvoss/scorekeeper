import { createDb, deleteGame, createGame, addPlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, savePlayerList, finishGame, renameGame, setDealer, advanceDealer } from './db.js';
import { loadDb, saveDb } from './storage.js';
import { renderHome, renderNewGame, renderActiveGameNormal, renderActiveGameRounds, renderSummary, renderAddPoints } from './render.js';

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
  goActiveGame: (gameId) => { location.hash = `#/game/${gameId}`; },
  goAddPoints: (gameId, playerId) => { location.hash = `#/game/${gameId}/player/${playerId}`; },
  deleteGame: (gameId) => {
    deleteGame(db, gameId);
    persist();
    route();
  },
  renameGame: (gameId, newName) => {
    renameGame(findGame(gameId), newName);
    persist();
    route();
  },
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
  startGame: (name, mode, draftPlayers) => {
    const game = createGame(db, name, mode);
    for (const p of draftPlayers) {
      addPlayer(game, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${game.id}`;
  },
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
  finishGame: (gameId) => {
    finishGame(findGame(gameId));
    persist();
    location.hash = `#/game/${gameId}/summary`;
  },
  rematch: (gameId) => {
    const oldGame = findGame(gameId);
    const newGame = createGame(db, oldGame.name, oldGame.mode);
    for (const p of oldGame.players) {
      addPlayer(newGame, p.name, p.color);
    }
    persist();
    location.hash = `#/game/${newGame.id}`;
  },
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
  savePlayerList: (name, players) => {
    savePlayerList(db, name, players);
    persist();
    route();
  },
};

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
  const summaryMatch = hash.match(/^#\/game\/([^/]+)\/summary$/);
  if (summaryMatch) {
    const game = findGame(summaryMatch[1]);
    if (game) {
      renderSummary(root, game, actions);
      return;
    }
  }
  const addPointsMatch = hash.match(/^#\/game\/([^/]+)\/player\/([^/]+)$/);
  if (addPointsMatch) {
    const game = findGame(addPointsMatch[1]);
    const player = game && game.players.find(p => p.id === addPointsMatch[2]);
    if (game && player && game.mode === 'normal') {
      renderAddPoints(root, game, player, actions);
      return;
    }
  }
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
  renderHome(root, db, actions);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);
route();
