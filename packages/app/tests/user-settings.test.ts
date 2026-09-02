import test from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryStorageBackend, xorEncryption } from '@awake-os/core';
import {
  DEFAULT_USER_SETTINGS,
  createSettingsStore,
  mapSettingsToRuntimeConfig,
} from '../src/settings/user-settings.ts';

function store() {
  return createSettingsStore({ backend: createInMemoryStorageBackend(), encryption: xorEncryption() });
}

test('read() returns defaults when nothing is stored', async () => {
  assert.deepEqual(await store().read(), DEFAULT_USER_SETTINGS);
});

test('update() merges and persists; a fresh store over the same backend sees it', async () => {
  const backend = createInMemoryStorageBackend();
  const enc = xorEncryption();
  const a = createSettingsStore({ backend, encryption: enc });
  await a.update({ onboardingComplete: true, interventionsEnabled: false });

  const b = createSettingsStore({ backend, encryption: enc });
  const s = await b.read();
  assert.equal(s.onboardingComplete, true);
  assert.equal(s.interventionsEnabled, false);
  assert.deepEqual(s.restPeriods, DEFAULT_USER_SETTINGS.restPeriods); // untouched
});

test('reset() returns to defaults', async () => {
  const s = store();
  await s.update({ onboardingComplete: true });
  assert.equal((await s.reset()).onboardingComplete, false);
});

test('a stored blob missing a new field is coerced onto defaults', async () => {
  const backend = createInMemoryStorageBackend();
  const enc = xorEncryption();
  // simulate an older settings blob
  const old = JSON.stringify({ onboardingComplete: true, restPeriods: [{ startHour: 22, endHour: 6 }] });
  await backend.rewrite('user-settings', [await enc.encrypt(new TextEncoder().encode(old))]);

  const s = await createSettingsStore({ backend, encryption: enc }).read();
  assert.equal(s.onboardingComplete, true);
  assert.deepEqual(s.restPeriods, [{ startHour: 22, endHour: 6 }]);
  assert.equal(s.interventionsEnabled, true); // default filled in
  assert.equal(s.observedApps.mode, 'all');
});

test('mapSettingsToRuntimeConfig turns settings into pipeline + retention config', () => {
  const cfg = mapSettingsToRuntimeConfig({
    ...DEFAULT_USER_SETTINGS,
    interventionsEnabled: false,
    restPeriods: [{ startHour: 0, endHour: 6 }, { startHour: 22, endHour: 24 }],
    retentionDays: { ...DEFAULT_USER_SETTINGS.retentionDays, rawEvents: 7 },
  });
  assert.equal(cfg.pipeline.interventionsEnabled, false);
  assert.deepEqual(cfg.pipeline.context?.restPeriods?.windows, [
    { startHour: 0, endHour: 6 },
    { startHour: 22, endHour: 24 },
  ]);
  assert.equal(cfg.retention.rawEventsMs, 7 * 24 * 60 * 60_000);
});
