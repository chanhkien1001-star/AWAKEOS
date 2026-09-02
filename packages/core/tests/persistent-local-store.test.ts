import test from 'node:test';
import assert from 'node:assert/strict';

import type { Event, HumanChoice, ReflectionMirror } from '../src/index.ts';
import type { PatternObservation } from '../src/engines/reflection-mirror.ts';
import type { InterventionRecord } from '../src/pipeline/ports.ts';
import { createPersistentLocalStore } from '../src/storage/persistent-local-store.ts';
import { createInMemoryStorageBackend, xorEncryption } from '../src/adapters-stub/storage-stubs.ts';
import { fixedClock } from '../src/util/clock.ts';

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0);
const DAY = 24 * 60 * 60_000;

const evt = (occurredAt: number): Event => ({
  id: `e-${occurredAt}`,
  occurredAt,
  type: 'ScreenStateChanged',
  source: { type: 'System', id: 'os' },
  subject: { type: 'Screen' },
  payload: { state: 'Unlocked' },
  schemaVersion: '1.0.0',
});
const rec = (triggeredAt: number): InterventionRecord => ({
  interventionId: `i-${triggeredAt}`,
  candidateId: 'c',
  patternId: 'p',
  awarenessWindowId: 'w',
  category: 'ExtendedDuration',
  triggeredAt,
  choice: 'Continue',
});
const observation = (observedAt: number): PatternObservation => ({
  patternId: `p-${observedAt}`,
  observedAt,
  category: 'ExtendedDuration',
  structuralName: 'ExtendedContinuousInteractionPattern',
  deviationFromBaselineRatio: 2,
  timeFrame: '12:00-18:00',
  dayOfWeek: 1,
  isUserDefinedRestPeriod: false,
});
const mirror = (generatedAt: number): ReflectionMirror => ({
  id: `m-${generatedAt}`,
  generatedAt,
  timeRangeStart: generatedAt - DAY,
  timeRangeEnd: generatedAt,
  observableFacts: [],
});

test('round-trips every record type through backend + encryption', async () => {
  const backend = createInMemoryStorageBackend();
  const store = createPersistentLocalStore({ backend, encryption: xorEncryption(), clock: fixedClock(NOW) });

  await store.appendEvent(evt(NOW - 5_000));
  await store.appendChoice({ id: 'h1', awarenessWindowId: 'w', selectedAt: NOW - 4_000, choice: 'Exit' } satisfies HumanChoice);
  await store.appendInterventionRecord(rec(NOW - 3_000));
  await store.appendPatternObservation(observation(NOW - 2_000));
  await store.saveReflection(mirror(NOW - 1_000));

  assert.equal((await store.readEvents(NOW - 60_000, NOW)).length, 1);
  assert.equal((await store.readChoices(NOW - 60_000, NOW)).length, 1);
  assert.equal((await store.readInterventionRecords(NOW - 60_000, NOW)).length, 1);
  assert.equal((await store.readPatternObservations(NOW - 60_000, NOW)).length, 1);
});

test('the backend holds ciphertext, not plaintext', async () => {
  const backend = createInMemoryStorageBackend();
  const store = createPersistentLocalStore({ backend, encryption: xorEncryption(0x5a), clock: fixedClock(NOW) });
  await store.appendEvent(evt(NOW - 1_000));

  const [raw] = backend.raw('events');
  const asText = new TextDecoder().decode(raw);
  assert.ok(!asText.includes('ScreenStateChanged'), 'plaintext leaked into the backend');
  assert.ok(!asText.includes('Unlocked'));
});

test('state survives a "restart" — a new store over the same backend reads it back', async () => {
  const backend = createInMemoryStorageBackend();
  const enc = xorEncryption();
  const first = createPersistentLocalStore({ backend, encryption: enc, clock: fixedClock(NOW) });
  await first.appendEvent(evt(NOW - 2_000));
  await first.appendEvent(evt(NOW - 1_000));

  const second = createPersistentLocalStore({ backend, encryption: enc, clock: fixedClock(NOW) });
  const events = await second.readEvents(NOW - 60_000, NOW);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.occurredAt), [NOW - 2_000, NOW - 1_000]);
});

test('time-range reads are half-open and ordered oldest-first', async () => {
  const backend = createInMemoryStorageBackend();
  const store = createPersistentLocalStore({ backend, encryption: xorEncryption(), clock: fixedClock(NOW) });
  for (const t of [NOW - 300, NOW - 100, NOW - 200]) await store.appendEvent(evt(t));

  const got = await store.readEvents(NOW - 250, NOW - 50);
  assert.deepEqual(got.map((e) => e.occurredAt), [NOW - 200, NOW - 100]);
});

test('prune() drops raw events past retention but keeps reflections longest', async () => {
  const backend = createInMemoryStorageBackend();
  const store = createPersistentLocalStore({
    backend,
    encryption: xorEncryption(),
    clock: fixedClock(NOW),
    retention: { rawEventsMs: 7 * DAY, reflectionsMs: 400 * DAY },
  });

  await store.appendEvent(evt(NOW - 40 * DAY)); // stale
  await store.appendEvent(evt(NOW - 1 * DAY)); // fresh
  await store.saveReflection(mirror(NOW - 90 * DAY)); // old but within reflection retention

  const summary = await store.prune();
  assert.equal(summary.removed['events'], 1);
  assert.equal(summary.removed['reflections'] ?? 0, 0);

  assert.equal((await store.readEvents(0, NOW + 1)).length, 1);
  // and the backend was actually rewritten, not just the cache
  const reloaded = createPersistentLocalStore({ backend, encryption: xorEncryption(), clock: fixedClock(NOW) });
  assert.equal((await reloaded.readEvents(0, NOW + 1)).length, 1);
});
