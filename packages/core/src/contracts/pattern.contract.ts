/**
 * CONTRACT 3 / 8 — PATTERN  (FROZEN — do not modify)
 *
 * Pipeline stage: [PATTERN]
 * Data boundary : Layer 2 — Derived Structure (metrics only).
 *
 * Invariants enforced here:
 *  - I-07 Reflection, Not Judgment: a Pattern names an objective *structure*
 *    ("RapidRepeatedTransition"), never a verdict about the person.
 *  - I-11 Structural Naming Only: `structuralName` MUST pass
 *    `assertStructuralName()` — interpretive words ("doomscrolling", "addiction",
 *    "compulsive", "anxiety"...) are rejected.
 *  - I-02 Evidence Before Interpretation: every Pattern is fully traceable to raw
 *    Events via `supportingEventIds`.
 */

export const PATTERN_SCHEMA_VERSION = '1.0.0' as const;

export type PatternCategory =
  | 'Repetition'
  | 'RapidTransition'
  | 'ExtendedDuration'
  | 'TemporalDensity';

export interface Pattern {
  readonly id: string;
  readonly detectedAt: number;
  readonly category: PatternCategory;
  readonly structuralName: string; // e.g., "RapidRepeatedTransition"
  readonly metrics: {
    readonly eventDensity: number;
    readonly transitionCount: number;
    readonly totalDurationMs: number;
    readonly deviationFromBaselineRatio: number;
  };
  readonly confidenceScore: number; // 0.0 - 1.0
  readonly supportingEventIds: readonly string[];
  readonly schemaVersion: string;
}
