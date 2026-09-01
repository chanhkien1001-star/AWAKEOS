import test from 'node:test';
import assert from 'node:assert/strict';

import type { Context } from '../src/contracts/context.contract.ts';
import type { InterventionCandidate } from '../src/contracts/intervention-candidate.contract.ts';
import type { Pattern } from '../src/contracts/pattern.contract.ts';
import { decidePolicy, DEFAULT_POLICY_CONFIG, type PolicyInput } from '../src/engines/policy-engine.ts';

function pattern(confidence: number, deviation: number): Pattern {
  return {
    id: 'p1',
    detectedAt: 0,
    category: 'ExtendedDuration',
    structuralName: 'ExtendedContinuousInteractionPattern',
    metrics: { eventDensity: 0, transitionCount: 0, totalDurationMs: 60 * 60_000, deviationFromBaselineRatio: deviation },
    confidenceScore: confidence,
    supportingEventIds: ['ev-1'],
    schemaVersion: '1.0.0',
  };
}

function context(activeMs: number, rest: boolean, recentEvents: number): Context {
  return {
    id: 'c1',
    timestamp: 1_000_000,
    referenceEventId: 'ev-1',
    temporal: { timeFrame: '18:00-24:00', dayOfWeek: 3, isUserDefinedRestPeriod: rest },
    sequence: { eventsInLastWindow: recentEvents, elapsedSinceLastUnlockMs: activeMs, activeSubjectDurationMs: activeMs },
    schemaVersion: '1.0.0',
  };
}

function candidate(salience: number): InterventionCandidate {
  return { id: 'cand1', generatedAt: 0, patternId: 'p1', contextId: 'c1', salienceScore: salience, schemaVersion: '1.0.0' };
}

const baseInput = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  candidate: candidate(0.9),
  pattern: pattern(0.9, 3),
  context: context(60 * 60_000, true, 5),
  recentInterventionTimestamps: [],
  now: 2_000_000,
  ...over,
});

test('I-04: Silence is a normal return value, never thrown', () => {
  const weak = baseInput({ candidate: candidate(0.01), pattern: pattern(0.05, 1) });
  const { decision } = decidePolicy(weak);
  assert.equal(decision.decision, 'Silence');
  assert.equal(decision.decisionReason, 'EpistemicUncertainty');
});

test('high eligibility, no fatigue -> Intervene / HighSalienceThresholdMet', () => {
  const { decision, trace } = decidePolicy(baseInput());
  assert.equal(decision.decision, 'Intervene');
  assert.equal(decision.decisionReason, 'HighSalienceThresholdMet');
  assert.ok(trace.decisionScore > DEFAULT_POLICY_CONFIG.threshold);
});

test('fatigue above MaxFatigueLimit forces Silence even with strong eligibility', () => {
  // 4 interventions within the 3h window * 0.2 = 0.8 > 0.6 limit
  const now = 10_000_000;
  const recent = [now - 1000, now - 2000, now - 3000, now - 4000];
  const { decision } = decidePolicy(baseInput({ now, recentInterventionTimestamps: recent }));
  assert.equal(decision.decision, 'Silence');
  assert.equal(decision.decisionReason, 'InterventionFatigue');
  assert.ok(decision.fatigueIndex > DEFAULT_POLICY_CONFIG.maxFatigueLimit);
});

test('interventions outside the fatigue window do not accrue fatigue', () => {
  const now = 10_000_000;
  const old = [now - 4 * 60 * 60_000, now - 5 * 60 * 60_000]; // older than 3h
  const { decision } = decidePolicy(baseInput({ now, recentInterventionTimestamps: old }));
  assert.equal(decision.fatigueIndex, 0);
  assert.equal(decision.decision, 'Intervene');
});

test('calculatedEligibility equals confidence * potentialValue * contextRelevance and stays in [0,1]', () => {
  const { decision, trace } = decidePolicy(baseInput());
  const expected = trace.patternConfidence * trace.potentialValue * trace.contextRelevance;
  assert.ok(Math.abs(decision.calculatedEligibility - expected) < 1e-9);
  assert.ok(decision.calculatedEligibility >= 0 && decision.calculatedEligibility <= 1);
});

test('DecisionScore == Eligibility - InterruptionCost - InterventionFatigue', () => {
  const { trace } = decidePolicy(baseInput());
  assert.ok(
    Math.abs(trace.decisionScore - (trace.eligibility - trace.interruptionCost - trace.interventionFatigue)) < 1e-9,
  );
});
