/**
 * STAGE 4 — [INTERVENTION CANDIDATE]   (pure, state-free)
 *
 * Turns a Pattern + its Context into a candidate iff it is structurally salient
 * enough to be *worth considering*. A candidate is NOT a decision to act —
 * Stage 5 still decides and defaults to Silence (I-04).
 *
 * `salienceScore` blends STRUCTURAL signals only (I-02):
 *  - how sure the structure is (`pattern.confidenceScore`);
 *  - how far it sits past the person's own baseline (normalised deviation);
 *  - a per-category weight (a long continuous session is a bigger structural
 *    fact than a short repeated tap);
 * then amplified by context: a user-defined rest period, and how long the phone
 * has been in an unbroken session. Nothing here reads an inferred mental state.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import { INTERVENTION_CANDIDATE_SCHEMA_VERSION } from '../contracts/intervention-candidate.contract.ts';
import type { Pattern, PatternCategory } from '../contracts/pattern.contract.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface CandidateGeneratorConfig {
  /** Below this salience, no candidate is generated at all. */
  readonly minSalience: number;
  readonly weights: {
    readonly confidence: number;
    readonly deviation: number;
    readonly category: number;
    /** deviation-from-baseline ratio mapping to a full normalised deviation of 1. */
    readonly deviationFullRatio: number;
  };
  readonly categoryWeight: Readonly<Record<PatternCategory, number>>;
  readonly amplifiers: {
    /** Added to the amplifier when Context.temporal.isUserDefinedRestPeriod. */
    readonly restPeriod: number;
    /** elapsedSinceLastUnlockMs mapping to the full unbroken-session amplifier. */
    readonly unbrokenSessionFullMs: number;
    readonly unbrokenSessionBump: number;
  };
}

export const DEFAULT_CANDIDATE_CONFIG: CandidateGeneratorConfig = Object.freeze({
  minSalience: 0.3,
  weights: { confidence: 0.45, deviation: 0.35, category: 0.2, deviationFullRatio: 3 },
  categoryWeight: Object.freeze({
    ExtendedDuration: 1.0,
    RapidTransition: 0.9,
    TemporalDensity: 0.7,
    Repetition: 0.6,
  }),
  amplifiers: {
    restPeriod: 0.4,
    unbrokenSessionFullMs: 90 * 60_000,
    unbrokenSessionBump: 0.3,
  },
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function generateCandidate(
  pattern: Pattern,
  context: Context,
  ids: IdFactory,
  clock: Clock,
  config: CandidateGeneratorConfig = DEFAULT_CANDIDATE_CONFIG,
): InterventionCandidate | null {
  const w = config.weights;
  const deviationNorm = clamp01((pattern.metrics.deviationFromBaselineRatio - 1) / (w.deviationFullRatio - 1));
  const categoryWeight = config.categoryWeight[pattern.category] ?? 0.5;

  const structural = clamp01(
    w.confidence * clamp01(pattern.confidenceScore) + w.deviation * deviationNorm + w.category * categoryWeight,
  );

  const a = config.amplifiers;
  const amplifier =
    1 +
    (context.temporal.isUserDefinedRestPeriod ? a.restPeriod : 0) +
    a.unbrokenSessionBump * clamp01(context.sequence.elapsedSinceLastUnlockMs / a.unbrokenSessionFullMs);

  const salienceScore = clamp01(structural * amplifier);
  if (salienceScore < config.minSalience) return null;

  return {
    id: ids.uuid(),
    generatedAt: clock.now(),
    patternId: pattern.id,
    contextId: context.id,
    salienceScore,
    schemaVersion: INTERVENTION_CANDIDATE_SCHEMA_VERSION,
  };
}
