import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDb, saveDb } from '../js/storage.js';
import { createDb } from '../js/db.js';

function makeFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    _data: data
  };
}

test('loadDb returns a fresh db when nothing is stored', () => {
  const storage = makeFakeStorage();
  const { db, error } = loadDb(storage, createDb);
  assert.equal(error, null);
  assert.deepEqual(db.games, []);
});

test('loadDb parses a previously saved db', () => {
  const saved = JSON.stringify({ games: [{ id: 'x' }], savedPlayerLists: [], settings: { theme: 'auto' } });
  const storage = makeFakeStorage({ 'scorekeeper-db': saved });
  const { db, error } = loadDb(storage, createDb);
  assert.equal(error, null);
  assert.equal(db.games[0].id, 'x');
});

test('loadDb falls back to a fresh db on corrupt JSON', () => {
  const storage = makeFakeStorage({ 'scorekeeper-db': '{not valid json' });
  const { db, error } = loadDb(storage, createDb);
  assert.notEqual(error, null);
  assert.deepEqual(db.games, []);
});

test('saveDb writes JSON to storage', () => {
  const storage = makeFakeStorage();
  const db = createDb();
  const result = saveDb(db, storage);
  assert.equal(result.ok, true);
  assert.equal(storage._data['scorekeeper-db'], JSON.stringify(db));
});

test('saveDb reports failure when storage.setItem throws', () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); }
  };
  const result = saveDb(createDb(), storage);
  assert.equal(result.ok, false);
  assert.notEqual(result.error, null);
});
