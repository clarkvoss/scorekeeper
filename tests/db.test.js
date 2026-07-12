import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb, createGame, addPlayer, removePlayer, adjustScore, setScore, undo, addRound, setRoundScore, deleteRound, computeRoundsTotals, deleteGame, savePlayerList, finishGame } from '../js/db.js';

test('createDb returns an empty db with default settings', () => {
  const db = createDb();
  assert.deepEqual(db.games, []);
  assert.deepEqual(db.savedPlayerLists, []);
  assert.equal(db.settings.theme, 'auto');
});

test('createGame adds a game to db.games with expected shape', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(db.games.length, 1);
  assert.equal(game.name, 'Poker Night');
  assert.equal(game.mode, 'normal');
  assert.deepEqual(game.players, []);
  assert.deepEqual(game.scores, {});
  assert.deepEqual(game.history, []);
  assert.deepEqual(game.rounds, []);
  assert.ok(game.id);
  assert.ok(game.createdAt);
});

test('addPlayer assigns a round-robin color and initializes score in normal mode', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const p2 = addPlayer(game, 'Bob');
  assert.equal(game.players.length, 2);
  assert.notEqual(p1.color, p2.color);
  assert.equal(game.scores[p1.id], 0);
  assert.equal(game.scores[p2.id], 0);
});

test('addPlayer respects an explicit color override', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice', '#123456');
  assert.equal(p1.color, '#123456');
});

test('addPlayer in rounds mode does not initialize game.scores', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  assert.equal(game.scores[p1.id], undefined);
});

test('removePlayer deletes the player and their score/history entries', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  game.scores[p1.id] = 5;
  game.history.push({ playerId: p1.id, delta: 5, timestamp: Date.now() });
  removePlayer(game, p1.id);
  assert.equal(game.players.length, 0);
  assert.equal(game.scores[p1.id], undefined);
  assert.equal(game.history.length, 0);
});

test('adjustScore applies a delta and records history', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  const newScore = adjustScore(game, p1.id, 5);
  assert.equal(newScore, 5);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].delta, 5);
  assert.equal(game.history[0].playerId, p1.id);
});

test('setScore computes and applies the correct delta', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 5);
  setScore(game, p1.id, 20);
  assert.equal(game.scores[p1.id], 20);
  assert.equal(game.history.at(-1).delta, 15);
});

test('undo reverses the most recent history entry', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const p1 = addPlayer(game, 'Alice');
  adjustScore(game, p1.id, 5);
  adjustScore(game, p1.id, 3);
  const undone = undo(game);
  assert.equal(undone.delta, 3);
  assert.equal(game.scores[p1.id], 5);
  assert.equal(game.history.length, 1);
});

test('undo returns null when history is empty', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(undo(game), null);
});

test('addRound, setRoundScore, and computeRoundsTotals track per-round scores', () => {
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
  assert.equal(game.rounds.length, 2);
  const totals = computeRoundsTotals(game);
  assert.equal(totals[p1.id], 13);
  assert.equal(totals[p2.id], 15);
});

test('computeRoundsTotals returns 0 for players with no rounds yet', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  const totals = computeRoundsTotals(game);
  assert.equal(totals[p1.id], 0);
});

test('deleteRound removes a round from the rounds list', () => {
  const db = createDb();
  const game = createGame(db, 'Cards', 'rounds');
  const p1 = addPlayer(game, 'Alice');
  const r0 = addRound(game);
  setRoundScore(game, r0, p1.id, 10);
  addRound(game);
  deleteRound(game, 0);
  assert.equal(game.rounds.length, 1);
  assert.equal(computeRoundsTotals(game)[p1.id], 0);
});

test('deleteGame removes a game from db.games', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  createGame(db, 'Other Game', 'normal');
  deleteGame(db, game.id);
  assert.equal(db.games.length, 1);
  assert.equal(db.games[0].name, 'Other Game');
});

test('savePlayerList stores a reusable list of player names/colors', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  addPlayer(game, 'Alice', '#e63946');
  addPlayer(game, 'Bob', '#f4a261');
  savePlayerList(db, 'Regulars', game.players);
  assert.equal(db.savedPlayerLists.length, 1);
  assert.equal(db.savedPlayerLists[0].name, 'Regulars');
  assert.equal(db.savedPlayerLists[0].players.length, 2);
  assert.equal(db.savedPlayerLists[0].players[0].name, 'Alice');
  assert.equal(db.savedPlayerLists[0].players[0].color, '#e63946');
});

test('createGame defaults finished to false', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  assert.equal(game.finished, false);
});

test('finishGame marks a game as finished and bumps updatedAt', () => {
  const db = createDb();
  const game = createGame(db, 'Poker Night', 'normal');
  const before = game.updatedAt;
  finishGame(game);
  assert.equal(game.finished, true);
  assert.ok(game.updatedAt >= before);
});
