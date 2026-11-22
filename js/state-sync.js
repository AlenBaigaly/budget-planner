/** Versioned record-level merge helpers for Firebase sync. */
export const CLOUD_SCHEMA_VERSION = 3;
export const ENTITY_COLLECTIONS = ['accounts', 'categories', 'transactions', 'recurring', 'goals', 'closedDeposits'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const isoNow = () => new Date().toISOString();
const timestamp = (value) => Date.parse(value || 0) || 0;

function withoutSyncFields(record) {
  const copy = clone(record || {});
  delete copy.updatedAt;
  return copy;
}

function isSameRecord(a, b) {
  return JSON.stringify(withoutSyncFields(a)) === JSON.stringify(withoutSyncFields(b));
}

export function ensureSyncSchema(rawState, fallbackTime = isoNow()) {
  const state = clone(rawState || {});
  state._sync = { schemaVersion: CLOUD_SCHEMA_VERSION, updatedAt: state._sync?.updatedAt || state.lastUpdated || fallbackTime };
  state.tombstones = Array.isArray(state.tombstones) ? state.tombstones : [];
  ENTITY_COLLECTIONS.forEach((collection) => {
    state[collection] = Array.isArray(state[collection]) ? state[collection] : [];
    state[collection] = state[collection].map((record) => ({ ...record, updatedAt: record.updatedAt || state.lastUpdated || fallbackTime }));
  });
  return state;
}

/** Applies timestamps only to records changed since the last confirmed snapshot. */
export function prepareLocalStateForSave(currentState, previousState, now = isoNow()) {
  const current = ensureSyncSchema(currentState, now);
  const previous = ensureSyncSchema(previousState || {}, now);
  ENTITY_COLLECTIONS.forEach((collection) => {
    const oldById = new Map(previous[collection].map((record) => [record.id, record]));
    const currentIds = new Set();
    current[collection] = current[collection].map((record) => {
      currentIds.add(record.id);
      const oldRecord = oldById.get(record.id);
      return !oldRecord || !isSameRecord(record, oldRecord) ? { ...record, updatedAt: now } : record;
    });
    previous[collection].forEach((record) => {
      if (!currentIds.has(record.id) && !current.tombstones.some((item) => item.collection === collection && item.id === record.id)) {
        current.tombstones.push({ collection, id: record.id, deletedAt: now });
      }
    });
  });
  current._sync = { schemaVersion: CLOUD_SCHEMA_VERSION, updatedAt: now };
  return current;
}

function latestTombstones(tombstones) {
  const output = new Map();
  tombstones.forEach((item) => {
    if (!item?.collection || !item?.id || !item?.deletedAt) return;
    const key = `${item.collection}:${item.id}`;
    if (!output.has(key) || timestamp(output.get(key).deletedAt) < timestamp(item.deletedAt)) output.set(key, item);
  });
  return output;
}

function mergeCollection(local, remote, collection, tombstones) {
  const byId = new Map();
  [...local[collection], ...remote[collection]].forEach((record) => {
    if (!record?.id) return;
    const previous = byId.get(record.id);
    if (!previous || timestamp(record.updatedAt) > timestamp(previous.updatedAt)) byId.set(record.id, record);
  });
  return [...byId.values()].filter((record) => {
    const tombstone = tombstones.get(`${collection}:${record.id}`);
    return !tombstone || timestamp(tombstone.deletedAt) < timestamp(record.updatedAt);
  });
}

export function mergeStates(localState, remoteState, now = isoNow()) {
  const local = ensureSyncSchema(localState, now);
  const remote = ensureSyncSchema(remoteState, now);
  const base = clone(timestamp(remote._sync.updatedAt) > timestamp(local._sync.updatedAt) ? remote : local);
  const tombstones = latestTombstones([...local.tombstones, ...remote.tombstones]);
  ENTITY_COLLECTIONS.forEach((collection) => { base[collection] = mergeCollection(local, remote, collection, tombstones); });
  base.tombstones = [...tombstones.values()].filter((item) => timestamp(item.deletedAt) > Date.now() - 180 * 24 * 60 * 60 * 1000);
  base._sync = { schemaVersion: CLOUD_SCHEMA_VERSION, updatedAt: now };
  return base;
}
