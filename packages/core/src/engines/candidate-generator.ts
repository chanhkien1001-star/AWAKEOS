/**
 * STAGE 4 — [INTERVENTION CANDIDATE]   (pure)   ***STUB LOGIC***
 *
 * Turns a Pattern + its Context into a candidate iff it is structurally salient
 * enough to be *worth considering*. Producing a candidate is NOT a decision to
 * act — Stage 5 still decides, and defaults to Silence (I-04).
 *
 * `salienceScore` is a function of structural metrics only (I-02): pattern
 * confidence, how far it deviates from baseline, and whether the Context says the
 * user marked this time as rest.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { InterventionCandidate } from '../contracts/intervention-candidate.contract.ts';
import { INTERVENTION_CANDIDATE_SCHEMA_VERSION } from '../contracts/intervention-candidate.contract.ts';
import type { Pattern } from '../contracts/pattern.contract.ts';
import type { Clock } from '../util/clock.ts';
import type { IdFactory } from '../util/id.ts';

export interface CandidateGeneratorConfig {
  /** Below this salience, no candidate is generated at all. */
  readonly minSalience: number;
  /** Multiplier applied when Context.temporal.isUserDefinedRestPeriod is true. */
  readonly restPeriodWeight: number;
}

export const DEFAULT_CANDIDATE_CONFIG: CandidateGeneratorConfig = Object.freeze({
  minSalience: 0.3,
  restPeriodWeight: 1.5,
});

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function generateCandidate(
  pattern: Pattern,
  context: Context,
  ids: IdFactory,
  clock: Clock,
  config: CandidateGeneratorConfig = DEFAULT_CANDIDATE_CONFIG,
): InterventionCandidate | null {
  const deviation = clamp01((pattern.metrics.deviationFromBaselineRatio - 1) / 2);
  const base = 0.5 * pattern.confidenceScore + 0.5 * deviation;
  const weighted = context.temporal.isUserDefinedRestPeriod
    ? base * config.restPeriodWeight
    : base;
  const salienceScore = clamp01(weighted);

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
