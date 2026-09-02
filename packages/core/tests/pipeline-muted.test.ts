import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline } from '../src/pipeline/pipeline.ts';
import { createPersistentLocalStore } from '../src/storage/persistent-local-store.ts';
import { createInMemoryStorageBackend, xorEncryption } from '../src/adapters-stub/storage-stubs.ts';
import { createScriptedEventSource } from '../src/adapters-stub/scripted-event-source.ts';
import { createScriptedChoiceProvider } from '../src/adapters-stub/scripted-choice-provider.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { longSession, matureBaseline, resetEventIds } from './helpers.ts';

test('I-01: with interventionsEnabled=false, a would-be Choice becomes Muted (still observed & recorded)', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 21, 0, 0);
  const script = longSession({ startAt, packageNameHash: 'hash:app', durationMs: 45 * 60_000, scrolls: 50 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('mute');
  const clock = fixedClock(lastAt + 5_000);
  const store = createPersistentLocalStore({
    backend: createInMemoryStorageBackend(),
    encryption: xorEncryption(),
    clock,
  });

  const provider = createScriptedChoiceProvider(Array.from({ length: 20 }, () => ({ choice: 'Exit' as const })), ids, clock);
  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: provider,
    store,
    ids,
    clock,
    getBaseline: () => matureBaseline({ now: clock.now(), timeFrame: '18:00-24:00', sessionMinutes: 12 }),
    config: { interventionsEnabled: false },
  });

  const outcomes = await pipeline.tick();

  assert.ok(outcomes.some((o) => o.kind === 'Muted'), 'expected at least one Muted outcome');
  assert.ok(!outcomes.some((o) => o.kind === 'Choice'), 'no Awareness Window should be rendered');
  assert.equal(provider.calls(), 0, 'the ChoiceProvider is never invoked');

  const muted = outcomes.find((o) => o.kind === 'Muted');
  if (muted && muted.kind === 'Muted') {
    assert.equal(muted.decision.decision, 'Intervene'); // the engine still decided
  }

  // the Reflection mirror is unaffected — structure was still recorded
  const mirror = await pipeline.reflect(startAt - 1, lastAt + 1);
  assert.ok(mirror.observableFacts.length >= 1);
});

test('store.wipe() erases every log', async () => {
  const backend = createInMemoryStorageBackend();
  const store = createPersistentLocalStore({ backend, encryption: xorEncryption(), clock: fixedClock(1_000_000) });
  await store.appendEvent({
    id: 'e1', occurredAt: 1000, type: 'ScreenStateChanged',
    source: { type: 'System', id: 'os' }, subject: { type: 'Screen' },
    payload: { state: 'Unlocked' }, schemaVersion: '1.0.0',
  });
  assert.equal((await store.readEvents(0, 2000)).length, 1);

  await store.wipe();
  assert.equal((await store.readEvents(0, 2000)).length, 0);
  assert.equal(backend.size('events'), 0);
});
