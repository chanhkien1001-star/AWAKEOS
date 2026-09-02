/**
 * STAGE 3/4 bridge — multi-pattern arbitration   (pure, state-free)
 *
 * One event can yield several `Pattern`s at once (a long session is often also a
 * dense one and a repetitive one). Only ONE Awareness Window may follow from an
 * event (I-05), so `arbitratePatterns` picks the single most salient structure
 * to carry forward — and marks the rest as suppressed, with a reason, so the
 * telemetry and reflection layers still see everything.
 *
 * Selection is NOT "most confident wins". It is:
 *
 *   arbitrationScore = confidence · categoryWeight · (1 + deviationBoost · normDeviation)
 *
 * and a broader structure SUBSUMES its facets: when `ExtendedDuration` is on
 * top, a co-occurring `Repetition` / `TemporalDensity` is the same phenomenon
 * seen from another angle, not a second reason to interrupt.
 *
 * This stage never invents meaning — it only ranks and de-duplicates structures.
 */

import type { Context } from '../contracts/context.contract.ts';
import type { Pattern, PatternCategory } from '../contracts/pattern.contract.ts';

export interface ArbiterConfig {
  readonly categoryWeight: Readonly<Record<PatternCategory, number>>;
  /** Extra arbitration weight per unit of normalised deviation-from-baseline. */
  readonly deviationBoost: number;
  /** Deviation ratio that maps to a full normalised deviation of 1. */
  readonly deviationFullRatio: number;
  /** Below this top score, nothing is selected. */
  readonly minArbitrationScore: number;
  /** category -> the categories it subsumes when they co-occur on one event. */
  readonly subsumes: Readonly<Partial<Record<PatternCategory, readonly PatternCategory[]>>>;
}

export const DEFAULT_ARBITER_CONFIG: ArbiterConfig = Object.freeze({
  categoryWeight: Object.freeze({
    ExtendedDuration: 1.0,
    RapidTransition: 0.9,
    TemporalDensity: 0.7,
    Repetition: 0.6,
  }),
  deviationBoost: 0.25,
  deviationFullRatio: 4,
  minArbitrationScore: 0.12,
  subsumes: Object.freeze({
    ExtendedDuration: ['Repetition', 'TemporalDensity'] as readonly PatternCategory[],
    // RapidTransition is a distinct phenomenon and subsumes nothing.
  }),
});

export type SuppressionReason = 'SubsumedByBroaderPattern' | 'OutrankedBySalience' | 'BelowArbitrationFloor';

export interface SuppressedPattern {
  readonly pattern: Pattern;
  readonly reason: SuppressionReason;
}

export interface ArbitrationResult {
  readonly selected: Pattern | null;
  readonly suppressed: readonly SuppressedPattern[];
  readonly scores: readonly { readonly patternId: string; readonly structuralName: string; readonly score: number }[];
}

function arbitrationScore(p: Pattern, cfg: ArbiterConfig): number {
  const weight = cfg.categoryWeight[p.category] ?? 0.5;
  const normDeviation = Math.max(0, Math.min(1, (p.metrics.deviationFromBaselineRatio - 1) / (cfg.deviationFullRatio - 1)));
  return p.confidenceScore * weight * (1 + cfg.deviationBoost * normDeviation);
}

export function arbitratePatterns(
  patterns: readonly Pattern[],
  _context: Context,
  config: ArbiterConfig = DEFAULT_ARBITER_CONFIG,
): ArbitrationResult {
  if (patterns.length === 0) return { selected: null, suppressed: [], scores: [] };

  const ranked = patterns
    .map((p) => ({ p, score: arbitrationScore(p, config) }))
    .sort((a, b) => b.score - a.score);

  const scores = ranked.map(({ p, score }) => ({ patternId: p.id, structuralName: p.structuralName, score }));
  const top = ranked[0]!;

  if (top.score < config.minArbitrationScore) {
    return {
      selected: null,
      suppressed: ranked.map(({ p }) => ({ pattern: p, reason: 'BelowArbitrationFloor' as const })),
      scores,
    };
  }

  const subsumed = new Set<PatternCategory>(config.subsumes[top.p.category] ?? []);
  const suppressed: SuppressedPattern[] = ranked.slice(1).map(({ p }) => ({
    pattern: p,
    reason: subsumed.has(p.category) ? 'SubsumedByBroaderPattern' : 'OutrankedBySalience',
  }));

  return { selected: top.p, suppressed, scores };
}
