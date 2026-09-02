import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline } from '../src/pipeline/pipeline.ts';
import { createPersistentLocalStore } from '../src/storage/persistent-local-store.ts';
import { createInMemoryStorageBackend, xorEncryption } from '../src/adapters-stub/storage-stubs.ts';
import { createScriptedEventSource } from '../src/adapters-stub/scripted-event-source.ts';
import { createScriptedChoiceProvider } from '../src/adapters-stub/scripted-choice-provider.ts';
import { assertNoJudgment } from '../src/invariants/invariants.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { longSession, matureBaseline, resetEventIds } from './helpers.ts';

test('E2E: pipeline -> encrypted PersistentLocalStore -> Reflection Mirror rebuilt from disk', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 21, 0, 0);
  const script = longSession({ startAt, packageNameHash: 'hash:app', durationMs: 45 * 60_000, scrolls: 50 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('re2e');
  const clock = fixedClock(lastAt + 5_000);
  const backend = createInMemoryStorageBackend();
  const encryption = xorEncryption(0x33);
  const store = createPersistentLocalStore({ backend, encryption, clock });

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider(Array.from({ length: 20 }, () => ({ choice: 'Continue' as const })), ids, clock),
    store,
    ids,
    clock,
    getBaseline: () => matureBaseline({ now: clock.now(), timeFrame: '18:00-24:00', sessionMinutes: 12 }),
  });

  await pipeline.tick();

  // pattern observations were persisted, and the backend holds only ciphertext
  const raw = backend.raw('pattern-observations');
  assert.ok(raw.length > 0, 'expected persisted pattern observations');
  assert.ok(!raw.some((r) => new TextDecoder().decode(r).includes('ExtendedContinuousInteractionPattern')));

  // rebuild the mirror from a FRESH store over the same backend (simulates a restart)
  const reopened = createPersistentLocalStore({ backend, encryption, clock });
  const rebuilt = createPipeline({
    eventSource: createScriptedEventSource([]),
    choiceProvider: createScriptedChoiceProvider([], ids, clock),
    store: reopened,
    ids,
    clock,
  });

  const mirror = await rebuilt.reflect(startAt - 1, lastAt + 1);
  assert.doesNotThrow(() => assertNoJudgment(mirror));
  const names = mirror.observableFacts.map((f) => f.patternName);
  assert.ok(names.includes('ExtendedContinuousInteractionPattern'), `missing in ${names}`);
  assert.ok(names.includes('RepeatedDiscreteInputPattern'), `missing in ${names}`);

  // the generated reflection was persisted (encrypted) back to the local store
  assert.ok(backend.raw('reflections').length >= 1);
});
