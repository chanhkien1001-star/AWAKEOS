import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline } from '../src/pipeline/pipeline.ts';
import { createMemoryStore } from '../src/adapters-stub/memory-store.ts';
import { createScriptedEventSource } from '../src/adapters-stub/scripted-event-source.ts';
import { createScriptedChoiceProvider } from '../src/adapters-stub/scripted-choice-provider.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';
import { longSession, matureBaseline, resetEventIds } from './helpers.ts';

const REST_PERIODS = { windows: [{ startHour: 23, endHour: 7 }] };

test('Step 3: arbitration picks the broader structure and suppresses its facets', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 23, 0, 0);
  // repeated "scroll" -> Repetition fires; a 40-min session -> ExtendedDuration fires too.
  const script = longSession({ startAt, packageNameHash: 'hash:app', durationMs: 40 * 60_000, scrolls: 60 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('arb');
  const clock = fixedClock(lastAt + 5_000);

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    choiceProvider: createScriptedChoiceProvider(Array.from({ length: 40 }, () => ({ choice: 'Exit' as const })), ids, clock),
    store: createMemoryStore(),
    ids,
    clock,
    getBaseline: () => matureBaseline({ now: clock.now(), timeFrame: '18:00-24:00', sessionMinutes: 12 }),
    config: { context: { restPeriods: REST_PERIODS } },
  });

  const outcomes = await pipeline.tick();

  const withSubsumption = outcomes.find(
    (o) =>
      o.kind !== 'NoCandidate' &&
      'suppressed' in o &&
      o.suppressed.some((s) => s.reason === 'SubsumedByBroaderPattern' && s.pattern.category === 'Repetition'),
  );
  assert.ok(withSubsumption, 'expected a Repetition pattern subsumed by the broader ExtendedDuration structure');
  if (withSubsumption && 'pattern' in withSubsumption) {
    assert.equal(withSubsumption.pattern.category, 'ExtendedDuration');
  }
});

test('I-01: the more the person consciously chooses "Continue", the quieter the system gets', async () => {
  resetEventIds();
  const startAt = Date.UTC(2026, 0, 5, 23, 0, 0);
  const script = longSession({ startAt, packageNameHash: 'hash:app', durationMs: 50 * 60_000, scrolls: 80 });
  const lastAt = script[script.length - 1]!.occurredAt;

  const ids = sequentialIdFactory('cont');
  const clock = fixedClock(lastAt + 5_000);

  const pipeline = createPipeline({
    eventSource: createScriptedEventSource(script),
    // the person keeps consciously choosing to continue
    choiceProvider: createScriptedChoiceProvider(Array.from({ length: 80 }, () => ({ choice: 'Continue' as const })), ids, clock),
    store: createMemoryStore(),
    ids,
    clock,
    getBaseline: () => matureBaseline({ now: clock.now(), timeFrame: '18:00-24:00', sessionMinutes: 12 }),
    config: { context: { restPeriods: REST_PERIODS } },
  });

  const outcomes = await pipeline.tick();
  const acting = outcomes.filter((o) => o.kind === 'Choice' || o.kind === 'Silence');

  const firstActingIsIntervene = acting[0]?.kind === 'Choice';
  assert.ok(firstActingIsIntervene, 'the system should open at least one Awareness Window before backing off');

  // after the early windows, fatigue driven by the person's own "Continue" choices
  // takes the system to Silence for that structure.
  const laterSilence = acting
    .slice(1)
    .find((o) => o.kind === 'Silence' && o.decision.decisionReason === 'InterventionFatigue');
  assert.ok(laterSilence, 'repeated conscious Continue should quiet the system (InterventionFatigue)');

  // and it never opens more windows than it falls silent — minimum necessary intervention (I-05)
  const choices = acting.filter((o) => o.kind === 'Choice').length;
  const silences = acting.filter((o) => o.kind === 'Silence').length;
  assert.ok(silences >= choices, `expected Silence (${silences}) to dominate Choice (${choices}) once fatigued`);
});
