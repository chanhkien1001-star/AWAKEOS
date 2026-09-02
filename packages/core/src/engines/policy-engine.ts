/**
 * STAGE 5 — [INTERVENTION POLICY]   (pure)   ***DECISION MATHS IS REAL***
 *
 * Implements Section 4 of the specification exactly:
 *
 *   Eligibility   = PatternConfidence * PotentialValue * ContextRelevance
 *   DecisionScore = Eligibility - InterruptionCost - InterventionFatigue
 *
 *   IF DecisionScore <= Threshold  OR  InterventionFatigue > MaxFatigueLimit
 *        -> Silence   (reason: EpistemicUncertainty | InterventionFatigue)
 *   ELSE -> Intervene (reason: HighSalienceThresholdMet)
 *
 * The rule above is FIXED and must never be softened to intervene more. The four
 * quantities feeding it are derived here from STRUCTURAL inputs only (I-02) with
 * tunable weights:
 *
 *  - PotentialValue      structural salience + how far past the personal baseline.
 *  - ContextRelevance    rest period + long active app + long unbroken session.
 *  - InterruptionCost    base + cost that ramps once the person is mid-burst.
 *  - InterventionFatigue delegated to `computeInterventionFatigue` — decayed,
 *                        per-category, and raised by the person's own prior
 *                        choices (I-01 / I-05).
 *
 * Silence is a first-class success (I-04); every Silence carries a reason.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import type { InterventionPolicyDecision } from '../contracts/intervention-policy.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';
import {
  computeInterventionFatigue,
  fatigueIndexFor,
  DEFAULT_FATIGUE_CONFIG,
  type FatigueConfig,
  type FatigueResult,
  type PriorInterventionSummary,
} from './fatigue.ts';

export interface PolicyConfig {
  /** DecisionScore must be strictly greater than this to Intervene. */
  readonly threshold: number;
  /** InterventionFatigue above this forces Silence regardless of DecisionScore. */
  readonly maxFatigueLimit: number;
  readonly weights: {
    readonly potentialValueFromSalience: number;
    readonly potentialValueFromDeviation: number;
    /** deviation-from-baseline ratio that maps to a full normalised deviation of 1. */
    readonly deviationFullRatio: number;
    readonly contextRelevanceBase: number;
    readonly contextRelevanceRestBonus: number;
    /** activeSubjectDurationMs mapping to the full active-app relevance term. */
    readonly contextRelevanceActiveAppFullMs: number;
    /** elapsedSinceLastUnlockMs mapping to the full unbroken-session relevance term. */
    readonly contextRelevanceUnbrokenSessionFullMs: number;
    readonly interruptionBaseCost: number;
    readonly interruptionCostPerRecentEvent: number;
    /** events-in-last-minute above which the per-event cost slope doubles. */
    readonly interruptionBurstThreshold: number;
  };
  readonly fatigue: FatigueConfig;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = Object.freeze({
  threshold: 0.15,
  maxFatigueLimit: 0.6,
  weights: {
    potentialValueFromSalience: 0.6,
    potentialValueFromDeviation: 0.4,
    deviationFullRatio: 3,
    contextRelevanceBase: 0.3,
    contextRelevanceRestBonus: 0.3,
    contextRelevanceActiveAppFullMs: 45 * 60_000,
    contextRelevanceUnbrokenSessionFullMs: 90 * 60_000,
    interruptionBaseCost: 0.1,
    interruptionCostPerRecentEvent: 0.005,
    interruptionBurstThreshold: 30,
  },
  fatigue: DEFAULT_FATIGUE_CONFIG,
});

export interface PolicyInput {
  readonly candidate: InterventionCandidate;
  readonly pattern: Pattern;
  readonly context: Context;
  /** The person's recent intervention history (any order). */
  readonly priorInterventions: readonly PriorInterventionSummary[];
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
  readonly fatigueBreakdown: FatigueResult;
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
  const w = c.weights;
  const deviationNorm = clamp01((input.pattern.metrics.deviationFromBaselineRatio - 1) / (w.deviationFullRatio - 1));
  return clamp01(w.potentialValueFromSalience * input.candidate.salienceScore + w.potentialValueFromDeviation * deviationNorm);
}

function contextRelevance(input: PolicyInput, c: PolicyConfig): number {
  const w = c.weights;
  const seq = input.context.sequence;
  const rest = input.context.temporal.isUserDefinedRestPeriod ? w.contextRelevanceRestBonus : 0;
  const activeApp = 0.35 * clamp01(seq.activeSubjectDurationMs / w.contextRelevanceActiveAppFullMs);
  const unbroken = 0.35 * clamp01(seq.elapsedSinceLastUnlockMs / w.contextRelevanceUnbrokenSessionFullMs);
  return clamp01(w.contextRelevanceBase + rest + activeApp + unbroken);
}

function interruptionCost(input: PolicyInput, c: PolicyConfig): number {
  const w = c.weights;
  const events = input.context.sequence.eventsInLastWindow;
  const burst = Math.max(0, events - w.interruptionBurstThreshold);
  return clamp01(w.interruptionBaseCost + w.interruptionCostPerRecentEvent * (events + burst));
}

export function decidePolicy(input: PolicyInput): PolicyResult {
  const c = input.config ?? DEFAULT_POLICY_CONFIG;

  const patternConfidence = clamp01(input.pattern.confidenceScore);
  const pv = potentialValue(input, c);
  const cr = contextRelevance(input, c);
  const eligibility = patternConfidence * pv * cr;

  const cost = interruptionCost(input, c);
  const fatigueBreakdown = computeInterventionFatigue(input.priorInterventions, input.now, c.fatigue);
  const fatigue = fatigueIndexFor(fatigueBreakdown, input.pattern.category);
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
      fatigueBreakdown,
      decisionScore,
      threshold: c.threshold,
      maxFatigueLimit: c.maxFatigueLimit,
    },
  };
}
