import test from 'node:test';
import assert from 'node:assert/strict';

import type { Context } from '../src/contracts/context.contract.ts';
import type { InterventionCandidate } from '../src/contracts/intervention-candidate.contract.ts';
import type { Pattern, PatternCategory } from '../src/contracts/pattern.contract.ts';
import { decidePolicy, DEFAULT_POLICY_CONFIG, type PolicyInput } from '../src/engines/policy-engine.ts';
import type { PriorInterventionSummary } from '../src/engines/fatigue.ts';

function pattern(confidence: number, deviation: number, category: PatternCategory = 'ExtendedDuration'): Pattern {
  return {
    id: 'p1',
    detectedAt: 0,
    category,
    structuralName: category === 'ExtendedDuration' ? 'ExtendedContinuousInteractionPattern' : 'RapidRepeatedTransition',
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

const NOW = 10_000_000;
const prior = (ageMs: number, category: PatternCategory, choice?: PriorInterventionSummary['choice']): PriorInterventionSummary =>
  choice === undefined ? { triggeredAt: NOW - ageMs, category } : { triggeredAt: NOW - ageMs, category, choice };

const baseInput = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  candidate: candidate(0.9),
  pattern: pattern(0.9, 3),
  context: context(60 * 60_000, true, 5),
  priorInterventions: [],
  now: NOW,
  ...over,
});

test('I-04: Silence is a normal return value, never thrown', () => {
  const { decision } = decidePolicy(baseInput({ candidate: candidate(0.01), pattern: pattern(0.05, 1) }));
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
  const priors = [prior(1_000, 'ExtendedDuration'), prior(2_000, 'ExtendedDuration'), prior(3_000, 'ExtendedDuration')];
  const { decision } = decidePolicy(baseInput({ priorInterventions: priors }));
  assert.equal(decision.decision, 'Silence');
  assert.equal(decision.decisionReason, 'InterventionFatigue');
  assert.ok(decision.fatigueIndex > DEFAULT_POLICY_CONFIG.maxFatigueLimit);
});

test('interventions outside the fatigue window do not accrue fatigue', () => {
  const old = [prior(4 * 60 * 60_000, 'ExtendedDuration'), prior(5 * 60 * 60_000, 'ExtendedDuration')];
  const { decision } = decidePolicy(baseInput({ priorInterventions: old }));
  assert.equal(decision.fatigueIndex, 0);
  assert.equal(decision.decision, 'Intervene');
});

test('fatigue decays: an intervention several half-lives ago barely counts', () => {
  const fresh = decidePolicy(baseInput({ priorInterventions: [prior(60_000, 'ExtendedDuration'), prior(90_000, 'ExtendedDuration')] }));
  const stale = decidePolicy(baseInput({
    priorInterventions: [prior(150 * 60_000, 'ExtendedDuration'), prior(160 * 60_000, 'ExtendedDuration')],
  }));
  assert.ok(stale.decision.fatigueIndex < fresh.decision.fatigueIndex);
});

test('I-01: one conscious "Continue" quiets the SAME structure, but not another', () => {
  const priors = [prior(30_000, 'ExtendedDuration', 'Continue')];

  const sameCategory = decidePolicy(baseInput({ priorInterventions: priors }));
  assert.equal(sameCategory.decision.decision, 'Silence');
  assert.equal(sameCategory.decision.decisionReason, 'InterventionFatigue');

  const otherCategory = decidePolicy(
    baseInput({ priorInterventions: priors, pattern: pattern(0.9, 3, 'RapidTransition') }),
  );
  assert.equal(otherCategory.decision.decision, 'Intervene');
});

test('choice feedback only ever raises fatigue: "Continue" weighs more than "Exit"', () => {
  const afterContinue = decidePolicy(baseInput({ priorInterventions: [prior(30_000, 'ExtendedDuration', 'Continue')] }));
  const afterExit = decidePolicy(baseInput({ priorInterventions: [prior(30_000, 'ExtendedDuration', 'Exit')] }));
  assert.ok(afterContinue.decision.fatigueIndex > afterExit.decision.fatigueIndex);
});

test('calculatedEligibility equals confidence * potentialValue * contextRelevance and stays in [0,1]', () => {
  const { decision, trace } = decidePolicy(baseInput());
  const expected = trace.patternConfidence * trace.potentialValue * trace.contextRelevance;
  assert.ok(Math.abs(decision.calculatedEligibility - expected) < 1e-9);
  assert.ok(decision.calculatedEligibility >= 0 && decision.calculatedEligibility <= 1);
});

test('DecisionScore == Eligibility - InterruptionCost - InterventionFatigue', () => {
  const { trace } = decidePolicy(baseInput({ priorInterventions: [prior(30_000, 'ExtendedDuration')] }));
  assert.ok(
    Math.abs(trace.decisionScore - (trace.eligibility - trace.interruptionCost - trace.interventionFatigue)) < 1e-9,
  );
});
