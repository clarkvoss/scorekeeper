const STORAGE_KEY = 'scorekeeper-db';

export function loadDb(storage, createDb) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { db: createDb(), error: null };
    return { db: JSON.parse(raw), error: null };
  } catch (err) {
    return { db: createDb(), error: err };
  }
}

export function saveDb(db, storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(db));
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}
