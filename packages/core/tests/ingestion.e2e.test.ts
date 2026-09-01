import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventCollector } from '../src/ingestion/event-collector.ts';
import { RawNativeEvents } from '../src/ingestion/raw-event.ts';
import { createPipeline } from '../src/pipeline/pipeline.ts';
import { createMemoryStore } from '../src/adapters-stub/memory-store.ts';
import { createScriptedChoiceProvider } from '../src/adapters-stub/scripted-choice-provider.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

const HASH = 'sha256:Reader00_11-22334455667788990011223344556677889900';

test('E2E: raw native signals -> EventCollector -> Pipeline reaches an Awareness Window', async () => {
  const startAt = Date.UTC(2026, 0, 5, 23, 15, 0); // rest period
  const durationMs = 40 * 60_000;
  const scrolls = 40;
  const gap = durationMs / scrolls;

  // A real adapter would push these across the bridge; here we build them by hand.
  const raws = [
    RawNativeEvents.screen('Unlocked', startAt),
    RawNativeEvents.screen('Unlocked', startAt + 60), // sensor bounce — must be de-bounced
    RawNativeEvents.application('Foreground', HASH, startAt + 100),
  ];
  const actions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  for (let i = 1; i <= scrolls; i++) {
    raws.push(RawNativeEvents.explicitInput(actions[(i - 1) % actions.length]!, Math.round(startAt + 100 + i * gap)));
  }

  const lastAt = raws[raws.length - 1]!.occurredAt;
  const ids = sequentialIdFactory('ing');
  const clock = fixedClock(lastAt + 1_000);

  const collector = createEventCollector({ ids, clock });
  const summary = collector.ingestRaw(raws);
  assert.equal(summary.deduped, 1, 'the duplicate Unlock should be de-bounced');
  assert.equal(summary.accepted, raws.length - 1);

  const pipeline = createPipeline({
    eventSource: collector, // the collector IS the EventSource
    choiceProvider: createScriptedChoiceProvider([{ choice: 'Exit' }], ids, clock),
    store: createMemoryStore(),
    ids,
    clock,
    config: { context: { restPeriods: { windows: [{ startHour: 23, endHour: 7 }] } } },
  });

  const outcomes = await pipeline.tick();
  assert.equal(outcomes.length, raws.length - 1);

  const extendedExit = outcomes.find(
    (o) => o.kind === 'Choice' && o.pattern.structuralName === 'ExtendedContinuousInteractionPattern',
  );
  assert.ok(extendedExit, 'pipeline should open an Awareness Window for the extended session');
  if (extendedExit && extendedExit.kind === 'Choice') {
    assert.equal(extendedExit.decision.decision, 'Intervene');
    assert.deepEqual(extendedExit.returnMoment, { text: 'You are here', hapticBeats: 1, autoDismissMs: 2_000 });
  }

  assert.equal(collector.pendingCount(), 0);
});
