/**
 * AQSHA local persistence.
 *
 * Financial records live in IndexedDB. localStorage is intentionally not used
 * as a live database: it only contains the legacy v1 key during migration so a
 * user can recover their previous data. The module has no network access.
 */

export const DATA_SCHEMA_VERSION = 2;
export const LOCAL_DB_NAME = 'aqsha-budget';
export const LEGACY_STATE_KEY = 'budget_planner_state_v1';
export const LEGACY_FALLBACK_KEY = 'aqsha_budget_state_v2';
export const LEGACY_BACKUP_KEY = 'aqsha_legacy_state_backup_v1';

const DB_VERSION = 1;
const STATE_STORE = 'state';
const BACKUP_STORE = 'backups';
const CURRENT_STATE_ID = 'current';
let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('Ваш браузер не поддерживает IndexedDB'));
    const request = indexedDB.open(LOCAL_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Не удалось открыть IndexedDB'));
  });
  return dbPromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ошибка IndexedDB'));
  });
}

async function read(storeName, id) {
  const db = await openDatabase();
  return requestAsPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(id));
}

async function write(storeName, value) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');
  await requestAsPromise(transaction.objectStore(storeName).put(value));
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Не удалось сохранить данные'));
    transaction.onabort = () => reject(transaction.error || new Error('Сохранение отменено'));
  });
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function readLegacyState() {
  for (const key of [LEGACY_STATE_KEY, LEGACY_FALLBACK_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { key, raw, state: JSON.parse(raw) };
    } catch (error) {
      console.warn('Не удалось прочитать старое локальное состояние:', error);
    }
  }
  return null;
}

/** Copies legacy records safely before switching the primary store to IndexedDB. */
export async function initializeStateStorage({ normalizeState, initialState }) {
  const existing = await read(STATE_STORE, CURRENT_STATE_ID);
  if (existing?.data) return { state: normalizeState(existing.data), source: 'indexeddb', migrated: false };

  const legacy = readLegacyState();
  const baseState = legacy?.state || deepCopy(initialState);
  const normalized = normalizeState(baseState);
  const now = new Date().toISOString();

  if (legacy) {
    if (!localStorage.getItem(LEGACY_BACKUP_KEY)) localStorage.setItem(LEGACY_BACKUP_KEY, legacy.raw);
    await write(BACKUP_STORE, {
      id: `legacy-v1-${Date.now()}`,
      reason: `Миграция из ${legacy.key}`,
      createdAt: now,
      schemaVersion: 1,
      data: deepCopy(legacy.state)
    });
  }

  await write(STATE_STORE, {
    id: CURRENT_STATE_ID,
    schemaVersion: DATA_SCHEMA_VERSION,
    updatedAt: now,
    data: normalized
  });
  return { state: normalized, source: legacy ? 'legacy-localStorage' : 'new', migrated: Boolean(legacy) };
}

export async function saveStateToIndexedDB(state, { updatedAt = new Date().toISOString() } = {}) {
  await write(STATE_STORE, {
    id: CURRENT_STATE_ID,
    schemaVersion: DATA_SCHEMA_VERSION,
    updatedAt,
    data: deepCopy(state)
  });
}

export async function saveBackupSnapshot(state, reason) {
  await write(BACKUP_STORE, {
    id: `snapshot-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    schemaVersion: DATA_SCHEMA_VERSION,
    data: deepCopy(state)
  });
}

export async function getLocalStorageStatus() {
  const record = await read(STATE_STORE, CURRENT_STATE_ID);
  return record ? { schemaVersion: record.schemaVersion, updatedAt: record.updatedAt } : null;
}
