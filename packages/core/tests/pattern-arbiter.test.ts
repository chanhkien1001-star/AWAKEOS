import test from 'node:test';
import assert from 'node:assert/strict';

import type { Context } from '../src/contracts/context.contract.ts';
import type { Pattern, PatternCategory } from '../src/contracts/pattern.contract.ts';
import { arbitratePatterns, DEFAULT_ARBITER_CONFIG } from '../src/engines/pattern-arbiter.ts';

const CTX = { timestamp: 1_000 } as unknown as Context;

let n = 0;
function pat(category: PatternCategory, structuralName: string, confidence: number, deviation = 2): Pattern {
  return {
    id: `p${++n}`,
    detectedAt: 0,
    category,
    structuralName,
    metrics: { eventDensity: 0, transitionCount: 0, totalDurationMs: 0, deviationFromBaselineRatio: deviation },
    confidenceScore: confidence,
    supportingEventIds: [],
    schemaVersion: '1.0.0',
  };
}

test('nothing detected -> nothing selected', () => {
  const r = arbitratePatterns([], CTX);
  assert.equal(r.selected, null);
  assert.equal(r.suppressed.length, 0);
});

test('a single pattern above the floor is selected', () => {
  const r = arbitratePatterns([pat('RapidTransition', 'RapidRepeatedTransition', 0.5)], CTX);
  assert.equal(r.selected?.structuralName, 'RapidRepeatedTransition');
});

test('ExtendedDuration outranks a more-confident Repetition and subsumes it', () => {
  // Repetition is the more confident detection, but ExtendedDuration is the
  // broader structure — its category weight carries it past.
  const ext = pat('ExtendedDuration', 'ExtendedContinuousInteractionPattern', 0.6);
  const rep = pat('Repetition', 'RepeatedDiscreteInputPattern', 0.85);
  const r = arbitratePatterns([rep, ext], CTX);
  assert.equal(r.selected?.category, 'ExtendedDuration');
  assert.equal(r.suppressed.length, 1);
  assert.equal(r.suppressed[0]!.pattern.category, 'Repetition');
  assert.equal(r.suppressed[0]!.reason, 'SubsumedByBroaderPattern');
});

test('a co-occurring RapidTransition is outranked, not subsumed, by ExtendedDuration', () => {
  const ext = pat('ExtendedDuration', 'ExtendedContinuousInteractionPattern', 0.9);
  const rapid = pat('RapidTransition', 'RapidRepeatedTransition', 0.3);
  const r = arbitratePatterns([ext, rapid], CTX);
  assert.equal(r.selected?.category, 'ExtendedDuration');
  assert.equal(r.suppressed[0]!.reason, 'OutrankedBySalience');
});

test('when every score is below the arbitration floor, nothing is selected', () => {
  const weak = pat('Repetition', 'RepeatedDiscreteInputPattern', 0.05, 1);
  const r = arbitratePatterns([weak], CTX);
  assert.equal(r.selected, null);
  assert.equal(r.suppressed[0]!.reason, 'BelowArbitrationFloor');
});

test('deviation-from-baseline boosts the arbitration score', () => {
  const mild = pat('RapidTransition', 'RapidRepeatedTransition', 0.4, 1);
  const extreme = pat('RapidTransition', 'RapidRepeatedTransition', 0.4, DEFAULT_ARBITER_CONFIG.deviationFullRatio);
  const [mildScore] = arbitratePatterns([mild], CTX).scores;
  const [extremeScore] = arbitratePatterns([extreme], CTX).scores;
  assert.ok(extremeScore!.score > mildScore!.score);
});
