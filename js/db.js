import { nextColor } from './colors.js';
import { nextEmoji } from './emojis.js';

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
    rounds: [],
    finished: false,
    dealerId: null
  };
  db.games.push(game);
  return game;
}

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

export function removePlayer(game, playerId) {
  game.players = game.players.filter(p => p.id !== playerId);
  delete game.scores[playerId];
  game.history = game.history.filter(h => h.playerId !== playerId);
  for (const round of game.rounds) {
    delete round[playerId];
  }
  game.updatedAt = Date.now();
}

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

export function finishGame(game) {
  game.finished = true;
  game.updatedAt = Date.now();
}

export function renameGame(game, newName) {
  game.name = newName;
  game.updatedAt = Date.now();
}

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
