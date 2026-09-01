/**
 * STAGE 5 — [INTERVENTION POLICY]   (pure)   ***DECISION MATHS IS REAL***
 *
 * This implements Section 4 of the specification exactly:
 *
 *   Eligibility   = PatternConfidence * PotentialValue * ContextRelevance
 *   DecisionScore = Eligibility - InterruptionCost - InterventionFatigue
 *
 *   IF DecisionScore <= Threshold  OR  InterventionFatigue > MaxFatigueLimit
 *        -> Silence
 *   ELSE -> Intervene
 *
 * `PotentialValue`, `ContextRelevance`, `InterruptionCost` and `InterventionFatigue`
 * are derived here from STRUCTURAL inputs only (I-02) with tunable weights; the
 * decision rule itself is fixed and must not be "softened" to intervene more.
 * Silence is a first-class success (I-04) and every Silence carries a reason.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import type { InterventionPolicyDecision } from '../contracts/intervention-policy.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';

export interface PolicyConfig {
  /** DecisionScore must be strictly greater than this to Intervene. */
  readonly threshold: number;
  /** InterventionFatigue above this forces Silence regardless of DecisionScore. */
  readonly maxFatigueLimit: number;
  readonly weights: {
    readonly potentialValueFromSalience: number;
    readonly potentialValueFromDeviation: number;
    readonly contextRelevanceRestBonus: number;
    /** activeSubjectDurationMs that maps to a full +0.5 relevance term. */
    readonly contextRelevanceDurationFullMs: number;
    readonly interruptionBaseCost: number;
    readonly interruptionCostPerRecentEvent: number;
  };
  readonly fatigue: {
    /** Trailing window over which prior interventions accrue fatigue. */
    readonly windowMs: number;
    readonly costPerRecentIntervention: number;
  };
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = Object.freeze({
  threshold: 0.15,
  maxFatigueLimit: 0.6,
  weights: {
    potentialValueFromSalience: 0.6,
    potentialValueFromDeviation: 0.4,
    contextRelevanceRestBonus: 0.3,
    contextRelevanceDurationFullMs: 45 * 60_000,
    interruptionBaseCost: 0.1,
    interruptionCostPerRecentEvent: 0.005,
  },
  fatigue: {
    windowMs: 3 * 60 * 60_000, // 3h
    costPerRecentIntervention: 0.2,
  },
});

export interface PolicyInput {
  readonly candidate: InterventionCandidate;
  readonly pattern: Pattern;
  readonly context: Context;
  /** `triggeredAt` of interventions already shown, any order. */
  readonly recentInterventionTimestamps: readonly number[];
  /** Evaluation time (epoch ms). */
  readonly now: number;
  readonly config?: PolicyConfig;
}

/** Diagnostic breakdown — NOT a frozen contract; safe to evolve. */
export interface PolicyTrace {
  readonly patternConfidence: number;
  readonly potentialValue: number;
  readonly contextRelevance: number;
  readonly eligibility: number;
  readonly interruptionCost: number;
  readonly interventionFatigue: number;
  readonly decisionScore: number;
  readonly threshold: number;
  readonly maxFatigueLimit: number;
}

export interface PolicyResult {
  readonly decision: InterventionPolicyDecision;
  readonly trace: PolicyTrace;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function potentialValue(input: PolicyInput, c: PolicyConfig): number {
  const deviationNorm = clamp01((input.pattern.metrics.deviationFromBaselineRatio - 1) / 2);
  return clamp01(
    c.weights.potentialValueFromSalience * input.candidate.salienceScore +
      c.weights.potentialValueFromDeviation * deviationNorm,
  );
}

function contextRelevance(input: PolicyInput, c: PolicyConfig): number {
  const rest = input.context.temporal.isUserDefinedRestPeriod ? c.weights.contextRelevanceRestBonus : 0;
  const durationTerm =
    0.5 * clamp01(input.context.sequence.activeSubjectDurationMs / c.weights.contextRelevanceDurationFullMs);
  return clamp01(0.4 + rest + durationTerm);
}

function interruptionCost(input: PolicyInput, c: PolicyConfig): number {
  return clamp01(
    c.weights.interruptionBaseCost +
      c.weights.interruptionCostPerRecentEvent * input.context.sequence.eventsInLastWindow,
  );
}

function interventionFatigue(input: PolicyInput, c: PolicyConfig): number {
  const since = input.now - c.fatigue.windowMs;
  const recent = input.recentInterventionTimestamps.filter((t) => t >= since).length;
  return recent * c.fatigue.costPerRecentIntervention;
}

export function decidePolicy(input: PolicyInput): PolicyResult {
  const c = input.config ?? DEFAULT_POLICY_CONFIG;

  const patternConfidence = clamp01(input.pattern.confidenceScore);
  const pv = potentialValue(input, c);
  const cr = contextRelevance(input, c);
  const eligibility = patternConfidence * pv * cr;

  const cost = interruptionCost(input, c);
  const fatigue = interventionFatigue(input, c);
  const decisionScore = eligibility - cost - fatigue;

  let decisionType: InterventionPolicyDecision['decision'];
  let reason: InterventionPolicyDecision['decisionReason'];

  if (fatigue > c.maxFatigueLimit) {
    decisionType = 'Silence';
    reason = 'InterventionFatigue';
  } else if (decisionScore <= c.threshold) {
    decisionType = 'Silence';
    reason = 'EpistemicUncertainty';
  } else {
    decisionType = 'Intervene';
    reason = 'HighSalienceThresholdMet';
  }

  return {
    decision: {
      candidateId: input.candidate.id,
      decision: decisionType,
      decisionReason: reason,
      calculatedEligibility: eligibility,
      interruptionCost: cost,
      fatigueIndex: fatigue,
    },
    trace: {
      patternConfidence,
      potentialValue: pv,
      contextRelevance: cr,
      eligibility,
      interruptionCost: cost,
      interventionFatigue: fatigue,
      decisionScore,
      threshold: c.threshold,
      maxFatigueLimit: c.maxFatigueLimit,
    },
  };
}
