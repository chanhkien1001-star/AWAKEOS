import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline } from '../src/pipeline/pipeline.ts';
import { createMemoryStore } from '../src/adapters-stub/memory-store.ts';
import { createScriptedEventSource } from '../src/adapters-stub/scripted-event-source.ts';
import { createScriptedChoiceProvider } from '../src/adapters-stub/scripted-choice-provider.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { fixedClock } from '../src/util/clock.ts';
import { assertNoJudgment } from '../src/invariants/invariants.ts';

import { longSession, rapidSwitching, resetEventIds } from './helpers.ts';

const REST_PERIODS = { windows: [{ startHour: 23, endHour: 7 }] };

test('E2E: EVENT -> CONTEXT -> PATTERN -> CANDIDATE -> POLICY -> INTERVENTION -> CHOICE -> REFLECTION', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 23, 0, 0); // Monday 23:00 UTC — inside the user's rest period
  const script = longSession({ startAt, packageNameHash: 'hash:app-A', durationMs: 40 * 60_000, scrolls: 60 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('e2e');
  const clock = fixedClock(lastAt + 5_000);
  const store = createMemoryStore();

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider(Array.from({ length: 30 }, () => ({ choice: 'Exit' as const })), ids, clock),
    store,
    ids,
    clock,
    config: { context: { restPeriods: REST_PERIODS } },
  });

  const outcomes = await pipeline.tick();

  // one outcome per event, in order
  assert.equal(outcomes.length, script.length);
  assert.equal(outcomes[0]?.kind, 'NoPattern'); // first event can't form a pattern

  // the pipeline reached a real Awareness Window + human choice
  const choices = outcomes.filter((o) => o.kind === 'Choice');
  assert.ok(choices.length >= 1, 'expected at least one Choice outcome');
  const firstChoice = choices[0]!;
  if (firstChoice.kind === 'Choice') {
    assert.equal(firstChoice.decision.decision, 'Intervene');
    assert.equal(firstChoice.decision.decisionReason, 'HighSalienceThresholdMet');
    assert.match(firstChoice.intervention.payloadText, /^Awareness Window\./);
    assert.equal(firstChoice.choice.choice, 'Exit');
  }

  // I-04 + I-05: once the system has spoken a few times, fatigue takes it back to Silence
  const fatigueSilence = outcomes.find(
    (o) => o.kind === 'Silence' && o.decision.decisionReason === 'InterventionFatigue',
  );
  assert.ok(fatigueSilence, 'expected Intervention Fatigue to force Silence after repeated interventions');

  // I-09: every observed event was persisted locally
  assert.equal(store._events.length, script.length);

  // Stage 8 — REFLECTION mirror surfaces every structural pattern seen, not just
  // the one the policy engine acted on.
  const mirror = await pipeline.reflect(startAt - 1, lastAt + 1);
  assert.doesNotThrow(() => assertNoJudgment(mirror)); // I-07
  const names = mirror.observableFacts.map((f) => f.patternName);
  assert.ok(names.includes('ExtendedContinuousInteractionPattern'), `missing extended-duration fact in ${names}`);
  assert.ok(names.includes('RepeatedDiscreteInputPattern'), `missing repetition fact in ${names}`);
  assert.equal(store._reflections.length, 1);
});

test('E2E: "The Return" — leaving an extended session triggers the You-are-here moment', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 23, 30, 0); // rest period
  // 40 distinct-enough actions => Repetition never trips; ExtendedDuration is the acting pattern.
  const script = longSession({
    startAt,
    packageNameHash: 'hash:reader',
    durationMs: 40 * 60_000,
    scrolls: 40,
    actions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
  });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('ret');
  const clock = fixedClock(lastAt + 1_000);

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider([{ choice: 'Exit' }], ids, clock),
    store: createMemoryStore(),
    ids,
    clock,
    config: { context: { restPeriods: REST_PERIODS } },
  });

  const outcomes = await pipeline.tick();
  const exitFromExtended = outcomes.find(
    (o) =>
      o.kind === 'Choice' &&
      o.pattern.structuralName === 'ExtendedContinuousInteractionPattern' &&
      o.choice.choice === 'Exit',
  );
  assert.ok(exitFromExtended, 'expected an Exit choice on an ExtendedContinuousInteractionPattern');
  if (exitFromExtended && exitFromExtended.kind === 'Choice') {
    assert.deepEqual(exitFromExtended.returnMoment, { text: 'You are here', hapticBeats: 1, autoDismissMs: 2_000 });
  }
});

test('E2E: rapid app switching surfaces RapidRepeatedTransition as a structural pattern', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 6, 14, 0, 0); // afternoon, not a rest period
  const script = rapidSwitching({
    startAt,
    apps: ['hash:a', 'hash:b', 'hash:c'],
    switches: 12,
    everyMs: 3_000,
  });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('e2e2');
  const clock = fixedClock(lastAt + 1_000);
  const store = createMemoryStore();

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider([{ choice: 'Continue' }], ids, clock),
    store,
    ids,
    clock,
  });

  const outcomes = await pipeline.tick();
  const sawRapid = outcomes.some(
    (o) => o.kind !== 'NoPattern' && o.pattern.structuralName === 'RapidRepeatedTransition',
  );
  assert.ok(sawRapid, 'expected a RapidRepeatedTransition pattern from 12 quick switches');
});

test('E2E: a quiet event stream yields only NoPattern outcomes — Silence by absence', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 6, 10, 0, 0);
  const script = longSession({ startAt, packageNameHash: 'hash:calm', durationMs: 3 * 60_000, scrolls: 2 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('e2e3');
  const clock = fixedClock(lastAt + 1_000);

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider([], ids, clock),
    store: createMemoryStore(),
    ids,
    clock,
  });

  const outcomes = await pipeline.tick();
  assert.ok(outcomes.every((o) => o.kind === 'NoPattern'));
});
