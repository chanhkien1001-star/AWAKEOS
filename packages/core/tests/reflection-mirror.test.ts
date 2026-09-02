import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReflectionMirror, type PatternObservation } from '../src/engines/reflection-mirror.ts';
import { assertNoJudgment } from '../src/invariants/invariants.ts';
import { fixedClock } from '../src/util/clock.ts';
import { sequentialIdFactory } from '../src/util/id.ts';

const NOW = Date.UTC(2026, 4, 10, 12, 0, 0);
const deps = () => ({ ids: sequentialIdFactory('m'), clock: fixedClock(NOW) });

let n = 0;
function obs(over: Partial<PatternObservation>): PatternObservation {
  return {
    patternId: `p${++n}`,
    observedAt: NOW - 1_000,
    category: 'ExtendedDuration',
    structuralName: 'ExtendedContinuousInteractionPattern',
    deviationFromBaselineRatio: 2,
    timeFrame: '18:00-24:00',
    dayOfWeek: 3,
    isUserDefinedRestPeriod: false,
    ...over,
  };
}

test('groups observations by structural name and counts them', () => {
  const { ids, clock } = deps();
  const observations = [
    obs({ structuralName: 'ExtendedContinuousInteractionPattern', dayOfWeek: 1 }),
    obs({ structuralName: 'ExtendedContinuousInteractionPattern', dayOfWeek: 2 }),
    obs({ structuralName: 'RapidRepeatedTransition', category: 'RapidTransition', dayOfWeek: 1 }),
  ];
  const mirror = buildReflectionMirror({ observations, timeRangeStart: NOW - 60_000, timeRangeEnd: NOW }, ids, clock);
  const ext = mirror.observableFacts.find((f) => f.patternName === 'ExtendedContinuousInteractionPattern')!;
  assert.equal(ext.occurrenceCount, 2);
  assert.match(ext.contextSummary, /on 2 days/);
});

test('observations outside the range are excluded', () => {
  const { ids, clock } = deps();
  const observations = [obs({ observedAt: NOW - 1_000 }), obs({ observedAt: NOW - 10 * 24 * 60 * 60_000 })];
  const mirror = buildReflectionMirror({ observations, timeRangeStart: NOW - 60_000, timeRangeEnd: NOW }, ids, clock);
  assert.equal(mirror.observableFacts[0]?.occurrenceCount, 1);
});

test('I-07: facts are ordered by time-of-day frame, never by occurrence count', () => {
  const { ids, clock } = deps();
  const observations = [
    // evening structure occurs many times
    ...Array.from({ length: 9 }, (_, i) => obs({ structuralName: 'ExtendedContinuousInteractionPattern', timeFrame: '18:00-24:00', dayOfWeek: (i % 7) + 1 })),
    // morning structure occurs rarely
    obs({ structuralName: 'HighTemporalEventDensity', category: 'TemporalDensity', timeFrame: '06:00-12:00' }),
  ];
  const mirror = buildReflectionMirror({ observations, timeRangeStart: NOW - 60_000, timeRangeEnd: NOW }, ids, clock);
  // morning (rarer) comes first because its time frame is earlier — not ranked by count
  assert.deepEqual(
    mirror.observableFacts.map((f) => f.patternName),
    ['HighTemporalEventDensity', 'ExtendedContinuousInteractionPattern'],
  );
});

test('I-07: the mirror carries no judgment-shaped fields or interpretive wording', () => {
  const { ids, clock } = deps();
  const mirror = buildReflectionMirror(
    { observations: [obs({ isUserDefinedRestPeriod: true })], timeRangeStart: NOW - 60_000, timeRangeEnd: NOW },
    ids,
    clock,
  );
  assert.doesNotThrow(() => assertNoJudgment(mirror));
  assert.match(mirror.observableFacts[0]!.contextSummary, /rest/); // a plain fact, phrased neutrally
});

test('an empty range yields an empty mirror, not an error', () => {
  const { ids, clock } = deps();
  const mirror = buildReflectionMirror({ observations: [], timeRangeStart: NOW - 60_000, timeRangeEnd: NOW }, ids, clock);
  assert.equal(mirror.observableFacts.length, 0);
  assert.equal(mirror.timeRangeStart, NOW - 60_000);
});
