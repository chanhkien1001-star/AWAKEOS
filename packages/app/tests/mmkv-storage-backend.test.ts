import test from 'node:test';
import assert from 'node:assert/strict';

import { createPersistentLocalStore, xorEncryption, type Event } from '@awake-os/core';
import { createMmkvStorageBackend, type MmkvLike } from '../src/storage/mmkv-storage-backend.ts';

function fakeMmkv(): MmkvLike & { _keys(): string[] } {
  const map = new Map<string, string>();
  return {
    getString: (k) => map.get(k),
    set: (k, v) => void map.set(k, v),
    delete: (k) => void map.delete(k),
    _keys: () => [...map.keys()],
  };
}

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const evt = (occurredAt: number): Event => ({
  id: `e-${occurredAt}`,
  occurredAt,
  type: 'ScreenStateChanged',
  source: { type: 'System', id: 'os' },
  subject: { type: 'Screen' },
  payload: { state: 'Unlocked' },
  schemaVersion: '1.0.0',
});

test('append / readAll / rewrite round-trip through the MMKV shape', async () => {
  const backend = createMmkvStorageBackend(fakeMmkv());
  await backend.append('events', Uint8Array.from([1, 2, 3]));
  await backend.append('events', Uint8Array.from([4, 5]));
  const all = await backend.readAll('events');
  assert.deepEqual(all.map((r) => Array.from(r)), [[1, 2, 3], [4, 5]]);

  await backend.rewrite('events', [Uint8Array.from([9])]);
  assert.deepEqual((await backend.readAll('events')).map((r) => Array.from(r)), [[9]]);
});

test('drives a full PersistentLocalStore end to end', async () => {
  const mmkv = fakeMmkv();
  const backend = createMmkvStorageBackend(mmkv);
  const store = createPersistentLocalStore({ backend, encryption: xorEncryption(), clock: { now: () => NOW } });

  await store.appendEvent(evt(NOW - 2_000));
  await store.appendEvent(evt(NOW - 1_000));

  // a fresh store over the same MMKV reads it back
  const reopened = createPersistentLocalStore({
    backend: createMmkvStorageBackend(mmkv),
    encryption: xorEncryption(),
    clock: { now: () => NOW },
  });
  const events = await reopened.readEvents(NOW - 60_000, NOW);
  assert.equal(events.length, 2);
  assert.ok(mmkv._keys().every((k) => k.startsWith('awake:store:')));
});
